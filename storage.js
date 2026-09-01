/**
 * Multracks Storage Module
 * Handles data persistence for projects and tracks
 * Architecture prepared for future multitrack player functionality
 */

const STORAGE_VERSION = 1;

// Storage operation versioning to prevent race conditions
let storageOperationVersion = 0;

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
        this.audioFileId = data.audioFileId || null; // ID for IndexedDB storage
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
        console.log('[STORAGE] Track current audioFileId:', this.audioFileId);
        
        // Save file to IndexedDB if file exists and we don't have an audioFileId yet
        // This now works for both logged in users and guests to enable persistence across refresh
        if (this.file && !this.audioFileId && typeof audioStorage !== 'undefined') {
            console.log('[STORAGE] Saving file to IndexedDB...');
            this.audioFileId = this.id; // Use track ID as audio file ID
            await audioStorage.saveAudioFile(this.audioFileId, this.file);
            console.log('[STORAGE] File saved to IndexedDB with ID:', this.audioFileId);
        }
        
        const json = {
            id: this.id,
            name: this.name,
            originalFileName: this.originalFileName,
            fileSize: this.fileSize,
            audioFileId: this.audioFileId,
            volume: this.volume,
            pan: this.pan,
            mute: this.mute,
            solo: this.solo,
            startTime: this.startTime,
            endTime: this.endTime,
            waveform: this.waveform,
            offset: this.offset
        };
        
        console.log('[STORAGE] Track.toJSON result has audioFileId:', !!json.audioFileId, 'Value:', json.audioFileId);
        return json;
    }
    
    static async fromJSON(json) {
        console.log('[STORAGE] Track.fromJSON called for:', json.name);
        console.log('[STORAGE] JSON has audioFileId:', !!json.audioFileId, 'Value:', json.audioFileId);
        
        const track = new Track(json);
        
        // Retrieve file from IndexedDB if audioFileId exists
        // This now works for both logged in users and guests
        if (json.audioFileId && !track.file && typeof audioStorage !== 'undefined') {
            console.log('[STORAGE] Retrieving file from IndexedDB with ID:', json.audioFileId);
            track.file = await audioStorage.getAudioFile(json.audioFileId);
            console.log('[STORAGE] File retrieved from IndexedDB:', !!track.file);
        }
        
        console.log('[STORAGE] Track.fromJSON result has file:', !!track.file);
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
    
    removeTrack(trackId) {
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
        console.log('[STORAGE] Project.toJSON called for:', this.name);
        const tracksData = [];
        for (let i = 0; i < this.tracks.length; i++) {
            // Ensure track is a Track instance
            const trackInstance = this.tracks[i] instanceof Track ? this.tracks[i] : new Track(this.tracks[i]);
            const trackJSON = await trackInstance.toJSON();
            tracksData.push(trackJSON);
            
            // Report progress if callback provided
            if (onProgress) {
                onProgress(i + 1, this.tracks.length);
            }
        }
        
        console.log('[STORAGE] Project.toJSON completed, tracks with audioFileId:', tracksData.filter(t => t.audioFileId).length, '/', tracksData.length);
        
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
        // Capture version at start of load operation
        const loadVersion = ++storageOperationVersion;
        console.log('[STORAGE] LOAD OPERATION VERSION:', loadVersion);
        
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
            
            // Validate version before applying results
            if (loadVersion !== storageOperationVersion) {
                console.log('[STORAGE] Load operation stale, discarding results:', loadVersion, 'current:', storageOperationVersion);
                return;
            }
            
            this.loaded = true;
            console.log('[STORAGE] Load completed, total projects:', this.projects.length);
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
        
        // Always save to localStorage for both logged in users and guests
        // This ensures audioFileId is persisted across page refreshes
        this.projects.unshift(project);
        console.log('[STORAGE] Project added to memory, total projects:', this.projects.length);
        await this.save(onProgress);
        console.log('[STORAGE] Project saved and added to storage');
        
        // Log audioFileId for each track
        project.tracks.forEach(track => {
            console.log('[STORAGE] Track audioFileId:', track.name, ':', track.audioFileId);
        });
        
        console.log('[STORAGE] Returning project:', project.name);
        console.log('[STORAGE] Project is now available in getProjectsByFilter:', this.getProjectsByFilter('all').length);
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
        // Capture version at start of delete operation
        const deleteVersion = ++storageOperationVersion;
        console.log('[STORAGE] DELETE OPERATION VERSION:', deleteVersion, 'for project:', id);
        
        const index = this.projects.findIndex(p => p.id === id);
        if (index !== -1) {
            const project = this.projects[index];
            this.projects.splice(index, 1);
            
            // Save and validate version
            await this.save();
            
            // Validate version before confirming deletion
            if (deleteVersion !== storageOperationVersion) {
                console.log('[STORAGE] Delete operation stale, may need to reload:', deleteVersion, 'current:', storageOperationVersion);
                // Reload to ensure consistency
                await this.load();
                return false;
            }
            
            console.log('[STORAGE] Project deleted:', id);
            return true;
        }
        return false;
    }
    
    async clearAll() {
        const storageKey = getStorageKey();
        const playlistsStorageKey = getPlaylistsStorageKey();
        
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
