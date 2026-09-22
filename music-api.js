// ========================================
// MUSIC API - iTunes Search API Integration
// ========================================

/**
 * Search for music using iTunes Search API
 * @param {string} query - Search term
 * @returns {Promise<Array>} - Normalized search results
 */
async function searchMusic(query) {
    if (!query || !query.trim()) {
        return [];
    }

    const searchTerm = query.trim();
    const encodedTerm = encodeURIComponent(searchTerm);
    
    // iTunes Search API endpoint
    const url = `https://itunes.apple.com/search?term=${encodedTerm}&media=music&entity=song&limit=20`;

    try {
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        // Normalize results
        if (data.results && Array.isArray(data.results)) {
            return data.results.map(normalizeMusicResult);
        }
        
        return [];
    } catch (error) {
        console.error('[MUSIC API] Error searching music:', error);
        throw error;
    }
}

/**
 * Normalize iTunes API result to standard format
 * @param {Object} result - Raw iTunes API result
 * @returns {Object} - Normalized music data
 */
function normalizeMusicResult(result) {
    return {
        id: result.trackId,
        title: result.trackName,
        artist: result.artistName,
        album: result.collectionName,
        artwork: result.artworkUrl100,
        artworkLarge: result.artworkUrl100?.replace('100x100', '600x600'),
        url: result.trackViewUrl,
        // Additional metadata for storage
        trackId: result.trackId,
        artistId: result.artistId,
        collectionId: result.collectionId,
        trackName: result.trackName,
        artistName: result.artistName,
        collectionName: result.collectionName,
        artworkUrl100: result.artworkUrl100,
        trackViewUrl: result.trackViewUrl
    };
}

/**
 * Debounce function to limit API calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} - Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Export functions for use in other files
if (typeof window !== 'undefined') {
    window.MusicAPI = {
        searchMusic,
        normalizeMusicResult,
        debounce
    };
}