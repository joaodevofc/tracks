/**
 * DAW-style Multi-track Editor
 * Horizontal timeline interface for track alignment and editing
 */

class TrackEditor {
    constructor() {
        this.currentProject = null;
        this.trackConfigs = new Map();
        this.isLoading = false;
        this.zoomLevel = 100; // pixels per second
        this.pixelsPerSecond = 100;
        
        // Playback state
        this.isPlaying = false;
        this.currentTime = 0;
        this.playbackInterval = null;
        this.maxDuration = 0;
        
        // Web Audio API
        this.audioContext = null;
        this.audioBuffers = new Map(); // Store decoded audio buffers
        this.sourceNodes = new Map(); // Store active source nodes
        this.trackGainNodes = new Map(); // Store gain nodes per track
        this.trackAnalyserNodes = new Map(); // Store analyser nodes per track
        this.visualizationInterval = null; // Interval for level meter updates
        
        // Drag state
        this.dragState = {
            isDragging: false,
            trackId: null,
            startX: 0,
            startOffset: 0,
            startScrollLeft: 0
        };
        
        // Selection state
        this.selectedTrackId = null;
        
        // Playhead drag state
        this.playheadDragState = {
            isDragging: false,
            startX: 0,
            startTime: 0
        };
        
        // Auto-scroll state
        this.autoScrollState = {
            isScrolling: false,
            direction: 0, // -1 for left, 1 for right
            speed: 10,
            animationFrame: null
        };
        
        // Waveform cache for performance
        this.waveformCache = new Map();
        
        // Initialize audio storage
        this.audioStorage = new AudioStorage();
        
        this.init();
    }
    
    init() {
        console.log('[EDITOR] DAW TrackEditor initialized');
        this.setupEventListeners();
        this.initAudioContext();
        this.loadProjectFromURL();
    }
    
    initAudioContext() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();
            console.log('[EDITOR] AudioContext initialized');
        } catch (error) {
            console.error('[EDITOR] Error initializing AudioContext:', error);
        }
    }
    
    setupEventListeners() {
        // Back button
        document.getElementById('backBtn').addEventListener('click', async () => {
            await this.cleanupAndReturn();
        });

        // Save button
        document.getElementById('saveBtn').addEventListener('click', () => {
            this.saveConfiguration();
        });

        // Play/Pause button
        document.getElementById('playPauseBtn').addEventListener('click', () => {
            this.togglePlayPause();
        });

        // Toast close
        document.getElementById('toastClose').addEventListener('click', () => {
            this.hideToast();
        });
        
        // Time ruler click to seek (only here, not on tracks)
        const timeRuler = document.getElementById('timeRuler');
        const timeRulerViewport = timeRuler.querySelector('.daw-time-ruler-viewport');
        const timeRulerTimeline = timeRuler.querySelector('.daw-time-ruler-timeline');
        
        if (timeRulerViewport) {
            timeRulerViewport.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent event bubbling
                this.seekToPosition(e);
            });
            
            // Time ruler drag to seek
            timeRulerViewport.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                this.startPlayheadDrag(e);
            });
        }
        
        // Playlist viewport click to seek
        const playlistViewport = document.getElementById('playlistViewport');
        if (playlistViewport) {
            playlistViewport.addEventListener('click', (e) => {
                // Only seek if clicking on the playlist content, not on a clip
                if (!e.target.closest('.daw-audio-block')) {
                    this.seekToPosition(e);
                }
            });
        }
        
        // Playhead drag (both ruler and playlist playheads)
        const playlistPlayhead = document.getElementById('playhead');
        const rulerPlayhead = document.getElementById('rulerPlayhead');
        
        if (playlistPlayhead) {
            playlistPlayhead.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                this.startPlayheadDrag(e);
            });
        }
        
        if (rulerPlayhead) {
            rulerPlayhead.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                this.startPlayheadDrag(e);
            });
        }
        
        // Scroll to zoom on playlist viewport (reuse existing playlistViewport variable)
        if (playlistViewport) {
            playlistViewport.addEventListener('wheel', (e) => {
                this.handleScrollZoom(e);
            }, { passive: false });
        }
        
        // Scroll to zoom on time ruler viewport (reuse existing timeRulerViewport variable)
        if (timeRulerViewport) {
            timeRulerViewport.addEventListener('wheel', (e) => {
                this.handleScrollZoom(e);
            }, { passive: false });
        }
        
        // Global mouse events for drag
        document.addEventListener('mousemove', (e) => {
            this.handleDragMove(e);
            this.handlePlayheadDragMove(e);
        });
        document.addEventListener('mouseup', () => {
            this.handleDragEnd();
            this.handlePlayheadDragEnd();
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // S or C key to split
            if ((e.key === 's' || e.key === 'S' || e.key === 'c' || e.key === 'C') && this.selectedTrackId) {
                e.preventDefault();
                this.splitSelectedClip();
            }
        });
        
        // Clear sessionStorage when leaving
        window.addEventListener('beforeunload', () => {
            sessionStorage.removeItem('editorProjectId');
            this.cleanup();
        });
        
        // Update playhead on resize
        window.addEventListener('resize', () => {
            this.updatePlayhead();
            // Re-render time ruler to ensure markers are correct
            const timeRuler = document.getElementById('timeRuler');
            const timeRulerTimeline = timeRuler.querySelector('.daw-time-ruler-timeline');
            if (timeRulerTimeline) {
                this.renderTimeRuler(timeRulerTimeline, this.maxDuration);
            }
        });
    }
    
    async loadProjectFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        let projectId = urlParams.get('projectId');
        
        console.log('[EDITOR] Current URL:', window.location.href);
        console.log('[EDITOR] Project ID from URL:', projectId);
        
        // Fallback to sessionStorage
        if (!projectId) {
            projectId = sessionStorage.getItem('editorProjectId');
            console.log('[EDITOR] Project ID from sessionStorage:', projectId);
        }
        
        if (!projectId) {
            console.error('[EDITOR] No project ID provided');
            this.showError('Projeto não encontrado', 'Nenhum ID de projeto foi fornecido.');
            this.hideSplashScreen();
            return;
        }
        
        console.log('[EDITOR] Loading project:', projectId);
        this.isLoading = true;
        
        try {
            // Debug: Check storage availability
            console.log('[EDITOR] Storage manager available:', typeof storage !== 'undefined');
            console.log('[EDITOR] Firebase auth available:', typeof window.firebaseAuth !== 'undefined');
            
            if (typeof window.firebaseAuth !== 'undefined' && window.firebaseAuth.auth) {
                const user = window.firebaseAuth.auth.currentUser;
                console.log('[EDITOR] Current user:', user ? user.uid : 'Not logged in');
            }
            
            // Debug: Check all localStorage keys
            console.log('[EDITOR] All localStorage keys:', Object.keys(localStorage));
            
            // Try multiple storage strategies
            let project = null;
            
            // Strategy 1: Storage Manager
            if (typeof storage !== 'undefined') {
                await storage.load();
                console.log('[EDITOR] Storage loaded, total projects:', storage.getAllProjects().length);
                console.log('[EDITOR] All project IDs:', storage.getAllProjects().map(p => p.id));
                
                project = storage.getProject(projectId);
                console.log('[EDITOR] Project from storage manager:', project);
            }
            
            // Strategy 2: Direct localStorage with all possible keys
            if (!project) {
                console.log('[EDITOR] Trying direct localStorage search...');
                project = await this.searchLocalStorageForProject(projectId);
            }
            
            // Strategy 3: Check if storage might be using different user ID
            if (!project) {
                console.log('[EDITOR] Checking alternative storage keys...');
                project = await this.searchAlternativeStorageKeys(projectId);
            }
            
            if (!project) {
                console.error('[EDITOR] Project not found in any storage location');
                console.error('[EDITOR] Requested project ID:', projectId);
                this.showError('Projeto não encontrado', `Projeto com ID "${projectId}" não foi encontrado em nenhum local de armazenamento.`);
                return;
            }
            
            console.log('[EDITOR] Project found:', project.name);
            console.log('[EDITOR] Project has', project.tracks.length, 'tracks');
            
            // Check if project is empty (0 tracks) - show upload prompt
            if (project.tracks.length === 0) {
                console.log('[EDITOR] Empty project detected, showing upload prompt');
                this.showEmptyProjectUploadPrompt(project);
                return;
            }
            
            // Hydrate with audio files
            await this.hydrateProject(project);
            
            this.currentProject = project;
            this.updateProjectInfo();
            this.renderTimeline();
            
            // Initialize playhead position after render
            setTimeout(() => {
                this.updatePlayhead();
            }, 100);
            
        } catch (error) {
            console.error('[EDITOR] Error loading project:', error);
            this.showError('Erro ao carregar', error.message);
        } finally {
            this.isLoading = false;
            this.hideSplashScreen();
        }
    }
    
    async searchLocalStorageForProject(projectId) {
        console.log('[EDITOR] Searching localStorage for project:', projectId);
        
        // Try all possible storage key patterns
        const possibleKeys = [
            'multracks_projects_guest',
            'multracks_projects', // No user suffix
            `multracks_projects_${projectId}`, // Check if project ID is used as key
            'projects', // Simple key
            'musicas' // Check common music app key
        ];
        
        for (const key of possibleKeys) {
            const data = localStorage.getItem(key);
            if (data) {
                console.log('[EDITOR] Found data in key:', key);
                try {
                    const parsed = JSON.parse(data);
                    console.log('[EDITOR] Data type:', Array.isArray(parsed) ? 'array' : typeof parsed);
                    
                    let projects = [];
                    if (Array.isArray(parsed)) {
                        projects = parsed;
                    } else if (parsed.projects && Array.isArray(parsed.projects)) {
                        projects = parsed.projects;
                    } else if (parsed.id === projectId) {
                        // Single project object
                        return parsed;
                    }
                    
                    const found = projects.find(p => p.id === projectId);
                    if (found) {
                        console.log('[EDITOR] Project found in key:', key);
                        return found;
                    }
                } catch (error) {
                    console.error('[EDITOR] Error parsing data from key:', key, error);
                }
            }
        }
        
        console.log('[EDITOR] Project not found in any localStorage key');
        return null;
    }
    
    async searchAlternativeStorageKeys(projectId) {
        console.log('[EDITOR] Searching alternative storage keys...');
        
        // Get all localStorage keys
        const allKeys = Object.keys(localStorage);
        console.log('[EDITOR] All localStorage keys to check:', allKeys);
        
        for (const key of allKeys) {
            if (key.includes('project') || key.includes('music') || key.includes('track')) {
                const data = localStorage.getItem(key);
                if (data) {
                    try {
                        const parsed = JSON.parse(data);
                        console.log('[EDITOR] Checking key:', key, 'for project');
                        
                        let projects = [];
                        if (Array.isArray(parsed)) {
                            projects = parsed;
                        } else if (parsed.projects && Array.isArray(parsed.projects)) {
                            projects = parsed.projects;
                        }
                        
                        const found = projects.find(p => p.id === projectId);
                        if (found) {
                            console.log('[EDITOR] Project found in alternative key:', key);
                            return found;
                        }
                    } catch (error) {
                        console.error('[EDITOR] Error parsing alternative key:', key, error);
                    }
                }
            }
        }
        
        return null;
    }
    
    showEmptyProjectUploadPrompt(project) {
        console.log('[EDITOR] Showing empty project upload prompt');
        
        // Create upload prompt UI
        const trackHeaders = document.getElementById('trackHeaders');
        const playlistContent = document.getElementById('playlistContent');
        const timeRuler = document.getElementById('timeRuler');
        
        trackHeaders.innerHTML = '';
        playlistContent.innerHTML = '';
        timeRuler.innerHTML = '';
        
        // Create upload prompt UI in playlist content
        const uploadPrompt = document.createElement('div');
        uploadPrompt.className = 'empty-project-upload';
        uploadPrompt.style.cssText = 'display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 60px 20px; text-align: center;';
        uploadPrompt.innerHTML = `
            <div class="upload-prompt-content">
                <h3>Projeto Vazio</h3>
                <p>Este projeto não tem tracks ainda. Carregue uma pasta com seus arquivos de áudio para começar a editar.</p>
                <button id="uploadFolderBtn" class="upload-folder-btn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                    </svg>
                    Carregar Pasta de Tracks
                </button>
                <p class="upload-hint">Selecione a pasta que contém todos os arquivos de áudio (WAV, MP3, FLAC, etc.)</p>
            </div>
        `;
        
        playlistContent.appendChild(uploadPrompt);
        
        // Add click handler for upload button
        const uploadBtn = document.getElementById('uploadFolderBtn');
        if (uploadBtn) {
            uploadBtn.addEventListener('click', () => this.handleEmptyProjectUpload(project));
        }
        
        this.hideSplashScreen();
    }
    
    async handleEmptyProjectUpload(project) {
        console.log('[EDITOR] Handling empty project upload');
        
        // Create file input for folder selection
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.setAttribute('webkitdirectory', '');
        fileInput.setAttribute('directory', '');
        fileInput.multiple = true;
        
        fileInput.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            const audioFiles = files.filter(file => 
                file.type.startsWith('audio/') || 
                file.name.match(/\.(wav|mp3|flac|ogg|aiff|m4a)$/i)
            );
            
            console.log('[EDITOR] Selected files:', files.length);
            console.log('[EDITOR] Audio files:', audioFiles.length);
            
            if (audioFiles.length === 0) {
                alert('Nenhum arquivo de áudio encontrado na pasta selecionada.');
                return;
            }
            
            await this.processUploadedFiles(project, audioFiles);
        });
        
        fileInput.click();
    }
    
    async processUploadedFiles(project, audioFiles) {
        console.log('[EDITOR] Processing uploaded files for project:', project.id);
        
        const playlistContent = document.getElementById('playlistContent');
        playlistContent.innerHTML = '<div class="upload-progress" style="display: flex; align-items: center; justify-content: center; height: 100%; padding: 60px 20px; text-align: center;"><p>Carregando tracks...</p></div>';
        
        try {
            // Resume AudioContext if suspended
            if (this.audioContext && this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            const newTracks = [];
            
            for (const file of audioFiles) {
                try {
                    // Store audio file in AudioStorage
                    const audioFileId = await this.audioStorage.storeAudioFile(file);
                    console.log('[EDITOR] Stored audio file:', file.name, 'ID:', audioFileId);
                    
                    // Create track entry
                    const track = {
                        id: `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        name: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
                        audioFileId: audioFileId,
                        file: file, // Runtime file for decoding
                        offset: 0,
                        startTime: 0,
                        endTime: null,
                        mute: false,
                        solo: false
                    };
                    
                    newTracks.push(track);
                } catch (error) {
                    console.error('[EDITOR] Error processing file:', file.name, error);
                }
            }
            
            console.log('[EDITOR] Created', newTracks.length, 'new tracks');
            
            // Update project with new tracks
            project.tracks = newTracks;
            this.currentProject = project;
            
            // Hydrate and render
            await this.hydrateProject(project);
            this.updateProjectInfo();
            this.renderTimeline();
            
            // Save project with new tracks
            await this.saveConfiguration();
            
            console.log('[EDITOR] Empty project loaded with', newTracks.length, 'tracks');
            
        } catch (error) {
            console.error('[EDITOR] Error processing uploaded files:', error);
            playlistContent.innerHTML = '<div class="upload-error" style="display: flex; align-items: center; justify-content: center; height: 100%; padding: 60px 20px; text-align: center;"><p>Erro ao carregar tracks. Tente novamente.</p></div>';
        }
    }
    
    async hydrateProject(project) {
        console.log('[EDITOR] Hydrating project with audio files...');
        
        // Resume AudioContext if suspended (browser autoplay policy)
        if (this.audioContext && this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
        
        for (const track of project.tracks) {
            // Ensure track has default states
            if (track.mute === undefined) track.mute = false;
            if (track.solo === undefined) track.solo = false;
            if (track.offset === undefined) track.offset = 0;
            if (track.startTime === undefined) track.startTime = 0;
            if (track.endTime === undefined) track.endTime = 180;
            
            // Check if track.file is a valid Blob/File (not a corrupted object like {})
            const hasValidFile = track.file && (track.file instanceof Blob || track.file instanceof File);
            
            if (track.audioFileId && !hasValidFile) {
                try {
                    const file = await this.audioStorage.loadAudioFile(track.audioFileId);
                    if (file) {
                        track.file = file;
                        console.log('[EDITOR] Audio loaded for track:', track.name);
                        
                        // Decode audio buffer
                        await this.decodeAudioBuffer(track);
                    }
                } catch (error) {
                    console.error('[EDITOR] Error loading audio for track:', track.name, error);
                }
            } else if (hasValidFile) {
                // Already has valid file, decode if not already decoded
                await this.decodeAudioBuffer(track);
            } else if (!track.audioFileId && !hasValidFile) {
                console.warn('[EDITOR] Track has no audioFileId and no valid file:', track.name);
            }
        }
    }
    
    async decodeAudioBuffer(track) {
        if (!this.audioContext) {
            console.warn('[EDITOR] AudioContext not available');
            return;
        }
        
        // Check if already decoded
        if (this.audioBuffers.has(track.id)) {
            console.log('[EDITOR] Audio buffer already decoded for track:', track.name);
            return;
        }
        
        try {
            const arrayBuffer = await track.file.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            
            this.audioBuffers.set(track.id, audioBuffer);
            console.log('[EDITOR] Audio buffer decoded for track:', track.name, 'duration:', audioBuffer.duration.toFixed(2) + 's');
        } catch (error) {
            console.error('[EDITOR] Error decoding audio buffer for track:', track.name, error);
        }
    }
    
    updateProjectInfo() {
        document.getElementById('projectTitle').textContent = this.currentProject.name;
        document.getElementById('projectMeta').textContent = `${this.currentProject.tracks.length} tracks`;
    }
    
    syncScroll() {
        // Sync horizontal scroll between time ruler and playlist viewport
        const timeRulerViewport = document.querySelector('.daw-time-ruler-viewport');
        const playlistViewport = document.getElementById('playlistViewport');
        
        if (timeRulerViewport && playlistViewport) {
            timeRulerViewport.addEventListener('scroll', (e) => {
                playlistViewport.scrollLeft = e.target.scrollLeft;
            });
            
            playlistViewport.addEventListener('scroll', (e) => {
                timeRulerViewport.scrollLeft = e.target.scrollLeft;
            });
        }
        
        // Sync vertical scroll between track headers and playlist content
        const trackHeaders = document.getElementById('trackHeaders');
        if (trackHeaders && playlistViewport) {
            trackHeaders.addEventListener('scroll', (e) => {
                playlistViewport.scrollTop = e.target.scrollTop;
            });
            
            playlistViewport.addEventListener('scroll', (e) => {
                trackHeaders.scrollTop = e.target.scrollTop;
            });
        }
    }
    
    renderTimeline() {
        const trackHeaders = document.getElementById('trackHeaders');
        const playlistContent = document.getElementById('playlistContent');
        const timeRuler = document.getElementById('timeRuler');
        
        trackHeaders.innerHTML = '';
        playlistContent.innerHTML = '';
        timeRuler.innerHTML = '';
        
        // Calculate total duration from actual audio buffers
        let maxDuration = 0;
        for (const track of this.currentProject.tracks) {
            const audioBuffer = this.audioBuffers.get(track.id);
            if (audioBuffer) {
                const trackOffset = track.offset || 0;
                const totalSpan = trackOffset + audioBuffer.duration;
                if (totalSpan > maxDuration) {
                    maxDuration = totalSpan;
                }
                console.log('[EDITOR] Track:', track.name, 'duration:', audioBuffer.duration.toFixed(2) + 's', 'offset:', trackOffset.toFixed(2) + 's', 'total:', totalSpan.toFixed(2) + 's');
            } else {
                // Fallback to track.endTime if no buffer
                const duration = track.endTime || 180;
                const trackOffset = track.offset || 0;
                const totalSpan = trackOffset + duration;
                if (totalSpan > maxDuration) {
                    maxDuration = totalSpan;
                }
                console.log('[EDITOR] Track:', track.name, 'no buffer, using endTime:', duration.toFixed(2) + 's', 'offset:', trackOffset.toFixed(2) + 's', 'total:', totalSpan.toFixed(2) + 's');
            }
        }
        
        // Ensure minimum duration of 60 seconds
        if (maxDuration < 60) {
            maxDuration = 60;
        }
        
        this.maxDuration = maxDuration;
        console.log('[EDITOR] Total timeline duration:', maxDuration.toFixed(2) + 's');
        
        // Calculate content width based on duration and pixelsPerSecond
        const contentWidth = maxDuration * this.pixelsPerSecond;
        console.log('[EDITOR] Playlist content width:', contentWidth.toFixed(0) + 'px');
        
        // Rebuild time ruler structure with viewport
        timeRuler.innerHTML = `
            <div class="daw-time-ruler-track-header"></div>
            <div class="daw-time-ruler-viewport">
                <div class="daw-time-ruler-timeline" style="width: ${contentWidth}px;"></div>
            </div>
        `;
        
        // Set playlist content width
        playlistContent.style.width = `${contentWidth}px`;
        
        // Render time ruler
        const timeRulerTimeline = timeRuler.querySelector('.daw-time-ruler-timeline');
        if (timeRulerTimeline) {
            this.renderTimeRuler(timeRulerTimeline, maxDuration);
        } else {
            console.error('[EDITOR] Time ruler timeline element not found');
        }
        
        // Sync scroll between time ruler and playlist
        this.syncScroll();
        
        // Reset playhead position
        this.updatePlayhead();
        
        // Render track headers and playlist rows
        for (const track of this.currentProject.tracks) {
            this.renderPlaylistTrack(track, trackHeaders, playlistContent, maxDuration);
        }
        
        // Update all track visual states based on mute/solo
        this.updateAllTrackVisualStates();
        
        // Update zoom display
        this.updateZoomDisplay();
    }
    
    renderTimeRuler(ruler, duration) {
        if (!ruler) {
            console.error('[EDITOR] renderTimeRuler called with null ruler');
            return;
        }
        
        // Use requestAnimationFrame to ensure DOM is painted
        requestAnimationFrame(() => {
            const totalSeconds = Math.ceil(duration);
            const interval = this.calculateTimeInterval(totalSeconds);
            
            console.log('[EDITOR] Rendering time ruler:', {
                duration: duration,
                totalSeconds: totalSeconds,
                interval: interval,
                pixelsPerSecond: this.pixelsPerSecond
            });
            
            // Clear existing markers
            ruler.innerHTML = '';
            
            for (let seconds = 0; seconds <= totalSeconds; seconds += interval) {
                const marker = document.createElement('div');
                marker.className = 'daw-time-marker';
                // Use pixel-based positioning instead of percentage
                const x = seconds * this.pixelsPerSecond;
                marker.style.left = `${x}px`;
                marker.textContent = this.formatTime(seconds);
                ruler.appendChild(marker);
            }
        });
    }
    
    calculateTimeInterval(totalSeconds) {
        if (totalSeconds <= 60) return 5;      // 5 seconds
        if (totalSeconds <= 120) return 10;    // 10 seconds
        if (totalSeconds <= 300) return 30;    // 30 seconds
        if (totalSeconds <= 600) return 60;    // 1 minute
        return 120;                          // 2 minutes
    }
    
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    renderPlaylistTrack(track, trackHeaders, playlistContent, maxDuration) {
        // Create track header (left column)
        const header = document.createElement('div');
        header.className = 'daw-playlist-track-header';
        header.dataset.trackId = track.id;
        
        // Track name
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'daw-track-name';
        nameInput.value = track.name;
        nameInput.addEventListener('change', (e) => {
            this.updateTrackName(track.id, e.target.value);
        });
        
        // Track controls
        const controls = document.createElement('div');
        controls.className = 'daw-track-controls';
        
        // Mute button
        const muteBtn = document.createElement('button');
        muteBtn.className = 'daw-track-control' + (track.mute ? ' active' : '');
        muteBtn.textContent = 'M';
        muteBtn.title = 'Mute';
        muteBtn.addEventListener('click', () => {
            this.toggleMute(track.id);
        });
        
        // Solo button
        const soloBtn = document.createElement('button');
        soloBtn.className = 'daw-track-control' + (track.solo ? ' active' : '');
        soloBtn.textContent = 'S';
        soloBtn.title = 'Solo';
        soloBtn.addEventListener('click', () => {
            this.toggleSolo(track.id);
        });
        
        controls.appendChild(muteBtn);
        controls.appendChild(soloBtn);
        
        // Level meter
        const levelMeter = document.createElement('div');
        levelMeter.className = 'daw-track-level-meter';
        levelMeter.innerHTML = `
            <div class="track-level-bar" id="trackLevelBar_${track.id}" style="height: 0%"></div>
            <div class="track-level-bar peak" id="trackLevelBar_${track.id}_peak" style="height: 0%"></div>
        `;
        controls.appendChild(levelMeter);
        
        header.appendChild(nameInput);
        header.appendChild(controls);
        trackHeaders.appendChild(header);
        
        // Create track timeline row (right column in shared content)
        const timelineRow = document.createElement('div');
        timelineRow.className = 'daw-playlist-track-timeline';
        timelineRow.dataset.trackId = track.id;
        
        // Get actual audio duration from buffer
        const audioBuffer = this.audioBuffers.get(track.id);
        const actualDuration = audioBuffer ? audioBuffer.duration : (track.endTime || 180);
        
        // Audio block (compact clip style)
        const trackOffset = track.offset || 0;
        const trackStart = track.startTime || 0;
        const trackEnd = track.endTime || actualDuration;
        
        const block = document.createElement('div');
        block.className = 'daw-audio-block' + (this.selectedTrackId === track.id ? ' selected' : '');
        block.dataset.trackId = track.id;
        
        // Calculate position and width using pixels instead of percentage
        const blockLeft = (trackOffset + trackStart) * this.pixelsPerSecond;
        const blockWidth = (trackEnd - trackStart) * this.pixelsPerSecond;
        
        block.style.left = `${blockLeft}px`;
        block.style.width = `${blockWidth}px`;
        
        // Waveform canvas (lightweight visualization)
        const waveformCanvas = document.createElement('canvas');
        waveformCanvas.className = 'daw-audio-waveform';
        waveformCanvas.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;';
        block.appendChild(waveformCanvas);
        
        // Draw waveform after canvas is in DOM
        requestAnimationFrame(() => {
            const canvasWidth = blockWidth;
            const canvasHeight = 36; // Match block height - padding
            waveformCanvas.width = canvasWidth;
            waveformCanvas.height = canvasHeight;
            this.drawWaveform(waveformCanvas, track.id, canvasWidth, canvasHeight, trackStart, trackEnd);
        });
        
        // Track info
        const info = document.createElement('div');
        info.className = 'daw-audio-block-info';
        info.textContent = `${trackOffset.toFixed(2)}s`;
        block.appendChild(info);
        
        // Click handler for selection
        block.addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectTrack(track.id);
        });
        
        // Drag events
        block.addEventListener('mousedown', (e) => {
            this.startDrag(e, track.id);
        });
        
        timelineRow.appendChild(block);
        playlistContent.appendChild(timelineRow);
        
        // Initialize track configuration with all states
        this.trackConfigs.set(track.id, {
            name: track.name,
            offset: trackOffset,
            trimIn: trackStart,
            trimOut: trackEnd,
            originalDuration: actualDuration,
            mute: track.mute || false,
            solo: track.solo || false
        });
        
        // Update visual state based on mute/solo
        this.updateTrackVisualState(track.id);
    }
    
    startDrag(e, trackId) {
        this.dragState.isDragging = true;
        this.dragState.trackId = trackId;
        this.dragState.startX = e.clientX;
        
        const config = this.trackConfigs.get(trackId);
        this.dragState.startOffset = config.offset;
        
        // Get the shared playlist viewport
        const playlistViewport = document.getElementById('playlistViewport');
        this.dragState.startScrollLeft = playlistViewport ? playlistViewport.scrollLeft : 0;
        
        const block = document.querySelector(`.daw-audio-block[data-track-id="${trackId}"]`);
        if (block) {
            block.classList.add('dragging');
        }
        
        e.preventDefault();
    }
    
    handleDragMove(e) {
        if (!this.dragState.isDragging) return;
        
        // Get the shared playlist viewport
        const playlistViewport = document.getElementById('playlistViewport');
        
        if (!playlistViewport) return;
        
        const currentScrollLeft = playlistViewport.scrollLeft;
        
        // Calculate delta including scroll changes
        const deltaX = (e.clientX - this.dragState.startX) + (currentScrollLeft - this.dragState.startScrollLeft);
        
        // Convert pixel delta to time delta using pixelsPerSecond
        const deltaTime = deltaX / this.pixelsPerSecond;
        
        const newOffset = Math.max(0, this.dragState.startOffset + deltaTime);
        
        // Update config
        const config = this.trackConfigs.get(this.dragState.trackId);
        config.offset = newOffset;
        this.trackConfigs.set(this.dragState.trackId, config);
        
        // Update actual track object in currentProject
        const track = this.currentProject.tracks.find(t => t.id === this.dragState.trackId);
        if (track) {
            track.offset = newOffset;
        }
        
        // Update visual position
        this.updateBlockPosition(this.dragState.trackId, newOffset);
        
        // Check if we need to expand timeline
        this.checkTimelineExpansion(newOffset);
        
        // Handle auto-scroll
        this.handleAutoScroll(e, playlistViewport);
    }
    
    handleDragEnd() {
        if (!this.dragState.isDragging) return;
        
        const block = document.querySelector(`.daw-audio-block[data-track-id="${this.dragState.trackId}"]`);
        if (block) {
            block.classList.remove('dragging');
        }
        
        this.dragState.isDragging = false;
        this.dragState.trackId = null;
        
        // Stop auto-scroll
        this.stopAutoScroll();
        
        // Restart audio playback if playing to reflect new offset
        if (this.isPlaying) {
            console.log('[EDITOR] Track offset changed, restarting audio playback');
            this.stopAudioPlayback();
            this.startAudioPlayback();
        }
    }
    
    updateBlockPosition(trackId, offset) {
        const block = document.querySelector(`.daw-audio-block[data-track-id="${trackId}"]`);
        if (!block) return;
        
        const config = this.trackConfigs.get(trackId);
        // Use pixel-based positioning
        const blockLeft = (offset + config.trimIn) * this.pixelsPerSecond;
        
        block.style.left = `${blockLeft}px`;
        
        // Update info display
        const info = block.querySelector('.daw-audio-block-info');
        if (info) {
            info.textContent = `Offset: ${offset.toFixed(2)}s`;
        }
    }
    
    getMaxDuration() {
        let maxDuration = 0;
        for (const track of this.currentProject.tracks) {
            const audioBuffer = this.audioBuffers.get(track.id);
            if (audioBuffer) {
                const trackOffset = track.offset || 0;
                const totalSpan = trackOffset + audioBuffer.duration;
                if (totalSpan > maxDuration) {
                    maxDuration = totalSpan;
                }
            } else {
                // Fallback to track.endTime if no buffer
                const duration = track.endTime || 180;
                const trackOffset = track.offset || 0;
                const totalSpan = trackOffset + duration;
                if (totalSpan > maxDuration) {
                    maxDuration = totalSpan;
                }
            }
        }
        
        // Ensure minimum duration of 60 seconds
        if (maxDuration < 60) {
            maxDuration = 60;
        }
        
        return maxDuration;
    }
    
    checkTimelineExpansion(newOffset) {
        const config = this.trackConfigs.get(this.dragState.trackId);
        if (!config) return;
        
        const clipEnd = newOffset + config.trimOut;
        const extraMargin = 10; // 10 seconds of extra space
        
        if (clipEnd + extraMargin > this.maxDuration) {
            this.maxDuration = clipEnd + extraMargin;
            this.updateTimelineWidth();
        }
    }
    
    updateTimelineWidth() {
        const contentWidth = this.maxDuration * this.pixelsPerSecond;
        
        // Update time ruler timeline width
        const timeRulerTimeline = document.querySelector('.daw-time-ruler-timeline');
        if (timeRulerTimeline) {
            timeRulerTimeline.style.width = `${contentWidth}px`;
            this.renderTimeRuler(timeRulerTimeline, this.maxDuration);
        }
        
        // Update playlist content width
        const playlistContent = document.getElementById('playlistContent');
        if (playlistContent) {
            playlistContent.style.width = `${contentWidth}px`;
        }
        
        console.log('[EDITOR] Timeline expanded to:', this.maxDuration.toFixed(2) + 's', 'width:', contentWidth.toFixed(0) + 'px');
    }
    
    handleAutoScroll(e, viewport) {
        const viewportRect = viewport.getBoundingClientRect();
        const mouseX = e.clientX;
        const viewportWidth = viewportRect.width;
        const scrollThreshold = 80; // pixels from edge
        const scrollSpeed = 10;
        
        // Check if mouse is near right edge
        if (mouseX > viewportRect.right - scrollThreshold) {
            this.startAutoScroll(viewport, 1, scrollSpeed);
        } 
        // Check if mouse is near left edge
        else if (mouseX < viewportRect.left + scrollThreshold) {
            this.startAutoScroll(viewport, -1, scrollSpeed);
        } 
        else {
            this.stopAutoScroll();
        }
    }
    
    startAutoScroll(viewport, direction, speed) {
        if (this.autoScrollState.isScrolling && this.autoScrollState.direction === direction) {
            return; // Already scrolling in this direction
        }
        
        this.stopAutoScroll(); // Stop any existing scroll
        
        this.autoScrollState.isScrolling = true;
        this.autoScrollState.direction = direction;
        this.autoScrollState.speed = speed;
        
        const scroll = () => {
            if (!this.autoScrollState.isScrolling) return;
            
            viewport.scrollLeft += direction * speed;
            
            // Update drag position during scroll
            if (this.dragState.isDragging) {
                this.dragState.startScrollLeft = viewport.scrollLeft;
                this.dragState.startX = this.dragState.startX; // Keep original mouse X
            }
            
            this.autoScrollState.animationFrame = requestAnimationFrame(scroll);
        };
        
        this.autoScrollState.animationFrame = requestAnimationFrame(scroll);
    }
    
    stopAutoScroll() {
        if (this.autoScrollState.animationFrame) {
            cancelAnimationFrame(this.autoScrollState.animationFrame);
            this.autoScrollState.animationFrame = null;
        }
        
        this.autoScrollState.isScrolling = false;
        this.autoScrollState.direction = 0;
    }
    
    updateTrackName(trackId, newName) {
        const config = this.trackConfigs.get(trackId);
        config.name = newName;
        this.trackConfigs.set(trackId, config);
        
        const track = this.currentProject.tracks.find(t => t.id === trackId);
        if (track) {
            track.name = newName;
        }
    }
    
    toggleMute(trackId) {
        const track = this.currentProject.tracks.find(t => t.id === trackId);
        if (track) {
            track.mute = !track.mute;
            
            // Update button state
            const muteBtn = document.querySelector(`.daw-playlist-track-header[data-track-id="${trackId}"] .daw-track-control:first-child`);
            if (muteBtn) {
                muteBtn.classList.toggle('active', track.mute);
            }
            
            // Update track visual opacity based on mute state
            this.updateTrackVisualState(trackId);
            
            // Restart audio playback if playing to apply mute change
            if (this.isPlaying) {
                this.stopAudioPlayback();
                this.startAudioPlayback();
            }
        }
    }
    
    toggleSolo(trackId) {
        const track = this.currentProject.tracks.find(t => t.id === trackId);
        if (track) {
            track.solo = !track.solo;
            
            // Update button state
            const soloBtn = document.querySelector(`.daw-playlist-track-header[data-track-id="${trackId}"] .daw-track-control:last-child`);
            if (soloBtn) {
                soloBtn.classList.toggle('active', track.solo);
            }
            
            // Update all track visual states based on solo
            this.updateAllTrackVisualStates();
            
            // Restart audio playback if playing to apply solo change
            if (this.isPlaying) {
                this.stopAudioPlayback();
                this.startAudioPlayback();
            }
        }
    }
    
    updateTrackVisualState(trackId) {
        const track = this.currentProject.tracks.find(t => t.id === trackId);
        if (!track) return;
        
        const timelineRow = document.querySelector(`.daw-playlist-track-timeline[data-track-id="${trackId}"]`);
        const audioBlock = document.querySelector(`.daw-audio-block[data-track-id="${trackId}"]`);
        
        if (timelineRow && audioBlock) {
            // Check if this track should be visually dimmed
            const hasSolo = this.currentProject.tracks.some(t => t.solo);
            const isMuted = track.mute;
            const isSoloed = track.solo;
            const isDimmed = hasSolo && !isSoloed;
            
            if (isMuted || isDimmed) {
                timelineRow.style.opacity = '0.4';
                audioBlock.style.opacity = '0.4';
            } else {
                timelineRow.style.opacity = '1';
                audioBlock.style.opacity = '1';
            }
        }
    }
    
    updateAllTrackVisualStates() {
        for (const track of this.currentProject.tracks) {
            this.updateTrackVisualState(track.id);
        }
    }
    
    updateZoomDisplay() {
        const zoomPercent = Math.round((this.pixelsPerSecond / 100) * 100);
        document.getElementById('zoomLevel').textContent = `${zoomPercent}%`;
    }
    
    togglePlayPause() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }
    
    play() {
        this.isPlaying = true;
        this.updatePlayPauseButton();
        
        // Resume AudioContext if suspended
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        // Start audio playback
        this.startAudioPlayback();
        
        // Start playback interval for UI updates
        this.playbackInterval = setInterval(() => {
            this.currentTime += 0.05; // Update every 50ms
            
            if (this.currentTime >= this.maxDuration) {
                this.currentTime = 0; // Loop back to start
                this.stopAudioPlayback();
                this.startAudioPlayback();
            }
            
            this.updatePlayhead();
            this.updateTimeDisplay();
        }, 50);
    }
    
    startAudioPlayback() {
        console.log('[EDITOR] Starting audio playback at:', this.currentTime);
        
        // Clear any existing source nodes
        this.stopAudioPlayback();
        
        if (!this.audioContext) {
            console.warn('[EDITOR] AudioContext not available');
            return;
        }
        
        const startTime = this.audioContext.currentTime;
        
        for (const track of this.currentProject.tracks) {
            // Skip if muted or no audio buffer
            if (track.mute || !this.audioBuffers.has(track.id)) {
                continue;
            }
            
            // Skip if solo is active and this track is not soloed
            const hasSolo = this.currentProject.tracks.some(t => t.solo);
            if (hasSolo && !track.solo) {
                continue;
            }
            
            try {
                const audioBuffer = this.audioBuffers.get(track.id);
                const source = this.audioContext.createBufferSource();
                source.buffer = audioBuffer;
                
                // Create gain node for this track
                const trackGain = this.audioContext.createGain();
                trackGain.gain.value = track.mute ? 0 : 1;
                
                // Create analyser node for level meter
                const analyser = this.audioContext.createAnalyser();
                analyser.fftSize = 256;
                analyser.smoothingTimeConstant = 0.8;
                
                // Connect audio graph: source -> gain -> analyser -> destination
                source.connect(trackGain);
                trackGain.connect(analyser);
                analyser.connect(this.audioContext.destination);
                
                // Store nodes for later access
                this.trackGainNodes.set(track.id, trackGain);
                this.trackAnalyserNodes.set(track.id, analyser);
                
                // Calculate offset and trim
                const trackOffset = track.offset || 0;
                const trimIn = track.startTime || 0;
                const trimOut = track.endTime || audioBuffer.duration;
                const playbackOffset = this.currentTime;
                
                // Calculate when to start this track
                const trackStartTime = trackOffset + trimIn;
                const trackEndTime = trackOffset + trimOut;
                
                // Calculate delay if track starts in the future
                const delay = Math.max(0, trackStartTime - playbackOffset);
                
                // Calculate source offset (where to start playing within the buffer)
                const sourceOffset = Math.max(0, playbackOffset - trackStartTime);
                
                // Calculate duration to play
                const duration = Math.min(audioBuffer.duration - sourceOffset, trimOut - trimIn - sourceOffset);
                
                // Only schedule if track will play at some point
                if (playbackOffset < trackEndTime && duration > 0) {
                    source.start(startTime + delay, sourceOffset, duration);
                    
                    // Store source node for stopping later
                    this.sourceNodes.set(track.id, source);
                    
                    console.log('[EDITOR] Scheduling track:', track.name, 
                        'delay:', delay.toFixed(2) + 's', 
                        'sourceOffset:', sourceOffset.toFixed(2) + 's', 
                        'duration:', duration.toFixed(2) + 's');
                }
            } catch (error) {
                console.error('[EDITOR] Error playing track:', track.name, error);
            }
        }
        
        // Start visualization loop
        this.startVisualization();
    }
    
    stopAudioPlayback() {
        console.log('[EDITOR] Stopping audio playback');
        
        // Stop visualization
        this.stopVisualization();
        
        // Stop all active source nodes
        for (const [trackId, source] of this.sourceNodes) {
            try {
                source.stop();
                source.disconnect();
            } catch (error) {
                console.error('[EDITOR] Error stopping source node for track:', trackId, error);
            }
        }
        
        // Clear all nodes
        this.sourceNodes.clear();
        this.trackGainNodes.clear();
        this.trackAnalyserNodes.clear();
    }
    
    startVisualization() {
        // Clear any existing visualization interval
        this.stopVisualization();
        
        // Start polling loop for level meters
        this.visualizationInterval = setInterval(() => {
            if (!this.isPlaying) return;
            
            for (const [trackId, analyser] of this.trackAnalyserNodes) {
                try {
                    const dataArray = new Uint8Array(analyser.frequencyBinCount);
                    analyser.getByteFrequencyData(dataArray);
                    
                    // Calculate average level
                    let sum = 0;
                    for (let i = 0; i < dataArray.length; i++) {
                        sum += dataArray[i];
                    }
                    const average = sum / dataArray.length;
                    const level = (average / 255) * 100; // Convert to percentage
                    
                    // Calculate peak level
                    const peak = Math.max(...dataArray) / 255 * 100;
                    
                    // Update UI
                    this.updateTrackLevelMeter(trackId, level, peak);
                } catch (error) {
                    console.error('[EDITOR] Error updating level meter for track:', trackId, error);
                }
            }
        }, 50); // Update every 50ms
    }
    
    stopVisualization() {
        if (this.visualizationInterval) {
            clearInterval(this.visualizationInterval);
            this.visualizationInterval = null;
        }
        
        // Reset all level meters to 0
        for (const trackId of this.trackAnalyserNodes.keys()) {
            this.updateTrackLevelMeter(trackId, 0, 0);
        }
    }
    
    updateTrackLevelMeter(trackId, level, peak) {
        const levelBar = document.getElementById(`trackLevelBar_${trackId}`);
        const peakBar = document.getElementById(`trackLevelBar_${trackId}_peak`);
        
        if (levelBar) {
            levelBar.style.height = `${level}%`;
        }
        
        if (peakBar) {
            peakBar.style.height = `${peak}%`;
        }
    }
    
    selectTrack(trackId) {
        this.selectedTrackId = trackId;
        
        // Update visual selection
        document.querySelectorAll('.daw-audio-block').forEach(block => {
            block.classList.remove('selected');
        });
        
        const selectedBlock = document.querySelector(`.daw-audio-block[data-track-id="${trackId}"]`);
        if (selectedBlock) {
            selectedBlock.classList.add('selected');
        }
        
        console.log('[EDITOR] Selected track:', trackId);
    }
    
    splitSelectedClip() {
        if (!this.selectedTrackId) {
            console.warn('[EDITOR] No track selected for split');
            return;
        }
        
        const track = this.currentProject.tracks.find(t => t.id === this.selectedTrackId);
        if (!track) {
            console.error('[EDITOR] Selected track not found');
            return;
        }
        
        // Check if playhead is within this clip's active range
        const trackOffset = track.offset || 0;
        const trackStart = track.startTime || 0;
        const trackEnd = track.endTime || 180; // Fallback duration
        const trackStartTime = trackOffset + trackStart;
        const trackEndTime = trackOffset + trackEnd;
        
        if (this.currentTime < trackStartTime || this.currentTime > trackEndTime) {
            console.warn('[EDITOR] Playhead not within clip range');
            return;
        }
        
        console.log('[EDITOR] Splitting clip at:', this.currentTime);
        
        // Calculate split point relative to original audio
        const splitPoint = this.currentTime - trackOffset;
        
        // Create first piece (left part)
        const firstPiece = {
            ...track,
            id: track.id, // Keep original ID
            endTime: splitPoint, // New trim-out
            offset: trackOffset, // Keep original offset
            startTime: trackStart // Keep original trim-in
        };
        
        // Create second piece (right part)
        const secondPiece = {
            ...track,
            id: `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // New ID
            offset: this.currentTime, // New offset at split point
            startTime: splitPoint, // New trim-in at split point
            endTime: trackEnd, // Keep original trim-out
            mute: false, // Reset mute for new piece
            solo: false // Reset solo for new piece
        };
        
        // Copy audio buffer to second piece (same underlying audio)
        const originalBuffer = this.audioBuffers.get(track.id);
        if (originalBuffer) {
            this.audioBuffers.set(secondPiece.id, originalBuffer);
        }
        
        // Remove original track and add both pieces
        const trackIndex = this.currentProject.tracks.findIndex(t => t.id === track.id);
        this.currentProject.tracks.splice(trackIndex, 1, firstPiece, secondPiece);
        
        // Update track configs
        this.trackConfigs.set(firstPiece.id, this.trackConfigs.get(track.id) || {});
        this.trackConfigs.set(secondPiece.id, this.trackConfigs.get(track.id) || {});
        
        // Recalculate max duration after split
        this.maxDuration = this.getMaxDuration();
        
        // Update timeline width
        this.updateTimelineWidth();
        
        // Clear selection
        this.selectedTrackId = null;
        
        // Re-render timeline
        this.renderTimeline();
        
        console.log('[EDITOR] Clip split into two pieces');
    }
    
    pause() {
        this.isPlaying = false;
        this.updatePlayPauseButton();
        
        // Stop audio playback
        this.stopAudioPlayback();
        
        if (this.playbackInterval) {
            clearInterval(this.playbackInterval);
            this.playbackInterval = null;
        }
    }
    
    updatePlayPauseButton() {
        const playIcon = document.getElementById('playIcon');
        const pauseIcon = document.getElementById('pauseIcon');
        
        if (this.isPlaying) {
            playIcon.style.display = 'none';
            pauseIcon.style.display = 'block';
        } else {
            playIcon.style.display = 'block';
            pauseIcon.style.display = 'none';
        }
    }
    
    updatePlayhead() {
        const playhead = document.getElementById('playhead');
        const rulerPlayhead = document.getElementById('rulerPlayhead');
        const playlistViewport = document.getElementById('playlistViewport');
        
        // Use pixel-based positioning with pixelsPerSecond
        const absolutePosition = this.currentTime * this.pixelsPerSecond;
        
        // Update playlist playhead (overlay) - needs to account for scroll
        if (playhead) {
            const trackHeaderWidth = 200; // Match CSS .daw-track-header width
            const scrollLeft = playlistViewport ? playlistViewport.scrollLeft : 0;
            const visualPosition = trackHeaderWidth + absolutePosition - scrollLeft;
            playhead.style.left = `${visualPosition}px`;
        }
        
        // Update ruler playhead (inside time ruler timeline) - automatic scroll handling
        if (rulerPlayhead) {
            rulerPlayhead.style.left = `${absolutePosition}px`;
        }
    }
    
    updateTimeDisplay() {
        const timeDisplay = document.getElementById('timeDisplay');
        if (timeDisplay) {
            timeDisplay.textContent = this.formatTime(Math.floor(this.currentTime));
        }
    }
    
    seekToPosition(e) {
        const playlistViewport = document.getElementById('playlistViewport');
        const timeRulerViewport = document.querySelector('.daw-time-ruler-viewport');
        
        // Determine which viewport was clicked
        let viewport, rect;
        if (e.target.closest('.daw-time-ruler-viewport')) {
            viewport = timeRulerViewport;
            rect = viewport.getBoundingClientRect();
        } else if (e.target.closest('.daw-playlist-viewport')) {
            viewport = playlistViewport;
            rect = viewport.getBoundingClientRect();
        } else {
            return;
        }
        
        if (!viewport) return;
        
        const clickX = e.clientX - rect.left;
        const scrollLeft = viewport.scrollLeft;
        
        // Calculate absolute position in the timeline content
        const absoluteX = scrollLeft + clickX;
        
        // Convert to time using pixelsPerSecond
        const newTime = absoluteX / this.pixelsPerSecond;
        
        // Clamp between 0 and maxDuration
        this.currentTime = Math.max(0, Math.min(this.maxDuration, newTime));
        
        console.log('[EDITOR] Seek:', {
            clickX: clickX,
            scrollLeft: scrollLeft,
            absoluteX: absoluteX,
            newTime: newTime,
            currentTime: this.currentTime
        });
        
        this.updatePlayhead();
        this.updateTimeDisplay();
        
        // If playing, restart audio playback from new position
        if (this.isPlaying) {
            this.stopAudioPlayback();
            this.startAudioPlayback();
        }
    }
    
    startPlayheadDrag(e) {
        this.playheadDragState.isDragging = true;
        this.playheadDragState.startX = e.clientX;
        this.playheadDragState.startTime = this.currentTime;
        
        // Add dragging class to both playheads
        const playlistPlayhead = document.getElementById('playhead');
        const rulerPlayhead = document.getElementById('rulerPlayhead');
        
        if (playlistPlayhead) {
            playlistPlayhead.classList.add('dragging');
        }
        
        if (rulerPlayhead) {
            rulerPlayhead.classList.add('dragging');
        }
        
        // Pause playback if playing
        if (this.isPlaying) {
            this.togglePlayPause();
        }
        
        // Immediately seek to clicked position
        this.seekToPosition(e);
        
        console.log('[EDITOR] Started playhead drag at:', this.currentTime);
    }
    
    handlePlayheadDragMove(e) {
        if (!this.playheadDragState.isDragging) return;
        
        const playlistViewport = document.getElementById('playlistViewport');
        const timeRulerViewport = document.querySelector('.daw-time-ruler-viewport');
        
        // Use either viewport
        const viewport = playlistViewport || timeRulerViewport;
        if (!viewport) return;
        
        const deltaX = e.clientX - this.playheadDragState.startX;
        
        // Convert pixel delta to time delta using pixelsPerSecond
        const timeDelta = deltaX / this.pixelsPerSecond;
        const newTime = this.playheadDragState.startTime + timeDelta;
        
        // Clamp between 0 and maxDuration
        this.currentTime = Math.max(0, Math.min(this.maxDuration, newTime));
        
        this.updatePlayhead();
        this.updateTimeDisplay();
    }
    
    handlePlayheadDragEnd() {
        if (this.playheadDragState.isDragging) {
            console.log('[EDITOR] Ended playhead drag at:', this.currentTime);
            this.playheadDragState.isDragging = false;
            
            // Remove dragging class from both playheads
            const playlistPlayhead = document.getElementById('playhead');
            const rulerPlayhead = document.getElementById('rulerPlayhead');
            
            if (playlistPlayhead) {
                playlistPlayhead.classList.remove('dragging');
            }
            
            if (rulerPlayhead) {
                rulerPlayhead.classList.remove('dragging');
            }
        }
    }
    
    handleScrollZoom(e) {
        e.preventDefault();
        
        const delta = e.deltaY;
        const zoomStep = 10;
        
        // Store current scroll position before zoom
        const playlistViewport = document.getElementById('playlistViewport');
        const currentScrollLeft = playlistViewport ? playlistViewport.scrollLeft : 0;
        
        if (delta < 0) {
            // Scroll up - zoom in
            this.pixelsPerSecond = Math.min(400, this.pixelsPerSecond + zoomStep);
        } else {
            // Scroll down - zoom out
            this.pixelsPerSecond = Math.max(20, this.pixelsPerSecond - zoomStep);
        }
        
        this.updateZoomDisplay();
        this.updateGridSpacing();
        this.updateTimelineWidth(); // This will re-render ruler and update clip positions
        this.updateTrackBlockPositions();
        
        // Try to preserve scroll position relative to content
        if (playlistViewport) {
            const scrollRatio = currentScrollLeft / (this.maxDuration * (this.pixelsPerSecond - (delta < 0 ? -zoomStep : zoomStep)));
            playlistViewport.scrollLeft = scrollRatio * (this.maxDuration * this.pixelsPerSecond);
        }
    }
    
    updateGridSpacing() {
        const gridSpacing = this.pixelsPerSecond;
        const playlistContent = document.getElementById('playlistContent');
        const timeRulerTimeline = document.querySelector('.daw-time-ruler-timeline');
        
        const allElements = [playlistContent, timeRulerTimeline];
        
        allElements.forEach(element => {
            if (element) {
                element.style.backgroundSize = `${gridSpacing}px 100%`;
            }
        });
    }
    
    updateTrackBlockPositions() {
        // Update audio block positions and widths based on new zoom level
        for (const track of this.currentProject.tracks) {
            const audioBuffer = this.audioBuffers.get(track.id);
            const actualDuration = audioBuffer ? audioBuffer.duration : (track.endTime || 180);
            
            const trackOffset = track.offset || 0;
            const trackStart = track.startTime || 0;
            const trackEnd = track.endTime || actualDuration;
            
            const block = document.querySelector(`.daw-audio-block[data-track-id="${track.id}"]`);
            if (block) {
                // Use pixel-based positioning
                const blockLeft = (trackOffset + trackStart) * this.pixelsPerSecond;
                const blockWidth = (trackEnd - trackStart) * this.pixelsPerSecond;
                
                block.style.left = `${blockLeft}px`;
                block.style.width = `${blockWidth}px`;
                
                // Redraw waveform with new dimensions
                const waveformCanvas = block.querySelector('.daw-audio-waveform');
                if (waveformCanvas) {
                    const canvasWidth = blockWidth;
                    const canvasHeight = 36; // Match block height - padding
                    waveformCanvas.width = canvasWidth;
                    waveformCanvas.height = canvasHeight;
                    this.drawWaveform(waveformCanvas, track.id, canvasWidth, canvasHeight, trackStart, trackEnd);
                }
            }
        }
    }
    
    async saveConfiguration() {
        if (!this.currentProject) {
            this.showToast('Nenhum projeto carregado');
            return;
        }
        
        console.log('[EDITOR] Saving configuration...');
        
        try {
            // Update all project tracks with current configuration
            for (const track of this.currentProject.tracks) {
                const config = this.trackConfigs.get(track.id);
                if (config) {
                    // Update all track states
                    track.name = config.name;
                    track.offset = config.offset; // Primary timeline positioning
                    track.startTime = config.trimIn;
                    track.endTime = config.trimOut;
                    // Preserve mute and solo states from current project
                    if (track.mute === undefined) track.mute = false;
                    if (track.solo === undefined) track.solo = false;
                } else {
                    // Initialize config if not exists
                    this.trackConfigs.set(track.id, {
                        name: track.name,
                        offset: track.offset || 0,
                        trimIn: track.startTime || 0,
                        trimOut: track.endTime || 180,
                        originalDuration: track.endTime || 180
                    });
                }
            }
            
            // Add edited timestamp/flag
            this.currentProject.updatedAt = Date.now();
            this.currentProject.isEdited = true;
            console.log('[EDITOR] Set updatedAt:', new Date(this.currentProject.updatedAt).toISOString());
            
            // Get the correct storage key
            const storageKey = window.getStorageKey ? window.getStorageKey() : 'multracks_projects_guest';
            console.log('[EDITOR] Using storage key:', storageKey);
            
            // Save using storage manager if available
            if (typeof storage !== 'undefined' && storage.updateProject) {
                await storage.updateProject(this.currentProject.id, this.currentProject);
                console.log('[EDITOR] Saved via StorageManager');
            }
            
            // Also save directly to localStorage for compatibility (with blobs stripped)
            await this.saveProjectToLocalStorage(this.currentProject, storageKey);
            console.log('[EDITOR] Saved via localStorage');
            
            // Save configuration separately for easy access
            const configJson = this.exportConfiguration();
            const configKey = `track_config_${this.currentProject.id}`;
            localStorage.setItem(configKey, JSON.stringify(configJson));
            
            console.log('[EDITOR] Configuration saved:', configJson);
            console.log('[EDITOR] Project tracks after save:', this.currentProject.tracks.map(t => ({
                id: t.id,
                name: t.name,
                offset: t.offset,
                startTime: t.startTime,
                endTime: t.endTime,
                mute: t.mute,
                solo: t.solo
            })));
            
            this.showToast('Configuração salva com sucesso');
            
        } catch (error) {
            console.error('[EDITOR] Error saving configuration:', error);
            this.showToast('Erro ao salvar configuração');
        }
    }
    
    async saveProjectToLocalStorage(project, storageKey) {
        // Use provided storage key or fallback
        const key = storageKey || (window.getStorageKey ? window.getStorageKey() : 'multracks_projects_guest');
        const storageData = localStorage.getItem(key);
        
        console.log('[EDITOR] Saving to localStorage with key:', key);
        
        let storageObj = { version: 1, projects: [] };
        if (storageData) {
            try {
                const parsedData = JSON.parse(storageData);
                if (parsedData.version && parsedData.projects) {
                    storageObj = parsedData;
                } else if (Array.isArray(parsedData)) {
                    storageObj.projects = parsedData;
                }
            } catch (parseError) {
                console.error('[EDITOR] Error parsing storage data:', parseError);
            }
        }
        
        if (!Array.isArray(storageObj.projects)) {
            storageObj.projects = [];
        }
        
        // Create a clean copy of the project without Blob/File objects
        const projectCopy = {
            ...project,
            tracks: project.tracks.map(track => ({
                ...track,
                file: undefined, // Remove Blob/File, keep only audioFileId
                audioFileId: track.audioFileId // Ensure audioFileId is preserved
            }))
        };
        
        const projectIndex = storageObj.projects.findIndex(p => p.id === project.id);
        
        if (projectIndex !== -1) {
            storageObj.projects[projectIndex] = projectCopy;
            console.log('[EDITOR] Updated existing project in localStorage');
        } else {
            storageObj.projects.push(projectCopy);
            console.log('[EDITOR] Added new project to localStorage');
        }
        
        localStorage.setItem(key, JSON.stringify(storageObj));
        console.log('[EDITOR] Total projects in localStorage:', storageObj.projects.length);
    }
    
    exportConfiguration() {
        const config = {
            projectId: this.currentProject.id,
            projectName: this.currentProject.name,
            tracks: []
        };
        
        for (const track of this.currentProject.tracks) {
            const trackConfig = this.trackConfigs.get(track.id);
            if (trackConfig) {
                config.tracks.push({
                    id: track.id,
                    name: trackConfig.name,
                    offset: trackConfig.offset, // Primary timeline positioning
                    trimIn: trackConfig.trimIn,
                    trimOut: trackConfig.trimOut,
                    originalDuration: trackConfig.originalDuration,
                    mute: track.mute || false,
                    solo: track.solo || false
                });
            }
        }
        
        return config;
    }
    
    showError(title, message) {
        const trackHeaders = document.getElementById('trackHeaders');
        const playlistContent = document.getElementById('playlistContent');
        
        trackHeaders.innerHTML = '';
        playlistContent.innerHTML = `
            <div class="daw-error" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 60px 40px; text-align: center;">
                <div class="daw-error-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                </div>
                <h3 class="daw-error-title">${title}</h3>
                <p class="daw-error-description">${message}</p>
                <button class="daw-btn" onclick="window.location.href='index.html'">
                    Voltar para a Biblioteca
                </button>
            </div>
        `;
    }
    
    showToast(message) {
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toastMessage');
        
        toastMessage.textContent = message;
        toast.classList.add('show');
        
        setTimeout(() => {
            this.hideToast();
        }, 3000);
    }
    
    hideToast() {
        const toast = document.getElementById('toast');
        toast.classList.remove('show');
    }
    
    hideSplashScreen() {
        const splashScreen = document.getElementById('splashScreen');
        if (splashScreen) {
            splashScreen.style.display = 'none';
        }
    }
    
    cleanup() {
        // Stop playback
        this.pause();

        // Stop auto-scroll
        this.stopAutoScroll();

        // Clear audio buffers
        this.audioBuffers.clear();
        this.sourceNodes.clear();

        // Clear waveform cache
        this.waveformCache.clear();

        // Close AudioContext
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        console.log('[EDITOR] Cleanup completed');
    }

    async cleanupAndReturn() {
        console.log('[EDITOR] Cleaning up before returning to main app');

        // Stop playback
        this.pause();

        // Stop auto-scroll
        this.stopAutoScroll();

        // Stop visualization
        this.stopVisualization();

        // Clear audio buffers to free memory
        this.audioBuffers.clear();
        this.sourceNodes.clear();
        this.trackGainNodes.clear();
        this.trackAnalyserNodes.clear();

        // Clear waveform cache
        this.waveformCache.clear();

        // Close AudioContext to free audio resources
        if (this.audioContext) {
            try {
                await this.audioContext.close();
                this.audioContext = null;
            } catch (e) {
                console.warn('[EDITOR] Error closing AudioContext:', e);
            }
        }

        // Clear project reference
        this.currentProject = null;

        // Clear sessionStorage
        sessionStorage.removeItem('editorProjectId');

        console.log('[EDITOR] Cleanup complete, navigating to index.html');

        // Navigate back to main app
        window.location.href = 'index.html';
    }
    
    /**
     * Generate lightweight waveform data from AudioBuffer
     * Returns cached data if available, otherwise generates new data
     * Uses a higher resolution cache for better quality at different zoom levels
     */
    generateWaveformData(trackId, numSamples = 500) {
        // Use a higher resolution cache key for better quality
        const cacheKey = `${trackId}_highres`;
        
        // Check cache first
        if (this.waveformCache.has(cacheKey)) {
            const cachedData = this.waveformCache.get(cacheKey);
            // Downsample to requested number of samples if needed
            if (cachedData.length > numSamples) {
                return this.downsampleWaveform(cachedData, numSamples);
            }
            return cachedData;
        }
        
        const audioBuffer = this.audioBuffers.get(trackId);
        if (!audioBuffer) {
            console.warn('[EDITOR] No audio buffer for track:', trackId);
            return null;
        }
        
        try {
            // Get channel data (use first channel for mono representation)
            const channelData = audioBuffer.getChannelData(0);
            const totalSamples = channelData.length;
            
            // Use higher resolution for cache (500 samples for good quality)
            const cacheSamples = 500;
            const blockSize = Math.floor(totalSamples / cacheSamples);
            
            // Generate peaks array
            const peaks = new Array(cacheSamples).fill(0);
            
            for (let i = 0; i < cacheSamples; i++) {
                const start = i * blockSize;
                const end = Math.min(start + blockSize, totalSamples);
                
                let max = 0;
                let min = 0;
                
                // Find min/max in this block
                for (let j = start; j < end; j++) {
                    const sample = channelData[j];
                    if (sample > max) max = sample;
                    if (sample < min) min = sample;
                }
                
                // Store as absolute amplitude
                peaks[i] = Math.max(Math.abs(max), Math.abs(min));
            }
            
            // Cache the high-resolution result
            this.waveformCache.set(cacheKey, peaks);
            
            console.log('[EDITOR] Generated high-res waveform data for track:', trackId, 'samples:', cacheSamples);
            
            // Downsample to requested number of samples if needed
            if (numSamples < cacheSamples) {
                return this.downsampleWaveform(peaks, numSamples);
            }
            
            return peaks;
            
        } catch (error) {
            console.error('[EDITOR] Error generating waveform data:', error);
            return null;
        }
    }
    
    /**
     * Downsample waveform data to requested number of samples
     */
    downsampleWaveform(highResData, targetSamples) {
        if (highResData.length <= targetSamples) {
            return highResData;
        }
        
        const downsampled = new Array(targetSamples).fill(0);
        const ratio = highResData.length / targetSamples;
        
        for (let i = 0; i < targetSamples; i++) {
            const start = Math.floor(i * ratio);
            const end = Math.floor((i + 1) * ratio);
            
            let max = 0;
            for (let j = start; j < end; j++) {
                if (highResData[j] > max) {
                    max = highResData[j];
                }
            }
            
            downsampled[i] = max;
        }
        
        return downsampled;
    }
    
    /**
     * Draw waveform on canvas within audio block
     * Respects trim parameters and adjusts for different zoom levels
     */
    drawWaveform(canvas, trackId, width, height, trimIn = 0, trimOut = null) {
        const ctx = canvas.getContext('2d');
        
        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        
        // Get track configuration for trim values
        const config = this.trackConfigs.get(trackId);
        if (config) {
            trimIn = config.trimIn || 0;
            trimOut = config.trimOut || null;
        }
        
        // Get waveform data with appropriate resolution based on width
        const samples = Math.min(Math.max(width, 100), 500); // Between 100-500 samples
        const peaks = this.generateWaveformData(trackId, samples);
        if (!peaks) {
            // Draw placeholder if no waveform data
            this.drawPlaceholderWaveform(ctx, width, height);
            return;
        }
        
        // Get audio buffer to calculate trim positions
        const audioBuffer = this.audioBuffers.get(trackId);
        if (!audioBuffer) {
            this.drawPlaceholderWaveform(ctx, width, height);
            return;
        }
        
        // Calculate trim positions in the waveform data
        const totalDuration = audioBuffer.duration;
        const trimInRatio = trimIn / totalDuration;
        const trimOutRatio = trimOut ? trimOut / totalDuration : 1;
        
        const startIndex = Math.floor(trimInRatio * peaks.length);
        const endIndex = Math.floor(trimOutRatio * peaks.length);
        
        // Extract the relevant portion of the waveform
        const relevantPeaks = peaks.slice(startIndex, endIndex);
        
        if (relevantPeaks.length === 0) {
            this.drawPlaceholderWaveform(ctx, width, height);
            return;
        }
        
        // Drawing parameters
        const centerY = height / 2;
        const barWidth = width / relevantPeaks.length;
        const maxAmplitude = height / 2 - 2; // Leave small padding
        
        // Draw waveform
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 1;
        
        // Draw as connected line (top)
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        
        for (let i = 0; i < relevantPeaks.length; i++) {
            const amplitude = relevantPeaks[i] * maxAmplitude;
            const x = i * barWidth + barWidth / 2;
            const y = centerY - amplitude;
            
            ctx.lineTo(x, y);
        }
        
        ctx.stroke();
        
        // Draw mirrored waveform for stereo look (bottom)
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        
        for (let i = 0; i < relevantPeaks.length; i++) {
            const amplitude = relevantPeaks[i] * maxAmplitude;
            const x = i * barWidth + barWidth / 2;
            const y = centerY + amplitude;
            
            ctx.lineTo(x, y);
        }
        
        ctx.stroke();
        
        // Add subtle fill for better visibility
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        
        for (let i = 0; i < relevantPeaks.length; i++) {
            const amplitude = relevantPeaks[i] * maxAmplitude;
            const x = i * barWidth + barWidth / 2;
            const y = centerY - amplitude;
            ctx.lineTo(x, y);
        }
        
        for (let i = relevantPeaks.length - 1; i >= 0; i--) {
            const amplitude = relevantPeaks[i] * maxAmplitude;
            const x = i * barWidth + barWidth / 2;
            const y = centerY + amplitude;
            ctx.lineTo(x, y);
        }
        
        ctx.closePath();
        ctx.fill();
    }
    
    /**
     * Draw placeholder waveform when no audio data is available
     */
    drawPlaceholderWaveform(ctx, width, height) {
        const centerY = height / 2;
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        
        // Draw simple horizontal line
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(width, centerY);
        ctx.stroke();
        
        // Draw some random-looking placeholder bars
        const barCount = 20;
        const barWidth = width / barCount;
        
        for (let i = 0; i < barCount; i++) {
            const x = i * barWidth;
            const barHeight = Math.random() * (height / 4);
            
            ctx.fillRect(x + 2, centerY - barHeight / 2, barWidth - 4, barHeight);
        }
    }
}

// Initialize editor when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.trackEditor = new TrackEditor();
});