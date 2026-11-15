/**
 * ============================================================================
 * Botica Natural — Supabase Infrastructure & Singleton Client (ES6+ Module)
 * ============================================================================
 * Utilizado exclusivamente pelo Painel Administrativo (`admin.html` / `js/admin/*`)
 * para autenticação (`supabase.auth`), Storage (`supabase.storage`) e RPC (`is_admin`).
 *
 * As páginas públicas (`index.html`, `produtos.html`, `produto.html`, `privacidade.html`)
 * consomem apenas `js/publicApi.js` (fetch REST leve, sem carregar `@supabase/supabase-js`).
 * ============================================================================
 */

import { createClient } from './vendor/supabase-js-2.49.1.esm.js';
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  DB_TABLES,
  STORAGE_CONFIG,
  RPC_FUNCTIONS,
  STORAGE_BUCKET,
  validateClientConfig,
  isSupabaseConfigured,
  isTrustedSupabaseStorageUrl,
  isTrustedStorageUrl,
  getPublicImageUrl,
  getProductImageUrl,
  resolveSafeStorageImageUrl,
  normalizeSupabaseError,
} from './publicApi.js';

export {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  DB_TABLES,
  STORAGE_CONFIG,
  RPC_FUNCTIONS,
  STORAGE_BUCKET,
  validateClientConfig,
  isSupabaseConfigured,
  isTrustedSupabaseStorageUrl,
  isTrustedStorageUrl,
  getPublicImageUrl,
  getProductImageUrl,
  resolveSafeStorageImageUrl,
  normalizeSupabaseError,
};

const AUTH_CLIENT_OPTIONS = Object.freeze({
  auth: Object.freeze({
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'vitrine_admin_auth_token',
  }),
});

const safeInitUrl = SUPABASE_URL.startsWith('https://')
  ? SUPABASE_URL
  : 'https://placeholder-project.supabase.co';
const safeInitKey = SUPABASE_ANON_KEY || 'placeholder-anon-key';

/**
 * Instância única (Singleton) do cliente Supabase para o painel administrativo.
 */
export const supabase = createClient(safeInitUrl, safeInitKey, AUTH_CLIENT_OPTIONS);

/**
 * Recupera de forma assíncrona e segura a sessão ativa do administrador no Supabase Auth.
 */
export async function getCurrentSession() {
  if (!isSupabaseConfigured) {
    return null;
  }

  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      normalizeSupabaseError(error, 'Falha ao verificar a sessão de autenticação');
      return null;
    }

    return data?.session ?? null;
  } catch (unexpectedError) {
    normalizeSupabaseError(
      unexpectedError,
      'Exceção inesperada ao recuperar a sessão do usuário'
    );
    return null;
  }
}
