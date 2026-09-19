// ========================================
// SERVICE PLAN SHARED VIEW - READ ONLY
// ========================================

const MONTHS = [
    'JANEIRO',
    'FEVEREIRO',
    'MARÇO',
    'ABRIL',
    'MAIO',
    'JUNHO',
    'JULHO',
    'AGOSTO',
    'SETEMBRO',
    'OUTUBRO',
    'NOVEMBRO',
    'DEZEMBRO'
];

const DAYS_OF_WEEK_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const DAYS_OF_WEEK = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

const ITEM_TYPES = {
    'OPENING': 'ABERTURA',
    'MUSIC': 'MÚSICA',
    'MESSAGE': 'MENSAGEM',
    'OFFERING': 'OFERTA',
    'COMMUNION': 'SANTA CEIA',
    'PRAYER': 'ORAÇÃO',
    'ANNOUNCEMENTS': 'AVISOS',
    'VIDEO': 'VÍDEO',
    'INSTRUMENTAL': 'INSTRUMENTAL',
    'BREAK': 'PAUSA',
    'CLOSING': 'ENCERRAMENTO',
    'CUSTOM': 'PERSONALIZADO'
};

// Shared mode state
let sharedMonth = null;
let sharedYear = null;
let sharedUserId = null;
let currentMonth = new Date().getMonth();
let currentYear = 2026;
let selectedDay = null;
let selectedDate = null;
let servicePlans = {};
let currentServicePlan = null;

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
    // Parse URL parameters for shared month
    parseSharedParameters();
    
    if (sharedMonth !== null && sharedYear !== null && sharedUserId) {
        // Set current month/year to shared values
        currentMonth = sharedMonth;
        currentYear = sharedYear;
        
        // Render calendar for shared month only
        renderCalendar(currentMonth, currentYear);
        
        // Load service plans for the shared user
        loadSharedServicePlans(sharedUserId);
        
        // Initialize side panel
        initSidePanel();
    } else {
        showError('Link de compartilhamento inválido.');
    }
});

function parseSharedParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    
    const month = urlParams.get('month');
    const year = urlParams.get('year');
    const userId = urlParams.get('userId');
    
    if (month !== null) {
        sharedMonth = parseInt(month, 10);
    }
    
    if (year !== null) {
        sharedYear = parseInt(year, 10);
    }
    
    if (userId) {
        sharedUserId = userId;
    }
    
    console.log('[SHARED] Parameters:', { sharedMonth, sharedYear, sharedUserId });
}

function loadSharedServicePlans(userId) {
    if (!window.firebaseDB) {
        console.error('[SHARED] Firebase DB not available');
        return;
    }

    console.log('[SHARED] Loading service plans for user:', userId);

    const { db, collection, query, onSnapshot } = window.firebaseDB;
    const servicePlansRef = collection(db, 'users', userId, 'servicePlans');

    // Real-time listener
    onSnapshot(
        query(servicePlansRef),
        (snapshot) => {
            const plans = {};
            snapshot.forEach((doc) => {
                const data = doc.data();
                const dateKey = data.date;
                plans[dateKey] = {
                    id: doc.id,
                    name: data.name,
                    date: data.date,
                    items: data.items || [],
                    createdAt: data.createdAt,
                    updatedAt: data.updatedAt
                };
                console.log('[SHARED] Loaded plan:', dateKey, data.name);
            });

            servicePlans = plans;
            renderCalendar(currentMonth, currentYear);

            console.log('[SHARED] Service Plans loaded:', Object.keys(plans).length, plans);
        },
        (error) => {
            console.error('[SHARED] Error loading service plans:', error);
            showError('Unable to load Service Plans. Please try again.');
        }
    );
}

// ========================================
// CALENDAR (REUSED FROM ORIGINAL)
// ========================================

function renderCalendar(month, year) {
    const calendarGrid = document.getElementById('calendarGrid');
    const calendarTitle = document.getElementById('calendarTitle');
    
    // Update title
    calendarTitle.textContent = `${MONTHS[month]} ${year}`;
    
    // Clear existing calendar
    calendarGrid.innerHTML = '';
    
    // Add day headers
    DAYS_OF_WEEK.forEach(day => {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'calendar-day-header';
        dayHeader.textContent = day;
        calendarGrid.appendChild(dayHeader);
    });
    
    // Get first day of month and total days
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = getDaysInMonth(month, year);
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day empty';
        calendarGrid.appendChild(emptyDay);
    }
    
    // Add days
    for (let day = 1; day <= daysInMonth; day++) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        dayElement.dataset.day = day;
        dayElement.dataset.month = month;
        dayElement.dataset.year = year;
        
        const dayNumber = document.createElement('div');
        dayNumber.className = 'calendar-day-number';
        dayNumber.textContent = day;
        
        const dayName = document.createElement('div');
        dayName.className = 'calendar-day-name';
        const dayOfWeek = (firstDay + day - 1) % 7;
        dayName.textContent = DAYS_OF_WEEK[dayOfWeek];
        
        const selectionIndicator = document.createElement('div');
        selectionIndicator.className = 'selection-indicator';
        
        dayElement.appendChild(dayNumber);
        dayElement.appendChild(dayName);
        dayElement.appendChild(selectionIndicator);
        
        // Check if this is today
        const today = new Date();
        const isToday = (day === today.getDate() && 
                        month === today.getMonth() && 
                        year === today.getFullYear());
        
        if (isToday) {
            dayElement.classList.add('is-today');
        }
        
        // Check if service plan exists for this date
        const currentDate = new Date(year, month, day);
        const dateKey = formatDateKey(currentDate);
        
        if (servicePlans[dateKey]) {
            const servicePlan = servicePlans[dateKey];
            const planNameElement = document.createElement('div');
            planNameElement.className = 'calendar-service-plan-name';
            
            // Show complete name without truncation
            planNameElement.textContent = servicePlan.name;
            dayElement.appendChild(planNameElement);
            dayElement.classList.add('has-service-plan');
            
            // Apply highlight color if set
            if (servicePlan.highlightColor) {
                dayElement.style.backgroundColor = servicePlan.highlightColor;
                dayElement.style.color = '#ffffff';
            }
        }
        
        dayElement.addEventListener('click', () => {
            selectDay(dayElement, day, month, year);
        });
        
        calendarGrid.appendChild(dayElement);
    }
}

function getDaysInMonth(month, year) {
    const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    
    const daysPerMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return daysPerMonth[month];
}

function selectDay(dayElement, day, month, year) {
    // Remove previous selection
    const allDays = document.querySelectorAll('.calendar-day:not(.empty)');
    allDays.forEach(d => d.classList.remove('selected'));
    
    // Add selection to clicked day
    dayElement.classList.add('selected');
    
    // Update selected date
    selectedDay = day;
    selectedDate = new Date(year, month, day);
    
    // Check if service plan exists for this date
    const dateKey = formatDateKey(selectedDate);
    
    if (servicePlans[dateKey]) {
        currentServicePlan = servicePlans[dateKey];
        openSharedServicePlanViewer();
    } else {
        // No service plan for this date
        alert('Nenhum plano de serviço para esta data.');
    }
}

function formatDateKey(date) {
    // Handle both Date objects and string dates
    let dateObj;
    
    if (date instanceof Date) {
        dateObj = date;
    } else if (typeof date === 'string') {
        // If it's already a string in YYYY-MM-DD format, return it
        if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return date;
        }
        // Otherwise try to parse it
        dateObj = new Date(date);
    } else {
        // Fallback: try to convert to Date
        dateObj = new Date(date);
    }
    
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
}

function formatDateForDisplay(date) {
    // Handle both Date objects and string dates
    let dateObj;
    
    if (date instanceof Date) {
        dateObj = date;
    } else if (typeof date === 'string') {
        dateObj = new Date(date);
    } else {
        dateObj = new Date(date);
    }
    
    const day = dateObj.getDate();
    const month = MONTHS[dateObj.getMonth()];
    const year = dateObj.getFullYear();

    return `${day} de ${month} de ${year}`;
}

// ========================================
// SHARED SERVICE PLAN VIEWER
// ========================================

function openSharedServicePlanViewer() {
    // Use side panel instead of editor section
    openSidePanel();
}

function closeSharedServicePlanViewer() {
    closeSidePanel();
    
    // Clear selection
    const allDays = document.querySelectorAll('.calendar-day:not(.empty)');
    allDays.forEach(d => d.classList.remove('selected'));
    selectedDay = null;
    selectedDate = null;
    currentServicePlan = null;
}

// ========================================
// SIDE PANEL SYSTEM (SHARED MODE)
// ========================================

function initSidePanel() {
    const overlay = document.getElementById('sidePanelOverlay');
    const closeBtn = document.getElementById('closeSidePanel');
    const editorSection = document.getElementById('sidePanelEditorSection');
    const backBtn = document.getElementById('sidePanelBackBtn');
    
    // Close button
    closeBtn.addEventListener('click', closeSidePanel);
    
    // Back button in editor
    backBtn.addEventListener('click', handleSidePanelBack);
    
    // Close when clicking outside
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeSidePanel();
        }
    });
}

function openSidePanel() {
    if (!selectedDate) return;
    
    const overlay = document.getElementById('sidePanelOverlay');
    const editorSection = document.getElementById('sidePanelEditorSection');
    
    // Format date for display
    const formattedDate = formatDateForDisplay(selectedDate);
    const dayName = DAYS_OF_WEEK_FULL[selectedDate.getDay()];
    
    document.getElementById('sidePanelDate').textContent = formattedDate;
    document.getElementById('sidePanelDayName').textContent = dayName;
    
    // Show editor section directly (shared mode)
    editorSection.style.display = 'flex';
    
    // Update editor plan name
    document.getElementById('sidePanelEditorPlanName').textContent = currentServicePlan.name;
    
    // Render music items only
    renderSharedMusicItems();
    
    // Show overlay
    overlay.classList.add('active');
}

function closeSidePanel() {
    const overlay = document.getElementById('sidePanelOverlay');
    const editorSection = document.getElementById('sidePanelEditorSection');
    
    overlay.classList.remove('active');
    editorSection.style.display = 'none';
}

function handleSidePanelBack() {
    closeSidePanel();
}

function renderSharedMusicItems() {
    const itemsList = document.getElementById('sidePanelItemsContainer');
    const emptyState = document.getElementById('emptyState');
    
    if (!itemsList) {
        console.error('[SHARED] sidePanelItemsContainer not found');
        return;
    }
    
    // Clear current items
    itemsList.innerHTML = '';
    
    // Filter for music items only
    const musicItems = currentServicePlan.items.filter(item => item.type === 'MUSIC');
    
    if (musicItems.length === 0) {
        // Show empty state
        if (emptyState) {
            itemsList.innerHTML = `
                <div class="side-panel-empty-state">
                    <div class="side-panel-empty-state-title">NENHUMA MÚSICA</div>
                    <div class="side-panel-empty-state-text">Este plano de serviço não possui músicas.</div>
                </div>
            `;
        }
    } else {
        // Render each music item
        musicItems.forEach((item, index) => {
            const itemElement = createSharedMusicItemElement(item, index);
            itemsList.appendChild(itemElement);
        });
    }
}

function createSharedMusicItemElement(item, index) {
    const itemElement = document.createElement('div');
    itemElement.className = 'service-plan-item';
    
    const timeDisplay = item.time ? item.time : '';
    const typeDisplay = ITEM_TYPES[item.type] || item.type;
    const itemNumber = String(index + 1).padStart(2, '0');
    const typeIcon = getTypeIcon(item.type);
    
    itemElement.innerHTML = `
        <div class="item-number">${itemNumber}</div>
        <div class="item-icon">${typeIcon}</div>
        <div class="item-details">
            <div class="item-header">
                <span class="item-type">${typeDisplay}</span>
                ${timeDisplay ? `<span class="item-time">${timeDisplay}</span>` : ''}
            </div>
            <div class="item-name">${item.name}</div>
            ${item.note ? `<div class="item-note">${item.note}</div>` : ''}
        </div>
    `;
    
    return itemElement;
}

function getTypeIcon(type) {
    const icons = {
        'OPENING': '◉',
        'MUSIC': '♪',
        'MESSAGE': '◉',
        'OFFERING': '◉',
        'COMMUNION': '◉',
        'PRAYER': '◉',
        'ANNOUNCEMENTS': '◉',
        'VIDEO': '◉',
        'INSTRUMENTAL': '♪',
        'BREAK': '◉',
        'CLOSING': '◉',
        'CUSTOM': '◉'
    };
    return icons[type] || '◉';
}

function showError(message) {
    const calendarSection = document.getElementById('calendarSection');
    calendarSection.innerHTML = `
        <div class="error-state">
            <div class="error-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
            </div>
            <h2 class="error-title">Erro</h2>
            <p class="error-description">${message}</p>
        </div>
    `;
}