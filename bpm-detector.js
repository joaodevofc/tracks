/**
 * BPM Detector Module
 * Automatic BPM detection using Essentia.js
 * Analyzes only one track (click or drums) for fast detection
 */

// Essentia.js lazy loading
let essentiaLoaded = false;
let essentiaInstance = null;

/**
 * Normalize string for comparison (case-insensitive, accent-insensitive)
 */
function normalizeString(str) {
    return str.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, ''); // Remove accents
}

/**
 * Find the best track for BPM detection
 * Priority: click/metronome tracks first, then drums/percussion
 * Returns only ONE track or null
 */
function findBpmTrack(tracks) {
    if (!tracks || tracks.length === 0) {
        return null;
    }

    // Group 1: click/metronome tracks
    const clickKeywords = ['click', 'clic', 'metronomo', 'guide click', 'cue'];
    
    // Group 2: drums/percussion tracks
    const drumKeywords = ['bateria', 'drums', 'drum', 'percussao', 'percussión'];

    // Search for Group 1 tracks
    for (const track of tracks) {
        const normalizedName = normalizeString(track.name);
        if (clickKeywords.some(keyword => normalizedName.includes(keyword))) {
            console.log('[BPM DETECTOR] Found click track:', track.name);
            return track;
        }
    }

    // Search for Group 2 tracks (only if no Group 1 found)
    for (const track of tracks) {
        const normalizedName = normalizeString(track.name);
        if (drumKeywords.some(keyword => normalizedName.includes(keyword))) {
            console.log('[BPM DETECTOR] Found drum track:', track.name);
            return track;
        }
    }

    console.log('[BPM DETECTOR] No suitable track found');
    return null;
}

/**
 * Load Essentia.js and WASM lazily
 * Loads only when needed, not on page load
 */
async function loadEssentia() {
    if (essentiaLoaded && essentiaInstance) {
        return essentiaInstance;
    }

    try {
        console.log('[BPM DETECTOR] Loading Essentia.js...');

        // Check if Essentia is already loaded globally
        if (typeof Essentia !== 'undefined') {
            essentiaInstance = new Essentia.EssentiaJS(
                Essentia.EssentiaJSModule,
                'https://cdn.jsdelivr.net/npm/essentia.js@0.1.3/dist/essentia-wasm-mini.js'
            );
            await essentiaInstance.init();
            essentiaLoaded = true;
            console.log('[BPM DETECTOR] Essentia.js loaded successfully (from global)');
            return essentiaInstance;
        }

        // Load Essentia.js library (version 0.1.3)
        const essentiaScript = document.createElement('script');
        essentiaScript.src = 'https://cdn.jsdelivr.net/npm/essentia.js@0.1.3/dist/essentia.js-mini.js';
        essentiaScript.type = 'text/javascript';
        
        await new Promise((resolve, reject) => {
            essentiaScript.onload = resolve;
            essentiaScript.onerror = reject;
            document.head.appendChild(essentiaScript);
        });

        // Create Essentia instance
        if (typeof Essentia === 'undefined') {
            throw new Error('Essentia library not loaded');
        }

        essentiaInstance = new Essentia.EssentiaJS(
            Essentia.EssentiaJSModule,
            'https://cdn.jsdelivr.net/npm/essentia.js@0.1.3/dist/essentia-wasm-mini.js'
        );

        await essentiaInstance.init();
        essentiaLoaded = true;
        console.log('[BPM DETECTOR] Essentia.js loaded successfully');

        return essentiaInstance;
    } catch (error) {
        console.error('[BPM DETECTOR] Failed to load Essentia.js:', error);
        return null;
    }
}

/**
 * Detect BPM from audio buffer
 * Uses only first 30-45 seconds, converts to mono, resamples to 44100Hz
 * Tries Web Worker first, falls back to main thread with pauses
 */
async function detectBpm(audioBuffer) {
    if (!audioBuffer) {
        return null;
    }

    // Extract first 30-45 seconds
    const sampleRate = audioBuffer.sampleRate;
    const duration = Math.min(45, audioBuffer.duration); // Max 45 seconds
    const startSample = 0;
    const endSample = Math.floor(sampleRate * duration);
    const channelData = audioBuffer.getChannelData(0);
    const segmentData = channelData.slice(startSample, endSample);

    // Convert to mono (average channels if stereo)
    let monoData;
    if (audioBuffer.numberOfChannels > 1) {
        const channelData2 = audioBuffer.getChannelData(1);
        monoData = new Float32Array(segmentData.length);
        for (let i = 0; i < segmentData.length; i++) {
            monoData[i] = (segmentData[i] + channelData2[i]) / 2;
        }
    } else {
        monoData = segmentData;
    }

    // Resample to 44100Hz using OfflineAudioContext
    const targetSampleRate = 44100;
    const offlineContext = new OfflineAudioContext(
        1,
        monoData.length * (targetSampleRate / sampleRate),
        targetSampleRate
    );

    const source = offlineContext.createBufferSource();
    const buffer = offlineContext.createBuffer(1, monoData.length, sampleRate);
    buffer.getChannelData(0).set(monoData);
    source.buffer = buffer;
    source.connect(offlineContext.destination);
    source.start();

    const resampledBuffer = await offlineContext.startRendering();

    // Try Web Worker first
    try {
        const result = await detectBpmInWorker(resampledBuffer);
        if (result) {
            return result;
        }
    } catch (error) {
        console.warn('[BPM DETECTOR] Web Worker failed, falling back to main thread:', error);
    }

    // Fallback to main thread with pauses
    return await detectBpmMainThread(resampledBuffer);
}

/**
 * Try Web Worker for BPM detection
 */
function detectBpmInWorker(audioBuffer) {
    return new Promise((resolve, reject) => {
        const workerCode = `
            // Import Essentia
            importScripts('https://cdn.jsdelivr.net/npm/essentia.js@0.1.3/dist/essentia.js-mini.js');
            
            self.onmessage = async function(e) {
                const audioBuffer = e.data;
                
                try {
                    // Wait for Essentia to be available
                    if (typeof Essentia === 'undefined') {
                        self.postMessage({ error: 'Essentia not loaded' });
                        return;
                    }
                    
                    const essentia = new Essentia.EssentiaJS(
                        Essentia.EssentiaJSModule,
                        'https://cdn.jsdelivr.net/npm/essentia.js@0.1.3/dist/essentia-wasm-mini.js'
                    );
                    
                    await essentia.init();
                    
                    // Extract audio data
                    const channelData = audioBuffer.getChannelData(0);
                    
                    // RhythmExtractor2013 algorithm
                    const features = essentia.RhythmExtractor2013(
                        channelData,
                        audioBuffer.sampleRate,
                        {
                            method: 'multifeature',
                            minTempo: 60,
                            maxTempo: 200
                        }
                    );
                    
                    const bpm = Math.round(features.bpm);
                    const confidence = features.confidence;
                    
                    self.postMessage({ bpm, confidence });
                } catch (error) {
                    self.postMessage({ error: error.message });
                }
            };
        `;

        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(blob);
        const worker = new Worker(workerUrl);

        worker.onmessage = (e) => {
            const { bpm, confidence, error } = e.data;
            worker.terminate();
            URL.revokeObjectURL(workerUrl);

            if (error) {
                reject(new Error(error));
                return;
            }

            // Check confidence threshold
            if (confidence < 0.5) {
                console.log('[BPM DETECTOR] Low confidence:', confidence, ', returning null');
                resolve(null);
            } else {
                console.log('[BPM DETECTOR] BPM detected (worker):', bpm, 'confidence:', confidence);
                resolve({ bpm, confidence });
            }
        };

        worker.onerror = (error) => {
            console.error('[BPM DETECTOR] Worker error:', error);
            worker.terminate();
            URL.revokeObjectURL(workerUrl);
            reject(error);
        };

        worker.postMessage(audioBuffer);
    });
}

/**
 * Main thread BPM detection with pauses to avoid blocking UI
 */
async function detectBpmMainThread(audioBuffer) {
    const essentia = await loadEssentia();
    if (!essentia) {
        return null;
    }

    try {
        const channelData = audioBuffer.getChannelData(0);
        
        // Pause before heavy computation to let UI update
        await new Promise(resolve => setTimeout(resolve, 10));
        
        const features = essentia.RhythmExtractor2013(
            channelData,
            audioBuffer.sampleRate,
            {
                method: 'multifeature',
                minTempo: 60,
                maxTempo: 200
            }
        );

        const bpm = Math.round(features.bpm);
        const confidence = features.confidence;

        // Check confidence threshold
        if (confidence < 0.5) {
            console.log('[BPM DETECTOR] Low confidence:', confidence, ', returning null');
            return null;
        } else {
            console.log('[BPM DETECTOR] BPM detected (main thread):', bpm, 'confidence:', confidence);
            return { bpm, confidence };
        }
    } catch (error) {
        console.error('[BPM DETECTOR] Error during detection:', error);
        return null;
    }
}

/**
 * Auto-detect BPM from project
 * Chooses track, detects BPM, returns result
 */
async function autoDetectBpm(project) {
    if (!project || !project.tracks || project.tracks.length === 0) {
        return null;
    }

    console.log('[BPM DETECTOR] Starting auto-detection for project:', project.name);

    // Find suitable track
    const track = findBpmTrack(project.tracks);
    if (!track) {
        console.log('[BPM DETECTOR] No suitable track found');
        return null;
    }

    // Check if track has file
    if (!track.file) {
        console.log('[BPM DETECTOR] Track has no file:', track.name);
        return null;
    }

    try {
        // Decode audio buffer from track file
        const arrayBuffer = await track.file.arrayBuffer();
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        // Detect BPM
        const result = await detectBpm(audioBuffer);

        if (result) {
            return {
                bpm: result.bpm,
                confidence: result.confidence,
                trackName: track.name
            };
        }

        return null;
    } catch (error) {
        console.error('[BPM DETECTOR] Error during detection:', error);
        return null;
    }
}

// Export for use in app.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { autoDetectBpm };
}
