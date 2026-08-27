/**
 * API Client for W.Tracks Backend
 * Handles all HTTP communication with the backend server
 */

class ApiClient {
    constructor() {
        // Default to localhost:3000 for development
        this.baseUrl = localStorage.getItem('wtracks_api_url') || 'http://localhost:3000';
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

        const url = `${this.baseUrl}/api/tracks`;
        const headers = {};

        if (this.authToken) {
            headers['Authorization'] = `Bearer ${this.authToken}`;
        }

        console.log('[API] Uploading track:', metadata.trackName, 'Size:', file.size);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: formData
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('[API] Track uploaded successfully:', result.id);
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
    getTrackStreamUrl(trackId) {
        return `${this.baseUrl}/api/tracks/${trackId}/file`;
    }

    /**
     * Delete a track
     */
    async deleteTrack(trackId) {
        return this.request(`/api/tracks/${trackId}`, {
            method: 'DELETE'
        });
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
