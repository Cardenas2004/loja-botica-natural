/**
 * ============================================================================
 * Botica Natural — Gerador Centralizado de Mensagens do WhatsApp (`js/whatsapp.js`)
 * ============================================================================
 * Single Source of Truth (SSoT) para comunicação comercial via WhatsApp.
 * Compartilhado entre:
 *   - Vitrine e Catálogo Geral (`js/app.js`)
 *   - Página Dedicada de Detalhes do Produto (`js/product.js`)
 *   - Painel Administrativo de Gestão de Catálogo (`js/admin.js`)
 *
 * Recursos:
 *   - Persistência e sincronização de templates dinâmicos no Supabase (`site_settings`)
 *   - Cache resiliente em memória por sessão (Zero chamadas redundantes)
 *   - Fallback de segurança garantido quando o banco estiver offline ou sem configuração
 *   - Interpolação inteligente de variáveis (`{produto}`, `{categoria}`, `{preco}`, `{link}`, `{sku}`)
 *   - Tratamento defensivo de caracteres especiais, quebras de linha e dados ausentes
 * ============================================================================
 */

import {
  isSupabaseConfigured,
  fetchPublicSiteSetting,
} from './publicApi.js';

import {
  BRAND_NAME,
  SITE_DOMAIN,
  WHATSAPP_PHONE as CONFIG_WHATSAPP_PHONE,
} from './config.js';

/* ==========================================================================
   1. CONSTANTES & CONTRATOS IMUTÁVEIS
   ========================================================================== */

/**
 * Número oficial de WhatsApp da Botica Natural (DDI + DDD + Número limpo).
 * @type {string}
 */
export const WHATSAPP_PHONE = CONFIG_WHATSAPP_PHONE;

/**
 * Chave de registro do template na tabela `public.site_settings`.
 * @type {string}
 */
export const SETTING_KEY_PRODUCT_TEMPLATE = 'whatsapp_product_message_template';

/**
 * Modelo padrão de segurança (Fallback Oficial) caso o banco ainda não possua configuração salva.
 * @type {string}
 */
export const DEFAULT_PRODUCT_MESSAGE_TEMPLATE =
  `Olá! Tenho interesse no produto *{produto}* (Categoria: {categoria} | Valor: {preco}). Vi no site da ${BRAND_NAME} ({link}) e gostaria de tirar dúvidas com o farmacêutico e fazer meu pedido!`;

/**
 * Catálogo de variáveis dinâmicas disponíveis para inserção no editor.
 */
export const AVAILABLE_VARIABLES = Object.freeze([
  {
    token: '{produto}',
    aliases: ['{nome}'],
    label: 'Nome do Produto',
    description: 'Nome comercial da fórmula (ex.: Magno 6)',
    example: 'Magno 6',
  },
  {
    token: '{categoria}',
    aliases: [],
    label: 'Categoria',
    description: 'Categoria farmacêutica do item (ex.: Cápsulas)',
    example: 'Cápsulas',
  },
  {
    token: '{preco}',
    aliases: ['{valor}'],
    label: 'Preço (R$)',
    description: 'Valor formatado em moeda nacional (ex.: R$ 50,00)',
    example: 'R$ 50,00',
  },
  {
    token: '{link}',
    aliases: ['{url}'],
    label: 'Link da Página',
    description: 'URL direta para a página do produto',
    example: 'https://www.boticanatural.com.br/produto.html?id=4299',
  },
  {
    token: '{sku}',
    aliases: ['{ref}'],
    label: 'REF / SKU',
    description: 'Código interno de referência (ex.: REF: 4299)',
    example: 'REF: 4299',
  },
]);

/* ==========================================================================
   2. ESTADO EM MEMÓRIA & FORMATADOR DE MOEDA
   ========================================================================== */

const brlCurrencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Cache do template em memória da sessão.
 * @type {string | null}
 */
let cachedTemplate = null;

/**
 * Promise em voo para evitar requisições concorrentes duplicadas.
 * @type {Promise<string> | null}
 */
let pendingFetchPromise = null;

/* ==========================================================================
   3. UTILITÁRIOS PUROS DE FORMATAÇÃO E RESOLUÇÃO DE DADOS
   ========================================================================== */

/**
 * Formata um valor numérico para moeda Real Brasileiro (R$).
 * @param {number | string | null | undefined} value
 * @returns {string}
 */
export function formatPriceBRL(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return 'Sob consulta';
  }
  return brlCurrencyFormatter.format(numericValue);
}

/**
 * Higieniza o número de telefone, mantendo exclusivamente dígitos.
 * @param {string | number | null | undefined} rawNumber
 * @returns {string}
 */
export function sanitizeWhatsAppNumber(rawNumber) {
  const digits = String(rawNumber || '').replace(/\D+/g, '');
  if (!digits) {
    return WHATSAPP_PHONE;
  }
  // Se não possuir DDI do Brasil (55), adiciona por convenção defensiva
  return digits.length <= 11 ? `55${digits}` : digits;
}

/**
 * Extrai o nome da categoria a partir do objeto relacional do produto ou ID.
 * @param {any} product
 * @returns {string}
 */
function resolveCategoryName(product) {
  if (product?.categories && typeof product.categories === 'object') {
    const joined = Array.isArray(product.categories) ? product.categories[0] : product.categories;
    if (joined?.name) {
      return String(joined.name).trim();
    }
  }
  if (product?.category_name) {
    return String(product.category_name).trim();
  }
  return 'Fórmula Manipulada';
}

/**
 * Constrói a URL canônica e absoluta para a página individual do produto.
 * @param {any} product
 * @returns {string}
 */
function resolveProductUrl(product) {
  const productId = String(product?.id || '').trim();
  const origin = SITE_DOMAIN;

  if (!productId) {
    return `${origin}/produtos.html`;
  }

  return `${origin}/produto.html?id=${encodeURIComponent(productId)}`;
}

/**
 * Resolve e normaliza o dicionário de variáveis para o produto fornecido.
 * @param {any} product
 * @returns {Record<string, string>}
 */
export function resolveProductVariables(product) {
  const name = String(product?.name || 'Fórmula Manipulada').trim();
  const category = resolveCategoryName(product);
  const price = formatPriceBRL(product?.price);
  const link = resolveProductUrl(product);
  const rawSku = String(product?.sku_ref || '').trim();
  const sku = rawSku
    ? rawSku.toUpperCase().startsWith('REF')
      ? rawSku
      : `REF: ${rawSku}`
    : '';

  return {
    '{produto}': name,
    '{nome}': name,
    '{categoria}': category,
    '{preco}': price,
    '{valor}': price,
    '{link}': link,
    '{url}': link,
    '{sku}': sku,
    '{ref}': sku,
  };
}

/**
 * Substitui todas as ocorrências de variáveis suportadas no modelo fornecido.
 * Preserva integralmente quebras de linha, emojis e acentuação.
 *
 * @param {string} template - Texto do template com variáveis ({produto}, etc).
 * @param {any} product - Objeto do produto.
 * @returns {string}
 */
export function interpolateTemplate(template, product) {
  if (typeof template !== 'string' || !template.trim()) {
    template = cachedTemplate || DEFAULT_PRODUCT_MESSAGE_TEMPLATE;
  }

  const vars = resolveProductVariables(product);

  // Expressão regular case-insensitive que captura qualquer tag entre chaves
  let output = template.replace(
    /\{(produto|nome|categoria|preco|valor|link|url|sku|ref)\}/gi,
    (match) => {
      const lower = match.toLowerCase();
      if (Object.prototype.hasOwnProperty.call(vars, lower)) {
        return vars[lower];
      }
      return match;
    }
  );

  // Se o SKU estiver vazio, limpa eventuais parênteses ou delimitadores órfãos (ex: " (REF: )" ou " ()")
  output = output.replace(/\s*\(\s*\)/g, '').replace(/\s{2,}/g, ' ');

  return output.trim();
}

/**
 * Alias de compatibilidade com módulos do admin
 */
export const interpolateProductMessage = interpolateTemplate;


/**
 * Constrói a mensagem final interpolada para o produto.
 * Implementa hierarquia de resolução:
 *   1. CustomTemplate passado explicitamente (ex.: digitação em tempo real no preview).
 *   2. Mensagem personalizada exclusiva do produto (`product.whatsapp_message`).
 *   3. Modelo padrão global salvo no Supabase (`site_settings.whatsapp_product_message_template`).
 *   4. Fallback padrão do sistema (`DEFAULT_PRODUCT_MESSAGE_TEMPLATE`).
 *
 * @param {any} product - Objeto do produto.
 * @param {string | null} [customTemplate=null] - Template manual opcional.
 * @returns {string}
 */
export function buildProductWhatsAppMessage(product, customTemplate = null) {
  if (typeof customTemplate === 'string' && customTemplate.trim()) {
    return interpolateTemplate(customTemplate, product);
  }

  const individualMessage = String(product?.whatsapp_message || '').trim();
  if (individualMessage) {
    return interpolateTemplate(individualMessage, product);
  }

  const templateToUse = cachedTemplate || DEFAULT_PRODUCT_MESSAGE_TEMPLATE;
  return interpolateTemplate(templateToUse, product);
}

/**
 * Constrói a URL final do WhatsApp (`https://wa.me/NUMERO?text=MENSAGEM_CODIFICADA`).
 * @param {any} product
 * @param {string | null} [customTemplate=null]
 * @param {string} [phone=WHATSAPP_PHONE]
 * @returns {string}
 */
export function buildProductWhatsAppUrl(
  product,
  customTemplate = null,
  phone = WHATSAPP_PHONE
) {
  const cleanPhone = sanitizeWhatsAppNumber(phone);
  const message = buildProductWhatsAppMessage(product, customTemplate);
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

/* ==========================================================================
   4. GERENCIAMENTO DE CACHE, BUSCA E PERSISTÊNCIA NO SUPABASE
   ========================================================================== */

/**
 * Retorna o template de mensagem ativo em cache ou o fallback de segurança síncrono.
 * @returns {string}
 */
export function getCachedProductWhatsAppTemplate() {
  return cachedTemplate || DEFAULT_PRODUCT_MESSAGE_TEMPLATE;
}

/**
 * Atualiza manualmente o cache em memória (utilizado em testes ou pós-salvamento).
 * @param {string} template
 */
export function setCachedProductWhatsAppTemplate(template) {
  if (typeof template === 'string' && template.trim()) {
    cachedTemplate = template.trim();
  }
}

/**
 * Recupera de forma assíncrona o template configurado no Supabase.
 * Implementa cache em memória, deduping de chamadas concorrentes e fallback resiliente.
 *
 * @param {boolean} [forceRefresh=false] - Se true, ignora o cache em memória e consulta o banco.
 * @returns {Promise<string>}
 */
export async function fetchProductWhatsAppTemplate(forceRefresh = false) {
  if (!forceRefresh && cachedTemplate) {
    return cachedTemplate;
  }

  if (pendingFetchPromise) {
    return pendingFetchPromise;
  }

  pendingFetchPromise = (async () => {
    try {
      if (!isSupabaseConfigured) {
        cachedTemplate = DEFAULT_PRODUCT_MESSAGE_TEMPLATE;
        return cachedTemplate;
      }

      const { data, error } = await fetchPublicSiteSetting(SETTING_KEY_PRODUCT_TEMPLATE);

      if (error) {
        // Log discreto sem interromper a execução da vitrine
        console.warn(
          '[Botica Natural · WhatsApp] Não foi possível carregar template remoto do Supabase. Utilizando fallback oficial.',
          error.message
        );
        cachedTemplate = cachedTemplate || DEFAULT_PRODUCT_MESSAGE_TEMPLATE;
        return cachedTemplate;
      }

      if (data?.value && typeof data.value === 'string' && data.value.trim()) {
        cachedTemplate = data.value.trim();
        return cachedTemplate;
      }

      cachedTemplate = DEFAULT_PRODUCT_MESSAGE_TEMPLATE;
      return cachedTemplate;
    } catch (err) {
      console.warn(
        '[Botica Natural · WhatsApp] Falha inesperada ao consultar configurações. Fallback ativado.',
        err
      );
      cachedTemplate = cachedTemplate || DEFAULT_PRODUCT_MESSAGE_TEMPLATE;
      return cachedTemplate;
    } finally {
      pendingFetchPromise = null;
    }
  })();

  return pendingFetchPromise;
}


