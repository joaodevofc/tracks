/**
 * Track Hydrator
 * Orchestrates track hydration from R2 to IndexedDB
 * Manages download queue, version checking, and progress tracking
 */

class TrackHydrator {
    constructor() {
        this.r2Storage = null;
        this.audioStorage = null;
        this.MAX_CONCURRENT_DOWNLOADS = 2; // Limit concurrent downloads
        this.downloadQueue = [];
        this.activeDownloads = 0;
        this.downloadResults = new Map(); // trackId -> result
    }

    /**
     * Initialize the hydrator with storage instances
     */
    init(r2Storage, audioStorage) {
        this.r2Storage = r2Storage;
        this.audioStorage = audioStorage;
        console.log('[TRACK HYDRATOR] Initialized with storage instances');
    }

    /**
     * Hydrate a project's tracks
     * Ensures all tracks have valid File objects
     * Downloads from R2 if necessary
     * @param {Object} project - Project object with tracks array
     * @param {Function} onProgress - Progress callback (current, total, trackName, progress)
     * @returns {Promise<Object>} Hydration statistics
     */
    async hydrateProject(project, onProgress) {
        console.log('[TRACK HYDRATOR] =======================================');
        console.log('[TRACK HYDRATOR] Hydrating project:', project.name);
        console.log('[TRACK HYDRATOR] Total tracks:', project.tracks.length);
        console.log('[TRACK HYDRATOR] =======================================');

        if (!this.r2Storage || !this.audioStorage) {
            console.error('[TRACK HYDRATOR] Storage instances not initialized');
            return {
                total: project.tracks.length,
                local: 0,
                downloaded: 0,
                error: project.tracks.length,
                skipped: 0
            };
        }

        const stats = {
            total: project.tracks.length,
            local: 0,
            downloaded: 0,
            error: 0,
            skipped: 0
        };

        // Identify tracks that need downloading
        const tracksToDownload = [];
        const tracksToCheckVersion = [];

        for (const track of project.tracks) {
            console.log('[TRACK HYDRATOR] Processing track:', track.name);
            console.log('[TRACK HYDRATOR] - Has file:', !!track.file);
            console.log('[TRACK HYDRATOR] - Has audioFileId:', !!track.audioFileId);
            console.log('[TRACK HYDRATOR] - Cloud:', track.cloud);
            console.log('[TRACK HYDRATOR] - Local:', track.local);
            console.log('[TRACK HYDRATOR] - R2 Key:', track.r2Key);
            console.log('[TRACK HYDRATOR] - R2 Version:', track.r2Version);

            // Reset error state
            track.error = false;
            track.downloading = false;

            // Check if track has a valid file
            const hasValidFile = track.file && (track.file instanceof Blob || track.file instanceof File);

            if (hasValidFile) {
                // Track has local file
                track.local = true;
                stats.local++;

                // If track is in R2, check version
                if (track.cloud && track.r2Key) {
                    tracksToCheckVersion.push(track);
                } else {
                    // Local-only track, no version check needed
                    stats.skipped++;
                }
            } else {
                // Track doesn't have local file
                track.local = false;

                if (track.cloud && track.r2Key) {
                    // Check if browser is offline before attempting download
                    if (!navigator.onLine) {
                        console.warn('[TRACK HYDRATOR] Browser is offline, cannot download track:', track.name);
                        track.error = true;
                        stats.error++;
                    } else {
                        // Track exists in R2, needs download
                        tracksToDownload.push(track);
                    }
                } else {
                    // Track has no file and no R2 reference - error
                    track.error = true;
                    stats.error++;
                    console.error('[TRACK HYDRATOR] Track has no file and no R2 reference:', track.name);
                }
            }
        }

        console.log('[TRACK HYDRATOR] Tracks to check version:', tracksToCheckVersion.length);
        console.log('[TRACK HYDRATOR] Tracks to download:', tracksToDownload.length);

        // Check versions for tracks that have local files
        for (const track of tracksToCheckVersion) {
            try {
                const cloudMetadata = await this.r2Storage.getTrackMetadata(track.r2Key);
                
                if (cloudMetadata.version > (track.r2Version || 0)) {
                    console.log('[TRACK HYDRATOR] Track version mismatch:', track.name);
                    console.log('[TRACK HYDRATOR] - Local version:', track.r2Version);
                    console.log('[TRACK HYDRATOR] - Cloud version:', cloudMetadata.version);
                    
                    // Version outdated, needs re-download
                    tracksToDownload.push(track);
                    stats.local--; // Will be incremented after download
                } else {
                    console.log('[TRACK HYDRATOR] Track version up to date:', track.name);
                    stats.skipped++;
                }
            } catch (error) {
                console.warn('[TRACK HYDRATOR] Could not check version for track:', track.name, error);
                // Assume local version is OK if we can't check
                stats.skipped++;
            }
        }

        // Download tracks that need it
        if (tracksToDownload.length > 0) {
            console.log('[TRACK HYDRATOR] Starting download queue for', tracksToDownload.length, 'tracks');
            await this.processDownloadQueue(tracksToDownload, onProgress);
        }

        // Count final results
        for (const track of project.tracks) {
            if (track.error) {
                stats.error++;
            } else if (track.local && track.file) {
                stats.local++;
            }
        }

        stats.downloaded = tracksToDownload.filter(t => t.local && !t.error).length;

        console.log('[TRACK HYDRATOR] =======================================');
        console.log('[TRACK HYDRATOR] Hydration complete');
        console.log('[TRACK HYDRATOR] - Total:', stats.total);
        console.log('[TRACK HYDRATOR] - Local (after hydration):', stats.local);
        console.log('[TRACK HYDRATOR] - Downloaded:', stats.downloaded);
        console.log('[TRACK HYDRATOR] - Error:', stats.error);
        console.log('[TRACK HYDRATOR] - Skipped (version OK):', stats.skipped);
        console.log('[TRACK HYDRATOR] =======================================');

        return stats;
    }

    /**
     * Process download queue with concurrency control
     * @param {Array} tracks - Array of tracks to download
     * @param {Function} onProgress - Progress callback
     */
    async processDownloadQueue(tracks, onProgress) {
        const results = [];
        const executing = [];
        let completed = 0;

        for (const track of tracks) {
            // Wait if we've reached the concurrency limit
            if (executing.length >= this.MAX_CONCURRENT_DOWNLOADS) {
                await Promise.race(executing);
            }

            // Start download
            track.downloading = true;
            track.error = false;

            const promise = this.downloadTrack(track, (progress) => {
                if (onProgress) {
                    onProgress(completed + 1, tracks.length, track.name, progress);
                }
            }).then(() => {
                completed++;
                executing.splice(executing.indexOf(promise), 1);
                track.downloading = false;
            }).catch((error) => {
                completed++;
                executing.splice(executing.indexOf(promise), 1);
                track.downloading = false;
                track.error = true;
                console.error('[TRACK HYDRATOR] Download failed for track:', track.name, error);
            });

            executing.push(promise);
            results.push(promise);
        }

        await Promise.all(results);
    }

    /**
     * Download a single track from R2
     * @param {Object} track - Track object
     * @param {Function} onProgress - Progress callback
     * @returns {Promise<void>}
     */
    async downloadTrack(track, onProgress) {
        console.log('[TRACK HYDRATOR] Downloading track:', track.name);
        console.log('[TRACK HYDRATOR] R2 Key:', track.r2Key);

        try {
            // Download from R2 with retry
            const file = await this.r2Storage.retryWithBackoff(async () => {
                return await this.r2Storage.downloadTrack(track.r2Key, onProgress);
            }, 3, 1000);

            if (!file) {
                throw new Error('Download returned null');
            }

            // Save to IndexedDB
            if (track.audioFileId) {
                await this.audioStorage.saveAudioFile(track.audioFileId, file);
                console.log('[TRACK HYDRATOR] Saved to IndexedDB:', track.audioFileId);
            }

            // Update track
            track.file = file;
            track.local = true;
            track.error = false;

            // Update version if metadata includes it
            try {
                const metadata = await this.r2Storage.getTrackMetadata(track.r2Key);
                if (metadata.version) {
                    track.r2Version = metadata.version;
                }
            } catch (error) {
                console.warn('[TRACK HYDRATOR] Could not update version:', error);
            }

            console.log('[TRACK HYDRATOR] Download successful:', track.name);
        } catch (error) {
            console.error('[TRACK HYDRATOR] Download failed:', track.name, error);
            track.error = true;
            track.local = false;
            throw error;
        }
    }

    /**
     * Hydrate a single track
     * @param {Object} track - Track object
     * @param {Function} onProgress - Progress callback
     * @returns {Promise<boolean>} True if successful
     */
    async hydrateTrack(track, onProgress) {
        console.log('[TRACK HYDRATOR] Hydrating single track:', track.name);

        // Check if track already has valid file
        if (track.file && (track.file instanceof Blob || track.file instanceof File)) {
            track.local = true;

            // Check version if in R2
            if (track.cloud && track.r2Key) {
                try {
                    const cloudMetadata = await this.r2Storage.getTrackMetadata(track.r2Key);
                    if (cloudMetadata.version > (track.r2Version || 0)) {
                        // Version outdated, re-download
                        await this.downloadTrack(track, onProgress);
                    }
                } catch (error) {
                    console.warn('[TRACK HYDRATOR] Could not check version:', error);
                }
            }

            return true;
        }

        // Track doesn't have file, try to download from R2
        if (track.cloud && track.r2Key) {
            // Check if browser is offline before attempting download
            if (!navigator.onLine) {
                console.warn('[TRACK HYDRATOR] Browser is offline, cannot download track:', track.name);
                track.error = true;
                return false;
            }
            
            try {
                await this.downloadTrack(track, onProgress);
                return true;
            } catch (error) {
                console.error('[TRACK HYDRATOR] Failed to hydrate track:', track.name, error);
                track.error = true;
                return false;
            }
        }

        // Track has no file and no R2 reference
        console.error('[TRACK HYDRATOR] Track has no file and no R2 reference:', track.name);
        track.error = true;
        return false;
    }

    /**
     * Cancel all active downloads
     */
    cancelDownloads() {
        console.log('[TRACK HYDRATOR] Cancelling all downloads');
        this.downloadQueue = [];
        // Note: XMLHttpRequest doesn't have a built-in cancel mechanism
        // This would need to be implemented with AbortController in the future
    }

    /**
     * Get hydration status for a project
     * @param {Object} project - Project object
     * @returns {Object} Status object
     */
    getProjectStatus(project) {
        const status = {
            total: project.tracks.length,
            local: 0,
            cloud: 0,
            downloading: 0,
            error: 0,
            needsDownload: 0
        };

        for (const track of project.tracks) {
            if (track.local) status.local++;
            if (track.cloud) status.cloud++;
            if (track.downloading) status.downloading++;
            if (track.error) status.error++;
            if (track.cloud && !track.local && !track.downloading) status.needsDownload++;
        }

        return status;
    }
}

// Create global track hydrator instance
const trackHydrator = new TrackHydrator();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TrackHydrator, trackHydrator };
}
