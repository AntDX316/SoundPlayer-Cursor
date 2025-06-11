class SoundPlayer {
    constructor() {
        this.audioContext = null;
        this.audioElement = new Audio();
        this.audioSource = null;
        this.analyser = null;
        this.folders = new Map();
        this.currentFolder = 'all';
        this.files = new Map();
        this.currentTrack = null;
        this.isPlaying = false;
        this.isShuffleOn = false;
        this.isRepeatOneOn = false;
        this.db = null;
        this.selectedFiles = new Set();
        this.searchQuery = '';
        this.filteredFiles = new Set();
        this.isSeeking = false;
        this.isAutoScrollOn = true; // Auto-scroll enabled by default
        
        this.initDB().then(() => {
            this.createDefaultFolder();
            this.setupEventListeners();
            this.loadState();
        });
    }

    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('SoundPlayerDB', 1);
            
            request.onerror = () => reject(request.error);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('files')) {
                    db.createObjectStore('files');
                }
                if (!db.objectStoreNames.contains('state')) {
                    db.createObjectStore('state');
                }
            };
            
            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve();
            };
        });
    }

    handleFileUpload(event) {
        const files = event.target.files;
        if (files.length === 0) return;

        // Ensure current folder exists
        if (!this.folders.has(this.currentFolder)) {
            this.createDefaultFolder();
            this.currentFolder = 'all';
        }

        Array.from(files).forEach(file => {
            const fileId = Date.now() + '-' + file.name;
            const reader = new FileReader();
            
            reader.onload = (e) => {
                // Store file in IndexedDB
                const transaction = this.db.transaction(['files'], 'readwrite');
                const store = transaction.objectStore('files');
                store.put(e.target.result, fileId).onsuccess = () => {
                    console.log(`File ${file.name} stored successfully`);
                };
            };
            
            reader.readAsArrayBuffer(file);

            this.files.set(fileId, {
                id: fileId,
                name: file.name,
                url: URL.createObjectURL(file)
            });
            
            // Add to current folder
            const currentFolder = this.folders.get(this.currentFolder);
            if (!currentFolder.files) {
                currentFolder.files = new Set();
            }
            currentFolder.files.add(fileId);

            // Add to All Files
            if (this.currentFolder !== 'all') {
                const allFolder = this.folders.get('all');
                if (!allFolder.files) {
                    allFolder.files = new Set();
                }
                allFolder.files.add(fileId);
            }
        });

        event.target.value = '';
        this.updateFilesList();
        this.saveState();
    }

    saveState() {
        const state = {
            folders: Array.from(this.folders.entries()).map(([id, folder]) => ({
                id,
                name: folder.name,
                files: Array.from(folder.files || [])
            })),
            files: Array.from(this.files.entries()).map(([id, file]) => ({
                id,
                name: file.name
            })),
            currentFolder: this.currentFolder,
            currentTrack: this.currentTrack,
            isShuffleOn: this.isShuffleOn,
            isRepeatOneOn: this.isRepeatOneOn,
            isAutoScrollOn: this.isAutoScrollOn
        };

        const transaction = this.db.transaction(['state'], 'readwrite');
        const store = transaction.objectStore('state');
        
        return new Promise((resolve, reject) => {
            const request = store.put(state, 'currentState');
            request.onsuccess = () => {
                console.log('State saved successfully');
                resolve();
            };
            request.onerror = () => {
                console.error('Failed to save state:', request.error);
                reject(request.error);
            };
        });
    }

    async loadState() {
        try {
            const transaction = this.db.transaction(['state', 'files'], 'readonly');
            const stateStore = transaction.objectStore('state');
            const filesStore = transaction.objectStore('files');

            const state = await new Promise((resolve) => {
                stateStore.get('currentState').onsuccess = (event) => {
                    resolve(event.target.result);
                };
            });

            if (state) {
                // Clear current state
                this.folders.clear();
                this.files.clear();

                // Restore folders
                state.folders.forEach(folder => {
                    this.folders.set(folder.id, {
                        name: folder.name,
                        files: new Set(folder.files || [])
                    });
                });

                // Restore files
                for (const file of state.files) {
                    const fileData = await new Promise((resolve) => {
                        filesStore.get(file.id).onsuccess = (event) => {
                            resolve(event.target.result);
                        };
                    });

                    if (fileData) {
                        const blob = new Blob([fileData]);
                        const url = URL.createObjectURL(blob);
                        this.files.set(file.id, {
                            id: file.id,
                            name: file.name,
                            url: url
                        });
                    }
                }

                // Restore player state
                this.currentFolder = state.currentFolder || 'all';
                this.currentTrack = state.currentTrack || null;
                this.isShuffleOn = state.isShuffleOn || false;
                this.isRepeatOneOn = state.isRepeatOneOn || false;
                this.isAutoScrollOn = state.isAutoScrollOn !== undefined ? state.isAutoScrollOn : true;

                // Update UI
                this.updateFoldersList();
                this.updateFilesList();
                
                // Update folder name in header
                const currentFolderElement = document.getElementById('currentFolderName');
                if (currentFolderElement && this.folders.has(this.currentFolder)) {
                    currentFolderElement.textContent = this.folders.get(this.currentFolder).name;
                }
                
                // Update controls state
                document.getElementById('shuffleBtn').classList.toggle('active', this.isShuffleOn);
                document.getElementById('repeatOneBtn').classList.toggle('active', this.isRepeatOneOn);
                const autoScrollBtn = document.getElementById('autoScrollBtn');
                if (autoScrollBtn) {
                    autoScrollBtn.classList.toggle('active', this.isAutoScrollOn);
                }

                // If there was a track playing, restore it
                if (this.currentTrack) {
                    const file = this.files.get(this.currentTrack);
                    if (file) {
                        document.getElementById('currentTrack').textContent = file.name;
                    }
                }
            }
        } catch (err) {
            console.warn('Failed to load state:', err);
            this.createDefaultFolder();
        }
    }

    initializeAudioContext() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.audioSource = this.audioContext.createMediaElementSource(this.audioElement);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            this.audioSource.connect(this.analyser);
            this.analyser.connect(this.audioContext.destination);
            this.setupVisualizer();
        }
    }

    setupVisualizer() {
        const canvas = document.getElementById('visualizer');
        const ctx = canvas.getContext('2d');
        
        // Set canvas size to match its display size
        const resizeCanvas = () => {
            const rect = canvas.getBoundingClientRect();
            canvas.width = rect.width * window.devicePixelRatio;
            canvas.height = rect.height * window.devicePixelRatio;
            ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        };
        
        // Resize canvas initially and on window resize
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            const WIDTH = canvas.width / window.devicePixelRatio;
            const HEIGHT = canvas.height / window.devicePixelRatio;

            requestAnimationFrame(draw);

            this.analyser.getByteFrequencyData(dataArray);

            ctx.fillStyle = 'rgb(0, 0, 0)';
            ctx.fillRect(0, 0, WIDTH, HEIGHT);

            const barWidth = (WIDTH / bufferLength) * 2.5;
            let barHeight;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                barHeight = (dataArray[i] / 255) * HEIGHT;

                const gradient = ctx.createLinearGradient(0, HEIGHT, 0, HEIGHT - barHeight);
                gradient.addColorStop(0, '#8b5cf6');  // Primary color at bottom
                gradient.addColorStop(1, '#7c3aed');  // Darker shade at top

                ctx.fillStyle = gradient;
                ctx.fillRect(x, HEIGHT - barHeight, barWidth, barHeight);

                x += barWidth + 1;
            }
        };

        draw();
    }

    setupEventListeners() {
        console.log('Setting up event listeners...');
        
        // File upload
        const fileUploadBtn = document.getElementById('fileUpload');
        console.log('File upload button:', fileUploadBtn);
        if (fileUploadBtn) {
            fileUploadBtn.addEventListener('click', () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.multiple = true;
                input.accept = 'audio/*';
                input.onchange = (e) => this.handleFileUpload(e);
                input.click();
            });
        }

        // New folder button
        const newFolderBtn = document.getElementById('newFolderBtn');
        if (newFolderBtn) {
            newFolderBtn.addEventListener('click', () => {
                this.createNewFolder();
            });
        }

        // Playback controls
        const playBtn = document.getElementById('playBtn');
        if (playBtn) {
            playBtn.addEventListener('click', () => this.togglePlay());
        }

        const prevBtn = document.getElementById('prevBtn');
        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.playPrevious());
        }

        const nextBtn = document.getElementById('nextBtn');
        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.playNext());
        }

        const volumeSlider = document.getElementById('volumeSlider');
        if (volumeSlider) {
            volumeSlider.addEventListener('input', (e) => this.setVolume(e.target.value));
        }

        const seekBar = document.getElementById('seekBar');
        if (seekBar) {
            seekBar.addEventListener('input', (e) => this.seek(e.target.value));
            seekBar.addEventListener('change', (e) => this.seek(e.target.value));
            // Also handle mouse events for better responsiveness
            seekBar.addEventListener('mousedown', () => {
                this.isSeeking = true;
            });
            seekBar.addEventListener('mouseup', () => {
                this.isSeeking = false;
            });
        }

        // Audio element events
        this.audioElement.addEventListener('timeupdate', () => this.updateProgress());
        this.audioElement.addEventListener('ended', () => this.handleTrackEnd());
        this.audioElement.addEventListener('loadedmetadata', () => this.updateDuration());

        // Playlist controls
        const shuffleBtn = document.getElementById('shuffleBtn');
        if (shuffleBtn) {
            shuffleBtn.addEventListener('click', () => this.toggleShuffle());
        }

        const repeatOneBtn = document.getElementById('repeatOneBtn');
        if (repeatOneBtn) {
            repeatOneBtn.addEventListener('click', () => this.toggleRepeatOne());
        }

        const autoScrollBtn = document.getElementById('autoScrollBtn');
        if (autoScrollBtn) {
            autoScrollBtn.addEventListener('click', () => this.toggleAutoScroll());
        }

        // Save/Load buttons
        const saveStateBtn = document.getElementById('saveStateBtn');
        if (saveStateBtn) {
            saveStateBtn.addEventListener('click', () => this.saveToFile());
        }

        const loadStateBtn = document.getElementById('loadStateBtn');
        if (loadStateBtn) {
            loadStateBtn.addEventListener('click', () => this.loadFromFile());
        }

        // Search functionality
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    this.clearSearch();
                }
            });
        }

        const clearSearchBtn = document.getElementById('clearSearch');
        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', () => this.clearSearch());
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                this.saveToFile();
            } else if (e.ctrlKey && e.key === 'o') {
                e.preventDefault();
                this.loadFromFile();
            } else if (e.ctrlKey && e.key === 'f') {
                e.preventDefault();
                const searchInput = document.getElementById('searchInput');
                if (searchInput) {
                    searchInput.focus();
                }
            }
        });

        console.log('Event listeners setup complete');
    }

    handleSearch(query) {
        this.searchQuery = query.toLowerCase().trim();
        const clearSearchBtn = document.getElementById('clearSearch');
        
        if (this.searchQuery) {
            clearSearchBtn.style.display = 'flex';
            this.filterFiles();
        } else {
            clearSearchBtn.style.display = 'none';
            this.filteredFiles.clear();
        }
        
        this.updateFilesList();
    }

    filterFiles() {
        this.filteredFiles.clear();
        const folderFiles = this.folders.get(this.currentFolder).files;
        
        folderFiles.forEach(fileId => {
            const file = this.files.get(fileId);
            if (file && file.name.toLowerCase().includes(this.searchQuery)) {
                this.filteredFiles.add(fileId);
            }
        });
    }

    clearSearch() {
        const searchInput = document.getElementById('searchInput');
        const clearSearchBtn = document.getElementById('clearSearch');
        
        searchInput.value = '';
        this.searchQuery = '';
        this.filteredFiles.clear();
        clearSearchBtn.style.display = 'none';
        
        this.updateFilesList();
    }

    createDefaultFolder() {
        if (!this.folders.has('all')) {
            this.folders.set('all', { 
                name: 'All Files', 
                files: new Set() 
            });
        }
        this.updateFoldersList();
    }

    updateFoldersList() {
        const foldersContainer = document.getElementById('folders');
        foldersContainer.innerHTML = '';

        // Remove any existing event listeners
        const newContainer = foldersContainer.cloneNode(false);
        newContainer.id = 'folders'; // Ensure the ID is preserved
        foldersContainer.parentNode.replaceChild(newContainer, foldersContainer);

        this.folders.forEach((folder, folderId) => {
            const folderElement = document.createElement('div');
            folderElement.className = `folder-item ${this.currentFolder === folderId ? 'active' : ''}`;
            folderElement.dataset.folderId = folderId;
            
            folderElement.innerHTML = `
                <div class="folder-name">
                    <span class="material-icons">folder</span>
                    ${folder.name}
                </div>
                ${folderId !== 'all' ? `
                    <div class="folder-controls">
                        <button class="folder-btn rename" title="Rename folder">
                            <span class="material-icons">edit</span>
                        </button>
                        <button class="folder-btn delete" title="Delete folder">
                            <span class="material-icons">delete</span>
                        </button>
                    </div>
                ` : ''}
            `;

            newContainer.appendChild(folderElement);
        });

        // Use event delegation for all folder interactions
        newContainer.addEventListener('click', (e) => {
            const folderItem = e.target.closest('.folder-item');
            if (!folderItem) return;

            const folderId = folderItem.dataset.folderId;
            
            // Handle folder control buttons - check for both button and icon clicks
            const renameBtn = e.target.closest('.folder-btn.rename');
            const deleteBtn = e.target.closest('.folder-btn.delete');
            
            if (renameBtn) {
                e.stopPropagation();
                e.preventDefault();
                this.renameFolder(folderId);
                return;
            }
            
            if (deleteBtn) {
                e.stopPropagation();
                e.preventDefault();
                this.deleteFolder(folderId);
                return;
            }
            
            // Handle folder selection (only if not clicking on controls)
            if (!e.target.closest('.folder-controls')) {
                e.preventDefault();
                e.stopPropagation();
                this.switchFolder(folderId);
            }
        });
    }

    updateFolderActiveStates() {
        const foldersContainer = document.getElementById('folders');
        const folderElements = foldersContainer.querySelectorAll('.folder-item');
        
        folderElements.forEach(folderElement => {
            const folderId = folderElement.dataset.folderId;
            if (folderId === this.currentFolder) {
                folderElement.classList.add('active');
            } else {
                folderElement.classList.remove('active');
            }
        });
    }

    updateFilesList() {
        const filesGrid = document.getElementById('filesGrid');
        filesGrid.innerHTML = '';

        // Add toolbar for multi-select operations
        const toolbar = document.createElement('div');
        toolbar.className = 'files-toolbar';
        toolbar.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 16px;
            background: #1a1a1a;
            border-radius: 8px;
            margin: 8px;
        `;

        const selectionTools = document.createElement('div');
        selectionTools.style.cssText = `
            display: flex;
            gap: 8px;
            align-items: center;
        `;



        const clearAllBtn = document.createElement('button');
        clearAllBtn.innerHTML = '<span class="material-icons">cleaning_services</span> Clear All';
        clearAllBtn.className = 'toolbar-btn';
        clearAllBtn.style.cssText = `
            background: #666;
            color: white;
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 14px;
        `;

        selectionTools.appendChild(clearAllBtn);
        toolbar.appendChild(selectionTools);
        filesGrid.appendChild(toolbar);

        // Use filtered files if search is active, otherwise use all folder files
        const folderFiles = this.folders.get(this.currentFolder).files;
        const filesToShow = this.searchQuery ? this.filteredFiles : folderFiles;
        
        // Show search results info
        if (this.searchQuery) {
            const searchInfo = document.createElement('div');
            searchInfo.style.cssText = `
                padding: 12px 16px;
                background: rgba(139, 92, 246, 0.1);
                border: 1px solid rgba(139, 92, 246, 0.3);
                border-radius: 8px;
                margin: 8px;
                color: #a0a0a0;
                font-size: 14px;
            `;
            searchInfo.innerHTML = `
                <span class="material-icons" style="vertical-align: middle; margin-right: 8px; font-size: 18px;">search</span>
                Found ${filesToShow.size} result${filesToShow.size !== 1 ? 's' : ''} for "${this.searchQuery}"
            `;
            filesGrid.appendChild(searchInfo);
        }

        filesToShow.forEach(fileId => {
            const file = this.files.get(fileId);
            if (!file) return;

            const fileElement = document.createElement('div');
            fileElement.className = `file-card ${this.currentTrack === fileId ? 'playing' : ''} ${this.selectedFiles.has(fileId) ? 'selected' : ''}`;
            fileElement.dataset.fileId = fileId;
            fileElement.innerHTML = `
                <div class="file-content">
                    <div class="file-info">
                        <span class="material-icons">audio_file</span>
                        <p>${file.name}</p>
                    </div>
                    <button class="delete-btn" title="Delete file">
                        <span class="material-icons">delete</span>
                    </button>
                </div>
            `;
            
            // Add click handler for selection
            fileElement.addEventListener('click', (e) => {
                if (e.ctrlKey || e.metaKey) {
                    // Toggle selection
                    if (this.selectedFiles.has(fileId)) {
                        this.selectedFiles.delete(fileId);
                        fileElement.classList.remove('selected');
                    } else {
                        this.selectedFiles.add(fileId);
                        fileElement.classList.add('selected');
                    }
                } else if (e.shiftKey && this.lastSelectedFile) {
                    // Range selection
                    const fileElements = Array.from(filesGrid.querySelectorAll('.file-card'));
                    const lastIndex = fileElements.findIndex(el => el.dataset.fileId === this.lastSelectedFile);
                    const currentIndex = fileElements.findIndex(el => el.dataset.fileId === fileId);
                    const start = Math.min(lastIndex, currentIndex);
                    const end = Math.max(lastIndex, currentIndex);

                    for (let i = start; i <= end; i++) {
                        const el = fileElements[i];
                        const id = el.dataset.fileId;
                        this.selectedFiles.add(id);
                        el.classList.add('selected');
                    }
                } else {
                    // Single selection
                    if (!e.target.closest('.delete-btn')) {
                        this.selectedFiles.clear();
                        filesGrid.querySelectorAll('.file-card').forEach(card => card.classList.remove('selected'));
                        this.selectedFiles.add(fileId);
                        fileElement.classList.add('selected');
                        this.playFile(fileId);
                    }
                }

                this.lastSelectedFile = fileId;
            });

            // Add click handler for delete button
            fileElement.querySelector('.delete-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteFile(fileId);
            });

            filesGrid.appendChild(fileElement);
        });

        // Add handlers for toolbar buttons
        clearAllBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear all files and folders? This cannot be undone.')) {
                this.clearAll();
            }
        });
    }

    playFile(fileId) {
        const file = this.files.get(fileId);
        if (!file) return;

        this.currentTrack = fileId;
        this.audioElement.src = file.url;
        document.getElementById('currentTrack').textContent = file.name;
        
        // Update selection to match the currently playing track
        this.selectedFiles.clear();
        this.selectedFiles.add(fileId);
        this.lastSelectedFile = fileId;
        
        this.play();
        this.updateFilesList(); // Update to show which file is playing
        
        // Auto-scroll to the current track if enabled
        if (this.isAutoScrollOn) {
            // Use setTimeout to ensure the file list is updated first
            setTimeout(() => this.scrollToCurrentTrack(), 100);
        }
    }

    togglePlay() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    play() {
        if (!this.audioContext) {
            this.initializeAudioContext();
        }
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        this.audioElement.play()
            .then(() => {
                this.isPlaying = true;
                document.getElementById('playBtn').innerHTML = '<span class="material-icons">pause</span>';
            })
            .catch(error => {
                console.error('Error playing audio:', error);
                this.isPlaying = false;
                document.getElementById('playBtn').innerHTML = '<span class="material-icons">play_arrow</span>';
            });
    }

    pause() {
        this.audioElement.pause();
        this.isPlaying = false;
        document.getElementById('playBtn').innerHTML = '<span class="material-icons">play_arrow</span>';
    }

    playPrevious() {
        if (!this.currentTrack) return;
        
        const files = Array.from(this.folders.get(this.currentFolder).files);
        const currentIndex = files.indexOf(this.currentTrack);
        const previousIndex = (currentIndex - 1 + files.length) % files.length;
        this.playFile(files[previousIndex]);
    }

    playNext() {
        if (!this.currentTrack) return;
        
        const files = Array.from(this.folders.get(this.currentFolder).files);
        if (files.length === 0) return;

        if (this.isShuffleOn) {
            this.playRandomTrack();
            return;
        }
        
        const currentIndex = files.indexOf(this.currentTrack);
        const nextIndex = (currentIndex + 1) % files.length;
        this.playFile(files[nextIndex]);
    }

    setVolume(value) {
        this.audioElement.volume = value / 100;
    }

    seek(value) {
        if (!this.audioElement.duration || isNaN(this.audioElement.duration)) {
            return; // Can't seek if no audio is loaded or duration is invalid
        }
        const time = (value * this.audioElement.duration) / 100;
        this.audioElement.currentTime = time;
    }

    updateProgress() {
        if (!this.audioElement.duration || isNaN(this.audioElement.duration)) {
            return; // Can't update progress if no audio is loaded or duration is invalid
        }
        const progress = (this.audioElement.currentTime / this.audioElement.duration) * 100;
        const seekBar = document.getElementById('seekBar');
        // Only update seek bar if user is not currently seeking
        if (seekBar && !this.isSeeking) {
            seekBar.value = progress || 0;
        }
        const currentTimeEl = document.getElementById('currentTime');
        if (currentTimeEl) {
            currentTimeEl.textContent = this.formatTime(this.audioElement.currentTime || 0);
        }
    }

    updateDuration() {
        const durationEl = document.getElementById('duration');
        if (durationEl) {
            durationEl.textContent = this.formatTime(this.audioElement.duration || 0);
        }
    }

    formatTime(seconds) {
        if (!seconds || isNaN(seconds)) {
            return '0:00';
        }
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    toggleShuffle() {
        this.isShuffleOn = !this.isShuffleOn;
        
        // If shuffle is being turned on, turn off repeat
        if (this.isShuffleOn && this.isRepeatOneOn) {
            this.isRepeatOneOn = false;
            document.getElementById('repeatOneBtn').classList.remove('active');
        }
        
        document.getElementById('shuffleBtn').classList.toggle('active', this.isShuffleOn);
        this.saveState();
    }

    toggleRepeatOne() {
        this.isRepeatOneOn = !this.isRepeatOneOn;
        
        // If repeat is being turned on, turn off shuffle
        if (this.isRepeatOneOn && this.isShuffleOn) {
            this.isShuffleOn = false;
            document.getElementById('shuffleBtn').classList.remove('active');
        }
        
        document.getElementById('repeatOneBtn').classList.toggle('active', this.isRepeatOneOn);
        this.saveState();
    }

    toggleAutoScroll() {
        this.isAutoScrollOn = !this.isAutoScrollOn;
        document.getElementById('autoScrollBtn').classList.toggle('active', this.isAutoScrollOn);
        this.saveState();
        
        // If auto-scroll is being turned on and there's a current track, scroll to it
        if (this.isAutoScrollOn && this.currentTrack) {
            this.scrollToCurrentTrack();
        }
    }

    scrollToCurrentTrack() {
        if (!this.currentTrack) return;
        
        const filesGrid = document.getElementById('filesGrid');
        const currentTrackElement = filesGrid.querySelector(`[data-file-id="${this.currentTrack}"]`);
        
        if (currentTrackElement) {
            currentTrackElement.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'nearest'
            });
        }
    }

    handleTrackEnd() {
        if (this.isRepeatOneOn) {
            this.audioElement.currentTime = 0;
            this.play();
        } else if (this.isShuffleOn) {
            this.playRandomTrack();
        } else {
            this.playNext();
        }
    }

    playRandomTrack() {
        const files = Array.from(this.folders.get(this.currentFolder).files);
        if (files.length === 0) return;
        
        const randomIndex = Math.floor(Math.random() * files.length);
        this.playFile(files[randomIndex]);
    }

    showInputDialog(title, placeholder = '', initialValue = '') {
        return new Promise((resolve) => {
            // Create backdrop
            const backdrop = document.createElement('div');
            backdrop.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                z-index: 9999;
                display: flex;
                align-items: center;
                justify-content: center;
            `;

            // Create dialog
            const dialog = document.createElement('div');
            dialog.style.cssText = `
                background: rgba(30, 30, 30, 0.98);
                color: white;
                padding: 24px;
                border-radius: 8px;
                min-width: 300px;
                max-width: 500px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.5);
                border: 1px solid rgba(255, 255, 255, 0.1);
            `;

            dialog.innerHTML = `
                <h3 style="margin-top: 0; margin-bottom: 16px; color: white;">${title}</h3>
                <input type="text" value="${initialValue}" placeholder="${placeholder}"
                    style="width: 100%; padding: 12px; border-radius: 4px; border: 1px solid #444; 
                    background: #222; color: white; margin-bottom: 16px; font-size: 14px;
                    outline: none; box-sizing: border-box;">
                <div style="display: flex; justify-content: flex-end; gap: 8px;">
                    <button class="cancel-btn" 
                        style="padding: 10px 20px; border-radius: 4px; border: none; 
                        background: #666; color: white; cursor: pointer; font-size: 14px;">Cancel</button>
                    <button class="confirm-btn" 
                        style="padding: 10px 20px; border-radius: 4px; border: none; 
                        background: #2196f3; color: white; cursor: pointer; font-size: 14px;">OK</button>
                </div>
            `;

            backdrop.appendChild(dialog);

            const input = dialog.querySelector('input');
            
            const cleanup = () => {
                if (backdrop.parentNode) {
                    document.body.removeChild(backdrop);
                }
            };

            dialog.querySelector('.cancel-btn').addEventListener('click', () => {
                cleanup();
                resolve(null);
            });

            dialog.querySelector('.confirm-btn').addEventListener('click', () => {
                const value = input.value.trim();
                cleanup();
                resolve(value || null);
            });

            input.addEventListener('keyup', (e) => {
                if (e.key === 'Enter') {
                    const value = input.value.trim();
                    cleanup();
                    resolve(value || null);
                } else if (e.key === 'Escape') {
                    cleanup();
                    resolve(null);
                }
            });

            // Close on backdrop click
            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop) {
                    cleanup();
                    resolve(null);
                }
            });

            document.body.appendChild(backdrop);
            
            // Focus the input after a short delay to ensure it's rendered
            setTimeout(() => {
                input.focus();
                input.select();
            }, 10);
        });
    }

    async createNewFolder() {
        console.log('Creating new folder...');
        const folderName = await this.showInputDialog('Create New Folder', 'Enter folder name');
        console.log('Folder name:', folderName);
        
        if (folderName) {
            const folderId = 'folder_' + Date.now();
            console.log('Creating folder with ID:', folderId);
            
            this.folders.set(folderId, { 
                name: folderName, 
                files: new Set() 
            });
            
            console.log('Current folders:', this.folders);
            this.updateFoldersList();
            this.switchFolder(folderId);
            this.saveState();
        }
    }

    async renameFolder(folderId) {
        const folder = this.folders.get(folderId);
        if (!folder || folderId === 'all') return;

        const newName = await this.showInputDialog('Rename Folder', 'Enter new folder name', folder.name);
        if (newName && newName !== folder.name) {
            folder.name = newName;
            this.updateFoldersList();
            if (this.currentFolder === folderId) {
                document.getElementById('currentFolderName').textContent = folder.name;
            }
            this.saveState();
        }
    }

    deleteFolder(folderId) {
        if (folderId === 'all') return;

        const folder = this.folders.get(folderId);
        if (!folder) return;

        if (confirm(`Are you sure you want to delete the folder "${folder.name}"?`)) {
            // Move files to "All Files" if they're not already there
            folder.files.forEach(fileId => {
                this.folders.get('all').files.add(fileId);
            });

            // Delete the folder
            this.folders.delete(folderId);

            // Switch to "All Files" if the deleted folder was current
            if (this.currentFolder === folderId) {
                this.switchFolder('all');
            } else {
                this.updateFoldersList();
            }
            this.saveState();
        }
    }

    switchFolder(folderId) {
        this.currentFolder = folderId;
        const folder = this.folders.get(folderId);
        if (folder) {
            document.getElementById('currentFolderName').textContent = folder.name;
            // Clear search when switching folders
            this.clearSearch();
            // Update folder active states without recreating the entire list
            this.updateFolderActiveStates();
            this.updateFilesList();
            // Save the current folder selection
            this.saveState();
        }
    }

    deleteFile(fileId) {
        const file = this.files.get(fileId);
        if (!file) return;

        if (confirm(`Are you sure you want to delete "${file.name}"?`)) {
            // Remove from all folders
            this.folders.forEach(folder => {
                folder.files.delete(fileId);
            });

            // Remove from files map
            this.files.delete(fileId);

            // Remove from IndexedDB
            const transaction = this.db.transaction(['files'], 'readwrite');
            const store = transaction.objectStore('files');
            store.delete(fileId);

            // If this was the current track, stop playback
            if (this.currentTrack === fileId) {
                this.audioElement.pause();
                this.audioElement.src = '';
                this.currentTrack = null;
                this.isPlaying = false;
                document.getElementById('currentTrack').textContent = 'No track selected';
                document.getElementById('playBtn').innerHTML = '<span class="material-icons">play_arrow</span>';
            }

            // Update the display
            this.updateFilesList();
            this.saveState();
        }
    }

    async showLoadingDialog(message) {
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(30, 30, 30, 0.95);
            color: white;
            padding: 20px;
            border-radius: 8px;
            z-index: 1000;
            min-width: 300px;
            text-align: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        `;

        const messageEl = document.createElement('div');
        messageEl.textContent = message;
        messageEl.style.marginBottom = '15px';
        dialog.appendChild(messageEl);

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.cssText = `
            background: #ff4444;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            transition: background 0.2s;
        `;
        cancelBtn.onmouseover = () => cancelBtn.style.background = '#ff6666';
        cancelBtn.onmouseout = () => cancelBtn.style.background = '#ff4444';
        dialog.appendChild(cancelBtn);

        document.body.appendChild(dialog);

        return {
            dialog,
            messageEl,
            cancelBtn,
            updateMessage: (text) => messageEl.textContent = text
        };
    }

    async saveToFile() {
        let abortController = new AbortController();
        let loadingDialog = null;

        try {
            // Show save dialog immediately
            const result = await window.electron.showSaveDialog({
                title: 'Save Library',
                defaultPath: 'soundplayer-library.zip',
                filters: [
                    { name: 'ZIP Files', extensions: ['zip'] }
                ]
            });
            
            if (!result) return; // User cancelled
            const savePath = result;

            loadingDialog = await this.showLoadingDialog('Preparing library for download...');
            loadingDialog.cancelBtn.addEventListener('click', () => {
                abortController.abort();
                document.body.removeChild(loadingDialog.dialog);
                alert('Save operation cancelled');
            });

            // Get unique file IDs from all folders
            const uniqueFileIds = new Set();
            this.folders.forEach(folder => {
                folder.files.forEach(fileId => uniqueFileIds.add(fileId));
            });

            // Prepare the metadata
            const metadata = {
                folders: Array.from(this.folders.entries()).map(([id, folder]) => ({
                    id,
                    name: folder.name,
                    files: Array.from(folder.files || [])
                })),
                fileInfo: []
            };

            // Create zip file
            const zip = new JSZip();
            zip.file('metadata.json', JSON.stringify(metadata, null, 2));

            let processed = 0;
            const total = uniqueFileIds.size;
            console.log(`Saving ${total} unique files...`);
            
            for (const fileId of uniqueFileIds) {
                if (abortController.signal.aborted) {
                    throw new Error('Operation cancelled');
                }

                try {
                    const fileInfo = this.files.get(fileId);
                    if (!fileInfo) {
                        console.warn(`File info not found for ID: ${fileId}`);
                        continue;
                    }

                    processed++;
                    loadingDialog.updateMessage(`Preparing library for download... (${processed}/${total} files)`);

                    const fileData = await this.getFile(fileId);
                    if (fileData) {
                        zip.file(fileId, fileData);
                        metadata.fileInfo.push({
                            id: fileId,
                            name: fileInfo.name
                        });
                    }
                } catch (err) {
                    if (abortController.signal.aborted) throw err;
                    console.warn(`Failed to add file ${fileId} to zip:`, err);
                }
            }

            zip.file('metadata.json', JSON.stringify(metadata, null, 2));

            loadingDialog.updateMessage('Compressing library...');
            const content = await zip.generateAsync({
                type: 'arraybuffer',
                compression: 'DEFLATE',
                compressionOptions: {
                    level: 5
                }
            }, (metadata) => {
                if (abortController.signal.aborted) throw new Error('Operation cancelled');
                loadingDialog.updateMessage(`Compressing library... ${metadata.percent.toFixed(0)}%`);
            });

            // Save using Electron
            await window.electron.saveFile(savePath, content);

            document.body.removeChild(loadingDialog.dialog);
            alert('Library saved successfully to ' + savePath);
        } catch (err) {
            if (loadingDialog && loadingDialog.dialog.parentNode) {
                document.body.removeChild(loadingDialog.dialog);
            }
            if (err.message !== 'Operation cancelled') {
                console.error('Failed to save library:', err);
                alert('Failed to save library: ' + err.message);
            }
        }
    }

    async getFile(fileId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['files'], 'readonly');
            const store = transaction.objectStore('files');
            const request = store.get(fileId);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async loadFromFile() {
        let abortController = new AbortController();
        let loadingDialog = null;

        try {
            // Show open dialog immediately
            const filePath = await window.electron.showOpenDialog({
                title: 'Load Library',
                filters: [
                    { name: 'ZIP Files', extensions: ['zip'] }
                ],
                properties: ['openFile']
            });

            if (!filePath) return; // User cancelled

            loadingDialog = await this.showLoadingDialog('Loading library...');
            loadingDialog.cancelBtn.addEventListener('click', () => {
                abortController.abort();
                document.body.removeChild(loadingDialog.dialog);
                alert('Load operation cancelled');
            });

            // Load file using Electron
            const fileData = await window.electron.loadFile(filePath);
            const zipData = await JSZip.loadAsync(fileData);

            if (abortController.signal.aborted) throw new Error('Operation cancelled');

            const metadataJson = await zipData.file('metadata.json').async('string');
            const metadata = JSON.parse(metadataJson);

            // Clear current state
            this.folders.clear();
            this.files.clear();
            await this.clearDatabase();

            // Create default folder first
            this.createDefaultFolder();
            this.currentFolder = 'all';

            // Restore folders
            metadata.folders.forEach(folder => {
                this.folders.set(folder.id, {
                    name: folder.name,
                    files: new Set(folder.files || [])
                });
            });

            // Restore files
            let processed = 0;
            const total = metadata.fileInfo.length;
            
            for (const fileInfo of metadata.fileInfo) {
                if (abortController.signal.aborted) throw new Error('Operation cancelled');

                try {
                    processed++;
                    loadingDialog.updateMessage(`Loading library... (${processed}/${total} files)`);

                    const fileData = await zipData.file(fileInfo.id).async('arraybuffer');
                    await this.storeFile(fileInfo.id, fileData);

                    const blob = new Blob([fileData]);
                    const url = URL.createObjectURL(blob);
                    
                    this.files.set(fileInfo.id, {
                        id: fileInfo.id,
                        name: fileInfo.name,
                        url: url
                    });

                    const allFolder = this.folders.get('all');
                    if (allFolder && !allFolder.files.has(fileInfo.id)) {
                        allFolder.files.add(fileInfo.id);
                    }
                } catch (err) {
                    if (abortController.signal.aborted) throw err;
                    console.warn(`Failed to load file ${fileInfo.name}:`, err);
                }
            }

            document.body.removeChild(loadingDialog.dialog);

            this.updateFoldersList();
            this.updateFilesList();
            
            const currentFolderName = document.getElementById('currentFolderName');
            if (currentFolderName) {
                currentFolderName.textContent = this.folders.get(this.currentFolder).name;
            }

            alert('Library loaded successfully!');
        } catch (err) {
            if (loadingDialog && loadingDialog.dialog.parentNode) {
                document.body.removeChild(loadingDialog.dialog);
            }
            if (err.message !== 'Operation cancelled') {
                console.error('Failed to load library:', err);
                alert('Failed to load library: ' + err.message);
            }
        }
    }

    async clearDatabase() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['files'], 'readwrite');
            const store = transaction.objectStore('files');
            const request = store.clear();
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async storeFile(fileId, fileData) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['files'], 'readwrite');
            const store = transaction.objectStore('files');
            const request = store.put(fileData, fileId);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    arrayBufferToBase64(buffer) {
        return new Promise((resolve) => {
            const blob = new Blob([buffer]);
            const reader = new FileReader();
            reader.onload = () => {
                const dataUrl = reader.result;
                const base64 = dataUrl.split(',')[1];
                resolve(base64);
            };
            reader.readAsDataURL(blob);
        });
    }

    base64ToArrayBuffer(base64) {
        return fetch(`data:application/octet-stream;base64,${base64}`).then(res => res.arrayBuffer());
    }

    async clearAll() {
        // Stop playback
        if (this.isPlaying) {
            this.pause();
        }
        this.currentTrack = null;
        document.getElementById('currentTrack').textContent = 'No track selected';

        // Clear memory
        this.files.clear();
        this.folders.clear();
        this.selectedFiles.clear();

        // Clear IndexedDB
        await this.clearDatabase();

        // Reset to default state
        this.createDefaultFolder();
        this.currentFolder = 'all';
        
        // Update UI
        this.updateFoldersList();
        this.updateFilesList();
    }
}

// Initialize the sound player when the page loads
window.addEventListener('load', () => {
    window.soundPlayer = new SoundPlayer();
}); 