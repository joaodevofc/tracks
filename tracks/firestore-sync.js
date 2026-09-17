/**
 * Firestore Sync Layer
 * Handles synchronization of project metadata between localStorage and Firestore
 * - Firestore is source of truth for authenticated users
 * - localStorage serves as cache/fallback
 * - Audio files remain in IndexedDB
 * - No File/Blob data is stored in Firestore
 */

class FirestoreSync {
    constructor() {
        this.db = null;
        this.auth = null;
        this.initialized = false;
    }

    /**
     * Initialize Firestore sync with Firebase instances
     */
    init() {
        if (typeof window.firebaseDB !== 'undefined' && typeof window.firebaseAuth !== 'undefined') {
            this.db = window.firebaseDB.db;
            this.auth = window.firebaseAuth.auth;
            this.initialized = true;
            console.log('[SYNC] Firestore sync initialized');
        } else {
            console.warn('[SYNC] Firebase not available, Firestore sync disabled');
        }
    }

    /**
     * Get current user ID
     * @returns {string|null} User ID or null if not authenticated
     */
    getCurrentUserId() {
        if (!this.auth) return null;
        const user = this.auth.currentUser;
        return user ? user.uid : null;
    }

    /**
     * Check if user is authenticated
     * @returns {boolean}
     */
    isAuthenticated() {
        return this.getCurrentUserId() !== null;
    }

    /**
     * Load projects from Firestore for authenticated user
     * @returns {Promise<Array>} Array of project metadata objects
     */
    async loadProjectsFromFirestore() {
        if (!this.initialized || !this.isAuthenticated()) {
            console.log('[SYNC] Not authenticated, skipping Firestore load');
            return [];
        }

        const userId = this.getCurrentUserId();
        console.log('[SYNC] Loading projects from Firestore');

        try {
            const { collection, getDocs, query, orderBy } = window.firebaseDB;
            const projectsRef = collection(this.db, 'users', userId, 'projects');
            const q = query(projectsRef, orderBy('updatedAt', 'desc'));
            const querySnapshot = await getDocs(q);

            const projects = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                projects.push({
                    id: doc.id,
                    ...data
                });
            });

            console.log('[SYNC] Firestore projects loaded:', projects.length);
            return projects;
        } catch (error) {
            console.error('[SYNC] Error loading projects from Firestore:', error);
            return [];
        }
    }

    /**
     * Save a project to Firestore (metadata only)
     * @param {Object} project - Project object (will be serialized to JSON)
     * @returns {Promise<boolean>} Success status
     */
    async saveProjectToFirestore(project) {
        if (!this.initialized || !this.isAuthenticated()) {
            console.log('[SYNC] Not authenticated, skipping Firestore save');
            return false;
        }

        // Check if user has access to cloud sync
        if (window.PlanSystem) {
            const userId = this.getCurrentUserId();
            const userPlan = await window.PlanSystem.getUserPlan(userId);
            const planRules = window.PlanSystem.getPlanRules(userPlan);

            if (!planRules.features.cloudSync) {
                console.log('[SYNC] Cloud sync not available for plan:', userPlan);
                return false;
            }
        }

        const userId = this.getCurrentUserId();
        console.log('[SYNC] Saving project to Firestore:', project.name, 'ID:', project.id);

        try {
            const { doc, setDoc, serverTimestamp } = window.firebaseDB;
            const projectRef = doc(this.db, 'users', userId, 'projects', project.id);

            // Serialize project to JSON (this will save audioFileId but not File objects)
            const projectJSON = await project.toJSON();

            // Remove any circular references or non-serializable data
            const firestoreData = {
                ...projectJSON,
                syncedAt: serverTimestamp()
            };

            await setDoc(projectRef, firestoreData, { merge: true });
            console.log('[SYNC] Project synced to Firestore:', project.id);

            // Update local project with syncedAt timestamp
            project.syncedAt = new Date().toISOString();

            return true;
        } catch (error) {
            console.error('[SYNC] Error saving project to Firestore:', error);
            return false;
        }
    }

    /**
     * Delete a project from Firestore
     * @param {string} projectId - Project ID
     * @returns {Promise<boolean>} Success status
     */
    async deleteProjectFromFirestore(projectId) {
        if (!this.initialized || !this.isAuthenticated()) {
            console.log('[SYNC] Not authenticated, skipping Firestore delete');
            return false;
        }

        const userId = this.getCurrentUserId();
        console.log('[SYNC] Deleting project from Firestore:', projectId);

        try {
            const { doc, deleteDoc } = window.firebaseDB;
            const projectRef = doc(this.db, 'users', userId, 'projects', projectId);
            await deleteDoc(projectRef);
            console.log('[SYNC] Project deleted from Firestore:', projectId);
            return true;
        } catch (error) {
            console.error('[SYNC] Error deleting project from Firestore:', error);
            return false;
        }
    }

    /**
     * Delete a project from local storage (localStorage and IndexedDB)
     * @param {string} projectId - Project ID
     * @returns {Promise<boolean>} Success status
     */
    async deleteProjectFromLocal(projectId) {
        console.log('[SYNC] Deleting project from local storage:', projectId);

        try {
            // Get the project first to collect audioFileIds
            let audioFileIds = [];
            if (typeof window.storage !== 'undefined') {
                const project = window.storage.getProject(projectId);
                if (project && project.tracks) {
                    audioFileIds = project.tracks.filter(t => t.audioFileId).map(t => t.audioFileId);
                }
            }

            // Delete from localStorage via storage module
            if (typeof window.storage !== 'undefined') {
                await window.storage.deleteProject(projectId);
                console.log('[SYNC] Project deleted from localStorage:', projectId);
            }

            // Delete audio files from IndexedDB using individual audioFileIds
            if (typeof window.audioStorage !== 'undefined' && audioFileIds.length > 0) {
                for (const audioFileId of audioFileIds) {
                    await window.audioStorage.deleteAudioFile(audioFileId);
                }
                console.log('[SYNC] Project audio deleted from IndexedDB:', projectId, 'files:', audioFileIds.length);
            }

            return true;
        } catch (error) {
            console.error('[SYNC] Error deleting project from local storage:', error);
            return false;
        }
    }

    /**
     * Sync local projects to Firestore on login
     * - Load local projects from localStorage
     * - Identify which don't exist in Firestore
     * - Check if project was ever synced (has syncedAt field)
     * - If never synced: sync to Firestore (genuinely new offline project)
     * - If was synced but missing from Firestore: delete locally (deleted elsewhere)
     * - Preserve existing r2Key, r2Version, etc.
     * - Don't duplicate projects
     * @param {Array} localProjects - Array of local Project objects
     * @returns {Promise<Object>} Sync statistics
     */
    async syncLocalProjectsToFirestore(localProjects) {
        if (!this.initialized || !this.isAuthenticated()) {
            console.log('[SYNC] Not authenticated, skipping sync');
            return { migrated: 0, skipped: 0, deleted: 0, error: 0 };
        }

        console.log('[SYNC] Local projects found:', localProjects.length);

        // Load existing projects from Firestore
        const firestoreProjects = await this.loadProjectsFromFirestore();
        const firestoreProjectIds = new Set(firestoreProjects.map(p => p.id));

        console.log('[SYNC] Firestore projects loaded:', firestoreProjects.length);

        const stats = {
            migrated: 0,
            skipped: 0,
            deleted: 0,
            error: 0
        };

        // Sync local projects that don't exist in Firestore
        for (const localProject of localProjects) {
            if (firestoreProjectIds.has(localProject.id)) {
                console.log('[SYNC] Project already in Firestore, skipping:', localProject.id);
                stats.skipped++;
                continue;
            }

            // Check if project was ever synced (has syncedAt field)
            const wasEverSynced = localProject.syncedAt !== undefined && localProject.syncedAt !== null;

            if (wasEverSynced) {
                // Project was synced before but missing from Firestore = deleted elsewhere
                console.log('[SYNC] Project was synced but missing from Firestore (deleted elsewhere), deleting locally:', localProject.id);
                try {
                    await this.deleteProjectFromLocal(localProject.id);
                    stats.deleted++;
                } catch (error) {
                    console.error('[SYNC] Error deleting local project:', localProject.id, error);
                    stats.error++;
                }
            } else {
                // Project never synced = genuinely new offline project
                console.log('[SYNC] Migrating local project (never synced):', localProject.name, 'ID:', localProject.id);

                try {
                    const success = await this.saveProjectToFirestore(localProject);
                    if (success) {
                        console.log('[SYNC] Project synced:', localProject.id);
                        stats.migrated++;
                    } else {
                        console.error('[SYNC] Failed to sync project:', localProject.id);
                        stats.error++;
                    }
                } catch (error) {
                    console.error('[SYNC] Error syncing project:', localProject.id, error);
                    stats.error++;
                }
            }
        }

        console.log('[SYNC] Sync complete - Migrated:', stats.migrated, 'Skipped:', stats.skipped, 'Deleted:', stats.deleted, 'Error:', stats.error);
        return stats;
    }

    /**
     * Merge Firestore projects with local projects with conflict resolution
     * - Compare updatedAt between Firestore and local
     * - Use newer version
     * - Log which version is used
     * - Handle projects deleted elsewhere (synced but missing from Firestore)
     * @param {Array} firestoreProjects - Array of project metadata from Firestore
     * @param {Array} localProjects - Array of local Project objects
     * @returns {Promise<Array>} Merged array of Project objects
     */
    async mergeProjects(firestoreProjects, localProjects) {
        console.log('[SYNC] Merging projects');
        console.log('[SYNC] Firestore projects loaded:', firestoreProjects.length);
        console.log('[SYNC] Local projects found:', localProjects.length);

        const mergedProjects = [];
        const processedIds = new Set();
        const localIdsToDelete = []; // Track local projects to delete

        // Process Firestore projects
        for (const firestoreProject of firestoreProjects) {
            const localProject = localProjects.find(p => p.id === firestoreProject.id);

            if (localProject) {
                // Conflict resolution: compare updatedAt
                const firestoreTime = new Date(firestoreProject.updatedAt).getTime();
                const localTime = new Date(localProject.updatedAt).getTime();

                if (firestoreTime > localTime) {
                    console.log('[SYNC] Using Firestore version:', firestoreProject.name, '(Firestore newer)');
                    // Use Firestore version
                    const project = await Project.fromJSON(firestoreProject);
                    mergedProjects.push(project);
                } else if (localTime > firestoreTime) {
                    console.log('[SYNC] Using local version:', localProject.name, '(Local newer)');
                    // Use local version and sync to Firestore
                    mergedProjects.push(localProject);
                    // Async sync to Firestore (don't await)
                    this.saveProjectToFirestore(localProject).catch(err => {
                        console.error('[SYNC] Failed to sync newer local version:', err);
                    });
                } else {
                    console.log('[SYNC] Versions equal, using Firestore version:', firestoreProject.name);
                    // Versions equal, use Firestore version
                    const project = await Project.fromJSON(firestoreProject);
                    mergedProjects.push(project);
                }
            } else {
                // Project only in Firestore
                console.log('[SYNC] Project only in Firestore:', firestoreProject.name);
                const project = await Project.fromJSON(firestoreProject);
                mergedProjects.push(project);
            }

            processedIds.add(firestoreProject.id);
        }

        // Add local projects that don't exist in Firestore
        for (const localProject of localProjects) {
            if (!processedIds.has(localProject.id)) {
                // Check if project was ever synced (has syncedAt field)
                const wasEverSynced = localProject.syncedAt !== undefined && localProject.syncedAt !== null;

                if (wasEverSynced) {
                    // Project was synced before but missing from Firestore = deleted elsewhere
                    console.log('[SYNC] Project was synced but missing from Firestore (deleted elsewhere), marking for deletion:', localProject.name);
                    localIdsToDelete.push(localProject.id);
                } else {
                    // Project never synced = genuinely new offline project
                    console.log('[SYNC] Project only in local (never synced):', localProject.name);
                    mergedProjects.push(localProject);
                    // Sync to Firestore
                    this.saveProjectToFirestore(localProject).catch(err => {
                        console.error('[SYNC] Failed to sync local-only project:', err);
                    });
                }
            }
        }

        // Delete local projects that were synced but missing from Firestore
        if (localIdsToDelete.length > 0) {
            console.log('[SYNC] Deleting', localIdsToDelete.length, 'local projects that were deleted elsewhere');
            for (const projectId of localIdsToDelete) {
                try {
                    await this.deleteProjectFromLocal(projectId);
                } catch (error) {
                    console.error('[SYNC] Error deleting local project:', projectId, error);
                }
            }
        }

        // Sort by updatedAt descending
        mergedProjects.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

        console.log('[SYNC] Merge complete, total projects:', mergedProjects.length);
        return mergedProjects;
    }

    /**
     * Perform full sync on login
     * 1. Load local projects
     * 2. Load Firestore projects
     * 3. Merge with conflict resolution
     * 4. Save merged result to localStorage
     * 5. Migrate any local-only projects to Firestore
     * @param {Array} localProjects - Array of local Project objects
     * @returns {Promise<Array>} Merged projects array
     */
    async performSync(localProjects) {
        if (!this.initialized || !this.isAuthenticated()) {
            console.log('[SYNC] Not authenticated, skipping full sync');
            return localProjects;
        }

        console.log('[SYNC] Starting full sync');

        // Load Firestore projects
        const firestoreProjects = await this.loadProjectsFromFirestore();

        // Merge with conflict resolution
        const mergedProjects = await this.mergeProjects(firestoreProjects, localProjects);

        // Sync local-only projects to Firestore
        await this.syncLocalProjectsToFirestore(localProjects);

        console.log('[SYNC] Full sync complete');
        return mergedProjects;
    }
}

// Create global Firestore sync instance
const firestoreSync = new FirestoreSync();

// Initialize when Firebase is available
if (typeof window.firebaseDB !== 'undefined' && typeof window.firebaseAuth !== 'undefined') {
    firestoreSync.init();
} else {
    // Wait for Firebase to load
    const checkFirebase = setInterval(() => {
        if (typeof window.firebaseDB !== 'undefined' && typeof window.firebaseAuth !== 'undefined') {
            clearInterval(checkFirebase);
            firestoreSync.init();
        }
    }, 100);
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FirestoreSync, firestoreSync };
}
