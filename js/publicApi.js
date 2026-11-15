// @ts-check
/**
 * ============================================================================
 * Botica Natural — Cliente Público REST Ultraleve (`js/publicApi.js`)
 * ============================================================================
 * Substitui o bundle completo `@supabase/supabase-js` (~104 KB) nas páginas
 * públicas (`index.html`, `produtos.html`, `produto.html`, `privacidade.html`)
 * por chamadas diretas via `fetch` contra a REST API PostgREST do Supabase,
 * com `AbortController` de timeout, `select` explícito de colunas e `is_active=eq.true`.
 *
 * O painel administrativo (`admin.html`) continua utilizando `js/supabaseClient.js`.
 * ============================================================================
 */

const runtimeEnv = (typeof window !== 'undefined' && /** @type {any} */ (window).__ENV__) || {};

/**
 * Higieniza a URL base do projeto Supabase.
 * @param {string} rawUrl
 * @returns {string}
 */
export function sanitizeSupabaseProjectUrl(rawUrl) {
  return String(rawUrl || '')
    .trim()
    .replace(/\/+(rest|auth|storage|functions)\/v1\/?$/i, '')
    .replace(/\/+$/, '');
}

/**
 * URL pública base do projeto Supabase.
 * @type {string}
 */
export const SUPABASE_URL = sanitizeSupabaseProjectUrl(
  runtimeEnv.SUPABASE_URL || 'https://njdkuhgoophzjxmmempu.supabase.co'
);

/**
 * Chave pública anônima (`anon` JWT).
 * @type {string}
 */
export const SUPABASE_ANON_KEY = String(
  runtimeEnv.SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qZGt1aGdvb3Boemp4bW1lbXB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwNTUzMTcsImV4cCI6MjEwODYzMTMxN30._OoxbYVB16sKWtH5vyOygPvcMOQtPdOluS15x1pJgq0'
).trim();

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
  MAX_FILE_SIZE_BYTES: 2097152, // 2 MB
  ALLOWED_MIME_TYPES: Object.freeze(['image/webp', 'image/jpeg', 'image/png']),
});

/**
 * Funções RPC expostas no banco para validação Zero-Trust.
 */
export const RPC_FUNCTIONS = Object.freeze({
  IS_ADMIN: 'is_admin',
});

const PLACEHOLDER_PATTERN =
  /^(sua[_-]|seu[_-]|your[_-]|example|placeholder|insira|coloque|todo|<|\[)/i;

/**
 * Verifica se `SUPABASE_URL` e `SUPABASE_ANON_KEY` foram configuradas corretamente.
 * @param {string} [url=SUPABASE_URL]
 * @param {string} [anonKey=SUPABASE_ANON_KEY]
 * @returns {{ isValid: boolean, errors: string[] }}
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
      '[SupabasePublicApi][ConfigError] Credenciais do Supabase ausentes ou inválidas:\n' +
        errors.map((err, idx) => `  ${idx + 1}. ${err}`).join('\n')
    );
  }

  return { isValid, errors };
}

const configValidation = validateClientConfig(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Flag booleana que indica se as credenciais estão prontas para chamadas de rede.
 * @type {boolean}
 */
export const isSupabaseConfigured = configValidation.isValid;

/**
 * Verifica se uma URL pertence estritamente ao host oficial do Supabase Storage deste projeto.
 * @param {string | null | undefined} rawUrl
 * @returns {boolean}
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
 * Constrói a URL pública de uma imagem no bucket `product-images` sem depender do SDK `@supabase/supabase-js`.
 * @param {string | null | undefined} imagePath
 * @returns {string}
 */
export function getPublicImageUrl(imagePath) {
  if (typeof imagePath !== 'string') {
    return '';
  }

  const trimmedPath = imagePath.trim();
  if (!trimmedPath) {
    return '';
  }

  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/i.test(trimmedPath) || trimmedPath.startsWith('//')) {
    return isTrustedSupabaseStorageUrl(trimmedPath) ? trimmedPath : '';
  }

  const sanitizedStoragePath = trimmedPath.replace(/^\/+/, '').replace(/\.\.\//g, '');
  if (!sanitizedStoragePath) {
    return '';
  }

  const encodedSegments = sanitizedStoragePath
    .split('/')
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join('/');

  const candidateUrl = `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_CONFIG.BUCKET_NAME}/${encodedSegments}`;
  return isTrustedSupabaseStorageUrl(candidateUrl) ? candidateUrl : '';
}

/**
 * Resolve com segurança o par `image_url` / `image_path` vindo do banco.
 * @param {string | null | undefined} imageUrl
 * @param {string | null | undefined} imagePath
 * @param {string} [fallback='']
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

const SAFE_ERROR_MESSAGES_BY_CODE = Object.freeze({
  '23505': 'Já existe um registro cadastrado com estes dados (nome ou identificador duplicado).',
  '23503': 'Esta operação não pôde ser concluída porque o item está vinculado a outros registros.',
  '23502': 'Preencha todos os campos obrigatórios antes de salvar.',
  '23514': 'Os valores informados não atendem às regras de validação (verifique preço ou campos obrigatórios).',
  '22P02': 'Formato de dados inválido enviado na requisição.',
  '42501': 'Acesso negado: sua conta não possui permissão de administrador para realizar esta ação.',
  PGRST116: 'O registro solicitado não foi encontrado ou não está mais disponível.',
  PGRST301: 'Sua sessão expirou. Faça login novamente para continuar.',
  invalid_credentials: 'E-mail ou senha incorretos. Verifique suas credenciais e tente novamente.',
  email_not_confirmed: 'Seu endereço de e-mail ainda não foi confirmado.',
  user_not_found: 'Usuário não encontrado.',
  over_request_rate_limit: 'Muitas tentativas em sequência. Aguarde alguns instantes antes de tentar novamente.',
  session_not_found: 'Sessão encerrada ou expirada. Faça login novamente.',
});

/**
 * Normaliza erros do PostgREST, Auth, Storage ou falhas de rede em mensagens seguras em português.
 * @param {unknown} error
 * @param {string} [contextMessage='Erro ao processar a solicitação']
 * @returns {{ success: false, userMessage: string, code: string, status: number | null }}
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

  console.error(`[SupabaseClient][${contextMessage}]`, {
    code: rawCode,
    status,
    message: rawMessage,
    details: rawError.details ?? null,
    hint: rawError.hint ?? null,
    rawError: error,
  });

  if (SAFE_ERROR_MESSAGES_BY_CODE[rawCode]) {
    return {
      success: false,
      userMessage: SAFE_ERROR_MESSAGES_BY_CODE[rawCode],
      code: rawCode,
      status,
    };
  }

  const lowerMsg = rawMessage.toLowerCase();

  if (lowerMsg.includes('invalid login credentials')) {
    return {
      success: false,
      userMessage: SAFE_ERROR_MESSAGES_BY_CODE.invalid_credentials,
      code: 'AUTH_INVALID_CREDENTIALS',
      status: status ?? 400,
    };
  }

  if (status === 401 || lowerMsg.includes('jwt expired') || lowerMsg.includes('invalid jwt')) {
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
    rawCode === 'AbortError' ||
    lowerMsg.includes('aborted') ||
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

  if (lowerMsg.includes('carousel_slides') || lowerMsg.includes('does not exist')) {
    return {
      success: false,
      userMessage:
        'A tabela "carousel_slides" ainda não foi criada no Supabase. Execute as migrações no SQL Editor do Supabase.',
      code: 'TABLE_NOT_FOUND',
      status: 404,
    };
  }

  if (lowerMsg.includes('is_admin') || lowerMsg.includes('function public.is_admin')) {
    return {
      success: false,
      userMessage:
        'A função "public.is_admin()" precisa ser criada. Execute as migrações no SQL Editor do Supabase.',
      code: 'FUNCTION_NOT_FOUND',
      status: 400,
    };
  }

  if (lowerMsg.includes('bucket not found') || lowerMsg.includes('bucket_id')) {
    return {
      success: false,
      userMessage:
        'O bucket "product-images" não foi encontrado no Storage. Execute o schema de referência no SQL Editor do Supabase.',
      code: 'BUCKET_NOT_FOUND',
      status: 404,
    };
  }

  const fallbackDetail = rawMessage ? `: ${rawMessage}` : '. Tente novamente em alguns instantes.';
  return {
    success: false,
    userMessage: `${contextMessage}${fallbackDetail}`,
    code: rawCode || 'UNEXPECTED_ERROR',
    status,
  };
}

export const STORAGE_BUCKET = STORAGE_CONFIG.BUCKET_NAME;
export const getProductImageUrl = getPublicImageUrl;
export const isTrustedStorageUrl = isTrustedSupabaseStorageUrl;

/* ==========================================================================
   CHAMADAS REST DE LEITURA PÚBLICA (FETCH PURO + ABORTCONTROLLER)
   ========================================================================== */

const DEFAULT_PUBLIC_TIMEOUT_MS = 8000;

export const PUBLIC_SELECT_COLUMNS = Object.freeze({
  CAROUSEL:
    'id,title,button_link,image_url,image_path,focus_x,focus_y,display_order,is_active,created_at,updated_at',
  CATEGORIES: 'id,name,slug,display_order,is_active,created_at,updated_at',
  PRODUCTS:
    'id,category_id,name,slug,sku_ref,short_description,payment_info,description,usage_instructions,composition,package_info,allergen_info,quality_note,whatsapp_message,text_options,price,image_url,image_path,is_active,is_best_seller,home_featured,home_position,created_at,updated_at,categories(id,name,slug)',
  COMPOUNDS:
    'id,title,label_subtitle,label_title,label_badge,show_label,button_text,button_link,product_id,open_in_new_tab,show_button,card_theme,badge_color,title_align,botanical_theme,show_capsules,image_url,image_path,botanical_image_url,botanical_image_path,display_order,is_active,created_at,updated_at',
  SETTINGS: 'key,value,updated_at',
});

/**
 * Executa uma consulta GET contra `/rest/v1/<table>` com `AbortController` de timeout.
 * @param {string} table
 * @param {Record<string, string>} queryParams
 * @param {{ timeoutMs?: number, fallbackSelect?: string }} [options]
 * @returns {Promise<{ data: any[] | null, error: any | null }>}
 */
export async function fetchPublicTable(table, queryParams = {}, options = {}) {
  if (!isSupabaseConfigured) {
    return {
      data: null,
      error: { code: 'NOT_CONFIGURED', message: 'Supabase não configurado.' },
    };
  }

  const timeoutMs = options.timeoutMs || DEFAULT_PUBLIC_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const executeRequest = async (/** @type {Record<string, string>} */ paramsObj) => {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(paramsObj)) {
      if (v !== undefined && v !== null && v !== '') {
        search.set(k, String(v));
      }
    }
    const url = `${SUPABASE_URL}/rest/v1/${encodeURIComponent(table)}?${search.toString()}`;
    return fetch(url, {
      method: 'GET',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
  };

  try {
    let response = await executeRequest(queryParams);

    // Se uma coluna recém-migrada ainda não existir no banco remoto (HTTP 400), tenta fallbackSelect
    if (!response.ok && response.status === 400 && options.fallbackSelect) {
      response = await executeRequest({
        ...queryParams,
        select: options.fallbackSelect,
      });
    }

    if (!response.ok) {
      let errPayload = null;
      try {
        errPayload = await response.json();
      } catch {
        errPayload = { message: response.statusText };
      }
      return {
        data: null,
        error: {
          code: errPayload?.code || `HTTP_${response.status}`,
          status: response.status,
          message: errPayload?.message || `HTTP ${response.status}`,
          details: errPayload?.details || null,
          hint: errPayload?.hint || null,
        },
      };
    }

    const json = await response.json();
    return {
      data: Array.isArray(json) ? json : json ? [json] : [],
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error: err,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Busca slides ativos do carrossel principal (`is_active=eq.true`).
 */
export function fetchActiveCarouselSlides() {
  return fetchPublicTable(
    DB_TABLES.CAROUSEL,
    {
      select: PUBLIC_SELECT_COLUMNS.CAROUSEL,
      is_active: 'eq.true',
      order: 'display_order.asc,created_at.desc',
    },
    { fallbackSelect: '*' }
  );
}

/**
 * Busca categorias ativas da vitrine (`is_active=eq.true`).
 */
export function fetchActiveCategories() {
  return fetchPublicTable(
    DB_TABLES.CATEGORIES,
    {
      select: PUBLIC_SELECT_COLUMNS.CATEGORIES,
      is_active: 'eq.true',
      order: 'display_order.asc,name.asc',
    },
    { fallbackSelect: '*' }
  );
}

/**
 * Busca produtos ativos do catálogo (`is_active=eq.true`) com join de categoria.
 */
export function fetchActiveProducts() {
  return fetchPublicTable(
    DB_TABLES.PRODUCTS,
    {
      select: PUBLIC_SELECT_COLUMNS.PRODUCTS,
      is_active: 'eq.true',
      order: 'created_at.desc',
    },
    { fallbackSelect: '*,categories(id,name,slug)' }
  );
}

/**
 * Busca um único produto ativo pelo `id` (`is_active=eq.true`).
 * @param {string} productId
 * @returns {Promise<{ data: any | null, error: any | null }>}
 */
export async function fetchActiveProductById(productId) {
  const { data, error } = await fetchPublicTable(
    DB_TABLES.PRODUCTS,
    {
      select: PUBLIC_SELECT_COLUMNS.PRODUCTS,
      id: `eq.${String(productId || '').trim()}`,
      is_active: 'eq.true',
      limit: '1',
    },
    { fallbackSelect: '*,categories(id,name,slug)' }
  );

  if (error) {
    return { data: null, error };
  }
  return {
    data: Array.isArray(data) && data.length > 0 ? data[0] : null,
    error: null,
  };
}

/**
 * Busca um único produto ativo pelo `slug` (`is_active=eq.true`).
 * @param {string} productSlug
 * @returns {Promise<{ data: any | null, error: any | null }>}
 */
export async function fetchActiveProductBySlug(productSlug) {
  const normalizedSlug = String(productSlug || '').trim().toLowerCase();
  if (!normalizedSlug) {
    return { data: null, error: null };
  }
  const { data, error } = await fetchPublicTable(
    DB_TABLES.PRODUCTS,
    {
      select: PUBLIC_SELECT_COLUMNS.PRODUCTS,
      slug: `eq.${normalizedSlug}`,
      is_active: 'eq.true',
      limit: '1',
    },
    { fallbackSelect: '*,categories(id,name,slug)' }
  );

  if (error) {
    return { data: null, error };
  }
  return {
    data: Array.isArray(data) && data.length > 0 ? data[0] : null,
    error: null,
  };
}

/**
 * Busca cards ativos da vitrine de compostos (`is_active=eq.true`).
 */
export function fetchActiveCompoundCards() {
  return fetchPublicTable(
    DB_TABLES.COMPOUNDS,
    {
      select: PUBLIC_SELECT_COLUMNS.COMPOUNDS,
      is_active: 'eq.true',
      order: 'display_order.asc,created_at.asc',
    },
    { fallbackSelect: '*' }
  );
}

/**
 * Busca uma chave de configuração pública em `site_settings`.
 * @param {string} key
 * @returns {Promise<{ data: { key: string, value: string, updated_at?: string } | null, error: any | null }>}
 */
export async function fetchPublicSiteSetting(key) {
  const { data, error } = await fetchPublicTable(DB_TABLES.SETTINGS, {
    select: PUBLIC_SELECT_COLUMNS.SETTINGS,
    key: `eq.${String(key || '').trim()}`,
    limit: '1',
  });

  if (error) {
    return { data: null, error };
  }
  return {
    data: Array.isArray(data) && data.length > 0 ? data[0] : null,
    error: null,
  };
}
