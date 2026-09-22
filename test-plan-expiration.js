/**
 * Teste de Expiração de Plano Track Pro
 * Este script testa a lógica de expiração baseada em planExpiresAt
 * com o novo sistema que considera expiração para todos os tipos de plano
 */

// Simula a função getEffectivePlan do planEngine.js
function getEffectivePlan(userData) {
    if (!userData) {
        console.log('[PLAN VALIDITY] No user data provided');
        return 'track';
    }

    const plan = userData.plan || 'track';
    const planExpiresAt = userData.planExpiresAt;
    const now = new Date();

    console.log('[PLAN VALIDITY] Current plan:', plan);
    console.log('[PLAN VALIDITY] Plan expires at:', planExpiresAt);
    console.log('[PLAN VALIDITY] Current time:', now.toISOString());

    // Se não for track_pro, sempre retorna track
    if (plan !== 'track_pro') {
        console.log('[PLAN VALIDITY] Not track_pro, returning:', plan);
        return plan;
    }

    // Se for track_pro mas não tiver planExpiresAt, trata como expirado (segurança)
    if (!planExpiresAt) {
        console.log('[PLAN VALIDITY] track_pro without planExpiresAt, treating as expired');
        return 'track';
    }

    // Verifica expiração
    const expiresDate = new Date(planExpiresAt);
    const isExpired = expiresDate <= now;

    console.log('[PLAN VALIDITY] Plan expired:', isExpired);

    if (isExpired) {
        console.log('[PLAN VALIDITY] Track Pro expired, returning track');
        return 'track';
    } else {
        console.log('[PLAN VALIDITY] Track Pro is still active');
        return 'track_pro';
    }
}

// Simula calculateRemainingTime do planEngine.js
function calculateRemainingTime(planExpiresAt) {
    if (!planExpiresAt) {
        return {
            isExpired: true,
            totalMs: 0,
            days: 0,
            hours: 0,
            minutes: 0,
            seconds: 0
        };
    }

    const now = new Date();
    const expiresDate = new Date(planExpiresAt);
    const remainingMs = expiresDate - now;

    console.log('[REMAINING] Current time:', now.toISOString());
    console.log('[REMAINING] Expires at:', expiresDate.toISOString());
    console.log('[REMAINING] Remaining ms:', remainingMs);

    if (remainingMs <= 0) {
        // EXPIRADO - retorna zeros, não usa Math.abs
        return {
            isExpired: true,
            totalMs: 0,
            days: 0,
            hours: 0,
            minutes: 0,
            seconds: 0
        };
    }

    const days = Math.floor(remainingMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((remainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);

    return {
        isExpired: false,
        totalMs: remainingMs,
        days,
        hours,
        minutes,
        seconds
    };
}

// Test 1: Usuário com trial expirado
console.log('\n=== TESTE 1: Usuário com trial expirado ===');
const pastDate = new Date();
pastDate.setDate(pastDate.getDate() - 10);

const expiredTrialUser = {
    plan: 'track_pro',
    planType: 'trial',
    planStartedAt: new Date(pastDate.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    planExpiresAt: pastDate.toISOString()
};

const result1 = getEffectivePlan(expiredTrialUser);
console.log('Resultado:', result1);
if (result1 === 'track') {
    console.log('✅ PASS: Usuário com trial expirado foi corretamente identificado como track');
} else {
    console.log('❌ FAIL: Esperava "track", mas recebeu:', result1);
}

// Test 2: Usuário com trial ativo
console.log('\n=== TESTE 2: Usuário com trial ativo ===');
const futureDate = new Date();
futureDate.setDate(futureDate.getDate() + 5);

const activeTrialUser = {
    plan: 'track_pro',
    planType: 'trial',
    planStartedAt: new Date().toISOString(),
    planExpiresAt: futureDate.toISOString()
};

const result2 = getEffectivePlan(activeTrialUser);
console.log('Resultado:', result2);
if (result2 === 'track_pro') {
    console.log('✅ PASS: Usuário com trial ativo foi corretamente identificado como track_pro');
} else {
    console.log('❌ FAIL: Esperava "track_pro", mas recebeu:', result2);
}

// Test 3: Usuário com plano mensal expirado
console.log('\n=== TESTE 3: Usuário com plano mensal expirado ===');
const expiredMonthlyDate = new Date();
expiredMonthlyDate.setDate(expiredMonthlyDate.getDate() - 30);

const expiredMonthlyUser = {
    plan: 'track_pro',
    planType: 'monthly',
    planStartedAt: new Date(expiredMonthlyDate.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    planExpiresAt: expiredMonthlyDate.toISOString()
};

const result3 = getEffectivePlan(expiredMonthlyUser);
console.log('Resultado:', result3);
if (result3 === 'track') {
    console.log('✅ PASS: Usuário com plano mensal expirado foi corretamente identificado como track');
} else {
    console.log('❌ FAIL: Esperava "track", mas recebeu:', result3);
}

// Test 4: Usuário com plano anual ativo
console.log('\n=== TESTE 4: Usuário com plano anual ativo ===');
const annualFutureDate = new Date();
annualFutureDate.setDate(annualFutureDate.getDate() + 365);

const activeAnnualUser = {
    plan: 'track_pro',
    planType: 'annual',
    planStartedAt: new Date().toISOString(),
    planExpiresAt: annualFutureDate.toISOString()
};

const result4 = getEffectivePlan(activeAnnualUser);
console.log('Resultado:', result4);
if (result4 === 'track_pro') {
    console.log('✅ PASS: Usuário com plano anual ativo foi corretamente identificado como track_pro');
} else {
    console.log('❌ FAIL: Esperava "track_pro", mas recebeu:', result4);
}

// Test 5: Usuário track_pro sem planExpiresAt (segurança)
console.log('\n=== TESTE 5: Usuário track_pro sem planExpiresAt ===');
const noExpirationUser = {
    plan: 'track_pro',
    planType: 'monthly',
    planStartedAt: new Date().toISOString()
    // planExpiresAt ausente
};

const result5 = getEffectivePlan(noExpirationUser);
console.log('Resultado:', result5);
if (result5 === 'track') {
    console.log('✅ PASS: Usuário track_pro sem planExpiresAt foi tratado como track (segurança)');
} else {
    console.log('❌ FAIL: Esperava "track" por segurança, mas recebeu:', result5);
}

// Test 6: Usuário com plano Track normal
console.log('\n=== TESTE 6: Usuário com plano Track normal ===');
const trackUser = {
    plan: 'track',
    planType: null
};

const result6 = getEffectivePlan(trackUser);
console.log('Resultado:', result6);
if (result6 === 'track') {
    console.log('✅ PASS: Usuário com plano Track permanece como track');
} else {
    console.log('❌ FAIL: Esperava "track", mas recebeu:', result6);
}

// Test 7: Cálculo de tempo restante expirado
console.log('\n=== TESTE 7: Cálculo de tempo restante expirado ===');
const expiredTime = new Date();
expiredTime.setMinutes(expiredTime.getMinutes() - 5);

const remaining7 = calculateRemainingTime(expiredTime.toISOString());
console.log('Resultado:', remaining7);
if (remaining7.isExpired === true && remaining7.totalMs === 0 && remaining7.days === 0 && remaining7.hours === 0 && remaining7.minutes === 0 && remaining7.seconds === 0) {
    console.log('✅ PASS: Tempo expirado retorna zeros, não valores positivos');
} else {
    console.log('❌ FAIL: Esperava zeros para tempo expirado');
}

// Test 8: Cálculo de tempo restante ativo
console.log('\n=== TESTE 8: Cálculo de tempo restante ativo ===');
const activeTime = new Date();
activeTime.setHours(activeTime.getHours() + 2);
activeTime.setMinutes(activeTime.getMinutes() + 30);

const remaining8 = calculateRemainingTime(activeTime.toISOString());
console.log('Resultado:', remaining8);
if (remaining8.isExpired === false && remaining8.totalMs > 0 && remaining8.hours === 2 && remaining8.minutes === 30) {
    console.log('✅ PASS: Tempo ativo calculado corretamente');
} else {
    console.log('❌ FAIL: Esperava tempo positivo com 2h 30m');
}

// Test 9: Expiração exata (now == planExpiresAt)
console.log('\n=== TESTE 9: Expiração exata (now == planExpiresAt) ===');
const exactTime = new Date();
// Simula expiração no momento exato (ou 1ms atrás devido ao delay de execução)

const exactExpirationUser = {
    plan: 'track_pro',
    planType: 'trial',
    planExpiresAt: exactTime.toISOString()
};

const result9 = getEffectivePlan(exactExpirationUser);
console.log('Resultado:', result9);
if (result9 === 'track') {
    console.log('✅ PASS: Expiração exata é tratada como expirada');
} else {
    console.log('❌ FAIL: Esperava "track" para expiração exata');
}

console.log('\n=== FIM DOS TESTES ===');