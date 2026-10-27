/**
 * ============================================================================
 * Botica Natural — Controlador de Roteamento & Renderização Dinâmica (PDP)
 * ============================================================================
 * Arquitetura: Clean Code · Separation of Concerns (Router / Formatter / View)
 * Segurança: Prevenção estrita contra XSS — uso exclusivo de textContent,
 * createElement e DocumentFragment (nenhum dado dinâmico passa por innerHTML).
 */
(() => {
  'use strict';

  const WHATSAPP_PHONE = '555197731564';

  const brlFormatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });

  /* ==========================================================================
     1. ROUTER — Extração e Sanitização Estrita de Parâmetros via URLSearchParams
     ========================================================================== */
  const ProductRouter = Object.freeze({
    /**
     * Captura e sanitiza o parâmetro `id` da query string (?id=...) usando URLSearchParams.
     * Trunca e remove caracteres de controle/bidi para prevenir UI Spoofing na tela de erro.
     * @param {string} [searchString=window.location.search]
     * @returns {string | null}
     */
    getProductIdFromUrl(searchString = window.location.search) {
      try {
        const params = new URLSearchParams(searchString);
        const rawId = params.get('id');
        if (!rawId) return null;

        // Remove caracteres de controle e limita a 48 caracteres imprimíveis seguros
        const sanitized = rawId.replace(/[^\w-]/g, '').trim().slice(0, 48);
        return sanitized.length > 0 ? sanitized : null;
      } catch {
        return null;
      }
    }
  });

  /* ==========================================================================
     2. HELPERS DE DOM SEGUROS (XSS-SAFE)
     ========================================================================== */
  const DomUtils = Object.freeze({
    /**
     * Seleciona um único elemento no contexto informado.
     * @param {string} selector
     * @param {ParentNode} [context=document]
     * @returns {HTMLElement | null}
     */
    qs(selector, context = document) {
      return context.querySelector(selector);
    },

    /**
     * Seleciona múltiplos elementos como Array no contexto informado.
     * @param {string} selector
     * @param {ParentNode} [context=document]
     * @returns {HTMLElement[]}
     */
    qsa(selector, context = document) {
      return [...context.querySelectorAll(selector)];
    },

    /**
     * Define textContent com segurança em um elemento, caso exista.
     * @param {Element | null} element
     * @param {string} text
     */
    setText(element, text) {
      if (!element) return;
      element.textContent = String(text ?? '');
    },

    /**
     * Cria um elemento HTML com classes e texto seguro (via textContent).
     * @param {string} tagName
     * @param {Object} [options]
     * @param {string} [options.className]
     * @param {string} [options.text]
     * @param {Record<string, string>} [options.attrs]
     * @returns {HTMLElement}
     */
    createElement(tagName, { className, text, attrs } = {}) {
      const el = document.createElement(tagName);
      if (className) el.className = className;
      if (text !== undefined) el.textContent = String(text);
      if (attrs) {
        Object.entries(attrs).forEach(([key, value]) => {
          el.setAttribute(key, String(value));
        });
      }
      return el;
    },

    /**
     * Valida se o caminho de imagem é relativo e pertence ao diretório seguro do projeto.
     * @param {string} path
     * @returns {string}
     */
    sanitizeImagePath(path) {
      if (typeof path !== 'string') return 'images/logo.jpg';
      const cleaned = path.trim();
      if (/^images\/[a-zA-Z0-9/_-]+\.(jpg|jpeg|png|webp|svg)$/i.test(cleaned)) {
        return cleaned;
      }
      return 'images/logo.jpg';
    },

    /**
     * Valida classes de ícones FontAwesome permitindo apenas caracteres seguros.
     * @param {string} iconClass
     * @param {string} fallback
     * @returns {string}
     */
    sanitizeIconClass(iconClass, fallback = 'fa-solid fa-capsules') {
      if (typeof iconClass !== 'string') return fallback;
      return /^fa-(solid|regular|brands)\s+fa-[a-z0-9-]+$/.test(iconClass.trim())
        ? iconClass.trim()
        : fallback;
    },

    /**
     * Gera a URL de pedido pelo WhatsApp com mensagem codificada via encodeURIComponent.
     * @param {Object} product
     * @param {number} [quantity=1]
     * @returns {string}
     */
    buildWhatsAppUrl(product, quantity = 1) {
      const qtyLabel = quantity > 1 ? `${quantity} unidades de ` : '';
      const totalFormatted = brlFormatter.format(product.price * quantity);
      const message =
        `Olá! Vi os detalhes da fórmula *${qtyLabel}${product.name}* (${product.pharmaceuticalForm} — ${totalFormatted}) ` +
        `no site da Botica Natural (Cód: ${product.sku}) e gostaria de fazer meu pedido / tirar uma dúvida com o farmacêutico.`;

      return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`;
    }
  });

  /* ==========================================================================
     3. VIEW — Renderizador Seguro da Página de Produto
     ========================================================================== */
  const ProductView = Object.freeze({
    /**
     * Exibe o estado de erro amigável quando o ID é ausente ou inválido.
     * @param {string | null} attemptedId
     */
    renderNotFound(attemptedId) {
      const contentSection = DomUtils.qs('[data-pdp-content]');
      const relatedSection = DomUtils.qs('[data-pdp-related-section]');
      const errorSection = DomUtils.qs('[data-pdp-error]');
      const errorDetail = DomUtils.qs('[data-pdp-error-detail]');
      const breadcrumbCurrent = DomUtils.qs('[data-pdp-breadcrumb-current]');

      if (contentSection) contentSection.hidden = true;
      if (relatedSection) relatedSection.hidden = true;

      if (breadcrumbCurrent) {
        DomUtils.setText(breadcrumbCurrent, 'Produto não encontrado');
      }

      if (errorDetail) {
        const message = attemptedId
          ? `Não localizamos nenhuma fórmula correspondente ao código "${attemptedId}". Verifique o endereço ou explore nosso catálogo completo abaixo.`
          : 'Nenhum código de produto foi informado no endereço da página. Selecione uma fórmula em nosso catálogo ou volte para a página inicial.';
        DomUtils.setText(errorDetail, message);
      }

      if (errorSection) {
        errorSection.hidden = false;
        errorSection.focus({ preventScroll: true });
      }

      document.title = 'Produto não encontrado | Botica Natural — Farmácia de Manipulação';
    },

    /**
     * Renderiza todos os dados do produto no DOM da página.
     * @param {Object} product
     * @param {ReadonlyArray<Object>} relatedProducts
     */
    renderProduct(product, relatedProducts) {
      const contentSection = DomUtils.qs('[data-pdp-content]');
      const errorSection = DomUtils.qs('[data-pdp-error]');
      if (errorSection) errorSection.hidden = true;
      if (contentSection) contentSection.hidden = false;

      // 1. Metadados do Documento (SEO Dinâmico)
      document.title = `${product.name} | Botica Natural — Farmácia de Manipulação`;
      const metaDesc = DomUtils.qs('meta[name="description"]');
      if (metaDesc) {
        metaDesc.setAttribute('content', `${product.name} (${product.pharmaceuticalForm}): ${product.shortDescription}`);
      }

      // 2. Breadcrumb Semântico
      const bcCategory = DomUtils.qs('[data-pdp-breadcrumb-category]');
      const bcCurrent = DomUtils.qs('[data-pdp-breadcrumb-current]');
      if (bcCategory) {
        DomUtils.setText(bcCategory, product.categoryLabel);
        bcCategory.setAttribute('href', `produtos.html#${encodeURIComponent(product.category)}`);
      }
      DomUtils.setText(bcCurrent, product.name);

      // 3. Mídia & Badges
      const imgEl = DomUtils.qs('[data-pdp-image]');
      if (imgEl) {
        imgEl.setAttribute('src', DomUtils.sanitizeImagePath(product.image));
        imgEl.setAttribute('alt', product.imageAlt || product.name);
      }

      const highlightBadge = DomUtils.qs('[data-pdp-badge-highlight]');
      if (highlightBadge) {
        highlightBadge.textContent = '';
        const icon = DomUtils.createElement('i', {
          className: DomUtils.sanitizeIconClass(product.highlightIcon, 'fa-solid fa-star'),
          attrs: { 'aria-hidden': 'true' }
        });
        highlightBadge.append(icon, document.createTextNode(` ${product.highlightBadge}`));
      }

      DomUtils.setText(DomUtils.qs('[data-pdp-badge-category]'), product.categoryLabel);

      // 4. Cabeçalho Técnico do Produto
      const formEl = DomUtils.qs('[data-pdp-form]');
      if (formEl) {
        formEl.textContent = '';
        const icon = DomUtils.createElement('i', {
          className: DomUtils.sanitizeIconClass(product.formIcon, 'fa-solid fa-capsules'),
          attrs: { 'aria-hidden': 'true' }
        });
        formEl.append(icon, document.createTextNode(` ${product.pharmaceuticalForm}`));
      }

      DomUtils.setText(DomUtils.qs('[data-pdp-sku]'), `Cód: ${product.sku}`);
      DomUtils.setText(DomUtils.qs('[data-pdp-title]'), product.name);
      DomUtils.setText(DomUtils.qs('[data-pdp-short-desc]'), product.shortDescription);
      DomUtils.setText(DomUtils.qs('[data-pdp-action]'), product.pharmacologicalAction);

      // 5. Lista de Benefícios Principais
      const benefitsList = DomUtils.qs('[data-pdp-benefits]');
      if (benefitsList && Array.isArray(product.benefits)) {
        benefitsList.textContent = '';
        const fragment = document.createDocumentFragment();

        product.benefits.forEach((benefitText) => {
          const li = DomUtils.createElement('li', { className: 'pdp-benefits__item' });
          const checkIcon = DomUtils.createElement('i', {
            className: 'fa-solid fa-circle-check',
            attrs: { 'aria-hidden': 'true' }
          });
          const span = DomUtils.createElement('span', { text: benefitText });
          li.append(checkIcon, span);
          fragment.appendChild(li);
        });

        benefitsList.appendChild(fragment);
      }

      // 6. Preço, Parcelamento e Controle de Quantidade Interativo
      this.initPricingAndQuantity(product);

      // 7. Abas de Ficha Técnica Farmacêutica
      this.renderTechnicalTabs(product);

      // 8. Produtos Relacionados
      this.renderRelatedProducts(relatedProducts);
    },

    /**
     * Inicializa a exibição de preço, cálculo seguro de parcelas e seletor de quantidade.
     * @param {Object} product
     */
    initPricingAndQuantity(product) {
      const priceEl = DomUtils.qs('[data-pdp-price]');
      const installmentsEl = DomUtils.qs('[data-pdp-installments]');
      const qtyInput = DomUtils.qs('[data-pdp-qty-value]');
      const btnDecrease = DomUtils.qs('[data-pdp-qty-minus]');
      const btnIncrease = DomUtils.qs('[data-pdp-qty-plus]');
      const primaryWaBtn = DomUtils.qs('[data-pdp-wa-primary]');
      const mobileWaBtn = DomUtils.qs('[data-pdp-wa-mobile]');

      const unitPrice = Number.isFinite(product.price) && product.price > 0 ? product.price : 0;
      const maxInstallments = Number.isSafeInteger(product.installmentsCount) && product.installmentsCount > 0
        ? product.installmentsCount
        : 1;

      let quantity = 1;

      const updatePricingUi = () => {
        const total = unitPrice * quantity;
        const installmentValue = total / maxInstallments;

        DomUtils.setText(priceEl, brlFormatter.format(total));

        if (installmentsEl) {
          installmentsEl.textContent = '';
          const prefix = document.createTextNode('ou em até ');
          const strong = DomUtils.createElement('strong', {
            text: `${maxInstallments}x de ${brlFormatter.format(installmentValue)}`
          });
          const suffix = document.createTextNode(' sem juros no cartão');
          installmentsEl.append(prefix, strong, suffix);
        }

        if (qtyInput) {
          DomUtils.setText(qtyInput, String(quantity));
        }

        if (btnDecrease) {
          btnDecrease.disabled = quantity <= 1;
        }
        if (btnIncrease) {
          btnIncrease.disabled = quantity >= 10;
        }

        const waUrl = DomUtils.buildWhatsAppUrl(product, quantity);
        if (primaryWaBtn) primaryWaBtn.setAttribute('href', waUrl);
        if (mobileWaBtn) mobileWaBtn.setAttribute('href', waUrl);
      };

      if (btnDecrease) {
        btnDecrease.onclick = () => {
          if (quantity > 1) {
            quantity -= 1;
            updatePricingUi();
          }
        };
      }

      if (btnIncrease) {
        btnIncrease.onclick = () => {
          if (quantity < 10) {
            quantity += 1;
            updatePricingUi();
          }
        };
      }

      updatePricingUi();
    },

    /**
     * Renderiza o conteúdo das 4 abas técnicas usando criação segura de nós DOM.
     * @param {Object} product
     */
    renderTechnicalTabs(product) {
      // Aba 1: Descrição Técnica
      const techContainer = DomUtils.qs('[data-pdp-tech-description]');
      if (techContainer && Array.isArray(product.technicalDescription)) {
        techContainer.textContent = '';
        const fragment = document.createDocumentFragment();
        product.technicalDescription.forEach((paragraphText) => {
          const p = DomUtils.createElement('p', {
            className: 'pdp-panel__paragraph',
            text: paragraphText
          });
          fragment.appendChild(p);
        });
        techContainer.appendChild(fragment);
      }

      // Aba 2: Composição Quantitativa
      const compTbody = DomUtils.qs('[data-pdp-composition-body]');
      if (compTbody && Array.isArray(product.composition)) {
        compTbody.textContent = '';
        const fragment = document.createDocumentFragment();
        product.composition.forEach((item) => {
          const tr = DomUtils.createElement('tr');
          const tdActive = DomUtils.createElement('td', {
            className: 'pdp-comp-table__active',
            text: item.active
          });
          const tdConc = DomUtils.createElement('td', {
            className: 'pdp-comp-table__conc',
            text: item.concentration
          });
          const tdRole = DomUtils.createElement('td', {
            className: 'pdp-comp-table__role',
            text: item.role
          });
          tr.append(tdActive, tdConc, tdRole);
          fragment.appendChild(tr);
        });
        compTbody.appendChild(fragment);
      }

      // Aba 3: Posologia & Modo de Uso
      DomUtils.setText(DomUtils.qs('[data-pdp-posology]'), product.posology);

      // Aba 4: Especificações & Segurança
      const specsGrid = DomUtils.qs('[data-pdp-specs-list]');
      if (specsGrid && Array.isArray(product.specifications)) {
        specsGrid.textContent = '';
        const fragment = document.createDocumentFragment();
        product.specifications.forEach((spec) => {
          const itemWrap = DomUtils.createElement('div', { className: 'pdp-specs__item' });
          const dt = DomUtils.createElement('dt', { className: 'pdp-specs__label', text: spec.label });
          const dd = DomUtils.createElement('dd', { className: 'pdp-specs__value', text: spec.value });
          itemWrap.append(dt, dd);
          fragment.appendChild(itemWrap);
        });
        specsGrid.appendChild(fragment);
      }

      DomUtils.setText(DomUtils.qs('[data-pdp-contraindications]'), product.contraindications);
    },

    /**
     * Renderiza os cards de produtos relacionados de forma 100% segura via DOM API.
     * @param {ReadonlyArray<Object>} relatedProducts
     */
    renderRelatedProducts(relatedProducts) {
      const section = DomUtils.qs('[data-pdp-related-section]');
      const grid = DomUtils.qs('[data-pdp-related-grid]');
      if (!grid || !Array.isArray(relatedProducts) || relatedProducts.length === 0) {
        if (section) section.hidden = true;
        return;
      }

      if (section) section.hidden = false;
      grid.textContent = '';
      const fragment = document.createDocumentFragment();

      relatedProducts.forEach((item) => {
        const productUrl = `produto.html?id=${encodeURIComponent(item.id)}`;
        const installmentVal = brlFormatter.format(item.price / item.installmentsCount);

        const article = DomUtils.createElement('article', { className: 'product-card' });

        // Media Link
        const mediaLink = DomUtils.createElement('a', {
          className: 'product-card__media product-card__media-link',
          attrs: { href: productUrl, 'aria-label': `Ver detalhes de ${item.name}` }
        });
        const img = DomUtils.createElement('img', {
          className: 'product-card__img',
          attrs: {
            src: DomUtils.sanitizeImagePath(item.image),
            alt: item.imageAlt || item.name,
            loading: 'lazy',
            width: '600',
            height: '450'
          }
        });
        const badgesWrap = DomUtils.createElement('div', { className: 'product-card__badges' });
        const badgeHighlight = DomUtils.createElement('span', {
          className: 'product-badge product-badge--bestseller'
        });
        const badgeIcon = DomUtils.createElement('i', {
          className: DomUtils.sanitizeIconClass(item.highlightIcon, 'fa-solid fa-star'),
          attrs: { 'aria-hidden': 'true' }
        });
        badgeHighlight.append(badgeIcon, document.createTextNode(` ${item.highlightBadge}`));

        const badgeCat = DomUtils.createElement('span', {
          className: 'product-badge product-badge--cat',
          text: item.categoryLabel
        });
        badgesWrap.append(badgeHighlight, badgeCat);
        mediaLink.append(img, badgesWrap);

        // Card Body
        const body = DomUtils.createElement('div', { className: 'product-card__body' });

        const formSpan = DomUtils.createElement('span', { className: 'product-card__form' });
        const formIcon = DomUtils.createElement('i', {
          className: DomUtils.sanitizeIconClass(item.formIcon, 'fa-solid fa-capsules'),
          attrs: { 'aria-hidden': 'true' }
        });
        formSpan.append(formIcon, document.createTextNode(` ${item.pharmaceuticalForm}`));

        const titleH3 = DomUtils.createElement('h3', { className: 'product-card__title' });
        const titleLink = DomUtils.createElement('a', {
          className: 'product-card__title-link',
          text: item.name,
          attrs: { href: productUrl }
        });
        titleH3.appendChild(titleLink);

        const descP = DomUtils.createElement('p', {
          className: 'product-card__desc',
          text: item.shortDescription
        });

        const priceBox = DomUtils.createElement('div', { className: 'product-card__price-box' });
        const priceLabel = DomUtils.createElement('span', {
          className: 'product-card__price-label',
          text: 'A partir de'
        });
        const priceVal = DomUtils.createElement('span', {
          className: 'product-card__price',
          text: brlFormatter.format(item.price)
        });
        const priceInst = DomUtils.createElement('span', {
          className: 'product-card__price-installments'
        });
        const instStrong = DomUtils.createElement('strong', {
          text: `${item.installmentsCount}x de ${installmentVal}`
        });
        priceInst.append(document.createTextNode('ou em até '), instStrong, document.createTextNode(' sem juros'));
        priceBox.append(priceLabel, priceVal, priceInst);

        const actionsDiv = DomUtils.createElement('div', { className: 'product-card__actions' });
        const detailsBtn = DomUtils.createElement('a', {
          className: 'product-card__btn product-card__btn--details',
          attrs: { href: productUrl }
        });
        const eyeIcon = DomUtils.createElement('i', {
          className: 'fa-solid fa-flask',
          attrs: { 'aria-hidden': 'true' }
        });
        detailsBtn.append(eyeIcon, document.createTextNode(' Ver detalhes da fórmula'));

        const waBtn = DomUtils.createElement('a', {
          className: 'product-card__btn',
          attrs: {
            href: DomUtils.buildWhatsAppUrl(item, 1),
            target: '_blank',
            rel: 'noopener noreferrer',
            'data-wa': `relacionado-${item.slug}`
          }
        });
        const waIcon = DomUtils.createElement('i', {
          className: 'fa-brands fa-whatsapp',
          attrs: { 'aria-hidden': 'true' }
        });
        waBtn.append(waIcon, document.createTextNode(' Pedir pelo WhatsApp'));

        actionsDiv.append(detailsBtn, waBtn);
        body.append(formSpan, titleH3, descP, priceBox, actionsDiv);
        article.append(mediaLink, body);
        fragment.appendChild(article);
      });

      grid.appendChild(fragment);
    },

    /**
     * Inicializa a navegação acessível por abas da Ficha Técnica (WAI-ARIA Tabs Pattern).
     */
    initAccessibleTabs() {
      const tablist = DomUtils.qs('[data-pdp-tablist]');
      if (!tablist) return;

      const tabs = DomUtils.qsa('[role="tab"]', tablist);
      const panels = DomUtils.qsa('[role="tabpanel"]');

      const activateTab = (selectedTab, { focus = false } = {}) => {
        const targetPanelId = selectedTab.getAttribute('aria-controls');

        tabs.forEach((tab) => {
          const isSelected = tab === selectedTab;
          tab.classList.toggle('is-active', isSelected);
          tab.setAttribute('aria-selected', String(isSelected));
          tab.setAttribute('tabindex', isSelected ? '0' : '-1');
        });

        panels.forEach((panel) => {
          panel.hidden = panel.id !== targetPanelId;
        });

        if (focus) selectedTab.focus();
      };

      tabs.forEach((tab, index) => {
        tab.addEventListener('click', () => activateTab(tab));

        tab.addEventListener('keydown', (event) => {
          let nextIndex = null;
          if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
          if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
          if (event.key === 'Home') nextIndex = 0;
          if (event.key === 'End') nextIndex = tabs.length - 1;

          if (nextIndex !== null) {
            event.preventDefault();
            activateTab(tabs[nextIndex], { focus: true });
          }
        });
      });
    }
  });

  /* ==========================================================================
     4. BOOTSTRAP — Orquestrador Principal da Página de Produto
     ========================================================================== */
  const initProductPage = () => {
    const repository = window.BoticaProductRepository;
    if (!repository) {
      ProductView.renderNotFound(null);
      return;
    }

    const productId = ProductRouter.getProductIdFromUrl();
    if (!productId) {
      ProductView.renderNotFound(null);
      return;
    }

    const product = repository.findById(productId);
    if (!product) {
      ProductView.renderNotFound(productId);
      return;
    }

    const relatedProducts = repository.findRelated(product, 3);
    ProductView.renderProduct(product, relatedProducts);
    ProductView.initAccessibleTabs();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProductPage);
  } else {
    initProductPage();
  }
})();

