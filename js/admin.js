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

/* ==========================================================================
   1. ESTADO REATIVO EM MEMÓRIA (SINGLE STATE STORE)
   ========================================================================== */

/**
 * @typedef {Object} AdminState
 * @property {import('./supabaseClient.js').Category[]} categories
 * @property {import('./supabaseClient.js').Product[]} products
 * @property {{ search: string, categoryId: string, status: string }} filters
 * @property {string | null} activePreviewObjectUrl
 * @property {boolean} isLoadingData
 */

/** @type {AdminState} */
const state = {
  categories: [],
  products: [],
  filters: {
    search: '',
    categoryId: 'all',
    status: 'all',
  },
  activePreviewObjectUrl: null,
  isLoadingData: false,
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
  prodCategory: /** @type {HTMLSelectElement | null} */ (document.getElementById('prod-category')),
  prodPrice: /** @type {HTMLInputElement | null} */ (document.getElementById('prod-price')),
  prodDesc: /** @type {HTMLTextAreaElement | null} */ (document.getElementById('prod-desc')),
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
 * Sincroniza toda a interface administrativa com o estado atual em memória.
 */
function renderAll() {
  renderKpis();
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
  if (DOM.prodCategory) DOM.prodCategory.value = product.category_id || '';
  if (DOM.prodPrice) DOM.prodPrice.value = Number(product.price ?? 0).toFixed(2);
  if (DOM.prodDesc) DOM.prodDesc.value = product.description || '';
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
  const categoryId = DOM.prodCategory?.value.trim() || '';
  const rawPrice = Number.parseFloat(DOM.prodPrice?.value || '');
  const description = DOM.prodDesc?.value.trim() || null;
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
      category_id: categoryId,
      price: Number(rawPrice.toFixed(2)),
      description,
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
      await Promise.all([fetchCategories(), fetchProducts()]);
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
  state.filters = { search: '', categoryId: 'all', status: 'all' };

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

