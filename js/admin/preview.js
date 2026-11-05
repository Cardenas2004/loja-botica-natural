// @ts-check
/**
 * Controlador de Pré-visualização em Tempo Real da Página de Produto (Fase 3).
 * Comunica-se com `<iframe src="produto.html?preview=1">` via `postMessage` na mesma origem.
 */

import { el, createIcon, debounce } from './ui.js';

/** @typedef {'mobile' | 'tablet' | 'desktop'} PreviewViewport */

const VIEWPORT_WIDTHS = {
  mobile: 375,
  tablet: 768,
  desktop: 1280,
};

/**
 * Cria o painel de pré-visualização em tempo real com alternador de dispositivo e sincronização via `postMessage`.
 */
export function createLiveProductPreview() {
  /** @type {PreviewViewport} */
  let currentViewport = 'desktop';
  let isIframeReady = false;
  let isFullscreen = false;
  /** @type {{ product: any, whatsappTemplate?: string | null } | null} */
  let lastPayload = null;

  const syncBadge = el(
    'span',
    { className: 'badge badge-success preview-sync-badge' },
    [
      createIcon('fa-solid fa-bolt'),
      el('span', { textContent: 'Ao vivo' }),
    ]
  );

  // Botões de alternância de largura (Mobile 375px | Tablet 768px | Desktop 1280px)
  /** @type {Map<PreviewViewport, HTMLButtonElement>} */
  const viewportBtns = new Map();

  /** @type {Array<{ id: PreviewViewport, icon: string, label: string }>} */
  const devices = [
    { id: 'mobile', icon: 'fa-solid fa-mobile-screen', label: 'Mobile (375px)' },
    { id: 'tablet', icon: 'fa-solid fa-tablet-screen-button', label: 'Tablet (768px)' },
    { id: 'desktop', icon: 'fa-solid fa-desktop', label: 'Desktop (1280px)' },
  ];

  const deviceToolbar = el('div', {
    className: 'preview-device-switcher',
    role: 'group',
    'aria-label': 'Largura da pré-visualização',
  });

  devices.forEach((dev) => {
    const isSelected = dev.id === currentViewport;
    const btn = /** @type {HTMLButtonElement} */ (
      el(
        'button',
        {
          type: 'button',
          className: `preview-device-btn ${isSelected ? 'is-active' : ''}`,
          title: dev.label,
          'aria-label': dev.label,
          'aria-pressed': isSelected ? 'true' : 'false',
          onClick: () => setViewport(dev.id),
        },
        [createIcon(dev.icon), el('span', { className: 'preview-device-btn__text', textContent: dev.id === 'mobile' ? '375' : dev.id === 'tablet' ? '768' : '1280' })]
      )
    );
    viewportBtns.set(dev.id, btn);
    deviceToolbar.appendChild(btn);
  });

  const fullscreenBtn = /** @type {HTMLButtonElement} */ (
    el(
      'button',
      {
        type: 'button',
        className: 'btn btn-secondary btn-sm',
        title: 'Alternar pré-visualização em tela cheia',
        'aria-label': 'Alternar pré-visualização em tela cheia',
        onClick: () => toggleFullscreen(),
      },
      [createIcon('fa-solid fa-expand'), el('span', { textContent: 'Tela cheia' })]
    )
  );

  const iframe = /** @type {HTMLIFrameElement} */ (
    el('iframe', {
      src: 'produto.html?preview=1',
      className: 'live-preview-iframe',
      title: 'Pré-visualização em tempo real da página de produto',
    })
  );

  const stageOuter = el('div', { className: 'live-preview-stage' }, [
    el('div', { className: 'live-preview-viewport-frame' }, [iframe]),
  ]);

  const panelRoot = el('aside', {
    className: 'live-preview-panel',
    'aria-label': 'Pré-visualização da página de produto',
  }, [
    el('div', { className: 'live-preview-header' }, [
      el('div', { className: 'live-preview-header__title' }, [
        createIcon('fa-regular fa-eye'),
        el('span', { textContent: 'Preview da Página de Produto' }),
        syncBadge,
      ]),
      el('div', { className: 'live-preview-header__controls' }, [
        deviceToolbar,
        fullscreenBtn,
      ]),
    ]),
    stageOuter,
    el('div', { className: 'live-preview-footer' }, [
      createIcon('fa-solid fa-circle-info'),
      el('span', {
        textContent:
          'Este preview usa exatamente o mesmo renderizador e CSS da página pública (produto.html).',
      }),
    ]),
  ]);

  /**
   * Calcula a escala proporcional (`transform: scale`) para caber a largura simulada dentro do container.
   */
  function updateViewportScale() {
    const frameWrap = /** @type {HTMLElement | null} */ (
      stageOuter.querySelector('.live-preview-viewport-frame')
    );
    if (!frameWrap) return;

    const targetWidth = VIEWPORT_WIDTHS[currentViewport];
    const availableWidth = Math.max(280, (stageOuter.clientWidth || 560) - 24);
    const scale = Math.min(1, availableWidth / targetWidth);
    const stageHeight = isFullscreen ? Math.max(580, window.innerHeight - 140) : 640;

    iframe.style.width = `${targetWidth}px`;
    iframe.style.height = `${Math.round(stageHeight / scale)}px`;
    iframe.style.transform = `scale(${scale.toFixed(4)})`;
    iframe.style.transformOrigin = 'top left';

    frameWrap.style.width = `${Math.round(targetWidth * scale)}px`;
    frameWrap.style.height = `${stageHeight}px`;
  }

  /**
   * Altera a largura simulada do dispositivo.
   * @param {PreviewViewport} nextViewport
   */
  function setViewport(nextViewport) {
    currentViewport = nextViewport;
    for (const [id, btn] of viewportBtns.entries()) {
      const active = id === nextViewport;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
    updateViewportScale();
  }

  /**
   * Alterna o modo de tela cheia do painel de preview.
   */
  function toggleFullscreen() {
    isFullscreen = !isFullscreen;
    panelRoot.classList.toggle('is-fullscreen', isFullscreen);
    fullscreenBtn.replaceChildren(
      createIcon(isFullscreen ? 'fa-solid fa-compress' : 'fa-solid fa-expand'),
      el('span', { textContent: isFullscreen ? 'Fechar tela cheia' : 'Tela cheia' })
    );
    window.requestAnimationFrame(updateViewportScale);
  }

  /**
   * Envia o payload atual ao iframe de preview via `postMessage` restrito à mesma origem.
   */
  function flushPostMessage() {
    if (!lastPayload || !iframe.contentWindow) return;
    try {
      iframe.contentWindow.postMessage(
        {
          type: 'botica:preview-update',
          product: lastPayload.product,
          whatsappTemplate: lastPayload.whatsappTemplate || null,
        },
        window.location.origin
      );
    } catch {
      // Ignora caso o iframe ainda esteja carregando
    }
  }

  const debouncedPostMessage = debounce(() => {
    flushPostMessage();
  }, 150);

  // Escuta confirmação de prontidão do iframe
  const onWindowMessage = (/** @type {MessageEvent} */ event) => {
    if (event.origin !== window.location.origin || event.source !== iframe.contentWindow) {
      return;
    }
    if (event.data && event.data.type === 'botica:preview-ready') {
      isIframeReady = true;
      updateViewportScale();
      flushPostMessage();
    }
  };

  window.addEventListener('message', onWindowMessage);

  iframe.addEventListener('load', () => {
    isIframeReady = true;
    updateViewportScale();
    flushPostMessage();
  });

  // Observa redimensionamento do container para recalcular a escala
  let resizeObserver = null;
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      updateViewportScale();
    });
    resizeObserver.observe(stageOuter);
  }

  return {
    element: panelRoot,
    /**
     * Agenda atualização em tempo real (debounce de 150ms) com os dados do formulário.
     * @param {any} productData
     * @param {string | null} [whatsappTemplate]
     */
    scheduleUpdate(productData, whatsappTemplate = null) {
      lastPayload = { product: productData, whatsappTemplate };
      if (isIframeReady) {
        debouncedPostMessage();
      }
    },
    /**
     * Faz scroll e destaca o campo correspondente dentro da pré-visualização.
     * @param {string} fieldName
     */
    focusField(fieldName) {
      if (!isIframeReady || !iframe.contentWindow || !fieldName) return;
      try {
        iframe.contentWindow.postMessage(
          { type: 'botica:preview-focus', field: fieldName },
          window.location.origin
        );
      } catch {
        // Ignora erro de cross-frame se não carregado
      }
    },
    refreshScale: updateViewportScale,
    destroy() {
      window.removeEventListener('message', onWindowMessage);
      if (resizeObserver) resizeObserver.disconnect();
    },
  };
}

