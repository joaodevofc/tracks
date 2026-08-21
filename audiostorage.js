/**
 * Audio Storage Manager
 * Handles IndexedDB operations for storing audio files
 * IndexedDB is used because localStorage has a ~5-10MB limit
 */

const AUDIO_DB_NAME = 'MultracksAudioDB';
const AUDIO_DB_VERSION = 1;
const AUDIO_STORE_NAME = 'audioFiles';

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

class AudioStorage {
    constructor() {
        this.db = null;
        this.init();
    }
    
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(AUDIO_DB_NAME, AUDIO_DB_VERSION);
            
            request.onerror = () => {
                console.error('[AUDIO STORAGE] Error opening IndexedDB:', request.error);
                reject(request.error);
            };
            
            request.onsuccess = async () => {
                this.db = request.result;
                console.log('[AUDIO STORAGE] IndexedDB opened successfully');
                
                // Request persistent storage
                await this.requestPersistentStorage();
                
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(AUDIO_STORE_NAME)) {
                    const objectStore = db.createObjectStore(AUDIO_STORE_NAME, { keyPath: 'id' });
                    console.log('[AUDIO STORAGE] Created object store:', AUDIO_STORE_NAME);
                }
            };
        });
    }
    
    /**
     * Request persistent storage to prevent automatic deletion
     */
    async requestPersistentStorage() {
        if (navigator.storage && navigator.storage.persist) {
            try {
                const granted = await navigator.storage.persist();
                const persisted = navigator.storage.persisted();
                
                console.log('[AUDIO STORAGE] Persistent storage requested:', granted);
                console.log('[AUDIO STORAGE] Storage persisted:', persisted);
                
                if (granted) {
                    console.log('[AUDIO STORAGE] ✅ Storage will not be cleared automatically');
                } else {
                    console.log('[AUDIO STORAGE] ⚠️ Storage may be cleared under pressure');
                }
            } catch (error) {
                console.warn('[AUDIO STORAGE] Could not request persistent storage:', error);
            }
        } else {
            console.log('[AUDIO STORAGE] Storage persistence API not available');
        }
    }
    
    /**
     * Get storage usage and quota
     */
    async getStorageInfo() {
        if (navigator.storage && navigator.storage.estimate) {
            try {
                const estimate = await navigator.storage.estimate();
                return {
                    usage: estimate.usage || 0,
                    quota: estimate.quota || 0,
                    available: (estimate.quota || 0) - (estimate.usage || 0),
                    usagePercent: estimate.quota ? ((estimate.usage || 0) / estimate.quota * 100) : 0
                };
            } catch (error) {
                console.warn('[AUDIO STORAGE] Could not get storage estimate:', error);
                return { usage: 0, quota: 0, available: 0, usagePercent: 0 };
            }
        }
        return { usage: 0, quota: 0, available: 0, usagePercent: 0 };
    }
    
    /**
     * Get total size of all stored audio files
     */
    async getTotalSize() {
        if (!this.db) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([AUDIO_STORE_NAME], 'readonly');
            const store = transaction.objectStore(AUDIO_STORE_NAME);
            const request = store.getAll();
            
            request.onsuccess = () => {
                const records = request.result || [];
                const totalSize = records.reduce((sum, record) => sum + (record.size || 0), 0);
                console.log('[AUDIO STORAGE] Total audio storage size:', totalSize, 'bytes');
                resolve(totalSize);
            };
            
            request.onerror = () => {
                console.error('[AUDIO STORAGE] Error getting total size:', request.error);
                reject(request.error);
            };
        });
    }
    
    /**
     * Check if there's enough space for files
     */
    async checkSpaceAvailable(requiredSize) {
        const storageInfo = await this.getStorageInfo();
        const currentSize = await this.getTotalSize();
        const freeSpace = storageInfo.available;
        
        const available = freeSpace >= requiredSize;
        
        console.log('[AUDIO STORAGE] Space check:');
        console.log('  Required:', requiredSize, 'bytes');
        console.log('  Current usage:', currentSize, 'bytes');
        console.log('  Free space:', freeSpace, 'bytes');
        console.log('  Available:', available);
        
        return {
            available,
            requiredSize,
            currentSize,
            freeSpace,
            storageInfo
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
    
    async saveAudioFile(id, file) {
        // Check if user is authenticated
        const isUserLoggedIn = window.firebaseAuth && window.firebaseAuth.auth && window.firebaseAuth.auth.currentUser;
        
        if (!isUserLoggedIn) {
            console.log('[AUDIO STORAGE] User not logged in - skipping IndexedDB save (guest mode)');
            return; // Don't save to IndexedDB for guests
        }
        
        if (!this.db) await this.init();
        
        // Check space availability before saving
        const spaceCheck = await this.checkSpaceAvailable(file.size);
        if (!spaceCheck.available) {
            const error = new Error(`Insufficient space. Required: ${this.formatBytes(file.size)}, Available: ${this.formatBytes(spaceCheck.freeSpace)}`);
            console.error('[AUDIO STORAGE]', error.message);
            throw error;
        }
        
        const userId = getCurrentUserId();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([AUDIO_STORE_NAME], 'readwrite');
            const store = transaction.objectStore(AUDIO_STORE_NAME);
            
            const record = {
                id: id,
                file: file,
                name: file.name,
                size: file.size,
                type: file.type,
                userId: userId, // Include userId for user isolation
                createdAt: new Date().toISOString()
            };
            
            const request = store.put(record);
            
            request.onsuccess = () => {
                console.log('[AUDIO STORAGE] Audio file saved:', id, 'for user:', userId, '(' + this.formatBytes(file.size) + ')');
                resolve();
            };
            
            request.onerror = () => {
                const error = request.error;
                console.error('[AUDIO STORAGE] Error saving audio file:', error);
                
                // Check if it's a quota exceeded error
                if (error.name === 'QuotaExceededError') {
                    const quotaError = new Error(`IndexedDB quota exceeded. The audio file (${this.formatBytes(file.size)}) is too large or storage is full. Consider clearing old audio files.`);
                    console.error('[AUDIO STORAGE]', quotaError.message);
                    reject(quotaError);
                } else {
                    reject(error);
                }
            };
        });
    }
    
    async getAudioFile(id) {
        if (!this.db) await this.init();
        
        const userId = getCurrentUserId();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([AUDIO_STORE_NAME], 'readonly');
            const store = transaction.objectStore(AUDIO_STORE_NAME);
            
            const request = store.get(id);
            
            request.onsuccess = () => {
                const record = request.result;
                if (record) {
                    // Verify that the file belongs to the current user
                    if (record.userId === userId) {
                        console.log('[AUDIO STORAGE] Audio file retrieved:', id, 'for user:', userId);
                        resolve(record.file);
                    } else {
                        console.warn('[AUDIO STORAGE] Audio file belongs to different user:', id, 'expected:', userId, 'got:', record.userId);
                        resolve(null);
                    }
                } else {
                    console.log('[AUDIO STORAGE] Audio file not found:', id);
                    resolve(null);
                }
            };
            
            request.onerror = () => {
                console.error('[AUDIO STORAGE] Error getting audio file:', request.error);
                reject(request.error);
            };
        });
    }
    
    async deleteAudioFile(id) {
        if (!this.db) await this.init();
        
        const userId = getCurrentUserId();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([AUDIO_STORE_NAME], 'readwrite');
            const store = transaction.objectStore(AUDIO_STORE_NAME);
            
            const request = store.delete(id);
            
            request.onsuccess = () => {
                console.log('[AUDIO STORAGE] Audio file deleted:', id, 'for user:', userId);
                resolve();
            };
            
            request.onerror = () => {
                console.error('[AUDIO STORAGE] Error deleting audio file:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Clear all audio files for the current user from IndexedDB
     */
    async clearAllAudioFiles() {
        if (!this.db) await this.init();
        
        const userId = getCurrentUserId();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([AUDIO_STORE_NAME], 'readwrite');
            const store = transaction.objectStore(AUDIO_STORE_NAME);
            
            // Clear all records in the store
            const clearRequest = store.clear();
            
            clearRequest.onsuccess = () => {
                console.log('[AUDIO STORAGE] ✅ Cleared all audio files from IndexedDB');
                resolve();
            };
            
            clearRequest.onerror = () => {
                console.error('[AUDIO STORAGE] Error clearing audio files:', clearRequest.error);
                reject(clearRequest.error);
            };
        });
    }

    /**
     * Get all audio file IDs for the current user
     */
    async getAllAudioFileIds() {
        if (!this.db) await this.init();
        
        const userId = getCurrentUserId();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([AUDIO_STORE_NAME], 'readonly');
            const store = transaction.objectStore(AUDIO_STORE_NAME);
            const request = store.getAll();
            
            request.onsuccess = () => {
                const records = request.result || [];
                // Filter by userId
                const userRecords = records.filter(record => record.userId === userId);
                const ids = userRecords.map(record => record.id);
                console.log('[AUDIO STORAGE] Total audio file IDs for user:', userId, ':', ids.length);
                resolve(ids);
            };
            
            request.onerror = () => {
                console.error('[AUDIO STORAGE] Error getting audio file IDs:', request.error);
                reject(request.error);
            };
        });
    }
    
    async clearAll() {
        if (!this.db) await this.init();
        
        const userId = getCurrentUserId();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([AUDIO_STORE_NAME], 'readwrite');
            const store = transaction.objectStore(AUDIO_STORE_NAME);
            
            // Get all keys first
            const getAllKeysRequest = store.getAllKeys();
            
            getAllKeysRequest.onsuccess = () => {
                const keys = getAllKeysRequest.result;
                let deletedCount = 0;
                
                // Delete only files belonging to current user
                keys.forEach(key => {
                    const getRequest = store.get(key);
                    getRequest.onsuccess = () => {
                        const record = getRequest.result;
                        if (record && record.userId === userId) {
                            const deleteRequest = store.delete(key);
                            deleteRequest.onsuccess = () => {
                                deletedCount++;
                                if (deletedCount === keys.length) {
                                    console.log('[AUDIO STORAGE] All audio files cleared for user:', userId);
                                    resolve();
                                }
                            };
                        } else {
                            deletedCount++;
                            if (deletedCount === keys.length) {
                                console.log('[AUDIO STORAGE] All audio files cleared for user:', userId);
                                resolve();
                            }
                        }
                    };
                });
                
                if (keys.length === 0) {
                    console.log('[AUDIO STORAGE] No audio files to clear for user:', userId);
                    resolve();
                }
            };
            
            getAllKeysRequest.onerror = () => {
                console.error('[AUDIO STORAGE] Error clearing audio files:', getAllKeysRequest.error);
                reject(getAllKeysRequest.error);
            };
        });
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudioStorage;
}
