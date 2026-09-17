/**
 * Developer Diagnostics Panel for W.Tracks PWA
 * Real-time technical diagnostics when Developer Mode is enabled
 */

// Diagnostics intervals (accessible for cleanup)
let diagnosticsInterval = null;
let timeUpdateInterval = null;
let healthCheckInterval = null;

// Diagnostics state
const DIAGNOSTICS_STATE = {
    fps: 0,
    frameTime: 0,
    jsHeap: null,
    heapLimit: null,
    memoryUsage: null,
    audioContextState: 'N/A',
    audioSampleRate: 'N/A',
    audioNodes: 'N/A',
    playerState: 'N/A',
    playerTracks: 'N/A',
    playerCurrentTime: 'N/A',
    networkStatus: 'Unknown',
    serviceWorkerStatus: 'N/A',
    cacheStatus: 'N/A',
    indexedDBStatus: 'N/A',
    localStorageStatus: 'N/A',
    storageUsed: 'N/A',
    storageQuota: 'N/A',
    firebaseAuthStatus: 'Unknown',
    firebaseConnectionStatus: 'Unknown',
    firebaseLatency: null,
    r2ConnectionStatus: 'Unknown',
    r2Latency: null,
    performanceStatus: 'Unknown',
    platform: 'Unknown',
    viewport: '0 × 0',
    timezone: 'N/A',
    currentDate: 'N/A',
    currentTime: 'N/A',
    pwaStatus: 'Unknown',
    version: 'N/A',
    isExpanded: true
};

// FPS calculation
let frameCount = 0;
let lastFpsUpdate = performance.now();
let lastFrameTime = performance.now();
let frameTimes = [];

/**
 * Initialize diagnostics system
 */
function initializeDiagnostics() {
    console.log('[DIAGNOSTICS] Initializing...');
    
    // Start FPS monitoring
    startFpsMonitoring();
    
    // Start time updates
    startTimeUpdates();
    
    // Start low-frequency updates
    startLowFrequencyUpdates();
    
    // Set up event listeners
    setupEventListeners();
    
    // Initial data collection
    collectDiagnosticsData();
    
    // Check Firebase connection
    checkFirebaseConnection();
    
    // Check R2 connection
    checkR2Connection();
}

/**
 * Start FPS monitoring
 */
function startFpsMonitoring() {
    function updateFps() {
        const now = performance.now();
        frameCount++;
        
        // Calculate frame time
        const deltaTime = now - lastFrameTime;
        lastFrameTime = now;
        frameTimes.push(deltaTime);
        
        // Keep only last 60 frame times for average
        if (frameTimes.length > 60) {
            frameTimes.shift();
        }
        
        // Update FPS display every 500ms
        if (now - lastFpsUpdate >= 500) {
            DIAGNOSTICS_STATE.fps = Math.round((frameCount * 1000) / (now - lastFpsUpdate));
            
            // Calculate average frame time
            const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
            DIAGNOSTICS_STATE.frameTime = avgFrameTime.toFixed(1);
            
            // Update performance status
            updatePerformanceStatus();
            
            // Update UI if panel is visible
            if (DIAGNOSTICS_STATE.isExpanded) {
                updateDiagnosticsUI();
            } else {
                updateCollapsedUI();
            }
            
            frameCount = 0;
            lastFpsUpdate = now;
        }
        
        requestAnimationFrame(updateFps);
    }
    
    requestAnimationFrame(updateFps);
}

/**
 * Update performance status based on FPS
 */
function updatePerformanceStatus() {
    const fps = DIAGNOSTICS_STATE.fps;
    
    if (fps >= 55) {
        DIAGNOSTICS_STATE.performanceStatus = 'Good';
    } else if (fps >= 30) {
        DIAGNOSTICS_STATE.performanceStatus = 'Warning';
    } else {
        DIAGNOSTICS_STATE.performanceStatus = 'Critical';
    }
}

/**
 * Start low-frequency updates (every 2 seconds)
 */
function startLowFrequencyUpdates() {
    diagnosticsInterval = setInterval(() => {
        collectDiagnosticsData();
        
        if (DIAGNOSTICS_STATE.isExpanded) {
            updateDiagnosticsUI();
        }
    }, 2000);
    
    // Firebase and R2 health check every 15 seconds (lightweight)
    healthCheckInterval = setInterval(() => {
        checkFirebaseConnection();
        checkR2Connection();
    }, 15000);
}

/**
 * Start time updates (every second)
 */
function startTimeUpdates() {
    updateTime();
    setInterval(updateTime, 1000);
}

/**
 * Update current date and time
 */
function updateTime() {
    const now = new Date();
    
    // Format date: DD/MM/YYYY
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    DIAGNOSTICS_STATE.currentDate = `${day}/${month}/${year}`;
    
    // Format time: HH:mm:ss
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    DIAGNOSTICS_STATE.currentTime = `${hours}:${minutes}:${seconds}`;
    
    // Get timezone
    try {
        DIAGNOSTICS_STATE.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (e) {
        DIAGNOSTICS_STATE.timezone = 'N/A';
    }
    
    if (DIAGNOSTICS_STATE.isExpanded) {
        updateDateTimeUI();
    } else {
        updateCollapsedTimeUI();
    }
}

/**
 * Check Firebase connection status with latency
 */
async function checkFirebaseConnection() {
    if (!window.firebaseAuth || !window.firebaseDB) {
        DIAGNOSTICS_STATE.firebaseConnectionStatus = 'Initializing';
        DIAGNOSTICS_STATE.firebaseLatency = null;
        return;
    }
    
    // Check if user is authenticated
    const auth = window.firebaseAuth.auth;
    const user = auth.currentUser;
    
    if (!user) {
        DIAGNOSTICS_STATE.firebaseConnectionStatus = 'Disconnected';
        DIAGNOSTICS_STATE.firebaseLatency = null;
        return;
    }
    
    // Try a lightweight Firestore read to verify connectivity and measure latency
    if (window.firebaseDB.db) {
        try {
            const startTime = performance.now();
            
            // Lightweight health check: read a small document
            const { db, doc, getDoc } = window.firebaseDB;
            const configDocRef = doc(db, 'global_config', 'checkout');
            await getDoc(configDocRef);
            
            const endTime = performance.now();
            const latency = Math.round(endTime - startTime);
            
            DIAGNOSTICS_STATE.firebaseConnectionStatus = 'Connected';
            DIAGNOSTICS_STATE.firebaseLatency = latency;
        } catch (error) {
            console.log('[DIAGNOSTICS] Firebase health check failed:', error.message);
            DIAGNOSTICS_STATE.firebaseConnectionStatus = 'Disconnected';
            DIAGNOSTICS_STATE.firebaseLatency = null;
        }
    } else {
        DIAGNOSTICS_STATE.firebaseConnectionStatus = 'Disconnected';
        DIAGNOSTICS_STATE.firebaseLatency = null;
    }
    
    if (DIAGNOSTICS_STATE.isExpanded) {
        updateConnectivityUI();
    }
}

/**
 * Check R2 connection status via Worker health check with latency
 */
async function checkR2Connection() {
    if (!window.r2Storage) {
        DIAGNOSTICS_STATE.r2ConnectionStatus = 'N/A';
        DIAGNOSTICS_STATE.r2Latency = null;
        return;
    }
    
    try {
        const workerUrl = window.r2Storage.workerUrl;
        const healthCheckUrl = `${workerUrl}/health`;
        
        // Lightweight health check with timeout and latency measurement
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        const startTime = performance.now();
        
        const response = await fetch(healthCheckUrl, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        const endTime = performance.now();
        const latency = Math.round(endTime - startTime);
        
        if (response.ok) {
            DIAGNOSTICS_STATE.r2ConnectionStatus = 'Connected';
            DIAGNOSTICS_STATE.r2Latency = latency;
        } else {
            DIAGNOSTICS_STATE.r2ConnectionStatus = 'Disconnected';
            DIAGNOSTICS_STATE.r2Latency = null;
        }
    } catch (error) {
        console.log('[DIAGNOSTICS] R2 health check failed:', error.message);
        DIAGNOSTICS_STATE.r2ConnectionStatus = 'Disconnected';
        DIAGNOSTICS_STATE.r2Latency = null;
    }
    
    if (DIAGNOSTICS_STATE.isExpanded) {
        updateConnectivityUI();
    }
}

/**
 * Collect diagnostics data
 */
function collectDiagnosticsData() {
    // Memory information
    if (performance.memory) {
        DIAGNOSTICS_STATE.jsHeap = formatBytes(performance.memory.usedJSHeapSize);
        DIAGNOSTICS_STATE.heapLimit = formatBytes(performance.memory.jsHeapSizeLimit);
        
        if (performance.memory.jsHeapSizeLimit > 0) {
            const usage = (performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100;
            DIAGNOSTICS_STATE.memoryUsage = usage.toFixed(1) + '%';
        }
    }
    
    // Audio Context
    if (window.audioContext) {
        DIAGNOSTICS_STATE.audioContextState = window.audioContext.state;
        DIAGNOSTICS_STATE.audioSampleRate = window.audioContext.sampleRate + ' Hz';
    }
    
    // Audio Nodes and Player State (from existing player)
    if (window.multitrackPlayer && window.multitrackPlayer.audioContext) {
        try {
            DIAGNOSTICS_STATE.audioContextState = window.multitrackPlayer.audioContext.state;
            DIAGNOSTICS_STATE.audioSampleRate = window.multitrackPlayer.audioContext.sampleRate + ' Hz';
            
            // Audio nodes count
            DIAGNOSTICS_STATE.audioNodes = window.multitrackPlayer.trackNodes ? 
                window.multitrackPlayer.trackNodes.size : 'N/A';
            
            // Player state
            DIAGNOSTICS_STATE.playerState = window.multitrackPlayer.isPlaying ? 'Playing' : 
                window.multitrackPlayer.isLoading ? 'Loading' : 'Stopped';
            
            // Tracks count
            DIAGNOSTICS_STATE.playerTracks = window.multitrackPlayer.currentProject?.tracks?.length || 'N/A';
            
            // Current time
            if (window.multitrackPlayer.currentTime !== undefined) {
                const minutes = Math.floor(window.multitrackPlayer.currentTime / 60);
                const seconds = Math.floor(window.multitrackPlayer.currentTime % 60);
                DIAGNOSTICS_STATE.playerCurrentTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            }
        } catch (e) {
            DIAGNOSTICS_STATE.audioContextState = 'Error';
        }
    }
    
    // Network status
    DIAGNOSTICS_STATE.networkStatus = navigator.onLine ? 'Online' : 'Offline';
    
    // Service Worker status
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        DIAGNOSTICS_STATE.serviceWorkerStatus = 'Active';
    } else if (navigator.serviceWorker) {
        DIAGNOSTICS_STATE.serviceWorkerStatus = 'Waiting';
    } else {
        DIAGNOSTICS_STATE.serviceWorkerStatus = 'N/A';
    }
    
    // Cache status
    if ('caches' in window) {
        DIAGNOSTICS_STATE.cacheStatus = 'Available';
    } else {
        DIAGNOSTICS_STATE.cacheStatus = 'N/A';
    }
    
    // IndexedDB status
    try {
        if (window.indexedDB) {
            DIAGNOSTICS_STATE.indexedDBStatus = 'Available';
        } else {
            DIAGNOSTICS_STATE.indexedDBStatus = 'N/A';
        }
    } catch (e) {
        DIAGNOSTICS_STATE.indexedDBStatus = 'Error';
    }
    
    // LocalStorage status
    try {
        localStorage.setItem('test', 'test');
        localStorage.removeItem('test');
        DIAGNOSTICS_STATE.localStorageStatus = 'Available';
    } catch (e) {
        DIAGNOSTICS_STATE.localStorageStatus = 'N/A';
    }
    
    // Storage usage estimate
    if (navigator.storage && navigator.storage.estimate) {
        navigator.storage.estimate().then(estimate => {
            DIAGNOSTICS_STATE.storageUsed = formatBytes(estimate.usage);
            DIAGNOSTICS_STATE.storageQuota = formatBytes(estimate.quota);
            updateStorageUI();
        }).catch(() => {
            DIAGNOSTICS_STATE.storageUsed = 'N/A';
            DIAGNOSTICS_STATE.storageQuota = 'N/A';
            updateStorageUI();
        });
    } else {
        DIAGNOSTICS_STATE.storageUsed = 'N/A';
        DIAGNOSTICS_STATE.storageQuota = 'N/A';
    }
    
    // Firebase Auth status
    if (window.firebaseAuth && window.firebaseAuth.auth) {
        const user = window.firebaseAuth.auth.currentUser;
        DIAGNOSTICS_STATE.firebaseAuthStatus = user ? 'Connected' : 'Signed out';
    } else {
        DIAGNOSTICS_STATE.firebaseAuthStatus = 'Initializing';
    }
    
    // Platform
    DIAGNOSTICS_STATE.platform = detectPlatform();
    
    // Viewport
    DIAGNOSTICS_STATE.viewport = `${window.innerWidth} × ${window.innerHeight}`;
    
    // PWA status
    DIAGNOSTICS_STATE.pwaStatus = detectPWAStatus();
    
    // Version (if available)
    if (window.WTRACKS_VERSION) {
        DIAGNOSTICS_STATE.version = window.WTRACKS_VERSION;
    }
}

/**
 * Format bytes to human readable format
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Detect platform
 */
function detectPlatform() {
    const platform = navigator.platform || navigator.userAgentData?.platform || 'Unknown';
    
    if (platform.includes('Win')) return 'Windows';
    if (platform.includes('Mac')) return 'macOS';
    if (platform.includes('Linux')) return 'Linux';
    if (platform.includes('Android')) return 'Android';
    if (platform.includes('iPhone') || platform.includes('iPad') || platform.includes('iOS')) return 'iOS';
    
    return platform;
}

/**
 * Detect PWA status
 */
function detectPWAStatus() {
    if (window.matchMedia('(display-mode: standalone)').matches) {
        return 'Standalone';
    }
    if (window.matchMedia('(display-mode: fullscreen)').matches) {
        return 'Fullscreen';
    }
    if (window.navigator.standalone === true) {
        return 'Standalone (iOS)';
    }
    return 'Browser';
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
    // Network status changes
    window.addEventListener('online', () => {
        DIAGNOSTICS_STATE.networkStatus = 'Online';
        if (DIAGNOSTICS_STATE.isExpanded) updateDiagnosticsUI();
    });
    
    window.addEventListener('offline', () => {
        DIAGNOSTICS_STATE.networkStatus = 'Offline';
        if (DIAGNOSTICS_STATE.isExpanded) updateDiagnosticsUI();
    });
    
    // Viewport resize
    window.addEventListener('resize', () => {
        DIAGNOSTICS_STATE.viewport = `${window.innerWidth} × ${window.innerHeight}`;
        if (DIAGNOSTICS_STATE.isExpanded) updateDiagnosticsUI();
    });
}

/**
 * Create diagnostics panel
 */
function createDiagnosticsPanel() {
    // Remove existing panel if any
    const existingPanel = document.getElementById('devToolsPanel');
    if (existingPanel) {
        existingPanel.remove();
    }

    // Create panel
    const panel = document.createElement('div');
    panel.id = 'devToolsPanel';
    panel.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: rgba(0, 0, 0, 0.95);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        padding: 0;
        z-index: 99999;
        font-family: 'IBM Plex Mono', monospace;
        font-size: 11px;
        color: #fff;
        backdrop-filter: blur(10px);
        min-width: 200px;
        max-width: 280px;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    `;

    panel.innerHTML = `
        <div id="devPanelHeader" style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            cursor: pointer;
        ">
            <div style="font-weight: 600; color: #8b5cf6;">
                W.TRACKS DEV
            </div>
            <div id="devPanelToggle" style="color: #888; font-size: 14px;">−</div>
        </div>
        
        <div id="devPanelContent" style="padding: 12px 16px;">
            <!-- Control Section -->
            <div style="margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
                <div style="font-size: 10px; color: #888; margin-bottom: 8px;">
                    DevTools: <span id="devToolsStatus" style="color: #4ade80;">Disponíveis</span>
                </div>
                <button id="toggleDevModeBtn" style="
                    width: 100%;
                    padding: 8px 12px;
                    background: #f87171;
                    color: #fff;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 11px;
                    font-weight: 500;
                    transition: all 0.2s;
                ">
                    Desativar Modo
                </button>
            </div>
            
            <!-- Diagnostics Section -->
            <div id="diagnosticsSection">
                <div style="font-size: 10px; color: #8b5cf6; margin-bottom: 8px; font-weight: 600;">
                    DIAGNÓSTICO
                </div>
                
                <!-- Performance -->
                <div style="margin-bottom: 12px;">
                    <div style="font-size: 10px; color: #8b5cf6; margin-bottom: 8px; font-weight: 600;">
                        PERFORMANCE
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span style="color: #888;">FPS</span>
                        <span id="diagFps" style="color: #4ade80;">60</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span style="color: #888;">Frame Time</span>
                        <span id="diagFrameTime">16.4 ms</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span style="color: #888;">JS Heap</span>
                        <span id="diagJsHeap">84 MB</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #888;">Heap Limit</span>
                        <span id="diagHeapLimit">2 GB</span>
                    </div>
                </div>
                
                <!-- Audio -->
                <div style="margin-bottom: 12px;">
                    <div style="font-size: 10px; color: #8b5cf6; margin-bottom: 8px; font-weight: 600;">
                        AUDIO
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span style="color: #888;">Audio Context</span>
                        <span id="diagAudioContext">Running</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span style="color: #888;">Audio Nodes</span>
                        <span id="diagAudioNodes">N/A</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span style="color: #888;">Sample Rate</span>
                        <span id="diagSampleRate">N/A</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span style="color: #888;">Player State</span>
                        <span id="diagPlayerState">N/A</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span style="color: #888;">Tracks</span>
                        <span id="diagTracks">N/A</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #888;">Current Time</span>
                        <span id="diagCurrentTime">N/A</span>
                    </div>
                </div>
                
                <!-- Network -->
                <div style="margin-bottom: 12px;">
                    <div style="font-size: 10px; color: #8b5cf6; margin-bottom: 8px; font-weight: 600;">
                        CONECTIVIDADE
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span style="color: #888;">Network</span>
                        <span id="diagNetwork" style="color: #4ade80;">Online</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span style="color: #888;">Firebase</span>
                        <span id="diagFirebaseConnection">● Connected  82 ms</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #888;">R2 Storage</span>
                        <span id="diagR2Connection">● Connected 146 ms</span>
                    </div>
                </div>
                
                <!-- PWA -->
                <div style="margin-bottom: 12px;">
                    <div style="font-size: 10px; color: #8b5cf6; margin-bottom: 8px; font-weight: 600;">
                        PWA
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span style="color: #888;">Service Worker</span>
                        <span id="diagServiceWorker">Active</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #888;">Cache</span>
                        <span id="diagCache">Available</span>
                    </div>
                </div>
                
                <!-- Storage -->
                <div style="margin-bottom: 12px;">
                    <div style="font-size: 10px; color: #8b5cf6; margin-bottom: 8px; font-weight: 600;">
                        STORAGE
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span style="color: #888;">IndexedDB</span>
                        <span id="diagIndexedDB">Available</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span style="color: #888;">LocalStorage</span>
                        <span id="diagLocalStorage">Available</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #888;">Storage Used</span>
                        <span id="diagStorageUsed">N/A</span>
                    </div>
                </div>
                
                <!-- System -->
                <div style="margin-bottom: 12px;">
                    <div style="font-size: 10px; color: #8b5cf6; margin-bottom: 8px; font-weight: 600;">
                        SYSTEM
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span style="color: #888;">PWA</span>
                        <span id="diagPWA">Standalone</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span style="color: #888;">Viewport</span>
                        <span id="diagViewport">1920 × 1080</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #888;">Timezone</span>
                        <span id="diagTimezone">America/Sao_Paulo</span>
                    </div>
                </div>
                
                <!-- Date/Time -->
                <div style="margin-bottom: 12px;">
                    <div style="font-size: 10px; color: #8b5cf6; margin-bottom: 8px; font-weight: 600;">
                        DATA / HORA
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span style="color: #888;">Date</span>
                        <span id="diagDate">17/09/2026</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #888;">Time</span>
                        <span id="diagTime">16:42:18</span>
                    </div>
                </div>
                
                <!-- Version -->
                <div style="margin-bottom: 8px;">
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #888;">W.Tracks</span>
                        <span id="diagVersion">N/A</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(panel);

    // Header click to collapse/expand
    const header = document.getElementById('devPanelHeader');
    header.addEventListener('click', () => {
        togglePanelExpansion();
    });

    // Toggle button click handler
    const toggleBtn = document.getElementById('toggleDevModeBtn');
    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.disableDeveloperMode) {
            window.disableDeveloperMode();
        }
    });
}

/**
 * Toggle panel expansion
 */
function togglePanelExpansion() {
    DIAGNOSTICS_STATE.isExpanded = !DIAGNOSTICS_STATE.isExpanded;
    
    const content = document.getElementById('devPanelContent');
    const toggle = document.getElementById('devPanelToggle');
    
    if (DIAGNOSTICS_STATE.isExpanded) {
        content.style.display = 'block';
        toggle.textContent = '−';
        updateDiagnosticsUI();
    } else {
        content.style.display = 'none';
        toggle.textContent = '+';
        updateCollapsedUI();
    }
}

/**
 * Update collapsed UI (show only FPS)
 */
function updateCollapsedUI() {
    const header = document.getElementById('devPanelHeader');
    if (!header) return;
    
    // Add FPS indicator to header when collapsed
    let fpsIndicator = document.getElementById('collapsedFps');
    if (!fpsIndicator) {
        fpsIndicator = document.createElement('div');
        fpsIndicator.id = 'collapsedFps';
        fpsIndicator.style.cssText = `
            color: #4ade80;
            font-size: 10px;
            margin-left: 8px;
        `;
        header.querySelector('div:first-child').appendChild(fpsIndicator);
    }
    
    // Update FPS
    const statusColor = DIAGNOSTICS_STATE.performanceStatus === 'Good' ? '#4ade80' : 
                       DIAGNOSTICS_STATE.performanceStatus === 'Warning' ? '#fbbf24' : '#f87171';
    fpsIndicator.style.color = statusColor;
    fpsIndicator.textContent = `● ${DIAGNOSTICS_STATE.fps} FPS`;
    
    // Also show time in collapsed state
    updateCollapsedTimeUI();
}

/**
 * Update collapsed time UI
 */
function updateCollapsedTimeUI() {
    const header = document.getElementById('devPanelHeader');
    if (!header) return;
    
    let timeIndicator = document.getElementById('collapsedTime');
    if (!timeIndicator) {
        timeIndicator = document.createElement('div');
        timeIndicator.id = 'collapsedTime';
        timeIndicator.style.cssText = `
            color: #888;
            font-size: 10px;
            margin-left: 8px;
        `;
        header.querySelector('div:first-child').appendChild(timeIndicator);
    }
    
    timeIndicator.textContent = DIAGNOSTICS_STATE.currentTime;
}

/**
 * Update diagnostics UI
 */
function updateDiagnosticsUI() {
    // Update FPS
    const fpsEl = document.getElementById('diagFps');
    if (fpsEl) {
        fpsEl.textContent = DIAGNOSTICS_STATE.fps;
        const statusColor = DIAGNOSTICS_STATE.performanceStatus === 'Good' ? '#4ade80' : 
                           DIAGNOSTICS_STATE.performanceStatus === 'Warning' ? '#fbbf24' : '#f87171';
        fpsEl.style.color = statusColor;
    }
    
    // Update Frame Time
    const frameTimeEl = document.getElementById('diagFrameTime');
    if (frameTimeEl) {
        frameTimeEl.textContent = DIAGNOSTICS_STATE.frameTime + ' ms';
    }
    
    // Update Memory
    const jsHeapEl = document.getElementById('diagJsHeap');
    if (jsHeapEl) {
        jsHeapEl.textContent = DIAGNOSTICS_STATE.jsHeap || 'N/A';
    }
    
    const heapLimitEl = document.getElementById('diagHeapLimit');
    if (heapLimitEl) {
        heapLimitEl.textContent = DIAGNOSTICS_STATE.heapLimit || 'N/A';
    }
    
    // Update Audio
    const audioCtxEl = document.getElementById('diagAudioContext');
    if (audioCtxEl) {
        audioCtxEl.textContent = DIAGNOSTICS_STATE.audioContextState;
        const statusColor = DIAGNOSTICS_STATE.audioContextState === 'Running' ? '#4ade80' : 
                           DIAGNOSTICS_STATE.audioContextState === 'Suspended' ? '#fbbf24' : '#888';
        audioCtxEl.style.color = statusColor;
    }
    
    const audioNodesEl = document.getElementById('diagAudioNodes');
    if (audioNodesEl) {
        audioNodesEl.textContent = DIAGNOSTICS_STATE.audioNodes;
    }
    
    const sampleRateEl = document.getElementById('diagSampleRate');
    if (sampleRateEl) {
        sampleRateEl.textContent = DIAGNOSTICS_STATE.audioSampleRate;
    }
    
    const playerStateEl = document.getElementById('diagPlayerState');
    if (playerStateEl) {
        playerStateEl.textContent = DIAGNOSTICS_STATE.playerState;
        const statusColor = DIAGNOSTICS_STATE.playerState === 'Playing' ? '#4ade80' : 
                           DIAGNOSTICS_STATE.playerState === 'Loading' ? '#fbbf24' : '#888';
        playerStateEl.style.color = statusColor;
    }
    
    const tracksEl = document.getElementById('diagTracks');
    if (tracksEl) {
        tracksEl.textContent = DIAGNOSTICS_STATE.playerTracks;
    }
    
    const currentTimeEl = document.getElementById('diagCurrentTime');
    if (currentTimeEl) {
        currentTimeEl.textContent = DIAGNOSTICS_STATE.playerCurrentTime;
    }
    
    // Update Connectivity
    updateConnectivityUI();
    
    // Update PWA
    const swEl = document.getElementById('diagServiceWorker');
    if (swEl) {
        swEl.textContent = DIAGNOSTICS_STATE.serviceWorkerStatus;
        const statusColor = DIAGNOSTICS_STATE.serviceWorkerStatus === 'Active' ? '#4ade80' : '#888';
        swEl.style.color = statusColor;
    }
    
    const cacheEl = document.getElementById('diagCache');
    if (cacheEl) {
        cacheEl.textContent = DIAGNOSTICS_STATE.cacheStatus;
        const statusColor = DIAGNOSTICS_STATE.cacheStatus === 'Available' ? '#4ade80' : '#888';
        cacheEl.style.color = statusColor;
    }
    
    // Update Storage
    const idbEl = document.getElementById('diagIndexedDB');
    if (idbEl) {
        idbEl.textContent = DIAGNOSTICS_STATE.indexedDBStatus;
        const statusColor = DIAGNOSTICS_STATE.indexedDBStatus === 'Available' ? '#4ade80' : '#888';
        idbEl.style.color = statusColor;
    }
    
    const lsEl = document.getElementById('diagLocalStorage');
    if (lsEl) {
        lsEl.textContent = DIAGNOSTICS_STATE.localStorageStatus;
        const statusColor = DIAGNOSTICS_STATE.localStorageStatus === 'Available' ? '#4ade80' : '#888';
        lsEl.style.color = statusColor;
    }
    
    const storageUsedEl = document.getElementById('diagStorageUsed');
    if (storageUsedEl) {
        storageUsedEl.textContent = DIAGNOSTICS_STATE.storageUsed;
    }
    
    // Update System
    const pwaEl = document.getElementById('diagPWA');
    if (pwaEl) {
        pwaEl.textContent = DIAGNOSTICS_STATE.pwaStatus;
    }
    
    const viewportEl = document.getElementById('diagViewport');
    if (viewportEl) {
        viewportEl.textContent = DIAGNOSTICS_STATE.viewport;
    }
    
    const timezoneEl = document.getElementById('diagTimezone');
    if (timezoneEl) {
        timezoneEl.textContent = DIAGNOSTICS_STATE.timezone;
    }
    
    // Update Date/Time
    updateDateTimeUI();
    
    // Update Version
    const versionEl = document.getElementById('diagVersion');
    if (versionEl) {
        versionEl.textContent = DIAGNOSTICS_STATE.version;
    }
}

/**
 * Update storage UI
 */
function updateStorageUI() {
    const storageUsedEl = document.getElementById('diagStorageUsed');
    if (storageUsedEl) {
        storageUsedEl.textContent = DIAGNOSTICS_STATE.storageUsed;
    }
}

/**
 * Update connectivity UI
 */
function updateConnectivityUI() {
    const networkEl = document.getElementById('diagNetwork');
    if (networkEl) {
        networkEl.textContent = DIAGNOSTICS_STATE.networkStatus;
        networkEl.style.color = DIAGNOSTICS_STATE.networkStatus === 'Online' ? '#4ade80' : '#f87171';
    }
    
    const firebaseEl = document.getElementById('diagFirebaseConnection');
    if (firebaseEl) {
        const status = DIAGNOSTICS_STATE.firebaseConnectionStatus;
        const latency = DIAGNOSTICS_STATE.firebaseLatency;
        const latencyText = latency !== null ? `${latency} ms` : 'N/A';
        firebaseEl.textContent = `● ${status}  ${latencyText}`;
        const statusColor = status === 'Connected' ? '#4ade80' : 
                           status === 'Connecting...' ? '#fbbf24' : '#f87171';
        firebaseEl.style.color = statusColor;
    }
    
    const r2El = document.getElementById('diagR2Connection');
    if (r2El) {
        const status = DIAGNOSTICS_STATE.r2ConnectionStatus;
        const latency = DIAGNOSTICS_STATE.r2Latency;
        const latencyText = latency !== null ? `${latency} ms` : 'N/A';
        r2El.textContent = `● ${status} ${latencyText}`;
        const statusColor = status === 'Connected' ? '#4ade80' : 
                           status === 'Connecting...' ? '#fbbf24' : 
                           status === 'N/A' ? '#888' : '#f87171';
        r2El.style.color = statusColor;
    }
}

/**
 * Update date/time UI
 */
function updateDateTimeUI() {
    const dateEl = document.getElementById('diagDate');
    if (dateEl) {
        dateEl.textContent = DIAGNOSTICS_STATE.currentDate;
    }
    
    const timeEl = document.getElementById('diagTime');
    if (timeEl) {
        timeEl.textContent = DIAGNOSTICS_STATE.currentTime;
    }
}

/**
 * Show diagnostics panel
 */
function showDiagnosticsPanel() {
    createDiagnosticsPanel();
    initializeDiagnostics();
}

/**
 * Hide diagnostics panel
 */
function hideDiagnosticsPanel() {
    const panel = document.getElementById('devToolsPanel');
    if (panel) {
        panel.remove();
    }
}

/**
 * Show diagnostics panel
 */
function showDiagnosticsPanel() {
    createDiagnosticsPanel();
    initializeDiagnostics();
}

/**
 * Hide diagnostics panel
 */
function hideDiagnosticsPanel() {
    const panel = document.getElementById('devToolsPanel');
    if (panel) {
        panel.remove();
    }
}

// Make functions available globally
window.showDiagnosticsPanel = showDiagnosticsPanel;
window.hideDiagnosticsPanel = hideDiagnosticsPanel;
window.DIAGNOSTICS_STATE = DIAGNOSTICS_STATE;
window.checkFirebaseConnection = checkFirebaseConnection;
window.checkR2Connection = checkR2Connection;
window.diagnosticsInterval = diagnosticsInterval;
window.timeUpdateInterval = timeUpdateInterval;
window.healthCheckInterval = healthCheckInterval;