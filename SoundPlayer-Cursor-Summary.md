# SoundPlayer-Cursor Project Summary

## 🎵 Overview

**SoundPlayer-Cursor** is a modern, cross-platform desktop audio player built by **[@AntDX316](https://twitter.com/AntDX316)** using **Electron** and web technologies. The application combines elegant design with powerful features including real-time spectrum visualization, intelligent library management, and intuitive playlist functionality.

## 🏗️ Technical Architecture

### Core Technologies
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Node.js with Electron framework
- **Audio Processing**: Web Audio API + HTML5 Audio Element
- **Data Storage**: IndexedDB for persistent storage
- **Visualization**: Canvas-based spectrum analyzer
- **Build System**: electron-builder for cross-platform packaging

### Key Components

#### 1. **Main Process (main.js)**
- Electron application window management (1200x800 default)
- Native file system operations via IPC handlers
- Cross-platform menu system with keyboard shortcuts
- File dialogs for save/load operations
- About dialog with application info

#### 2. **Core Application Logic (app.js)**
- **SoundPlayer Class**: Main application controller (~1679 lines)
- **Audio System**: Web Audio API integration with spectrum visualization
- **Library Management**: Folder-based organization with drag-and-drop
- **Search System**: Real-time case-insensitive file filtering
- **Playlist Features**: Shuffle, repeat, auto-scroll functionality
- **Data Persistence**: IndexedDB for library state and file storage

#### 3. **User Interface (index.html + styles.css)**
- Modern dark theme with purple accent colors
- Responsive sidebar with folder navigation
- Main content area with file grid layout
- Bottom controls panel with playback and visualization
- Real-time spectrum analyzer display

## 🎯 Key Features

### Audio Playback
- ✅ High-quality audio playback with Web Audio API
- ✅ Real-time spectrum visualization (256-point FFT)
- ✅ Volume control and seek functionality
- ✅ Support for common audio formats (MP3, WAV, OGG, etc.)

### Library Management
- ✅ **Folder Organization**: Create, rename, delete folders
- ✅ **File Management**: Upload, organize, delete audio files
- ✅ **Persistent Storage**: IndexedDB for local data persistence
- ✅ **Save/Load Library**: Export/import library as ZIP files
- ✅ **Auto-scroll**: Automatically scroll to currently playing track

### Search & Navigation
- ✅ **Real-time Search**: Instant filtering as you type
- ✅ **Case-insensitive**: Flexible search matching
- ✅ **Keyboard Shortcuts**: `Ctrl+F` to focus search, `Escape` to clear
- ✅ **Folder Switching**: Easy navigation between collections

### Playlist Features
- ✅ **Shuffle Mode**: Random track selection (mutually exclusive with repeat)
- ✅ **Repeat Modes**: Repeat one track or all tracks
- ✅ **Auto-scroll**: Automatic scrolling to current track (default enabled)
- ✅ **Track Navigation**: Previous/next with arrow keys or buttons

## 🔧 Technical Implementation Details

### Audio Architecture
```javascript
// Web Audio API Integration
this.audioContext = new AudioContext();
this.audioSource = this.audioContext.createMediaElementSource(this.audioElement);
this.analyser = this.audioContext.createAnalyser();
this.analyser.fftSize = 256;
this.audioSource.connect(this.analyser);
this.analyser.connect(this.audioContext.destination);
```

### Data Management
- **Files Map**: Stores file metadata (ID, name, URL)
- **Folders Map**: Organizes files into collections
- **IndexedDB**: Persistent storage for library state and audio files
- **Object URLs**: Blob URLs for audio file playback with cleanup management

### Visualization System
- Canvas-based spectrum analyzer with 256-point FFT
- Real-time frequency data visualization
- Responsive design that adapts to canvas size
- Gradient color scheme (purple theme)

## 📁 File Structure

```
SoundPlayer-Cursor/
├── main.js              # Electron main process (153 lines)
├── app.js               # Core application logic (1679 lines)
├── index.html           # Main UI structure (99 lines)
├── styles.css           # Complete styling (690 lines)
├── preload.js           # Electron security bridge (10 lines)
├── server.py            # Local HTTP server for web testing (24 lines)
├── package.json         # Project configuration and dependencies
├── README.md            # Comprehensive documentation (150 lines)
├── CLAUDE.md            # Developer guidance for AI assistance
├── LICENSE              # MIT license
├── screenshot.png       # Application screenshot
└── .gitignore           # Git ignore rules
```

## 🎮 User Experience Features

### Keyboard Shortcuts
- `Space`: Play/Pause
- `→` / `←`: Next/Previous track
- `Ctrl+F`: Focus search bar
- `Escape`: Clear search
- `Delete`: Delete selected track
- `Ctrl+Q` / `Cmd+Q`: Exit application

### UI/UX Highlights
- **Dark Theme**: Modern purple-accented dark interface
- **Responsive Design**: Adapts to different window sizes
- **Notification System**: User feedback for actions
- **Loading Indicators**: Progress feedback for operations
- **Drag & Drop**: Easy file organization (planned)

## 🚀 Build & Distribution

### Development Commands
```bash
npm start           # Launch development version
npm run build       # Build for current platform
npm run build:win   # Build Windows installer (NSIS)
npm run build:mac   # Build macOS DMG
npm run build:linux # Build Linux AppImage/DEB
npm run build:all   # Build for Windows and Linux
```

### Distribution Formats
- **Windows**: NSIS installer (`SoundPlayer-Setup.exe`)
- **macOS**: DMG package (`SoundPlayer.dmg`)
- **Linux**: AppImage (`SoundPlayer.AppImage`) or DEB package

## 💾 Data Management

### Storage Strategy
- **Local Files**: Stored as ArrayBuffer in IndexedDB
- **Metadata**: File names, folder associations, player state
- **Library Backup**: ZIP format with JSON metadata
- **Cleanup**: Automatic cleanup of blob URLs to prevent memory leaks

### Persistence Features
- Library state survives application restarts
- Folder structure and file organization maintained
- Player preferences (shuffle, repeat, auto-scroll) remembered
- Search state and current track position preserved

## 🔮 Project Status

This appears to be a **mature, feature-complete** desktop audio player with:
- ✅ Core audio playback functionality
- ✅ Advanced library management
- ✅ Modern UI/UX design
- ✅ Cross-platform compatibility
- ✅ Comprehensive documentation
- ✅ Professional build system

The project demonstrates excellent software engineering practices with clean architecture, proper error handling, and user-friendly design principles.

## 🎭 Creator

**Created by [@AntDX316](https://twitter.com/AntDX316)**
- Version: 1.0.0
- License: MIT
- Built with: Electron, Web Audio API, IndexedDB
- Platform: Cross-platform (Windows, macOS, Linux)

---

*This summary was generated by analyzing the complete codebase structure and implementation details.*