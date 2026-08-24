/**
 * API Client for W.Tracks Backend
 * Handles all HTTP communication with the backend server
 */

class ApiClient {
    constructor() {
        // Default to Cloudflare Worker for production
        this.baseUrl = localStorage.getItem('wtracks_api_url') || 'https://wtracks.wtracks.workers.dev';
        this.authToken = null;
    }

    /**
     * Set the base URL for the API
     */
    setBaseUrl(url) {
        this.baseUrl = url;
        localStorage.setItem('wtracks_api_url', url);
    }

    /**
     * Set the authentication token (Firebase ID token)
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
     * Get headers for API requests
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
     * Generic request method
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const config = {
            ...options,
            headers: {
                ...this.getHeaders(),
                ...options.headers
            }
        };

        console.log('[API] Request:', config.method || 'GET', url);

        try {
            const response = await fetch(url, config);

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('[API] Request failed:', error);
            throw error;
        }
    }

    /**
     * Upload a track
     */
    async uploadTrack(file, metadata) {
        const formData = new FormData();
        formData.append('audioFile', file);
        formData.append('userId', metadata.userId);
        formData.append('projectName', metadata.projectName);
        formData.append('trackName', metadata.trackName);
        formData.append('trackId', metadata.trackId || '');

        const url = `${this.baseUrl}/upload`;
        const headers = {};

        if (this.authToken) {
            headers['Authorization'] = `Bearer ${this.authToken}`;
            // Log first 20 chars of token for debugging (security)
            const tokenPreview = this.authToken.substring(0, 20) + '...';
            console.log('[API] Auth token present (first 20 chars):', tokenPreview);
            console.log('[API] Token length:', this.authToken.length);
        } else {
            console.warn('[API] No auth token available for upload!');
        }

        console.log('[API] Uploading track:', metadata.trackName, 'Size:', file.size, 'to:', url);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: formData
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Unknown error' }));
                console.error('[API] Upload failed with status:', response.status, 'Error:', error);
                throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('[API] Track uploaded successfully:', result.id, 'Key:', result.key);
            return result;
        } catch (error) {
            console.error('[API] Upload failed:', error);
            throw error;
        }
    }

    /**
     * Get all tracks for a user
     */
    async getUserTracks(userId) {
        return this.request(`/api/tracks/${userId}`);
    }

    /**
     * Get a specific track
     */
    async getTrack(userId, trackId) {
        return this.request(`/api/tracks/${userId}/${trackId}`);
    }

    /**
     * Get the streaming URL for a track
     */
    async getTrackStreamUrl(trackId) {
        try {
            const url = `${this.baseUrl}/track/${trackId}/url`;
            const headers = {};

            if (this.authToken) {
                headers['Authorization'] = `Bearer ${this.authToken}`;
            }

            console.log('[API] Getting stream URL for track:', trackId);

            const response = await fetch(url, {
                method: 'GET',
                headers: headers
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Unknown error' }));
                console.error('[API] Get stream URL failed:', error);
                throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('[API] Stream URL obtained:', result.url);
            return result.url;
        } catch (error) {
            console.error('[API] Get stream URL failed:', error);
            throw error;
        }
    }

    /**
     * Delete a track
     */
    async deleteTrack(trackId) {
        try {
            const url = `${this.baseUrl}/track/${trackId}`;
            const headers = {};

            if (this.authToken) {
                headers['Authorization'] = `Bearer ${this.authToken}`;
            }

            console.log('[API] Deleting track:', trackId);

            const response = await fetch(url, {
                method: 'DELETE',
                headers: headers
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Unknown error' }));
                console.error('[API] Delete track failed:', error);
                throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('[API] Track deleted successfully:', trackId);
            return result;
        } catch (error) {
            console.error('[API] Delete track failed:', error);
            throw error;
        }
    }

    /**
     * Check server health
     */
    async healthCheck() {
        try {
            return await this.request('/api/health');
        } catch (error) {
            console.error('[API] Health check failed:', error);
            throw error;
        }
    }

    /**
     * Get user storage usage from backend
     * TODO: Implement this endpoint on the backend server
     */
    async getUserStorageUsage(userId) {
        try {
            return await this.request(`/api/storage/${userId}`);
        } catch (error) {
            console.error('[API] Get storage usage failed:', error);
            throw error;
        }
    }
}

// Create global API client instance
const apiClient = new ApiClient();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ApiClient, apiClient };
}
