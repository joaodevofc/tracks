/**
 * Developer Mode System for W.Tracks PWA
 * Blocks DevTools for regular users in PWA, can be activated via secret profile name
 */

// Central state
const DEV_MODE_CONFIG = {
    enabled: false,
    isAuthorized: false,
    isAdmin: false,
    adminData: null
};

// Secret UID to activate Developer Mode
const DEV_MODE_SECRET_UID = 'CesU7HhFpFPCzDGBZHrn4pNEygr2';

// Keys used by W.Tracks (must NOT be blocked)
const TRACKS_KEYS = [
    'Space', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
    'Delete', 'Backspace', 'Enter', 'Tab', 's', 'S', 'c', 'C'
];

/**
 * Check if running as PWA
 */
function isRunningAsPWA() {
    return (
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches ||
        window.navigator.standalone === true
    );
}

/**
 * Check if key combination is a DevTools shortcut
 */
function isDevToolsShortcut(e) {
    // F12 is always a DevTools shortcut
    if (e.key === 'F12') {
        return true;
    }

    // Control+Shift+I/J/C/U (Windows)
    if (e.ctrlKey && e.shiftKey && ['I', 'J', 'C', 'U'].includes(e.key)) {
        return true;
    }

    // Control+U (Windows - view source)
    if (e.ctrlKey && e.key === 'u') {
        return true;
    }

    // Meta+Alt+I/J/C/U (macOS)
    if (e.metaKey && e.altKey && ['I', 'J', 'C', 'U'].includes(e.key)) {
        return true;
    }

    // Meta+U (macOS - view source)
    if (e.metaKey && e.key === 'u') {
        return true;
    }

    return false;
}

/**
 * Check if key is used by W.Tracks
 */
function isTracksKey(e) {
    // Check if focus is in an editable element
    const activeElement = document.activeElement;
    const isEditable = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.isContentEditable
    );

    // Allow all keys in editable elements
    if (isEditable) return true;

    // Allow specific W.Tracks keys
    return TRACKS_KEYS.includes(e.key);
}

/**
 * Check if should block DevTools
 */
function shouldBlockDevTools() {
    return isRunningAsPWA() && !DEV_MODE_CONFIG.enabled;
}

/**
 * Enable Developer Mode
 */
function enableDeveloperMode() {
    DEV_MODE_CONFIG.enabled = true;
    DEV_MODE_CONFIG.isAuthorized = true;
    localStorage.setItem('wtracks_dev_mode', 'true');
    console.log('[DEV MODE] Developer Mode ENABLED');
    
    // Create diagnostics panel
    if (window.showDiagnosticsPanel) {
        window.showDiagnosticsPanel();
    }
    
    // Show Dev Console
    if (window.showDevConsole) {
        window.showDevConsole();
    }
}

/**
 * Disable Developer Mode
 */
function disableDeveloperMode() {
    DEV_MODE_CONFIG.enabled = false;
    DEV_MODE_CONFIG.isAuthorized = false;
    localStorage.setItem('wtracks_dev_mode', 'false');
    console.log('[DEV MODE] Developer Mode DISABLED');
    
    // Hide diagnostics panel
    if (window.hideDiagnosticsPanel) {
        window.hideDiagnosticsPanel();
    }
    
    // Hide Dev Console
    if (window.hideDevConsole) {
        window.hideDevConsole();
    }
    
    // Restore original console functions
    if (window.restoreConsole) {
        window.restoreConsole();
    }
    
    // Clear diagnostics intervals
    if (window.diagnosticsInterval) {
        clearInterval(window.diagnosticsInterval);
        window.diagnosticsInterval = null;
    }
    if (window.timeUpdateInterval) {
        clearInterval(window.timeUpdateInterval);
        window.timeUpdateInterval = null;
    }
    if (window.healthCheckInterval) {
        clearInterval(window.healthCheckInterval);
        window.healthCheckInterval = null;
    }
    
    // Re-enable blocking
    setupDevToolsBlocking();
}

/**
 * Initialize Developer Mode
 */
async function initializeDeveloperMode() {
    console.log('[DEV MODE] Initializing...');

    // Check if running as PWA
    if (!isRunningAsPWA()) {
        console.log('[DEV MODE] Not running as PWA - skipping initialization');
        return;
    }

    console.log('[DEV MODE] Running as PWA - checking persisted state');

    // Check persisted state
    const persistedMode = localStorage.getItem('wtracks_dev_mode');
    if (persistedMode === 'true') {
        DEV_MODE_CONFIG.enabled = true;
        DEV_MODE_CONFIG.isAuthorized = true;
        console.log('[DEV MODE] Developer Mode enabled from persistence');
        
        // Show diagnostics panel
        if (window.showDiagnosticsPanel) {
            window.showDiagnosticsPanel();
        }
        
        // Show Dev Console
        if (window.showDevConsole) {
            window.showDevConsole();
        }
    }

    // Set up DevTools blocking if needed
    if (shouldBlockDevTools()) {
        setupDevToolsBlocking();
    }
}

// DevTools blocking event listeners
let keydownListener = null;
let contextMenuListener = null;

/**
 * Set up DevTools blocking
 */
function setupDevToolsBlocking() {
    console.log('[DEV MODE] Setting up DevTools blocking...');

    // Remove existing listeners if any
    if (keydownListener) {
        document.removeEventListener('keydown', keydownListener, true);
    }
    if (contextMenuListener) {
        document.removeEventListener('contextmenu', contextMenuListener, true);
    }

    // Block keyboard shortcuts
    keydownListener = (e) => {
        if (shouldBlockDevTools() && isDevToolsShortcut(e) && !isTracksKey(e)) {
            e.preventDefault();
            e.stopPropagation();
            console.log('[DEV MODE] Blocked DevTools shortcut:', e.key);
        }
    };
    document.addEventListener('keydown', keydownListener, true);

    // Block context menu
    contextMenuListener = (e) => {
        if (shouldBlockDevTools()) {
            e.preventDefault();
            e.stopPropagation();
            console.log('[DEV MODE] Blocked context menu');
        }
    };
    document.addEventListener('contextmenu', contextMenuListener, true);
}

// Initialize immediately
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeDeveloperMode);
} else {
    initializeDeveloperMode();
}

// Make functions available globally for debugging
window.DEV_MODE_CONFIG = DEV_MODE_CONFIG;
window.DEV_MODE_SECRET_UID = DEV_MODE_SECRET_UID;
window.isRunningAsPWA = isRunningAsPWA;
window.enableDeveloperMode = enableDeveloperMode;
window.disableDeveloperMode = disableDeveloperMode;