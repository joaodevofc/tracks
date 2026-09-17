/**
 * Dev Console for W.Tracks PWA
 * Real-time console logs viewer when Developer Mode is enabled
 */

// Console configuration
const DEV_CONSOLE_CONFIG = {
    maxLogs: 500,
    autoScroll: true,
    isPaused: false,
    filter: 'ALL',
    searchQuery: '',
    height: '30%', // partial size
    minHeight: '10%',
    maxHeight: '90%',
    isExpanded: false,
    isCollapsed: false
};

// Console state
const DEV_CONSOLE_STATE = {
    logs: [],
    errorCount: 0,
    warningCount: 0,
    logCount: 0
};

// Store original console functions
const ORIGINAL_CONSOLE = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug
};

/**
 * Initialize Dev Console
 */
function initializeDevConsole() {
    console.log('[DEV CONSOLE] Initializing...');
    
    // Intercept console functions
    interceptConsole();
    
    // Capture global errors
    setupGlobalErrorHandlers();
    
    // Set up integration with diagnostics
    setupDiagnosticsIntegration();
    
    // Create console UI
    createDevConsoleUI();
    
    console.log('[DEV CONSOLE] Initialized');
}

/**
 * Intercept console functions
 */
function interceptConsole() {
    console.log = function(...args) {
        ORIGINAL_CONSOLE.log.apply(console, args);
        addDevLog('LOG', args);
    };
    
    console.info = function(...args) {
        ORIGINAL_CONSOLE.info.apply(console, args);
        addDevLog('INFO', args);
    };
    
    console.warn = function(...args) {
        ORIGINAL_CONSOLE.warn.apply(console, args);
        addDevLog('WARN', args);
        DEV_CONSOLE_STATE.warningCount++;
        updateConsoleHeader();
    };
    
    console.error = function(...args) {
        ORIGINAL_CONSOLE.error.apply(console, args);
        addDevLog('ERROR', args);
        DEV_CONSOLE_STATE.errorCount++;
        updateConsoleHeader();
    };
    
    console.debug = function(...args) {
        ORIGINAL_CONSOLE.debug.apply(console, args);
        addDevLog('DEBUG', args);
    };
}

/**
 * Restore original console functions
 */
function restoreConsole() {
    console.log = ORIGINAL_CONSOLE.log;
    console.info = ORIGINAL_CONSOLE.info;
    console.warn = ORIGINAL_CONSOLE.warn;
    console.error = ORIGINAL_CONSOLE.error;
    console.debug = ORIGINAL_CONSOLE.debug;
}

/**
 * Setup global error handlers
 */
function setupGlobalErrorHandlers() {
    window.addEventListener('error', (event) => {
        const errorMsg = event.message || 'Unknown error';
        const errorStack = event.error?.stack || '';
        addDevLog('ERROR', [errorMsg, errorStack], errorStack);
        DEV_CONSOLE_STATE.errorCount++;
        updateConsoleHeader();
    });
    
    window.addEventListener('unhandledrejection', (event) => {
        const errorMsg = event.reason?.message || 'Unhandled Promise Rejection';
        const errorStack = event.reason?.stack || '';
        addDevLog('ERROR', [errorMsg, errorStack], errorStack);
        DEV_CONSOLE_STATE.errorCount++;
        updateConsoleHeader();
    });
}

/**
 * Add log to console
 */
function addDevLog(type, args, stack = null) {
    if (DEV_CONSOLE_CONFIG.isPaused) return;
    
    const timestamp = formatTimestamp();
    const message = formatMessage(args);
    
    const log = {
        id: Date.now() + Math.random(),
        timestamp,
        type,
        message,
        rawArgs: args,
        stack: stack || null
    };
    
    // Extract stack trace from errors if not provided
    if (!stack && type === 'ERROR') {
        for (const arg of args) {
            if (arg instanceof Error) {
                log.stack = arg.stack;
                break;
            }
            if (typeof arg === 'object' && arg !== null) {
                if (arg.stack) {
                    log.stack = arg.stack;
                    break;
                }
            }
        }
    }
    
    DEV_CONSOLE_STATE.logs.push(log);
    DEV_CONSOLE_STATE.logCount++;
    
    // Limit logs
    if (DEV_CONSOLE_STATE.logs.length > DEV_CONSOLE_CONFIG.maxLogs) {
        DEV_CONSOLE_STATE.logs.shift();
    }
    
    // Update UI if visible
    if (!DEV_CONSOLE_CONFIG.isCollapsed) {
        updateConsoleLogs();
    }
    
    updateConsoleHeader();
}

/**
 * Format timestamp
 */
function formatTimestamp() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `[${hours}:${minutes}:${seconds}]`;
}

/**
 * Format message from args
 */
function formatMessage(args) {
    return args.map(arg => {
        if (typeof arg === 'object' && arg !== null) {
            try {
                return JSON.stringify(arg, null, 2);
            } catch (e) {
                return String(arg);
            }
        }
        return String(arg);
    }).join(' ');
}

/**
 * Create Dev Console UI
 */
function createDevConsoleUI() {
    // Remove existing console if any
    const existingConsole = document.getElementById('devConsole');
    if (existingConsole) {
        existingConsole.remove();
    }
    
    // Create console container
    const consoleContainer = document.createElement('div');
    consoleContainer.id = 'devConsole';
    consoleContainer.style.cssText = `
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        height: ${DEV_CONSOLE_CONFIG.height};
        background: rgba(0, 0, 0, 0.95);
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        flex-direction: column;
        z-index: 99998;
        font-family: 'IBM Plex Mono', monospace;
        font-size: 11px;
        color: #fff;
        backdrop-filter: blur(10px);
        transition: height 0.2s ease;
    `;
    
    consoleContainer.innerHTML = `
        <!-- Header -->
        <div id="devConsoleHeader" style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 12px;
            background: rgba(0, 0, 0, 0.5);
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            cursor: move;
            user-select: none;
        ">
            <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-weight: 600; color: #8b5cf6;">CONSOLE DEV</span>
                <span id="devConsoleStats" style="color: #888; font-size: 10px;">0 logs</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                <select id="devConsoleFilter" style="
                    background: rgba(255, 255, 255, 0.1);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    color: #fff;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 10px;
                    cursor: pointer;
                ">
                    <option value="ALL">ALL</option>
                    <option value="LOG">LOG</option>
                    <option value="INFO">INFO</option>
                    <option value="WARN">WARN</option>
                    <option value="ERROR">ERROR</option>
                    <option value="DEBUG">DEBUG</option>
                </select>
                <input id="devConsoleSearch" type="text" placeholder="Search..." style="
                    background: rgba(255, 255, 255, 0.1);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    color: #fff;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 10px;
                    width: 100px;
                ">
                <button id="devConsolePause" style="
                    background: rgba(255, 255, 255, 0.1);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    color: #fff;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 10px;
                    cursor: pointer;
                ">Pause</button>
                <button id="devConsoleClear" style="
                    background: rgba(255, 255, 255, 0.1);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    color: #fff;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 10px;
                    cursor: pointer;
                ">Clear</button>
                <button id="devConsoleCollapse" style="
                    background: rgba(255, 255, 255, 0.1);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    color: #fff;
                    padding: 4px 10px;
                    border-radius: 4px;
                    font-size: 12px;
                    cursor: pointer;
                    width: 24px;
                ">−</button>
                <button id="devConsoleExpand" style="
                    background: rgba(255, 255, 255, 0.1);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    color: #fff;
                    padding: 4px 10px;
                    border-radius: 4px;
                    font-size: 12px;
                    cursor: pointer;
                    width: 24px;
                ">□</button>
                <button id="devConsoleClose" style="
                    background: rgba(239, 68, 68, 0.2);
                    border: 1px solid rgba(239, 68, 68, 0.4);
                    color: #f87171;
                    padding: 4px 10px;
                    border-radius: 4px;
                    font-size: 12px;
                    cursor: pointer;
                    width: 24px;
                ">×</button>
            </div>
        </div>
        
        <!-- Logs container -->
        <div id="devConsoleLogs" style="
            flex: 1;
            overflow-y: auto;
            padding: 8px 12px;
            font-size: 11px;
            line-height: 1.5;
        ">
            <div style="color: #888; font-style: italic;">Waiting for logs...</div>
        </div>
        
        <!-- Resize handle -->
        <div id="devConsoleResize" style="
            height: 4px;
            background: rgba(255, 255, 255, 0.1);
            cursor: ns-resize;
            position: absolute;
            top: -2px;
            left: 0;
            right: 0;
        "></div>
    `;
    
    document.body.appendChild(consoleContainer);
    
    // Setup event listeners
    setupConsoleEventListeners(consoleContainer);
}

/**
 * Setup console event listeners
 */
function setupConsoleEventListeners(consoleContainer) {
    // Filter change
    const filterSelect = document.getElementById('devConsoleFilter');
    filterSelect.addEventListener('change', (e) => {
        DEV_CONSOLE_CONFIG.filter = e.target.value;
        updateConsoleLogs();
    });
    
    // Search input
    const searchInput = document.getElementById('devConsoleSearch');
    searchInput.addEventListener('input', (e) => {
        DEV_CONSOLE_CONFIG.searchQuery = e.target.value.toLowerCase();
        updateConsoleLogs();
    });
    
    // Pause button
    const pauseBtn = document.getElementById('devConsolePause');
    pauseBtn.addEventListener('click', () => {
        DEV_CONSOLE_CONFIG.isPaused = !DEV_CONSOLE_CONFIG.isPaused;
        pauseBtn.textContent = DEV_CONSOLE_CONFIG.isPaused ? 'Resume' : 'Pause';
        pauseBtn.style.background = DEV_CONSOLE_CONFIG.isPaused ? 'rgba(251, 191, 36, 0.2)' : 'rgba(255, 255, 255, 0.1)';
    });
    
    // Clear button
    const clearBtn = document.getElementById('devConsoleClear');
    clearBtn.addEventListener('click', () => {
        DEV_CONSOLE_STATE.logs = [];
        DEV_CONSOLE_STATE.logCount = 0;
        DEV_CONSOLE_STATE.errorCount = 0;
        DEV_CONSOLE_STATE.warningCount = 0;
        updateConsoleLogs();
        updateConsoleHeader();
    });
    
    // Collapse button
    const collapseBtn = document.getElementById('devConsoleCollapse');
    collapseBtn.addEventListener('click', () => {
        toggleConsoleCollapse();
    });
    
    // Expand button
    const expandBtn = document.getElementById('devConsoleExpand');
    expandBtn.addEventListener('click', () => {
        toggleConsoleExpand();
    });
    
    // Close button
    const closeBtn = document.getElementById('devConsoleClose');
    closeBtn.addEventListener('click', () => {
        hideDevConsole();
    });
    
    // Resize handle
    const resizeHandle = document.getElementById('devConsoleResize');
    let isResizing = false;
    let startY, startHeight;
    
    resizeHandle.addEventListener('mousedown', function(e) {
        isResizing = true;
        startY = e.clientY;
        startHeight = consoleContainer.offsetHeight;
        document.body.style.userSelect = 'none';
    });
    
    document.addEventListener('mousemove', function(e) {
        if (!isResizing) return;
        
        const deltaY = startY - e.clientY;
        const newHeight = startHeight + deltaY;
        const minHeight = window.innerHeight * 0.1;
        const maxHeight = window.innerHeight * 0.9;
        
        if (newHeight >= minHeight && newHeight <= maxHeight) {
            const heightPercent = (newHeight / window.innerHeight) * 100;
            DEV_CONSOLE_CONFIG.height = heightPercent + '%';
            consoleContainer.style.height = DEV_CONSOLE_CONFIG.height;
        }
    });
    
    document.addEventListener('mouseup', function() {
        if (isResizing) {
            isResizing = false;
            document.body.style.userSelect = '';
        }
    });
    
    // Auto-scroll detection
    const logsContainer = document.getElementById('devConsoleLogs');
    logsContainer.addEventListener('scroll', () => {
        const isAtBottom = logsContainer.scrollHeight - logsContainer.scrollTop <= logsContainer.clientHeight + 50;
        DEV_CONSOLE_CONFIG.autoScroll = isAtBottom;
    });
}

/**
 * Toggle console collapse
 */
function toggleConsoleCollapse() {
    DEV_CONSOLE_CONFIG.isCollapsed = !DEV_CONSOLE_CONFIG.isCollapsed;
    
    const consoleContainer = document.getElementById('devConsole');
    const collapseBtn = document.getElementById('devConsoleCollapse');
    const logsContainer = document.getElementById('devConsoleLogs');
    
    if (DEV_CONSOLE_CONFIG.isCollapsed) {
        consoleContainer.style.height = '30px';
        logsContainer.style.display = 'none';
        collapseBtn.textContent = '▲';
    } else {
        consoleContainer.style.height = DEV_CONSOLE_CONFIG.height;
        logsContainer.style.display = 'block';
        collapseBtn.textContent = '−';
    }
}

/**
 * Toggle console expand
 */
function toggleConsoleExpand() {
    DEV_CONSOLE_CONFIG.isExpanded = !DEV_CONSOLE_CONFIG.isExpanded;
    
    const consoleContainer = document.getElementById('devConsole');
    
    if (DEV_CONSOLE_CONFIG.isExpanded) {
        DEV_CONSOLE_CONFIG.previousHeight = DEV_CONSOLE_CONFIG.height;
        DEV_CONSOLE_CONFIG.height = DEV_CONSOLE_CONFIG.maxHeight;
    } else {
        DEV_CONSOLE_CONFIG.height = DEV_CONSOLE_CONFIG.previousHeight || '30%';
    }
    
    consoleContainer.style.height = DEV_CONSOLE_CONFIG.height;
}

/**
 * Update console logs UI
 */
function updateConsoleLogs() {
    const logsContainer = document.getElementById('devConsoleLogs');
    if (!logsContainer) return;
    
    // Filter logs
    const filteredLogs = DEV_CONSOLE_STATE.logs.filter(log => {
        // Type filter
        if (DEV_CONSOLE_CONFIG.filter !== 'ALL' && log.type !== DEV_CONSOLE_CONFIG.filter) {
            return false;
        }
        
        // Search filter
        if (DEV_CONSOLE_CONFIG.searchQuery && !log.message.toLowerCase().includes(DEV_CONSOLE_CONFIG.searchQuery)) {
            return false;
        }
        
        return true;
    });
    
    // Clear container
    logsContainer.innerHTML = '';
    
    if (filteredLogs.length === 0) {
        logsContainer.innerHTML = '<div style="color: #888; font-style: italic;">No logs matching filter</div>';
        return;
    }
    
    // Render logs
    filteredLogs.forEach(log => {
        const logEl = document.createElement('div');
        logEl.style.cssText = `
            padding: 4px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            word-break: break-word;
            cursor: pointer;
            transition: background 0.15s ease;
        `;
        
        logEl.dataset.logId = log.id;
        
        // Color based on type
        let typeColor = '#888';
        let backgroundColor = 'transparent';
        
        if (log.type === 'INFO') typeColor = '#60a5fa';
        if (log.type === 'WARN') {
            typeColor = '#fbbf24';
            backgroundColor = 'rgba(251, 191, 36, 0.05)';
        }
        if (log.type === 'ERROR') {
            typeColor = '#f87171';
            backgroundColor = 'rgba(248, 113, 113, 0.1)';
        }
        if (log.type === 'DEBUG') typeColor = '#a78bfa';
        
        logEl.style.backgroundColor = backgroundColor;
        
        logEl.innerHTML = `
            <span style="color: #666;">${log.timestamp}</span>
            <span style="color: ${typeColor}; font-weight: 500; margin-left: 8px;">${log.type}</span>
            <span style="color: ${log.type === 'ERROR' ? '#f87171' : '#ddd'}; margin-left: 8px;">${escapeHtml(log.message)}</span>
        `;
        
        // Click handler
        logEl.addEventListener('click', (e) => {
            e.stopPropagation();
            showLogContextMenu(log, e.clientX, e.clientY);
        });
        
        // Hover effect
        logEl.addEventListener('mouseenter', () => {
            logEl.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
        });
        
        logEl.addEventListener('mouseleave', () => {
            logEl.style.backgroundColor = backgroundColor;
        });
        
        logsContainer.appendChild(logEl);
    });
    
    // Auto-scroll
    if (DEV_CONSOLE_CONFIG.autoScroll) {
        logsContainer.scrollTop = logsContainer.scrollHeight;
    }
}

/**
 * Update console header stats
 */
function updateConsoleHeader() {
    const statsEl = document.getElementById('devConsoleStats');
    if (!statsEl) return;
    
    let statsText = `${DEV_CONSOLE_STATE.logCount} logs`;
    if (DEV_CONSOLE_STATE.errorCount > 0) {
        statsText += `   ${DEV_CONSOLE_STATE.errorCount} errors`;
    }
    if (DEV_CONSOLE_STATE.warningCount > 0) {
        statsText += `   ${DEV_CONSOLE_STATE.warningCount} warnings`;
    }
    
    statsEl.textContent = statsText;
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Show log context menu
 */
function showLogContextMenu(log, x, y) {
    // Remove existing menu
    const existingMenu = document.getElementById('logContextMenu');
    if (existingMenu) {
        existingMenu.remove();
    }
    
    // Create menu
    const menu = document.createElement('div');
    menu.id = 'logContextMenu';
    menu.style.cssText = `
        position: fixed;
        left: ${x}px;
        top: ${y}px;
        background: rgba(0, 0, 0, 0.95);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 6px;
        padding: 4px 0;
        z-index: 999999;
        font-family: 'IBM Plex Mono', monospace;
        font-size: 11px;
        color: #fff;
        backdrop-filter: blur(10px);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        min-width: 120px;
    `;
    
    menu.innerHTML = `
        <div class="logMenuItem" data-action="copy" style="
            padding: 8px 16px;
            cursor: pointer;
            transition: background 0.15s ease;
        ">Copiar log</div>
        <div class="logMenuItem" data-action="delete" style="
            padding: 8px 16px;
            cursor: pointer;
            transition: background 0.15s ease;
            color: #f87171;
        ">Apagar log</div>
    `;
    
    document.body.appendChild(menu);
    
    // Position menu to stay within viewport
    const menuRect = menu.getBoundingClientRect();
    if (menuRect.right > window.innerWidth) {
        menu.style.left = (window.innerWidth - menuRect.width - 10) + 'px';
    }
    if (menuRect.bottom > window.innerHeight) {
        menu.style.top = (window.innerHeight - menuRect.height - 10) + 'px';
    }
    
    // Menu item hover effects
    menu.querySelectorAll('.logMenuItem').forEach(item => {
        item.addEventListener('mouseenter', () => {
            item.style.background = 'rgba(255, 255, 255, 0.1)';
        });
        item.addEventListener('mouseleave', () => {
            item.style.background = 'transparent';
        });
    });
    
    // Click handlers
    menu.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        if (action === 'copy') {
            copyLog(log);
        } else if (action === 'delete') {
            deleteLog(log.id);
        }
        menu.remove();
    });
    
    // Close on click outside
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 0);
}

/**
 * Copy log to clipboard
 */
function copyLog(log) {
    let textToCopy = `${log.timestamp} ${log.type} ${log.message}`;
    
    // Add stack trace if available
    if (log.stack) {
        textToCopy += '\n\n' + log.stack;
    }
    
    // Copy to clipboard
    navigator.clipboard.writeText(textToCopy).then(() => {
        // Show confirmation
        showCopyConfirmation();
    }).catch(err => {
        console.error('[DEV CONSOLE] Failed to copy log:', err);
    });
}

/**
 * Show copy confirmation
 */
function showCopyConfirmation() {
    const confirmation = document.createElement('div');
    confirmation.style.cssText = `
        position: fixed;
        bottom: 80px;
        right: 20px;
        background: rgba(34, 197, 94, 0.9);
        color: #fff;
        padding: 8px 16px;
        border-radius: 4px;
        font-size: 11px;
        z-index: 999999;
        font-family: 'IBM Plex Mono', monospace;
        backdrop-filter: blur(10px);
    `;
    confirmation.textContent = 'Copiado';
    
    document.body.appendChild(confirmation);
    
    setTimeout(() => {
        confirmation.remove();
    }, 1500);
}

/**
 * Delete log
 */
function deleteLog(logId) {
    const index = DEV_CONSOLE_STATE.logs.findIndex(log => log.id === logId);
    if (index !== -1) {
        const deletedLog = DEV_CONSOLE_STATE.logs[index];
        
        DEV_CONSOLE_STATE.logs.splice(index, 1);
        DEV_CONSOLE_STATE.logCount--;
        
        // Update error/warning counts if needed
        if (deletedLog.type === 'ERROR') {
            DEV_CONSOLE_STATE.errorCount--;
        } else if (deletedLog.type === 'WARN') {
            DEV_CONSOLE_STATE.warningCount--;
        }
        
        updateConsoleLogs();
        updateConsoleHeader();
    }
}

/**
 * Setup integration with diagnostics
 */
function setupDiagnosticsIntegration() {
    // Monitor Firebase connection changes (debounced)
    let lastFirebaseStatus = null;
    let lastFirebaseLatency = null;
    
    setInterval(() => {
        if (!window.DIAGNOSTICS_STATE) return;
        
        const currentStatus = window.DIAGNOSTICS_STATE.firebaseConnectionStatus;
        const currentLatency = window.DIAGNOSTICS_STATE.firebaseLatency;
        
        if (currentStatus !== lastFirebaseStatus) {
            const latencyText = currentLatency ? ` — ${currentLatency}ms` : '';
            addDevLog('INFO', [`Firebase connection: ${currentStatus}${latencyText}`]);
            lastFirebaseStatus = currentStatus;
        }
    }, 2000);
    
    // Monitor R2 connection changes (debounced)
    let lastR2Status = null;
    let lastR2Latency = null;
    
    setInterval(() => {
        if (!window.DIAGNOSTICS_STATE) return;
        
        const currentStatus = window.DIAGNOSTICS_STATE.r2ConnectionStatus;
        const currentLatency = window.DIAGNOSTICS_STATE.r2Latency;
        
        if (currentStatus !== lastR2Status) {
            const latencyText = currentLatency ? ` — ${currentLatency}ms` : '';
            addDevLog('INFO', [`R2 Storage: ${currentStatus}${latencyText}`]);
            lastR2Status = currentStatus;
        }
    }, 2000);
    
    // Monitor FPS for performance warnings (debounced)
    let lastFpsWarning = 0;
    const fpsWarningCooldown = 10000; // 10 seconds
    
    setInterval(() => {
        if (!window.DIAGNOSTICS_STATE) return;
        
        const fps = window.DIAGNOSTICS_STATE.fps;
        const now = Date.now();
        
        if (fps < 30 && fps > 0 && now - lastFpsWarning > fpsWarningCooldown) {
            addDevLog('WARN', [`Performance: FPS dropped to ${fps}`]);
            lastFpsWarning = now;
        }
    }, 2000);
}

/**
 * Show Dev Console
 */
function showDevConsole() {
    const existingConsole = document.getElementById('devConsole');
    if (existingConsole) {
        existingConsole.remove();
    }
    
    initializeDevConsole();
}

/**
 * Hide Dev Console
 */
function hideDevConsole() {
    const consoleContainer = document.getElementById('devConsole');
    if (consoleContainer) {
        consoleContainer.remove();
    }
}

// Make functions available globally
window.showDevConsole = showDevConsole;
window.hideDevConsole = hideDevConsole;
window.restoreConsole = restoreConsole;
window.DEV_CONSOLE_CONFIG = DEV_CONSOLE_CONFIG;
window.DEV_CONSOLE_STATE = DEV_CONSOLE_STATE;