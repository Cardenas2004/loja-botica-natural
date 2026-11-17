/**
 * @fileoverview Motor Dinâmico da Vitrine Pública — Botica Natural (100% Supabase Driven)
 * @description Conecta a Landing Page (`index.html`) e o Catálogo (`produtos.html`) exclusivamente
 * ao banco de dados PostgreSQL + Storage do Supabase. Nenhum banner ou produto é fixo no código.
 *
 * @module js/app
 */

import {
  isSupabaseConfigured,
  getPublicImageUrl,
  resolveSafeStorageImageUrl,
  normalizeSupabaseError,
  fetchActiveCarouselSlides,
  fetchActiveCategories,
  fetchActiveProducts,
  fetchActiveCompoundCards,
} from './publicApi.js';

import {
  buildProductWhatsAppUrl as buildCentralProductWhatsAppUrl,
  buildProductDetailHref,
  buildFallbackProductHref,
  extractProductSlugFromHref,
  fetchProductWhatsAppTemplate,
  getBuiltProductSlugs,
  loadBuiltProductSlugs,
  normalizeProductSlug,
  resolveSafeProductHref,
} from './whatsapp.js';

import {
  BRAND_NAME,
  SITE_DOMAIN,
  WHATSAPP_PHONE,
  DEFAULT_WHATSAPP_GREETING,
  SITE_CONFIG,
} from './config.js';

import { extractPlainText } from './shared/richtext.js';
import { classifySafeLink, isSafeNavigationLink } from './shared/urlSafety.js';
import { createCategoryIconElement } from './shared/categoryIcons.js';
import {
  DEFAULT_COMPOUND_CARDS,
  createCompoundCardElement,
} from './shared/compoundShowcaseRenderer.js';

/* ==========================================================================
   1. CONFIGURAÇÕES GLOBAIS E FORMATAÇÃO (SINGLE SOURCE OF TRUTH)
   ========================================================================== */

export const WHATSAPP_CONFIG = Object.freeze({
  PHONE_NUMBER: WHATSAPP_PHONE,
  BASE_URL: SITE_CONFIG.WHATSAPP_BASE_URL,
  SHOW_INSTALLMENTS: SITE_CONFIG.SHOW_INSTALLMENTS,
  MAX_INSTALLMENTS: SITE_CONFIG.MAX_INSTALLMENTS,
  MAX_BESTSELLERS: SITE_CONFIG.MAX_BESTSELLERS,
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
  /** @type {Array<any>} */
  carouselSlides: [],
  /** @type {Array<any>} */
  categories: [],
  /** @type {Array<any>} */
  products: [],
  /** @type {Array<any>} Cards ativos da Vitrine de Compostos Manipulados */
  compoundCards: [],
  /** @type {boolean} Indica se os cards de compostos vieram do banco de dados */
  compoundCardsLoadedFromDb: false,
  /** @type {string} ID da categoria selecionada ('all' por padrão) */
  activeCategory: 'all',
  /** @type {string} Termo de busca textual em tempo real */
  searchQuery: '',
  /** @type {number} Página atual da listagem do catálogo */
  currentPage: 1,
  /** @type {number} Quantidade de produtos por página no catálogo */
  pageSize: 24,
  /** @type {boolean} Controle de estado de carregamento */
  isLoading: true,
  /** @type {boolean} Indica falha de conexão/consulta ao Supabase */
  hasError: false,
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
  return resolveSafeStorageImageUrl(
    product?.image_url,
    product?.image_path,
    FALLBACK_PRODUCT_IMAGE
  );
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
  const productDescription =
    extractPlainText(product?.short_description || product?.description) ||
    'Fórmula manipulada sob medida com matérias-primas certificadas e rigoroso controle de qualidade farmacêutico.';
  const categoryName = resolveProductCategoryName(product);
  const numericPrice = Number(product?.price);
  const hasValidPrice = Number.isFinite(numericPrice) && numericPrice > 0;
  const whatsappUrl = buildProductWhatsAppUrl(product);
  const productDetailUrl = buildProductDetailHref(product);

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
  // REVISAR COM RT: RDC 67/2007 e normas de publicidade da Anvisa (exibição de preços de fórmulas manipuladas vs. "Sob consulta")
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

  if (hasValidPrice && WHATSAPP_CONFIG.SHOW_INSTALLMENTS) {
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
    `Tenho interesse em ${productName} via WhatsApp por ${formatPriceBRL(numericPrice)}`
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

/**
 * Valida o link de um banner por whitelist estrita via `classifySafeLink` (`js/shared/urlSafety.js`).
 * Rejeita `javascript:`, `data:`, `vbscript:`, URLs protocol-relative (`//`, `/\`, `\/`) e caracteres de controle.
 *
 * @param {string | null | undefined} rawUrl
 * @returns {string}
 */
function sanitizeBannerLink(rawUrl) {
  if (!isSafeNavigationLink(rawUrl, { allowEmpty: false })) {
    return '';
  }
  const classified = classifySafeLink(rawUrl);
  return classified.valid && classified.href ? classified.href : '';
}

function resolveCarouselSlideImageUrl(slide) {
  return resolveSafeStorageImageUrl(slide?.image_url, slide?.image_path, '');
}

function createHeroCarouselSlideElement(slide, index, carouselEl) {
  const imageUrl = resolveCarouselSlideImageUrl(slide);
  if (!imageUrl) return null;

  const slideEl = document.createElement('div');
  slideEl.className = 'promo__slide';
  slideEl.dataset.slideId = String(slide.id || '');
  slideEl.dataset.slideIndex = String(index);

  const altText =
    String(slide.title || '').trim() ||
    'Destaque Botica Natural — Farmácia de Manipulação';
  const safeHref = resolveSafeProductHref(
    sanitizeBannerLink(slide.button_link),
    catalogState.products
  );
  const safeHrefInfo = safeHref ? classifySafeLink(safeHref) : null;

  /** @type {HTMLAnchorElement | HTMLDivElement} */
  let wrapperEl;
  if (safeHref && safeHrefInfo?.valid) {
    const anchor = document.createElement('a');
    anchor.className = 'promo__link';
    anchor.href = safeHref;
    anchor.draggable = false;
    anchor.setAttribute('aria-label', altText);
    if (safeHrefInfo.isExternal || safeHrefInfo.kind === 'https' || safeHrefInfo.kind === 'http') {
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

  const img = document.createElement('img');
  img.className = 'promo__img';
  img.src = imageUrl;
  img.alt = altText;
  img.draggable = false;
  img.width = 1920;
  img.height = 600;

  if (index === 0) {
    img.loading = 'eager';
    img.setAttribute('fetchpriority', 'high');
    img.decoding = 'sync';

    // Ajusta automaticamente a proporção do carrossel (desktop e mobile) ao banner real carregado
    if (carouselEl) {
      const syncCarouselAspect = () => {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        if (w >= 200 && h > 0) {
          const ratio = w / h;
          if (ratio >= 1.33 && ratio <= 4.2) {
            img.width = w;
            img.height = h;
            carouselEl.style.setProperty('--promo-aspect', `${w} / ${h}`);
          }
        }
      };
      if (img.complete && img.naturalWidth > 0) {
        syncCarouselAspect();
      } else {
        img.addEventListener('load', syncCarouselAspect, { once: true });
      }
    }
  } else {
    img.loading = 'lazy';
    img.decoding = 'async';
  }

  picture.appendChild(img);
  wrapperEl.appendChild(picture);
  slideEl.appendChild(wrapperEl);

  return slideEl;
}

/** @type {(() => void) | null} */
let destroyHeroCarouselController = null;

function initNativeHeroCarousel(carouselEl, wrapperEl, slideCount) {
  if (destroyHeroCarouselController) {
    destroyHeroCarouselController();
    destroyHeroCarouselController = null;
  }

  if (!carouselEl || !wrapperEl || typeof window === 'undefined') return;

  const paginationEl =
    carouselEl.querySelector('#hero-carousel-pagination') ||
    carouselEl.querySelector('.promo__pagination');
  const prevBtn = /** @type {HTMLButtonElement | null} */ (
    carouselEl.querySelector('[data-hero-carousel-prev]') ||
      carouselEl.querySelector('.promo__nav--prev')
  );
  const nextBtn = /** @type {HTMLButtonElement | null} */ (
    carouselEl.querySelector('[data-hero-carousel-next]') ||
      carouselEl.querySelector('.promo__nav--next')
  );

  const hasMultipleSlides = slideCount > 1;
  const reducedMotionMQ =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;
  let prefersReducedMotion = Boolean(reducedMotionMQ?.matches);

  let currentIndex = 0;
  let isHoverPaused = false;
  let isFocusPaused = false;
  let isTouchInteracting = false;
  let lastInputWasPointer = false;
  /** @type {number | null} */
  let pointerResetTimerId = null;
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  let touchStartIndex = 0;
  let didHorizontalDrag = false;
  /** @type {number | null} */
  let autoplayTimerId = null;
  /** @type {number | null} */
  let scrollRafId = null;
  /** @type {number | null} */
  let resizeRafId = null;
  /** @type {number | null} */
  let programmaticTargetIdx = null;
  /** @type {number | null} */
  let programmaticTimerId = null;

  const slides = Array.from(wrapperEl.querySelectorAll('.promo__slide'));
  /** @type {HTMLButtonElement[]} */
  const bullets = [];

  if (paginationEl) {
    const bulletFrag = document.createDocumentFragment();
    if (hasMultipleSlides) {
      for (let i = 0; i < slideCount; i++) {
        const bullet = document.createElement('button');
        bullet.type = 'button';
        bullet.className = `promo__bullet${i === 0 ? ' is-active' : ''}`;
        bullet.setAttribute('aria-label', `Ir para o banner ${i + 1}`);
        if (i === 0) {
          bullet.setAttribute('aria-current', 'true');
        }
        bullet.addEventListener('click', () => {
          goToSlide(i);
          restartAutoplayIfAllowed();
        });
        bullets.push(bullet);
        bulletFrag.appendChild(bullet);
      }
    }
    paginationEl.replaceChildren(bulletFrag);
    /** @type {HTMLElement} */ (paginationEl).hidden = !hasMultipleSlides;
  }

  if (prevBtn) prevBtn.hidden = !hasMultipleSlides;
  if (nextBtn) nextBtn.hidden = !hasMultipleSlides;

  function syncActiveIndicators() {
    bullets.forEach((b, idx) => {
      const active = idx === currentIndex;
      b.classList.toggle('is-active', active);
      if (active) {
        b.setAttribute('aria-current', 'true');
      } else {
        b.removeAttribute('aria-current');
      }
    });
    slides.forEach((s, idx) => {
      const active = idx === currentIndex;
      s.classList.toggle('is-active', active);
      s.dataset.active = String(active);
    });
    carouselEl.dataset.activeSlide = String(currentIndex);
  }

  function clearProgrammaticScrollLock() {
    programmaticTargetIdx = null;
    if (programmaticTimerId !== null) {
      window.clearTimeout(programmaticTimerId);
      programmaticTimerId = null;
    }
  }

  function goToSlide(/** @type {number} */ targetIdx, options = {}) {
    if (slideCount <= 0) return;
    currentIndex = ((targetIdx % slideCount) + slideCount) % slideCount;
    syncActiveIndicators();

    const slideWidth = wrapperEl.clientWidth || carouselEl.clientWidth || 0;
    const targetLeft = currentIndex * slideWidth;
    clearProgrammaticScrollLock();
    if (Math.abs(wrapperEl.scrollLeft - targetLeft) > 2) {
      programmaticTargetIdx = currentIndex;
      programmaticTimerId = window.setTimeout(() => {
        programmaticTargetIdx = null;
        programmaticTimerId = null;
      }, 800);
    }
    try {
      wrapperEl.scrollTo({
        left: targetLeft,
        behavior: options.instant || prefersReducedMotion ? 'auto' : 'smooth',
      });
    } catch {
      clearProgrammaticScrollLock();
      wrapperEl.scrollLeft = targetLeft;
    }
  }

  function stopAutoplayTimer() {
    if (autoplayTimerId !== null) {
      window.clearInterval(autoplayTimerId);
      autoplayTimerId = null;
    }
  }

  function canAutoplayRun() {
    return (
      hasMultipleSlides &&
      !prefersReducedMotion &&
      !isHoverPaused &&
      !isFocusPaused &&
      !isTouchInteracting &&
      !document.hidden
    );
  }

  function markPointerInteraction() {
    lastInputWasPointer = true;
    if (pointerResetTimerId !== null) {
      window.clearTimeout(pointerResetTimerId);
    }
    pointerResetTimerId = window.setTimeout(() => {
      lastInputWasPointer = false;
      pointerResetTimerId = null;
    }, 600);
  }

  function startAutoplayTimer() {
    stopAutoplayTimer();
    if (!canAutoplayRun()) return;
    autoplayTimerId = window.setInterval(() => {
      goToSlide(currentIndex + 1);
    }, 4500);
  }

  function restartAutoplayIfAllowed() {
    stopAutoplayTimer();
    startAutoplayTimer();
  }

  const onPrevClick = () => {
    goToSlide(currentIndex - 1);
    restartAutoplayIfAllowed();
  };

  const onNextClick = () => {
    goToSlide(currentIndex + 1);
    restartAutoplayIfAllowed();
  };

  const onKeyDown = (/** @type {KeyboardEvent} */ e) => {
    lastInputWasPointer = false;
    if (!hasMultipleSlides) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      goToSlide(currentIndex + 1);
      restartAutoplayIfAllowed();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goToSlide(currentIndex - 1);
      restartAutoplayIfAllowed();
    }
  };

  const onPointerDownCapture = () => {
    markPointerInteraction();
  };

  const onPointerEnter = (/** @type {PointerEvent} */ e) => {
    if (e.pointerType !== 'mouse') return;
    isHoverPaused = true;
    stopAutoplayTimer();
  };

  const onPointerLeave = (/** @type {PointerEvent} */ e) => {
    if (e.pointerType !== 'mouse') return;
    isHoverPaused = false;
    startAutoplayTimer();
  };

  const onFocusIn = (/** @type {FocusEvent} */ e) => {
    const target = /** @type {Element | null} */ (e.target);
    const isFocusVisible = Boolean(
      target && typeof target.matches === 'function' && target.matches(':focus-visible')
    );
    if (lastInputWasPointer && !isFocusVisible) return;
    isFocusPaused = true;
    stopAutoplayTimer();
  };

  const onFocusOut = (/** @type {FocusEvent} */ e) => {
    const nextTarget = /** @type {Node | null} */ (e.relatedTarget);
    if (!nextTarget || !carouselEl.contains(nextTarget)) {
      isFocusPaused = false;
      startAutoplayTimer();
    }
  };

  const onTouchStart = (/** @type {TouchEvent} */ e) => {
    markPointerInteraction();
    if (!hasMultipleSlides || e.touches.length !== 1) return;
    const t = e.touches[0];
    isTouchInteracting = true;
    isHoverPaused = false;
    isFocusPaused = false;
    didHorizontalDrag = false;
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    touchStartTime = Date.now();
    touchStartIndex = currentIndex;
    clearProgrammaticScrollLock();
    stopAutoplayTimer();
  };

  const onTouchMove = (/** @type {TouchEvent} */ e) => {
    if (!isTouchInteracting || e.touches.length !== 1) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
      didHorizontalDrag = true;
    }
  };

  const finishTouchInteraction = (/** @type {TouchEvent} */ e) => {
    if (!isTouchInteracting) return;
    const changed = e.changedTouches && e.changedTouches[0];
    const endDx = changed ? changed.clientX - touchStartX : 0;
    const endDy = changed ? changed.clientY - touchStartY : 0;
    const elapsed = Date.now() - touchStartTime;
    const w = wrapperEl.clientWidth || carouselEl.clientWidth || 1;
    const nearestIdx = Math.round(wrapperEl.scrollLeft / w);
    const maxScroll = Math.max(0, wrapperEl.scrollWidth - w);
    const isHorizontalGesture = Math.abs(endDx) > Math.abs(endDy) * 1.1;

    isTouchInteracting = false;

    if (hasMultipleSlides && e.type === 'touchend' && isHorizontalGesture) {
      const quickFlick = Math.abs(endDx) >= 32 && elapsed < 500;
      const deliberateSwipe = Math.abs(endDx) >= Math.min(56, w * 0.14);
      if (touchStartIndex === 0 && endDx > 36 && wrapperEl.scrollLeft <= 2) {
        goToSlide(slideCount - 1);
      } else if (
        touchStartIndex === slideCount - 1 &&
        endDx < -36 &&
        wrapperEl.scrollLeft >= maxScroll - 2
      ) {
        goToSlide(0);
      } else if (nearestIdx === touchStartIndex && (quickFlick || deliberateSwipe)) {
        goToSlide(endDx < 0 ? touchStartIndex + 1 : touchStartIndex - 1);
      } else if (nearestIdx >= 0 && nearestIdx < slideCount && nearestIdx !== currentIndex) {
        currentIndex = nearestIdx;
        syncActiveIndicators();
      }
    } else if (nearestIdx >= 0 && nearestIdx < slideCount && nearestIdx !== currentIndex) {
      currentIndex = nearestIdx;
      syncActiveIndicators();
    }

    restartAutoplayIfAllowed();

    if (didHorizontalDrag) {
      window.setTimeout(() => {
        didHorizontalDrag = false;
      }, 60);
    }
  };

  const onTrackClickCapture = (/** @type {MouseEvent} */ e) => {
    if (didHorizontalDrag) {
      e.preventDefault();
      e.stopPropagation();
      didHorizontalDrag = false;
    }
  };

  const onScroll = () => {
    if (scrollRafId !== null) cancelAnimationFrame(scrollRafId);
    scrollRafId = requestAnimationFrame(() => {
      const w = wrapperEl.clientWidth || 1;
      if (programmaticTargetIdx !== null) {
        if (Math.abs(wrapperEl.scrollLeft - programmaticTargetIdx * w) <= 2) {
          clearProgrammaticScrollLock();
        }
        return;
      }
      const idx = Math.round(wrapperEl.scrollLeft / w);
      if (idx >= 0 && idx < slideCount && idx !== currentIndex) {
        currentIndex = idx;
        syncActiveIndicators();
      }
    });
  };

  const onScrollEnd = () => {
    clearProgrammaticScrollLock();
    const w = wrapperEl.clientWidth || 1;
    const idx = Math.round(wrapperEl.scrollLeft / w);
    if (idx >= 0 && idx < slideCount && idx !== currentIndex) {
      currentIndex = idx;
      syncActiveIndicators();
    }
  };

  const onWindowResize = () => {
    if (resizeRafId !== null) cancelAnimationFrame(resizeRafId);
    resizeRafId = requestAnimationFrame(() => {
      resizeRafId = null;
      const w = wrapperEl.clientWidth || 0;
      if (w > 0 && !isTouchInteracting) {
        clearProgrammaticScrollLock();
        wrapperEl.scrollLeft = currentIndex * w;
      }
    });
  };

  const onVisibilityChange = () => {
    if (document.hidden) stopAutoplayTimer();
    else startAutoplayTimer();
  };

  const onReducedMotionChange = (/** @type {MediaQueryListEvent} */ e) => {
    prefersReducedMotion = e.matches;
    if (prefersReducedMotion) {
      stopAutoplayTimer();
    } else {
      startAutoplayTimer();
    }
  };

  prevBtn?.addEventListener('click', onPrevClick);
  nextBtn?.addEventListener('click', onNextClick);
  carouselEl.addEventListener('keydown', onKeyDown);
  carouselEl.addEventListener('pointerdown', onPointerDownCapture, { capture: true });
  carouselEl.addEventListener('pointerenter', onPointerEnter);
  carouselEl.addEventListener('pointerleave', onPointerLeave);
  carouselEl.addEventListener('focusin', onFocusIn);
  carouselEl.addEventListener('focusout', onFocusOut);
  wrapperEl.addEventListener('touchstart', onTouchStart, { passive: true });
  wrapperEl.addEventListener('touchmove', onTouchMove, { passive: true });
  wrapperEl.addEventListener('touchend', finishTouchInteraction, { passive: true });
  wrapperEl.addEventListener('touchcancel', finishTouchInteraction, { passive: true });
  wrapperEl.addEventListener('click', onTrackClickCapture, { capture: true });
  wrapperEl.addEventListener('scroll', onScroll, { passive: true });
  wrapperEl.addEventListener('scrollend', onScrollEnd, { passive: true });
  window.addEventListener('resize', onWindowResize, { passive: true });
  document.addEventListener('visibilitychange', onVisibilityChange);
  reducedMotionMQ?.addEventListener('change', onReducedMotionChange);

  syncActiveIndicators();
  startAutoplayTimer();

  destroyHeroCarouselController = () => {
    stopAutoplayTimer();
    clearProgrammaticScrollLock();
    if (scrollRafId !== null) cancelAnimationFrame(scrollRafId);
    if (resizeRafId !== null) cancelAnimationFrame(resizeRafId);
    if (pointerResetTimerId !== null) window.clearTimeout(pointerResetTimerId);
    prevBtn?.removeEventListener('click', onPrevClick);
    nextBtn?.removeEventListener('click', onNextClick);
    carouselEl.removeEventListener('keydown', onKeyDown);
    carouselEl.removeEventListener('pointerdown', onPointerDownCapture, { capture: true });
    carouselEl.removeEventListener('pointerenter', onPointerEnter);
    carouselEl.removeEventListener('pointerleave', onPointerLeave);
    carouselEl.removeEventListener('focusin', onFocusIn);
    carouselEl.removeEventListener('focusout', onFocusOut);
    wrapperEl.removeEventListener('touchstart', onTouchStart);
    wrapperEl.removeEventListener('touchmove', onTouchMove);
    wrapperEl.removeEventListener('touchend', finishTouchInteraction);
    wrapperEl.removeEventListener('touchcancel', finishTouchInteraction);
    wrapperEl.removeEventListener('click', onTrackClickCapture, { capture: true });
    wrapperEl.removeEventListener('scroll', onScroll);
    wrapperEl.removeEventListener('scrollend', onScrollEnd);
    window.removeEventListener('resize', onWindowResize);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    reducedMotionMQ?.removeEventListener('change', onReducedMotionChange);
  };
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
    carouselEl.querySelector('.promo__track');
  if (!wrapperEl) return;

  const activeSlides = Array.isArray(catalogState.carouselSlides)
    ? catalogState.carouselSlides
    : [];

  const fragment = document.createDocumentFragment();
  let validSlideCount = 0;

  activeSlides.forEach((slide, index) => {
    const slideNode = createHeroCarouselSlideElement(
      slide,
      index,
      /** @type {HTMLElement} */ (carouselEl)
    );
    if (slideNode) {
      fragment.appendChild(slideNode);
      validSlideCount += 1;
    }
  });

  if (destroyHeroCarouselController) {
    destroyHeroCarouselController();
    destroyHeroCarouselController = null;
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
  initNativeHeroCarousel(
    /** @type {HTMLElement} */ (carouselEl),
    /** @type {HTMLElement} */ (wrapperEl),
    validSlideCount
  );
}

/* ==========================================================================
   5. RENDERIZAÇÃO DA SEÇÃO "MAIS VENDIDOS" (100% SUPABASE)
   ========================================================================== */

/**
 * Cria um bloco de fallback amigável com CTA direto para o WhatsApp quando o Supabase falha.
 * @returns {HTMLElement}
 */
function createStorefrontFallbackElement() {
  const wrapper = document.createElement('div');
  wrapper.className = 'catalog-empty grid-span-full';

  const iconWrap = document.createElement('div');
  iconWrap.className = 'catalog-empty__icon';
  iconWrap.setAttribute('aria-hidden', 'true');
  const icon = document.createElement('i');
  icon.className = 'fa-brands fa-whatsapp';
  iconWrap.appendChild(icon);

  const title = document.createElement('h3');
  title.className = 'catalog-empty__title';
  title.textContent = 'Catálogo em atualização no momento';

  const desc = document.createElement('p');
  desc.className = 'catalog-empty__desc';
  desc.textContent =
    'Não foi possível carregar a vitrine online agora. Fale diretamente com nossa equipe farmacêutica pelo WhatsApp para consultar fórmulas, preços e enviar sua receita.';

  const cta = document.createElement('a');
  cta.className = 'btn btn--primary';
  cta.href = `${WHATSAPP_CONFIG.BASE_URL}/${WHATSAPP_CONFIG.PHONE_NUMBER}?text=${encodeURIComponent(DEFAULT_WHATSAPP_GREETING)}`;
  cta.target = '_blank';
  cta.rel = 'noopener noreferrer';
  cta.dataset.wa = 'fallback-supabase';

  const waIcon = document.createElement('i');
  waIcon.className = 'fa-brands fa-whatsapp';
  waIcon.setAttribute('aria-hidden', 'true');
  cta.append(waIcon, document.createTextNode(' Solicitar atendimento no WhatsApp'));

  wrapper.append(iconWrap, title, desc, cta);
  return wrapper;
}

function renderBestSellers() {
  const bestSellersSection = document.getElementById('mais-vendidos');
  const container =
    document.getElementById('bestsellers-grid') ||
    document.querySelector('[data-bestsellers-grid]');

  if (!bestSellersSection || !container) return;

  const homeFeaturedProducts = catalogState.products
    .filter((product) => Boolean(product.home_featured))
    .sort((a, b) => (Number(a.home_position) || 0) - (Number(b.home_position) || 0));

  const bestSellerProducts = catalogState.products.filter(
    (product) => Boolean(product.is_best_seller) && !product.home_featured
  );

  let featuredProducts = [...homeFeaturedProducts, ...bestSellerProducts];

  if (featuredProducts.length === 0 && catalogState.products.length > 0) {
    featuredProducts = catalogState.products.slice(0, WHATSAPP_CONFIG.MAX_BESTSELLERS);
  } else {
    featuredProducts = featuredProducts.slice(0, WHATSAPP_CONFIG.MAX_BESTSELLERS);
  }

  if (featuredProducts.length === 0) {
    if (catalogState.hasError) {
      bestSellersSection.hidden = false;
      container.hidden = false;
      container.replaceChildren(createStorefrontFallbackElement());
      container.setAttribute('aria-busy', 'false');
      renderCompoundsShowcase();
      return;
    }
    container.replaceChildren();
    container.hidden = true;
    container.setAttribute('aria-busy', 'false');
    renderCompoundsShowcase();
    return;
  }

  bestSellersSection.hidden = false;
  container.hidden = false;

  const fragment = document.createDocumentFragment();

  featuredProducts.forEach((product) => {
    const cardEl = createProductCardElement(product);
    fragment.appendChild(cardEl);
  });

  container.replaceChildren(fragment);
  container.setAttribute('aria-busy', 'false');

  renderCompoundsShowcase();
}

function renderCompoundsShowcase() {
  const showcase = document.getElementById('compounds-showcase');
  if (!showcase) return;

  const track = showcase.querySelector('.compounds-showcase__track');
  if (!track) return;

  if (catalogState.compoundCardsLoadedFromDb && catalogState.compoundCards.length > 0) {
    const fragment = document.createDocumentFragment();
    catalogState.compoundCards.forEach((card, index) => {
      const cardEl = createCompoundCardElement(card, {
        products: catalogState.products,
        isPreview: false,
        uniqueIndex: index,
      });
      fragment.appendChild(cardEl);
    });
    track.replaceChildren(fragment);
    track.setAttribute('aria-busy', 'false');
    showcase.hidden = false;
    return;
  }

  const fallbackFragment = document.createDocumentFragment();
  DEFAULT_COMPOUND_CARDS.forEach((card, index) => {
    const cardEl = createCompoundCardElement(card, {
      products: catalogState.products,
      isPreview: false,
      uniqueIndex: index,
    });
    fallbackFragment.appendChild(cardEl);
  });
  track.replaceChildren(fallbackFragment);
  track.setAttribute('aria-busy', 'false');

  showcase.hidden = false;
  syncCompoundsShowcase();
}

function syncCompoundsShowcase() {
  const showcase = document.getElementById('compounds-showcase');
  if (!showcase || !Array.isArray(catalogState.products) || catalogState.products.length === 0) {
    return;
  }

  const normalizeText = (str) =>
    String(str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .trim();

  const cards = showcase.querySelectorAll('.compound-card');
  cards.forEach((card) => {
    const linkEl = card.querySelector('[data-compound-link]');
    if (!linkEl) return;

    const targetId = String(card.getAttribute('data-compound-id') || '').trim();
    const matchKey = normalizeText(card.getAttribute('data-compound-match'));

    let matched = null;
    if (targetId) {
      matched = catalogState.products.find((p) => String(p.id) === targetId);
    }
    if (!matched && matchKey) {
      matched = catalogState.products.find((p) =>
        normalizeText(p.name).includes(matchKey)
      );
    }

    if (matched && (matched.slug || matched.id)) {
      linkEl.setAttribute('href', buildProductDetailHref(matched));
    }
  });
}

/* ==========================================================================
   6. RENDERIZAÇÃO DE CATÁLOGO E CATEGORIAS (100% SUPABASE)
   ========================================================================== */

/** Palavras que ficam em minúsculas no meio de um nome de categoria (pt-BR). */
const CATEGORY_LOWERCASE_WORDS = new Set([
  'a', 'à', 'ao', 'aos', 'as', 'às', 'com', 'da', 'das', 'de', 'do', 'dos',
  'e', 'em', 'na', 'nas', 'no', 'nos', 'o', 'os', 'ou', 'para', 'por',
]);

/**
 * Padroniza a exibição de nomes de categoria cadastrados todo em maiúsculas
 * ("SAÚDE DA MULHER" → "Saúde da Mulher"), para que a lista não misture caixas.
 * Nomes já escritos em caixa mista ("Cremes Faciais") são mantidos como estão.
 * Apenas exibição: o valor salvo no banco não muda.
 *
 * @param {unknown} rawName
 * @returns {string}
 */
function formatCategoryLabel(rawName) {
  const name = String(rawName ?? '').trim().replace(/\s+/g, ' ');
  if (!name) return '';

  const letters = name.replace(/[^\p{L}]/gu, '');
  const isAllCaps = letters.length > 1 && letters === letters.toLocaleUpperCase('pt-BR');
  if (!isAllCaps) return name;

  let wordIndex = 0;
  return name.toLocaleLowerCase('pt-BR').replace(/[\p{L}\p{N}]+/gu, (word) => {
    const isFirstWord = wordIndex === 0;
    wordIndex += 1;
    if (!isFirstWord && CATEGORY_LOWERCASE_WORDS.has(word)) return word;
    return word.charAt(0).toLocaleUpperCase('pt-BR') + word.slice(1);
  });
}

/**
 * Escreve o texto permitindo quebra de linha logo após cada "/" (via <wbr>),
 * para nomes como "Ansiolíticos/Calmantes/Melhora do Sono" não quebrarem no meio da palavra.
 * O textContent do elemento continua igual ao texto original.
 *
 * @param {HTMLElement} element
 * @param {string} text
 */
function appendTextWithSlashBreaks(element, text) {
  const parts = String(text).split('/');
  parts.forEach((part, index) => {
    const isLast = index === parts.length - 1;
    element.appendChild(document.createTextNode(isLast ? part : `${part}/`));
    if (!isLast) element.appendChild(document.createElement('wbr'));
  });
}

function countProductsInCategory(categoryId) {
  if (categoryId === 'all') return catalogState.products.length;
  return catalogState.products.filter(
    (prod) => String(prod.category_id) === String(categoryId)
  ).length;
}

/**
 * Atualiza a lista completa de categorias e o seletor único do catálogo.
 * (A antiga fileira de abas foi substituída pela caixa única de categorias.)
 */
function renderCategoryFilters() {
  renderCategorySheetItems();
  updateCategoryPickerUI();
}

/** @type {{ open: (source?: HTMLElement | null) => void, close: () => void } | null} */
let categorySheetController = null;

function updateCategoryPickerUI() {
  // O nome acessível do seletor vem do próprio texto visível (WCAG 2.5.3, rótulo no nome)
  const labelEl = document.getElementById('category-picker-label');
  const totalEl = document.getElementById('category-picker-total');
  const iconWrap = document.querySelector('.catalog-category-picker__icon');

  const isAll = catalogState.activeCategory === 'all';
  const currentCategory = isAll
    ? null
    : catalogState.categories.find(
        (c) => String(c.id) === String(catalogState.activeCategory)
      );

  const activeName = isAll
    ? 'Todos os Produtos'
    : formatCategoryLabel(currentCategory?.name) || 'Categoria';
  const totalCategories = catalogState.categories.length;
  const totalLabel = totalCategories > 0
    ? `${totalCategories} ${totalCategories === 1 ? 'categoria' : 'categorias'}`
    : 'Ver categorias';

  if (labelEl) {
    labelEl.textContent = activeName;
  }
  if (totalEl) {
    if (totalCategories > 0) {
      // Em telas estreitas o CSS oculta a palavra e mantém só o número
      const unitEl = document.createElement('span');
      unitEl.className = 'catalog-category-picker__action-unit';
      unitEl.textContent = totalCategories === 1 ? ' categoria' : ' categorias';
      totalEl.replaceChildren(document.createTextNode(String(totalCategories)), unitEl);
    } else {
      totalEl.textContent = totalLabel;
    }
  }
  if (iconWrap) {
    iconWrap.replaceChildren(
      createCategoryIconElement(
        isAll ? 'Todos os Produtos' : String(currentCategory?.name || ''),
        isAll ? 'all' : String(catalogState.activeCategory),
        'category-svg-icon'
      )
    );
  }

  // Sincroniza a opção marcada (e o foco itinerante) na lista de categorias
  const sheetList = document.getElementById('category-sheet-list');
  if (sheetList) {
    const items = sheetList.querySelectorAll('.category-sheet__item');
    items.forEach((item) => {
      const isSelected = item.dataset.category === String(catalogState.activeCategory);
      item.classList.toggle('is-active', isSelected);
      item.setAttribute('aria-selected', String(isSelected));
      item.tabIndex = isSelected ? 0 : -1;
      const checkIcon = item.querySelector('.category-sheet__item-check');
      if (checkIcon) {
        checkIcon.hidden = !isSelected;
      }
    });
  }
}

function createCategorySheetItem({ id, name, count, isActive }) {
  const item = document.createElement('button');
  item.type = 'button';
  item.className = `category-sheet__item${isActive ? ' is-active' : ''}${count === 0 ? ' is-empty' : ''}`;
  item.dataset.category = String(id);
  item.setAttribute('role', 'option');
  item.setAttribute('aria-selected', String(Boolean(isActive)));
  item.tabIndex = isActive ? 0 : -1;

  const iconWrapper = document.createElement('span');
  iconWrapper.className = 'category-sheet__item-icon';
  iconWrapper.setAttribute('aria-hidden', 'true');
  iconWrapper.appendChild(
    createCategoryIconElement(name, String(id), 'category-svg-icon')
  );
  item.appendChild(iconWrapper);

  const textWrap = document.createElement('span');
  textWrap.className = 'category-sheet__item-text';

  const nameSpan = document.createElement('span');
  nameSpan.className = 'category-sheet__item-name';
  appendTextWithSlashBreaks(nameSpan, id === 'all' ? name : formatCategoryLabel(name));
  textWrap.appendChild(nameSpan);

  const countSpan = document.createElement('span');
  countSpan.className = 'category-sheet__item-count';
  countSpan.textContent = `${count} ${count === 1 ? 'fórmula' : 'fórmulas'}`;
  textWrap.appendChild(countSpan);
  item.appendChild(textWrap);

  const checkIcon = document.createElement('i');
  checkIcon.className = 'fa-solid fa-check category-sheet__item-check';
  checkIcon.setAttribute('aria-hidden', 'true');
  checkIcon.hidden = !isActive;
  item.appendChild(checkIcon);

  item.addEventListener('click', () => {
    const newId = String(id);
    if (categorySheetController) {
      categorySheetController.close();
    }
    if (catalogState.activeCategory !== newId) {
      handleCategorySelection(newId);
    }
    const catalogSection = document.getElementById('catalogo');
    if (catalogSection && typeof catalogSection.scrollIntoView === 'function') {
      const prefersReducedMotion =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      catalogSection.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'start',
      });
    }
  });

  return item;
}

function renderCategorySheetItems() {
  const sheetList = document.getElementById('category-sheet-list');
  if (!sheetList) return;

  const fragment = document.createDocumentFragment();

  // Opção "Todos os Produtos"
  const allItem = createCategorySheetItem({
    id: 'all',
    name: 'Todos os Produtos',
    count: countProductsInCategory('all'),
    isActive: catalogState.activeCategory === 'all',
  });
  fragment.appendChild(allItem);

  // Cada categoria cadastrada, na ordem definida no painel administrativo
  catalogState.categories.forEach((cat) => {
    const catId = String(cat.id);

    const catItem = createCategorySheetItem({
      id: catId,
      name: String(cat.name || '').trim(),
      count: countProductsInCategory(catId),
      isActive: catalogState.activeCategory === catId,
    });
    fragment.appendChild(catItem);
  });

  // Mensagem vazia de busca
  const emptySearchMsg = document.createElement('div');
  emptySearchMsg.id = 'category-sheet-empty';
  emptySearchMsg.className = 'category-sheet__empty';
  emptySearchMsg.setAttribute('role', 'status');
  emptySearchMsg.hidden = true;
  const emptyIcon = document.createElement('i');
  emptyIcon.className = 'fa-solid fa-magnifying-glass';
  emptyIcon.setAttribute('aria-hidden', 'true');
  const emptyText = document.createElement('p');
  emptyText.textContent = 'Nenhuma categoria encontrada.';
  emptySearchMsg.appendChild(emptyIcon);
  emptySearchMsg.appendChild(emptyText);
  fragment.appendChild(emptySearchMsg);

  sheetList.replaceChildren(fragment);
}

function initCategorySheet() {
  if (categorySheetController) return;

  const modal = document.getElementById('category-bottom-sheet');
  const backdrop = document.getElementById('category-sheet-backdrop');
  const openBtn = document.getElementById('btn-open-category-modal');
  const closeBtn = document.getElementById('btn-close-category-sheet');
  const searchInput = /** @type {HTMLInputElement | null} */ (
    document.getElementById('category-sheet-search')
  );
  const clearSearchBtn = document.getElementById('btn-clear-category-search');

  if (!modal || !backdrop) return;

  // No desktop a lista abre ancorada ao seletor (lista suspensa); no celular, como painel inferior.
  const desktopQuery =
    typeof window.matchMedia === 'function' ? window.matchMedia('(min-width: 1024px)') : null;

  /** @type {HTMLElement | null} */
  let returnFocusElement = null;

  const getVisibleItems = () =>
    /** @type {HTMLElement[]} */ ([
      ...modal.querySelectorAll('.category-sheet__item:not(.is-hidden)'),
    ]);

  const getTabbableElements = () =>
    /** @type {HTMLElement[]} */ ([...modal.querySelectorAll('button, input')]).filter(
      (el) =>
        el.tabIndex >= 0 &&
        !el.hidden &&
        !el.classList.contains('is-hidden') &&
        !(/** @type {HTMLButtonElement} */ (el).disabled) &&
        el.getClientRects().length > 0
    );

  /** Garante que a lista suspensa caiba na tela sem esconder o seletor sob o cabeçalho fixo. */
  function revealDropdown() {
    if (!desktopQuery?.matches || !openBtn) return;
    const overflow = modal.getBoundingClientRect().bottom - (window.innerHeight - 16);
    if (overflow <= 0) return;
    const headerHeight =
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 72;
    const roomAboveTrigger = openBtn.getBoundingClientRect().top - (headerHeight + 12);
    const delta = Math.min(overflow, roomAboveTrigger);
    if (delta > 0) {
      const prefersReducedMotion =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollBy({ top: delta, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    }
  }

  function openSheet(sourceEl = null) {
    returnFocusElement =
      sourceEl || (document.activeElement instanceof HTMLElement ? document.activeElement : null);

    backdrop.removeAttribute('hidden');
    modal.removeAttribute('hidden');
    backdrop.setAttribute('aria-hidden', 'false');
    modal.setAttribute('aria-hidden', 'false');

    void modal.offsetHeight;

    backdrop.classList.add('is-open');
    modal.classList.add('is-open');

    if (openBtn) openBtn.setAttribute('aria-expanded', 'true');

    // Trava a rolagem só no celular (painel inferior); no desktop a lista suspensa acompanha a página
    if (!desktopQuery?.matches) {
      document.body.classList.add('category-sheet-lock');
    }

    // Foco síncrono no clique com o modal já visível -> aciona teclado virtual no iOS Safari e Android
    if (searchInput) {
      searchInput.focus({ preventScroll: true });
      try {
        searchInput.select();
      } catch {}
    }

    requestAnimationFrame(revealDropdown);
  }

  function closeSheet() {
    backdrop.classList.remove('is-open');
    modal.classList.remove('is-open');
    backdrop.setAttribute('aria-hidden', 'true');
    modal.setAttribute('aria-hidden', 'true');

    if (openBtn) openBtn.setAttribute('aria-expanded', 'false');

    document.body.classList.remove('category-sheet-lock');

    setTimeout(() => {
      if (!modal.classList.contains('is-open')) {
        modal.hidden = true;
        backdrop.hidden = true;
      }
    }, 280);

    if (returnFocusElement && typeof returnFocusElement.focus === 'function') {
      returnFocusElement.focus({ preventScroll: true });
    }
  }

  openBtn?.addEventListener('click', () => {
    if (modal.classList.contains('is-open')) {
      closeSheet();
    } else {
      openSheet(openBtn);
    }
  });
  closeBtn?.addEventListener('click', closeSheet);
  backdrop.addEventListener('click', closeSheet);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal.classList.contains('is-open')) {
      closeSheet();
    }
  });

  // Teclado: Tab circula dentro da lista (diálogo modal); setas, Home e End percorrem as categorias.
  modal.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') {
      const tabbables = getTabbableElements();
      if (tabbables.length === 0) return;
      const first = tabbables[0];
      const last = tabbables[tabbables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
      return;
    }

    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const items = getVisibleItems();
    if (items.length === 0) return;

    const isInSearch = document.activeElement === searchInput;
    if (isInSearch && (event.key === 'Home' || event.key === 'End')) return;

    const currentIndex = items.indexOf(/** @type {HTMLElement} */ (document.activeElement));
    let target = null;

    if (event.key === 'ArrowDown') {
      target = items[currentIndex < 0 ? 0 : Math.min(currentIndex + 1, items.length - 1)];
    } else if (event.key === 'ArrowUp') {
      if (currentIndex <= 0) {
        target = isInSearch ? null : searchInput;
      } else {
        target = items[currentIndex - 1];
      }
    } else if (event.key === 'Home') {
      target = items[0];
    } else if (event.key === 'End') {
      target = items[items.length - 1];
    }

    if (target) {
      event.preventDefault();
      target.focus();
    }
  });

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const query = normalizeText(searchInput.value.trim());
      if (clearSearchBtn) {
        clearSearchBtn.hidden = !query;
      }

      const items = modal.querySelectorAll('.category-sheet__item');
      let visibleCount = 0;

      items.forEach((item) => {
        const catId = item.dataset.category;
        const nameEl = item.querySelector('.category-sheet__item-name');
        const nameText = normalizeText(nameEl ? nameEl.textContent : '');

        let matches = false;
        if (!query) {
          matches = true;
        } else if (catId === 'all') {
          matches =
            'todos os produtos'.includes(query) ||
            'todas as formulas'.includes(query) ||
            'todos'.includes(query);
        } else {
          matches = nameText.includes(query);
        }

        item.classList.toggle('is-hidden', !matches);
        if (matches) visibleCount++;
      });

      const emptyMsg = document.getElementById('category-sheet-empty');
      if (emptyMsg) {
        emptyMsg.hidden = visibleCount > 0;
      }
    });

    // Enter na busca seleciona a primeira categoria encontrada
    searchInput.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || !searchInput.value.trim()) return;
      const firstMatch = getVisibleItems()[0];
      if (firstMatch) {
        event.preventDefault();
        firstMatch.click();
      }
    });

    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input'));
        searchInput.focus();
      });
    }
  }

  categorySheetController = {
    open: openSheet,
    close: closeSheet,
  };
}

function handleCategorySelection(selectedCategoryId) {
  if (catalogState.activeCategory === selectedCategoryId) return;

  catalogState.activeCategory = selectedCategoryId;
  catalogState.currentPage = 1;

  updateCategoryPickerUI();
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
  const paginationEl =
    document.getElementById('catalog-pagination') ||
    document.querySelector('[data-catalog-pagination]');

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

  const total = filteredProducts.length;
  const pageSize = catalogState.pageSize || 24;
  const totalPages = Math.ceil(total / pageSize) || 1;

  if (catalogState.currentPage > totalPages) {
    catalogState.currentPage = totalPages;
  }
  if (catalogState.currentPage < 1) {
    catalogState.currentPage = 1;
  }

  const startIndex = (catalogState.currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, total);
  const pagedProducts = filteredProducts.slice(startIndex, endIndex);

  if (countLabelEl) {
    if (total === 0) {
      countLabelEl.textContent = '0 fórmulas encontradas';
    } else if (totalPages > 1) {
      countLabelEl.textContent = `Exibindo ${startIndex + 1}–${endIndex} de ${total} fórmulas disponíveis`;
    } else {
      countLabelEl.textContent =
        total === 1 ? 'Exibindo 1 fórmula disponível' : `Exibindo ${total} fórmulas disponíveis`;
    }
  }

  if (total === 0) {
    catalogGrid.replaceChildren();
    catalogGrid.hidden = true;
    catalogGrid.setAttribute('aria-busy', 'false');
    if (paginationEl) paginationEl.hidden = true;

    if (emptyStateEl) {
      const emptyTitle = emptyStateEl.querySelector('.catalog-empty__title');
      const emptyDesc = emptyStateEl.querySelector('.catalog-empty__desc');
      if (emptyTitle) {
        if (catalogState.hasError) {
          emptyTitle.textContent = 'Catálogo temporariamente indisponível.';
        } else {
          emptyTitle.textContent = normalizedQuery
            ? 'Nenhum produto encontrado para sua busca.'
            : 'Nenhum produto cadastrado nesta categoria no momento.';
        }
      }
      if (emptyDesc && catalogState.hasError) {
        emptyDesc.textContent =
          'Não foi possível conectar ao catálogo agora. Solicite seu orçamento ou consulte qualquer fórmula diretamente pelo nosso WhatsApp.';
      }
      emptyStateEl.hidden = false;
    }
    return;
  }

  if (emptyStateEl) {
    emptyStateEl.hidden = true;
  }

  const fragment = document.createDocumentFragment();
  pagedProducts.forEach((product) => {
    fragment.appendChild(createProductCardElement(product));
  });

  catalogGrid.hidden = false;
  catalogGrid.replaceChildren(fragment);
  catalogGrid.setAttribute('aria-busy', 'false');

  // Renderiza controles de paginação
  if (paginationEl) {
    if (totalPages <= 1) {
      paginationEl.hidden = true;
      paginationEl.replaceChildren();
    } else {
      paginationEl.hidden = false;
      const navFragment = document.createDocumentFragment();

      const prevBtn = document.createElement('button');
      prevBtn.type = 'button';
      prevBtn.className = 'catalog-pagination__btn';
      prevBtn.setAttribute('aria-label', 'Página anterior');
      prevBtn.disabled = catalogState.currentPage === 1;
      prevBtn.textContent = '← Anterior';
      prevBtn.addEventListener('click', () => {
        if (catalogState.currentPage > 1) {
          catalogState.currentPage--;
          renderCatalogProducts();
          document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' });
        }
      });
      navFragment.appendChild(prevBtn);

      for (let p = 1; p <= totalPages; p++) {
        const pageBtn = document.createElement('button');
        pageBtn.type = 'button';
        pageBtn.className = 'catalog-pagination__btn';
        if (p === catalogState.currentPage) {
          pageBtn.classList.add('is-active');
          pageBtn.setAttribute('aria-current', 'page');
        }
        pageBtn.setAttribute('aria-label', `Ir para página ${p}`);
        pageBtn.textContent = String(p);
        pageBtn.addEventListener('click', () => {
          if (catalogState.currentPage !== p) {
            catalogState.currentPage = p;
            renderCatalogProducts();
            document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' });
          }
        });
        navFragment.appendChild(pageBtn);
      }

      const nextBtn = document.createElement('button');
      nextBtn.type = 'button';
      nextBtn.className = 'catalog-pagination__btn';
      nextBtn.setAttribute('aria-label', 'Próxima página');
      nextBtn.disabled = catalogState.currentPage === totalPages;
      nextBtn.textContent = 'Próxima →';
      nextBtn.addEventListener('click', () => {
        if (catalogState.currentPage < totalPages) {
          catalogState.currentPage++;
          renderCatalogProducts();
          document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' });
        }
      });
      navFragment.appendChild(nextBtn);

      paginationEl.replaceChildren(navFragment);
    }
  }
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
      '[Botica Natural] Credenciais do Supabase pendentes. Exibindo fallback de atendimento via WhatsApp.'
    );
    catalogState.carouselSlides = [];
    catalogState.categories = [];
    catalogState.products = [];
    catalogState.hasError = true;
    catalogState.isLoading = false;
    return;
  }

  try {
    catalogState.hasError = false;
    const [
      carouselResponse,
      categoriesResponse,
      productsResponse,
      compoundsResponse,
    ] = await Promise.all([
      fetchActiveCarouselSlides(),
      fetchActiveCategories(),
      fetchActiveProducts(),
      fetchActiveCompoundCards(),
      fetchProductWhatsAppTemplate(),
      loadBuiltProductSlugs(),
    ]);

    catalogState.carouselSlides =
      !carouselResponse.error && Array.isArray(carouselResponse.data)
        ? carouselResponse.data
        : [];

    if (!compoundsResponse.error && Array.isArray(compoundsResponse.data) && compoundsResponse.data.length > 0) {
      catalogState.compoundCards = compoundsResponse.data;
      catalogState.compoundCardsLoadedFromDb = true;
    } else {
      catalogState.compoundCards = [];
      catalogState.compoundCardsLoadedFromDb = false;
    }

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
    catalogState.hasError = true;
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
    catalogState.currentPage = 1;
    if (clearBtn) {
      clearBtn.classList.toggle('is-visible', catalogState.searchQuery.trim().length > 0);
    }
    renderCatalogProducts();
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      catalogState.searchQuery = '';
      catalogState.currentPage = 1;
      clearBtn.classList.remove('is-visible');
      renderCatalogProducts();
      searchInput.focus();
    });
  }
}

function bindResilientProductNavigation() {
  if (document.documentElement.dataset.bnProductNavBound === '1') return;
  document.documentElement.dataset.bnProductNavBound = '1';

  document.addEventListener('click', async (event) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const targetEl = /** @type {Element | null} */ (event.target);
    const anchor = targetEl?.closest?.('a[href]');
    if (!(anchor instanceof HTMLAnchorElement)) return;

    const rawHref = anchor.getAttribute('href') || '';
    const slug = extractProductSlugFromHref(rawHref);
    if (!slug) return;

    const builtSlugs = getBuiltProductSlugs();
    if (builtSlugs instanceof Set && builtSlugs.has(slug)) {
      return;
    }

    event.preventDefault();
    const matched = catalogState.products.find(
      (item) => normalizeProductSlug(item?.slug) === slug
    );
    const fallbackHref = buildFallbackProductHref(matched, slug);
    const openInNewTab = anchor.target === '_blank';
    const popup = openInNewTab ? window.open('', '_blank') : null;
    if (popup) {
      popup.opener = null;
    }

    let resolvedHref = rawHref;
    try {
      const probe = await fetch(anchor.href, { method: 'HEAD', cache: 'no-store' });
      if (!probe.ok) {
        resolvedHref = fallbackHref;
      }
    } catch {
      resolvedHref = fallbackHref;
    }

    if (popup && !popup.closed) {
      popup.location.replace(resolvedHref);
    } else if (openInNewTab) {
      window.open(resolvedHref, '_blank', 'noopener,noreferrer');
    } else {
      window.location.assign(resolvedHref);
    }
  });
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

  bindResilientProductNavigation();

  if (hasCatalogSection) {
    initCatalogSearchListeners();
    initCategorySheet();
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