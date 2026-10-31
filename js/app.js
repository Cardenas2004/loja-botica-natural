/**
 * @fileoverview Motor Dinâmico da Vitrine Pública — Botica Natural (100% Supabase Driven)
 * @description Conecta a Landing Page (`index.html`) e o Catálogo (`produtos.html`) exclusivamente
 * ao banco de dados PostgreSQL + Storage do Supabase. Nenhum banner ou produto é fixo no código.
 *
 * @module js/app
 */

import {
  supabase,
  DB_TABLES,
  isSupabaseConfigured,
  getPublicImageUrl,
  normalizeSupabaseError,
} from './supabaseClient.js';

import {
  buildProductWhatsAppUrl as buildCentralProductWhatsAppUrl,
  fetchProductWhatsAppTemplate,
} from './whatsapp.js';

/* ==========================================================================
   1. CONFIGURAÇÕES GLOBAIS E FORMATAÇÃO (SINGLE SOURCE OF TRUTH)
   ========================================================================== */

export const WHATSAPP_CONFIG = Object.freeze({
  PHONE_NUMBER: '555197731564',
  BASE_URL: 'https://wa.me',
  MAX_INSTALLMENTS: 6,
  MAX_BESTSELLERS: 6,
});

const brlCurrencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const FALLBACK_PRODUCT_IMAGE =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='600' height='600' viewBox='0 0 600 600'><rect width='600' height='600' fill='%23FAF7FD'/><g fill='%235B2D9E' opacity='0.45' transform='translate(260, 240)'><path d='M40 0C17.9 0 0 17.9 0 40s17.9 40 40 40 40-17.9 40-40S62.1 0 40 0zm0 70c-16.5 0-30-13.5-30-30s13.5-30 30-30 30 13.5 30 30-13.5 30-30 30z'/><circle cx='40' cy='40' r='14'/></g><text x='50%25' y='62%25' text-anchor='middle' fill='%233D1E6D' font-family='Inter, sans-serif' font-size='16' font-weight='600' opacity='0.65'>Botica Natural — Fórmula Manipulada</text></svg>";

/* ==========================================================================
   2. ESTADO REATIVO EM MEMÓRIA (ALIMENTADO 100% PELO SUPABASE)
   ========================================================================== */

const catalogState = {
  /** @type {Array<import('./supabaseClient.js').CarouselSlide>} */
  carouselSlides: [],
  /** @type {Array<import('./supabaseClient.js').Category>} */
  categories: [],
  /** @type {Array<import('./supabaseClient.js').Product>} */
  products: [],
  /** @type {string} ID da categoria selecionada ('all' por padrão) */
  activeCategory: 'all',
  /** @type {string} Termo de busca textual em tempo real */
  searchQuery: '',
  /** @type {boolean} Controle de estado de carregamento */
  isLoading: true,
};

/* ==========================================================================
   3. FUNÇÕES UTILITÁRIAS PURAS (FORMATAÇÃO, IMAGENS E WHATSAPP)
   ========================================================================== */

function formatPriceBRL(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return 'Sob consulta';
  }
  return brlCurrencyFormatter.format(numericValue);
}

function normalizeText(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function resolveProductCategoryName(product) {
  if (product?.categories && typeof product.categories === 'object') {
    const joinedCategory = Array.isArray(product.categories)
      ? product.categories[0]
      : product.categories;
    if (joinedCategory?.name) {
      return String(joinedCategory.name).trim();
    }
  }

  if (product?.category_id && catalogState.categories.length > 0) {
    const matched = catalogState.categories.find(
      (cat) => String(cat.id) === String(product.category_id)
    );
    if (matched?.name) {
      return String(matched.name).trim();
    }
  }

  return 'Fórmula Manipulada';
}

function resolveProductImageUrl(product) {
  const directUrl = String(product?.image_url || '').trim();
  if (directUrl) {
    return directUrl;
  }

  const storagePath = String(product?.image_path || '').trim();
  if (storagePath) {
    const publicUrl = getPublicImageUrl(storagePath);
    if (publicUrl) {
      return publicUrl;
    }
  }

  return FALLBACK_PRODUCT_IMAGE;
}

export function buildProductWhatsAppUrl(product) {
  return buildCentralProductWhatsAppUrl(product);
}

/* ==========================================================================
   4. CONSTRUÇÃO SEGURA DE DOM DE PRODUTOS (ZERO INNERHTML)
   ========================================================================== */

export function createProductCardElement(product) {
  const article = document.createElement('article');
  article.className = 'product-card product-card--fade-in';
  article.dataset.productId = String(product?.id || '');
  article.dataset.category = String(product?.category_id || '');

  const productName = String(product?.name || 'Fórmula Manipulada').trim();
  const productDescription = String(
    product?.short_description ||
      product?.description ||
      'Fórmula manipulada sob medida com matérias-primas certificadas e rigoroso controle de qualidade farmacêutico.'
  ).trim();
  const categoryName = resolveProductCategoryName(product);
  const numericPrice = Number(product?.price);
  const hasValidPrice = Number.isFinite(numericPrice) && numericPrice > 0;
  const whatsappUrl = buildProductWhatsAppUrl(product);
  const productDetailUrl = product?.id
    ? `produto.html?id=${encodeURIComponent(product.id)}`
    : 'produto.html';

  // 1. Container de Mídia (.product-card__media)
  const mediaContainer = document.createElement('div');
  mediaContainer.className = 'product-card__media';

  const imgLink = document.createElement('a');
  imgLink.className = 'product-card__media-link';
  imgLink.href = productDetailUrl;
  imgLink.setAttribute('aria-label', `Ver detalhes de ${productName}`);

  const img = document.createElement('img');
  img.className = 'product-card__img';
  img.src = resolveProductImageUrl(product);
  img.alt = `${productName} — Botica Natural`;
  img.loading = 'lazy';
  img.decoding = 'async';
  img.width = 600;
  img.height = 600;
  img.style.cursor = 'pointer';

  img.addEventListener(
    'error',
    () => {
      if (img.dataset.fallbackApplied === 'true') return;
      img.dataset.fallbackApplied = 'true';
      img.src = FALLBACK_PRODUCT_IMAGE;
    },
    { once: true }
  );

  imgLink.appendChild(img);
  mediaContainer.appendChild(imgLink);

  // 2. Badges Superiores (.product-card__badges)
  const badgesContainer = document.createElement('div');
  badgesContainer.className = 'product-card__badges';

  if (product?.is_best_seller) {
    const bestsellerBadge = document.createElement('span');
    bestsellerBadge.className = 'product-badge product-badge--bestseller';

    const fireIcon = document.createElement('i');
    fireIcon.className = 'fa-solid fa-fire';
    fireIcon.setAttribute('aria-hidden', 'true');

    bestsellerBadge.appendChild(fireIcon);
    bestsellerBadge.appendChild(document.createTextNode(' Mais Vendido'));
    badgesContainer.appendChild(bestsellerBadge);
  }

  const categoryBadge = document.createElement('span');
  categoryBadge.className = 'product-badge product-badge--cat';
  categoryBadge.textContent = categoryName;
  badgesContainer.appendChild(categoryBadge);

  mediaContainer.appendChild(badgesContainer);
  article.appendChild(mediaContainer);

  // 3. Corpo do Card (.product-card__body)
  const bodyContainer = document.createElement('div');
  bodyContainer.className = 'product-card__body';

  const formTag = document.createElement('span');
  formTag.className = 'product-card__form';
  const flaskIcon = document.createElement('i');
  flaskIcon.className = 'fa-solid fa-mortar-pestle';
  flaskIcon.setAttribute('aria-hidden', 'true');
  formTag.appendChild(flaskIcon);
  formTag.appendChild(document.createTextNode(` ${categoryName}`));
  bodyContainer.appendChild(formTag);

  const titleEl = document.createElement('h3');
  titleEl.className = 'product-card__title';

  const titleLink = document.createElement('a');
  titleLink.className = 'product-card__title-link';
  titleLink.href = productDetailUrl;
  titleLink.textContent = productName;
  titleLink.setAttribute('title', `Ver detalhes de ${productName}`);
  titleEl.appendChild(titleLink);
  bodyContainer.appendChild(titleEl);

  const descEl = document.createElement('p');
  descEl.className = 'product-card__desc';
  descEl.textContent = productDescription;
  bodyContainer.appendChild(descEl);

  // 4. Rodapé do Card (.product-card__footer: Preço + Botões de Ação alinhados na base)
  const footerContainer = document.createElement('div');
  footerContainer.className = 'product-card__footer';

  const priceBox = document.createElement('div');
  priceBox.className = 'product-card__price-box';

  const priceLabel = document.createElement('span');
  priceLabel.className = 'product-card__price-label';
  priceLabel.textContent = hasValidPrice ? 'A partir de' : 'Orçamento personalizado';

  const priceValue = document.createElement('span');
  priceValue.className = 'product-card__price';
  priceValue.textContent = formatPriceBRL(numericPrice);

  const installmentsSpan = document.createElement('span');
  installmentsSpan.className = 'product-card__price-installments';

  if (hasValidPrice) {
    const installmentValue = numericPrice / WHATSAPP_CONFIG.MAX_INSTALLMENTS;
    installmentsSpan.appendChild(document.createTextNode('ou em até '));

    const strongInstallment = document.createElement('strong');
    strongInstallment.textContent = `${WHATSAPP_CONFIG.MAX_INSTALLMENTS}x de ${formatPriceBRL(installmentValue)}`;
    installmentsSpan.appendChild(strongInstallment);

    installmentsSpan.appendChild(document.createTextNode(' sem juros'));
  } else {
    installmentsSpan.textContent = 'Consulte condições pelo WhatsApp';
  }

  priceBox.appendChild(priceLabel);
  priceBox.appendChild(priceValue);
  priceBox.appendChild(installmentsSpan);
  footerContainer.appendChild(priceBox);

  // 5. Botões de Ação (.product-card__actions)
  const actionsContainer = document.createElement('div');
  actionsContainer.className = 'product-card__actions';

  const detailsBtn = document.createElement('a');
  detailsBtn.className = 'product-card__btn product-card__btn--details';
  detailsBtn.href = productDetailUrl;
  detailsBtn.setAttribute('aria-label', `Ver detalhes e bula de ${productName}`);

  const eyeIcon = document.createElement('i');
  eyeIcon.className = 'fa-solid fa-circle-info';
  eyeIcon.setAttribute('aria-hidden', 'true');
  detailsBtn.appendChild(eyeIcon);
  detailsBtn.appendChild(document.createTextNode(' Ver Detalhes'));

  const whatsappBtn = document.createElement('a');
  whatsappBtn.className = 'product-card__btn';
  whatsappBtn.href = whatsappUrl;
  whatsappBtn.target = '_blank';
  whatsappBtn.rel = 'noopener noreferrer';
  whatsappBtn.dataset.wa = 'vitrine-produto';
  whatsappBtn.setAttribute(
    'aria-label',
    `Pedir ${productName} pelo WhatsApp por ${formatPriceBRL(numericPrice)}`
  );

  const waIcon = document.createElement('i');
  waIcon.className = 'fa-brands fa-whatsapp';
  waIcon.setAttribute('aria-hidden', 'true');

  whatsappBtn.appendChild(waIcon);
  whatsappBtn.appendChild(document.createTextNode(' Tenho interesse'));

  actionsContainer.appendChild(detailsBtn);
  actionsContainer.appendChild(whatsappBtn);
  footerContainer.appendChild(actionsContainer);
  bodyContainer.appendChild(footerContainer);
  article.appendChild(bodyContainer);

  return article;
}

/* ==========================================================================
   4.5. RENDERIZAÇÃO DINÂMICA DO CARROSSEL PRINCIPAL (100% SUPABASE)
   ========================================================================== */

function sanitizeBannerLink(rawUrl) {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return '';
  if (/^(javascript|data|vbscript):/i.test(trimmed)) return '';
  return trimmed;
}

function resolveCarouselSlideImageUrl(slide) {
  const directUrl = String(slide?.image_url || '').trim();
  if (directUrl) return directUrl;

  const storagePath = String(slide?.image_path || '').trim();
  if (storagePath) {
    const publicUrl = getPublicImageUrl(storagePath);
    if (publicUrl) return publicUrl;
  }

  return '';
}

function resolveCarouselSlideMobileImageUrl(slide) {
  const directMobileUrl = String(slide?.mobile_image_url || '').trim();
  if (directMobileUrl) return directMobileUrl;

  const mobileStoragePath = String(slide?.mobile_image_path || '').trim();
  if (mobileStoragePath) {
    const publicUrl = getPublicImageUrl(mobileStoragePath);
    if (publicUrl) return publicUrl;
  }

  return '';
}

function createHeroCarouselSlideElement(slide, index) {
  const imageUrl = resolveCarouselSlideImageUrl(slide);
  if (!imageUrl) return null;

  const mobileImageUrl = resolveCarouselSlideMobileImageUrl(slide);

  const slideEl = document.createElement('div');
  slideEl.className = mobileImageUrl
    ? 'swiper-slide promo__slide promo__slide--has-mobile-art'
    : 'swiper-slide promo__slide';
  slideEl.dataset.slideId = String(slide.id || '');

  const altText =
    String(slide.title || '').trim() ||
    'Destaque Botica Natural — Farmácia de Manipulação';
  const safeHref = sanitizeBannerLink(slide.button_link);

  /** @type {HTMLAnchorElement | HTMLDivElement} */
  let wrapperEl;
  if (safeHref) {
    const anchor = document.createElement('a');
    anchor.className = 'promo__link';
    anchor.href = safeHref;
    anchor.setAttribute('aria-label', altText);
    if (/^https?:\/\//i.test(safeHref)) {
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
    }
    wrapperEl = anchor;
  } else {
    const divWrap = document.createElement('div');
    divWrap.className = 'promo__link';
    wrapperEl = divWrap;
  }

  const picture = document.createElement('picture');
  picture.className = 'promo__picture';

  if (mobileImageUrl) {
    const sourceMobile = document.createElement('source');
    sourceMobile.media = '(max-width: 767px)';
    sourceMobile.srcset = mobileImageUrl;
    picture.appendChild(sourceMobile);
  }

  const img = document.createElement('img');
  img.className = 'promo__img';
  img.src = imageUrl;
  img.alt = altText;
  img.width = 1920;
  img.height = 600;

  if (index === 0) {
    img.loading = 'eager';
    img.setAttribute('fetchpriority', 'high');
    img.decoding = 'sync';
  } else {
    img.loading = 'lazy';
    img.decoding = 'async';
  }

  picture.appendChild(img);
  wrapperEl.appendChild(picture);
  slideEl.appendChild(wrapperEl);

  return slideEl;
}

function syncHeroSwiperInstance(carouselEl, slideCount) {
  if (!carouselEl || typeof window === 'undefined') return;

  const SwiperConstructor = /** @type {any} */ (window).Swiper;
  const hasMultipleSlides = slideCount > 1;
  const prefersReducedMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (typeof SwiperConstructor !== 'function') {
    window.addEventListener(
      'load',
      () => syncHeroSwiperInstance(carouselEl, slideCount),
      { once: true }
    );
    return;
  }

  const existingSwiper = /** @type {any} */ (carouselEl).swiper;
  if (existingSwiper && typeof existingSwiper.destroy === 'function') {
    existingSwiper.destroy(true, true);
  }

  const swiperInstance = new SwiperConstructor(carouselEl, {
    loop: hasMultipleSlides,
    speed: prefersReducedMotion ? 0 : 650,
    grabCursor: hasMultipleSlides,
    watchOverflow: true,
    observer: true,
    observeParents: true,
    resizeObserver: true,
    slidesPerView: 1,
    spaceBetween: 0,
    autoplay:
      hasMultipleSlides && !prefersReducedMotion
        ? {
            delay: 4500,
            disableOnInteraction: false,
            pauseOnMouseEnter: true,
          }
        : false,
    pagination: {
      el: '.promo__pagination',
      clickable: true,
    },
    navigation: {
      nextEl: '.promo__nav--next',
      prevEl: '.promo__nav--prev',
    },
    keyboard: {
      enabled: true,
      onlyInViewport: true,
    },
    a11y: {
      prevSlideMessage: 'Banner anterior',
      nextSlideMessage: 'Próximo banner',
      firstSlideMessage: 'Este é o primeiro banner',
      lastSlideMessage: 'Este é o último banner',
      paginationBulletMessage: 'Ir para o banner {{index}}',
    },
  });

  if (swiperInstance && typeof swiperInstance.update === 'function') {
    swiperInstance.update();
  }
}

/**
 * Renderiza exclusivamente os slides ativos vindos do banco de dados (`carousel_slides`).
 * Se não houver nenhum slide ativo cadastrado no Painel Admin, oculta a seção `.promo`.
 */
function renderHeroCarousel() {
  const promoSection = document.getElementById('inicio') || document.querySelector('.promo');
  const carouselEl =
    document.getElementById('hero-carousel') ||
    document.querySelector('.promo__carousel');
  if (!carouselEl) return;

  const wrapperEl =
    document.getElementById('hero-carousel-wrapper') ||
    carouselEl.querySelector('.swiper-wrapper');
  if (!wrapperEl) return;

  const activeSlides = Array.isArray(catalogState.carouselSlides)
    ? catalogState.carouselSlides
    : [];

  const fragment = document.createDocumentFragment();
  let validSlideCount = 0;

  activeSlides.forEach((slide, index) => {
    const slideNode = createHeroCarouselSlideElement(slide, index);
    if (slideNode) {
      fragment.appendChild(slideNode);
      validSlideCount += 1;
    }
  });

  const currentSwiper = /** @type {any} */ (carouselEl).swiper;
  if (currentSwiper && typeof currentSwiper.destroy === 'function') {
    currentSwiper.destroy(true, true);
  }

  // Se não houver banners ativos no banco, oculta a seção do carrossel
  if (validSlideCount === 0) {
    wrapperEl.replaceChildren();
    carouselEl.setAttribute('aria-busy', 'false');
    if (promoSection) promoSection.hidden = true;
    return;
  }

  if (promoSection) promoSection.hidden = false;
  wrapperEl.replaceChildren(fragment);
  carouselEl.setAttribute('aria-busy', 'false');
  syncHeroSwiperInstance(/** @type {HTMLElement} */ (carouselEl), validSlideCount);
}

/* ==========================================================================
   5. RENDERIZAÇÃO DA SEÇÃO "MAIS VENDIDOS" (100% SUPABASE)
   ========================================================================== */

function renderBestSellers() {
  const bestSellersSection = document.getElementById('mais-vendidos');
  const container =
    document.getElementById('bestsellers-grid') ||
    document.querySelector('[data-bestsellers-grid]');

  if (!bestSellersSection || !container) return;

  let featuredProducts = catalogState.products.filter(
    (product) => Boolean(product.is_best_seller)
  );

  if (featuredProducts.length === 0 && catalogState.products.length > 0) {
    featuredProducts = catalogState.products.slice(0, WHATSAPP_CONFIG.MAX_BESTSELLERS);
  } else {
    featuredProducts = featuredProducts.slice(0, WHATSAPP_CONFIG.MAX_BESTSELLERS);
  }

  if (featuredProducts.length === 0) {
    container.replaceChildren();
    bestSellersSection.hidden = true;
    container.setAttribute('aria-busy', 'false');
    return;
  }

  bestSellersSection.hidden = false;

  const isSwiperWrapper =
    container.classList.contains('swiper-wrapper') ||
    Boolean(container.closest('.swiper'));

  const fragment = document.createDocumentFragment();

  featuredProducts.forEach((product) => {
    const cardEl = createProductCardElement(product);

    if (isSwiperWrapper) {
      const slideWrapper = document.createElement('div');
      slideWrapper.className = 'swiper-slide';
      slideWrapper.appendChild(cardEl);
      fragment.appendChild(slideWrapper);
    } else {
      fragment.appendChild(cardEl);
    }
  });

  container.replaceChildren(fragment);
  container.setAttribute('aria-busy', 'false');

  const swiperRoot = container.closest('.swiper');
  if (swiperRoot && swiperRoot.swiper && typeof swiperRoot.swiper.update === 'function') {
    swiperRoot.swiper.update();
  }
}

/* ==========================================================================
   6. RENDERIZAÇÃO DE CATÁLOGO E CATEGORIAS (100% SUPABASE)
   ========================================================================== */

function createCategoryFilterButton({ id, slug, name, count, isActive }) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `catalog-tab${isActive ? ' active is-active' : ''}`;
  button.dataset.category = String(id);
  if (slug) button.dataset.slug = String(slug);
  button.setAttribute('aria-pressed', String(Boolean(isActive)));

  if (id === 'all') {
    const icon = document.createElement('i');
    icon.className = 'fa-solid fa-shapes';
    icon.setAttribute('aria-hidden', 'true');
    button.appendChild(icon);
  }

  const labelSpan = document.createElement('span');
  labelSpan.textContent = name;
  button.appendChild(labelSpan);

  const countBadge = document.createElement('span');
  countBadge.className = 'catalog-tab__count';
  countBadge.textContent = String(count);
  button.appendChild(countBadge);

  button.addEventListener('click', () => {
    handleCategorySelection(String(id));
  });

  return button;
}

function renderCategoryFilters() {
  const filtersContainer =
    document.getElementById('category-filters') ||
    document.querySelector('[data-catalog-tabs]');

  if (!filtersContainer) return;

  const fragment = document.createDocumentFragment();

  const allButton = createCategoryFilterButton({
    id: 'all',
    slug: 'todos',
    name: 'Todos',
    count: catalogState.products.length,
    isActive: catalogState.activeCategory === 'all',
  });
  fragment.appendChild(allButton);

  catalogState.categories.forEach((category) => {
    const categoryId = String(category.id);
    const productCount = catalogState.products.filter(
      (prod) => String(prod.category_id) === categoryId
    ).length;

    const categoryBtn = createCategoryFilterButton({
      id: categoryId,
      slug: String(category.slug || ''),
      name: String(category.name || '').trim(),
      count: productCount,
      isActive: catalogState.activeCategory === categoryId,
    });

    fragment.appendChild(categoryBtn);
  });

  filtersContainer.replaceChildren(fragment);
}

function handleCategorySelection(selectedCategoryId) {
  if (catalogState.activeCategory === selectedCategoryId) return;

  catalogState.activeCategory = selectedCategoryId;

  const filtersContainer =
    document.getElementById('category-filters') ||
    document.querySelector('[data-catalog-tabs]');

  if (filtersContainer) {
    const buttons = filtersContainer.querySelectorAll('.catalog-tab');
    buttons.forEach((btn) => {
      const isSelected = btn.dataset.category === selectedCategoryId;
      btn.classList.toggle('active', isSelected);
      btn.classList.toggle('is-active', isSelected);
      btn.setAttribute('aria-pressed', String(isSelected));
    });
  }

  renderCatalogProducts();
}

/**
 * Sincroniza o filtro inicial caso a URL possua hash (ex: produtos.html#dermocosmeticos)
 */
function syncCategoryFromUrlHash() {
  try {
    const rawHash = decodeURIComponent(window.location.hash.replace(/^#/, '')).trim().toLowerCase();
    if (!rawHash || rawHash === 'todos' || rawHash === 'all') return;

    const matchedCategory = catalogState.categories.find(
      (cat) =>
        String(cat.id).toLowerCase() === rawHash ||
        String(cat.slug || '').toLowerCase() === rawHash
    );

    if (matchedCategory) {
      catalogState.activeCategory = String(matchedCategory.id);
    }
  } catch {
    /* Ignora hashes malformados */
  }
}

function renderCatalogProducts() {
  const catalogGrid =
    document.getElementById('catalog-grid') ||
    document.querySelector('[data-catalog-grid]');

  if (!catalogGrid) return;

  const emptyStateEl =
    document.getElementById('catalog-empty') ||
    document.querySelector('[data-catalog-empty]');
  const countLabelEl =
    document.getElementById('catalog-count') ||
    document.querySelector('[data-catalog-count]');

  const normalizedQuery = normalizeText(catalogState.searchQuery);

  const filteredProducts = catalogState.products.filter((product) => {
    const matchesCategory =
      catalogState.activeCategory === 'all' ||
      String(product.category_id) === String(catalogState.activeCategory);

    if (!matchesCategory) return false;

    if (!normalizedQuery) return true;

    const searchableText = normalizeText(
      `${product.name || ''} ${product.short_description || ''} ${product.description || ''} ${resolveProductCategoryName(product)}`
    );
    return searchableText.includes(normalizedQuery);
  });

  if (countLabelEl) {
    const total = filteredProducts.length;
    countLabelEl.textContent =
      total === 1 ? 'Exibindo 1 fórmula disponível' : `Exibindo ${total} fórmulas disponíveis`;
  }

  if (filteredProducts.length === 0) {
    catalogGrid.replaceChildren();
    catalogGrid.hidden = true;
    catalogGrid.setAttribute('aria-busy', 'false');

    if (emptyStateEl) {
      const emptyTitle = emptyStateEl.querySelector('.catalog-empty__title');
      if (emptyTitle) {
        emptyTitle.textContent = normalizedQuery
          ? 'Nenhum produto encontrado para sua busca.'
          : 'Nenhum produto cadastrado nesta categoria no momento.';
      }
      emptyStateEl.hidden = false;
    }
    return;
  }

  if (emptyStateEl) {
    emptyStateEl.hidden = true;
  }

  const fragment = document.createDocumentFragment();
  filteredProducts.forEach((product) => {
    fragment.appendChild(createProductCardElement(product));
  });

  catalogGrid.hidden = false;
  catalogGrid.replaceChildren(fragment);
  catalogGrid.setAttribute('aria-busy', 'false');
}

/* ==========================================================================
   7. BUSCA EM PARALELO NO SUPABASE (PROMISE.ALL) E INICIALIZAÇÃO
   ========================================================================== */

async function loadCatalogData() {
  catalogState.isLoading = true;

  const configured =
    typeof isSupabaseConfigured === 'function'
      ? isSupabaseConfigured()
      : Boolean(isSupabaseConfigured);

  if (!configured) {
    console.warn(
      '[Botica Natural] Credenciais do Supabase pendentes. Nenhum produto ou banner será exibido até configurar o banco.'
    );
    catalogState.carouselSlides = [];
    catalogState.categories = [];
    catalogState.products = [];
    catalogState.isLoading = false;
    return;
  }

  try {
    const [carouselResponse, categoriesResponse, productsResponse] = await Promise.all([
      supabase
        .from(DB_TABLES.CAROUSEL)
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false }),

      supabase
        .from(DB_TABLES.CATEGORIES)
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true })
        .order('name', { ascending: true }),

      supabase
        .from(DB_TABLES.PRODUCTS)
        .select('*, categories(id, name, slug)')
        .eq('is_active', true)
        .order('created_at', { ascending: false }),

      fetchProductWhatsAppTemplate(),
    ]);

    catalogState.carouselSlides =
      !carouselResponse.error && Array.isArray(carouselResponse.data)
        ? carouselResponse.data
        : [];

    if (categoriesResponse.error) {
      throw categoriesResponse.error;
    }

    if (productsResponse.error) {
      throw productsResponse.error;
    }

    catalogState.categories = Array.isArray(categoriesResponse.data)
      ? categoriesResponse.data
      : [];
    catalogState.products = Array.isArray(productsResponse.data)
      ? productsResponse.data
      : [];
  } catch (err) {
    const normalizedErr = normalizeSupabaseError(err);
    console.error('[Botica Natural] Erro ao carregar dados do Supabase:', normalizedErr);
    catalogState.carouselSlides = [];
    catalogState.categories = [];
    catalogState.products = [];
  } finally {
    catalogState.isLoading = false;
  }
}

function initCatalogSearchListeners() {
  const searchInput = document.querySelector('[data-catalog-search]');
  const clearBtn = document.querySelector('.catalog-search-clear');

  if (!searchInput) return;

  searchInput.addEventListener('input', (event) => {
    const target = /** @type {HTMLInputElement | null} */ (event.target);
    catalogState.searchQuery = target?.value || '';
    if (clearBtn) {
      clearBtn.classList.toggle('is-visible', catalogState.searchQuery.trim().length > 0);
    }
    renderCatalogProducts();
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      catalogState.searchQuery = '';
      clearBtn.classList.remove('is-visible');
      renderCatalogProducts();
      searchInput.focus();
    });
  }
}

async function initPublicStorefront() {
  const hasHeroCarousel = Boolean(
    document.getElementById('hero-carousel') ||
      document.querySelector('.promo__carousel')
  );

  const hasBestsellersSection = Boolean(
    document.getElementById('mais-vendidos') ||
      document.getElementById('bestsellers-grid') ||
      document.querySelector('[data-bestsellers-grid]')
  );

  const hasCatalogSection = Boolean(
    document.getElementById('catalog-grid') ||
      document.querySelector('[data-catalog-grid]')
  );

  if (!hasHeroCarousel && !hasBestsellersSection && !hasCatalogSection) return;

  if (hasCatalogSection) {
    initCatalogSearchListeners();
  }

  await loadCatalogData();

  if (hasHeroCarousel) {
    renderHeroCarousel();
  }

  if (hasBestsellersSection) {
    renderBestSellers();
  }

  if (hasCatalogSection) {
    syncCategoryFromUrlHash();
    renderCategoryFilters();
    renderCatalogProducts();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPublicStorefront);
} else {
  initPublicStorefront();
}