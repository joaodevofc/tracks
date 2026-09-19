/**
 * NOVO SISTEMA DE SETLIST - ETAPA 1
 * Sistema de Repertórios isolado do sistema existente
 */

class RepertoireManager {
    constructor() {
        this.repertoires = [];
        this.currentRepertoire = null;
        this.currentUser = null;
        this.db = null;
        this.auth = null;
        this.currentYoutubeSongId = null;
        this.currentYoutubeSongName = null;
        this.currentEditingSongId = null;
        
        // Individual song player state
        this.youtubePlayer = null;
        this.activeSongIndex = -1;
        this.songPlayers = {};
        
        this.init();
    }

    async init() {
        console.log('[REPERTÓRIOS] Inicializando novo sistema de repertórios');
        
        // Aguardar Firebase estar disponível
        await this.waitForFirebase();
        
        // Configurar referências do Firebase
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
        
        if (window.firebaseAuth) {
            this.auth = window.firebaseAuth.auth;
            this.onAuthStateChanged = window.firebaseAuth.onAuthStateChanged;
        }
        
        // Monitorar estado de autenticação
        this.monitorAuthState();
        
        // Inicializar event listeners
        this.initEventListeners();
    }

    async waitForFirebase() {
        const maxAttempts = 50;
        let attempts = 0;
        
        while (attempts < maxAttempts) {
            if (window.firebaseDB && window.firebaseAuth) {
                console.log('[REPERTÓRIOS] Firebase disponível');
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        console.error('[REPERTÓRIOS] Firebase não disponível após timeout');
        return false;
    }

    monitorAuthState() {
        if (!this.onAuthStateChanged || !this.auth) {
            console.warn('[REPERTÓRIOS] Auth não disponível');
            return;
        }

        this.onAuthStateChanged(this.auth, (user) => {
            this.currentUser = user;
            console.log('[REPERTÓRIOS] Estado de autenticação alterado:', user ? user.email : 'não logado');
            
            if (user) {
                this.loadRepertoires();
                this.updateUserDisplay(user);
            } else {
                this.repertoires = [];
                this.renderRepertoires();
                this.redirectToLogin();
            }
        });
    }

    updateUserDisplay(user) {
        const userInitial = document.getElementById('userInitial');
        if (userInitial && user.email) {
            userInitial.textContent = user.email.charAt(0).toUpperCase();
        }
    }

    redirectToLogin() {
        // Redirecionar para index.html se não estiver logado
        if (!this.currentUser) {
            console.log('[REPERTÓRIOS] Usuário não logado, redirecionando para login');
            window.location.href = 'index.html';
        }
    }

    getCurrentUserId() {
        return this.currentUser ? this.currentUser.uid : null;
    }

    initEventListeners() {
        console.log('[REPERTÓRIOS] Configurando event listeners');
        
        // Botão criar repertório
        const createBtn = document.getElementById('createRepertoireBtn');
        if (createBtn) {
            createBtn.addEventListener('click', () => this.showCreateRepertoireModal());
        }
        
        // Modal criar repertório
        const closeCreateModal = document.getElementById('closeCreateRepertoireModal');
        if (closeCreateModal) {
            closeCreateModal.addEventListener('click', () => this.hideCreateRepertoireModal());
        }
        
        const createModal = document.getElementById('createRepertoireModal');
        if (createModal) {
            createModal.addEventListener('click', (e) => {
                if (e.target === createModal) {
                    this.hideCreateRepertoireModal();
                }
            });
        }
        
        const createForm = document.getElementById('createRepertoireForm');
        if (createForm) {
            createForm.addEventListener('submit', (e) => this.handleCreateRepertoire(e));
        }
        
        // Botão voltar
        const backBtn = document.getElementById('backToRepertoiresBtn');
        if (backBtn) {
            backBtn.addEventListener('click', () => this.showRepertoiresListView());
        }
        
        // Botão excluir
        const deleteBtn = document.getElementById('deleteRepertoireBtn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => this.showDeleteConfirmModal());
        }
        
        // Botão compartilhar
        const shareBtn = document.getElementById('shareRepertoireBtn');
        if (shareBtn) {
            shareBtn.addEventListener('click', () => this.showShareModal());
        }
        
        // Modal de confirmação de exclusão
        const closeDeleteModal = document.getElementById('closeDeleteConfirmModal');
        if (closeDeleteModal) {
            closeDeleteModal.addEventListener('click', () => this.hideDeleteConfirmModal());
        }
        
        const deleteModal = document.getElementById('deleteConfirmModal');
        if (deleteModal) {
            deleteModal.addEventListener('click', (e) => {
                if (e.target === deleteModal) {
                    this.hideDeleteConfirmModal();
                }
            });
        }
        
        const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
        if (cancelDeleteBtn) {
            cancelDeleteBtn.addEventListener('click', () => this.hideDeleteConfirmModal());
        }
        
        const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
        if (confirmDeleteBtn) {
            confirmDeleteBtn.addEventListener('click', () => this.handleDeleteRepertoire());
        }
        
        // Botão adicionar música
        const addSongBtn = document.getElementById('addSongBtn');
        if (addSongBtn) {
            addSongBtn.addEventListener('click', () => this.addManualSong());
        }

        // Modal de busca do YouTube
        const closeYoutubeSearchModal = document.getElementById('closeYoutubeSearchModal');
        if (closeYoutubeSearchModal) {
            closeYoutubeSearchModal.addEventListener('click', () => this.hideYoutubeSearchModal());
        }

        const youtubeSearchModal = document.getElementById('youtubeSearchModal');
        if (youtubeSearchModal) {
            youtubeSearchModal.addEventListener('click', (e) => {
                if (e.target === youtubeSearchModal) {
                    this.hideYoutubeSearchModal();
                }
            });
        }

        const youtubeSearchBtn = document.getElementById('youtubeSearchBtn');
        if (youtubeSearchBtn) {
            youtubeSearchBtn.addEventListener('click', () => this.handleYoutubeSearch());
        }

        const youtubeSearchInput = document.getElementById('youtubeSearchInput');
        if (youtubeSearchInput) {
            youtubeSearchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleYoutubeSearch();
                }
            });
        }

        // Modal do player do YouTube
        const closeYoutubePlayerModal = document.getElementById('closeYoutubePlayerModal');
        if (closeYoutubePlayerModal) {
            closeYoutubePlayerModal.addEventListener('click', () => this.hideYoutubePlayerModal());
        }

        const youtubePlayerModal = document.getElementById('youtubePlayerModal');
        if (youtubePlayerModal) {
            youtubePlayerModal.addEventListener('click', (e) => {
                if (e.target === youtubePlayerModal) {
                    this.hideYoutubePlayerModal();
                }
            });
        }

        // Modal de detalhes da música
        const closeSongDetailsModal = document.getElementById('closeSongDetailsModal');
        if (closeSongDetailsModal) {
            closeSongDetailsModal.addEventListener('click', () => this.hideSongDetailsModal());
        }

        const songDetailsModal = document.getElementById('songDetailsModal');
        if (songDetailsModal) {
            songDetailsModal.addEventListener('click', (e) => {
                if (e.target === songDetailsModal) {
                    this.hideSongDetailsModal();
                }
            });
        }

        // Modal de compartilhamento
        const closeShareModal = document.getElementById('closeShareModal');
        if (closeShareModal) {
            closeShareModal.addEventListener('click', () => this.hideShareModal());
        }

        const shareModal = document.getElementById('shareModal');
        if (shareModal) {
            shareModal.addEventListener('click', (e) => {
                if (e.target === shareModal) {
                    this.hideShareModal();
                }
            });
        }

        const copyLinkBtn = document.getElementById('copyLinkBtn');
        if (copyLinkBtn) {
            copyLinkBtn.addEventListener('click', () => this.copyShareLink());
        }

        // Autosave com debounce para detalhes da música
        const keyInput = document.getElementById('songDetailsKey');
        const bpmInput = document.getElementById('songDetailsBpm');
        const notesInput = document.getElementById('songDetailsNotes');

        if (keyInput) {
            keyInput.addEventListener('input', this.debounce(() => this.saveSongDetails(), 1000));
        }
        if (bpmInput) {
            bpmInput.addEventListener('input', this.debounce(() => this.saveSongDetails(), 1000));
        }
        if (notesInput) {
            notesInput.addEventListener('input', this.debounce(() => this.saveSongDetails(), 1000));
        }
        
        // Botão de perfil
        const profileBtn = document.getElementById('profileBtn');
        if (profileBtn) {
            profileBtn.addEventListener('click', () => {
                window.location.href = 'index.html';
            });
        }
    }

    async loadRepertoires() {
        const userId = this.getCurrentUserId();
        
        if (!userId) {
            console.log('[REPERTÓRIOS] Nenhum usuário logado');
            this.repertoires = [];
            this.renderRepertoires();
            return;
        }
        
        if (!this.db) {
            console.warn('[REPERTÓRIOS] Firebase não disponível');
            this.repertoires = [];
            this.renderRepertoires();
            return;
        }
        
        try {
            console.log('[REPERTÓRIOS] Carregando repertórios do usuário:', userId);
            
            const q = this.query(
                this.collection(this.db, 'repertorios'),
                this.where('userId', '==', userId)
            );
            
            const querySnapshot = await this.getDocs(q);
            this.repertoires = [];
            
            console.log('[REPERTÓRIOS] Encontrados', querySnapshot.size, 'repertórios');
            
            for (const doc of querySnapshot.docs) {
                const data = doc.data();
                this.repertoires.push({
                    id: doc.id,
                    name: data.name,
                    date: data.date,
                    songs: data.songs || [],
                    createdAt: data.createdAt?.toDate() || new Date(),
                    updatedAt: data.updatedAt?.toDate() || new Date()
                });
                console.log('[REPERTÓRIOS] Repertório carregado:', data.name);
            }
            
            // Ordenar por data (mais recente primeiro)
            this.repertoires.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            this.renderRepertoires();
        } catch (error) {
            console.error('[REPERTÓRIOS] Erro ao carregar repertórios:', error);
            this.repertoires = [];
            this.renderRepertoires();
        }
    }

    renderRepertoires() {
        console.log('[REPERTÓRIOS] Renderizando', this.repertoires.length, 'repertórios');
        
        const repertoiresList = document.getElementById('repertoiresList');
        const noRepertoires = document.getElementById('noRepertoires');
        
        if (!repertoiresList) {
            console.error('[REPERTÓRIOS] Elemento repertoiresList não encontrado');
            return;
        }
        
        if (this.repertoires.length === 0) {
            repertoiresList.style.display = 'none';
            noRepertoires.style.display = 'block';
            return;
        }
        
        repertoiresList.style.display = 'grid';
        noRepertoires.style.display = 'none';
        
        repertoiresList.innerHTML = this.repertoires.map(repertoire => this.createRepertoireCard(repertoire)).join('');
        
        // Adicionar event listeners aos cards
        repertoiresList.querySelectorAll('.repertoire-card').forEach(card => {
            card.addEventListener('click', () => {
                const repertoireId = card.dataset.repertoireId;
                this.openRepertoire(repertoireId);
            });
        });
    }

    createRepertoireCard(repertoire) {
        const formattedDate = this.formatDate(repertoire.date);
        const songCount = repertoire.songs?.length || 0;
        
        return `
            <div class="repertoire-card" data-repertoire-id="${repertoire.id}">
                <div class="repertoire-card-header">
                    <div>
                        <h3 class="repertoire-card-title">${this.escapeHtml(repertoire.name)}</h3>
                        <p class="repertoire-card-date">${formattedDate}</p>
                    </div>
                </div>
                <p class="repertoire-card-count">${songCount} música${songCount !== 1 ? 's' : ''}</p>
                <button class="repertoire-card-open-btn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M5 12h14"></path>
                        <path d="M12 5l7 7-7 7"></path>
                    </svg>
                    Abrir
                </button>
            </div>
        `;
    }

    showCreateRepertoireModal() {
        const modal = document.getElementById('createRepertoireModal');
        modal.style.display = 'flex';
        
        // Limpar formulário
        const form = document.getElementById('createRepertoireForm');
        if (form) {
            form.reset();
        }
        
        // Focar no input
        setTimeout(() => {
            const nameInput = document.getElementById('repertoireNameInput');
            if (nameInput) {
                nameInput.focus();
            }
        }, 100);
    }

    hideCreateRepertoireModal() {
        const modal = document.getElementById('createRepertoireModal');
        modal.style.display = 'none';
    }

    async handleCreateRepertoire(event) {
        event.preventDefault();
        
        const name = document.getElementById('repertoireNameInput').value.trim();
        const date = document.getElementById('repertoireDateInput').value;
        
        if (!name || !date) {
            alert('Por favor, preencha todos os campos.');
            return;
        }
        
        const userId = this.getCurrentUserId();
        if (!userId) {
            alert('Você precisa estar logado para criar um repertório.');
            return;
        }
        
        try {
            console.log('[REPERTÓRIOS] Criando repertório:', name, 'para data:', date);
            
            const repertoireData = {
                userId: userId,
                name: name,
                date: date,
                songs: [],
                createdAt: this.serverTimestamp(),
                updatedAt: this.serverTimestamp()
            };
            
            const docRef = await this.addDoc(this.collection(this.db, 'repertorios'), repertoireData);
            
            console.log('[REPERTÓRIOS] Repertório criado com ID:', docRef.id);
            
            // Fechar modal
            this.hideCreateRepertoireModal();
            
            // Recarregar repertórios
            await this.loadRepertoires();
            
            // Feedback
            alert('Repertório criado com sucesso!');
        } catch (error) {
            console.error('[REPERTÓRIOS] Erro ao criar repertório:', error);
            alert('Erro ao criar repertório. Tente novamente.');
        }
    }

    openRepertoire(repertoireId) {
        console.log('[REPERTÓRIOS] Abrindo repertório:', repertoireId);
        
        const repertoire = this.repertoires.find(r => r.id === repertoireId);
        if (!repertoire) {
            console.error('[REPERTÓRIOS] Repertório não encontrado:', repertoireId);
            return;
        }
        
        this.currentRepertoire = repertoire;
        this.renderRepertoireDetail();
        this.showRepertoireDetailView();
    }

    renderRepertoireDetail() {
        if (!this.currentRepertoire) {
            console.error('[REPERTÓRIOS] Nenhum repertório selecionado');
            return;
        }
        
        const titleElement = document.getElementById('repertoireDetailTitle');
        const dateElement = document.getElementById('repertoireDetailDate');
        const songsListElement = document.getElementById('repertoireSongsList');
        const noSongsElement = document.getElementById('noSongs');
        
        titleElement.textContent = this.currentRepertoire.name;
        dateElement.textContent = this.formatDate(this.currentRepertoire.date);
        
        const songs = this.currentRepertoire.songs || [];
        
        if (songs.length === 0) {
            songsListElement.style.display = 'none';
            noSongsElement.style.display = 'block';
        } else {
            songsListElement.style.display = 'flex';
            noSongsElement.style.display = 'none';
            this.renderRepertoireSongs();
        }
    }

    renderRepertoireSongs() {
        const songsListElement = document.getElementById('repertoireSongsList');
        if (!songsListElement || !this.currentRepertoire) return;
        
        const songs = this.currentRepertoire.songs || [];
        
        // Renderizar músicas existentes + input para nova música
        let html = '';
        
        songs.forEach((song, index) => {
            html += this.createRepertoireSongItem(song, index);
        });
        
        // Adicionar input para nova música
        html += this.createNewSongInput(songs.length);
        
        songsListElement.innerHTML = html;
        
        // Adicionar event listeners para músicas existentes (excluindo nova música)
        const songItems = songsListElement.querySelectorAll('.repertoire-song-item:not(.new-song-item)');
        
        songItems.forEach((item, index) => {
            const song = songs[index];
            
            // Botão de ouvir
            const playBtn = item.querySelector('.repertoire-song-play-btn');
            if (playBtn) {
                playBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (song.youtubeVideoId) {
                        this.playSong(song.youtubeVideoId, song.name, index);
                    }
                });
            }
            
            // Botão de alterar YouTube (dentro da thumbnail)
            const changeYoutubeBtn = item.querySelector('.repertoire-song-change-youtube-btn');
            if (changeYoutubeBtn) {
                changeYoutubeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.showYoutubeSearchModal(song.id, song.name);
                });
            }
            
            // Botão de remover
            const removeBtn = item.querySelector('.repertoire-song-remove-btn');
            if (removeBtn) {
                removeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.removeSongFromRepertoire(index);
                });
            }
            
            // Botão de detalhes
            const detailsBtn = item.querySelector('.repertoire-song-details-btn');
            if (detailsBtn) {
                detailsBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.showSongDetailsModal(song);
                });
            }
            
            // Botão de adicionar YouTube (quando não tem YouTube)
            const addYoutubeBtn = item.querySelector('.repertoire-song-add-youtube-btn');
            if (addYoutubeBtn) {
                addYoutubeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.showYoutubeSearchModal(song.id, song.name);
                });
            }
        });
        
        // Event listener para input de nova música
        const newSongInput = songsListElement.querySelector('.new-song-name-input');
        if (newSongInput) {
            newSongInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.createNewSong(newSongInput.value.trim());
                }
            });
        }
        
        // Event listener para botão + de nova música
        const addSongBtn = songsListElement.querySelector('.new-song-add-btn');
        if (addSongBtn) {
            addSongBtn.addEventListener('click', () => {
                const input = songsListElement.querySelector('.new-song-name-input');
                if (input) {
                    this.createNewSong(input.value.trim());
                }
            });
        }

        // Setup individual song player controls
        document.querySelectorAll('.song-player-control-btn').forEach(btn => {
            const songIndex = parseInt(btn.dataset.songIndex);
            
            if (btn.classList.contains('song-rewind-btn')) {
                btn.addEventListener('click', () => this.seekRelative(songIndex, -10));
            } else if (btn.classList.contains('song-forward-btn')) {
                btn.addEventListener('click', () => this.seekRelative(songIndex, 10));
            } else if (btn.classList.contains('song-play-pause-btn')) {
                btn.addEventListener('click', () => this.togglePlayPause(songIndex));
            }
        });

        // Setup progress bars
        document.querySelectorAll('.song-player-progress-bar').forEach(bar => {
            const songIndex = parseInt(bar.dataset.songIndex);
            bar.addEventListener('click', (e) => this.handleProgressBarClick(e, songIndex));
        });
    }

    createNewSongInput(songsCount) {
        const number = String(songsCount + 1).padStart(2, '0');
        
        return `
            <div class="repertoire-song-item new-song-item">
                <span class="repertoire-song-number">${number}</span>
                <div class="repertoire-song-input-container">
                    <input type="text" class="form-input new-song-name-input" placeholder="Digite o nome da música...">
                </div>
                <div class="repertoire-song-actions">
                    <button class="repertoire-song-add-btn new-song-add-btn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }

    createRepertoireSongItem(song, index) {
        const number = String(index + 1).padStart(2, '0');
        const hasYoutube = song.youtubeVideoId;
        const thumbnail = song.youtubeThumbnail || '';
        
        let youtubeSection = '';
        if (hasYoutube) {
            youtubeSection = `
                <div class="repertoire-song-youtube">
                    <div class="repertoire-song-youtube-thumbnail">
                        <img src="${thumbnail}" alt="${this.escapeHtml(song.name)}">
                    </div>
                    <div class="repertoire-song-youtube-actions">
                        <button class="repertoire-song-play-btn" title="Ouvir">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polygon points="5 3 19 12 5 21 5 3"></polygon>
                            </svg>
                        </button>
                        <button class="repertoire-song-change-youtube-btn" title="Alterar">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-7 7"></path>
                            </svg>
                            Alterar
                        </button>
                    </div>
                </div>
                
                <!-- Individual song player -->
                <div class="song-player" id="song-player-${index}" style="display: none;">
                    <div class="song-player-info">
                        <div class="song-player-progress-container">
                            <div class="song-player-progress-bar" data-song-index="${index}">
                                <div class="song-player-progress-fill" id="song-progress-fill-${index}"></div>
                            </div>
                            <div class="song-player-time">
                                <span id="song-current-time-${index}">0:00</span>
                                <span id="song-duration-${index}">0:00</span>
                            </div>
                        </div>
                    </div>
                    <div class="song-player-controls">
                        <button class="song-player-control-btn song-rewind-btn" data-song-index="${index}" title="Voltar 10 segundos">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polygon points="11 19 2 12 11 5 11 19"></polygon>
                                <polygon points="22 19 13 12 22 5 22 19"></polygon>
                            </svg>
                        </button>
                        <button class="song-player-control-btn song-play-pause-btn" data-song-index="${index}" title="Play/Pause">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="song-play-icon-${index}">
                                <polygon points="5 3 19 12 5 21 5 3"></polygon>
                            </svg>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="song-pause-icon-${index}" style="display: none;">
                                <rect x="6" y="4" width="4" height="16"></rect>
                                <rect x="14" y="4" width="4" height="16"></rect>
                            </svg>
                        </button>
                        <button class="song-player-control-btn song-forward-btn" data-song-index="${index}" title="Avançar 10 segundos">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polygon points="13 5 22 12 13 19 13 5"></polygon>
                                <polygon points="2 5 11 12 2 19 2 5"></polygon>
                            </svg>
                        </button>
                    </div>
                    <!-- Error message -->
                    <div class="song-player-error" id="song-error-${index}" style="display: none;">
                        <span class="song-error-text">Esta música não está disponível no YouTube</span>
                    </div>
                    <!-- Hidden YouTube IFrame container for this song -->
                    <div class="song-youtube-container" id="song-youtube-${index}" style="display: none;"></div>
                </div>
            `;
        }
        
        // Adicionar informações de Tom, BPM e Observações quando houver conteúdo
        let detailsSection = '';
        const hasKey = song.key && song.key.trim() !== '';
        const hasBpm = song.bpm !== null && song.bpm !== undefined && song.bpm !== '';
        const hasNotes = song.notes && song.notes.trim() !== '';
        
        if (hasKey || hasBpm || hasNotes) {
            let detailsParts = [];
            
            if (hasKey) {
                detailsParts.push(`<span class="song-detail-key">Tom: ${this.escapeHtml(song.key)}</span>`);
            }
            
            if (hasBpm) {
                detailsParts.push(`<span class="song-detail-bpm">BPM: ${song.bpm}</span>`);
            }
            
            let detailsHtml = '';
            if (detailsParts.length > 0) {
                detailsHtml = `<div class="song-details-line">${detailsParts.join(' · ')}</div>`;
            }
            
            if (hasNotes) {
                detailsHtml += `<div class="song-detail-notes">${this.escapeHtml(song.notes)}</div>`;
            }
            
            detailsSection = `<div class="repertoire-song-details">${detailsHtml}</div>`;
        }
        
        const detailsButton = `<button class="repertoire-song-details-btn" title="Detalhes">Detalhes</button>`;
        
        const actionButton = !hasYoutube 
            ? `<button class="repertoire-song-add-youtube-btn action-btn">Adicionar música</button>`
            : '';
        
        return `
            <div class="repertoire-song-item" data-song-id="${song.id}">
                <span class="repertoire-song-number">${number}</span>
                <div class="repertoire-song-info">
                    <h4 class="repertoire-song-title">${this.escapeHtml(song.name)}</h4>
                    ${youtubeSection}
                    ${detailsSection}
                </div>
                <div class="repertoire-song-actions">
                    ${detailsButton}
                    ${actionButton}
                    <button class="repertoire-song-remove-btn" title="Remover">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }

    addManualSong() {
        console.log('[REPERTÓRIOS] Adicionando música manual');
        if (!this.currentRepertoire) {
            alert('Nenhum repertório selecionado.');
            return;
        }
        
        // Se não há músicas, inicializa o array
        if (!this.currentRepertoire.songs) {
            this.currentRepertoire.songs = [];
        }
        
        // Adiciona música vazia com ID temporário
        const newSong = {
            id: 'temp_' + Date.now(),
            name: '',
            youtubeVideoId: null,
            youtubeThumbnail: null,
            youtubeTitle: null,
            youtubeChannel: null,
            key: '',
            bpm: null,
            notes: ''
        };
        
        this.currentRepertoire.songs.push(newSong);
        this.renderRepertoireDetail();
        
        // Focar no input
        setTimeout(() => {
            const newSongInput = document.querySelector('.new-song-name-input');
            if (newSongInput) {
                newSongInput.focus();
            }
        }, 100);
    }

    async createNewSong(name) {
        if (!name || !this.currentRepertoire) {
            return;
        }
        
        console.log('[REPERTÓRIOS] Criando nova música:', name);
        
        // Encontrar a música temporária e atualizar
        const tempSongIndex = this.currentRepertoire.songs.findIndex(s => s.id.startsWith('temp_'));
        if (tempSongIndex !== -1) {
            this.currentRepertoire.songs[tempSongIndex] = {
                id: 'song_' + Date.now(),
                name: name,
                youtubeVideoId: null,
                youtubeThumbnail: null,
                youtubeTitle: null,
                youtubeChannel: null,
                key: '',
                bpm: null,
                notes: ''
            };
        } else {
            // Se não encontrou música temporária, adiciona nova
            this.currentRepertoire.songs.push({
                id: 'song_' + Date.now(),
                name: name,
                youtubeVideoId: null,
                youtubeThumbnail: null,
                youtubeTitle: null,
                youtubeChannel: null,
                key: '',
                bpm: null,
                notes: ''
            });
        }
        
        // Salvar no Firebase
        await this.saveRepertoire();
        
        // Atualizar visual
        this.renderRepertoireDetail();
        
        // Recarregar repertórios para atualizar contador
        await this.loadRepertoires();
    }

    showRepertoireDetailView() {
        document.getElementById('repertoiresListView').style.display = 'none';
        document.getElementById('repertoireDetailView').style.display = 'block';
    }

    showRepertoiresListView() {
        document.getElementById('repertoireDetailView').style.display = 'none';
        document.getElementById('repertoiresListView').style.display = 'block';
        this.currentRepertoire = null;
    }

    showDeleteConfirmModal() {
        const modal = document.getElementById('deleteConfirmModal');
        modal.style.display = 'flex';
    }

    hideDeleteConfirmModal() {
        const modal = document.getElementById('deleteConfirmModal');
        modal.style.display = 'none';
    }

    async handleDeleteRepertoire() {
        if (!this.currentRepertoire) {
            console.error('[REPERTÓRIOS] Nenhum repertório selecionado para exclusão');
            return;
        }
        
        try {
            console.log('[REPERTÓRIOS] Excluindo repertório:', this.currentRepertoire.id);
            
            await this.deleteDoc(this.doc(this.db, 'repertorios', this.currentRepertoire.id));
            
            console.log('[REPERTÓRIOS] Repertório excluído com sucesso');
            
            // Fechar modal
            this.hideDeleteConfirmModal();
            
            // Voltar para lista
            this.showRepertoiresListView();
            
            // Recarregar repertórios
            await this.loadRepertoires();
            
            // Feedback
            alert('Repertório excluído com sucesso!');
        } catch (error) {
            console.error('[REPERTÓRIOS] Erro ao excluir repertório:', error);
            alert('Erro ao excluir repertório. Tente novamente.');
        }
    }

    formatDate(dateString) {
        if (!dateString) return 'Data não definida';
        
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        
        return `${day}/${month}/${year}`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ==================== YOUTUBE SEARCH ====================
    
    showYoutubeSearchModal(songId, songName) {
        this.currentYoutubeSongId = songId;
        this.currentYoutubeSongName = songName;
        
        const modal = document.getElementById('youtubeSearchModal');
        const titleElement = document.getElementById('youtubeSearchModalTitle');
        
        // Atualizar título do modal
        if (titleElement) {
            titleElement.textContent = `Adicionar música — ${songName}`;
        }
        
        if (modal) {
            modal.style.display = 'flex';
            modal.style.opacity = '1';
            modal.style.visibility = 'visible';
        }
        
        // Limpar busca anterior e usar nome da música como termo
        const searchInput = document.getElementById('youtubeSearchInput');
        if (searchInput) {
            searchInput.value = songName || '';
        }
        
        document.getElementById('youtubeSearchResults').style.display = 'none';
        document.getElementById('youtubeSearchEmpty').style.display = 'none';
        document.getElementById('youtubeSearchError').style.display = 'none';
        
        // Focar no input e fazer busca automática
        setTimeout(() => {
            const searchInput = document.getElementById('youtubeSearchInput');
            if (searchInput) {
                searchInput.focus();
                // Fazer busca automática se houver nome
                if (songName) {
                    this.handleYoutubeSearch();
                }
            }
        }, 100);
    }

    hideYoutubeSearchModal() {
        const modal = document.getElementById('youtubeSearchModal');
        modal.style.display = 'none';
        
        // Parar player do YouTube se estiver aberto
        this.hideYoutubePlayerModal();
    }

    async handleYoutubeSearch() {
        const query = document.getElementById('youtubeSearchInput').value.trim();
        
        if (!query || query.length < 2) {
            alert('Digite pelo menos 2 caracteres para pesquisar.');
            return;
        }
        
        console.log('[REPERTÓRIOS] Pesquisando no YouTube:', query);
        
        // Mostrar loading
        document.getElementById('youtubeSearchLoading').style.display = 'flex';
        document.getElementById('youtubeSearchResults').style.display = 'none';
        document.getElementById('youtubeSearchEmpty').style.display = 'none';
        document.getElementById('youtubeSearchError').style.display = 'none';
        
        try {
            const results = await this.searchYouTube(query);
            
            document.getElementById('youtubeSearchLoading').style.display = 'none';
            
            if (results.length === 0) {
                document.getElementById('youtubeSearchEmpty').style.display = 'block';
            } else {
                this.renderYoutubeResults(results);
                document.getElementById('youtubeSearchResults').style.display = 'flex';
            }
        } catch (error) {
            console.error('[REPERTÓRIOS] Erro na busca do YouTube:', error);
            document.getElementById('youtubeSearchLoading').style.display = 'none';
            document.getElementById('youtubeSearchError').style.display = 'block';
        }
    }

    async searchYouTube(query) {
        // Usando a mesma API key do sistema existente
        const API_KEY = 'AIzaSyDbFi9ANyHakC0WwqxSz3WuqwFa5mQaeJA';
        const API_URL = 'https://www.googleapis.com/youtube/v3/search';
        
        try {
            const response = await fetch(`${API_URL}?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=10&key=${API_KEY}`);
            
            if (!response.ok) {
                console.error('[REPERTÓRIOS] YouTube API error:', response.status, response.statusText);
                return this.getFallbackResults(query);
            }
            
            const data = await response.json();
            
            if (!data.items || data.items.length === 0) {
                console.log('[REPERTÓRIOS] Nenhum resultado encontrado');
                return [];
            }
            
            const results = data.items.map(item => ({
                videoId: item.id.videoId,
                title: item.snippet.title,
                channel: item.snippet.channelTitle,
                thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || 'https://via.placeholder.com/320x180',
                youtubeUrl: `https://www.youtube.com/watch?v=${item.id.videoId}`
            }));
            
            console.log('[REPERTÓRIOS] YouTube search retornou', results.length, 'resultados');
            return results;
            
        } catch (error) {
            console.error('[REPERTÓRIOS] YouTube search error:', error);
            return this.getFallbackResults(query);
        }
    }

    getFallbackResults(query) {
        // Resultados de fallback caso a API falhe
        return [
            {
                videoId: 'dQw4w9WgXcQ',
                title: `${query} - Resultado 1`,
                channel: 'Canal Teste 1',
                thumbnail: 'https://via.placeholder.com/320x180?text=Video+1',
                youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
            },
            {
                videoId: 'dQw4w9WgXcQ',
                title: `${query} - Resultado 2`,
                channel: 'Canal Teste 2',
                thumbnail: 'https://via.placeholder.com/320x180?text=Video+2',
                youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
            }
        ];
    }

    renderYoutubeResults(results) {
        const resultsContainer = document.getElementById('youtubeSearchResults');
        resultsContainer.innerHTML = results.map(result => this.createYoutubeResultCard(result)).join('');
        
        // Adicionar event listeners
        resultsContainer.querySelectorAll('.youtube-result-card').forEach(card => {
            const videoId = card.dataset.videoId;
            const result = results.find(r => r.videoId === videoId);
            
            if (result) {
                // Botão de ouvir
                const playBtn = card.querySelector('.youtube-result-play-btn');
                if (playBtn) {
                    playBtn.addEventListener('click', () => {
                        this.playYoutubeVideo(result.videoId, result.title);
                    });
                }
                
                // Botão de adicionar
                const addBtn = card.querySelector('.youtube-result-add-btn');
                if (addBtn) {
                    addBtn.addEventListener('click', () => {
                        this.addSongToRepertoire(result);
                    });
                }
            }
        });
    }

    createYoutubeResultCard(result) {
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
                        <button class="youtube-result-add-btn">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                            Adicionar
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    async addSongToRepertoire(songData) {
        if (!this.currentRepertoire) {
            alert('Nenhum repertório selecionado.');
            return;
        }
        
        // Verificar se estamos vinculando a uma música existente
        if (this.currentYoutubeSongId) {
            // Vincular YouTube à música existente
            const songIndex = this.currentRepertoire.songs.findIndex(s => s.id === this.currentYoutubeSongId);
            
            if (songIndex !== -1) {
                try {
                    console.log('[REPERTÓRIOS] Vinculando YouTube à música:', this.currentYoutubeSongName);
                    
                    this.currentRepertoire.songs[songIndex] = {
                        ...this.currentRepertoire.songs[songIndex],
                        youtubeVideoId: songData.videoId,
                        youtubeThumbnail: songData.thumbnail,
                        youtubeTitle: songData.title,
                        youtubeChannel: songData.channel,
                        youtubeUrl: songData.youtubeUrl
                    };
                    
                    // Salvar no Firebase
                    await this.saveRepertoire();
                    
                    // Atualizar visual
                    this.renderRepertoireDetail();
                    
                    // Recarregar repertórios para atualizar contador
                    await this.loadRepertoires();
                    
                    // Fechar modal
                    this.hideYoutubeSearchModal();
                    
                    // Feedback
                    alert(`Vídeo vinculado à música "${this.currentYoutubeSongName}"!`);
                    
                } catch (error) {
                    console.error('[REPERTÓRIOS] Erro ao vincular YouTube:', error);
                    alert('Erro ao vincular vídeo. Tente novamente.');
                }
            }
        } else {
            // Comportamento anterior: criar nova música (depreciação)
            console.warn('[REPERTÓRIOS] Criando música nova deprecado - use fluxo manual');
            
            // Verificar duplicata
            const isDuplicate = this.currentRepertoire.songs?.some(song => song.youtubeVideoId === songData.videoId);
            if (isDuplicate) {
                alert('Este vídeo já está vinculado a uma música no repertório.');
                return;
            }
            
            try {
                console.log('[REPERTÓRIOS] Adicionando música:', songData.title);
                
                const newSong = {
                    id: 'song_' + Date.now(),
                    name: songData.title,
                    youtubeVideoId: songData.videoId,
                    youtubeThumbnail: songData.thumbnail,
                    youtubeTitle: songData.title,
                    youtubeChannel: songData.channel,
                    youtubeUrl: songData.youtubeUrl
                };
                
                if (!this.currentRepertoire.songs) {
                    this.currentRepertoire.songs = [];
                }
                
                this.currentRepertoire.songs.push(newSong);
                
                // Salvar no Firebase
                await this.saveRepertoire();
                
                // Atualizar visual
                this.renderRepertoireDetail();
                
                // Fechar modal
                this.hideYoutubeSearchModal();
                
                // Feedback
                alert(`"${songData.title}" adicionada ao repertório!`);
                
            } catch (error) {
                console.error('[REPERTÓRIOS] Erro ao adicionar música:', error);
                alert('Erro ao adicionar música. Tente novamente.');
            }
        }
    }

    async removeSongFromRepertoire(index) {
        if (!this.currentRepertoire || !this.currentRepertoire.songs) {
            return;
        }
        
        if (!confirm('Remover esta música do repertório?')) {
            return;
        }
        
        try {
            console.log('[REPERTÓRIOS] Removendo música no índice:', index);
            
            this.currentRepertoire.songs.splice(index, 1);
            
            // Salvar no Firebase
            await this.saveRepertoire();
            
            // Atualizar visual
            this.renderRepertoireDetail();
            
            // Recarregar repertórios para atualizar contador
            await this.loadRepertoires();
            
        } catch (error) {
            console.error('[REPERTÓRIOS] Erro ao remover música:', error);
            alert('Erro ao remover música. Tente novamente.');
        }
    }

    async saveRepertoire() {
        if (!this.currentRepertoire || !this.db) {
            return;
        }
        
        try {
            const repertoireRef = this.doc(this.db, 'repertorios', this.currentRepertoire.id);
            await this.updateDoc(repertoireRef, {
                songs: this.currentRepertoire.songs,
                updatedAt: this.serverTimestamp()
            });
            
            console.log('[REPERTÓRIOS] Repertório salvo com sucesso');
        } catch (error) {
            console.error('[REPERTÓRIOS] Erro ao salvar repertório:', error);
            throw error;
        }
    }

    // ==================== YOUTUBE PLAYER ====================
    
    playYoutubeVideo(videoId, title) {
        console.log('[REPERTÓRIOS] Reproduzindo vídeo:', videoId, title);
        
        // Find the song with this videoId in current repertoire
        if (this.currentRepertoire && this.currentRepertoire.songs) {
            const songIndex = this.currentRepertoire.songs.findIndex(s => s.youtubeVideoId === videoId);
            if (songIndex !== -1) {
                const song = this.currentRepertoire.songs[songIndex];
                this.playSong(videoId, song.name, songIndex);
                return;
            }
        }
        
        // Fallback to modal if not found in repertoire
        const modal = document.getElementById('youtubePlayerModal');
        const playerContainer = document.getElementById('youtubePlayer');
        const titleElement = document.getElementById('youtubePlayerTitle');
        
        titleElement.textContent = title || 'Reproduzindo';
        
        // Limpar player anterior
        playerContainer.innerHTML = '';
        
        // Criar novo iframe do YouTube
        const iframe = document.createElement('iframe');
        iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
        iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
        iframe.setAttribute('allowfullscreen', '');
        
        playerContainer.appendChild(iframe);
        
        // Mostrar modal
        modal.style.display = 'flex';
    }

    // ==================== INDIVIDUAL SONG PLAYERS ====================
    
    playSong(videoId, songName, index) {
        // Stop previous song if playing
        if (this.activeSongIndex !== -1 && this.activeSongIndex !== index) {
            this.stopSong(this.activeSongIndex);
        }

        this.activeSongIndex = index;
        
        // Initialize song state if not exists
        if (!this.songPlayers[index]) {
            this.songPlayers[index] = {
                isPlaying: false,
                currentTime: 0,
                duration: 0
            };
        }
        
        // Clear any previous error for this song
        const errorElement = document.getElementById(`song-error-${index}`);
        if (errorElement) {
            errorElement.style.display = 'none';
        }
        
        // Re-enable controls for this song
        const controls = document.querySelectorAll(`.song-player-control-btn[data-song-index="${index}"]`);
        controls.forEach(btn => {
            btn.disabled = false;
            btn.style.opacity = '1';
        });
        
        // Show player for this song
        const playerElement = document.getElementById(`song-player-${index}`);
        if (playerElement) {
            playerElement.style.display = 'block';
        }

        if (!this.youtubePlayer) {
            this.initializeYoutubePlayer(videoId, songName, index);
        } else {
            // Destroy old player before creating new one
            if (typeof this.youtubePlayer.destroy === 'function') {
                this.youtubePlayer.destroy();
            }
            this.youtubePlayer = null;
            this.initializeYoutubePlayer(videoId, songName, index);
        }
    }

    initializeYoutubePlayer(videoId, songName, index) {
        const container = document.getElementById(`song-youtube-${index}`);
        const playerId = `youtube-iframe-player-${index}`;
        container.innerHTML = `<div id="${playerId}"></div>`;

        this.youtubePlayer = new YT.Player(playerId, {
            height: '200',
            width: '200',
            videoId: videoId,
            playerVars: {
                'playsinline': 1,
                'controls': 0,
                'disablekb': 1,
                'fs': 0,
                'rel': 0,
                'enablejsapi': 1,
                'origin': window.location.origin
            },
            events: {
                'onReady': (event) => this.onPlayerReady(event, index),
                'onStateChange': (event) => this.onPlayerStateChange(event, index),
                'onError': (event) => this.onPlayerError(event, index)
            }
        });

        this.songPlayers[index] = {
            isPlaying: true,
            currentTime: 0,
            duration: 0
        };
    }

    onPlayerReady(event, index) {
        event.target.playVideo();
        this.updatePlayPauseButton(index);
        this.startProgressUpdate(index);
    }

    onPlayerStateChange(event, index) {
        if (event.data === YT.PlayerState.PLAYING) {
            this.songPlayers[index].isPlaying = true;
            this.updatePlayPauseButton(index);
        } else if (event.data === YT.PlayerState.PAUSED) {
            this.songPlayers[index].isPlaying = false;
            this.updatePlayPauseButton(index);
        }
    }

    onPlayerError(event, index) {
        console.error(`[REPERTÓRIOS] YouTube player error for song ${index}:`, event.data);
        
        // Show error message in player
        const errorElement = document.getElementById(`song-error-${index}`);
        if (errorElement) {
            errorElement.style.display = 'block';
        }
        
        // Disable controls
        const controls = document.querySelectorAll(`.song-player-control-btn[data-song-index="${index}"]`);
        controls.forEach(btn => {
            btn.disabled = true;
            btn.style.opacity = '0.5';
        });
        
        // Update song state
        if (this.songPlayers[index]) {
            this.songPlayers[index].isPlaying = false;
            this.updatePlayPauseButton(index);
        }
    }

    stopSong(index) {
        if (this.youtubePlayer && this.activeSongIndex === index) {
            this.youtubePlayer.pauseVideo();
            this.songPlayers[index].isPlaying = false;
            this.updatePlayPauseButton(index);
            
            // Hide player
            const playerElement = document.getElementById(`song-player-${index}`);
            if (playerElement) {
                playerElement.style.display = 'none';
            }
        }
    }

    togglePlayPause(index) {
        if (!this.youtubePlayer || this.activeSongIndex !== index) return;

        if (this.songPlayers[index].isPlaying) {
            this.youtubePlayer.pauseVideo();
        } else {
            this.youtubePlayer.playVideo();
        }
    }

    seekRelative(index, seconds) {
        if (!this.youtubePlayer || this.activeSongIndex !== index) return;

        const currentTime = this.youtubePlayer.getCurrentTime();
        const newTime = Math.max(0, currentTime + seconds);
        this.youtubePlayer.seekTo(newTime, true);
    }

    handleProgressBarClick(event, index) {
        if (!this.youtubePlayer || this.activeSongIndex !== index || !this.songPlayers[index].duration) return;

        const progressBar = document.querySelector(`.song-player-progress-bar[data-song-index="${index}"]`);
        const rect = progressBar.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const percentage = clickX / rect.width;
        const seekTime = percentage * this.songPlayers[index].duration;

        this.youtubePlayer.seekTo(seekTime, true);
    }

    updatePlayPauseButton(index) {
        const playIcon = document.querySelector(`.song-play-icon-${index}`);
        const pauseIcon = document.querySelector(`.song-pause-icon-${index}`);

        if (this.songPlayers[index] && this.songPlayers[index].isPlaying) {
            playIcon.style.display = 'none';
            pauseIcon.style.display = 'block';
        } else {
            playIcon.style.display = 'block';
            pauseIcon.style.display = 'none';
        }
    }

    startProgressUpdate(index) {
        setInterval(() => {
            if (!this.youtubePlayer || this.activeSongIndex !== index || !this.songPlayers[index].isPlaying) return;

            const currentTime = this.youtubePlayer.getCurrentTime();
            const duration = this.youtubePlayer.getDuration();

            this.songPlayers[index].currentTime = currentTime;
            this.songPlayers[index].duration = duration;

            this.updateProgressBar(index, currentTime, duration);
            this.updateTimeDisplay(index, currentTime, duration);
        }, 1000);
    }

    updateProgressBar(index, currentTime, duration) {
        const progressFill = document.getElementById(`song-progress-fill-${index}`);
        const percentage = duration > 0 ? (currentTime / duration) * 100 : 0;
        progressFill.style.width = `${percentage}%`;
    }

    updateTimeDisplay(index, currentTime, duration) {
        document.getElementById(`song-current-time-${index}`).textContent = this.formatTime(currentTime);
        document.getElementById(`song-duration-${index}`).textContent = this.formatTime(duration);
    }

    formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '0:00';
        
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    hideYoutubePlayerModal() {
        const modal = document.getElementById('youtubePlayerModal');
        const playerContainer = document.getElementById('youtubePlayer');
        
        // Parar vídeo removendo o iframe
        playerContainer.innerHTML = '';
        
        modal.style.display = 'none';
    }

    // ==================== SONG DETAILS ====================
    
    showSongDetailsModal(song) {
        console.log('[REPERTÓRIOS] Abrindo detalhes da música:', song.id, song.name);
        
        this.currentEditingSongId = song.id;
        
        const modal = document.getElementById('songDetailsModal');
        const titleElement = document.getElementById('songDetailsTitle');
        const nameInput = document.getElementById('songDetailsName');
        const keyInput = document.getElementById('songDetailsKey');
        const bpmInput = document.getElementById('songDetailsBpm');
        const notesInput = document.getElementById('songDetailsNotes');
        
        // Preencher campos
        if (titleElement) {
            titleElement.textContent = `Detalhes — ${song.name}`;
        }
        
        if (nameInput) {
            nameInput.value = song.name || '';
        }
        
        if (keyInput) {
            keyInput.value = song.key || '';
        }
        
        if (bpmInput) {
            bpmInput.value = song.bpm || '';
        }
        
        if (notesInput) {
            notesInput.value = song.notes || '';
        }
        
        // Mostrar modal
        modal.style.display = 'flex';
        modal.style.opacity = '1';
        modal.style.visibility = 'visible';
    }

    hideSongDetailsModal() {
        const modal = document.getElementById('songDetailsModal');
        modal.style.display = 'none';
        this.currentEditingSongId = null;
    }

    async saveSongDetails() {
        if (!this.currentRepertoire || !this.currentEditingSongId) {
            return;
        }
        
        const keyInput = document.getElementById('songDetailsKey');
        const bpmInput = document.getElementById('songDetailsBpm');
        const notesInput = document.getElementById('songDetailsNotes');
        const saveStatus = document.getElementById('songDetailsSaveStatus');
        
        // Mostrar indicador de salvamento
        if (saveStatus) {
            saveStatus.style.display = 'block';
            saveStatus.querySelector('.save-indicator').textContent = 'Salvando...';
        }
        
        try {
            const songIndex = this.currentRepertoire.songs.findIndex(s => s.id === this.currentEditingSongId);
            
            if (songIndex !== -1) {
                const key = keyInput.value.trim();
                const bpm = bpmInput.value ? parseInt(bpmInput.value) : null;
                const notes = notesInput.value.trim();
                
                this.currentRepertoire.songs[songIndex] = {
                    ...this.currentRepertoire.songs[songIndex],
                    key: key,
                    bpm: bpm,
                    notes: notes
                };
                
                // Salvar no Firebase
                await this.saveRepertoire();
                
                // Atualizar visual da lista
                this.renderRepertoireDetail();
                
                // Atualizar indicador
                if (saveStatus) {
                    saveStatus.querySelector('.save-indicator').textContent = 'Salvo!';
                    setTimeout(() => {
                        saveStatus.style.display = 'none';
                    }, 2000);
                }
                
                console.log('[REPERTÓRIOS] Detalhes da música salvos');
            }
        } catch (error) {
            console.error('[REPERTÓRIOS] Erro ao salvar detalhes:', error);
            if (saveStatus) {
                saveStatus.querySelector('.save-indicator').textContent = 'Erro ao salvar';
                setTimeout(() => {
                    saveStatus.style.display = 'none';
                }, 2000);
            }
        }
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func.apply(this, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // ==================== SHARE MODAL ====================
    
    async showShareModal() {
        if (!this.currentRepertoire) {
            return;
        }
        
        console.log('[REPERTÓRIOS] Abrindo modal de compartilhamento');
        
        // Gerar ou recuperar shareId
        const shareId = await this.getOrCreateShareId();
        
        if (!shareId) {
            console.error('[REPERTÓRIOS] Erro ao gerar shareId');
            return;
        }
        
        // Montar link de compartilhamento usando URL API
        const shareUrl = new URL('setlist-shared.html', window.location.href);
        shareUrl.searchParams.set('share', shareId);
        const shareLink = shareUrl.href;
        
        console.log('[REPERTÓRIOS] Link de compartilhamento gerado:', shareLink);
        
        // Preencher input
        const shareLinkInput = document.getElementById('shareLinkInput');
        if (shareLinkInput) {
            shareLinkInput.value = shareLink;
        }
        
        // Mostrar modal
        const modal = document.getElementById('shareModal');
        modal.style.display = 'flex';
        modal.style.opacity = '1';
        modal.style.visibility = 'visible';
    }

    hideShareModal() {
        const modal = document.getElementById('shareModal');
        modal.style.display = 'none';
    }

    async getOrCreateShareId() {
        if (!this.currentRepertoire) {
            return null;
        }
        
        // Se já tem shareId, retornar
        if (this.currentRepertoire.shareId) {
            return this.currentRepertoire.shareId;
        }
        
        // Gerar novo shareId
        const shareId = this.generateShareId();
        
        // Salvar no Firebase
        try {
            const repertoireRef = this.doc(this.db, 'repertorios', this.currentRepertoire.id);
            await this.updateDoc(repertoireRef, {
                shareId: shareId,
                updatedAt: this.serverTimestamp()
            });
            
            // Atualizar local
            this.currentRepertoire.shareId = shareId;
            
            console.log('[REPERTÓRIOS] ShareId gerado:', shareId);
            return shareId;
        } catch (error) {
            console.error('[REPERTÓRIOS] Erro ao salvar shareId:', error);
            return null;
        }
    }

    generateShareId() {
        // Gerar ID único e imprevisível
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 12; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    copyShareLink() {
        const shareLinkInput = document.getElementById('shareLinkInput');
        const copyStatus = document.getElementById('shareCopyStatus');
        
        if (shareLinkInput) {
            shareLinkInput.select();
            shareLinkInput.setSelectionRange(0, 99999); // Para mobile
            
            navigator.clipboard.writeText(shareLinkInput.value).then(() => {
                if (copyStatus) {
                    copyStatus.style.display = 'block';
                    copyStatus.querySelector('.copy-indicator').textContent = 'Link copiado!';
                    setTimeout(() => {
                        copyStatus.style.display = 'none';
                    }, 2000);
                }
            }).catch(err => {
                console.error('[REPERTÓRIOS] Erro ao copiar link:', err);
            });
        }
    }
}

// Global callback for YouTube API
window.onYouTubeIframeAPIReady = function() {
    console.log('[REPERTÓRIOS] YouTube API ready');
};