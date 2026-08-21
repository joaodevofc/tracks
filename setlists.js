/**
 * Setlists Manager
 * Gerencia o sistema de setlists com integração do YouTube
 */

class SetlistsManager {
    constructor(app) {
        this.app = app;
        this.currentSetlist = null;
        this.setlists = [];
        this.youtubePlayer = null;
        this.searchTimeout = null;
        
        this.init();
    }
    
    async init() {
        console.log('[SETLISTS] Initializing Setlists Manager');
        
        // Initialize Firebase collections
        if (window.firebaseDB) {
            this.db = window.firebaseDB.db;
            this.collection = window.firebaseDB.collection;
            this.getDocs = window.firebaseDB.getDocs;
            this.query = window.firebaseDB.query;
            this.where = window.firebaseDB.where;
            this.orderBy = window.firebaseDB.orderBy;
            this.addDoc = window.firebaseDB.addDoc;
            this.updateDoc = window.firebaseDB.updateDoc;
            this.deleteDoc = window.firebaseDB.deleteDoc;
            this.doc = window.firebaseDB.doc;
            this.getDoc = window.firebaseDB.getDoc;
            this.setDoc = window.firebaseDB.setDoc;
            this.serverTimestamp = window.firebaseDB.serverTimestamp;
        }
        
        this.initEventListeners();
        this.loadSetlists();
    }
    
    initEventListeners() {
        console.log('[SETLISTS] Initializing event listeners');
        
        // Navigation
        const setlistsNavLink = document.querySelector('[data-view="setlists"]');
        console.log('[SETLISTS] Setlists nav link:', setlistsNavLink);
        
        if (setlistsNavLink) {
            setlistsNavLink.addEventListener('click', (e) => {
                console.log('[SETLISTS] Setlists nav link clicked');
                e.preventDefault();
                this.showSetlistsView();
            });
        } else {
            console.error('[SETLISTS] Setlists nav link not found!');
        }
        
        // Hide floating menu when leaving setlists view
        const otherNavLinks = document.querySelectorAll('.nav-link:not([data-view="setlists"])');
        otherNavLinks.forEach(link => {
            link.addEventListener('click', () => {
                document.getElementById('setlistsFloatingMenu').classList.remove('visible');
                document.getElementById('setlistsView').style.display = 'none';
            });
        });
        
        // Floating menu - Create setlist
        const floatingCreateSetlistBtn = document.getElementById('floatingCreateSetlistBtn');
        if (floatingCreateSetlistBtn) {
            floatingCreateSetlistBtn.addEventListener('click', async () => {
                // Check plan restrictions for Home users
                const userPlan = await this.getUserPlan();
                console.log('[SETLISTS] Create button clicked - User plan:', userPlan, 'Current setlists:', this.setlists.length);

                if (userPlan === 'home' && this.setlists.length >= 1) {
                    console.log('[SETLISTS] Home user already has 1 setlist, showing upgrade modal');
                    if (this.app && this.app.showUpgradeModal) {
                        this.app.showUpgradeModal('Setlists');
                    } else {
                        alert('No plano Home, você pode criar apenas 1 setlist. Faça upgrade para o plano Studio para criar setlists ilimitadas.');
                    }
                    return;
                }

                this.showCreateSetlistModal();
            });
        }
        
        // YouTube search (main page)
        const searchInput = document.getElementById('setlistsSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                clearTimeout(this.searchTimeout);
                this.searchTimeout = setTimeout(() => {
                    this.searchYouTube(e.target.value);
                }, 500);
            });
        }
        
        // Back to setlists
        const backToSetlistsBtn = document.getElementById('backToSetlists');
        if (backToSetlistsBtn) {
            backToSetlistsBtn.addEventListener('click', () => this.showSetlistsView());
        }
        
        // Share setlist
        const shareSetlistBtn = document.getElementById('shareSetlistBtn');
        if (shareSetlistBtn) {
            shareSetlistBtn.addEventListener('click', () => this.shareCurrentSetlist());
        }
        
        // Delete setlist
        const deleteSetlistBtn = document.getElementById('deleteSetlistBtn');
        if (deleteSetlistBtn) {
            deleteSetlistBtn.addEventListener('click', () => this.deleteCurrentSetlist());
        }
        
        // YouTube search (setlist editor)
        const setlistSearchInput = document.getElementById('setlistEditorSearchInput');
        if (setlistSearchInput) {
            setlistSearchInput.addEventListener('input', (e) => {
                clearTimeout(this.searchTimeout);
                this.searchTimeout = setTimeout(() => {
                    this.searchYouTubeInSetlist(e.target.value);
                }, 500);
            });
        }
    }
    
    async loadSetlists() {
        const userId = this.getCurrentUserId();
        
        if (!userId) {
            console.log('[SETLISTS] No user logged in');
            this.setlists = [];
            this.renderSetlists();
            return;
        }
        
        if (!this.db) {
            console.warn('[SETLISTS] Firebase not available');
            this.setlists = [];
            this.renderSetlists();
            return;
        }
        
        try {
            const q = this.query(
                this.collection(this.db, 'setlists'),
                this.where('userId', '==', userId)
            );
            
            console.log('[SETLISTS] Query created, fetching documents...');
            
            const querySnapshot = await this.getDocs(q);
            this.setlists = [];
            
            console.log('[SETLISTS] Query snapshot size:', querySnapshot.size);
            
            for (const doc of querySnapshot.docs) {
                const data = doc.data();
                this.setlists.push({
                    id: doc.id,
                    name: data.name,
                    createdAt: data.createdAt?.toDate() || new Date(),
                    songs: data.songs || [],
                    shareId: data.shareId || null
                });
                console.log('[SETLISTS] Loaded setlist:', data.name, 'ID:', doc.id);
            }
            
            // Sort by createdAt locally
            this.setlists.sort((a, b) => b.createdAt - a.createdAt);
            
            console.log('[SETLISTS] Loaded setlists:', this.setlists.length);
            this.renderSetlists();
        } catch (error) {
            console.error('[SETLISTS] Error loading setlists:', error);
            console.error('[SETLISTS] Error code:', error.code);
            this.setlists = [];
            this.renderSetlists();
        }
    }
    
    renderSetlists() {
        console.log('[SETLISTS] Rendering setlists, count:', this.setlists.length);
        
        const floatingList = document.getElementById('floatingSetlistsList');
        const noSetlists = document.getElementById('floatingNoSetlists');
        
        console.log('[SETLISTS] Floating list element:', floatingList);
        console.log('[SETLISTS] No setlists element:', noSetlists);
        
        if (!floatingList) {
            console.error('[SETLISTS] Floating setlists list element not found!');
            return;
        }
        
        if (this.setlists.length === 0) {
            floatingList.style.display = 'none';
            noSetlists.style.display = 'block';
            console.log('[SETLISTS] Showing no setlists message');
            return;
        }
        
        floatingList.style.display = 'flex';
        noSetlists.style.display = 'none';
        
        floatingList.innerHTML = this.setlists.map((setlist, index) => this.createFloatingSetlistItem(setlist, index)).join('');
        
        console.log('[SETLISTS] Rendered', this.setlists.length, 'setlist items');
        
        // Add event listeners to floating items
        floatingList.querySelectorAll('.floating-setlist-item').forEach(item => {
            item.addEventListener('click', () => {
                const setlistId = item.dataset.setlistId;
                this.openSetlist(setlistId);
            });
        });
    }
    
    createFloatingSetlistItem(setlist, index) {
        // Use first letter of setlist name as display
        const firstLetter = setlist.name.charAt(0).toUpperCase();
        
        return `
            <div class="floating-setlist-item" data-setlist-id="${setlist.id}" data-setlist-name="${this.escapeHtml(setlist.name)}">
                ${firstLetter}
            </div>
        `;
    }
    
    createSetlistCard(setlist) {
        const date = this.formatDate(setlist.createdAt);
        const songCount = setlist.songs?.length || 0;
        
        return `
            <div class="setlist-card" data-setlist-id="${setlist.id}">
                <div class="setlist-card-header">
                    <div>
                        <h3 class="setlist-card-title">${this.escapeHtml(setlist.name)}</h3>
                        <p class="setlist-card-date">${date}</p>
                    </div>
                </div>
                <p class="setlist-card-count">${songCount} música${songCount !== 1 ? 's' : ''}</p>
                <button class="setlist-card-open-btn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M5 12h14"></path>
                        <path d="M12 5l7 7-7 7"></path>
                    </svg>
                    Abrir
                </button>
            </div>
        `;
    }
    
    showSetlistsView() {
        console.log('[SETLISTS] Showing setlists view');
        
        // Hide all views
        document.getElementById('libraryView').style.display = 'none';
        document.getElementById('communityView').style.display = 'none';
        document.getElementById('myTracksView').style.display = 'none';
        document.getElementById('setlistEditorView').style.display = 'none';
        document.getElementById('playerView').style.display = 'none';
        
        // Show setlists search view
        document.getElementById('setlistsView').style.display = 'block';
        
        // Update navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector('[data-view="setlists"]').classList.add('active');
        
        // Show floating menu
        const floatingMenu = document.getElementById('setlistsFloatingMenu');
        console.log('[SETLISTS] Floating menu element:', floatingMenu);
        if (floatingMenu) {
            floatingMenu.classList.add('visible');
            console.log('[SETLISTS] Floating menu visible');
        } else {
            console.error('[SETLISTS] Floating menu element not found!');
        }
        
        // Clear search
        document.getElementById('setlistsSearchInput').value = '';
        document.getElementById('youtubeResults').style.display = 'none';
        document.getElementById('setlistsSearchEmptyState').style.display = 'block';
        
        // Load setlists for floating menu
        this.loadSetlists();
    }
    
    showCreateSetlistModal() {
        const modal = document.createElement('div');
        modal.className = 'create-setlist-modal';
        modal.id = 'createSetlistModal';
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2 class="modal-title">Nova Setlist</h2>
                    <button class="modal-close" id="closeCreateSetlistModal">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="modal-body">
                    <form class="create-setlist-form" id="createSetlistForm">
                        <div class="form-group">
                            <label class="form-label">Nome da Setlist</label>
                            <input type="text" class="form-input" id="setlistNameInput" placeholder="Ex: Culto de Domingo" required>
                        </div>
                        <button type="submit" class="create-setlist-submit-btn">
                            Criar Setlist
                        </button>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add event listeners
        const closeBtn = document.getElementById('closeCreateSetlistModal');
        const form = document.getElementById('createSetlistForm');
        
        closeBtn.addEventListener('click', () => {
            modal.remove();
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('setlistNameInput').value.trim();
            
            if (name) {
                await this.createSetlist(name);
                modal.remove();
            }
        });
        
        // Focus on input
        setTimeout(() => {
            document.getElementById('setlistNameInput').focus();
        }, 100);
    }
    
    showSetlistSelectionModal(songData) {
        console.log('[SETLISTS] Showing setlist selection modal for:', songData.title);
        
        // Reload setlists to get latest data
        this.loadSetlists().then(() => {
            console.log('[SETLISTS] Setlists loaded for selection modal:', this.setlists.length);
            
            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay active';
            overlay.id = 'setlistSelectionModalOverlay';
            
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.id = 'setlistSelectionModal';
            
            const setlistOptions = this.setlists.length > 0 
                ? this.setlists.map(setlist => `
                    <div class="setlist-selection-item" data-setlist-id="${setlist.id}">
                        <div class="setlist-selection-info">
                            <h4 class="setlist-selection-name">${this.escapeHtml(setlist.name)}</h4>
                            <p class="setlist-selection-count">${setlist.songs?.length || 0} músicas</p>
                        </div>
                        <button class="setlist-selection-add-btn">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                        </button>
                    </div>
                `).join('')
                : '<p class="no-setlists-message">Nenhuma setlist criada ainda</p>';
            
            modal.innerHTML = `
                <div class="modal-header">
                    <h2 class="modal-title">Salvar em Setlist</h2>
                    <button class="modal-close" id="closeSetlistSelectionModal">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="song-preview">
                        <div class="song-preview-thumbnail">
                            <img src="${songData.thumbnail}" alt="${this.escapeHtml(songData.title)}">
                        </div>
                        <div class="song-preview-info">
                            <h4 class="song-preview-title">${this.escapeHtml(songData.title)}</h4>
                            <p class="song-preview-channel">${this.escapeHtml(songData.channel)}</p>
                        </div>
                    </div>
                    
                    <h3 class="setlist-selection-title">Selecione uma setlist</h3>
                    
                    <div class="setlist-selection-list">
                        ${setlistOptions}
                    </div>
                    
                    <button class="create-new-setlist-btn" id="createNewSetlistFromSelection">
                        Criar Nova Setlist
                    </button>
                </div>
            `;
            
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
            console.log('[SETLISTS] Modal appended to body');
            
            // Add event listeners
            const closeBtn = document.getElementById('closeSetlistSelectionModal');
            const createNewBtn = document.getElementById('createNewSetlistFromSelection');
            
            closeBtn.addEventListener('click', () => {
                overlay.remove();
            });
            
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.remove();
                }
            });
            
            // Add event listeners to setlist items
            modal.querySelectorAll('.setlist-selection-item').forEach(item => {
                item.addEventListener('click', () => {
                    const setlistId = item.dataset.setlistId;
                    this.addSongToExistingSetlist(setlistId, songData);
                    overlay.remove();
                });
            });
            
            // Create new setlist button
            createNewBtn.addEventListener('click', async () => {
                // Check plan restrictions for Home users
                const userPlan = await this.getUserPlan();
                console.log('[SETLISTS] Create new setlist from selection - User plan:', userPlan, 'Current setlists:', this.setlists.length);

                if (userPlan === 'home' && this.setlists.length >= 1) {
                    console.log('[SETLISTS] Home user already has 1 setlist, showing upgrade modal');
                    overlay.remove();
                    if (this.app && this.app.showUpgradeModal) {
                        this.app.showUpgradeModal('Setlists');
                    } else {
                        alert('No plano Home, você pode criar apenas 1 setlist. Faça upgrade para o plano Studio para criar setlists ilimitadas.');
                    }
                    return;
                }

                overlay.remove();
                this.showCreateSetlistModalForSong(songData);
            });
        });
    }
    
    showCreateSetlistModalForSong(songData) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'createSetlistModal';
        
        modal.innerHTML = `
            <div class="modal-content create-setlist-modal">
                <div class="modal-header">
                    <h2 class="modal-title">Nova Setlist</h2>
                    <button class="modal-close" id="closeCreateSetlistModal">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="song-preview">
                        <div class="song-preview-thumbnail">
                            <img src="${songData.thumbnail}" alt="${this.escapeHtml(songData.title)}">
                        </div>
                        <div class="song-preview-info">
                            <h4 class="song-preview-title">${this.escapeHtml(songData.title)}</h4>
                            <p class="song-preview-channel">${this.escapeHtml(songData.channel)}</p>
                        </div>
                    </div>
                    
                    <form class="create-setlist-form" id="createSetlistForm">
                        <div class="form-group">
                            <label class="form-label">Nome da Setlist</label>
                            <input type="text" class="form-input" id="setlistNameInput" placeholder="Ex: Culto de Domingo" required>
                        </div>
                        <button type="submit" class="btn btn-primary">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M5 13l4 4L19 7"></path>
                            </svg>
                            Criar e Adicionar
                        </button>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add event listeners
        const closeBtn = document.getElementById('closeCreateSetlistModal');
        const form = document.getElementById('createSetlistForm');
        
        closeBtn.addEventListener('click', () => {
            modal.remove();
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('setlistNameInput').value.trim();
            
            if (name) {
                await this.createSetlistWithSong(name, songData);
                modal.remove();
            }
        });
        
        // Focus on input
        setTimeout(() => {
            document.getElementById('setlistNameInput').focus();
        }, 100);
    }
    
    async addSongToExistingSetlist(setlistId, songData) {
        const setlist = this.setlists.find(s => s.id === setlistId);

        if (!setlist) {
            console.error('[SETLISTS] Setlist not found:', setlistId);
            return;
        }

        songData.position = setlist.songs?.length || 0;

        if (!setlist.songs) {
            setlist.songs = [];
        }

        // Check plan restrictions for Home users (max 5 songs per setlist)
        const userPlan = await this.getUserPlan();
        if (userPlan === 'home' && setlist.songs.length >= 5) {
            if (this.app && this.app.showUpgradeModal) {
                this.app.showUpgradeModal('Setlists');
            } else {
                alert('No plano Home, você pode adicionar no máximo 5 músicas por setlist. Faça upgrade para o plano Studio para adicionar músicas ilimitadas.');
            }
            return;
        }

        setlist.songs.push(songData);

        // Save to Firebase
        await this.saveSetlistById(setlistId, setlist);

        console.log('[SETLISTS] Song added to setlist:', songData.title, 'in setlist:', setlist.name);

        // Show feedback
        alert(`"${songData.title}" adicionada à setlist "${setlist.name}"`);
    }
    
    async createSetlistWithSong(name, songData) {
        const userId = this.getCurrentUserId();
        
        if (!userId) {
            alert('Você precisa estar logado para criar uma setlist');
            return;
        }
        
        if (!this.db) {
            alert('Erro: Firebase não disponível');
            return;
        }
        
        try {
            const shareId = this.generateShareId();
            
            const setlistData = {
                name: name,
                userId: userId,
                songs: [songData],
                shareId: shareId,
                createdAt: this.serverTimestamp(),
                updatedAt: this.serverTimestamp()
            };
            
            const docRef = await this.addDoc(this.collection(this.db, 'setlists'), setlistData);
            
            console.log('[SETLISTS] Setlist created with song:', docRef.id);
            
            // Reload setlists
            await this.loadSetlists();
            
            alert(`Setlist "${name}" criada com "${songData.title}"`);
        } catch (error) {
            console.error('[SETLISTS] Error creating setlist with song:', error);
            alert('Erro ao criar setlist: ' + error.message);
        }
    }
    
    async saveSetlistById(setlistId, setlist) {
        if (!this.db) return;
        
        try {
            const setlistRef = this.doc(this.db, 'setlists', setlistId);
            
            await this.updateDoc(setlistRef, {
                songs: setlist.songs,
                updatedAt: this.serverTimestamp()
            });
            
            console.log('[SETLISTS] Setlist saved:', setlistId);
        } catch (error) {
            console.error('[SETLISTS] Error saving setlist:', error);
        }
    }
    
    async createSetlist(name) {
        const userId = this.getCurrentUserId();

        console.log('[SETLISTS] Creating setlist with userId:', userId);

        if (!userId) {
            alert('Você precisa estar logado para criar uma setlist');
            return;
        }

        if (!this.db) {
            alert('Erro: Firebase não disponível');
            return;
        }

        // Check plan restrictions for Home users (backup check)
        const userPlan = await this.getUserPlan();
        console.log('[SETLISTS] Creating setlist - User plan:', userPlan, 'Current setlists count:', this.setlists.length);

        if (userPlan === 'home') {
            // Check if user already has a setlist
            if (this.setlists.length >= 1) {
                console.log('[SETLISTS] Home user already has 1 setlist, blocking creation (backup check)');
                // This should normally be caught by the button click handler, but keeping as backup
                if (this.app && this.app.showUpgradeModal) {
                    this.app.showUpgradeModal('Setlists');
                }
                return;
            }
        }

        try {
            const shareId = this.generateShareId();

            const setlistData = {
                name: name,
                userId: userId,
                songs: [],
                shareId: shareId,
                createdAt: this.serverTimestamp(),
                updatedAt: this.serverTimestamp()
            };

            console.log('[SETLISTS] Adding document to setlists collection:', setlistData);

            const docRef = await this.addDoc(this.collection(this.db, 'setlists'), setlistData);

            console.log('[SETLISTS] Setlist created with ID:', docRef.id);

            // Reload setlists
            await this.loadSetlists();

            // Open the new setlist
            this.openSetlist(docRef.id);
        } catch (error) {
            console.error('[SETLISTS] Error creating setlist:', error);
            console.error('[SETLISTS] Error details:', error.code, error.message);
            alert('Erro ao criar setlist: ' + error.message);
        }
    }
    
    async openSetlist(setlistId) {
        const setlist = this.setlists.find(s => s.id === setlistId);
        
        if (!setlist) {
            console.error('[SETLISTS] Setlist not found:', setlistId);
            return;
        }
        
        this.currentSetlist = setlist;
        
        // Hide all views
        document.getElementById('libraryView').style.display = 'none';
        document.getElementById('communityView').style.display = 'none';
        document.getElementById('myTracksView').style.display = 'none';
        document.getElementById('setlistsView').style.display = 'none';
        document.getElementById('playerView').style.display = 'none';
        
        // Show setlist editor view
        document.getElementById('setlistEditorView').style.display = 'block';
        
        // Update header
        document.getElementById('setlistEditorTitle').textContent = setlist.name;
        document.getElementById('setlistEditorDate').textContent = this.formatDate(setlist.createdAt);
        
        // Clear search
        const setlistSearchInput = document.getElementById('setlistEditorSearchInput');
        if (setlistSearchInput) {
            setlistSearchInput.value = '';
        }
        document.getElementById('youtubeResults').style.display = 'none';
        
        // Hide floating menu
        document.getElementById('setlistsFloatingMenu').classList.remove('visible');
        
        // Render songs
        this.renderSetlistSongs();
    }
    
    renderSetlistSongs() {
        const songsList = document.getElementById('setlistSongsList');
        const emptyState = document.getElementById('setlistSongsEmptyState');
        
        if (!songsList) return;
        
        const songs = this.currentSetlist.songs || [];
        
        if (songs.length === 0) {
            songsList.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }
        
        songsList.style.display = 'flex';
        emptyState.style.display = 'none';
        
        songsList.innerHTML = songs.map((song, index) => this.createSetlistSongItem(song, index)).join('');
        
        // Add event listeners
        songsList.querySelectorAll('.setlist-song-item').forEach((item, index) => {
            // Drag and drop
            item.setAttribute('draggable', 'true');
            item.addEventListener('dragstart', (e) => this.handleDragStart(e, index));
            item.addEventListener('dragover', (e) => this.handleDragOver(e));
            item.addEventListener('drop', (e) => this.handleDrop(e, index));
            item.addEventListener('dragend', () => this.handleDragEnd());
            
            // Play button
            const playBtn = item.querySelector('.setlist-song-play-btn');
            if (playBtn) {
                playBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.playYouTubeVideo(song.youtubeVideoId);
                });
            }
            
            // Remove button
            const removeBtn = item.querySelector('.setlist-song-remove-btn');
            if (removeBtn) {
                removeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.removeSongFromSetlist(index);
                });
            }
        });
    }
    
    createSetlistSongItem(song, index) {
        const thumbnail = song.thumbnail || 'https://via.placeholder.com/60x60?text=♫';
        
        return `
            <div class="setlist-song-item" data-index="${index}">
                <span class="setlist-song-number">${String(index + 1).padStart(2, '0')}</span>
                <div class="setlist-song-thumbnail">
                    <img src="${thumbnail}" alt="${this.escapeHtml(song.title)}">
                </div>
                <div class="setlist-song-info">
                    <h4 class="setlist-song-title">${this.escapeHtml(song.title)}</h4>
                    <p class="setlist-song-channel">${this.escapeHtml(song.channel)}</p>
                </div>
                <div class="setlist-song-actions">
                    <button class="setlist-song-play-btn" title="Ouvir no YouTube">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polygon points="5 3 19 12 5 21 5 3"></polygon>
                        </svg>
                    </button>
                    <button class="setlist-song-remove-btn" title="Remover">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }
    
    // Drag and drop handlers
    handleDragStart(e, index) {
        e.target.classList.add('dragging');
        e.dataTransfer.setData('text/plain', index);
        e.dataTransfer.effectAllowed = 'move';
    }
    
    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }
    
    handleDrop(e, targetIndex) {
        e.preventDefault();
        const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'));
        
        if (sourceIndex !== targetIndex) {
            this.reorderSongs(sourceIndex, targetIndex);
        }
    }
    
    handleDragEnd() {
        document.querySelectorAll('.setlist-song-item').forEach(item => {
            item.classList.remove('dragging');
        });
    }
    
    async reorderSongs(fromIndex, toIndex) {
        const songs = [...this.currentSetlist.songs];
        const [movedSong] = songs.splice(fromIndex, 1);
        songs.splice(toIndex, 0, movedSong);
        
        this.currentSetlist.songs = songs;
        
        // Update positions
        this.currentSetlist.songs.forEach((song, index) => {
            song.position = index;
        });
        
        // Re-render
        this.renderSetlistSongs();
        
        // Save to Firebase
        await this.saveSetlist();
    }
    
    async removeSongFromSetlist(index) {
        if (!confirm('Remover esta música da setlist?')) {
            return;
        }
        
        this.currentSetlist.songs.splice(index, 1);
        
        // Update positions
        this.currentSetlist.songs.forEach((song, i) => {
            song.position = i;
        });
        
        // Re-render
        this.renderSetlistSongs();
        
        // Save to Firebase
        await this.saveSetlist();
    }
    
    async searchYouTube(query) {
        if (!query || query.trim().length < 2) {
            document.getElementById('youtubeResults').style.display = 'none';
            document.getElementById('setlistsSearchEmptyState').style.display = 'block';
            return;
        }
        
        console.log('[SETLISTS] Searching YouTube for:', query);
        
        document.getElementById('setlistsSearchEmptyState').style.display = 'none';
        
        // Using YouTube Data API (you'll need to set up API key)
        // For now, using a mock implementation
        const results = await this.mockYouTubeSearch(query);
        
        this.renderYouTubeResults(results, true); // true = main page mode
    }
    
    async searchYouTubeInSetlist(query) {
        if (!query || query.trim().length < 2) {
            document.getElementById('youtubeResults').style.display = 'none';
            return;
        }
        
        console.log('[SETLISTS] Searching YouTube in setlist for:', query);
        
        // Using YouTube Data API (you'll need to set up API key)
        // For now, using a mock implementation
        const results = await this.mockYouTubeSearch(query);
        
        this.renderYouTubeResults(results, false); // false = setlist editor mode
    }
    
    async mockYouTubeSearch(query) {
        // Real YouTube Data API v3 search
        const API_KEY = 'AIzaSyDbFi9ANyHakC0WwqxSz3WuqwFa5mQaeJA';
        const API_URL = 'https://www.googleapis.com/youtube/v3/search';
        
        try {
            const response = await fetch(`${API_URL}?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=10&key=${API_KEY}`);
            
            if (!response.ok) {
                console.error('[SETLISTS] YouTube API error:', response.status, response.statusText);
                return this.getFallbackResults(query);
            }
            
            const data = await response.json();
            
            if (!data.items || data.items.length === 0) {
                console.log('[SETLISTS] No results found');
                return [];
            }
            
            const results = data.items.map(item => ({
                videoId: item.id.videoId,
                title: item.snippet.title,
                channel: item.snippet.channelTitle,
                thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || 'https://via.placeholder.com/320x180',
                youtubeUrl: `https://www.youtube.com/watch?v=${item.id.videoId}`
            }));
            
            console.log('[SETLISTS] YouTube search returned', results.length, 'results');
            return results;
            
        } catch (error) {
            console.error('[SETLISTS] YouTube search error:', error);
            return this.getFallbackResults(query);
        }
    }
    
    getFallbackResults(query) {
        // Fallback results in case API fails
        return [
            {
                videoId: 'dQw4w9WgXcQ',
                title: `${query} - Resultado 1`,
                channel: 'Canal Teste 1',
                thumbnail: 'https://via.placeholder.com/320x180?text=Video+1'
            },
            {
                videoId: 'dQw4w9WgXcQ',
                title: `${query} - Resultado 2`,
                channel: 'Canal Teste 2',
                thumbnail: 'https://via.placeholder.com/320x180?text=Video+2'
            }
        ];
    }
    
    renderYouTubeResults(results, isMainPage = false) {
        const resultsContainer = document.getElementById('youtubeResults');
        const resultsGrid = document.getElementById('youtubeResultsGrid');
        
        if (!resultsContainer || !resultsGrid) return;
        
        if (results.length === 0) {
            resultsContainer.style.display = 'none';
            return;
        }
        
        resultsContainer.style.display = 'block';
        
        resultsGrid.innerHTML = results.map(result => this.createYouTubeResultCard(result, isMainPage)).join('');
        
        // Add event listeners
        resultsGrid.querySelectorAll('.youtube-result-card').forEach(card => {
            const videoId = card.dataset.videoId;
            
            // Play button
            const playBtn = card.querySelector('.youtube-result-play-btn');
            if (playBtn) {
                playBtn.addEventListener('click', () => {
                    this.playYouTubeVideo(videoId);
                });
            }
            
            // Save button
            const saveBtn = card.querySelector('.youtube-result-save-btn');
            if (saveBtn) {
                saveBtn.addEventListener('click', () => {
                    const songData = {
                        title: card.querySelector('.youtube-result-title').textContent,
                        channel: card.querySelector('.youtube-result-channel').textContent,
                        thumbnail: card.querySelector('.youtube-result-thumbnail img').src,
                        youtubeVideoId: videoId,
                        youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
                        position: 0,
                        addedAt: new Date().toISOString()
                    };
                    
                    if (isMainPage) {
                        // Show setlist selection modal
                        this.showSetlistSelectionModal(songData);
                    } else {
                        // Save directly to current setlist
                        songData.position = this.currentSetlist.songs.length;
                        this.addSongToSetlist(songData);
                    }
                });
            }
        });
    }
    
    createYouTubeResultCard(result, isMainPage = false) {
        const saveButtonText = isMainPage ? 'Salvar em Setlist' : 'Salvar';
        
        return `
            <div class="youtube-result-card" data-video-id="${result.videoId}">
                <div class="youtube-result-thumbnail">
                    <img src="${result.thumbnail}" alt="${this.escapeHtml(result.title)}">
                </div>
                <div class="youtube-result-content">
                    <h4 class="youtube-result-title">${this.escapeHtml(result.title)}</h4>
                    <p class="youtube-result-channel">${this.escapeHtml(result.channel)}</p>
                    <div class="youtube-result-actions">
                        <button class="youtube-result-play-btn">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polygon points="5 3 19 12 5 21 5 3"></polygon>
                            </svg>
                            Ouvir
                        </button>
                        <button class="youtube-result-save-btn">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                            ${saveButtonText}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    playYouTubeVideo(videoId) {
        // Create modal with YouTube player
        const modal = document.createElement('div');
        modal.className = 'youtube-player-modal';
        modal.id = 'youtubePlayerModal';
        
        modal.innerHTML = `
            <div class="youtube-player-content">
                <div class="youtube-player-header">
                    <h3 class="youtube-player-title">YouTube Player</h3>
                    <button class="youtube-player-close-btn" id="closeYouTubePlayer">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="youtube-player-video">
                    <iframe 
                        src="https://www.youtube.com/embed/${videoId}?autoplay=1" 
                        frameborder="0" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                        allowfullscreen>
                    </iframe>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Close button
        const closeBtn = document.getElementById('closeYouTubePlayer');
        closeBtn.addEventListener('click', () => {
            modal.remove();
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }
    
    async addSongToSetlist(songData) {
        this.currentSetlist.songs.push(songData);
        
        // Re-render songs
        this.renderSetlistSongs();
        
        // Save to Firebase
        await this.saveSetlist();
        
        console.log('[SETLISTS] Song added to setlist:', songData.title);
    }
    
    async saveSetlist() {
        if (!this.db || !this.currentSetlist) return;
        
        try {
            const setlistRef = this.doc(this.db, 'setlists', this.currentSetlist.id);
            
            await this.updateDoc(setlistRef, {
                songs: this.currentSetlist.songs,
                updatedAt: this.serverTimestamp()
            });
            
            console.log('[SETLISTS] Setlist saved');
        } catch (error) {
            console.error('[SETLISTS] Error saving setlist:', error);
        }
    }
    
    async createPublicSetlist() {
        if (!this.db || !this.currentSetlist) {
            console.error('[SETLISTS] Cannot create public setlist: db or currentSetlist missing');
            return;
        }
        
        console.log('[SETLISTS] Creating public setlist for:', this.currentSetlist.name, 'shareId:', this.currentSetlist.shareId);
        
        try {
            const publicSetlistData = {
                name: this.currentSetlist.name,
                songs: this.currentSetlist.songs,
                createdAt: this.currentSetlist.createdAt,
                shareId: this.currentSetlist.shareId,
                originalSetlistId: this.currentSetlist.id
            };
            
            console.log('[SETLISTS] Public setlist data:', publicSetlistData);
            
            const publicSetlistRef = this.doc(this.db, 'publicSetlists', this.currentSetlist.shareId);
            await this.setDoc(publicSetlistRef, publicSetlistData);
            
            console.log('[SETLISTS] Public setlist created successfully:', this.currentSetlist.shareId);
        } catch (error) {
            console.error('[SETLISTS] Error creating public setlist:', error);
            console.error('[SETLISTS] Error code:', error.code);
            console.error('[SETLISTS] Error message:', error.message);
        }
    }

    async shareCurrentSetlist() {
        console.log('[SETLISTS] Share button clicked');
        
        if (!this.currentSetlist || !this.currentSetlist.shareId) {
            alert('Erro: Setlist não possui ID de compartilhamento');
            return;
        }
        
        console.log('[SETLISTS] Creating public copy of setlist:', this.currentSetlist.name);
        
        // Create public copy of the setlist
        await this.createPublicSetlist();
        
        const shareUrl = `${window.location.origin}/setlist.html?shareId=${this.currentSetlist.shareId}`;
        console.log('[SETLISTS] Share URL generated:', shareUrl);
        
        // Create share modal with overlay
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        overlay.id = 'shareModalOverlay';
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'shareModal';
        
        modal.innerHTML = `
            <div class="modal-header">
                <h2 class="modal-title">Compartilhar Setlist</h2>
                <button class="modal-close" id="closeShareModal">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
            <div class="modal-body share-modal-content">
                <h3 class="share-modal-title">Link da Setlist</h3>
                <p class="share-modal-description">Copie o link abaixo para compartilhar sua setlist</p>
                <div class="share-link-container">
                    <input type="text" class="share-link-input" id="shareLinkInput" value="${shareUrl}" readonly>
                    <button class="share-copy-btn" id="copyShareLink">
                        Copiar
                    </button>
                </div>
                <div class="share-modal-footer">
                    <p class="share-modal-note">Qualquer pessoa com este link poderá visualizar sua setlist.</p>
                </div>
            </div>
        `;
        
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        
        // Add event listeners
        const closeBtn = document.getElementById('closeShareModal');
        const copyBtn = document.getElementById('copyShareLink');
        const linkInput = document.getElementById('shareLinkInput');
        
        closeBtn.addEventListener('click', () => {
            overlay.remove();
        });
        
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        });
        
        copyBtn.addEventListener('click', () => {
            linkInput.select();
            document.execCommand('copy');
            
            const originalText = copyBtn.textContent;
            copyBtn.textContent = 'Copiado!';
            
            setTimeout(() => {
                copyBtn.textContent = originalText;
            }, 2000);
        });
        
        // Select input on focus
        linkInput.addEventListener('focus', () => {
            linkInput.select();
        });
    }
    
    async deleteCurrentSetlist() {
        if (!this.currentSetlist || !this.currentSetlist.id) {
            alert('Erro: Nenhuma setlist selecionada');
            return;
        }
        
        if (!confirm(`Tem certeza que deseja excluir a setlist "${this.currentSetlist.name}"? Esta ação não pode ser desfeita.`)) {
            return;
        }
        
        try {
            const setlistRef = this.doc(this.db, 'setlists', this.currentSetlist.id);
            await this.deleteDoc(setlistRef);
            
            console.log('[SETLISTS] Setlist deleted:', this.currentSetlist.id);
            
            // Go back to setlists view
            this.showSetlistsView();
            
            // Reload setlists
            await this.loadSetlists();
        } catch (error) {
            console.error('[SETLISTS] Error deleting setlist:', error);
            alert('Erro ao excluir setlist: ' + error.message);
        }
    }

    // Utility methods
    getCurrentUserId() {
        if (this.app && this.app.getCurrentUserId) {
            return this.app.getCurrentUserId();
        }

        // Fallback to auth
        if (window.firebaseAuth && window.firebaseAuth.auth) {
            const user = window.firebaseAuth.auth.currentUser;
            return user ? user.uid : null;
        }

        return null;
    }

    async getUserPlan() {
        const userId = this.getCurrentUserId();
        if (!userId || !window.firebaseDB) {
            return 'home'; // Default to home if not logged in or Firebase unavailable
        }

        try {
            const { db, doc, getDoc } = window.firebaseDB;
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                return userData.plano || 'home';
            }
        } catch (error) {
            console.warn('[SETLISTS] Could not fetch user plan:', error);
        }

        return 'home'; // Default to home
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    formatDate(date) {
        if (!date) return '';
        
        const d = new Date(date);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        
        return `${day}/${month}/${year}`;
    }
    
    generateShareId() {
        // Generate a random 8-character ID
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 8; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
}