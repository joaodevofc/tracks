/**
 * HTTP Storage Manager
 * Handles data persistence using the backend API instead of IndexedDB
 * This provides cloud storage synchronized across devices
 */

class HttpStorageManager {
    constructor() {
        this.projects = [];
        this.loaded = false;
        this.currentUserId = null;
        this.useLocalStorage = false; // Fallback to localStorage if API unavailable
    }

    /**
     * Set the current user ID
     */
    setUserId(userId) {
        this.currentUserId = userId;
        console.log('[HTTP STORAGE] User ID set:', userId);
    }

    /**
     * Get the current user ID
     */
    getUserId() {
        return this.currentUserId;
    }

    /**
     * Check if API is available
     */
    async isApiAvailable() {
        try {
            await apiClient.healthCheck();
            return true;
        } catch (error) {
            console.warn('[HTTP STORAGE] API not available, falling back to localStorage');
            this.useLocalStorage = true;
            return false;
        }
    }

    /**
     * Load projects from API or localStorage
     */
    async load() {
        try {
            // First check if API is available
            const apiAvailable = await this.isApiAvailable();

            if (apiAvailable && this.currentUserId) {
                // Load from API
                console.log('[HTTP STORAGE] Loading projects from API for user:', this.currentUserId);
                await this.loadFromApi();
            } else {
                // Fallback to localStorage
                console.log('[HTTP STORAGE] Loading projects from localStorage');
                await this.loadFromLocalStorage();
            }

            this.loaded = true;
        } catch (error) {
            console.error('[HTTP STORAGE] Error loading projects:', error);
            // Fallback to localStorage on error
            await this.loadFromLocalStorage();
            this.loaded = true;
        }
    }

    /**
     * Load projects from API
     */
    async loadFromApi() {
        try {
            if (!this.currentUserId) {
                console.warn('[HTTP STORAGE] No user ID set, cannot load from API');
                return;
            }

            const tracks = await apiClient.getUserTracks(this.currentUserId);
            
            // Group tracks by project name to recreate projects
            const projectsMap = new Map();
            
            tracks.forEach(track => {
                const projectName = track.projectName;
                if (!projectsMap.has(projectName)) {
                    projectsMap.set(projectName, {
                        id: `project_${projectName.replace(/\s+/g, '_').toLowerCase()}`,
                        name: projectName,
                        tracks: [],
                        updatedAt: track.createdAt
                    });
                }
                
                const project = projectsMap.get(projectName);
                project.tracks.push({
                    id: track.id,
                    name: track.trackName,
                    originalFileName: track.originalFileName,
                    fileSize: track.fileSize,
                    audioFileId: track.id, // Use track ID as audio file ID
                    file: null, // File will be loaded on demand
                    mimeType: track.mimeType,
                    isHttpStored: true // Flag to indicate this is stored via HTTP
                });
            });

            // Convert map to array and create Project instances
            this.projects = Array.from(projectsMap.values()).map(p => new Project(p));
            
            console.log('[HTTP STORAGE] Loaded', this.projects.length, 'projects from API');
        } catch (error) {
            console.error('[HTTP STORAGE] Error loading from API:', error);
            throw error;
        }
    }

    /**
     * Load projects from localStorage (fallback)
     */
    async loadFromLocalStorage() {
        const STORAGE_KEY = 'multracks_projects';
        const STORAGE_VERSION = 1;

        try {
            const data = localStorage.getItem(STORAGE_KEY);
            if (data) {
                const parsed = JSON.parse(data);
                if (parsed.version === STORAGE_VERSION) {
                    this.projects = [];
                    for (const p of parsed.projects) {
                        const project = await Project.fromJSON(p);
                        this.projects.push(project);
                    }
                } else {
                    this.projects = [];
                }
            }
        } catch (error) {
            console.error('[HTTP STORAGE] Error loading from localStorage:', error);
            this.projects = [];
        }
    }

    /**
     * Save projects (no-op for API since data is saved immediately)
     */
    async save(onProgress) {
        if (this.useLocalStorage) {
            // Fallback to localStorage save
            return this.saveToLocalStorage(onProgress);
        }
        
        // API saves are immediate, so this is a no-op
        console.log('[HTTP STORAGE] Save called (API mode - data already saved)');
    }

    /**
     * Save to localStorage (fallback)
     */
    async saveToLocalStorage(onProgress) {
        const STORAGE_KEY = 'multracks_projects';
        const STORAGE_VERSION = 1;

        try {
            const projectsData = [];
            for (const project of this.projects) {
                const projectJSON = await project.toJSON(onProgress);
                projectsData.push(projectJSON);
            }

            const data = {
                version: STORAGE_VERSION,
                projects: projectsData
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (error) {
            console.error('[HTTP STORAGE] Error saving to localStorage:', error);
            throw error;
        }
    }

    /**
     * Get all projects
     */
    getAllProjects() {
        return [...this.projects];
    }

    /**
     * Get a specific project
     */
    getProject(id) {
        return this.projects.find(p => p.id === id);
    }

    /**
     * Create a new project
     */
    async createProject(projectData, onProgress) {
        console.log('[HTTP STORAGE] createProject called with:', projectData);
        
        const project = new Project(projectData);
        
        // If using API, upload tracks immediately
        if (!this.useLocalStorage && this.currentUserId) {
            await this.uploadProjectTracks(project, onProgress);
        }

        this.projects.unshift(project);
        await this.save(onProgress);

        return project;
    }

    /**
     * Upload all tracks for a project to the API
     */
    async uploadProjectTracks(project, onProgress) {
        if (!this.currentUserId) {
            console.warn('[HTTP STORAGE] No user ID set, skipping upload');
            return;
        }

        console.log('[HTTP STORAGE] Uploading tracks for project:', project.name);

        for (let i = 0; i < project.tracks.length; i++) {
            const track = project.tracks[i];
            
            if (track.file && !track.isHttpStored) {
                try {
                    const result = await apiClient.uploadTrack(track.file, {
                        userId: this.currentUserId,
                        projectName: project.name,
                        trackName: track.name,
                        trackId: track.id
                    });

                    // Update track with server response
                    track.audioFileId = result.id;
                    track.isHttpStored = true;
                    track.file = null; // Clear file to save memory

                    console.log('[HTTP STORAGE] Uploaded track:', track.name);
                } catch (error) {
                    console.error('[HTTP STORAGE] Error uploading track:', track.name, error);
                    // Continue with other tracks even if one fails
                }
            }

            // Report progress
            if (onProgress) {
                onProgress(i + 1, project.tracks.length);
            }
        }
    }

    /**
     * Duplicate a project
     */
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
            
            // Upload tracks for duplicate if using API
            if (!this.useLocalStorage && this.currentUserId) {
                await this.uploadProjectTracks(duplicate);
            }

            this.projects.unshift(duplicate);
            await this.save();
            return duplicate;
        }
        return null;
    }

    /**
     * Toggle favorite
     */
    async toggleFavorite(id) {
        const project = this.getProject(id);
        if (project) {
            project.favorite = !project.favorite;
            await this.save();
            return project.favorite;
        }
        return false;
    }

    /**
     * Increment play count
     */
    async incrementPlayCount(id) {
        const project = this.getProject(id);
        if (project) {
            project.playCount++;
            project.lastPlayed = new Date().toISOString();
            await this.save();
        }
    }

    /**
     * Update a project
     */
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

    /**
     * Delete a project
     */
    async deleteProject(id) {
        const index = this.projects.findIndex(p => p.id === id);
        if (index !== -1) {
            const project = this.projects[index];
            
            // Delete tracks from API if using HTTP storage
            if (!this.useLocalStorage) {
                for (const track of project.tracks) {
                    if (track.isHttpStored && track.audioFileId) {
                        try {
                            await apiClient.deleteTrack(track.audioFileId);
                            console.log('[HTTP STORAGE] Deleted track from API:', track.audioFileId);
                        } catch (error) {
                            console.error('[HTTP STORAGE] Error deleting track from API:', track.audioFileId, error);
                        }
                    }
                }
            }

            this.projects.splice(index, 1);
            await this.save();
            console.log('[HTTP STORAGE] Project deleted:', id);
            return true;
        }
        return false;
    }

    /**
     * Clear all projects
     */
    async clearAll() {
        // Delete all tracks from API if using HTTP storage
        if (!this.useLocalStorage) {
            for (const project of this.projects) {
                for (const track of project.tracks) {
                    if (track.isHttpStored && track.audioFileId) {
                        try {
                            await apiClient.deleteTrack(track.audioFileId);
                        } catch (error) {
                            console.error('[HTTP STORAGE] Error deleting track:', error);
                        }
                    }
                }
            }
        }

        this.projects = [];
        localStorage.removeItem('multracks_projects');
        console.log('[HTTP STORAGE] All projects cleared');
    }

    /**
     * Get projects by filter
     */
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

    /**
     * Search projects
     */
    searchProjects(query) {
        const lowerQuery = query.toLowerCase();
        return this.getAllProjects().filter(p => 
            p.name.toLowerCase().includes(lowerQuery) ||
            p.artist.toLowerCase().includes(lowerQuery) ||
            p.album.toLowerCase().includes(lowerQuery)
        );
    }

    /**
     * Export project
     */
    exportProject(id) {
        const project = this.getProject(id);
        if (project) {
            return JSON.stringify(project.toJSON(), null, 2);
        }
        return null;
    }

    /**
     * Import project
     */
    importProject(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            const project = Project.fromJSON(data);
            project.id = this.generateId();
            this.projects.unshift(project);
            this.save();
            return project;
        } catch (error) {
            console.error('[HTTP STORAGE] Error importing project:', error);
            return null;
        }
    }

    /**
     * Generate ID
     */
    generateId() {
        return 'project_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Get storage size (only relevant for localStorage)
     */
    getStorageSize() {
        if (this.useLocalStorage) {
            const data = localStorage.getItem('multracks_projects');
            return data ? new Blob([data]).size : 0;
        }
        return 0;
    }
}

// Initialize global HTTP storage instance
const httpStorage = new HttpStorageManager();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { HttpStorageManager, httpStorage };
}
