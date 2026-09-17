/**
 * SISTEMA CENTRAL DE PLANOS W.TRACKS
 * 
 * Este arquivo contém a estrutura central de planos e as regras de cada plano.
 * 
 * Fonte única de verdade para o sistema de planos.
 * Todo o código deve consultar esta estrutura para verificar limites e permissões.
 */

const PLANS = {
    track: {
        name: 'Track',
        displayName: 'Track',
        // Limites
        limits: {
            maxFaders: 5,
            maxSetlists: 1,
            maxSongsPerSetlist: 5,
            maxDurationSeconds: 300 // 5 minutos
        },
        // Recursos disponíveis
        features: {
            loops: false,
            pads: false,
            canvasEffects: false,
            cloudSync: false,
            cloudStorage: false
        }
    },
    track_pro: {
        name: 'Track Pro',
        displayName: 'Track Pro',
        // Limites (serão definidos futuramente)
        limits: {
            maxFaders: Infinity,
            maxSetlists: Infinity,
            maxSongsPerSetlist: Infinity,
            maxDurationSeconds: Infinity
        },
        // Recursos disponíveis
        features: {
            loops: true, // Loop habilitado para Track Pro
            pads: true,  // Pads habilitado para Track Pro
            canvasEffects: true, // Canvas effects habilitado para Track Pro
            cloudSync: true, // Sincronização em nuvem habilitada
            cloudStorage: true // Armazenamento em nuvem habilitado
        }
    }
};

/**
 * Obtém o plano atual do usuário do Firebase
 * @param {string} userId - ID do usuário no Firebase
 * @returns {Promise<string>} - Nome do plano (padrão: 'track')
 */
async function getUserPlan(userId) {
    if (!userId || !window.firebaseDB) {
        console.log('[PLAN SYSTEM] No userId or Firebase available, defaulting to track');
        return 'track';
    }

    try {
        const { db, doc, getDoc } = window.firebaseDB;
        const userDoc = await getDoc(doc(db, 'users', userId));

        if (userDoc.exists()) {
            const userData = userDoc.data();
            const plan = userData.plan || 'track';
            console.log('[PLAN SYSTEM] User plan from Firebase:', plan);
            return plan;
        } else {
            console.log('[PLAN SYSTEM] User document not found, defaulting to track');
            return 'track';
        }
    } catch (error) {
        console.error('[PLAN SYSTEM] Error fetching user plan:', error);
        return 'track';
    }
}

/**
 * Obtém as regras do plano especificado
 * @param {string} planName - Nome do plano ('track' ou 'track_pro')
 * @returns {Object} - Objeto com limites e features do plano
 */
function getPlanRules(planName) {
    const plan = PLANS[planName] || PLANS.track;
    console.log('[PLAN SYSTEM] Getting rules for plan:', planName, plan);
    return plan;
}

/**
 * Verifica se o usuário tem acesso a uma funcionalidade específica
 * @param {string} userId - ID do usuário
 * @param {string} feature - Nome da funcionalidade ('loops', 'pads', 'canvasEffects', 'cloudSync')
 * @returns {Promise<boolean>} - true se o usuário tem acesso, false caso contrário
 */
async function hasFeatureAccess(userId, feature) {
    const planName = await getUserPlan(userId);
    const plan = getPlanRules(planName);
    return plan.features[feature] || false;
}

/**
 * Verifica se o usuário excede o limite de faders
 * @param {string} userId - ID do usuário
 * @param {number} trackCount - Número de tracks/faders
 * @returns {Promise<boolean>} - true se excede o limite, false caso contrário
 */
async function exceedsFaderLimit(userId, trackCount) {
    const planName = await getUserPlan(userId);
    const plan = getPlanRules(planName);
    return trackCount > plan.limits.maxFaders;
}

/**
 * Verifica se o usuário excede o limite de setlists
 * @param {string} userId - ID do usuário
 * @param {number} setlistCount - Número de setlists
 * @returns {Promise<boolean>} - true se excede o limite, false caso contrário
 */
async function exceedsSetlistLimit(userId, setlistCount) {
    const planName = await getUserPlan(userId);
    const plan = getPlanRules(planName);
    return setlistCount >= plan.limits.maxSetlists;
}

/**
 * Verifica se o usuário excede o limite de músicas na setlist
 * @param {string} userId - ID do usuário
 * @param {number} songCount - Número de músicas na setlist
 * @returns {Promise<boolean>} - true se excede o limite, false caso contrário
 */
async function exceedsSetlistSongLimit(userId, songCount) {
    const planName = await getUserPlan(userId);
    const plan = getPlanRules(planName);
    return songCount >= plan.limits.maxSongsPerSetlist;
}

/**
 * Verifica se uma track excede o limite de duração
 * @param {string} userId - ID do usuário
 * @param {number} durationSeconds - Duração da track em segundos
 * @returns {Promise<boolean>} - true se excede o limite, false caso contrário
 */
async function exceedsDurationLimit(userId, durationSeconds) {
    const planName = await getUserPlan(userId);
    const plan = getPlanRules(planName);
    return durationSeconds > plan.limits.maxDurationSeconds;
}

/**
 * Verifica se o usuário tem acesso a armazenamento em nuvem
 * @param {string} userId - ID do usuário
 * @returns {Promise<boolean>} - true se tem acesso, false caso contrário
 */
async function hasCloudStorageAccess(userId) {
    const planName = await getUserPlan(userId);
    const plan = getPlanRules(planName);
    return plan.features.cloudStorage || false;
}

/**
 * Verifica se o usuário tem plano Track Pro
 * @param {string} planName - Nome do plano ('track' ou 'track_pro')
 * @returns {boolean} - true se for track_pro, false caso contrário
 */
function isTrackPro(planName) {
    return planName === 'track_pro';
}

/**
 * Verifica se o usuário tem plano Track Pro (síncrona, usa plano em cache)
 * @param {string} planName - Nome do plano em cache
 * @returns {boolean} - true se for track_pro, false caso contrário
 */
function isTrackProCached(planName) {
    return planName === 'track_pro';
}

/**
 * Verifica se o Track Pro do usuário está expirado
 * @param {string} userId - ID do usuário
 * @returns {Promise<boolean>} - true se está expirado, false caso contrário
 */
async function isTrackProExpired(userId) {
    if (!userId || !window.firebaseDB) {
        return false;
    }

    try {
        const { db, doc, getDoc } = window.firebaseDB;
        const userDoc = await getDoc(doc(db, 'users', userId));

        if (userDoc.exists()) {
            const userData = userDoc.data();
            
            // Only check expiration if user is currently track_pro
            if (userData.plan === 'track_pro' && userData.validadeAcesso) {
                const expiryDate = new Date(userData.validadeAcesso);
                const now = new Date();
                
                if (expiryDate <= now) {
                    console.log('[PLAN SYSTEM] Track Pro expired for user:', userId, 'expired at:', expiryDate);
                    return true;
                }
            }
        }
        
        return false;
    } catch (error) {
        console.error('[PLAN SYSTEM] Error checking Track Pro expiration:', error);
        return false;
    }
}

/**
 * Verifica e atualiza planos expirados (função de manutenção)
 * @param {string} userId - ID do usuário (opcional, para verificar um usuário específico)
 * @returns {Promise<boolean>} - true se foi atualizado para track, false caso contrário
 */
async function checkAndUpdateExpiredPlan(userId) {
    if (!window.firebaseDB) {
        return false;
    }

    try {
        const { db, doc, getDoc, updateDoc, collection, addDoc } = window.firebaseDB;
        
        // If specific userId provided, check only that user
        if (userId) {
            const isExpired = await isTrackProExpired(userId);
            if (isExpired) {
                await downgradeExpiredUser(userId);
                return true;
            }
            return false;
        }
        
        // Otherwise, check all track_pro users (maintenance function)
        const usersSnapshot = await getDocs(collection(db, 'users'));
        let updatedCount = 0;
        
        for (const userDoc of usersSnapshot.docs) {
            const userData = userDoc.data();
            
            if (userData.plan === 'track_pro' && userData.validadeAcesso) {
                const expiryDate = new Date(userData.validadeAcesso);
                const now = new Date();
                
                if (expiryDate <= now) {
                    console.log('[PLAN SYSTEM] Downgrading expired Track Pro user:', userDoc.id);
                    await downgradeExpiredUser(userDoc.id);
                    updatedCount++;
                }
            }
        }
        
        if (updatedCount > 0) {
            console.log('[PLAN SYSTEM] Downgraded', updatedCount, 'expired Track Pro users');
        }
        
        return updatedCount > 0;
    } catch (error) {
        console.error('[PLAN SYSTEM] Error checking expired plans:', error);
        return false;
    }
}

/**
 * Rebaixa um usuário expirado de track_pro para track
 * @param {string} userId - ID do usuário
 */
async function downgradeExpiredUser(userId) {
    if (!window.firebaseDB) {
        return;
    }

    try {
        const { db, doc, getDoc, updateDoc, collection, addDoc } = window.firebaseDB;
        const userDoc = await getDoc(doc(db, 'users', userId));
        
        if (userDoc.exists()) {
            const userData = userDoc.data();
            
            // Add to subscription history before downgrading
            if (userData.planActivatedAt) {
                await addDoc(collection(db, 'subscriptionHistory'), {
                    uid: userId,
                    email: userData.email,
                    plan: 'track_pro',
                    planType: userData.planType || 'mensal',
                    paymentOrigin: userData.paymentOrigin || 'unknown',
                    activatedAt: userData.planActivatedAt,
                    expiresAt: userData.validadeAcesso,
                    transactionId: userData.lastTransactionId || null,
                    expiredAt: new Date().toISOString(),
                    reason: 'expired',
                    createdAt: new Date().toISOString()
                });
            }
            
            // Downgrade to track, but preserve planActivatedAt
            await updateDoc(doc(db, 'users', userId), {
                plan: 'track',
                planType: null,
                subscriptionStatus: 'expired',
                statusPagamento: 'expirado',
                updatedAt: new Date().toISOString()
                // Note: planActivatedAt is preserved for historical reference
            });
            
            console.log('[PLAN SYSTEM] User downgraded from track_pro to track:', userId);
        }
    } catch (error) {
        console.error('[PLAN SYSTEM] Error downgrading user:', error);
    }
}

// Export para uso em outros arquivos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        PLANS,
        getUserPlan,
        getPlanRules,
        hasFeatureAccess,
        exceedsFaderLimit,
        exceedsSetlistLimit,
        exceedsSetlistSongLimit,
        exceedsDurationLimit,
        hasCloudStorageAccess,
        isTrackPro,
        isTrackProCached,
        isTrackProExpired,
        checkAndUpdateExpiredPlan,
        downgradeExpiredUser
    };
}

// Export para uso global
window.PlanSystem = {
    PLANS,
    getUserPlan,
    getPlanRules,
    hasFeatureAccess,
    exceedsFaderLimit,
    exceedsSetlistLimit,
    exceedsSetlistSongLimit,
    exceedsDurationLimit,
    hasCloudStorageAccess,
    isTrackPro,
    isTrackProCached,
    isTrackProExpired,
    checkAndUpdateExpiredPlan,
    downgradeExpiredUser
};

console.log('[PLAN SYSTEM] Plan system initialized');