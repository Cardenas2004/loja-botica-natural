/**
 * ============================================================================
 * Botica Natural — Painel Administrativo Controller (`js/admin.js`)
 * ============================================================================
 * Arquitetura: ES6+ Module · Single State Store · Zero XSS (DOM API)
 * Recursos:
 *   - Guardião de Rota Zero-Trust (Supabase Auth + RPC `public.is_admin()`)
 *   - CRUD Completo de Categorias e Produtos sincronizado com PostgreSQL
 *   - Pipeline Sênior de Imagem: Preview c/ Revogação de Memória + Conversão
 *     Automática para WebP via Canvas + Remoção de Arquivos Órfãos no Storage
 *   - Filtros Reativos em Memória com Debounce (Zero chamadas extras de rede)
 *   - UX Nativa: Modal `<dialog>` Promisificado + Sistema de Toasts Acessível
 * ============================================================================
 */

import {
  supabase,
  DB_TABLES,
  STORAGE_CONFIG,
  RPC_FUNCTIONS,
  isSupabaseConfigured,
  getCurrentSession,
  getPublicImageUrl,
  normalizeSupabaseError,
} from './supabaseClient.js';

import {
  fetchProductWhatsAppTemplate,
  saveProductWhatsAppTemplate,
  saveIndividualProductWhatsAppMessage,
  DEFAULT_PRODUCT_MESSAGE_TEMPLATE,
  interpolateTemplate,
  AVAILABLE_VARIABLES,
} from './whatsapp.js';

/* ==========================================================================
   1. ESTADO REATIVO EM MEMÓRIA (SINGLE STATE STORE)
   ========================================================================== */

/**
 * @typedef {Object} AdminState
 * @property {import('./supabaseClient.js').Category[]} categories
 * @property {import('./supabaseClient.js').Product[]} products
 * @property {import('./supabaseClient.js').CarouselSlide[]} carouselSlides
 * @property {{ search: string, categoryId: string, status: string }} filters
 * @property {string | null} activePreviewObjectUrl
 * @property {string | null} activeSlidePreviewObjectUrl
 * @property {boolean} isLoadingData
 */

/** @type {AdminState} */
const state = {
  categories: [],
  products: [],
  carouselSlides: [],
  filters: {
    search: '',
    categoryId: 'all',
    status: 'all',
  },
  activePreviewObjectUrl: null,
  activeSlidePreviewObjectUrl: null,
  isLoadingData: false,
  whatsappTemplate: DEFAULT_PRODUCT_MESSAGE_TEMPLATE,
  whatsappScope: '__global__',
  selectedSampleIndex: 0,
};

/* ==========================================================================
   2. MAPEAMENTO DE SELETORES DO DOM (CACHE DE REFERÊNCIAS)
   ========================================================================== */

const DOM = Object.freeze({
  // Views Principais
  loginView: /** @type {HTMLElement | null} */ (document.getElementById('login-view')),
  dashboardView: /** @type {HTMLElement | null} */ (document.getElementById('dashboard-view')),

  // Autenticação
  loginForm: /** @type {HTMLFormElement | null} */ (document.getElementById('login-form')),
  emailInput: /** @type {HTMLInputElement | null} */ (document.getElementById('email')),
  passwordInput: /** @type {HTMLInputElement | null} */ (document.getElementById('password')),
  btnLogin: /** @type {HTMLButtonElement | null} */ (document.getElementById('btn-login')),
  loginFeedback: /** @type {HTMLElement | null} */ (document.getElementById('login-feedback')),

  // Header do Dashboard
  adminUserEmail: /** @type {HTMLElement | null} */ (document.getElementById('admin-user-email')),
  btnLogout: /** @type {HTMLButtonElement | null} */ (document.getElementById('btn-logout')),

  // KPIs
  kpiTotalProducts: /** @type {HTMLElement | null} */ (document.getElementById('kpi-total-products')),
  kpiActiveProducts: /** @type {HTMLElement | null} */ (document.getElementById('kpi-active-products')),
  kpiBestsellers: /** @type {HTMLElement | null} */ (document.getElementById('kpi-bestsellers')),
  kpiCategories: /** @type {HTMLElement | null} */ (document.getElementById('kpi-categories')),

  // Módulo 0: Gerenciador de Banners do Carrossel Principal
  panelCarouselTitle: /** @type {HTMLElement | null} */ (document.getElementById('panel-carousel-title')),
  carouselCountBadge: /** @type {HTMLElement | null} */ (document.getElementById('carousel-count-badge')),
  carouselForm: /** @type {HTMLFormElement | null} */ (document.getElementById('carousel-form')),
  slideId: /** @type {HTMLInputElement | null} */ (document.getElementById('slide-id')),
  slideOldImagePath: /** @type {HTMLInputElement | null} */ (document.getElementById('slide-old-image-path')),
  slideImage: /** @type {HTMLInputElement | null} */ (document.getElementById('slide-image')),
  slideImageRequiredMark: /** @type {HTMLElement | null} */ (document.getElementById('slide-image-required-mark')),
  slidePreviewContainer: /** @type {HTMLElement | null} */ (document.getElementById('slide-preview-container')),
  slidePreview: /** @type {HTMLImageElement | null} */ (document.getElementById('slide-preview')),
  slideTitle: /** @type {HTMLInputElement | null} */ (document.getElementById('slide-title')),
  slideLink: /** @type {HTMLInputElement | null} */ (document.getElementById('slide-link')),
  slideOrder: /** @type {HTMLInputElement | null} */ (document.getElementById('slide-order')),
  slideActive: /** @type {HTMLInputElement | null} */ (document.getElementById('slide-active')),
  btnSaveSlide: /** @type {HTMLButtonElement | null} */ (document.getElementById('btn-save-slide')),
  btnCancelSlide: /** @type {HTMLButtonElement | null} */ (document.getElementById('btn-cancel-slide')),
  carouselAdminGrid: /** @type {HTMLElement | null} */ (document.getElementById('carousel-admin-grid')),
  carouselEmptyState: /** @type {HTMLElement | null} */ (document.getElementById('carousel-empty-state')),

  // Módulo 1: Categorias
  panelCategoriesTitle: /** @type {HTMLElement | null} */ (document.getElementById('panel-categories-title')),
  categoryForm: /** @type {HTMLFormElement | null} */ (document.getElementById('category-form')),
  catId: /** @type {HTMLInputElement | null} */ (document.getElementById('cat-id')),
  catName: /** @type {HTMLInputElement | null} */ (document.getElementById('cat-name')),
  catSlug: /** @type {HTMLInputElement | null} */ (document.getElementById('cat-slug')),
  catOrder: /** @type {HTMLInputElement | null} */ (document.getElementById('cat-order')),
  catActive: /** @type {HTMLInputElement | null} */ (document.getElementById('cat-active')),
  btnSaveCat: /** @type {HTMLButtonElement | null} */ (document.getElementById('btn-save-cat')),
  btnCancelCat: /** @type {HTMLButtonElement | null} */ (document.getElementById('btn-cancel-cat')),
  categoriesList: /** @type {HTMLUListElement | null} */ (document.getElementById('categories-list')),

  // Módulo 2: Produtos
  panelProductsTitle: /** @type {HTMLElement | null} */ (document.getElementById('panel-products-title')),
  productForm: /** @type {HTMLFormElement | null} */ (document.getElementById('product-form')),
  prodId: /** @type {HTMLInputElement | null} */ (document.getElementById('prod-id')),
  prodOldImagePath: /** @type {HTMLInputElement | null} */ (document.getElementById('prod-old-image-path')),
  prodName: /** @type {HTMLInputElement | null} */ (document.getElementById('prod-name')),
  prodSku: /** @type {HTMLInputElement | null} */ (document.getElementById('prod-sku')),
  prodCategory: /** @type {HTMLSelectElement | null} */ (document.getElementById('prod-category')),
  prodPrice: /** @type {HTMLInputElement | null} */ (document.getElementById('prod-price')),
  prodShortDesc: /** @type {HTMLTextAreaElement | null} */ (document.getElementById('prod-short-desc')),
  prodPaymentInfo: /** @type {HTMLInputElement | null} */ (document.getElementById('prod-payment-info')),
  prodDesc: /** @type {HTMLTextAreaElement | null} */ (document.getElementById('prod-desc')),
  prodUsage: /** @type {HTMLTextAreaElement | null} */ (document.getElementById('prod-usage')),
  prodComposition: /** @type {HTMLTextAreaElement | null} */ (document.getElementById('prod-composition')),
  prodPackage: /** @type {HTMLInputElement | null} */ (document.getElementById('prod-package')),
  prodAllergens: /** @type {HTMLInputElement | null} */ (document.getElementById('prod-allergens')),
  prodQualityNote: /** @type {HTMLInputElement | null} */ (document.getElementById('prod-quality-note')),
  prodWhatsappMessage: /** @type {HTMLTextAreaElement | null} */ (document.getElementById('prod-whatsapp-message')),
  prodActive: /** @type {HTMLInputElement | null} */ (document.getElementById('prod-active')),
  prodBestseller: /** @type {HTMLInputElement | null} */ (document.getElementById('prod-bestseller')),
  prodImage: /** @type {HTMLInputElement | null} */ (document.getElementById('prod-image')),
  imagePreviewContainer: /** @type {HTMLElement | null} */ (document.getElementById('image-preview-container')),
  imagePreview: /** @type {HTMLImageElement | null} */ (document.getElementById('image-preview')),
  btnSaveProd: /** @type {HTMLButtonElement | null} */ (document.getElementById('btn-save-prod')),
  btnCancelProd: /** @type {HTMLButtonElement | null} */ (document.getElementById('btn-cancel-prod')),

  // Módulo 3: Busca, Filtros e Tabela de Catálogo
  searchProducts: /** @type {HTMLInputElement | null} */ (document.getElementById('search-products')),
  filterCategory: /** @type {HTMLSelectElement | null} */ (document.getElementById('filter-category')),
  filterStatus: /** @type {HTMLSelectElement | null} */ (document.getElementById('filter-status')),
  productsTable: /** @type {HTMLTableElement | null} */ (document.getElementById('products-table')),
  productsTbody: /** @type {HTMLTableSectionElement | null} */ (document.getElementById('products-tbody')),
  productsEmptyState: /** @type {HTMLElement | null} */ (document.getElementById('products-empty-state')),

  // Modal de Confirmação & Toasts
  confirmModal: /** @type {HTMLDialogElement | null} */ (document.getElementById('confirm-modal')),
  modalTitle: /** @type {HTMLElement | null} */ (document.getElementById('modal-title')),
  modalMessage: /** @type {HTMLElement | null} */ (document.getElementById('modal-message')),
  modalBtnCancel: /** @type {HTMLButtonElement | null} */ (document.getElementById('modal-btn-cancel')),
  modalBtnConfirm: /** @type {HTMLButtonElement | null} */ (document.getElementById('modal-btn-confirm')),
  toastContainer: /** @type {HTMLElement | null} */ (document.getElementById('toast-container')),

  // Módulo 2.5: Mensagens do WhatsApp
  panelWhatsappTitle: /** @type {HTMLElement | null} */ (document.getElementById('panel-whatsapp-title')),
  whatsappScopeSelect: /** @type {HTMLSelectElement | null} */ (document.getElementById('whatsapp-scope-select')),
  whatsappProductsOptgroup: /** @type {HTMLOptGroupElement | null} */ (document.getElementById('whatsapp-products-optgroup')),
  whatsappScopeStatus: /** @type {HTMLElement | null} */ (document.getElementById('whatsapp-scope-status')),
  whatsappForm: /** @type {HTMLFormElement | null} */ (document.getElementById('whatsapp-settings-form')),
  whatsappTemplateText: /** @type {HTMLTextAreaElement | null} */ (document.getElementById('whatsapp-template-text')),
  whatsappCharCounter: /** @type {HTMLElement | null} */ (document.getElementById('whatsapp-char-counter')),
  whatsappValidationHint: /** @type {HTMLElement | null} */ (document.getElementById('whatsapp-validation-hint')),
  whatsappSyncBadge: /** @type {HTMLElement | null} */ (document.getElementById('whatsapp-sync-badge')),
  btnSaveWhatsApp: /** @type {HTMLButtonElement | null} */ (document.getElementById('btn-save-whatsapp-template')),
  btnSaveWhatsAppLabel: /** @type {HTMLElement | null} */ (document.getElementById('btn-save-whatsapp-label')),
  btnRestoreWhatsApp: /** @type {HTMLButtonElement | null} */ (document.getElementById('btn-restore-whatsapp-template')),
  btnRestoreWhatsAppLabel: /** @type {HTMLElement | null} */ (document.getElementById('btn-restore-whatsapp-label')),
  btnCyclePreviewProd: /** @type {HTMLButtonElement | null} */ (document.getElementById('btn-cycle-preview-prod')),
  waPreviewSampleBadge: /** @type {HTMLElement | null} */ (document.getElementById('wa-preview-sample-badge')),
  waPreviewBubbleText: /** @type {HTMLElement | null} */ (document.getElementById('wa-preview-bubble-text')),
  waPreviewBubbleTime: /** @type {HTMLElement | null} */ (document.getElementById('wa-preview-bubble-time')),
  varPillBtns: /** @type {NodeListOf<HTMLButtonElement>} */ (document.querySelectorAll('.var-pill-btn')),
});

/* ==========================================================================
   3. UTILITÁRIOS PUROS (FORMATAÇÃO, SLUG, DEBOUNCE, BOTÕES)
   ========================================================================== */

const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

/**
 * Formata um valor numérico para moeda Real Brasileiro (R$).
 * @param {number | string | null | undefined} value
 * @returns {string}
 */
function formatCurrencyBRL(value) {
  const num = Number(value);
  return Number.isFinite(num) ? brlFormatter.format(num) : 'R$ 0,00';
}

/**
 * Normaliza texto para busca insensível a acentos e caixa.
 * @param {unknown} text
 * @returns {string}
 */
function normalizeText(text) {
  if (typeof text !== 'string') return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Converte um nome em slug URL-friendly (ex.: "Saúde & Prevenção" -> "saude-prevencao").
 * @param {string} value
 * @returns {string}
 */
function generateSlug(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

/**
 * Cria uma função com debounce para evitar execuções excessivas em eventos de digitação.
 * @template {(...args: any[]) => void} T
 * @param {T} fn
 * @param {number} [delayMs=200]
 * @returns {(...args: Parameters<T>) => void}
 */
function debounce(fn, delayMs = 200) {
  /** @type {ReturnType<typeof setTimeout> | null} */
  let timerId = null;
  return (...args) => {
    if (timerId !== null) clearTimeout(timerId);
    timerId = setTimeout(() => {
      fn(...args);
      timerId = null;
    }, delayMs);
  };
}

/**
 * Alterna o estado de carregamento visual e bloqueio de um botão de submit.
 * Preserva a estrutura de ícone + texto sem usar innerHTML inseguro.
 *
 * @param {HTMLButtonElement | null} button
 * @param {boolean} isLoading
 * @param {string} loadingText
 * @param {string} defaultText
 * @param {string} [defaultIconClass='fa-solid fa-floppy-disk']
 */
function setButtonLoading(
  button,
  isLoading,
  loadingText,
  defaultText,
  defaultIconClass = 'fa-solid fa-floppy-disk'
) {
  if (!button) return;
  button.disabled = isLoading;
  button.setAttribute('aria-busy', String(isLoading));

  const icon = document.createElement('i');
  icon.setAttribute('aria-hidden', 'true');
  icon.className = isLoading ? 'fa-solid fa-circle-notch fa-spin' : defaultIconClass;

  const span = document.createElement('span');
  span.textContent = isLoading ? loadingText : defaultText;

  button.replaceChildren(icon, span);
}

/**
 * Gera um SVG data URI leve como fallback para produtos sem foto.
 * @returns {string}
 */
const FALLBACK_PRODUCT_THUMB =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'><rect width='120' height='120' rx='12' fill='%23F4EEFA'/><text x='50%25' y='54%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='36' fill='%233D1E6D'>🌿</text></svg>";

/* ==========================================================================
   4. SISTEMA DE NOTIFICAÇÕES (TOASTS) & MODAL PROMISIFICADO (<dialog>)
   ========================================================================== */

/**
 * Exibe uma notificação flutuante acessível dentro de `#toast-container`.
 * Remove automaticamente após 4 segundos com transição suave.
 *
 * @param {string} message - Mensagem a ser exibida ao administrador.
 * @param {'success' | 'error' | 'warning'} [type='success'] - Tipo semântico do alerta.
 */
function showToast(message, type = 'success') {
  if (!DOM.toastContainer || !message) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type} toast--${type}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

  const contentWrap = document.createElement('div');
  contentWrap.style.display = 'flex';
  contentWrap.style.alignItems = 'center';
  contentWrap.style.gap = '10px';

  const icon = document.createElement('i');
  icon.setAttribute('aria-hidden', 'true');
  if (type === 'error') {
    icon.className = 'fa-solid fa-circle-exclamation';
  } else if (type === 'warning') {
    icon.className = 'fa-solid fa-triangle-exclamation';
  } else {
    icon.className = 'fa-solid fa-circle-check';
  }

  const textSpan = document.createElement('span');
  textSpan.textContent = message;

  contentWrap.append(icon, textSpan);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Fechar notificação');
  closeBtn.style.opacity = '0.7';
  closeBtn.style.padding = '2px 4px';
  const closeIcon = document.createElement('i');
  closeIcon.className = 'fa-solid fa-xmark';
  closeIcon.setAttribute('aria-hidden', 'true');
  closeBtn.appendChild(closeIcon);

  toast.append(contentWrap, closeBtn);
  DOM.toastContainer.appendChild(toast);

  let removed = false;
  const dismissToast = () => {
    if (removed) return;
    removed = true;
    toast.style.transition = 'opacity 200ms ease, transform 200ms ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(24px)';
    setTimeout(() => toast.remove(), 220);
  };

  const autoDismissTimer = setTimeout(dismissToast, 4000);
  closeBtn.addEventListener('click', () => {
    clearTimeout(autoDismissTimer);
    dismissToast();
  });
}

/**
 * Abre o modal nativo `<dialog id="confirm-modal">` de forma promisificada.
 * Resolve `true` ao confirmar em `#modal-btn-confirm` e `false` ao cancelar ou pressionar `ESC`.
 *
 * @param {{ title?: string, message?: string }} options
 * @returns {Promise<boolean>}
 */
function confirmAction({
  title = 'Confirmar exclusão',
  message = 'Tem certeza de que deseja excluir permanentemente este registro? Esta ação não poderá ser desfeita.',
} = {}) {
  return new Promise((resolve) => {
    const dialog = DOM.confirmModal;
    if (!dialog || typeof dialog.showModal !== 'function') {
      resolve(false);
      return;
    }

    if (DOM.modalTitle) DOM.modalTitle.textContent = title;
    if (DOM.modalMessage) DOM.modalMessage.textContent = message;

    let settled = false;
    const cleanupAndResolve = (confirmed) => {
      if (settled) return;
      settled = true;

      DOM.modalBtnConfirm?.removeEventListener('click', onConfirm);
      DOM.modalBtnCancel?.removeEventListener('click', onCancel);
      dialog.removeEventListener('cancel', onCancel);
      dialog.removeEventListener('click', onBackdropClick);

      if (dialog.open) {
        dialog.close();
      }
      resolve(confirmed);
    };

    const onConfirm = () => cleanupAndResolve(true);
    const onCancel = () => cleanupAndResolve(false);
    const onBackdropClick = (/** @type {MouseEvent} */ event) => {
      if (event.target === dialog) {
        cleanupAndResolve(false);
      }
    };

    DOM.modalBtnConfirm?.addEventListener('click', onConfirm);
    DOM.modalBtnCancel?.addEventListener('click', onCancel);
    dialog.addEventListener('cancel', onCancel);
    dialog.addEventListener('click', onBackdropClick);

    if (!dialog.open) {
      dialog.showModal();
    }
    DOM.modalBtnCancel?.focus();
  });
}

/* ==========================================================================
   5. PIPELINE SÊNIOR DE IMAGEM (PREVIEW + CONVERSÃO WEBP + LIMPEZA DE MEMÓRIA)
   ========================================================================== */

/**
 * Revoga o ObjectURL ativo da memória do navegador para evitar memory leaks.
 */
function revokeActivePreviewUrl() {
  if (state.activePreviewObjectUrl) {
    URL.revokeObjectURL(state.activePreviewObjectUrl);
    state.activePreviewObjectUrl = null;
  }
}

/**
 * Exibe ou oculta o container de preview de imagem (`#image-preview-container`).
 * @param {string | null} srcUrl - URL da imagem (ObjectURL local ou URL pública do Supabase).
 */
function updateImagePreviewUI(srcUrl) {
  if (!DOM.imagePreviewContainer || !DOM.imagePreview) return;

  if (srcUrl) {
    DOM.imagePreview.src = srcUrl;
    DOM.imagePreviewContainer.hidden = false;
  } else {
    DOM.imagePreview.removeAttribute('src');
    DOM.imagePreviewContainer.hidden = true;
  }
}

/**
 * Revoga o ObjectURL ativo do preview de slide do carrossel da memória do navegador.
 */
function revokeActiveSlidePreviewUrl() {
  if (state.activeSlidePreviewObjectUrl) {
    URL.revokeObjectURL(state.activeSlidePreviewObjectUrl);
    state.activeSlidePreviewObjectUrl = null;
  }
}

/**
 * Exibe ou oculta o container de preview panorâmico (`#slide-preview-container`).
 * @param {string | null} srcUrl - URL da imagem (ObjectURL local ou URL pública do Supabase).
 */
function updateSlidePreviewUI(srcUrl) {
  if (!DOM.slidePreviewContainer || !DOM.slidePreview) return;

  if (srcUrl) {
    DOM.slidePreview.src = srcUrl;
    DOM.slidePreviewContainer.hidden = false;
  } else {
    DOM.slidePreview.removeAttribute('src');
    DOM.slidePreviewContainer.hidden = true;
  }
}

/**
 * Valida o arquivo de imagem selecionado contra os tipos MIME permitidos
 * e tamanho máximo razoável antes do processamento no Canvas.
 *
 * @param {File} file
 * @returns {{ valid: boolean, error?: string }}
 */
function validateSelectedImageFile(file) {
  if (!(file instanceof File)) {
    return { valid: false, error: 'Arquivo de imagem inválido.' };
  }

  if (!STORAGE_CONFIG.ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'Formato não permitido. Selecione uma imagem JPG, PNG ou WebP.',
    };
  }

  // Permite entrada de até 10MB antes da compressão WebP, mas exige <= 2MB no arquivo final
  const maxRawInputBytes = STORAGE_CONFIG.MAX_FILE_SIZE_BYTES * 5;
  if (file.size > maxRawInputBytes) {
    return {
      valid: false,
      error: 'A imagem original é muito pesada. Selecione um arquivo de até 10 MB.',
    };
  }

  return { valid: true };
}

/**
 * Converte e comprime qualquer imagem (`image/jpeg`, `image/png`, `image/webp`)
 * no cliente para o formato `image/webp` usando HTML5 `<canvas>`, redimensionando
 * proporcionalmente e garantindo o limite de 2MB (`STORAGE_CONFIG.MAX_FILE_SIZE_BYTES`).
 *
 * @param {File} file - Arquivo original selecionado pelo administrador.
 * @param {{ maxDimension?: number, initialQuality?: number }} [options]
 * @returns {Promise<Blob>} Blob otimizado em formato `image/webp`.
 */
async function convertImageToWebP(
  file,
  { maxDimension = 1280, initialQuality = 0.84 } = {}
) {
  // Se já for WebP e já respeitar o limite estrito de 2MB, ainda redimensionamos se for enorme,
  // ou retornamos diretamente caso o suporte a canvas falhe.
  const imgElement = await new Promise((resolve, reject) => {
    const tempUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(tempUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(tempUrl);
      reject(new Error('Não foi possível decodificar a imagem selecionada.'));
    };
    img.src = tempUrl;
  });

  let { naturalWidth: width, naturalHeight: height } = imgElement;
  if (width <= 0 || height <= 0) {
    throw new Error('Dimensões de imagem inválidas.');
  }

  if (width > maxDimension || height > maxDimension) {
    const ratio = Math.min(maxDimension / width, maxDimension / height);
    width = Math.max(1, Math.round(width * ratio));
    height = Math.max(1, Math.round(height * ratio));
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Contexto gráfico 2D indisponível no navegador.');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(imgElement, 0, 0, width, height);

  const encodeWithQuality = (quality) =>
    new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Falha ao converter a imagem para WebP.'));
        },
        'image/webp',
        quality
      );
    });

  let quality = initialQuality;
  let webpBlob = await encodeWithQuality(quality);

  // Caso o WebP ainda ultrapasse 2MB, reduz progressivamente a qualidade até caber no limite do bucket
  while (webpBlob.size > STORAGE_CONFIG.MAX_FILE_SIZE_BYTES && quality > 0.45) {
    quality = Number((quality - 0.12).toFixed(2));
    webpBlob = await encodeWithQuality(quality);
  }

  // Limpa memória do buffer do canvas
  canvas.width = 0;
  canvas.height = 0;

  if (webpBlob.size > STORAGE_CONFIG.MAX_FILE_SIZE_BYTES) {
    throw new Error('A imagem excede o limite máximo de 2 MB mesmo após a compressão WebP.');
  }

  return webpBlob;
}

/**
 * Faz o upload do Blob WebP para o bucket `product-images` e retorna `{ imagePath, imageUrl }`.
 *
 * @param {File} rawFile
 * @returns {Promise<{ imagePath: string, imageUrl: string }>}
 */
async function uploadProductImage(rawFile) {
  const validation = validateSelectedImageFile(rawFile);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const webpBlob = await convertImageToWebP(rawFile);

  const randomSuffix =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;

  const baseSlug = generateSlug(rawFile.name.replace(/\.[^.]+$/, '')) || 'produto';
  const imagePath = `catalogo/${Date.now()}-${baseSlug}-${randomSuffix.slice(0, 8)}.webp`;

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_CONFIG.BUCKET_NAME)
    .upload(imagePath, webpBlob, {
      contentType: 'image/webp',
      cacheControl: '31536000',
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  const imageUrl = getPublicImageUrl(imagePath);
  return { imagePath, imageUrl };
}

/**
 * Comprime um banner widescreen em Alta Definição (`maxDimension = 1920`, `initialQuality = 0.85`)
 * para formato `image/webp` e realiza o upload no bucket `product-images` com prefixo
 * padronizado `carousel_${crypto.randomUUID()}.webp`.
 *
 * @param {File} rawFile - Arquivo original selecionado em `#slide-image`.
 * @returns {Promise<{ imagePath: string, imageUrl: string }>}
 */
async function uploadCarouselImage(rawFile) {
  const validation = validateSelectedImageFile(rawFile);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const webpBlob = await convertImageToWebP(rawFile, {
    maxDimension: 1920,
    initialQuality: 0.85,
  });

  const uniqueUuid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;

  const imagePath = `carousel/banner-${Date.now()}-${uniqueUuid.slice(0, 8)}.webp`;

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_CONFIG.BUCKET_NAME)
    .upload(imagePath, webpBlob, {
      contentType: 'image/webp',
      cacheControl: '31536000',
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  const imageUrl = getPublicImageUrl(imagePath);
  return { imagePath, imageUrl };
}

/**
 * Remove silenciosamente uma imagem antiga do bucket `product-images` para evitar arquivos órfãos.
 * @param {string | null | undefined} oldImagePath
 */
async function removeStorageImageIfPresent(oldImagePath) {
  if (typeof oldImagePath !== 'string') return;
  const cleaned = oldImagePath.trim();
  if (!cleaned || /^https?:\/\//i.test(cleaned) || cleaned.startsWith('images/')) {
    return;
  }

  try {
    await supabase.storage.from(STORAGE_CONFIG.BUCKET_NAME).remove([cleaned]);
  } catch (err) {
    console.warn('[Admin][StorageCleanup] Não foi possível remover a imagem antiga:', err);
  }
}

/* ==========================================================================
   6. ATUALIZAÇÃO DE KPIS E RENDERIZAÇÃO SEGURA (ZERO XSS)
   ========================================================================== */

/**
 * Recalcula e renderiza os 4 indicadores de KPI a partir do `state` em memória.
 */
function renderKpis() {
  const totalProducts = state.products.length;
  const activeProducts = state.products.filter((p) => Boolean(p.is_active)).length;
  const bestsellers = state.products.filter((p) => Boolean(p.is_best_seller)).length;
  const activeCategories = state.categories.filter((c) => Boolean(c.is_active)).length;

  if (DOM.kpiTotalProducts) DOM.kpiTotalProducts.textContent = String(totalProducts);
  if (DOM.kpiActiveProducts) DOM.kpiActiveProducts.textContent = String(activeProducts);
  if (DOM.kpiBestsellers) DOM.kpiBestsellers.textContent = String(bestsellers);
  if (DOM.kpiCategories) DOM.kpiCategories.textContent = String(activeCategories);
}

/**
 * Sincroniza os `<select>` de categorias (`#prod-category` e `#filter-category`)
 * preservando a seleção atual do administrador.
 */
function renderCategorySelects() {
  // 1. Select do Formulário de Produto (#prod-category)
  if (DOM.prodCategory) {
    const previousValue = DOM.prodCategory.value;
    const frag = document.createDocumentFragment();

    const placeholderOpt = document.createElement('option');
    placeholderOpt.value = '';
    placeholderOpt.textContent =
      state.categories.length > 0
        ? 'Selecione uma categoria...'
        : 'Cadastre uma categoria primeiro...';
    frag.appendChild(placeholderOpt);

    state.categories.forEach((cat) => {
      const opt = document.createElement('option');
      opt.value = cat.id;
      opt.textContent = cat.is_active ? cat.name : `${cat.name} (Inativa)`;
      frag.appendChild(opt);
    });

    DOM.prodCategory.replaceChildren(frag);
    if (previousValue && state.categories.some((c) => c.id === previousValue)) {
      DOM.prodCategory.value = previousValue;
    }
  }

  // 2. Select de Filtro da Tabela (#filter-category)
  if (DOM.filterCategory) {
    const previousFilter = state.filters.categoryId || 'all';
    const frag = document.createDocumentFragment();

    const allOpt = document.createElement('option');
    allOpt.value = 'all';
    allOpt.textContent = 'Todas as categorias';
    frag.appendChild(allOpt);

    state.categories.forEach((cat) => {
      const opt = document.createElement('option');
      opt.value = cat.id;
      opt.textContent = cat.name;
      frag.appendChild(opt);
    });

    DOM.filterCategory.replaceChildren(frag);
    const hasCategory = state.categories.some((c) => c.id === previousFilter);
    const nextFilter = hasCategory ? previousFilter : 'all';
    state.filters.categoryId = nextFilter;
    DOM.filterCategory.value = nextFilter;
  }
}

/**
 * Renderiza a lista de categorias cadastradas (`#categories-list`).
 */
function renderCategoriesList() {
  if (!DOM.categoriesList) return;

  if (state.categories.length === 0) {
    const emptyLi = document.createElement('li');
    emptyLi.className = 'category-item';
    emptyLi.style.justifyContent = 'center';
    emptyLi.style.color = 'var(--text-muted)';
    emptyLi.textContent = 'Nenhuma categoria cadastrada.';
    DOM.categoriesList.replaceChildren(emptyLi);
    return;
  }

  const fragment = document.createDocumentFragment();

  state.categories.forEach((cat) => {
    const li = document.createElement('li');
    li.className = 'category-item';
    li.dataset.id = cat.id;

    // Bloco esquerdo: Ordem + Nome/Slug
    const infoDiv = document.createElement('div');
    infoDiv.className = 'category-item__info';

    const orderBadge = document.createElement('span');
    orderBadge.className = 'badge-order category-item__order';
    orderBadge.title = `Ordem de exibição: ${cat.display_order ?? 0}`;
    orderBadge.textContent = `#${cat.display_order ?? 0}`;

    const textDiv = document.createElement('div');
    textDiv.className = 'category-item__text';

    const nameStrong = document.createElement('strong');
    nameStrong.className = 'category-item__name';
    nameStrong.textContent = cat.name;

    const slugSmall = document.createElement('small');
    slugSmall.className = 'category-item__slug';
    slugSmall.textContent = `/${cat.slug}`;

    textDiv.append(nameStrong, slugSmall);
    infoDiv.append(orderBadge, textDiv);

    // Bloco direito: Badge de Status + Botões Editar / Excluir
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'category-item__actions';

    const statusBadge = document.createElement('span');
    statusBadge.className = `badge ${cat.is_active ? 'badge-success' : 'badge-muted'}`;
    statusBadge.textContent = cat.is_active ? 'Ativa' : 'Inativa';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn btn-secondary btn-sm btn-icon';
    editBtn.dataset.action = 'edit-category';
    editBtn.dataset.id = cat.id;
    editBtn.title = `Editar categoria "${cat.name}"`;
    editBtn.setAttribute('aria-label', `Editar categoria ${cat.name}`);
    const editIcon = document.createElement('i');
    editIcon.className = 'fa-solid fa-pen';
    editIcon.setAttribute('aria-hidden', 'true');
    editBtn.appendChild(editIcon);

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn btn-danger btn-sm btn-icon';
    deleteBtn.dataset.action = 'delete-category';
    deleteBtn.dataset.id = cat.id;
    deleteBtn.title = `Excluir categoria "${cat.name}"`;
    deleteBtn.setAttribute('aria-label', `Excluir categoria ${cat.name}`);
    const deleteIcon = document.createElement('i');
    deleteIcon.className = 'fa-regular fa-trash-can';
    deleteIcon.setAttribute('aria-hidden', 'true');
    deleteBtn.appendChild(deleteIcon);

    actionsDiv.append(statusBadge, editBtn, deleteBtn);
    li.append(infoDiv, actionsDiv);
    fragment.appendChild(li);
  });

  DOM.categoriesList.replaceChildren(fragment);
}

/**
 * Filtra `state.products` em memória de acordo com `state.filters`
 * (sem disparar requisições adicionais ao Supabase).
 *
 * @returns {import('./supabaseClient.js').Product[]}
 */
function getFilteredProducts() {
  const query = normalizeText(state.filters.search);
  const categoryFilter = state.filters.categoryId;
  const statusFilter = state.filters.status;

  return state.products.filter((product) => {
    if (categoryFilter !== 'all' && product.category_id !== categoryFilter) {
      return false;
    }

    if (statusFilter === 'active' && !product.is_active) return false;
    if (statusFilter === 'inactive' && product.is_active) return false;
    if (statusFilter === 'bestseller' && !product.is_best_seller) return false;

    if (query) {
      const haystack = normalizeText(`${product.name || ''} ${product.description || ''}`);
      if (!haystack.includes(query)) return false;
    }

    return true;
  });
}

/**
 * Renderiza a tabela administrativa de produtos (`#products-tbody`) e controla
 * a visibilidade de `#products-empty-state`.
 */
function renderProductsTable() {
  if (!DOM.productsTbody) return;

  const filteredProducts = getFilteredProducts();
  const categoriesMap = new Map(state.categories.map((c) => [c.id, c.name]));

  if (filteredProducts.length === 0) {
    DOM.productsTbody.replaceChildren();
    if (DOM.productsEmptyState) DOM.productsEmptyState.hidden = false;
    if (DOM.productsTable) DOM.productsTable.hidden = true;
    return;
  }

  if (DOM.productsEmptyState) DOM.productsEmptyState.hidden = true;
  if (DOM.productsTable) DOM.productsTable.hidden = false;

  const fragment = document.createDocumentFragment();

  filteredProducts.forEach((product) => {
    const tr = document.createElement('tr');
    tr.dataset.id = product.id;

    // 1. Miniatura da Foto
    const tdThumb = document.createElement('td');
    const img = document.createElement('img');
    img.className = 'product-thumb';
    img.width = 56;
    img.height = 56;
    img.loading = 'lazy';
    img.alt = product.name;
    const resolvedImage =
      product.image_url || getPublicImageUrl(product.image_path) || FALLBACK_PRODUCT_THUMB;
    img.src = resolvedImage;
    img.addEventListener('error', () => {
      if (img.src !== FALLBACK_PRODUCT_THUMB) {
        img.src = FALLBACK_PRODUCT_THUMB;
      }
    });
    tdThumb.appendChild(img);

    // 2. Nome e Descrição
    const tdInfo = document.createElement('td');
    const titleStrong = document.createElement('strong');
    titleStrong.className = 'product-cell-title';
    titleStrong.textContent = product.name;
    tdInfo.appendChild(titleStrong);

    if (product.description) {
      const descP = document.createElement('p');
      descP.className = 'product-cell-desc';
      descP.textContent = product.description;
      tdInfo.appendChild(descP);
    }

    // 3. Categoria
    const tdCategory = document.createElement('td');
    const catBadge = document.createElement('span');
    catBadge.className = 'badge badge-order';
    const catName =
      product.categories?.name ||
      (product.category_id ? categoriesMap.get(product.category_id) : null) ||
      'Sem categoria';
    catBadge.textContent = catName;
    tdCategory.appendChild(catBadge);

    // 4. Preço
    const tdPrice = document.createElement('td');
    const priceSpan = document.createElement('span');
    priceSpan.className = 'product-cell-price';
    priceSpan.textContent = formatCurrencyBRL(product.price);
    tdPrice.appendChild(priceSpan);

    // 5. Badges de Status (Ativo/Inativo + Mais Vendido)
    const tdStatus = document.createElement('td');
    const badgesWrap = document.createElement('div');
    badgesWrap.className = 'status-badges-stack';

    const activeBadge = document.createElement('span');
    activeBadge.className = `badge ${product.is_active ? 'badge-success' : 'badge-muted'}`;
    activeBadge.textContent = product.is_active ? 'Ativo' : 'Inativo';
    badgesWrap.appendChild(activeBadge);

    if (product.is_best_seller) {
      const bestBadge = document.createElement('span');
      bestBadge.className = 'badge badge-gold';
      const fireIcon = document.createElement('i');
      fireIcon.className = 'fa-solid fa-fire';
      fireIcon.setAttribute('aria-hidden', 'true');
      const bestText = document.createElement('span');
      bestText.textContent = 'Mais Vendido';
      bestBadge.append(fireIcon, bestText);
      badgesWrap.appendChild(bestBadge);
    }

    const hasCustomWa = Boolean(product.whatsapp_message && product.whatsapp_message.trim());
    const waBadge = document.createElement('span');
    waBadge.className = `badge ${hasCustomWa ? 'badge-success' : 'badge-muted'}`;
    const waIcon = document.createElement('i');
    waIcon.className = 'fa-brands fa-whatsapp';
    waIcon.setAttribute('aria-hidden', 'true');
    const waText = document.createElement('span');
    waText.textContent = hasCustomWa ? ' Msg Própria' : ' Msg Geral';
    waBadge.append(waIcon, waText);
    waBadge.title = hasCustomWa
      ? 'Este produto possui mensagem exclusiva configurada para o WhatsApp'
      : 'Este produto herda o modelo geral padrão da loja no WhatsApp';
    badgesWrap.appendChild(waBadge);

    tdStatus.appendChild(badgesWrap);

    // 6. Ações (Editar / Excluir)
    const tdActions = document.createElement('td');
    const actionsWrap = document.createElement('div');
    actionsWrap.className = 'table-actions';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn btn-secondary btn-sm';
    editBtn.dataset.action = 'edit-product';
    editBtn.dataset.id = product.id;
    editBtn.setAttribute('aria-label', `Editar produto ${product.name}`);
    const editIcon = document.createElement('i');
    editIcon.className = 'fa-solid fa-pen';
    editIcon.setAttribute('aria-hidden', 'true');
    const editLabel = document.createElement('span');
    editLabel.textContent = 'Editar';
    editBtn.append(editIcon, editLabel);

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn btn-danger btn-sm btn-icon';
    deleteBtn.dataset.action = 'delete-product';
    deleteBtn.dataset.id = product.id;
    deleteBtn.title = `Excluir "${product.name}"`;
    deleteBtn.setAttribute('aria-label', `Excluir produto ${product.name}`);
    const deleteIcon = document.createElement('i');
    deleteIcon.className = 'fa-regular fa-trash-can';
    deleteIcon.setAttribute('aria-hidden', 'true');
    deleteBtn.appendChild(deleteIcon);

    actionsWrap.append(editBtn, deleteBtn);
    tdActions.appendChild(actionsWrap);

    tr.append(tdThumb, tdInfo, tdCategory, tdPrice, tdStatus, tdActions);
    fragment.appendChild(tr);
  });

  DOM.productsTbody.replaceChildren(fragment);
}

/**
 * Renderiza a galeria visual de slides do carrossel (`#carousel-admin-grid`) e controla
 * a visibilidade de `#carousel-empty-state` usando exclusivamente `createElement` e `textContent`.
 */
function renderCarouselAdminGrid() {
  if (!DOM.carouselAdminGrid) return;

  const totalSlides = state.carouselSlides.length;
  if (DOM.carouselCountBadge) {
    DOM.carouselCountBadge.textContent =
      totalSlides === 1 ? '1 foto' : `${totalSlides} fotos`;
  }

  if (totalSlides === 0) {
    DOM.carouselAdminGrid.replaceChildren();
    DOM.carouselAdminGrid.hidden = true;
    if (DOM.carouselEmptyState) DOM.carouselEmptyState.hidden = false;
    return;
  }

  if (DOM.carouselEmptyState) DOM.carouselEmptyState.hidden = true;
  DOM.carouselAdminGrid.hidden = false;

  const editingSlideId = DOM.slideId?.value.trim() || '';
  const fragment = document.createDocumentFragment();

  state.carouselSlides.forEach((slide) => {
    const card = document.createElement('article');
    card.className = 'carousel-slide-card';
    if (editingSlideId && editingSlideId === slide.id) {
      card.classList.add('is-editing');
    }
    card.dataset.id = slide.id;

    // 1. Miniatura Panorâmica Oficial (1920x650) + Badges de Ordem e Status
    const mediaWrap = document.createElement('div');
    mediaWrap.className = 'carousel-slide-card__media';

    const img = document.createElement('img');
    img.className = 'carousel-slide-card__img';
    img.loading = 'lazy';
    img.width = 480;
    img.height = 162;
    const slideTitleText = String(slide.title || '').trim();
    img.alt = slideTitleText || `Banner do carrossel (Ordem ${slide.display_order})`;
    const resolvedUrl =
      slide.image_url || getPublicImageUrl(slide.image_path) || FALLBACK_PRODUCT_THUMB;
    img.src = resolvedUrl;
    img.addEventListener('error', () => {
      if (img.src !== FALLBACK_PRODUCT_THUMB) {
        img.src = FALLBACK_PRODUCT_THUMB;
      }
    });

    const badgesOverlay = document.createElement('div');
    badgesOverlay.className = 'carousel-slide-card__badges';

    const orderBadge = document.createElement('span');
    orderBadge.className = 'badge badge-order';
    orderBadge.textContent = `Ordem: ${slide.display_order}`;

    const statusBadge = document.createElement('span');
    statusBadge.className = `badge ${slide.is_active ? 'badge-success' : 'badge-muted'}`;
    statusBadge.textContent = slide.is_active ? 'Ativo' : 'Inativo';

    badgesOverlay.append(orderBadge, statusBadge);
    mediaWrap.append(img, badgesOverlay);

    // 2. Corpo com Descrição / Link Opcional
    const bodyWrap = document.createElement('div');
    bodyWrap.className = 'carousel-slide-card__body';

    const titleEl = document.createElement('strong');
    titleEl.className = 'carousel-slide-card__title';
    titleEl.textContent = slideTitleText || 'Banner sem descrição definida';
    bodyWrap.appendChild(titleEl);

    const linkText = String(slide.button_link || '').trim();
    if (linkText) {
      const linkSpan = document.createElement('span');
      linkSpan.className = 'carousel-slide-card__link';
      const linkIcon = document.createElement('i');
      linkIcon.className = 'fa-solid fa-link';
      linkIcon.setAttribute('aria-hidden', 'true');
      linkSpan.append(linkIcon, document.createTextNode(` ${linkText}`));
      bodyWrap.appendChild(linkSpan);
    }

    // 3. Ações Diretas: Editar / Trocar Foto & Excluir Foto
    const actionsWrap = document.createElement('div');
    actionsWrap.className = 'carousel-slide-card__actions';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn btn-secondary btn-sm';
    editBtn.dataset.action = 'edit-slide';
    editBtn.dataset.id = slide.id;
    editBtn.setAttribute(
      'aria-label',
      `Editar ou trocar foto do banner ${slideTitleText || slide.display_order}`
    );
    const editIcon = document.createElement('i');
    editIcon.className = 'fa-solid fa-camera-rotate';
    editIcon.setAttribute('aria-hidden', 'true');
    const editLabel = document.createElement('span');
    editLabel.textContent = 'Editar / Trocar Foto';
    editBtn.append(editIcon, editLabel);

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn btn-danger btn-sm';
    deleteBtn.dataset.action = 'delete-slide';
    deleteBtn.dataset.id = slide.id;
    deleteBtn.setAttribute(
      'aria-label',
      `Excluir foto do banner ${slideTitleText || slide.display_order}`
    );
    const deleteIcon = document.createElement('i');
    deleteIcon.className = 'fa-regular fa-trash-can';
    deleteIcon.setAttribute('aria-hidden', 'true');
    const deleteLabel = document.createElement('span');
    deleteLabel.textContent = 'Excluir Foto';
    deleteBtn.append(deleteIcon, deleteLabel);

    actionsWrap.append(editBtn, deleteBtn);
    card.append(mediaWrap, bodyWrap, actionsWrap);
    fragment.appendChild(card);
  });

  DOM.carouselAdminGrid.replaceChildren(fragment);
}

/**
 * Sincroniza toda a interface administrativa com o estado atual em memória.
 */
function renderAll() {
  renderKpis();
  renderCarouselAdminGrid();
  renderCategorySelects();
  renderCategoriesList();
  renderProductsTable();
}

/* ==========================================================================
   7. OPERAÇÕES DE DADOS SUPABASE (FETCH & CRUD)
   ========================================================================== */

/**
 * Busca todas as categorias ordenadas por `display_order` ASC e `name` ASC.
 */
async function fetchCategories() {
  const { data, error } = await supabase
    .from(DB_TABLES.CATEGORIES)
    .select('*')
    .order('display_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    const normalized = normalizeSupabaseError(error, 'Erro ao carregar categorias');
    showToast(normalized.userMessage, 'error');
    return;
  }

  state.categories = Array.isArray(data) ? data : [];
  renderKpis();
  renderCategorySelects();
  renderCategoriesList();
}

/**
 * Busca todos os produtos do catálogo ordenados pelos mais recentes.
 */
async function fetchProducts() {
  const { data, error } = await supabase
    .from(DB_TABLES.PRODUCTS)
    .select('*, categories(id, name, slug)')
    .order('created_at', { ascending: false });

  if (error) {
    const normalized = normalizeSupabaseError(error, 'Erro ao carregar produtos');
    showToast(normalized.userMessage, 'error');
    return;
  }

  state.products = Array.isArray(data) ? data : [];
  renderKpis();
  renderProductsTable();
  populateWhatsAppScopeSelect();
}

/**
 * Busca todos os slides do carrossel ordenados por `display_order` ASC e `created_at` DESC.
 */
async function fetchCarouselSlides() {
  const { data, error } = await supabase
    .from(DB_TABLES.CAROUSEL)
    .select('*')
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    const rawCode = String(error.code || '');
    // Caso a tabela `carousel_slides` ainda não tenha sido criada no SQL Editor, degrada graciosamente
    if (rawCode === '42P01' || rawCode === 'PGRST205') {
      console.warn(
        '[Admin][Carousel] A tabela "public.carousel_slides" ainda não foi criada no Supabase. Execute o script "supabase_carousel.sql" no SQL Editor.'
      );
      state.carouselSlides = [];
      renderCarouselAdminGrid();
      return;
    }

    const normalized = normalizeSupabaseError(error, 'Erro ao carregar fotos do carrossel');
    showToast(normalized.userMessage, 'error');
    return;
  }

  state.carouselSlides = Array.isArray(data) ? data : [];
  renderCarouselAdminGrid();
}

/* ==========================================================================
   8. CONTROLADORES DE FORMULÁRIO: CATEGORIAS
   ========================================================================== */

/**
 * Reseta o formulário de categorias para o estado inicial de criação.
 */
function resetCategoryForm() {
  DOM.categoryForm?.reset();
  if (DOM.catId) DOM.catId.value = '';
  if (DOM.catSlug) DOM.catSlug.value = '';
  if (DOM.catOrder) DOM.catOrder.value = '0';
  if (DOM.catActive) DOM.catActive.checked = true;
  if (DOM.btnCancelCat) DOM.btnCancelCat.hidden = true;
  if (DOM.panelCategoriesTitle) DOM.panelCategoriesTitle.textContent = 'Gestão de Categorias';
  setButtonLoading(DOM.btnSaveCat, false, 'Salvando...', 'Salvar Categoria');
}

/**
 * Preenche o formulário de categorias para edição do registro selecionado.
 * @param {string} categoryId
 */
function startEditCategory(categoryId) {
  const category = state.categories.find((c) => c.id === categoryId);
  if (!category) return;

  if (DOM.catId) DOM.catId.value = category.id;
  if (DOM.catName) DOM.catName.value = category.name;
  if (DOM.catSlug) DOM.catSlug.value = category.slug || generateSlug(category.name);
  if (DOM.catOrder) DOM.catOrder.value = String(category.display_order ?? 0);
  if (DOM.catActive) DOM.catActive.checked = Boolean(category.is_active);
  if (DOM.btnCancelCat) DOM.btnCancelCat.hidden = false;
  if (DOM.panelCategoriesTitle) DOM.panelCategoriesTitle.textContent = 'Editando Categoria';

  setButtonLoading(DOM.btnSaveCat, false, 'Atualizando...', 'Atualizar Categoria');
  DOM.catName?.focus();
}

/**
 * Salva (cria ou atualiza) uma categoria no Supabase.
 * @param {SubmitEvent} event
 */
async function handleCategorySubmit(event) {
  event.preventDefault();

  const id = DOM.catId?.value.trim() || '';
  const name = DOM.catName?.value.trim() || '';
  const slug = generateSlug(DOM.catSlug?.value || name);
  const displayOrder = Math.max(0, Number.parseInt(DOM.catOrder?.value || '0', 10) || 0);
  const isActive = Boolean(DOM.catActive?.checked);

  if (!name || !slug) {
    showToast('Informe um nome válido para a categoria.', 'warning');
    DOM.catName?.focus();
    return;
  }

  const isEditing = Boolean(id);
  setButtonLoading(
    DOM.btnSaveCat,
    true,
    isEditing ? 'Atualizando...' : 'Salvando...',
    isEditing ? 'Atualizar Categoria' : 'Salvar Categoria'
  );

  try {
    const payload = {
      name,
      slug,
      display_order: displayOrder,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    };

    const query = isEditing
      ? supabase.from(DB_TABLES.CATEGORIES).update(payload).eq('id', id)
      : supabase.from(DB_TABLES.CATEGORIES).insert([payload]);

    const { error } = await query;

    if (error) {
      const normalized = normalizeSupabaseError(error, 'Não foi possível salvar a categoria');
      showToast(normalized.userMessage, 'error');
      return;
    }

    showToast(
      isEditing ? 'Categoria atualizada com sucesso!' : 'Categoria criada com sucesso!',
      'success'
    );
    resetCategoryForm();
    await Promise.all([fetchCategories(), fetchProducts()]);
  } catch (unexpectedErr) {
    const normalized = normalizeSupabaseError(unexpectedErr, 'Erro inesperado ao salvar categoria');
    showToast(normalized.userMessage, 'error');
  } finally {
    const stillEditing = Boolean(DOM.catId?.value);
    setButtonLoading(
      DOM.btnSaveCat,
      false,
      'Salvando...',
      stillEditing ? 'Atualizar Categoria' : 'Salvar Categoria'
    );
  }
}

/**
 * Exclui uma categoria após confirmação no modal nativo `<dialog>`.
 * @param {string} categoryId
 */
async function handleDeleteCategory(categoryId) {
  const category = state.categories.find((c) => c.id === categoryId);
  if (!category) return;

  const linkedProductsCount = state.products.filter((p) => p.category_id === categoryId).length;
  const warningDetail =
    linkedProductsCount > 0
      ? ` Atenção: existem ${linkedProductsCount} produto(s) vinculados a "${category.name}".`
      : '';

  const confirmed = await confirmAction({
    title: 'Excluir categoria',
    message: `Deseja realmente excluir a categoria "${category.name}"?${warningDetail}`,
  });

  if (!confirmed) return;

  try {
    const { error } = await supabase.from(DB_TABLES.CATEGORIES).delete().eq('id', categoryId);

    if (error) {
      const normalized = normalizeSupabaseError(error, 'Não foi possível excluir a categoria');
      showToast(normalized.userMessage, 'error');
      return;
    }

    if (DOM.catId?.value === categoryId) {
      resetCategoryForm();
    }

    showToast(`Categoria "${category.name}" excluída com sucesso.`, 'success');
    await Promise.all([fetchCategories(), fetchProducts()]);
  } catch (err) {
    const normalized = normalizeSupabaseError(err, 'Erro ao excluir categoria');
    showToast(normalized.userMessage, 'error');
  }
}

/* ==========================================================================
   9. CONTROLADORES DE FORMULÁRIO: PRODUTOS
   ========================================================================== */

/**
 * Reseta o formulário de produtos, limpa o input de arquivo e revoga ObjectURLs.
 */
function resetProductForm() {
  DOM.productForm?.reset();
  if (DOM.prodId) DOM.prodId.value = '';
  if (DOM.prodOldImagePath) DOM.prodOldImagePath.value = '';
  if (DOM.prodSku) DOM.prodSku.value = '';
  if (DOM.prodShortDesc) DOM.prodShortDesc.value = '';
  if (DOM.prodPaymentInfo) {
    DOM.prodPaymentInfo.value = 'Consulte formas de pagamento via WhatsApp / Cartão e Pix';
  }
  if (DOM.prodDesc) DOM.prodDesc.value = '';
  if (DOM.prodUsage) DOM.prodUsage.value = '';
  if (DOM.prodComposition) DOM.prodComposition.value = '';
  if (DOM.prodPackage) DOM.prodPackage.value = '';
  if (DOM.prodAllergens) DOM.prodAllergens.value = 'Não contém lactose e glúten.';
  if (DOM.prodQualityNote) {
    DOM.prodQualityNote.value =
      'Todos os produtos da Botica Natural são preparados com matérias-primas selecionadas e rigoroso controle de qualidade farmacêutico, garantindo melhor eficácia.';
  }
  if (DOM.prodWhatsappMessage) DOM.prodWhatsappMessage.value = '';
  if (DOM.prodActive) DOM.prodActive.checked = true;
  if (DOM.prodBestseller) DOM.prodBestseller.checked = false;
  if (DOM.prodImage) DOM.prodImage.value = '';
  if (DOM.btnCancelProd) DOM.btnCancelProd.hidden = true;
  if (DOM.panelProductsTitle) DOM.panelProductsTitle.textContent = 'Cadastrar / Editar Produto';

  revokeActivePreviewUrl();
  updateImagePreviewUI(null);
  setButtonLoading(DOM.btnSaveProd, false, 'Salvando...', 'Salvar Produto');
}

/**
 * Entra no modo de edição de um produto populando todos os campos e o preview da foto.
 * @param {string} productId
 */
function startEditProduct(productId) {
  const product = state.products.find((p) => p.id === productId);
  if (!product) return;

  revokeActivePreviewUrl();
  if (DOM.prodImage) DOM.prodImage.value = '';

  if (DOM.prodId) DOM.prodId.value = product.id;
  if (DOM.prodOldImagePath) DOM.prodOldImagePath.value = product.image_path || '';
  if (DOM.prodName) DOM.prodName.value = product.name || '';
  if (DOM.prodSku) DOM.prodSku.value = product.sku_ref || '';
  if (DOM.prodCategory) DOM.prodCategory.value = product.category_id || '';
  if (DOM.prodPrice) DOM.prodPrice.value = Number(product.price ?? 0).toFixed(2);
  if (DOM.prodShortDesc) DOM.prodShortDesc.value = product.short_description || '';
  if (DOM.prodPaymentInfo) {
    DOM.prodPaymentInfo.value =
      product.payment_info || 'Consulte formas de pagamento via WhatsApp / Cartão e Pix';
  }
  if (DOM.prodDesc) DOM.prodDesc.value = product.description || '';
  if (DOM.prodUsage) DOM.prodUsage.value = product.usage_instructions || '';
  if (DOM.prodComposition) DOM.prodComposition.value = product.composition || '';
  if (DOM.prodPackage) DOM.prodPackage.value = product.package_info || '';
  if (DOM.prodAllergens) {
    DOM.prodAllergens.value = product.allergen_info ?? 'Não contém lactose e glúten.';
  }
  if (DOM.prodQualityNote) {
    DOM.prodQualityNote.value =
      product.quality_note ||
      'Todos os produtos da Botica Natural são preparados com matérias-primas selecionadas e rigoroso controle de qualidade farmacêutico, garantindo melhor eficácia.';
  }
  if (DOM.prodWhatsappMessage) {
    DOM.prodWhatsappMessage.value = product.whatsapp_message || '';
  }
  if (DOM.prodActive) DOM.prodActive.checked = Boolean(product.is_active);
  if (DOM.prodBestseller) DOM.prodBestseller.checked = Boolean(product.is_best_seller);

  const existingImageUrl = product.image_url || getPublicImageUrl(product.image_path);
  updateImagePreviewUI(existingImageUrl || null);

  if (DOM.btnCancelProd) DOM.btnCancelProd.hidden = false;
  if (DOM.panelProductsTitle) DOM.panelProductsTitle.textContent = 'Editando Produto';
  setButtonLoading(DOM.btnSaveProd, false, 'Atualizando...', 'Atualizar Produto');

  DOM.productForm?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  DOM.prodName?.focus();
}

/**
 * Manipula a seleção de um novo arquivo de imagem em `#prod-image`:
 * valida MIME/tamanho, revoga ObjectURL anterior e exibe preview instantâneo.
 */
function handleProductImageSelection() {
  const file = DOM.prodImage?.files?.[0];

  revokeActivePreviewUrl();

  if (!file) {
    const oldPath = DOM.prodOldImagePath?.value.trim();
    updateImagePreviewUI(oldPath ? getPublicImageUrl(oldPath) : null);
    return;
  }

  const validation = validateSelectedImageFile(file);
  if (!validation.valid) {
    showToast(validation.error || 'Arquivo inválido.', 'error');
    if (DOM.prodImage) DOM.prodImage.value = '';
    updateImagePreviewUI(null);
    return;
  }

  const previewUrl = URL.createObjectURL(file);
  state.activePreviewObjectUrl = previewUrl;
  updateImagePreviewUI(previewUrl);
}

/**
 * Salva (cria ou atualiza) um produto no Supabase, executando o pipeline
 * de conversão WebP e limpeza de imagem antiga no Storage quando aplicável.
 *
 * @param {SubmitEvent} event
 */
async function handleProductSubmit(event) {
  event.preventDefault();

  const id = DOM.prodId?.value.trim() || '';
  const oldImagePath = DOM.prodOldImagePath?.value.trim() || '';
  const name = DOM.prodName?.value.trim() || '';
  const skuRef = DOM.prodSku?.value.trim() || '';
  const categoryId = DOM.prodCategory?.value.trim() || '';
  const rawPrice = Number.parseFloat(DOM.prodPrice?.value || '');
  const shortDescription = DOM.prodShortDesc?.value.trim() || '';
  const paymentInfo =
    DOM.prodPaymentInfo?.value.trim() ||
    'Consulte formas de pagamento via WhatsApp / Cartão e Pix';
  const description = DOM.prodDesc?.value.trim() || '';
  const usageInstructions = DOM.prodUsage?.value.trim() || '';
  const composition = DOM.prodComposition?.value.trim() || '';
  const packageInfo = DOM.prodPackage?.value.trim() || '';
  const allergenInfo = DOM.prodAllergens?.value.trim() || 'Não contém lactose e glúten.';
  const qualityNote =
    DOM.prodQualityNote?.value.trim() ||
    'Todos os produtos da Botica Natural são preparados com matérias-primas selecionadas e rigoroso controle de qualidade farmacêutico, garantindo melhor eficácia.';
  const whatsappMessage = DOM.prodWhatsappMessage?.value.trim() || '';
  const isActive = Boolean(DOM.prodActive?.checked);
  const isBestSeller = Boolean(DOM.prodBestseller?.checked);
  const selectedFile = DOM.prodImage?.files?.[0] || null;

  if (!name) {
    showToast('Informe o nome do produto.', 'warning');
    DOM.prodName?.focus();
    return;
  }

  if (!categoryId) {
    showToast('Selecione uma categoria para o produto.', 'warning');
    DOM.prodCategory?.focus();
    return;
  }

  if (!Number.isFinite(rawPrice) || rawPrice < 0) {
    showToast('Informe um preço válido maior ou igual a zero.', 'warning');
    DOM.prodPrice?.focus();
    return;
  }

  const isEditing = Boolean(id);
  setButtonLoading(
    DOM.btnSaveProd,
    true,
    selectedFile ? 'Otimizando imagem & salvando...' : 'Salvando...',
    isEditing ? 'Atualizar Produto' : 'Salvar Produto'
  );

  /** @type {string | null} */
  let newlyUploadedPath = null;

  try {
    const existingProduct = isEditing ? state.products.find((p) => p.id === id) : null;
    let finalImagePath = existingProduct?.image_path ?? (oldImagePath || null);
    let finalImageUrl = existingProduct?.image_url ?? (oldImagePath ? getPublicImageUrl(oldImagePath) : null);

    // Se o administrador selecionou uma nova foto, converte para WebP e envia ao Storage
    if (selectedFile) {
      const uploadResult = await uploadProductImage(selectedFile);
      newlyUploadedPath = uploadResult.imagePath;
      finalImagePath = uploadResult.imagePath;
      finalImageUrl = uploadResult.imageUrl;
    }

    const payload = {
      name,
      sku_ref: skuRef,
      category_id: categoryId,
      price: Number(rawPrice.toFixed(2)),
      short_description: shortDescription,
      payment_info: paymentInfo,
      description,
      usage_instructions: usageInstructions,
      composition,
      package_info: packageInfo,
      allergen_info: allergenInfo,
      quality_note: qualityNote,
      whatsapp_message: whatsappMessage,
      image_path: finalImagePath,
      image_url: finalImageUrl,
      is_active: isActive,
      is_best_seller: isBestSeller,
      updated_at: new Date().toISOString(),
    };

    const query = isEditing
      ? supabase.from(DB_TABLES.PRODUCTS).update(payload).eq('id', id)
      : supabase.from(DB_TABLES.PRODUCTS).insert([payload]);

    const { error } = await query;

    if (error) {
      // Se o banco rejeitou a gravação mas uma nova imagem já havia subido, limpa o arquivo recém-enviado
      if (newlyUploadedPath) {
        await removeStorageImageIfPresent(newlyUploadedPath);
      }
      const normalized = normalizeSupabaseError(error, 'Não foi possível salvar o produto');
      showToast(normalized.userMessage, 'error');
      return;
    }

    // Se era uma edição com troca de foto, remove a foto antiga do bucket para não deixar lixo no Storage
    if (isEditing && newlyUploadedPath && oldImagePath && oldImagePath !== newlyUploadedPath) {
      await removeStorageImageIfPresent(oldImagePath);
    }

    showToast(
      isEditing ? 'Produto atualizado com sucesso!' : 'Produto cadastrado com sucesso!',
      'success'
    );
    resetProductForm();
    await fetchProducts();
  } catch (err) {
    if (newlyUploadedPath) {
      await removeStorageImageIfPresent(newlyUploadedPath);
    }
    const message =
      err instanceof Error && err.message
        ? err.message
        : normalizeSupabaseError(err, 'Erro ao processar o produto').userMessage;
    showToast(message, 'error');
  } finally {
    const stillEditing = Boolean(DOM.prodId?.value);
    setButtonLoading(
      DOM.btnSaveProd,
      false,
      'Salvando...',
      stillEditing ? 'Atualizar Produto' : 'Salvar Produto'
    );
  }
}

/**
 * Exclui um produto do banco e remove sua respectiva imagem do bucket `product-images`.
 * @param {string} productId
 */
async function handleDeleteProduct(productId) {
  const product = state.products.find((p) => p.id === productId);
  if (!product) return;

  const confirmed = await confirmAction({
    title: 'Excluir produto',
    message: `Tem certeza de que deseja excluir permanentemente "${product.name}" do catálogo?`,
  });

  if (!confirmed) return;

  try {
    const { error } = await supabase.from(DB_TABLES.PRODUCTS).delete().eq('id', productId);

    if (error) {
      const normalized = normalizeSupabaseError(error, 'Não foi possível excluir o produto');
      showToast(normalized.userMessage, 'error');
      return;
    }

    if (product.image_path) {
      await removeStorageImageIfPresent(product.image_path);
    }

    if (DOM.prodId?.value === productId) {
      resetProductForm();
    }

    showToast(`Produto "${product.name}" excluído com sucesso.`, 'success');
    await fetchProducts();
  } catch (err) {
    const normalized = normalizeSupabaseError(err, 'Erro ao excluir produto');
    showToast(normalized.userMessage, 'error');
  }
}

/* ==========================================================================
   9.5. CONTROLADORES DE FORMULÁRIO: GERENCIADOR DE BANNERS DO CARROSSEL
   ========================================================================== */

/**
 * Reseta o formulário `#carousel-form` para o estado inicial de adição de nova foto,
 * revogando qualquer ObjectURL panorâmico da memória RAM.
 */
function resetCarouselForm() {
  revokeActiveSlidePreviewUrl();
  updateSlidePreviewUI(null);

  DOM.carouselForm?.reset();
  if (DOM.slideId) DOM.slideId.value = '';
  if (DOM.slideOldImagePath) DOM.slideOldImagePath.value = '';
  if (DOM.slideTitle) DOM.slideTitle.value = '';
  if (DOM.slideLink) DOM.slideLink.value = '';
  if (DOM.slideOrder) DOM.slideOrder.value = '0';
  if (DOM.slideActive) DOM.slideActive.checked = true;
  if (DOM.slideImage) DOM.slideImage.value = '';
  if (DOM.slideImageRequiredMark) DOM.slideImageRequiredMark.hidden = false;

  if (DOM.panelCarouselTitle) {
    DOM.panelCarouselTitle.textContent = 'Gerenciador de Banners do Carrossel';
  }

  setButtonLoading(
    DOM.btnSaveSlide,
    false,
    'Enviando Banner...',
    'Adicionar Foto ao Carrossel',
    'fa-solid fa-cloud-arrow-up'
  );

  if (DOM.btnCancelSlide) {
    DOM.btnCancelSlide.hidden = true;
  }

  renderCarouselAdminGrid();
}

/**
 * Manipula a seleção de arquivo no input `#slide-image`, validando formato/tamanho
 * e exibindo o preview panorâmico widescreen imediato.
 */
function handleSlideImageSelection() {
  revokeActiveSlidePreviewUrl();

  const file = DOM.slideImage?.files?.[0];
  if (!file) {
    const editingId = DOM.slideId?.value.trim();
    if (editingId) {
      const existing = state.carouselSlides.find((s) => s.id === editingId);
      const existingUrl = existing?.image_url || getPublicImageUrl(existing?.image_path);
      updateSlidePreviewUI(existingUrl || null);
    } else {
      updateSlidePreviewUI(null);
    }
    return;
  }

  const validation = validateSelectedImageFile(file);
  if (!validation.valid) {
    if (DOM.slideImage) DOM.slideImage.value = '';
    updateSlidePreviewUI(null);
    showToast(validation.error || 'Arquivo de banner inválido.', 'error');
    return;
  }

  const previewUrl = URL.createObjectURL(file);
  state.activeSlidePreviewObjectUrl = previewUrl;
  updateSlidePreviewUI(previewUrl);
}

/**
 * Preenche o formulário `#carousel-form` para editar ou substituir a foto de um slide existente.
 * @param {string} slideId
 */
function startEditCarouselSlide(slideId) {
  const slide = state.carouselSlides.find((s) => s.id === slideId);
  if (!slide) {
    showToast('Banner não encontrado na memória.', 'error');
    return;
  }

  revokeActiveSlidePreviewUrl();
  if (DOM.slideImage) DOM.slideImage.value = '';

  if (DOM.slideId) DOM.slideId.value = slide.id;
  if (DOM.slideOldImagePath) DOM.slideOldImagePath.value = slide.image_path || '';
  if (DOM.slideTitle) DOM.slideTitle.value = slide.title || '';
  if (DOM.slideLink) DOM.slideLink.value = slide.button_link || '';
  if (DOM.slideOrder) DOM.slideOrder.value = String(slide.display_order ?? 0);
  if (DOM.slideActive) DOM.slideActive.checked = Boolean(slide.is_active);
  if (DOM.slideImageRequiredMark) DOM.slideImageRequiredMark.hidden = true;

  const currentImgUrl = slide.image_url || getPublicImageUrl(slide.image_path);
  updateSlidePreviewUI(currentImgUrl || null);

  if (DOM.panelCarouselTitle) {
    DOM.panelCarouselTitle.textContent = `Editando Banner (Ordem ${slide.display_order})`;
  }

  setButtonLoading(
    DOM.btnSaveSlide,
    false,
    'Salvando...',
    'Salvar Alterações / Trocar Foto',
    'fa-solid fa-floppy-disk'
  );

  if (DOM.btnCancelSlide) {
    DOM.btnCancelSlide.hidden = false;
  }

  renderCarouselAdminGrid();
  DOM.carouselForm?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  DOM.slideTitle?.focus();
}

/**
 * Processa a criação ou atualização de um banner do carrossel (`#carousel-form`),
 * realizando compressão WebP HD (`1920px`, `0.85`), upload no Storage e remoção
 * automática do arquivo antigo quando a foto é substituída (Zero Arquivos Órfãos).
 *
 * @param {SubmitEvent} event
 */
async function handleCarouselSubmit(event) {
  event.preventDefault();

  const editingId = DOM.slideId?.value.trim() || '';
  const oldImagePath = DOM.slideOldImagePath?.value.trim() || '';
  const title = DOM.slideTitle?.value.trim() || '';
  const buttonLink = DOM.slideLink?.value.trim() || '';
  const rawOrder = Number.parseInt(DOM.slideOrder?.value || '0', 10);
  const displayOrder = Number.isFinite(rawOrder) && rawOrder >= 0 ? rawOrder : 0;
  const isActive = Boolean(DOM.slideActive?.checked);
  const selectedFile = DOM.slideImage?.files?.[0] || null;

  if (!editingId && !selectedFile) {
    showToast('Selecione uma foto panorâmica para adicionar ao carrossel.', 'warning');
    DOM.slideImage?.focus();
    return;
  }

  setButtonLoading(
    DOM.btnSaveSlide,
    true,
    selectedFile ? 'Otimizando WebP 1920px e enviando...' : 'Salvando alterações...',
    editingId ? 'Salvar Alterações / Trocar Foto' : 'Adicionar Foto ao Carrossel',
    editingId ? 'fa-solid fa-floppy-disk' : 'fa-solid fa-cloud-arrow-up'
  );

  /** @type {{ imagePath: string, imageUrl: string } | null} */
  let uploadedBanner = null;

  try {
    if (selectedFile) {
      uploadedBanner = await uploadCarouselImage(selectedFile);
    }

    /** @type {Record<string, any>} */
    const payload = {
      title,
      button_link: buttonLink,
      display_order: displayOrder,
      is_active: isActive,
    };

    if (uploadedBanner) {
      payload.image_path = uploadedBanner.imagePath;
      payload.image_url = uploadedBanner.imageUrl;
    }

    if (editingId) {
      const { error } = await supabase
        .from(DB_TABLES.CAROUSEL)
        .update(payload)
        .eq('id', editingId);

      if (error) throw error;

      // Se uma nova foto foi enviada na edição, apaga o arquivo antigo do Storage para evitar órfãos
      if (uploadedBanner && oldImagePath && oldImagePath !== uploadedBanner.imagePath) {
        await removeStorageImageIfPresent(oldImagePath);
      }

      showToast(
        uploadedBanner
          ? 'Foto do banner substituída e carrossel atualizado!'
          : 'Dados do banner atualizados com sucesso!',
        'success'
      );
    } else {
      const { error } = await supabase.from(DB_TABLES.CAROUSEL).insert([payload]);

      if (error) throw error;

      showToast('Nova foto adicionada ao carrossel com sucesso!', 'success');
    }

    resetCarouselForm();
    await fetchCarouselSlides();
  } catch (err) {
    // Rollback físico no Storage caso o upload tenha ocorrido mas o banco tenha falhado
    if (uploadedBanner?.imagePath) {
      await removeStorageImageIfPresent(uploadedBanner.imagePath);
    }

    const normalized = normalizeSupabaseError(err, 'Erro ao salvar banner do carrossel');
    showToast(normalized.userMessage, 'error');
  } finally {
    const stillEditing = Boolean(DOM.slideId?.value.trim());
    setButtonLoading(
      DOM.btnSaveSlide,
      false,
      'Salvando...',
      stillEditing ? 'Salvar Alterações / Trocar Foto' : 'Adicionar Foto ao Carrossel',
      stillEditing ? 'fa-solid fa-floppy-disk' : 'fa-solid fa-cloud-arrow-up'
    );
  }
}

/**
 * Exclui um banner do carrossel mediante confirmação em `<dialog>` e remove
 * imediatamente o arquivo físico correspondente do Supabase Storage.
 *
 * @param {string} slideId
 */
async function handleDeleteCarouselSlide(slideId) {
  const slide = state.carouselSlides.find((s) => s.id === slideId);
  if (!slide) return;

  const label = slide.title ? `"${slide.title}"` : `de Ordem ${slide.display_order}`;
  const confirmed = await confirmAction({
    title: 'Excluir Foto do Carrossel',
    message: `Tem certeza que deseja excluir permanentemente o banner ${label}? A imagem também será apagada do servidor.`,
  });

  if (!confirmed) return;

  try {
    const { error } = await supabase.from(DB_TABLES.CAROUSEL).delete().eq('id', slideId);

    if (error) {
      const normalized = normalizeSupabaseError(error, 'Não foi possível excluir o banner');
      showToast(normalized.userMessage, 'error');
      return;
    }

    if (slide.image_path) {
      await removeStorageImageIfPresent(slide.image_path);
    }

    if (DOM.slideId?.value === slideId) {
      resetCarouselForm();
    }

    showToast('Foto excluída do carrossel e removida do Storage.', 'success');
    await fetchCarouselSlides();
  } catch (err) {
    const normalized = normalizeSupabaseError(err, 'Erro inesperado ao excluir banner');
    showToast(normalized.userMessage, 'error');
  }
}

/* ==========================================================================
   9.5. MÓDULO DE GESTÃO DE MENSAGENS PERSONALIZADAS DO WHATSAPP
   ========================================================================== */

/**
 * Retorna uma fórmula para alimentar a pré-visualização em tempo real.
 * Se um produto específico estiver selecionado no escopo, utiliza seus dados reais;
 * caso contrário, utiliza a fórmula do ciclo da vitrine ou fallback estruturado.
 * @returns {any}
 */
function getSampleProductForPreview() {
  if (state.whatsappScope && state.whatsappScope !== '__global__') {
    const specificProd = state.products.find((p) => p.id === state.whatsappScope);
    if (specificProd) return specificProd;
  }

  if (Array.isArray(state.products) && state.products.length > 0) {
    const idx = Math.abs(state.selectedSampleIndex) % state.products.length;
    return state.products[idx];
  }

  return {
    id: '4299',
    name: 'Magno 6',
    category_id: 'cat-magnesio',
    category_name: 'Cápsulas',
    categories: { name: 'Cápsulas' },
    price: 50.0,
    sku_ref: 'REF: 4299',
    short_description: 'Aumenta a energia física e mental, auxiliando no relaxamento e sono.',
  };
}

/**
 * Popula o select de escopo com todos os produtos do catálogo para edição individual.
 */
function populateWhatsAppScopeSelect() {
  if (!DOM.whatsappProductsOptgroup) return;

  const fragment = document.createDocumentFragment();

  state.products.forEach((prod) => {
    const opt = document.createElement('option');
    opt.value = prod.id;
    const hasCustom = Boolean(prod.whatsapp_message && prod.whatsapp_message.trim());
    opt.textContent = `${prod.name} ${hasCustom ? '⭐ (Mensagem Exclusiva)' : '· (Padrão Geral)'}`;
    fragment.appendChild(opt);
  });

  DOM.whatsappProductsOptgroup.replaceChildren(fragment);

  // Garante sincronia do valor selecionado
  if (DOM.whatsappScopeSelect) {
    if (
      state.whatsappScope !== '__global__' &&
      !state.products.some((p) => p.id === state.whatsappScope)
    ) {
      state.whatsappScope = '__global__';
      DOM.whatsappScopeSelect.value = '__global__';
      handleWhatsAppScopeChange();
    } else {
      DOM.whatsappScopeSelect.value = state.whatsappScope;
    }
  }
}

/**
 * Altera o escopo do editor entre o "Modelo Geral da Loja" e a "Mensagem Exclusiva de um Produto".
 */
function handleWhatsAppScopeChange() {
  const selectedScope = DOM.whatsappScopeSelect?.value || '__global__';
  state.whatsappScope = selectedScope;

  if (selectedScope === '__global__') {
    if (DOM.whatsappTemplateText) {
      DOM.whatsappTemplateText.value = state.whatsappTemplate || DEFAULT_PRODUCT_MESSAGE_TEMPLATE;
    }

    if (DOM.whatsappScopeStatus) {
      DOM.whatsappScopeStatus.className = 'wa-scope-status-banner';
      DOM.whatsappScopeStatus.innerHTML =
        '<i class="fa-solid fa-circle-info" aria-hidden="true"></i> <span>Você está editando o <strong>Modelo Geral da Loja</strong>. Qualquer produto sem mensagem exclusiva herdará este modelo automaticamente.</span>';
    }

    if (DOM.btnSaveWhatsAppLabel) {
      DOM.btnSaveWhatsAppLabel.textContent = 'Salvar Modelo Geral';
    }
    if (DOM.btnRestoreWhatsAppLabel) {
      DOM.btnRestoreWhatsAppLabel.textContent = 'Restaurar Padrão Oficial';
    }
    if (DOM.btnCyclePreviewProd) {
      DOM.btnCyclePreviewProd.hidden = false;
    }
  } else {
    const product = state.products.find((p) => p.id === selectedScope);
    if (!product) return;

    const hasCustom = Boolean(product.whatsapp_message && product.whatsapp_message.trim());

    if (DOM.whatsappTemplateText) {
      DOM.whatsappTemplateText.value = hasCustom
        ? product.whatsapp_message
        : (state.whatsappTemplate || DEFAULT_PRODUCT_MESSAGE_TEMPLATE);
    }

    if (DOM.whatsappScopeStatus) {
      if (hasCustom) {
        DOM.whatsappScopeStatus.className = 'wa-scope-status-banner wa-scope-status-banner--custom';
        DOM.whatsappScopeStatus.innerHTML = `<i class="fa-solid fa-star" aria-hidden="true"></i> <span>Editando mensagem <strong>exclusiva</strong> do produto: <strong>"${product.name}"</strong>. Apenas este produto abrirá esta mensagem no WhatsApp.</span>`;
      } else {
        DOM.whatsappScopeStatus.className = 'wa-scope-status-banner';
        DOM.whatsappScopeStatus.innerHTML = `<i class="fa-solid fa-link" aria-hidden="true"></i> <span>O produto <strong>"${product.name}"</strong> está usando o <em>Modelo Geral da Loja</em>. Escreva abaixo para torná-la exclusiva para ele.</span>`;
      }
    }

    if (DOM.btnSaveWhatsAppLabel) {
      DOM.btnSaveWhatsAppLabel.textContent = `Salvar Mensagem do Produto`;
    }
    if (DOM.btnRestoreWhatsAppLabel) {
      DOM.btnRestoreWhatsAppLabel.textContent = 'Limpar e Usar Modelo Geral';
    }
    if (DOM.btnCyclePreviewProd) {
      DOM.btnCyclePreviewProd.hidden = true;
    }
  }

  updateWhatsAppPreview();
}

/**
 * Atualiza o balão de simulação do WhatsApp e o contador de caracteres em tempo real.
 */
function updateWhatsAppPreview() {
  const textarea = DOM.whatsappTemplateText;
  const currentText = textarea?.value || '';
  const charLength = currentText.length;
  const maxChars = 1000;

  // Atualiza contador de caracteres com classes semânticas de alerta
  if (DOM.whatsappCharCounter) {
    DOM.whatsappCharCounter.textContent = `${charLength} / ${maxChars} caracteres`;
    DOM.whatsappCharCounter.classList.toggle('is-warning', charLength >= 750 && charLength < 950);
    DOM.whatsappCharCounter.classList.toggle('is-danger', charLength >= 950);
  }

  // Validação: não permitir mensagem vazia
  const isValid = currentText.trim().length > 0;
  if (DOM.btnSaveWhatsApp) {
    DOM.btnSaveWhatsApp.disabled = !isValid;
  }

  if (DOM.whatsappValidationHint) {
    if (!isValid) {
      DOM.whatsappValidationHint.textContent = 'A mensagem não pode ficar vazia.';
      DOM.whatsappValidationHint.style.color = 'var(--danger)';
    } else {
      DOM.whatsappValidationHint.textContent = '';
    }
  }

  const sampleProduct = getSampleProductForPreview();

  // Atualiza crachá da fórmula de teste
  if (DOM.waPreviewSampleBadge) {
    const sampleName = sampleProduct.name || 'Fórmula';
    const sampleSku = sampleProduct.sku_ref ? ` (${sampleProduct.sku_ref})` : '';
    const samplePrice = formatCurrencyBRL(sampleProduct.price);
    DOM.waPreviewSampleBadge.textContent = `${sampleName}${sampleSku} · ${samplePrice}`;
  }

  // Interpola as variáveis de forma segura no balão do WhatsApp
  if (DOM.waPreviewBubbleText) {
    const previewMessage = interpolateTemplate(
      currentText || DEFAULT_PRODUCT_MESSAGE_TEMPLATE,
      sampleProduct
    );
    DOM.waPreviewBubbleText.textContent = previewMessage;
  }

  // Atualiza horário atual no balão
  if (DOM.waPreviewBubbleTime) {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    DOM.waPreviewBubbleTime.textContent = `${hh}:${mm}`;
  }
}

/**
 * Insere a variável dinâmica na posição do cursor do textarea informado.
 * @param {string} variableText - Tag entre chaves (ex.: '{produto}').
 * @param {HTMLTextAreaElement | null} [targetTextarea=null] - Textarea alvo.
 */
function insertVariableAtCursor(variableText, targetTextarea = null) {
  const textarea = targetTextarea || DOM.whatsappTemplateText;
  if (!textarea) return;

  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? textarea.value.length;
  const currentVal = textarea.value;

  textarea.value = currentVal.substring(0, start) + variableText + currentVal.substring(end);
  const nextPos = start + variableText.length;
  textarea.setSelectionRange(nextPos, nextPos);
  textarea.focus();

  if (textarea === DOM.whatsappTemplateText) {
    updateWhatsAppPreview();
  }
}

/**
 * Carrega a configuração do template salva no Supabase (`site_settings`).
 */
async function fetchWhatsAppSettings() {
  if (DOM.whatsappSyncBadge) {
    DOM.whatsappSyncBadge.className = 'badge badge-muted';
    DOM.whatsappSyncBadge.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Sincronizando...';
  }

  try {
    const template = await fetchProductWhatsAppTemplate(true);
    state.whatsappTemplate = template;

    if (state.whatsappScope === '__global__' && DOM.whatsappTemplateText) {
      DOM.whatsappTemplateText.value = template;
    }

    updateWhatsAppPreview();

    if (DOM.whatsappSyncBadge) {
      DOM.whatsappSyncBadge.className = 'badge badge-success';
      DOM.whatsappSyncBadge.innerHTML = '<i class="fa-solid fa-cloud-check"></i> Sincronizado';
    }
  } catch (err) {
    const normalized = normalizeSupabaseError(err, 'Erro ao carregar template do WhatsApp');
    showToast(normalized.userMessage, 'warning');

    if (DOM.whatsappSyncBadge) {
      DOM.whatsappSyncBadge.className = 'badge badge-gold';
      DOM.whatsappSyncBadge.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Modo Padrão Ativo';
    }
  }
}

/**
 * Salva e persiste a mensagem no banco de dados via Supabase (Global ou por Produto).
 * @param {SubmitEvent} event
 */
async function handleSaveWhatsAppSettings(event) {
  event.preventDefault();

  const newText = DOM.whatsappTemplateText?.value.trim() || '';
  if (!newText) {
    showToast('A mensagem do WhatsApp não pode ficar vazia.', 'warning');
    return;
  }

  setButtonLoading(
    DOM.btnSaveWhatsApp,
    true,
    'Salvando Mensagem...',
    'Salvar Mensagem',
    'fa-solid fa-floppy-disk'
  );

  if (DOM.whatsappSyncBadge) {
    DOM.whatsappSyncBadge.className = 'badge badge-muted';
    DOM.whatsappSyncBadge.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Salvando...';
  }

  try {
    const adminEmail = DOM.adminUserEmail?.textContent || 'admin';

    if (state.whatsappScope === '__global__') {
      // Salva Modelo Geral da Loja (site_settings)
      await saveProductWhatsAppTemplate(newText, adminEmail);
      state.whatsappTemplate = newText;
      showToast('Modelo Geral do WhatsApp salvo com sucesso no banco de dados!', 'success');
    } else {
      // Salva Mensagem Exclusiva do Produto (products.whatsapp_message)
      const productId = state.whatsappScope;
      await saveIndividualProductWhatsAppMessage(productId, newText, adminEmail);

      const product = state.products.find((p) => p.id === productId);
      if (product) {
        product.whatsapp_message = newText;
      }

      populateWhatsAppScopeSelect();
      renderProductsTable();
      handleWhatsAppScopeChange();

      showToast(`Mensagem exclusiva salva com sucesso para "${product?.name || 'o produto'}"!`, 'success');
    }

    if (DOM.whatsappSyncBadge) {
      DOM.whatsappSyncBadge.className = 'badge badge-success';
      DOM.whatsappSyncBadge.innerHTML = '<i class="fa-solid fa-cloud-check"></i> Salvo no Banco';
    }

    updateWhatsAppPreview();
  } catch (err) {
    const normalized = normalizeSupabaseError(err, 'Não foi possível salvar o template');
    showToast(normalized.userMessage, 'error');

    if (DOM.whatsappSyncBadge) {
      DOM.whatsappSyncBadge.className = 'badge badge-danger';
      DOM.whatsappSyncBadge.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Erro ao Salvar';
    }
  } finally {
    setButtonLoading(
      DOM.btnSaveWhatsApp,
      false,
      'Salvando Mensagem...',
      state.whatsappScope === '__global__' ? 'Salvar Modelo Geral' : 'Salvar Mensagem do Produto',
      'fa-solid fa-floppy-disk'
    );
  }
}

/**
 * Restaura o modelo padrão (se global) ou remove a mensagem exclusiva (se produto individual).
 */
async function handleRestoreWhatsAppDefault() {
  if (state.whatsappScope === '__global__') {
    const confirmed = await confirmAction({
      title: 'Restaurar Modelo Padrão Geral',
      message:
        'Deseja realmente restaurar o modelo original da Botica Natural? O texto atual no editor será substituído pelo padrão da marca.',
    });

    if (!confirmed) return;

    if (DOM.whatsappTemplateText) {
      DOM.whatsappTemplateText.value = DEFAULT_PRODUCT_MESSAGE_TEMPLATE;
    }

    updateWhatsAppPreview();
    showToast(
      'Modelo padrão geral restaurado no editor. Clique em "Salvar" para aplicar.',
      'warning'
    );
  } else {
    const product = state.products.find((p) => p.id === state.whatsappScope);
    const confirmed = await confirmAction({
      title: 'Remover Mensagem Exclusiva',
      message: `Deseja remover a mensagem exclusiva de "${product?.name || 'este produto'}" e fazer com que ele volte a herdar o Modelo Geral da loja?`,
    });

    if (!confirmed) return;

    try {
      const adminEmail = DOM.adminUserEmail?.textContent || 'admin';
      await saveIndividualProductWhatsAppMessage(state.whatsappScope, '', adminEmail);

      if (product) {
        product.whatsapp_message = '';
      }

      populateWhatsAppScopeSelect();
      renderProductsTable();
      handleWhatsAppScopeChange();

      showToast(`O produto "${product?.name || ''}" agora utiliza o Modelo Geral da loja.`, 'success');
    } catch (err) {
      const normalized = normalizeSupabaseError(err, 'Erro ao redefinir mensagem do produto');
      showToast(normalized.userMessage, 'error');
    }
  }
}

/**
 * Alterna a fórmula de teste utilizada na pré-visualização (disponível no modo geral).
 */
function handleCycleSampleProduct() {
  state.selectedSampleIndex++;
  updateWhatsAppPreview();

  const currentSample = getSampleProductForPreview();
  showToast(`Pré-visualização atualizada com: "${currentSample.name}"`, 'success');
}

/* ==========================================================================
   10. AUTENTICAÇÃO, GUARDIÃO DE ROTA E CICLO DE SESSÃO
   ========================================================================== */

/**
 * Exibe uma mensagem de erro dentro de `#login-feedback`.
 * @param {string | null} message
 */
function setLoginFeedback(message) {
  if (!DOM.loginFeedback) return;
  if (message) {
    DOM.loginFeedback.textContent = message;
    DOM.loginFeedback.hidden = false;
  } else {
    DOM.loginFeedback.textContent = '';
    DOM.loginFeedback.hidden = true;
  }
}

/**
 * Valida no servidor se o token JWT pertence a um administrador autorizado (`public.is_admin()`).
 * @returns {Promise<boolean>}
 */
async function verifyServerAdminRole() {
  try {
    const { data, error } = await supabase.rpc(RPC_FUNCTIONS.IS_ADMIN);
    if (error) {
      // Caso a função RPC retorne erro de permissão, bloqueia o acesso
      normalizeSupabaseError(error, 'Falha ao validar permissão administrativa (is_admin)');
      return false;
    }
    return Boolean(data);
  } catch {
    return false;
  }
}

/**
 * Transiciona a UI para o estado Autenticado, exibe `#dashboard-view` e carrega os dados.
 * @param {import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm').Session} session
 */
async function enterAuthenticatedState(session) {
  const isAdmin = await verifyServerAdminRole();
  if (!isAdmin) {
    await supabase.auth.signOut();
    enterUnauthenticatedState();
    setLoginFeedback(
      'Acesso negado: esta conta não possui privilégios de administrador no sistema.'
    );
    return;
  }

  setLoginFeedback(null);
  if (DOM.loginView) DOM.loginView.hidden = true;
  if (DOM.dashboardView) DOM.dashboardView.hidden = false;
  if (DOM.adminUserEmail) {
    DOM.adminUserEmail.textContent = session.user?.email || 'Administrador';
  }

  if (!state.isLoadingData) {
    state.isLoadingData = true;
    try {
      await Promise.all([
        fetchCarouselSlides(),
        fetchCategories(),
        fetchProducts(),
        fetchWhatsAppSettings(),
      ]);
    } finally {
      state.isLoadingData = false;
    }
  }
}

/**
 * Limpa todo o `state` em memória, revoga ObjectURLs e retorna para `#login-view`.
 */
function enterUnauthenticatedState() {
  state.categories = [];
  state.products = [];
  state.carouselSlides = [];
  state.whatsappTemplate = null;
  state.whatsappScope = '__global__';
  state.filters = { search: '', categoryId: 'all', status: 'all' };

  resetCarouselForm();
  resetCategoryForm();
  resetProductForm();

  if (DOM.searchProducts) DOM.searchProducts.value = '';
  if (DOM.filterStatus) DOM.filterStatus.value = 'all';
  if (DOM.adminUserEmail) DOM.adminUserEmail.textContent = '';

  renderAll();

  if (DOM.dashboardView) DOM.dashboardView.hidden = true;
  if (DOM.loginView) DOM.loginView.hidden = false;
}

/**
 * Manipula o submit do formulário `#login-form`.
 * @param {SubmitEvent} event
 */
async function handleLoginSubmit(event) {
  event.preventDefault();
  setLoginFeedback(null);

  if (!isSupabaseConfigured) {
    setLoginFeedback(
      'Configuração pendente: preencha SUPABASE_URL e SUPABASE_ANON_KEY em "js/supabaseClient.js".'
    );
    return;
  }

  const email = DOM.emailInput?.value.trim() || '';
  const password = DOM.passwordInput?.value || '';

  if (!email || !password) {
    setLoginFeedback('Preencha seu e-mail administrativo e sua senha para continuar.');
    return;
  }

  setButtonLoading(
    DOM.btnLogin,
    true,
    'Autenticando...',
    'Entrar no Painel',
    'fa-solid fa-right-to-bracket'
  );

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      const normalized = normalizeSupabaseError(error, 'Falha na autenticação');
      setLoginFeedback(normalized.userMessage);
      return;
    }

    if (data?.session) {
      await enterAuthenticatedState(data.session);
      showToast('Bem-vindo ao Painel Administrativo!', 'success');
    }
  } catch (err) {
    const normalized = normalizeSupabaseError(err, 'Erro inesperado ao realizar login');
    setLoginFeedback(normalized.userMessage);
  } finally {
    if (DOM.passwordInput) DOM.passwordInput.value = '';
    setButtonLoading(
      DOM.btnLogin,
      false,
      'Autenticando...',
      'Entrar no Painel',
      'fa-solid fa-right-to-bracket'
    );
  }
}

/**
 * Encerra a sessão ativa do administrador.
 */
async function handleLogout() {
  try {
    await supabase.auth.signOut();
    enterUnauthenticatedState();
    showToast('Sessão encerrada com segurança.', 'success');
  } catch (err) {
    const normalized = normalizeSupabaseError(err, 'Erro ao encerrar sessão');
    showToast(normalized.userMessage, 'error');
  }
}

/* ==========================================================================
   11. REGISTRO DE EVENT LISTENERS & BOOTSTRAP
   ========================================================================== */

function bindEvents() {
  // Autenticação
  DOM.loginForm?.addEventListener('submit', handleLoginSubmit);
  DOM.btnLogout?.addEventListener('click', handleLogout);

  // Formulário de Banners do Carrossel & Event Delegation na Galeria (#carousel-admin-grid)
  DOM.slideImage?.addEventListener('change', handleSlideImageSelection);
  DOM.carouselForm?.addEventListener('submit', handleCarouselSubmit);
  DOM.btnCancelSlide?.addEventListener('click', resetCarouselForm);

  DOM.carouselAdminGrid?.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('button[data-action]') : null;
    if (!target) return;

    const action = target.getAttribute('data-action');
    const id = target.getAttribute('data-id');
    if (!id) return;

    if (action === 'edit-slide') startEditCarouselSlide(id);
    if (action === 'delete-slide') handleDeleteCarouselSlide(id);
  });

  // Geração automática de slug da categoria enquanto o admin digita o nome
  DOM.catName?.addEventListener('input', () => {
    if (DOM.catSlug) {
      DOM.catSlug.value = generateSlug(DOM.catName?.value || '');
    }
  });

  // Formulário de Categorias
  DOM.categoryForm?.addEventListener('submit', handleCategorySubmit);
  DOM.btnCancelCat?.addEventListener('click', resetCategoryForm);

  // Event Delegation na lista de categorias (#categories-list)
  DOM.categoriesList?.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('button[data-action]') : null;
    if (!target) return;

    const action = target.getAttribute('data-action');
    const id = target.getAttribute('data-id');
    if (!id) return;

    if (action === 'edit-category') startEditCategory(id);
    if (action === 'delete-category') handleDeleteCategory(id);
  });

  // Formulário de Produtos & Upload de Imagem
  DOM.prodImage?.addEventListener('change', handleProductImageSelection);
  DOM.productForm?.addEventListener('submit', handleProductSubmit);
  DOM.btnCancelProd?.addEventListener('click', resetProductForm);

  // Filtros em Memória com Debounce de 200ms na busca textual
  const handleDebouncedSearch = debounce((value) => {
    state.filters.search = value;
    renderProductsTable();
  }, 200);

  DOM.searchProducts?.addEventListener('input', (event) => {
    const target = /** @type {HTMLInputElement} */ (event.target);
    handleDebouncedSearch(target.value || '');
  });

  DOM.filterCategory?.addEventListener('change', (event) => {
    const target = /** @type {HTMLSelectElement} */ (event.target);
    state.filters.categoryId = target.value || 'all';
    renderProductsTable();
  });

  DOM.filterStatus?.addEventListener('change', (event) => {
    const target = /** @type {HTMLSelectElement} */ (event.target);
    state.filters.status = target.value || 'all';
    renderProductsTable();
  });

  // Event Delegation na tabela de produtos (#products-tbody)
  DOM.productsTbody?.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('button[data-action]') : null;
    if (!target) return;

    const action = target.getAttribute('data-action');
    const id = target.getAttribute('data-id');
    if (!id) return;

    if (action === 'edit-product') startEditProduct(id);
    if (action === 'delete-product') handleDeleteProduct(id);
  });

  // Editor de Mensagens Automáticas do WhatsApp (Geral e por Produto)
  DOM.whatsappScopeSelect?.addEventListener('change', handleWhatsAppScopeChange);
  DOM.whatsappTemplateText?.addEventListener('input', updateWhatsAppPreview);
  DOM.whatsappForm?.addEventListener('submit', handleSaveWhatsAppSettings);
  DOM.btnRestoreWhatsApp?.addEventListener('click', handleRestoreWhatsAppDefault);
  DOM.btnCyclePreviewProd?.addEventListener('click', handleCycleSampleProduct);

  // Inserção de variáveis no editor principal do WhatsApp
  document
    .querySelectorAll('.var-pill-btn:not(.var-pill-btn--prod)')
    .forEach((btn) => {
      btn.addEventListener('click', () => {
        const variableTag = btn.getAttribute('data-var');
        if (variableTag) {
          insertVariableAtCursor(variableTag, DOM.whatsappTemplateText);
        }
      });
    });

  // Inserção de variáveis no formulário de produtos
  document.querySelectorAll('.var-pill-btn--prod').forEach((btn) => {
    btn.addEventListener('click', () => {
      const variableTag = btn.getAttribute('data-var');
      if (variableTag) {
        insertVariableAtCursor(variableTag, DOM.prodWhatsappMessage);
      }
    });
  });
}

/**
 * Inicializa o controlador do Painel Administrativo.
 */
async function initAdminApp() {
  bindEvents();

  if (!isSupabaseConfigured) {
    enterUnauthenticatedState();
    setLoginFeedback(
      'Configure SUPABASE_URL e SUPABASE_ANON_KEY em "js/supabaseClient.js" para habilitar o painel.'
    );
    return;
  }

  const session = await getCurrentSession();
  if (session) {
    await enterAuthenticatedState(session);
  } else {
    enterUnauthenticatedState();
  }

  supabase.auth.onAuthStateChange(async (event, nextSession) => {
    if (event === 'SIGNED_OUT' || !nextSession) {
      enterUnauthenticatedState();
    } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      await enterAuthenticatedState(nextSession);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdminApp);
} else {
  initAdminApp();
}

