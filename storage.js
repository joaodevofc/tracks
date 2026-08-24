/**
 * Multracks Storage Module
 * Handles data persistence for projects and tracks
 * Architecture prepared for future multitrack player functionality
 */

const STORAGE_VERSION = 1;

// Get current user ID from Firebase Auth, fallback to 'guest'
function getCurrentUserId() {
    if (window.firebaseAuth && window.firebaseAuth.auth) {
        const user = window.firebaseAuth.auth.currentUser;
        if (user) {
            return user.uid;
        }
    }
    return 'guest';
}

/**
 * Get current user plan from Firestore
 * Returns 'Studio', 'Pro', 'Home', or null if not found
 */
async function getUserPlan() {
    try {
        if (!window.firebaseDB || !window.firebaseAuth) {
            console.log('[STORAGE] Firebase not available, defaulting to Home plan');
            return 'Home';
        }

        const user = window.firebaseAuth.auth.currentUser;
        if (!user) {
            console.log('[STORAGE] No authenticated user, defaulting to Home plan');
            return 'Home';
        }

        const userDoc = await window.firebaseDB.getDoc(
            window.firebaseDB.doc(window.firebaseDB.db, 'users', user.uid)
        );

        if (userDoc.exists()) {
            const userData = userDoc.data();
            console.log('[STORAGE] Raw Firestore user data:', JSON.stringify(userData, null, 2));
            console.log('[STORAGE] Raw plano field value:', userData.plano, 'Type:', typeof userData.plano);
            console.log('[STORAGE] Plano field exists:', 'plano' in userData);
            
            const plano = userData.plano || 'home';
            console.log('[STORAGE] Final plano value after conversion:', plano, 'Type:', typeof plano);
            console.log('[STORAGE] Plano comparison checks:');
            console.log('[STORAGE] - plano === "studio":', plano === 'studio');
            console.log('[STORAGE] - plano === "pro":', plano === 'pro');
            console.log('[STORAGE] - plano === "home":', plano === 'home');
            
            return plano;
        }

        console.log('[STORAGE] User document not found, defaulting to home plano');
        return 'home';
    } catch (error) {
        console.error('[STORAGE] Error getting user plan:', error);
        return 'Home'; // Default to Home on error
    }
}

// Get dynamic storage keys based on current user
function getStorageKey() {
    const userId = getCurrentUserId();
    return `multracks_projects_${userId}`;
}

function getPlaylistsStorageKey() {
    const userId = getCurrentUserId();
    return `multracks_playlists_${userId}`;
}

/**
 * Playlist data structure
 * Contains user-created playlists with selected projects
 */
class Playlist {
    constructor(data = {}) {
        this.id = data.id || this.generateId();
        this.name = data.name || 'Nova Playlist';
        this.cover = data.cover || null; // Base64 encoded image
        this.projectIds = data.projectIds || []; // Array of project IDs
        this.createdAt = data.createdAt || new Date().toISOString();
        this.updatedAt = data.updatedAt || new Date().toISOString();
    }
    
    generateId() {
        return 'playlist_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    addProject(projectId) {
        if (!this.projectIds.includes(projectId)) {
            this.projectIds.push(projectId);
            this.updateTimestamp();
        }
    }
    
    removeProject(projectId) {
        this.projectIds = this.projectIds.filter(id => id !== projectId);
        this.updateTimestamp();
    }
    
    updateTimestamp() {
        this.updatedAt = new Date().toISOString();
    }
    
    getProjectCount() {
        return this.projectIds.length;
    }
    
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            cover: this.cover,
            projectIds: this.projectIds,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }
    
    static fromJSON(json) {
        return new Playlist(json);
    }
}

/**
 * Track data structure
 * Prepared for multitrack player with volume, mute, solo, pan controls
 */
class Track {
    constructor(data = {}) {
        this.id = data.id || this.generateId();
        this.name = data.name || 'Untitled Track';
        this.originalFileName = data.originalFileName || '';
        this.fileSize = data.fileSize || 0;
        this.file = data.file || null;
        this.audioFileId = data.audioFileId || null; // ID for storage (IndexedDB or cloud)
        this.objectUrl = data.objectUrl || null; // Object URL for guest mode (in-memory only)
        this.streamUrl = data.streamUrl || null; // Streaming URL for cloud-stored tracks
        this.isHttpStored = data.isHttpStored || false; // Flag for cloud storage
        this.projectName = data.projectName || null; // Project name for upload metadata
        this.volume = data.volume !== undefined ? data.volume : 1;
        this.pan = data.pan !== undefined ? data.pan : 0;
        this.mute = data.mute || false;
        this.solo = data.solo || false;
        this.startTime = data.startTime || 0;
        this.endTime = data.endTime || 0;
        this.waveform = data.waveform || null;
        this.offset = data.offset || 0;
    }
    
    generateId() {
        return 'track_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    async toJSON() {
        console.log('[STORAGE] Track.toJSON called for:', this.name);
        console.log('[STORAGE] Track has file:', !!this.file);
        
        // Check if user is authenticated
        const isUserLoggedIn = window.firebaseAuth && window.firebaseAuth.auth && window.firebaseAuth.auth.currentUser;
        
        // Check user plan for cloud storage decision
        const userPlan = await getUserPlan();
        console.log('[STORAGE] User plano:', userPlan, 'for track:', this.name);
        
        // Studio/Pro users: Upload to cloud storage
        if (isUserLoggedIn && this.file && !this.isHttpStored && (userPlan === 'studio' || userPlan === 'pro')) {
            console.log('[API] User is studio/pro - uploading track to cloud storage:', this.name);
            
            try {
                if (typeof apiClient !== 'undefined') {
                    const userId = getCurrentUserId();
                    const projectName = this.projectName || 'Untitled Project';
                    console.log('[API] Calling apiClient.uploadTrack for:', this.name, 'Size:', this.file.size, 'Project:', projectName);
                    
                    const result = await apiClient.uploadTrack(this.file, {
                        userId: userId,
                        projectName: projectName,
                        trackName: this.name,
                        trackId: this.id
                    });
                    
                    console.log('[API] Upload successful for track:', this.name, 'Result:', result);
                    this.isHttpStored = true;
                    this.audioFileId = result.id; // Use the returned ID from cloud storage
                    this.file = null; // Clear file to save memory since it's now in cloud
                    
                    console.log('[STORAGE] Track marked as cloud stored with ID:', this.audioFileId);
                } else {
                    console.warn('[STORAGE] apiClient not available, falling back to IndexedDB');
                }
            } catch (error) {
                console.error('[API] Upload failed for track:', this.name, error);
                console.log('[STORAGE] Falling back to IndexedDB due to upload failure');
                // Continue with IndexedDB fallback
            }
        }
        
        // Home users or fallback: Save to IndexedDB
        if (isUserLoggedIn && this.file && !this.audioFileId && !this.isHttpStored && typeof audioStorage !== 'undefined') {
            console.log('[STORAGE] Saving file to IndexedDB (Home plan or fallback)...');
            this.audioFileId = this.id; // Use track ID as audio file ID
            await audioStorage.saveAudioFile(this.audioFileId, this.file);
            console.log('[STORAGE] File saved to IndexedDB with ID:', this.audioFileId);
        } else if (!isUserLoggedIn && this.file) {
            console.log('[STORAGE] User not logged in - keeping file in memory only (guest mode)');
            // Create object URL for in-memory playback
            if (!this.objectUrl) {
                this.objectUrl = URL.createObjectURL(this.file);
            }
        }
        
        const json = {
            id: this.id,
            name: this.name,
            originalFileName: this.originalFileName,
            fileSize: this.fileSize,
            audioFileId: this.audioFileId,
            objectUrl: this.objectUrl, // Include object URL for guest mode
            streamUrl: this.streamUrl, // Include streaming URL for cloud tracks
            isHttpStored: this.isHttpStored, // Include cloud storage flag
            volume: this.volume,
            pan: this.pan,
            mute: this.mute,
            solo: this.solo,
            startTime: this.startTime,
            endTime: this.endTime,
            waveform: this.waveform,
            offset: this.offset
        };
        
        console.log('[STORAGE] Track.toJSON result - isHttpStored:', json.isHttpStored, 'audioFileId:', !!json.audioFileId);
        return json;
    }
    
    static async fromJSON(json) {
        console.log('[STORAGE] Track.fromJSON called for:', json.name);
        console.log('[STORAGE] JSON has audioFileId:', !!json.audioFileId);
        console.log('[STORAGE] JSON isHttpStored:', json.isHttpStored);
        
        const track = new Track(json);
        
        // Restore objectUrl if it exists (guest mode)
        if (json.objectUrl) {
            track.objectUrl = json.objectUrl;
            console.log('[STORAGE] Restored objectUrl for guest mode');
        }
        
        // Restore streamUrl if it exists (cloud-stored tracks)
        if (json.streamUrl) {
            track.streamUrl = json.streamUrl;
            console.log('[STORAGE] Restored streamUrl for cloud-stored track');
        }
        
        // Retrieve file from IndexedDB only if NOT cloud-stored and user is logged in
        const isUserLoggedIn = window.firebaseAuth && window.firebaseAuth.auth && window.firebaseAuth.auth.currentUser;
        
        if (isUserLoggedIn && json.audioFileId && !track.file && !json.isHttpStored && typeof audioStorage !== 'undefined') {
            console.log('[STORAGE] Track is locally stored - retrieving file from IndexedDB with ID:', json.audioFileId);
            track.file = await audioStorage.getAudioFile(json.audioFileId);
            console.log('[STORAGE] File retrieved from IndexedDB:', !!track.file);
        } else if (json.isHttpStored) {
            console.log('[STORAGE] Track is cloud-stored - will be hydrated via API later, skipping IndexedDB');
        }
        
        console.log('[STORAGE] Track.fromJSON result has file:', !!track.file, 'has streamUrl:', !!track.streamUrl);
        return track;
    }
}

/**
 * Project data structure
 * Contains all tracks and metadata for a music project
 */
class Project {
    constructor(data = {}) {
        this.id = data.id || this.generateId();
        this.name = data.name || 'Untitled Project';
        this.key = data.key || '';
        this.bpm = data.bpm || null;
        this.artist = data.artist || '';
        this.album = data.album || '';
        this.genre = data.genre || '';
        this.cover = data.cover || null;
        
        // Don't call fromJSON in constructor - handle it in fromJSON static method
        // If tracks are passed, they should already be Track instances or plain objects
        this.tracks = data.tracks ? data.tracks.map(t => new Track(t)) : [];
        
        this.createdAt = data.createdAt || new Date().toISOString();
        this.updatedAt = data.updatedAt || new Date().toISOString();
        this.favorite = data.favorite || false;
        this.playCount = data.playCount || 0;
        this.lastPlayed = data.lastPlayed || null;
        
        // Future multitrack player state
        this.playbackState = data.playbackState || 'stopped'; // stopped, playing, paused
        this.currentTime = data.currentTime || 0;
        this.totalDuration = data.totalDuration || 0;
        this.loopEnabled = data.loopEnabled || false;
        this.loopStart = data.loopStart || 0;
        this.loopEnd = data.loopEnd || 0;
    }
    
    generateId() {
        return 'project_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    addTrack(trackData) {
        const track = new Track(trackData);
        this.tracks.push(track);
        this.updateTimestamp();
        return track;
    }
    
    async removeTrack(trackId) {
        const track = this.tracks.find(t => t.id === trackId);
        if (track && track.isHttpStored && track.audioFileId) {
            // Delete cloud-stored track from R2
            try {
                if (typeof apiClient !== 'undefined') {
                    await apiClient.deleteTrack(track.audioFileId);
                    console.log('[STORAGE] Deleted cloud track from R2:', track.audioFileId);
                }
            } catch (error) {
                console.error('[STORAGE] Failed to delete cloud track from R2:', track.audioFileId, error);
                // Continue with track removal even if R2 deletion fails
            }
        }
        
        this.tracks = this.tracks.filter(t => t.id !== trackId);
        this.updateTimestamp();
    }
    
    updateTrack(trackId, updates) {
        const track = this.tracks.find(t => t.id === trackId);
        if (track) {
            Object.assign(track, updates);
            this.updateTimestamp();
        }
    }
    
    reorderTracks(newOrder) {
        const orderedTracks = [];
        newOrder.forEach(id => {
            const track = this.tracks.find(t => t.id === id);
            if (track) orderedTracks.push(track);
        });
        this.tracks = orderedTracks;
        this.updateTimestamp();
    }
    
    updateTimestamp() {
        this.updatedAt = new Date().toISOString();
    }
    
    getTrackCount() {
        return this.tracks.length;
    }
    
    getTotalDuration() {
        if (this.totalDuration > 0) return this.totalDuration;
        // Calculate from tracks if not set
        const maxDuration = Math.max(...this.tracks.map(t => t.duration || 0));
        return maxDuration;
    }
    
    async toJSON(onProgress) {
        const tracksData = [];
        for (let i = 0; i < this.tracks.length; i++) {
            // Ensure track is a Track instance
            const trackInstance = this.tracks[i] instanceof Track ? this.tracks[i] : new Track(this.tracks[i]);
            
            // Set project name for upload metadata
            if (trackInstance.file && !trackInstance.isHttpStored) {
                trackInstance.projectName = this.name;
            }
            
            const trackJSON = await trackInstance.toJSON();
            tracksData.push(trackJSON);
            
            // Report progress if callback provided
            if (onProgress) {
                onProgress(i + 1, this.tracks.length);
            }
        }
        
        return {
            id: this.id,
            name: this.name,
            key: this.key,
            bpm: this.bpm,
            artist: this.artist,
            album: this.album,
            genre: this.genre,
            cover: this.cover,
            tracks: tracksData,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            favorite: this.favorite,
            playCount: this.playCount,
            lastPlayed: this.lastPlayed,
            playbackState: this.playbackState,
            currentTime: this.currentTime,
            totalDuration: this.totalDuration,
            loopEnabled: this.loopEnabled,
            loopStart: this.loopStart,
            loopEnd: this.loopEnd
        };
    }
    
    static async fromJSON(json) {
        console.log('[STORAGE] Project.fromJSON called for:', json.name);
        
        const project = new Project(json);
        
        // Convert tracks from JSON (async for base64 decoding)
        project.tracks = [];
        if (json.tracks && Array.isArray(json.tracks)) {
            for (const trackJSON of json.tracks) {
                const track = await Track.fromJSON(trackJSON);
                project.tracks.push(track);
            }
        }
        
        console.log('[STORAGE] Project.fromJSON completed, tracks:', project.tracks.length);
        return project;
    }
}

/**
 * Storage Manager
 * Handles localStorage operations and project management
 */
class StorageManager {
    constructor() {
        this.projects = [];
        this.playlists = [];
        this.loaded = false;
        this.load();
    }
    
    async load() {
        try {
            const storageKey = getStorageKey();
            const playlistsStorageKey = getPlaylistsStorageKey();
            
            console.log('[STORAGE] Loading projects for user:', getCurrentUserId());
            
            // Load projects
            const data = localStorage.getItem(storageKey);
            if (data) {
                const parsed = JSON.parse(data);
                if (parsed.version === STORAGE_VERSION) {
                    this.projects = [];
                    for (const p of parsed.projects) {
                        const project = await Project.fromJSON(p);
                        this.projects.push(project);
                    }
                } else {
                    // Handle version migration if needed
                    this.projects = [];
                }
            }
            
            // Load playlists
            const playlistsData = localStorage.getItem(playlistsStorageKey);
            if (playlistsData) {
                const parsedPlaylists = JSON.parse(playlistsData);
                this.playlists = parsedPlaylists.map(p => Playlist.fromJSON(p));
            }
            
            this.loaded = true;
        } catch (error) {
            console.error('Error loading projects:', error);
            this.projects = [];
            this.playlists = [];
            this.loaded = true;
        }
    }
    
    async save(onProgress) {
        try {
            const storageKey = getStorageKey();
            const playlistsStorageKey = getPlaylistsStorageKey();
            const userId = getCurrentUserId();
            
            console.log('[STORAGE] save() called for user:', userId, 'projects:', this.projects.length);
            const projectsData = [];
            for (const project of this.projects) {
                console.log('[STORAGE] Converting project to JSON:', project.name);
                const projectJSON = await project.toJSON(onProgress);
                projectsData.push(projectJSON);
            }
            
            const data = {
                version: STORAGE_VERSION,
                projects: projectsData
            };
            localStorage.setItem(storageKey, JSON.stringify(data));
            
            // Save playlists
            const playlistsData = this.playlists.map(p => p.toJSON());
            localStorage.setItem(playlistsStorageKey, JSON.stringify(playlistsData));
            
            console.log('[STORAGE] save() completed successfully');
        } catch (error) {
            console.error('[STORAGE] Error saving projects:', error);
            throw error;
        }
    }
    
    getAllProjects() {
        return [...this.projects];
    }
    
    getProject(id) {
        return this.projects.find(p => p.id === id);
    }
    
    async createProject(projectData, onProgress) {
        console.log('[STORAGE] createProject called with:', projectData);
        console.log('[STORAGE] Tracks in projectData:', projectData.tracks.length);
        
        const project = new Project(projectData);
        
        console.log('[STORAGE] Project created, tracks:', project.tracks.length);
        console.log('[STORAGE] First track after Project constructor:', project.tracks[0]);
        
        // Check if user is authenticated
        const isUserLoggedIn = window.firebaseAuth && window.firebaseAuth.auth && window.firebaseAuth.auth.currentUser;
        
        if (isUserLoggedIn) {
            // User is logged in - save to storage
            this.projects.unshift(project);
            await this.save(onProgress);
            console.log('[STORAGE] Project saved and added to storage');
        } else {
            // User is not logged in - keep in memory only
            this.projects.unshift(project);
            console.log('[STORAGE] Project added to memory only (guest mode)');
        }
        
        console.log('[STORAGE] Returning project:', project.name);
        return project;
    }
    
    async duplicateProject(id) {
        const original = this.getProject(id);
        if (original) {
            const duplicate = new Project({
                ...await original.toJSON(),
                id: undefined,
                name: `${original.name} (copy)`,
                createdAt: undefined,
                updatedAt: undefined
            });
            this.projects.unshift(duplicate);
            await this.save();
            return duplicate;
        }
        return null;
    }
    
    async toggleFavorite(id) {
        const project = this.getProject(id);
        if (project) {
            project.favorite = !project.favorite;
            await this.save();
            return project.favorite;
        }
        return false;
    }
    
    async incrementPlayCount(id) {
        const project = this.getProject(id);
        if (project) {
            project.playCount++;
            project.lastPlayed = new Date().toISOString();
            await this.save();
        }
    }
    
    async updateProject(id, updates) {
        const project = this.getProject(id);
        if (project) {
            Object.assign(project, updates);
            project.updateTimestamp();
            await this.save();
            return project;
        }
        return null;
    }
    
    async deleteProject(id) {
        const index = this.projects.findIndex(p => p.id === id);
        if (index !== -1) {
            const project = this.projects[index];
            
            // Delete cloud-stored tracks from R2 before removing project
            for (const track of project.tracks) {
                if (track.isHttpStored && track.audioFileId) {
                    try {
                        if (typeof apiClient !== 'undefined') {
                            await apiClient.deleteTrack(track.audioFileId);
                            console.log('[STORAGE] Deleted cloud track from R2:', track.audioFileId);
                        }
                    } catch (error) {
                        console.error('[STORAGE] Failed to delete cloud track from R2:', track.audioFileId, error);
                        // Continue with project deletion even if R2 deletion fails
                    }
                }
            }
            
            this.projects.splice(index, 1);
            await this.save();
            console.log('[STORAGE] Project deleted:', id);
            return true;
        }
        return false;
    }
    
    async clearAll() {
        const storageKey = getStorageKey();
        const playlistsStorageKey = getPlaylistsStorageKey();
        
        // Delete all cloud-stored tracks from R2 before clearing
        for (const project of this.projects) {
            for (const track of project.tracks) {
                if (track.isHttpStored && track.audioFileId) {
                    try {
                        if (typeof apiClient !== 'undefined') {
                            await apiClient.deleteTrack(track.audioFileId);
                            console.log('[STORAGE] Deleted cloud track from R2 during clearAll:', track.audioFileId);
                        }
                    } catch (error) {
                        console.error('[STORAGE] Failed to delete cloud track from R2 during clearAll:', track.audioFileId, error);
                        // Continue with clearing even if R2 deletion fails
                    }
                }
            }
        }
        
        this.projects = [];
        this.playlists = [];
        localStorage.removeItem(storageKey);
        localStorage.removeItem(playlistsStorageKey);
        console.log('[STORAGE] All projects and playlists cleared for user:', getCurrentUserId());
    }
    
    getProjectsByFilter(filter) {
        switch (filter) {
            case 'recent':
                return this.getAllProjects().sort((a, b) => 
                    new Date(b.updatedAt) - new Date(a.updatedAt)
                );
            case 'favorites':
                return this.getAllProjects().filter(p => p.favorite);
            default:
                return this.getAllProjects();
        }
    }
    
    searchProjects(query) {
        const lowerQuery = query.toLowerCase();
        return this.getAllProjects().filter(p => 
            p.name.toLowerCase().includes(lowerQuery) ||
            p.artist.toLowerCase().includes(lowerQuery) ||
            p.album.toLowerCase().includes(lowerQuery)
        );
    }
    
    exportProject(id) {
        const project = this.getProject(id);
        if (project) {
            return JSON.stringify(project.toJSON(), null, 2);
        }
        return null;
    }
    
    importProject(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            const project = Project.fromJSON(data);
            project.id = this.generateId(); // Generate new ID on import
            this.projects.unshift(project);
            this.save();
            return project;
        } catch (error) {
            console.error('Error importing project:', error);
            return null;
        }
    }
    
    generateId() {
        return 'project_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    clearAll() {
        this.projects = [];
        this.playlists = [];
        this.save();
    }
    
    getStorageSize() {
        const storageKey = getStorageKey();
        const data = localStorage.getItem(storageKey);
        return data ? new Blob([data]).size : 0;
    }
    
    // Playlist management methods
    getAllPlaylists() {
        return [...this.playlists];
    }
    
    getPlaylist(id) {
        return this.playlists.find(p => p.id === id);
    }
    
    async createPlaylist(playlistData) {
        const playlist = new Playlist(playlistData);
        this.playlists.unshift(playlist);
        await this.save();
        return playlist;
    }
    
    async updatePlaylist(id, updates) {
        const playlist = this.getPlaylist(id);
        if (playlist) {
            Object.assign(playlist, updates);
            playlist.updateTimestamp();
            await this.save();
            return playlist;
        }
        return null;
    }
    
    async deletePlaylist(id) {
        const index = this.playlists.findIndex(p => p.id === id);
        if (index !== -1) {
            this.playlists.splice(index, 1);
            await this.save();
            console.log('[STORAGE] Playlist deleted:', id);
            return true;
        }
        return false;
    }
    
    getPlaylistProjects(playlistId) {
        const playlist = this.getPlaylist(playlistId);
        if (!playlist) return [];
        
        return playlist.projectIds.map(id => this.getProject(id)).filter(p => p !== undefined);
    }
}

// Initialize global storage instance
const storage = new StorageManager();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { StorageManager, Project, Track, storage };
}
