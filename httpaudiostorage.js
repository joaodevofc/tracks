/**
 * HTTP Audio Storage Manager
 * Handles audio file streaming from the backend server instead of IndexedDB
 * This provides cloud storage synchronized across devices
 */

class HttpAudioStorage {
    constructor() {
        this.useIndexedDB = false; // Fallback to IndexedDB if API unavailable
        this.audioStorage = null; // IndexedDB fallback
        this.init();
    }

    async init() {
        // Initialize IndexedDB as fallback
        if (typeof AudioStorage !== 'undefined') {
            this.audioStorage = new AudioStorage();
            await this.audioStorage.init();
        }
    }

    /**
     * Check if API is available
     */
    async isApiAvailable() {
        try {
            await apiClient.healthCheck();
            return true;
        } catch (error) {
            console.warn('[HTTP AUDIO STORAGE] API not available, falling back to IndexedDB');
            this.useIndexedDB = true;
            return false;
        }
    }

    /**
     * Get storage usage info (always returns 0 for HTTP storage)
     */
    async getStorageInfo() {
        if (this.useIndexedDB && this.audioStorage) {
            return await this.audioStorage.getStorageInfo();
        }
        
        // HTTP storage doesn't use browser storage
        return {
            usage: 0,
            quota: 0,
            available: 0,
            usagePercent: 0
        };
    }

    /**
     * Get total size (always returns 0 for HTTP storage)
     */
    async getTotalSize() {
        if (this.useIndexedDB && this.audioStorage) {
            return await this.audioStorage.getTotalSize();
        }
        
        // HTTP storage doesn't use browser storage
        return 0;
    }

    /**
     * Check space available (always returns true for HTTP storage)
     */
    async checkSpaceAvailable(requiredSize) {
        if (this.useIndexedDB && this.audioStorage) {
            return await this.audioStorage.checkSpaceAvailable(requiredSize);
        }
        
        // HTTP storage has no browser storage limits
        return {
            available: true,
            requiredSize,
            currentSize: 0,
            freeSpace: Infinity,
            storageInfo: { usage: 0, quota: 0, available: 0, usagePercent: 0 }
        };
    }

    /**
     * Format bytes to human readable size
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * Save audio file (no-op for HTTP storage - files are uploaded via API)
     */
    async saveAudioFile(id, file) {
        if (this.useIndexedDB && this.audioStorage) {
            return await this.audioStorage.saveAudioFile(id, file);
        }
        
        // HTTP storage files are uploaded via apiClient.uploadTrack
        console.log('[HTTP AUDIO STORAGE] saveAudioFile called (no-op for HTTP storage)');
        console.log('[HTTP AUDIO STORAGE] Files should be uploaded via apiClient.uploadTrack');
    }

    /**
     * Get audio file - returns a URL for streaming
     */
    async getAudioFile(id) {
        // Check if API is available
        const apiAvailable = await this.isApiAvailable();

        if (apiAvailable) {
            // Return streaming URL
            const streamUrl = apiClient.getTrackStreamUrl(id);
            console.log('[HTTP AUDIO STORAGE] Returning stream URL for:', id);
            return streamUrl;
        } else if (this.audioStorage) {
            // Fallback to IndexedDB
            console.log('[HTTP AUDIO STORAGE] Falling back to IndexedDB for:', id);
            return await this.audioStorage.getAudioFile(id);
        }

        return null;
    }

    /**
     * Delete audio file
     */
    async deleteAudioFile(id) {
        if (this.useIndexedDB && this.audioStorage) {
            return await this.audioStorage.deleteAudioFile(id);
        }
        
        // HTTP storage files are deleted via apiClient.deleteTrack
        console.log('[HTTP AUDIO STORAGE] deleteAudioFile called (no-op for HTTP storage)');
        console.log('[HTTP AUDIO STORAGE] Files should be deleted via apiClient.deleteTrack');
    }

    /**
     * Clear all audio files
     */
    async clearAllAudioFiles() {
        if (this.useIndexedDB && this.audioStorage) {
            return await this.audioStorage.clearAllAudioFiles();
        }
        
        // HTTP storage files are deleted via project deletion
        console.log('[HTTP AUDIO STORAGE] clearAllAudioFiles called (no-op for HTTP storage)');
    }

    /**
     * Get all audio file IDs
     */
    async getAllAudioFileIds() {
        if (this.useIndexedDB && this.audioStorage) {
            return await this.audioStorage.getAllAudioFileIds();
        }
        
        // HTTP storage doesn't track IDs locally
        return [];
    }

    /**
     * Clear all
     */
    async clearAll() {
        if (this.useIndexedDB && this.audioStorage) {
            return await this.audioStorage.clearAll();
        }
        
        console.log('[HTTP AUDIO STORAGE] clearAll called (no-op for HTTP storage)');
    }

    /**
     * Load a track for playback
     * This method returns a URL that can be used with HTML5 Audio
     */
    async loadTrackForPlayback(trackId) {
        const apiAvailable = await this.isApiAvailable();

        if (apiAvailable) {
            // Return streaming URL
            return apiClient.getTrackStreamUrl(trackId);
        } else if (this.audioStorage) {
            // Fallback: load from IndexedDB and create object URL
            const file = await this.audioStorage.getAudioFile(trackId);
            if (file) {
                return URL.createObjectURL(file);
            }
        }

        return null;
    }

    /**
     * Clean up object URLs created for fallback playback
     */
    revokeObjectUrl(url) {
        if (url && url.startsWith('blob:')) {
            URL.revokeObjectURL(url);
        }
    }
}

// Initialize global HTTP audio storage instance
const httpAudioStorage = new HttpAudioStorage();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { HttpAudioStorage, httpAudioStorage };
}
