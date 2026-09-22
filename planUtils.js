/**
 * Shared utility functions for plan validation and expiration checking
 * Used across app.js and equipewtracks.html to avoid code duplication
 */

/**
 * Check if the plan is expired based on trial expiration
 * This function uses the new plan system (track/track_pro) and ignores legacy fields
 * @param {Object} userData - User data object from Firestore
 * @returns {boolean} - True if plan is expired, false otherwise
 */
function isPlanExpired(userData) {
    if (!userData) {
        return false;
    }

    const plan = userData.plan || 'track';
    const planType = userData.planType;
    const trialEndsAt = userData.trialEndsAt;
    const now = new Date();

    // Only check expiration for track_pro with planType === 'trial'
    if (plan === 'track_pro' && planType === 'trial') {
        if (trialEndsAt) {
            const trialEndDate = new Date(trialEndsAt);
            return trialEndDate <= now;
        }
    }

    // For paid Track Pro or regular Track, no expiration
    return false;
}

// Export for use in ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { isPlanExpired };
}
