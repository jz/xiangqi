# CLAUDE.md — Xiangqi (Chinese Chess) Project

## Project Overview

A complete Chinese Chess (象棋) game implemented as a **single HTML file** with no build system, no dependencies, and no backend. The entire application — HTML structure, CSS styling, JavaScript game logic, AI engine, and UI — lives in `index.html`.

## Running the Application

```bash
# Option 1: Open directly in browser
open index.html

# Option 2: Serve via HTTP
python3 -m http.server 8000
# then visit http://localhost:8000
```

No build step, no `npm install`, no compilation needed.

## Repository Structure

```
xiangqi/
├── index.html                  # The entire application (~1,629 lines)
├── index.html.backup           # Backup before a major refactor
└── index.html.before_engine    # Backup before AI engine was added
```

There are no separate source directories, test files, config files, or package managers. Everything is in `index.html`.

## Architecture Inside `index.html`

The file is organized in three main sections:

### 1. CSS (lines 7–231)
- Traditional Chinese chess aesthetic: brown/gold color scheme
- Canvas board styling, button styles, responsive layout
- Pulse animation for check warnings
- Custom scrollbar styling

### 2. HTML (lines 233–324)
- `<canvas id="board">`: The game board rendered via Canvas API
- Status panel, game mode selector, FEN import/export
- Captured pieces display, move history list

### 3. JavaScript (lines 326–1627)
The JS is the core of the application. Key areas:

#### Constants & State (lines ~326–420)
- `START_FEN`: Default starting position
- `PIKAFISH_API`: External engine URL (`https://pikafish-api-production.up.railway.app`)
- Board dimensions: `ROWS=10`, `COLS=9`, `CELL=60px`, `PAD=40px`
- Game state: `board[][]`, `history[]`, `future[]`, `selected`, `playerColor`, `gameMode`, `difficulty`

#### FEN Parsing & Export (lines ~430–490)
- `parseFen(fen)`: Converts FEN string → 10×9 board array
- `boardToFen(board, turn)`: Converts board → FEN string
- FEN uses uppercase for Red (`R`,`N`,`B`,`A`,`K`,`C`,`P`) and lowercase for Black (`r`,`n`,`b`,`a`,`k`,`c`,`p`)
- Turn indicator: `r` = Red, `b` = Black (internally); Pikafish uses `w` for Red (handled in API call)

#### Move Generation & Validation (lines ~490–650)
- `legalMovesFor(board, r, c)`: Returns all legal moves for piece at `(r,c)`, accounting for check
- `pseudoMovesFor(board, r, c)`: Raw moves without checking for self-check
- `inCheck(board, color)`: Detects if `color`'s king is in check
- `doMove(board, from, to)`: Returns new board state after a move (immutable)
- Move legality is enforced per-piece type with standard Xiangqi rules

#### Rendering (lines ~650–770)
- `render()`: Main draw function — calls `drawBoard()`, `drawPieces()`, `drawHighlights()`
- `drawBoard()`: Canvas grid, river markings, palace diagonals
- `drawPieces()`: Draws each piece as styled circles with Chinese characters
- `drawHighlights()`: Selection ring, legal move dots, last-move highlight

#### AI Engine — Local (lines ~772–1016, Web Worker blob)
The local AI runs in a Web Worker (embedded as a string, converted to a Blob URL):
- **Algorithm**: Iterative deepening minimax with alpha-beta pruning
- **Depth**: 2 (Easy), 3 (Medium), 5 (Hard)
- **Optimizations**: Transposition table (Zobrist hashing), killer move heuristic, MVV-LVA move ordering
- **Piece-square tables**: Position bonuses per piece type per square
- **Piece values**: K=10000, R=900, C=450, N=410, B=150, A=120, P=70

#### AI Engine — Pikafish (lines ~1016–1060)
- Calls `POST https://pikafish-api-production.up.railway.app/bestmove`
- Payload: `{ fen, depth, movetime }`
- Returns move in UCI format (e.g., `"a0b0"`) — coordinates are col+rank, 0-indexed
- Falls back to local AI if the API call fails

#### Game Control & UI (lines ~1060–1627)
- `scheduleAIMove()`: Decides when the AI should play and triggers it
- `handleCanvasClick(e)`: Processes board clicks — piece selection and move execution
- `undoMove()` / `redoMove()`: Undo/redo using `history[]` and `future[]` arrays
- `newGame()`: Resets state, renders fresh board
- `saveToLocalStorage()` / `loadFromLocalStorage()`: Auto-persist game state

## Key Conventions

### Naming
- **Single-letter abbreviations** for hot-path variables: `r`=row, `c`=col, `p`=piece, `b`=board, `m`=move
- **Full descriptive names** for public functions: `legalMovesFor`, `scheduleAIMove`, `pieceColor`
- **UPPERCASE_SNAKE_CASE** for constants: `ROWS`, `COLS`, `CELL`, `START_FEN`, `RED`, `BLACK`
- Worker-internal functions are aggressively abbreviated to keep Blob size small: `pc()`, `isR()`, `en()`, `inB()`

### Code Style
- Pure functions for game logic — board state is never mutated in place; `doMove` returns a new board
- No classes or OOP patterns anywhere; everything is procedural/functional
- Canvas API for all rendering (no SVG, no DOM manipulation for pieces)
- Web Worker is created from a Blob URL (the worker source is a template literal string in the main file)

### Board Coordinate System
- `board[row][col]` — row 0 is Black's back rank (top), row 9 is Red's back rank (bottom)
- `col` 0 is the leftmost file
- Pieces: uppercase = Red, lowercase = Black, `''` = empty

### FEN Format
```
rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r
```
- Ranks separated by `/`, rank 0 first
- Numbers = empty squares
- Turn: `r` (Red's turn) or `b` (Black's turn)
- When sending to Pikafish API, Red is represented as `w` (the API follows Western chess conventions)

## Game Modes & Features

| Feature | Details |
|---|---|
| PvP | Two humans alternate moves |
| vs AI | Choose color (Red/Black), difficulty (Easy/Medium/Hard), engine (Local/Pikafish) |
| Undo/Redo | Full history with `history[]`/`future[]` arrays |
| Save/Load | Auto-saved to `localStorage`; manual FEN import/export |
| Check detection | Animated pulse on king when in check |
| Move history | Displayed as file+rank notation in sidebar |

## Making Changes

Since the entire application is one file, all edits go to `index.html`. Keep these principles in mind:

1. **Game logic functions must remain pure** — they take board state as input and return new state; do not mutate `board` in place.
2. **Worker code stays compact** — the Web Worker is embedded as a string. Keep abbreviations when editing that section (lines ~772–1016).
3. **No external dependencies** — do not introduce npm packages, CDN links, or backend requirements.
4. **FEN/Pikafish turn indicator** — internally use `r`/`b` for turn, but translate to `w`/`b` when calling the Pikafish API.
5. **Test by opening in browser** — there is no test suite. Verify moves manually, especially after touching `legalMovesFor`, `inCheck`, or `doMove`.

## Known External Dependency

The Pikafish API (`https://pikafish-api-production.up.railway.app`) is an external service. If it's unreachable, the game automatically falls back to the local minimax AI. The local AI is always the fallback — never assume the API is available.

## Development Workflow

```bash
# 1. Edit index.html
# 2. Open/refresh in browser
# 3. Manually test affected features
# 4. Commit changes
git add index.html
git commit -m "<type>: <description>"
git push -u origin <branch>
```

Commit message types: `fix:`, `feat:`, `refactor:`, `docs:`

## Branch Conventions

- Main development: `main`
- Feature/fix branches: descriptive names prefixed by type (e.g., `claude/add-claude-documentation-DJnJd`)
