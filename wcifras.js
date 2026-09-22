// ========================================
// W.CIFRAS - ETAPA 3
// ========================================

console.log('[W.CIFRAS] Page loaded - Stage 3: Add chord flow with authentication');

// Global state
let currentUser = null;
let isAuthInitialized = false;
let selectedCoverFile = null;
let uploadedCoverUrl = null;
let currentFontSize = 100;
let currentChordId = null;
let isSidebarOpen = false;
let originalChordContent = '';
let originalKey = '';
let selectedKey = '';
let selectedMode = 'normal'; // 'normal' or 'simplified'
let currentInstrument = 'guitar'; // default instrument
let allChords = []; // Store all chords for search/filtering
let currentChordData = null; // Store current chord data for editing
let currentPlaylist = null; // Current playlist being edited/viewed
let playlistSongs = []; // Songs in current playlist (for editing)
let userPlaylists = []; // All user playlists
let currentPlaylistId = null; // ID of current playlist
let unsubscribePlaylists = null; // Unsubscribe function for playlists listener
let isEditingPlaylist = false; // Whether modal is in edit mode
let editingPlaylistId = null; // ID of playlist being edited
let longPressTimer = null; // Timer for long-press detection
let longPressStarted = false; // Whether long-press has started
let longPressTriggered = false; // Whether long-press was triggered (to prevent normal click)

// Cloudinary configuration
const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/dkfe21jnc/image/upload';
const UPLOAD_PRESET = 'vizu_upload';
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

// Musical notes array for transposition
const NOTES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

// ========================================
// AUTHENTICATION
// ========================================

// Initialize Firebase Auth listener
function initializeAuth() {
    // Wait for Firebase to be available (loaded as module before this script)
    const checkFirebase = setInterval(() => {
        if (typeof window.firebaseAuth !== 'undefined' && typeof window.firebaseDB !== 'undefined') {
            clearInterval(checkFirebase);
            
            const { auth, onAuthStateChanged } = window.firebaseAuth;
            
            onAuthStateChanged(auth, (user) => {
                currentUser = user;
                isAuthInitialized = true;
                
                if (user) {
                    console.log('[W.CIFRAS] User authenticated:', user.email);
                    // Load user playlists
                    loadUserPlaylists();
                } else {
                    console.log('[W.CIFRAS] User not authenticated');
                }
            });
            
            console.log('[W.CIFRAS] Firebase initialized');
        }
    }, 100);
    
    // Timeout after 5 seconds
    setTimeout(() => {
        clearInterval(checkFirebase);
        if (!isAuthInitialized) {
            console.warn('[W.CIFRAS] Firebase not available after timeout');
            isAuthInitialized = true;
        }
    }, 5000);
}

// Check if user is authenticated
function isUserAuthenticated() {
    return currentUser !== null;
}

// ========================================
// MODAL MANAGEMENT
// ========================================

// Open login required modal
function openLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.classList.add('active');
        console.log('[W.CIFRAS] Login modal opened');
    }
}

// Close login required modal
function closeLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.classList.remove('active');
        console.log('[W.CIFRAS] Login modal closed');
    }
}

// Open add chord modal
function openAddChordModal() {
    if (!isUserAuthenticated()) {
        openLoginModal();
        return;
    }
    
    const modal = document.getElementById('addChordModal');
    if (modal) {
        modal.classList.add('active');
        console.log('[W.CIFRAS] Add chord modal opened');
    }
}

// Close add chord modal
function closeAddChordModal() {
    const modal = document.getElementById('addChordModal');
    if (modal) {
        modal.classList.remove('active');
        clearForm();
        console.log('[W.CIFRAS] Add chord modal closed');
    }
}

// Clear form fields
function clearForm() {
    document.getElementById('chordTitle').value = '';
    document.getElementById('chordArtist').value = '';
    document.getElementById('chordKey').value = '';
    document.getElementById('chordContent').value = '';
    clearCover();
    clearErrors();
}

// ========================================
// COVER UPLOAD
// ========================================

// Handle cover file selection
function handleCoverSelect(file) {
    // Validate type
    if (!file.type.match(/image\/(jpeg|png|webp)/)) {
        console.error('[W.CIFRAS] Invalid file type:', file.type);
        return;
    }

    // Validate size
    if (file.size > MAX_SIZE) {
        console.error('[W.CIFRAS] File too large:', file.size);
        return;
    }

    selectedCoverFile = file;

    // Show loading and upload
    uploadCoverImage(file);
}

// Upload cover image to Cloudinary
async function uploadCoverImage(file) {
    const coverBtn = document.getElementById('chordCoverBtn');
    const coverLoading = document.getElementById('chordCoverLoading');
    const coverProgressFill = document.getElementById('chordCoverProgressFill');
    const coverPreview = document.getElementById('chordCoverPreview');
    const coverImage = document.getElementById('chordCoverImage');

    // Show loading
    coverBtn.style.display = 'none';
    coverLoading.style.display = 'flex';
    coverPreview.style.display = 'none';

    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', UPLOAD_PRESET);
        formData.append('quality', 'auto');
        formData.append('fetch_format', 'auto');

        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                coverProgressFill.style.width = percent + '%';
            }
        });

        xhr.addEventListener('load', () => {
            if (xhr.status === 200) {
                const response = JSON.parse(xhr.responseText);
                uploadedCoverUrl = response.secure_url;
                
                // Show preview
                coverImage.src = uploadedCoverUrl;
                coverPreview.style.display = 'block';
                coverLoading.style.display = 'none';
                
                console.log('[W.CIFRAS] Cover uploaded successfully:', uploadedCoverUrl);
            } else {
                throw new Error('Erro no upload');
            }
        });

        xhr.addEventListener('error', () => {
            throw new Error('Erro no upload');
        });

        xhr.open('POST', CLOUDINARY_URL);
        xhr.send(formData);

    } catch (error) {
        console.error('[W.CIFRAS] Upload error:', error);
        coverLoading.style.display = 'none';
        coverBtn.style.display = 'flex';
        selectedCoverFile = null;
    }
}

// Clear cover
function clearCover() {
    selectedCoverFile = null;
    uploadedCoverUrl = null;
    
    const coverInput = document.getElementById('chordCoverInput');
    const coverBtn = document.getElementById('chordCoverBtn');
    const coverPreview = document.getElementById('chordCoverPreview');
    const coverLoading = document.getElementById('chordCoverLoading');
    const coverProgressFill = document.getElementById('chordCoverProgressFill');
    const coverImage = document.getElementById('chordCoverImage');

    coverInput.value = '';
    coverImage.src = '';
    coverPreview.style.display = 'none';
    coverLoading.style.display = 'none';
    coverBtn.style.display = 'flex';
    coverProgressFill.style.width = '0%';
}

// Clear error messages
function clearErrors() {
    document.getElementById('chordTitleError').textContent = '';
    document.getElementById('chordArtistError').textContent = '';
    document.getElementById('chordKeyError').textContent = '';
    document.getElementById('chordContentError').textContent = '';
}

// ========================================
// FORM VALIDATION
// ========================================

// Validate form fields
function validateForm() {
    let isValid = true;
    clearErrors();
    
    const title = document.getElementById('chordTitle').value.trim();
    const artist = document.getElementById('chordArtist').value.trim();
    const key = document.getElementById('chordKey').value;
    const content = document.getElementById('chordContent').value.trim();
    
    if (!title) {
        document.getElementById('chordTitleError').textContent = 'Título é obrigatório';
        isValid = false;
    }
    
    if (!artist) {
        document.getElementById('chordArtistError').textContent = 'Artista é obrigatório';
        isValid = false;
    }
    
    if (!key) {
        document.getElementById('chordKeyError').textContent = 'Tom é obrigatório';
        isValid = false;
    }
    
    if (!content) {
        document.getElementById('chordContentError').textContent = 'Conteúdo é obrigatório';
        isValid = false;
    }
    
    return isValid;
}

// ========================================
// FORM SUBMISSION
// ========================================

// Prepare chord data for server
function prepareChordData() {
    const title = document.getElementById('chordTitle').value.trim();
    const artist = document.getElementById('chordArtist').value.trim();
    const key = document.getElementById('chordKey').value;
    const content = document.getElementById('chordContent').value.trim();
    
    // Structure prepared for future Firestore integration
    const chordData = {
        title,
        artist,
        key,
        content,
        cover: uploadedCoverUrl, // Cloudinary URL
        author: {
            uid: currentUser ? currentUser.uid : null,
            name: currentUser ? (currentUser.displayName || currentUser.email) : null
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    return chordData;
}

// Publish chord to Firestore
async function publishChordSheet() {
    if (!validateForm()) {
        console.log('[W.CIFRAS] Form validation failed');
        return;
    }
    
    if (typeof window.firebaseDB === 'undefined') {
        console.error('[W.CIFRAS] Firebase DB not available');
        return;
    }
    
    const chordData = prepareChordData();
    
    try {
        const { db, collection, addDoc } = window.firebaseDB;
        
        // Save to Firestore
        const docRef = await addDoc(collection(db, 'chords'), chordData);
        
        console.log('[W.CIFRAS] Chord published successfully with ID:', docRef.id);
        
        // Close modal and clear form
        closeAddChordModal();
        
        // Show success (could add a toast notification here)
        console.log('[W.CIFRAS] Chord published to public catalog');
        
    } catch (error) {
        console.error('[W.CIFRAS] Error publishing chord:', error);
        console.error('[W.CIFRAS] Error details:', error.code, error.message);
    }
}

// ========================================
// SECTION INSERTION
// ========================================

// Insert section into textarea
function insertSection(sectionName) {
    const textarea = document.getElementById('chordContent');
    const sectionText = `[ ${sectionName} ]\n\n`;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    
    textarea.value = text.substring(0, start) + sectionText + text.substring(end);
    textarea.selectionStart = textarea.selectionEnd = start + sectionText.length;
    textarea.focus();
}

// ========================================
// EVENT LISTENERS
// ========================================

// Setup event listeners
function setupEventListeners() {
    // Add chord button
    const addBtn = document.getElementById('wcifrasAddBtn');
    if (addBtn) {
        addBtn.addEventListener('click', openAddChordModal);
    }
    
    // Login modal
    const loginModalClose = document.getElementById('loginModalClose');
    const loginModalCancel = document.getElementById('loginModalCancel');
    
    if (loginModalClose) {
        loginModalClose.addEventListener('click', closeLoginModal);
    }
    if (loginModalCancel) {
        loginModalCancel.addEventListener('click', closeLoginModal);
    }
    
    // Add chord modal
    const addChordModalClose = document.getElementById('addChordModalClose');
    const addChordModalCancel = document.getElementById('addChordModalCancel');
    const addChordModalPublish = document.getElementById('addChordModalPublish');
    
    if (addChordModalClose) {
        addChordModalClose.addEventListener('click', closeAddChordModal);
    }
    if (addChordModalCancel) {
        addChordModalCancel.addEventListener('click', closeAddChordModal);
    }
    if (addChordModalPublish) {
        addChordModalPublish.addEventListener('click', publishChordSheet);
    }
    
    // Section buttons
    const sectionButtons = document.querySelectorAll('.wcifras-form-control-btn');
    sectionButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const section = btn.dataset.section;
            insertSection(section);
        });
    });
    
    // Cover upload
    const coverBtn = document.getElementById('chordCoverBtn');
    const coverInput = document.getElementById('chordCoverInput');
    const coverRemove = document.getElementById('chordCoverRemove');
    
    if (coverBtn && coverInput) {
        coverBtn.addEventListener('click', () => coverInput.click());
        
        coverInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleCoverSelect(e.target.files[0]);
            }
        });
    }
    
    if (coverRemove) {
        coverRemove.addEventListener('click', clearCover);
    }
    
    // Chord view controls
    const backBtn = document.getElementById('wcifrasBackBtn');
    const notFoundBackBtn = document.getElementById('wcifrasNotFoundBack');
    const fontIncrease = document.getElementById('wcifrasFontIncrease');
    const fontDecrease = document.getElementById('wcifrasFontDecrease');
    const fullscreenBtn = document.getElementById('wcifrasFullscreenBtn');
    
    if (backBtn) {
        backBtn.addEventListener('click', closeChordView);
    }
    
    if (notFoundBackBtn) {
        notFoundBackBtn.addEventListener('click', closeChordView);
    }
    
    if (fontIncrease) {
        fontIncrease.addEventListener('click', increaseFontSize);
    }
    
    if (fontDecrease) {
        fontDecrease.addEventListener('click', decreaseFontSize);
    }
    
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', toggleFullscreen);
    }
    
    // Sidebar controls
    const menuToggle = document.getElementById('wcifrasMenuToggle');
    const sidebarClose = document.getElementById('wcifrasSidebarClose');
    
    if (menuToggle) {
        menuToggle.addEventListener('click', toggleSidebar);
    }
    
    if (sidebarClose) {
        sidebarClose.addEventListener('click', closeSidebar);
    }
    
    // Key selector controls
    const keySelector = document.getElementById('wcifrasKeySelector');
    const keyDropdown = document.getElementById('wcifrasKeyDropdown');
    const keyOptions = document.querySelectorAll('.wcifras-key-option');
    
    if (keySelector) {
        keySelector.addEventListener('click', toggleKeyDropdown);
    }
    
    keyOptions.forEach(option => {
        option.addEventListener('click', () => {
            selectKey(option.dataset.key);
            toggleKeyDropdown();
        });
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        const keySelector = document.getElementById('wcifrasKeySelector');
        const keyDropdown = document.getElementById('wcifrasKeyDropdown');
        const modeSelector = document.getElementById('wcifrasModeSelector');
        const modeDropdown = document.getElementById('wcifrasModeDropdown');
        
        if (keySelector && !keySelector.contains(e.target) && keyDropdown && !keyDropdown.contains(e.target)) {
            keyDropdown.style.display = 'none';
            keySelector.classList.remove('active');
        }
        
        if (modeSelector && !modeSelector.contains(e.target) && modeDropdown && !modeDropdown.contains(e.target)) {
            modeDropdown.style.display = 'none';
            modeSelector.classList.remove('active');
        }
    });
    
    // Mode selector controls
    const modeSelector = document.getElementById('wcifrasModeSelector');
    const modeDropdown = document.getElementById('wcifrasModeDropdown');
    const modeOptions = document.querySelectorAll('.wcifras-mode-option');
    
    if (modeSelector) {
        modeSelector.addEventListener('click', toggleModeDropdown);
    }
    
    modeOptions.forEach(option => {
        option.addEventListener('click', () => {
            setMode(option.dataset.mode);
            toggleModeDropdown();
        });
    });
    
    // Instrument category toggles
    const categoryStrings = document.getElementById('wcifrasCategoryStrings');
    const categoryKeys = document.getElementById('wcifrasCategoryKeys');
    const categoryWinds = document.getElementById('wcifrasCategoryWinds');
    const categoryPercussion = document.getElementById('wcifrasCategoryPercussion');
    
    if (categoryStrings) {
        categoryStrings.addEventListener('click', () => toggleInstrumentCategory('strings'));
    }
    
    if (categoryKeys) {
        categoryKeys.addEventListener('click', () => toggleInstrumentCategory('keys'));
    }
    
    if (categoryWinds) {
        categoryWinds.addEventListener('click', () => toggleInstrumentCategory('winds'));
    }
    
    if (categoryPercussion) {
        categoryPercussion.addEventListener('click', () => toggleInstrumentCategory('percussion'));
    }
    
    // Instrument selection
    const instrumentItems = document.querySelectorAll('.wcifras-instrument-item');
    instrumentItems.forEach(item => {
        item.addEventListener('click', () => {
            selectInstrument(item.dataset.instrument);
        });
    });
    
    // Share button
    const shareBtn = document.getElementById('wcifrasShareBtn');
    if (shareBtn) {
        shareBtn.addEventListener('click', shareChord);
    }
    
    // Edit button
    const editBtn = document.getElementById('wcifrasEditBtn');
    if (editBtn) {
        editBtn.addEventListener('click', openEditModal);
    }
    
    // Save button
    const saveBtn = document.getElementById('wcifrasSaveBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveEditedChord);
    }
    
    // Download button
    const downloadBtn = document.getElementById('wcifrasDownloadBtn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', downloadChord);
    }
    
    // Print button
    const printBtn = document.getElementById('wcifrasPrintBtn');
    if (printBtn) {
        printBtn.addEventListener('click', printChord);
    }
    
    // Search input
    const searchInput = document.getElementById('wcifrasSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            filterChords(e.target.value);
        });
    }
    
    // Close modals on overlay click
    const modals = document.querySelectorAll('.wcifras-modal-overlay');
    modals.forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
    
    // Close modals on ESC key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeLoginModal();
            closeAddChordModal();
            closePlaylistModal();
        }
    });
    
    // Playlist FAB buttons
    const createPlaylistBtn = document.getElementById('wcifrasCreatePlaylistBtn');
    if (createPlaylistBtn) {
        createPlaylistBtn.addEventListener('click', openCreatePlaylistModal);
    }
    
    const currentPlaylistBtn = document.getElementById('wcifrasCurrentPlaylistBtn');
    if (currentPlaylistBtn) {
        // Long-press detection
        currentPlaylistBtn.addEventListener('mousedown', (e) => {
            if (!currentPlaylistBtn.dataset.playlistId) return;

            console.log('[W.CIFRAS] Playlist long press started (mouse)');
            longPressStarted = true;
            longPressTriggered = false;

            longPressTimer = setTimeout(() => {
                if (longPressStarted) {
                    console.log('[W.CIFRAS] Playlist long press triggered (mouse)');
                    longPressTriggered = true;

                    // Vibrate if supported
                    if (navigator.vibrate) {
                        navigator.vibrate(20);
                    }

                    openPlaylistActionsMenu(currentPlaylistBtn.dataset.playlistId);
                }
            }, 1900);
        });

        currentPlaylistBtn.addEventListener('mouseup', () => {
            console.log('[W.CIFRAS] Playlist long press cancelled (mouseup)');
            clearTimeout(longPressTimer);
            longPressStarted = false;
        });

        currentPlaylistBtn.addEventListener('mouseleave', () => {
            console.log('[W.CIFRAS] Playlist long press cancelled (mouseleave)');
            clearTimeout(longPressTimer);
            longPressStarted = false;
        });

        // Touch events for mobile
        currentPlaylistBtn.addEventListener('touchstart', (e) => {
            if (!currentPlaylistBtn.dataset.playlistId) return;

            console.log('[W.CIFRAS] Playlist long press started (touch)');
            longPressStarted = true;
            longPressTriggered = false;

            longPressTimer = setTimeout(() => {
                if (longPressStarted) {
                    console.log('[W.CIFRAS] Playlist long press triggered (touch)');
                    longPressTriggered = true;

                    // Vibrate if supported
                    if (navigator.vibrate) {
                        navigator.vibrate(20);
                    }

                    openPlaylistActionsMenu(currentPlaylistBtn.dataset.playlistId);
                }
            }, 1900);
        });

        currentPlaylistBtn.addEventListener('touchend', () => {
            console.log('[W.CIFRAS] Playlist long press cancelled (touchend)');
            clearTimeout(longPressTimer);
            longPressStarted = false;
        });

        currentPlaylistBtn.addEventListener('touchcancel', () => {
            console.log('[W.CIFRAS] Playlist long press cancelled (touchcancel)');
            clearTimeout(longPressTimer);
            longPressStarted = false;
        });

        currentPlaylistBtn.addEventListener('touchmove', () => {
            console.log('[W.CIFRAS] Playlist long press cancelled (touchmove)');
            clearTimeout(longPressTimer);
            longPressStarted = false;
        });

        // Normal click (only if not a long press)
        currentPlaylistBtn.addEventListener('click', (e) => {
            if (longPressTriggered) {
                console.log('[W.CIFRAS] Playlist click prevented (long press was triggered)');
                longPressTriggered = false;
                e.preventDefault();
                e.stopPropagation();
                return;
            }

            console.log('[W.CIFRAS] Playlist button clicked:', currentPlaylistBtn.dataset.playlistId);
            if (currentPlaylistBtn.dataset.playlistId) {
                openPlaylist(currentPlaylistBtn.dataset.playlistId);
            }
        });
    }
    
    // Playlist modal
    const playlistModalClose = document.getElementById('wcifrasPlaylistModalClose');
    if (playlistModalClose) {
        playlistModalClose.addEventListener('click', closePlaylistModal);
    }

    const playlistModalCancel = document.getElementById('wcifrasPlaylistModalCancel');
    if (playlistModalCancel) {
        playlistModalCancel.addEventListener('click', closePlaylistModal);
    }

    const playlistModalSave = document.getElementById('wcifrasPlaylistModalSave');
    if (playlistModalSave) {
        playlistModalSave.addEventListener('click', savePlaylist);
    }

    // Playlist actions menu
    const playlistActionsEdit = document.getElementById('wcifrasPlaylistActionsEdit');
    if (playlistActionsEdit) {
        playlistActionsEdit.addEventListener('click', editPlaylistFromActions);
    }

    const playlistActionsShare = document.getElementById('wcifrasPlaylistActionsShare');
    if (playlistActionsShare) {
        playlistActionsShare.addEventListener('click', sharePlaylist);
    }

    const playlistActionsDelete = document.getElementById('wcifrasPlaylistActionsDelete');
    if (playlistActionsDelete) {
        playlistActionsDelete.addEventListener('click', openDeletePlaylistConfirmation);
    }

    const playlistActionsCancel = document.getElementById('wcifrasPlaylistActionsCancel');
    if (playlistActionsCancel) {
        playlistActionsCancel.addEventListener('click', closePlaylistActionsMenu);
    }

    const playlistActionsOverlay = document.getElementById('wcifrasPlaylistActionsOverlay');
    if (playlistActionsOverlay) {
        playlistActionsOverlay.addEventListener('click', (e) => {
            if (e.target === playlistActionsOverlay) {
                closePlaylistActionsMenu();
            }
        });
    }

    // Delete playlist confirmation modal
    const deletePlaylistModalClose = document.getElementById('wcifrasDeletePlaylistModalClose');
    if (deletePlaylistModalClose) {
        deletePlaylistModalClose.addEventListener('click', closeDeletePlaylistConfirmation);
    }

    const deletePlaylistCancel = document.getElementById('wcifrasDeletePlaylistCancel');
    if (deletePlaylistCancel) {
        deletePlaylistCancel.addEventListener('click', closeDeletePlaylistConfirmation);
    }

    const deletePlaylistConfirm = document.getElementById('wcifrasDeletePlaylistConfirm');
    if (deletePlaylistConfirm) {
        deletePlaylistConfirm.addEventListener('click', confirmDeletePlaylist);
    }
    
    // Playlist search
    const playlistSearch = document.getElementById('wcifrasPlaylistSearch');
    if (playlistSearch) {
        playlistSearch.addEventListener('input', (e) => {
            searchPlaylistChords(e.target.value);
        });
    }
    
    // Playlist view
    const playlistBackBtn = document.getElementById('wcifrasPlaylistBackBtn');
    if (playlistBackBtn) {
        playlistBackBtn.addEventListener('click', closePlaylistView);
    }
    
    const playlistEditBtn = document.getElementById('wcifrasPlaylistEditBtn');
    if (playlistEditBtn) {
        playlistEditBtn.addEventListener('click', () => {
            alert('Edição de playlist será implementada em breve.');
        });
    }
    
    const playlistDeleteBtn = document.getElementById('wcifrasPlaylistDeleteBtn');
    if (playlistDeleteBtn) {
        playlistDeleteBtn.addEventListener('click', deletePlaylist);
    }
    
    // Scroll handler for FAB buttons
    window.addEventListener('scroll', handleScroll);
    
    console.log('[W.CIFRAS] Event listeners set up');
}

// Handle scroll for FAB buttons
function handleScroll() {
    const fabContainer = document.getElementById('wcifrasFabContainer');
    if (!fabContainer) return;
    
    const scrollY = window.scrollY;
    
    if (scrollY > 200) {
        fabContainer.classList.add('hidden');
    } else {
        fabContainer.classList.remove('hidden');
    }
}

// ========================================
// CHORD VIEW
// ========================================

// Open chord view
function openChordView(chordId) {
    currentChordId = chordId;

    // Clear playlist context if not already in playlist
    // (i.e., if opening from catalog card click)
    if (!currentPlaylist) {
        currentPlaylist = null;
        currentPlaylistId = null;
        playlistSongs = [];
    }

    // Hide catalog, show chord view
    document.getElementById('wcifrasCatalogView').style.display = 'none';
    document.getElementById('wcifrasChordView').style.display = 'block';
    document.getElementById('wcifrasChordView').classList.add('active');

    // Hide not found, show content
    document.getElementById('wcifrasNotFound').style.display = 'none';
    document.getElementById('wcifrasChordContent').style.display = 'block';

    // Hide playlist FABs when in chord reader
    const fabContainer = document.getElementById('wcifrasFabContainer');
    if (fabContainer) {
        fabContainer.style.display = 'none';
    }

    // Load chord from Firestore
    loadChordFromFirestore(chordId);

    console.log('[W.CIFRAS] Opening chord view for:', chordId);
}

// Close chord view (back to catalog)
function closeChordView() {
    currentChordId = null;

    // Clear playlist context
    currentPlaylist = null;
    currentPlaylistId = null;
    playlistSongs = [];

    // Close sidebar if open
    if (isSidebarOpen) {
        closeSidebar();
    }

    // Show catalog, hide chord view
    document.getElementById('wcifrasCatalogView').style.display = 'block';
    document.getElementById('wcifrasChordView').style.display = 'none';

    // Show playlist FABs when back in catalog
    const fabContainer = document.getElementById('wcifrasFabContainer');
    if (fabContainer) {
        fabContainer.style.display = 'flex';
    }

    // Reset font size
    currentFontSize = 100;
    updateFontSize();

    console.log('[W.CIFRAS] Closed chord view - playlist context cleared');
}

// Load single chord from Firestore
async function loadChordFromFirestore(chordId) {
    if (typeof window.firebaseDB === 'undefined') {
        console.error('[W.CIFRAS] Firebase DB not available');
        showChordNotFound();
        return;
    }
    
    try {
        const { db, doc, getDoc } = window.firebaseDB;
        
        const chordDoc = await getDoc(doc(db, 'chords', chordId));
        
        if (chordDoc.exists()) {
            const chordData = chordDoc.data();
            renderChordView(chordData);
            console.log('[W.CIFRAS] Chord loaded:', chordId);
        } else {
            console.log('[W.CIFRAS] Chord not found:', chordId);
            showChordNotFound();
        }
    } catch (error) {
        console.error('[W.CIFRAS] Error loading chord:', error);
        showChordNotFound();
    }
}

// Show chord not found state
function showChordNotFound() {
    document.getElementById('wcifrasChordContent').style.display = 'none';
    document.getElementById('wcifrasNotFound').style.display = 'flex';
}

// Render chord view
function renderChordView(chord) {
    // Store chord data for editing
    currentChordData = chord;
    
    // Save original content and key
    originalChordContent = chord.content;
    originalKey = chord.key;
    selectedKey = chord.key;
    selectedMode = 'normal';
    
    // Set header info
    document.getElementById('wcifrasChordTitle').textContent = chord.title;
    document.getElementById('wcifrasChordArtist').textContent = chord.artist;
    
    // Set edited date if exists
    const editedElement = document.getElementById('wcifrasChordEdited');
    if (chord.updatedAt) {
        let date;
        
        // Handle Firebase Timestamp object
        if (chord.updatedAt.toDate) {
            date = chord.updatedAt.toDate();
        } else if (typeof chord.updatedAt === 'string') {
            date = new Date(chord.updatedAt);
        } else {
            date = new Date(chord.updatedAt);
        }
        
        if (!isNaN(date.getTime())) {
            const formattedDate = date.toLocaleDateString('pt-BR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
            
            editedElement.textContent = `Editada em ${formattedDate}`;
            editedElement.style.display = 'block';
        } else {
            editedElement.style.display = 'none';
        }
    } else {
        editedElement.style.display = 'none';
    }
    
    // Update key display
    document.getElementById('wcifrasKeyDisplay').textContent = chord.key;
    
    // Update key dropdown selection
    document.querySelectorAll('.wcifras-key-option').forEach(option => {
        option.classList.toggle('selected', option.dataset.key === chord.key);
    });
    
    // Update mode display
    document.getElementById('wcifrasModeDisplay').textContent = 'Normal';
    
    // Update mode dropdown selection
    document.querySelectorAll('.wcifras-mode-option').forEach(option => {
        option.classList.toggle('selected', option.dataset.mode === 'normal');
    });
    
    // Update sidebar
    const sidebarList = document.getElementById('wcifrasSidebarList');
    
    // Clear all items
    sidebarList.innerHTML = '';
    
    // If in playlist context, render playlist sidebar
    if (currentPlaylist && currentPlaylist.songs) {
        renderPlaylistSidebar();
    } else {
        // Otherwise, show only current song (original behavior)
        const newCurrentSong = document.createElement('li');
        newCurrentSong.className = 'wcifras-sidebar-item active';
        newCurrentSong.id = 'wcifrasCurrentSong';
        newCurrentSong.textContent = chord.title;
        sidebarList.appendChild(newCurrentSong);
    }
    
    // Render content
    renderChordContent(chord.content);
}

// Render chord content with formatting
function renderChordContent(content) {
    const contentDiv = document.getElementById('wcifrasChordContent');
    
    // Parse content to identify sections and chords
    const lines = content.split('\n');
    let html = '';
    
    lines.forEach(line => {
        // Check if it's a section header [ SECTION ]
        const sectionMatch = line.match(/^\[\s*(.+?)\s*\]$/);
        
        if (sectionMatch) {
            // It's a section header
            html += `<div class="chord-section">${sectionMatch[1]}</div>`;
        } else if (line.trim() === '') {
            // Empty line
            html += '<div class="chord-line"></div>';
        } else {
            // Check if it's a chord line
            if (isChordLine(line)) {
                // Process chord line: highlight each chord
                const processedLine = line.replace(/([A-G][#b]?(m|maj|min|dim|aug|sus|add)?[0-9]?(?:[0-9])?(?:maj|min)?(?:sus|add)?[0-9]?(?:[0-9])?(?:\/[A-G][#b]?)?)/g, 
                    '<span class="chord-text">$1</span>');
                html += `<div class="chord-line chord-only">${processedLine}</div>`;
            } else {
                // Regular lyric line
                html += `<div class="chord-line">${line}</div>`;
            }
        }
    });
    
    contentDiv.innerHTML = html;
}

// Update font size
function updateFontSize() {
    const contentDiv = document.getElementById('wcifrasChordContent');
    const fontSizeSpan = document.getElementById('wcifrasFontSize');
    
    contentDiv.style.fontSize = (18 * currentFontSize / 100) + 'px';
    fontSizeSpan.textContent = currentFontSize + '%';
}

// Increase font size
function increaseFontSize() {
    if (currentFontSize < 150) {
        currentFontSize += 10;
        updateFontSize();
    }
}

// Decrease font size
function decreaseFontSize() {
    if (currentFontSize > 70) {
        currentFontSize -= 10;
        updateFontSize();
    }
}

// Toggle fullscreen
function toggleFullscreen() {
    const chordView = document.getElementById('wcifrasChordView');
    
    if (!document.fullscreenElement) {
        chordView.requestFullscreen().catch(err => {
            console.log('[W.CIFRAS] Fullscreen error:', err);
        });
    } else {
        document.exitFullscreen();
    }
}

// ========================================
// SIDEBAR MENU
// ========================================

// Toggle sidebar
function toggleSidebar() {
    isSidebarOpen = !isSidebarOpen;
    
    const sidebar = document.getElementById('wcifrasSidebar');
    const mainContent = document.getElementById('wcifrasChordMain');
    const menuToggle = document.getElementById('wcifrasMenuToggle');
    
    if (isSidebarOpen) {
        sidebar.classList.add('active');
        mainContent.classList.add('shifted');
        menuToggle.classList.add('active');
    } else {
        sidebar.classList.remove('active');
        mainContent.classList.remove('shifted');
        menuToggle.classList.remove('active');
    }
    
    console.log('[W.CIFRAS] Sidebar toggled:', isSidebarOpen);
}

// Open sidebar
function openSidebar() {
    if (!isSidebarOpen) {
        toggleSidebar();
    }
}

// Close sidebar
function closeSidebar() {
    if (isSidebarOpen) {
        toggleSidebar();
    }
}

// ========================================
// CHORD TRANSPOSITION
// ========================================

// Get semitone distance between two keys
function getSemitoneDistance(fromKey, toKey) {
    const fromIndex = NOTES.indexOf(fromKey);
    const toIndex = NOTES.indexOf(toKey);
    
    if (fromIndex === -1 || toIndex === -1) return 0;
    
    let distance = toIndex - fromIndex;
    
    // Handle wrap-around (e.g., from B to C is +1 semitone)
    if (distance < -6) distance += 12;
    if (distance > 6) distance -= 12;
    
    return distance;
}

// Parse chord to get root note and suffix
function parseChord(chord) {
    // Match: note (C, C#, etc.) + rest (m, 7, m7, etc.)
    const match = chord.match(/^([A-G][#b]?)(.*)$/);
    
    if (!match) return { root: chord, suffix: '' };
    
    return {
        root: match[1],
        suffix: match[2]
    };
}

// Transpose a single chord
function transposeChord(chord, semitones) {
    const parsed = parseChord(chord);
    const rootIndex = NOTES.indexOf(parsed.root);
    
    if (rootIndex === -1) return chord; // Not a recognized chord
    
    const newIndex = (rootIndex + semitones + 12) % 12;
    const newRoot = NOTES[newIndex];
    
    return newRoot + parsed.suffix;
}

// Simplify a chord (remove extensions)
function simplifyChord(chord) {
    const parsed = parseChord(chord);
    
    // Keep only major, minor, and sus4
    const simplifiedSuffix = parsed.suffix
        .replace(/m|Maj|maj|7|9|11|13|add|dim|aug|sus2|sus4|[0-9]/g, '')
        .replace(/\/.*$/, ''); // Remove bass note
    
    // If empty, it's just the root note
    if (simplifiedSuffix === '') return parsed.root;
    
    // Only keep 'm' for minor and 'sus4' for sus4
    if (parsed.suffix.includes('m') && !parsed.suffix.includes('sus')) {
        return parsed.root + 'm';
    }
    if (parsed.suffix.includes('sus4')) {
        return parsed.root + 'sus4';
    }
    
    return parsed.root;
}

// Check if a line is likely a chord line
function isChordLine(line) {
    // A line is likely chords if it has multiple chord-like patterns
    // Improved regex to match more chord patterns while avoiding false positives
    const chordPattern = /([A-G][#b]?(?:m|maj|min|dim|aug|sus|add)?(?:2|4|5|6|7|9|11|13)?(?:maj|min|sus|add)?(?:[2-9]|11|13)?(?:\/[A-G][#b]?)?)/g;
    const matches = line.match(chordPattern);
    
    if (!matches) return false;
    
    // If it has 2+ chord patterns, it's likely a chord line
    // Also check that the line has enough chord characters vs text
    const chordChars = matches.join('').length;
    const totalChars = line.replace(/\s/g, '').length;
    
    // If chords take up more than 50% of non-space characters, it's a chord line
    if (chordChars / totalChars > 0.5) return true;
    
    // If it has 2+ chord patterns, it's likely a chord line
    return matches.length >= 2;
}

// Process chord content with transposition and simplification
function processChordContent(content, transposeSemitones, simplify) {
    const lines = content.split('\n');
    
    return lines.map(line => {
        // Section headers
        if (line.match(/^\[\s*(.+?)\s*\]$/)) {
            return line;
        }
        
        // Empty lines
        if (line.trim() === '') {
            return line;
        }
        
        // Check if it's a chord line
        if (isChordLine(line)) {
            // Split by spaces to process each chord
            const parts = line.split(/(\s+)/);
            
            return parts.map(part => {
                // Preserve spaces
                if (part.match(/^\s+$/)) return part;
                if (part === '') return part;
                
                // Try to transpose
                let chord = part;
                
                if (transposeSemitones !== 0) {
                    chord = transposeChord(chord, transposeSemitones);
                }
                
                if (simplify) {
                    chord = simplifyChord(chord);
                }
                
                return chord;
            }).join('');
        }
        
        // Lyrics or other text - keep as is
        return line;
    }).join('\n');
}

// Update chord view with current key and mode
function updateChordView() {
    if (!originalChordContent) return;
    
    const semitones = getSemitoneDistance(originalKey, selectedKey);
    const simplify = selectedMode === 'simplified';
    
    const processedContent = processChordContent(originalChordContent, semitones, simplify);
    renderChordContent(processedContent);
}

// Select key
function selectKey(key) {
    selectedKey = key;
    
    // Update display
    document.getElementById('wcifrasKeyDisplay').textContent = key;
    
    // Update dropdown selection
    document.querySelectorAll('.wcifras-key-option').forEach(option => {
        option.classList.toggle('selected', option.dataset.key === key);
    });
    
    // Update chord view
    updateChordView();
    
    console.log('[W.CIFRAS] Key selected:', key);
}

// Toggle key dropdown
function toggleKeyDropdown() {
    const dropdown = document.getElementById('wcifrasKeyDropdown');
    const selector = document.getElementById('wcifrasKeySelector');
    
    const isHidden = dropdown.style.display === 'none';
    
    dropdown.style.display = isHidden ? 'block' : 'none';
    selector.classList.toggle('active', isHidden);
}

// Set mode
function setMode(mode) {
    selectedMode = mode;
    
    // Update display
    document.getElementById('wcifrasModeDisplay').textContent = mode === 'normal' ? 'Normal' : 'Simplificada';
    
    // Update dropdown selection
    document.querySelectorAll('.wcifras-mode-option').forEach(option => {
        option.classList.toggle('selected', option.dataset.mode === mode);
    });
    
    // Update chord view
    updateChordView();
    
    console.log('[W.CIFRAS] Mode set:', mode);
}

// Toggle mode dropdown
function toggleModeDropdown() {
    const dropdown = document.getElementById('wcifrasModeDropdown');
    const selector = document.getElementById('wcifrasModeSelector');
    
    const isHidden = dropdown.style.display === 'none';
    
    dropdown.style.display = isHidden ? 'block' : 'none';
    selector.classList.toggle('active', isHidden);
}

// ========================================
// INSTRUMENT SELECTION
// ========================================

// Load instrument preference from localStorage
function loadInstrumentPreference() {
    const saved = localStorage.getItem('wcifras_selected_instrument');
    if (saved) {
        currentInstrument = saved;
    }
    updateInstrumentSelection();
}

// Save instrument preference to localStorage
function saveInstrumentPreference() {
    localStorage.setItem('wcifras_selected_instrument', currentInstrument);
}

// Select instrument
function selectInstrument(instrument) {
    currentInstrument = instrument;
    updateInstrumentSelection();
    saveInstrumentPreference();
    console.log('[W.CIFRAS] Instrument selected:', instrument);
}

// Update instrument selection visual
function updateInstrumentSelection() {
    // Remove selected class from all instruments
    document.querySelectorAll('.wcifras-instrument-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // Add selected class to current instrument
    const currentItem = document.querySelector(`.wcifras-instrument-item[data-instrument="${currentInstrument}"]`);
    if (currentItem) {
        currentItem.classList.add('selected');
    }
}

// Toggle instrument category
function toggleInstrumentCategory(category) {
    const categoryEl = document.querySelector(`.wcifras-instrument-category[data-category="${category}"]`);
    const listEl = document.getElementById(`wcifrasInstrument${category.charAt(0).toUpperCase() + category.slice(1)}`);
    
    if (categoryEl && listEl) {
        const isOpen = listEl.style.display !== 'none';
        listEl.style.display = isOpen ? 'none' : 'block';
        categoryEl.classList.toggle('open', !isOpen);
    }
}

// Initialize instrument categories
function initializeInstrumentCategories() {
    // Strings category open by default
    const stringsCategory = document.querySelector('.wcifras-instrument-category[data-category="strings"]');
    const stringsList = document.getElementById('wcifrasInstrumentStrings');
    if (stringsCategory && stringsList) {
        stringsList.style.display = 'block';
        stringsCategory.classList.add('open');
    }
    
    // Other categories closed by default
    const keysList = document.getElementById('wcifrasInstrumentKeys');
    if (keysList) keysList.style.display = 'none';
    
    const windsList = document.getElementById('wcifrasInstrumentWinds');
    if (windsList) windsList.style.display = 'none';
    
    const percussionList = document.getElementById('wcifrasInstrumentPercussion');
    if (percussionList) percussionList.style.display = 'none';
}

// Check URL for chord ID on page load
function checkUrlForChordId() {
    const urlParams = new URLSearchParams(window.location.search);
    const chordId = urlParams.get('id');
    
    if (chordId) {
        openChordView(chordId);
    }
}

// ========================================
// PLAYLIST SYSTEM
// ========================================

// Open create playlist modal
function openCreatePlaylistModal() {
    if (!currentUser) {
        openLoginModal();
        return;
    }

    // Reset form
    document.getElementById('wcifrasPlaylistName').value = '';
    document.getElementById('wcifrasPlaylistDescription').value = '';
    document.getElementById('wcifrasPlaylistSearch').value = '';
    document.getElementById('wcifrasPlaylistSearchResults').innerHTML = '';
    playlistSongs = [];
    renderPlaylistSongs();

    // Set modal to create mode
    isEditingPlaylist = false;
    editingPlaylistId = null;
    document.querySelector('#wcifrasPlaylistModal .wcifras-modal-title').textContent = 'CRIAR PLAYLIST';
    document.querySelector('#wcifrasPlaylistModalSave').textContent = 'Salvar playlist';

    // Show modal using .active class
    const modal = document.getElementById('wcifrasPlaylistModal');
    if (modal) {
        modal.classList.add('active');
    }

    console.log('[W.CIFRAS] Create playlist modal opened');
}

// Close playlist modal
function closePlaylistModal() {
    const modal = document.getElementById('wcifrasPlaylistModal');
    if (modal) {
        modal.classList.remove('active');
    }
    
    console.log('[W.CIFRAS] Playlist modal closed');
}

// Search chords for playlist
function searchPlaylistChords(searchTerm) {
    const resultsContainer = document.getElementById('wcifrasPlaylistSearchResults');
    
    if (!searchTerm || searchTerm.trim() === '') {
        resultsContainer.innerHTML = '';
        return;
    }
    
    const term = searchTerm.toLowerCase().trim();
    const filtered = allChords.filter(chord => {
        const title = chord.title ? chord.title.toLowerCase() : '';
        const artist = chord.artist ? chord.artist.toLowerCase() : '';
        return title.includes(term) || artist.includes(term);
    });
    
    resultsContainer.innerHTML = '';
    
    filtered.forEach(chord => {
        const item = document.createElement('div');
        item.className = 'wcifras-playlist-search-item';
        
        // Check if already in playlist
        const isInPlaylist = playlistSongs.some(s => s.chordId === chord.id);
        
        item.innerHTML = `
            <div class="wcifras-playlist-search-item-info">
                <div class="wcifras-playlist-search-item-title">${chord.title}</div>
                <div class="wcifras-playlist-search-item-artist">${chord.artist}</div>
                <div class="wcifras-playlist-search-item-key">Tom: ${chord.key}</div>
            </div>
            ${isInPlaylist ? '<span style="color: var(--wcifras-accent); font-size: 12px;">✓ Adicionada</span>' : `
                <button class="wcifras-playlist-add-btn" data-chord-id="${chord.id}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                </button>
            `}
        `;
        
        resultsContainer.appendChild(item);
    });
    
    // Add click handlers for add buttons
    document.querySelectorAll('.wcifras-playlist-add-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            addSongToPlaylist(btn.dataset.chordId);
        });
    });
}

// Add song to playlist
function addSongToPlaylist(chordId) {
    const chord = allChords.find(c => c.id === chordId);
    if (!chord) return;
    
    // Check if already in playlist
    if (playlistSongs.some(s => s.chordId === chordId)) return;
    
    // Add to playlist
    playlistSongs.push({
        chordId: chord.id,
        order: playlistSongs.length
    });
    
    // Render songs
    renderPlaylistSongs();
    
    // Re-run search to update UI
    const searchTerm = document.getElementById('wcifrasPlaylistSearch').value;
    if (searchTerm) {
        searchPlaylistChords(searchTerm);
    }
    
    console.log('[W.CIFRAS] Song added to playlist:', chord.title);
}

// Remove song from playlist
function removeSongFromPlaylist(index) {
    playlistSongs.splice(index, 1);
    
    // Update order
    playlistSongs.forEach((song, i) => {
        song.order = i;
    });
    
    renderPlaylistSongs();
    console.log('[W.CIFRAS] Song removed from playlist');
}

// Render playlist songs
function renderPlaylistSongs() {
    const container = document.getElementById('wcifrasPlaylistSongs');
    
    if (playlistSongs.length === 0) {
        container.innerHTML = '<p class="wcifras-playlist-empty">Nenhuma música adicionada ainda.</p>';
        return;
    }
    
    container.innerHTML = '';
    
    playlistSongs.forEach((song, index) => {
        const chord = allChords.find(c => c.id === song.chordId);
        if (!chord) return;
        
        const item = document.createElement('div');
        item.className = 'wcifras-playlist-song-item';
        item.innerHTML = `
            <div class="wcifras-playlist-song-info">
                <span class="wcifras-playlist-song-order">${index + 1}</span>
                <div class="wcifras-playlist-song-content">
                    <div class="wcifras-playlist-song-title">${chord.title}</div>
                    <div class="wcifras-playlist-song-artist">${chord.artist}</div>
                    <div class="wcifras-playlist-song-key">Tom: ${chord.key}</div>
                </div>
            </div>
            <button class="wcifras-playlist-remove-btn" data-index="${index}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        `;
        
        container.appendChild(item);
    });
    
    // Add click handlers for remove buttons
    document.querySelectorAll('.wcifras-playlist-remove-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            removeSongFromPlaylist(parseInt(btn.dataset.index));
        });
    });
}

// Save playlist
async function savePlaylist() {
    const name = document.getElementById('wcifrasPlaylistName').value.trim();
    const description = document.getElementById('wcifrasPlaylistDescription').value.trim();

    if (!name) {
        alert('Por favor, insira um nome para a playlist.');
        return;
    }

    if (playlistSongs.length === 0) {
        alert('Adicione pelo menos uma música à playlist.');
        return;
    }

    try {
        const { db, collection, addDoc, updateDoc, doc, serverTimestamp } = window.firebaseDB;

        const playlistData = {
            name,
            description,
            ownerUid: currentUser.uid,
            songs: playlistSongs,
            updatedAt: serverTimestamp()
        };

        if (isEditingPlaylist && editingPlaylistId) {
            // Update existing playlist
            await updateDoc(doc(db, 'playlists', editingPlaylistId), playlistData);
            console.log('[W.CIFRAS] Playlist updated:', editingPlaylistId);

            // Update local userPlaylists
            const playlistIndex = userPlaylists.findIndex(p => p.id === editingPlaylistId);
            if (playlistIndex !== -1) {
                userPlaylists[playlistIndex] = {
                    ...userPlaylists[playlistIndex],
                    ...playlistData
                };
            }

            // Update current playlist button if it's the current playlist
            if (currentPlaylistId === editingPlaylistId) {
                showCurrentPlaylistButton(editingPlaylistId, name);
            }
        } else {
            // Create new playlist
            playlistData.createdAt = serverTimestamp();
            const docRef = await addDoc(collection(db, 'playlists'), playlistData);
            console.log('[W.CIFRAS] Playlist saved:', docRef.id);

            // Show current playlist button
            showCurrentPlaylistButton(docRef.id, name);
        }

        // Close modal
        closePlaylistModal();

        // Load user playlists to refresh
        loadUserPlaylists();

    } catch (error) {
        console.error('[W.CIFRAS] Error saving playlist:', error);
        console.error('[W.CIFRAS] Error code:', error.code);
        console.error('[W.CIFRAS] Error message:', error.message);
        alert('Erro ao salvar playlist: ' + error.message + '. Tente novamente.');
    }
}

// Load user playlists
function loadUserPlaylists() {
    if (!currentUser || typeof window.firebaseDB === 'undefined') {
        return;
    }

    // Unsubscribe existing listener to prevent duplicates
    if (unsubscribePlaylists) {
        unsubscribePlaylists();
        unsubscribePlaylists = null;
    }

    try {
        const { db, collection, query, where, onSnapshot } = window.firebaseDB;

        // Simple query without orderBy to avoid index issues
        const playlistsQuery = query(
            collection(db, 'playlists'),
            where('ownerUid', '==', currentUser.uid)
        );

        unsubscribePlaylists = onSnapshot(playlistsQuery, (snapshot) => {
            userPlaylists = [];
            snapshot.forEach((doc) => {
                userPlaylists.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            // Sort by updatedAt in JavaScript (descending)
            userPlaylists.sort((a, b) => {
                const dateA = a.updatedAt ? (a.updatedAt.toDate ? a.updatedAt.toDate() : new Date(a.updatedAt)) : new Date(0);
                const dateB = b.updatedAt ? (b.updatedAt.toDate ? b.updatedAt.toDate() : new Date(b.updatedAt)) : new Date(0);
                return dateB - dateA;
            });

            console.log('[W.CIFRAS] Loaded playlists:', userPlaylists.length);

            // Show most recent playlist if exists
            if (userPlaylists.length > 0) {
                const mostRecent = userPlaylists[0];
                showCurrentPlaylistButton(mostRecent.id, mostRecent.name);
            }
        }, (error) => {
            console.error('[W.CIFRAS] Error loading playlists:', error);
            console.error('[W.CIFRAS] Error code:', error.code);
            console.error('[W.CIFRAS] Error message:', error.message);
        });
    } catch (error) {
        console.error('[W.CIFRAS] Error in loadUserPlaylists:', error);
        console.error('[W.CIFRAS] Error code:', error.code);
        console.error('[W.CIFRAS] Error message:', error.message);
    }
}

// Show current playlist button
function showCurrentPlaylistButton(playlistId, playlistName) {
    const btn = document.getElementById('wcifrasCurrentPlaylistBtn');
    btn.style.display = 'flex';
    btn.title = playlistName;
    btn.dataset.playlistId = playlistId;

    // Set first letter as cover
    const coverLetter = btn.querySelector('.wcifras-playlist-cover-letter');
    if (coverLetter && playlistName) {
        coverLetter.textContent = playlistName.charAt(0).toUpperCase();
    }
}

// Open playlist (loads first song directly)
async function openPlaylist(playlistId) {
    console.log('[W.CIFRAS] Opening playlist:', playlistId);

    let playlist = userPlaylists.find(p => p.id === playlistId);

    // Fallback: fetch directly from Firestore if not in local cache
    if (!playlist) {
        console.error('[W.CIFRAS] Playlist not found in local cache:', playlistId);

        try {
            const { db, doc, getDoc } = window.firebaseDB;
            const playlistDoc = await getDoc(doc(db, 'playlists', playlistId));

            if (playlistDoc.exists()) {
                playlist = {
                    id: playlistDoc.id,
                    ...playlistDoc.data()
                };

                // Verify ownership
                if (playlist.ownerUid !== currentUser.uid) {
                    console.error('[W.CIFRAS] Playlist does not belong to current user');
                    alert('Você não tem permissão para acessar esta playlist.');
                    return;
                }

                console.log('[W.CIFRAS] Playlist loaded from Firestore fallback:', playlist.name);
            } else {
                console.error('[W.CIFRAS] Playlist not found in Firestore:', playlistId);
                alert('Playlist não encontrada.');
                return;
            }
        } catch (error) {
            console.error('[W.CIFRAS] Error fetching playlist from Firestore:', error);
            console.error('[W.CIFRAS] Error code:', error.code);
            console.error('[W.CIFRAS] Error message:', error.message);
            alert('Erro ao carregar playlist. Tente novamente.');
            return;
        }
    }

    if (!playlist.songs || playlist.songs.length === 0) {
        console.log('[W.CIFRAS] Playlist has no songs');
        alert('Esta playlist não tem músicas.');
        return;
    }

    currentPlaylist = playlist;
    currentPlaylistId = playlistId;

    const sortedSongs = [...playlist.songs].sort((a, b) => a.order - b.order);
    playlistSongs = sortedSongs;

    const firstSong = sortedSongs[0];

    if (!firstSong || !firstSong.chordId) {
        console.log('[W.CIFRAS] First song is invalid');
        alert('Primeira música da playlist inválida.');
        return;
    }

    console.log('[W.CIFRAS] Opening playlist:', playlist.name);
    console.log('[W.CIFRAS] First song:', firstSong.chordId);

    // Open directly the first chord
    openChordView(firstSong.chordId);
}

// Render playlist sidebar
function renderPlaylistSidebar() {
    const sidebarList = document.getElementById('wcifrasSidebarList');

    if (!sidebarList) return;

    sidebarList.innerHTML = '';

    if (!currentPlaylist || !currentPlaylist.songs) {
        return;
    }

    const sortedSongs = [...currentPlaylist.songs].sort((a, b) => a.order - b.order);

    sortedSongs.forEach((song, index) => {
        const chord = allChords.find(c => c.id === song.chordId);

        if (!chord) return;

        const item = document.createElement('li');
        item.className = 'wcifras-sidebar-item';

        if (chord.id === currentChordId) {
            item.classList.add('active');
        }

        item.innerHTML = `
            <span class="wcifras-sidebar-song-number">${index + 1}</span>
            <span class="wcifras-sidebar-song-title">${chord.title}</span>
        `;

        item.addEventListener('click', () => {
            // Keep playlist context
            currentPlaylistId = currentPlaylist.id;

            // Open the chord in the same reader
            openChordView(chord.id);
        });

        sidebarList.appendChild(item);
    });

    console.log('[W.CIFRAS] Playlist sidebar rendered:', sortedSongs.length, 'songs');
}

// Open playlist view (intermediate screen - kept for reference)
function openPlaylistView(playlistId) {
    const playlist = userPlaylists.find(p => p.id === playlistId);
    if (!playlist) return;
    
    currentPlaylist = playlist;
    currentPlaylistId = playlistId;
    
    // Hide catalog, show playlist view
    document.getElementById('wcifrasCatalogView').style.display = 'none';
    document.getElementById('wcifrasPlaylistView').style.display = 'block';
    
    // Update header
    document.getElementById('wcifrasPlaylistTitle').textContent = playlist.name;
    document.getElementById('wcifrasPlaylistDescription').textContent = playlist.description || '';
    
    // Render songs
    renderPlaylistViewSongs();
    
    console.log('[W.CIFRAS] Playlist view opened:', playlist.name);
}

// Render playlist view songs
function renderPlaylistViewSongs() {
    const container = document.getElementById('wcifrasPlaylistSongsList');
    
    if (!currentPlaylist || !currentPlaylist.songs || currentPlaylist.songs.length === 0) {
        container.innerHTML = '<p class="wcifras-playlist-empty">Esta playlist não tem músicas.</p>';
        return;
    }
    
    container.innerHTML = '';
    
    // Sort by order
    const sortedSongs = [...currentPlaylist.songs].sort((a, b) => a.order - b.order);
    
    sortedSongs.forEach((song, index) => {
        const chord = allChords.find(c => c.id === song.chordId);
        if (!chord) return;
        
        const card = document.createElement('div');
        card.className = 'wcifras-playlist-song-card';
        card.dataset.chordId = chord.id;
        card.innerHTML = `
            <div class="wcifras-playlist-song-number">${index + 1}</div>
            <div class="wcifras-playlist-song-content">
                <div class="wcifras-playlist-song-title">${chord.title}</div>
                <div class="wcifras-playlist-song-artist">${chord.artist}</div>
                <div class="wcifras-playlist-song-key">Tom: ${chord.key}</div>
            </div>
        `;
        
        card.addEventListener('click', () => {
            openChordView(chord.id);
        });
        
        container.appendChild(card);
    });
}

// Close playlist view
function closePlaylistView() {
    document.getElementById('wcifrasPlaylistView').style.display = 'none';
    document.getElementById('wcifrasCatalogView').style.display = 'block';
    currentPlaylist = null;
    currentPlaylistId = null;
}

// Delete playlist
async function deletePlaylist() {
    if (!currentPlaylistId) return;

    if (!confirm('Excluir playlist?\n\nEsta ação removerá apenas a playlist.\nAs cifras não serão apagadas.')) {
        return;
    }

    try {
        const { db, doc, deleteDoc } = window.firebaseDB;

        await deleteDoc(doc(db, 'playlists', currentPlaylistId));

        console.log('[W.CIFRAS] Playlist deleted:', currentPlaylistId);

        // Close view
        closePlaylistView();

        // Hide current playlist button
        document.getElementById('wcifrasCurrentPlaylistBtn').style.display = 'none';

    } catch (error) {
        console.error('[W.CIFRAS] Error deleting playlist:', error);
        alert('Erro ao excluir playlist. Tente novamente.');
    }
}

// ========================================
// PLAYLIST ACTIONS MENU
// ========================================

// Open playlist actions menu
function openPlaylistActionsMenu(playlistId) {
    const playlist = userPlaylists.find(p => p.id === playlistId);

    if (!playlist) {
        console.error('[W.CIFRAS] Playlist not found for actions menu:', playlistId);
        return;
    }

    // Set playlist ID for actions
    editingPlaylistId = playlistId;

    // Update menu title
    const titleElement = document.getElementById('wcifrasPlaylistActionsTitle');
    if (titleElement) {
        titleElement.textContent = playlist.name;
    }

    // Show overlay
    const overlay = document.getElementById('wcifrasPlaylistActionsOverlay');
    if (overlay) {
        overlay.classList.add('active');
    }

    console.log('[W.CIFRAS] Playlist actions menu opened:', playlist.name);
}

// Close playlist actions menu
function closePlaylistActionsMenu() {
    const overlay = document.getElementById('wcifrasPlaylistActionsOverlay');
    if (overlay) {
        overlay.classList.remove('active');
    }

    editingPlaylistId = null;
    longPressTriggered = false; // Reset flag so next click works normally

    console.log('[W.CIFRAS] Playlist actions menu closed');
}

// Edit playlist from actions menu
function editPlaylistFromActions() {
    if (!editingPlaylistId) {
        console.error('[W.CIFRAS] No playlist ID for edit');
        return;
    }

    const playlist = userPlaylists.find(p => p.id === editingPlaylistId);

    if (!playlist) {
        console.error('[W.CIFRAS] Playlist not found for edit:', editingPlaylistId);
        return;
    }

    // Close actions menu
    closePlaylistActionsMenu();

    // Set modal to edit mode
    isEditingPlaylist = true;
    editingPlaylistId = playlist.id;

    // Populate modal with current data
    document.getElementById('wcifrasPlaylistName').value = playlist.name || '';
    document.getElementById('wcifrasPlaylistDescription').value = playlist.description || '';

    // Load songs
    playlistSongs = [...playlist.songs].sort((a, b) => a.order - b.order);
    renderPlaylistSongs();

    // Update modal title and button
    document.querySelector('#wcifrasPlaylistModal .wcifras-modal-title').textContent = 'EDITAR PLAYLIST';
    document.querySelector('#wcifrasPlaylistModalSave').textContent = 'Salvar alterações';

    // Show modal
    const modal = document.getElementById('wcifrasPlaylistModal');
    if (modal) {
        modal.classList.add('active');
    }

    console.log('[W.CIFRAS] Edit playlist modal opened:', playlist.name);
}

// Open delete playlist confirmation
function openDeletePlaylistConfirmation() {
    if (!editingPlaylistId) {
        console.error('[W.CIFRAS] No playlist ID for delete');
        return;
    }

    // Close actions menu
    closePlaylistActionsMenu();

    // Show confirmation modal
    const modal = document.getElementById('wcifrasDeletePlaylistModal');
    if (modal) {
        modal.style.display = 'flex';
    }

    console.log('[W.CIFRAS] Delete playlist confirmation opened');
}

// Close delete playlist confirmation
function closeDeletePlaylistConfirmation() {
    const modal = document.getElementById('wcifrasDeletePlaylistModal');
    if (modal) {
        modal.style.display = 'none';
    }

    console.log('[W.CIFRAS] Delete playlist confirmation closed');
}

// Confirm delete playlist
async function confirmDeletePlaylist() {
    if (!editingPlaylistId) {
        console.error('[W.CIFRAS] No playlist ID for delete confirmation');
        return;
    }

    try {
        const { db, doc, deleteDoc } = window.firebaseDB;

        await deleteDoc(doc(db, 'playlists', editingPlaylistId));

        console.log('[W.CIFRAS] Playlist deleted:', editingPlaylistId);

        // Remove from local userPlaylists
        userPlaylists = userPlaylists.filter(p => p.id !== editingPlaylistId);

        // If it was the current playlist, clear context
        if (currentPlaylistId === editingPlaylistId) {
            currentPlaylist = null;
            currentPlaylistId = null;
            playlistSongs = [];

            // Hide current playlist button
            document.getElementById('wcifrasCurrentPlaylistBtn').style.display = 'none';
        }

        // Close confirmation modal
        closeDeletePlaylistConfirmation();

        // If it was the most recent playlist, show the next one
        if (userPlaylists.length > 0) {
            const mostRecent = userPlaylists[0];
            showCurrentPlaylistButton(mostRecent.id, mostRecent.name);
        }

    } catch (error) {
        console.error('[W.CIFRAS] Error deleting playlist:', error);
        console.error('[W.CIFRAS] Error code:', error.code);
        console.error('[W.CIFRAS] Error message:', error.message);
        alert('Erro ao excluir playlist: ' + error.message + '. Tente novamente.');
    }
}

// Share playlist
async function sharePlaylist() {
    if (!editingPlaylistId) {
        console.error('[W.CIFRAS] No playlist ID for share');
        return;
    }

    const playlist = userPlaylists.find(p => p.id === editingPlaylistId);

    if (!playlist) {
        console.error('[W.CIFRAS] Playlist not found for share:', editingPlaylistId);
        return;
    }

    // Close actions menu
    closePlaylistActionsMenu();

    // Generate share URL
    const shareUrl = new URL('wcifras.html', window.location.origin);
    shareUrl.searchParams.set('playlist', editingPlaylistId);

    // Create share message
    const shareMessage = `Confira esta playlist no W.Cifras!\n\n${playlist.name}\n\nAcesse a playlist:\n${shareUrl.toString()}`;

    // Try native share first
    if (navigator.share) {
        try {
            await navigator.share({
                title: playlist.name,
                text: shareMessage,
                url: shareUrl.toString()
            });
            console.log('[W.CIFRAS] Playlist shared successfully');
            return;
        } catch (shareError) {
            if (shareError.name !== 'AbortError') {
                console.log('[W.CIFRAS] Native share failed, falling back to clipboard:', shareError);
            } else {
                // User cancelled share
                return;
            }
        }
    }

    // Fallback: copy to clipboard
    await navigator.clipboard.writeText(shareMessage);
    showShareConfirmation();
    console.log('[W.CIFRAS] Playlist link copied to clipboard');
}

// ========================================
// CHORD SHARING
// ========================================

// Share chord
async function shareChord() {
    if (!currentChordId) {
        console.log('[W.CIFRAS] No chord to share');
        return;
    }
    
    if (typeof window.firebaseDB === 'undefined') {
        console.error('[W.CIFRAS] Firebase DB not available');
        return;
    }
    
    try {
        const { db, doc, getDoc } = window.firebaseDB;
        
        // Get chord data from Firestore
        const chordDoc = await getDoc(doc(db, 'chords', currentChordId));
        
        if (!chordDoc.exists()) {
            console.log('[W.CIFRAS] Chord not found');
            return;
        }
        
        const chord = chordDoc.data();
        
        // Generate share URL
        const shareUrl = new URL('wcifras.html', window.location.origin);
        shareUrl.searchParams.set('id', currentChordId);
        
        // Create share message
        const shareMessage = `Olha essa cifra que compartilharam com você pelo W.Cifras!\n\n${chord.title} — ${chord.artist}\n\nAcesse a cifra:\n${shareUrl.toString()}`;
        
        // Try native share first
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `${chord.title} — ${chord.artist}`,
                    text: shareMessage,
                    url: shareUrl.toString()
                });
                console.log('[W.CIFRAS] Chord shared successfully');
                return;
            } catch (shareError) {
                if (shareError.name !== 'AbortError') {
                    console.log('[W.CIFRAS] Native share failed, falling back to clipboard:', shareError);
                } else {
                    // User cancelled share
                    return;
                }
            }
        }
        
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(shareMessage);
        showShareConfirmation();
        console.log('[W.CIFRAS] Chord link copied to clipboard');
        
    } catch (error) {
        console.error('[W.CIFRAS] Share error:', error);
    }
}

// Show share confirmation
function showShareConfirmation() {
    // Create temporary confirmation element
    const confirmation = document.createElement('div');
    confirmation.className = 'wcifras-share-confirmation';
    confirmation.textContent = 'Link da cifra copiado.';
    confirmation.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--wcifras-accent);
        color: var(--wcifras-black);
        padding: 12px 24px;
        border-radius: var(--wcifras-radius-md);
        font-size: var(--wcifras-font-size-sm);
        font-weight: 500;
        z-index: 10000;
        animation: fadeIn 0.3s ease;
    `;
    
    document.body.appendChild(confirmation);
    
    // Remove after 2 seconds
    setTimeout(() => {
        confirmation.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(confirmation);
        }, 300);
    }, 2000);
}

// ========================================
// CHORD EDITING
// ========================================

// Open edit mode (inline)
function openEditModal() {
    if (!currentChordData) {
        console.log('[W.CIFRAS] No chord data to edit');
        return;
    }
    
    if (!currentUser) {
        showLoginModal();
        return;
    }
    
    // Check if user is the author
    if (currentChordData.author?.uid !== currentUser.uid) {
        showPermissionError();
        return;
    }
    
    // Enter edit mode
    const chordView = document.getElementById('wcifrasChordView');
    const chordContent = document.getElementById('wcifrasChordContent');
    const chordEditor = document.getElementById('wcifrasChordEditor');
    const saveBtn = document.getElementById('wcifrasSaveBtn');
    
    // Populate editor with current content
    chordEditor.value = originalChordContent;
    
    // Switch to edit mode
    chordContent.style.display = 'none';
    chordEditor.style.display = 'block';
    saveBtn.style.display = 'flex';
    
    // Add editing class for focus effect
    chordView.classList.add('editing');
    
    // Focus editor
    chordEditor.focus();
    
    console.log('[W.CIFRAS] Edit mode opened');
}

// Close edit mode
function closeEditModal() {
    const chordView = document.getElementById('wcifrasChordView');
    const chordContent = document.getElementById('wcifrasChordContent');
    const chordEditor = document.getElementById('wcifrasChordEditor');
    const saveBtn = document.getElementById('wcifrasSaveBtn');
    
    // Switch back to read mode
    chordContent.style.display = 'block';
    chordEditor.style.display = 'none';
    saveBtn.style.display = 'none';
    
    // Remove editing class
    chordView.classList.remove('editing');
    
    console.log('[W.CIFRAS] Edit mode closed');
}

// Save edited chord
async function saveEditedChord() {
    if (!currentChordId || !currentChordData) {
        console.log('[W.CIFRAS] No chord to save');
        return;
    }
    
    if (!currentUser) {
        showLoginModal();
        return;
    }
    
    const chordEditor = document.getElementById('wcifrasChordEditor');
    const content = chordEditor.value.trim();
    
    if (!content) {
        alert('Por favor, preencha o conteúdo da cifra.');
        return;
    }
    
    try {
        const { db, doc, updateDoc, serverTimestamp } = window.firebaseDB;
        
        await updateDoc(doc(db, 'chords', currentChordId), {
            content,
            updatedAt: serverTimestamp()
        });
        
        // Update local data
        currentChordData = {
            ...currentChordData,
            content,
            updatedAt: new Date().toISOString()
        };
        
        // Update original content
        originalChordContent = content;
        
        // Re-render
        renderChordContent(content);
        
        // Update edited date display
        updateEditedDateDisplay();
        
        // Close edit mode
        closeEditModal();
        
        console.log('[W.CIFRAS] Chord updated successfully');
    } catch (error) {
        console.error('[W.CIFRAS] Error updating chord:', error);
        alert('Erro ao salvar a cifra. Tente novamente.');
    }
}

// Update edited date display
function updateEditedDateDisplay() {
    const editedElement = document.getElementById('wcifrasChordEdited');
    
    if (currentChordData.updatedAt) {
        let date;
        
        // Handle Firebase Timestamp object
        if (currentChordData.updatedAt.toDate) {
            date = currentChordData.updatedAt.toDate();
        } else if (typeof currentChordData.updatedAt === 'string') {
            date = new Date(currentChordData.updatedAt);
        } else {
            date = new Date(currentChordData.updatedAt);
        }
        
        if (!isNaN(date.getTime())) {
            const formattedDate = date.toLocaleDateString('pt-BR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
            
            editedElement.textContent = `Editada em ${formattedDate}`;
            editedElement.style.display = 'block';
        } else {
            editedElement.style.display = 'none';
        }
    } else {
        editedElement.style.display = 'none';
    }
}

// Show permission error
function showPermissionError() {
    alert('Você não tem permissão para editar esta cifra. Apenas o autor pode editar.');
}

// ========================================
// CHORD DOWNLOAD
// ========================================

// Download chord as text file
function downloadChord() {
    if (!currentChordData) {
        console.log('[W.CIFRAS] No chord data to download');
        return;
    }
    
    const content = `${currentChordData.title} — ${currentChordData.artist}
Tom: ${currentChordData.key}

${currentChordData.content}`;
    
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentChordData.title.replace(/[^a-zA-Z0-9]/g, '_')}_cifra.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('[W.CIFRAS] Chord downloaded');
}

// ========================================
// CHORD PRINT
// ========================================

// Print chord
function printChord() {
    if (!currentChordData) {
        console.log('[W.CIFRAS] No chord data to print');
        return;
    }
    
    window.print();
    console.log('[W.CIFRAS] Print dialog opened');
}

// ========================================
// CHORDS LIST
// ========================================

// Load chords from Firestore
function loadChordsFromFirestore() {
    if (typeof window.firebaseDB === 'undefined') {
        console.warn('[W.CIFRAS] Firebase DB not available, cannot load chords');
        return;
    }
    
    const { db, collection, query, orderBy, onSnapshot } = window.firebaseDB;
    
    // Query chords ordered by creation date (newest first)
    const chordsQuery = query(
        collection(db, 'chords'),
        orderBy('createdAt', 'desc')
    );
    
    // Real-time listener
    onSnapshot(chordsQuery, (snapshot) => {
        const chords = [];
        
        snapshot.forEach((doc) => {
            chords.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // Store all chords for search
        allChords = chords;
        
        renderChordsList(chords);
        console.log('[W.CIFRAS] Loaded', chords.length, 'chords from Firestore');
    }, (error) => {
        console.error('[W.CIFRAS] Error loading chords:', error);
    });
}

// Filter chords based on search query
function filterChords(searchTerm) {
    if (!searchTerm || searchTerm.trim() === '') {
        renderChordsList(allChords);
        return;
    }
    
    const term = searchTerm.toLowerCase().trim();
    const filtered = allChords.filter(chord => {
        const title = chord.title ? chord.title.toLowerCase() : '';
        const artist = chord.artist ? chord.artist.toLowerCase() : '';
        const key = chord.key ? chord.key.toLowerCase() : '';
        
        return title.includes(term) || artist.includes(term) || key.includes(term);
    });
    
    renderChordsList(filtered);
    console.log('[W.CIFRAS] Filtered chords:', filtered.length);
}

// Render chords list
function renderChordsList(chords) {
    const listContainer = document.getElementById('wcifrasList');
    const emptyState = document.getElementById('wcifrasEmptyState');
    
    if (!listContainer || !emptyState) {
        console.error('[W.CIFRAS] List containers not found');
        return;
    }
    
    // Clear existing content
    listContainer.innerHTML = '';
    
    // Show empty state if no chords
    if (chords.length === 0) {
        emptyState.style.display = 'flex';
        listContainer.style.display = 'none';
        return;
    }
    
    // Show list and hide empty state
    emptyState.style.display = 'none';
    listContainer.style.display = 'flex';
    
    // Render each chord card
    chords.forEach(chord => {
        const card = createChordCard(chord);
        listContainer.appendChild(card);
    });
}

// Create a single chord card element
function createChordCard(chord) {
    const card = document.createElement('div');
    card.className = 'wcifras-card';
    card.dataset.id = chord.id;
    
    // Create cover section
    const cover = document.createElement('div');
    cover.className = 'wcifras-card-cover';
    
    if (chord.cover) {
        const img = document.createElement('img');
        img.src = chord.cover;
        img.alt = chord.title;
        cover.appendChild(img);
    } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'wcifras-card-cover-placeholder';
        placeholder.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M9 18V5l12-2v13"></path>
                <circle cx="6" cy="18" r="3"></circle>
                <circle cx="18" cy="16" r="3"></circle>
            </svg>
        `;
        cover.appendChild(placeholder);
    }
    
    // Create content section
    const content = document.createElement('div');
    content.className = 'wcifras-card-content';
    
    const title = document.createElement('div');
    title.className = 'wcifras-card-title';
    title.textContent = chord.title;
    
    const artist = document.createElement('div');
    artist.className = 'wcifras-card-artist';
    artist.textContent = chord.artist;
    
    const meta = document.createElement('div');
    meta.className = 'wcifras-card-meta';
    
    const authorItem = document.createElement('div');
    authorItem.className = 'wcifras-card-meta-item';
    authorItem.innerHTML = `
        <svg class="wcifras-card-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
        </svg>
        <span>${chord.author?.name || 'Anônimo'}</span>
    `;
    
    const separator = document.createElement('span');
    separator.textContent = '•';
    
    const keyItem = document.createElement('div');
    keyItem.className = 'wcifras-card-meta-item';
    keyItem.innerHTML = `
        <span>Tom: <span class="wcifras-card-key">${chord.key}</span></span>
    `;
    
    meta.appendChild(authorItem);
    meta.appendChild(separator);
    meta.appendChild(keyItem);
    
    content.appendChild(title);
    content.appendChild(artist);
    content.appendChild(meta);
    
    // Create favorite button
    const favoriteBtn = document.createElement('button');
    favoriteBtn.className = 'wcifras-card-favorite';
    favoriteBtn.setAttribute('aria-label', 'Favoritar');
    favoriteBtn.innerHTML = `
        <svg viewBox="0 0 24 24">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
        </svg>
    `;
    
    // Prevent card click when clicking favorite button
    favoriteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        favoriteBtn.classList.toggle('active');
        console.log('[W.CIFRAS] Favorite toggled for chord:', chord.id);
    });
    
    // Assemble card
    card.appendChild(cover);
    card.appendChild(content);
    card.appendChild(favoriteBtn);
    
    // Add click handler to open chord view
    card.addEventListener('click', () => {
        openChordView(chord.id);
    });
    
    return card;
}

// ========================================
// INITIALIZATION
// ========================================

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initializeAuth();
    setupEventListeners();
    
    // Load chords from Firestore after Firebase is initialized
    const checkFirebase = setInterval(() => {
        if (typeof window.firebaseDB !== 'undefined') {
            clearInterval(checkFirebase);
            loadChordsFromFirestore();
            checkUrlForChordId();
            
            // Initialize instrument system
            initializeInstrumentCategories();
            loadInstrumentPreference();
        }
    }, 100);
    
    // Timeout after 5 seconds
    setTimeout(() => {
        clearInterval(checkFirebase);
    }, 5000);
});

// Future functionality will be added in later stages
// - Search functionality
// - Firebase integration
// - Chord display viewer
// - Transposition
// - Real favorites system
// - Upload/edit chords
