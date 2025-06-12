# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `npm start` - Launch the Electron application
- `npm run build` - Build for current platform
- `npm run build:win` - Build Windows installer (NSIS)
- `npm run build:mac` - Build macOS DMG
- `npm run build:linux` - Build Linux AppImage/DEB
- `npm run build:all` - Build for Windows and Linux
- `python server.py` - Start local HTTP server for web testing (port 8000)

### Dependencies
- `npm install` - Install all dependencies

## Architecture

Sound Player is an Electron-based desktop audio player with the following structure:

- **main.js** - Electron main process, handles window creation, native dialogs, file I/O via IPC
- **index.html** - Main UI structure with sidebar (folders/controls) and main content area
- **app.js** - Core application logic as SoundPlayer class with audio processing, visualization, library management
- **styles.css** - Complete styling for dark theme UI

### Key Components

**Audio System:**
- Web Audio API with AudioContext for spectrum visualization
- HTML5 Audio element for playback
- Canvas-based spectrum analyzer visualization

**Library Management:**
- IndexedDB for persistent storage of library state and file metadata
- Folder-based organization system with drag-and-drop support
- Save/Load functionality for library backups using ZIP format

**File Architecture:**
- Files stored as Map with metadata (path, folder, duration, etc.)
- Folders stored as Map with file associations
- Real-time search filtering with case-insensitive matching

**IPC Handlers (main.js):**
- `save-file` / `load-file` - File system operations
- `show-save-dialog` / `show-open-dialog` - Native file dialogs
- `show-directory-dialog` - Directory selection
- `check-file-exists` - File existence validation

The application supports both native Electron builds and web-based testing via the Python server.