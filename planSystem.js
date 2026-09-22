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
        const { db, doc, getDoc, updateDoc } = window.firebaseDB;
        const userDoc = await getDoc(doc(db, 'users', userId));

        if (userDoc.exists()) {
            const userData = userDoc.data();
            
            // CORREÇÃO: Usar Plan Engine para obter plano EFETIVO (considerando expiração)
            if (window.planEngine && window.planEngine.initialized) {
                const effectivePlan = window.planEngine.getEffectivePlan(userData);
                
                // Se plano efetivo é track mas Firestore ainda tem track_pro, fazer downgrade
                if (effectivePlan === 'track' && userData.plan === 'track_pro') {
                    console.log('[PLAN SYSTEM] Track Pro expired, downgrading user to track');
                    
                    try {
                        await window.planEngine.downgradeExpiredUser(userId);
                        console.log('[PLAN SYSTEM] User plan downgraded to track');
                    } catch (updateError) {
                        console.error('[PLAN SYSTEM] Error downgrading user plan:', updateError);
                        // Ainda retorna track mesmo se update falhar
                    }
                }
                
                console.log('[PLAN SYSTEM] User effective plan:', effectivePlan);
                return effectivePlan;
            }
            
            // Fallback para lógica legada se Plan Engine não disponível
            let plan = userData.plan || 'track';
            const expiration = checkPlanExpiration(userData);

            if (expiration.expired && plan === 'track_pro') {
                console.log('[PLAN SYSTEM] Downgrading user from track_pro to track due to expired trial');
                
                try {
                    await updateDoc(doc(db, 'users', userId), {
                        plan: 'track',
                        trialStatus: 'expired',
                        updatedAt: new Date().toISOString()
                    });
                    
                    plan = 'track';
                    console.log('[PLAN SYSTEM] User plan updated to track');
                } catch (updateError) {
                    console.error('[PLAN SYSTEM] Error updating user plan:', updateError);
                    plan = 'track';
                }
            }

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
 * Verifica e processa a expiração do teste de 7 dias
 * @param {Object} userData - Dados do usuário do Firestore
 * @returns {Object} - Objeto com { expired: boolean, downgraded: boolean, plan: string }
 */
function checkPlanExpiration(userData) {
    if (!userData) {
        console.log('[PLAN VALIDITY] No user data provided');
        return { expired: false, downgraded: false, plan: 'track' };
    }

    // Use Plan Engine if available for centralized validation
    if (window.planEngine && window.planEngine.initialized) {
        const status = window.planEngine.checkPlanStatus(userData);
        return { 
            expired: !status.isActive, 
            downgraded: false, 
            plan: status.isActive ? userData.plan : 'track' 
        };
    }

    // Fallback to legacy logic for compatibility
    const plan = userData.plan || 'track';
    const planType = userData.planType;
    const planExpiresAt = userData.planExpiresAt || userData.trialEndsAt || userData.validadeAcesso;
    const now = new Date();

    console.log('[PLAN VALIDITY] Current plan:', plan);
    console.log('[PLAN VALIDITY] Plan type:', planType);
    console.log('[PLAN VALIDITY] Plan expires:', planExpiresAt);
    console.log('[PLAN VALIDITY] Current time:', now.toISOString());

    // Check expiration for any track_pro plan (trial, monthly, annual)
    if (plan === 'track_pro' && planExpiresAt) {
        const expiresAt = new Date(planExpiresAt);
        const isExpired = expiresAt <= now;

        console.log('[PLAN VALIDITY] Plan expired:', isExpired);

        if (isExpired) {
            console.log('[PLAN VALIDITY] Track Pro plan expired');
            console.log('[PLAN VALIDITY] User downgraded to Track');
            return { expired: true, downgraded: false, plan: 'track' };
        } else {
            console.log('[PLAN VALIDITY] Track Pro plan is still active');
            return { expired: false, downgraded: false, plan: 'track_pro' };
        }
    }

    // For plans without expiration date or regular Track
    console.log('[PLAN VALIDITY] No expiration check needed');
    return { expired: false, downgraded: false, plan: plan };
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
            const expiration = checkPlanExpiration(userData);
            return expiration.expired;
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
        const { db, doc, getDoc, updateDoc, collection, addDoc, getDocs } = window.firebaseDB;
        
        // If specific userId provided, check only that user
        if (userId) {
            const userDoc = await getDoc(doc(db, 'users', userId));
            
            if (userDoc.exists()) {
                const userData = userDoc.data();
                const expiration = checkPlanExpiration(userData);
                
                if (expiration.expired) {
                    await downgradeExpiredUser(userId);
                    return true;
                }
            }
            return false;
        }
        
        // Otherwise, check all track_pro users (maintenance function)
        const usersSnapshot = await getDocs(collection(db, 'users'));
        let updatedCount = 0;
        
        for (const userDoc of usersSnapshot.docs) {
            const userData = userDoc.data();
            const expiration = checkPlanExpiration(userData);
            
            if (expiration.expired) {
                console.log('[PLAN SYSTEM] Downgrading expired Track Pro user:', userDoc.id);
                await downgradeExpiredUser(userDoc.id);
                updatedCount++;
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
            if (userData.trialStartedAt) {
                await addDoc(collection(db, 'subscriptionHistory'), {
                    uid: userId,
                    email: userData.email,
                    plan: 'track_pro',
                    planType: userData.planType || 'trial',
                    paymentOrigin: userData.paymentOrigin || 'trial',
                    activatedAt: userData.trialStartedAt,
                    expiresAt: userData.trialEndsAt,
                    transactionId: null,
                    expiredAt: new Date().toISOString(),
                    reason: 'trial_expired',
                    createdAt: new Date().toISOString()
                });
            }
            
            // Downgrade to track, but preserve trial metadata
            await updateDoc(doc(db, 'users', userId), {
                plan: 'track',
                trialStatus: 'expired',
                updatedAt: new Date().toISOString()
                // Note: trialUsed, trialStartedAt, trialEndsAt, trialExpiresAt are preserved
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
        checkPlanExpiration,
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
    checkPlanExpiration,
    isTrackProExpired,
    checkAndUpdateExpiredPlan,
    downgradeExpiredUser
};

console.log('[PLAN SYSTEM] Plan system initialized');