## 🖥️ Flow Mind Web: Centrum Analityczne

Aplikacja webowa to "centrum dowodzenia" ekosystemu Flow Mind. Zaprojektowana z myślą o pracy głębokiej (**Deep Work**) na dużym ekranie, służy do analizy, strukturyzowania i zarządzania wiedzą zebraną "w biegu".

![Flow Mind Web Interface](image.p)

### 🛠️ Stack Technologiczny

Zamiast korzystać z gotowych frameworków SPA (jak React czy Vue), frontend został zbudowany w oparciu o **Vanilla JavaScript (ES6+)**. To świadoma decyzja architektoniczna, mająca na celu:
1.  Zapewnienie maksymalnej lekkości i wydajności.
2.  Pełną kontrolę nad manipulacją drzewem DOM (renderowanie rekurencyjne).
3.  Zrozumienie fundamentalnych mechanizmów działania przeglądarki "pod maską".

* **Core:** HTML5, CSS3 (CSS Variables, Flexbox, Grid), Vanilla JS.
* **Auth & Data:** Firebase JS SDK (Authentication + Firestore).
* **API Comm:** Fetch API (Async/Await) z autoryzacją JWT (`Bearer Token`).
* **Design:** Custom CSS z obsługą motywów (Dark/Light Mode) i responsywnością (RWD).

### ✨ Kluczowe Funkcje & UX

#### 1. Wizualizacja "Z Lotu Ptaka"
W przeciwieństwie do wersji mobilnej (skupionej na ścieżce), wersja webowa renderuje **pełny graf wiedzy**. Użytkownik widzi całą strukturę tematu, co pozwala na łączenie odległych faktów i zrozumienie szerszego kontekstu.

#### 2. Tryb Skupienia (Focus Mode)
Autorskie rozwiązanie problemu przytłoczenia informacją na dużym ekranie.
* **Działanie:** Po aktywacji, algorytm trawersuje drzewo DOM, identyfikuje aktywną ścieżkę (od korzenia do wybranego węzła) i nakłada warstwę przyciemniającą (dimmer) na wszystkie niepowiązane gałęzie.
* **Cel:** Pozwala pracować nad jednym detalem bez tracenia z oczu ogólnego zarysu mapy.

#### 3. Edycja "W Miejscu" (In-Place Editing)
Interfejs wspiera intuicyjną edycję treści (`contenteditable`). Kliknięcie w dowolny węzeł pozwala na zmianę jego nazwy, a zmiany są natychmiastowo synchronizowane z bazą danych i widoczne na urządzeniach mobilnych.

#### 4. Dynamiczna Ekspansja AI
Integracja z modelem językowym (przez backend Python/Flask). Użytkownik może rozwinąć dowolny węzeł, a system wygeneruje kontekstowe pod-tematy, automatycznie dobierając pasujące **ikony (Emoji)** dla lepszej nawigacji wizualnej.

#### 5. Narzędzia Eksportu
Zaimplementowano funkcje umożliwiające wyciągnięcie wiedzy z ekosystemu:
* **Eksport do PNG:** Renderowanie widoku DOM do pliku graficznego (z użyciem `html-to-image`).
* **Eksport do TXT:** Algorytm parsujący strukturę drzewa do formatu tekstowego z wcięciami (hierarchia).

-
-
-
## 🖥️ Flow Mind Web: The Analytical Hub

The web application serves as the "command center" of the Flow Mind ecosystem. Designed for **Deep Work** on large screens, it facilitates the analysis, structuring, and management of knowledge gathered "on the go".

![Flow Mind Web Interface](Zrzut%20ekranu%202025-10-31%20231621.png)

### 🛠️ Tech Stack

Instead of relying on heavy SPA frameworks (like React or Vue), the frontend was built using **Vanilla JavaScript (ES6+)**. This was a conscious architectural decision aimed at:
1.  Ensuring maximum performance and lightweight footprint.
2.  Providing full control over DOM manipulation (recursive rendering algorithms).
3.  Demonstrating a deep understanding of browser fundamentals "under the hood".

* **Core:** HTML5, CSS3 (CSS Variables, Flexbox, Grid), Vanilla JS.
* **Auth & Data:** Firebase JS SDK (Authentication + Firestore).
* **API Comm:** Fetch API (Async/Await) with JWT authorization (`Bearer Token`).
* **Design:** Custom CSS with theme support (Dark/Light Mode) and responsiveness (RWD).

### ✨ Key Features & UX

#### 1. "Bird's-Eye" Visualization
Unlike the mobile version (which focuses on a linear path), the web version renders the **full knowledge graph**. This allows users to visualize the entire structure, connect distant concepts, and grasp the broader context of the topic.

#### 2. Focus Mode
A proprietary solution designed to solve the problem of information overload on large screens.
* **How it works:** Upon activation, the algorithm traverses the DOM tree, identifies the active path (from root to the selected node), and applies a "dimmer" layer to all unrelated branches.
* **Goal:** Enables working on specific details without losing sight of the overall map structure.

#### 3. In-Place Editing
The interface supports intuitive content editing (`contenteditable`). Clicking on any node allows for immediate text modification. Changes are instantly synchronized with the database and reflected on mobile devices in real-time.

#### 4. Dynamic AI Expansion
Integration with a Large Language Model (via Python/Flask backend). Users can expand any node, and the system generates contextual sub-topics, automatically selecting matching **Icons (Emojis)** for better visual navigation.

#### 5. Export Tools
Implemented features allow users to extract knowledge from the ecosystem:
* **Export to PNG:** Renders the current DOM view into a high-quality image file (using `html-to-image`).
* **Export to TXT:** A custom parser that converts the tree structure into a hierarchical text format with indentation.