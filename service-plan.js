// ========================================
// SERVICE PLAN PAGE - MONTH CAROUSEL & CALENDAR
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

let currentMonth = new Date().getMonth(); // Current month (0-indexed)
let currentYear = 2026; // Fixed year for testing
let selectedDay = null;
let selectedDate = null;

// Service Plans storage (key: date string, value: service plan object)
let servicePlans = {}; // Example: { "2025-09-20": { id, name, date, items } }

// Firestore state
let servicePlansListener = null;
let isLoadingServicePlans = false;

// Current Service Plan data structure
let currentServicePlan = {
    id: null,
    name: '',
    date: null,
    items: []
};

let editingItemId = null;
let deletingItemId = null;

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
    // Start with loading state
    isLoadingServicePlans = true;
    showLoadingState();
    
    initMonthCarousel();
    renderCalendar(currentMonth, currentYear);
    initSidePanel();
    initEditorEventListeners();
    
    // Wait for Firebase to be available before initializing Service Plans
    waitForFirebaseAndInit();
});

function waitForFirebaseAndInit() {
    const maxAttempts = 50; // 5 seconds
    let attempts = 0;
    
    const checkFirebase = setInterval(() => {
        attempts++;
        
        if (window.firebaseAuth && window.firebaseDB) {
            clearInterval(checkFirebase);
            console.log('[SERVICE PLAN] Firebase is available, initializing Service Plans...');
            initFirebaseServicePlans();
        } else if (attempts >= maxAttempts) {
            clearInterval(checkFirebase);
            console.error('[SERVICE PLAN] Firebase not available after timeout');
            hideLoadingState();
            showError('Firebase não está disponível. Verifique sua conexão.');
        }
    }, 100);
}

// ========================================
// MONTH CAROUSEL
// ========================================

function initMonthCarousel() {
    const track = document.getElementById('monthCarouselTrack');
    
    // Generate month items
    MONTHS.forEach((month, index) => {
        const monthItem = document.createElement('div');
        monthItem.className = 'month-item';
        monthItem.dataset.monthIndex = index;
        
        if (index === currentMonth) {
            monthItem.classList.add('active');
        }
        
        const monthSpan = document.createElement('span');
        monthSpan.textContent = month;
        monthItem.appendChild(monthSpan);
        
        monthItem.addEventListener('click', () => {
            selectMonth(index);
        });
        
        track.appendChild(monthItem);
    });
    
    // Update month visual states based on Service Plans
    updateMonthVisualStates();
    
    // Setup touch/swipe support (after elements are created)
    setupCarouselSwipe();
}

function selectMonth(monthIndex) {
    currentMonth = monthIndex;
    
    // Update active state
    const monthItems = document.querySelectorAll('.month-item');
    monthItems.forEach((item, index) => {
        if (index === monthIndex) {
            item.classList.add('active');
            // Scroll to selected month
            item.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        } else {
            item.classList.remove('active');
        }
    });
    
    // Update calendar
    selectedDay = null;
    renderCalendar(currentMonth, currentYear);
}

function updateMonthVisualStates() {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonthIndex = today.getMonth();
    
    const monthItems = document.querySelectorAll('.month-item');
    
    monthItems.forEach((item, index) => {
        // Remove previous visual state
        item.classList.remove('month-faded');
        
        // Skip current and future months - they should be normal
        if (index >= currentMonthIndex) {
            return;
        }
        
        // For past months, check if there are any Service Plans
        const hasServicePlanInMonth = checkMonthHasServicePlan(index, currentYear);
        
        if (!hasServicePlanInMonth) {
            item.classList.add('month-faded');
        }
    });
}

function checkMonthHasServicePlan(monthIndex, year) {
    // Check if there are any Service Plans in the given month/year
    for (const dateKey in servicePlans) {
        if (servicePlans.hasOwnProperty(dateKey)) {
            // dateKey format is "YYYY-MM-DD"
            const parts = dateKey.split('-');
            if (parts.length === 3) {
                const planYear = parseInt(parts[0], 10);
                const planMonth = parseInt(parts[1], 10) - 1; // Convert to 0-indexed month
                
                if (planYear === year && planMonth === monthIndex) {
                    return true;
                }
            }
        }
    }
    return false;
}

function setupCarouselSwipe() {
    const carousel = document.getElementById('monthCarousel');
    const track = document.getElementById('monthCarouselTrack');
    
    // Track dragging state for click prevention
    let isDragging = false;
    let hasDragged = false;
    let startX = 0;
    let initialScrollLeft = 0;
    const dragThreshold = 5; // Minimum pixels to consider it a drag
    
    // === DESKTOP / MOUSE EVENTS ===
    
    carousel.addEventListener('mousedown', (e) => {
        isDragging = true;
        hasDragged = false;
        startX = e.pageX;
        initialScrollLeft = carousel.scrollLeft;
        carousel.style.cursor = 'grabbing';
        carousel.style.userSelect = 'none';
    });
    
    carousel.addEventListener('mouseleave', () => {
        if (isDragging) {
            isDragging = false;
            carousel.style.cursor = 'grab';
            carousel.style.userSelect = '';
        }
    });
    
    carousel.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            carousel.style.cursor = 'grab';
            carousel.style.userSelect = '';
        }
    });
    
    carousel.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        e.preventDefault();
        
        const currentX = e.pageX;
        const walk = (currentX - startX) * 1.2; // Speed multiplier
        carousel.scrollLeft = initialScrollLeft - walk;
        
        // Check if movement exceeds threshold
        if (Math.abs(currentX - startX) > dragThreshold) {
            hasDragged = true;
        }
    });
    
    // === CLICK PREVENTION FOR DESKTOP ===
    
    // Add click prevention to existing month items
    const monthItems = carousel.querySelectorAll('.month-item');
    monthItems.forEach(item => {
        item.addEventListener('click', (e) => {
            if (hasDragged) {
                e.preventDefault();
                e.stopPropagation();
                hasDragged = false; // Reset for next interaction
                return;
            }
            // Allow normal click if no significant drag occurred
        }, true); // Use capture phase to ensure it runs before the original handler
    });
    
    // === TOUCH / MOBILE EVENTS ===
    
    let touchStartX = 0;
    let touchInitialScrollLeft = 0;
    let touchHasDragged = false;
    
    carousel.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].pageX;
        touchInitialScrollLeft = carousel.scrollLeft;
        touchHasDragged = false;
    }, { passive: true });
    
    carousel.addEventListener('touchmove', (e) => {
        const currentX = e.touches[0].pageX;
        const walk = (currentX - touchStartX) * 1.2;
        carousel.scrollLeft = touchInitialScrollLeft - walk;
        
        // Check if movement exceeds threshold
        if (Math.abs(currentX - touchStartX) > dragThreshold) {
            touchHasDragged = true;
        }
    }, { passive: true });
    
    carousel.addEventListener('touchend', (e) => {
        if (touchHasDragged) {
            // Prevent click if significant drag occurred
            e.preventDefault();
            touchHasDragged = false;
        }
    }, { passive: false });
    
}

// ========================================
// CALENDAR
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
    selectedDay = { day, month, year };
    
    // Create date object
    selectedDate = new Date(year, month, day);
    
    // Open side panel
    openSidePanel();
}

// ========================================
// SIDE PANEL SYSTEM
// ========================================

function initSidePanel() {
    const overlay = document.getElementById('sidePanelOverlay');
    const closeBtn = document.getElementById('closeSidePanel');
    const createSection = document.getElementById('sidePanelCreateSection');
    const viewSection = document.getElementById('sidePanelViewSection');
    
    // Close button
    closeBtn.addEventListener('click', closeSidePanel);
    
    // Create service plan button
    const createBtn = document.getElementById('sidePanelCreateBtn');
    createBtn.addEventListener('click', handleSidePanelCreate);
    
    // Open service plan button
    const openBtn = document.getElementById('sidePanelOpenBtn');
    openBtn.addEventListener('click', handleSidePanelOpen);
    
    // Edit name button
    const editNameBtn = document.getElementById('sidePanelEditNameBtn');
    editNameBtn.addEventListener('click', handleSidePanelEditName);
    
    // Share month button
    const shareMonthBtn = document.getElementById('sidePanelShareMonthBtn');
    if (shareMonthBtn) {
        shareMonthBtn.addEventListener('click', handleSidePanelShareMonth);
    }
    
    // Day color palette
    const colorPalette = document.getElementById('dayColorPalette');
    if (colorPalette) {
        const colorOptions = colorPalette.querySelectorAll('.color-option');
        colorOptions.forEach(option => {
            option.addEventListener('click', () => handleDayColorSelect(option));
        });
    }
    
    // Delete service plan button
    const deleteBtn = document.getElementById('sidePanelDeleteBtn');
    deleteBtn.addEventListener('click', handleSidePanelDelete);
    
    // Back button in editor
    const backBtn = document.getElementById('sidePanelBackBtn');
    backBtn.addEventListener('click', handleSidePanelBack);
    
    // Add item button in editor
    const addItemBtn = document.getElementById('sidePanelAddItemBtn');
    addItemBtn.addEventListener('click', handleSidePanelAddItem);
    
    // Input validation
    const nameInput = document.getElementById('sidePanelServicePlanNameInput');
    nameInput.addEventListener('input', () => {
        nameInput.classList.remove('error');
        document.getElementById('sidePanelNameError').classList.remove('visible');
    });
    
    // Enter key to submit
    nameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSidePanelCreate();
        }
    });
    
    // ESC key to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeSidePanel();
        }
    });
    
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
    const createSection = document.getElementById('sidePanelCreateSection');
    const viewSection = document.getElementById('sidePanelViewSection');
    
    // Format date for display
    const formattedDate = formatDateForDisplay(selectedDate);
    const dayName = DAYS_OF_WEEK_FULL[selectedDate.getDay()];
    
    document.getElementById('sidePanelDate').textContent = formattedDate;
    document.getElementById('sidePanelDayName').textContent = dayName;
    
    // Check if service plan exists
    const dateKey = formatDateKey(selectedDate);
    
    if (servicePlans[dateKey]) {
        // Show view section
        createSection.style.display = 'none';
        viewSection.style.display = 'flex';
        
        // Update service plan name
        document.getElementById('sidePanelServicePlanNameDisplay').textContent = servicePlans[dateKey].name;
        
        // Update color palette selection
        updateColorPaletteSelection(servicePlans[dateKey].highlightColor);
    } else {
        // Show create section
        createSection.style.display = 'flex';
        viewSection.style.display = 'none';
        
        // Clear input
        document.getElementById('sidePanelServicePlanNameInput').value = '';
        document.getElementById('sidePanelServicePlanNameInput').classList.remove('error');
        document.getElementById('sidePanelNameError').classList.remove('visible');
    }
    
    // Show overlay
    overlay.classList.add('active');
    
    // Focus on input or button
    setTimeout(() => {
        if (servicePlans[dateKey]) {
            document.getElementById('sidePanelOpenBtn').focus();
        } else {
            document.getElementById('sidePanelServicePlanNameInput').focus();
        }
    }, 100);
}

function closeSidePanel() {
    const overlay = document.getElementById('sidePanelOverlay');
    overlay.classList.remove('active');
}

function handleSidePanelCreate() {
    const nameInput = document.getElementById('sidePanelServicePlanNameInput');
    const name = nameInput.value.trim();
    
    // Validation
    if (!name) {
        nameInput.classList.add('error');
        document.getElementById('sidePanelNameError').classList.add('visible');
        nameInput.focus();
        return;
    }
    
    // Check if this is a new plan or editing existing
    const dateKey = formatDateKey(selectedDate);
    const existingPlan = servicePlans[dateKey];
    
    if (existingPlan) {
        // Update existing plan name
        existingPlan.name = name;
        currentServicePlan = existingPlan;
        
        // Save to Firestore
        saveServicePlanToFirestore(currentServicePlan);
    } else {
        // Create new service plan
        const dateString = formatDateKey(selectedDate);
        currentServicePlan = {
            id: generateUniqueId(),
            name: name,
            date: dateString,
            items: []
        };
        
        // Store in service plans by date
        servicePlans[dateKey] = currentServicePlan;
        
        console.log('Service Plan Created:', {
            date: selectedDate,
            dateString: dateString,
            formattedDate: formatDateForDisplay(selectedDate),
            name: name,
            servicePlan: currentServicePlan,
            dateKey: dateKey
        });
        
        // Save to Firestore
        saveServicePlanToFirestore(currentServicePlan);
    }
    
    // Update side panel to show view section
    const createSection = document.getElementById('sidePanelCreateSection');
    const viewSection = document.getElementById('sidePanelViewSection');
    
    createSection.style.display = 'none';
    viewSection.style.display = 'flex';
    
    // Use the correct element ID for displaying the name
    document.getElementById('sidePanelServicePlanNameDisplay').textContent = name;
    
    // Re-render calendar to show the service plan name
    renderCalendar(currentMonth, currentYear);
    
    // Don't clear selection - user may want to open the editor immediately
    // const allDays = document.querySelectorAll('.calendar-day:not(.empty)');
    // allDays.forEach(d => d.classList.remove('selected'));
    // selectedDay = null;
    // selectedDate = null;
}

function handleSidePanelOpen() {
    const dateKey = formatDateKey(selectedDate);
    
    if (dateKey && servicePlans[dateKey]) {
        currentServicePlan = servicePlans[dateKey];
        selectedDate = currentServicePlan.date; // Restore selectedDate
        
        // Show editor section in side panel
        const viewSection = document.getElementById('sidePanelViewSection');
        const editorSection = document.getElementById('sidePanelEditorSection');
        
        viewSection.style.display = 'none';
        editorSection.style.display = 'flex';
        
        // Update editor plan name
        document.getElementById('sidePanelEditorPlanName').textContent = currentServicePlan.name;
        
        // Render items
        renderSidePanelItems();
    }
}

function handleSidePanelBack() {
    const viewSection = document.getElementById('sidePanelViewSection');
    const editorSection = document.getElementById('sidePanelEditorSection');
    
    editorSection.style.display = 'none';
    viewSection.style.display = 'flex';
}

function handleSidePanelAddItem() {
    // Open the existing add item modal
    openAddItemModal();
}

function renderSidePanelItems() {
    const container = document.getElementById('sidePanelItemsContainer');
    container.innerHTML = '';
    
    if (!currentServicePlan.items || currentServicePlan.items.length === 0) {
        container.innerHTML = `
            <div class="side-panel-empty-state">
                <div class="side-panel-empty-state-title">NENHUM ITEM AINDA</div>
                <div class="side-panel-empty-state-text">Adicione o primeiro item ao seu serviço.</div>
            </div>
        `;
        return;
    }
    
    currentServicePlan.items.forEach((item, index) => {
        const itemElement = document.createElement('div');
        itemElement.className = 'side-panel-item';
        itemElement.dataset.index = index;
        itemElement.draggable = true;
        
        const timeDisplay = item.time ? item.time : '';
        const typeLabel = ITEM_TYPES[item.type] || item.type;
        const itemNumber = String(index + 1).padStart(2, '0');
        const typeIcon = getTypeIcon(item.type);
        
        itemElement.innerHTML = `
            <div class="side-panel-item-main">
                <span class="side-panel-item-number">${itemNumber}</span>
                <span class="side-panel-item-icon">${typeIcon}</span>
                <span class="side-panel-item-type">${typeLabel}</span>
                ${timeDisplay ? `<span class="side-panel-item-time">${timeDisplay}</span>` : ''}
            </div>
            <div class="side-panel-item-name">${item.name}</div>
            <div class="side-panel-item-actions">
                <button class="side-panel-item-action-btn" onclick="handleSidePanelEditItem(${index})" title="Editar">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                </button>
                <button class="side-panel-item-action-btn" onclick="handleSidePanelDeleteItem(${index})" title="Excluir">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
            </div>
        `;
        
        // Drag and drop handlers
        itemElement.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', index);
            itemElement.classList.add('dragging');
        });
        
        itemElement.addEventListener('dragend', () => {
            itemElement.classList.remove('dragging');
        });
        
        itemElement.addEventListener('dragover', (e) => {
            e.preventDefault();
            const dragging = document.querySelector('.dragging');
            if (dragging && dragging !== itemElement) {
                const rect = itemElement.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                if (e.clientY < midY) {
                    container.insertBefore(dragging, itemElement);
                } else {
                    container.insertBefore(dragging, itemElement.nextSibling);
                }
            }
        });
        
        itemElement.addEventListener('drop', (e) => {
            e.preventDefault();
            const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
            const toIndex = index;
            
            if (fromIndex !== toIndex) {
                // Reorder items
                const item = currentServicePlan.items.splice(fromIndex, 1)[0];
                currentServicePlan.items.splice(toIndex, 0, item);
                
                // Update service plan in storage
                const dateKey = formatDateKey(selectedDate);
                servicePlans[dateKey] = currentServicePlan;
                
                // Save to Firestore
                saveServicePlanToFirestore(currentServicePlan);
                
                // Re-render
                renderSidePanelItems();
            }
        });
        
        container.appendChild(itemElement);
    });
}

function handleSidePanelEditItem(index) {
    editingItemId = currentServicePlan.items[index].id;
    openEditItemModal();
}

function handleSidePanelDeleteItem(index) {
    const item = currentServicePlan.items[index];
    if (confirm(`Tem certeza que deseja remover "${item.name}"?`)) {
        currentServicePlan.items.splice(index, 1);
        
        // Update service plan in storage
        const dateKey = formatDateKey(selectedDate);
        servicePlans[dateKey] = currentServicePlan;
        
        // Save to Firestore
        saveServicePlanToFirestore(currentServicePlan);
        
        // Re-render
        renderSidePanelItems();
    }
}

function handleSidePanelEditName() {
    const dateKey = formatDateKey(selectedDate);
    
    if (dateKey && servicePlans[dateKey]) {
        // Switch to create mode with existing name
        const createSection = document.getElementById('sidePanelCreateSection');
        const viewSection = document.getElementById('sidePanelViewSection');
        
        createSection.style.display = 'flex';
        viewSection.style.display = 'none';
        
        // Pre-fill with existing name
        document.getElementById('sidePanelServicePlanNameInput').value = servicePlans[dateKey].name;
        document.getElementById('sidePanelServicePlanNameInput').focus();
    }
}

function handleSidePanelDelete() {
    const dateKey = formatDateKey(selectedDate);
    
    if (dateKey && servicePlans[dateKey] && confirm('Tem certeza que deseja excluir este Service Plan?')) {
        // Delete from Firestore
        deleteServicePlanFromFirestore(dateKey).then((success) => {
            if (success) {
                // Delete from local storage
                delete servicePlans[dateKey];
                
                console.log('Service Plan deleted for date:', dateKey);
                
                // Close side panel
                closeSidePanel();
                
                // Re-render calendar
                renderCalendar(currentMonth, currentYear);
                
                // Update month visual states
                updateMonthVisualStates();
                
                // Clear selection
                const allDays = document.querySelectorAll('.calendar-day:not(.empty)');
                allDays.forEach(d => d.classList.remove('selected'));
                selectedDay = null;
                selectedDate = null;
            }
        });
    }
}

function handleSidePanelShareMonth() {
    const currentUser = window.firebaseAuth?.auth?.currentUser;
    if (!currentUser) {
        alert('Você precisa estar logado para compartilhar.');
        return;
    }
    
    // Generate share link for current month
    const shareUrl = generateShareLink(currentMonth, currentYear, currentUser.uid);
    
    // Copy to clipboard
    navigator.clipboard.writeText(shareUrl).then(() => {
        alert('Link de compartilhamento copiado para a área de transferência!');
    }).catch(err => {
        console.error('Failed to copy:', err);
        // Fallback: show the link
        prompt('Copie este link de compartilhamento:', shareUrl);
    });
}

function generateShareLink(month, year, userId) {
    const baseUrl = window.location.origin;
    const sharedPage = 'service-plan-shared.html';
    const params = new URLSearchParams({
        month: month,
        year: year,
        userId: userId
    });
    
    return `${baseUrl}/${sharedPage}?${params.toString()}`;
}

function handleDayColorSelect(option) {
    const color = option.dataset.color;
    const dateKey = formatDateKey(selectedDate);
    
    if (dateKey && servicePlans[dateKey]) {
        // Update color in service plan
        servicePlans[dateKey].highlightColor = color;
        
        // Update UI selection
        const colorOptions = document.querySelectorAll('.color-option');
        colorOptions.forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
        
        // Save to Firestore
        saveServicePlanToFirestore(servicePlans[dateKey]);
        
        // Re-render calendar to show the color
        renderCalendar(currentMonth, currentYear);
        
        console.log('[SERVICE PLAN] Day color updated:', dateKey, color);
    }
}

function updateColorPaletteSelection(currentColor) {
    const colorOptions = document.querySelectorAll('.color-option');
    colorOptions.forEach(opt => {
        opt.classList.remove('selected');
        if (opt.dataset.color === currentColor) {
            opt.classList.add('selected');
        }
    });
}

// ========================================
// FIREBASE SERVICE PLANS
// ========================================

function initFirebaseServicePlans() {
    console.log('[SERVICE PLAN] Initializing Firebase Service Plans...');
    
    // Listen to auth state changes
    if (window.firebaseAuth && window.firebaseAuth.onAuthStateChanged) {
        window.firebaseAuth.onAuthStateChanged(window.firebaseAuth.auth, (user) => {
            if (user) {
                console.log('[SERVICE PLAN] User logged in:', user.uid);
                loadServicePlans(user.uid);
            } else {
                console.log('[SERVICE PLAN] User logged out');
                clearServicePlans();
            }
        });
    } else {
        console.error('[SERVICE PLAN] Firebase Auth not available');
    }
}

function loadServicePlans(userId) {
    if (!window.firebaseDB) {
        console.error('[SERVICE PLAN] Firebase DB not available');
        return;
    }

    isLoadingServicePlans = true;
    showLoadingState();

    console.log('[SERVICE PLAN] Loading service plans for user:', userId);

    const { db, collection, query, onSnapshot } = window.firebaseDB;
    const servicePlansRef = collection(db, 'users', userId, 'servicePlans');

    // Real-time listener
    servicePlansListener = onSnapshot(
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
                    highlightColor: data.highlightColor || null,
                    createdAt: data.createdAt,
                    updatedAt: data.updatedAt
                };
                console.log('[SERVICE PLAN] Loaded plan:', dateKey, data.name);
            });

            servicePlans = plans;
            isLoadingServicePlans = false;
            hideLoadingState();
            renderCalendar(currentMonth, currentYear);
            updateMonthVisualStates();

            console.log('[SERVICE PLAN] Service Plans loaded:', Object.keys(plans).length, plans);
        },
        (error) => {
            console.error('[SERVICE PLAN] Error loading service plans:', error);
            isLoadingServicePlans = false;
            hideLoadingState();
            showError('Unable to load your Service Plans. Please try again.');
        }
    );
}

function clearServicePlans() {
    if (servicePlansListener) {
        servicePlansListener();
        servicePlansListener = null;
    }

    servicePlans = {};
    renderCalendar(currentMonth, currentYear);
    updateMonthVisualStates();
    console.log('[SERVICE PLAN] Service Plans cleared');
}

async function saveServicePlanToFirestore(servicePlan) {
    if (!window.firebaseDB) {
        console.error('[SERVICE PLAN] Firebase DB not available');
        return false;
    }

    const currentUser = window.firebaseAuth?.auth?.currentUser;
    if (!currentUser) {
        console.error('[SERVICE PLAN] No user logged in');
        showError('Você precisa estar logado para salvar Service Plans.');
        return false;
    }

    try {
        const { db, doc, setDoc, serverTimestamp } = window.firebaseDB;
        const userId = currentUser.uid;
        const planId = servicePlan.id;
        const servicePlanRef = doc(db, 'users', userId, 'servicePlans', planId);

        // Convert date to string if it's a Date object
        const dateString = servicePlan.date instanceof Date 
            ? formatDateKey(servicePlan.date) 
            : servicePlan.date;

        const planData = {
            name: servicePlan.name,
            date: dateString,
            items: servicePlan.items || [],
            highlightColor: servicePlan.highlightColor || null,
            updatedAt: serverTimestamp()
        };

        // Check if it's a new plan (no createdAt)
        const existingPlan = servicePlans[dateString];
        if (!existingPlan || !existingPlan.createdAt) {
            planData.createdAt = serverTimestamp();
        } else {
            planData.createdAt = existingPlan.createdAt;
        }

        console.log('[SERVICE PLAN] Saving service plan:', {
            userId,
            planId,
            planData
        });

        await setDoc(servicePlanRef, planData, { merge: true });

        console.log('[SERVICE PLAN] Service Plan saved successfully:', planId);
        
        // Update month visual states after saving
        updateMonthVisualStates();
        showSuccess('Service Plan saved');
        return true;
    } catch (error) {
        console.error('[SERVICE PLAN] Error saving service plan:', error);
        showError('Unable to save changes. Please try again.');
        return false;
    }
}

async function deleteServicePlanFromFirestore(dateKey) {
    if (!window.firebaseDB) {
        console.error('[SERVICE PLAN] Firebase DB not available');
        return false;
    }

    const currentUser = window.firebaseAuth?.auth?.currentUser;
    if (!currentUser) {
        console.error('[SERVICE PLAN] No user logged in');
        return false;
    }

    try {
        const { db, doc, deleteDoc } = window.firebaseDB;
        const userId = currentUser.uid;
        const plan = servicePlans[dateKey];

        if (!plan || !plan.id) {
            console.error('[SERVICE PLAN] Service Plan not found');
            return false;
        }

        const servicePlanRef = doc(db, 'users', userId, 'servicePlans', plan.id);
        await deleteDoc(servicePlanRef);

        console.log('[SERVICE PLAN] Service Plan deleted:', plan.id);
        return true;
    } catch (error) {
        console.error('[SERVICE PLAN] Error deleting service plan:', error);
        showError('Unable to delete Service Plan. Please try again.');
        return false;
    }
}

function showLoadingState() {
    const calendarSection = document.getElementById('calendarSection');
    const loadingText = document.getElementById('loadingText');
    if (calendarSection) {
        calendarSection.classList.add('loading');
    }
    if (loadingText) {
        loadingText.style.display = 'block';
    }
}

function hideLoadingState() {
    const calendarSection = document.getElementById('calendarSection');
    const loadingText = document.getElementById('loadingText');
    if (calendarSection) {
        calendarSection.classList.remove('loading');
    }
    if (loadingText) {
        loadingText.style.display = 'none';
    }
}

function showEmptyState() {
    const calendarSection = document.getElementById('calendarSection');
    if (calendarSection) {
        calendarSection.classList.add('empty');
    }
}

function hideEmptyState() {
    const calendarSection = document.getElementById('calendarSection');
    if (calendarSection) {
        calendarSection.classList.remove('empty');
    }
}

function showError(message) {
    console.error('[SERVICE PLAN]', message);
    // TODO: Show toast notification if the app has one
    // For now, just log to console
}

function showSuccess(message) {
    console.log('[SERVICE PLAN]', message);
    // TODO: Show toast notification if the app has one
    // For now, just log to console
}

function formatDateForDisplay(date) {
    const dayName = DAYS_OF_WEEK_FULL[date.getDay()];
    const monthName = MONTHS[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    
    return `${day} de ${monthName} de ${year}`;
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

// ========================================
// SERVICE PLAN EDITOR
// ========================================

function openServicePlanEditor() {
    const calendarSection = document.getElementById('calendarSection');
    const editorSection = document.getElementById('servicePlanEditorSection');
    
    // Update editor header info
    document.getElementById('editorServicePlanName').textContent = currentServicePlan.name;
    document.getElementById('editorServicePlanDate').textContent = formatDateForDisplay(currentServicePlan.date);
    
    // Show editor, hide calendar
    calendarSection.style.display = 'none';
    editorSection.style.display = 'block';
    
    // Render items
    renderServicePlanItems();
    
    // Initialize editor event listeners
    initEditorEventListeners();
}

function closeServicePlanEditor() {
    const calendarSection = document.getElementById('calendarSection');
    const editorSection = document.getElementById('servicePlanEditorSection');
    
    // Show calendar, hide editor
    calendarSection.style.display = 'block';
    editorSection.style.display = 'none';
    
    // Reset current service plan reference (but keep it in storage)
    currentServicePlan = {
        id: null,
        name: '',
        date: null,
        items: []
    };
    
    // Clear day selection
    const allDays = document.querySelectorAll('.calendar-day:not(.empty)');
    allDays.forEach(d => d.classList.remove('selected'));
    selectedDay = null;
    selectedDate = null;
    
    // Re-render calendar to show service plan names
    renderCalendar(currentMonth, currentYear);
}

function initEditorEventListeners() {
    // Back to calendar button
    const backBtn = document.getElementById('backToCalendarBtn');
    backBtn.addEventListener('click', closeServicePlanEditor);
    
    // Add item buttons
    const addItemBtn = document.getElementById('addItemBtn');
    const emptyAddItemBtn = document.getElementById('emptyAddItemBtn');
    
    addItemBtn.addEventListener('click', openAddItemModal);
    emptyAddItemBtn.addEventListener('click', openAddItemModal);
    
    // Add item modal
    const closeAddItemModalBtn = document.getElementById('closeAddItemModal');
    const cancelAddItemBtn = document.getElementById('cancelAddItem');
    const confirmAddItemBtn = document.getElementById('confirmAddItem');
    
    closeAddItemModalBtn.addEventListener('click', closeAddItemModal);
    cancelAddItemBtn.addEventListener('click', closeAddItemModal);
    confirmAddItemBtn.addEventListener('click', handleAddItem);
    
    // Edit item modal
    const closeEditItemModalBtn = document.getElementById('closeEditItemModal');
    const cancelEditItemBtn = document.getElementById('cancelEditItem');
    const confirmEditItemBtn = document.getElementById('confirmEditItem');
    
    closeEditItemModalBtn.addEventListener('click', closeEditItemModal);
    cancelEditItemBtn.addEventListener('click', closeEditItemModal);
    confirmEditItemBtn.addEventListener('click', handleEditItem);
    
    // Delete item modal
    const closeDeleteItemModalBtn = document.getElementById('closeDeleteItemModal');
    const cancelDeleteItemBtn = document.getElementById('cancelDeleteItem');
    const confirmDeleteItemBtn = document.getElementById('confirmDeleteItem');
    
    closeDeleteItemModalBtn.addEventListener('click', closeDeleteItemModal);
    cancelDeleteItemBtn.addEventListener('click', closeDeleteItemModal);
    confirmDeleteItemBtn.addEventListener('click', handleDeleteItem);
    
    // Input validation
    document.getElementById('itemName').addEventListener('input', () => {
        document.getElementById('itemName').classList.remove('error');
        document.getElementById('itemNameError').classList.remove('visible');
    });
    
    document.getElementById('itemTime').addEventListener('input', () => {
        document.getElementById('itemTime').classList.remove('error');
        document.getElementById('itemTimeError').classList.remove('visible');
    });
    
    document.getElementById('editItemName').addEventListener('input', () => {
        document.getElementById('editItemName').classList.remove('error');
        document.getElementById('editItemNameError').classList.remove('visible');
    });
    
    document.getElementById('editItemTime').addEventListener('input', () => {
        document.getElementById('editItemTime').classList.remove('error');
        document.getElementById('editItemTimeError').classList.remove('visible');
    });
    
    // ESC key for modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (document.getElementById('deleteItemModal').classList.contains('active')) {
                closeDeleteItemModal();
            } else if (document.getElementById('editItemModal').classList.contains('active')) {
                closeEditItemModal();
            } else if (document.getElementById('addItemModal').classList.contains('active')) {
                closeAddItemModal();
            }
        }
    });
    
    // Close modals when clicking outside
    document.getElementById('addItemModal').addEventListener('click', (e) => {
        if (e.target.id === 'addItemModal') closeAddItemModal();
    });
    
    document.getElementById('editItemModal').addEventListener('click', (e) => {
        if (e.target.id === 'editItemModal') closeEditItemModal();
    });
    
    document.getElementById('deleteItemModal').addEventListener('click', (e) => {
        if (e.target.id === 'deleteItemModal') closeDeleteItemModal();
    });
}

function renderServicePlanItems() {
    const itemsList = document.getElementById('itemsList');
    const emptyState = document.getElementById('emptyState');
    
    // Clear current items
    itemsList.innerHTML = '';
    
    if (currentServicePlan.items.length === 0) {
        // Show empty state
        emptyState.style.display = 'flex';
        itemsList.style.display = 'none';
    } else {
        // Hide empty state, show items
        emptyState.style.display = 'none';
        itemsList.style.display = 'flex';
        
        // Render each item
        currentServicePlan.items.forEach((item, index) => {
            const itemElement = createServicePlanItemElement(item, index);
            itemsList.appendChild(itemElement);
        });
        
        // Initialize drag and drop
        initDragAndDrop();
    }
}

function createServicePlanItemElement(item, index) {
    const itemElement = document.createElement('div');
    itemElement.className = 'service-plan-item';
    itemElement.dataset.itemId = item.id;
    itemElement.draggable = true;
    
    const timeDisplay = item.time ? item.time : '';
    const typeDisplay = ITEM_TYPES[item.type] || item.type;
    const itemNumber = String(index + 1).padStart(2, '0');
    
    // Get icon based on type
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
        </div>
        <div class="item-actions">
            <button class="item-action-btn edit" data-item-id="${item.id}" aria-label="Editar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
            </button>
            <button class="item-action-btn delete" data-item-id="${item.id}" aria-label="Excluir">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
            </button>
        </div>
    `;
    
    // Add event listeners
    const editBtn = itemElement.querySelector('.edit');
    const deleteBtn = itemElement.querySelector('.delete');
    
    editBtn.addEventListener('click', () => openEditItemModal(item.id));
    deleteBtn.addEventListener('click', () => openDeleteItemModal(item.id));
    
    // Drag events
    itemElement.addEventListener('dragstart', handleDragStart);
    itemElement.addEventListener('dragend', handleDragEnd);
    itemElement.addEventListener('dragover', handleDragOver);
    itemElement.addEventListener('drop', handleDrop);
    itemElement.addEventListener('dragleave', handleDragLeave);
    
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

// ========================================
// ADD ITEM MODAL
// ========================================

function openAddItemModal() {
    const modal = document.getElementById('addItemModal');
    
    // Clear form
    document.getElementById('itemType').value = 'MUSIC';
    document.getElementById('itemName').value = '';
    document.getElementById('itemTime').value = '';
    
    // Clear errors
    document.getElementById('itemName').classList.remove('error');
    document.getElementById('itemNameError').classList.remove('visible');
    document.getElementById('itemTime').classList.remove('error');
    document.getElementById('itemTimeError').classList.remove('visible');
    
    // Show modal
    modal.classList.add('active');
    
    // Focus on name input
    setTimeout(() => {
        document.getElementById('itemName').focus();
    }, 100);
}

function closeAddItemModal() {
    const modal = document.getElementById('addItemModal');
    modal.classList.remove('active');
}

function handleAddItem() {
    const type = document.getElementById('itemType').value;
    const name = document.getElementById('itemName').value.trim();
    const time = document.getElementById('itemTime').value.trim();
    
    // Validation
    let hasError = false;
    
    if (!name) {
        document.getElementById('itemName').classList.add('error');
        document.getElementById('itemNameError').classList.add('visible');
        hasError = true;
    }
    
    if (time && !validateTimeFormat(time)) {
        document.getElementById('itemTime').classList.add('error');
        document.getElementById('itemTimeError').classList.add('visible');
        hasError = true;
    }
    
    if (hasError) return;
    
    // Create new item
    const newItem = {
        id: generateUniqueId(),
        type: type,
        name: name,
        time: time || null
    };
    
    // Add to service plan
    currentServicePlan.items.push(newItem);
    
    // Update service plan in storage
    const dateKey = formatDateKey(selectedDate);
    servicePlans[dateKey] = currentServicePlan;
    
    console.log('Item added:', newItem);
    console.log('Current service plan:', currentServicePlan);
    
    // Save to Firestore
    saveServicePlanToFirestore(currentServicePlan);
    
    // Close modal and re-render
    closeAddItemModal();
    renderServicePlanItems();
    
    // Also re-render side panel if it's open
    const editorSection = document.getElementById('sidePanelEditorSection');
    if (editorSection.style.display !== 'none') {
        renderSidePanelItems();
    }
}

// ========================================
// EDIT ITEM MODAL
// ========================================

function openEditItemModal(itemId) {
    const modal = document.getElementById('editItemModal');
    const item = currentServicePlan.items.find(i => i.id === itemId);
    
    if (!item) return;
    
    editingItemId = itemId;
    
    // Fill form with current values
    document.getElementById('editItemType').value = item.type;
    document.getElementById('editItemName').value = item.name;
    document.getElementById('editItemTime').value = item.time || '';
    
    // Clear errors
    document.getElementById('editItemName').classList.remove('error');
    document.getElementById('editItemNameError').classList.remove('visible');
    document.getElementById('editItemTime').classList.remove('error');
    document.getElementById('editItemTimeError').classList.remove('visible');
    
    // Show modal
    modal.classList.add('active');
    
    // Focus on name input
    setTimeout(() => {
        document.getElementById('editItemName').focus();
    }, 100);
}

function closeEditItemModal() {
    const modal = document.getElementById('editItemModal');
    modal.classList.remove('active');
    editingItemId = null;
}

function handleEditItem() {
    if (!editingItemId) return;
    
    const type = document.getElementById('editItemType').value;
    const name = document.getElementById('editItemName').value.trim();
    const time = document.getElementById('editItemTime').value.trim();
    
    // Validation
    let hasError = false;
    
    if (!name) {
        document.getElementById('editItemName').classList.add('error');
        document.getElementById('editItemNameError').classList.add('visible');
        hasError = true;
    }
    
    if (time && !validateTimeFormat(time)) {
        document.getElementById('editItemTime').classList.add('error');
        document.getElementById('editItemTimeError').classList.add('visible');
        hasError = true;
    }
    
    if (hasError) return;
    
    // Update item
    const itemIndex = currentServicePlan.items.findIndex(i => i.id === editingItemId);
    if (itemIndex !== -1) {
        currentServicePlan.items[itemIndex] = {
            ...currentServicePlan.items[itemIndex],
            type: type,
            name: name,
            time: time || null
        };
        
        // Update service plan in storage
        const dateKey = formatDateKey(selectedDate);
        servicePlans[dateKey] = currentServicePlan;
        
        console.log('Item updated:', currentServicePlan.items[itemIndex]);
        console.log('Current service plan:', currentServicePlan);
        
        // Save to Firestore
        saveServicePlanToFirestore(currentServicePlan);
    }
    
    // Close modal and re-render
    closeEditItemModal();
    renderServicePlanItems();
    
    // Also re-render side panel if it's open
    const editorSection = document.getElementById('sidePanelEditorSection');
    if (editorSection.style.display !== 'none') {
        renderSidePanelItems();
    }
}

// ========================================
// DELETE ITEM MODAL
// ========================================

function openDeleteItemModal(itemId) {
    const modal = document.getElementById('deleteItemModal');
    const item = currentServicePlan.items.find(i => i.id === itemId);
    
    if (!item) return;
    
    deletingItemId = itemId;
    
    // Show item name in confirmation
    document.getElementById('deleteItemName').textContent = `"${item.name}"`;
    
    // Show modal
    modal.classList.add('active');
}

function closeDeleteItemModal() {
    const modal = document.getElementById('deleteItemModal');
    modal.classList.remove('active');
    deletingItemId = null;
}

function handleDeleteItem() {
    if (!deletingItemId) return;
    
    // Remove item from service plan
    currentServicePlan.items = currentServicePlan.items.filter(i => i.id !== deletingItemId);
    
    // Update service plan in storage
    const dateKey = formatDateKey(selectedDate);
    servicePlans[dateKey] = currentServicePlan;
    
    console.log('Item deleted');
    console.log('Current service plan:', currentServicePlan);
    
    // Save to Firestore
    saveServicePlanToFirestore(currentServicePlan);
    
    // Close modal and re-render
    closeDeleteItemModal();
    renderServicePlanItems();
}

// ========================================
// DRAG AND DROP
// ========================================

let draggedItem = null;

function initDragAndDrop() {
    const items = document.querySelectorAll('.service-plan-item');
    items.forEach(item => {
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragend', handleDragEnd);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('drop', handleDrop);
        item.addEventListener('dragleave', handleDragLeave);
    });
}

function handleDragStart(e) {
    draggedItem = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    document.querySelectorAll('.service-plan-item').forEach(item => {
        item.classList.remove('drag-over');
    });
    draggedItem = null;
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (this !== draggedItem) {
        this.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    
    if (this !== draggedItem) {
        const draggedItemId = draggedItem.dataset.itemId;
        const targetItemId = this.dataset.itemId;
        
        const draggedIndex = currentServicePlan.items.findIndex(i => i.id === draggedItemId);
        const targetIndex = currentServicePlan.items.findIndex(i => i.id === targetItemId);
        
        if (draggedIndex !== -1 && targetIndex !== -1) {
            // Remove dragged item
            const [draggedItemData] = currentServicePlan.items.splice(draggedIndex, 1);
            
            // Insert at new position
            currentServicePlan.items.splice(targetIndex, 0, draggedItemData);
            
            // Update service plan in storage
            const dateKey = formatDateKey(selectedDate);
            servicePlans[dateKey] = currentServicePlan;
            
            console.log('Items reordered:', currentServicePlan.items);
            
            // Save to Firestore
            saveServicePlanToFirestore(currentServicePlan);
            
            // Re-render
            renderServicePlanItems();
        }
    }
    
    this.classList.remove('drag-over');
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

function generateUniqueId() {
    return 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function validateTimeFormat(time) {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
}