// @ts-check
/**
 * ============================================================================
 * Botica Natural — Controlador da Página de Detalhes do Produto (`js/product.js`)
 * ============================================================================
 * Arquitetura: ES6+ Module · Zero-Trust UI · Zero XSS (DOM API Segura)
 * Recursos:
 *   - Recuperação reativa do produto ativo pelo UUID (`produto.html?id=...`)
 *   - Renderização compartilhada via `js/shared/productRenderer.js` + `js/shared/richtext.js`
 *   - Modo de Pré-visualização em Tempo Real (`produto.html?preview=1`) via `postMessage`
 *     restrito à mesma origem (`window.location.origin`) e `window.parent`
 * ============================================================================
 */

import {
  isSupabaseConfigured,
  normalizeSupabaseError,
  fetchActiveProductById,
} from './publicApi.js';

import { fetchProductWhatsAppTemplate } from './whatsapp.js';
import { BRAND_NAME, SITE_DOMAIN } from './config.js';
import { extractPlainText } from './shared/richtext.js';
import {
  renderProduct,
  highlightProductField,
  resolveProductImage,
  SAMPLE_PREVIEW_PRODUCT,
} from './shared/productRenderer.js';

const DOM = {
  skeleton: document.getElementById('pdp-skeleton'),
  errorSection: document.getElementById('pdp-error'),
  errorMessage: document.getElementById('pdp-error-message'),
  content: document.getElementById('pdp-content'),
};

/**
 * Exibe o estado de erro caso o produto não seja localizado.
 * @param {string} msg
 */
function showErrorState(msg) {
  if (DOM.skeleton) DOM.skeleton.hidden = true;
  if (DOM.content) DOM.content.hidden = true;
  if (DOM.errorSection) DOM.errorSection.hidden = false;
  if (DOM.errorMessage && msg) DOM.errorMessage.textContent = msg;
  document.title = `Produto não encontrado | ${BRAND_NAME}`;
}

/**
 * Garante `<meta name="robots" content="noindex, nofollow">` quando em modo de pré-visualização.
 */
function ensureNoIndexMeta() {
  let robotsMeta = document.head.querySelector('meta[name="robots"]');
  if (!robotsMeta) {
    robotsMeta = document.createElement('meta');
    robotsMeta.setAttribute('name', 'robots');
    document.head.appendChild(robotsMeta);
  }
  robotsMeta.setAttribute('content', 'noindex, nofollow');
}

/**
 * Atualiza dinamicamente meta tags de SEO, canonical, Open Graph e JSON-LD Product.
 * @param {any} product
 * @param {string} resolvedImg
 * @param {boolean} hasValidPrice
 */
function updateProductSeoAndJsonLd(product, resolvedImg, hasValidPrice) {
  const productName = String(product.name || 'Fórmula Manipulada').trim();
  const rawDesc =
    extractPlainText(product.short_description) ||
    extractPlainText(product.description) ||
    `Fórmula manipulada sob medida na ${BRAND_NAME} com controle de qualidade farmacêutico.`;
  const productDesc = rawDesc.slice(0, 220);

  const canonicalUrl = `${SITE_DOMAIN}/produto.html?id=${encodeURIComponent(String(product.id || ''))}`;
  const ogImageUrl = resolvedImg.startsWith('http')
    ? resolvedImg
    : `${SITE_DOMAIN}/images/og-image.jpg`;

  document.title = `${productName} | ${BRAND_NAME}`;

  const setMetaContent = (
    /** @type {string} */ selector,
    /** @type {string} */ attrName,
    /** @type {string} */ attrVal,
    /** @type {string} */ contentVal
  ) => {
    let el = document.head.querySelector(selector);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attrName, attrVal);
      document.head.appendChild(el);
    }
    el.setAttribute('content', contentVal);
  };

  setMetaContent('meta[name="description"]', 'name', 'description', productDesc);
  setMetaContent('meta[property="og:title"]', 'property', 'og:title', `${productName} | ${BRAND_NAME}`);
  setMetaContent('meta[property="og:description"]', 'property', 'og:description', productDesc);
  setMetaContent('meta[property="og:url"]', 'property', 'og:url', canonicalUrl);
  setMetaContent('meta[property="og:image"]', 'property', 'og:image', ogImageUrl);

  let canonicalLink = document.head.querySelector('link[rel="canonical"]');
  if (!canonicalLink) {
    canonicalLink = document.createElement('link');
    canonicalLink.setAttribute('rel', 'canonical');
    document.head.appendChild(canonicalLink);
  }
  canonicalLink.setAttribute('href', canonicalUrl);

  // JSON-LD Product (omite `offers` quando o preço for "Sob consulta" / <= 0)
  /** @type {Record<string, any>} */
  const jsonLdPayload = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: productName,
    description: productDesc,
    image: ogImageUrl,
    brand: {
      '@type': 'Brand',
      name: BRAND_NAME,
    },
  };

  const sku = String(product.sku_ref || '').trim();
  if (sku) {
    jsonLdPayload.sku = sku;
  }

  if (hasValidPrice) {
    jsonLdPayload.offers = {
      '@type': 'Offer',
      url: canonicalUrl,
      priceCurrency: 'BRL',
      price: Number(product.price).toFixed(2),
      availability: 'https://schema.org/InStock',
    };
  }

  let scriptEl = document.getElementById('product-jsonld');
  if (!scriptEl) {
    scriptEl = document.createElement('script');
    scriptEl.id = 'product-jsonld';
    // @ts-ignore
    scriptEl.type = 'application/ld+json';
    document.head.appendChild(scriptEl);
  }
  scriptEl.textContent = JSON.stringify(jsonLdPayload);
}

/**
 * Inicializa o modo de pré-visualização em tempo real (`produto.html?preview=1`).
 * Não consulta o Supabase e escuta `postMessage` exclusivamente de `window.parent`
 * na mesma origem (`window.location.origin`).
 */
function initLivePreviewMode() {
  ensureNoIndexMeta();
  document.title = `Pré-visualização do Produto | ${BRAND_NAME}`;

  const isSameOriginIframe =
    window.parent !== window &&
    (() => {
      try {
        return window.parent.location.origin === window.location.origin;
      } catch {
        return false;
      }
    })();

  if (!isSameOriginIframe) {
    showErrorState('Pré-visualização disponível apenas no painel administrativo');
    return;
  }

  // Renderiza imediatamente o estado de exemplo apenas dentro do iframe do painel administrativo
  renderProduct(document, SAMPLE_PREVIEW_PRODUCT, { isPreview: true });

  window.addEventListener('message', (event) => {
    // Validação estrita de segurança: mesma origem e proveniente de window.parent
    if (event.origin !== window.location.origin || event.source !== window.parent) {
      return;
    }

    const payload = event.data;
    if (!payload || typeof payload !== 'object') return;

    if (payload.type === 'botica:preview-update' && payload.product) {
      renderProduct(document, payload.product, {
        isPreview: true,
        whatsappTemplate: payload.whatsappTemplate || null,
      });
    } else if (payload.type === 'botica:preview-focus' && typeof payload.field === 'string') {
      highlightProductField(document, payload.field);
    }
  });

  // Notifica o painel administrativo que o iframe de preview está pronto para receber dados
  if (window.parent && window.parent !== window) {
    try {
      window.parent.postMessage({ type: 'botica:preview-ready' }, window.location.origin);
    } catch {
      // Ignora em caso de restrição de contexto
    }
  }
}

/**
 * Inicializa o carregamento normal do produto na vitrine pública.
 */
async function initProductPage() {
  const urlParams = new URLSearchParams(window.location.search);

  // Modo de pré-visualização em tempo real do painel administrativo
  if (urlParams.get('preview') === '1') {
    initLivePreviewMode();
    return;
  }

  const productId = urlParams.get('id')?.trim();

  if (!productId) {
    showErrorState('Nenhum código de produto foi informado no endereço da página.');
    return;
  }

  if (!isSupabaseConfigured) {
    showErrorState('O catálogo está em manutenção temporária. Consulte nosso atendimento via WhatsApp.');
    return;
  }

  try {
    // Busca o produto ativo em paralelo com o template global do WhatsApp
    const [{ data, error }, _waTemplate] = await Promise.all([
      fetchActiveProductById(productId),
      fetchProductWhatsAppTemplate(),
    ]);

    if (error) {
      const normalized = normalizeSupabaseError(error, 'Falha ao consultar detalhes do produto');
      showErrorState(normalized.userMessage);
      return;
    }

    if (!data || data.is_active === false) {
      showErrorState('Este produto não foi encontrado ou não está mais disponível no catálogo ativo.');
      return;
    }

    const resolvedImg = resolveProductImage(data, { isPreview: false });
    const numericPrice = Number(data.price);
    const hasValidPrice = Number.isFinite(numericPrice) && numericPrice > 0;

    updateProductSeoAndJsonLd(data, resolvedImg, hasValidPrice);
    renderProduct(document, data, { isPreview: false });
  } catch (unexpectedErr) {
    normalizeSupabaseError(unexpectedErr, 'Erro inesperado na página de produto');
    showErrorState('Não foi possível carregar os detalhes deste produto no momento.');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initProductPage);
} else {
  initProductPage();
}
