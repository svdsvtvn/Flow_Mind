import json
import os
from datetime import datetime
from functools import wraps

import groq
from flask import Flask, render_template, request, jsonify, g
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, auth, firestore, initialize_app

load_dotenv()
app = Flask(__name__, static_folder='static', template_folder='templates')

# Konfiguracja z Twoim ID projektu
firebase_config = {'projectId': 'ai-mind-mapper'}

db = None
try:
    if not firebase_admin._apps:
        if os.path.exists("serviceAccountKey.json"):
            cred = credentials.Certificate("serviceAccountKey.json")
            initialize_app(cred, firebase_config)
            print("✅ Init z serviceAccountKey.json")
        elif os.path.exists("firebase-admin-key.json"):
            cred = credentials.Certificate("firebase-admin-key.json")
            initialize_app(cred, firebase_config)
            print("✅ Init z firebase-admin-key.json")
        else:
            # Fallback dla środowiska chmurowego (Render)
            initialize_app(options=firebase_config)
            print("✅ Init default (cloud)")
    db = firestore.client()
except ValueError as e:
    db = firestore.client()
    print(f"ℹ️ Firebase Admin already initialized: {e}")
except Exception as e:
    print(f"⚠️ WARNING: Firebase Admin failed to initialize: {e}")
    print("ℹ️ The app will run without Firebase Admin authorization.")
    print("📝 REMINDER: Download serviceAccountKey.json from the Firebase console and add it to the project!")

client = groq.Groq(api_key=os.getenv("GROQ_API_KEY"))
GROQ_MODEL = "moonshotai/kimi-k2-instruct-0905"

def require_auth(f):
    """Decorator validating a Firebase token before executing the wrapped function."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({"error": "Brak tokena lub niepoprawny format"}), 401

        token = auth_header.split(' ')[1]
        
        try:
            decoded_token = auth.verify_id_token(token)
            uid = decoded_token['uid']
            g.user_id = uid
            print(f"✅ User verified: {g.user_id}")
        except Exception as e:
            print(f"❌ Token verification failed: {e}")
            return jsonify({"error": "Nieprawidłowy token"}), 403

        return f(*args, **kwargs)
    return decorated_function

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/generate-map', methods=['POST'])
@require_auth
def generate_map():
    """Generate a complete mind map for the requested topic."""
    topic = request.json.get('topic')
    emojis_enabled = request.json.get('emojisEnabled', False)
    
    if not topic:
        return jsonify({'error': 'Nie podano tematu'}), 400

    try:

        if emojis_enabled:
            system_prompt = f"""
            Jesteś ekspertem w tworzeniu zwięzłych, hierarchicznych map myśli na temat: "{topic}".
            
            KRYTYCZNE WYMAGANIA:
            1. Odpowiedz ZAWSZE w formacie JSON, bez żadnego dodatkowego tekstu.
            2. Każdy węzeł MUSI zawierać dwa pola: "text" (treść węzła) oraz "emoji" (jedno pasujące emoji Unicode).
            3. Struktura główna: {{"text": "{topic}", "emoji": "🧠", "children": [...]}}
            4. Każdy element w "children" również ma "text", "emoji" i opcjonalnie "children".
            5. Wybieraj emoji, które WIZUALNIE reprezentują dany temat (np. ☀️ dla światła, 🌙 dla ciemności, 📚 dla nauki).
            6. Używaj WYŁĄCZNIE pojedynczych emoji Unicode (np. "🔬", "💡", "🌍").
            7. Celuj w 2-4 poziomy zagnieżdzenia na start.
            
            Przykład prawidłowej struktury:
            {{
              "text": "Fotosynteza",
              "emoji": "🌱",
              "children": [
                {{"text": "Faza świetlna", "emoji": "☀️", "children": [...]}},
                {{"text": "Faza ciemna", "emoji": "🌙"}}
              ]
            }}
            """
        else:
            system_prompt = f"""
            Jesteś ekspertem w tworzeniu zwięzłych, hierarchicznych map myśli na temat: "{topic}".
            
            KRYTYCZNE WYMAGANIA:
            1. Odpowiedz ZAWSZE w formacie JSON, bez żadnego dodatkowego tekstu.
            2. Struktura główna: {{"content": "{topic}", "children": [...]}}
            3. Każdy węzeł ma klucz "content" z treścią. Węzły z podpunktami mają "children".
            4. Celuj w 2-4 poziomy zagnieżdzenia na start.
            
            Przykład prawidłowej struktury:
            {{
              "content": "Fotosynteza",
              "children": [
                {{"content": "Faza świetlna", "children": [...]}},
                {{"content": "Faza ciemna"}}
              ]
            }}
            """

        chat_completion = client.chat.completions.create(
            messages=[{"role": "system", "content": system_prompt}],
            model=GROQ_MODEL,
            response_format={"type": "json_object"},
            temperature=0.2
        )

        map_data_string = chat_completion.choices[0].message.content
        map_data = json.loads(map_data_string)
        
        if emojis_enabled:
            def add_emoji_to_content(node):
                """Recursively append an emoji to the content field."""
                emoji = node.get('emoji', '📌')
                text = node.get('text', node.get('content', ''))
                node['content'] = f"{emoji} {text}"
                
                node.pop('text', None)
                node.pop('emoji', None)
                
                if 'children' in node and isinstance(node['children'], list):
                    for child in node['children']:
                        add_emoji_to_content(child)
                
                return node
            
            map_data = add_emoji_to_content(map_data)
        
        return jsonify(map_data)

    except Exception as e:
        print(f"Groq error while generating the map: {e}")
        return jsonify({'error': 'Wystąpił błąd podczas komunikacji z AI.'}), 500

@app.route('/expand-node', methods=['POST'])
@require_auth
def expand_node():
    """Expand a single branch of the mind map."""
    data = request.json
    node_path = data.get('path')
    emojis_enabled = data.get('emojisEnabled', False)
    
    if not node_path:
        return jsonify({'error': 'Nie podano ścieżki do rozwinięcia'}), 400

    context = " -> ".join(node_path)

    try:

        if emojis_enabled:
            system_prompt = f"""
            Kontekst: "{context}". Wygeneruj TYLKO listę podpunktów dla OSTATNIEGO elementu.
            
            KRYTYCZNE WYMAGANIA:
            1. Odpowiedz w formacie JSON jako obiekt zawierający klucz "nodes" z listą.
            2. Każdy element listy MUSI zawierać "text" (treść) i "emoji" (jedno pasujące emoji Unicode).
            3. Format: {{"nodes": [{{"text": "...", "emoji": "🔥"}}, {{"text": "...", "emoji": "💧"}}]}}
            4. Wybieraj emoji, które WIZUALNIE reprezentują temat (np. 🔬 nauka, 💡 pomysł, 🌍 świat).
            5. Używaj WYŁĄCZNIE pojedynczych emoji Unicode.
            6. Jeśli nie ma podpunktów, zwróć: {{"nodes": []}}
            
            Przykład prawidłowej odpowiedzi:
            {{
              "nodes": [
                {{"text": "Definicja", "emoji": "📖"}},
                {{"text": "Przykłady", "emoji": "💡"}},
                {{"text": "Zastosowania", "emoji": "🔧"}}
              ]
            }}
            """
        else:
            system_prompt = f"""
            Kontekst: "{context}". Wygeneruj TYLKO listę podpunktów dla OSTATNIEGO elementu.
            
            KRYTYCZNE WYMAGANIA:
            1. Odpowiedz w formacie JSON jako obiekt zawierający klucz "nodes" z listą.
            2. Każdy element listy ma pole "content" z treścią węzła.
            3. Format: {{"nodes": [{{"content": "..."}}, {{"content": "..."}}]}}
            4. Jeśli nie ma podpunktów, zwróć: {{"nodes": []}}
            
            Przykład prawidłowej odpowiedzi:
            {{
              "nodes": [
                {{"content": "Definicja"}},
                {{"content": "Przykłady"}},
                {{"content": "Zastosowania"}}
              ]
            }}
            """

        chat_completion = client.chat.completions.create(
            messages=[{"role": "system", "content": system_prompt}],
            model=GROQ_MODEL,
            response_format={"type": "json_object"},
            temperature=0.2
        )

        response_data = json.loads(chat_completion.choices[0].message.content)

        final_nodes = []
        data_to_check = None

        if isinstance(response_data, list):
            data_to_check = response_data
        elif isinstance(response_data, dict):
            potential_nodes = response_data.get('children') or response_data.get('nodes')
            if isinstance(potential_nodes, list):
                data_to_check = potential_nodes

        if data_to_check is not None:
            if emojis_enabled:
                for item in data_to_check:
                    if isinstance(item, dict):
                        emoji = item.get('emoji', '📌')
                        text = item.get('text', item.get('content', '')).strip()
                        
                        if text:
                            final_nodes.append({'content': f"{emoji} {text}"})
            else:
                for item in data_to_check:
                    if isinstance(item, dict) and 'content' in item:
                        content = item['content'].strip()
                        if content:
                            final_nodes.append({'content': content})

        return jsonify(final_nodes)

    except Exception as e:
        import traceback
        print(f"❌ Groq error while expanding a node: {e}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/get-explanation', methods=['POST'])
@require_auth
def get_explanation():
    """Generate an explanation based on the provided prompt."""
    print("🔍 /get-explanation invoked")
    prompt_content = request.json.get('prompt') if request.json else None
    
    if not prompt_content:
        return jsonify({'error': 'Brak promptu'}), 400
    
    try:
        chat_completion = client.chat.completions.create(
            messages=[{
                "role": "system",
                "content": prompt_content
            }],
            model=GROQ_MODEL,
            temperature=0.4
        )
        
        explanation_text = chat_completion.choices[0].message.content
        return jsonify({"explanation": explanation_text})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/get-maps', methods=['GET'])
@require_auth
def get_maps():
    """Fetch every user map from the users/{userID}/maps collection."""
    user_id = g.user_id
    print(f"🔍 GET-MAPS: Fetching maps for user: {user_id}")
    try:
        maps_ref = db.collection('users').document(user_id).collection('maps')
        maps_stream = maps_ref.stream()
        
        maps_list = []
        for doc in maps_stream:
            map_data = doc.to_dict()
            
            print(f"📋 Map ID: {doc.id}")
            print(f"   Document fields: {list(map_data.keys())}")
            has_title = 'title' in map_data
            has_content = 'content' in map_data
            print(f"   Has 'title': {has_title}")
            print(f"   Has 'content': {has_content}")
            if not has_title:
                print("   ⚠️ Missing 'title' field")
            if not has_content:
                print("   ⚠️ Missing 'content' field")
            
            map_data['id'] = doc.id
            maps_list.append(map_data)
        
        print(f"✅ Returning {len(maps_list)} map(s)")
        return jsonify(maps_list), 200 
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/create-map', methods=['POST'])
@require_auth
def create_map():
    """Create a new map document at users/{userID}/maps (title, content, mapData)."""
    if db is None:
        return jsonify({'error': 'Firebase nie jest zainicjalizowany'}), 500
    
    user_id = g.user_id
    data = request.json
    
    print(f"🔍 CREATE-MAP: Request received from user: {user_id}")
    print(f"   Incoming keys: {list(data.keys()) if data else 'NO DATA'}")
    
    if not data:
        return jsonify({'error': 'Brak danych mapy'}), 400
    
    content = data.get('content')
    title = data.get('title')
    
    print(f"   Content provided: {content is not None}")
    print(f"   Title: {title}")
    
    if not content:
        return jsonify({'error': 'Brak pola content'}), 400
    
    if not title:
        if isinstance(content, dict) and 'content' in content:
            title = str(content['content'])
        else:
            title = 'Bez nazwy'
        print(f"   Generated title fallback: {title}")
    
    try:
        firestore_data = {
            'title': title,
            'content': content,
            'mapData': content,
            'createdAt': datetime.utcnow(),
            'lastUpdated': datetime.utcnow()
        }
        print("📝 Persisting map to Firestore (title + content + mapData)")
        maps_ref = db.collection('users').document(user_id).collection('maps')
        write_time, doc_ref = maps_ref.add(firestore_data)
        map_id = doc_ref.id
        saved_doc = doc_ref.get()
        saved_data = saved_doc.to_dict() if saved_doc.exists else None
        print(f"✅ Created new map: {map_id}")
        print(f"   Verified stored fields: {list(saved_data.keys()) if saved_data else 'NONE'}")
        return jsonify({
            'id': map_id,
            'title': title,
            'content': content
        }), 201
    except Exception as e:
        print(f"❌ Map creation failed: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/update-map', methods=['POST'])
@require_auth
def update_map_post():
    """Update an existing map using documentId and newMapData/newMapContent."""
    if db is None:
        return jsonify({'error': 'Firebase nie jest zainicjalizowany'}), 500
    
    user_id = g.user_id
    data = request.json or {}
    document_id = data.get('documentId')
    new_map = data.get('newMapData') if 'newMapData' in data else data.get('newMapContent')
    
    if not document_id:
        return jsonify({'error': 'Brak documentId'}), 400
    if new_map is None:
        return jsonify({'error': 'Brak newMapData/newMapContent'}), 400
    
    try:
        map_ref = db.collection('users').document(user_id).collection('maps').document(document_id)
        if not map_ref.get().exists:
            return jsonify({'error': 'Mapa nie znaleziona'}), 404
        update_payload = {
            'content': new_map,
            'mapData': new_map,
            'lastUpdated': datetime.utcnow()
        }
        map_ref.update(update_payload)
        print(f"✅ [POST /update-map] Updated map {document_id} (user: {user_id}); fields: {list(update_payload.keys())}")
        return jsonify({'id': document_id, 'updated': True}), 200
    except Exception as e:
        import traceback
        print(f"❌ Map update failed (POST /update-map): {e}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/update-map/<map_id>', methods=['PUT', 'PATCH'])
@require_auth
def update_map(map_id):
    """Update map title/content in users/{userID}/maps and mirror mapData."""
    if db is None:
        return jsonify({'error': 'Firebase nie jest zainicjalizowany'}), 500
    
    user_id = g.user_id
    data = request.json
    
    if not data:
        return jsonify({'error': 'Brak danych do aktualizacji'}), 400
    
    try:
        map_ref = db.collection('users').document(user_id).collection('maps').document(map_id)
        map_doc = map_ref.get()
        if not map_doc.exists:
            return jsonify({'error': 'Mapa nie znaleziona'}), 404
        update_data = {
            'lastUpdated': datetime.utcnow()
        }
        if 'content' in data:
            update_data['content'] = data['content']
            update_data['mapData'] = data['content']
        if 'title' in data:
            update_data['title'] = data['title']
        map_ref.update(update_data)
        print(f"✅ Updated map: {map_id} for user: {user_id}")
        return jsonify({'id': map_id, 'updated': True}), 200
    except Exception as e:
        print(f"❌ Map update error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/migrate-maps', methods=['POST'])
@require_auth
def migrate_maps():
    """Migrate legacy map documents to the name + mapData structure."""
    if db is None:
        return jsonify({'error': 'Firebase nie jest zainicjalizowany'}), 500
    
    user_id = g.user_id
    print(f"🔄 MIGRATE-MAPS: Migrating maps for user: {user_id}")
    
    try:
        maps_ref = db.collection('users').document(user_id).collection('maps')
        maps_stream = maps_ref.stream()
        
        migrated_count = 0
        skipped_count = 0
        errors = []
        
        for doc in maps_stream:
            map_data = doc.to_dict()
            doc_id = doc.id
            
            has_name = 'name' in map_data
            has_mapData = 'mapData' in map_data
            
            if has_name and has_mapData:
                print(f"   ⏭️  Map {doc_id} already has the correct structure, skipping")
                skipped_count += 1
                continue
            
            print(f"   🔄 Migrating map {doc_id}...")
            
            update_data = {}
            
            
            if not has_name:
                if 'mapStructure' in map_data and isinstance(map_data['mapStructure'], dict):
                    if 'content' in map_data['mapStructure']:
                        update_data['name'] = str(map_data['mapStructure']['content'])
                    else:
                        update_data['name'] = f'Mapa {doc_id[:8]}'
                elif 'mapData' in map_data and isinstance(map_data['mapData'], dict):
                    if 'content' in map_data['mapData']:
                        update_data['name'] = str(map_data['mapData']['content'])
                    else:
                        update_data['name'] = f'Mapa {doc_id[:8]}'
                elif 'content' in map_data:
                    if isinstance(map_data['content'], dict) and 'content' in map_data['content']:
                        update_data['name'] = str(map_data['content']['content'])
                    else:
                        update_data['name'] = str(map_data['content'])
                else:
                    update_data['name'] = f'Mapa {doc_id[:8]}'
            
            if not has_mapData:
                if 'mapStructure' in map_data:
                    update_data['mapData'] = map_data['mapStructure']
                    print("      ➕ Copying 'mapData' from 'mapStructure'")
                elif 'content' in map_data:
                    update_data['mapData'] = map_data['content']
                    print("      ➕ Copying 'mapData' from 'content'")
                else:
                    temp_data = dict(map_data)
                    temp_data.pop('name', None)
                    temp_data.pop('createdAt', None)
                    temp_data.pop('lastUpdated', None)
                    update_data['mapData'] = temp_data
                    print("      ➕ Copying 'mapData' from the entire document (fallback)")
            
            if 'mapData' in update_data and 'content' not in map_data:
                update_data['content'] = update_data['mapData']
                print("      ➕ Copying 'content' as a mirror of 'mapData'")
            
            if update_data:
                update_data['lastUpdated'] = datetime.utcnow()
                
                doc_ref = maps_ref.document(doc_id)
                doc_ref.update(update_data)
                
                verified_doc = doc_ref.get()
                verified_data = verified_doc.to_dict() if verified_doc.exists else None
                has_name_after = verified_data and 'name' in verified_data
                has_mapData_after = verified_data and 'mapData' in verified_data
                has_content_after = verified_data and 'content' in verified_data
                
                print(f"      ✅ Updated map {doc_id}")
                print(f"         After migration: name={has_name_after}, mapData={has_mapData_after}, content={has_content_after}")
                
                if has_name_after and (has_mapData_after or has_content_after):
                    migrated_count += 1
                else:
                    errors.append(f"Map {doc_id} failed post-migration verification")
        
        result = {
            'migrated': migrated_count,
            'skipped': skipped_count,
            'total': migrated_count + skipped_count,
            'errors': errors
        }
        
        print(f"✅ Migration completed: {result}")
        return jsonify(result), 200
        
    except Exception as e:
        print(f"❌ Map migration error: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    DEBUG_MODE = os.getenv('FLASK_DEBUG') == '1'
    app.run(debug=DEBUG_MODE, host='0.0.0.0', port=int(os.getenv('PORT', 5000)))