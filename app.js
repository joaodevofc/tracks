/**
 * Multracks Application
 * Main application logic for library rendering and add music wizard
 */

class MultracksApp {
    constructor() {
        this.currentWizardStep = 1;
        this.totalWizardSteps = 4;
        this.selectedFiles = [];
        this.importMethod = null;
        this.currentFilter = 'all';
        this.isCreatingProject = false; // Flag to prevent duplicate project creation
        
        // Player state
        this.currentView = 'library'; // 'library' or 'player'
        this.currentProject = null;
        this.audioPlayer = null;
        this.isPlaying = false;
        this.currentTime = 0;
        this.totalDuration = 0;
        
        // Player session (songs loaded in player, separate from library)
        this.playerSession = [];
        
        // Playlist playback state
        this.currentPlaylistId = null;
        this.playlistQueue = [];
        this.currentPlaylistIndex = 0;
        this.currentPlaylistCover = null;
        this.callbacksSetup = false; // Prevent duplicate callback setup
        this.waveformLoading = false; // Track waveform loading state
        
        // Community favorites
        this.communityFavorites = [];
        
        // Initialize audio storage
        this.audioStorage = new AudioStorage();
        
        // Pad system
        this.availablePads = [
            {
                file: "Pad_Reverse_A_F_sharp_m_30_minutos.mp3",
                key: "A",
                relativeKey: "F#m",
                bpm: 120
            },
            {
                file: "Pad_Reverse_A_sharp_Bb_Gm_30_minutos.mp3",
                key: "A#",
                relativeKey: "Gm",
                bpm: 120
            },
            {
                file: "Pad_Reverse_B_G_sharp_m_Abm_30_minutos.mp3",
                key: "B",
                relativeKey: "G#m",
                bpm: 120
            },
            {
                file: "Pad_Reverse_C_Am_30_minutos.mp3",
                key: "C",
                relativeKey: "Am",
                bpm: 120
            },
            {
                file: "Pad_Reverse_C_sharp_Db_A_sharp_m_Bbm_30_minutos.mp3",
                key: "C#",
                relativeKey: "A#m",
                bpm: 120
            },
            {
                file: "Pad_Reverse_D_Bm_30_minutos.mp3",
                key: "D",
                relativeKey: "Bm",
                bpm: 120
            },
            {
                file: "Pad_Reverse_D_sharp_Eb_Cm_30_minutos.mp3",
                key: "D#",
                relativeKey: "Cm",
                bpm: 120
            },
            {
                file: "Pad_Reverse_E_C_sharp_m_Dbm_30_minutos.mp3",
                key: "E",
                relativeKey: "C#m",
                bpm: 120
            },
            {
                file: "Pad_Reverse_F_Dm_30_minutos.mp3",
                key: "F",
                relativeKey: "Dm",
                bpm: 120
            },
            {
                file: "Pad_Reverse_F_sharp_Gb_D_sharp_m_Ebm_30_minutos.mp3",
                key: "F#",
                relativeKey: "D#m",
                bpm: 120
            },
            {
                file: "Pad_Reverse_G_Em_30_minutos.mp3",
                key: "G",
                relativeKey: "Em",
                bpm: 120
            },
            {
                file: "Pad_Reverse_G_sharp_Ab_Fm_30_minutos.mp3",
                key: "G#",
                relativeKey: "Fm",
                bpm: 120
            }
        ];
        this.currentPad = null;
        this.padAudioElement = null;
        this.padTrackNodes = null;
        this.padIsPlaying = false;
        this.padFadeOutTimer = null;
        this.padFadeInTimer = null;
        this.padTransitionDuration = 500; // ms for smooth transitions
        
        this.init();
    }
    
    async init() {
        // Check if running via file:// protocol and show warning
        if (window.location.protocol === 'file:') {
            console.warn('[APP] Running via file:// protocol - some features may not work properly');
            console.warn('[APP] Please run via a local server (e.g., Live Server) for full PWA/Service Worker support');
            
            // Show friendly warning to user
            setTimeout(() => {
                const warningBanner = document.createElement('div');
                warningBanner.style.position = 'fixed';
                warningBanner.style.top = '0';
                warningBanner.style.left = '0';
                warningBanner.style.right = '0';
                warningBanner.style.background = 'linear-gradient(135deg, #ff6b6b, #ee5a5a)';
                warningBanner.style.color = 'white';
                warningBanner.style.padding = '16px';
                warningBanner.style.textAlign = 'center';
                warningBanner.style.zIndex = '10000';
                warningBanner.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                warningBanner.style.fontSize = '14px';
                warningBanner.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
                
                warningBanner.innerHTML = '<div style="max-width: 800px; margin: 0 auto; padding: 0 20px;"><strong>⚠️ Modo file:// detectado</strong><br>Para melhor experiência, use um servidor local (ex: Live Server no VS Code). Alguns recursos PWA/Service Worker podem não funcionar corretamente. <button id="dismissFileWarning" style="margin-left: 15px; padding: 6px 12px; background: white; color: #ee5a5a; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">Entendi</button></div>';
                
                // Append to DOM first, then add event listener
                document.body.appendChild(warningBanner);
                
                const dismissButton = document.getElementById('dismissFileWarning');
                if (dismissButton) {
                    dismissButton.addEventListener('click', () => {
                        warningBanner.remove();
                    });
                }
            }, 1000);
        }
        
        // Hide splash screen after everything is loaded
        const hideSplashScreen = () => {
            const splashScreen = document.getElementById('splashScreen');
            if (splashScreen) {
                // Keep splash screen visible for 2 seconds
                setTimeout(() => {
                    splashScreen.classList.add('hidden');
                    setTimeout(() => {
                        splashScreen.style.display = 'none';
                    }, 500);
                }, 2000);
            }
        };

        this.initLibrary();
        this.initExplore();
        this.initCommunity();
        this.initAddMusicWizard();
        this.initSettingsModal();
        this.initAuthModal();
        this.initGuestWarningModal();
        this.initPublicProfileModal();
        this.initPlayer();
        this.initEventListeners();
        this.initPadSystem();
        this.initMyTracks();
        this.initSetlists();

        // Wait for storage to load before rendering
        await storage.load();
        this.renderLibrary();

        // Check auth state
        this.checkAuthState();

        // Expose storage for debugging
        window.storage = storage;
        window.clearStorage = () => storage.clearAll();
        window.audioStorage = this.audioStorage;

        // Expose IndexedDB cleanup functions
        window.clearAudioStorage = () => this.audioStorage.clearAllAudioFiles();
        window.getAudioStorageInfo = () => this.audioStorage.getStorageInfo();
        window.getAudioStorageIds = () => this.audioStorage.getAllAudioFileIds();

        // Expose hydration function for debugging
        window.hydrateCurrentProject = () => this.hydrateProjectFiles(this.currentProject);
        window.currentApp = this;
        
        // Expose favorites debug functions
        window.refreshFavorites = () => this.refreshFavoritesFromFirestore();
        window.showFavorites = () => {
            console.log('[APP] Current favorites:', this.communityFavorites);
            console.log('[APP] User ID:', this.getCurrentUserId());
        };

        // Log storage info on startup
        console.log('[APP] =======================================');
        console.log('[APP] 🛠️ DEBUG FUNCTIONS AVAILABLE:');
        console.log('[APP] window.storage - Access project storage');
        console.log('[APP] window.clearStorage() - Clear all projects');
        console.log('[APP] window.audioStorage - Access audio storage');
        console.log('[APP] window.clearAudioStorage() - Clear all audio files');
        console.log('[APP] window.getAudioStorageInfo() - Get storage usage info');
        console.log('[APP] window.getAudioStorageIds() - Get all audio file IDs');
        console.log('[APP] window.hydrateCurrentProject() - Hydrate current project files');
        console.log('[APP] =======================================');

        // Hide splash screen after all initialization is complete
        hideSplashScreen();

        // Check storage status
        setTimeout(async () => {
            try {
                const storageInfo = await this.audioStorage.getStorageInfo();
                const totalSize = await this.audioStorage.getTotalSize();
                const audioIds = await this.audioStorage.getAllAudioFileIds();

                console.log('[APP] 📊 STORAGE STATUS:');
                console.log('[APP] Total audio files:', audioIds.length);
                console.log('[APP] Total audio size:', this.audioStorage.formatBytes(totalSize));
                console.log('[APP] Storage usage:', this.audioStorage.formatBytes(storageInfo.usage));
                console.log('[APP] Storage quota:', this.audioStorage.formatBytes(storageInfo.quota));
                console.log('[APP] Storage available:', this.audioStorage.formatBytes(storageInfo.available));
                console.log('[APP] Usage percentage:', storageInfo.usagePercent.toFixed(2) + '%');

                if (storageInfo.usagePercent > 80) {
                    console.warn('[APP] ⚠️ Storage usage is high! Consider clearing old audio files.');
                }
            } catch (error) {
                console.warn('[APP] Could not get storage info:', error);
            }
        }, 1000);
    }
    
    // ========================================
    // ========================================
    // LIBRARY
    // ========================================
    initLibrary() {
        this.musicGrid = document.getElementById('musicGrid');
        this.emptyState = document.getElementById('emptyState');
        this.libraryCount = document.getElementById('libraryCount');
        
        this.renderLibrary();
    }

    // ========================================
    // EXPLORE
    // ========================================
    initExplore() {
        this.exploreGrid = document.getElementById('exploreGrid');
        this.exploreCount = document.getElementById('exploreCount');
        this.exploreMusicas = [];

        this.loadExploreMusicas();
    }

    // ========================================
    // COMMUNITY
    // ========================================
    initCommunity() {
        this.communityGrid = document.getElementById('communityGrid');
        this.communityCount = document.getElementById('communityCount');
        this.communityFilters = document.getElementById('communityFilters');
        this.currentCommunityFilter = 'Todos';
        this.communityTracks = [];

        this.renderCommunityFilters();
        this.loadCommunityTracksFromFirebase();
    }

    async loadCommunityTracksFromFirebase() {
        // Check if Firebase is available
        if (typeof window.firebaseDB === 'undefined') {
            console.warn('[APP] Firebase not available, falling back to static data');
            this.communityTracks = communityTracks || [];
            this.shuffleArray(this.communityTracks);
            this.renderCommunity();
            return;
        }

        try {
            const q = window.firebaseDB.query(
                window.firebaseDB.collection(window.firebaseDB.db, 'communityTracks')
            );

            const querySnapshot = await window.firebaseDB.getDocs(q);
            this.communityTracks = [];

            // Cache for creator data to avoid multiple queries
            const creatorCache = new Map();

            for (const doc of querySnapshot.docs) {
                const data = doc.data();
                if (data.published) { // Only show published tracks
                    let authorName = data.authorName;
                    let authorAvatar = data.authorAvatar;

                    // If authorName is not set, try to get from creators collection
                    if (!authorName && data.userId && window.firebaseDB) {
                        try {
                            if (!creatorCache.has(data.userId)) {
                                const { db, doc, getDoc } = window.firebaseDB;
                                const creatorDoc = await getDoc(doc(db, 'creators', data.userId));
                                if (creatorDoc.exists()) {
                                    const creatorData = creatorDoc.data();
                                    creatorCache.set(data.userId, {
                                        displayName: creatorData.displayName,
                                        profilePhoto: creatorData.profilePhoto
                                    });
                                }
                            }

                            const cachedCreator = creatorCache.get(data.userId);
                            if (cachedCreator) {
                                authorName = cachedCreator.displayName;
                                authorAvatar = cachedCreator.profilePhoto;
                            }
                        } catch (error) {
                            console.warn('[APP] Could not fetch creator data:', error);
                        }
                    }

                    this.communityTracks.push({
                        id: doc.id,
                        name: data.name,
                        artist: data.artist,
                        genre: data.genre,
                        key: data.key,
                        bpm: data.bpm,
                        stems: data.stems,
                        coverUrl: data.coverUrl,
                        downloadUrl: data.downloadUrl,
                        downloads: data.downloads || 0,
                        featured: data.featured || false,
                        author: data.author,
                        authorName: authorName || data.author || 'Usuário',
                        authorEmail: data.authorEmail || '',
                        authorAvatar: authorAvatar || null,
                        isOfficial: data.isOfficial === true, // Only true if explicitly set
                        isPaid: data.isPaid || false,
                        price: data.price || 0,
                        paymentInfo: data.paymentInfo || ''
                    });
                }
            }

            // Shuffle the tracks array for random order
            this.shuffleArray(this.communityTracks);

            console.log('[APP] Loaded', this.communityTracks.length, 'community tracks from Firebase (shuffled)');
            this.renderCommunity();
        } catch (error) {
            console.error('[APP] Error loading community tracks from Firebase:', error);
            // Fallback to static data
            this.communityTracks = communityTracks || [];
            this.shuffleArray(this.communityTracks);
            this.renderCommunity();
        }
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    renderCommunityFilters() {
        if (!this.communityFilters) return;

        const genres = ['Todos', 'Antigas', 'Novas', 'Worship', 'Americanas', 'Nacionais', 'Favoritos'];
        this.communityFilters.innerHTML = genres.map(genre =>
            `<button class="filter-btn ${genre === 'Todos' ? 'active' : ''}" data-filter="${genre}">${genre}</button>`
        ).join('');

        // Add event listeners to filter buttons
        this.communityFilters.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.communityFilters.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentCommunityFilter = btn.dataset.filter;
                this.renderCommunity();
            });
        });
    }

    renderCommunity() {
        console.log('[APP] Rendering community tracks. Current filter:', this.currentCommunityFilter);
        if (!this.communityGrid) return;

        let filteredTracks;

        if (this.currentCommunityFilter === 'Favoritos') {
            // Show only favorited tracks
            filteredTracks = this.communityTracks.filter(track => 
                this.isCommunityTrackFavorited(track.id)
            );
            console.log('[APP] Filtered for favorites:', filteredTracks.length, 'tracks');
        } else if (this.currentCommunityFilter === 'Todos') {
            filteredTracks = this.communityTracks;
            console.log('[APP] Showing all tracks:', filteredTracks.length);
        } else {
            // Filter by genre
            filteredTracks = this.communityTracks.filter(track => {
                const genres = Array.isArray(track.genre) ? track.genre : [track.genre];
                return genres.includes(this.currentCommunityFilter);
            });
            console.log('[APP] Filtered for genre:', this.currentCommunityFilter, 'Found:', filteredTracks.length);
        }

        this.communityCount.textContent = `${filteredTracks.length} track${filteredTracks.length !== 1 ? 's' : ''}`;
        this.communityGrid.innerHTML = '';

        if (filteredTracks.length === 0) {
            const emptyMessage = this.currentCommunityFilter === 'Favoritos' 
                ? 'Nenhuma track favoritada ainda. Clique na estrelinha para adicionar aos favoritos.'
                : 'Nenhuma track disponível nesta categoria';
                
            this.communityGrid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M9 18V5l12-2v13"></path>
                            <circle cx="6" cy="18" r="3"></circle>
                            <circle cx="18" cy="16" r="3"></circle>
                        </svg>
                    </div>
                    <h3 class="empty-title">Nenhuma track encontrada</h3>
                    <p class="empty-description">${emptyMessage}</p>
                </div>
            `;
            return;
        }

        filteredTracks.forEach(track => {
            const card = this.createCommunityCard(track);
            this.communityGrid.appendChild(card);
        });
    }

    createCommunityCard(track) {
        const card = document.createElement('div');
        card.className = 'community-card';
        card.dataset.trackId = track.id; // Add track ID to card data
        
        console.log('[APP] Creating community card for track:', track.id, track.name);

        const coverHtml = track.coverUrl
            ? `<img src="${track.coverUrl}" alt="${this.escapeHtml(track.name)}">`
            : `
                <div class="community-card-cover-placeholder">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M9 18V5l12-2v13"></path>
                        <circle cx="6" cy="18" r="3"></circle>
                        <circle cx="18" cy="16" r="3"></circle>
                    </svg>
                </div>
            `;

        const featuredBadge = track.featured ? '<div class="community-card-featured">Em Alta</div>' : '';
        
        // Author info with verification badge for official tracks
        const isOfficial = track.isOfficial === true; // Only true if explicitly set
        const authorName = isOfficial ? 'W.Tracks' : (track.authorName || track.authorEmail?.split('@')[0] || 'Usuário');
        
        // Avatar: use official logo for W.Tracks, otherwise use user avatar or placeholder
        let authorAvatar;
        if (isOfficial) {
            authorAvatar = `<img src="icon-white-transparent.png" alt="W.Tracks" class="community-card-author-avatar community-card-author-avatar-official">`;
        } else if (track.authorAvatar) {
            authorAvatar = `<img src="${track.authorAvatar}" alt="${this.escapeHtml(authorName)}" class="community-card-author-avatar">`;
        } else {
            authorAvatar = `<div class="community-card-author-avatar-placeholder">${authorName.charAt(0).toUpperCase()}</div>`;
        }
        
        // Verification badge for official tracks
        const verificationBadge = isOfficial 
            ? `<svg class="community-card-verification-badge" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 12l2 2 4-4"></path>
                <circle cx="12" cy="12" r="10"></circle>
               </svg>`
            : '';
        
        const authorInfo = authorName ? `
            <div class="community-card-author ${isOfficial ? 'community-card-author-official' : ''}">
                ${authorAvatar}
                <span>por ${this.escapeHtml(authorName)}</span>
                ${verificationBadge}
            </div>
        ` : '';
        
        // Price badge (hidden for now - payment system in development)
        const priceInfo = ''; // Temporarily disabled - all tracks are free for now

        // Check if this track is favorited by current user
        const isFavorited = this.isCommunityTrackFavorited(track.id);
        
        card.innerHTML = `
            <div class="community-card-cover">
                ${coverHtml}
                ${featuredBadge}
                <button class="community-card-favorite ${isFavorited ? 'favorited' : ''}" data-track-id="${track.id}" aria-label="Favoritar">
                    <svg viewBox="0 0 24 24" fill="${isFavorited ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                    </svg>
                </button>
            </div>
            <div class="community-card-content">
                <h3 class="community-card-title">${this.escapeHtml(track.name)}</h3>
                ${authorInfo}
                <div class="community-card-meta">
                    <div class="community-card-meta-row">
                        <span>${this.escapeHtml(track.artist)}</span>
                    </div>
                    <div class="community-card-meta-row">
                        <span class="community-card-key">${track.key}</span>
                        <span>•</span>
                        <span>${track.bpm} BPM</span>
                    </div>
                    <div class="community-card-meta-row">
                        <span class="community-card-stems">${track.stems} stems</span>
                    </div>
                    <div class="community-card-genre">${Array.isArray(track.genre) ? track.genre.join(', ') : track.genre}</div>
                </div>
                <button class="community-card-download" data-track-id="${track.id}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    ${track.isPaid ? 'Comprar' : 'Download .zip'}
                </button>
            </div>
        `;

        // Add download button event (direct download - payment system disabled for now)
        const downloadBtn = card.querySelector('.community-card-download');
        downloadBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.downloadCommunityTrack(track);
        });

        // Add favorite button event
        const favoriteBtn = card.querySelector('.community-card-favorite');
        favoriteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await this.toggleCommunityTrackFavorite(track.id, favoriteBtn);
        });

        return card;
    }

    downloadCommunityTrack(track) {
        console.log('[APP] Downloading community track:', track.name, 'from:', track.downloadUrl);

        // Check if user is logged in before allowing download
        const currentUser = window.firebaseAuth && window.firebaseAuth.auth && window.firebaseAuth.auth.currentUser;
        if (!currentUser) {
            // Show auth modal instead of allowing download
            this.openAuthModal();
            return;
        }

        // Open download URL in new tab
        window.open(track.downloadUrl, '_blank');

        // Show feedback
        const downloadBtn = document.querySelector(`.community-card-download[data-track-id="${track.id}"]`);
        if (downloadBtn) {
            const originalText = downloadBtn.innerHTML;
            downloadBtn.innerHTML = 'Abrindo link...';
            downloadBtn.disabled = true;

            setTimeout(() => {
                downloadBtn.innerHTML = originalText;
                downloadBtn.disabled = false;
            }, 2000);
        }
    }

    isCommunityTrackFavorited(trackId) {
        const isFavorited = this.communityFavorites.includes(trackId);
        console.log('[APP] Checking if track is favorited:', trackId, 'Result:', isFavorited, 'Current favorites:', this.communityFavorites);
        return isFavorited;
    }

    async toggleCommunityTrackFavorite(trackId, favoriteBtn) {
        console.log('[APP] Toggling favorite for track:', trackId);
        const isFavorited = this.isCommunityTrackFavorited(trackId);
        console.log('[APP] Current favorited state:', isFavorited);
        
        if (isFavorited) {
            // Remove from favorites
            this.communityFavorites = this.communityFavorites.filter(id => id !== trackId);
            favoriteBtn.classList.remove('favorited');
            favoriteBtn.querySelector('svg').setAttribute('fill', 'none');
            console.log('[APP] ❌ Removed from favorites:', trackId);
        } else {
            // Add to favorites
            this.communityFavorites.push(trackId);
            favoriteBtn.classList.add('favorited');
            favoriteBtn.querySelector('svg').setAttribute('fill', 'currentColor');
            console.log('[APP] ⭐ Added to favorites:', trackId);
        }
        
        console.log('[APP] Updated favorites array:', this.communityFavorites);
        
        // Save to storage (async - Firestore)
        await this.saveCommunityFavorites();
        
        // Re-render community cards to update all favorite buttons
        console.log('[APP] Re-rendering community cards...');
        this.renderCommunity();
    }

    async loadCommunityFavorites() {
        const userId = this.getCurrentUserId();
        console.log('[APP] Loading community favorites for user:', userId);
        
        if (!userId) {
            console.log('[APP] No user logged in, clearing favorites');
            this.communityFavorites = [];
            return;
        }

        // Try to load from Firestore first
        if (window.firebaseDB) {
            try {
                const { db, doc, getDoc } = window.firebaseDB;
                console.log('[APP] Attempting to load favorites from Firestore...');
                const userFavoritesDoc = await getDoc(doc(db, 'userFavorites', userId));
                
                if (userFavoritesDoc.exists()) {
                    const data = userFavoritesDoc.data();
                    this.communityFavorites = data.communityFavorites || [];
                    console.log('[APP] ✅ Loaded community favorites from Firestore:', this.communityFavorites.length, this.communityFavorites);
                    
                    // Also save to localStorage as backup
                    this.saveCommunityFavoritesToLocalStorage();
                    return;
                } else {
                    console.log('[APP] No favorites document found in Firestore for user:', userId);
                }
            } catch (error) {
                console.error('[APP] ❌ Error loading favorites from Firestore, falling back to localStorage:', error);
            }
        } else {
            console.log('[APP] Firebase DB not available, using localStorage only');
        }

        // Fallback to localStorage
        const storageKey = `community_favorites_${userId}`;
        const storedFavorites = localStorage.getItem(storageKey);
        
        if (storedFavorites) {
            try {
                this.communityFavorites = JSON.parse(storedFavorites);
                console.log('[APP] ✅ Loaded community favorites from localStorage:', this.communityFavorites.length, this.communityFavorites);
            } catch (error) {
                console.error('[APP] ❌ Error loading community favorites from localStorage:', error);
                this.communityFavorites = [];
            }
        } else {
            console.log('[APP] No favorites found in localStorage for user:', userId);
            this.communityFavorites = [];
        }
    }

    async saveCommunityFavorites() {
        const userId = this.getCurrentUserId();
        console.log('[APP] Saving community favorites for user:', userId, 'Favorites:', this.communityFavorites);
        
        if (!userId) {
            console.warn('[APP] ❌ Cannot save favorites - no user logged in');
            return;
        }

        // Save to Firestore
        if (window.firebaseDB) {
            try {
                const { db, doc, setDoc, serverTimestamp } = window.firebaseDB;
                console.log('[APP] Attempting to save favorites to Firestore...');
                await setDoc(doc(db, 'userFavorites', userId), {
                    communityFavorites: this.communityFavorites,
                    updatedAt: serverTimestamp()
                });
                console.log('[APP] ✅ Saved community favorites to Firestore:', this.communityFavorites.length);
            } catch (error) {
                console.error('[APP] ❌ Error saving favorites to Firestore:', error);
                // Fallback to localStorage if Firestore fails
                console.log('[APP] Falling back to localStorage...');
                this.saveCommunityFavoritesToLocalStorage();
            }
        } else {
            // Fallback to localStorage if Firebase not available
            console.log('[APP] Firebase DB not available, using localStorage only');
            this.saveCommunityFavoritesToLocalStorage();
        }
    }

    saveCommunityFavoritesToLocalStorage() {
        const userId = this.getCurrentUserId();
        if (!userId) {
            console.warn('[APP] Cannot save favorites to localStorage - no user logged in');
            return;
        }

        const storageKey = `community_favorites_${userId}`;
        localStorage.setItem(storageKey, JSON.stringify(this.communityFavorites));
        console.log('[APP] 💾 Saved community favorites to localStorage:', this.communityFavorites.length);
    }

    // Debug function to manually refresh favorites from Firestore
    async refreshFavoritesFromFirestore() {
        console.log('[APP] 🔧 Manual refresh: Loading favorites from Firestore...');
        await this.loadCommunityFavorites();
        this.renderCommunity();
        console.log('[APP] 🔧 Manual refresh completed');
    }

    getCurrentUserId() {
        if (window.firebaseAuth && window.firebaseAuth.auth) {
            const user = window.firebaseAuth.auth.currentUser;
            if (user) {
                console.log('[APP] Current user ID:', user.uid, 'Email:', user.email);
                return user.uid;
            } else {
                console.log('[APP] No user logged in (currentUser is null)');
            }
        } else {
            console.log('[APP] Firebase Auth not available');
        }
        return null;
    }

    async getUserPlan() {
        const userId = this.getCurrentUserId();
        if (!userId || !window.firebaseDB) {
            return 'home'; // Default to home if not logged in or Firebase unavailable
        }

        try {
            const { db, doc, getDoc, collection, query, where, getDocs } = window.firebaseDB;
            // First try to get by UID (new method)
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                return userData.plano || 'home';
            } else {
                // Fallback: try to find by uid field (old method with auto-generated IDs)
                const q = query(collection(db, 'users'), where('uid', '==', userId));
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    const userData = querySnapshot.docs[0].data();
                    return userData.plano || 'home';
                }
            }
        } catch (error) {
            console.warn('[APP] Could not fetch user plan:', error);
        }

        return 'home'; // Default to home
    }

    async isStudioPlan() {
        const plan = await this.getUserPlan();
        return plan === 'studio';
    }

    async requireStudioPlan(featureName = 'este recurso') {
        const isStudio = await this.isStudioPlan();
        if (!isStudio) {
            // Show upgrade modal for all features (including setlists and minhas tracks)
            this.showUpgradeModal(featureName);
            return false;
        }
        return true;
    }

    showUpgradeModal(featureName) {
        const upgradeModal = document.getElementById('upgradeModal');
        const upgradeTitle = document.getElementById('upgradeTitle');
        const upgradeMessage = document.getElementById('upgradeMessage');

        if (upgradeModal && upgradeTitle && upgradeMessage) {
            // Customize message based on feature
            const messages = {
                'Setlists': 'No plano Home, você pode criar apenas 1 setlist com até 5 músicas.',
                'Minhas Tracks': 'A criação de conta de criador está disponível apenas para usuários do plano Studio.',
                'Adicionar músicas': 'A adição de músicas personalizadas está disponível apenas para usuários do plano Studio.',
                'default': `${featureName} está disponível apenas para usuários do plano Studio.`
            };

            upgradeTitle.textContent = 'Recurso Exclusivo Studio';
            upgradeMessage.textContent = messages[featureName] || messages['default'];

            upgradeModal.classList.add('active');
        }
    }

    hideUpgradeModal() {
        const upgradeModal = document.getElementById('upgradeModal');
        if (upgradeModal) {
            upgradeModal.classList.remove('active');
        }
    }

    navigateToPlans() {
        window.location.href = 'planos.html';
    }

    async switchView(viewName) {
        // Note: Setlists view is now accessible to Home users (limit: 1 setlist)
        // The restriction is applied when creating setlists, not when viewing

        // Hide all views
        const views = ['libraryView', 'communityView', 'exploreView', 'myTracksView', 'setlistsView'];
        views.forEach(viewId => {
            const viewElement = document.getElementById(viewId);
            if (viewElement) viewElement.style.display = 'none';
        });

        // Show selected view
        const selectedView = document.getElementById(`${viewName}View`);
        if (selectedView) {
            selectedView.style.display = 'block';
        }

        // Update nav links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.dataset.view === viewName) {
                link.classList.add('active');
            }
        });
        
        // Handle hero banner and FAB button
        const heroBanner = document.getElementById('heroBanner');
        const fabAdd = document.getElementById('fabAdd');
        
        if (viewName === 'myTracks') {
            // Hide hero and FAB for my tracks
            if (heroBanner) heroBanner.style.display = 'none';
            if (fabAdd) fabAdd.style.display = 'none';
        } else {
            // Show hero and FAB for other views
            if (heroBanner) heroBanner.style.display = 'block';
            if (fabAdd) fabAdd.style.display = 'flex';
        }

        // Update banner image based on view
        const heroBannerImage = document.getElementById('heroBannerImage');
        const scrollIndicator = document.querySelector('.scroll-indicator');

        if (heroBannerImage && heroBanner) {
            if (viewName === 'community') {
                heroBannerImage.src = 'banners/comunidade.png';
                heroBanner.style.display = 'block';
                if (scrollIndicator) scrollIndicator.style.display = 'none';
            } else if (viewName === 'library') {
                heroBannerImage.src = 'banners/baner index.png';
                heroBanner.style.display = 'block';
                if (scrollIndicator) scrollIndicator.style.display = 'block';
            } else {
                heroBanner.style.display = 'none';
            }
        }
        
        if (fabAdd) {
            fabAdd.style.display = viewName === 'library' ? 'flex' : 'none';
        }
    }

    async loadExploreMusicas() {
        try {
            const response = await fetch('public/musicas/musicas.json');
            const data = await response.json();
            this.exploreMusicas = data.musicas || [];
            this.renderExplore();
        } catch (error) {
            console.error('[APP] Error loading explore musicas:', error);
            this.exploreMusicas = [];
            this.renderExplore();
        }
    }

    renderExplore() {
        this.exploreCount.textContent = `${this.exploreMusicas.length} música${this.exploreMusicas.length !== 1 ? 's' : ''}`;
        this.exploreGrid.innerHTML = '';
        
        this.exploreMusicas.forEach(musica => {
            const card = this.createExploreCard(musica);
            this.exploreGrid.appendChild(card);
        });
    }

    createExploreCard(musica) {
        const card = document.createElement('div');
        card.className = 'music-card';
        
        const coverHtml = musica.capa 
            ? `<img src="/musicas/${musica.capa}" alt="${musica.nome}">`
            : `
                <div class="music-card-cover-placeholder">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M9 18V5l12-2v13"></path>
                        <circle cx="6" cy="18" r="3"></circle>
                        <circle cx="18" cy="16" r="3"></circle>
                    </svg>
                </div>
            `;
        
        card.innerHTML = `
            <div class="music-card-cover">
                ${coverHtml}
                <button class="music-card-menu" aria-label="Opções">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="1"></circle>
                        <circle cx="12" cy="5" r="1"></circle>
                        <circle cx="12" cy="19" r="1"></circle>
                    </svg>
                </button>
            </div>
            <div class="music-card-content">
                <h3 class="music-card-title">${this.escapeHtml(musica.nome)}</h3>
                <div class="music-card-meta">
                    <div class="music-card-meta-row">
                        <span class="music-card-key">🎵 Música do explorar</span>
                    </div>
                    <div class="music-card-date">${this.escapeHtml(musica.artista || '')}</div>
                </div>
            </div>
        `;
        
        const menuBtn = card.querySelector('.music-card-menu');
        menuBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            // Check if menu is already open for this button
            const existingMenu = document.querySelector('.card-menu-dropdown');
            if (existingMenu) {
                existingMenu.remove();
            } else {
                this.showExploreMenu(musica, menuBtn);
            }
        });
        
        return card;
    }

    showExploreMenu(musica, button) {
        // Close any existing menus first
        document.querySelectorAll('.card-menu-dropdown').forEach(m => m.remove());

        const menu = document.createElement('div');
        menu.className = 'card-menu-dropdown';
        menu.style.cssText = `
            position: fixed;
            background: var(--color-black-card);
            border: 1px solid var(--border-medium);
            border-radius: var(--radius-md);
            padding: var(--spacing-xs);
            min-width: 160px;
            z-index: 1000;
            box-shadow: var(--shadow-lg);
        `;
        
        const items = [
            { label: 'Salvar em Minhas músicas', action: () => this.saveExploreToLibrary(musica) }
        ];
        
        items.forEach(item => {
            const btn = document.createElement('button');
            btn.className = 'card-menu-item';
            btn.style.cssText = `
                width: 100%;
                padding: var(--spacing-sm) var(--spacing-md);
                text-align: left;
                font-size: var(--font-size-sm);
                color: var(--color-white);
                border-radius: var(--radius-sm);
                transition: background var(--transition-fast);
            `;
            btn.textContent = item.label;
            btn?.addEventListener('click', () => {
                item.action();
                menu.remove();
            });
            btn?.addEventListener('mouseenter', () => {
                btn.style.background = 'var(--color-black-hover)';
            });
            menu.appendChild(btn);
        });
        
        const rect = button.getBoundingClientRect();
        menu.style.top = `${rect.bottom + 8}px`;
        menu.style.left = `${rect.left}px`;

        document.body.appendChild(menu);

        const closeMenu = (e) => {
            if (!menu.contains(e.target) && !button.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };

        setTimeout(() => {
            document.addEventListener('click', closeMenu);
        }, 10);
    }

    async saveExploreToLibrary(musica) {
        // Create a project object from the explore music
        const projectData = {
            name: musica.nome,
            artist: musica.artista || '',
            album: 'Explorar',
            key: '',
            bpm: 120,
            timeSignature: '4/4',
            tracks: [{
                name: musica.nome,
                originalFileName: musica.arquivo,
                fileSize: 0,
                audioFileId: null,
                file: null
            }],
            cover: musica.capa ? `/musicas/${musica.capa}` : null,
            isExploreMusic: true,
            exploreAudioPath: `/musicas/${musica.arquivo}`
        };
        
        try {
            const project = await storage.createProject(projectData);
            console.log('[APP] Explore music saved to library:', project.name);
            alert(`${musica.nome} salva em Minhas músicas!`);
            this.renderLibrary();
        } catch (error) {
            console.error('[APP] Error saving explore music:', error);
            alert('Erro ao salvar música');
        }
    }
    
    renderLibrary(filter = 'all', searchTerm = '') {
        // Handle playlists filter
        if (filter === 'playlists') {
            this.renderPlaylists(searchTerm);
            return;
        }
        
        let projects = storage.getProjectsByFilter(filter);

        // Apply search filter if search term is provided
        if (searchTerm) {
            projects = projects.filter(project => {
                const name = project.name.toLowerCase();
                const artist = project.artist ? project.artist.toLowerCase() : '';
                const album = project.album ? project.album.toLowerCase() : '';
                return name.includes(searchTerm) ||
                       artist.includes(searchTerm) ||
                       album.includes(searchTerm);
            });
        }

        // Update title and count text based on filter
        const libraryTitle = document.querySelector('.library-title');
        if (filter === 'favorites') {
            if (libraryTitle) libraryTitle.textContent = 'Meus favoritos';
            this.libraryCount.textContent = `${projects.length} favorito${projects.length !== 1 ? 's' : ''}`;
        } else if (filter === 'recent') {
            if (libraryTitle) libraryTitle.textContent = 'Recentes';
            this.libraryCount.textContent = `${projects.length} recente${projects.length !== 1 ? 's' : ''}`;
        } else {
            if (libraryTitle) libraryTitle.textContent = 'Minhas músicas';
            this.libraryCount.textContent = `${projects.length} projeto${projects.length !== 1 ? 's' : ''}`;
        }

        if (projects.length === 0) {
            this.musicGrid.style.display = 'none';
            this.emptyState.classList.add('visible');
            
            // Update empty state message for search
            if (searchTerm) {
                const emptyTitle = this.emptyState.querySelector('.empty-title');
                const emptyDescription = this.emptyState.querySelector('.empty-description');
                const emptyCta = this.emptyState.querySelector('.empty-cta');
                
                if (emptyTitle) emptyTitle.textContent = 'Nenhum resultado encontrado';
                if (emptyDescription) emptyDescription.textContent = `Tente buscar por outro termo`;
                if (emptyCta) emptyCta.style.display = 'none';
            } else if (filter === 'favorites') {
                const emptyTitle = this.emptyState.querySelector('.empty-title');
                const emptyDescription = this.emptyState.querySelector('.empty-description');
                const emptyCta = this.emptyState.querySelector('.empty-cta');
                
                if (emptyTitle) emptyTitle.textContent = 'Nenhum favorito ainda';
                if (emptyDescription) emptyDescription.textContent = 'Clique no ícone de coração nas músicas para adicioná-las aos favoritos';
                if (emptyCta) emptyCta.style.display = 'none';
            } else if (filter === 'recent') {
                const emptyTitle = this.emptyState.querySelector('.empty-title');
                const emptyDescription = this.emptyState.querySelector('.empty-description');
                const emptyCta = this.emptyState.querySelector('.empty-cta');
                
                if (emptyTitle) emptyTitle.textContent = 'Nenhuma música recente';
                if (emptyDescription) emptyDescription.textContent = 'As músicas que você adicionar aparecerão aqui';
                if (emptyCta) emptyCta.style.display = 'none';
            } else {
                const emptyTitle = this.emptyState.querySelector('.empty-title');
                const emptyDescription = this.emptyState.querySelector('.empty-description');
                const emptyCta = this.emptyState.querySelector('.empty-cta');
                
                if (emptyTitle) emptyTitle.textContent = 'Nenhuma música ainda';
                if (emptyDescription) emptyDescription.textContent = 'Comece adicionando seu primeiro projeto multitrack';
                
                // Reset button for music library
                if (emptyCta) {
                    emptyCta.textContent = 'Adicionar música';
                    emptyCta.style.display = 'block';
                    emptyCta.onclick = () => {
                        this.openModal();
                    };
                }
            }
        } else {
            this.musicGrid.style.display = 'grid';
            this.emptyState.classList.remove('visible');
            this.renderMusicCards(projects);
        }
    }
    
    renderPlaylists(searchTerm = '') {
        let playlists = storage.getAllPlaylists();
        
        // Apply search filter if search term is provided
        if (searchTerm) {
            playlists = playlists.filter(playlist => {
                const name = playlist.name.toLowerCase();
                return name.includes(searchTerm);
            });
        }
        
        this.libraryCount.textContent = `${playlists.length} playlist${playlists.length !== 1 ? 's' : ''}`;
        
        if (playlists.length === 0) {
            this.musicGrid.style.display = 'none';
            this.emptyState.classList.add('visible');
            
            // Update empty state message for playlists
            const emptyTitle = this.emptyState.querySelector('.empty-title');
            const emptyDescription = this.emptyState.querySelector('.empty-description');
            const emptyCta = this.emptyState.querySelector('.empty-cta');
            
            if (emptyTitle) emptyTitle.textContent = 'Nenhuma playlist ainda';
            if (emptyDescription) emptyDescription.textContent = 'Crie sua primeira playlist para organizar suas músicas';
            
            // Add create playlist button to empty state
            if (emptyCta) {
                emptyCta.textContent = 'Criar Playlist';
                emptyCta.style.display = 'block';
                emptyCta.onclick = () => this.createNewPlaylist();
            }
        } else {
            this.musicGrid.style.display = 'grid';
            this.emptyState.classList.remove('visible');
            this.renderPlaylistCards(playlists);
            
            // Add create playlist button to grid header
            this.addCreatePlaylistButton();
        }
    }

    searchLibrary(searchTerm) {
        this.renderLibrary(this.currentFilter, searchTerm);
    }
    
    async createNewPlaylist() {
        this.openCreatePlaylistModal();
    }
    
    openCreatePlaylistModal() {
        const modal = document.getElementById('playlistModal');
        if (!modal) return;
        
        // Reset form
        document.getElementById('playlistName').value = '';
        document.getElementById('playlistCoverInput').value = '';
        document.getElementById('coverPreview').style.display = 'none';
        document.getElementById('coverUploadPlaceholder').style.display = 'flex';
        document.getElementById('playlistSongSearch').value = '';
        this.currentPlaylistCover = null;
        
        // Render available songs with checkboxes
        this.renderPlaylistSongSelection();
        
        // Show modal
        modal.classList.add('active');
    }
    
    closeCreatePlaylistModal() {
        const modal = document.getElementById('playlistModal');
        if (modal) {
            modal.classList.remove('active');
        }
    }
    
    renderPlaylistSongSelection(searchTerm = '') {
        const container = document.getElementById('playlistSongsSelector');
        if (!container) return;
        
        let projects = storage.getAllProjects();
        
        // Apply search filter if search term is provided
        if (searchTerm) {
            projects = projects.filter(project => {
                const name = project.name.toLowerCase();
                const artist = project.artist ? project.artist.toLowerCase() : '';
                return name.includes(searchTerm) || artist.includes(searchTerm);
            });
        }
        
        if (projects.length === 0) {
            container.innerHTML = '<p class="no-songs-message">' + 
                (searchTerm ? 'Nenhuma música encontrada para esta busca.' : 'Nenhuma música disponível. Adicione músicas primeiro.') + 
                '</p>';
            return;
        }
        
        container.innerHTML = projects.map(project => `
            <div class="playlist-song-item">
                <label class="playlist-song-checkbox">
                    <input type="checkbox" value="${project.id}" data-project-name="${project.name}">
                    <span class="checkbox-custom"></span>
                    <div class="playlist-song-info">
                        <div class="playlist-song-cover">
                            ${project.cover 
                                ? `<img src="${project.cover}" alt="${project.name}">` 
                                : `<div class="default-cover">${project.name.charAt(0).toUpperCase()}</div>`
                            }
                        </div>
                        <div class="playlist-song-details">
                            <span class="playlist-song-name">${project.name}</span>
                            <span class="playlist-song-artist">${project.artist || 'Unknown Artist'}</span>
                        </div>
                    </div>
                </label>
            </div>
        `).join('');
    }
    
    handlePlaylistCoverUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Por favor, selecione um arquivo de imagem válido.');
            return;
        }
        
        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('A imagem não pode exceder 5MB.');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            this.currentPlaylistCover = e.target.result;
            
            // Show preview
            const preview = document.getElementById('coverPreview');
            const previewImage = document.getElementById('coverPreviewImage');
            const placeholder = document.getElementById('coverUploadPlaceholder');
            
            previewImage.src = e.target.result;
            preview.style.display = 'block';
            placeholder.style.display = 'none';
        };
        reader.readAsDataURL(file);
    }
    
    removePlaylistCover() {
        this.currentPlaylistCover = null;
        document.getElementById('playlistCoverInput').value = '';
        document.getElementById('coverPreview').style.display = 'none';
        document.getElementById('coverUploadPlaceholder').style.display = 'flex';
    }
    
    async savePlaylist() {
        const nameInput = document.getElementById('playlistName');
        const name = nameInput.value.trim();
        
        if (!name) {
            alert('Por favor, insira um nome para a playlist.');
            return;
        }
        
        // Get selected project IDs
        const checkboxes = document.querySelectorAll('#playlistSongsSelector input[type="checkbox"]:checked');
        const projectIds = Array.from(checkboxes).map(cb => cb.value);
        
        if (projectIds.length === 0) {
            alert('Por favor, selecione pelo menos uma música para a playlist.');
            return;
        }
        
        try {
            const playlistData = {
                name: name,
                cover: this.currentPlaylistCover,
                projectIds: projectIds
            };
            
            const playlist = await storage.createPlaylist(playlistData);
            console.log('[APP] Playlist created:', playlist);
            
            // Close modal
            this.closeCreatePlaylistModal();
            
            // Switch to playlists view
            this.switchToPlaylistsFilter();
            
            // Show success message
            alert('Playlist "' + name + '" criada com sucesso!');
            
        } catch (error) {
            console.error('[APP] Error creating playlist:', error);
            alert('Erro ao criar playlist: ' + error.message);
        }
    }
    
    switchToPlaylistsFilter() {
        // Update filter buttons
        const filterBtns = document.querySelectorAll('.filter-btn');
        filterBtns.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.filter === 'playlists') {
                btn.classList.add('active');
            }
        });
        
        // Update current filter and render
        this.currentFilter = 'playlists';
        this.renderLibrary('playlists');
    }
    
    async playPlaylist(playlistId) {
        const playlist = storage.getPlaylist(playlistId);
        if (!playlist) {
            console.error('[APP] Playlist not found:', playlistId);
            return;
        }
        
        console.log('[APP] Playing playlist:', playlist.name);
        
        // Get all projects in the playlist
        const projects = storage.getPlaylistProjects(playlistId);
        
        if (projects.length === 0) {
            alert('Esta playlist não contém músicas disponíveis.');
            return;
        }
        
        try {
            // Load the first project into the player
            const firstProject = projects[0];
            
            // Hydrate audio files before loading to player
            console.log('[APP] Hydrating audio files for first project:', firstProject.name);
            const hydrationResult = await this.hydrateProjectFiles(firstProject);
            
            if (hydrationResult.missingCount > 0) {
                console.warn('[APP] Some tracks have missing audio files:', hydrationResult.missingCount);
                alert(`Aviso: ${hydrationResult.missingCount} faixas não têm arquivos de áudio disponíveis.`);
            }
            
            await this.loadProjectToPlayer(firstProject);
            
            // Set up playlist queue for sequential playback
            this.currentPlaylistId = playlistId;
            this.playlistQueue = projects.slice(1); // Remaining projects
            this.currentPlaylistIndex = 0;
            
            // Start playback
            if (this.audioPlayer) {
                await this.audioPlayer.play();
            }
            
            console.log('[APP] Playlist playback started, queue size:', this.playlistQueue.length);
            
        } catch (error) {
            console.error('[APP] Error playing playlist:', error);
            alert('Erro ao reproduzir playlist: ' + error.message);
        }
    }
    
    async loadProjectToPlayer(project) {
        console.log('[APP] Loading project to player:', project.name);
        
        // Stop any current playback and cleanup
        if (this.audioPlayer) {
            this.audioPlayer.stop();
            this.audioPlayer.stopVisualization();
            this.audioPlayer.stopPlaybackTimer();
        }
        
        // Stop pad when loading new project
        if (this.padIsPlaying) {
            this.stopPad();
        }
        
        // Switch to player view
        this.switchToPlayer();
        
        // Set current project
        this.currentProject = project;
        
        // Initialize audio player if needed
        if (!this.audioPlayer) {
            this.audioPlayer = new MultitrackPlayer();
            this.setupPlayerCallbacks();
        }
        
        // Hydrate audio files before loading to player (if not already hydrated)
        console.log('[APP] Checking audio file hydration for project:', project.name);
        const hydrationResult = await this.hydrateProjectFiles(project);
        
        if (hydrationResult.missingCount > 0) {
            console.warn('[APP] Some tracks have missing audio files:', hydrationResult.missingCount);
            // Don't alert here to avoid spam during playlist playback
        }
        
        // Filter out tracks without audio files to prevent playback failures
        const originalTrackCount = project.tracks.length;
        project.tracks = project.tracks.filter(track => track.file !== null || track.streamUrl !== null);
        const filteredTrackCount = project.tracks.length;
        
        if (filteredTrackCount === 0) {
            console.error('[APP] No tracks with valid audio files after filtering');
            throw new Error('Nenhuma faixa com áudio válido disponível');
        }
        
        if (filteredTrackCount < originalTrackCount) {
            console.warn('[APP] Filtered out', originalTrackCount - filteredTrackCount, 'tracks without audio files');
        }
        
        // Load project into player
        await this.audioPlayer.loadProject(project);
        
        // Update UI
        this.renderMixer();
        this.renderProjectInfo();
        
        console.log('[APP] Project loaded successfully to player with', filteredTrackCount, 'valid tracks');
    }
    
    setupPlayerCallbacks() {
        if (!this.audioPlayer) return;
        
        // Prevent setting up callbacks multiple times
        if (this.callbacksSetup) {
            console.log('[APP] Player callbacks already setup, skipping');
            return;
        }
        
        // Set up callback for when song ends to play next in playlist
        // We'll handle this in the main initPlayer callback to avoid conflicts
        // Just mark that we're setting up playlist-specific logic
        console.log('[APP] Playlist-specific song ended handling will be managed by main callback');
        
        // Set up other callbacks
        this.audioPlayer.onTimeUpdate = (currentTime) => {
            this.updateTimeDisplay(currentTime);
        };
        
        this.audioPlayer.onPlayStateChange = (state) => {
            this.updatePlayButton(state);
        };
        
        this.audioPlayer.onTrackStateChange = (trackId, state) => {
            this.updateTrackState(trackId, state);
        };
        
        this.callbacksSetup = true;
        console.log('[APP] Player callbacks setup complete');
    }
    
    async playNextInPlaylist() {
        console.log('[APP] Song ended, playing next in playlist');
        
        if (!this.playlistQueue || this.playlistQueue.length === 0) {
            console.log('[APP] Playlist queue empty, stopping playback');
            this.currentPlaylistId = null;
            return;
        }
        
        const nextProject = this.playlistQueue.shift();
        this.currentPlaylistIndex++;
        
        try {
            // Hydrate audio files for the next project
            console.log('[APP] Hydrating audio files for next project:', nextProject.name);
            const hydrationResult = await this.hydrateProjectFiles(nextProject);
            
            if (hydrationResult.missingCount > 0) {
                console.warn('[APP] Some tracks have missing audio files:', hydrationResult.missingCount);
            }
            
            await this.loadProjectToPlayer(nextProject);
            
            if (this.audioPlayer) {
                await this.audioPlayer.play();
            }
            
            console.log('[APP] Playing next song in playlist:', nextProject.name);
            
        } catch (error) {
            console.error('[APP] Error playing next song:', error);
            // Don't recursively call playNextInPlaylist to prevent infinite loop
            // Just stop playback if there's an error
            if (this.audioPlayer) {
                this.audioPlayer.stop();
            }
            
            // Try to play the next song instead of stopping completely
            if (this.playlistQueue.length > 0) {
                console.log('[APP] Attempting to play next song after error');
                setTimeout(() => this.playNextInPlaylist(), 1000);
            }
        }
    }
    
    openPlaylistDetails(playlistId) {
        const playlist = storage.getPlaylist(playlistId);
        if (!playlist) return;
        
        // For now, just play the playlist
        // Could be expanded to show playlist details/edit
        this.playPlaylist(playlistId);
    }
    
    showPlaylistMenu(playlistId, menuButton) {
        // Simple context menu for playlist options
        const playlist = storage.getPlaylist(playlistId);
        if (!playlist) return;
        
        const options = [
            { label: 'Tocar', action: () => this.playPlaylist(playlistId) },
            { label: 'Editar', action: () => this.editPlaylist(playlistId) },
            { label: 'Excluir', action: () => this.deletePlaylist(playlistId) }
        ];
        
        // Create simple menu
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.innerHTML = options.map(opt => 
            `<button class="context-menu-item">${opt.label}</button>`
        ).join('');
        
        // Position menu
        const rect = menuButton.getBoundingClientRect();
        menu.style.top = rect.bottom + 'px';
        menu.style.left = rect.left + 'px';
        
        document.body.appendChild(menu);
        
        // Add click handlers
        menu.querySelectorAll('.context-menu-item').forEach((item, index) => {
            item?.addEventListener('click', () => {
                options[index].action();
                menu.remove();
            });
        });
        
        // Close menu on outside click
        setTimeout(() => {
            const closeMenu = (e) => {
                if (!menu.contains(e.target)) {
                    menu.remove();
                    document.removeEventListener('click', closeMenu);
                }
            };
            document.addEventListener('click', closeMenu);
        }, 0);
    }
    
    editPlaylist(playlistId) {
        // For now, just show a message
        alert('Funcionalidade de edição de playlist em desenvolvimento.');
    }
    
    async deletePlaylist(playlistId) {
        const confirmed = confirm('Tem certeza que deseja excluir esta playlist?');
        if (!confirmed) return;
        
        try {
            await storage.deletePlaylist(playlistId);
            this.renderLibrary('playlists');
            console.log('[APP] Playlist deleted:', playlistId);
        } catch (error) {
            console.error('[APP] Error deleting playlist:', error);
            alert('Erro ao excluir playlist: ' + error.message);
        }
    }
    
    addCreatePlaylistButton() {
        // Check if button already exists
        const existingBtn = document.getElementById('playlistGridBtn');
        if (existingBtn) {
            existingBtn.remove();
        }
        
        // Create create playlist card
        const createCard = document.createElement('div');
        createCard.className = 'music-card create-playlist-card';
        createCard.id = 'playlistGridBtn';
        createCard.innerHTML = `
            <div class="music-card-cover">
                <div class="create-playlist-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 5v14M5 12h14"></path>
                    </svg>
                </div>
            </div>
            <div class="music-card-content">
                <h3 class="music-card-title">Criar Playlist</h3>
            </div>
        `;
        
        createCard?.addEventListener('click', () => {
            this.createNewPlaylist();
        });
        
        // Add to beginning of grid
        this.musicGrid.insertBefore(createCard, this.musicGrid.firstChild);
    }
    
    renderMusicCards(projects) {
        this.musicGrid.innerHTML = '';
        
        projects.forEach(project => {
            const card = this.createMusicCard(project);
            this.musicGrid.appendChild(card);
        });
    }
    
    renderPlaylistCards(playlists) {
        this.musicGrid.innerHTML = '';
        
        playlists.forEach(playlist => {
            const card = this.createPlaylistCard(playlist);
            this.musicGrid.appendChild(card);
        });
    }
    
    createPlaylistCard(playlist) {
        const card = document.createElement('div');
        card.className = 'music-card playlist-card';
        card.dataset.playlistId = playlist.id;
        
        const coverHtml = playlist.cover 
            ? `<img src="${playlist.cover}" alt="${playlist.name}">`
            : `
                <div class="music-card-cover-placeholder">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M9 18V5l12-2v13"></path>
                        <circle cx="6" cy="18" r="3"></circle>
                        <circle cx="18" cy="16" r="3"></circle>
                    </svg>
                </div>
            `;
        
        const songCount = playlist.projectIds.length;
        const date = this.formatDate(playlist.updatedAt);
        
        card.innerHTML = `
            <div class="music-card-cover">
                ${coverHtml}
                <button class="music-card-menu" aria-label="Opções">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="1"></circle>
                        <circle cx="12" cy="5" r="1"></circle>
                        <circle cx="12" cy="19" r="1"></circle>
                    </svg>
                </button>
            </div>
            <div class="music-card-content">
                <h3 class="music-card-title">${this.escapeHtml(playlist.name)}</h3>
                <div class="music-card-meta">
                    <div class="music-card-meta-row">
                        <span class="music-card-tracks">${songCount} música${songCount !== 1 ? 's' : ''}</span>
                        <span class="music-card-date">${date}</span>
                    </div>
                </div>
            </div>
            <div class="music-card-actions">
                <button class="music-card-play-btn" aria-label="Tocar playlist">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                </button>
            </div>
        `;
        
        // Add click event for play button
        const playBtn = card.querySelector('.music-card-play-btn');
        playBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.playPlaylist(playlist.id);
        });
        
        // Add click event for card (open playlist details)
        card?.addEventListener('click', () => {
            this.openPlaylistDetails(playlist.id);
        });
        
        // Add menu button event
        const menuBtn = card.querySelector('.music-card-menu');
        menuBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            // Check if menu is already open for this button
            const existingMenu = document.querySelector('.context-menu');
            if (existingMenu) {
                existingMenu.remove();
            } else {
                this.showPlaylistMenu(playlist.id, menuBtn);
            }
        });
        
        return card;
    }
    
    createMusicCard(project) {
        const card = document.createElement('div');
        card.className = 'music-card';
        card.dataset.projectId = project.id;
        
        const coverHtml = project.cover 
            ? `<img src="${project.cover}" alt="${project.name}">`
            : `
                <div class="music-card-cover-placeholder">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M9 18V5l12-2v13"></path>
                        <circle cx="6" cy="18" r="3"></circle>
                        <circle cx="18" cy="16" r="3"></circle>
                    </svg>
                </div>
            `;
        
        const date = this.formatDate(project.updatedAt);
        const trackCount = project.getTrackCount();
        
        // Check if this is an explore music
        const isExploreMusic = project.isExploreMusic || false;
        const trackInfo = isExploreMusic ? '🎵 Música do explorar' : `${trackCount} track${trackCount !== 1 ? 's' : ''}`;
        
        card.innerHTML = `
            <div class="music-card-cover">
                ${coverHtml}
                <button class="music-card-menu" aria-label="Opções">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="1"></circle>
                        <circle cx="12" cy="5" r="1"></circle>
                        <circle cx="12" cy="19" r="1"></circle>
                    </svg>
                </button>
            </div>
            <div class="music-card-content">
                <h3 class="music-card-title">${this.escapeHtml(project.name)}</h3>
                <div class="music-card-meta">
                    <div class="music-card-meta-row">
                        ${project.key && !isExploreMusic ? `<span class="music-card-key">🎹 ${project.key}</span>` : ''}
                        <span class="${isExploreMusic ? 'music-card-key' : ''}">${trackInfo}</span>
                    </div>
                    <div class="music-card-date">Última alteração: ${date}</div>
                </div>
            </div>
        `;
        
        card.addEventListener('click', async (e) => {
            if (!e.target.closest('.music-card-menu')) {
                await this.openProject(project.id);
            }
        });
        
        const menuBtn = card.querySelector('.music-card-menu');
        menuBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            // Check if menu is already open for this button
            const existingMenu = document.querySelector('.card-menu-dropdown');
            if (existingMenu) {
                existingMenu.remove();
            } else {
                this.showCardMenu(project, menuBtn);
            }
        });
        
        return card;
    }
    
    async openProject(projectId) {
        console.log('[APP] =======================================');
        console.log('[APP] openProject() called with projectId:', projectId);

        const project = storage.getProject(projectId);
        if (project) {
            console.log('[APP] Found project:', project.name);

            // Stop current playback before opening new project
            if (this.audioPlayer && this.audioPlayer.isPlaying) {
                console.log('[APP] Stopping current playback before opening new project');
                this.audioPlayer.stop();
            }
            
            // Hydrate audio files before loading
            console.log('[APP] Hydrating audio files for project:', project.name);
            const hydrationResult = await this.hydrateProjectFiles(project);
            
            if (hydrationResult.missingCount > 0) {
                console.warn('[APP] Some tracks have missing audio files:', hydrationResult.missingCount);
                alert(`Aviso: ${hydrationResult.missingCount} faixas não têm arquivos de áudio disponíveis.`);
            }
            
            // Filter out tracks without audio files
            const originalTrackCount = project.tracks.length;
            project.tracks = project.tracks.filter(track => track.file !== null || track.streamUrl !== null);
            const filteredTrackCount = project.tracks.length;
            
            if (filteredTrackCount === 0) {
                console.error('[APP] No tracks with valid audio files after filtering');
                alert('Erro: Nenhuma faixa com áudio válido disponível');
                return;
            }
            
            if (filteredTrackCount < originalTrackCount) {
                console.warn('[APP] Filtered out', originalTrackCount - filteredTrackCount, 'tracks without audio files');
            }
            
            // Add to player session if not already there
            if (!this.playerSession.find(p => p.id === projectId)) {
                console.log('[APP] Adding project to player session');
                this.playerSession.push(project);
            } else {
                console.log('[APP] Project already in player session');
            }
            
            this.currentProject = project;
            this.switchToPlayer();
            storage.incrementPlayCount(projectId);
        } else {
            console.warn('[APP] Project not found:', projectId);
        }
        
        console.log('[APP] =======================================');
    }
    
    // ========================================
    // VIEW NAVIGATION
    // ========================================
    switchToPlayer() {
        this.currentView = 'player';

        const library = document.querySelector('.library');
        const hero = document.querySelector('.hero');
        const fab = document.querySelector('.fab-add');
        const playerView = document.getElementById('playerView');
        const exploreView = document.getElementById('exploreView');

        if (library) library.style.display = 'none';
        if (hero) hero.style.display = 'none';
        if (fab) fab.style.display = 'none';
        if (exploreView) exploreView.style.display = 'none';
        
        if (playerView) {
            playerView.classList.add('active');
        }
        
        // Hide main header when player is active
        document.body.classList.add('player-active');
        
        this.renderPlayer();
    }
    
    switchToLibrary() {
        this.currentView = 'library';
        document.getElementById('playerView').classList.remove('active');
        document.getElementById('libraryView').style.display = 'block';
        document.getElementById('myTracksView').style.display = 'none';
        document.getElementById('communityView').style.display = 'none';
        document.getElementById('exploreView').style.display = 'none';
        document.querySelector('.hero').style.display = 'block';
        document.querySelector('.fab-add').style.display = 'flex';
        
        // Show main header when returning to library
        document.body.classList.remove('player-active');
        
        // Stop playback if playing
        if (this.audioPlayer) {
            this.audioPlayer.stop();
        }
        
        // Clear effects when returning to library
        this.clearAllEffects();
        
        // Hide effect popover if open
        this.hideEffectPopover();
        this.hideClickIndicator();
        
        // Reset drag state
        this.resetTimelineDragState();
        
        // Stop PAD if playing
        if (this.padIsPlaying) {
            this.stopPad();
        }
        
        // Deactivate idle wave when leaving player
        this.deactivateIdleWave();
        
        this.renderLibrary();
    }

    switchToExplore() {
        this.currentView = 'explore';
        document.getElementById('playerView').classList.remove('active');
        document.getElementById('libraryView').style.display = 'none';
        document.getElementById('exploreView').style.display = 'block';
        document.querySelector('.hero').style.display = 'none';
        document.querySelector('.fab-add').style.display = 'none';
        
        // Show main header when switching to explore
        document.body.classList.remove('player-active');
        
        // Stop playback if playing
        if (this.audioPlayer) {
            this.audioPlayer.stop();
        }
        
        // Stop PAD if playing
        if (this.padIsPlaying) {
            this.stopPad();
        }
        
        // Deactivate idle wave when leaving player
        this.deactivateIdleWave();
        
        this.renderExplore();
    }
    
    // ========================================
    // PLAYER
    // ========================================
    initPlayer() {
        this.playerView = document.getElementById('playerView');
        this.musicSelectorScroll = document.getElementById('musicSelectorScroll');
        this.backToLibrary = document.getElementById('backToLibrary');
        this.playPauseBtn = document.getElementById('playPauseBtn');
        this.bpmValue = document.getElementById('bpmValue');
        this.timeSignature = document.getElementById('timeSignature');
        this.currentTimeDisplay = document.getElementById('currentTime');
        this.waveformCanvas = document.getElementById('waveformCanvas');
        this.playhead = document.getElementById('playhead');
        this.mixerTracks = document.getElementById('mixerTracks');
        this.masterFader = document.getElementById('masterFader');
        
        // Effects management
        this.effectsLayer = document.getElementById('effectsLayer');
        this.clickIndicator = document.getElementById('clickIndicator');
        this.effectPopover = document.getElementById('effectPopover');
        this.effectFileInput = document.getElementById('effectFileInput');
        this.cancelEffectBtn = document.getElementById('cancelEffectBtn');
        this.popoverTime = document.getElementById('popoverTime');
        
        // Effects data storage
        this.effects = []; // Array to store effect objects
        this.currentClickTime = null; // Store current click position in seconds
        
        // Timeline scrubbing/dragging
        this.isDragging = false;
        this.dragStartTime = 0;
        this.dragStartX = 0;
        
        // BPM and metronome controls
        this.bpmInput = document.getElementById('bpmInput');
        this.timeSignatureSelect = document.getElementById('timeSignatureSelect');
        this.metronomeBtn = document.getElementById('metronomeBtn');
        
        // Master channel controls
        this.masterPanInput = document.getElementById('masterPanInput');
        
        // Master pan value
        this.masterPan = 0;
        
        // Setup master pan slider interaction
        if (this.masterPanInput) {
            this.masterPanInput.addEventListener('input', (e) => {
                const panValue = parseInt(e.target.value) / 100; // Convert -100 to 100 range to -1 to 1
                this.masterPan = panValue;
                this.setMasterPan(panValue);
            });
        }
        
        // Add song to session modal
        this.addSongToSessionModal = document.getElementById('addSongToSessionModal');
        this.addSongModalClose = document.getElementById('addSongModalClose');
        this.songSearchInput = document.getElementById('songSearchInput');
        this.songList = document.getElementById('songList');
        
        // Idle wave timer for faders
        this.idleTimer = null;
        this.idleTimeout = 10000; // 10 seconds
        this.initIdleTimer();
        
        // Initialize audio player
        try {
            this.audioPlayer = new MultitrackPlayer();
            
            // Set up player callbacks
            this.audioPlayer.onTimeUpdate = (time) => this.updateTimeDisplay(time);
            this.audioPlayer.onPlayStateChange = (state) => this.updatePlayButton(state);
            this.audioPlayer.onTrackStateChange = (trackId, state) => this.updateTrackState(trackId, state);
            this.audioPlayer.onTrackLevelUpdate = (trackId, level) => this.updateTrackLevelMeter(trackId, level);
            this.audioPlayer.onMetronomeLevelUpdate = (level) => this.updateMetronomeLevelMeter(level);
            this.audioPlayer.onMasterLevelUpdate = (level) => this.updateMasterLevelMeter(level);
            this.audioPlayer.onDurationChange = (duration) => this.setTotalDuration(duration);
            this.audioPlayer.onSongEnded = () => {
                // Check if we're in playlist mode
                if (this.currentPlaylistId && this.playlistQueue && this.playlistQueue.length > 0) {
                    console.log('[APP] In playlist mode, playing next song');
                    this.playNextInPlaylist();
                } else {
                    console.log('[APP] Not in playlist mode, using default song ended handler');
                    this.handleSongEnded();
                }
            };
        } catch (error) {
            console.error('Error creating MultitrackPlayer:', error);
            this.audioPlayer = null;
        }
        
        // Initialize metronome state
        this.metronomeEnabled = false;
        this.metronomeVolume = 1.0; // Unity gain (0dB)
        this.metronomePan = 0;
        this.metronomeMuted = false;
        this.metronomeSolo = false;

        // Master solo state
        this.masterSoloEnabled = false;

        // Initialize master fader to 0dB (position 0.5 = value 50)
        if (this.masterFader) {
            this.masterFader.value = 50;
            const masterPosition = 0.5;
            const masterDb = this.positionToDb(masterPosition);
            const masterGain = this.dbToGain(masterDb);

            // Update master display
            const masterDbValue = document.getElementById('masterDbValue');
            if (masterDbValue) {
                masterDbValue.textContent = this.formatDbValue(masterDb);
            }

            // Set initial master volume in audio player
            if (this.audioPlayer) {
                this.audioPlayer.setMasterVolume(masterGain);
            }
        }
    }
    
    initIdleTimer() {
        // Reset timer on user interaction
        const resetIdleTimer = () => {
            this.resetIdleTimer();
        };
        
        // Add event listeners for user interactions
        document.addEventListener('mousemove', resetIdleTimer);
        document.addEventListener('mousedown', resetIdleTimer);
        document.addEventListener('touchstart', resetIdleTimer);
        document.addEventListener('keydown', resetIdleTimer);
        
        // Also reset on fader input
        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('fader-input')) {
                // Immediately stop animation for this specific fader
                this.stopIdleWaveForFader(e.target);
                resetIdleTimer();
            }
        });
        
        // Start the idle timer
        this.startIdleTimer();
    }
    
    startIdleTimer() {
        // Clear existing timer
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
        }
        
        // Only start timer if player is paused
        if (this.audioPlayer && !this.audioPlayer.isPlaying) {
            this.idleTimer = setTimeout(() => {
                this.activateIdleWave();
            }, this.idleTimeout);
        }
    }
    
    resetIdleTimer() {
        // Remove idle wave effect if active
        this.deactivateIdleWave();
        
        // Restart timer if player is paused
        this.startIdleTimer();
    }
    
    activateIdleWave() {
        // Only activate if player is still paused
        if (this.audioPlayer && !this.audioPlayer.isPlaying) {
            const mixerContainer = document.querySelector('.mixer-container');
            if (mixerContainer) {
                mixerContainer.classList.add('idle-wave');
                console.log('[APP] Idle wave activated');
            }
        }
    }
    
    deactivateIdleWave() {
        const mixerContainer = document.querySelector('.mixer-container');
        if (mixerContainer && mixerContainer.classList.contains('idle-wave')) {
            // Add stopping class for smooth transition
            mixerContainer.classList.remove('idle-wave');
            mixerContainer.classList.add('idle-wave-stopping');
            
            // Remove stopping class after transition completes
            setTimeout(() => {
                if (mixerContainer) {
                    mixerContainer.classList.remove('idle-wave-stopping');
                }
            }, 500); // Match the CSS transition duration
        }
        
        // Clear timer
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
            this.idleTimer = null;
        }
    }
    
    stopIdleWaveForFader(faderInput) {
        // Immediately stop animation for the specific fader being interacted with
        const trackChannel = faderInput.closest('.track-channel');
        if (trackChannel) {
            const trackFader = trackChannel.querySelector('.track-fader');
            if (trackFader) {
                // Remove animation immediately
                trackFader.style.animation = 'none';
                trackFader.style.transform = 'translateY(0)';
                trackFader.style.transition = 'transform 0.2s ease-out';
            }
        }
    }
    
    renderPlayer() {
        if (!this.currentProject) return;
        
        this.renderMusicSelector();
        this.renderProjectInfo();
        this.renderMixer();
        this.loadProjectAudio();
    }
    
    renderMusicSelector() {
        // Show only songs in player session
        const projects = this.playerSession;
        this.musicSelectorScroll.innerHTML = '';
        
        if (projects.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'music-selector-empty';
            emptyState.textContent = 'Nenhuma música na sessão';
            emptyState.style.cssText = `
                padding: var(--spacing-md);
                color: var(--color-white-muted);
                font-size: var(--font-size-sm);
            `;
            this.musicSelectorScroll.appendChild(emptyState);
            return;
        }
        
        projects.forEach(project => {
            const item = document.createElement('div');
            item.className = 'music-selector-item';
            if (project.id === this.currentProject.id) {
                item.classList.add('active');
            }
            
            const coverHtml = project.cover 
                ? `<img src="${project.cover}" alt="${project.name}">`
                : `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M9 18V5l12-2v13"></path>
                        <circle cx="6" cy="18" r="3"></circle>
                        <circle cx="18" cy="16" r="3"></circle>
                    </svg>
                `;
            
            item.innerHTML = `
                <div class="music-selector-cover">
                    ${coverHtml}
                </div>
                <div class="music-selector-info">
                    <div class="music-selector-name">${this.escapeHtml(project.name)}</div>
                    <div class="music-selector-key">${project.key || '--'}</div>
                </div>
                <button class="music-selector-remove" data-project-id="${project.id}" aria-label="Remover da sessão">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            `;
            
            // Click on item to switch song
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.music-selector-remove')) {
                    this.switchToSong(project.id);
                }
            });
            
            // Click on remove button
            const removeBtn = item.querySelector('.music-selector-remove');
            removeBtn?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeFromSession(project.id);
            });
            
            this.musicSelectorScroll.appendChild(item);
        });
    }
    
    switchToSong(projectId) {
        console.log('[APP] =======================================');
        console.log('[APP] switchToSong() called with projectId:', projectId);
        
        const project = this.playerSession.find(p => p.id === projectId);
        if (project) {
            console.log('[APP] Found project in session:', project.name);
            
            // Stop current playback before switching
            if (this.audioPlayer && this.audioPlayer.isPlaying) {
                console.log('[APP] Stopping current playback before switching');
                this.audioPlayer.stop();
            }
            
            // Stop PAD if playing before switching
            if (this.padIsPlaying) {
                console.log('[APP] Stopping PAD before switching');
                this.stopPad();
            }
            
            this.currentProject = project;
            this.renderMusicSelector();
            this.renderProjectInfo();
            this.renderMixer();
            
            console.log('[APP] Loading audio for new project:', project.name);
            this.loadProjectAudio();
            storage.incrementPlayCount(projectId);
        } else {
            console.warn('[APP] Project not found in session:', projectId);
        }
        
        console.log('[APP] =======================================');
    }
    
    removeFromSession(projectId) {
        // Remove from session
        this.playerSession = this.playerSession.filter(p => p.id !== projectId);
        
        // If removing current song, switch to another if available
        if (this.currentProject.id === projectId) {
            if (this.playerSession.length > 0) {
                this.currentProject = this.playerSession[0];
                this.renderProjectInfo();
                this.renderMixer();
                this.loadProjectAudio();
            } else {
                // No songs left, go back to library
                this.switchToLibrary();
                return;
            }
        }
        
        this.renderMusicSelector();
    }
    
    renderProjectInfo() {
        this.bpmInput.value = this.currentProject.bpm || 120;
        this.timeSignatureSelect.value = this.currentProject.timeSignature || '4/4';
        // Duration will be set by player's onDurationChange callback after loading
        this.currentTimeDisplay.textContent = '0:00';
    }
    
    renderMixer() {
        this.mixerTracks.innerHTML = '';

        // Render regular tracks
        this.currentProject.tracks.forEach((track, index) => {
            const channel = this.createTrackChannel(track, index);
            this.mixerTracks.appendChild(channel);
        });

        // Render metronome channel if enabled
        if (this.metronomeEnabled) {
            const metronomeChannel = this.createMetronomeChannel();
            this.mixerTracks.appendChild(metronomeChannel);
        }

        // Initialize master LED ring
        this.updateLedRing('master', 0);

        // Check initial state of faders for indicator light
        this.checkFadersModified();

        // Check initial state of panned tracks for indicator light
        this.checkPannedTracks();

        // Apply solo-muted effect if any tracks are in solo
        this.updateSoloMutedEffect();

        // Apply muted effect for tracks that are already muted
        this.mixerTracks.querySelectorAll('.track-channel').forEach(trackChannel => {
            const trackId = trackChannel.dataset.trackId;
            const track = this.currentProject?.tracks.find(t => t.id === trackId);
            if (track && track.mute) {
                trackChannel.classList.add('muted');
            }
        });
    }
    
    createTrackChannel(track, index) {
        const channel = document.createElement('div');
        channel.className = 'track-channel';
        channel.dataset.trackId = track.id;
        
        // Convert gain to position for display
        const position = this.gainToPosition(track.volume);
        const volumePercent = Math.round(position * 100);
        const db = this.positionToDb(position);
        
        // Calculate pan rotation (-135deg to +135deg)
        const panRotation = track.pan * 135;
        const panLabel = this.formatPanLabel(track.pan);
        
        channel.innerHTML = `
            <div class="track-header">
                <div class="track-name">${this.escapeHtml(track.name)}</div>
            </div>
            <div class="track-controls">
                <button class="track-btn mute-btn ${track.mute ? 'active' : ''}" data-action="mute">M</button>
                <button class="track-btn solo-btn ${track.solo ? 'active' : ''}" data-action="solo">S</button>
            </div>
            <div class="track-fader">
                <input type="range" class="fader-input" min="0" max="100" value="${volumePercent}" data-action="volume">
                <div class="fader-track">
                    <div class="fader-fill" style="height: ${volumePercent}%"></div>
                    <div class="track-level-bar" id="trackLevelBar_${track.id}" style="height: 0%"></div>
                    <div class="track-level-bar peak" id="trackPeakBar_${track.id}" style="height: 0%"></div>
                </div>
                <div class="fader-thumb" style="bottom: ${volumePercent}%"></div>
            </div>
            <div class="track-db-value">${this.formatDbValue(db)}</div>
            <div class="track-pan-container">
                <input type="range" class="track-pan-input" min="-100" max="100" value="${Math.round(track.pan * 100)}" data-track-id="${track.id}" data-action="pan">
            </div>
        `;
        
        // Event listeners
        const muteBtn = channel.querySelector('.mute-btn');
        muteBtn?.addEventListener('click', () => this.toggleTrackMute(track.id));
        
        const soloBtn = channel.querySelector('.solo-btn');
        soloBtn?.addEventListener('click', () => this.toggleTrackSolo(track.id));
        
        // Pan slider interaction
        const panSlider = channel.querySelector('.track-pan-input');
        if (panSlider) {
            panSlider.addEventListener('input', (e) => {
                const panValue = parseInt(e.target.value) / 100; // Convert -100 to 100 range to -1 to 1
                this.setTrackPan(track.id, panValue);
            });
        }
        
        const volumeInput = channel.querySelector('.fader-input');
        const faderContainer = channel.querySelector('.track-fader');
        
        // Custom fader interaction - calculate volume from click position
        const handleFaderInteraction = (clientY) => {
            const rect = faderContainer.getBoundingClientRect();
            const clickY = clientY - rect.top;
            const percentage = 1 - (clickY / rect.height); // Top = 1.0, Bottom = 0.0
            const position = Math.max(0, Math.min(1, percentage));
            const volumePercent = Math.round(position * 100);
            
            // Convert position to dB gain
            const db = this.positionToDb(position);
            const gain = this.dbToGain(db);
            
            // Update audio player with gain (not linear volume)
            this.setTrackVolume(track.id, gain);
            
            // Update visual feedback (thumb and fader fill)
            const thumb = channel.querySelector('.fader-thumb');
            const faderFill = channel.querySelector('.fader-fill');
            const dbValue = channel.querySelector('.track-db-value');

            if (thumb) thumb.style.bottom = `${volumePercent}%`;
            if (faderFill) faderFill.style.height = `${volumePercent}%`;
            if (dbValue) dbValue.textContent = this.formatDbValue(db);

            // Update input value for consistency
            volumeInput.value = volumePercent;
            
            // Check if faders are modified to update indicator light
            this.checkFadersModified();
        };
        
        // Mouse events on entire fader container
        faderContainer?.addEventListener('mousedown', (e) => {
            handleFaderInteraction(e.clientY);
            
            const handleMouseMove = (moveEvent) => {
                handleFaderInteraction(moveEvent.clientY);
            };
            
            const handleMouseUp = () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
            
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        });
        
        // Touch events for mobile with reduced sensitivity
        faderContainer.addEventListener('touchstart', (e) => {
            e.preventDefault();
            
            // Immediately handle the initial touch position
            handleFaderInteraction(e.touches[0].clientY);
            
            const handleTouchMove = (moveEvent) => {
                moveEvent.preventDefault();
                handleFaderInteraction(moveEvent.touches[0].clientY);
            };
            
            const handleTouchEnd = () => {
                document.removeEventListener('touchmove', handleTouchMove);
                document.removeEventListener('touchend', handleTouchEnd);
            };
            
            document.addEventListener('touchmove', handleTouchMove);
            document.addEventListener('touchend', handleTouchEnd);
        });
        
        // Prevent default input event to avoid conflicts with custom handling
        volumeInput?.addEventListener('input', (e) => {
            e.preventDefault();
            const newVolume = e.target.value / 100;
            this.setTrackVolume(track.id, newVolume);
            
            // Update visual feedback immediately during drag
            const thumb = channel.querySelector('.fader-thumb');
            const fill = channel.querySelector('.track-meter-fill');
            const volumePercent = Math.round(newVolume * 100);
            
            if (thumb) thumb.style.bottom = `${volumePercent}%`;
            if (fill) fill.style.height = `${volumePercent}%`;
            
            // Check if faders are modified to update indicator light
            this.checkFadersModified();
        });
        
        return channel;
    }
    
    createMetronomeChannel() {
        const channel = document.createElement('div');
        channel.className = 'track-channel metronome-channel';
        channel.dataset.trackId = 'metronome';
        
        // Convert gain to position for display
        const position = this.gainToPosition(this.metronomeVolume);
        const volumePercent = Math.round(position * 100);
        const db = this.positionToDb(position);

        // Initialize metronome volume to unity gain if not set
        if (this.metronomeVolume === 0.5) {
            this.metronomeVolume = 1.0;
        }
        
        channel.innerHTML = `
            <div class="track-header">
                <div class="track-name">Click</div>
            </div>
            <div class="track-controls">
                <button class="track-btn metronome-mute-btn" data-action="mute">M</button>
                <button class="track-btn metronome-solo-btn" data-action="solo">S</button>
            </div>
            <div class="track-fader">
                <input type="range" class="fader-input metronome-fader" min="0" max="100" value="${volumePercent}">
                <div class="fader-track">
                    <div class="fader-fill" style="height: ${volumePercent}%"></div>
                    <div class="track-level-bar" id="metronomeLevelBar" style="height: 0%"></div>
                </div>
                <div class="fader-thumb" style="bottom: ${volumePercent}%"></div>
            </div>
            <div class="track-db-value">${this.formatDbValue(db)}</div>
            <div class="track-pan">
                <input type="range" class="track-pan-input metronome-pan" min="-1" max="1" step="0.1" value="${this.metronomePan}">
            </div>
        `;
        
        // Event listeners
        const muteBtn = channel.querySelector('.metronome-mute-btn');
        muteBtn?.addEventListener('click', () => this.toggleMetronomeMute());
        
        const soloBtn = channel.querySelector('.metronome-solo-btn');
        soloBtn?.addEventListener('click', () => this.toggleMetronomeSolo());
        
        const volumeInput = channel.querySelector('.metronome-fader');
        const faderContainer = channel.querySelector('.track-fader');
        
        // Custom fader interaction
        const handleFaderInteraction = (clientY) => {
            const rect = faderContainer.getBoundingClientRect();
            const clickY = clientY - rect.top;
            const percentage = 1 - (clickY / rect.height);
            const position = Math.max(0, Math.min(1, percentage));
            const volumePercent = Math.round(position * 100);
            
            const db = this.positionToDb(position);
            const gain = this.dbToGain(db);
            
            this.setMetronomeVolume(gain);

            const thumb = channel.querySelector('.fader-thumb');
            const faderFill = channel.querySelector('.fader-fill');
            const dbValue = channel.querySelector('.track-db-value');

            if (thumb) thumb.style.bottom = `${volumePercent}%`;
            if (faderFill) faderFill.style.height = `${volumePercent}%`;
            if (dbValue) dbValue.textContent = this.formatDbValue(db);

            volumeInput.value = volumePercent;
        };
        
        faderContainer?.addEventListener('mousedown', (e) => {
            handleFaderInteraction(e.clientY);
            
            const handleMouseMove = (moveEvent) => {
                handleFaderInteraction(moveEvent.clientY);
            };
            
            const handleMouseUp = () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
            
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        });
        
        // Touch events for mobile
        faderContainer.addEventListener('touchstart', (e) => {
            e.preventDefault();
            
            // Immediately handle the initial touch position
            handleFaderInteraction(e.touches[0].clientY);
            
            const handleTouchMove = (moveEvent) => {
                moveEvent.preventDefault();
                handleFaderInteraction(moveEvent.touches[0].clientY);
            };
            
            const handleTouchEnd = () => {
                document.removeEventListener('touchmove', handleTouchMove);
                document.removeEventListener('touchend', handleTouchEnd);
            };
            
            document.addEventListener('touchmove', handleTouchMove);
            document.addEventListener('touchend', handleTouchEnd);
        });
        
        // Touch events for mobile with reduced sensitivity
        faderContainer.addEventListener('touchstart', (e) => {
            e.preventDefault();
            
            // Immediately handle the initial touch position
            handleFaderInteraction(e.touches[0].clientY);
            
            const handleTouchMove = (moveEvent) => {
                moveEvent.preventDefault();
                handleFaderInteraction(moveEvent.touches[0].clientY);
            };
            
            const handleTouchEnd = () => {
                document.removeEventListener('touchmove', handleTouchMove);
                document.removeEventListener('touchend', handleTouchEnd);
            };
            
            document.addEventListener('touchmove', handleTouchMove);
            document.addEventListener('touchend', handleTouchEnd);
        });
        
        const panInput = channel.querySelector('.metronome-pan');
        panInput?.addEventListener('input', (e) => {
            this.setMetronomePan(parseFloat(e.target.value));
        });
        
        return channel;
    }
    
    /**
     * Hydrate project files from IndexedDB
     * This ensures tracks loaded from storage have their actual audio files
     * Can be called independently or is automatically called in loadProjectAudio()
     */
    async hydrateProjectFiles(project) {
        console.log('[APP] =======================================');
        console.log('[APP] hydrateProjectFiles() called for:', project.name);
        console.log('[APP] Total tracks to hydrate:', project.tracks.length);
        
        if (!this.audioStorage) {
            console.error('[APP] audioStorage not available, cannot hydrate files');
            return { hydratedCount: 0, missingCount: project.tracks.length, alreadyHadFileCount: 0 };
        }
        
        let hydratedCount = 0;
        let missingCount = 0;
        let alreadyHadFileCount = 0;
        let invalidIdCount = 0;
        let cloudHydratedCount = 0;
        
        for (const track of project.tracks) {
            console.log('[APP] Checking track:', track.name);
            console.log('[APP] Track has file:', !!track.file);
            console.log('[APP] Track has audioFileId:', track.audioFileId);
            console.log('[APP] Track isHttpStored:', track.isHttpStored);
            
            if (track.file) {
                alreadyHadFileCount++;
                console.log('[APP] Track already has file, skipping hydration:', track.name);
                continue;
            }
            
            if (!track.audioFileId) {
                missingCount++;
                invalidIdCount++;
                console.warn('[APP] Track has no file and no audioFileId:', track.name);
                continue;
            }
            
            // Check if track is stored in cloud (R2)
            if (track.isHttpStored) {
                console.log('[APP] Track is cloud-stored - fetching streaming URL from API...');
                try {
                    if (typeof apiClient !== 'undefined') {
                        const streamUrl = await apiClient.getTrackStreamUrl(track.audioFileId);
                        
                        if (streamUrl) {
                            // Create a Response object to simulate a file-like interface
                            // The audio player can handle URLs directly
                            track.streamUrl = streamUrl;
                            hydratedCount++;
                            cloudHydratedCount++;
                            console.log('[APP] ✅ Cloud-hydrated track:', track.name, 'Stream URL:', streamUrl.substring(0, 50) + '...');
                        } else {
                            missingCount++;
                            console.error('[APP] ❌ Failed to get stream URL for track:', track.name, 'audioFileId:', track.audioFileId);
                        }
                    } else {
                        console.error('[APP] apiClient not available for cloud hydration');
                        missingCount++;
                    }
                } catch (error) {
                    missingCount++;
                    console.error('[APP] ❌ Error fetching stream URL for track:', track.name, error);
                }
            } else {
                // Track is stored locally in IndexedDB
                console.log('[APP] Track is locally stored - fetching from IndexedDB...');
                try {
                    const file = await this.audioStorage.getAudioFile(track.audioFileId);
                    
                    if (file) {
                        track.file = file;
                        hydratedCount++;
                        console.log('[APP] ✅ Hydrated track from IndexedDB:', track.name, 'File size:', file.size);
                    } else {
                        missingCount++;
                        console.error('[APP] ❌ File not found in IndexedDB for track:', track.name, 'audioFileId:', track.audioFileId);
                    }
                } catch (error) {
                    missingCount++;
                    console.error('[APP] ❌ Error fetching file from IndexedDB for track:', track.name, error);
                }
            }
        }
        
        console.log('[APP] Hydration summary - Hydrated:', hydratedCount, 'Cloud-hydrated:', cloudHydratedCount, 'Already had file:', alreadyHadFileCount, 'Missing:', missingCount, 'Invalid IDs:', invalidIdCount);
        console.log('[APP] =======================================');
        
        return { hydratedCount, missingCount, alreadyHadFileCount, invalidIdCount, cloudHydratedCount };
    }

    /**
     * Show warning when project has missing audio files
     */
    showMissingFilesWarning(missingCount) {
        const warningDiv = document.createElement('div');
        warningDiv.className = 'missing-files-warning';
        warningDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: var(--color-black-card);
            border: 1px solid var(--border-medium);
            border-radius: var(--radius-lg);
            padding: var(--spacing-xl);
            max-width: 400px;
            z-index: 2000;
            box-shadow: var(--shadow-lg);
        `;
        
        warningDiv.innerHTML = `
            <div style="text-align: center;">
                <div style="font-size: 48px; margin-bottom: var(--spacing-md);">⚠️</div>
                <h3 style="color: var(--color-white); margin-bottom: var(--spacing-md);">Arquivos de áudio faltando</h3>
                <p style="color: var(--color-white-muted); margin-bottom: var(--spacing-lg);">
                    Este projeto tem ${missingCount} track(s) sem os arquivos de áudio correspondentes.
                    Isso pode acontecer se o projeto foi importado antes da atualização do sistema de armazenamento.
                </p>
                <div style="display: flex; gap: var(--spacing-md); justify-content: center;">
                    <button id="reimportBtn" style="
                        padding: var(--spacing-md) var(--spacing-xl);
                        background: var(--color-white);
                        color: var(--color-black);
                        border: none;
                        border-radius: var(--radius-md);
                        cursor: pointer;
                        font-weight: 600;
                    ">Reimportar arquivos</button>
                    <button id="cancelBtn" style="
                        padding: var(--spacing-md) var(--spacing-xl);
                        background: transparent;
                        color: var(--color-white-muted);
                        border: 1px solid var(--border-medium);
                        border-radius: var(--radius-md);
                        cursor: pointer;
                    ">Cancelar</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(warningDiv);
        
        const reimportBtn = warningDiv.querySelector('#reimportBtn');
        const cancelBtn = warningDiv.querySelector('#cancelBtn');
        
        reimportBtn?.addEventListener('click', () => {
            document.body.removeChild(warningDiv);
            this.openAddTracksModal();
        });
        
        cancelBtn?.addEventListener('click', () => {
            document.body.removeChild(warningDiv);
        });
    }

    /**
     * Show warning when IndexedDB quota is exceeded
     */
    showQuotaExceededWarning() {
        const warningDiv = document.createElement('div');
        warningDiv.className = 'quota-exceeded-warning';
        warningDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: var(--color-black-card);
            border: 1px solid var(--border-medium);
            border-radius: var(--radius-lg);
            padding: var(--spacing-xl);
            max-width: 450px;
            z-index: 2000;
            box-shadow: var(--shadow-lg);
        `;
        
        warningDiv.innerHTML = `
            <div style="text-align: center;">
                <div style="font-size: 48px; margin-bottom: var(--spacing-md);">💾</div>
                <h3 style="color: var(--color-white); margin-bottom: var(--spacing-md);">Armazenamento cheio</h3>
                <p style="color: var(--color-white-muted); margin-bottom: var(--spacing-lg);">
                    O armazenamento de áudio do navegador está cheio. Isso impede que novos arquivos sejam salvos e pode causar problemas com projetos existentes.
                </p>
                <div style="display: flex; flex-direction: column; gap: var(--spacing-md);">
                    <button id="clearAudioBtn" style="
                        padding: var(--spacing-md) var(--spacing-xl);
                        background: #ef4444;
                        color: white;
                        border: none;
                        border-radius: var(--radius-md);
                        cursor: pointer;
                        font-weight: 600;
                    ">Limpar armazenamento de áudio</button>
                    <button id="clearAllBtn" style="
                        padding: var(--spacing-md) var(--spacing-xl);
                        background: transparent;
                        color: var(--color-white-muted);
                        border: 1px solid var(--border-medium);
                        border-radius: var(--radius-md);
                        cursor: pointer;
                    ">Limpar tudo (projetos + áudio)</button>
                    <button id="cancelBtn" style="
                        padding: var(--spacing-md) var(--spacing-xl);
                        background: transparent;
                        color: var(--color-white-muted);
                        border: none;
                        border-radius: var(--radius-md);
                        cursor: pointer;
                    ">Cancelar</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(warningDiv);
        
        const clearAudioBtn = warningDiv.querySelector('#clearAudioBtn');
        const clearAllBtn = warningDiv.querySelector('#clearAllBtn');
        const cancelBtn = warningDiv.querySelector('#cancelBtn');
        
        clearAudioBtn?.addEventListener('click', async () => {
            if (confirm('Tem certeza que deseja limpar todos os arquivos de áudio? Isso não afetará os metadados dos projetos, mas você precisará reimportar os arquivos.')) {
                await this.audioStorage.clearAllAudioFiles();
                document.body.removeChild(warningDiv);
                alert('Armazenamento de áudio limpo. Por favor, recarregue a página e reimporte os arquivos dos projetos.');
                location.reload();
            }
        });
        
        clearAllBtn?.addEventListener('click', async () => {
            if (confirm('Tem certeza que deseja limpar TUDO (projetos e áudio)? Esta ação não pode ser desfeita.')) {
                await this.audioStorage.clearAllAudioFiles();
                storage.clearAll();
                document.body.removeChild(warningDiv);
                alert('Tudo foi limpo. A página será recarregada.');
                location.reload();
            }
        });
        
        cancelBtn?.addEventListener('click', () => {
            document.body.removeChild(warningDiv);
        });
    }

    /**
     * Open modal to add tracks to current project (for reimporting missing files)
     */
    openAddTracksModal() {
        // Create file input
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.multiple = true;
        fileInput.accept = 'audio/*';
        fileInput.style.display = 'none';
        
        fileInput?.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            if (files.length === 0) return;
            
            // Process files and add to current project
            await this.addFilesToCurrentProject(files);
            document.body.removeChild(fileInput);
        });
        
        document.body.appendChild(fileInput);
        fileInput.click();
    }

    /**
     * Add files to current project (for reimporting missing files)
     */
    async addFilesToCurrentProject(files) {
        console.log('[APP] Adding', files.length, 'files to current project:', this.currentProject.name);
        
        // Filter audio files
        const audioFiles = files.filter(file => file.type.startsWith('audio/'));
        console.log('[APP] Audio files filtered:', audioFiles.length);
        
        if (audioFiles.length === 0) {
            alert('Nenhum arquivo de áudio encontrado. Por favor, selecione arquivos de áudio.');
            return;
        }
        
        // Check storage space
        try {
            const totalSize = audioFiles.reduce((sum, file) => sum + file.size, 0);
            const spaceCheck = await this.audioStorage.checkSpaceAvailable(totalSize);
            
            if (!spaceCheck.available) {
                alert(`Espaço insuficiente. Necessário: ${this.audioStorage.formatBytes(totalSize)}, Disponível: ${this.audioStorage.formatBytes(spaceCheck.freeSpace)}`);
                return;
            }
            
            console.log('[STORAGE] Space check passed for', audioFiles.length, 'files:', this.audioStorage.formatBytes(totalSize));
        } catch (error) {
            console.warn('[STORAGE] Could not check space availability, proceeding anyway:', error);
        }
        
        // Add files to current project
        audioFiles.forEach(file => {
            const trackData = {
                name: this.suggestTrackName(file.name),
                originalFileName: file.name,
                fileSize: file.size,
                file: file
            };
            
            this.currentProject.addTrack(trackData);
        });
        
        // Save project and reload
        this.saveProjectEffects(); // Save effects along with project
        storage.updateProject(this.currentProject.id, this.currentProject);
        this.renderMixer();
        this.loadProjectAudio();
        
        console.log('[APP] Files added to project successfully');
    }

    async loadProjectAudio() {
        console.log('[APP] =======================================');
        console.log('[APP] loadProjectAudio() called');
        console.log('[APP] Current project:', this.currentProject ? this.currentProject.name : 'none');
        console.log('[APP] audioPlayer exists:', !!this.audioPlayer);
        
        if (!this.audioPlayer) {
            console.log('[APP] audioPlayer is null, skipping audio load');
            this.renderWaveform();
            return;
        }
        
        if (!this.currentProject) {
            console.log('[APP] No current project to load audio for');
            return;
        }
        
        if (!this.currentProject.tracks || this.currentProject.tracks.length === 0) {
            console.warn('[APP] Project has no tracks, skipping audio load');
            this.renderWaveform();
            return;
        }
        
        // Check if player is already loading
        if (this.audioPlayer.isLoading) {
            console.warn('[APP] Player is already loading a project, waiting for it to complete...');
            // Wait for current loading to complete
            while (this.audioPlayer.isLoading) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            console.log('[APP] Previous loading completed, proceeding with new project');
        }
        
        console.log('[APP] Player state before load - isLoading:', this.audioPlayer.isLoading, 'isReady:', this.audioPlayer.isReady);
        console.log('[APP] Total tracks in project:', this.currentProject.tracks.length);
        
        // HYDRATE PROJECT FILES BEFORE LOADING
        console.log('[APP] Hydrating project files before loading...');
        const hydrationResult = await this.hydrateProjectFiles(this.currentProject);
        
        if (hydrationResult.missingCount > 0) {
            console.warn('[APP] ⚠️ Some tracks are missing files, playback may be incomplete');
            this.showMissingFilesWarning(hydrationResult.missingCount);
        }
        
        // Show loading screen
        this.showPlayerLoading();
        
        // Set loading progress callback
        this.audioPlayer.onLoadingProgress = (loaded, total) => {
            console.log('[APP] Loading progress:', loaded, '/', total);
            this.updateLoadingProgress(loaded, total);
            
            // Hide loading screen when player is ready
            if (this.audioPlayer.isReady) {
                console.log('[APP] Player is ready, hiding loading screen');
                this.hidePlayerLoading();
            }
        };
        
        try {
            console.log('[APP] Calling audioPlayer.loadProject() for:', this.currentProject.name);
            await this.audioPlayer.loadProject(this.currentProject);
            console.log('[APP] ✅ Project audio loaded successfully');
            this.hidePlayerLoading();
            this.renderWaveform();
        } catch (error) {
            console.error('[APP] ❌ Error loading project audio:', error);
            console.error('[APP] Error details:', error.name, error.message);
            this.hidePlayerLoading();
            this.renderWaveform();
            
            // Check if the error is due to missing files
            if (hydrationResult.missingCount > 0) {
                this.showMissingFilesWarning(hydrationResult.missingCount);
            }
            
            // Check if it's a quota exceeded error
            if (error.message && error.message.includes('quota')) {
                this.showQuotaExceededWarning();
            }
        }
        
        console.log('[APP] Player state after load - isLoading:', this.audioPlayer.isLoading, 'isReady:', this.audioPlayer.isReady);
        console.log('[APP] =======================================');
    }
    
    showPlayerLoading() {
        const loadingScreen = document.getElementById('playerLoading');
        if (loadingScreen) {
            loadingScreen.classList.remove('hidden');
        }
    }
    
    hidePlayerLoading() {
        const loadingScreen = document.getElementById('playerLoading');
        if (loadingScreen) {
            // Keep loading screen visible for 2 seconds
            setTimeout(() => {
                loadingScreen.classList.add('hidden');
            }, 2000);
        }
    }
    
    updateLoadingProgress(loaded, total) {
        const progressElement = document.getElementById('loadingProgress');
        if (progressElement) {
            progressElement.textContent = `${loaded} de ${total} tracks`;
        }
    }
    
    async renderWaveform() {
        const canvas = this.waveformCanvas;
        const ctx = canvas.getContext('2d');
        const loadingIndicator = document.getElementById('waveformLoading');
        
        // Set loading state
        this.waveformLoading = true;
        if (loadingIndicator) {
            loadingIndicator.style.display = 'flex';
        }
        
        // Disable play button during loading
        if (this.playPauseBtn) {
            this.playPauseBtn.disabled = true;
            this.playPauseBtn.classList.add('disabled');
        }
        
        // Set canvas size
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        
        // Clear canvas
        ctx.fillStyle = '#161616';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Check if we have cached waveform data
        if (this.currentProject.waveformData) {
            this.drawWaveformFromCache(ctx, canvas.width, canvas.height);
            this.hideWaveformLoading();
            return;
        }
        
        // Get the first track with a file for waveform generation
        const trackWithFile = this.currentProject.tracks.find(t => t.file);
        if (!trackWithFile) {
            // No file available, draw placeholder
            this.drawPlaceholderWaveform(ctx, canvas.width, canvas.height);
            this.hideWaveformLoading();
            return;
        }
        
        // Generate waveform asynchronously
        try {
            const waveformData = await this.generateWaveformData(trackWithFile.file, canvas.width);
            
            // Cache the waveform data
            this.currentProject.waveformData = waveformData;
            
            // Redraw with actual data
            this.drawWaveformFromCache(ctx, canvas.width, canvas.height);
            
            // Save project with cached waveform
            await storage.updateProject(this.currentProject.id, { waveformData: waveformData });
            this.saveProjectEffects(); // Save effects with waveform
        } catch (error) {
            console.error('[APP] Error generating waveform:', error);
            this.drawPlaceholderWaveform(ctx, canvas.width, canvas.height);
        } finally {
            this.hideWaveformLoading();
        }
    }
    
    hideWaveformLoading() {
        this.waveformLoading = false;
        const loadingIndicator = document.getElementById('waveformLoading');
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
        
        // Enable play button after loading
        if (this.playPauseBtn) {
            this.playPauseBtn.disabled = false;
            this.playPauseBtn.classList.remove('disabled');
        }
        
        // Update effect positions after waveform is loaded
        this.updateEffectPositions();
    }
    
    async generateWaveformData(file, width) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioContext = new AudioContext();
        
        try {
            const arrayBuffer = await file.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            
            const channelData = audioBuffer.getChannelData(0); // Use first channel
            const samplesPerPixel = Math.floor(channelData.length / width);
            
            const peaks = [];
            
            for (let i = 0; i < width; i++) {
                const start = i * samplesPerPixel;
                const end = start + samplesPerPixel;
                
                let max = 0;
                for (let j = start; j < end && j < channelData.length; j++) {
                    const sample = Math.abs(channelData[j]);
                    if (sample > max) {
                        max = sample;
                    }
                }
                
                peaks.push(max);
            }
            
            audioContext.close();
            return peaks;
        } catch (error) {
            audioContext.close();
            throw error;
        }
    }
    
    drawWaveformFromCache(ctx, width, height) {
        if (!this.currentProject.waveformData) return;
        
        const peaks = this.currentProject.waveformData;
        const centerY = height / 2;
        const maxAmplitude = height / 2 - 5; // Leave some padding
        
        ctx.fillStyle = '#404040';
        
        for (let i = 0; i < peaks.length && i < width; i++) {
            const peak = peaks[i];
            const barHeight = peak * maxAmplitude;
            
            // Draw symmetric waveform (above and below center)
            ctx.fillRect(i, centerY - barHeight, 1, barHeight * 2);
        }
    }
    
    drawPlaceholderWaveform(ctx, width, height) {
        ctx.strokeStyle = '#404040';
        ctx.lineWidth = 1;
        ctx.beginPath();
        
        const centerY = height / 2;
        const amplitude = height / 3;
        
        for (let x = 0; x < width; x++) {
            const y = centerY + Math.sin(x * 0.05) * amplitude * Math.random();
            if (x === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        
        ctx.stroke();
    }
    
    // ========================================
    // EFFECTS MANAGEMENT
    // ========================================
    async showEffectPopover(clientX, clientY, timeInSeconds, clickX, canvasWidth) {
        // Check plan restriction - Home users cannot add effects
        const isStudio = await this.isStudioPlan();
        if (!isStudio) {
            this.showUpgradeModal('Efeitos no canvas');
            return;
        }

        // Store current click time
        this.currentClickTime = timeInSeconds;

        // Format time for display
        const formattedTime = this.formatTime(timeInSeconds);
        this.popoverTime.textContent = formattedTime;

        // Position popover near the click
        const popover = this.effectPopover;
        const timelineRect = document.getElementById('timelineWaveform').getBoundingClientRect();

        // Calculate position (ensure it stays within viewport)
        let leftPos = clientX - 100; // Center horizontally (popover is ~200px wide)
        let topPos = clientY - 150; // Position above the click

        // Adjust if too close to edges
        if (leftPos < 10) leftPos = 10;
        if (leftPos + 200 > window.innerWidth) leftPos = window.innerWidth - 210;
        if (topPos < 10) topPos = clientY + 20; // Show below if too close to top

        popover.style.left = `${leftPos}px`;
        popover.style.top = `${topPos}px`;
        popover.classList.add('active');

        // Store canvas data for effect positioning
        this.currentCanvasWidth = canvasWidth;
        this.currentClickX = clickX;
    }
    
    hideEffectPopover() {
        this.effectPopover.classList.remove('active');
        this.currentClickTime = null;
        this.effectFileInput.value = ''; // Reset file input
    }
    
    showClickIndicator(x) {
        const indicator = this.clickIndicator;
        indicator.style.left = `${x}px`;
        indicator.style.display = 'block';
    }
    
    hideClickIndicator() {
        this.clickIndicator.style.display = 'none';
    }
    
    async handleEffectFileUpload(file) {
        if (!file) return;
        
        try {
            console.log('[EFFECTS] Processing effect file:', file.name);
            
            // Create temporary URL for the file
            const audioUrl = URL.createObjectURL(file);
            
            // Load audio to get duration
            const audio = new Audio(audioUrl);
            
            await new Promise((resolve, reject) => {
                audio.addEventListener('loadedmetadata', () => {
                    console.log('[EFFECTS] Effect duration:', audio.duration);
                    resolve();
                });
                
                audio.addEventListener('error', (error) => {
                    console.error('[EFFECTS] Error loading audio:', error);
                    reject(new Error('Não foi possível carregar o arquivo de áudio'));
                });
            });
            
            // Calculate effect timing
            const startTime = this.currentClickTime;
            const duration = audio.duration;
            const endTime = startTime + duration;
            
            // Create effect object
            const effect = {
                id: 'effect-' + Date.now(),
                fileName: file.name,
                startTime: startTime,
                duration: duration,
                endTime: endTime,
                fileBlob: file,
                audioUrl: audioUrl
            };
            
            // Add to effects array
            this.effects.push(effect);
            
            // Render effect block on timeline
            this.renderEffectBlock(effect);
            
            // Hide popover and indicator
            this.hideEffectPopover();
            this.hideClickIndicator();
            
            console.log('[EFFECTS] Effect added successfully:', effect);
            
        } catch (error) {
            console.error('[EFFECTS] Error processing effect file:', error);
            alert('Erro ao processar arquivo de efeito: ' + error.message);
            this.hideEffectPopover();
            this.hideClickIndicator();
        }
    }
    
    renderEffectBlock(effect) {
        const block = document.createElement('div');
        block.className = 'effect-block';
        block.dataset.effectId = effect.id;
        
        // Calculate position and width based on timeline
        const canvasWidth = this.currentCanvasWidth || this.waveformCanvas.width;
        const totalDuration = this.totalDuration;
        
        const leftPercent = (effect.startTime / totalDuration) * 100;
        const widthPercent = (effect.duration / totalDuration) * 100;
        
        block.style.left = `${leftPercent}%`;
        block.style.width = `${widthPercent}%`;
        
        // Create block content
        block.innerHTML = `
            <div class="effect-block-content">
                ${effect.fileName}
            </div>
            <button class="effect-block-remove" title="Remover efeito">×</button>
        `;
        
        // Add remove functionality
        const removeBtn = block.querySelector('.effect-block-remove');
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeEffect(effect.id);
        });
        
        // Add click to play effect
        block.addEventListener('click', (e) => {
            if (!e.target.classList.contains('effect-block-remove')) {
                this.playEffect(effect);
            }
        });
        
        // Add to effects layer
        this.effectsLayer.appendChild(block);
    }
    
    removeEffect(effectId) {
        // Remove from array
        const index = this.effects.findIndex(e => e.id === effectId);
        if (index > -1) {
            const effect = this.effects[index];
            
            // Clean up audio URL
            if (effect.audioUrl) {
                URL.revokeObjectURL(effect.audioUrl);
            }
            
            this.effects.splice(index, 1);
        }
        
        // Remove from DOM
        const block = this.effectsLayer.querySelector(`[data-effect-id="${effectId}"]`);
        if (block) {
            block.remove();
        }
        
        console.log('[EFFECTS] Effect removed:', effectId);
    }
    
    playEffect(effect) {
        console.log('[EFFECTS] Playing effect:', effect.fileName);
        
        // Create audio element for playback
        const audio = new Audio(effect.audioUrl);
        
        // Play at the correct time if player is running
        if (this.audioPlayer && this.audioPlayer.isPlaying) {
            const currentTime = this.audioPlayer.getCurrentTime();
            const delay = (effect.startTime - currentTime) * 1000;
            
            if (delay > 0) {
                // Schedule to play at the right time
                setTimeout(() => {
                    if (this.audioPlayer.isPlaying) {
                        audio.play();
                    }
                }, delay);
            } else if (delay > -effect.duration * 1000) {
                // Effect should be playing now
                audio.currentTime = -delay / 1000;
                audio.play();
            }
        } else {
            // Just play immediately if player is stopped
            audio.play();
        }
        
        // Clean up after playback
        audio.addEventListener('ended', () => {
            URL.revokeObjectURL(effect.audioUrl);
        });
    }
    
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 100);
        return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    }
    
    clearAllEffects() {
        // Clean up all audio URLs
        this.effects.forEach(effect => {
            if (effect.audioUrl) {
                URL.revokeObjectURL(effect.audioUrl);
            }
        });
        
        // Clear array
        this.effects = [];
        
        // Clear DOM
        this.effectsLayer.innerHTML = '';
        
        console.log('[EFFECTS] All effects cleared');
    }
    
    loadProjectEffects(project) {
        // Load effects from project data if they exist
        if (project.effects && Array.isArray(project.effects)) {
            project.effects.forEach(effectData => {
                // Recreate audio URL from stored blob or data
                let audioUrl;
                if (effectData.fileBlob) {
                    audioUrl = URL.createObjectURL(effectData.fileBlob);
                } else if (effectData.audioData) {
                    // Handle base64 or other stored audio data
                    const blob = this.base64ToBlob(effectData.audioData);
                    audioUrl = URL.createObjectURL(blob);
                }
                
                const effect = {
                    id: effectData.id,
                    fileName: effectData.fileName,
                    startTime: effectData.startTime,
                    duration: effectData.duration,
                    endTime: effectData.endTime,
                    fileBlob: effectData.fileBlob,
                    audioUrl: audioUrl
                };
                
                this.effects.push(effect);
                this.renderEffectBlock(effect);
            });
            
            console.log('[EFFECTS] Loaded', project.effects.length, 'effects from project');
        }
    }
    
    saveProjectEffects() {
        // Save current effects to project
        if (this.currentProject) {
            const effectsData = this.effects.map(effect => ({
                id: effect.id,
                fileName: effect.fileName,
                startTime: effect.startTime,
                duration: effect.duration,
                endTime: effect.endTime,
                fileBlob: effect.fileBlob
                // Note: We don't save audioUrl as it's recreated from blob
            }));
            
            this.currentProject.effects = effectsData;
            
            // Save to storage
            storage.updateProject(this.currentProject.id, { effects: effectsData });
            
            console.log('[EFFECTS] Saved', effectsData.length, 'effects to project');
        }
    }
    
    base64ToBlob(base64Data) {
        // Helper to convert base64 audio data back to blob
        const parts = base64Data.split(',');
        const mimeType = parts[0].match(/:(.*?);/)[1];
        const decodedData = atob(parts[1]);
        const uint8Array = new Uint8Array(decodedData.length);
        
        for (let i = 0; i < decodedData.length; i++) {
            uint8Array[i] = decodedData.charCodeAt(i);
        }
        
        return new Blob([uint8Array], { type: mimeType });
    }
    
    updateEffectPositions() {
        // Update all effect block positions when timeline size changes
        const canvasWidth = this.waveformCanvas.width;
        const totalDuration = this.totalDuration;
        
        this.effects.forEach(effect => {
            const block = this.effectsLayer.querySelector(`[data-effect-id="${effect.id}"]`);
            if (block) {
                const leftPercent = (effect.startTime / totalDuration) * 100;
                const widthPercent = (effect.duration / totalDuration) * 100;
                
                block.style.left = `${leftPercent}%`;
                block.style.width = `${widthPercent}%`;
            }
        });
        
        console.log('[EFFECTS] Updated effect positions');
    }
    
    // ========================================
    // TIMELINE SCRUBBING
    // ========================================
    handleTimelineSeek(x, canvasWidth, clientX, clientY) {
        const percentage = x / canvasWidth;
        const seekTime = percentage * this.totalDuration;
        
        // Update playhead position
        this.updatePlayheadPosition(x, canvasWidth);
        
        // Seek audio player
        if (this.audioPlayer) {
            this.audioPlayer.seek(seekTime);
        }
        
        console.log('[TIMELINE] Seek to:', seekTime, 'seconds');
    }
    
    updatePlayheadPosition(x, canvasWidth) {
        // Update playhead visual position using pixels for drag
        this.playhead.style.left = `${x}px`;
        
        // Calculate and update time display
        const percentage = x / canvasWidth;
        const currentTime = percentage * this.totalDuration;
        this.currentTimeDisplay.textContent = this.formatTime(currentTime);
    }
    
    // Helper method to reset drag state (called when leaving player view)
    resetTimelineDragState() {
        this.isDragging = false;
        if (this.waveformCanvas) {
            this.waveformCanvas.style.cursor = 'crosshair';
        }
        if (this.playhead) {
            this.playhead.classList.remove('dragging');
        }
    }
    
    // Show message when seeking is disabled during playback
    showSeekingDisabledMessage() {
        // Show a temporary message on the waveform
        const message = document.createElement('div');
        message.className = 'seeking-disabled-message';
        message.textContent = 'Pause a música para mover o marcador';
        message.style.cssText = 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0, 0, 0, 0.8); color: white; padding: 8px 16px; border-radius: 4px; font-size: 0.85rem; z-index: 1000; pointer-events: none; animation: fadeInOut 2s ease forwards;';
        
        // Add animation keyframes if not exists
        if (!document.getElementById('seeking-message-style')) {
            const style = document.createElement('style');
            style.id = 'seeking-message-style';
            style.textContent = '@keyframes fadeInOut { 0% { opacity: 0; transform: translate(-50%, -50%) scale(0.9); } 20% { opacity: 1; transform: translate(-50%, -50%) scale(1); } 80% { opacity: 1; transform: translate(-50%, -50%) scale(1); } 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.9); } }';
            document.head.appendChild(style);
        }
        
        const timelineWaveform = document.getElementById('timelineWaveform');
        if (timelineWaveform) {
            timelineWaveform.appendChild(message);
            
            // Remove message after animation
            setTimeout(() => {
                message.remove();
            }, 2000);
        }
    }
    
    togglePlay() {
        if (!this.audioPlayer) return;
        
        // Prevent play if waveform is still loading
        if (this.waveformLoading) {
            console.log('[APP] Cannot play - waveform still loading');
            return;
        }
        
        // Use the player's actual state instead of app state for decision
        if (this.audioPlayer.isPlaying) {
            this.audioPlayer.pause();
            // Remove idle timer when pausing
            this.resetIdleTimer();
        } else {
            this.audioPlayer.play();
            // Remove idle wave effect immediately when playing
            this.deactivateIdleWave();
        }
        
        // Don't manually update isPlaying here - the onPlayStateChange callback
        // from the player will update it correctly via updatePlayButton()
    }
    
    updatePlayButton(state) {
        if (!this.playPauseBtn) return;
        
        const playIcon = this.playPauseBtn.querySelector('.play-icon');
        const pauseIcon = this.playPauseBtn.querySelector('.pause-icon');
        
        // Update timeline waveform visual state
        const timelineWaveform = document.getElementById('timelineWaveform');
        if (timelineWaveform) {
            if (state === 'playing') {
                timelineWaveform.classList.add('playing');
            } else {
                timelineWaveform.classList.remove('playing');
            }
        }
        
        if (state === 'playing') {
            this.playPauseBtn.classList.add('playing');
            this.isPlaying = true;
        } else {
            // Handle both 'paused' and 'stopped' states
            this.playPauseBtn.classList.remove('playing');
            this.isPlaying = false;
        }
    }
    
    updateTimeDisplay(time) {
        this.currentTime = time;
        this.currentTimeDisplay.textContent = this.formatTime(time);
        
        // Update playhead position
        if (this.totalDuration > 0) {
            const percentage = (time / this.totalDuration) * 100;
            this.playhead.style.left = `${percentage}%`;
        }
    }
    
    setTotalDuration(duration) {
        this.totalDuration = duration;
    }
    
    toggleTrackMute(trackId) {
        // Special handling for PAD track
        if (trackId === 'pad-track' && this.padTrackNodes) {
            if (this.currentProject) {
                const track = this.currentProject.tracks.find(t => t.id === trackId);
                if (track) {
                    track.mute = !track.mute;
                    // Apply mute by setting gain to 0
                    if (track.mute) {
                        this.padTrackNodes.gain.gain.value = 0;
                    } else {
                        this.padTrackNodes.gain.gain.value = track.volume;
                    }
                    
                    // Update UI
                    const channel = this.mixerTracks.querySelector(`[data-track-id="${trackId}"]`);
                    if (channel) {
                        const muteBtn = channel.querySelector('.mute-btn');
                        muteBtn.classList.toggle('active', track.mute);
                        if (track.mute) {
                            channel.classList.add('muted');
                        } else {
                            channel.classList.remove('muted');
                        }
                    }
                }
            }
            this.updateSoloMutedEffect();
            return;
        }
        
        if (!this.audioPlayer) return;
        
        const muted = this.audioPlayer.toggleTrackMute(trackId);
        
        // Update UI
        const channel = this.mixerTracks.querySelector(`[data-track-id="${trackId}"]`);
        if (channel) {
            const muteBtn = channel.querySelector('.mute-btn');
            muteBtn.classList.toggle('active', muted);
            
            // Apply muted class for digital mixer effect
            if (muted) {
                channel.classList.add('muted');
            } else {
                channel.classList.remove('muted');
            }
        }
        
        // Re-apply solo-muted effect in case mute state affects solo visibility
        this.updateSoloMutedEffect();
    }
    
    updateSoloMutedEffect() {
        if (!this.mixerTracks) return;
        
        // Check if any track has solo enabled (including PAD)
        const hasSoloTracks = this.currentProject?.tracks.some(t => t.solo) || 
                             (this.audioPlayer?.hasSoloTracks && this.audioPlayer.hasSoloTracks());
        
        this.mixerTracks.querySelectorAll('.track-channel').forEach(trackChannel => {
            const trackId = trackChannel.dataset.trackId;
            const track = this.currentProject?.tracks.find(t => t.id === trackId);
            
            if (track) {
                // For PAD, use project's solo state directly
                if (trackId === 'pad-track') {
                    if (hasSoloTracks && !track.solo) {
                        trackChannel.classList.add('solo-muted');
                        // Mute the PAD gain
                        if (this.padTrackNodes) {
                            this.padTrackNodes.gain.gain.value = 0;
                        }
                    } else {
                        trackChannel.classList.remove('solo-muted');
                        // Restore PAD gain if not muted
                        if (this.padTrackNodes && !track.mute) {
                            this.padTrackNodes.gain.gain.value = track.volume;
                        }
                    }
                } else {
                    // For normal tracks, check if should be solo-muted
                    // A track should be solo-muted if:
                    // 1. Any track has solo enabled (including PAD)
                    // 2. This specific track is NOT soloed
                    const shouldMute = hasSoloTracks && !track.solo;
                    
                    if (shouldMute) {
                        trackChannel.classList.add('solo-muted');
                    } else {
                        trackChannel.classList.remove('solo-muted');
                    }
                }
            }
        });
    }
    toggleTrackSolo(trackId) {
        // Special handling for PAD track
        if (trackId === 'pad-track' && this.padTrackNodes) {
            const track = this.currentProject?.tracks.find(t => t.id === trackId);
            if (track) {
                track.solo = !track.solo;
                
                // Update UI for PAD track only
                const channel = this.mixerTracks.querySelector(`[data-track-id="${trackId}"]`);
                if (channel) {
                    const soloBtn = channel.querySelector('.solo-btn');
                    soloBtn.classList.toggle('active', track.solo);
                }
                
                // Update solo-muted effect
                this.updateSoloMutedEffect();
                
                // Trigger player to update normal tracks with PAD solo state
                if (this.audioPlayer) {
                    const padHasSolo = track.solo;
                    // Apply mute/solo to all normal tracks considering PAD solo
                    this.audioPlayer.trackNodes.forEach((nodes, id) => {
                        if (id !== 'pad-track') {
                            this.audioPlayer.applyMuteSoloToTrack(id, padHasSolo);
                        }
                    });
                }
            }
            return;
        }
        
        if (!this.audioPlayer) return;
        
        // Check if PAD has solo when toggling normal track solo
        const padTrack = this.currentProject?.tracks.find(t => t.id === 'pad-track');
        const padHasSolo = padTrack ? padTrack.solo : false;
        
        const soloed = this.audioPlayer.toggleTrackSolo(trackId, padHasSolo);
        
        // Update UI
        const channel = this.mixerTracks.querySelector(`[data-track-id="${trackId}"]`);
        if (channel) {
            const soloBtn = channel.querySelector('.solo-btn');
            soloBtn.classList.toggle('active', soloed);
        }
        
        // Update all solo buttons for normal tracks only
        this.mixerTracks.querySelectorAll('.solo-btn').forEach(btn => {
            const channelId = btn.closest('.track-channel').dataset.trackId;
            if (channelId !== 'pad-track') {
                // For normal tracks, check the track's solo state
                const track = this.currentProject.tracks.find(t => t.id === channelId);
                if (track) {
                    btn.classList.toggle('active', track.solo);
                }
            }
        });
        
        // Apply digital mixer effect
        this.updateSoloMutedEffect();
    }
    
    formatPanLabel(pan) {
        if (pan === 0) return 'C';
        if (pan < 0) return `L${Math.round(Math.abs(pan) * 100)}`;
        return `R${Math.round(pan * 100)}`;
    }
    
    updateLedRing(trackId, panValue) {
        const ledPointer = trackId === 'master'
            ? document.getElementById('masterLedPointer')
            : document.querySelector(`.led-pointer[data-track-id="${trackId}"]`);
        
        if (!ledPointer) return;
        
        // Convert pan value (-1 to 1) to angle (-135deg to +135deg)
        const angle = panValue * 135;
        
        // Handle visibility (On/Off)
        if (panValue === 0) {
            ledPointer.style.opacity = '0';
            ledPointer.classList.remove('active');
        } else {
            ledPointer.style.opacity = '1';
            ledPointer.classList.add('active');
            // Update rotation directly
            ledPointer.style.transform = `rotate(${angle}deg)`;
            ledPointer.style.transformOrigin = '30px 30px';
        }
    }
    

    
    setupPanKnobInteraction(knob, trackId) {
        if (!knob) return;
        
        let isDragging = false;
        let startY = 0;
        let startPan = 0;
        
        const track = this.currentProject?.tracks.find(t => t.id === trackId);
        if (!track) return;
        
        const updatePan = (deltaY) => {
            // Convert vertical drag to pan value (-1 to +1)
            const sensitivity = 0.01;
            let newPan = startPan - (deltaY * sensitivity);
            newPan = Math.max(-1, Math.min(1, newPan));
            
            // Update audio player
            this.setTrackPan(trackId, newPan);
            
            // Update visual rotation
            const rotation = newPan * 135;
            knob.style.transform = `rotate(${rotation}deg)`;
            
            // Update LED arc
            this.updateLedRing(trackId, newPan);
            
            // Update knob text
            const panLabel = this.formatPanLabel(newPan);
            const knobText = knob.querySelector('.pan-knob-text');
            
            if (knobText) knobText.textContent = panLabel;
        };
        
        knob?.addEventListener('mousedown', (e) => {
            isDragging = true;
            startY = e.clientY;
            startPan = track.pan;
            knob.style.cursor = 'grabbing';
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const deltaY = e.clientY - startY;
            updatePan(deltaY);
        });
        
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                knob.style.cursor = 'pointer';
            }
        });
        
        // Double-click to reset to center
        knob?.addEventListener('dblclick', () => {
            this.setTrackPan(trackId, 0);
            knob.style.transform = 'rotate(0deg)';
            this.updateLedRing(trackId, 0);
            
            const knobText = knob.querySelector('.pan-knob-text');
            
            if (knobText) knobText.textContent = 'C';
        });
        
        // Double-tap support for mobile
        let lastTapTime = 0;
        knob?.addEventListener('touchend', (e) => {
            const currentTime = new Date().getTime();
            const tapLength = currentTime - lastTapTime;
            
            if (tapLength < 300 && tapLength > 0) {
                // Double-tap detected
                this.setTrackPan(trackId, 0);
                knob.style.transform = 'rotate(0deg)';
                this.updateLedRing(trackId, 0);
                
                const knobText = knob.querySelector('.pan-knob-text');
                
                if (knobText) knobText.textContent = 'C';
            }
            
            lastTapTime = currentTime;
        });
        
        // Scroll wheel support
        knob?.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            let newPan = track.pan + delta;
            newPan = Math.max(-1, Math.min(1, newPan));
            
            this.setTrackPan(trackId, newPan);
            const rotation = newPan * 135;
            knob.style.transform = `rotate(${rotation}deg)`;
            this.updateLedRing(trackId, newPan);
            
            const panLabel = this.formatPanLabel(newPan);
            const knobText = knob.querySelector('.pan-knob-text');
            
            if (knobText) knobText.textContent = panLabel;
        });
        
        // Touch support for vertical drag
        knob?.addEventListener('touchstart', (e) => {
            isDragging = true;
            startY = e.touches[0].clientY;
            startPan = track.pan;
            knob.style.cursor = 'grabbing';
            e.preventDefault();
        }, { passive: false });
        
        document.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            const deltaY = e.touches[0].clientY - startY;
            updatePan(deltaY);
        }, { passive: false });
        
        document.addEventListener('touchend', () => {
            if (isDragging) {
                isDragging = false;
                knob.style.cursor = 'pointer';
            }
        });
    }
    
    setTrackPan(trackId, pan) {
        if (!this.audioPlayer) return;
        
        this.audioPlayer.setTrackPan(trackId, pan);
        
        // Update UI
        const channel = this.mixerTracks.querySelector(`[data-track-id="${trackId}"]`);
        if (channel) {
            const panKnob = channel.querySelector('.pan-knob-x32');
            
            if (panKnob) {
                const rotation = pan * 135;
                panKnob.style.transform = `rotate(${rotation}deg)`;
            }
            
            // Update LED arc to show current pan value
            this.updateLedRing(trackId, pan);
        }
        
        // Update track pan in project data
        if (this.currentProject) {
            const track = this.currentProject.tracks.find(t => t.id === trackId);
            if (track) {
                track.pan = pan;
            }
        }
    }
    
    setMasterPan(pan) {
        if (!this.audioPlayer) return;
        
        this.audioPlayer.setMasterPan(pan);
        
        // Update UI
        const masterPanInput = document.getElementById('masterPanInput');
        if (masterPanInput) {
            masterPanInput.value = Math.round(pan * 100);
        }
    }
    
    setupPanKnobInteractionX32(knob, trackId) {
        if (!knob) return;

        let isDragging = false;
        let startX = 0;
        let startY = 0;
        let startPan = 0;
        let lastTapTime = 0;

        const track = this.currentProject?.tracks.find(t => t.id === trackId);
        if (!track) return;

        const updatePan = (deltaX, deltaY) => {
            // Convert drag to pan value (-1 to +1)
            // Up/Right increases pan (towards +1/right), Down/Left decreases pan (towards -1/left)
            const sensitivity = 0.01;
            let newPan = startPan - (deltaY * sensitivity) + (deltaX * sensitivity);
            newPan = Math.max(-1, Math.min(1, newPan));

            // Update audio player
            this.setTrackPan(trackId, newPan);

            // Update visual rotation
            const rotation = newPan * 135;
            knob.style.transform = `rotate(${rotation}deg)`;

            // Update LED arc (persistent - shows current pan value)
            this.updateLedRing(trackId, newPan);
        };

        knob?.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            startPan = track.pan;
            knob.style.cursor = 'grabbing';
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            updatePan(deltaX, deltaY);
        });
        
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                knob.style.cursor = 'pointer';
                // Update LED ring to show current pan value
                this.updateLedRing(trackId, this.audioPlayer.trackNodes.get(trackId)?.panner?.pan?.value || 0);
            }
        });

        // Double-click to reset to center
        knob?.addEventListener('dblclick', () => {
            this.setTrackPan(trackId, 0);
            knob.style.transform = 'rotate(0deg)';
            this.updateLedRing(trackId, 0);
        });

        // Double-tap support for mobile
        knob?.addEventListener('touchend', (e) => {
            const currentTime = new Date().getTime();
            const tapLength = currentTime - lastTapTime;
            
            if (tapLength < 300 && tapLength > 0) {
                // Double-tap detected
                this.setTrackPan(trackId, 0);
                knob.style.transform = 'rotate(0deg)';
                this.updateLedRing(trackId, 0);
            }

            lastTapTime = currentTime;
        });

        // Scroll wheel support
        knob?.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            let newPan = track.pan + delta;
            newPan = Math.max(-1, Math.min(1, newPan));
            
            this.setTrackPan(trackId, newPan);
            const rotation = newPan * 135;
            knob.style.transform = `rotate(${rotation}deg)`;
            this.updateLedRing(trackId, newPan);
        });

        // Touch support for drag (both vertical and horizontal)
        knob?.addEventListener('touchstart', (e) => {
            isDragging = true;
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            startPan = track.pan;
            knob.style.cursor = 'grabbing';
            e.preventDefault();
        }, { passive: false });
        
        document.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            const deltaX = e.touches[0].clientX - startX;
            const deltaY = e.touches[0].clientY - startY;
            updatePan(deltaX, deltaY);
        }, { passive: false });
        
        document.addEventListener('touchend', () => {
            if (isDragging) {
                isDragging = false;
                knob.style.cursor = 'pointer';
                // Update LED ring to show current pan value
                this.updateLedRing(trackId, this.audioPlayer.trackNodes.get(trackId)?.panner?.pan?.value || 0);
            }
        });
    }
    
    setupMasterPanKnobInteractionX32(knob) {
        if (!knob) return;

        let isDragging = false;
        let startX = 0;
        let startY = 0;
        let startPan = 0;
        let lastTapTime = 0;

        const updatePan = (deltaX, deltaY) => {
            const sensitivity = 0.01;
            let newPan = startPan - (deltaY * sensitivity) + (deltaX * sensitivity);
            newPan = Math.max(-1, Math.min(1, newPan));
            
            this.setMasterPan(newPan);
        };

        knob?.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            startPan = this.masterPan || 0;
            knob.style.cursor = 'grabbing';
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            updatePan(deltaX, deltaY);
        });
        
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                knob.style.cursor = 'pointer';
                // Update LED ring to show current pan value
                this.updateLedRing('master', this.masterPan || 0);
            }
        });
        
        // Double-click to reset
        knob?.addEventListener('dblclick', () => {
            this.setMasterPan(0);
        });
        
        // Double-tap support
        knob?.addEventListener('touchend', (e) => {
            const currentTime = new Date().getTime();
            const tapLength = currentTime - lastTapTime;
            
            if (tapLength < 300 && tapLength > 0) {
                this.setMasterPan(0);
            }
            
            lastTapTime = currentTime;
        });
        
        // Touch support
        knob?.addEventListener('touchstart', (e) => {
            isDragging = true;
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            startPan = this.masterPan || 0;
            knob.style.cursor = 'grabbing';
            e.preventDefault();
        }, { passive: false });
        
        document.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            const deltaX = e.touches[0].clientX - startX;
            const deltaY = e.touches[0].clientY - startY;
            updatePan(deltaX, deltaY);
        }, { passive: false });
        
        document.addEventListener('touchend', () => {
            if (isDragging) {
                isDragging = false;
                knob.style.cursor = 'pointer';
                // Update LED ring to show current pan value
                this.updateLedRing('master', this.masterPan || 0);
            }
        });
    }
    
    setupMasterPanKnob() {
        if (!this.masterPanKnob) return;
        
        let isDragging = false;
        let startY = 0;
        let startPan = 0;
        
        const updatePan = (deltaY) => {
            // Convert vertical drag to pan value (-1 to +1)
            const sensitivity = 0.01;
            let newPan = startPan - (deltaY * sensitivity);
            newPan = Math.max(-1, Math.min(1, newPan));
            
            // Update audio player
            if (this.audioPlayer) {
                this.audioPlayer.setMasterPan(newPan);
            }
            
            // Update master pan value
            this.masterPan = newPan;
            
            // Update visual rotation
            const rotation = newPan * 135;
            this.masterPanKnob.style.transform = `rotate(${rotation}deg)`;
            
            // Update LED ring immediately
            this.updateLedRing('master', newPan);
            
            // Update label
            if (this.masterPanLabel) {
                this.masterPanLabel.textContent = this.formatPanLabel(newPan);
            }
        };
        
        this.masterPanKnob?.addEventListener('mousedown', (e) => {
            isDragging = true;
            startY = e.clientY;
            startPan = this.masterPan;
            this.masterPanKnob.style.cursor = 'grabbing';
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const deltaY = e.clientY - startY;
            updatePan(deltaY);
        });
        
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                this.masterPanKnob.style.cursor = 'pointer';
                // Update LED ring to show current pan value
                this.updateLedRing('master', this.masterPan);
            }
        });
        
        // Double-click to reset to center
        this.masterPanKnob?.addEventListener('dblclick', () => {
            if (this.audioPlayer) {
                this.audioPlayer.setMasterPan(0);
            }
            this.masterPan = 0;
            this.masterPanKnob.style.transform = 'rotate(0deg)';
            this.updateLedRing('master', 0);
            if (this.masterPanLabel) {
                this.masterPanLabel.textContent = 'C';
            }
        });
        
        // Scroll wheel support
        this.masterPanKnob?.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            let newPan = this.masterPan + delta;
            newPan = Math.max(-1, Math.min(1, newPan));
            
            if (this.audioPlayer) {
                this.audioPlayer.setMasterPan(newPan);
            }
            this.masterPan = newPan;
            const rotation = newPan * 135;
            this.masterPanKnob.style.transform = `rotate(${rotation}deg)`;
            this.updateLedRing('master', newPan);
            if (this.masterPanLabel) {
                this.masterPanLabel.textContent = this.formatPanLabel(newPan);
            }
        });
    }
    
    setTrackVolume(trackId, gain) {
        // Special handling for PAD track
        if (trackId === 'pad-track' && this.padTrackNodes) {
            this.padTrackNodes.gain.gain.value = gain;
            if (this.currentProject) {
                const track = this.currentProject.tracks.find(t => t.id === trackId);
                if (track) {
                    track.volume = gain;
                }
            }
            // Update UI
            const channel = this.mixerTracks.querySelector(`[data-track-id="${trackId}"]`);
            if (channel) {
                const thumb = channel.querySelector('.fader-thumb');
                const faderFill = channel.querySelector('.fader-fill');
                const dbValue = channel.querySelector('.track-db-value');
                const volumeInput = channel.querySelector('.fader-input');

                const position = this.gainToPosition(gain);
                const volumePercent = Math.round(position * 100);
                const db = this.positionToDb(position);

                if (thumb) thumb.style.bottom = `${volumePercent}%`;
                if (faderFill) faderFill.style.height = `${volumePercent}%`;
                if (dbValue) dbValue.textContent = this.formatDbValue(db);
                if (volumeInput) volumeInput.value = volumePercent;
            }
            this.checkFadersModified();
            return;
        }
        
        if (!this.audioPlayer) return;

        this.audioPlayer.setTrackVolume(trackId, gain);

        // Update track volume in project data
        if (this.currentProject) {
            const track = this.currentProject.tracks.find(t => t.id === trackId);
            if (track) {
                track.volume = gain;
            }
        }

        // Update UI
        const channel = this.mixerTracks.querySelector(`[data-track-id="${trackId}"]`);
        if (channel) {
            const thumb = channel.querySelector('.fader-thumb');
            const faderFill = channel.querySelector('.fader-fill');
            const dbValue = channel.querySelector('.track-db-value');
            const volumeInput = channel.querySelector('.fader-input');

            // Convert gain to position for visual display
            const position = this.gainToPosition(gain);
            const volumePercent = Math.round(position * 100);
            const db = this.positionToDb(position);

            if (thumb) thumb.style.bottom = `${volumePercent}%`;
            if (faderFill) faderFill.style.height = `${volumePercent}%`;
            if (dbValue) dbValue.textContent = this.formatDbValue(db);
            if (volumeInput) volumeInput.value = volumePercent;
        }

        // Check if faders are modified to update indicator light
        this.checkFadersModified();
    }
    
    setTrackPan(trackId, pan) {
        // Special handling for PAD track
        if (trackId === 'pad-track' && this.padTrackNodes) {
            this.padTrackNodes.panner.pan.value = pan;
            if (this.currentProject) {
                const track = this.currentProject.tracks.find(t => t.id === trackId);
                if (track) {
                    track.pan = pan;
                }
            }
            this.updateLedRing(trackId, pan);
            this.checkPannedTracks();
            return;
        }
        
        if (!this.audioPlayer) return;

        this.audioPlayer.setTrackPan(trackId, pan);

        // Update track pan in project data
        if (this.currentProject) {
            const track = this.currentProject.tracks.find(t => t.id === trackId);
            if (track) {
                track.pan = pan;
            }
        }

        // Update LED ring to show current pan value
        this.updateLedRing(trackId, pan);

        // Check if any tracks are panned to update indicator
        this.checkPannedTracks();
    }
    
    resetNormalVolumes() {
        if (!this.currentProject || !this.audioPlayer) return;

        // Reset all track volumes to normal (0 dB / unity gain)
        const normalGain = 1.0; // Unity gain = 0 dB

        this.currentProject.tracks.forEach((track, index) => {
            // Update track volume in project data
            track.volume = normalGain;
            track.pan = track.pan || 0; // Preserve pan setting

            // Special handling for PAD track
            if (track.id === 'pad-track' && this.padTrackNodes) {
                this.padTrackNodes.gain.gain.value = normalGain;
                this.padTrackNodes.panner.pan.value = track.pan;
            } else {
                // Update audio player for normal tracks
                this.audioPlayer.setTrackVolume(track.id, normalGain);
                this.audioPlayer.setTrackPan(track.id, track.pan);
            }

            // Update UI immediately (no delay)
            this.setTrackVolume(track.id, normalGain);

            // Add animation class to fader
            const channel = this.mixerTracks.querySelector(`[data-track-id="${track.id}"]`);
            if (channel) {
                const fader = channel.querySelector('.track-fader');
                if (fader) {
                    fader.classList.add('animating');
                    setTimeout(() => fader.classList.remove('animating'), 400);
                }

                // Update pan input in UI
                const panInput = channel.querySelector('.track-pan-input');
                if (panInput) panInput.value = track.pan;
            }
        });

        // Turn off indicator light
        this.updateResetIndicator(false);

        console.log('[APP] All track volumes reset to normal immediately');
    }
    
    resetPanVolumes() {
        if (!this.currentProject || !this.audioPlayer) return;

        // Reset pan for tracks panned to left OR right (both sides)
        // Left: pan < -0.3, Right: pan > 0.3, Center: -0.3 <= pan <= 0.3
        const centerPan = 0; // Center position
        const panThreshold = 0.3;

        this.currentProject.tracks.forEach(track => {
            const currentPan = track.pan || 0;
            let shouldReset = false;

            // Reset if panned to either left or right (not center)
            if (Math.abs(currentPan) > panThreshold) {
                shouldReset = true;
            }

            if (shouldReset) {
                // Update track pan in project data
                track.pan = centerPan;

                // Special handling for PAD track
                if (track.id === 'pad-track' && this.padTrackNodes) {
                    this.padTrackNodes.panner.pan.value = centerPan;
                } else {
                    // Update audio player immediately
                    this.audioPlayer.setTrackPan(track.id, centerPan);
                }

                // Update LED ring immediately
                this.updateLedRing(track.id, centerPan);

                // Update UI immediately
                const channel = this.mixerTracks.querySelector(`[data-track-id="${track.id}"]`);
                if (channel) {
                    const panInput = channel.querySelector('.track-pan-input');
                    if (panInput) panInput.value = centerPan;

                    // Add animation class to fader
                    const fader = channel.querySelector('.track-fader');
                    if (fader) {
                        fader.classList.add('animating');
                        setTimeout(() => fader.classList.remove('animating'), 400);
                    }
                }
            }
        });

        // Turn off pan indicator light
        this.updatePanIndicator(false);

        console.log('[APP] Panned tracks reset to center immediately');
    }
    
    updateResetIndicator(show) {
        const indicator = document.querySelector('.reset-normal-btn .btn-indicator');
        if (indicator) {
            if (show) {
                indicator.classList.add('active');
            } else {
                indicator.classList.remove('active');
            }
        }
    }

    updatePanIndicator(show) {
        const indicator = document.querySelector('.reset-pan-btn .btn-indicator');
        if (indicator) {
            if (show) {
                indicator.classList.add('active');
            } else {
                indicator.classList.remove('active');
            }
        }
    }

    checkFadersModified() {
        if (!this.currentProject) return;

        const normalGain = 1.0; // Unity gain = 0dB
        const toleranceDb = 0.5; // 0.5dB tolerance

        const hasModifiedFaders = this.currentProject.tracks.some(track => {
            const trackDb = 20 * Math.log10(track.volume);
            return Math.abs(trackDb) > toleranceDb;
        });

        this.updateResetIndicator(hasModifiedFaders);
    }

    checkPannedTracks() {
        if (!this.currentProject) return;

        const panThreshold = 0.3;

        const hasPannedTracks = this.currentProject.tracks.some(track => {
            const currentPan = track.pan || 0;
            return Math.abs(currentPan) > panThreshold;
        });

        this.updatePanIndicator(hasPannedTracks);
    }
    
    toggleMasterMute() {
        if (!this.audioPlayer) return;
        
        const masterMuteBtn = document.getElementById('masterMute');
        masterMuteBtn.classList.toggle('active');
        
        // Toggle master mute logic (to be implemented in player)
        if (this.audioPlayer.masterGain) {
            const isMuted = masterMuteBtn.classList.contains('active');
            const masterPosition = document.getElementById('masterFader').value / 100;
            this.audioPlayer.masterGain.gain.value = isMuted ? 0 : this.dbToGain(this.positionToDb(masterPosition));
        }
    }
    
    toggleMasterSolo() {
        if (!this.audioPlayer) return;
        
        const masterSoloBtn = document.getElementById('masterSolo');
        this.masterSoloEnabled = !this.masterSoloEnabled;
        masterSoloBtn.classList.toggle('active', this.masterSoloEnabled);
        
        // Check if any track is in solo
        const hasSoloTracks = this.currentProject?.tracks.some(t => t.solo) || false;
        
        if (this.masterSoloEnabled) {
            if (!hasSoloTracks) {
                // No tracks in solo - show feedback and disable master solo
                alert('Nenhuma track está em solo. Ative o solo de pelo menos uma track primeiro.');
                this.masterSoloEnabled = false;
                masterSoloBtn.classList.remove('active');
                return;
            }
            // Master solo enabled - only soloed tracks should play
            // This is already handled by the existing solo logic in applyMuteSoloToTrack
            console.log('[APP] Master solo enabled - only soloed tracks will play');
        } else {
            // Master solo disabled - normal solo behavior
            console.log('[APP] Master solo disabled');
        }
        
        // Re-apply mute/solo to all tracks
        if (this.audioPlayer) {
            this.currentProject.tracks.forEach(track => {
                this.audioPlayer.applyMuteSoloToTrack(track.id);
            });
        }
    }
    
    toggleMetronome() {
        this.metronomeEnabled = !this.metronomeEnabled;

        if (this.audioPlayer) {
            this.audioPlayer.setMetronomeEnabled(this.metronomeEnabled);
        }

        // Update button state
        this.metronomeBtn.classList.toggle('active', this.metronomeEnabled);

        // If metronome solo is active, restore states before re-rendering mixer
        if (!this.metronomeEnabled && this.metronomeSolo) {
            console.log('[APP] Disabling metronome - restoring metronome solo states first');
            this.metronomeSolo = false;
            const soloBtn = document.querySelector('.metronome-solo-btn');
            if (soloBtn) soloBtn.classList.remove('active');

            if (this.currentProject && this.audioPlayer) {
                this.currentProject.tracks.forEach(track => {
                    // Restore previous mute state
                    if (track.wasMutedBeforeMetronomeSolo !== undefined) {
                        track.mute = track.wasMutedBeforeMetronomeSolo;
                        delete track.wasMutedBeforeMetronomeSolo;
                    }
                    this.audioPlayer.applyMuteSoloToTrack(track.id);
                });
                // Update fader visual effects before re-rendering
                this.updateSoloMutedEffect();
            }
        }

        // Re-render mixer to show/hide metronome channel
        this.renderMixer();

        // Update metronome level in visualization
        if (this.metronomeEnabled) {
            this.startMetronomeVisualization();
        }
    }
    
    setMetronomeVolume(gain) {
        this.metronomeVolume = gain;
        
        if (this.audioPlayer) {
            this.audioPlayer.setMetronomeVolume(gain);
        }
    }
    
    setMetronomePan(pan) {
        this.metronomePan = pan;
        
        if (this.audioPlayer) {
            this.audioPlayer.setMetronomePan(pan);
        }
    }
    
    toggleMetronomeMute() {
        this.metronomeMuted = !this.metronomeMuted;
        
        const muteBtn = document.querySelector('.metronome-mute-btn');
        muteBtn.classList.toggle('active', this.metronomeMuted);
        
        if (this.audioPlayer) {
            this.audioPlayer.setMetronomeVolume(this.metronomeMuted ? 0 : this.metronomeVolume);
        }
    }
    
    toggleMetronomeSolo() {
        this.metronomeSolo = !this.metronomeSolo;

        const soloBtn = document.querySelector('.metronome-solo-btn');
        soloBtn.classList.toggle('active', this.metronomeSolo);

        if (this.metronomeSolo) {
            // Metronome solo enabled - mute all tracks
            console.log('[APP] Metronome solo enabled - muting all tracks');
            if (this.currentProject && this.audioPlayer) {
                this.currentProject.tracks.forEach(track => {
                    // Temporarily mute all tracks
                    track.wasMutedBeforeMetronomeSolo = track.mute;
                    track.mute = true;
                    this.audioPlayer.applyMuteSoloToTrack(track.id);
                });
                // Update fader visual effects immediately
                this.updateSoloMutedEffect();
            }
        } else {
            // Metronome solo disabled - restore previous mute states
            console.log('[APP] Metronome solo disabled - restoring track mute states');
            if (this.currentProject && this.audioPlayer) {
                this.currentProject.tracks.forEach(track => {
                    // Restore previous mute state
                    if (track.wasMutedBeforeMetronomeSolo !== undefined) {
                        track.mute = track.wasMutedBeforeMetronomeSolo;
                        delete track.wasMutedBeforeMetronomeSolo;
                    }
                    this.audioPlayer.applyMuteSoloToTrack(track.id);
                });
                // Update fader visual effects immediately
                this.updateSoloMutedEffect();
            }
        }
    }
    
    startMetronomeVisualization() {
        if (!this.metronomeEnabled) return;
        
        const updateMetronomeLevel = () => {
            if (!this.metronomeEnabled) return;
            
            if (this.audioPlayer) {
                const level = this.audioPlayer.getMetronomeLevel();
                this.updateMetronomeLevelMeter(level);
            }
            
            requestAnimationFrame(updateMetronomeLevel);
        };
        
        requestAnimationFrame(updateMetronomeLevel);
    }
    
    updateTrackState(trackId, state) {
        // Handle track state updates from audio player
        console.log('Track state updated:', trackId, state);
    }
    
    updateTrackLevelMeter(trackId, level, peakLevel) {
        // Update the level meter indicator for a specific track using unique ID
        const levelBar = document.getElementById(`trackLevelBar_${trackId}`);
        if (levelBar) {
            // Apply logarithmic scaling for better dynamic range representation
            const scaledLevel = Math.pow(level, 0.5); // Square root for more sensitivity at low levels
            const heightPercent = Math.min(100, Math.round(scaledLevel * 100));
            levelBar.style.height = `${heightPercent}%`;
            
            // Add glow effect based on level intensity
            const glowIntensity = Math.min(1, level * 1.5);
            levelBar.style.boxShadow = `0 0 ${8 + glowIntensity * 8}px rgba(34, 197, 94, ${0.3 + glowIntensity * 0.4})`;
            
            // Change color based on level intensity
            if (heightPercent > 85) {
                // Red for clipping/peak levels
                levelBar.style.background = 'linear-gradient(to top, #ef4444, #dc2626)';
                levelBar.style.boxShadow = `0 0 ${12}px rgba(239, 68, 68, 0.8)`;
            } else if (heightPercent > 65) {
                // Yellow for high levels
                levelBar.style.background = 'linear-gradient(to top, #f59e0b, #d97706)';
                levelBar.style.boxShadow = `0 0 ${10}px rgba(245, 158, 11, 0.6)`;
            } else if (heightPercent > 40) {
                // Green for normal levels
                levelBar.style.background = 'linear-gradient(to top, #22c55e, #16a34a)';
                levelBar.style.boxShadow = `0 0 ${8}px rgba(34, 197, 94, 0.5)`;
            } else {
                // Subtle green for low levels
                levelBar.style.background = 'linear-gradient(to top, #4ade80, #22c55e)';
                levelBar.style.boxShadow = `0 0 ${6}px rgba(74, 222, 128, 0.3)`;
            }
        }
        
        // Update peak hold indicator
        const peakBar = document.getElementById(`trackPeakBar_${trackId}`);
        if (peakBar && peakLevel !== undefined) {
            const scaledPeak = Math.pow(peakLevel, 0.5);
            const peakPercent = Math.min(100, Math.round(scaledPeak * 100));
            peakBar.style.height = `${peakPercent}%`;
        }
    }
    
    updateMetronomeLevelMeter(level) {
        // Update metronome level meter
        const levelBar = document.getElementById('metronomeLevelBar');
        if (levelBar) {
            // Apply logarithmic scaling for better dynamic range representation
            const scaledLevel = Math.pow(level, 0.5);
            const heightPercent = Math.min(100, Math.round(scaledLevel * 100));
            levelBar.style.height = `${heightPercent}%`;
            
            // Add glow effect based on level intensity
            const glowIntensity = Math.min(1, level * 1.5);
            levelBar.style.boxShadow = `0 0 ${8 + glowIntensity * 8}px rgba(34, 197, 94, ${0.3 + glowIntensity * 0.4})`;
            
            // Change color based on level intensity
            if (heightPercent > 85) {
                levelBar.style.background = 'linear-gradient(to top, #ef4444, #dc2626)';
                levelBar.style.boxShadow = `0 0 ${12}px rgba(239, 68, 68, 0.8)`;
            } else if (heightPercent > 65) {
                levelBar.style.background = 'linear-gradient(to top, #f59e0b, #d97706)';
                levelBar.style.boxShadow = `0 0 ${10}px rgba(245, 158, 11, 0.6)`;
            } else if (heightPercent > 40) {
                levelBar.style.background = 'linear-gradient(to top, #22c55e, #16a34a)';
                levelBar.style.boxShadow = `0 0 ${8}px rgba(34, 197, 94, 0.5)`;
            } else {
                levelBar.style.background = 'linear-gradient(to top, #4ade80, #22c55e)';
                levelBar.style.boxShadow = `0 0 ${6}px rgba(74, 222, 128, 0.3)`;
            }
        }
    }
    
    handleSongEnded() {
        console.log('[APP] Song ended, handling auto-advance/repeat logic');
        
        // Get settings from localStorage
        const repeatMode = localStorage.getItem('repeatMode') === 'true';
        const autoAdvanceMode = localStorage.getItem('autoAdvanceMode') === 'true';
        const transitionMode = localStorage.getItem('transitionMode') === 'true';
        
        if (repeatMode) {
            // Repeat current song
            console.log('[APP] Repeat mode enabled, restarting current song');
            this.audioPlayer.seek(0);
            this.audioPlayer.play();
        } else if (autoAdvanceMode && this.playerSession.length > 1) {
            // Auto-advance to next song
            const currentIndex = this.playerSession.findIndex(p => p.id === this.currentProject.id);
            const nextIndex = currentIndex + 1;
            
            if (nextIndex < this.playerSession.length) {
                const nextProject = this.playerSession[nextIndex];
                console.log('[APP] Auto-advancing to next song:', nextProject.name);
                
                const playNext = async () => {
                    if (transitionMode && this.audioPlayer.masterGain) {
                        // Fade out current song
                        await this.fadeMasterVolume(0, 400);
                    }

                    this.currentProject = nextProject;
                    this.renderMusicSelector();
                    this.renderProjectInfo();
                    this.renderMixer();
                    await this.loadProjectAudio();

                    if (transitionMode && this.audioPlayer.masterGain) {
                        // Start with volume at 0, then fade in
                        this.audioPlayer.masterGain.gain.value = 0;
                        this.audioPlayer.play();
                        await this.fadeMasterVolume(1, 400);
                    } else {
                        this.audioPlayer.play();
                    }
                };
                
                playNext();
            } else {
                console.log('[APP] Reached end of playlist, stopping');
            }
        } else {
            console.log('[APP] No auto-advance or repeat, stopping playback');
        }
    }
    
    async fadeMasterVolume(targetGain, duration) {
        if (!this.audioPlayer || !this.audioPlayer.masterGain) return;
        
        const startGain = this.audioPlayer.masterGain.gain.value;
        const startTime = this.audioPlayer.audioContext.currentTime;
        const endTime = startTime + (duration / 1000);
        
        return new Promise(resolve => {
            const fadeInterval = setInterval(() => {
                const currentTime = this.audioPlayer.audioContext.currentTime;
                const progress = Math.min(1, (currentTime - startTime) / (duration / 1000));
                const currentGain = startGain + (targetGain - startGain) * progress;
                
                this.audioPlayer.masterGain.gain.value = currentGain;
                
                if (progress >= 1) {
                    clearInterval(fadeInterval);
                    resolve();
                }
            }, 16);
        });
    }
    
    updateMasterLevelMeter(level) {
        // Update master level meter
        const levelBar = document.getElementById('masterLevelBar');
        if (levelBar) {
            // Apply logarithmic scaling for better dynamic range representation
            const scaledLevel = Math.pow(level, 0.5);
            const heightPercent = Math.min(100, Math.round(scaledLevel * 100));
            levelBar.style.height = `${heightPercent}%`;
            
            // Add glow effect based on level intensity
            const glowIntensity = Math.min(1, level * 1.5);
            levelBar.style.boxShadow = `0 0 ${8 + glowIntensity * 8}px rgba(34, 197, 94, ${0.3 + glowIntensity * 0.4})`;
            
            // Change color based on level intensity
            if (heightPercent > 85) {
                levelBar.style.background = 'linear-gradient(to top, #ef4444, #dc2626)';
                levelBar.style.boxShadow = `0 0 ${12}px rgba(239, 68, 68, 0.8)`;
            } else if (heightPercent > 65) {
                levelBar.style.background = 'linear-gradient(to top, #f59e0b, #d97706)';
                levelBar.style.boxShadow = `0 0 ${10}px rgba(245, 158, 11, 0.6)`;
            } else if (heightPercent > 40) {
                levelBar.style.background = 'linear-gradient(to top, #22c55e, #16a34a)';
                levelBar.style.boxShadow = `0 0 ${8}px rgba(34, 197, 94, 0.5)`;
            } else {
                levelBar.style.background = 'linear-gradient(to top, #4ade80, #22c55e)';
                levelBar.style.boxShadow = `0 0 ${6}px rgba(74, 222, 128, 0.3)`;
            }
        }
    }
    
    async handleAddTrackToPlayer(files) {
        const audioFiles = Array.from(files).filter(file => 
            file.type.startsWith('audio/') || 
            file.name.match(/\.(wav|mp3|flac|ogg|aiff)$/i)
        );
        
        if (audioFiles.length === 0) {
            alert('Nenhum arquivo de áudio válido encontrado');
            return;
        }
        
        // Calculate total size of files to be imported
        const totalSize = audioFiles.reduce((sum, file) => sum + file.size, 0);
        
        // Check available space
        if (this.audioStorage) {
            try {
                const spaceCheck = await this.audioStorage.checkSpaceAvailable(totalSize);
                
                if (!spaceCheck.available) {
                    const error = `Espaço insuficiente no dispositivo para salvar este projeto.\n\n` +
                                  `Espaço necessário: ${this.audioStorage.formatBytes(totalSize)}\n` +
                                  `Espaço disponível: ${this.audioStorage.formatBytes(spaceCheck.freeSpace)}\n` +
                                  `Uso atual: ${this.audioStorage.formatBytes(spaceCheck.currentSize)}\n` +
                                  `Uso: ${spaceCheck.storageInfo.usagePercent.toFixed(1)}%`;
                    
                    alert(error);
                    console.error('[STORAGE] Space check failed:', error);
                    return;
                }
                
                console.log('[STORAGE] Space check passed for', audioFiles.length, 'files:', this.audioStorage.formatBytes(totalSize));
            } catch (error) {
                console.warn('[STORAGE] Could not check space availability, proceeding anyway:', error);
            }
        }
        
        audioFiles.forEach(file => {
            const trackData = {
                name: this.suggestTrackName(file.name),
                originalFileName: file.name,
                fileSize: file.size,
                file: file
            };
            
            this.currentProject.addTrack(trackData);
        });
        
        // Save project and re-render mixer
        storage.updateProject(this.currentProject.id, this.currentProject);
        this.renderMixer();
        this.loadProjectAudio();
    }
    
    // ========================================
    // ADD SONG TO SESSION
    // ========================================
    openAddSongToSessionModal() {
        this.addSongToSessionModal.classList.add('active');
        this.songSearchInput.value = '';
        this.renderSongList();
    }
    
    closeAddSongToSessionModal() {
        this.addSongToSessionModal.classList.remove('active');
    }
    
    renderSongList(searchQuery = '') {
        const allProjects = storage.getAllProjects();
        const query = searchQuery.toLowerCase();
        
        const filteredProjects = allProjects.filter(project => {
            const matchesSearch = !query || 
                project.name.toLowerCase().includes(query) ||
                (project.artist && project.artist.toLowerCase().includes(query));
            const notInSession = !this.playerSession.find(p => p.id === project.id);
            return matchesSearch && notInSession;
        });
        
        this.songList.innerHTML = '';
        
        if (filteredProjects.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'song-list-empty';
            emptyState.textContent = searchQuery 
                ? 'Nenhuma música encontrada' 
                : 'Todas as músicas já estão na sessão';
            emptyState.style.cssText = `
                padding: var(--spacing-xl);
                text-align: center;
                color: var(--color-white-muted);
                font-size: var(--font-size-sm);
            `;
            this.songList.appendChild(emptyState);
            return;
        }
        
        filteredProjects.forEach(project => {
            const item = document.createElement('div');
            item.className = 'song-list-item';
            
            const coverHtml = project.cover 
                ? `<img src="${project.cover}" alt="${project.name}">`
                : `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M9 18V5l12-2v13"></path>
                        <circle cx="6" cy="18" r="3"></circle>
                        <circle cx="18" cy="16" r="3"></circle>
                    </svg>
                `;
            
            const trackCount = project.getTrackCount();
            
            item.innerHTML = `
                <div class="song-list-item-cover">
                    ${coverHtml}
                </div>
                <div class="song-list-item-info">
                    <div class="song-list-item-name">${this.escapeHtml(project.name)}</div>
                    <div class="song-list-item-meta">
                        ${project.key ? `${project.key} • ` : ''}${trackCount} tracks
                    </div>
                </div>
                <div class="song-list-item-badge">+</div>
            `;
            
            item?.addEventListener('click', () => {
                this.addToSession(project.id);
            });
            
            this.songList.appendChild(item);
        });
    }
    
    addToSession(projectId) {
        const project = storage.getProject(projectId);
        if (project && !this.playerSession.find(p => p.id === projectId)) {
            this.playerSession.push(project);
            this.renderMusicSelector();
            this.closeAddSongToSessionModal();
        }
    }
    
    showCardMenu(project, button) {
        // Close any existing menus first
        document.querySelectorAll('.card-menu-dropdown').forEach(m => m.remove());

        // Simple context menu implementation
        const menu = document.createElement('div');
        menu.className = 'card-menu-dropdown';
        menu.style.cssText = `
            position: fixed;
            background: var(--color-black-card);
            border: 1px solid var(--border-medium);
            border-radius: var(--radius-md);
            padding: var(--spacing-xs);
            min-width: 160px;
            z-index: 1000;
            box-shadow: var(--shadow-lg);
        `;
        
        const items = [
            { label: 'Renomear', action: () => this.showRenameModal(project) },
            { label: 'Editar', action: () => this.showEditProjectModal(project) },
            { label: project.favorite ? 'Remover favorito' : 'Favoritar', action: () => this.toggleFavorite(project.id) },
            { label: 'Excluir', action: () => this.deleteProject(project.id), danger: true }
        ];
        
        items.forEach(item => {
            const btn = document.createElement('button');
            btn.className = 'card-menu-item';
            btn.style.cssText = `
                width: 100%;
                padding: var(--spacing-sm) var(--spacing-md);
                text-align: left;
                font-size: var(--font-size-sm);
                color: ${item.danger ? '#ff4444' : 'var(--color-white)'};
                border-radius: var(--radius-sm);
                transition: background var(--transition-fast);
            `;
            btn.textContent = item.label;
            btn?.addEventListener('click', () => {
                item.action();
                menu.remove();
            });
            btn?.addEventListener('mouseenter', () => {
                btn.style.background = 'var(--color-black-hover)';
            });
            menu.appendChild(btn);
        });
        
        const rect = button.getBoundingClientRect();
        menu.style.top = `${rect.bottom + 8}px`;
        menu.style.left = `${rect.left}px`;

        document.body.appendChild(menu);

        const closeMenu = (e) => {
            if (!menu.contains(e.target) && !button.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };

        setTimeout(() => {
            document.addEventListener('click', closeMenu);
        }, 10);
    }

    showRenameModal(project) {
        console.log('[APP] showRenameModal called for:', project.name);
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 2000;
        `;
        
        modal.innerHTML = `
            <div class="modal-content" style="
                background: var(--color-black-card);
                border: 1px solid var(--border-medium);
                border-radius: var(--radius-lg);
                padding: var(--spacing-xl);
                max-width: 400px;
                width: 90%;
            ">
                <h2 style="color: var(--color-white); margin-bottom: var(--spacing-md);">Renomear música</h2>
                <input type="text" id="renameInput" value="${this.escapeHtml(project.name)}" style="
                    width: 100%;
                    padding: var(--spacing-md);
                    background: var(--color-black);
                    border: 1px solid var(--border-medium);
                    border-radius: var(--radius-md);
                    color: var(--color-white);
                    font-size: var(--font-size-md);
                    margin-bottom: var(--spacing-lg);
                ">
                <div style="display: flex; gap: var(--spacing-md); justify-content: flex-end;">
                    <button id="cancelRename" style="
                        padding: var(--spacing-md) var(--spacing-xl);
                        background: transparent;
                        color: var(--color-white-muted);
                        border: 1px solid var(--border-medium);
                        border-radius: var(--radius-md);
                        cursor: pointer;
                    ">Cancelar</button>
                    <button id="confirmRename" style="
                        padding: var(--spacing-md) var(--spacing-xl);
                        background: var(--color-white);
                        color: var(--color-black);
                        border: none;
                        border-radius: var(--radius-md);
                        cursor: pointer;
                        font-weight: 600;
                    ">Salvar</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const input = modal.querySelector('#renameInput');
        const cancelBtn = modal.querySelector('#cancelRename');
        const confirmBtn = modal.querySelector('#confirmRename');
        
        input.focus();
        input.select();
        
        cancelBtn?.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        confirmBtn?.addEventListener('click', () => {
            const newName = input.value.trim();
            if (newName && newName !== project.name) {
                project.name = newName;
                storage.updateProject(project.id, project);
                this.renderLibrary(this.currentFilter);
            }
            document.body.removeChild(modal);
        });
        
        input?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                confirmBtn?.click();
            }
        });
        
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    showEditProjectModal(project) {
        console.log('[APP] showEditProjectModal called for:', project.name);
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            background: rgba(0, 0, 0, 0.9) !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            z-index: 999999 !important;
            visibility: visible !important;
            opacity: 1 !important;
        `;
        
        console.log('[APP] Modal element created');
        
        const coverHtml = project.cover 
            ? `
                <div style="position: relative; margin-bottom: var(--spacing-md);">
                    <img src="${project.cover}" alt="Capa" style="width: 100%; height: 200px; object-fit: cover; border-radius: var(--radius-md);">
                    <button id="removeCoverBtn" style="
                        position: absolute;
                        top: var(--spacing-sm);
                        right: var(--spacing-sm);
                        width: 32px;
                        height: 32px;
                        background: rgba(0, 0, 0, 0.7);
                        border: none;
                        border-radius: var(--radius-sm);
                        color: white;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    ">✕</button>
                </div>
            `
            : `<div style="width: 100%; height: 200px; background: var(--color-black); border: 2px dashed var(--border-medium); border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; color: var(--color-white-muted); margin-bottom: var(--spacing-md);">Sem capa</div>`;
        
        const tracksHtml = project.tracks.map(track => `
            <div style="
                padding: var(--spacing-sm);
                background: var(--color-black);
                border: 1px solid var(--border-medium);
                border-radius: var(--radius-sm);
                margin-bottom: var(--spacing-xs);
                display: flex;
                align-items: center;
                gap: var(--spacing-sm);
            ">
                <div style="width: 8px; height: 8px; background: var(--color-white); border-radius: 50%;"></div>
                <span style="color: var(--color-white); flex: 1;">${this.escapeHtml(track.name)}</span>
                <span style="color: var(--color-white-muted); font-size: var(--font-size-sm);">${this.formatBytes(track.fileSize || 0)}</span>
            </div>
        `).join('');
        
        modal.innerHTML = `
            <div class="modal-content" style="
                background: var(--color-black-card);
                border: 1px solid var(--border-medium);
                border-radius: var(--radius-lg);
                padding: var(--spacing-xl);
                max-width: 500px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
            ">
                <h2 style="color: var(--color-white); margin-bottom: var(--spacing-md);">Editar: ${this.escapeHtml(project.name)}</h2>
                
                <div style="margin-bottom: var(--spacing-lg);">
                    <label style="color: var(--color-white-muted); display: block; margin-bottom: var(--spacing-sm);">Capa</label>
                    ${coverHtml}
                    <input type="file" id="coverInput" accept="image/*" style="display: none;">
                    <button id="changeCoverBtn" style="
                        width: 100%;
                        padding: var(--spacing-md);
                        background: var(--color-black);
                        color: var(--color-white);
                        border: 1px solid var(--border-medium);
                        border-radius: var(--radius-md);
                        cursor: pointer;
                    ">Alterar capa</button>
                </div>
                
                <div style="margin-bottom: var(--spacing-lg);">
                    <label style="color: var(--color-white-muted); display: block; margin-bottom: var(--spacing-sm);">Tracks (${project.tracks.length})</label>
                    <div style="max-height: 200px; overflow-y: auto;">
                        ${tracksHtml}
                    </div>
                </div>
                
                <div style="display: flex; gap: var(--spacing-md); justify-content: flex-end;">
                    <button id="closeEdit" style="
                        padding: var(--spacing-md) var(--spacing-xl);
                        background: transparent;
                        color: var(--color-white-muted);
                        border: 1px solid var(--border-medium);
                        border-radius: var(--radius-md);
                        cursor: pointer;
                    ">Fechar</button>
                </div>
            </div>
        `;
        
        console.log('[APP] Adding modal to body');
        document.body.appendChild(modal);
        console.log('[APP] Modal added to body');
        
        const closeBtn = modal.querySelector('#closeEdit');
        const changeCoverBtn = modal.querySelector('#changeCoverBtn');
        const coverInput = modal.querySelector('#coverInput');
        const removeCoverBtn = modal.querySelector('#removeCoverBtn');
        
        console.log('[APP] Elements found:', { closeBtn: !!closeBtn, changeCoverBtn: !!changeCoverBtn, coverInput: !!coverInput, removeCoverBtn: !!removeCoverBtn });
        
        closeBtn?.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        changeCoverBtn?.addEventListener('click', () => {
            coverInput.click();
        });
        
        if (removeCoverBtn) {
            removeCoverBtn?.addEventListener('click', () => {
                project.cover = null;
                storage.updateProject(project.id, project);
                this.renderLibrary(this.currentFilter);
                document.body.removeChild(modal);
            });
        }
        
        coverInput?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    project.cover = event.target.result;
                    storage.updateProject(project.id, project);
                    this.renderLibrary(this.currentFilter);
                    document.body.removeChild(modal);
                };
                reader.readAsDataURL(file);
            }
        });
        
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }
    
    toggleFavorite(projectId) {
        storage.toggleFavorite(projectId);
        this.renderLibrary(this.currentFilter);
    }
    
    duplicateProject(projectId) {
        storage.duplicateProject(projectId);
        this.renderLibrary(this.currentFilter);
    }
    
    exportProject(projectId) {
        const json = storage.exportProject(projectId);
        if (json) {
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `multracks_project_${projectId}.json`;
            a.click();
            URL.revokeObjectURL(url);
        }
    }
    
    async deleteProject(projectId) {
        if (confirm('Tem certeza que deseja excluir este projeto?')) {
            await storage.deleteProject(projectId);
            this.renderLibrary(this.currentFilter);
        }
    }
    
    // ========================================
    // ADD MUSIC WIZARD
    // ========================================
    initAddMusicWizard() {
        this.modal = document.getElementById('addMusicModal');
        this.modalClose = document.getElementById('modalClose');
        this.wizardBack = document.getElementById('wizardBack');
        this.wizardNext = document.getElementById('wizardNext');
        this.wizardCreate = document.getElementById('wizardCreate');
        this.dropZone = document.getElementById('dropZone');
        this.fileInput = document.getElementById('fileInput');
        this.selectedFilesContainer = document.getElementById('selectedFiles');
        this.projectName = document.getElementById('projectName');
        this.projectKey = document.getElementById('projectKey');
        this.tracksList = document.getElementById('tracksList');
        this.addTrackBtn = document.getElementById('addTrackBtn');
        
        this.wizardSteps = document.querySelectorAll('.wizard-step');
        this.importOptions = document.querySelectorAll('.import-option');
    }
    
    initSettingsModal() {
        this.settingsModal = document.getElementById('settingsModal');
        this.settingsModalClose = document.getElementById('settingsModalClose');
        this.repeatMode = document.getElementById('repeatMode');
        this.autoAdvanceMode = document.getElementById('autoAdvanceMode');
        this.transitionMode = document.getElementById('transitionMode');

        // Profile edit fields
        this.saveProfileBtn = document.getElementById('saveProfileBtn');
        this.settingsDisplayName = document.getElementById('settingsDisplayName');

        // Profile photo upload elements
        this.profilePhotoUploadArea = document.getElementById('profilePhotoUploadArea');
        this.profilePhotoInput = document.getElementById('profilePhotoInput');
        this.profilePhotoPlaceholder = document.getElementById('profilePhotoPlaceholder');
        this.profilePhotoPreview = document.getElementById('profilePhotoPreview');
        this.profilePhotoPreviewImg = document.getElementById('profilePhotoPreviewImg');
        this.removeProfilePhotoBtn = document.getElementById('removeProfilePhotoBtn');

        // Profile photo file
        this.selectedProfilePhoto = null;

        // Initialize profile photo upload
        this.initProfilePhotoUpload();

        // Add event listeners to save settings when changed
        this.repeatMode?.addEventListener('change', (e) => {
            localStorage.setItem('repeatMode', e.target.checked);
        });

        this.autoAdvanceMode?.addEventListener('change', (e) => {
            localStorage.setItem('autoAdvanceMode', e.target.checked);
        });

        this.transitionMode?.addEventListener('change', (e) => {
            localStorage.setItem('transitionMode', e.target.checked);
        });

        // Upgrade modal event listeners
        const upgradeModalClose = document.getElementById('upgradeModalClose');
        const upgradeCancelBtn = document.getElementById('upgradeCancelBtn');
        const upgradeBtn = document.getElementById('upgradeBtn');

        upgradeModalClose?.addEventListener('click', () => this.hideUpgradeModal());
        upgradeCancelBtn?.addEventListener('click', () => this.hideUpgradeModal());
        upgradeBtn?.addEventListener('click', () => this.navigateToPlans());

        // Close upgrade modal when clicking outside
        const upgradeModal = document.getElementById('upgradeModal');
        upgradeModal?.addEventListener('click', (e) => {
            if (e.target === upgradeModal) {
                this.hideUpgradeModal();
            }
        });

        // Save profile button
        this.saveProfileBtn?.addEventListener('click', () => this.saveUserProfile());
    }

    initProfilePhotoUpload() {
        // Use the avatar button as upload trigger
        this.settingsProfileAvatarBtn = document.getElementById('settingsProfileAvatarBtn');

        if (!this.settingsProfileAvatarBtn || !this.profilePhotoInput) return;

        // Click avatar to upload
        this.settingsProfileAvatarBtn.addEventListener('click', () => {
            this.profilePhotoInput.click();
        });

        // File selection
        this.profilePhotoInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                this.handleProfilePhotoFile(e.target.files[0]);
            }
        });

        // Drag and drop on avatar
        this.settingsProfileAvatarBtn.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.settingsProfileAvatarBtn.classList.add('dragover');
        });

        this.settingsProfileAvatarBtn.addEventListener('dragleave', (e) => {
            e.preventDefault();
            this.settingsProfileAvatarBtn.classList.remove('dragover');
        });

        this.settingsProfileAvatarBtn.addEventListener('drop', (e) => {
            e.preventDefault();
            this.settingsProfileAvatarBtn.classList.remove('dragover');

            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                this.handleProfilePhotoFile(e.dataTransfer.files[0]);
            }
        });
    }

    handleProfilePhotoFile(file) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Por favor, selecione uma imagem.');
            return;
        }

        // Validate file size (5MB max)
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            alert('A imagem deve ter no máximo 5MB.');
            return;
        }

        this.selectedProfilePhoto = file;

        // Show preview on avatar
        const reader = new FileReader();
        reader.onload = (e) => {
            const settingsUserInitial = document.getElementById('settingsUserInitial');
            if (settingsUserInitial) {
                settingsUserInitial.style.backgroundImage = `url(${e.target.result})`;
                settingsUserInitial.style.backgroundSize = 'cover';
                settingsUserInitial.style.backgroundPosition = 'center';
                settingsUserInitial.textContent = '';
            }
        };
        reader.readAsDataURL(file);
    }

    removeProfilePhoto() {
        this.selectedProfilePhoto = null;
        this.profilePhotoInput.value = '';

        // Reset avatar to show initial
        const settingsUserInitial = document.getElementById('settingsUserInitial');
        if (settingsUserInitial) {
            settingsUserInitial.style.backgroundImage = 'none';
            // Will be updated by populateSettingsModal
        }
    }

    async uploadProfilePhotoToCloudinary(file) {
        const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/dkfe21jnc/image/upload';
        const UPLOAD_PRESET = 'vizu_upload';

        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', UPLOAD_PRESET);

        try {
            const response = await fetch(CLOUDINARY_URL, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.secure_url) {
                return data.secure_url;
            } else {
                throw new Error('Upload failed');
            }
        } catch (error) {
            console.error('[PROFILE] Error uploading photo to Cloudinary:', error);
            throw error;
        }
    }
    
    async saveUserProfile() {
        const currentUser = window.firebaseAuth && window.firebaseAuth.auth && window.firebaseAuth.auth.currentUser;

        if (!currentUser) {
            alert('Você precisa estar logado para salvar seu perfil.');
            return;
        }

        if (!window.firebaseDB) {
            alert('Firebase não está disponível.');
            return;
        }

        try {
            let displayName = this.settingsDisplayName?.value || currentUser.displayName;
            // Fallback to email only if displayName is still null/undefined (not empty string)
            if (!displayName || displayName.trim() === '') {
                displayName = currentUser.email.split('@')[0];
            }

            // Upload profile photo if selected
            let profilePhotoUrl = null;
            if (this.selectedProfilePhoto) {
                try {
                    profilePhotoUrl = await this.uploadProfilePhotoToCloudinary(this.selectedProfilePhoto);
                    console.log('[PROFILE] Photo uploaded:', profilePhotoUrl);
                } catch (error) {
                    alert('Erro ao fazer upload da foto: ' + error.message);
                    return;
                }
            }

            const profileData = {
                displayName: displayName,
                email: currentUser.email,
                updatedAt: window.firebaseDB.serverTimestamp()
            };

            // Add profile photo if uploaded
            if (profilePhotoUrl) {
                profileData.profilePhoto = profilePhotoUrl;
            }

            // Update Firebase Auth displayName
            try {
                if (currentUser.updateProfile) {
                    await currentUser.updateProfile({
                        displayName: displayName
                    });
                    console.log('[PROFILE] Firebase Auth displayName updated:', displayName);
                }
            } catch (error) {
                console.warn('[PROFILE] Could not update Firebase Auth displayName:', error);
            }

            const userDocRef = window.firebaseDB.doc(window.firebaseDB.db, 'users', currentUser.uid);

            // Check if user document exists
            const docSnap = await window.firebaseDB.getDoc(userDocRef);

            if (docSnap.exists()) {
                // Update existing document, preserving plano field
                const existingData = docSnap.data();
                if (existingData.plano) {
                    profileData.plano = existingData.plano;
                } else {
                    profileData.plano = 'home'; // Set default plan if missing
                }
                await window.firebaseDB.updateDoc(userDocRef, profileData);
                console.log('[PROFILE] Profile updated:', currentUser.uid);
            } else {
                // Create new document with default plan
                profileData.createdAt = window.firebaseDB.serverTimestamp();
                profileData.plano = 'home';
                await window.firebaseDB.setDoc(userDocRef, profileData);
                console.log('[PROFILE] Profile created:', currentUser.uid);
            }

            // Also update creator profile if exists
            try {
                const creatorDocRef = window.firebaseDB.doc(window.firebaseDB.db, 'creators', currentUser.uid);
                const creatorDocSnap = await window.firebaseDB.getDoc(creatorDocRef);

                if (creatorDocSnap.exists()) {
                    const creatorData = {
                        displayName: displayName,
                        email: currentUser.email
                    };

                    if (profilePhotoUrl) {
                        creatorData.profilePhoto = profilePhotoUrl;
                    }

                    await window.firebaseDB.updateDoc(creatorDocRef, creatorData);
                    console.log('[PROFILE] Creator profile updated:', currentUser.uid);
                }
            } catch (error) {
                console.warn('[PROFILE] Could not update creator profile:', error);
            }

            // Clear profile photo selection
            this.removeProfilePhoto();

            // Update UI
            await this.populateSettingsModal();
            await this.updateProfileButtonForLoggedIn(currentUser);

            alert('Perfil salvo com sucesso!');
        } catch (error) {
            console.error('[PROFILE] Error saving profile:', error);
            alert('Erro ao salvar perfil: ' + error.message);
        }
    }
    
    async loadUserProfileData() {
        const currentUser = window.firebaseAuth && window.firebaseAuth.auth && window.firebaseAuth.auth.currentUser;

        if (!currentUser || !window.firebaseDB) return;

        try {
            const userDocRef = window.firebaseDB.doc(window.firebaseDB.db, 'users', currentUser.uid);
            const docSnap = await window.firebaseDB.getDoc(userDocRef);

            if (docSnap.exists()) {
                const data = docSnap.data();

                // Populate form fields with Firestore data as priority
                if (this.settingsDisplayName) {
                    let displayName = data.displayName || currentUser.displayName;
                    // Fallback to email only if displayName is still null/undefined (not empty string)
                    if (!displayName || displayName.trim() === '') {
                        displayName = currentUser.email.split('@')[0];
                    }
                    this.settingsDisplayName.value = displayName;
                }

                console.log('[PROFILE] Profile data loaded:', currentUser.uid);
            } else {
                // If no profile data exists, use current user data
                if (this.settingsDisplayName) {
                    let displayName = currentUser.displayName;
                    // Fallback to email only if displayName is still null/undefined (not empty string)
                    if (!displayName || displayName.trim() === '') {
                        displayName = currentUser.email.split('@')[0];
                    }
                    this.settingsDisplayName.value = displayName;
                }
            }
        } catch (error) {
            console.error('[PROFILE] Error loading profile data:', error);
        }
    }
    
    openModal() {
        console.log('[DEBUG] openModal called');
        console.log('[DEBUG] selectedFiles BEFORE reset:', this.selectedFiles.length);
        console.log('[DEBUG] currentWizardStep BEFORE reset:', this.currentWizardStep);
        this.modal.classList.add('active');
        this.resetWizard();
    }
    
    closeModal() {
        this.modal.classList.remove('active');
        this.resetWizard();
    }
    
    openSettingsModal() {
        this.settingsModal.classList.add('active');
        this.populateSettingsModal();
        this.removeProfilePhoto(); // Reset photo upload state
    }

    async populateSettingsModal() {
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
            try {
                const user = JSON.parse(storedUser);

                // Try to get displayName from Firestore first
                let displayName = user.displayName;
                let email = user.email;
                let profilePhoto = null;

                try {
                    if (window.firebaseDB && user.uid) {
                        const { db, doc, getDoc, collection, query, where, getDocs } = window.firebaseDB;
                        // First try to get by UID (new method)
                        const userDoc = await getDoc(doc(db, 'users', user.uid));
                        if (userDoc.exists()) {
                            const userData = userDoc.data();
                            displayName = userData.displayName || displayName;
                            profilePhoto = userData.profilePhoto || null;
                            user.plano = userData.plano || 'home'; // Get plan from Firestore
                        } else {
                            // Fallback: try to find by uid field (old method with auto-generated IDs)
                            const q = query(collection(db, 'users'), where('uid', '==', user.uid));
                            const querySnapshot = await getDocs(q);
                            if (!querySnapshot.empty) {
                                const userData = querySnapshot.docs[0].data();
                                displayName = userData.displayName || displayName;
                                profilePhoto = userData.profilePhoto || null;
                                user.plano = userData.plano || 'home';
                            }
                        }
                    }
                } catch (error) {
                    console.warn('[SETTINGS] Could not fetch user data from Firestore:', error);
                }

                // Fallback to email only if displayName is still null/undefined (not empty string)
                if (!displayName || displayName.trim() === '') {
                    displayName = email.split('@')[0];
                }
                const initial = displayName.charAt(0).toUpperCase();

                const settingsUserInitial = document.getElementById('settingsUserInitial');
                const settingsProfileName = document.getElementById('settingsProfileName');
                const settingsProfileEmail = document.getElementById('settingsProfileEmail');
                const settingsAccountType = document.getElementById('settingsAccountType');
                const settingsAccountPlan = document.getElementById('settingsAccountPlan');

                if (settingsUserInitial) {
                    if (profilePhoto) {
                        // Show profile photo instead of initial
                        settingsUserInitial.style.backgroundImage = `url(${profilePhoto})`;
                        settingsUserInitial.style.backgroundSize = 'cover';
                        settingsUserInitial.style.backgroundPosition = 'center';
                        settingsUserInitial.textContent = '';
                    } else {
                        // Show initial
                        settingsUserInitial.style.backgroundImage = 'none';
                        settingsUserInitial.textContent = initial;
                    }
                }

                if (settingsProfileName) {
                    settingsProfileName.textContent = displayName;
                }

                if (settingsProfileEmail) {
                    settingsProfileEmail.textContent = email;
                }

                if (settingsAccountType) {
                    settingsAccountType.textContent = user.accountType || 'Usuário';
                }

                if (settingsAccountPlan) {
                    const plan = user.plano || 'home';
                    settingsAccountPlan.textContent = plan.toUpperCase();
                    settingsAccountPlan.className = 'account-plan-value ' + plan;
                }
            } catch (e) {
                console.warn('[SETTINGS] Could not parse stored user:', e);
            }
        }

        // Load app settings from localStorage
        this.repeatMode.checked = localStorage.getItem('repeatMode') === 'true';
        this.autoAdvanceMode.checked = localStorage.getItem('autoAdvanceMode') === 'true';
        this.transitionMode.checked = localStorage.getItem('transitionMode') === 'true';

        // Load storage info
        this.updateStorageInfo();
    }
    
    async updateStorageInfo() {
        try {
            const storageUsed = document.getElementById('storageUsed');
            const storageProgressFill = document.getElementById('storageProgressFill');
            
            if (storageUsed && storageProgressFill) {
                // Check if backend API is available
                let backendAvailable = false;
                try {
                    await apiClient.healthCheck();
                    backendAvailable = true;
                } catch (error) {
                    console.log('[SETTINGS] Backend not available, using local storage info');
                }

                if (backendAvailable) {
                    // TODO: Implement backend endpoint for user storage info
                    // For now, show 0 since backend storage tracking needs implementation
                    storageUsed.textContent = '0 MB';
                    storageProgressFill.style.width = '0%';
                } else {
                    // Fallback to local IndexedDB storage
                    const totalSize = await this.audioStorage.getTotalSize();
                    const formattedSize = this.audioStorage.formatBytes(totalSize);
                    storageUsed.textContent = formattedSize;
                    
                    // Calculate percentage (assuming 10GB limit)
                    const totalLimit = 10 * 1024 * 1024 * 1024; // 10GB in bytes
                    const percentage = Math.min(100, (totalSize / totalLimit) * 100);
                    storageProgressFill.style.width = `${percentage}%`;
                }
            }
        } catch (error) {
            console.error('[SETTINGS] Error loading storage info:', error);
            // Show 0 on error
            const storageUsed = document.getElementById('storageUsed');
            const storageProgressFill = document.getElementById('storageProgressFill');
            if (storageUsed && storageProgressFill) {
                storageUsed.textContent = '0 MB';
                storageProgressFill.style.width = '0%';
            }
        }
    }
    
    closeSettingsModal() {
        this.settingsModal.classList.remove('active');
    }

    clearLocalStorage() {
        if (confirm('Tem certeza que deseja limpar o armazenamento local? Isso removerá todos os dados salvos no navegador, mas não afetará seus dados no servidor.')) {
            try {
                // Clear all audio files from IndexedDB
                this.audioStorage.clearAllAudioFiles().then(() => {
                    console.log('[SETTINGS] Local storage cleared');
                    alert('Armazenamento local limpo com sucesso!');
                    this.updateStorageInfo(); // Refresh storage display
                }).catch(error => {
                    console.error('[SETTINGS] Error clearing local storage:', error);
                    alert('Erro ao limpar armazenamento local: ' + error.message);
                });
            } catch (error) {
                console.error('[SETTINGS] Error clearing local storage:', error);
                alert('Erro ao limpar armazenamento local: ' + error.message);
            }
        }
    }

    clearAllIndexedDB() {
        if (confirm('⚠️ ATENÇÃO: Isso limpará TODO o IndexedDB, incluindo dados de todos os usuários e arquivos antigos. Esta ação não pode ser desfeita. Continuar?')) {
            try {
                // Delete entire IndexedDB database
                const deleteRequest = indexedDB.deleteDatabase('wtracksAudio');
                
                deleteRequest.onsuccess = () => {
                    console.log('[SETTINGS] Entire IndexedDB database deleted');
                    alert('IndexedDB completamente limpo! A página será recarregada.');
                    location.reload();
                };
                
                deleteRequest.onerror = () => {
                    console.error('[SETTINGS] Error deleting IndexedDB:', deleteRequest.error);
                    alert('Erro ao limpar IndexedDB: ' + deleteRequest.error);
                };
                
                deleteRequest.onblocked = () => {
                    console.warn('[SETTINGS] IndexedDB delete blocked - please close other tabs');
                    alert('A operação foi bloqueada. Feche outras abas do navegador e tente novamente.');
                };
            } catch (error) {
                console.error('[SETTINGS] Error clearing IndexedDB:', error);
                alert('Erro ao limpar IndexedDB: ' + error.message);
            }
        }
    }
    
    resetWizard() {
        console.log('[DEBUG] resetWizard called');
        console.log('[DEBUG] selectedFiles BEFORE reset:', this.selectedFiles.length);
        console.log('[DEBUG] currentWizardStep BEFORE reset:', this.currentWizardStep);
        console.log('[DEBUG] Active wizard steps BEFORE reset:', Array.from(this.wizardSteps).map(s => s.classList.contains('active')));
        
        this.currentWizardStep = 1;
        this.selectedFiles = [];
        this.importMethod = null;
        this.projectName.value = '';
        this.projectKey.value = '';
        
        // Manually reset wizard steps
        this.wizardSteps.forEach(s => s.classList.remove('active'));
        this.wizardSteps[0].classList.add('active');
        
        this.updateWizardUI();
        
        console.log('[DEBUG] selectedFiles AFTER reset:', this.selectedFiles.length);
        console.log('[DEBUG] currentWizardStep AFTER reset:', this.currentWizardStep);
        console.log('[DEBUG] Active wizard steps AFTER reset:', Array.from(this.wizardSteps).map(s => s.classList.contains('active')));
    }
    
    goToWizardStep(step) {
        console.log('[DEBUG] goToWizardStep called with step:', step);
        console.log('[DEBUG] Current step before change:', this.currentWizardStep);
        
        if (step < 1 || step > this.totalWizardSteps) return;
        
        this.wizardSteps.forEach(s => s.classList.remove('active'));
        this.wizardSteps[step - 1].classList.add('active');
        
        this.currentWizardStep = step;
        this.updateWizardUI();
        
        console.log('[DEBUG] Current step after change:', this.currentWizardStep);
        
        if (step === 4) {
            this.renderTracksList();
        }
    }
    
    updateWizardUI() {
        this.wizardBack.disabled = this.currentWizardStep === 1;
        
        if (this.currentWizardStep === this.totalWizardSteps) {
            this.wizardNext.style.display = 'none';
            this.wizardCreate.style.display = 'inline-block';
            this.wizardCreate.disabled = !this.validateStep(this.currentWizardStep);
        } else {
            this.wizardNext.style.display = 'inline-block';
            this.wizardCreate.style.display = 'none';
            this.wizardNext.disabled = !this.validateStep(this.currentWizardStep);
        }
    }
    
    validateStep(step) {
        switch (step) {
            case 1:
                return this.importMethod !== null;
            case 2:
                return this.selectedFiles.length > 0;
            case 3:
                return this.projectName.value.trim() !== '';
            case 4:
                return this.selectedFiles.length > 0;
            default:
                return false;
        }
    }
    
    handleImportMethod(method) {
        this.importMethod = method;
        
        if (method === 'drive') {
            // Handle Google Drive import
            console.log('[APP] Google Drive import requested');
            if (typeof abrirGoogleDrive === 'function') {
                abrirGoogleDrive();
            } else {
                console.error('[APP] Google Drive function not available');
                alert('Integração com Google Drive não disponível. Verifique se os scripts foram carregados.');
            }
            return;
        }
        
        if (method === 'folder') {
            this.fileInput.setAttribute('webkitdirectory', '');
            this.fileInput.setAttribute('directory', '');
        } else {
            this.fileInput.removeAttribute('webkitdirectory');
            this.fileInput.removeAttribute('directory');
        }
        
        this.fileInput.click();
    }
    
    async handleFileSelect(files) {
        console.log('[DEBUG] handleFileSelect called');
        console.log('[DEBUG] selectedFiles BEFORE adding:', this.selectedFiles.length);
        console.log('[DEBUG] wasInStep4:', this.wasInStep4);
        
        console.log('[IMPORT] Files selected:', files);
        console.log('[IMPORT] Number of files:', files.length);
        
        const audioFiles = Array.from(files).filter(file => 
            file.type.startsWith('audio/') || 
            file.name.match(/\.(wav|mp3|flac|ogg|aiff)$/i)
        );
        
        console.log('[IMPORT] Audio files filtered:', audioFiles.length);
        
        if (audioFiles.length === 0) {
            alert('Nenhum arquivo de áudio válido encontrado');
            return;
        }
        
        // Calculate total size of files to be imported
        const totalSize = audioFiles.reduce((sum, file) => sum + file.size, 0);
        
        // Check available space
        if (this.audioStorage) {
            try {
                const spaceCheck = await this.audioStorage.checkSpaceAvailable(totalSize);
                
                if (!spaceCheck.available) {
                    const error = `Espaço insuficiente no dispositivo para salvar este projeto.\n\n` +
                                  `Espaço necessário: ${this.audioStorage.formatBytes(totalSize)}\n` +
                                  `Espaço disponível: ${this.audioStorage.formatBytes(spaceCheck.freeSpace)}\n` +
                                  `Uso atual: ${this.audioStorage.formatBytes(spaceCheck.currentSize)}\n` +
                                  `Uso: ${spaceCheck.storageInfo.usagePercent.toFixed(1)}%`;
                    
                    alert(error);
                    console.error('[STORAGE] Space check failed:', error);
                    return;
                }
                
                console.log('[STORAGE] Space check passed for', audioFiles.length, 'files:', this.audioStorage.formatBytes(totalSize));
            } catch (error) {
                console.warn('[STORAGE] Could not check space availability, proceeding anyway:', error);
            }
        }
        
        audioFiles.forEach(file => {
            console.log('[IMPORT] File:', {
                name: file.name,
                size: file.size,
                type: file.type,
                lastModified: file.lastModified
            });
            
            if (!this.selectedFiles.find(f => f.name === file.name)) {
                const suggestedName = this.suggestTrackName(file.name);
                console.log('[IMPORT] Suggested track name:', suggestedName);
                
                this.selectedFiles.push({
                    file: file,
                    name: suggestedName
                });
                
                console.log('[IMPORT] Created track item:', {
                    name: suggestedName,
                    file: file,
                    hasFile: !!file
                });
            }
        });
        
        this.renderSelectedFiles();
        this.updateWizardUI();
        
        // If we were in step 4 and added more tracks, re-render the tracks list
        if (this.wasInStep4) {
            this.renderTracksList();
            this.wasInStep4 = false;
        }
    }
    
    suggestTrackName(fileName) {
        // Remove extension and common suffixes
        let name = fileName.replace(/\.[^/.]+$/, '');
        
        // Remove common prefixes/suffixes
        name = name.replace(/^(lead |main |backing |rhythm )/i, '');
        name = name.replace(/(\s+(take|ver|version|mix|stem|track)\s*\d*)$/i, '');
        
        // Capitalize first letter
        name = name.charAt(0).toUpperCase() + name.slice(1);
        
        return name || fileName;
    }
    
    renderSelectedFiles() {
        this.selectedFilesContainer.innerHTML = '';
        
        this.selectedFiles.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'selected-file';
            div.innerHTML = `
                <span class="selected-file-name">${this.escapeHtml(item.file.name)}</span>
                <button class="selected-file-remove" data-index="${index}" aria-label="Remover">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            `;
            
            const removeBtn = div.querySelector('.selected-file-remove');
            removeBtn?.addEventListener('click', () => {
                this.selectedFiles.splice(index, 1);
                this.renderSelectedFiles();
                this.updateWizardUI();
            });
            
            this.selectedFilesContainer.appendChild(div);
        });
    }
    
    renderTracksList() {
        console.log('[DEBUG] renderTracksList called');
        console.log('[DEBUG] selectedFiles length:', this.selectedFiles.length);
        console.log('[DEBUG] selectedFiles:', this.selectedFiles);
        
        this.tracksList.innerHTML = '';
        
        this.selectedFiles.forEach((item, index) => {
            const trackDiv = document.createElement('div');
            trackDiv.className = 'track-item';
            trackDiv.draggable = true;
            trackDiv.dataset.index = index;
            
            trackDiv.innerHTML = `
                <div class="track-item-drag">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="9" cy="12" r="1"></circle>
                        <circle cx="9" cy="5" r="1"></circle>
                        <circle cx="9" cy="19" r="1"></circle>
                        <circle cx="15" cy="12" r="1"></circle>
                        <circle cx="15" cy="5" r="1"></circle>
                        <circle cx="15" cy="19" r="1"></circle>
                    </svg>
                </div>
                <div class="track-item-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9 18V5l12-2v13"></path>
                        <circle cx="6" cy="18" r="3"></circle>
                    </svg>
                </div>
                <input type="text" class="track-item-input" value="${this.escapeHtml(item.name)}" data-index="${index}">
                <button class="track-item-remove" data-index="${index}" aria-label="Remover">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            `;
            
            const input = trackDiv.querySelector('.track-item-input');
            input?.addEventListener('input', (e) => {
                this.selectedFiles[index].name = e.target.value;
            });
            
            const removeBtn = trackDiv.querySelector('.track-item-remove');
            removeBtn?.addEventListener('click', () => {
                this.selectedFiles.splice(index, 1);
                this.renderTracksList();
                this.updateWizardUI();
            });
            
            // Drag and drop for reordering
            trackDiv?.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', index);
                trackDiv.classList.add('dragging');
            });
            
            trackDiv?.addEventListener('dragend', () => {
                trackDiv.classList.remove('dragging');
            });
            
            trackDiv?.addEventListener('dragover', (e) => {
                e.preventDefault();
                const dragging = this.tracksList.querySelector('.dragging');
                if (dragging !== trackDiv) {
                    const rect = trackDiv.getBoundingClientRect();
                    const midY = rect.top + rect.height / 2;
                    if (e.clientY < midY) {
                        this.tracksList.insertBefore(dragging, trackDiv);
                    } else {
                        this.tracksList.insertBefore(dragging, trackDiv.nextSibling);
                    }
                }
            });
            
            trackDiv?.addEventListener('drop', (e) => {
                e.preventDefault();
                this.updateTracksOrder();
            });
            
            this.tracksList.appendChild(trackDiv);
        });
    }
    
    updateTracksOrder() {
        const newOrder = [];
        const items = this.tracksList.querySelectorAll('.track-item');
        items.forEach(item => {
            const index = parseInt(item.dataset.index);
            newOrder.push(this.selectedFiles[index]);
        });
        this.selectedFiles = newOrder;
        this.renderTracksList();
    }
    
    async createProject() {
        // Guard against duplicate clicks
        if (this.isCreatingProject) {
            console.log('[IMPORT] Project creation already in progress, ignoring duplicate click');
            return;
        }

        this.isCreatingProject = true;
        
        // Store original button text and state
        const originalButtonText = this.wizardCreate.textContent;
        const originalDisabled = this.wizardCreate.disabled;
        
        // Generate temporary ID for loading card
        const tempId = 'loading-' + Date.now();
        const projectName = this.projectName.value.trim();
        
        try {
            console.log('[IMPORT] Creating project with', this.selectedFiles.length, 'tracks');
            
            const tracks = this.selectedFiles.map(item => {
                console.log('[IMPORT] Creating track from item:', {
                    name: item.name,
                    file: item.file,
                    hasFile: !!item.file,
                    fileName: item.file ? item.file.name : 'NO FILE'
                });
                
                return {
                    name: item.name,
                    originalFileName: item.file.name,
                    fileSize: item.file.size,
                    file: item.file
                };
            });
            
            console.log('[IMPORT] Tracks array created:', tracks.length);
            console.log('[IMPORT] Tracks before storage.createProject:', tracks);
            
            // Disable button and show initial loading state
            this.wizardCreate.disabled = true;
            this.wizardCreate.textContent = `Criando... 0 de ${tracks.length} tracks`;
            
            // Create progress callback
            const onProgress = (saved, total) => {
                this.wizardCreate.textContent = `Criando... ${saved} de ${total} tracks`;
                // Update loading card progress
                this.updateLoadingCardProgress(tempId, saved, total);
            };
            
            // Add loading card to library immediately
            this.addLoadingCardToLibrary(tempId, projectName, tracks.length);
            
            // Close modal to show the loading card
            this.closeModal();
            
            const project = await storage.createProject({
                name: projectName,
                key: this.projectKey.value,
                tracks: tracks
            }, onProgress);
            
            console.log('[IMPORT] Project created:', project.name);
            console.log('[IMPORT] Project tracks after creation:', project.tracks.length);
            console.log('[IMPORT] First track in project:', project.tracks[0]);
            
            // createProject already saves, no need to save again
            console.log('[IMPORT] Project saved to storage');
            
            // Remove loading card and render complete library
            this.removeLoadingCard(tempId);
            this.renderLibrary();
            
        } catch (error) {
            console.error('[IMPORT] Error creating project:', error);
            alert('Erro ao criar projeto: ' + error.message);
            // Remove loading card on error
            this.removeLoadingCard(tempId);
            this.renderLibrary();
        } finally {
            // Always re-enable button and reset state
            this.isCreatingProject = false;
            this.wizardCreate.disabled = originalDisabled;
            this.wizardCreate.textContent = originalButtonText;
        }
    }

    addLoadingCardToLibrary(tempId, projectName, trackCount) {
        const card = document.createElement('div');
        card.className = 'music-card loading-card';
        card.dataset.tempId = tempId;
        
        card.innerHTML = `
            <div class="music-card-cover">
                <div class="music-card-cover-placeholder loading-placeholder">
                    <div class="loading-spinner-small"></div>
                </div>
            </div>
            <div class="music-card-content">
                <h3 class="music-card-title">${this.escapeHtml(projectName)}</h3>
                <div class="music-card-meta">
                    <div class="music-card-meta-row">
                        <span class="music-card-tracks">${trackCount} track${trackCount !== 1 ? 's' : ''}</span>
                        <span class="music-card-date">Carregando...</span>
                    </div>
                    <div class="loading-progress-text" id="progress-${tempId}">
                        Preparando upload...
                    </div>
                </div>
            </div>
        `;
        
        // Ensure musicGrid exists
        if (!this.musicGrid) {
            this.musicGrid = document.getElementById('musicGrid');
        }
        
        // Add card to beginning of grid
        if (this.musicGrid.firstChild) {
            this.musicGrid.insertBefore(card, this.musicGrid.firstChild);
        } else {
            this.musicGrid.appendChild(card);
        }
        
        // Show empty state as hidden since we have a loading card
        const emptyState = document.getElementById('emptyState');
        if (emptyState) {
            emptyState.style.display = 'none';
        }
        
        // Show music grid
        this.musicGrid.style.display = 'grid';
    }

    updateLoadingCardProgress(tempId, saved, total) {
        const progressText = document.getElementById(`progress-${tempId}`);
        if (progressText) {
            const percentage = Math.round((saved / total) * 100);
            progressText.textContent = `Processando: ${saved}/${total} tracks (${percentage}%)`;
        }
    }

    removeLoadingCard(tempId) {
        const loadingCard = document.querySelector(`[data-temp-id="${tempId}"]`);
        if (loadingCard) {
            loadingCard.remove();
        }
        
        // Check if library is now empty and show empty state if needed
        const currentCards = this.musicGrid.querySelectorAll('.music-card:not(.loading-card)');
        if (currentCards.length === 0) {
            const emptyState = document.getElementById('emptyState');
            if (emptyState) {
                emptyState.style.display = 'block';
                this.musicGrid.style.display = 'none';
            }
        }
    }
    
    // ========================================
    // EVENT LISTENERS
    // ========================================
    initEventListeners() {
        // Navigation links
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', async (e) => {
                e.preventDefault();
                const view = link.dataset.view;
                if (view) {
                    await this.switchView(view);
                }
            });
        });

        // Scroll indicator click
        const scrollIndicator = document.querySelector('.scroll-indicator');
        if (scrollIndicator) {
            scrollIndicator.addEventListener('click', () => {
                const library = document.getElementById('libraryView');
                if (library) {
                    library.scrollIntoView({ behavior: 'smooth' });
                }
            });
        }

        // Filter buttons
        const filterBtns = document.querySelectorAll('.filter-btn');
        filterBtns.forEach(btn => {
            btn?.addEventListener('click', () => {
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentFilter = btn.dataset.filter;
                this.renderLibrary(this.currentFilter);
            });
        });

        // Create Playlist Modal events
        document.getElementById('playlistModalClose')?.addEventListener('click', () => {
            this.closeCreatePlaylistModal();
        });
        
        document.getElementById('playlistModalCancel')?.addEventListener('click', () => {
            this.closeCreatePlaylistModal();
        });
        
        document.getElementById('playlistModalSave')?.addEventListener('click', () => {
            this.savePlaylist();
        });
        
        // Playlist cover upload
        document.getElementById('playlistCoverUpload')?.addEventListener('click', () => {
            document.getElementById('playlistCoverInput').click();
        });
        
        document.getElementById('playlistCoverInput')?.addEventListener('change', (e) => {
            this.handlePlaylistCoverUpload(e);
        });
        
        document.getElementById('coverRemoveBtn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removePlaylistCover();
        });
        
        // Playlist song search
        document.getElementById('playlistSongSearch')?.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            this.renderPlaylistSongSelection(searchTerm);
        });
        

        


        this.settingsModalClose?.addEventListener('click', () => {
            this.closeSettingsModal();
        });

        // Search functionality (library header)
        const searchBtn = document.getElementById('searchBtn');
        const searchInput = document.getElementById('searchInput');

        searchBtn?.addEventListener('click', () => {
            searchInput.classList.toggle('active');
            if (searchInput.classList.contains('active')) {
                searchInput.focus();
            } else {
                searchInput.value = '';
                this.renderLibrary(this.currentFilter);
            }
        });

        searchInput?.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            this.searchLibrary(searchTerm);
        });

        searchInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                searchInput.classList.remove('active');
                searchInput.value = '';
                this.renderLibrary(this.currentFilter);
            }
        });

        // Close search when clicking outside (library)
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-container') && searchInput?.classList.contains('active')) {
                searchInput.classList.remove('active');
                searchInput.value = '';
                this.renderLibrary(this.currentFilter);
            }
        });

        // Search functionality (player header) - REMOVED
        // const playerSearchBtn = document.getElementById('playerSearchBtn');
        // const playerSearchInput = document.getElementById('playerSearchInput');

        // playerSearchBtn?.addEventListener('click', () => {
        //     playerSearchInput.classList.toggle('active');
        //     if (playerSearchInput.classList.contains('active')) {
        //         playerSearchInput.focus();
        //     } else {
        //         playerSearchInput.value = '';
        //         this.renderLibrary(this.currentFilter);
        //     }
        // });

        // playerSearchInput?.addEventListener('input', (e) => {
        //     const searchTerm = e.target.value.toLowerCase().trim();
        //     this.searchLibrary(searchTerm);
        // });

        // playerSearchInput?.addEventListener('keydown', (e) => {
        //     if (e.key === 'Escape') {
        //         playerSearchInput.classList.remove('active');
        //         playerSearchInput.value = '';
        //         this.renderLibrary(this.currentFilter);
        //     }
        // });

        // Close search when clicking outside (player)
        // document.addEventListener('click', (e) => {
        //     if (!e.target.closest('.search-container') && playerSearchInput?.classList.contains('active')) {
        //         playerSearchInput.classList.remove('active');
        //         playerSearchInput.value = '';
        //         this.renderLibrary(this.currentFilter);
        //     }
        // });

        // Account type selection in registration
        const registerType = document.getElementById('registerType');
        const otherTypeGroup = document.getElementById('otherTypeGroup');

        registerType?.addEventListener('change', (e) => {
            if (e.target.value === 'outro') {
                otherTypeGroup.style.display = 'flex';
                document.getElementById('registerOtherType').required = true;
            } else {
                otherTypeGroup.style.display = 'none';
                document.getElementById('registerOtherType').required = false;
                document.getElementById('registerOtherType').value = '';
            }
        });

        // Social login (Google)
        const googleBtn = document.querySelector('.auth-social-btn.google-btn');
        googleBtn?.addEventListener('click', () => {
            alert('Login com Google será implementado em breve!');
        });

        // Forgot password
        const forgotPassword = document.querySelector('.auth-link');
        forgotPassword?.addEventListener('click', (e) => {
            e.preventDefault();
            alert('Recuperação de senha será implementada em breve!');
        });

        // Profile dropdown (library header)
        const profileBtn = document.getElementById('profileBtn');
        const profileDropdown = document.getElementById('profileDropdown');
        const logoutBtn = document.getElementById('logoutBtn');
        const settingsBtn = document.getElementById('settingsBtn');

        profileBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // Check Firebase Auth state instead of localStorage
            const isUserLoggedIn = window.firebaseAuth && window.firebaseAuth.auth && window.firebaseAuth.auth.currentUser;

            if (isUserLoggedIn) {
                // User is logged in - show dropdown
                profileDropdown.classList.toggle('active');
            } else {
                // User is logged out - open auth modal
                this.openAuthModal();
            }
        });

        // Close dropdown when clicking outside (library)
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.profile-container')) {
                profileDropdown?.classList.remove('active');
            }
        });

        // Profile dropdown (player header) - REMOVED
        // const playerProfileBtn = document.getElementById('playerProfileBtn');
        // const playerProfileDropdown = document.getElementById('playerProfileDropdown');
        // const playerLogoutBtn = document.getElementById('playerLogoutBtn');
        // const playerSettingsBtn = document.getElementById('playerSettingsBtn');

        // playerProfileBtn?.addEventListener('click', (e) => {
        //     e.stopPropagation();
        //     const currentUser = localStorage.getItem('currentUser');

        //     if (currentUser) {
        //         // User is logged in - show dropdown
        //         playerProfileDropdown.classList.toggle('active');
        //     } else {
        //         // User is logged out - open auth modal
        //         this.openAuthModal();
        //     }
        // });

        // Close dropdown when clicking outside (player)
        // document.addEventListener('click', (e) => {
        //     if (!e.target.closest('.profile-container')) {
        //         playerProfileDropdown?.classList.remove('active');
        //     }
        // });

        // Settings button (header)
        settingsBtn?.addEventListener('click', () => {
            profileDropdown.classList.remove('active');
            this.openSettingsModal();
        });
        
        // Settings button (player)
        const playerSettingsBtn = document.getElementById('playerSettingsBtn');
        playerSettingsBtn?.addEventListener('click', () => {
            this.openSettingsModal();
        });

        // Clear storage button
        const clearStorageBtn = document.getElementById('clearStorageBtn');
        clearStorageBtn?.addEventListener('click', () => {
            this.clearLocalStorage();
        });

        // Clear all IndexedDB button
        const clearAllIndexedDBBtn = document.getElementById('clearAllIndexedDBBtn');
        clearAllIndexedDBBtn?.addEventListener('click', () => {
            this.clearAllIndexedDB();
        });

        // Logout button (library)
        logoutBtn?.addEventListener('click', () => {
            profileDropdown?.classList.remove('active');
            this.handleLogout();
        });

        // My Tracks button
        const myTracksBtn = document.getElementById('myTracksBtn');
        myTracksBtn?.addEventListener('click', async () => {
            profileDropdown?.classList.remove('active');
            // Check plan restriction
            const isStudio = await this.isStudioPlan();
            if (!isStudio) {
                this.showUpgradeModal('Minhas Tracks');
                return;
            }
            this.switchToMyTracks();
        });

        // Logout button (player) - REMOVED
        // playerLogoutBtn?.addEventListener('click', () => {
        //     playerProfileDropdown?.classList.remove('active');
        //     this.handleLogout();
        // });
        
        // FAB add button
        const fabAdd = document.getElementById('fabAdd');
        const emptyAddBtn = document.getElementById('emptyAddBtn');

        const checkAuthBeforeOpenModal = async () => {
            // Check Firebase Auth state instead of localStorage
            const isUserLoggedIn = window.firebaseAuth && window.firebaseAuth.auth && window.firebaseAuth.auth.currentUser;

            if (!isUserLoggedIn) {
                // Show guest warning modal instead of auth modal
                this.openGuestWarningModal();
                return;
            }

            // Home users can add music - no plan restriction
            this.openModal();
        };

        fabAdd?.addEventListener('click', () => checkAuthBeforeOpenModal());
        emptyAddBtn?.addEventListener('click', () => checkAuthBeforeOpenModal());
        
        // Modal
        this.modalClose?.addEventListener('click', () => this.closeModal());
        this.modal?.addEventListener('click', (e) => {
            if (e.target === this.modal) this.closeModal();
        });
        
        // Import options
        this.importOptions.forEach(option => {
            option.addEventListener('click', () => {
                const method = option.dataset.method;
                this.handleImportMethod(method);
            });
        });
        
        // File input
        this.fileInput?.addEventListener('change', (e) => {
            this.handleFileSelect(e.target.files);
        });
        
        // Drop zone
        this.dropZone?.addEventListener('click', () => this.fileInput.click());
        
        this.dropZone?.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dropZone.classList.add('dragover');
        });
        
        this.dropZone?.addEventListener('dragleave', () => {
            this.dropZone.classList.remove('dragover');
        });
        
        this.dropZone?.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropZone.classList.remove('dragover');
            this.handleFileSelect(e.dataTransfer.files);
        });
        
        // Wizard navigation
        this.wizardBack?.addEventListener('click', () => {
            this.goToWizardStep(this.currentWizardStep - 1);
        });
        
        this.wizardNext?.addEventListener('click', () => {
            this.goToWizardStep(this.currentWizardStep + 1);
        });
        
        this.wizardCreate?.addEventListener('click', () => {
            this.createProject();
        });
        
        // Form validation
        this.projectName?.addEventListener('input', () => {
            this.updateWizardUI();
        });
        
        // Add track button (for step 4)
        this.addTrackBtn?.addEventListener('click', () => {
            console.log('[DEBUG] + button clicked');
            console.log('[DEBUG] Current wizard step:', this.currentWizardStep);
            console.log('[DEBUG] selectedFiles BEFORE clear:', this.selectedFiles.length);
            console.log('[DEBUG] selectedFiles BEFORE clear:', this.selectedFiles);
            
            // Store current step to return after file selection
            this.wasInStep4 = this.currentWizardStep === 4;
            // Clear selected files before adding new ones
            this.selectedFiles = [];
            
            console.log('[DEBUG] selectedFiles AFTER clear:', this.selectedFiles.length);
            console.log('[DEBUG] wasInStep4:', this.wasInStep4);
            
            this.fileInput.click();
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.classList.contains('active')) {
                this.closeModal();
            }
            
            // Player keyboard shortcuts
            if (this.currentView === 'player') {
                if (e.key === ' ' && !e.target.matches('input')) {
                    e.preventDefault();
                    this.togglePlay();
                }
                if (e.key === 'Escape') {
                    this.switchToLibrary();
                }
            }
        });
        
        // Player controls
        this.backToLibrary?.addEventListener('click', () => this.switchToLibrary());
        
        this.playPauseBtn?.addEventListener('click', () => this.togglePlay());
        
        // Timeline click for seeking
        // Timeline scrubbing with drag support
        this.waveformCanvas?.addEventListener('pointerdown', (e) => {
            if (!this.audioPlayer || this.totalDuration === 0) return;
            
            // Prevent seeking during waveform loading
            if (this.waveformLoading) {
                console.log('[APP] Cannot seek - waveform still loading');
                return;
            }
            
            // Only allow seeking when paused
            if (this.audioPlayer.isPlaying) {
                console.log('[APP] Cannot seek - audio is playing. Pause first to scrub.');
                // Visual feedback that seeking is not allowed
                this.showSeekingDisabledMessage();
                return;
            }
            
            e.preventDefault(); // Prevent default touch actions
            
            const rect = this.waveformCanvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            
            // Initialize drag state
            this.isDragging = true;
            this.dragStartTime = Date.now();
            this.dragStartX = x;
            
            // Change cursor to grabbing
            this.waveformCanvas.style.cursor = 'grabbing';
            
            // Add dragging class to playhead for smooth movement
            this.playhead.classList.add('dragging');
            
            // Initial seek
            this.handleTimelineSeek(x, rect.width, e.clientX, e.clientY);
        });
        
        // Handle drag movement (bound to check isDragging)
        this.handleTimelineDrag = (e) => {
            if (!this.isDragging) return;
            
            const rect = this.waveformCanvas.getBoundingClientRect();
            let x = e.clientX - rect.left;
            
            // Clamp X to canvas bounds
            x = Math.max(0, Math.min(x, rect.width));
            
            // Update playhead position during drag
            this.updatePlayheadPosition(x, rect.width);
        };
        
        // Handle drag end (bound to check isDragging)
        this.handleTimelineDragEnd = async (e) => {
            if (!this.isDragging) return;
            
            const rect = this.waveformCanvas.getBoundingClientRect();
            let x = e.clientX - rect.left;
            
            // Clamp X to canvas bounds
            x = Math.max(0, Math.min(x, rect.width));
            
            // Determine if this was a click or a drag
            const dragDuration = Date.now() - this.dragStartTime;
            const dragDistance = Math.abs(x - this.dragStartX);
            
            // Reset drag state
            this.isDragging = false;
            this.waveformCanvas.style.cursor = 'crosshair';
            
            // Remove dragging class from playhead
            this.playhead.classList.remove('dragging');
            
            // If it was a quick click with minimal movement, show effect popover
            if (dragDuration < 200 && dragDistance < 5) {
                const percentage = x / rect.width;
                const seekTime = percentage * this.totalDuration;
                await this.showEffectPopover(e.clientX, e.clientY, seekTime, x, rect.width);
                this.showClickIndicator(x);
            } else {
                // It was a drag, hide any open popover
                this.hideEffectPopover();
                this.hideClickIndicator();
            }
            
            // Final seek
            this.handleTimelineSeek(x, rect.width);
        };
        
        // Handle drag cancellation (bound to check isDragging)
        this.handleTimelineDragCancel = (e) => {
            if (this.isDragging) {
                this.isDragging = false;
                this.waveformCanvas.style.cursor = 'crosshair';
                this.playhead.classList.remove('dragging');
                this.hideEffectPopover();
                this.hideClickIndicator();
            }
        };
        
        // Add window-level event listeners
        window.addEventListener('pointermove', this.handleTimelineDrag);
        window.addEventListener('pointerup', this.handleTimelineDragEnd);
        window.addEventListener('pointerleave', this.handleTimelineDragCancel);
        
        // Effect file input change handler (disabled - functionality removed)
        // this.effectFileInput?.addEventListener('change', (e) => {
        //     this.handleEffectFileUpload(e.target.files[0]);
        // });
        
        // Cancel effect button handler
        this.cancelEffectBtn?.addEventListener('click', () => {
            this.hideEffectPopover();
            this.hideClickIndicator();
        });
        
        // Close popover when clicking outside
        document.addEventListener('click', (e) => {
            if (this.effectPopover.classList.contains('active')) {
                if (!this.effectPopover.contains(e.target) && e.target !== this.waveformCanvas) {
                    this.hideEffectPopover();
                    this.hideClickIndicator();
                }
            }
        });
        
        // Update effect positions on window resize
        window.addEventListener('resize', () => {
            if (this.currentView === 'player' && this.effects.length > 0) {
                this.updateEffectPositions();
            }
        });
        
        // Master fader with custom interaction and dB scale
        if (this.masterFader) {
            const masterFaderContainer = this.masterFader.parentElement;
            
            const handleMasterFaderInteraction = (clientY) => {
                const rect = masterFaderContainer.getBoundingClientRect();
                const clickY = clientY - rect.top;
                const percentage = 1 - (clickY / rect.height); // Top = 1.0, Bottom = 0.0
                const position = Math.max(0, Math.min(1, percentage));
                const volumePercent = Math.round(position * 100);
                
                // Convert position to dB gain
                const db = this.positionToDb(position);
                const gain = this.dbToGain(db);
                
                // Update audio player with gain
                if (this.audioPlayer) {
                    this.audioPlayer.setMasterVolume(gain);
                }
                
                // Update visual feedback
                const masterThumb = document.getElementById('masterFaderThumb');
                const masterFill = document.getElementById('masterFaderFill');
                const masterDbValue = document.getElementById('masterDbValue');
                
                if (masterThumb) masterThumb.style.bottom = `${volumePercent}%`;
                if (masterFill) masterFill.style.height = `${volumePercent}%`;
                if (masterDbValue) masterDbValue.textContent = this.formatDbValue(db);

                // Update input value for consistency
                this.masterFader.value = volumePercent;
            };
            
            // Mouse events on entire master fader container
            masterFaderContainer.addEventListener('mousedown', (e) => {
                handleMasterFaderInteraction(e.clientY);
                
                const handleMouseMove = (moveEvent) => {
                    handleMasterFaderInteraction(moveEvent.clientY);
                };
                
                const handleMouseUp = () => {
                    document.removeEventListener('mousemove', handleMouseMove);
                    document.removeEventListener('mouseup', handleMouseUp);
                };
                
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
            });
            
            // Touch events for mobile with reduced sensitivity
            masterFaderContainer.addEventListener('touchstart', (e) => {
                e.preventDefault();
                
                // Immediately handle the initial touch position
                handleMasterFaderInteraction(e.touches[0].clientY);
                
                const handleTouchMove = (moveEvent) => {
                    moveEvent.preventDefault();
                    handleMasterFaderInteraction(moveEvent.touches[0].clientY);
                };
                
                const handleTouchEnd = () => {
                    document.removeEventListener('touchmove', handleTouchMove);
                    document.removeEventListener('touchend', handleTouchEnd);
                };
                
                document.addEventListener('touchmove', handleTouchMove);
                document.addEventListener('touchend', handleTouchEnd);
            });
        }
        
        // Master mute and solo buttons
        this.masterMute?.addEventListener('click', () => this.toggleMasterMute());
        this.masterSolo?.addEventListener('click', () => this.toggleMasterSolo());

        // Reset volume buttons
        const resetNormalBtn = document.getElementById('resetNormalVolumes');
        if (resetNormalBtn) {
            resetNormalBtn.addEventListener('click', () => this.resetNormalVolumes());
        }

        const resetPanBtn = document.getElementById('resetPanVolumes');
        if (resetPanBtn) {
            resetPanBtn.addEventListener('click', () => this.resetPanVolumes());
        }
        
        // BPM and time signature controls
        this.bpmInput?.addEventListener('input', (e) => {
            const bpm = parseInt(e.target.value);
            if (this.audioPlayer && !isNaN(bpm) && bpm >= 40 && bpm <= 240) {
                this.audioPlayer.setMetronomeBpm(bpm);
            }
        });
        
        this.timeSignatureSelect?.addEventListener('change', (e) => {
            const timeSignature = e.target.value;
            if (this.audioPlayer) {
                this.audioPlayer.setMetronomeTimeSignature(timeSignature);
            }
        });
        
        this.metronomeBtn?.addEventListener('click', () => this.toggleMetronome());
        
        // Add music to player button
        document.getElementById('addMusicToPlayer')?.addEventListener('click', () => {
            this.openAddSongToSessionModal();
        });
        
        // Add song to session modal events
        this.addSongModalClose?.addEventListener('click', () => this.closeAddSongToSessionModal());
        
        this.addSongToSessionModal?.addEventListener('click', (e) => {
            if (e.target === this.addSongToSessionModal) {
                this.closeAddSongToSessionModal();
            }
        });

        this.songSearchInput?.addEventListener('input', (e) => {
            this.renderSongList(e.target.value);
        });
    }
    
    // ========================================
    // AUTHENTICATION
    // ========================================
    
    initAuthModal() {
        this.authModal = document.getElementById('authModal');
        this.authModalClose = document.getElementById('authModalClose');
        this.loginForm = document.getElementById('loginForm');
        this.registerForm = document.getElementById('registerForm');
        this.loginTitle = this.loginForm?.querySelector('.auth-title');
        this.registerTitle = this.registerForm?.querySelector('.auth-title');
        this.switchToRegister = document.getElementById('switchToRegister');
        this.switchToLogin = document.getElementById('switchToLogin');

        // Auth modal events
        this.authModalClose?.addEventListener('click', () => this.closeAuthModal());

        this.authModal?.addEventListener('click', (e) => {
            if (e.target === this.authModal) {
                this.closeAuthModal();
            }
        });

        // Switch between login and register
        this.switchToRegister?.addEventListener('click', () => this.showRegisterForm());
        this.switchToLogin?.addEventListener('click', () => this.showLoginForm());
        
        // Form submissions
        this.loginForm?.addEventListener('submit', (e) => this.handleLogin(e));
        this.registerForm?.addEventListener('submit', (e) => this.handleRegister(e));
        
        // Password toggle functionality
        this.initPasswordToggles();
        
        // Password strength indicator
        this.initPasswordStrength();
        
        // Monitor auth state changes
        this.monitorAuthState();
    }
    
    initGuestWarningModal() {
        this.guestWarningModal = document.getElementById('guestWarningModal');
        this.guestWarningModalClose = document.getElementById('guestWarningModalClose');
        this.guestContinueBtn = document.getElementById('guestContinueBtn');
        this.guestLoginBtn = document.getElementById('guestLoginBtn');
        
        // Close button
        this.guestWarningModalClose?.addEventListener('click', () => this.closeGuestWarningModal());
        
        // Click outside to close
        this.guestWarningModal?.addEventListener('click', (e) => {
            if (e.target === this.guestWarningModal) {
                this.closeGuestWarningModal();
            }
        });
        
        // Continue without login button
        this.guestContinueBtn?.addEventListener('click', () => {
            this.closeGuestWarningModal();
            this.continueAsGuest();
        });
        
        // Login button
        this.guestLoginBtn?.addEventListener('click', () => {
            this.closeGuestWarningModal();
            this.openAuthModal();
        });
    }
    
    initPublicProfileModal() {
        this.publicProfileModal = document.getElementById('publicProfileModal');
        this.publicProfileModalClose = document.getElementById('publicProfileModalClose');
        this.profileAvatar = document.getElementById('profileAvatar');
        this.profileAvatarInitial = document.getElementById('profileAvatarInitial');
        this.profileDisplayName = document.getElementById('profileDisplayName');
        this.profileTracksGrid = document.getElementById('profileTracksGrid');
        this.profileTracksEmpty = document.getElementById('profileTracksEmpty');
        this.profileTracksSearch = document.getElementById('profileTracksSearch');
        
        // Close button
        this.publicProfileModalClose?.addEventListener('click', () => this.closePublicProfileModal());
        
        // Click outside to close
        this.publicProfileModal?.addEventListener('click', (e) => {
            if (e.target === this.publicProfileModal) {
                this.closePublicProfileModal();
            }
        });
        
        // Search functionality
        this.profileTracksSearch?.addEventListener('input', (e) => {
            this.filterProfileTracks(e.target.value);
        });
        
        this.currentProfileUserId = null;
        this.currentProfileTracks = [];
    }
    
    openPublicProfileModal(userId) {
        this.currentProfileUserId = userId;
        this.publicProfileModal.classList.add('active');
        this.loadUserProfile(userId);
    }
    
    closePublicProfileModal() {
        this.publicProfileModal.classList.remove('active');
        this.currentProfileUserId = null;
        this.currentProfileTracks = [];
    }
    
    async loadUserProfile(userId) {
        if (!window.firebaseDB) {
            console.warn('[PROFILE] Firebase not available');
            return;
        }
        
        try {
            // Load user profile data
            const userDocRef = window.firebaseDB.doc(window.firebaseDB.db, 'users', userId);
            const userDocSnap = await window.firebaseDB.getDoc(userDocRef);
            
            if (userDocSnap.exists()) {
                const userData = userDocSnap.data();
                this.renderProfileHeader(userData);
            } else {
                // User doesn't have a profile document, use basic info
                this.renderProfileHeader({
                    displayName: 'Usuário'
                });
            }
            
            // Load user's tracks
            await this.loadUserTracks(userId);
        } catch (error) {
            console.error('[PROFILE] Error loading user profile:', error);
        }
    }
    
    renderProfileHeader(userData) {
        // Set avatar
        if (userData.profilePhoto) {
            this.profileAvatar.style.backgroundImage = `url(${userData.profilePhoto})`;
            this.profileAvatar.style.backgroundSize = 'cover';
            this.profileAvatar.style.backgroundPosition = 'center';
            this.profileAvatar.innerHTML = '';
        } else {
            const initial = userData.displayName ? userData.displayName.charAt(0).toUpperCase() : 'U';
            this.profileAvatar.style.backgroundImage = 'none';
            this.profileAvatar.innerHTML = `<span>${initial}</span>`;
        }

        // Set name
        this.profileDisplayName.textContent = userData.displayName || 'Usuário';
    }
    
    async loadUserTracks(userId) {
        if (!window.firebaseDB) return;
        
        try {
            const q = window.firebaseDB.query(
                window.firebaseDB.collection(window.firebaseDB.db, 'communityTracks'),
                window.firebaseDB.where('userId', '==', userId),
                window.firebaseDB.where('published', '==', true),
                window.firebaseDB.orderBy('createdAt', 'desc')
            );
            
            const querySnapshot = await window.firebaseDB.getDocs(q);
            this.currentProfileTracks = [];
            
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                this.currentProfileTracks.push({
                    id: doc.id,
                    name: data.name,
                    artist: data.artist,
                    genre: data.genre,
                    key: data.key,
                    bpm: data.bpm,
                    stems: data.stems,
                    coverUrl: data.coverUrl,
                    downloadUrl: data.downloadUrl,
                    authorName: data.authorName,
                    authorEmail: data.authorEmail
                });
            });
            
            this.renderProfileTracks();
        } catch (error) {
            console.error('[PROFILE] Error loading user tracks:', error);
        }
    }
    
    renderProfileTracks() {
        if (this.currentProfileTracks.length === 0) {
            this.profileTracksGrid.style.display = 'none';
            this.profileTracksEmpty.style.display = 'block';
            return;
        }
        
        this.profileTracksGrid.style.display = 'grid';
        this.profileTracksEmpty.style.display = 'none';
        this.profileTracksGrid.innerHTML = this.currentProfileTracks.map(track => this.renderCommunityCard(track)).join('');
    }
    
    filterProfileTracks(searchTerm) {
        const term = searchTerm.toLowerCase();
        const filtered = this.currentProfileTracks.filter(track => 
            track.name.toLowerCase().includes(term) ||
            track.artist.toLowerCase().includes(term) ||
            track.key?.toLowerCase().includes(term) ||
            track.bpm?.toString().includes(term)
        );
        
        if (filtered.length === 0) {
            this.profileTracksGrid.style.display = 'none';
            this.profileTracksEmpty.style.display = 'block';
        } else {
            this.profileTracksGrid.style.display = 'grid';
            this.profileTracksEmpty.style.display = 'none';
            this.profileTracksGrid.innerHTML = filtered.map(track => this.renderCommunityCard(track)).join('');
        }
    }
    
    openGuestWarningModal() {
        this.guestWarningModal.classList.add('active');
    }
    
    closeGuestWarningModal() {
        this.guestWarningModal.classList.remove('active');
    }
    
    continueAsGuest() {
        // Flag to indicate guest mode
        this.isGuestMode = true;
        
        // Open the add music modal
        this.openModal();
    }
    
    initPasswordStrength() {
        const registerPassword = document.getElementById('registerPassword');
        
        registerPassword?.addEventListener('input', (e) => {
            const password = e.target.value;
            const strength = this.calculatePasswordStrength(password);
            this.updatePasswordStrength(strength);
        });
    }
    
    initPasswordToggles() {
        const passwordToggles = document.querySelectorAll('.auth-password-toggle');
        
        passwordToggles.forEach(toggle => {
            toggle.addEventListener('click', () => {
                const targetId = toggle.dataset.target;
                const input = document.getElementById(targetId);
                const eyeOpen = toggle.querySelector('.eye-open');
                const eyeClosed = toggle.querySelector('.eye-closed');
                
                if (input.type === 'password') {
                    input.type = 'text';
                    eyeOpen.style.display = 'none';
                    eyeClosed.style.display = 'block';
                } else {
                    input.type = 'password';
                    eyeOpen.style.display = 'block';
                    eyeClosed.style.display = 'none';
                }
            });
        });
    }
    
    monitorAuthState() {
        // Wait for Firebase to be available
        const checkFirebase = setInterval(() => {
            if (window.firebaseAuth) {
                clearInterval(checkFirebase);
                const { auth, onAuthStateChanged } = window.firebaseAuth;
                
                onAuthStateChanged(auth, async (user) => {
                    if (user) {
                        console.log('[AUTH] User is logged in:', user.email);
                        this.updateUserProfile(user);
                        this.updateProfileButtonForLoggedIn(user);
                        
                        // Re-initialize storage Firebase connection
                        if (typeof storage !== 'undefined' && typeof storage.reinitializeFirebase === 'function') {
                            console.log('[AUTH] Re-initializing storage Firebase connection...');
                            await storage.reinitializeFirebase();
                        }
                        
                        // Set Firebase ID token for API client
                        try {
                            const idToken = await user.getIdToken();
                            if (typeof apiClient !== 'undefined') {
                                apiClient.setAuthToken(idToken);
                                const tokenPreview = idToken.substring(0, 20) + '...';
                                console.log('[AUTH] Firebase ID token set in apiClient (first 20 chars):', tokenPreview);
                                console.log('[AUTH] Firebase Project ID from frontend:', window.firebaseConfig?.projectId || 'not available');
                            }
                            
                            // Set up periodic token refresh (every 30 minutes)
                            if (this.tokenRefreshInterval) {
                                clearInterval(this.tokenRefreshInterval);
                            }
                            this.tokenRefreshInterval = setInterval(async () => {
                                try {
                                    const refreshedToken = await user.getIdToken(true);
                                    if (typeof apiClient !== 'undefined') {
                                        apiClient.setAuthToken(refreshedToken);
                                        console.log('[AUTH] Firebase ID token refreshed in apiClient');
                                    }
                                } catch (error) {
                                    console.error('[AUTH] Error refreshing ID token:', error);
                                }
                            }, 30 * 60 * 1000); // 30 minutes
                        } catch (error) {
                            console.error('[AUTH] Error getting ID token:', error);
                        }
                        
                        // Load community favorites for this user (async from Firestore)
                        await this.loadCommunityFavorites();
                        
                        // Reload storage with new user's data
                        if (typeof storage !== 'undefined') {
                            console.log('[AUTH] Reloading storage for user:', user.uid);
                            storage.load().then(() => {
                                console.log('[AUTH] Storage reloaded, refreshing UI');
                                this.renderLibrary();
                            }).catch(error => {
                                console.error('[AUTH] Error reloading storage:', error);
                            });
                        }
                    } else {
                        console.log('[AUTH] User is logged out');
                        this.updateProfileButtonForLoggedOut();
                        localStorage.removeItem('currentUser');
                        
                        // Clear API client token on logout
                        if (typeof apiClient !== 'undefined') {
                            apiClient.setAuthToken(null);
                            console.log('[AUTH] Firebase ID token cleared from apiClient');
                        }
                        
                        // Clear community favorites on logout
                        this.communityFavorites = [];
                        
                        // Reload storage with guest user's data
                        if (typeof storage !== 'undefined') {
                            console.log('[AUTH] Reloading storage for guest user');
                            storage.load().then(() => {
                                console.log('[AUTH] Storage reloaded, refreshing UI');
                                this.renderLibrary();
                                this.renderCommunity(); // Update community cards
                            }).catch(error => {
                                console.error('[AUTH] Error reloading storage:', error);
                            });
                        }
                    }
                });

                // Check initial auth state
                this.checkAuthState();
            }
        }, 100);
    }
    
    async updateProfileButtonForLoggedIn(user) {
        // Try to get displayName from Firestore first
        let displayName = user.displayName;
        let email = user.email;
        let profilePhoto = null;

        try {
            if (window.firebaseDB) {
                const { db, doc, getDoc, collection, query, where, getDocs } = window.firebaseDB;
                // First try to get by UID (new method)
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    displayName = userData.displayName || displayName;
                    profilePhoto = userData.profilePhoto || null;
                } else {
                    // Fallback: try to find by uid field (old method with auto-generated IDs)
                    const q = query(collection(db, 'users'), where('uid', '==', user.uid));
                    const querySnapshot = await getDocs(q);
                    if (!querySnapshot.empty) {
                        const userData = querySnapshot.docs[0].data();
                        displayName = userData.displayName || displayName;
                        profilePhoto = userData.profilePhoto || null;
                    }
                }
            }
        } catch (error) {
            console.warn('[AUTH] Could not fetch user data from Firestore:', error);
        }

        // Fallback to email only if displayName is still null/undefined (not empty string)
        if (!displayName || displayName.trim() === '') {
            displayName = email.split('@')[0];
        }
        const initial = displayName.charAt(0).toUpperCase();

        const userInitial = document.getElementById('userInitial');
        const dropdownUserInitial = document.getElementById('dropdownUserInitial');
        const profileName = document.getElementById('profileName');
        const profileEmail = document.getElementById('profileEmail');
        const profileBtn = document.getElementById('profileBtn');

        if (userInitial) {
            if (profilePhoto) {
                userInitial.style.backgroundImage = `url(${profilePhoto})`;
                userInitial.style.backgroundSize = 'cover';
                userInitial.style.backgroundPosition = 'center';
                userInitial.textContent = '';
            } else {
                userInitial.style.backgroundImage = 'none';
                userInitial.textContent = initial;
            }
            userInitial.style.display = 'flex';
        }

        if (dropdownUserInitial) {
            if (profilePhoto) {
                dropdownUserInitial.parentElement.style.backgroundImage = `url(${profilePhoto})`;
                dropdownUserInitial.parentElement.style.backgroundSize = 'cover';
                dropdownUserInitial.parentElement.style.backgroundPosition = 'center';
                dropdownUserInitial.textContent = '';
            } else {
                dropdownUserInitial.parentElement.style.backgroundImage = 'none';
                dropdownUserInitial.textContent = initial;
            }
        }

        if (profileName) {
            profileName.textContent = displayName;
        }

        if (profileEmail) {
            profileEmail.textContent = email;
        }

        if (profileBtn) {
            profileBtn.setAttribute('aria-label', `Logado como ${displayName} - Clique para opções`);
        }

        console.log('[AUTH] Profile button updated for logged in user:', displayName);
    }

    updateProfileButtonForLoggedOut() {
        const userInitial = document.getElementById('userInitial');
        const dropdownUserInitial = document.getElementById('dropdownUserInitial');
        const profileName = document.getElementById('profileName');
        const profileEmail = document.getElementById('profileEmail');
        const profileBtn = document.getElementById('profileBtn');

        if (userInitial) {
            userInitial.style.display = 'none';
        }

        if (dropdownUserInitial) {
            dropdownUserInitial.textContent = '';
        }

        if (profileName) {
            profileName.textContent = '';
        }

        if (profileEmail) {
            profileEmail.textContent = '';
        }

        if (profileBtn) {
            profileBtn.setAttribute('aria-label', 'Perfil - Clique para entrar');
        }
    }
    
    updateProfileButtonBasedOnAuth() {
        // Check if user is already logged in from localStorage
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
            try {
                const user = JSON.parse(storedUser);
                console.log('[AUTH] Found stored user:', user.email);
                this.updateProfileButtonForLoggedIn(user);
            } catch (e) {
                console.warn('[AUTH] Could not parse stored user:', e);
                this.updateProfileButtonForLoggedOut();
            }
        } else {
            this.updateProfileButtonForLoggedOut();
        }
    }

    // Call this on init to set initial state
    checkAuthState() {
        this.updateProfileButtonBasedOnAuth();
    }

    handleLogout() {
        if (!window.firebaseAuth) {
            console.error('Firebase não está disponível. Verifique se os scripts foram carregados.');
            return;
        }

        // Clear token refresh interval
        if (this.tokenRefreshInterval) {
            clearInterval(this.tokenRefreshInterval);
            this.tokenRefreshInterval = null;
        }

        const { auth, signOut } = window.firebaseAuth;

        signOut(auth)
            .then(() => {
                console.log('[AUTH] Logout successful');
                this.updateProfileButtonForLoggedOut();
                localStorage.removeItem('currentUser');
                this.communityFavorites = []; // Clear favorites on logout
                // Reload page to clear user session
                window.location.reload();
            })
            .catch((error) => {
                console.error('[AUTH] Logout error:', error);
            });
    }

    openAuthModal() {
        this.authModal.classList.add('active');
        this.showLoginForm();
    }
    
    closeAuthModal() {
        this.authModal.classList.remove('active');
        this.loginForm.reset();
        this.registerForm.reset();
        // Hide error messages
        const loginError = document.getElementById('loginError');
        if (loginError) {
            loginError.style.display = 'none';
        }
        const registerError = document.getElementById('registerError');
        if (registerError) {
            registerError.style.display = 'none';
        }
    }
    
    showLoginForm() {
        this.loginForm.style.display = 'flex';
        this.registerForm.style.display = 'none';
        if (this.loginTitle) {
            this.loginTitle.textContent = 'Bem-vindo de volta';
        }
        // Hide error messages
        const loginError = document.getElementById('loginError');
        if (loginError) {
            loginError.style.display = 'none';
        }
        const registerError = document.getElementById('registerError');
        if (registerError) {
            registerError.style.display = 'none';
        }
    }

    showRegisterForm() {
        this.loginForm.style.display = 'none';
        this.registerForm.style.display = 'flex';
        if (this.registerTitle) {
            this.registerTitle.textContent = 'Crie sua conta';
        }
        // Hide error messages
        const loginError = document.getElementById('loginError');
        if (loginError) {
            loginError.style.display = 'none';
        }
        const registerError = document.getElementById('registerError');
        if (registerError) {
            registerError.style.display = 'none';
        }
    }
    
    handleLogin(e) {
        e.preventDefault();

        // Hide any previous error messages
        const loginError = document.getElementById('loginError');
        if (loginError) {
            loginError.style.display = 'none';
        }
        
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        console.log('[AUTH] Login attempt:', email);

        // Check if Firebase is available
        if (!window.firebaseAuth) {
            const loginError = document.getElementById('loginError');
            if (loginError) {
                loginError.textContent = 'Firebase não está disponível. Verifique se os scripts foram carregados.';
                loginError.style.display = 'flex';
            }
            return;
        }

        const { auth, signInWithEmailAndPassword } = window.firebaseAuth;
        
        signInWithEmailAndPassword(auth, email, password)
            .then(async (userCredential) => {
                const user = userCredential.user;
                console.log('[AUTH] Login successful:', user.email);

                // Check if user is banned or suspended
                if (window.firebaseDB) {
                    try {
                        const { db, doc, getDoc, collection, query, where, getDocs } = window.firebaseDB;
                        // First try to get by UID (new method)
                        let userDoc = await getDoc(doc(db, 'users', user.uid));
                        let userData = null;

                        if (userDoc.exists()) {
                            userData = userDoc.data();
                        } else {
                            // Fallback: try to find by uid field (old method with auto-generated IDs)
                            const q = query(collection(db, 'users'), where('uid', '==', user.uid));
                            const querySnapshot = await getDocs(q);
                            if (!querySnapshot.empty) {
                                userData = querySnapshot.docs[0].data();
                            }
                        }

                        if (userData) {
                            // Ensure user has a plan, set to 'home' if missing
                            if (!userData.plano) {
                                try {
                                    await window.firebaseDB.updateDoc(userDoc, { plano: 'home' });
                                    console.log('[AUTH] Default plan set for existing user:', user.uid);
                                } catch (error) {
                                    console.warn('[AUTH] Could not set default plan:', error);
                                }
                            }

                            if (userData.status === 'banned') {
                                await signOut(auth);
                                alert(`Sua conta foi banida.\n\nMotivo: ${userData.banReason || 'Não especificado'}\n\nPara mais informações, entre em contato com o suporte.`);
                                return;
                            }

                            if (userData.status === 'suspended') {
                                await signOut(auth);
                                const suspensionReason = userData.suspensionReason || 'Não especificado';
                                let suspensionInfo = `Sua conta está suspensa.\n\nMotivo: ${suspensionReason}`;

                                if (userData.suspensionEndDate) {
                                    const endDate = new Date(userData.suspensionEndDate.seconds * 1000);
                                    suspensionInfo += `\n\nSuspensão até: ${endDate.toLocaleDateString('pt-BR')} ${endDate.toLocaleTimeString('pt-BR')}`;
                                } else {
                                    suspensionInfo += '\n\nSuspensão: Indeterminada';
                                }

                                alert(suspensionInfo);
                                return;
                            }
                        }
                    } catch (error) {
                        console.warn('[AUTH] Could not check user status:', error);
                        // Continue with login if check fails
                    }
                }

                // Reload user to get updated profile including displayName
                user.reload().then(async () => {
                    console.log('[AUTH] User profile reloaded:', user.displayName);
                    this.closeAuthModal();
                    this.updateUserProfile(user);
                    await this.loadCommunityFavorites();
                }).catch(async (error) => {
                    console.warn('[AUTH] Could not reload user profile:', error);
                    this.closeAuthModal();
                    this.updateUserProfile(user);
                    await this.loadCommunityFavorites();
                });
            })
            .catch((error) => {
                console.error('[AUTH] Login error:', error);
                const errorCode = error.code;
                const errorMessage = error.message;

                let errorText = '';
                if (errorCode === 'auth/user-not-found') {
                    errorText = 'Usuário não encontrado. Verifique seu email.';
                } else if (errorCode === 'auth/wrong-password') {
                    errorText = 'Senha incorreta.';
                } else if (errorCode === 'auth/invalid-credential') {
                    errorText = 'Email ou senha incorretos. Verifique suas credenciais.';
                } else if (errorCode === 'auth/invalid-email') {
                    errorText = 'Email inválido.';
                } else {
                    errorText = 'Erro ao fazer login. Tente novamente.';
                }

                // Show error in the modal
                const loginError = document.getElementById('loginError');
                if (loginError) {
                    loginError.textContent = errorText;
                    loginError.style.display = 'flex';
                }
            });
    }
    
    async handleRegister(e) {
        e.preventDefault();

        // Hide any previous error messages
        const registerError = document.getElementById('registerError');
        if (registerError) {
            registerError.style.display = 'none';
        }

        const name = document.getElementById('registerName').value;
        const email = document.getElementById('registerEmail').value;
        const accountType = document.getElementById('registerType').value;
        const otherType = document.getElementById('registerOtherType').value;
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('registerConfirmPassword').value;
        const acceptTerms = document.getElementById('acceptTerms').checked;

        console.log('[AUTH] Register attempt:', name, email, accountType);

        // Validações
        if (!accountType) {
            const registerError = document.getElementById('registerError');
            if (registerError) {
                registerError.textContent = 'Por favor, selecione o tipo de conta.';
                registerError.style.display = 'flex';
            }
            return;
        }

        if (accountType === 'outro' && !otherType.trim()) {
            const registerError = document.getElementById('registerError');
            if (registerError) {
                registerError.textContent = 'Por favor, especifique o tipo de conta.';
                registerError.style.display = 'flex';
            }
            return;
        }

        if (password.length < 6) {
            const registerError = document.getElementById('registerError');
            if (registerError) {
                registerError.textContent = 'A senha deve ter pelo menos 6 caracteres.';
                registerError.style.display = 'flex';
            }
            return;
        }

        if (password !== confirmPassword) {
            const registerError = document.getElementById('registerError');
            if (registerError) {
                registerError.textContent = 'As senhas não coincidem.';
                registerError.style.display = 'flex';
            }
            return;
        }

        if (!acceptTerms) {
            const registerError = document.getElementById('registerError');
            if (registerError) {
                registerError.textContent = 'Você deve concordar com os Termos de Uso e Política de Privacidade.';
                registerError.style.display = 'flex';
            }
            return;
        }

        // Check if Firebase is available
        if (!window.firebaseAuth) {
            const registerError = document.getElementById('registerError');
            if (registerError) {
                registerError.textContent = 'Firebase não está disponível. Verifique se os scripts foram carregados.';
                registerError.style.display = 'flex';
            }
            return;
        }

        const { auth, createUserWithEmailAndPassword } = window.firebaseAuth;

        createUserWithEmailAndPassword(auth, email, password)
            .then(async (userCredential) => {
                const user = userCredential.user;
                console.log('[AUTH] Registration successful:', user.email);

                // Prepare user data
                const finalAccountType = accountType === 'outro' ? otherType : accountType;
                const userData = {
                    displayName: name,
                    accountType: finalAccountType,
                    email: email,
                    createdAt: new Date().toISOString()
                };

                // Update user profile with display name
                try {
                    if (user.updateProfile) {
                        await user.updateProfile({
                            displayName: name
                        });
                        console.log('[AUTH] Display name updated:', name);
                        // Force reload user to get updated profile
                        await user.reload();
                        console.log('[AUTH] User profile reloaded with displayName:', user.displayName);
                    }
                } catch (error) {
                    console.warn('[AUTH] Could not update display name:', error);
                }

                // Store additional user data in Firestore if available
                if (window.firebaseDB) {
                    const { db, collection, doc, setDoc, serverTimestamp } = window.firebaseDB;
                    setDoc(doc(db, 'users', user.uid), {
                        uid: user.uid,
                        displayName: name,
                        email: email,
                        accountType: finalAccountType,
                        plano: 'home', // Default plan for new users
                        createdAt: serverTimestamp()
                    }).then(() => {
                        console.log('[AUTH] User data stored in Firestore with default plan: home');
                    }).catch((error) => {
                        console.warn('[AUTH] Could not store user data in Firestore:', error);
                    });
                }

                this.closeAuthModal();
                // Update profile immediately after all async operations
                this.updateUserProfile(user);
            })
            .catch((error) => {
                console.error('[AUTH] Registration error:', error);
                const errorCode = error.code;
                const errorMessage = error.message;

                let errorText = '';
                if (errorCode === 'auth/email-already-in-use') {
                    errorText = 'Este email já está sendo usado por outra conta.';
                } else if (errorCode === 'auth/invalid-email') {
                    errorText = 'Email inválido.';
                } else if (errorCode === 'auth/weak-password') {
                    errorText = 'A senha é muito fraca. Use pelo menos 6 caracteres.';
                } else {
                    errorText = 'Erro ao criar conta. Tente novamente.';
                }

                // Show error in the modal
                const registerError = document.getElementById('registerError');
                if (registerError) {
                    registerError.textContent = errorText;
                    registerError.style.display = 'flex';
                }
            });
    }
    
    async updateUserProfile(user) {
        // Update UI to show logged in user
        const profileBtn = document.getElementById('profileBtn');
        const userInitial = document.getElementById('userInitial');
        const dropdownUserInitial = document.getElementById('dropdownUserInitial');
        const profileName = document.getElementById('profileName');
        const profileEmail = document.getElementById('profileEmail');

        if (user) {
            // Try to get displayName from Firestore first
            let displayName = user.displayName;
            let email = user.email;

            try {
                if (window.firebaseDB) {
                    const { db, doc, getDoc, collection, query, where, getDocs } = window.firebaseDB;
                    // First try to get by UID (new method)
                    const userDoc = await getDoc(doc(db, 'users', user.uid));
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        displayName = userData.displayName || displayName;
                    } else {
                        // Fallback: try to find by uid field (old method with auto-generated IDs)
                        const q = query(collection(db, 'users'), where('uid', '==', user.uid));
                        const querySnapshot = await getDocs(q);
                        if (!querySnapshot.empty) {
                            const userData = querySnapshot.docs[0].data();
                            displayName = userData.displayName || displayName;
                        }
                    }
                }
            } catch (error) {
                console.warn('[AUTH] Could not fetch user data from Firestore:', error);
            }

            // Fallback to email only if displayName is still null/undefined (not empty string)
            if (!displayName || displayName.trim() === '') {
                displayName = email.split('@')[0];
            }
            const initial = displayName.charAt(0).toUpperCase();

            if (profileBtn) {
                profileBtn.setAttribute('aria-label', `Logado como ${displayName}`);
            }

            if (userInitial) {
                userInitial.textContent = initial;
                userInitial.style.display = 'flex';
            }

            if (dropdownUserInitial) {
                dropdownUserInitial.textContent = initial;
            }

            if (profileName) {
                profileName.textContent = displayName;
            }

            if (profileEmail) {
                profileEmail.textContent = email;
            }

            console.log('[AUTH] User profile updated:', displayName);
        }

        // Store user info in localStorage
        localStorage.setItem('currentUser', JSON.stringify({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName
        }));
    }

    updateProfileButtonForLoggedOut() {
        const userInitial = document.getElementById('userInitial');
        const profileBtn = document.getElementById('profileBtn');

        if (userInitial) {
            userInitial.style.display = 'none';
        }

        if (profileBtn) {
            profileBtn.setAttribute('aria-label', 'Perfil');
        }

        // Clear dropdown info
        const dropdownUserInitial = document.getElementById('dropdownUserInitial');
        const profileName = document.getElementById('profileName');
        const profileEmail = document.getElementById('profileEmail');

        if (dropdownUserInitial) dropdownUserInitial.textContent = '';
        if (profileName) profileName.textContent = '';
        if (profileEmail) profileEmail.textContent = '';
    }

    calculatePasswordStrength(password) {
        let strength = 0;

        if (password.length >= 6) strength += 1;
        if (password.length >= 10) strength += 1;
        if (/[A-Z]/.test(password)) strength += 1;
        if (/[0-9]/.test(password)) strength += 1;
        if (/[^A-Za-z0-9]/.test(password)) strength += 1;

        return Math.min(strength, 4);
    }

    updatePasswordStrength(strength) {
        const strengthBarFill = document.querySelector('.auth-strength-fill');
        const strengthText = document.querySelector('.auth-strength-text');

        if (!strengthBarFill || !strengthText) return;

        const colors = ['#ff3b2f', '#ff6b35', '#ffb347', '#7bc043', '#4caf50'];
        const labels = ['Muito fraca', 'Fraca', 'Média', 'Forte', 'Muito forte'];
        const widths = ['20%', '40%', '60%', '80%', '100%'];

        strengthBarFill.style.background = colors[strength];
        strengthBarFill.style.width = widths[strength];
        strengthText.textContent = labels[strength];
    }
    
    // ========================================
    // UTILITIES
    // ========================================
    
    /**
     * Convert fader position (0-1) to dB
     * 0.5 = 0dB (unity gain)
     * Below 0.5: logarithmic attenuation to -∞dB at position 0
     * Above 0.5: linear amplification to +10dB at position 1.0
     */
    positionToDb(position) {
        if (position >= 0.5) {
            // Top half (0.5 to 1.0): linear from 0dB to +10dB
            return ((position - 0.5) / 0.5) * 10;
        } else if (position > 0) {
            // Bottom half (0 to 0.5): logarithmic attenuation from 0dB to -70dB
            // Using a logarithmic curve that mimics professional console behavior
            const normalizedPos = position / 0.5; // 0 to 1
            const minDb = -70; // Practical minimum (close to -∞)
            return minDb * (1 - Math.pow(normalizedPos, 0.5)); // Square root curve for smooth feel
        } else {
            // Position 0 = complete silence (-∞dB)
            return -Infinity;
        }
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

    /**
     * Convert linear gain to fader position (0-1)
     * Reverse of positionToDb for proper display
     */
    gainToPosition(gain) {
        if (gain <= 0) {
            return 0;
        }

        const db = 20 * Math.log10(gain);

        if (db >= 0) {
            // Above 0dB: convert back to position above 0.5 (0 to +10dB range)
            return 0.5 + (db / 10) * 0.5;
        } else {
            // Below 0dB: convert back to position below 0.5 (logarithmic curve)
            const minDb = -70;
            if (db <= minDb) {
                return 0;
            }
            const normalizedDb = (minDb - db) / minDb; // 0 to 1
            const normalizedPos = Math.pow(normalizedDb, 2); // Square to reverse the sqrt curve
            return normalizedPos * 0.5;
        }
    }

    /**
     * Format dB value for display
     * Returns formatted string like "+5.2 dB", "0.0 dB", "-12.5 dB" or "-∞ dB"
     */
    formatDbValue(db) {
        if (db === -Infinity || !isFinite(db)) {
            return "-∞ dB";
        }
        const sign = db >= 0 ? "+" : "";
        return `${sign}${db.toFixed(1)} dB`;
    }
    
    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        
        if (minutes < 1) return 'agora';
        if (minutes < 60) return `${minutes} min atrás`;
        if (hours < 24) return `${hours}h atrás`;
        if (days < 7) return `${days} dia${days !== 1 ? 's' : ''} atrás`;
        
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '0:00';
        
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    // ========================================
    // PAD SYSTEM
    // ========================================
    initPadSystem() {
        console.log('[PAD] Initializing pad system...');
        
        try {
            // Pads are already loaded in constructor
            console.log('[PAD] Loaded', this.availablePads.length, 'available pads');
            
            // Enable PAD button if pads are available
            const padBtn = document.getElementById('padBtn');
            if (padBtn && this.availablePads.length > 0) {
                padBtn.classList.remove('hidden');
                console.log('[PAD] PAD button enabled');
            }
            
            // Setup PAD button event listener
            this.setupPadButton();
            
        } catch (error) {
            console.error('[PAD] Error initializing pad system:', error);
        }
    }
    
    async setupPadButton() {
        const padBtn = document.getElementById('padBtn');
        if (padBtn) {
            padBtn.addEventListener('click', async () => {
                // PAD is now available for Home users
                this.showPadSelectionModal();
            });
        }
    }
    
    showPadSelectionModal() {
        // Create modal if it doesn't exist
        let modal = document.getElementById('padSelectionModal');
        
        if (!modal) {
            modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.id = 'padSelectionModal';
            
            modal.innerHTML = `
                <div class="modal pad-modal">
                    <div class="modal-header">
                        <h3 class="modal-title">Selecionar PAD</h3>
                        <button class="modal-close" id="padModalClose" aria-label="Fechar">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                    
                    <div class="modal-body">
                        <div class="pad-grid" id="padGrid">
                            <!-- Pads will be rendered here -->
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Setup close button
            document.getElementById('padModalClose').addEventListener('click', () => {
                this.closePadSelectionModal();
            });
            
            // Close on overlay click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closePadSelectionModal();
                }
            });
        }
        
        // Render pads with current state
        this.renderPadGrid();
        
        // Show modal
        modal.classList.add('active');
    }
    
    closePadSelectionModal() {
        const modal = document.getElementById('padSelectionModal');
        if (modal) {
            modal.classList.remove('active');
        }
        
        // Update visual state to reflect current pad status
        this.updatePadVisualState();
    }
    
    renderPadGrid() {
        const padGrid = document.getElementById('padGrid');
        if (!padGrid) return;
        
        padGrid.innerHTML = '';
        
        this.availablePads.forEach(pad => {
            const padButton = document.createElement('button');
            padButton.className = 'pad-item';
            padButton.dataset.key = pad.key;
            padButton.dataset.file = pad.file;
            
            // Add active class if this is the current playing pad
            if (this.currentPad && this.currentPad.key === pad.key && this.padIsPlaying) {
                padButton.classList.add('active', 'playing');
            }
            
            // Display only the key name
            padButton.innerHTML = `
                <span class="pad-key">${pad.key}</span>
                <span class="pad-relative">${pad.relativeKey}</span>
            `;
            
            padButton.addEventListener('click', () => {
                this.selectPad(pad);
            });
            
            padGrid.appendChild(padButton);
        });
    }
    
    async selectPad(pad) {
        console.log('[PAD] Selected pad:', pad.key, 'file:', pad.file);
        
        // Close modal
        this.closePadSelectionModal();
        
        // Update visual state immediately (not after fade)
        this.updatePadVisualState();
        
        // Check if it's the same pad (ON/OFF toggle)
        if (this.currentPad && this.currentPad.key === pad.key && this.padIsPlaying) {
            console.log('[PAD] Same pad selected, turning OFF');
            await this.fadeOutAndStopPad();
            this.currentPad = null;
            this.updatePadVisualState();
            return;
        }
        
        // If a different pad is playing, transition smoothly
        if (this.padIsPlaying && this.currentPad) {
            console.log('[PAD] Transitioning from', this.currentPad.key, 'to', pad.key);
            await this.transitionToNewPad(pad);
        } else {
            // First pad selection - just load and play
            await this.loadAndPlayPad(pad);
        }
        
        this.updatePadVisualState();
    }
    
    async transitionToNewPad(newPad) {
        try {
            // Cancel any ongoing fade timers to prevent race conditions
            if (this.padFadeOutTimer) {
                cancelAnimationFrame(this.padFadeOutTimer);
                this.padFadeOutTimer = null;
            }
            if (this.padFadeInTimer) {
                cancelAnimationFrame(this.padFadeInTimer);
                this.padFadeInTimer = null;
            }
            
            // Step 1: Fade out current pad
            await this.fadeOutCurrentPad();
            
            // Step 2: Stop current pad completely
            this.stopPad();
            
            // Step 3: Load new pad
            await this.loadAndPlayPad(newPad);
            
            // Step 4: Fade in new pad
            await this.fadeInNewPad();
            
        } catch (error) {
            console.error('[PAD] Error during pad transition:', error);
            // Clean up state on error
            this.stopPad();
            this.currentPad = null;
            this.padIsPlaying = false;
            this.updatePadVisualState();
        }
    }
    
    async fadeOutCurrentPad() {
        return new Promise((resolve) => {
            if (!this.padTrackNodes || !this.padTrackNodes.gain) {
                resolve();
                return;
            }
            
            // Get current gain from track (respecting mute state)
            const track = this.currentProject?.tracks.find(t => t.id === 'pad-track');
            const currentGain = (track && !track.mute) ? (track.volume || 0.7) : this.padTrackNodes.gain.gain.value;
            const startTime = performance.now();
            const duration = this.padTransitionDuration;
            
            const fadeOut = (currentTime) => {
                // Check if nodes still exist (in case stopPad was called during fade)
                if (!this.padTrackNodes || !this.padTrackNodes.gain) {
                    resolve();
                    return;
                }
                
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Exponential fade for smoother sound
                const newGain = currentGain * (1 - progress);
                this.padTrackNodes.gain.gain.value = newGain;
                
                if (progress < 1) {
                    this.padFadeOutTimer = requestAnimationFrame(fadeOut);
                } else {
                    resolve();
                }
            };
            
            this.padFadeOutTimer = requestAnimationFrame(fadeOut);
        });
    }
    
    async fadeInNewPad() {
        return new Promise((resolve) => {
            if (!this.padTrackNodes || !this.padTrackNodes.gain) {
                resolve();
                return;
            }
            
            // Get target volume from track (respecting current volume setting)
            const track = this.currentProject?.tracks.find(t => t.id === 'pad-track');
            const baseVolume = track ? (track.volume || 0.7) : 0.7;
            
            // Check if should be muted (mute or solo-muted)
            const hasSoloTracks = this.currentProject?.tracks.some(t => t.solo) || false;
            const shouldMute = (track && track.mute) || (hasSoloTracks && track && !track.solo);
            
            const targetGain = shouldMute ? 0 : baseVolume;
            const startTime = performance.now();
            const duration = this.padTransitionDuration;
            
            // Start from 0
            this.padTrackNodes.gain.gain.value = 0;
            
            const fadeIn = (currentTime) => {
                // Check if nodes still exist (in case stopPad was called during fade)
                if (!this.padTrackNodes || !this.padTrackNodes.gain) {
                    resolve();
                    return;
                }
                
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Linear fade for quick but smooth response
                const newGain = targetGain * progress;
                this.padTrackNodes.gain.gain.value = newGain;
                
                if (progress < 1) {
                    this.padFadeInTimer = requestAnimationFrame(fadeIn);
                } else {
                    resolve();
                }
            };
            
            this.padFadeInTimer = requestAnimationFrame(fadeIn);
        });
    }
    
    async fadeOutAndStopPad() {
        await this.fadeOutCurrentPad();
        this.stopPad();
        this.updatePadButtonState();
    }
    
    updatePadButtonState() {
        const padBtn = document.getElementById('padBtn');
        if (padBtn) {
            if (this.padIsPlaying && this.currentPad) {
                padBtn.classList.add('active');
                padBtn.setAttribute('aria-label', `PAD - ${this.currentPad.key}`);
            } else {
                padBtn.classList.remove('active');
                padBtn.setAttribute('aria-label', 'PAD');
            }
        }
    }
    
    updatePadVisualState() {
        // Update visual state in pad selection modal
        const padItems = document.querySelectorAll('.pad-item');
        padItems.forEach(item => {
            const itemKey = item.dataset.key;
            
            // Remove all active states
            item.classList.remove('active', 'playing');
            
            // Add active state to current pad
            if (this.currentPad && itemKey === this.currentPad.key && this.padIsPlaying) {
                item.classList.add('active', 'playing');
            }
        });
        
        // Update PAD button state
        this.updatePadButtonState();
    }
    
    updatePadButtonState() {
        const padBtn = document.getElementById('padBtn');
        if (padBtn) {
            if (this.padIsPlaying && this.currentPad) {
                padBtn.classList.add('active');
                padBtn.setAttribute('aria-label', `PAD - ${this.currentPad.key}`);
            } else {
                padBtn.classList.remove('active');
                padBtn.setAttribute('aria-label', 'PAD');
            }
        }
    }
    
    async loadAndPlayPad(pad) {
        try {
            console.log('[PAD] Loading pad:', pad.file);
            
            // Cleanup old audio element and event listeners
            if (this.padAudioElement) {
                this.padAudioElement.pause();
                this.padAudioElement.src = '';
                // Remove event listeners by cloning
                const oldElement = this.padAudioElement;
                this.padAudioElement = null;
                oldElement.remove();
            }
            
            this.padAudioElement = new Audio();
            
            // Use the renamed folder without spaces
            const padPath = `pads_w.tracks/${encodeURIComponent(pad.file)}`;
            this.padAudioElement.src = padPath;
            console.log('[PAD] Trying path:', padPath);
            
            this.padAudioElement.loop = true; // Enable continuous loop
            
            // Wait for audio to load
            await new Promise((resolve, reject) => {
                this.padAudioElement.addEventListener('canplay', resolve, { once: true });
                this.padAudioElement.addEventListener('error', reject, { once: true });
                setTimeout(() => reject(new Error('Timeout loading pad audio')), 10000);
            });
            
            console.log('[PAD] Pad loaded successfully, duration:', this.padAudioElement.duration);
            
            // Ensure it starts from the beginning
            this.padAudioElement.currentTime = 0;
            
            // Store current pad info
            this.currentPad = pad;
            
            // Add pad as a track to the mixer
            this.addPadToMixer(pad);
            
            // Start playback immediately with fade-in (independent of player state)
            // Start with volume at 0 for fade-in
            if (this.padTrackNodes && this.padTrackNodes.gain) {
                this.padTrackNodes.gain.gain.value = 0;
            }
            
            this.padAudioElement.play();
            this.padIsPlaying = true;
            console.log('[PAD] Pad started playing independently, beginning fade-in');
            
            // Update PAD button visual state
            this.updatePadButtonState();
            
            // Perform fade-in
            await this.fadeInNewPad();
            
        } catch (error) {
            console.error('[PAD] Error loading pad:', error);
            alert('Erro ao carregar pad: ' + error.message);
        }
    }
    
    addPadToMixer(pad) {
        if (!this.audioPlayer || !this.mixerTracks) return;
        
        console.log('[PAD] Adding pad to mixer as track');
        
        // Check if pad track already exists in the project
        const existingPadTrack = this.currentProject?.tracks.find(t => t.id === 'pad-track');
        
        if (existingPadTrack) {
            // Update existing pad track name instead of re-rendering entire mixer
            existingPadTrack.name = `PAD - ${pad.key}`;
            existingPadTrack.volume = existingPadTrack.volume || 0.7;
            existingPadTrack.pan = existingPadTrack.pan || 0;
            
            // Update only the pad channel UI
            const padChannel = this.mixerTracks.querySelector(`[data-track-id="pad-track"]`);
            if (padChannel) {
                const trackName = padChannel.querySelector('.track-name');
                if (trackName) {
                    trackName.textContent = `PAD - ${pad.key}`;
                }
                
                // Update volume slider to reflect current volume
                const volumeInput = padChannel.querySelector('.fader-input');
                const thumb = padChannel.querySelector('.fader-thumb');
                const faderFill = padChannel.querySelector('.fader-fill');
                const dbValue = padChannel.querySelector('.track-db-value');
                
                if (volumeInput) {
                    const position = this.gainToPosition(existingPadTrack.volume);
                    const volumePercent = Math.round(position * 100);
                    volumeInput.value = volumePercent;
                    
                    if (thumb) thumb.style.bottom = `${volumePercent}%`;
                    if (faderFill) faderFill.style.height = `${volumePercent}%`;
                    
                    const db = this.positionToDb(position);
                    if (dbValue) dbValue.textContent = this.formatDbValue(db);
                }
            }
            
            // Setup pad audio nodes independently (NOT through player's track system)
            this.setupPadAudioNodes(existingPadTrack);
        } else {
            // Create a special pad track object
            const padTrack = {
                id: 'pad-track',
                name: `PAD - ${pad.key}`,
                volume: 0.7,
                pan: 0,
                mute: false,
                solo: false,
                isPad: true // Mark as special pad track
            };
            
            // Add to current project tracks temporarily for mixer display only
            if (this.currentProject) {
                this.currentProject.tracks.push(padTrack);
            }
            
            // Re-render mixer to include pad track (only on first pad selection)
            this.renderMixer();
            
            // Setup pad audio nodes independently (NOT through player's track system)
            this.setupPadAudioNodes(padTrack);
        }
    }
    
    // ========================================
    // MY TRACKS SYSTEM
    // ========================================
    
    initMyTracks() {
        console.log('[MY TRACKS] Initializing My Tracks system');

        // Creator signup modal
        this.creatorSignupModal = document.getElementById('creatorSignupModal');
        this.creatorSignupModalClose = document.getElementById('creatorSignupModalClose');
        this.startCreatorSignup = document.getElementById('startCreatorSignup');
        this.creatorSignupSubmit = document.getElementById('creatorSignupSubmit');
        this.creatorDisplayName = document.getElementById('creatorDisplayName');
        this.creatorTermsAgreement = document.getElementById('creatorTermsAgreement');

        // Profile photo upload
        this.creatorPhotoUploadArea = document.getElementById('creatorPhotoUploadArea');
        this.creatorPhotoInput = document.getElementById('creatorPhotoInput');
        this.creatorPhotoPlaceholder = document.getElementById('creatorPhotoPlaceholder');
        this.creatorPhotoPreview = document.getElementById('creatorPhotoPreview');
        this.creatorPhotoPreviewImage = document.getElementById('creatorPhotoPreviewImage');
        this.creatorPhotoRemoveBtn = document.getElementById('creatorPhotoRemoveBtn');
        this.selectedCreatorPhotoFile = null;
        this.uploadedCreatorPhotoUrl = null;

        // Add event listeners for creator signup
        this.startCreatorSignup?.addEventListener('click', () => this.openCreatorSignupModal());
        this.creatorSignupModalClose?.addEventListener('click', () => this.closeCreatorSignupModal());
        this.creatorSignupSubmit?.addEventListener('click', () => this.handleCreatorSignup());

        // Profile photo upload event listeners
        this.initCreatorPhotoUpload();

        // Click outside to close modal
        this.creatorSignupModal?.addEventListener('click', (e) => {
            if (e.target === this.creatorSignupModal) {
                this.closeCreatorSignupModal();
            }
        });

        // Add event listeners for track modal
        document.getElementById('addNewTrackBtn')?.addEventListener('click', () => this.openTrackModal());
        document.getElementById('emptyAddTrackBtn')?.addEventListener('click', () => this.openTrackModal());
        document.getElementById('trackModalClose')?.addEventListener('click', () => this.closeTrackModal());
        document.getElementById('trackModalCancel')?.addEventListener('click', () => this.closeTrackModal());
        document.getElementById('trackModalSave')?.addEventListener('click', () => this.saveTrack());
        
        // Payment info toggle (disabled for now - payment system in development)
        // document.getElementById('trackIsPaid')?.addEventListener('change', (e) => {
        //     const paymentSection = document.getElementById('paymentInfoSection');
        //     if (paymentSection) {
        //         paymentSection.style.display = e.target.checked ? 'block' : 'none';
        //     }
        // });
        
        // Image upload handling
        const uploadArea = document.getElementById('uploadArea');
        const coverInput = document.getElementById('coverInput');
        
        uploadArea?.addEventListener('click', () => coverInput?.click());
        
        uploadArea?.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        
        uploadArea?.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });
        
        uploadArea?.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file && this.validateImageFile(file)) {
                this.handleImageSelect(file);
            }
        });
        
        coverInput?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file && this.validateImageFile(file)) {
                this.handleImageSelect(file);
            }
        });
        
        // Cloudinary config
        this.CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/dkfe21jnc/image/upload';
        this.UPLOAD_PRESET = 'vizu_upload';
        this.MAX_SIZE = 5 * 1024 * 1024;
        this.selectedCoverFile = null;
    }

    // ========================================
    // SETLISTS SYSTEM
    // ========================================
    
    initSetlists() {
        console.log('[APP] Initializing Setlists system');
        
        if (typeof SetlistsManager !== 'undefined') {
            this.setlistsManager = new SetlistsManager(this);
            console.log('[APP] SetlistsManager created successfully');
        } else {
            console.error('[APP] SetlistsManager não está disponível');
        }
    }

    // ========================================
    // CREATOR SIGNUP SYSTEM
    // ========================================

    initCreatorPhotoUpload() {
        if (!this.creatorPhotoUploadArea) return;

        // Click to upload
        this.creatorPhotoUploadArea.addEventListener('click', () => {
            this.creatorPhotoInput.click();
        });

        // Drag and drop
        this.creatorPhotoUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.creatorPhotoUploadArea.classList.add('dragover');
        });

        this.creatorPhotoUploadArea.addEventListener('dragleave', () => {
            this.creatorPhotoUploadArea.classList.remove('dragover');
        });

        this.creatorPhotoUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.creatorPhotoUploadArea.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file && this.validateImageFile(file)) {
                this.handleCreatorPhotoSelect(file);
            }
        });

        // File input change
        this.creatorPhotoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file && this.validateImageFile(file)) {
                this.handleCreatorPhotoSelect(file);
            }
        });

        // Remove button
        this.creatorPhotoRemoveBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeCreatorPhoto();
        });
    }

    validateImageFile(file) {
        // Validate type
        if (!file.type.match(/image\/(jpeg|png|webp)/)) {
            alert('Por favor, selecione apenas arquivos JPG, PNG ou WEBP.');
            return false;
        }

        // Validate size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            alert('A imagem deve ter no máximo 5MB.');
            return false;
        }

        return true;
    }

    handleCreatorPhotoSelect(file) {
        this.selectedCreatorPhotoFile = file;

        // Show preview
        const reader = new FileReader();
        reader.onload = (e) => {
            this.creatorPhotoPreviewImage.src = e.target.result;
            this.creatorPhotoPlaceholder.style.display = 'none';
            this.creatorPhotoPreview.style.display = 'flex';
        };
        reader.readAsDataURL(file);
    }

    removeCreatorPhoto() {
        this.selectedCreatorPhotoFile = null;
        this.uploadedCreatorPhotoUrl = null;
        this.creatorPhotoInput.value = '';
        this.creatorPhotoPreviewImage.src = '';
        this.creatorPhotoPlaceholder.style.display = 'flex';
        this.creatorPhotoPreview.style.display = 'none';
    }

    async uploadCreatorPhotoToCloudinary(file) {
        const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/dkfe21jnc/image/upload';
        const UPLOAD_PRESET = 'vizu_upload';

        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', UPLOAD_PRESET);
        formData.append('quality', 'auto');
        formData.append('fetch_format', 'auto');

        try {
            const response = await fetch(CLOUDINARY_URL, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error('Erro no upload da imagem');
            }

            const data = await response.json();
            return data.secure_url;
        } catch (error) {
            console.error('[CREATOR SIGNUP] Error uploading photo:', error);
            throw error;
        }
    }

    async openCreatorSignupModal() {
        // Check plan restriction - Home users cannot create creator accounts
        const isStudio = await this.isStudioPlan();
        if (!isStudio) {
            this.showUpgradeModal('Minhas Tracks');
            return;
        }

        if (this.creatorSignupModal) {
            this.creatorSignupModal.classList.add('active');
            // Reset form
            this.removeCreatorPhoto();
            // Pre-fill with current user data if available
            const currentUser = window.firebaseAuth && window.firebaseAuth.auth && window.firebaseAuth.auth.currentUser;
            if (currentUser && this.creatorDisplayName) {
                let displayName = currentUser.displayName;
                // Fallback to email only if displayName is still null/undefined (not empty string)
                if (!displayName || displayName.trim() === '') {
                    displayName = currentUser.email.split('@')[0];
                }
                this.creatorDisplayName.value = displayName || '';
            }
        }
    }

    closeCreatorSignupModal() {
        if (this.creatorSignupModal) {
            this.creatorSignupModal.classList.remove('active');
            // Reset photo upload state
            this.removeCreatorPhoto();
        }
    }

    async handleCreatorSignup() {
        const displayName = this.creatorDisplayName?.value?.trim();
        const termsAgreed = this.creatorTermsAgreement?.checked;

        // Validation
        if (!displayName) {
            alert('Por favor, insira seu nome de exibição.');
            return;
        }

        if (!termsAgreed) {
            alert('Você precisa concordar com os termos de direitos autorais para se inscrever como criador.');
            return;
        }

        const currentUser = window.firebaseAuth && window.firebaseAuth.auth && window.firebaseAuth.auth.currentUser;
        if (!currentUser) {
            alert('Você precisa estar logado para se inscrever como criador.');
            return;
        }

        try {
            // Upload profile photo if selected
            let profilePhotoUrl = null;
            if (this.selectedCreatorPhotoFile) {
                profilePhotoUrl = await this.uploadCreatorPhotoToCloudinary(this.selectedCreatorPhotoFile);
                this.uploadedCreatorPhotoUrl = profilePhotoUrl;
            }

            // Update Firebase Auth displayName
            if (currentUser.updateProfile) {
                await currentUser.updateProfile({
                    displayName: displayName
                });
                console.log('[CREATOR SIGNUP] Firebase Auth displayName updated:', displayName);
            }

            // Save creator data to Firestore
            if (window.firebaseDB) {
                const { db, collection, doc, setDoc, serverTimestamp } = window.firebaseDB;

                const creatorData = {
                    uid: currentUser.uid,
                    displayName: displayName,
                    email: currentUser.email,
                    profilePhoto: profilePhotoUrl || null,
                    isCreator: true,
                    creatorSignupDate: serverTimestamp(),
                    termsAgreed: true,
                    termsAgreedDate: serverTimestamp()
                };

                await setDoc(doc(db, 'creators', currentUser.uid), creatorData);
                console.log('[CREATOR SIGNUP] Creator data saved to Firestore');

                // Also update user profile
                await setDoc(doc(db, 'users', currentUser.uid), {
                    displayName: displayName,
                    email: currentUser.email,
                    profilePhoto: profilePhotoUrl || null,
                    isCreator: true,
                    updatedAt: serverTimestamp()
                }, { merge: true });

                alert('Inscrição realizada com sucesso! Você agora pode publicar suas tracks.');
                this.closeCreatorSignupModal();

                // Update UI and reload view
                this.updateUserProfile(currentUser);
                this.checkCreatorSignup();
            }
        } catch (error) {
            console.error('[CREATOR SIGNUP] Error:', error);
            alert('Erro ao realizar inscrição: ' + error.message);
        }
    }

    async checkCreatorSignup() {
        const currentUser = window.firebaseAuth && window.firebaseAuth.auth && window.firebaseAuth.auth.currentUser;
        if (!currentUser) return;

        const creatorSignupSection = document.getElementById('creatorSignupSection');
        const tracksManagementSection = document.getElementById('tracksManagementSection');

        try {
            if (window.firebaseDB) {
                const { db, doc, getDoc } = window.firebaseDB;
                const creatorDoc = await getDoc(doc(db, 'creators', currentUser.uid));

                if (creatorDoc.exists()) {
                    // User is signed up as creator
                    console.log('[CREATOR SIGNUP] User is a creator');
                    if (creatorSignupSection) creatorSignupSection.style.display = 'none';
                    if (tracksManagementSection) tracksManagementSection.style.display = 'block';
                    this.loadMyTracks();
                } else {
                    // User is not signed up as creator
                    console.log('[CREATOR SIGNUP] User is not a creator');
                    if (creatorSignupSection) creatorSignupSection.style.display = 'flex';
                    if (tracksManagementSection) tracksManagementSection.style.display = 'none';
                }
            }
        } catch (error) {
            console.error('[CREATOR SIGNUP] Error checking creator status:', error);
            // Show signup section on error
            if (creatorSignupSection) creatorSignupSection.style.display = 'flex';
            if (tracksManagementSection) tracksManagementSection.style.display = 'none';
        }
    }
    
    async switchToMyTracks() {
        // Check if user is logged in using Firebase Auth
        const isUserLoggedIn = window.firebaseAuth && window.firebaseAuth.auth && window.firebaseAuth.auth.currentUser;

        if (!isUserLoggedIn) {
            this.openAuthModal();
            return;
        }

        // Check plan restriction - Home users cannot access Minhas Tracks
        const isStudio = await this.isStudioPlan();
        if (!isStudio) {
            this.showUpgradeModal('Minhas Tracks');
            return;
        }

        // Show loading screen for My Tracks
        const myTracksSplashScreen = document.getElementById('myTracksSplashScreen');
        if (myTracksSplashScreen) {
            myTracksSplashScreen.style.display = 'flex';
            myTracksSplashScreen.classList.remove('hidden');
        }

        // Switch to myTracks view directly without plan restriction
        const views = ['libraryView', 'communityView', 'exploreView', 'myTracksView', 'setlistsView'];
        views.forEach(viewId => {
            const viewElement = document.getElementById(viewId);
            if (viewElement) viewElement.style.display = 'none';
        });

        const myTracksView = document.getElementById('myTracksView');
        if (myTracksView) {
            myTracksView.style.display = 'block';
        }

        // Hide loading screen after 2 seconds
        setTimeout(() => {
            if (myTracksSplashScreen) {
                myTracksSplashScreen.classList.add('hidden');
                setTimeout(() => {
                    myTracksSplashScreen.style.display = 'none';
                }, 500);
            }
        }, 2000);

        // Check if user is signed up as creator
        this.checkCreatorSignup();
    }
    
    async loadMyTracks() {
        if (!window.firebaseDB) {
            console.warn('[MY TRACKS] Firebase not available');
            return;
        }
        
        try {
            // Get current user from Firebase Auth
            const currentUser = window.firebaseAuth && window.firebaseAuth.auth && window.firebaseAuth.auth.currentUser;
            
            if (!currentUser || !currentUser.email) {
                console.warn('[MY TRACKS] No logged in user');
                return;
            }
            
            const q = window.firebaseDB.query(
                window.firebaseDB.collection(window.firebaseDB.db, 'communityTracks'),
                window.firebaseDB.where('authorEmail', '==', currentUser.email)
            );
            
            const querySnapshot = await window.firebaseDB.getDocs(q);
            const tracks = [];
            
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                tracks.push({
                    id: doc.id,
                    ...data
                });
            });
            
            // Sort by createdAt in descending order on client side
            tracks.sort((a, b) => {
                const dateA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt || 0);
                const dateB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt || 0);
                return dateB - dateA;
            });
            
            console.log('[MY TRACKS] Loaded', tracks.length, 'tracks for user');
            this.renderMyTracks(tracks);
        } catch (error) {
            console.error('[MY TRACKS] Error loading tracks:', error);
        }
    }
    
    renderMyTracks(tracks) {
        const grid = document.getElementById('myTracksGrid');
        const emptyState = document.getElementById('myTracksEmptyState');
        const countElement = document.getElementById('myTracksCount');
        
        countElement.textContent = `${tracks.length} track${tracks.length !== 1 ? 's' : ''}`;
        
        if (tracks.length === 0) {
            grid.innerHTML = '';
            emptyState.style.display = 'flex';
            return;
        }
        
        emptyState.style.display = 'none';
        grid.innerHTML = '';
        
        tracks.forEach(track => {
            const cardWrapper = document.createElement('div');
            cardWrapper.innerHTML = this.createMyTrackCard(track);
            const card = cardWrapper.firstElementChild;
            
            // Add event listeners
            const editBtn = card.querySelector('.btn-secondary');
            const deleteBtn = card.querySelector('.btn-danger');
            
            if (editBtn) {
                editBtn.addEventListener('click', () => this.editTrack(track.id));
            }
            
            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => this.deleteTrack(track.id));
            }
            
            grid.appendChild(card);
        });
    }
    
    createMyTrackCard(track) {
        const coverHtml = track.coverUrl
            ? `<img src="${track.coverUrl}" alt="${this.escapeHtml(track.name)}">`
            : `
                <div class="community-card-cover-placeholder">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M9 18V5l12-2v13"></path>
                        <circle cx="6" cy="18" r="3"></circle>
                        <circle cx="18" cy="16" r="3"></circle>
                    </svg>
                </div>
            `;

        const statusBadge = track.published
            ? '<div class="community-card-featured" style="background: linear-gradient(135deg, #10b981, #059669);">Publicado</div>'
            : '<div class="community-card-featured" style="background: linear-gradient(135deg, #6b7280, #4b5563);">Rascunho</div>';

        // Author avatar
        const authorName = track.authorName || 'Você';
        let authorAvatarHtml;
        if (track.authorAvatar) {
            authorAvatarHtml = `<img src="${track.authorAvatar}" alt="${this.escapeHtml(authorName)}" class="community-card-author-avatar">`;
        } else {
            authorAvatarHtml = `<div class="community-card-author-avatar-placeholder">${authorName.charAt(0).toUpperCase()}</div>`;
        }

        return `
            <div class="community-card">
                <div class="community-card-cover">
                    ${coverHtml}
                    ${statusBadge}
                </div>
                <div class="community-card-content">
                    <h3 class="community-card-title">${this.escapeHtml(track.name)}</h3>
                    <div class="community-card-author">
                        ${authorAvatarHtml}
                        <span>por ${this.escapeHtml(authorName)}</span>
                    </div>
                    <div class="community-card-meta">
                        <div class="community-card-meta-row">
                            <span>${this.escapeHtml(track.artist)}</span>
                        </div>
                        <div class="community-card-meta-row">
                            <span class="community-card-key">${track.key}</span>
                            <span>•</span>
                            <span>${track.bpm} BPM</span>
                        </div>
                        <div class="community-card-meta-row">
                            <span class="community-card-stems">${track.stems} stems</span>
                            <span>•</span>
                            <span>${track.downloads || 0} downloads</span>
                        </div>
                        <div class="community-card-genre">${Array.isArray(track.genre) ? track.genre.join(', ') : track.genre}</div>
                    </div>
                    <div style="display:flex;gap:8px;margin-top:12px;">
                        <button class="btn btn-secondary" style="flex:1;padding:8px;font-size:0.85rem;" onclick="window.currentApp.editTrack('${track.id}')">Editar</button>
                        <button class="btn btn-danger" style="flex:1;padding:8px;font-size:0.85rem;" onclick="window.currentApp.deleteTrack('${track.id}')">Excluir</button>
                    </div>
                </div>
            </div>
        `;
    }
    
    openTrackModal(trackId = null) {
        // Check if user is signed up as creator before allowing track creation
        if (!trackId) {
            const currentUser = window.firebaseAuth && window.firebaseAuth.auth && window.firebaseAuth.auth.currentUser;
            if (currentUser) {
                // Check creator status
                this.checkCreatorSignupForModal().then(isCreator => {
                    if (!isCreator) {
                        // Show signup modal instead
                        this.openCreatorSignupModal();
                        return;
                    }
                    // Proceed with opening track modal
                    this.proceedWithTrackModal(trackId);
                });
                return;
            }
        }

        // For editing existing tracks or if check passed, proceed
        this.proceedWithTrackModal(trackId);
    }

    async checkCreatorSignupForModal() {
        const currentUser = window.firebaseAuth && window.firebaseAuth.auth && window.firebaseAuth.auth.currentUser;
        if (!currentUser) return false;

        try {
            if (window.firebaseDB) {
                const { db, doc, getDoc } = window.firebaseDB;
                const creatorDoc = await getDoc(doc(db, 'creators', currentUser.uid));
                return creatorDoc.exists();
            }
        } catch (error) {
            console.error('[CREATOR SIGNUP] Error checking creator status:', error);
        }
        return false;
    }

    proceedWithTrackModal(trackId) {
        const modal = document.getElementById('trackModal');
        const form = document.getElementById('trackForm');
        const title = document.getElementById('trackModalTitle');

        form.reset();
        document.getElementById('trackId').value = '';
        document.getElementById('trackCoverUrl').value = '';
        this.selectedCoverFile = null;
        this.resetUploadPreview();
        document.getElementById('paymentInfoSection').style.display = 'none';

        if (trackId) {
            // Edit existing track
            this.loadTrackForEdit(trackId);
            title.textContent = 'Editar Track';
        } else {
            // Create new track
            title.textContent = 'Nova Track';
        }

        modal.classList.add('active');
    }
    
    async loadTrackForEdit(trackId) {
        if (!window.firebaseDB) return;
        
        try {
            const docRef = window.firebaseDB.doc(window.firebaseDB.db, 'communityTracks', trackId);
            const docSnap = await window.firebaseDB.getDoc(docRef);
            
            if (docSnap.exists()) {
                const track = docSnap.data();
                
                document.getElementById('trackId').value = trackId;
                document.getElementById('trackName').value = track.name;
                document.getElementById('trackArtist').value = track.artist;
                document.getElementById('trackKey').value = track.key;
                document.getElementById('trackBpm').value = track.bpm;
                document.getElementById('trackStems').value = track.stems;
                document.getElementById('trackDownloadUrl').value = track.downloadUrl;
                document.getElementById('trackPublished').checked = track.published;
                document.getElementById('trackIsPaid').checked = track.isPaid || false;
                document.getElementById('trackPrice').value = track.price || '';
                document.getElementById('trackPaymentInfo').value = track.paymentInfo || '';
                
                if (track.isPaid) {
                    document.getElementById('paymentInfoSection').style.display = 'block';
                }
                
                // Load genres
                const genres = Array.isArray(track.genre) ? track.genre : [track.genre].filter(g => g);
                document.querySelectorAll('input[name="trackGenre"]').forEach(checkbox => {
                    checkbox.checked = genres.includes(checkbox.value);
                });
                
                if (track.coverUrl) {
                    document.getElementById('trackCoverUrl').value = track.coverUrl;
                    this.showUploadPreview(track.coverUrl);
                }
            }
        } catch (error) {
            console.error('[MY TRACKS] Error loading track for edit:', error);
        }
    }
    
    closeTrackModal() {
        document.getElementById('trackModal').classList.remove('active');
    }
    
    async saveTrack() {
        const form = document.getElementById('trackForm');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }
        
        // Check copyright agreement
        const copyrightAgreement = document.getElementById('copyrightAgreement');
        if (!copyrightAgreement.checked) {
            alert('Você precisa concordar com os termos de direitos autorais para continuar.');
            return;
        }
        
        const trackId = document.getElementById('trackId').value;
        
        // Get current user from Firebase Auth
        const currentUser = window.firebaseAuth && window.firebaseAuth.auth && window.firebaseAuth.auth.currentUser;
        
        if (!currentUser) {
            alert('Você precisa estar logado para salvar uma track.');
            this.openAuthModal();
            return;
        }
        
        // Get selected genres as array
        const selectedGenres = [];
        document.querySelectorAll('input[name="trackGenre"]:checked').forEach(checkbox => {
            selectedGenres.push(checkbox.value);
        });
        
        // Get creator profile data for avatar and display name
        let authorAvatar = null;
        let authorDisplayName = null;
        try {
            if (window.firebaseDB) {
                const { db, doc, getDoc } = window.firebaseDB;
                const creatorDoc = await getDoc(doc(db, 'creators', currentUser.uid));
                if (creatorDoc.exists()) {
                    const creatorData = creatorDoc.data();
                    authorAvatar = creatorData.profilePhoto || null;
                    authorDisplayName = creatorData.displayName || null;
                }
            }
        } catch (error) {
            console.warn('[MY TRACKS] Could not fetch creator profile:', error);
        }

        const trackData = {
            name: document.getElementById('trackName').value,
            artist: document.getElementById('trackArtist').value,
            genre: selectedGenres,
            key: document.getElementById('trackKey').value,
            bpm: parseInt(document.getElementById('trackBpm').value),
            stems: parseInt(document.getElementById('trackStems').value),
            downloadUrl: document.getElementById('trackDownloadUrl').value,
            published: document.getElementById('trackPublished').checked,
            // Payment system disabled - all tracks are free for now
            isPaid: false,
            price: 0,
            paymentInfo: '',
            authorName: authorDisplayName || currentUser.displayName || currentUser.email.split('@')[0],
            authorEmail: currentUser.email,
            authorAvatar: authorAvatar, // Use creator profile photo
            userId: currentUser.uid, // Add userId for profile linking
            isOfficial: false, // Regular user tracks are not official
            updatedAt: window.firebaseDB.serverTimestamp()
        };
        
        // Upload cover image if selected
        if (this.selectedCoverFile) {
            try {
                const coverUrl = await this.uploadImageToCloudinary(this.selectedCoverFile);
                trackData.coverUrl = coverUrl;
            } catch (error) {
                alert('Erro ao fazer upload da capa: ' + error.message);
                return;
            }
        } else if (!trackId) {
            // New track without cover - use placeholder
            trackData.coverUrl = '';
        }
        
        try {
            if (trackId) {
                // Update existing track
                await window.firebaseDB.updateDoc(
                    window.firebaseDB.doc(window.firebaseDB.db, 'communityTracks', trackId),
                    trackData
                );
                console.log('[MY TRACKS] Track updated:', trackId);
            } else {
                // Create new track
                trackData.createdAt = window.firebaseDB.serverTimestamp();
                trackData.downloads = 0;
                trackData.featured = false;
                
                await window.firebaseDB.addDoc(
                    window.firebaseDB.collection(window.firebaseDB.db, 'communityTracks'),
                    trackData
                );
                console.log('[MY TRACKS] Track created');
            }
            
            this.closeTrackModal();
            this.loadMyTracks();
        } catch (error) {
            console.error('[MY TRACKS] Error saving track:', error);
            alert('Erro ao salvar track: ' + error.message);
        }
    }
    
    editTrack(trackId) {
        this.openTrackModal(trackId);
    }
    
    async deleteTrack(trackId) {
        if (!confirm('Tem certeza que deseja excluir esta track? Esta ação não pode ser desfeita.')) return;
        
        try {
            await window.firebaseDB.deleteDoc(
                window.firebaseDB.doc(window.firebaseDB.db, 'communityTracks', trackId)
            );
            console.log('[MY TRACKS] Track deleted:', trackId);
            this.loadMyTracks();
        } catch (error) {
            console.error('[MY TRACKS] Error deleting track:', error);
            alert('Erro ao excluir track: ' + error.message);
        }
    }
    
    validateImageFile(file) {
        if (!file.type.match(/image\/(jpeg|png|webp)/)) {
            alert('Por favor, selecione apenas arquivos JPG, PNG ou WEBP.');
            return false;
        }
        
        if (file.size > this.MAX_SIZE) {
            alert('O arquivo é muito grande. Máximo 5MB.');
            return false;
        }
        
        return true;
    }
    
    handleImageSelect(file) {
        this.selectedCoverFile = file;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            this.showUploadPreview(e.target.result);
        };
        reader.readAsDataURL(file);
    }
    
    showUploadPreview(imageSrc) {
        const placeholder = document.getElementById('uploadPlaceholder');
        const preview = document.getElementById('uploadPreview');
        const previewImage = document.getElementById('previewImage');
        const fileInfo = document.getElementById('fileInfo');
        
        if (this.selectedCoverFile) {
            fileInfo.textContent = `${this.selectedCoverFile.name} (${this.formatFileSize(this.selectedCoverFile.size)})`;
        }
        
        previewImage.src = imageSrc;
        placeholder.style.display = 'none';
        preview.style.display = 'block';
    }
    
    resetUploadPreview() {
        const placeholder = document.getElementById('uploadPlaceholder');
        const preview = document.getElementById('uploadPreview');
        
        placeholder.style.display = 'block';
        preview.style.display = 'none';
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    async uploadImageToCloudinary(file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', this.UPLOAD_PRESET);
        
        const response = await fetch(this.CLOUDINARY_URL, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('Upload failed');
        }
        
        const data = await response.json();
        return data.secure_url;
    }
    
    async setupPadAudioNodes(padTrack) {
        if (!this.audioPlayer || !this.audioPlayer.audioContext) {
            console.warn('[PAD] AudioContext not available, deferring pad node setup');
            return;
        }
        
        try {
            console.log('[PAD] Setting up audio nodes for pad track');
            
            // Create track nodes using player's audio context
            const audioContext = this.audioPlayer.audioContext;
            
            // Create gain node
            const padGain = audioContext.createGain();
            
            // Check if should start muted (mute or solo-muted)
            const hasSoloTracks = this.currentProject?.tracks.some(t => t.solo) || false;
            const shouldMute = padTrack.mute || (hasSoloTracks && !padTrack.solo);
            
            padGain.gain.value = shouldMute ? 0 : padTrack.volume;
            
            // Create panner
            const padPanner = audioContext.createStereoPanner();
            padPanner.pan.value = padTrack.pan;
            
            // Create analyser for level meter
            const padAnalyser = audioContext.createAnalyser();
            padAnalyser.fftSize = 256;
            padAnalyser.smoothingTimeConstant = 0.8;
            
            // Create media element source
            const padMediaSource = audioContext.createMediaElementSource(this.padAudioElement);
            
            // Connect: mediaElement -> gain -> panner -> analyser -> masterGain
            padMediaSource.connect(padGain);
            padGain.connect(padPanner);
            padPanner.connect(padAnalyser);
            padAnalyser.connect(this.audioPlayer.masterGain);
            
            // Store nodes ONLY in pad-specific storage (NOT in player's trackNodes)
            // This prevents the player from trying to synchronize the pad with other tracks
            this.padTrackNodes = {
                audioElement: this.padAudioElement,
                mediaSource: padMediaSource,
                gain: padGain,
                panner: padPanner,
                analyser: padAnalyser
            };
            
            console.log('[PAD] Pad audio nodes setup complete');
        } catch (error) {
            console.error('[PAD] Error setting up pad audio nodes:', error);
        }
    }
    
    stopPad() {
        // Cancel any ongoing fade timers
        if (this.padFadeOutTimer) {
            cancelAnimationFrame(this.padFadeOutTimer);
            this.padFadeOutTimer = null;
        }
        if (this.padFadeInTimer) {
            cancelAnimationFrame(this.padFadeInTimer);
            this.padFadeInTimer = null;
        }
        
        if (this.padAudioElement) {
            this.padAudioElement.pause();
            this.padAudioElement.currentTime = 0;
        }
        this.padIsPlaying = false;
        console.log('[PAD] Pad stopped');
    }
    
    removePadFromMixer() {
        if (!this.currentProject) return;
        
        // Cancel any ongoing fade timers
        if (this.padFadeOutTimer) {
            cancelAnimationFrame(this.padFadeOutTimer);
            this.padFadeOutTimer = null;
        }
        if (this.padFadeInTimer) {
            cancelAnimationFrame(this.padFadeInTimer);
            this.padFadeInTimer = null;
        }
        
        // Remove pad track from project
        this.currentProject.tracks = this.currentProject.tracks.filter(t => t.id !== 'pad-track');
        
        // Cleanup audio nodes
        if (this.padTrackNodes) {
            if (this.padTrackNodes.mediaSource) {
                this.padTrackNodes.mediaSource.disconnect();
            }
            if (this.padTrackNodes.gain) {
                this.padTrackNodes.gain.disconnect();
            }
            if (this.padTrackNodes.panner) {
                this.padTrackNodes.panner.disconnect();
            }
            if (this.padTrackNodes.analyser) {
                this.padTrackNodes.analyser.disconnect();
            }
            this.padTrackNodes = null;
        }
        
        // Stop and cleanup audio element
        if (this.padAudioElement) {
            this.padAudioElement.pause();
            this.padAudioElement.src = '';
            this.padAudioElement = null;
        }
        
        this.currentPad = null;
        this.padIsPlaying = false;
        
        // Remove only the pad channel from mixer without re-rendering everything
        const padChannel = this.mixerTracks.querySelector(`[data-track-id="pad-track"]`);
        if (padChannel) {
            padChannel.remove();
        }
        
        console.log('[PAD] Pad removed from mixer');
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.multracksApp = new MultracksApp();
});
