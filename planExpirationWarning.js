/**
 * Plan Expiration Warning System
 * Sistema de aviso minimalista para expiração do Track Pro
 * Mostra aviso quando faltam 5 dias ou menos para planExpiresAt
 */

const PlanExpirationWarning = (function() {
    let warningElement = null;
    let updateInterval = null;
    let isDismissed = false;
    let currentUserData = null;

    // Constants
    const WARNING_DAYS_THRESHOLD = 5; // Mostrar aviso quando faltar 5 dias ou menos
    const UPDATE_INTERVAL_MS = 60000; // Atualizar a cada 1 minuto

    /**
     * Inicializa o sistema de aviso
     */
    function init() {
        console.log('[PLAN WARNING] Initializing expiration warning system');

        // Criar elemento do aviso
        createWarningElement();

        // Escutar mudanças de autenticação
        if (window.firebaseAuth && window.firebaseAuth.auth) {
            window.firebaseAuth.auth.onAuthStateChanged(handleAuthStateChange);
        }

        console.log('[PLAN WARNING] System initialized');
    }

    /**
     * Cria o elemento HTML do aviso
     */
    function createWarningElement() {
        warningElement = document.createElement('div');
        warningElement.id = 'planExpirationWarning';
        warningElement.className = 'plan-expiration-warning';
        warningElement.style.display = 'none';

        warningElement.innerHTML = `
            <div class="plan-warning-content">
                <span class="plan-warning-icon">⚠</span>
                <span class="plan-warning-message"></span>
                <button class="plan-warning-renew" id="planWarningRenew">Renovar</button>
                <button class="plan-warning-close" id="planWarningClose">×</button>
            </div>
        `;

        // Adicionar event listeners
        const renewBtn = warningElement.querySelector('#planWarningRenew');
        const closeBtn = warningElement.querySelector('#planWarningClose');

        if (renewBtn) {
            renewBtn.addEventListener('click', renew);
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', dismiss);
        }

        // Adicionar ao body antes de </body>
        document.body.appendChild(warningElement);
    }

    /**
     * Manipula mudanças de estado de autenticação
     */
    async function handleAuthStateChange(user) {
        if (!user) {
            // Usuário deslogado - esconder aviso
            hide();
            currentUserData = null;
            return;
        }

        console.log('[PLAN WARNING] User authenticated, checking plan status');

        // Obter dados do usuário
        try {
            if (window.planEngine && window.planEngine.initialized) {
                currentUserData = await window.planEngine.getUserById(user.uid);
                checkAndShowWarning();
            } else if (window.PlanSystem) {
                const plan = await window.PlanSystem.getUserPlan(user.uid);
                // Fallback - usar PlanSystem se planEngine não disponível
                currentUserData = { plan: plan };
                checkAndShowWarning();
            }
        } catch (error) {
            console.error('[PLAN WARNING] Error getting user data:', error);
        }
    }

    /**
     * Verifica se deve mostrar o aviso
     */
    function checkAndShowWarning() {
        if (!currentUserData) {
            hide();
            return;
        }

        // CORREÇÃO: NÃO usar effectivePlan para decidir se mostra aviso
        // effectivePlan vira "track" após expiração, o que impediria o aviso de expiração
        // Em vez disso, verificar se usuário tem histórico de Track Pro

        const planExpiresAt = currentUserData.planExpiresAt;
        const planType = currentUserData.planType;
        const paymentOrigin = currentUserData.paymentOrigin;
        const trialStatus = currentUserData.trialStatus;
        const subscriptionStatus = currentUserData.subscriptionStatus;
        const storedPlan = currentUserData.plan;

        // Verificar se usuário teve Track Pro (baseado em campos históricos)
        const hadTrackPro = (
            // Plano armazenado é track_pro
            storedPlan === 'track_pro' ||
            // Tem planType indicando assinatura
            planType === 'trial' ||
            planType === 'monthly' ||
            planType === 'annual' ||
            // Tem paymentOrigin indicando assinatura
            paymentOrigin === 'trial' ||
            paymentOrigin === 'site' ||
            // Tem trialStatus (mesmo que expired)
            trialStatus === 'active' ||
            trialStatus === 'expired' ||
            // Tem subscriptionStatus
            subscriptionStatus === 'active' ||
            subscriptionStatus === 'expired' ||
            subscriptionStatus === 'cancelled'
        );

        // Se nunca teve Track Pro, não mostrar aviso
        if (!hadTrackPro) {
            console.log('[PLAN WARNING] User never had Track Pro, no warning');
            hide();
            return;
        }

        // Se teve Track Pro mas não tem planExpiresAt, não mostrar aviso
        if (!planExpiresAt) {
            console.log('[PLAN WARNING] User had Track Pro but no planExpiresAt, no warning');
            hide();
            return;
        }

        const now = new Date();
        const expiresDate = new Date(planExpiresAt);
        const remainingMs = expiresDate - now;
        const remainingDays = remainingMs / (1000 * 60 * 60 * 24);

        console.log('[PLAN WARNING] User had Track Pro, planExpiresAt:', planExpiresAt);
        console.log('[PLAN WARNING] Remaining days:', remainingDays);

        // Se já expirou, mostrar aviso de expirado
        if (remainingMs <= 0) {
            showExpired();
            return;
        }

        // Se faltar mais de 5 dias, não mostrar
        if (remainingDays > WARNING_DAYS_THRESHOLD) {
            hide();
            return;
        }

        // Se faltar 5 dias ou menos, mostrar aviso
        showWarning(remainingDays);
    }

    /**
     * Mostra aviso de expiração próxima
     */
    function showWarning(remainingDays) {
        if (isDismissed) return;

        let message = '';

        if (remainingDays < 1) {
            // Menos de 24 horas
            message = 'Sua assinatura expira hoje.';
        } else {
            const days = Math.floor(remainingDays);
            if (days === 1) {
                message = 'Falta 1 dia para sua assinatura expirar.';
            } else {
                message = `Faltam ${days} dias para sua assinatura expirar.`;
            }
        }

        updateMessage(message);
        show();

        // Iniciar atualização periódica
        startUpdateInterval();
    }

    /**
     * Mostra aviso de plano expirado
     */
    function showExpired() {
        if (isDismissed) return;

        const message = 'Sua assinatura expirou.';
        updateMessage(message);
        show();

        // Não precisa atualizar periodicamente pois já expirou
        stopUpdateInterval();
    }

    /**
     * Atualiza a mensagem do aviso
     */
    function updateMessage(message) {
        const messageElement = warningElement.querySelector('.plan-warning-message');
        if (messageElement) {
            messageElement.textContent = message;
        }
    }

    /**
     * Mostra o aviso
     */
    function show() {
        if (warningElement) {
            warningElement.style.display = 'flex';
        }
    }

    /**
     * Esconde o aviso
     */
    function hide() {
        if (warningElement) {
            warningElement.style.display = 'none';
        }
        stopUpdateInterval();
    }

    /**
     * Fecha o aviso (apenas para a sessão atual)
     */
    function dismiss() {
        console.log('[PLAN WARNING] Warning dismissed by user');
        isDismissed = true;
        hide();
        stopUpdateInterval();
    }

    /**
     * Redireciona para página de planos
     */
    function renew() {
        console.log('[PLAN WARNING] Redirecting to planos.html');
        window.location.href = 'planos.html';
    }

    /**
     * Inicia intervalo de atualização
     */
    function startUpdateInterval() {
        stopUpdateInterval(); // Parar existente se houver
        updateInterval = setInterval(() => {
            if (currentUserData && !isDismissed) {
                checkAndShowWarning();
            }
        }, UPDATE_INTERVAL_MS);
    }

    /**
     * Para intervalo de atualização
     */
    function stopUpdateInterval() {
        if (updateInterval) {
            clearInterval(updateInterval);
            updateInterval = null;
        }
    }

    /**
     * API pública
     */
    return {
        init: init,
        dismiss: dismiss,
        renew: renew
    };
})();

// Inicializar quando DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        PlanExpirationWarning.init();
    });
} else {
    PlanExpirationWarning.init();
}


// Inicializar quando DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        PlanExpirationWarning.init();
    });
} else {
    PlanExpirationWarning.init();
}
