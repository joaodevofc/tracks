/**
 * Shared utility functions for plan validation and expiration checking
 * Used across app.js and equipewtracks.html to avoid code duplication
 */

/**
 * Check if the plan is expired based on expiration dates
 * @param {Object} userData - User data object from Firestore
 * @returns {boolean} - True if plan is expired, false otherwise
 */
function isPlanExpired(userData) {
    const currentPlan = (userData.plan || userData.plano || 'home').toLowerCase();
    const validadeAcesso = userData.validadeAcesso;
    const trialExpiresAt = userData.trialExpiresAt;
    const paymentOrigin = userData.paymentOrigin;
    const currentDate = new Date();
    
    if (currentPlan !== 'studio') {
        return false; // Only Studio plans can expire
    }
    
    // Check if this is a paid subscription (not trial)
    const isPaidSubscription = paymentOrigin === 'site' && validadeAcesso;
    
    if (isPaidSubscription) {
        const expiryDate = new Date(validadeAcesso);
        return currentDate > expiryDate;
    } else if (trialExpiresAt) {
        // Check trial validity
        const trialExpiryDate = new Date(trialExpiresAt);
        return currentDate > trialExpiryDate;
    }
    
    // If no expiration date exists, consider it not expired
    // (this handles edge cases where the plan field might be out of sync)
    return false;
}

// Export for use in ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { isPlanExpired };
}
