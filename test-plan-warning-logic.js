/**
 * Teste da lógica do aviso de expiração
 * Testa apenas a lógica de decisão sem dependência de browser
 */

const WARNING_DAYS_THRESHOLD = 5;

function shouldShowWarning(userData) {
    if (!userData) return { show: false, message: 'Sem dados' };

    // CORREÇÃO: Verificar se usuário teve Track Pro baseado em campos históricos
    // NÃO usar effectivePlan pois ele vira "track" após expiração
    const planExpiresAt = userData.planExpiresAt;
    const planType = userData.planType;
    const paymentOrigin = userData.paymentOrigin;
    const trialStatus = userData.trialStatus;
    const subscriptionStatus = userData.subscriptionStatus;
    const storedPlan = userData.plan;

    const hadTrackPro = (
        storedPlan === 'track_pro' ||
        planType === 'trial' ||
        planType === 'monthly' ||
        planType === 'annual' ||
        paymentOrigin === 'trial' ||
        paymentOrigin === 'site' ||
        trialStatus === 'active' ||
        trialStatus === 'expired' ||
        subscriptionStatus === 'active' ||
        subscriptionStatus === 'expired' ||
        subscriptionStatus === 'cancelled'
    );

    if (!hadTrackPro) {
        return { show: false, message: 'Usuário nunca teve Track Pro' };
    }

    if (!planExpiresAt) {
        return { show: false, message: 'Teve Track Pro mas sem planExpiresAt' };
    }

    const now = new Date();
    const expiresDate = new Date(planExpiresAt);
    const remainingMs = expiresDate - now;
    const remainingDays = remainingMs / (1000 * 60 * 60 * 24);

    if (remainingMs <= 0) {
        return { show: true, message: 'Sua assinatura expirou.', state: 'expired' };
    }

    if (remainingDays <= WARNING_DAYS_THRESHOLD) {
        if (remainingDays < 1) {
            return { show: true, message: 'Sua assinatura expira hoje.', state: 'today' };
        } else {
            const days = Math.floor(remainingDays);
            const message = days === 1
                ? 'Falta 1 dia para sua assinatura expirar.'
                : `Faltam ${days} dias para sua assinatura expirar.`;
            return { show: true, message: message, state: 'days' };
        }
    }

    return { show: false, message: 'Não mostrar aviso (mais de 5 dias)' };
}

// Testes
console.log('\n=== TESTE 1: Mais de 5 dias - Não mostrar aviso ===');
const futureDate10 = new Date();
futureDate10.setDate(futureDate10.getDate() + 10);
const result1 = shouldShowWarning({ plan: 'track_pro', planType: 'monthly', planExpiresAt: futureDate10.toISOString() });
console.log('Resultado:', result1);
console.log(result1.show ? '❌ FAIL: Deveria não mostrar aviso' : '✅ PASS: Não mostrou aviso corretamente');

console.log('\n=== TESTE 2: Exatamente 5 dias - Mostrar aviso ===');
const futureDate5 = new Date();
futureDate5.setDate(futureDate5.getDate() + 5);
const result2 = shouldShowWarning({ plan: 'track_pro', planType: 'monthly', planExpiresAt: futureDate5.toISOString() });
console.log('Resultado:', result2);
console.log((result2.show && result2.state === 'days') ? `✅ PASS: ${result2.message}` : '❌ FAIL: Deveria mostrar aviso de 5 dias');

console.log('\n=== TESTE 3: 3 dias - Mostrar aviso ===');
const futureDate3 = new Date();
futureDate3.setDate(futureDate3.getDate() + 3);
const result3 = shouldShowWarning({ plan: 'track_pro', planType: 'monthly', planExpiresAt: futureDate3.toISOString() });
console.log('Resultado:', result3);
console.log((result3.show && result3.state === 'days') ? `✅ PASS: ${result3.message}` : '❌ FAIL: Deveria mostrar aviso de 3 dias');

console.log('\n=== TESTE 4: 1 dia - Mostrar aviso ===');
const futureDate1 = new Date();
futureDate1.setDate(futureDate1.getDate() + 1);
const result4 = shouldShowWarning({ plan: 'track_pro', planType: 'monthly', planExpiresAt: futureDate1.toISOString() });
console.log('Resultado:', result4);
console.log((result4.show && result4.state === 'days') ? `✅ PASS: ${result4.message}` : '❌ FAIL: Deveria mostrar aviso de 1 dia');

console.log('\n=== TESTE 5: Menos de 24 horas - "Expira hoje" ===');
const futureDate12h = new Date();
futureDate12h.setHours(futureDate12h.getHours() + 12);
const result5 = shouldShowWarning({ plan: 'track_pro', planType: 'monthly', planExpiresAt: futureDate12h.toISOString() });
console.log('Resultado:', result5);
console.log((result5.show && result5.state === 'today') ? `✅ PASS: ${result5.message}` : '❌ FAIL: Deveria mostrar "expira hoje"');

console.log('\n=== TESTE 6: EXPIRADO - plan ainda "track_pro" - Mostrar "Expirou" ===');
const pastDate = new Date();
pastDate.setDate(pastDate.getDate() - 1);
const result6 = shouldShowWarning({ plan: 'track_pro', planType: 'monthly', planExpiresAt: pastDate.toISOString() });
console.log('Resultado:', result6);
console.log((result6.show && result6.state === 'expired') ? `✅ PASS: ${result6.message}` : '❌ FAIL: Deveria mostrar "expirou"');

console.log('\n=== TESTE 7: EXPIRADO - plan mudou para "track" - Mostrar "Expirou" ===');
const result7 = shouldShowWarning({ plan: 'track', planType: 'monthly', trialStatus: 'expired', planExpiresAt: pastDate.toISOString() });
console.log('Resultado:', result7);
console.log((result7.show && result7.state === 'expired') ? `✅ PASS: ${result7.message}` : '❌ FAIL: Deveria mostrar "expirou" mesmo com plan="track"');

console.log('\n=== TESTE 8: Plano Track que nunca teve Track Pro - Não mostrar aviso ===');
const result8 = shouldShowWarning({ plan: 'track' });
console.log('Resultado:', result8);
console.log(result8.show ? '❌ FAIL: Não deveria mostrar aviso para Track sem histórico' : '✅ PASS: Não mostrou aviso para Track sem histórico');

console.log('\n=== TESTE 9: Track Pro sem planExpiresAt - Não mostrar aviso ===');
const result9 = shouldShowWarning({ plan: 'track_pro', planType: 'monthly' });
console.log('Resultado:', result9);
console.log(result9.show ? '❌ FAIL: Não deveria mostrar aviso sem planExpiresAt' : '✅ PASS: Não mostrou aviso sem planExpiresAt');

console.log('\n=== TESTE 10: Trial expirado - Mostrar "Expirou" ===');
const result10 = shouldShowWarning({ plan: 'track', planType: 'trial', paymentOrigin: 'trial', trialStatus: 'expired', planExpiresAt: pastDate.toISOString() });
console.log('Resultado:', result10);
console.log((result10.show && result10.state === 'expired') ? `✅ PASS: ${result10.message}` : '❌ FAIL: Deveria mostrar "expirou" para trial');

console.log('\n=== FIM DOS TESTES ===');
