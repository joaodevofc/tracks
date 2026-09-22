/**
 * PLAN ENGINE - Motor Central de Validação de Planos
 * Fonte única de verdade para estado de planos W.Tracks
 * 
 * LIMITAÇÃO SEM BACKEND:
 * Este sistema utiliza Date.now() do navegador como fonte de tempo.
 * Sem Cloud Functions/backend, não existe garantia absoluta contra manipulação do relógio local.
 * A validade do plano é baseada em planExpiresAt (timestamp absoluto) vs tempo atual.
 * Quando o usuário retorna ao site, o sistema recalcula o tempo restante.
 */

class PlanEngine {
  constructor() {
    this.timeSource = 'local'; // SEM BACKEND: limitação documentada
    this.logBuffer = [];
    this.maxLogEntries = 1000;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    // SEM BACKEND: Não tentar sincronizar com servidor falso
    this.timeSource = 'local';
    this.initialized = true;
    this.log('ENGINE', 'info', 'Plan Engine initialized (local time mode - no backend available)');
  }

  /**
   * Obtém tempo atual do navegador
   * LIMITAÇÃO: Suscetível a manipulação do relógio local sem backend
   */
  getCurrentTime() {
    return new Date();
  }

  /**
   * Calcula tempo restante até expiração
   * CORREÇÃO: Não usa Math.abs() para mostrar tempo positivo após expiração
   */
  calculateRemainingTime(planExpiresAt) {
    if (!planExpiresAt) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0, isExpired: true };
    }

    const now = this.getCurrentTime();
    const expiresAt = new Date(planExpiresAt);
    const remainingMs = expiresAt.getTime() - now.getTime();
    
    const isExpired = remainingMs <= 0;
    
    // CORREÇÃO: Se expirado, retornar 0 para todos os campos
    if (isExpired) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0, isExpired: true };
    }
    
    // Se não expirado, calcular tempo restante positivo
    const days = Math.floor(remainingMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((remainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);

    return { days, hours, minutes, seconds, totalMs: remainingMs, isExpired: false };
  }

  formatRemainingTime(remaining) {
    const d = String(remaining.days).padStart(2, '0');
    const h = String(remaining.hours).padStart(2, '0');
    const m = String(remaining.minutes).padStart(2, '0');
    const s = String(remaining.seconds).padStart(2, '0');
    return `${d}d ${h}:${m}:${s}`;
  }

  /**
   * Obtém o plano EFETIVO do usuário (considerando expiração)
   * Esta é a função central de autorização - retorna o plano que deve ser usado para permissões
   * @param {Object} userData - Dados do usuário do Firestore
   * @returns {string} - 'track' ou 'track_pro' (plano efetivo após validação)
   */
  getEffectivePlan(userData) {
    if (!userData) {
      this.log('EFFECTIVE_PLAN', 'warning', 'No user data provided, defaulting to track');
      return 'track';
    }

    const plan = userData.plan || 'track';
    
    // Track permanece Track
    if (plan === 'track') {
      this.log('EFFECTIVE_PLAN', 'info', `uid=${userData.uid}, effective plan: track`);
      return 'track';
    }

    // Track Pro precisa validar expiração
    if (plan === 'track_pro') {
      const planExpiresAt = userData.planExpiresAt || userData.trialEndsAt || userData.validadeAcesso;
      
      // Sem data de expiração = segurança: não conceder Pro indefinido
      if (!planExpiresAt) {
        this.log('EFFECTIVE_PLAN', 'warning', `uid=${userData.uid}, track_pro without expiration date, treating as track`);
        return 'track';
      }

      const remaining = this.calculateRemainingTime(planExpiresAt);
      
      // Se expirado, plano efetivo é Track (mesmo que Firestore ainda tenha track_pro)
      if (remaining.isExpired) {
        this.log('EFFECTIVE_PLAN', 'info', `uid=${userData.uid}, track_pro expired, effective plan: track`);
        return 'track';
      }
      
      // Se não expirado, plano efetivo é Track Pro
      this.log('EFFECTIVE_PLAN', 'info', `uid=${userData.uid}, track_pro active, effective plan: track_pro`);
      return 'track_pro';
    }

    this.log('EFFECTIVE_PLAN', 'warning', `uid=${userData.uid}, unknown plan: ${plan}, defaulting to track`);
    return 'track';
  }

  /**
   * Verifica status detalhado do plano (para System e diagnóstico)
   * @param {Object} userData - Dados do usuário do Firestore
   * @returns {Object} - { effectivePlan, isActive, remaining, status, firestorePlan }
   */
  checkPlanStatus(userData) {
    if (!userData) {
      return { effectivePlan: 'track', isActive: true, remaining: null, status: 'unknown', firestorePlan: null };
    }

    const firestorePlan = userData.plan || 'track';
    const effectivePlan = this.getEffectivePlan(userData);
    
    if (firestorePlan === 'track') {
      return { effectivePlan: 'track', isActive: true, remaining: null, status: 'free', firestorePlan };
    }

    if (firestorePlan === 'track_pro') {
      const planExpiresAt = userData.planExpiresAt || userData.trialEndsAt || userData.validadeAcesso;
      
      if (!planExpiresAt) {
        return { effectivePlan: 'track', isActive: false, remaining: null, status: 'no_expiry', firestorePlan };
      }

      const remaining = this.calculateRemainingTime(planExpiresAt);
      const isActive = !remaining.isExpired;
      const status = isActive ? 'active' : 'expired';

      this.log('PLAN_CHECK', 'info', `uid=${userData.uid}, firestore=${firestorePlan}, effective=${effectivePlan}, remaining=${this.formatRemainingTime(remaining)}, status=${status}`);

      return { effectivePlan, isActive, remaining, status, firestorePlan };
    }

    return { effectivePlan: 'track', isActive: false, remaining: null, status: 'unknown', firestorePlan };
  }

  async activatePlan(userId, planType, transactionId = null) {
    const now = this.getCurrentTime();
    const planStartedAt = now.toISOString();
    
    // Durações conforme sistema atual
    let durationDays;
    switch (planType) {
      case 'trial': durationDays = 7; break;
      case 'monthly': durationDays = 30; break;
      case 'annual': durationDays = 365; break;
      default: durationDays = 30;
    }

    // Calcular expiração como timestamp absoluto
    const planExpiresAt = new Date(now);
    planExpiresAt.setDate(planExpiresAt.getDate() + durationDays);
    planExpiresAt.setHours(23, 59, 59, 999);

    const updateData = {
      plan: 'track_pro',
      planType: planType,
      planStartedAt: planStartedAt,
      planExpiresAt: planExpiresAt.toISOString(),
      trialUsed: true,
      trialStartedAt: planStartedAt,
      trialEndsAt: planExpiresAt.toISOString(),
      trialStatus: 'active',
      paymentOrigin: planType === 'trial' ? 'trial' : 'site',
      paymentStatus: 'completed',
      lastTransactionId: transactionId,
      updatedAt: now.toISOString()
    };

    try {
      const { db, doc, setDoc } = window.firebaseDB;
      const userDocRef = doc(db, 'users', userId);
      
      await setDoc(userDocRef, updateData, { merge: true });
      
      this.log('PLAN_ACTIVATE', 'success', `uid=${userId}, type=${planType}, expires=${planExpiresAt.toISOString()}`);
      
      return { success: true, planExpiresAt: planExpiresAt.toISOString() };
    } catch (error) {
      this.log('PLAN_ACTIVATE', 'error', `uid=${userId}, error=${error.message}`);
      throw error;
    }
  }

  /**
   * Rebaixa usuário expirado de track_pro para track
   * IDEMPOTENTE: Se já estiver como track, não faz nada
   * @param {string} userId - ID do usuário
   */
  async downgradeExpiredUser(userId) {
    try {
      const { db, doc, updateDoc, collection, addDoc, getDoc } = window.firebaseDB;
      const userDoc = await getDoc(doc(db, 'users', userId));
      
      if (!userDoc.exists()) {
        this.log('DOWNGRADE', 'error', `uid=${userId}, user not found`);
        return;
      }

      const userData = userDoc.data();
      
      // IDEMPOTENTE: Se já está como track, não precisa fazer downgrade novamente
      if (userData.plan === 'track') {
        this.log('DOWNGRADE', 'info', `uid=${userId}, already track, skipping downgrade`);
        return;
      }
      
      // Salvar no histórico antes de rebaixar (apenas se não estiver no histórico)
      const historySnapshot = await getDocs(collection(db, 'subscriptionHistory'));
      const alreadyInHistory = historySnapshot.docs.some(doc => 
        doc.data().uid === userId && 
        doc.data().expiresAt === (userData.planExpiresAt || userData.trialEndsAt) &&
        doc.data().reason === 'plan_expired'
      );
      
      if (!alreadyInHistory) {
        await addDoc(collection(db, 'subscriptionHistory'), {
          uid: userId,
          email: userData.email,
          plan: 'track_pro',
          planType: userData.planType,
          paymentOrigin: userData.paymentOrigin,
          activatedAt: userData.planStartedAt || userData.trialStartedAt,
          expiresAt: userData.planExpiresAt || userData.trialEndsAt,
          transactionId: userData.lastTransactionId,
          expiredAt: this.getCurrentTime().toISOString(),
          reason: 'plan_expired',
          createdAt: this.getCurrentTime().toISOString()
        });
      }

      // Rebaixar para track
      await updateDoc(doc(db, 'users', userId), {
        plan: 'track',
        trialStatus: 'expired',
        updatedAt: this.getCurrentTime().toISOString()
      });

      this.log('DOWNGRADE', 'success', `uid=${userId}, track_pro -> track`);
    } catch (error) {
      this.log('DOWNGRADE', 'error', `uid=${userId}, error=${error.message}`);
      throw error;
    }
  }

  log(category, level, message) {
    const entry = {
      timestamp: this.getCurrentTime().toISOString(),
      category,
      level,
      message
    };

    this.logBuffer.push(entry);
    
    if (this.logBuffer.length > this.maxLogEntries) {
      this.logBuffer.shift();
    }

    console.log(`[PLAN ENGINE] [${level.toUpperCase()}] ${category}: ${message}`);
  }

  getLogs(filters = {}) {
    let logs = [...this.logBuffer];

    if (filters.category) {
      logs = logs.filter(log => log.category === filters.category);
    }

    if (filters.level) {
      logs = logs.filter(log => log.level === filters.level);
    }

    if (filters.since) {
      const since = new Date(filters.since);
      logs = logs.filter(log => new Date(log.timestamp) >= since);
    }

    return logs;
  }

  /**
   * Verifica e processa expirações em lote (para System - ferramenta manual)
   * NOTA: SEM BACKEND, esta função é apenas para verificação manual via System
   * A validação real acontece via getEffectivePlan() quando usuário usa o site
   */
  async checkExpiredPlans() {
    try {
      const { db, collection, getDocs } = window.firebaseDB;
      const usersSnapshot = await getDocs(collection(db, 'users'));
      
      let expiredCount = 0;

      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        const status = this.checkPlanStatus(userData);

        // Se plano efetivo é track mas Firestore ainda tem track_pro, fazer downgrade
        if (status.effectivePlan === 'track' && status.firestorePlan === 'track_pro') {
          await this.downgradeExpiredUser(userDoc.id);
          expiredCount++;
        }
      }

      this.log('BATCH_CHECK', 'info', `Checked ${usersSnapshot.size} users, ${expiredCount} downgraded`);
      return expiredCount;
    } catch (error) {
      this.log('BATCH_CHECK', 'error', error.message);
      throw error;
    }
  }

  /**
   * Verifica e processa expiração para um usuário específico
   * Chamado automaticamente quando usuário acessa o site
   * @param {string} userId - ID do usuário
   */
  async checkAndProcessUserExpiry(userId) {
    try {
      const userData = await this.getUserById(userId);
      if (!userData) {
        this.log('USER_EXPIRY_CHECK', 'warning', `uid=${userId}, user not found`);
        return;
      }

      const status = this.checkPlanStatus(userData);
      
      // Se plano efetivo é track mas Firestore ainda tem track_pro, fazer downgrade
      if (status.effectivePlan === 'track' && status.firestorePlan === 'track_pro') {
        this.log('USER_EXPIRY_CHECK', 'info', `uid=${userId}, plan expired, processing downgrade`);
        await this.downgradeExpiredUser(userId);
      } else {
        this.log('USER_EXPIRY_CHECK', 'info', `uid=${userId}, plan valid, no action needed`);
      }
    } catch (error) {
      this.log('USER_EXPIRY_CHECK', 'error', `uid=${userId}, error=${error.message}`);
    }
  }

  async getAllUsers() {
    try {
      const { db, collection, getDocs } = window.firebaseDB;
      const usersSnapshot = await getDocs(collection(db, 'users'));
      
      const users = [];
      usersSnapshot.forEach(doc => {
        users.push({
          uid: doc.id,
          ...doc.data()
        });
      });

      return users;
    } catch (error) {
      this.log('FETCH_USERS', 'error', error.message);
      throw error;
    }
  }

  async getUserById(userId) {
    try {
      const { db, doc, getDoc } = window.firebaseDB;
      const userDoc = await getDoc(doc(db, 'users', userId));
      
      if (userDoc.exists()) {
        return {
          uid: userDoc.id,
          ...userDoc.data()
        };
      }

      return null;
    } catch (error) {
      this.log('FETCH_USER', 'error', error.message);
      throw error;
    }
  }
}

window.planEngine = new PlanEngine();
