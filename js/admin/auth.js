// @ts-check
/**
 * Módulo de autenticação e verificação de permissão administrativa (`public.is_admin()`).
 */

import {
  supabase,
  isSupabaseConfigured,
  RPC_FUNCTIONS,
  getCurrentSession,
  normalizeSupabaseError,
} from '../supabaseClient.js';

import { state, setState, resetAuthenticatedState } from './state.js';

export const GENERIC_LOGIN_ERROR = 'E-mail ou senha inválidos.';

/**
 * Consulta o nível de garantia de autenticação (`aal1`/`aal2`) e os fatores TOTP verificados.
 * @returns {Promise<{
 *   currentLevel: string | null,
 *   nextLevel: string | null,
 *   requiresMfaChallenge: boolean,
 *   verifiedTotpFactor: any | null,
 *   allFactors: any[],
 * }>}
 */
export async function inspectMfaAssuranceState() {
  if (!supabase?.auth?.mfa) {
    return {
      currentLevel: null,
      nextLevel: null,
      requiresMfaChallenge: false,
      verifiedTotpFactor: null,
      allFactors: [],
    };
  }

  try {
    const [aalRes, factorsRes] = await Promise.all([
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.auth.mfa.listFactors(),
    ]);

    const currentLevel = aalRes?.data?.currentLevel || null;
    const nextLevel = aalRes?.data?.nextLevel || null;
    const allFactors = Array.isArray(factorsRes?.data?.all) ? factorsRes.data.all : [];
    const verifiedTotp =
      (Array.isArray(factorsRes?.data?.totp) &&
        factorsRes.data.totp.find((f) => f.status === 'verified')) ||
      allFactors.find((f) => f.factor_type === 'totp' && f.status === 'verified') ||
      null;

    const requiresMfaChallenge = Boolean(
      currentLevel !== 'aal2' && nextLevel === 'aal2' && verifiedTotp
    );

    return {
      currentLevel,
      nextLevel,
      requiresMfaChallenge,
      verifiedTotpFactor: verifiedTotp,
      allFactors,
    };
  } catch {
    return {
      currentLevel: null,
      nextLevel: null,
      requiresMfaChallenge: false,
      verifiedTotpFactor: null,
      allFactors: [],
    };
  }
}

/**
 * Inicia inscrição de um novo fator TOTP no Supabase Auth MFA.
 * @param {string} [friendlyName='Botica Natural Admin']
 */
export async function startTotpEnrollment(friendlyName = 'Botica Natural Admin') {
  if (!supabase?.auth?.mfa) {
    return { ok: false, errorMessage: 'Serviço de autenticação indisponível no momento.' };
  }

  try {
    // Limpa fatores TOTP ainda não verificados para permitir nova geração limpa
    const existing = await supabase.auth.mfa.listFactors();
    const unverified = (existing?.data?.all || []).filter(
      (f) => f.factor_type === 'totp' && f.status === 'unverified'
    );
    for (const stale of unverified) {
      await supabase.auth.mfa.unenroll({ factorId: stale.id });
    }

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName,
    });

    if (error || !data) {
      const norm = normalizeSupabaseError(error, 'Não foi possível iniciar o cadastro de MFA');
      return { ok: false, errorMessage: norm.userMessage };
    }

    return {
      ok: true,
      factorId: data.id,
      qrCode: data.totp?.qr_code || '',
      secret: data.totp?.secret || '',
      uri: data.totp?.uri || '',
    };
  } catch (err) {
    const norm = normalizeSupabaseError(err, 'Erro ao iniciar inscrição de MFA');
    return { ok: false, errorMessage: norm.userMessage };
  }
}

/**
 * Conclui um desafio TOTP (usado tanto na ativação inicial quanto no login `aal2`).
 * @param {string} factorId
 * @param {string} rawCode
 * @param {{ verifyAdminAfter?: boolean }} [options={}]
 */
export async function verifyTotpChallenge(factorId, rawCode, options = {}) {
  if (!supabase?.auth?.mfa) {
    return { ok: false, errorMessage: 'Serviço de autenticação indisponível no momento.' };
  }

  const code = String(rawCode || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(code)) {
    return { ok: false, errorMessage: 'Informe o código numérico de 6 dígitos do autenticador.' };
  }

  try {
    const { data: chData, error: chError } = await supabase.auth.mfa.challenge({ factorId });
    if (chError || !chData?.id) {
      const norm = normalizeSupabaseError(chError, 'Falha ao iniciar desafio de verificação');
      return { ok: false, errorMessage: norm.userMessage };
    }

    const { error: verError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: chData.id,
      code,
    });
    if (verError) {
      normalizeSupabaseError(verError, 'Falha ao validar código MFA');
      return { ok: false, errorMessage: 'Código de verificação inválido ou expirado.' };
    }

    const session = await getCurrentSession();
    if (!session) {
      return { ok: false, errorMessage: GENERIC_LOGIN_ERROR };
    }

    if (options.verifyAdminAfter !== false) {
      const isAdmin = await verifyServerAdminRole();
      if (!isAdmin) {
        await supabase.auth.signOut();
        resetAuthenticatedState();
        return { ok: false, errorMessage: GENERIC_LOGIN_ERROR };
      }
    }

    setState({
      session,
      userEmail: session.user?.email || state.userEmail || 'Administrador',
      currentUserId: session.user?.id || state.currentUserId || '',
    });

    return { ok: true, session };
  } catch (err) {
    normalizeSupabaseError(err, 'Erro inesperado na validação MFA');
    return { ok: false, errorMessage: 'Não foi possível validar o código. Tente novamente.' };
  }
}

/**
 * Remove um fator MFA cadastrado (requer sessão `aal2` quando o fator estiver verificado).
 * @param {string} factorId
 */
export async function removeMfaFactor(factorId) {
  if (!supabase?.auth?.mfa) {
    return { ok: false, errorMessage: 'Serviço de autenticação indisponível no momento.' };
  }

  try {
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) {
      const norm = normalizeSupabaseError(error, 'Não foi possível remover o fator MFA');
      return { ok: false, errorMessage: norm.userMessage };
    }
    return { ok: true };
  } catch (err) {
    const norm = normalizeSupabaseError(err, 'Erro ao remover o fator MFA');
    return { ok: false, errorMessage: norm.userMessage };
  }
}

/**
 * Verifica no servidor via RPC administrativa se o usuário logado possui permissão.
 * @returns {Promise<boolean>}
 */
export async function verifyServerAdminRole() {
  if (!supabase) return false;
  try {
    const { data, error } = await supabase.rpc(RPC_FUNCTIONS.IS_ADMIN);
    if (error) {
      normalizeSupabaseError(error, 'Falha ao validar permissão administrativa');
      return false;
    }
    return Boolean(data);
  } catch {
    return false;
  }
}

/**
 * Realiza login com e-mail e senha.
 * Caso o usuário tenha TOTP habilitado (`nextLevel === 'aal2'`), solicita o desafio MFA
 * ANTES de validar `is_admin()` para evitar lockout quando `aal2` for exigido no banco.
 * Nunca diferencia falha de credencial de conta sem privilégio administrativo.
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ ok: boolean, mfaRequired?: boolean, factorId?: string, session?: any, errorMessage?: string }>}
 */
export async function loginAdmin(email, password) {
  if (!isSupabaseConfigured || !supabase) {
    return {
      ok: false,
      errorMessage: 'Serviço de autenticação indisponível no momento.',
    };
  }

  const cleanEmail = String(email || '').trim();
  if (!cleanEmail || !password) {
    return {
      ok: false,
      errorMessage: 'Preencha seu e-mail e senha para continuar.',
    };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) {
      normalizeSupabaseError(error, 'Falha na autenticação');
      return { ok: false, errorMessage: GENERIC_LOGIN_ERROR };
    }

    const session = data?.session;
    if (!session) {
      return { ok: false, errorMessage: GENERIC_LOGIN_ERROR };
    }

    const mfaState = await inspectMfaAssuranceState();
    if (mfaState.requiresMfaChallenge && mfaState.verifiedTotpFactor) {
      return {
        ok: true,
        mfaRequired: true,
        factorId: mfaState.verifiedTotpFactor.id,
        session,
      };
    }

    const isAdmin = await verifyServerAdminRole();
    if (!isAdmin) {
      await supabase.auth.signOut();
      resetAuthenticatedState();
      return {
        ok: false,
        errorMessage: GENERIC_LOGIN_ERROR,
      };
    }

    setState({
      session,
      userEmail: session.user?.email || 'Administrador',
      currentUserId: session.user?.id || '',
    });

    return { ok: true, mfaRequired: false, session };
  } catch (err) {
    normalizeSupabaseError(err, 'Erro inesperado ao realizar login');
    return { ok: false, errorMessage: GENERIC_LOGIN_ERROR };
  }
}

/**
 * Encerra a sessão ativa do administrador.
 */
export async function logoutAdmin() {
  if (supabase) {
    await supabase.auth.signOut();
  }
  resetAuthenticatedState();
}

/**
 * Inicializa o guardião de sessão e observa mudanças de autenticação.
 * @param {{
 *   onAuthenticated: (session: any) => Promise<void>,
 *   onUnauthenticated: (reason?: string) => void
 * }} callbacks
 */
export async function initAuthLifecycle(callbacks) {
  if (!isSupabaseConfigured || !supabase) {
    callbacks.onUnauthenticated('Serviço de autenticação indisponível no momento.');
    return;
  }

  const handleSessionResolution = async (/** @type {any} */ session) => {
    const mfaState = await inspectMfaAssuranceState();
    if (mfaState.requiresMfaChallenge && mfaState.verifiedTotpFactor) {
      callbacks.onMfaRequired?.({
        session,
        factorId: mfaState.verifiedTotpFactor.id,
      });
      return;
    }

    const isAdmin = await verifyServerAdminRole();
    if (isAdmin) {
      setState({
        session,
        userEmail: session.user?.email || 'Administrador',
        currentUserId: session.user?.id || '',
      });
      await callbacks.onAuthenticated(session);
    } else {
      await supabase.auth.signOut();
      resetAuthenticatedState();
      callbacks.onUnauthenticated(GENERIC_LOGIN_ERROR);
    }
  };

  const initialSession = await getCurrentSession();
  if (initialSession) {
    await handleSessionResolution(initialSession);
  } else {
    callbacks.onUnauthenticated();
  }

  // Listener com desacoplamento via setTimeout para evitar deadlock em chamadas RPC internas
  supabase.auth.onAuthStateChange((event, nextSession) => {
    setTimeout(async () => {
      if (event === 'SIGNED_OUT' || !nextSession) {
        resetAuthenticatedState();
        callbacks.onUnauthenticated();
        return;
      }

      const nextUserId = nextSession.user?.id || '';
      const previousUserId = state.currentUserId;

      // Se for o mesmo usuário já autenticado e não houver desafio MFA pendente
      if (previousUserId && nextUserId === previousUserId) {
        const mfaState = await inspectMfaAssuranceState();
        if (!mfaState.requiresMfaChallenge) {
          setState({
            session: nextSession,
            userEmail: nextSession.user?.email || state.userEmail,
          });
          return;
        }
      }

      await handleSessionResolution(nextSession);
    }, 0);
  });
}

