// @ts-check
/**
 * Renderizador compartilhado da página de produto (Botica Natural).
 * Utilizado tanto na vitrine pública (`js/product.js`) quanto no Live Preview
 * em tempo real do painel administrativo (`produto.html?preview=1`).
 */

import { getProductImageUrl, isTrustedStorageUrl } from '../supabaseClient.js';
import { buildProductWhatsAppUrl } from '../whatsapp.js';
import {
  DEFAULT_FIELD_MODES,
  normalizeTextMode,
  renderSanitizedRichText,
  extractPlainText,
} from './richtext.js';

export const FALLBACK_PRODUCT_IMAGE =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='600' height='600' viewBox='0 0 600 600'><rect width='600' height='600' fill='%23F4EEFA'/><g fill='none' stroke='%235B2D9E' stroke-width='10' stroke-linecap='round' stroke-linejoin='round' opacity='0.45'><rect x='220' y='150' width='160' height='300' rx='26'/><path d='M255 150v-32h90v32'/><line x1='260' y1='260' x2='340' y2='260'/><line x1='300' y1='220' x2='300' y2='300'/></g><text x='50%25' y='515' text-anchor='middle' font-family='Inter, sans-serif' font-size='22' font-weight='600' fill='%235B2D9E' opacity='0.65'>Botica Natural</text></svg>";

/** Produto fictício padrão para o modo de pré-visualização quando o formulário está em branco */
export const SAMPLE_PREVIEW_PRODUCT = Object.freeze({
  id: 'preview-exemplo',
  name: 'Exemplo — Fórmula Manipulada Personalizada',
  sku_ref: 'REF: EXEMPLO-01',
  category_name: 'Exemplo de Categoria',
  categories: { name: 'Exemplo de Categoria' },
  price: 0,
  short_description:
    '<p><strong>Exemplo de resumo curto:</strong> descreva aqui os principais benefícios da fórmula manipulada.</p>',
  payment_info: 'Consulte formas de pagamento via WhatsApp / Cartão e Pix',
  description:
    '<p><strong>Exemplo de descrição detalhada:</strong> utilize o editor ao lado para formatar parágrafos, listas e destaques com segurança.</p><ul><li>Matérias-primas com laudo de pureza</li><li>Manipulação individualizada sob supervisão farmacêutica</li></ul>',
  usage_instructions: '<p>Exemplo: Tomar 1 dose conforme orientação de profissional habilitado.</p>',
  composition: '<p>Exemplo: Ativo A 250mg, Ativo B 100mg — Excipiente q.s.p. 1 cápsula.</p>',
  package_info: 'Exemplo: Pote lacrado com 60 cápsulas.',
  allergen_info: 'Não contém lactose e glúten.',
  quality_note:
    'Todos os produtos da Botica Natural são preparados com matérias-primas selecionadas e rigoroso controle de qualidade farmacêutico, garantindo melhor eficácia.',
  whatsapp_message: '',
  text_options: { ...DEFAULT_FIELD_MODES },
  image_url: '',
  image_path: '',
  is_active: true,
  is_best_seller: false,
});

const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

/**
 * Resolve a URL segura da imagem principal do produto.
 * No modo preview (`isPreview: true`), aceita também `blob:` gerado por `URL.createObjectURL`.
 *
 * @param {any} product
 * @param {{ isPreview?: boolean }} [options]
 * @returns {string}
 */
export function resolveProductImage(product, options = {}) {
  if (!product) return FALLBACK_PRODUCT_IMAGE;

  const isPreview = Boolean(options.isPreview);

  if (isPreview && typeof product.preview_blob_url === 'string' && product.preview_blob_url.startsWith('blob:')) {
    return product.preview_blob_url;
  }

  if (typeof product.image_url === 'string') {
    const trimmed = product.image_url.trim();
    if (isPreview && trimmed.startsWith('blob:')) {
      return trimmed;
    }
    if (isTrustedStorageUrl(trimmed)) {
      return trimmed;
    }
  }

  if (typeof product.image_path === 'string' && product.image_path.trim() !== '') {
    const publicUrl = getProductImageUrl(product.image_path.trim());
    if (isTrustedStorageUrl(publicUrl)) return publicUrl;
  }

  return FALLBACK_PRODUCT_IMAGE;
}

/**
 * Obtém o modo de texto configurado para um campo específico do produto.
 * @param {any} product
 * @param {keyof typeof DEFAULT_FIELD_MODES} fieldName
 * @returns {'paragraphs' | 'lines' | 'inline'}
 */
export function getFieldTextMode(product, fieldName) {
  const rawOptions =
    product && typeof product.text_options === 'object' && product.text_options !== null
      ? product.text_options
      : {};
  const fallback = DEFAULT_FIELD_MODES[fieldName] || 'paragraphs';
  return normalizeTextMode(rawOptions[fieldName], fallback);
}

/**
 * Renderiza os dados de um produto no documento ou container da página de produto.
 *
 * @param {Document | HTMLElement} root
 * @param {any} rawProductData
 * @param {{ isPreview?: boolean, whatsappTemplate?: string | null }} [options]
 */
export function renderProduct(root, rawProductData, options = {}) {
  const doc = root instanceof Document ? root : root.ownerDocument || document;
  const isPreview = Boolean(options.isPreview);
  const product = rawProductData || SAMPLE_PREVIEW_PRODUCT;

  const byId = (/** @type {string} */ id) => doc.getElementById(id);

  const skeleton = byId('pdp-skeleton');
  const errorBox = byId('pdp-error');
  const content = byId('pdp-content');
  const breadcrumbCurrent = byId('pdp-breadcrumb-current');
  const breadcrumbCat = byId('pdp-breadcrumb-cat');
  const mainImg = /** @type {HTMLImageElement | null} */ (byId('pdp-main-img'));
  const thumbImg = /** @type {HTMLImageElement | null} */ (byId('pdp-thumb-img'));
  const thumbBtn = byId('pdp-thumb-btn');
  const titleEl = byId('pdp-title');
  const skuEl = byId('pdp-sku');
  const shortDescEl = byId('pdp-short-desc');
  const priceEl = byId('pdp-price');
  const paymentTextEl = byId('pdp-payment-text');
  const btnBuy = /** @type {HTMLAnchorElement | null} */ (byId('pdp-btn-buy'));
  const descFullEl = byId('pdp-desc-full');
  const descUsageBlock = byId('pdp-desc-usage-block');
  const descUsageText = byId('pdp-desc-usage-text');
  const descCompositionBlock = byId('pdp-desc-composition-block');
  const descCompositionText = byId('pdp-desc-composition-text');
  const descPackageBlock = byId('pdp-desc-package-block');
  const descPackageText = byId('pdp-desc-package-text');
  const descAllergensBlock = byId('pdp-desc-allergens-block');
  const descAllergensText = byId('pdp-desc-allergens-text');
  const descQualityBlock = byId('pdp-desc-quality-block');
  const descQualityText = byId('pdp-desc-quality-text');

  const productName = String(product.name || '').trim() || (isPreview ? 'Exemplo — Nome do Produto' : 'Produto');
  const numericPrice = Number(product.price);
  const hasValidPrice = Number.isFinite(numericPrice) && numericPrice > 0;
  // REVISAR COM RT: RDC 67/2007 e normas de publicidade da Anvisa (exibição de preço vs. "Sob consulta")
  const formattedPrice = hasValidPrice ? brlFormatter.format(numericPrice) : 'Sob consulta';
  const resolvedImg = resolveProductImage(product, { isPreview });

  // 1. Breadcrumb
  if (breadcrumbCurrent) breadcrumbCurrent.textContent = productName;
  if (breadcrumbCat) {
    const catName =
      product.categories?.name ||
      product.category_name ||
      (isPreview ? 'Exemplo de Categoria' : 'Fórmulas Manipuladas');
    breadcrumbCat.textContent = catName;
  }

  // 2. Galeria e Imagem Principal
  if (mainImg) {
    if (mainImg.src !== resolvedImg) {
      mainImg.src = resolvedImg;
    }
    mainImg.alt = `${productName} — Botica Natural`;
    mainImg.onerror = () => {
      mainImg.src = FALLBACK_PRODUCT_IMAGE;
    };
  }

  if (thumbImg) {
    if (thumbImg.src !== resolvedImg) {
      thumbImg.src = resolvedImg;
    }
    thumbImg.alt = `Miniatura de ${productName}`;
  }

  if (thumbBtn && !thumbBtn.dataset.boundScroll) {
    thumbBtn.dataset.boundScroll = '1';
    thumbBtn.addEventListener('click', () => {
      mainImg?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  // 3. Título e SKU
  if (titleEl) {
    titleEl.textContent = productName;
  }

  if (skuEl) {
    const sku = String(product.sku_ref || '').trim();
    if (sku) {
      skuEl.textContent = sku.toUpperCase().startsWith('REF') ? sku : `REF: ${sku}`;
      skuEl.hidden = false;
    } else {
      skuEl.hidden = true;
    }
  }

  // 4. Resumo Curto (Rich Text sanitizado)
  if (shortDescEl) {
    const shortRaw = String(product.short_description || '').trim() || String(product.description || '').trim();
    if (shortRaw) {
      shortDescEl.classList.add('pd-richtext');
      renderSanitizedRichText(shortDescEl, shortRaw, {
        mode: getFieldTextMode(product, 'short_description'),
      });
      shortDescEl.hidden = false;
    } else {
      shortDescEl.replaceChildren();
      shortDescEl.hidden = true;
    }
  }

  // 5. Preço e Condições de Pagamento
  if (priceEl) {
    priceEl.textContent = formattedPrice;
  }

  if (paymentTextEl) {
    const paymentRaw =
      String(product.payment_info || '').trim() ||
      'Consulte formas de pagamento via WhatsApp / Cartão e Pix';
    renderSanitizedRichText(paymentTextEl, paymentRaw, {
      mode: getFieldTextMode(product, 'payment_info'),
    });
  }

  // 6. Botão Comprar via WhatsApp
  if (btnBuy) {
    const waUrl = buildProductWhatsAppUrl(product, options.whatsappTemplate || undefined);
    btnBuy.href = waUrl;
    btnBuy.target = '_blank';
    btnBuy.rel = 'noopener noreferrer';

    const mobileBtnBuy = /** @type {HTMLAnchorElement | null} */ (byId('pdp-mobile-buy-btn'));
    if (mobileBtnBuy) {
      mobileBtnBuy.href = waUrl;
      mobileBtnBuy.target = '_blank';
      mobileBtnBuy.rel = 'noopener noreferrer';
    }
  }

  // 7. Ficha Técnica / Descrição Completa (Rich Text sanitizado)
  if (descFullEl) {
    const descRaw = String(product.description || '').trim();
    if (descRaw) {
      descFullEl.classList.add('pd-richtext');
      renderSanitizedRichText(descFullEl, descRaw, {
        mode: getFieldTextMode(product, 'description'),
      });
      descFullEl.hidden = false;
    } else {
      descFullEl.replaceChildren();
      descFullEl.hidden = true;
    }
  }

  // 8. Modo de Usar
  if (descUsageBlock && descUsageText) {
    const usageRaw = String(product.usage_instructions || '').trim();
    if (usageRaw) {
      descUsageText.classList.add('pd-richtext');
      renderSanitizedRichText(descUsageText, usageRaw, {
        mode: getFieldTextMode(product, 'usage_instructions'),
      });
      descUsageBlock.hidden = false;
    } else {
      descUsageText.replaceChildren();
      descUsageBlock.hidden = true;
    }
  }

  // 9. Composição
  if (descCompositionBlock && descCompositionText) {
    const compRaw = String(product.composition || '').trim();
    if (compRaw) {
      descCompositionText.classList.add('pd-richtext');
      renderSanitizedRichText(descCompositionText, compRaw, {
        mode: getFieldTextMode(product, 'composition'),
      });
      descCompositionBlock.hidden = false;
    } else {
      descCompositionText.replaceChildren();
      descCompositionBlock.hidden = true;
    }
  }

  // 10. Informações da Embalagem
  if (descPackageBlock && descPackageText) {
    const pkgRaw = String(product.package_info || '').trim();
    if (pkgRaw) {
      descPackageText.classList.add('pd-richtext');
      renderSanitizedRichText(descPackageText, pkgRaw, {
        mode: getFieldTextMode(product, 'package_info'),
      });
      descPackageBlock.hidden = false;
    } else {
      descPackageText.replaceChildren();
      descPackageBlock.hidden = true;
    }
  }

  // 11. Informações sobre Alérgenos
  if (descAllergensBlock && descAllergensText) {
    const allergensRaw = String(product.allergen_info || '').trim();
    if (allergensRaw) {
      descAllergensText.classList.add('pd-richtext');
      renderSanitizedRichText(descAllergensText, allergensRaw, {
        mode: getFieldTextMode(product, 'allergen_info'),
      });
      descAllergensBlock.hidden = false;
    } else {
      descAllergensText.replaceChildren();
      descAllergensBlock.hidden = true;
    }
  }

  // 12. Nota de Qualidade Farmacêutica
  if (descQualityBlock && descQualityText) {
    const qualityRaw =
      String(product.quality_note || '').trim() ||
      'Todos os produtos da Botica Natural são preparados com matérias-primas selecionadas e rigoroso controle de qualidade farmacêutico, garantindo melhor eficácia.';
    descQualityText.classList.add('pd-richtext');
    renderSanitizedRichText(descQualityText, qualityRaw, {
      mode: getFieldTextMode(product, 'quality_note'),
    });
    descQualityBlock.hidden = false;
  }

  // Exibe conteúdo principal e oculta skeleton/erro
  if (skeleton) skeleton.hidden = true;
  if (errorBox) errorBox.hidden = true;
  if (content) content.hidden = false;

  return {
    productName,
    plainShortDesc: extractPlainText(product.short_description || product.description || ''),
    resolvedImg,
    hasValidPrice,
  };
}

/** @type { ReturnType<typeof setTimeout> | null } */
let activeHighlightTimer = null;

/**
 * Faz scroll suave até o elemento marcado com `[data-field="<fieldName>"]` e aplica
 * um contorno sutil temporário no modo de pré-visualização.
 *
 * @param {Document | HTMLElement} root
 * @param {string} fieldName
 */
export function highlightProductField(root, fieldName) {
  if (!fieldName) return;
  const doc = root instanceof Document ? root : root.ownerDocument || document;
  const target = doc.querySelector(`[data-field="${CSS.escape(fieldName)}"]`);
  if (!target || !(target instanceof HTMLElement) || target.hidden) return;

  doc.querySelectorAll('.pd-preview-highlight').forEach((el) => {
    el.classList.remove('pd-preview-highlight');
  });

  target.classList.add('pd-preview-highlight');
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });

  if (activeHighlightTimer) clearTimeout(activeHighlightTimer);
  activeHighlightTimer = setTimeout(() => {
    target.classList.remove('pd-preview-highlight');
  }, 1800);
}
