/**
 * ============================================================================
 * Botica Natural — Controlador da Página de Detalhes do Produto (`js/product.js`)
 * ============================================================================
 * Arquitetura: ES6+ Module · Zero-Trust UI · Zero XSS (DOM API Segura)
 * Recursos:
 *   - Recuperação reativa do produto pelo UUID (`produto.html?id=...`)
 *   - Fallback resiliente de imagem e sanitização de dados
 *   - Formatação nativa de moeda em Real Brasileiro (Intl.NumberFormat)
 *   - Integração direta de conversão comercial via WhatsApp
 * ============================================================================
 */

import {
  supabase,
  isSupabaseConfigured,
  DB_TABLES,
  getPublicImageUrl,
  normalizeSupabaseError,
} from './supabaseClient.js';

import {
  buildProductWhatsAppUrl,
  fetchProductWhatsAppTemplate,
} from './whatsapp.js';

/* ==========================================================================
   1. CONSTANTES & UTILITÁRIOS
   ========================================================================== */

const WHATSAPP_PHONE = '555197731564';

const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const FALLBACK_PRODUCT_IMAGE =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='600' height='600' viewBox='0 0 600 600'><rect width='600' height='600' fill='%23F4EEFA'/><g fill='%233D1E6D' opacity='0.45' transform='translate(260, 250)'><path d='M40 0C17.9 0 0 17.9 0 40s17.9 40 40 40 40-17.9 40-40S62.1 0 40 0zm0 70c-16.5 0-30-13.5-30-30s13.5-30 30-30 30 13.5 30 30-13.5 30-30 30z'/><circle cx='40' cy='40' r='14'/></g><text x='50%25' y='65%25' text-anchor='middle' fill='%233D1E6D' font-family='Poppins, sans-serif' font-size='16' font-weight='600' opacity='0.65'>Botica Natural — Fórmula Magistral</text></svg>";

/* ==========================================================================
   2. MAPEAMENTO DE SELETORES DO DOM
   ========================================================================== */

const DOM = {
  // Estados Visuais
  skeleton: document.getElementById('pdp-skeleton'),
  errorSection: document.getElementById('pdp-error'),
  errorMessage: document.getElementById('pdp-error-message'),
  content: document.getElementById('pdp-content'),

  // Breadcrumb
  breadcrumbCat: document.getElementById('pdp-breadcrumb-cat'),
  breadcrumbCurrent: document.getElementById('pdp-breadcrumb-current'),

  // Galeria & Fotos
  thumbBtn: document.getElementById('pdp-thumb-btn'),
  thumbImg: /** @type {HTMLImageElement | null} */ (document.getElementById('pdp-thumb-img')),
  mainImg: /** @type {HTMLImageElement | null} */ (document.getElementById('pdp-main-img')),

  // Painel Comercial
  title: document.getElementById('pdp-title'),
  sku: document.getElementById('pdp-sku'),
  shortDesc: document.getElementById('pdp-short-desc'),
  price: document.getElementById('pdp-price'),
  paymentWrap: document.getElementById('pdp-payment-wrap'),
  paymentText: document.getElementById('pdp-payment-text'),
  btnBuy: /** @type {HTMLAnchorElement | null} */ (document.getElementById('pdp-btn-buy')),

  // Bloco Ficha Técnica (Descrição Estruturada)
  descFull: document.getElementById('pdp-desc-full'),
  descUsageBlock: document.getElementById('pdp-desc-usage-block'),
  descUsageText: document.getElementById('pdp-desc-usage-text'),
  descCompositionBlock: document.getElementById('pdp-desc-composition-block'),
  descCompositionText: document.getElementById('pdp-desc-composition-text'),
  descPackageBlock: document.getElementById('pdp-desc-package-block'),
  descPackageText: document.getElementById('pdp-desc-package-text'),
  descAllergensBlock: document.getElementById('pdp-desc-allergens-block'),
  descAllergensText: document.getElementById('pdp-desc-allergens-text'),
  descQualityBlock: document.getElementById('pdp-desc-quality-block'),
  descQualityText: document.getElementById('pdp-desc-quality-text'),
};

/* ==========================================================================
   3. HELPERS DE RENDERIZAÇÃO E FORMATAÇÃO
   ========================================================================== */

/**
 * Resolve a imagem principal do produto com fallback de segurança.
 * @param {import('./supabaseClient.js').Product} product
 * @returns {string}
 */
function resolveProductImage(product) {
  if (product?.image_url && String(product.image_url).trim()) {
    return String(product.image_url).trim();
  }
  if (product?.image_path && String(product.image_path).trim()) {
    const publicUrl = getPublicImageUrl(product.image_path);
    if (publicUrl) return publicUrl;
  }
  return FALLBACK_PRODUCT_IMAGE;
}

/**
 * Constrói o link de conversão direta para o WhatsApp com os dados do produto.
 * @param {import('./supabaseClient.js').Product} product
 * @param {string} formattedPrice
 * @returns {string}
 */
function buildWhatsAppBuyUrl(product, formattedPrice) {
  const name = product.name || 'Fórmula Manipulada';
  const skuText = product.sku_ref ? ` (${product.sku_ref})` : '';
  const pageUrl = window.location.href;

  const message =
    `Olá! Gostaria de comprar a fórmula *${name}*${skuText} ` +
    `no valor de *${formattedPrice}* que vi no site da Botica Natural (${pageUrl}). ` +
    `Gostaria de tirar dúvidas com o farmacêutico e finalizar meu pedido!`;

  return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`;
}

/**
 * Exibe o estado de erro caso o produto não seja localizado.
 * @param {string} msg
 */
function showErrorState(msg) {
  if (DOM.skeleton) DOM.skeleton.hidden = true;
  if (DOM.content) DOM.content.hidden = true;
  if (DOM.errorSection) DOM.errorSection.hidden = false;
  if (DOM.errorMessage && msg) DOM.errorMessage.textContent = msg;
  document.title = 'Produto não encontrado | Botica Natural';
}

/* ==========================================================================
   4. RENDERIZAÇÃO SEGURA DO PRODUTO (ZERO INNERHTML)
   ========================================================================== */

/**
 * Preenche todos os elementos do DOM com os dados do produto.
 * @param {import('./supabaseClient.js').Product} product
 */
function renderProductDetails(product) {
  const formattedPrice = brlFormatter.format(Number(product.price) || 0);
  const resolvedImg = resolveProductImage(product);

  // 1. Título da Aba e Breadcrumb
  document.title = `${product.name} | Botica Natural`;
  if (DOM.breadcrumbCurrent) DOM.breadcrumbCurrent.textContent = product.name;
  if (DOM.breadcrumbCat) {
    const catName = product.categories?.name || 'Fórmulas Manipuladas';
    DOM.breadcrumbCat.textContent = catName;
  }

  // 2. Galeria & Fotos
  if (DOM.mainImg) {
    DOM.mainImg.src = resolvedImg;
    DOM.mainImg.alt = `${product.name} — Botica Natural`;
    DOM.mainImg.addEventListener(
      'error',
      () => {
        DOM.mainImg.src = FALLBACK_PRODUCT_IMAGE;
      },
      { once: true }
    );
  }

  if (DOM.thumbImg) {
    DOM.thumbImg.src = resolvedImg;
    DOM.thumbImg.alt = `Miniatura de ${product.name}`;
  }

  if (DOM.thumbBtn) {
    DOM.thumbBtn.addEventListener('click', () => {
      DOM.mainImg?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  // 3. Título e REF
  if (DOM.title) DOM.title.textContent = product.name;
  if (DOM.sku) {
    const sku = String(product.sku_ref || '').trim();
    if (sku) {
      DOM.sku.textContent = sku.toUpperCase().startsWith('REF') ? sku : `REF: ${sku}`;
      DOM.sku.hidden = false;
    } else {
      DOM.sku.hidden = true;
    }
  }

  // 4. Resumo Curto de Benefícios (topo)
  if (DOM.shortDesc) {
    const shortText = product.short_description || product.description || '';
    DOM.shortDesc.textContent = shortText;
    DOM.shortDesc.hidden = !shortText;
  }

  // 5. Preço e Meios de Pagamento
  if (DOM.price) DOM.price.textContent = formattedPrice;
  if (DOM.paymentText) {
    const paymentText =
      product.payment_info || 'Consulte formas de pagamento via WhatsApp / Cartão e Pix';
    DOM.paymentText.textContent = paymentText;
  }

  // 6. Botão Comprar (WhatsApp)
  if (DOM.btnBuy) {
    DOM.btnBuy.href = buildProductWhatsAppUrl(product);
    DOM.btnBuy.target = '_blank';
    DOM.btnBuy.rel = 'noopener noreferrer';
    DOM.btnBuy.addEventListener('click', () => {
      DOM.btnBuy.href = buildProductWhatsAppUrl(product);
    });
  }

  // 7. Bloco Ficha Técnica / Descrição do Produto
  if (DOM.descFull) {
    const descText = product.description || '';
    DOM.descFull.textContent = descText;
    DOM.descFull.hidden = !descText;
  }

  if (DOM.descUsageBlock && DOM.descUsageText) {
    const usage = String(product.usage_instructions || '').trim();
    if (usage) {
      DOM.descUsageText.textContent = ` ${usage}`;
      DOM.descUsageBlock.hidden = false;
    } else {
      DOM.descUsageBlock.hidden = true;
    }
  }

  if (DOM.descCompositionBlock && DOM.descCompositionText) {
    const comp = String(product.composition || '').trim();
    if (comp) {
      DOM.descCompositionText.textContent = ` ${comp}`;
      DOM.descCompositionBlock.hidden = false;
    } else {
      DOM.descCompositionBlock.hidden = true;
    }
  }

  if (DOM.descPackageBlock && DOM.descPackageText) {
    const pkg = String(product.package_info || '').trim();
    if (pkg) {
      DOM.descPackageText.textContent = pkg;
      DOM.descPackageBlock.hidden = false;
    } else {
      DOM.descPackageBlock.hidden = true;
    }
  }

  if (DOM.descAllergensBlock && DOM.descAllergensText) {
    const allergens = String(product.allergen_info || '').trim();
    if (allergens) {
      DOM.descAllergensText.textContent = allergens;
      DOM.descAllergensBlock.hidden = false;
    } else {
      DOM.descAllergensBlock.hidden = true;
    }
  }

  if (DOM.descQualityBlock && DOM.descQualityText) {
    const quality =
      product.quality_note ||
      'Todos os produtos da Botica Natural são preparados com matérias-primas selecionadas e rigoroso controle de qualidade farmacêutico, garantindo melhor eficácia.';
    DOM.descQualityText.textContent = quality;
    DOM.descQualityBlock.hidden = false;
  }

  // Transiciona o estado de carregamento
  if (DOM.skeleton) DOM.skeleton.hidden = true;
  if (DOM.content) DOM.content.hidden = false;
}

/* ==========================================================================
   5. INICIALIZAÇÃO E CARREGAMENTO DO PRODUTO (SUPABASE)
   ========================================================================== */

async function initProductPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('id')?.trim();

  if (!productId) {
    showErrorState('Nenhum identificador de produto foi informado na URL.');
    return;
  }

  const configured =
    typeof isSupabaseConfigured === 'function'
      ? isSupabaseConfigured()
      : Boolean(isSupabaseConfigured);

  if (!configured || !supabase) {
    showErrorState(
      'Configuração do Supabase pendente. Configure as chaves de acesso para carregar os produtos em tempo real.'
    );
    return;
  }

  try {
    const [{ data: product, error }] = await Promise.all([
      supabase
        .from(DB_TABLES.PRODUCTS)
        .select('*, categories(id, name, slug)')
        .eq('id', productId)
        .single(),
      fetchProductWhatsAppTemplate(),
    ]);

    if (error || !product) {
      normalizeSupabaseError(error, 'Produto não encontrado');
      showErrorState(
        'A fórmula solicitada não foi encontrada ou foi desativada temporariamente da vitrine.'
      );
      return;
    }

    renderProductDetails(product);
  } catch (err) {
    normalizeSupabaseError(err, 'Erro ao carregar produto');
    showErrorState('Ocorreu um erro ao conectar ao servidor. Tente novamente em instantes.');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initProductPage);
} else {
  initProductPage();
}
