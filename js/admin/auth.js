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
 * Realiza login com e-mail e senha e valida imediatamente o papel de administrador.
 * Nunca diferencia falha de credencial de conta sem privilégio administrativo.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ ok: boolean, session?: any, errorMessage?: string }>}
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

    return { ok: true, session };
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

  const initialSession = await getCurrentSession();
  if (initialSession) {
    const isAdmin = await verifyServerAdminRole();
    if (isAdmin) {
      setState({
        session: initialSession,
        userEmail: initialSession.user?.email || 'Administrador',
        currentUserId: initialSession.user?.id || '',
      });
      await callbacks.onAuthenticated(initialSession);
    } else {
      await supabase.auth.signOut();
      resetAuthenticatedState();
      callbacks.onUnauthenticated(GENERIC_LOGIN_ERROR);
    }
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

      // Se for o mesmo usuário autenticado (TOKEN_REFRESHED ou foco com SIGNED_IN)
      if (previousUserId && nextUserId === previousUserId) {
        // Atualiza apenas a sessão em memória sem remontar telas nem refazer consultas
        setState({
          session: nextSession,
          userEmail: nextSession.user?.email || state.userEmail,
        });
        return;
      }

      // Novo usuário autenticado
      const isAdmin = await verifyServerAdminRole();
      if (isAdmin) {
        setState({
          session: nextSession,
          userEmail: nextSession.user?.email || 'Administrador',
          currentUserId: nextUserId,
        });
        await callbacks.onAuthenticated(nextSession);
      } else {
        await supabase.auth.signOut();
        resetAuthenticatedState();
        callbacks.onUnauthenticated(GENERIC_LOGIN_ERROR);
      }
    }, 0);
  });
}

