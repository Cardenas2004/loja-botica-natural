/**
 * ============================================================================
 * Botica Natural — Supabase Infrastructure & Singleton Client (ES6+ Module)
 * ============================================================================
 * Single Source of Truth (SSoT) compartilhado entre:
 *   - Vitrine Pública (`js/app.js`)
 *   - Painel Administrativo (`js/admin.js`)
 *
 * Arquitetura: Serverless BaaS · Zero-Trust RLS · Fail-Safe Initialization
 * ============================================================================
 */

import { createClient } from './vendor/supabase-js-2.49.1.esm.js';

/* ==========================================================================
   1. TIPAGEM JSDOC (SCHEMA POSTGRESQL -> INTELLISENSE VS CODE)
   ========================================================================== */

/**
 * Representa um registro da tabela `public.categories`.
 * @typedef {Object} Category
 * @property {string} id - Identificador único UUID (PK).
 * @property {string} name - Nome de exibição da categoria.
 * @property {string} slug - Identificador amigável único para URLs/filtros.
 * @property {number} display_order - Ordem de exibição numérica na vitrine.
 * @property {boolean} is_active - Flag de visibilidade pública da categoria.
 * @property {string} created_at - Data/hora de criação (ISO 8601 TIMESTAMPTZ).
 * @property {string} updated_at - Data/hora da última atualização (ISO 8601 TIMESTAMPTZ).
 */

/**
 * Representa um registro da tabela `public.products`.
 * @typedef {Object} Product
 * @property {string} id - Identificador único UUID (PK).
 * @property {string | null} category_id - Chave estrangeira UUID para `public.categories(id)`.
 * @property {string} name - Nome comercial do produto/fórmula.
 * @property {string} [sku_ref] - Código de referência ou SKU do produto (ex: "REF: 4299").
 * @property {string} [short_description] - Resumo conciso dos benefícios para o topo da página e vitrine.
 * @property {string} [payment_info] - Informação sobre opções de pagamento exibida ao lado do ícone de cartão.
 * @property {string | null} description - Descrição detalhada e benefícios clínicos do produto.
 * @property {string} [usage_instructions] - Instruções de posologia e modo de usar a fórmula.
 * @property {string} [composition] - Composição detalhada e insumos ativos do bloco "Contém:".
 * @property {string} [package_info] - Apresentação física e embalagem (ex: "Frasco com 90 cápsulas.").
 * @property {string} [allergen_info] - Informações de restrições e alergênicos (ex: "Não contém lactose e glúten.").
 * @property {string} [quality_note] - Nota de compromisso com rigor e qualidade farmacêutica.
 * @property {string} [whatsapp_message] - Mensagem personalizada exclusiva do WhatsApp para este produto.
 * @property {number} price - Preço unitário numérico (NUMERIC).
 * @property {string | null} image_url - URL pública direta da imagem do produto.
 * @property {string | null} image_path - Caminho relativo do arquivo dentro do bucket `product-images`.
 * @property {boolean} is_active - Indica se o produto está ativo e visível na vitrine pública.
 * @property {boolean} is_best_seller - Destaca o produto na seção "Mais Vendidos".
 * @property {string} created_at - Data/hora de criação (ISO 8601 TIMESTAMPTZ).
 * @property {string} updated_at - Data/hora da última atualização (ISO 8601 TIMESTAMPTZ).
 * @property {Category | null} [categories] - Objeto relacional opcional retornado em joins PostgREST.
 */

/**
 * Representa um registro da tabela `public.carousel_slides`.
 * @typedef {Object} CarouselSlide
 * @property {string} id - Identificador único UUID (PK).
 * @property {string} title - Descrição curta ou texto alternativo (`alt`) do banner.
 * @property {string} button_link - Link opcional caso o banner seja clicável.
 * @property {string} image_url - URL pública direta da imagem do banner no Supabase Storage.
 * @property {string} image_path - Caminho relativo do arquivo dentro do bucket `product-images`.
 * @property {number} display_order - Ordem de exibição numérica no carrossel (menor aparece primeiro).
 * @property {boolean} is_active - Indica se o banner está ativo e visível na Landing Page.
 * @property {string} created_at - Data/hora de criação (ISO 8601 TIMESTAMPTZ).
 * @property {string} updated_at - Data/hora da última atualização (ISO 8601 TIMESTAMPTZ).
 */

/**
 * Retorno padronizado de falha para consumo seguro pela camada de UI.
 * @typedef {Object} NormalizedSupabaseError
 * @property {false} success - Indicador explícito de falha da operação.
 * @property {string} userMessage - Mensagem amigável e higienizada em português para o usuário final.
 * @property {string} code - Código interno normalizado do erro (ex.: 'RLS_FORBIDDEN', 'UNIQUE_VIOLATION').
 * @property {number | null} status - Código HTTP associado, quando aplicável.
 */

/**
 * Resultado da validação de configuração do cliente Supabase.
 * @typedef {Object} ClientConfigValidationResult
 * @property {boolean} isValid - Indica se as credenciais são válidas para uso em produção/desenvolvimento.
 * @property {string[]} errors - Lista de inconsistências detectadas na configuração.
 */

/* ==========================================================================
   2. CREDENCIAIS DO PROJETO SUPABASE (AMBIENTE / CONFIGURAÇÃO)
   ========================================================================== */

const runtimeEnv = (typeof window !== 'undefined' && window.__ENV__) || {};

/**
 * Higieniza a URL base do projeto Supabase.
 * Caso o desenvolvedor cole acidentalmente o sufixo `/rest/v1/`, `/auth/v1/` ou barras finais,
 * remove-os automaticamente para evitar duplicação de rotas internas pelo SDK `@supabase/supabase-js`.
 *
 * @param {string} rawUrl - URL bruta informada na configuração.
 * @returns {string} URL base limpa (ex.: 'https://njdkuhgoophzjxmmempu.supabase.co').
 */
function sanitizeSupabaseProjectUrl(rawUrl) {
  return String(rawUrl || '')
    .trim()
    .replace(/\/+(rest|auth|storage|functions)\/v1\/?$/i, '')
    .replace(/\/+$/, '');
}

/**
 * URL pública base do projeto Supabase (Project URL).
 * @type {string}
 */
export const SUPABASE_URL = sanitizeSupabaseProjectUrl(
  runtimeEnv.SUPABASE_URL || 'https://njdkuhgoophzjxmmempu.supabase.co'
);

/**
 * Chave pública anônima (`anon` / `public` JWT).
 * Segura para exposição no frontend desde que o RLS (Row Level Security) esteja ativo nas tabelas.
 * NUNCA utilize a chave `service_role` no navegador.
 * @type {string}
 */
export const SUPABASE_ANON_KEY = String(
  runtimeEnv.SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qZGt1aGdvb3Boemp4bW1lbXB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwNTUzMTcsImV4cCI6MjEwODYzMTMxN30._OoxbYVB16sKWtH5vyOygPvcMOQtPdOluS15x1pJgq0'
).trim();

/* ==========================================================================
   3. CONTRATO DE CONSTANTES IMUTÁVEIS (ZERO MAGIC STRINGS)
   ========================================================================== */

/**
 * Mapeamento imutável das tabelas do schema `public` no PostgreSQL.
 */
export const DB_TABLES = Object.freeze({
  CATEGORIES: 'categories',
  PRODUCTS: 'products',
  CAROUSEL: 'carousel_slides',
  COMPOUNDS: 'compound_showcase_cards',
  SETTINGS: 'site_settings',
});

/**
 * Regras e limites imutáveis do Supabase Storage para imagens de produtos.
 */
export const STORAGE_CONFIG = Object.freeze({
  BUCKET_NAME: 'product-images',
  MAX_FILE_SIZE_BYTES: 2097152, // 2 MB (2 * 1024 * 1024 bytes)
  ALLOWED_MIME_TYPES: Object.freeze(['image/webp', 'image/jpeg', 'image/png']),
});

/**
 * Funções RPC (Remote Procedure Calls) expostas no banco para validação Zero-Trust.
 */
export const RPC_FUNCTIONS = Object.freeze({
  IS_ADMIN: 'is_admin',
});

/**
 * Opções explícitas de autenticação e persistência da sessão administrativa.
 */
const AUTH_CLIENT_OPTIONS = Object.freeze({
  auth: Object.freeze({
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'vitrine_admin_auth_token',
  }),
});

/* ==========================================================================
   4. VALIDAÇÃO FAIL-FAST DE CONFIGURAÇÃO (SEM QUEBRAR A PÁGINA)
   ========================================================================== */

/**
 * Padrões conhecidos de valores de placeholder que indicam credenciais ainda não preenchidas.
 * @type {RegExp}
 */
const PLACEHOLDER_PATTERN =
  /^(sua[_-]|seu[_-]|your[_-]|example|placeholder|insira|coloque|todo|<|\[)/i;

/**
 * Verifica se `SUPABASE_URL` e `SUPABASE_ANON_KEY` foram configuradas corretamente.
 * Emite um diagnóstico estruturado no console caso detecte placeholders ou formato inválido,
 * sem interromper a execução do DOM estático da página.
 *
 * @param {string} [url=SUPABASE_URL] - URL do projeto Supabase.
 * @param {string} [anonKey=SUPABASE_ANON_KEY] - Chave pública `anon` do Supabase.
 * @returns {ClientConfigValidationResult} Resultado detalhado da verificação.
 */
export function validateClientConfig(url = SUPABASE_URL, anonKey = SUPABASE_ANON_KEY) {
  /** @type {string[]} */
  const errors = [];

  const normalizedUrl = typeof url === 'string' ? url.trim() : '';
  const normalizedKey = typeof anonKey === 'string' ? anonKey.trim() : '';

  if (!normalizedUrl) {
    errors.push('A constante SUPABASE_URL está vazia.');
  } else {
    if (!normalizedUrl.startsWith('https://')) {
      errors.push('A constante SUPABASE_URL deve obrigatoriamente iniciar com "https://".');
    }

    try {
      const parsedUrl = new URL(normalizedUrl);
      if (
        PLACEHOLDER_PATTERN.test(parsedUrl.hostname) ||
        parsedUrl.hostname.includes('SEU-PROJETO') ||
        parsedUrl.hostname.includes('YOUR-PROJECT')
      ) {
        errors.push(
          `A constante SUPABASE_URL contém um valor de placeholder ("${normalizedUrl}").`
        );
      }
    } catch {
      errors.push(`A constante SUPABASE_URL não possui um formato de URL válido ("${normalizedUrl}").`);
    }
  }

  if (!normalizedKey) {
    errors.push('A constante SUPABASE_ANON_KEY está vazia.');
  } else if (
    normalizedKey.length < 32 ||
    PLACEHOLDER_PATTERN.test(normalizedKey) ||
    normalizedKey.includes('SUA_SUPABASE_ANON_KEY') ||
    normalizedKey.includes('YOUR_SUPABASE_ANON_KEY')
  ) {
    errors.push(
      'A constante SUPABASE_ANON_KEY contém um valor de placeholder ou token JWT incompleto.'
    );
  }

  const isValid = errors.length === 0;

  if (!isValid) {
    console.error(
      '[SupabaseClient][ConfigError] Credenciais do Supabase ausentes ou inválidas em "js/supabaseClient.js":\n' +
        errors.map((err, idx) => `  ${idx + 1}. ${err}`).join('\n') +
        '\n  -> Ação recomendada: Acesse o painel do Supabase (Project Settings > API) e configure SUPABASE_URL e SUPABASE_ANON_KEY.'
    );
  }

  return { isValid, errors };
}

/* ==========================================================================
   5. INSTANCIAÇÃO SINGLETON DO CLIENTE SUPABASE
   ========================================================================== */

const configValidation = validateClientConfig(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Flag booleana que permite aos módulos consumidores (`app.js` / `admin.js`)
 * saberem se o cliente está pronto para realizar chamadas de rede.
 * @type {boolean}
 */
export const isSupabaseConfigured = configValidation.isValid;

/**
 * Fallback seguro de URL e Key caso o desenvolvedor ainda não tenha preenchido as credenciais,
 * garantindo que `createClient` não lance exceção síncrona que quebre a página estática.
 */
const safeInitUrl = SUPABASE_URL.startsWith('https://')
  ? SUPABASE_URL
  : 'https://placeholder-project.supabase.co';
const safeInitKey = SUPABASE_ANON_KEY || 'placeholder-anon-key';

/**
 * Instância única (Singleton) do cliente Supabase compartilhada em toda a aplicação.
 */
export const supabase = createClient(safeInitUrl, safeInitKey, AUTH_CLIENT_OPTIONS);

/* ==========================================================================
   6. HELPERS UTILITÁRIOS DE INFRAESTRUTURA
   ========================================================================== */

/**
 * Recupera de forma assíncrona e segura a sessão ativa do usuário autenticado no Supabase Auth.
 * Nunca propaga exceções não tratadas para a camada de interface.
 *
 * @returns {Promise<import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm').Session | null>}
 *          A sessão ativa do administrador ou `null` caso não autenticado / em caso de falha.
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

/**
 * Verifica se uma URL pertence estritamente ao host oficial do Supabase Storage deste projeto.
 * Impede renderização de imagens de domínios externos arbitrários (anti-SSRF/tracking/spoofing).
 *
 * @param {string | null | undefined} rawUrl - URL candidata.
 * @returns {boolean} `true` se o protocolo for HTTPS e o host for o do Supabase Storage configurado.
 */
export function isTrustedSupabaseStorageUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return false;
  }

  try {
    const expectedHost = new URL(SUPABASE_URL).hostname.toLowerCase();
    const parsed = new URL(rawUrl.trim());
    return (
      parsed.protocol === 'https:' &&
      parsed.hostname.toLowerCase() === expectedHost &&
      parsed.pathname.startsWith(`/storage/v1/object/public/${STORAGE_CONFIG.BUCKET_NAME}/`)
    );
  } catch {
    return false;
  }
}

/**
 * Resolve e retorna a URL pública otimizada de uma imagem armazenada no bucket `product-images`.
 * Aceita tanto um caminho relativo do Storage (`image_path`) quanto uma URL absoluta do próprio Storage.
 * Rejeita qualquer URL cujo host não seja o do próprio Supabase Storage.
 *
 * @param {string | null | undefined} imagePath - Caminho do arquivo no bucket (`image_path`) ou URL completa.
 * @returns {string} URL pública válida do Supabase Storage ou string vazia (`''`) quando ausente/inválido.
 */
export function getPublicImageUrl(imagePath) {
  if (typeof imagePath !== 'string') {
    return '';
  }

  const trimmedPath = imagePath.trim();
  if (!trimmedPath) {
    return '';
  }

  // Se for uma URL com esquema ou protocolo relativo, aceita somente se for do host do Supabase Storage
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/i.test(trimmedPath) || trimmedPath.startsWith('//')) {
    return isTrustedSupabaseStorageUrl(trimmedPath) ? trimmedPath : '';
  }

  // Higieniza barras iniciais duplicadas e previne path traversal
  const sanitizedStoragePath = trimmedPath.replace(/^\/+/, '').replace(/\.\.\//g, '');
  if (!sanitizedStoragePath) {
    return '';
  }

  try {
    const { data } = supabase.storage
      .from(STORAGE_CONFIG.BUCKET_NAME)
      .getPublicUrl(sanitizedStoragePath);

    const candidateUrl = data?.publicUrl || '';
    return isTrustedSupabaseStorageUrl(candidateUrl) ? candidateUrl : '';
  } catch (err) {
    console.error('[SupabaseClient][StorageUrlError] Erro ao construir URL pública da imagem:', {
      imagePath,
      error: err,
    });
    return '';
  }
}

/**
 * Resolve com segurança o par `image_url` / `image_path` vindo do banco de dados,
 * garantindo que somente URLs do próprio Supabase Storage sejam renderizadas.
 *
 * @param {string | null | undefined} imageUrl - Campo `image_url` vindo do banco.
 * @param {string | null | undefined} imagePath - Campo `image_path` vindo do banco.
 * @param {string} [fallback=''] - Valor de fallback caso nenhum dos dois seja válido.
 * @returns {string}
 */
export function resolveSafeStorageImageUrl(imageUrl, imagePath, fallback = '') {
  if (isTrustedSupabaseStorageUrl(imageUrl)) {
    return String(imageUrl).trim();
  }

  if (typeof imagePath === 'string' && imagePath.trim()) {
    const fromPath = getPublicImageUrl(imagePath);
    if (fromPath) {
      return fromPath;
    }
  }

  return fallback;
}

/**
 * Mapa de tradução de códigos de erro do PostgreSQL / PostgREST / Supabase Auth / Storage
 * para mensagens seguras em português voltadas ao usuário final.
 * @type {Readonly<Record<string, string>>}
 */
const SAFE_ERROR_MESSAGES_BY_CODE = Object.freeze({
  // Códigos SQLSTATE (PostgreSQL)
  '23505': 'Já existe um registro cadastrado com estes dados (nome ou identificador duplicado).',
  '23503': 'Esta operação não pôde ser concluída porque o item está vinculado a outros registros.',
  '23502': 'Preencha todos os campos obrigatórios antes de salvar.',
  '23514': 'Os valores informados não atendem às regras de validação (verifique preço ou campos obrigatórios).',
  '22P02': 'Formato de dados inválido enviado na requisição.',
  '42501': 'Acesso negado: sua conta não possui permissão de administrador para realizar esta ação.',

  // Códigos PostgREST
  PGRST116: 'O registro solicitado não foi encontrado ou não está mais disponível.',
  PGRST301: 'Sua sessão expirou. Faça login novamente para continuar.',

  // Códigos Supabase Auth
  invalid_credentials: 'E-mail ou senha incorretos. Verifique suas credenciais e tente novamente.',
  email_not_confirmed: 'Seu endereço de e-mail ainda não foi confirmado.',
  user_not_found: 'Usuário não encontrado.',
  over_request_rate_limit: 'Muitas tentativas em sequência. Aguarde alguns instantes antes de tentar novamente.',
  session_not_found: 'Sessão encerrada ou expirada. Faça login novamente.',
});

/**
 * Intercepta erros originados do PostgREST, Supabase Auth, Storage ou falhas de rede,
 * registra o diagnóstico técnico completo no console para depuração e retorna um objeto
 * padronizado contendo apenas mensagens seguras em português para exibição na UI.
 *
 * @param {unknown} error - Objeto de erro bruto retornado pelo SDK do Supabase ou exceção JS.
 * @param {string} [contextMessage='Erro ao processar a solicitação'] - Contexto semântico da operação.
 * @returns {NormalizedSupabaseError} Objeto padronizado `{ success: false, userMessage, code, status }`.
 */
export function normalizeSupabaseError(
  error,
  contextMessage = 'Erro ao processar a solicitação'
) {
  const rawError = error && typeof error === 'object' ? /** @type {Record<string, any>} */ (error) : {};

  const rawCode = String(
    rawError.code || rawError.error_code || rawError.statusCode || rawError.name || 'UNKNOWN_ERROR'
  ).trim();
  const rawMessage = String(
    rawError.message || rawError.error_description || rawError.error || String(error || '')
  ).trim();
  const status =
    typeof rawError.status === 'number'
      ? rawError.status
      : typeof rawError.statusCode === 'number'
        ? Number(rawError.statusCode)
        : null;

  // Log técnico estruturado exclusivo para o console do desenvolvedor
  console.error(`[SupabaseClient][${contextMessage}]`, {
    code: rawCode,
    status,
    message: rawMessage,
    details: rawError.details ?? null,
    hint: rawError.hint ?? null,
    rawError: error,
  });

  // 1. Correspondência direta na tabela de códigos conhecidos
  if (SAFE_ERROR_MESSAGES_BY_CODE[rawCode]) {
    return {
      success: false,
      userMessage: SAFE_ERROR_MESSAGES_BY_CODE[rawCode],
      code: rawCode,
      status,
    };
  }

  const lowerMsg = rawMessage.toLowerCase();

  // 2. Heurísticas seguras para erros de Auth, RLS, Storage e Rede
  if (lowerMsg.includes('invalid login credentials')) {
    return {
      success: false,
      userMessage: SAFE_ERROR_MESSAGES_BY_CODE.invalid_credentials,
      code: 'AUTH_INVALID_CREDENTIALS',
      status: status ?? 400,
    };
  }

  if (
    status === 401 ||
    lowerMsg.includes('jwt expired') ||
    lowerMsg.includes('invalid jwt')
  ) {
    return {
      success: false,
      userMessage: 'Sua sessão expirou. Por favor, faça login novamente.',
      code: 'AUTH_SESSION_EXPIRED',
      status: 401,
    };
  }

  if (
    status === 403 ||
    lowerMsg.includes('row-level security') ||
    lowerMsg.includes('permission denied')
  ) {
    return {
      success: false,
      userMessage:
        'Acesso negado pelas políticas de segurança. Verifique se você está autenticado como administrador.',
      code: 'RLS_FORBIDDEN',
      status: 403,
    };
  }

  if (
    status === 413 ||
    lowerMsg.includes('payload too large') ||
    lowerMsg.includes('exceeded the maximum allowed size')
  ) {
    return {
      success: false,
      userMessage: 'A imagem selecionada excede o tamanho máximo permitido de 2 MB.',
      code: 'STORAGE_FILE_TOO_LARGE',
      status: 413,
    };
  }

  if (lowerMsg.includes('mime type') || lowerMsg.includes('invalid_mime_type')) {
    return {
      success: false,
      userMessage: 'Formato de imagem não suportado. Utilize arquivos WebP, JPEG ou PNG.',
      code: 'STORAGE_INVALID_MIME',
      status: 415,
    };
  }

  if (
    lowerMsg.includes('failed to fetch') ||
    lowerMsg.includes('networkerror') ||
    lowerMsg.includes('load failed')
  ) {
    return {
      success: false,
      userMessage:
        'Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente.',
      code: 'NETWORK_ERROR',
      status: null,
    };
  }

  if (
    rawCode === '42P01' ||
    rawCode === 'PGRST205' ||
    lowerMsg.includes('compound_showcase_cards')
  ) {
    return {
      success: false,
      userMessage:
        'A tabela "compound_showcase_cards" ainda não foi criada no Supabase. Execute a migração "supabase/migrations/20261113230000_compound_showcase_cards.sql" no SQL Editor do Supabase.',
      code: 'TABLE_NOT_FOUND',
      status: 404,
    };
  }

  if (
    lowerMsg.includes('carousel_slides') ||
    lowerMsg.includes('does not exist')
  ) {
    return {
      success: false,
      userMessage:
        'A tabela "carousel_slides" ainda não foi criada no Supabase. Copie e execute o script "supabase_carousel.sql" no SQL Editor do Supabase.',
      code: 'TABLE_NOT_FOUND',
      status: 404,
    };
  }

  if (lowerMsg.includes('is_admin') || lowerMsg.includes('function public.is_admin')) {
    return {
      success: false,
      userMessage:
        'A função "public.is_admin()" precisa ser criada. Execute o script "supabase_carousel.sql" atualizado no SQL Editor do Supabase.',
      code: 'FUNCTION_NOT_FOUND',
      status: 400,
    };
  }

  if (lowerMsg.includes('bucket not found') || lowerMsg.includes('bucket_id')) {
    return {
      success: false,
      userMessage:
        'O bucket "product-images" não foi encontrado no Storage. Execute o script "supabase_carousel.sql" para criá-lo.',
      code: 'BUCKET_NOT_FOUND',
      status: 404,
    };
  }

  // 3. Fallback seguro e informativo
  const fallbackDetail = rawMessage ? `: ${rawMessage}` : '. Tente novamente em alguns instantes.';
  return {
    success: false,
    userMessage: `${contextMessage}${fallbackDetail}`,
    code: rawCode || 'UNEXPECTED_ERROR',
    status,
  };
}

/* ==========================================================================
   7. ALIASES DE RETROCOMPATIBILIDADE (MODULOS CONSUMIDORES)
   ========================================================================== */
export const STORAGE_BUCKET = STORAGE_CONFIG.BUCKET_NAME;
export const getProductImageUrl = getPublicImageUrl;
export const isTrustedStorageUrl = isTrustedSupabaseStorageUrl;


