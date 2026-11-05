// @ts-check
/**
 * Componentes e utilitários padronizados de interface do Painel Administrativo.
 * Zero `innerHTML` com dados dinâmicos — construção 100% via DOM API.
 */

const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * Formata valor numérico para moeda BRL (`R$ 0,00`).
 * @param {number | string | null | undefined} value
 * @returns {string}
 */
export function formatBRL(value) {
  const num = typeof value === 'number' ? value : Number.parseFloat(String(value ?? '0'));
  return brlFormatter.format(Number.isFinite(num) ? num : 0);
}

/**
 * Formata uma data ISO para leitura curta em português.
 * @param {string | null | undefined} isoDate
 * @returns {string}
 */
export function formatDateShort(isoDate) {
  if (!isoDate) return '—';
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return '—';
  return dateFormatter.format(d);
}

/**
 * Converte um texto qualquer em `slug` URL-safe.
 * @param {string} text
 * @returns {string}
 */
export function generateSlug(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Cria uma função com debounce.
 * @template {(...args: any[]) => void} T
 * @param {T} fn
 * @param {number} [delay=200]
 * @returns {(...args: Parameters<T>) => void}
 */
export function debounce(fn, delay = 200) {
  /** @type {ReturnType<typeof setTimeout> | null} */
  let timer = null;
  return (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Cria um elemento de ícone FontAwesome com `aria-hidden="true"`.
 * @param {string} className
 * @returns {HTMLElement}
 */
export function createIcon(className) {
  const i = document.createElement('i');
  i.className = className;
  i.setAttribute('aria-hidden', 'true');
  return i;
}

/**
 * Helper declarativo seguro para criar elementos DOM sem `innerHTML`.
 *
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tag
 * @param {Record<string, any>} [attrs]
 * @param {Array<Node | string | null | undefined | false>} [children]
 * @returns {HTMLElementTagNameMap[K]}
 */
export function el(tag, attrs = {}, children = []) {
  const element = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;

    if (key === 'className') {
      element.className = String(value);
    } else if (key === 'textContent') {
      element.textContent = String(value);
    } else if (key === 'hidden') {
      element.hidden = Boolean(value);
    } else if (key === 'disabled') {
      /** @type {any} */ (element).disabled = Boolean(value);
    } else if (key === 'checked') {
      /** @type {any} */ (element).checked = Boolean(value);
    } else if (key === 'value') {
      /** @type {any} */ (element).value = String(value);
    } else if (key === 'dataset' && typeof value === 'object') {
      for (const [dKey, dVal] of Object.entries(value)) {
        if (dVal !== undefined && dVal !== null) {
          element.dataset[dKey] = String(dVal);
        }
      }
    } else if (key.startsWith('on') && typeof value === 'function') {
      const eventName = key.slice(2).toLowerCase();
      element.addEventListener(eventName, value);
    } else {
      element.setAttribute(key, value === true ? '' : String(value));
    }
  }

  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (typeof child === 'string') {
      element.appendChild(document.createTextNode(child));
    } else if (child instanceof Node) {
      element.appendChild(child);
    }
  }

  return element;
}

/**
 * Exibe uma notificação flutuante empilhável em `#toast-container`.
 * @param {string} message
 * @param {'success' | 'error' | 'warning' | 'info'} [type='success']
 */
export function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const iconMap = {
    success: 'fa-solid fa-circle-check',
    error: 'fa-solid fa-circle-exclamation',
    warning: 'fa-solid fa-triangle-exclamation',
    info: 'fa-solid fa-circle-info',
  };

  const toast = el('div', {
    className: `toast toast--${type}`,
    role: type === 'error' ? 'alert' : 'status',
  });

  const contentWrap = el(
    'div',
    { className: 'toast__content' },
    [
      createIcon(iconMap[type] || iconMap.info),
      el('span', { className: 'toast__text', textContent: message }),
    ]
  );

  const closeBtn = el(
    'button',
    {
      type: 'button',
      className: 'btn btn-icon toast__close',
      'aria-label': 'Fechar notificação',
      onClick: () => toast.remove(),
    },
    [createIcon('fa-solid fa-xmark')]
  );

  toast.append(contentWrap, closeBtn);
  container.appendChild(toast);

  window.setTimeout(() => {
    if (toast.isConnected) toast.remove();
  }, 4500);
}

/**
 * Abre o modal nativo `<dialog id="confirm-modal">` e retorna `Promise<boolean>`.
 * Substitui `window.confirm()` em todo o painel administrativo.
 *
 * @param {{
 *   title?: string,
 *   message: string,
 *   confirmLabel?: string,
 *   cancelLabel?: string,
 *   variant?: 'danger' | 'primary' | 'warning'
 * }} options
 * @returns {Promise<boolean>}
 */
export function confirmAction({
  title = 'Confirmar ação',
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
}) {
  const dialog = /** @type {HTMLDialogElement | null} */ (document.getElementById('confirm-modal'));
  const titleEl = document.getElementById('modal-title');
  const messageEl = document.getElementById('modal-message');
  const confirmBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('modal-btn-confirm'));
  const cancelBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('modal-btn-cancel'));
  const iconWrap = document.getElementById('modal-icon-wrap');

  if (!dialog || typeof dialog.showModal !== 'function' || !confirmBtn || !cancelBtn) {
    return Promise.resolve(false);
  }

  if (titleEl) titleEl.textContent = title;
  if (messageEl) messageEl.textContent = message;

  cancelBtn.textContent = cancelLabel;
  confirmBtn.className = `btn ${variant === 'primary' ? 'btn-primary' : 'btn-danger'}`;
  confirmBtn.replaceChildren(
    createIcon(variant === 'primary' ? 'fa-solid fa-check' : 'fa-regular fa-trash-can'),
    el('span', { textContent: confirmLabel })
  );

  if (iconWrap) {
    iconWrap.className = `confirm-modal__icon confirm-modal__icon--${variant}`;
  }

  return new Promise((resolve) => {
    let settled = false;

    const finalize = (/** @type {boolean} */ result) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (dialog.open) dialog.close();
      resolve(result);
    };

    const onConfirm = () => finalize(true);
    const onCancel = () => finalize(false);
    const onDialogCancel = (/** @type {Event} */ e) => {
      e.preventDefault();
      finalize(false);
    };

    const cleanup = () => {
      confirmBtn.removeEventListener('click', onConfirm);
      cancelBtn.removeEventListener('click', onCancel);
      dialog.removeEventListener('cancel', onDialogCancel);
    };

    confirmBtn.addEventListener('click', onConfirm);
    cancelBtn.addEventListener('click', onCancel);
    dialog.addEventListener('cancel', onDialogCancel);

    if (!dialog.open) {
      dialog.showModal();
    }
    cancelBtn.focus();
  });
}

/**
 * Alterna o estado de carregamento (`disabled` + spinner) de um botão.
 * @param {HTMLButtonElement | null} button
 * @param {boolean} isLoading
 * @param {string} loadingText
 * @param {string} defaultText
 * @param {string} [iconClass='fa-solid fa-check']
 */
export function setButtonLoading(
  button,
  isLoading,
  loadingText,
  defaultText,
  iconClass = 'fa-solid fa-check'
) {
  if (!button) return;
  button.disabled = isLoading;
  button.replaceChildren(
    createIcon(isLoading ? 'fa-solid fa-circle-notch fa-spin' : iconClass),
    el('span', { textContent: isLoading ? loadingText : defaultText })
  );
}

/**
 * Cria um componente de estado vazio ilustrado com CTA opcional.
 * @param {{
 *   icon?: string,
 *   title: string,
 *   description: string,
 *   ctaLabel?: string,
 *   onCtaClick?: () => void
 * }} config
 * @returns {HTMLElement}
 */
export function createEmptyState({
  icon = 'fa-solid fa-box-open',
  title,
  description,
  ctaLabel,
  onCtaClick,
}) {
  const children = [
    el('div', { className: 'empty-state__icon', 'aria-hidden': 'true' }, [createIcon(icon)]),
    el('h3', { className: 'empty-state__title', textContent: title }),
    el('p', { className: 'empty-state__desc', textContent: description }),
  ];

  if (ctaLabel && typeof onCtaClick === 'function') {
    children.push(
      el(
        'button',
        {
          type: 'button',
          className: 'btn btn-primary empty-state__cta',
          onClick: onCtaClick,
        },
        [createIcon('fa-solid fa-plus'), el('span', { textContent: ctaLabel })]
      )
    );
  }

  return el('div', { className: 'empty-state' }, children);
}

