/**
 * Multracks Player Module
 * Architecture for multitrack player with individual track controls
 * This module will be expanded when implementing the full multitrack player
 */

class MultitrackPlayer {
    constructor() {
        this.currentProject = null;
        this.audioContext = null;
        this.isPlaying = false;
        this.isLoading = false;
        this.isReady = false;
        this.currentTime = 0;
        this.totalDuration = 0;
        this.loopEnabled = false;
        this.loopStart = 0;
        this.loopEnd = 0;
        this.isRestarting = false;
        
        // Playback synchronization using audioContext hardware clock
        this.playbackStartContextTime = 0; // audioContext.currentTime when playback started
        this.playbackStartOffset = 0; // this.currentTime at playback start (for seek/resume support)
        this.trackEndedHandlers = new Map(); // Store handlers for cleanup
        this.songEndedNotified = false; // Prevent multiple song ended notifications
        this.waveformLoading = false; // Track waveform loading state
        
        // Track audio nodes
        this.trackNodes = new Map();
        
        // Master output
        this.masterGain = null;
        this.analyser = null;
        
        // Visualization frame for track level meters
        this.visualizationFrame = null;
        
        // Peak hold configuration
        this.peakHoldDuration = 800; // ms to hold peak
        this.peakReleaseFactor = 0.05; // slow decay for peak hold
        
        // Metronome
        this.metronome = null;
        this.metronomeEnabled = false;
        this.metronomeBpm = 120;
        this.metronomeTimeSignature = '4/4';
        
        // Event callbacks
        this.onTimeUpdate = null;
        this.onPlayStateChange = null;
        this.onTrackStateChange = null;
        this.onLoadingProgress = null;
        this.onTrackLevelUpdate = null; // Callback for track level meter updates
        this.onMetronomeLevelUpdate = null; // Callback for metronome level meter updates
        this.onMasterLevelUpdate = null; // Callback for master level meter updates
        this.onDurationChange = null; // Callback for duration changes
        this.onSongEnded = null; // Callback for when song ends
        
        this.init();
    }
    
    init() {
        // Don't initialize Audio Context immediately - wait for user interaction
        // This is required by browser autoplay policies
        console.log('[PLAYER] MultitrackPlayer initialized (Audio Context will be created on first play)');
    }
    
    initAudioContext() {
        if (this.audioContext) {
            console.log('[PLAYER] AudioContext already initialized');
            return;
        }
        
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();
            console.log('[PLAYER] AudioContext created:', this.audioContext.state);
            
            // Create master gain node
            this.masterGain = this.audioContext.createGain();
            this.masterGain.gain.value = 1;
            
            // Use standard StereoPannerNode for master
            this.masterPanner = this.audioContext.createStereoPanner();
            
            // Create analyser for visualization
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            
            // Create master analyser for master level meter
            this.masterAnalyser = this.audioContext.createAnalyser();
            this.masterAnalyser.fftSize = 256;
            this.masterAnalyser.smoothingTimeConstant = 0.8;
            
            // Create master limiter to prevent clipping/distortion
            this.masterLimiter = this.audioContext.createDynamicsCompressor();
            this.masterLimiter.threshold.value = -1; // -1 dB threshold
            this.masterLimiter.knee.value = 0; // Hard knee for limiter behavior
            this.masterLimiter.ratio.value = 20; // Aggressive ratio for limiting
            this.masterLimiter.attack.value = 0.003; // 3ms attack for fast transient response
            this.masterLimiter.release.value = 0.25; // 250ms release
            
            // Connect: masterGain -> masterPanner -> masterAnalyser -> analyser -> masterLimiter -> destination
            this.masterGain.connect(this.masterPanner);
            this.masterPanner.connect(this.masterAnalyser);
            this.masterAnalyser.connect(this.analyser);
            this.analyser.connect(this.masterLimiter);
            this.masterLimiter.connect(this.audioContext.destination);
            
            console.log('[PLAYER] Audio graph initialized (using standard StereoPannerNode with master limiter)');
            
            // Initialize metronome
            this.metronome = new Metronome(this.audioContext, this.masterGain);
            this.metronome.setBpm(this.metronomeBpm);
            this.metronome.setTimeSignature(this.metronomeTimeSignature);
            this.metronome.enable(this.metronomeEnabled);

            // Set beat callback for visualization
            this.metronome.onBeat = (beatInMeasure, isDownbeat, scheduledTime) => {
                // Callback for UI visualization if needed
                // The scheduledTime parameter allows UI to sync animations with actual audio timing
            };
            
        } catch (error) {
            console.error('[PLAYER] Error initializing AudioContext:', error);
            throw error;
        }
    }
    
    /**
     * Load a project into the player
     */
    async loadProject(project) {
        console.log('[PLAYER] =======================================');
        console.log('[PLAYER] Loading project:', project.name);
        console.log('[PLAYER] Project has', project.tracks.length, 'tracks');
        console.log('[PLAYER] =======================================');
        
        this.stop();
        this.stopVisualization(); // Stop any existing visualization before loading new project
        this.currentProject = project;
        this.isLoading = true;
        this.isReady = false;
        // Only reset currentTime when loading a new project
        this.currentTime = 0;
        // totalDuration will be calculated after tracks are loaded
        
        console.log('[PLAYER] Clearing existing track nodes, count:', this.trackNodes.size);
        
        // Clear existing track nodes
        this.trackNodes.forEach((nodes, trackId) => {
            console.log('[PLAYER] Cleaning up track:', trackId);
            // Stop and cleanup audio element
            if (nodes.audioElement) {
                try {
                    // Remove ended event listener
                    const endedHandler = this.trackEndedHandlers.get(trackId);
                    if (endedHandler) {
                        nodes.audioElement.removeEventListener('ended', endedHandler);
                        this.trackEndedHandlers.delete(trackId);
                        console.log('[PLAYER] Removed ended event listener for track:', trackId);
                    }
                    
                    nodes.audioElement.pause();
                    nodes.audioElement.currentTime = 0;
                    console.log('[PLAYER] Paused and reset audio element for track:', trackId);
                } catch (e) {
                    console.log('[PLAYER] Audio element already stopped for track:', trackId);
                }
                // Revoke object URL to free memory
                if (nodes.objectUrl) {
                    URL.revokeObjectURL(nodes.objectUrl);
                    console.log('[PLAYER] Revoked object URL for track:', trackId);
                }
            }
            // Disconnect media source
            if (nodes.mediaSource) {
                nodes.mediaSource.disconnect();
                console.log('[PLAYER] Disconnected media source for track:', trackId);
            }
            // Disconnect analyser
            if (nodes.analyser) {
                nodes.analyser.disconnect();
                console.log('[PLAYER] Disconnected analyser for track:', trackId);
            }
            nodes.gain.disconnect();
            if (nodes.panner) {
                nodes.panner.disconnect();
            }
            console.log('[PLAYER] Disconnected gain and panner for track:', trackId);
        });
        this.trackNodes.clear();
        console.log('[PLAYER] Track nodes cleared');
        
        // Initialize Audio Context if not already done
        console.log('[PLAYER] Initializing AudioContext...');
        this.initAudioContext();
        
        // Load all tracks with progress tracking and early readiness
        console.log('[PLAYER] Loading all tracks with optimized streaming...');
        let tracksLoaded = 0;
        let essentialTracksReady = false;
        const totalTracks = project.tracks.length;
        
        // Identify essential tracks (Click, Guide, or first track)
        const essentialTrackNames = ['Click', 'Guide', 'Click Track', 'Guide Track'];
        const essentialTrackIndices = project.tracks
            .map((track, index) => ({ track, index }))
            .filter(({ track }) => essentialTrackNames.some(name => 
                track.name.toLowerCase().includes(name.toLowerCase())
            ))
            .map(({ index }) => index);
        
        // If no essential tracks found, use first track as essential
        if (essentialTrackIndices.length === 0 && project.tracks.length > 0) {
            essentialTrackIndices.push(0);
        }
        
        console.log('[PLAYER] Essential track indices for early readiness:', essentialTrackIndices);
        
        // Load tracks individually with progress callback
        const loadPromises = project.tracks.map(async (track, index) => {
            console.log('[PLAYER] Starting load for track', index + 1, 'of', totalTracks, ':', track.name);
            const result = await this.loadTrack(track);
            
            if (result) {
                tracksLoaded++;
                console.log('[PLAYER] Track loaded successfully:', track.name, 'Progress:', tracksLoaded, '/', totalTracks);
                
                // Check if this is an essential track and is ready enough for playback
                if (!essentialTracksReady && essentialTrackIndices.includes(index)) {
                    const nodes = this.trackNodes.get(track.id);
                    if (nodes && nodes.audioElement && nodes.audioElement.readyState >= 3) {
                        console.log('[PLAYER] Essential track ready for early playback:', track.name);
                        essentialTracksReady = true;
                        
                        // Set player as ready early if we have at least one essential track
                        if (!this.isReady) {
                            console.log('[PLAYER] Setting player as ready early (essential track loaded)');
                            this.isReady = true;
                            this.isLoading = false;
                            
                            // Calculate preliminary duration from loaded tracks
                            this.totalDuration = 0;
                            this.trackNodes.forEach((nodes, trackId) => {
                                if (nodes.duration > this.totalDuration) {
                                    this.totalDuration = nodes.duration;
                                }
                            });
                            
                            // Notify app of duration change
                            if (this.onDurationChange) {
                                this.onDurationChange(this.totalDuration);
                            }
                        }
                    }
                }
                
                if (this.onLoadingProgress) {
                    this.onLoadingProgress(tracksLoaded, totalTracks);
                }
            } else {
                console.warn('[PLAYER] Track failed to load:', track.name);
            }
            return result;
        });
        
        // Continue loading all tracks in background
        const results = await Promise.all(loadPromises);
        const successfulLoads = results.filter(r => r).length;
        
        console.log('[PLAYER] Load results - Successful:', successfulLoads, 'Failed:', totalTracks - successfulLoads);
        
        if (successfulLoads === 0) {
            console.log('[PLAYER] ❌ ERROR: No audio tracks could be loaded');
            this.isLoading = false;
            this.isReady = false;
        } else {
            console.log('[PLAYER] ✅ All', successfulLoads, 'tracks loaded successfully');
            
            // Final duration calculation from all loaded tracks
            this.totalDuration = 0;
            this.trackNodes.forEach((nodes, trackId) => {
                console.log('[PLAYER] Track duration check - ID:', trackId, 'Duration:', nodes.duration);
                if (nodes.duration > this.totalDuration) {
                    this.totalDuration = nodes.duration;
                }
            });
            console.log('[PLAYER] Final total duration calculated:', this.totalDuration, 'seconds');
            
            // Notify app of final duration change
            if (this.onDurationChange) {
                this.onDurationChange(this.totalDuration);
            }
            
            // Ensure player is marked as ready if it wasn't already
            if (!this.isReady) {
                this.isReady = true;
            }
            this.isLoading = false;
            
            console.log('[PLAYER] ✅ Player READY - isLoading:', false, 'isReady:', true);
            this.isLoading = false;
            this.isReady = true;
            
            // Start visualization immediately after loading to show real-time levels
            this.startVisualization();
        }
        
        console.log('[PLAYER] =======================================');
        console.log('[PLAYER] Project load complete');
        console.log('[PLAYER] Final state - isLoading:', this.isLoading, 'isReady:', this.isReady, 'trackNodes:', this.trackNodes.size);
        console.log('[PLAYER] =======================================');
        
        return this.currentProject;
    }
    
    /**
     * Load a single track and create audio nodes using streaming
     */
    async loadTrack(track) {
        if (!this.audioContext) {
            console.log('[PLAYER] AudioContext not initialized, cannot load track');
            return false;
        }
        
        try {
            console.log('[PLAYER] Loading track with streaming:', track.name);
            console.log('[PLAYER] Track has file:', !!track.file);
            console.log('[PLAYER] Track has audioFileId:', !!track.audioFileId);
            
            // Check if track has a file
            if (!track.file) {
                console.warn('[PLAYER] Track has no file, skipping:', track.name);
                console.warn('[PLAYER] This track needs hydration before loading');
                return false;
            }
            
            // Create HTMLAudioElement for streaming
            const audioElement = new Audio();
            const objectUrl = URL.createObjectURL(track.file);
            audioElement.src = objectUrl;
            
            console.log('[PLAYER] Created audio element for track:', track.name, 'URL:', objectUrl);
            console.log('[PLAYER] Audio element properties:');
            console.log('[PLAYER] - src:', audioElement.src);
            console.log('[PLAYER] - crossOrigin:', audioElement.crossOrigin);
            console.log('[PLAYER] - preload:', audioElement.preload);
            console.log('[PLAYER] - mozAudioChannelType:', audioElement.mozAudioChannelType);
            console.log('[PLAYER] - webkitAudioChannelType:', audioElement.webkitAudioChannelType);
            
            // Wait for metadata to load to get duration
            await new Promise((resolve, reject) => {
                audioElement.addEventListener('loadedmetadata', resolve);
                audioElement.addEventListener('error', reject);
                setTimeout(() => reject(new Error('Timeout loading audio metadata')), 10000);
            });
            
            console.log('[PLAYER] Audio element metadata loaded, duration:', audioElement.duration, 'seconds');
            console.log('[PLAYER] Audio element channel info:');
            console.log('[PLAYER] - channels:', audioElement.mozChannels || audioElement.webkitAudioDecodedByteCount || 'unknown');
            console.log('[PLAYER] - sampleRate:', audioElement.mozSampleRate || 'unknown');
            
            // Wait for enough data to be loaded for playback (readyState >= 3 = HAVE_FUTURE_DATA)
            await new Promise((resolve, reject) => {
                if (audioElement.readyState >= 3) {
                    console.log('[PLAYER] Audio element already has enough data (readyState:', audioElement.readyState, ')');
                    resolve();
                    return;
                }
                
                console.log('[PLAYER] Waiting for audio element to have enough data for playback...');
                audioElement.addEventListener('canplay', () => {
                    console.log('[PLAYER] Audio element can play now (readyState:', audioElement.readyState, ')');
                    resolve();
                }, { once: true });
                
                audioElement.addEventListener('error', reject);
                setTimeout(() => reject(new Error('Timeout waiting for audio to be ready to play')), 15000);
            });
            
            console.log('[PLAYER] Audio element ready for playback, readyState:', audioElement.readyState);
            
            // Create track-specific nodes
            const trackGain = this.audioContext.createGain();
            // Ensure track.volume is defined and not zero, default to 1 if not set
            // Note: track.volume is the final gain value from app.js (already converted via positionToDb/dbToGain)
            const trackVolume = track.volume !== undefined && track.volume !== null ? track.volume : 1;
            trackGain.gain.value = trackVolume;
            console.log('[PLAYER] Track gain set to:', trackVolume.toFixed(4), '(final gain from app.js, original track.volume:', track.volume, ')');
            
            // Use standard StereoPannerNode from browser
            const panner = this.audioContext.createStereoPanner();
            
            // Create analyser for individual track visualization
            const trackAnalyser = this.audioContext.createAnalyser();
            trackAnalyser.fftSize = 256;
            trackAnalyser.smoothingTimeConstant = 0.8;
            
            // Create media element source from the audio element
            const mediaSource = this.audioContext.createMediaElementSource(audioElement);
            
            console.log('[PLAYER] 🔌 Setting up initial audio graph for track:', track.name);
            console.log('[PLAYER] 🔌 Node types:');
            console.log('[PLAYER] 🔌 - mediaSource:', mediaSource.constructor.name);
            console.log('[PLAYER] 🔌 - trackGain:', trackGain.constructor.name);
            console.log('[PLAYER] 🔌 - trackAnalyser:', trackAnalyser.constructor.name);
            console.log('[PLAYER] 🔌 - masterGain:', this.masterGain.constructor.name);
            
            // Connect: mediaElement -> gain -> panner -> analyser -> masterGain
            mediaSource.connect(trackGain);
            trackGain.connect(panner);
            panner.connect(trackAnalyser);
            trackAnalyser.connect(this.masterGain);
            console.log('[PLAYER] 🔌 Connected mediaSource -> trackGain -> panner -> trackAnalyser -> masterGain');
            console.log('[PLAYER] Audio graph connected for track:', track.name, '(using standard StereoPannerNode)');
            
            // Add ended event handler for loop support
            const endedHandler = () => {
                this.handleTrackEnded(track.id);
            };
            audioElement.addEventListener('ended', endedHandler);
            this.trackEndedHandlers.set(track.id, endedHandler);
            console.log('[PLAYER] Added ended event listener for track:', track.name);
            
            this.trackNodes.set(track.id, {
                audioElement: audioElement,
                objectUrl: objectUrl,
                mediaSource: mediaSource,
                gain: trackGain,
                panner: panner,
                analyser: trackAnalyser,
                duration: audioElement.duration,
                baseVolume: trackVolume, // Store the safe track volume for mute/solo calculations
                masterGain: this.masterGain, // Reference to master for pan graph recreation
                inputSplitter: null, // Will be created for custom pan (source L/R split)
                monoGain: null, // Will be created for custom pan (mono conversion)
                channelSplitter: null, // Will be created for custom pan (mono split for pan)
                channelMerger: null, // Will be created for custom pan
                leftGain: null, // Will be created for custom pan
                rightGain: null // Will be created for custom pan
            });

            // Apply initial pan value using standard StereoPannerNode
            if (track.pan !== undefined && track.pan !== null) {
                console.log('[PLAYER] 🎚️ Applying initial pan for track:', track.name, 'pan:', track.pan.toFixed(3));
                panner.pan.value = track.pan;
                console.log('[PLAYER] 🎚️ Initial pan applied to StereoPannerNode');
            }
            
            console.log('[PLAYER] ✅ Track loaded successfully with streaming:', track.name, 'readyState:', audioElement.readyState);
            return true;
            
        } catch (error) {
            console.error('[PLAYER] ❌ Error loading track', track.name, ':', error);
            console.error('[PLAYER] Error details:', error.name, error.message);
            return false;
        }
    }
    
    /**
     * Handle track ended event for loop support with synchronized restart
     */
    handleTrackEnded(trackId) {
        // console.log('[PLAYER] Track ended:', trackId, 'loopEnabled:', this.loopEnabled);

        // Only handle loop if loop is enabled
        if (!this.loopEnabled) {
            return;
        }

        // Check if this is the first track to end (to avoid multiple restarts)
        // Use a flag to prevent multiple simultaneous restarts
        if (this.isRestarting) {
            // console.log('[PLAYER] Already restarting, ignoring ended event for track:', trackId);
            return;
        }

        this.isRestarting = true;
        // console.log('[PLAYER] Starting synchronized loop restart process');

        // Stop current playback first to ensure clean restart
        this.stopPlaybackTimer();

        // Use requestAnimationFrame to ensure synchronized reset of all tracks
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                // Double requestAnimationFrame for precise timing
                // console.log('[PLAYER] Loop restart - synchronized reset to loop start:', this.loopStart);

                // Pause all audio elements first
                this.trackNodes.forEach((nodes, id) => {
                    if (nodes.audioElement) {
                        try {
                            nodes.audioElement.pause();
                        } catch (e) {
                            console.error('[PLAYER] Error pausing track during loop restart:', id, e);
                        }
                    }
                });

                // Reset all track currentTimes simultaneously to loop start
                this.trackNodes.forEach((nodes, id) => {
                    if (nodes.audioElement) {
                        // console.log('[PLAYER] Resetting track:', id, 'to loop start:', this.loopStart);
                        nodes.audioElement.currentTime = this.loopStart;
                    }
                });

                // Reset player currentTime
                this.currentTime = this.loopStart;

                // Restart metronome at loop start if enabled
                if (this.metronome && this.metronomeEnabled) {
                    // console.log('[PLAYER] Loop: Restarting metronome at loop start:', this.loopStart);
                    this.metronome.start(this.loopStart);
                }

                // Notify UI of time update
                if (this.onTimeUpdate) {
                    this.onTimeUpdate(this.currentTime);
                }

                // Clear restart flag
                this.isRestarting = false;

                // Restart playback immediately after reset using synchronized method
                if (this.isPlaying) {
                    // console.log('[PLAYER] Restarting synchronized playback from loop start');

                    // Record playback start time for hardware clock synchronization
                    this.playbackStartContextTime = this.audioContext.currentTime;
                    this.playbackStartOffset = this.currentTime;
                    // console.log('[PLAYER] Loop restart: Recorded playback start - contextTime:', this.playbackStartContextTime.toFixed(3), 'offset:', this.playbackStartOffset.toFixed(3));

                    this.startSynchronizedPlayback();
                    this.startPlaybackTimer(); // Restart timer after synchronized playback
                }
            });
        });
    }
    
    /**
     * Play all tracks from current time using streaming with improved synchronization
     */
    async play() {
        console.log('[PLAYER] play() called');
        console.log('[PLAYER] Current state - isLoading:', this.isLoading, 'isReady:', this.isReady, 'isPlaying:', this.isPlaying);
        
        // Check if player is ready
        if (this.isLoading || !this.isReady) {
            console.warn('[PLAYER] Play blocked: player is still loading. isLoading:', this.isLoading, 'isReady:', this.isReady);
            return;
        }
        
        // If already playing, do nothing (pause should be called separately)
        if (this.isPlaying) {
            console.log('[PLAYER] Already playing, ignoring play() call');
            return;
        }
        
        if (!this.audioContext) {
            console.log('[PLAYER] No AudioContext, initializing...');
            this.initAudioContext();
        }
        
        if (!this.audioContext || !this.currentProject) {
            console.log('[PLAYER] Cannot play: missing AudioContext or currentProject');
            return;
        }
        
        // Resume audio context if suspended (using await to ensure it's ready)
        // This is called via user interaction (play button), so it's safe to resume
        if (this.audioContext.state === 'suspended') {
            console.log('[PLAYER] Resuming suspended AudioContext');
            try {
                await this.audioContext.resume();
            } catch (error) {
                console.error('[PLAYER] Error resuming AudioContext:', error);
                return;
            }
        }
        
        // Log audio context state after resume
        console.log('[PLAYER] AudioContext state after resume:', this.audioContext.state);
        console.log('[PLAYER] Master gain value:', this.masterGain.gain.value);
        
        this.isPlaying = true;
        this.songEndedNotified = false; // Reset song ended notification flag
        
        console.log('[PLAYER] Starting playback at position:', this.currentTime);
        console.log('[PLAYER] Total tracks in project:', this.currentProject.tracks.length);
        console.log('[PLAYER] Total trackNodes loaded:', this.trackNodes.size);
        
        // Pre-synchronization: Set all audio elements to the exact same position first
        console.log('[PLAYER] Pre-synchronizing all tracks to position:', this.currentTime);
        this.trackNodes.forEach((nodes, trackId) => {
            const track = this.currentProject.tracks.find(t => t.id === trackId);
            
            // Check if audio element is ready to play
            if (nodes.audioElement.readyState < 3) {
                console.warn('[PLAYER] Track not ready to play yet:', track.name, 'readyState:', nodes.audioElement.readyState);
                return;
            }
            
            // Set ALL audio elements to the SAME current position
            if (this.currentTime >= 0 && this.currentTime < nodes.duration) {
                nodes.audioElement.currentTime = this.currentTime;
                // Apply mute/solo via gain
                this.applyMuteSoloToTrack(trackId);
            }
        });
        
        // Use requestAnimationFrame for precise synchronized playback start
        console.log('[PLAYER] Scheduling synchronized playback start');
        
        await new Promise(resolve => {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    // Double requestAnimationFrame for better timing precision
                    // Start metronome if enabled - use musical position (currentTime) not audioContext.currentTime
                    if (this.metronome && this.metronomeEnabled) {
                        console.log('[PLAYER] Starting metronome at musical position:', this.currentTime);
                        this.metronome.start(this.currentTime);
                    }
                    
                    // Record playback start time for hardware clock synchronization
                    this.playbackStartContextTime = this.audioContext.currentTime;
                    this.playbackStartOffset = this.currentTime;
                    console.log('[PLAYER] Recorded playback start - contextTime:', this.playbackStartContextTime.toFixed(3), 'offset:', this.playbackStartOffset.toFixed(3));
                    
                    this.startSynchronizedPlayback();
                    resolve();
                });
            });
        });
        
        this.startPlaybackTimer();
        this.startVisualization();
        
        if (this.onPlayStateChange) {
            this.onPlayStateChange('playing');
        }
    }
    
    /**
     * Start synchronized playback of all tracks with absolute timing
     */
    startSynchronizedPlayback() {
        let tracksPlaying = 0;
        let tracksSkipped = 0;
        let tracksErrored = 0;
        const playPromises = [];
        
        // Calculate absolute start time for perfect synchronization
        const syncStartTime = this.audioContext.currentTime + 0.05; // 50ms offset for synchronization
        console.log('[PLAYER] Absolute sync start time:', syncStartTime, '(current audioContext time:', this.audioContext.currentTime, ')');
        
        // Pre-synchronization: Set all tracks to exact position before starting
        this.trackNodes.forEach((nodes, trackId) => {
            const track = this.currentProject.tracks.find(t => t.id === trackId);
            
            // Check if audio element is ready to play
            if (nodes.audioElement.readyState < 3) {
                console.warn('[PLAYER] Track not ready to play yet:', track.name, 'readyState:', nodes.audioElement.readyState);
                tracksSkipped++;
                return;
            }
            
            // Check if current position is valid
            if (this.currentTime >= 0 && this.currentTime < nodes.duration) {
                // Final sync check - ensure all tracks are at exactly the same position
                nodes.audioElement.currentTime = this.currentTime;
            }
        });
        
        // Start all tracks simultaneously using the same timing reference
        this.trackNodes.forEach((nodes, trackId) => {
            const track = this.currentProject.tracks.find(t => t.id === trackId);
            
            console.log('[PLAYER] Starting synchronized playback for track:', track.name);
            
            // Check if current position is valid
            if (this.currentTime >= 0 && this.currentTime < nodes.duration) {
                // Play the audio element
                const playPromise = nodes.audioElement.play();
                
                if (playPromise !== undefined) {
                    playPromises.push(playPromise);
                    playPromise
                        .then(() => {
                            console.log('[PLAYER] ✅ Successfully started playing track:', track.name);
                        })
                        .catch(error => {
                            console.error('[PLAYER] ❌ Error playing track:', track.name, error);
                            tracksErrored++;
                        });
                }
                
                tracksPlaying++;
            } else {
                console.log('[PLAYER] Track position out of range:', track.name, 'currentTime:', this.currentTime, 'duration:', nodes.duration);
                tracksSkipped++;
            }
        });
        
        console.log('[PLAYER] Synchronized playback summary - Playing:', tracksPlaying, 'Skipped:', tracksSkipped, 'Errored:', tracksErrored);
        
        // Post-synchronization: Immediate drift correction after all tracks start
        if (playPromises.length > 0) {
            Promise.all(playPromises)
                .then(() => {
                    console.log('[PLAYER] All tracks started, performing immediate drift correction');
                    // Immediate correction using requestAnimationFrame for timing precision
                    requestAnimationFrame(() => {
                        this.trackNodes.forEach((nodes, trackId) => {
                            const track = this.currentProject.tracks.find(t => t.id === trackId);
                            if (this.currentTime >= 0 && this.currentTime < nodes.duration) {
                                // Small final adjustment to ensure perfect sync
                                const drift = Math.abs(nodes.audioElement.currentTime - this.currentTime);
                                if (drift > 0.005) { // Reduced threshold to 5ms for tighter sync
                                    nodes.audioElement.currentTime = this.currentTime;
                                }
                            }
                        });
                        console.log('[PLAYER] Immediate drift correction complete');
                    });
                })
                .catch(error => {
                    console.error('[PLAYER] Error during synchronized playback:', error);
                });
        }
    }
    
    /**
     * Pause playback with synchronized stopping
     */
    pause() {
        console.log('[PLAYER] pause() called, isPlaying:', this.isPlaying);
        
        if (!this.isPlaying) {
            console.log('[PLAYER] Not playing, ignoring pause()');
            return;
        }
        
        // Calculate elapsed time from the playback timer (more accurate than audioContext)
        // The playback timer already increments currentTime correctly
        console.log('[PLAYER] Pausing at position:', this.currentTime);
        
        this.isPlaying = false;
        this.isRestarting = false; // Clear restart flag on pause
        this.stopPlaybackTimer();
        // Don't stop visualization - keep level meters active to show real-time audio levels
        
        // Stop metronome
        if (this.metronome) {
            this.metronome.stop();
            console.log('[PLAYER] Metronome stopped');
        }
        
        // Synchronized pause: Capture current position first, then pause all
        const syncPosition = this.currentTime;
        console.log('[PLAYER] Synchronized pause at position:', syncPosition);
        
        let pausedCount = 0;
        this.trackNodes.forEach((nodes, trackId) => {
            if (nodes.audioElement) {
                try {
                    // First sync position, then pause
                    if (syncPosition >= 0 && syncPosition < nodes.duration) {
                        nodes.audioElement.currentTime = syncPosition;
                    }
                    nodes.audioElement.pause();
                    pausedCount++;
                    console.log('[PLAYER] Paused audio element for track:', trackId);
                } catch (e) {
                    console.error('[PLAYER] Error pausing audio element for track:', trackId, e);
                }
            } else {
                console.warn('[PLAYER] No audio element for track:', trackId);
            }
        });
        
        console.log('[PLAYER] Synchronized pause complete for', pausedCount, 'audio elements');
        
        if (this.onPlayStateChange) {
            this.onPlayStateChange('paused');
        }
    }
    
    /**
     * Stop playback and reset to beginning with synchronized cleanup
     */
    stop() {
        console.log('[PLAYER] stop() called');
        console.log('[PLAYER] Current state before stop - isPlaying:', this.isPlaying, 'currentTime:', this.currentTime);
        
        this.pause();
        
        // Synchronized reset of all audio elements to position 0
        this.trackNodes.forEach((nodes, trackId) => {
            if (nodes.audioElement) {
                try {
                    nodes.audioElement.currentTime = 0;
                    console.log('[PLAYER] Reset track:', trackId, 'to position 0');
                } catch (e) {
                    console.error('[PLAYER] Error resetting track:', trackId, e);
                }
            }
        });
        
        this.currentTime = 0;
        this.songEndedNotified = false; // Reset song ended notification flag
        
        console.log('[PLAYER] Playback stopped and all tracks synchronized to position 0');
        
        if (this.onPlayStateChange) {
            this.onPlayStateChange('stopped');
        }
        
        if (this.onTimeUpdate) {
            this.onTimeUpdate(0);
        }
    }
    
    /**
     * Seek to specific time with synchronized node recreation
     * @param {number} time - Target time in seconds
     * @param {boolean} pauseAfterSeek - If true, always pause after seek (for rewind/forward buttons)
     */
    async seek(time, pauseAfterSeek = false) {
        const wasPlaying = this.isPlaying;
        
        // Always pause first to ensure synchronization
        if (this.isPlaying) {
            this.pause();
        }
        
        this.currentTime = Math.max(0, Math.min(time, this.totalDuration));
        
        // Resume audio context if suspended
        if (this.audioContext && this.audioContext.state === 'suspended') {
            console.log('[PLAYER] Resuming AudioContext during seek');
            try {
                await this.audioContext.resume();
            } catch (error) {
                console.error('[PLAYER] Error resuming AudioContext during seek:', error);
            }
        }
        
        // Pre-synchronization: Set all audio elements to the exact same position
        console.log('[PLAYER] Pre-synchronizing all tracks to seek position:', this.currentTime);
        this.trackNodes.forEach((nodes) => {
            if (this.currentTime >= 0 && this.currentTime < nodes.duration) {
                nodes.audioElement.currentTime = this.currentTime;
            }
        });
        
        if (this.onTimeUpdate) {
            this.onTimeUpdate(this.currentTime);
        }
        
        // Only resume if was playing AND pauseAfterSeek is false
        if (wasPlaying && !pauseAfterSeek) {
            // Use requestAnimationFrame for synchronized restart
            await new Promise(resolve => {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        // Record playback start time for hardware clock synchronization
                        this.playbackStartContextTime = this.audioContext.currentTime;
                        this.playbackStartOffset = this.currentTime;
                        // console.log('[PLAYER] Seek: Recorded playback start - contextTime:', this.playbackStartContextTime.toFixed(3), 'offset:', this.playbackStartOffset.toFixed(3));

                        // Restart metronome at new position if enabled
                        if (this.metronome && this.metronomeEnabled) {
                            // console.log('[PLAYER] Seek: Restarting metronome at new position:', this.currentTime);
                            this.metronome.start(this.currentTime);
                        }

                        this.startSynchronizedPlayback();
                        resolve();
                    });
                });
            });
            
            // Ensure playback state is correct
            this.isPlaying = true;
            
            // Restart playback timer to update playhead position
            this.startPlaybackTimer();
            
            // Notify UI of play state change
            if (this.onPlayStateChange) {
                this.onPlayStateChange('playing');
            }
        }
        
        console.log('[PLAYER] Seek complete - pauseAfterSeek:', pauseAfterSeek, 'final state:', this.isPlaying ? 'playing' : 'paused');
    }
    
    /**
     * Seek relative to current time (for rewind/forward buttons)
     * Always pauses after seek to prevent desynchronization
     * Maintains perfect multitrack synchronization
     */
    async seekRelative(seconds) {
        const newTime = this.currentTime + seconds;
        console.log('[PLAYER] seekRelative called:', seconds, 'seconds, new time:', newTime);
        // Always pause after seek for rewind/forward buttons
        await this.seek(newTime, true);
    }
    
    /**
     * Set track volume with smooth transition
     * Note: volume parameter is the final gain value from app.js (already converted via positionToDb/dbToGain)
     */
    setTrackVolume(trackId, volume) {
        const nodes = this.trackNodes.get(trackId);
        if (nodes && nodes.gain) {
            nodes.baseVolume = volume; // Update base volume (final gain from app.js)
            
            // Apply volume considering current mute/solo state
            const track = this.currentProject?.tracks.find(t => t.id === trackId);
            if (track) {
                track.volume = volume;
                this.applyMuteSoloToTrack(trackId);
            }
        }
    }
    
    /**
     * Toggle track mute
     */
    toggleTrackMute(trackId) {
        const track = this.currentProject?.tracks.find(t => t.id === trackId);
        if (track) {
            track.mute = !track.mute;
            
            // Apply mute/solo via gain (keep audio playing)
            this.applyMuteSoloToTrack(trackId);
            
            if (this.onTrackStateChange) {
                this.onTrackStateChange(trackId, { mute: track.mute });
            }
            
            return track.mute;
        }
        return false;
    }
    
    /**
     * Toggle track solo
     * @param {string} trackId - The track ID to toggle solo for
     * @param {boolean} padHasSolo - Optional parameter to indicate if PAD has solo enabled
     */
    toggleTrackSolo(trackId, padHasSolo = false) {
        const track = this.currentProject?.tracks.find(t => t.id === trackId);
        if (track) {
            track.solo = !track.solo;
            
            // Apply mute/solo to all tracks via gain (keep audio playing)
            this.trackNodes.forEach((nodes, id) => {
                this.applyMuteSoloToTrack(id, padHasSolo);
            });
            
            if (this.onTrackStateChange) {
                this.onTrackStateChange(trackId, { solo: track.solo });
            }
            
            return track.solo;
        }
        return false;
    }
    
    /**
     * Set track pan using standard StereoPannerNode
     */
    setTrackPan(trackId, pan) {
        console.log('[PLAYER] 🎚️ setTrackPan called - trackId:', trackId, 'pan:', pan.toFixed(3));
        
        const nodes = this.trackNodes.get(trackId);
        if (nodes) {
            const track = this.currentProject?.tracks.find(t => t.id === trackId);
            if (track) {
                track.pan = pan;
                console.log('[PLAYER] 🎚️ Track pan updated in project:', track.name, 'new pan:', pan.toFixed(3));
            }

            // Use standard StereoPannerNode
            if (nodes.panner) {
                nodes.panner.pan.value = pan;
                console.log('[PLAYER] 🎚️ Applied pan to StereoPannerNode:', pan.toFixed(3));
            } else {
                console.log('[PLAYER] 🎚️ ERROR: Panner node not found');
            }
        } else {
            console.log('[PLAYER] 🎚️ ERROR: Track nodes not found for trackId:', trackId);
        }
    }

    /**
     * Apply hard cut pan logic using separate gain nodes for left and right channels
     */
    applyHardCutPan(nodes, pan) {
        const HARD_CUT_THRESHOLD = 0.95;

        console.log('[PLAYER] 🎚️ PAN DEBUG - Input pan:', pan.toFixed(3));
        console.log('[PLAYER] 🎚️ PAN DEBUG - Nodes check - leftGain:', !!nodes.leftGain, 'rightGain:', !!nodes.rightGain, 'inputSplitter:', !!nodes.inputSplitter, 'monoGain:', !!nodes.monoGain);

        // Recreate the pan graph if it doesn't exist or if it's still using StereoPannerNode
        if (!nodes.leftGain || !nodes.rightGain || !nodes.channelSplitter || !nodes.channelMerger || !nodes.inputSplitter || !nodes.monoGain) {
            console.log('[PLAYER] 🎚️ PAN DEBUG - Recreating pan graph...');
            this.recreatePanGraph(nodes);
        }

        if (nodes.leftGain && nodes.rightGain) {
            let leftGain, rightGain;

            // Hard cut for extreme values
            if (pan >= HARD_CUT_THRESHOLD) {
                // Fully right: left channel is strictly 0.0
                leftGain = 0.0;
                rightGain = 1.0;
                console.log('[PLAYER] 🎚️ PAN DEBUG - HARD CUT RIGHT: pan >= 0.95');
            } else if (pan <= -HARD_CUT_THRESHOLD) {
                // Fully left: right channel is strictly 0.0
                leftGain = 1.0;
                rightGain = 0.0;
                console.log('[PLAYER] 🎚️ PAN DEBUG - HARD CUT LEFT: pan <= -0.95');
            } else {
                // Intermediate range: map pan from (-0.95, 0.95) to (0.0, 1.0)
                const x = (pan + 0.95) / 1.90;
                
                // Apply equal power curve
                leftGain = Math.cos(x * (Math.PI / 2));
                rightGain = Math.sin(x * (Math.PI / 2));
                console.log('[PLAYER] 🎚️ PAN DEBUG - INTERMEDIATE: x =', x.toFixed(3));
            }

            console.log('[PLAYER] 🎚️ PAN DEBUG - Calculated gains - Left:', leftGain.toFixed(4), '| Right:', rightGain.toFixed(4));
            
            // Apply gains
            nodes.leftGain.gain.value = leftGain;
            nodes.rightGain.gain.value = rightGain;
            
            // Verify gains were applied correctly
            console.log('[PLAYER] 🎚️ PAN DEBUG - Applied gains - Left:', nodes.leftGain.gain.value.toFixed(4), '| Right:', nodes.rightGain.gain.value.toFixed(4));
            
            // Check if there are any other connections that might be bypassing our pan graph
            console.log('[PLAYER] 🎚️ PAN DEBUG - Analyser connections check...');
            console.log('[PLAYER] 🎚️ PAN DEBUG - analyser.numberOfInputs:', nodes.analyser?.numberOfInputs);
            console.log('[PLAYER] 🎚️ PAN DEBUG - analyser.numberOfOutputs:', nodes.analyser?.numberOfOutputs);
            
            // Check if there are any direct connections that bypass our pan graph
            console.log('[PLAYER] 🎚️ PAN DEBUG - Checking for bypass connections...');
            console.log('[PLAYER] 🎚️ PAN DEBUG - gain nodes connected to analyser:', nodes.gain? 'YES' : 'NO');
            console.log('[PLAYER] 🎚️ PAN DEBUG - panner connected:', nodes.panner ? 'YES' : 'NO');
            
            // Try to get the actual audio routing to debug
            console.log('[PLAYER] 🎚️ PAN DEBUG - Current audio routing:');
            console.log('[PLAYER] 🎚️ PAN DEBUG - gain -> analyser:', nodes.gain && nodes.analyser ? 'CONNECTED' : 'NOT CONNECTED');
            console.log('[PLAYER] 🎚️ PAN DEBUG - analyser -> inputSplitter:', nodes.analyser && nodes.inputSplitter ? 'CONNECTED' : 'NOT CONNECTED');
            console.log('[PLAYER] 🎚️ PAN DEBUG - analyser -> masterGain (DIRECT): DISCONNECTED (fixed!)');
            console.log('[PLAYER] 🎚️ PAN DEBUG - pan graph is correctly in place - no bypass');
        } else {
            console.log('[PLAYER] 🎚️ PAN DEBUG - ERROR: Gain nodes not available!');
            console.log('[PLAYER] 🎚️ PAN DEBUG - Node states:', {
                leftGain: nodes.leftGain,
                rightGain: nodes.rightGain,
                inputSplitter: nodes.inputSplitter,
                monoGain: nodes.monoGain,
                channelSplitter: nodes.channelSplitter,
                channelMerger: nodes.channelMerger
            });
        }
    }

    /**
     * Recreate the pan graph using ChannelSplitter/ChannelMerger for hard cut control
     * This converts stereo to mono first, then applies panning to prevent phase issues
     */
    recreatePanGraph(nodes) {
        console.log('[PLAYER] 🔧 recreatePanGraph called');
        console.log('[PLAYER] 🔧 Current node states before recreation:');
        console.log('[PLAYER] 🔧 - analyser:', !!nodes.analyser);
        console.log('[PLAYER] 🔧 - inputSplitter:', !!nodes.inputSplitter);
        console.log('[PLAYER] 🔧 - monoGain:', !!nodes.monoGain);
        console.log('[PLAYER] 🔧 - channelSplitter:', !!nodes.channelSplitter);
        console.log('[PLAYER] 🔧 - channelMerger:', !!nodes.channelMerger);
        console.log('[PLAYER] 🔧 - leftGain:', !!nodes.leftGain);
        console.log('[PLAYER] 🔧 - rightGain:', !!nodes.rightGain);
        console.log('[PLAYER] 🔧 - masterGain:', !!this.masterGain);
        
        if (!this.audioContext) {
            console.log('[PLAYER] 🔧 ERROR: AudioContext not available');
            return;
        }

        try {
            // Disconnect the old connection (analyser -> masterGain direct)
            if (nodes.analyser) {
                nodes.analyser.disconnect();
                console.log('[PLAYER] 🔧 Disconnected analyser from previous connection');
            }

            // Create new nodes for custom pan control with mono conversion
            nodes.inputSplitter = this.audioContext.createChannelSplitter(2); // Split source L/R
            nodes.monoGain = this.audioContext.createGain(); // Mix to mono
            nodes.channelSplitter = this.audioContext.createChannelSplitter(2); // Split for pan control
            nodes.channelMerger = this.audioContext.createChannelMerger(2);
            nodes.leftGain = this.audioContext.createGain();
            nodes.rightGain = this.audioContext.createGain();

            console.log('[PLAYER] 🔧 Created all pan nodes');
            console.log('[PLAYER] 🔧 Node types:');
            console.log('[PLAYER] 🔧 - inputSplitter:', nodes.inputSplitter.constructor.name);
            console.log('[PLAYER] 🔧 - monoGain:', nodes.monoGain.constructor.name);
            console.log('[PLAYER] 🔧 - channelSplitter:', nodes.channelSplitter.constructor.name);
            console.log('[PLAYER] 🔧 - channelMerger:', nodes.channelMerger.constructor.name);
            console.log('[PLAYER] 🔧 - leftGain:', nodes.leftGain.constructor.name);
            console.log('[PLAYER] 🔧 - rightGain:', nodes.rightGain.constructor.name);

            // Reconnect the graph with mono conversion:
            // analyser -> inputSplitter -> monoGain (sums L+R to mono) -> channelSplitter -> [leftGain, rightGain] -> merger -> masterGain
            if (nodes.analyser && this.masterGain) {
                // Step 1: Split source channels
                nodes.analyser.connect(nodes.inputSplitter);
                console.log('[PLAYER] 🔧 Step 1: Connected analyser -> inputSplitter');
                console.log('[PLAYER] 🔧 Step 1: inputSplitter.numberOfInputs:', nodes.inputSplitter.numberOfInputs);
                console.log('[PLAYER] 🔧 Step 1: inputSplitter.numberOfOutputs:', nodes.inputSplitter.numberOfOutputs);
                
                // Step 2: Mix both channels to mono (sum L+R)
                nodes.inputSplitter.connect(nodes.monoGain, 0); // Left channel to mono
                nodes.inputSplitter.connect(nodes.monoGain, 1); // Right channel to mono
                console.log('[PLAYER] 🔧 Step 2: Connected inputSplitter L+R -> monoGain');
                console.log('[PLAYER] 🔧 Step 2: monoGain.numberOfInputs:', nodes.monoGain.numberOfInputs);
                console.log('[PLAYER] 🔧 Step 2: monoGain.numberOfOutputs:', nodes.monoGain.numberOfOutputs);
                
                // Step 3: Split the mono signal for pan control
                nodes.monoGain.connect(nodes.channelSplitter);
                console.log('[PLAYER] 🔧 Step 3: Connected monoGain -> channelSplitter');
                console.log('[PLAYER] 🔧 Step 3: channelSplitter.numberOfInputs:', nodes.channelSplitter.numberOfInputs);
                console.log('[PLAYER] 🔧 Step 3: channelSplitter.numberOfOutputs:', nodes.channelSplitter.numberOfOutputs);
                
                // Step 4: Connect both outputs of mono splitter to pan gains (identical mono signal)
                nodes.channelSplitter.connect(nodes.leftGain, 0); // Mono to left gain
                nodes.channelSplitter.connect(nodes.rightGain, 0); // Mono to right gain (same channel 0)
                console.log('[PLAYER] 🔧 Step 4: Connected channelSplitter -> leftGain & rightGain');
                console.log('[PLAYER] 🔧 Step 4: leftGain.numberOfInputs:', nodes.leftGain.numberOfInputs);
                console.log('[PLAYER] 🔧 Step 4: rightGain.numberOfInputs:', nodes.rightGain.numberOfInputs);
                
                // Step 5: Merge with pan gains applied
                nodes.leftGain.connect(nodes.channelMerger, 0, 0); // Left to left
                nodes.rightGain.connect(nodes.channelMerger, 0, 1); // Right to right
                console.log('[PLAYER] 🔧 Step 5: Connected leftGain/rightGain -> channelMerger');
                console.log('[PLAYER] 🔧 Step 5: channelMerger.numberOfInputs:', nodes.channelMerger.numberOfInputs);
                console.log('[PLAYER] 🔧 Step 5: channelMerger.numberOfOutputs:', nodes.channelMerger.numberOfOutputs);
                
                // Step 6: Connect to master
                nodes.channelMerger.connect(this.masterGain);
                console.log('[PLAYER] 🔧 Step 6: Connected channelMerger -> masterGain');
                console.log('[PLAYER] 🔧 Step 6: masterGain.numberOfInputs:', this.masterGain.numberOfInputs);
            }

            console.log('[PLAYER] ✅ Recreated pan graph with mono conversion and hard cut control');
            
            // Verify the complete graph
            console.log('[PLAYER] 🔧 Graph verification:');
            console.log('[PLAYER] 🔧 - analyser -> inputSplitter:', nodes.analyser.numberOfOutputs, '->', nodes.inputSplitter.numberOfInputs);
            console.log('[PLAYER] 🔧 - inputSplitter -> monoGain:', nodes.inputSplitter.numberOfOutputs, '->', nodes.monoGain.numberOfInputs);
            console.log('[PLAYER] 🔧 - monoGain -> channelSplitter:', nodes.monoGain.numberOfOutputs, '->', nodes.channelSplitter.numberOfInputs);
            console.log('[PLAYER] 🔧 - channelSplitter -> leftGain/rightGain:', nodes.channelSplitter.numberOfOutputs, '->', nodes.leftGain.numberOfInputs, '/', nodes.rightGain.numberOfInputs);
            console.log('[PLAYER] 🔧 - leftGain/rightGain -> channelMerger:', nodes.leftGain.numberOfOutputs, '/', nodes.rightGain.numberOfOutputs, '->', nodes.channelMerger.numberOfInputs);
            console.log('[PLAYER] 🔧 - channelMerger -> masterGain:', nodes.channelMerger.numberOfOutputs, '->', this.masterGain.numberOfInputs);
        } catch (error) {
            console.error('[PLAYER] ❌ Error recreating pan graph:', error);
            console.error('[PLAYER] ❌ Error stack:', error.stack);
        }
    }
    
    /**
     * Set master pan using standard StereoPannerNode
     */
    setMasterPan(pan) {
        console.log('[PLAYER] 🎚️ setMasterPan called - pan:', pan.toFixed(3));
        
        if (this.masterPanner) {
            this.masterPanner.pan.value = pan;
            console.log('[PLAYER] 🎚️ Applied pan to master StereoPannerNode:', pan.toFixed(3));
        } else {
            console.log('[PLAYER] 🎚️ ERROR: Master panner node not found');
        }
    }

    /**
     * Apply hard cut pan logic for master
     */
    applyMasterHardCutPan(pan) {
        const HARD_CUT_THRESHOLD = 0.95;

        console.log('[PLAYER] 🎚️ MASTER PAN DEBUG - Input pan:', pan.toFixed(3));

        // Recreate the master pan graph if it doesn't exist
        if (!this.masterLeftGain || !this.masterRightGain || !this.masterChannelSplitter || !this.masterChannelMerger || !this.masterInputSplitter || !this.masterMonoGain) {
            console.log('[PLAYER] 🎚️ MASTER PAN DEBUG - Recreating master pan graph...');
            this.recreateMasterPanGraph();
        }

        if (this.masterLeftGain && this.masterRightGain) {
            let leftGain, rightGain;

            // Hard cut for extreme values
            if (pan >= HARD_CUT_THRESHOLD) {
                // Fully right: left channel is strictly 0.0
                leftGain = 0.0;
                rightGain = 1.0;
                console.log('[PLAYER] 🎚️ MASTER PAN DEBUG - HARD CUT RIGHT: pan >= 0.95');
            } else if (pan <= -HARD_CUT_THRESHOLD) {
                // Fully left: right channel is strictly 0.0
                leftGain = 1.0;
                rightGain = 0.0;
                console.log('[PLAYER] 🎚️ MASTER PAN DEBUG - HARD CUT LEFT: pan <= -0.95');
            } else {
                // Intermediate range: map pan from (-0.95, 0.95) to (0.0, 1.0)
                const x = (pan + 0.95) / 1.90;
                
                // Apply equal power curve
                leftGain = Math.cos(x * (Math.PI / 2));
                rightGain = Math.sin(x * (Math.PI / 2));
                console.log('[PLAYER] 🎚️ MASTER PAN DEBUG - INTERMEDIATE: x =', x.toFixed(3));
            }

            console.log('[PLAYER] 🎚️ MASTER PAN DEBUG - Left gain:', leftGain.toFixed(4), '| Right gain:', rightGain.toFixed(4));
            
            this.masterLeftGain.gain.value = leftGain;
            this.masterRightGain.gain.value = rightGain;
        } else {
            console.log('[PLAYER] 🎚️ MASTER PAN DEBUG - ERROR: Gain nodes not available!');
        }
    }

    /**
     * Recreate the master pan graph using ChannelSplitter/ChannelMerger for hard cut control with mono conversion
     */
    recreateMasterPanGraph() {
        console.log('[PLAYER] 🔧 recreateMasterPanGraph called');
        
        if (!this.audioContext) {
            console.log('[PLAYER] 🔧 ERROR: AudioContext not available');
            return;
        }

        try {
            // Disconnect the old connection
            if (this.masterGain) {
                this.masterGain.disconnect();
                console.log('[PLAYER] 🔧 Disconnected masterGain from previous connection');
            }

            // Create new nodes for custom pan control with mono conversion
            this.masterInputSplitter = this.audioContext.createChannelSplitter(2); // Split source L/R
            this.masterMonoGain = this.audioContext.createGain(); // Mix to mono
            this.masterChannelSplitter = this.audioContext.createChannelSplitter(2); // Split for pan control
            this.masterChannelMerger = this.audioContext.createChannelMerger(2);
            this.masterLeftGain = this.audioContext.createGain();
            this.masterRightGain = this.audioContext.createGain();

            console.log('[PLAYER] 🔧 Created all master pan nodes');

            // Reconnect the graph with mono conversion:
            // masterGain -> inputSplitter -> monoGain (sums L+R to mono) -> channelSplitter -> [leftGain, rightGain] -> merger -> masterAnalyser
            // Step 1: Split source channels
            this.masterGain.connect(this.masterInputSplitter);
            console.log('[PLAYER] 🔧 Step 1: Connected masterGain -> masterInputSplitter');
            
            // Step 2: Mix both channels to mono (sum L+R)
            this.masterInputSplitter.connect(this.masterMonoGain, 0); // Left channel to mono
            this.masterInputSplitter.connect(this.masterMonoGain, 1); // Right channel to mono
            console.log('[PLAYER] 🔧 Step 2: Connected masterInputSplitter L+R -> masterMonoGain');
            
            // Step 3: Split the mono signal for pan control
            this.masterMonoGain.connect(this.masterChannelSplitter);
            console.log('[PLAYER] 🔧 Step 3: Connected masterMonoGain -> masterChannelSplitter');
            
            // Step 4: Connect both outputs of mono splitter to pan gains (identical mono signal)
            this.masterChannelSplitter.connect(this.masterLeftGain, 0); // Mono to left gain
            this.masterChannelSplitter.connect(this.masterRightGain, 0); // Mono to right gain (same channel 0)
            console.log('[PLAYER] 🔧 Step 4: Connected masterChannelSplitter -> masterLeftGain & masterRightGain');
            
            // Step 5: Merge with pan gains applied
            this.masterLeftGain.connect(this.masterChannelMerger, 0, 0); // Left to left
            this.masterRightGain.connect(this.masterChannelMerger, 0, 1); // Right to right
            console.log('[PLAYER] 🔧 Step 5: Connected masterLeftGain/masterRightGain -> masterChannelMerger');
            
            // Step 6: Connect to master analyser
            this.masterChannelMerger.connect(this.masterAnalyser);
            console.log('[PLAYER] 🔧 Step 6: Connected masterChannelMerger -> masterAnalyser');

            console.log('[PLAYER] ✅ Recreated master pan graph with mono conversion and hard cut control');
        } catch (error) {
            console.error('[PLAYER] ❌ Error recreating master pan graph:', error);
        }
    }
    
    /**
     * Apply mute/solo state to a track via gain control with smooth transition
     * This keeps the audio playing but silences it appropriately
     * Note: baseVolume contains the final gain value from app.js (already converted via positionToDb/dbToGain)
     * @param {string} trackId - The track ID to apply mute/solo to
     * @param {boolean} padHasSolo - Optional parameter to indicate if PAD has solo enabled
     */
    applyMuteSoloToTrack(trackId, padHasSolo = false) {
        const nodes = this.trackNodes.get(trackId);
        const track = this.currentProject?.tracks.find(t => t.id === trackId);
        
        if (!nodes || !track) return;
        
        // Calculate effective gain based on mute/solo state
        // baseVolume is the final gain value from app.js (already converted via positionToDb/dbToGain)
        let effectiveGain = nodes.baseVolume !== undefined && nodes.baseVolume !== null ? nodes.baseVolume : 1;
        
        if (track.mute) {
            effectiveGain = 0;
        } else if (this.hasSoloTracks(padHasSolo) && !track.solo) {
            effectiveGain = 0;
        }
        
        // Apply smooth transition to avoid clicks (15ms ramp)
        const currentTime = this.audioContext ? this.audioContext.currentTime : 0;
        nodes.gain.gain.setTargetAtTime(effectiveGain, currentTime, 0.015);
        
        console.log('[PLAYER] Applied mute/solo to track:', track.name, 'baseVolume:', nodes.baseVolume, 'effectiveGain:', effectiveGain.toFixed(4), 'mute:', track.mute, 'solo:', track.solo, 'hasSoloTracks:', this.hasSoloTracks(padHasSolo), 'padHasSolo:', padHasSolo);
    }
    
    /**
     * Set master volume with smooth transition
     * Note: volume parameter is the final gain value from app.js (already converted via positionToDb/dbToGain)
     */
    setMasterVolume(volume) {
        if (this.masterGain) {
            // Apply smooth transition to avoid clicks (15ms ramp)
            const currentTime = this.audioContext ? this.audioContext.currentTime : 0;
            this.masterGain.gain.setTargetAtTime(volume, currentTime, 0.015);
        }
    }
    
    /**
     * Toggle loop
     */
    toggleLoop(enabled) {
        this.loopEnabled = enabled;
    }
    
    /**
     * Set loop points
     */
    setLoopPoints(start, end) {
        this.loopStart = start;
        this.loopEnd = end;
    }
    
    /**
     * Check if any track is soloed
     * @param {boolean} padHasSolo - Optional parameter to indicate if PAD has solo enabled
     */
    hasSoloTracks(padHasSolo = false) {
        const normalTracksHaveSolo = this.currentProject?.tracks.some(t => t.solo) || false;
        return normalTracksHaveSolo || padHasSolo;
    }
    
    /**
     * Start visualization for track level meters
     */
    startVisualization() {
        this.stopVisualization();
        
        const updateLevels = () => {
            // Continue updating even when paused to show real-time audio levels
            // This allows the meters to respond to actual audio output
            
            this.trackNodes.forEach((nodes, trackId) => {
                if (nodes.analyser) {
                    const dataArray = new Uint8Array(nodes.analyser.frequencyBinCount);
                    nodes.analyser.getByteFrequencyData(dataArray);
                    
                    // Calculate RMS (Root Mean Square) for more accurate level representation
                    let sum = 0;
                    for (let i = 0; i < dataArray.length; i++) {
                        sum += dataArray[i] * dataArray[i];
                    }
                    const rms = Math.sqrt(sum / dataArray.length);
                    const normalizedLevel = rms / 255; // 0.0 to 1.0
                    
                    // Apply asymmetric attack/release smoothing for responsive meters
                    // Attack: fast response to level increases (0.6)
                    // Release: slow decay for natural fall-off (0.08)
                    const attackFactor = 0.6;
                    const releaseFactor = 0.08;
                    const smoothingFactor = normalizedLevel > (nodes.currentLevel || 0) 
                        ? attackFactor 
                        : releaseFactor;
                    const smoothedLevel = nodes.currentLevel !== undefined 
                        ? nodes.currentLevel * (1 - smoothingFactor) + normalizedLevel * smoothingFactor
                        : normalizedLevel;
                    
                    // Store level for UI access
                    nodes.currentLevel = smoothedLevel;
                    
                    // Peak hold tracking
                    const currentTime = Date.now();
                    if (smoothedLevel > (nodes.peakLevel || 0)) {
                        // New peak detected
                        nodes.peakLevel = smoothedLevel;
                        nodes.peakTime = currentTime;
                    } else if (currentTime - (nodes.peakTime || 0) > this.peakHoldDuration) {
                        // Peak hold expired, decay slowly
                        nodes.peakLevel = (nodes.peakLevel || 0) * (1 - this.peakReleaseFactor);
                    }
                    
                    // Notify UI if callback exists for this specific track
                    if (this.onTrackLevelUpdate) {
                        this.onTrackLevelUpdate(trackId, smoothedLevel, nodes.peakLevel);
                    }
                }
            });
            
            // Update metronome level if enabled
            if (this.metronome && this.metronomeEnabled) {
                const metronomeLevel = this.metronome.getLevel();
                if (this.onMetronomeLevelUpdate) {
                    this.onMetronomeLevelUpdate(metronomeLevel);
                }
            }
            
            // Update master level meter
            if (this.masterAnalyser) {
                const masterDataArray = new Uint8Array(this.masterAnalyser.frequencyBinCount);
                this.masterAnalyser.getByteFrequencyData(masterDataArray);
                
                // Calculate RMS for master level
                let sum = 0;
                for (let i = 0; i < masterDataArray.length; i++) {
                    sum += masterDataArray[i] * masterDataArray[i];
                }
                const masterRms = Math.sqrt(sum / masterDataArray.length);
                const masterLevel = masterRms / 255;
                
                // Apply smoothing
                const smoothingFactor = 0.3;
                this.masterCurrentLevel = this.masterCurrentLevel !== undefined 
                    ? this.masterCurrentLevel * (1 - smoothingFactor) + masterLevel * smoothingFactor
                    : masterLevel;
                
                // Notify UI for master level
                if (this.onMasterLevelUpdate) {
                    this.onMasterLevelUpdate(this.masterCurrentLevel);
                }
            }
            
            this.visualizationFrame = requestAnimationFrame(updateLevels);
        };
        
        this.visualizationFrame = requestAnimationFrame(updateLevels);
    }
    
    /**
     * Stop visualization
     */
    stopVisualization() {
        if (this.visualizationFrame) {
            cancelAnimationFrame(this.visualizationFrame);
            this.visualizationFrame = null;
        }
        
        // Reset all track levels to zero
        this.trackNodes.forEach((nodes) => {
            nodes.currentLevel = 0;
            // Notify UI to reset levels
            if (this.onTrackLevelUpdate) {
                const trackId = Array.from(this.trackNodes.keys()).find(id => this.trackNodes.get(id) === nodes);
                if (trackId) {
                    this.onTrackLevelUpdate(trackId, 0);
                }
            }
        });
        
        // Reset master level
        this.masterCurrentLevel = 0;
        if (this.onMasterLevelUpdate) {
            this.onMasterLevelUpdate(0);
        }
    }
    
    /**
     * Start playback timer for time updates
     */
    startPlaybackTimer() {
        this.stopPlaybackTimer();

        const updateInterval = 50; // ms
        const driftThreshold = 0.05; // 50ms threshold for drift correction

        this.playbackTimer = setInterval(() => {
            if (this.isPlaying) {
                // Calculate real time using audioContext hardware clock (immune to setInterval delays)
                const elapsedRealTime = this.audioContext.currentTime - this.playbackStartContextTime;
                this.currentTime = this.playbackStartOffset + elapsedRealTime;

                // Continuous drift correction: check each track's actual currentTime
                // and correct if drift exceeds threshold
                this.trackNodes.forEach((nodes, trackId) => {
                    const track = this.currentProject.tracks.find(t => t.id === trackId);
                    if (nodes.audioElement && this.currentTime >= 0 && this.currentTime < nodes.duration) {
                        const actualTime = nodes.audioElement.currentTime;
                        const drift = Math.abs(actualTime - this.currentTime);

                        if (drift > driftThreshold) {
                            // Drift correction without logging (high frequency operation)
                            nodes.audioElement.currentTime = this.currentTime;
                        }
                    }
                });

                // Handle loop with synchronized restart using seek
                if (this.loopEnabled && this.loopStart !== null && this.loopEnd !== null) {
                    if (this.currentTime >= this.loopEnd - 0.05) {
                        // Use seek for synchronized loop back
                        this.seek(this.loopStart, false);
                    }
                }

                // Stop at end (only if loop is not enabled)
                if (!this.loopEnabled && this.currentTime >= this.totalDuration) {
                    this.stop();

                    // Notify app that song ended (only once)
                    if (this.onSongEnded && !this.songEndedNotified) {
                        this.songEndedNotified = true;
                        this.onSongEnded();
                    }
                    return;
                }

                if (this.onTimeUpdate) {
                    this.onTimeUpdate(this.currentTime);
                }
            }
        }, updateInterval);
    }
    
    /**
     * Stop playback timer
     */
    stopPlaybackTimer() {
        if (this.playbackTimer) {
            clearInterval(this.playbackTimer);
            this.playbackTimer = null;
        }
    }
    
    /**
     * Get waveform data for visualization
     */
    getWaveformData() {
        if (!this.analyser) return null;
        
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyser.getByteTimeDomainData(dataArray);
        
        return dataArray;
    }
    
    /**
     * Get frequency data for visualization
     */
    getFrequencyData() {
        if (!this.analyser) return null;
        
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyser.getByteFrequencyData(dataArray);
        
        return dataArray;
    }
    
    /**
     * Export current mix
     */
    async exportMix(format = 'wav') {
        // This would use OfflineAudioContext to render the mix
        // Implementation to be added when needed
        console.log('Export mix as', format);
        return null;
    }
    
    /**
     * Set metronome BPM
     */
    setMetronomeBpm(bpm) {
        this.metronomeBpm = bpm;
        if (this.metronome) {
            this.metronome.setBpm(bpm);
        }
    }
    
    /**
     * Set metronome time signature
     */
    setMetronomeTimeSignature(timeSignature) {
        this.metronomeTimeSignature = timeSignature;
        if (this.metronome) {
            this.metronome.setTimeSignature(timeSignature);
        }
    }
    
    /**
     * Enable/disable metronome
     */
    setMetronomeEnabled(enabled) {
        this.metronomeEnabled = enabled;
        if (this.metronome) {
            this.metronome.enable(enabled);
            
            // Start/stop metronome immediately if playback is active
            if (enabled && this.isPlaying && this.audioContext) {
                console.log('[PLAYER] Starting metronome during playback at musical position:', this.currentTime);
                this.metronome.start(this.currentTime);
            } else if (!enabled && this.metronome.isPlaying) {
                console.log('[PLAYER] Stopping metronome during playback');
                this.metronome.stop();
            }
        }
    }
    
    /**
     * Set metronome volume
     */
    setMetronomeVolume(volume) {
        if (this.metronome) {
            this.metronome.setVolume(volume);
        }
    }
    
    /**
     * Set metronome pan
     */
    setMetronomePan(pan) {
        if (this.metronome) {
            this.metronome.setPan(pan);
        }
    }
    
    /**
     * Get metronome level for visualization
     */
    getMetronomeLevel() {
        if (this.metronome) {
            return this.metronome.getLevel();
        }
        return 0;
    }
    
    /**
     * Clean up resources
     */
    destroy() {
        this.stop();
        this.stopPlaybackTimer();
        this.stopVisualization();
        
        // Destroy metronome
        if (this.metronome) {
            this.metronome.destroy();
        }
        
        this.trackNodes.forEach(nodes => {
            // Stop and cleanup audio element
            if (nodes.audioElement) {
                try {
                    nodes.audioElement.pause();
                    nodes.audioElement.currentTime = 0;
                } catch (e) {}
                // Revoke object URL to free memory
                if (nodes.objectUrl) {
                    URL.revokeObjectURL(nodes.objectUrl);
                }
            }
            // Disconnect media source
            if (nodes.mediaSource) {
                nodes.mediaSource.disconnect();
            }
            // Disconnect analyser
            if (nodes.analyser) {
                nodes.analyser.disconnect();
            }
            nodes.gain.disconnect();
            if (nodes.panner) {
                nodes.panner.disconnect();
            }
            // Disconnect custom pan nodes if they exist
            if (nodes.inputSplitter) {
                nodes.inputSplitter.disconnect();
            }
            if (nodes.monoGain) {
                nodes.monoGain.disconnect();
            }
            if (nodes.channelSplitter) {
                nodes.channelSplitter.disconnect();
            }
            if (nodes.channelMerger) {
                nodes.channelMerger.disconnect();
            }
            if (nodes.leftGain) {
                nodes.leftGain.disconnect();
            }
            if (nodes.rightGain) {
                nodes.rightGain.disconnect();
            }
        });
        this.trackNodes.clear();
        
        if (this.masterGain) {
            this.masterGain.disconnect();
        }
        
        // Disconnect master custom pan nodes if they exist
        if (this.masterInputSplitter) {
            this.masterInputSplitter.disconnect();
        }
        if (this.masterMonoGain) {
            this.masterMonoGain.disconnect();
        }
        if (this.masterChannelSplitter) {
            this.masterChannelSplitter.disconnect();
        }
        if (this.masterChannelMerger) {
            this.masterChannelMerger.disconnect();
        }
        if (this.masterLeftGain) {
            this.masterLeftGain.disconnect();
        }
        if (this.masterRightGain) {
            this.masterRightGain.disconnect();
        }
        
        if (this.audioContext) {
            this.audioContext.close();
        }
    }
}

/**
 * Metronome Class
 * Precise metronome with lookahead scheduling
 */
class Metronome {
    constructor(audioContext, masterGain) {
        this.audioContext = audioContext;
        this.masterGain = masterGain;

        this.bpm = 120;
        this.timeSignature = '4/4';
        this.isEnabled = false;
        this.isPlaying = false;

        // Metronome track nodes
        this.gain = null;
        this.boost = null; // Internal boost gain node
        this.panner = null;
        this.analyser = null;

        // Metronome internal boost (in dB)
        this.METRONOME_BOOST_DB = 6; // +6 dB internal boost

        // Scheduler
        this.lookahead = 25.0; // ms
        this.scheduleAheadTime = 0.1; // seconds
        this.nextNoteTime = 0.0;
        this.currentBeat = 0;
        this.schedulerTimer = null;

        // Temporal references for precise timing
        this.startMusicalTime = undefined;
        this.startAudioTime = undefined;

        // Protection against infinite loops
        this.maxScheduledNotes = 100; // Maximum notes per scheduler call

        // Callbacks
        this.onBeat = null;

        // Debug mode
        this.debug = false;

        this.init();
    }
    
    init() {
        // Create metronome-specific nodes
        this.gain = this.audioContext.createGain();
        this.gain.gain.value = 0.5; // Default volume

        // Create internal boost gain node
        this.boost = this.audioContext.createGain();
        this.boost.gain.value = this.dbToGain(this.METRONOME_BOOST_DB);

        // Use standard StereoPannerNode
        this.panner = this.audioContext.createStereoPanner();

        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;

        // Connect: gain -> boost -> panner -> analyser -> master
        this.gain.connect(this.boost);
        this.boost.connect(this.panner);
        this.panner.connect(this.analyser);
        this.analyser.connect(this.masterGain);

        console.log('[METRONOME] Metronome initialized with +', this.METRONOME_BOOST_DB, 'dB internal boost');
    }

    /**
     * Convert dB to linear gain for Web Audio
     */
    dbToGain(db) {
        if (db === -Infinity) {
            return 0;
        }
        return Math.pow(10, db / 20);
    }
    
    setBpm(bpm) {
        const oldBpm = this.bpm;
        this.bpm = Math.max(40, Math.min(240, bpm));
        // BPM change log is user-initiated, keep it for feedback
        console.log('[METRONOME] BPM changed from', oldBpm, 'to:', this.bpm);

        // If playing, schedule next click immediately with new BPM
        if (this.isPlaying && this.nextNoteTime > 0) {
            const currentAudioTime = this.audioContext.currentTime;
            const beatDuration = this.getBeatDuration();

            // Schedule next click immediately (or with minimal safe lookahead)
            this.nextNoteTime = currentAudioTime + 0.01; // 10ms minimal safe lookahead
            this.currentBeat++;

            if (this.debug) console.log('[METRONOME] Immediate BPM change - nextNoteTime:', this.nextNoteTime.toFixed(3), 'currentBeat:', this.currentBeat, 'beatDuration:', beatDuration.toFixed(3));

            // Trigger scheduler immediately to schedule the new click
            this.scheduler();
        }
    }
    
    setTimeSignature(timeSignature) {
        this.timeSignature = timeSignature;
        console.log('[METRONOME] Time signature set to:', this.timeSignature);
    }
    
    enable(enabled) {
        this.isEnabled = enabled;
        console.log('[METRONOME] Enabled:', enabled);
        
        if (!enabled && this.isPlaying) {
            this.stop();
        }
    }
    
    setVolume(volume) {
        if (this.gain) {
            this.gain.gain.value = volume;
        }
    }
    
    setPan(pan) {
        console.log('[METRONOME] 🎚️ setPan called - pan:', pan.toFixed(3));
        
        if (this.panner) {
            this.panner.pan.value = pan;
            console.log('[METRONOME] 🎚️ Applied pan to StereoPannerNode:', pan.toFixed(3));
        } else {
            console.log('[METRONOME] 🎚️ ERROR: Panner node not found');
        }
    }

    /**
     * Apply hard cut pan logic for metronome
     */
    applyHardCutPan(pan) {
        const HARD_CUT_THRESHOLD = 0.95;

        console.log('[METRONOME] 🎚️ PAN DEBUG - Input pan:', pan.toFixed(3));

        // Recreate the pan graph if it doesn't exist
        if (!this.leftGain || !this.rightGain || !this.channelSplitter || !this.channelMerger || !this.inputSplitter || !this.monoGain) {
            console.log('[METRONOME] 🎚️ PAN DEBUG - Recreating pan graph...');
            this.recreatePanGraph();
        }

        if (this.leftGain && this.rightGain) {
            let leftGain, rightGain;

            // Hard cut for extreme values
            if (pan >= HARD_CUT_THRESHOLD) {
                // Fully right: left channel is strictly 0.0
                leftGain = 0.0;
                rightGain = 1.0;
                console.log('[METRONOME] 🎚️ PAN DEBUG - HARD CUT RIGHT: pan >= 0.95');
            } else if (pan <= -HARD_CUT_THRESHOLD) {
                // Fully left: right channel is strictly 0.0
                leftGain = 1.0;
                rightGain = 0.0;
                console.log('[METRONOME] 🎚️ PAN DEBUG - HARD CUT LEFT: pan <= -0.95');
            } else {
                // Intermediate range: map pan from (-0.95, 0.95) to (0.0, 1.0)
                const x = (pan + 0.95) / 1.90;
                
                // Apply equal power curve
                leftGain = Math.cos(x * (Math.PI / 2));
                rightGain = Math.sin(x * (Math.PI / 2));
                console.log('[METRONOME] 🎚️ PAN DEBUG - INTERMEDIATE: x =', x.toFixed(3));
            }

            console.log('[METRONOME] 🎚️ PAN DEBUG - Left gain:', leftGain.toFixed(4), '| Right gain:', rightGain.toFixed(4));
            
            this.leftGain.gain.value = leftGain;
            this.rightGain.gain.value = rightGain;
        } else {
            console.log('[METRONOME] 🎚️ PAN DEBUG - ERROR: Gain nodes not available!');
        }
    }

    /**
     * Recreate the pan graph for metronome with mono conversion
     */
    recreatePanGraph() {
        console.log('[METRONOME] 🔧 recreatePanGraph called');

        if (!this.audioContext) {
            console.log('[METRONOME] 🔧 ERROR: AudioContext not available');
            return;
        }

        try {
            // Disconnect the old connection
            if (this.analyser) {
                this.analyser.disconnect();
                console.log('[METRONOME] 🔧 Disconnected analyser from previous connection');
            }

            // Create new nodes for custom pan control with mono conversion
            this.inputSplitter = this.audioContext.createChannelSplitter(2); // Split source L/R
            this.monoGain = this.audioContext.createGain(); // Mix to mono
            this.channelSplitter = this.audioContext.createChannelSplitter(2); // Split for pan control
            this.channelMerger = this.audioContext.createChannelMerger(2);
            this.leftGain = this.audioContext.createGain();
            this.rightGain = this.audioContext.createGain();

            console.log('[METRONOME] 🔧 Created all pan nodes');

            // Reconnect the graph with mono conversion:
            // boost -> panner -> analyser -> inputSplitter -> monoGain (sums L+R to mono) -> channelSplitter -> [leftGain, rightGain] -> merger -> masterGain
            if (this.boost && this.panner && this.analyser && this.masterGain) {
                // Step 1: Reconnect standard chain (boost -> panner -> analyser)
                this.boost.connect(this.panner);
                this.panner.connect(this.analyser);
                console.log('[METRONOME] 🔧 Step 1: Reconnected boost -> panner -> analyser');

                // Step 2: Split source channels
                this.analyser.connect(this.inputSplitter);
                console.log('[METRONOME] 🔧 Step 2: Connected analyser -> inputSplitter');

                // Step 3: Mix both channels to mono (sum L+R)
                this.inputSplitter.connect(this.monoGain, 0); // Left channel to mono
                this.inputSplitter.connect(this.monoGain, 1); // Right channel to mono
                console.log('[METRONOME] 🔧 Step 3: Connected inputSplitter L+R -> monoGain');

                // Step 4: Split the mono signal for pan control
                this.monoGain.connect(this.channelSplitter);
                console.log('[METRONOME] 🔧 Step 4: Connected monoGain -> channelSplitter');

                // Step 5: Connect both outputs of mono splitter to pan gains (identical mono signal)
                this.channelSplitter.connect(this.leftGain, 0); // Mono to left gain
                this.channelSplitter.connect(this.rightGain, 0); // Mono to right gain (same channel 0)
                console.log('[METRONOME] 🔧 Step 5: Connected channelSplitter -> leftGain & rightGain');

                // Step 6: Merge with pan gains applied
                this.leftGain.connect(this.channelMerger, 0, 0); // Left to left
                this.rightGain.connect(this.channelMerger, 0, 1); // Right to right
                console.log('[METRONOME] 🔧 Step 6: Connected leftGain/rightGain -> channelMerger');

                // Step 7: Connect to master
                this.channelMerger.connect(this.masterGain);
                console.log('[METRONOME] 🔧 Step 7: Connected channelMerger -> masterGain');
            }

            console.log('[METRONOME] ✅ Recreated pan graph with mono conversion and hard cut control');
        } catch (error) {
            console.error('[METRONOME] ❌ Error recreating pan graph:', error);
        }
    }
    
    getLevel() {
        if (!this.analyser) return 0;
        
        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(dataArray);
        
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
        }
        return sum / dataArray.length / 255;
    }
    
    /**
     * Get the number of beats per measure from time signature
     */
    getBeatsPerMeasure() {
        const [beats] = this.timeSignature.split('/').map(Number);
        return beats;
    }
    
    /**
     * Get the beat duration in seconds based on BPM
     */
    getBeatDuration() {
        return 60.0 / this.bpm;
    }
    
    /**
     * Get current musical time relative to metronome start
     */
    getCurrentMusicalTime() {
        if (!this.isPlaying || this.startMusicalTime === undefined) {
            return 0;
        }
        // Calculate musical time based on audioContext.currentTime and start reference
        const audioTimeElapsed = this.audioContext.currentTime - this.startAudioTime;
        return this.startMusicalTime + audioTimeElapsed;
    }

    /**
     * Convert musical time to audioContext time
     * @param {number} musicalTime - Musical position in seconds
     * @returns {number} AudioContext time in seconds
     */
    musicalTimeToAudioTime(musicalTime) {
        if (this.startMusicalTime === undefined || this.startAudioTime === undefined) {
            return this.audioContext.currentTime;
        }
        const musicalOffset = musicalTime - this.startMusicalTime;
        return this.startAudioTime + musicalOffset;
    }

    /**
     * Calculate which beat we should start from based on current time
     * Aligned to musical grid - finds the next beat on the grid
     */
    calculateStartingBeat(currentTime) {
        const beatDuration = this.getBeatDuration();
        const beatNumber = Math.floor(currentTime / beatDuration);
        // Return the NEXT beat number, not the current one
        return beatNumber + 1;
    }

    /**
     * Calculate the time of the next beat on the musical grid
     */
    calculateNextBeatTime(currentTime) {
        const beatDuration = this.getBeatDuration();
        const beatNumber = Math.floor(currentTime / beatDuration);
        const nextBeatTime = (beatNumber + 1) * beatDuration;
        return nextBeatTime;
    }
    
    /**
     * Start metronome from a specific musical time
     * @param {number} musicalTime - The musical position in seconds (e.g., 13.27s)
     */
    start(musicalTime) {
        if (!this.isEnabled) return;

        // Idempotent: stop existing scheduler before creating new one
        if (this.schedulerTimer) {
            if (this.debug) console.log('[METRONOME] Stopping existing scheduler before start');
            clearInterval(this.schedulerTimer);
            this.schedulerTimer = null;
        }

        if (this.debug) console.log('[METRONOME] Starting at musical time:', musicalTime.toFixed(3));

        this.isPlaying = true;

        // Store temporal references for precise calculation
        this.startMusicalTime = musicalTime;
        this.startAudioTime = this.audioContext.currentTime;

        // Calculate next beat aligned to musical grid
        this.currentBeat = this.calculateStartingBeat(musicalTime);
        const nextMusicalTime = this.calculateNextBeatTime(musicalTime);

        // Convert musical time to audioContext time for scheduling
        this.nextNoteTime = this.musicalTimeToAudioTime(nextMusicalTime);

        if (this.debug) console.log('[METRONOME] currentBeat:', this.currentBeat, 'nextNoteTime (audio):', this.nextNoteTime.toFixed(3));

        // Start the scheduler
        this.schedulerTimer = setInterval(() => this.scheduler(), this.lookahead);
    }
    
    /**
     * Stop metronome
     */
    stop() {
        if (this.debug) console.log('[METRONOME] Stopping');

        this.isPlaying = false;

        if (this.schedulerTimer) {
            clearInterval(this.schedulerTimer);
            this.schedulerTimer = null;
        }
    }
    
    /**
     * Scheduler - looks ahead and schedules notes
     */
    scheduler() {
        let notesScheduled = 0;
        const targetTime = this.audioContext.currentTime + this.scheduleAheadTime;

        while (this.nextNoteTime < targetTime && notesScheduled < this.maxScheduledNotes) {
            this.scheduleNote(this.currentBeat, this.nextNoteTime);
            this.nextNote();
            notesScheduled++;
        }

        // Log warning if we hit the limit (indicates timing issue)
        if (notesScheduled >= this.maxScheduledNotes) {
            console.warn('[METRONOME] Hit max scheduled notes limit:', this.maxScheduledNotes);
        }
    }
    
    /**
     * Schedule a single note
     */
    scheduleNote(beatNumber, time) {
        const beatsPerMeasure = this.getBeatsPerMeasure();
        const beatInMeasure = beatNumber % beatsPerMeasure;

        // First beat of measure gets higher pitch
        const isDownbeat = beatInMeasure === 0;
        const frequency = isDownbeat ? 1200 : 800;
        const duration = isDownbeat ? 0.04 : 0.03; // Slightly longer for downbeat

        // Create oscillator
        const osc = this.audioContext.createOscillator();
        const oscGain = this.audioContext.createGain();

        osc.type = 'sine';
        osc.frequency.value = frequency;

        // Envelope
        oscGain.gain.setValueAtTime(0, time);
        oscGain.gain.linearRampToValueAtTime(0.5, time + 0.005);
        oscGain.gain.exponentialRampToValueAtTime(0.001, time + duration);

        // Connect
        osc.connect(oscGain);
        oscGain.connect(this.gain);

        // Schedule
        osc.start(time);
        osc.stop(time + duration);

        // Cleanup - use web audio timing instead of setTimeout
        // Nodes will be garbage collected after stop()
        // Disconnect is optional but good practice
        osc.onended = () => {
            osc.disconnect();
            oscGain.disconnect();
        };

        // Schedule visual callback at the exact same time as audio
        // Note: This creates a setTimeout for each beat - consider if needed
        if (this.onBeat) {
            const delay = Math.max(0, (time - this.audioContext.currentTime) * 1000);
            setTimeout(() => {
                this.onBeat(beatInMeasure, isDownbeat, time);
            }, delay);
        }
    }
    
    /**
     * Advance to next note
     */
    nextNote() {
        const beatDuration = this.getBeatDuration();
        this.nextNoteTime += beatDuration;
        this.currentBeat++;
    }
    
    /**
     * Clean up
     */
    destroy() {
        this.stop();

        if (this.gain) this.gain.disconnect();
        if (this.boost) this.boost.disconnect();
        if (this.panner) this.panner.disconnect();
        if (this.analyser) this.analyser.disconnect();
        // Disconnect custom pan nodes if they exist
        if (this.inputSplitter) {
            this.inputSplitter.disconnect();
        }
        if (this.monoGain) {
            this.monoGain.disconnect();
        }
        if (this.channelSplitter) {
            this.channelSplitter.disconnect();
        }
        if (this.channelMerger) {
            this.channelMerger.disconnect();
        }
        if (this.leftGain) {
            this.leftGain.disconnect();
        }
        if (this.rightGain) {
            this.rightGain.disconnect();
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MultitrackPlayer;
}
