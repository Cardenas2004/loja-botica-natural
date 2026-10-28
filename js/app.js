/**
 * @fileoverview Motor Dinâmico da Vitrine Pública — Botica Natural
 * @description Conecta a Landing Page (`index.html`) e páginas de catálogo ao Supabase (PostgreSQL + Storage),
 * renderizando dinamicamente a seção "Mais Vendidos" com programação defensiva (Null-Safety Guards),
 * prevenção estrita de XSS (zero `innerHTML` com dados do banco) e alta performance.
 *
 * @module js/app
 * @author Staff Frontend Engineer
 */

import {
  supabase,
  DB_TABLES,
  isSupabaseConfigured,
  getPublicImageUrl,
  normalizeSupabaseError,
} from './supabaseClient.js';

/* ==========================================================================
   1. CONFIGURAÇÕES GLOBAIS E FORMATAÇÃO (SINGLE SOURCE OF TRUTH)
   ========================================================================== */

/**
 * Configuração centralizada de conversão para o WhatsApp da Botica Natural.
 * Preserva o número oficial da farmácia utilizado em toda a Landing Page.
 */
export const WHATSAPP_CONFIG = Object.freeze({
  PHONE_NUMBER: '555197731564',
  BASE_URL: 'https://wa.me',
  MAX_INSTALLMENTS: 6,
  MAX_BESTSELLERS: 6,
});

/**
 * Formatador nativo de moeda em Real Brasileiro (BRL - R$).
 * Instanciado uma única vez para máxima performance.
 */
const brlCurrencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Placeholder SVG Data URI leve e semântico para fallback de imagens ausentes ou com erro de rede.
 */
const FALLBACK_PRODUCT_IMAGE =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='600' height='450' viewBox='0 0 600 450'><rect width='600' height='450' fill='%23F3EDF9'/><g fill='%235B2D9E' opacity='0.45' transform='translate(260, 175)'><path d='M40 0C17.9 0 0 17.9 0 40s17.9 40 40 40 40-17.9 40-40S62.1 0 40 0zm0 70c-16.5 0-30-13.5-30-30s13.5-30 30-30 30 13.5 30 30-13.5 30-30 30z'/><circle cx='40' cy='40' r='14'/></g><text x='50%25' y='66%25' text-anchor='middle' fill='%233D1E6D' font-family='Poppins, sans-serif' font-size='16' font-weight='600' opacity='0.65'>Botica Natural — Fórmula Manipulada</text></svg>";

/**
 * Dados de fallback de segurança exibidos apenas caso `js/supabaseClient.js`
 * esteja sem conectividade ou em modo placeholder durante desenvolvimento offline.
 */
const LOCAL_SHOWCASE_FALLBACK = Object.freeze({
  categories: [
    { id: 'cat-emagrecimento', name: 'Emagrecimento & Metabolismo', slug: 'emagrecimento', display_order: 1, is_active: true },
    { id: 'cat-dermocosmeticos', name: 'Dermocosméticos', slug: 'dermocosmeticos', display_order: 2, is_active: true },
    { id: 'cat-suplementos', name: 'Suplementos & Longevidade', slug: 'suplementos', display_order: 3, is_active: true },
    { id: 'cat-imunidade', name: 'Saúde & Imunidade', slug: 'imunidade', display_order: 4, is_active: true },
    { id: 'cat-fitoterapicos', name: 'Fitoterápicos & Bem-Estar', slug: 'fitoterapicos', display_order: 5, is_active: true },
    { id: 'cat-veterinaria', name: 'Linha Pet Veterinária', slug: 'veterinaria', display_order: 6, is_active: true },
  ],
  products: [
    {
      id: '1',
      category_id: 'cat-emagrecimento',
      name: 'Okralin™ 500mg',
      description: 'Complexo 100% natural patenteado obtido do quiabo cultivado na Tunísia. Auxilia na redução da absorção de gordura alimentar e gerenciamento de peso.',
      price: 139.90,
      image_url: 'images/produtos/okralin-500mg.jpg',
      image_path: null,
      is_active: true,
      is_best_seller: true,
      categories: { id: 'cat-emagrecimento', name: 'Emagrecimento & Metabolismo', slug: 'emagrecimento' },
    },
    {
      id: '2',
      category_id: 'cat-dermocosmeticos',
      name: 'Sérum Vitamina C 20% + Ácido Hialurônico',
      description: 'Concentrado antioxidante de toque seco e rápida absorção. Estimula o colágeno, uniformiza o tom da pele e promove viço imediato.',
      price: 89.90,
      image_url: 'images/produtos/serum-vitamina-c.jpg',
      image_path: null,
      is_active: true,
      is_best_seller: true,
      categories: { id: 'cat-dermocosmeticos', name: 'Dermocosméticos', slug: 'dermocosmeticos' },
    },
    {
      id: '3',
      category_id: 'cat-emagrecimento',
      name: 'Morosil® 500mg Autêntico Galena',
      description: 'Extrato seco do suco das laranjas vermelhas Moro cultivadas ao redor do vulcão Etna na Sicília, auxiliando na redução de medidas abdominais.',
      price: 124.90,
      image_url: 'images/produtos/morosil-500mg.jpg',
      image_path: null,
      is_active: true,
      is_best_seller: true,
      categories: { id: 'cat-emagrecimento', name: 'Emagrecimento & Metabolismo', slug: 'emagrecimento' },
    },
    {
      id: '4',
      category_id: 'cat-dermocosmeticos',
      name: 'Creme Facial Anti-Aging Retinol-Like',
      description: 'Creme rejuvenescedor noturno com Bakuchiol (Retinol-Like) e peptídeos tensores para renovação celular sem irritação ou descamação.',
      price: 119.90,
      image_url: 'images/produtos/creme-antiaging.jpg',
      image_path: null,
      is_active: true,
      is_best_seller: false,
      categories: { id: 'cat-dermocosmeticos', name: 'Dermocosméticos', slug: 'dermocosmeticos' },
    },
    {
      id: '5',
      category_id: 'cat-emagrecimento',
      name: 'GreenSelect Phytosome® 120mg',
      description: 'Extrato de chá verde descafeinado com tecnologia Phytosome® que duplica a absorção dos polifenóis bioativos para gasto calórico seguro.',
      price: 98.90,
      image_url: 'images/produtos/greenselect-phytosome.jpg',
      image_path: null,
      is_active: true,
      is_best_seller: true,
      categories: { id: 'cat-emagrecimento', name: 'Emagrecimento & Metabolismo', slug: 'emagrecimento' },
    },
    {
      id: '6',
      category_id: 'cat-suplementos',
      name: 'Coenzima Q10 Ubiquinona 100mg + Vit. E',
      description: 'Cápsulas de alta biodisponibilidade para produção de energia celular mitocondrial, disposição física e proteção antioxidante cardiovascular.',
      price: 79.90,
      image_url: 'images/produtos/coenzima-q10.jpg',
      image_path: null,
      is_active: true,
      is_best_seller: false,
      categories: { id: 'cat-suplementos', name: 'Suplementos & Longevidade', slug: 'suplementos' },
    },
    {
      id: '7',
      category_id: 'cat-imunidade',
      name: 'Própolis Mais Blend (Vermelha + Verde)',
      description: 'Fórmula pioneira que associa a Própolis Vermelha de Alagoas à Própolis Verde do Alecrim-do-Campo com Zinco Quelato para imunidade diária.',
      price: 59.90,
      image_url: 'images/produtos/propolis-mais.jpg',
      image_path: null,
      is_active: true,
      is_best_seller: true,
      categories: { id: 'cat-imunidade', name: 'Saúde & Imunidade', slug: 'imunidade' },
    },
    {
      id: '8',
      category_id: 'cat-fitoterapicos',
      name: 'Composto Calmante Fitoterápico',
      description: 'Associação sinérgica de Passiflora, Valeriana e Mulungu em dosagens padronizadas para equilíbrio emocional e sono restaurador.',
      price: 54.90,
      image_url: 'images/produtos/composto-calmante.jpg',
      image_path: null,
      is_active: true,
      is_best_seller: true,
      categories: { id: 'cat-fitoterapicos', name: 'Fitoterápicos & Bem-Estar', slug: 'fitoterapicos' },
    },
    {
      id: '9',
      category_id: 'cat-veterinaria',
      name: 'Biscoito Pet Articulações (Condroitina + Glucosamina)',
      description: 'Suplemento veterinário em formato de petisco macio palatável sabor carne para regeneração articular e mobilidade de cães e gatos.',
      price: 84.90,
      image_url: 'images/produtos/biscoito-pet.jpg',
      image_path: null,
      is_active: true,
      is_best_seller: false,
      categories: { id: 'cat-veterinaria', name: 'Linha Pet Veterinária', slug: 'veterinaria' },
    },
  ],
});

/* ==========================================================================
   2. ESTADO REATIVO EM MEMÓRIA (SINGLE STATE STORE)
   ========================================================================== */

const catalogState = {
  /** @type {Array<import('./supabaseClient.js').CarouselSlide>} Lista de slides ativos do carrossel principal */
  carouselSlides: [],
  /** @type {Array<Object>} Lista de categorias ativas ordenadas */
  categories: [],
  /** @type {Array<Object>} Lista de produtos ativos com join de categoria */
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

/**
 * Formata um valor numérico para moeda BRL (R$).
 *
 * @param {number|string|null|undefined} value
 * @returns {string} Valor formatado (ex: "R$ 139,90") ou "Sob consulta" se inválido/zero
 */
function formatPriceBRL(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return 'Sob consulta';
  }
  return brlCurrencyFormatter.format(numericValue);
}

/**
 * Normaliza texto para busca insensível a acentos e caixa.
 *
 * @param {string} text
 * @returns {string}
 */
function normalizeText(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Resolve o nome de exibição da categoria de um produto.
 *
 * @param {Object} product
 * @returns {string}
 */
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

/**
 * Resolve a URL pública da imagem do produto com fallback seguro.
 *
 * @param {Object} product
 * @returns {string}
 */
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

/**
 * Constrói o link dinâmico de conversão para o WhatsApp contendo Nome do Produto,
 * Categoria e Preço formatado em BRL (R$).
 *
 * @param {Object} product
 * @returns {string} URL `https://wa.me/555197731564?text=...`
 */
export function buildProductWhatsAppUrl(product) {
  const productName = String(product?.name || 'Fórmula Manipulada').trim();
  const categoryName = resolveProductCategoryName(product);
  const formattedPrice = formatPriceBRL(product?.price);

  const message =
    `Olá! Tenho interesse no produto *${productName}* ` +
    `(Categoria: ${categoryName} | Valor: ${formattedPrice}) ` +
    `que vi na vitrine da Botica Natural. Gostaria de mais informações e fazer meu pedido!`;

  return `${WHATSAPP_CONFIG.BASE_URL}/${WHATSAPP_CONFIG.PHONE_NUMBER}?text=${encodeURIComponent(message)}`;
}

/* ==========================================================================
   4. CONSTRUÇÃO SEGURA DE DOM (ZERO INNERHTML — PREVENÇÃO DE XSS)
   ========================================================================== */

/**
 * Cria o elemento DOM `<article class="product-card">` preservando 100% da hierarquia
 * de classes CSS do Design System da Botica Natural e usando exclusivamente
 * `document.createElement` e `textContent`.
 *
 * @param {Object} product Objeto do produto vindo do Supabase
 * @returns {HTMLElement} Elemento `<article class="product-card">`
 */
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
  img.height = 450;
  img.style.cursor = 'pointer';

  // Fallback resiliente contra falha de carregamento de imagem externa
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

  // Tag de especialidade / categoria no topo do corpo
  const formTag = document.createElement('span');
  formTag.className = 'product-card__form';
  const flaskIcon = document.createElement('i');
  flaskIcon.className = 'fa-solid fa-mortar-pestle';
  flaskIcon.setAttribute('aria-hidden', 'true');
  formTag.appendChild(flaskIcon);
  formTag.appendChild(document.createTextNode(` ${categoryName}`));
  bodyContainer.appendChild(formTag);

  // Título (.product-card__title)
  const titleEl = document.createElement('h3');
  titleEl.className = 'product-card__title';

  const titleLink = document.createElement('a');
  titleLink.className = 'product-card__title-link';
  titleLink.href = productDetailUrl;
  titleLink.textContent = productName;
  titleLink.setAttribute('title', `Ver detalhes de ${productName}`);
  titleEl.appendChild(titleLink);
  bodyContainer.appendChild(titleEl);

  // Descrição (.product-card__desc)
  const descEl = document.createElement('p');
  descEl.className = 'product-card__desc';
  descEl.textContent = productDescription;
  bodyContainer.appendChild(descEl);

  // 4. Bloco de Preço e Parcelamento (.product-card__price-box)
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
  bodyContainer.appendChild(priceBox);

  // 5. Botão de Ação / Conversão WhatsApp (.product-card__actions > .product-card__btn)
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
  bodyContainer.appendChild(actionsContainer);
  article.appendChild(bodyContainer);

  return article;
}

/* ==========================================================================
   4.5. RENDERIZAÇÃO DINÂMICA DO CARROSSEL PRINCIPAL (HERO SWIPER)
   ========================================================================== */

/**
 * Higieniza links opcionais de banners contra injeção de protocolos maliciosos (`javascript:`, `data:`).
 *
 * @param {string | null | undefined} rawUrl
 * @returns {string} URL segura ou string vazia (`''`)
 */
function sanitizeBannerLink(rawUrl) {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return '';
  if (/^(javascript|data|vbscript):/i.test(trimmed)) return '';
  return trimmed;
}

/**
 * Resolve a URL pública da imagem de um slide do carrossel.
 *
 * @param {import('./supabaseClient.js').CarouselSlide} slide
 * @returns {string}
 */
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

/**
 * Cria um elemento `<div class="swiper-slide promo__slide">` usando exclusivamente
 * `document.createElement` e `textContent` (Zero `innerHTML` — Prevenção de XSS).
 *
 * @param {import('./supabaseClient.js').CarouselSlide} slide
 * @param {number} index Índice do slide para otimização de LCP no primeiro banner
 * @returns {HTMLElement | null}
 */
function createHeroCarouselSlideElement(slide, index) {
  const imageUrl = resolveCarouselSlideImageUrl(slide);
  if (!imageUrl) return null;

  const slideEl = document.createElement('div');
  slideEl.className = 'swiper-slide promo__slide';
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

  const img = document.createElement('img');
  img.className = 'promo__img';
  img.src = imageUrl;
  img.alt = altText;
  img.width = 1920;
  img.height = 650;

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

/**
 * Sincroniza ou reinicializa a instância do `Swiper.js` do carrossel principal
 * após a substituição dinâmica dos slides no DOM, garantindo que autoplay,
 * setas de navegação e paginação (bullets) funcionem com a quantidade exata de fotos.
 *
 * @param {HTMLElement} carouselEl Container `.promo__carousel`
 * @param {number} slideCount Quantidade de slides ativos renderizados
 */
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
    speed: 600,
    grabCursor: hasMultipleSlides,
    watchOverflow: true,
    autoplay:
      hasMultipleSlides && !prefersReducedMotion
        ? {
            delay: 5000,
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
 * Renderiza dinamicamente os slides ativos do banco no carrossel principal (`.promo__carousel`).
 * - Fallback Seguro: Se o banco retornar `0` slides ativos, mantém intactos os slides
 *   estáticos originais do `index.html` para que o topo do site nunca fique em branco.
 */
function renderHeroCarousel() {
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

  // Fallback Seguro: mantém os banners originais do HTML se o banco tiver 0 slides ativos
  if (activeSlides.length === 0) {
    return;
  }

  const fragment = document.createDocumentFragment();
  let validSlideCount = 0;

  activeSlides.forEach((slide, index) => {
    const slideNode = createHeroCarouselSlideElement(slide, index);
    if (slideNode) {
      fragment.appendChild(slideNode);
      validSlideCount += 1;
    }
  });

  if (validSlideCount === 0) {
    return;
  }

  // Se o Swiper já havia inicializado sobre os slides estáticos, destrói antes de substituir o DOM
  const currentSwiper = /** @type {any} */ (carouselEl).swiper;
  if (currentSwiper && typeof currentSwiper.destroy === 'function') {
    currentSwiper.destroy(true, true);
  }

  wrapperEl.replaceChildren(fragment);
  syncHeroSwiperInstance(/** @type {HTMLElement} */ (carouselEl), validSlideCount);
}

/* ==========================================================================
   5. RENDERIZAÇÃO DA SEÇÃO "MAIS VENDIDOS" (COM SUPORTE A SWIPER & GRID)
   ========================================================================== */

/**
 * Renderiza a seção `#mais-vendidos` filtrando os produtos com `is_best_seller === true`.
 * - Blindada com Null-Safety Guard caso a seção não exista no DOM atual.
 * - Se não houver produtos marcados como `is_best_seller`, aplica fallback inteligente
 *   exibindo os produtos ativos mais recentes.
 * - Se não houver nenhum produto ativo no banco, oculta a seção `#mais-vendidos` graciosamente.
 * - Suporta tanto layout em Grid (`.products-grid`) quanto Carrossel (`.swiper` / `.swiper-wrapper`).
 */
function renderBestSellers() {
  const bestSellersSection = document.getElementById('mais-vendidos');
  const container =
    document.getElementById('bestsellers-grid') ||
    document.querySelector('[data-bestsellers-grid]');

  // Null-Safety Guard: retorna silenciosamente se o container não existir na página atual
  if (!bestSellersSection || !container) return;

  // Filtra produtos marcados como Mais Vendidos
  let featuredProducts = catalogState.products.filter(
    (product) => Boolean(product.is_best_seller)
  );

  // Fallback Inteligente: usa os produtos ativos mais recentes se nenhum estiver marcado como best_seller
  if (featuredProducts.length === 0 && catalogState.products.length > 0) {
    featuredProducts = catalogState.products.slice(0, WHATSAPP_CONFIG.MAX_BESTSELLERS);
  } else {
    featuredProducts = featuredProducts.slice(0, WHATSAPP_CONFIG.MAX_BESTSELLERS);
  }

  // Se não houver nenhum produto ativo cadastrado, oculta a seção graciosamente
  if (featuredProducts.length === 0) {
    bestSellersSection.hidden = true;
    container.setAttribute('aria-busy', 'false');
    return;
  }

  bestSellersSection.hidden = false;

  // Verifica se o container utiliza Swiper.js
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

  // Se estiver em um carrossel Swiper, atualiza a instância após injetar no DOM
  const swiperRoot = container.closest('.swiper');
  if (swiperRoot && swiperRoot.swiper && typeof swiperRoot.swiper.update === 'function') {
    swiperRoot.swiper.update();
  }
}

/* ==========================================================================
   6. RENDERIZAÇÃO DEFENSIVA DE CATÁLOGO (APENAS QUANDO PRESENTE NO DOM)
   ========================================================================== */

/**
 * Cria um botão de filtro de categoria seguro via DOM API.
 *
 * @param {Object} options
 * @param {string} options.id Identificador da categoria ('all' ou UUID)
 * @param {string} options.name Nome exibido no botão
 * @param {number} options.count Quantidade de produtos ativos nessa categoria
 * @param {boolean} options.isActive Se o botão inicia ativo
 * @returns {HTMLButtonElement}
 */
function createCategoryFilterButton({ id, name, count, isActive }) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `catalog-tab${isActive ? ' active is-active' : ''}`;
  button.dataset.category = String(id);
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

/**
 * Renderiza a barra de categorias caso o container exista na página atual (ex: `produtos.html`).
 * Blindado com Null-Safety Guard para não executar na `index.html`.
 */
function renderCategoryFilters() {
  const filtersContainer =
    document.getElementById('category-filters') ||
    document.querySelector('[data-catalog-tabs]');

  if (!filtersContainer) return;

  const fragment = document.createDocumentFragment();

  const allButton = createCategoryFilterButton({
    id: 'all',
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
      name: String(category.name || '').trim(),
      count: productCount,
      isActive: catalogState.activeCategory === categoryId,
    });

    fragment.appendChild(categoryBtn);
  });

  filtersContainer.replaceChildren(fragment);
}

/**
 * Atualiza o estado visual dos botões de categoria e re-renderiza os produtos.
 *
 * @param {string} selectedCategoryId ID da categoria selecionada ou `'all'`
 */
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
 * Filtra os produtos em memória e atualiza o grid de catálogo (apenas se existir no DOM).
 * Blindado com Null-Safety Guard para não gerar `TypeError` na `index.html`.
 */
function renderCatalogProducts() {
  const catalogGrid =
    document.getElementById('catalog-grid') ||
    document.querySelector('[data-catalog-grid]');

  // Null-Safety Guard: se o grid de catálogo não existir na página (ex: index.html), encerra imediatamente
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
      `${product.name || ''} ${product.description || ''} ${resolveProductCategoryName(product)}`
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
          : 'Nenhum produto disponível nesta categoria no momento.';
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

/**
 * Busca categorias ativas e produtos ativos em paralelo (`Promise.all`) em uma única
 * rodada de rede, populando `catalogState`.
 */
async function loadCatalogData() {
  catalogState.isLoading = true;

  const configured =
    typeof isSupabaseConfigured === 'function'
      ? isSupabaseConfigured()
      : Boolean(isSupabaseConfigured);

  if (!configured) {
    console.info(
      '[Botica Natural] Credenciais do Supabase ainda em modo placeholder. Exibindo catálogo de demonstração local.'
    );
    catalogState.categories = [...LOCAL_SHOWCASE_FALLBACK.categories];
    catalogState.products = [...LOCAL_SHOWCASE_FALLBACK.products];
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
    ]);

    if (!carouselResponse.error && Array.isArray(carouselResponse.data)) {
      catalogState.carouselSlides = carouselResponse.data;
    } else {
      catalogState.carouselSlides = [];
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
    console.error('[Botica Natural] Erro ao carregar vitrine do Supabase:', normalizedErr);

    if (catalogState.products.length === 0) {
      catalogState.categories = [...LOCAL_SHOWCASE_FALLBACK.categories];
      catalogState.products = [...LOCAL_SHOWCASE_FALLBACK.products];
    }
  } finally {
    catalogState.isLoading = false;
  }
}

/**
 * Inicializa os eventos de busca textual instantânea somente quando os elementos
 * de busca do catálogo existirem no DOM atual.
 */
function initCatalogSearchListeners() {
  const searchInput = document.querySelector('[data-catalog-search]');
  const clearBtn = document.querySelector('.catalog-search-clear');

  // Null-Safety Guard: na `index.html` não há barra de busca de catálogo, evitando listeners órfãos
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

/**
 * Bootstrapper principal da vitrine pública.
 * Detecta de forma defensiva quais seções existem no DOM antes de inicializar listeners e renders.
 */
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

  // Se a página atual não possuir Carrossel, "Mais Vendidos" ou "Catálogo", não faz chamadas desnecessárias
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
    renderCategoryFilters();
    renderCatalogProducts();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPublicStorefront);
} else {
  initPublicStorefront();
}
