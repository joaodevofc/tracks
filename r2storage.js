/**
 * R2 Storage Manager
 * Handles communication with Cloudflare Worker for R2 operations
 * All R2 access goes through the Worker for security
 * Worker validates Firebase Auth and project/track access
 */

class R2Storage {
    constructor() {
        // Worker URL - will be configured
        this.workerUrl = localStorage.getItem('wtracks_worker_url') || 'https://wtracks-worker.wtracks.workers.dev';
        this.authToken = null;
        this.requestQueue = new Map(); // Track active requests
    }

    /**
     * Set the Worker URL
     */
    setWorkerUrl(url) {
        this.workerUrl = url;
        localStorage.setItem('wtracks_worker_url', url);
    }

    /**
     * Set the Firebase Auth token
     */
    setAuthToken(token) {
        this.authToken = token;
    }

    /**
     * Get current auth token
     */
    getAuthToken() {
        return this.authToken;
    }

    /**
     * Get headers for Worker requests
     */
    getHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };

        if (this.authToken) {
            headers['Authorization'] = `Bearer ${this.authToken}`;
        }

        return headers;
    }

    /**
     * Generate R2 key for a track
     * Format: users/{userId}/projects/{projectId}/tracks/{trackId}/{fileName}
     */
    generateR2Key(userId, projectId, trackId, fileName) {
        // Sanitize filename to remove special characters
        const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        return `users/${userId}/projects/${projectId}/tracks/${trackId}/${sanitizedFileName}`;
    }

    /**
     * Upload a track to R2 via Worker
     * @param {File} file - Audio file to upload
     * @param {Object} metadata - Upload metadata
     * @param {string} metadata.userId - User ID
     * @param {string} metadata.projectId - Project ID
     * @param {string} metadata.trackId - Track ID
     * @param {string} metadata.fileName - Original filename
     * @param {Function} onProgress - Progress callback (bytesUploaded, totalBytes)
     * @returns {Promise<Object>} Upload result with r2Key, version, size, uploadedAt
     */
    async uploadTrack(file, metadata, onProgress) {
        const { userId, projectId, trackId, fileName } = metadata;
        const r2Key = this.generateR2Key(userId, projectId, trackId, fileName);

        console.log('[R2 STORAGE] =======================================');
        console.log('[R2 STORAGE] Upload start');
        console.log('[R2 STORAGE] File size:', file.size);
        console.log('[R2 STORAGE] Upload method: Presigned URL (direct to R2)');
        console.log('[R2 STORAGE] =======================================');

        try {
            // Request presigned URL from Worker
            const presignedUrlUrl = `${this.workerUrl}/presigned-url?projectId=${encodeURIComponent(projectId)}&trackId=${encodeURIComponent(trackId)}&fileName=${encodeURIComponent(fileName)}&contentType=${encodeURIComponent(file.type)}`;
            
            const presignedResponse = await fetch(presignedUrlUrl, {
                method: 'POST',
                headers: this.getHeaders()
            });

            if (!presignedResponse.ok) {
                const error = await presignedResponse.json().catch(() => ({ error: 'Unknown error' }));
                console.error('[R2 STORAGE] Failed to get presigned URL:', error);
                console.error('[R2 STORAGE] HTTP status:', presignedResponse.status);
                throw new Error(error.error || `HTTP ${presignedResponse.status}: ${presignedResponse.statusText}`);
            }

            const { presignedUrl, r2Key: returnedR2Key } = await presignedResponse.json();
            console.log('[R2 STORAGE] Presigned URL received:', returnedR2Key);
            console.log('[R2 STORAGE] Presigned URL length:', presignedUrl.length);

            // Upload directly to R2 using presigned URL
            console.log('[R2 STORAGE] Uploading to R2...');
            
            const uploadResponse = await fetch(presignedUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': file.type
                },
                body: file
            });

            if (!uploadResponse.ok) {
                console.error('[R2 STORAGE] Upload failed:', uploadResponse.status, uploadResponse.statusText);
                throw new Error(`Upload failed: HTTP ${uploadResponse.status}`);
            }

            console.log('[R2 STORAGE] Upload complete:', returnedR2Key);

            // Get metadata from R2 to confirm
            const metadataResult = await this.getTrackMetadata(returnedR2Key);

            console.log('[R2 STORAGE] =======================================');
            console.log('[R2 STORAGE] Upload complete');
            console.log('[R2 STORAGE] R2 Key:', returnedR2Key);
            console.log('[R2 STORAGE] Version:', metadataResult.version);
            console.log('[R2 STORAGE] Size:', metadataResult.size);
            console.log('[R2 STORAGE] =======================================');

            return {
                r2Key: returnedR2Key,
                version: metadataResult.version,
                size: metadataResult.size
            };
        } catch (error) {
            console.error('[R2 STORAGE] Upload failed:', error);
            console.error('[R2 STORAGE] HTTP status:', error.message?.match(/HTTP (\d+)/)?.[1] || 'Unknown');
            throw error;
        }
    }

    /**
     * Download a track from R2 via Worker with streaming progress
     * @param {string} r2Key - R2 object key
     * @param {Function} onProgress - Progress callback (bytesDownloaded, totalBytes)
     * @returns {Promise<File>} Downloaded file
     */
    async downloadTrack(r2Key, onProgress) {
        console.log('[R2 STORAGE] Downloading track:', r2Key);

        const url = `${this.workerUrl}/download?key=${encodeURIComponent(r2Key)}`;

        try {
            // Use fetch with streaming for accurate progress tracking
            const response = await fetch(url, {
                headers: this.getHeaders()
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            const contentLength = response.headers.get('Content-Length');
            const totalBytes = contentLength ? parseInt(contentLength, 10) : null;
            
            console.log('[R2 STORAGE] Content-Length:', totalBytes);

            // Get reader for streaming
            const reader = response.body.getReader();
            const chunks = [];
            let receivedBytes = 0;

            // Read chunks
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) {
                    console.log('[R2 STORAGE] Download complete, total received:', receivedBytes);
                    break;
                }

                chunks.push(value);
                receivedBytes += value.length;

                // Report progress
                if (onProgress && totalBytes) {
                    onProgress(receivedBytes, totalBytes);
                }
            }

            // Create blob from chunks
            const blob = new Blob(chunks);
            const fileName = this.extractFileNameFromR2Key(r2Key);
            const file = new File([blob], fileName, { type: blob.type });
            
            console.log('[R2 STORAGE] Download successful:', fileName, 'Size:', file.size);
            return file;
        } catch (error) {
            console.error('[R2 STORAGE] Download failed:', error);
            throw error;
        }
    }

    /**
     * Delete a track from R2 via Worker
     * @param {string} r2Key - R2 object key
     * @returns {Promise<void>}
     */
    async deleteTrack(r2Key) {
        console.log('[R2 STORAGE] Deleting track:', r2Key);

        const url = `${this.workerUrl}/delete?key=${encodeURIComponent(r2Key)}`;

        try {
            const response = await fetch(url, {
                method: 'DELETE',
                headers: this.getHeaders()
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            console.log('[R2 STORAGE] Delete successful:', r2Key);
        } catch (error) {
            console.error('[R2 STORAGE] Delete failed:', error);
            throw error;
        }
    }

    /**
     * Get track metadata from R2 via Worker
     * @param {string} r2Key - R2 object key
     * @returns {Promise<Object>} Metadata with version, size, uploadedAt
     */
    async getTrackMetadata(r2Key) {
        console.log('[R2 STORAGE] Getting metadata for:', r2Key);

        const url = `${this.workerUrl}/metadata?key=${encodeURIComponent(r2Key)}`;

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: this.getHeaders()
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            const metadata = await response.json();
            console.log('[R2 STORAGE] Metadata retrieved:', metadata);
            return metadata;
        } catch (error) {
            console.error('[R2 STORAGE] Get metadata failed:', error);
            throw error;
        }
    }

    /**
     * Check if track exists in R2 via Worker
     * @param {string} r2Key - R2 object key
     * @returns {Promise<boolean>} True if track exists
     */
    async trackExists(r2Key) {
        console.log('[R2 STORAGE] Checking if track exists:', r2Key);

        try {
            const metadata = await this.getTrackMetadata(r2Key);
            return metadata !== null;
        } catch (error) {
            if (error.message.includes('404') || error.message.includes('not found')) {
                return false;
            }
            throw error;
        }
    }

    /**
     * Extract filename from R2 key
     * @param {string} r2Key - R2 object key
     * @returns {string} Filename
     */
    extractFileNameFromR2Key(r2Key) {
        const parts = r2Key.split('/');
        return parts[parts.length - 1] || 'audio.wav';
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
     * Retry a failed operation with exponential backoff
     * @param {Function} operation - Operation to retry
     * @param {number} maxRetries - Maximum number of retries
     * @param {number} delay - Initial delay in ms
     * @returns {Promise<any>} Operation result
     */
    async retryWithBackoff(operation, maxRetries = 3, delay = 1000) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await operation();
            } catch (error) {
                if (i === maxRetries - 1) {
                    throw error;
                }
                
                const backoffDelay = delay * Math.pow(2, i);
                console.log(`[R2 STORAGE] Retry ${i + 1}/${maxRetries} after ${backoffDelay}ms`);
                await new Promise(resolve => setTimeout(resolve, backoffDelay));
            }
        }
    }
}

// Create global R2 storage instance
const r2Storage = new R2Storage();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { R2Storage, r2Storage };
}
