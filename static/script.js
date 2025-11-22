
const AUDIO_CLICK = new Audio('/static/audio/click.mp3');
AUDIO_CLICK.volume = 0.7;

const AUDIO_SUCCESS = new Audio('/static/audio/success.mp3');
AUDIO_SUCCESS.volume = 0.8;

let audioUnlocked = false;
let isSoundEnabled = true;

function unlockAudio() {
    if (audioUnlocked) return;
    
    console.log("🔓 Unlocking audio...");
    
    if (AUDIO_CLICK) {
        AUDIO_CLICK.play().then(() => AUDIO_CLICK.pause()).catch(e => console.warn("AUDIO_CLICK error:", e));
        AUDIO_CLICK.currentTime = 0;
    }
    if (AUDIO_SUCCESS) {
        AUDIO_SUCCESS.play().then(() => AUDIO_SUCCESS.pause()).catch(e => console.warn("AUDIO_SUCCESS error:", e));
        AUDIO_SUCCESS.currentTime = 0;
    }
    
    audioUnlocked = true;
    console.log("✅ Audio unlocked!");
    document.removeEventListener('mousedown', unlockAudio);
    document.removeEventListener('keydown', unlockAudio);
}

function playSound(audioObject) {
    if (!isSoundEnabled) return;
    
    if (audioObject && audioUnlocked) {
        audioObject.currentTime = 0;
        audioObject.play().catch(e => console.warn("Audio play blocked:", e));
    }
}

document.addEventListener('mousedown', unlockAudio, { once: true });
document.addEventListener('keydown', unlockAudio, { once: true });

async function getAuthToken() {
    try {
        const cachedToken = localStorage.getItem('firebaseIdToken');
        
        if (cachedToken) {
            return cachedToken;
        }
        
        if (typeof firebase !== 'undefined' && firebase.auth()) {
            const user = firebase.auth().currentUser;
            if (user) {
                const token = await user.getIdToken();
                localStorage.setItem('firebaseIdToken', token);
                return token;
            }
        }
        return null;
    } catch (error) {
        console.error("❌ Failed to fetch Firebase token:", error);
        return null;
    }
}

const firebaseConfig = {
    apiKey: "AIzaSyCGKGQdsiJPGUOLl8vFgAKFRW7mOyWR99c",
    authDomain: "ai-mind-mapper.firebaseapp.com",
    projectId: "ai-mind-mapper",
    storageBucket: "ai-mind-mapper.firebasestorage.app",
    messagingSenderId: "709063725671",
    appId: "1:709063725671:web:8d01d99492d2778e2dbac2"
};

let app, auth, googleProvider, db;
let currentUser = null;
let currentMapId = null;

try {
    if (typeof firebase !== 'undefined') {
        app = firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        googleProvider = new firebase.auth.GoogleAuthProvider();
        db = firebase.firestore();
        console.log("✅ Firebase initialized successfully");
    } else {
        console.warn("⚠️ Firebase SDK is not loaded. Authentication is disabled.");
    }
} catch (error) {
    console.error("❌ Firebase initialization error:", error);
}

const themeToggle = document.getElementById('theme-switch');
const focusToggle = document.getElementById('focus-switch');
const emojiToggle = document.getElementById('emoji-switch');
const soundToggle = document.getElementById('sound-switch');
const body = document.body;

const removeSwitchLabels = () => {
    document.querySelectorAll('.switch-label').forEach(label => label.remove());
};

const initSwitchLabelCleanup = () => {
    removeSwitchLabels();
    const switchContainers = document.querySelectorAll('#top-toggles, #bottom-toggles');
    if (!switchContainers.length) return;

    switchContainers.forEach(container => {
        const observer = new MutationObserver(() => removeSwitchLabels());
        observer.observe(container, { childList: true, subtree: true });
    });
};

initSwitchLabelCleanup();

const setTheme = (theme) => {
    body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    themeToggle.checked = theme === 'light';
};

const dimAllNodes = () => {
    document.querySelectorAll('.markmap-node, .markmap-line').forEach(el => {
        el.classList.add('is-dimmed');
    });
};

const unDimAllNodes = () => {
    document.querySelectorAll('.markmap-node, .markmap-line').forEach(el => {
        el.classList.remove('is-dimmed');
    });
};

const setFocusMode = (enabled) => {
    if (enabled) {
        body.classList.add('focus-mode-active');
    } else {
        body.classList.remove('focus-mode-active');
        unDimAllNodes();
    }
    localStorage.setItem('focusMode', enabled ? 'true' : 'false');
    focusToggle.checked = enabled;
};

const setEmojiMode = (enabled) => {
    localStorage.setItem('emojisEnabled', enabled ? 'true' : 'false');
    emojiToggle.checked = enabled;
};

const setSoundMode = (enabled) => {
    isSoundEnabled = enabled;
    localStorage.setItem('soundEnabled', enabled ? 'true' : 'false');
    soundToggle.checked = enabled;
};

const savedTheme = localStorage.getItem('theme') || 'dark';
const savedFocusMode = localStorage.getItem('focusMode') === 'true';
const savedEmojiMode = localStorage.getItem('emojisEnabled') === 'true';
const savedSoundMode = localStorage.getItem('soundEnabled') !== 'false';
setTheme(savedTheme);
setFocusMode(savedFocusMode);
setEmojiMode(savedEmojiMode);
setSoundMode(savedSoundMode);

themeToggle?.addEventListener('change', (e) => {
    playSound(AUDIO_CLICK);
    setTheme(e.target.checked ? 'light' : 'dark');
});

focusToggle?.addEventListener('change', (e) => {
    playSound(AUDIO_CLICK);
    setFocusMode(e.target.checked);
});

emojiToggle?.addEventListener('change', (e) => {
    playSound(AUDIO_CLICK);
    setEmojiMode(e.target.checked);
});

soundToggle?.addEventListener('change', (e) => {
    setSoundMode(e.target.checked);
});

const cleanUndefinedFromObject = (obj) => {
    if (obj === null || obj === undefined) {
        return null;
    }
    
    if (Array.isArray(obj)) {
        return obj.map(item => cleanUndefinedFromObject(item)).filter(item => item !== undefined);
    }
    
    if (typeof obj === 'object') {
        const cleaned = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                const value = obj[key];
                if (value !== undefined) {
                    cleaned[key] = cleanUndefinedFromObject(value);
                }
            }
        }
        return cleaned;
    }
    
    return obj;
};

function sanitizeMapData(node) {
    if (!node || typeof node !== 'object') return node;
    const sanitized = {};
    if (typeof node.content !== 'undefined') sanitized.content = node.content;
    if (Array.isArray(node.children)) {
        sanitized.children = node.children.map(child => sanitizeMapData(child));
    }
    return sanitized;
}

const getMapRootTitle = (mapData) => {
    if (mapData && mapData.content) {
        return mapData.content;
    }
    return 'Bez tytułu';
};

const LAST_MAP_KEY = 'lastOpenedMapId';

const saveMapToFirestore = async (mapData) => {
    if (!currentUser) {
        console.log("⚠️ User is not authenticated; persisting map locally.");
        try {
            localStorage.setItem('aiMindMapState', JSON.stringify(mapData));
        } catch (error) {
            console.error('Error while saving map locally:', error);
        }
        return;
    }

    if (!mapData) {
        console.warn("⚠️ Missing map data; skipping save.");
        return;
    }
    console.log("🧹 MapData BEFORE sanitize:", mapData);
    const sanitizedMapData = sanitizeMapData(mapData);
    console.log("🧽 MapData AFTER sanitize:", sanitizedMapData);
    const cleanedMapData = cleanUndefinedFromObject(sanitizedMapData);

    if (cleanedMapData && cleanedMapData.content && typeof cleanedMapData.content === 'string' && !cleanedMapData.title) {
        cleanedMapData.title = cleanedMapData.content;
        console.log('📝 Adding root map title:', cleanedMapData.title);
    }
    console.log("🚿 MapData AFTER cleanUndefined:", cleanedMapData);

    if (!cleanedMapData || typeof cleanedMapData.content !== 'string' || cleanedMapData.content.trim() === '') {
        showFeedback('Błąd: Nie można zapisać pustej lub niepoprawnej mapy. Upewnij się, że temat główny jest ustawiony.');
        return;
    }
    try {
        const authToken = await getAuthToken();
        if (!authToken) {
            console.error("❌ Missing auth token; cannot save map");
            showFeedback('Błąd autoryzacji podczas zapisu mapy! Zaloguj się ponownie.');
            return;
        }

        if (currentMapId) {
            const response = await fetch(`/update-map/${currentMapId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    content: cleanedMapData
                })
            });
            if (!response.ok) {
                const errorData = await response.json();
                showFeedback('Błąd podczas aktualizacji mapy!');
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }
            console.log("✅ Map '" + currentMapId + "' updated by backend");
            try { localStorage.setItem(LAST_MAP_KEY, currentMapId); } catch {}
            showFeedback("Zaktualizowano mapę! Twoje zmiany zostały zapisane.");
        } else {
            const mapTitle = getMapRootTitle(mapData);
            const requestBody = {
                title: mapTitle,
                content: cleanedMapData
            };
            console.log("📤 Sending request to /create-map:", requestBody);
            const response = await fetch('/create-map', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify(requestBody)
            });
            if (!response.ok) {
                const errorData = await response.json();
                showFeedback('Błąd podczas zapisu mapy!');
                console.error("❌ Backend responded with an error:", errorData);
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }
            const result = await response.json();
            console.log("📥 Received backend response:", result);
            currentMapId = result.id;
            try { localStorage.setItem(LAST_MAP_KEY, currentMapId); } catch {}
            console.log("✅ New map created by backend with ID:", currentMapId);
            showFeedback("Mapa została zapisana! Możesz ją znaleźć w swoim panelu map.");
            
            renderMapItem(result);
        }
    } catch (error) {
        showFeedback('Błąd zapisu mapy! Sprawdź konsolę (F12).');
        console.error("❌ Map save error:", error);
        console.error("Map payload that failed to save:", cleanedMapData);
    }
};

const loadMapFromFirestore = (userId) => {
    if (!db) {
        console.error("❌ Firestore nie jest zainicjalizowany.");
        return;
    }

    const lastId = (() => { try { return localStorage.getItem(LAST_MAP_KEY); } catch { return null; } })();
    if (lastId) {
        const mapDocRef = db.collection('users').doc(userId).collection('maps').doc(lastId);
        mapDocRef.get()
            .then((doc) => {
                if (doc.exists) {
                    const docData = doc.data();
                    let mapData = null;
                    if (docData.content) mapData = docData.content;
                    else if (docData.mapData) mapData = docData.mapData;
                    else if (docData.mapStructure) mapData = docData.mapStructure;
                    else mapData = docData;
                    if (!mapData) return;
                    rebuildMapFromData(mapData);
                    currentMapId = lastId;
                    console.log("✅ Opened the last map:", lastId);
                }
            })
            .catch((error) => {
                console.error("❌ Failed to load the last map:", error);
            });
        return;
    }

    const mapDocRef = db.collection('users').doc(userId).collection('maps').doc('mainMap');
    mapDocRef.get()
        .then((doc) => {
            if (doc.exists) {
                const mapData = doc.data().mapStructure;
                console.log("✅ Mapa wczytana z Firestore");
                rebuildMapFromData(mapData);
                currentMapId = 'mainMap';
            } else {
                console.log("ℹ️ No saved map in Firestore; starting fresh.");
                currentMapId = null;
            }
        })
        .catch((error) => {
            console.error("❌ Error while loading a map from Firestore:", error);
        });
};

const rebuildMapFromData = (mapData) => {
    console.log("🔧 Rebuilding map from data:", mapData);
    
    if (!mapData) {
        console.error("❌ Brak danych mapy do odtworzenia!");
        return;
    }
    
    const mainContent = document.querySelector('main');
    const mindmapContainer = document.getElementById('mindmap-container');
    const searchContainer = document.querySelector('.search-container');
    const resetBtn = document.getElementById('reset-btn');
    const exportBtn = document.getElementById('export-btn');
    const exportPngBtn = document.getElementById('export-png-btn');
    const svgElement = document.getElementById('mindmap-svg');
    
    console.log("🔍 Elementy DOM:", {
        mainContent: !!mainContent,
        mindmapContainer: !!mindmapContainer,
        svgElement: !!svgElement
    });
    
    if (!mainContent || !mindmapContainer || !svgElement) {
        console.error("❌ Required DOM elements are missing!");
        return;
    }
    
    mainContent.style.display = 'none';
    mindmapContainer.style.display = 'block';
    if (searchContainer) searchContainer.style.display = 'block';
    if (resetBtn) resetBtn.style.display = 'block';
    if (exportBtn) exportBtn.style.display = 'block';
    if (exportPngBtn) exportPngBtn.style.display = 'block';
    
    console.log("✅ Map containers are visible");
    
    if (!window.markmap || !window.markmap.Markmap) {
        console.error("❌ Markmap library is not loaded!");
        return;
    }
    
    try {
        const { Markmap } = window.markmap;
        console.log("✅ Markmap available, rendering map...");
        
        svgElement.innerHTML = '';
        
        window.rootDataGlobal = mapData;
        window.markmapInstanceGlobal = Markmap.create(svgElement, null, mapData);
        
        console.log("✅ Mapa odtworzona na ekranie!", window.markmapInstanceGlobal);
        
        window.dispatchEvent(new CustomEvent('mapRebuilt', { 
            detail: { 
                mapData: mapData, 
                markmapInstance: window.markmapInstanceGlobal 
            } 
        }));
        
    } catch (error) {
        console.error("❌ Error while rendering the map:", error);
    }
};

const clearMap = () => {
    const mainContent = document.querySelector('main');
    const mindmapContainer = document.getElementById('mindmap-container');
    const searchContainer = document.querySelector('.search-container');
    const resetBtn = document.getElementById('reset-btn');
    const exportBtn = document.getElementById('export-btn');
    const exportPngBtn = document.getElementById('export-png-btn');
    const svgElement = document.getElementById('mindmap-svg');
    const searchInput = document.getElementById('search-input');
    
    if (mindmapContainer) mindmapContainer.style.display = 'none';
    if (searchContainer) searchContainer.style.display = 'none';
    if (resetBtn) resetBtn.style.display = 'none';
    if (exportBtn) exportBtn.style.display = 'none';
    if (exportPngBtn) exportPngBtn.style.display = 'none';
    if (svgElement) svgElement.innerHTML = '';
    if (searchInput) searchInput.value = '';
    if (mainContent) mainContent.style.display = 'block';
    
    window.rootDataGlobal = null;
    currentMapId = null;
};

const renderMapItem = (map) => {
    const mapList = document.getElementById('map-list');
    if (!mapList) {
        console.warn("⚠️ Element #map-list not found");
        return;
    }

    Array.from(mapList.children).forEach(item => {
        if (item.textContent.trim() === 'Brak zapisanych map') {
            item.remove();
        }
    });

    const mapId = map.id || map._id || 'unknown';
    
    const existingLink = mapList.querySelector(`a[data-mapid="${mapId}"]`);
    if (existingLink) {
        console.log(`ℹ️ Map ${mapId} already exists in the list; skipping duplicate`);
        return;
    }
    let mapName = 'Bez nazwy';
    
    if (map.title) {
        mapName = map.title;
    } else if (map.name) {
        mapName = map.name;
    } else if (map.content && typeof map.content === 'object' && map.content.content) {
        mapName = typeof map.content.content === 'string' ? map.content.content : String(map.content.content);
    } else if (map.mapData && map.mapData.content) {
        mapName = typeof map.mapData.content === 'string' ? map.mapData.content : String(map.mapData.content);
    } else if (typeof map.content === 'string') {
        mapName = map.content;
    } else if (mapId === 'mainMap') {
        mapName = 'Mapa Główna';
    } else {
        mapName = `Mapa ${mapId.substring(0, 8)}...`;
    }
    
    const listItem = document.createElement('li');
    
    const link = document.createElement('a');
    link.href = '#';
    link.setAttribute('data-mapid', mapId);
    link.textContent = mapName;
    
    link.addEventListener('click', (e) => {
        e.preventDefault();
        openMap(mapId);
    });
    
    const deleteIcon = document.createElement('span');
    deleteIcon.className = 'delete-icon';
    deleteIcon.textContent = '✖';
    deleteIcon.title = 'Usuń mapę';
    
    deleteIcon.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        deleteMap(mapId, mapName);
    });
    
    link.addEventListener('dblclick', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const input = document.createElement('input');
        input.type = 'text';
        input.value = mapName;
        input.style.background = 'var(--panel-bg)';
        input.style.color = 'var(--text-color)';
        input.style.border = '1px solid var(--button-color)';
        input.style.borderRadius = '4px';
        input.style.padding = '4px 8px';
        input.style.fontSize = '14px';
        input.style.fontFamily = 'inherit';
        input.style.width = '100%';
        
        link.style.display = 'none';
        listItem.insertBefore(input, link);
        input.focus();
        input.select();
        
        let isSaving = false;
        
        const saveName = () => {
            if (isSaving) return;
            isSaving = true;
            
            const newName = input.value.trim();
            if (newName && newName !== mapName) {
                renameMapInFirestore(mapId, newName);
            } else {
                input.remove();
                link.style.display = 'block';
            }
        };
        
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                input.remove();
                link.style.display = 'block';
                saveName();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                input.remove();
                link.style.display = 'block';
            }
        });
        
        input.addEventListener('blur', saveName);
    });
    
    listItem.appendChild(link);
    listItem.appendChild(deleteIcon);
    mapList.appendChild(listItem);
};

const loadUserMaps = async (userId) => {
    const mapList = document.getElementById('map-list');

    if (!mapList) {
        console.warn("⚠️ Element #map-list not found");
        return;
    }

    mapList.innerHTML = '';

    try {
        const authToken = await getAuthToken();
        
        if (!authToken) {
            console.warn("⚠️ Missing auth token; cannot fetch maps");
            return;
        }

        const response = await fetch('/get-maps', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (!response.ok) {
            throw new Error(`Błąd pobierania map: ${response.status}`);
        }

        const maps = await response.json();

        console.log("📋 Maps received from backend:", maps);

        if (!maps) {
            console.error("❌ Backend returned null/undefined for the map list");
            const errorItem = document.createElement('li');
            errorItem.textContent = 'Błąd pobierania map';
            errorItem.style.color = 'red';
            mapList.appendChild(errorItem);
            return;
        }

        if (maps.length === 0) {
            console.log("ℹ️ User has no saved maps.");
            const emptyItem = document.createElement('li');
            emptyItem.textContent = 'Brak zapisanych map';
            emptyItem.style.opacity = '0.5';
            mapList.appendChild(emptyItem);
            return;
        }
        
        console.log(`📋 Found ${maps.length} map(s) to display`);

        maps.forEach((map, index) => {
            console.log(`🗺️ Map ${index + 1}/${maps.length}:`, JSON.stringify(map, null, 2));
            renderMapItem(map);
        });

        console.log("✅ Map list loaded successfully");
        
    } catch (error) {
        console.error("❌ Error while loading map list:", error);
    }
};

const renameMapInFirestore = (mapId, newName) => {
    if (!currentUser) {
        console.error("❌ User is not authenticated.");
        return;
    }

    if (!db) {
        console.error("❌ Firestore is not initialized.");
        return;
    }

    const userId = currentUser.uid;
    const mapDocRef = db.collection('users').doc(userId).collection('maps').doc(mapId);

    mapDocRef.update({
        name: newName,
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
        console.log("✅ Map name changed to:", newName);
        // Refresh the map list
        loadUserMaps(userId);
    })
    .catch((error) => {
        console.error("❌ Map rename failed:", error);
    });
};

const deleteMap = (mapId, mapName) => {
    const confirmMessage = `Czy na pewno chcesz usunąć mapę: "${mapName}"?\n\nTej operacji nie da się cofnąć!`;
    
    if (confirm(confirmMessage)) {
        removeMapFromFirestore(mapId);
    }
};

const removeMapFromFirestore = (mapId) => {
    if (!currentUser) {
        console.error("❌ User is not authenticated.");
        return;
    }

    if (!db) {
        console.error("❌ Firestore is not initialized.");
        return;
    }

    const userId = currentUser.uid;
    const mapDocRef = db.collection('users').doc(userId).collection('maps').doc(mapId);

    mapDocRef.delete()
        .then(() => {
            console.log("✅ Map '" + mapId + "' removed from Firestore");
            
            if (currentMapId === mapId) {
                clearMap();
            }
            
            loadUserMaps(userId);
        })
        .catch((error) => {
            console.error("❌ Map deletion failed:", error);
            alert("Błąd podczas usuwania mapy. Spróbuj ponownie.");
        });
};

const createNewMap = () => {
    console.log("📝 Creating a new map...");
    clearMap();
    currentMapId = null;
};

const openMap = (mapId) => {
    if (!currentUser) {
        console.error("❌ User is not authenticated.");
        return;
    }

    if (!db) {
        console.error("❌ Firestore is not initialized.");
        return;
    }

    console.log("🔍 Attempting to open map:", mapId);
    try { localStorage.setItem(LAST_MAP_KEY, mapId); } catch {}

    clearMap();

    const userId = currentUser.uid;
    const mapDocRef = db.collection('users').doc(userId).collection('maps').doc(mapId);

    mapDocRef.get()
        .then((doc) => {
            if (doc.exists) {
                const docData = doc.data();
                console.log("🔍 Map data from Firestore:", docData);
                
                let mapData = null;
                
                if (docData.mapData) {
                    mapData = docData.mapData;
                    console.log("✅ Using mapData from the new structure");
                } else if (docData.mapStructure) {
                    mapData = docData.mapStructure;
                    console.log("✅ Using mapStructure from the legacy structure");
                } else if (docData.content) {
                    mapData = docData.content;
                    console.log("✅ Using content from the mobile format");
                } else {
                    mapData = docData;
                    console.log("⚠️ Using the entire document as a fallback map payload");
                }
                
                if (!mapData) {
                    console.error("❌ Map data missing inside the document!");
                    alert("Nie można wczytać mapy. Dokument ma nieznany format.");
                    return;
                }
                
                rebuildMapFromData(mapData);
                currentMapId = mapId;
                
                console.log("✅ Map '" + mapId + "' loaded successfully.");
                
            } else {
                console.error("❌ Map not found by ID:", mapId);
                alert("Nie znaleziono mapy o ID: " + mapId);
                currentMapId = null;
            }
        })
        .catch((error) => {
            console.error("❌ Error while loading map '" + mapId + "':", error);
            alert("Błąd podczas wczytywania mapy: " + error.message);
            currentMapId = null;
        });
};


const loadMapFromLocalStorage = () => {
    try {
        const savedMap = localStorage.getItem('aiMindMapState');
        return savedMap ? JSON.parse(savedMap) : null;
    } catch (error) {
        console.error('Error while loading map from localStorage:', error);
        return null;
    }
};


const generateMarkdown = (node, depth = 0) => {
    if (!node) return '';
    
    const indent = '  '.repeat(depth);
    let markdown = `${indent}- ${node.content}\n`;
    
    if (node.children && node.children.length > 0) {
        markdown += node.children
            .map(child => generateMarkdown(child, depth + 1))
            .join('');
    }
    
    return markdown;
};

const downloadAsFile = (content, filename) => {
    const element = document.createElement('a');
    const file = new Blob([content], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = filename.replace('.md', '.txt');
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    URL.revokeObjectURL(element.href);
};

const showFeedback = (message) => {
    const feedbackElement = document.getElementById('feedback-message');
    if (!feedbackElement) return;
    
    feedbackElement.textContent = message;
    feedbackElement.style.display = 'block';
    
    setTimeout(() => {
        feedbackElement.style.display = 'none';
    }, 3000);
};

let nodeClickTimer = null;
const DOUBLE_CLICK_DELAY = 300;

document.addEventListener('DOMContentLoaded', () => {
    const generateBtn = document.getElementById('generate-btn');
    const topicInput = document.getElementById('topic-input');
    const mindmapContainer = document.getElementById('mindmap-container');
    const mainContent = document.querySelector('main');
    const svgElement = document.getElementById('mindmap-svg');
    const resetBtn = document.getElementById('reset-btn');
    const exportBtn = document.getElementById('export-btn');
    const exportPngBtn = document.getElementById('export-png-btn');
    const searchContainer = document.querySelector('.search-container');
    const searchInput = document.getElementById('search-input');

    const { Markmap } = window.markmap;
    let markmapInstance;
    let rootData;
    
    window.markmapInstanceGlobal = null;
    window.rootDataGlobal = null;
    
    window.addEventListener('mapRebuilt', (event) => {
        console.log("📡 mapRebuilt event received, updating local state");
        rootData = event.detail.mapData;
        markmapInstance = event.detail.markmapInstance;
    });
    
    if (!currentUser) {
        const savedMapData = loadMapFromLocalStorage();
        if (savedMapData) {
            rootData = savedMapData;
            window.rootDataGlobal = savedMapData;
            mainContent.style.display = 'none';
            mindmapContainer.style.display = 'block';
            searchContainer.style.display = 'block';
            resetBtn.style.display = 'block';
            exportBtn.style.display = 'block';
            exportPngBtn.style.display = 'block';
            markmapInstance = Markmap.create(svgElement, null, rootData);
            window.markmapInstanceGlobal = markmapInstance;
        }
    }

    const generateNewMap = async () => {
        const topic = topicInput.value;
        if (topic.trim() === '') { return alert('Proszę wpisać temat do analizy.'); }
        
        const authToken = await getAuthToken();
        
        if (!authToken) {
            showFeedback("Musisz być zalogowany, aby generować mapy.");
            mainContent.style.display = 'block';
            return;
        }
        
        mainContent.style.display = 'none';
        try {
            const emojisEnabled = localStorage.getItem('emojisEnabled') === 'true';
            const response = await fetch('/generate-map', { 
                method: 'POST', 
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                }, 
                body: JSON.stringify({ topic, emojisEnabled }) 
            });
            if (!response.ok) throw new Error((await response.json()).error);
            rootData = await response.json();
            window.rootDataGlobal = rootData;
            
            playSound(AUDIO_SUCCESS);
            
            mindmapContainer.style.display = 'block';
            searchContainer.style.display = 'block';
            resetBtn.style.display = 'block';
            exportBtn.style.display = 'block';
            exportPngBtn.style.display = 'block';
            svgElement.innerHTML = '';
            markmapInstance = Markmap.create(svgElement, null, rootData);
            window.markmapInstanceGlobal = markmapInstance;
            
            saveMapToFirestore(rootData);
        } catch (error) {
            console.error('An error occurred while generating a map:', error);
            mainContent.style.display = 'block';
            mainContent.innerHTML += `<p style="color: red;">Błąd: ${error.message}</p>`;
        }
    };

    const resetView = () => {

        if (currentUser && currentMapId) {
            const confirmDelete = confirm('Czy na pewno chcesz wyczyścić obecną mapę? Ta akcja nie usunie zapisanej mapy z chmury.');
            if (!confirmDelete) return;
        }
        
        mindmapContainer.style.display = 'none';
        searchContainer.style.display = 'none';
        resetBtn.style.display = 'none';
        exportBtn.style.display = 'none';
        exportPngBtn.style.display = 'none';
        svgElement.innerHTML = '';
        topicInput.value = '';
        searchInput.value = '';
        mainContent.style.display = 'block';
        
        if (!currentUser) {
            localStorage.removeItem('aiMindMapState');
        }
        
        rootData = null;
        window.rootDataGlobal = null;
        currentMapId = null;
    };

    const expandNodeByAI = async (nodeElement, nodeData, path) => {
        const textElement = nodeElement.querySelector('text');
        if (textElement) textElement.textContent += ' 🤔...';

        try {
            const authToken = await getAuthToken();
            
            if (!authToken) {
                showFeedback("Musisz być zalogowany, aby rozwijać gałęzie.");
                if (textElement) {
                    const originalText = path[path.length - 1];
                    textElement.textContent = originalText;
                }
                return;
            }
            
            const emojisEnabled = localStorage.getItem('emojisEnabled') === 'true';
            const response = await fetch('/expand-node', { 
                method: 'POST', 
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                }, 
                body: JSON.stringify({ path, emojisEnabled }) 
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }
            const newChildren = await response.json();
            
            if (!newChildren || newChildren.length === 0) {
                if (textElement) {
                    const originalText = path[path.length - 1];
                    textElement.textContent = originalText;
                }
                showFeedback("Brak dalszych szczegółów. Osiągnięto maksymalną głębokość.");
                return;
            }
            
            const findNodeByPath = (node, pathToFind) => {
                let currentNode = node;
                for (let i = 1; i < pathToFind.length; i++) {
                    const segment = pathToFind[i];
                    const nextNode = currentNode.children?.find(child => child.content === segment);
                    if (nextNode) {
                        currentNode = nextNode;
                    } else { return null; }
                }
                return currentNode;
            };
            const targetNode = findNodeByPath(rootData, path);
            
            if (targetNode) {
                targetNode.children = newChildren;
            } else {
                throw new Error("Failed to update the map.");
            }
            
            markmapInstance.setData(rootData);
            window.rootDataGlobal = rootData;

            console.log("💾 Persisting the updated map after expanding a branch. currentMapId:", currentMapId);

            try {
                const authToken2 = await getAuthToken();
                if (authToken2 && currentMapId) {
                    const sanitized = sanitizeMapData(rootData);
                    const cleaned = cleanUndefinedFromObject(sanitized);
                    if (cleaned && cleaned.content && typeof cleaned.content === 'string' && !cleaned.title) {
                        cleaned.title = cleaned.content;
                    }
                    const resp = await fetch('/update-map', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${authToken2}`
                        },
                        body: JSON.stringify({
                            documentId: currentMapId,
                            newMapData: cleaned
                        })
                    });
                    if (!resp.ok) {
                        const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
                        console.warn('⚠️ POST /update-map failed:', err);
                    }
                }
            } catch (e) {
                console.warn('⚠️ Error during POST /update-map:', e);
            }

            await saveMapToFirestore(rootData);
            
            if (searchInput.value.trim() !== '') {
                setTimeout(() => filterNodes(), 100);
            }
        } catch (error) {
            console.error("Error while expanding a branch:", error);
            if (textElement) textElement.textContent = path[path.length - 1] + ' ❌';
        }
    };
    generateBtn.addEventListener('click', () => {
        playSound(AUDIO_CLICK);
        generateNewMap();
    });
    resetBtn.addEventListener('click', () => {
        playSound(AUDIO_CLICK);
        resetView();
    });
    
    exportBtn.addEventListener('click', () => {
        if (!rootData) return;
        playSound(AUDIO_CLICK);
        
        const markdownContent = generateMarkdown(rootData);
        const filename = `${rootData.content.slice(0, 30).replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
        downloadAsFile(markdownContent, filename);
    });

    exportPngBtn.addEventListener('click', async () => {
        if (!rootData || !markmapInstance) return;
        playSound(AUDIO_CLICK);
        
        const mapContainer = document.getElementById('mindmap-container');
        const bodyElement = document.body;
        
        const originalStyles = {
            containerWidth: mapContainer.style.width,
            containerHeight: mapContainer.style.height,
            containerOverflow: mapContainer.style.overflow,
            containerPaddingBottom: mapContainer.style.paddingBottom,
            bodyOverflow: bodyElement.style.overflow
        };
        
        try {
            exportPngBtn.disabled = true;
            exportPngBtn.textContent = '⏳ Przygotowuję...';
            
            bodyElement.style.overflow = 'hidden';
            mapContainer.style.width = '95vw';
            mapContainer.style.height = '95vh';
            mapContainer.style.overflow = 'visible';
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
            markmapInstance.fit();
            await new Promise(resolve => setTimeout(resolve, 600));
            
            mapContainer.style.paddingBottom = '50px';
            
            exportPngBtn.textContent = '📸 Tworzę obraz...';
            
            const mapWidth = mapContainer.scrollWidth;
            const mapHeight = mapContainer.scrollHeight;
            
            const dataUrl = await htmlToImage.toPng(mapContainer, {
                backgroundColor: window.getComputedStyle(bodyElement).backgroundColor,
                pixelRatio: 5,
                quality: 1.0,
                width: mapWidth,
                height: mapHeight,
                scrollX: 0,
                scrollY: 0
            });
            
            exportPngBtn.textContent = '💾 Zapisuję...';
            
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `${rootData.content.slice(0, 30).replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`;
            link.click();
            
            bodyElement.style.overflow = originalStyles.bodyOverflow;
            mapContainer.style.width = originalStyles.containerWidth;
            mapContainer.style.height = originalStyles.containerHeight;
            mapContainer.style.overflow = originalStyles.containerOverflow;
            mapContainer.style.paddingBottom = originalStyles.containerPaddingBottom;
            
            await new Promise(resolve => setTimeout(resolve, 100));
            markmapInstance.fit();
            
            exportPngBtn.textContent = '✅ Gotowe!';
            setTimeout(() => {
                exportPngBtn.textContent = '📥 Pobierz jako PNG';
                exportPngBtn.disabled = false;
            }, 1500);
            
        } catch (error) {
            console.error('Error during PNG export:', error);
            
            bodyElement.style.overflow = originalStyles.bodyOverflow;
            mapContainer.style.width = originalStyles.containerWidth;
            mapContainer.style.height = originalStyles.containerHeight;
            mapContainer.style.overflow = originalStyles.containerOverflow;
            mapContainer.style.paddingBottom = originalStyles.containerPaddingBottom;
            
            if (markmapInstance) {
                markmapInstance.fit();
            }
            
            exportPngBtn.textContent = '❌ Błąd';
            setTimeout(() => {
                exportPngBtn.textContent = '📥 Pobierz jako PNG';
                exportPngBtn.disabled = false;
            }, 2000);
        }
    });

    function findNodeInDataByPath(node, pathToFind) {
        let currentNode = node;
        if (pathToFind.length === 1) return node;
        for (let i = 1; i < pathToFind.length; i++) {
            const segment = pathToFind[i];
            const nextNode = currentNode.children?.find(child => child.content === segment);
            if (nextNode) {
                currentNode = nextNode;
            } else {
                return null;
            }
        }
        return currentNode;
    }

    function buildPathFromNodeData(nodeData) {
        const path = [];
        let current = nodeData;
        while (current) {
            if (current.data && current.data.content) {
                path.unshift(current.data.content);
            }
            current = current.parent;
        }
        return path;
    }

    function saveTextChanges(nodeElement, newText) {
        const nodeData = nodeElement.__data__;
        if (!nodeData) return;

        const path = buildPathFromNodeData(nodeData);
        const targetNode = findNodeInDataByPath(rootData, path);
        
        if (targetNode) {
            targetNode.content = newText;
            saveMapToFirestore(rootData);
            window.rootDataGlobal = rootData;
            markmapInstance.setData(rootData);
            
            if (searchInput.value.trim() !== '') {
                setTimeout(() => filterNodes(), 100);
            }
        }
    }

    function exitEditMode(element) {
        element.contentEditable = 'false';
        element.classList.remove('is-editing');
        element.removeEventListener('keydown', handleKeydown);
        element.removeEventListener('blur', handleBlur);
    }

    function handleKeydown(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            const newText = event.target.innerText || event.target.textContent;
            saveTextChanges(event.target.closest('.markmap-node'), newText);
            exitEditMode(event.target);
        } else if (event.key === 'Escape') {
            event.preventDefault();
            exitEditMode(event.target);
        }
    }

    function handleBlur(event) {
        const newText = event.target.innerText || event.target.textContent;
        saveTextChanges(event.target.closest('.markmap-node'), newText);
        exitEditMode(event.target);
    }

    function enableEditing(nodeElement) {
        const textElement = nodeElement.querySelector('text') || nodeElement.querySelector('div');
        if (!textElement) return;

        textElement.contentEditable = 'true';
        textElement.classList.add('is-editing');
        textElement.focus();
        
        if (window.getSelection) {
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(textElement);
            selection.removeAllRanges();
            selection.addRange(range);
        }

        textElement.addEventListener('keydown', handleKeydown);
        textElement.addEventListener('blur', handleBlur);
    }

    function runExpandNodeLogic(nodeElement) {
        const nodeData = nodeElement.__data__;
        if (!nodeData) return;

        const path = [];
        let current = nodeData;
        while (current) {
            if (current.data && current.data.content) path.unshift(current.data.content);
            current = current.parent;
        }

        const findNodeByPath = (node, pathToFind) => {
            let currentNode = node;
            if (pathToFind.length === 1) return node;
            for (let i = 1; i < pathToFind.length; i++) {
                const segment = pathToFind[i];
                const nextNode = currentNode.children?.find(child => child.content === segment);
                if (nextNode) {
                    currentNode = nextNode;
                } else {
                    return null;
                }
            }
            return currentNode;
        };
        const nodeInOurData = findNodeByPath(rootData, path);

        const hasChildrenInMemory = nodeInOurData && nodeInOurData.children && nodeInOurData.children.length > 0;

        if (!hasChildrenInMemory) {
            expandNodeByAI(nodeElement, nodeData, path);
        }
    }

    function highlightPath(clickedNodeElement) {
        if (!clickedNodeElement) return;

        const nodeData = clickedNodeElement.__data__;
        if (!nodeData) return;

        clickedNodeElement.classList.remove('is-dimmed');

        let currentParent = nodeData.parent;
        while (currentParent) {
            const allNodes = document.querySelectorAll('.markmap-node');
            const parentElement = Array.from(allNodes).find(node => node.__data__ === currentParent);
            if (parentElement) {
                parentElement.classList.remove('is-dimmed');
            }
            currentParent = currentParent.parent;
        }

        if (nodeData.children && nodeData.children.length > 0) {
            const allNodes = document.querySelectorAll('.markmap-node');
            nodeData.children.forEach(childData => {
                const childElement = Array.from(allNodes).find(node => node.__data__ === childData);
                if (childElement) {
                    childElement.classList.remove('is-dimmed');
                    highlightChildren(childElement, childData);
                }
            });
        }

        const allLines = document.querySelectorAll('.markmap-line');
        allLines.forEach(line => {
            line.classList.remove('is-dimmed');
        });
    }

    function highlightChildren(element, data) {
        if (data.children && data.children.length > 0) {
            const allNodes = document.querySelectorAll('.markmap-node');
            data.children.forEach(childData => {
                const childElement = Array.from(allNodes).find(node => node.__data__ === childData);
                if (childElement) {
                    childElement.classList.remove('is-dimmed');
                    highlightChildren(childElement, childData);
                }
            });
        }
    }

    function handleNodeClick(event) {
        const nodeElement = event.target.closest('.markmap-node');
        if (!nodeElement) return;
        
        playSound(AUDIO_CLICK);

        if (nodeClickTimer) {
            clearTimeout(nodeClickTimer);
            nodeClickTimer = null;
            event.stopPropagation();
            enableEditing(nodeElement);
        } else {
            if (document.body.classList.contains('focus-mode-active')) {
                event.stopPropagation();
                dimAllNodes();
                highlightPath(nodeElement);
                return;
            }

            nodeClickTimer = setTimeout(() => {
                runExpandNodeLogic(nodeElement);
                nodeClickTimer = null;
            }, DOUBLE_CLICK_DELAY);
        }
    }

    svgElement.addEventListener('click', handleNodeClick, { capture: true });

    function filterNodes() {
        const searchTerm = searchInput.value.toLowerCase().trim();
        
        const allNodes = document.querySelectorAll('.markmap-node');
        const allLines = document.querySelectorAll('.markmap-line');
        
        if (searchTerm === '') {
            allNodes.forEach(node => {
                node.classList.remove('highlight-search', 'dimmed-search');
            });
            allLines.forEach(line => {
                line.classList.remove('dimmed-search');
            });
            return;
        }
        
        allNodes.forEach(node => {
            node.classList.remove('highlight-search', 'dimmed-search');
            
            const textElement = node.querySelector('text') || node.querySelector('div');
            if (!textElement) return;
            
            const nodeText = textElement.textContent.toLowerCase();
            
            if (nodeText.includes(searchTerm)) {
                node.classList.add('highlight-search');
            } else {
                node.classList.add('dimmed-search');
            }
        });
        
        allLines.forEach(line => {
            line.classList.add('dimmed-search');
        });
    }
    
    searchInput?.addEventListener('input', filterNodes);
    
    searchInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            searchInput.value = '';
            filterNodes();
            searchInput.blur();
        }
    });

    const loginButton = document.getElementById('google-login-button');
    const logoutButton = document.getElementById('logout-button');
    const userInfoDiv = document.getElementById('user-info');
    const userNameSpan = document.getElementById('user-name');
    const userPhotoImg = document.getElementById('user-photo');
    
    if (typeof auth !== 'undefined' && auth) {
        loginButton?.addEventListener('click', () => {
            playSound(AUDIO_CLICK);
            auth.signInWithPopup(googleProvider)
                .then((result) => {
                    const user = result.user;
                    console.log("✅ Signed in as:", user.displayName);
                    return user.getIdToken();
                })
                .then((token) => {
                    localStorage.setItem('firebaseIdToken', token);
                    console.log("✅ Token persisted to localStorage");
                })
                .catch((error) => {
                    console.error("❌ Login failed:", error.code, error.message);
                    alert(`Błąd logowania: ${error.message}`);
                });
        });
        
        logoutButton?.addEventListener('click', () => {
            playSound(AUDIO_CLICK);
            auth.signOut()
                .then(() => {
                    console.log("✅ Signed out successfully");
                })
                .catch((error) => {
                    console.error("❌ Logout failed:", error);
                    alert(`Błąd wylogowania: ${error.message}`);
                });
        });
        
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                console.log("👤 User signed in:", user.displayName, user.email);
                currentUser = user;
                
                user.getIdToken().then((token) => {
                    localStorage.setItem('firebaseIdToken', token);
                    console.log("✅ Token persisted to localStorage");
                }).catch((error) => {
                    console.error("❌ Error fetching token during login:", error);
                });
                
                playSound(AUDIO_SUCCESS);
                
                userNameSpan.textContent = user.displayName || user.email;
                userPhotoImg.src = user.photoURL || 'https://via.placeholder.com/40';
                userInfoDiv.style.display = 'block';
                loginButton.style.display = 'none';
                
                const dropdownContainer = document.getElementById('dropdown-menu-container');
                if (dropdownContainer) {
                    dropdownContainer.style.display = 'block';
                }
                
                loadMapFromFirestore(user.uid);
                
                try {
                    const authToken = await getAuthToken();
                    if (authToken) {
                        console.log("🔄 Triggering automatic map migration...");
                        const migrateResponse = await fetch('/migrate-maps', {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${authToken}`
                            }
                        });
                        
                        if (migrateResponse.ok) {
                            const migrateResult = await migrateResponse.json();
                            console.log("🔄 Map migration result:", migrateResult);
                            if (migrateResult.migrated > 0) {
                                console.log(`✅ Migrated ${migrateResult.migrated} map(s) to the new structure`);
                                alert(`Zmigrowano ${migrateResult.migrated} map. Odśwież aplikację mobilną!`);
                            } else {
                                console.log("ℹ️ All maps already follow the latest structure");
                            }
                        } else {
                            const error = await migrateResponse.json();
                            console.warn("⚠️ Map migration endpoint returned an error:", error);
                        }
                    }
                } catch (error) {
                    console.warn("⚠️ Map migration request failed:", error);
                }
                
                loadUserMaps(user.uid);
                
            } else {
                console.log("👤 User signed out");
                currentUser = null;
                
                localStorage.removeItem('firebaseIdToken');
                
                userInfoDiv.style.display = 'none';
                loginButton.style.display = 'flex';
                
                const dropdownContainer = document.getElementById('dropdown-menu-container');
                if (dropdownContainer) {
                    dropdownContainer.style.display = 'none';
                }
                
                clearMap();
                
                const savedMapData = loadMapFromLocalStorage();
                if (savedMapData) {
                    rootData = savedMapData;
                    window.rootDataGlobal = savedMapData;
                    const mainContent = document.querySelector('main');
                    const mindmapContainer = document.getElementById('mindmap-container');
                    const searchContainer = document.querySelector('.search-container');
                    const resetBtn = document.getElementById('reset-btn');
                    const exportBtn = document.getElementById('export-btn');
                    const exportPngBtn = document.getElementById('export-png-btn');
                    const svgElement = document.getElementById('mindmap-svg');
                    
                    if (mainContent && mindmapContainer && svgElement) {
                        mainContent.style.display = 'none';
                        mindmapContainer.style.display = 'block';
                        if (searchContainer) searchContainer.style.display = 'block';
                        if (resetBtn) resetBtn.style.display = 'block';
                        if (exportBtn) exportBtn.style.display = 'block';
                        if (exportPngBtn) exportPngBtn.style.display = 'block';
                        markmapInstance = Markmap.create(svgElement, null, rootData);
                        window.markmapInstanceGlobal = markmapInstance;
                    }
                }
            }
        });
        
    } else {
        console.warn("⚠️ Firebase Authentication is unavailable. Check configuration.");
        if (loginButton) {
            loginButton.disabled = true;
            loginButton.textContent = "Logowanie niedostępne";
            loginButton.style.opacity = "0.5";
            loginButton.style.cursor = "not-allowed";
        }
    }

    const toggleMapListButton = document.getElementById('toggle-map-list');
    const mapManagementPanel = document.getElementById('map-management-panel');
    
    if (toggleMapListButton && mapManagementPanel) {
        toggleMapListButton.addEventListener('click', () => {
            playSound(AUDIO_CLICK);
            mapManagementPanel.classList.toggle('is-open');
        });
        
        document.addEventListener('click', (event) => {
            if (!mapManagementPanel.contains(event.target) && 
                !toggleMapListButton.contains(event.target)) {
                mapManagementPanel.classList.remove('is-open');
            }
        });
    }
});
