// @ts-check
/**
 * Componente de Editor de Texto Rico acessível e seguro (Botica Natural).
 * Zero dependências externas, zero uso de `innerHTML` (construção e colagem via DOM API + AST).
 */

import {
  sanitizeRichText,
  sanitizeRichHtml,
  legacyPlainTextToHtml,
  extractPlainText,
  normalizeTextMode,
  renderSanitizedRichText,
  DEFAULT_FIELD_MODES,
  FIELD_CHAR_LIMITS,
} from '../shared/richtext.js';

import { el, createIcon, showToast } from './ui.js';
import { classifySafeLink } from '../shared/urlSafety.js';

/**
 * Serializa os filhos de um elemento DOM do editor para HTML bruto antes de passar pelo sanitizador.
 * Evita leitura de `.innerHTML`.
 * @param {Node} rootNode
 * @returns {string}
 */
function serializeDomChildren(rootNode) {
  let out = '';
  const childNodes = rootNode.childNodes;
  for (let i = 0; i < childNodes.length; i += 1) {
    const node = childNodes[i];
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.nodeValue || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      out += text;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const elem = /** @type {HTMLElement} */ (node);
      const tag = elem.tagName.toLowerCase();
      if (tag === 'br') {
        out += '<br>';
      } else {
        let attr = '';
        if (tag === 'a') {
          const href = elem.getAttribute('href');
          if (href) {
            const escapedHref = href.replace(/"/g, '&quot;');
            attr = ` href="${escapedHref}"`;
          }
        }
        out += `<${tag}${attr}>${serializeDomChildren(elem)}</${tag}>`;
      }
    }
  }
  return out;
}

/**
 * Adaptador isolado de comandos de formatação no elemento `contenteditable`.
 * @param {HTMLElement} editableEl
 * @param {string} command
 * @param {string} [value]
 */
function applyEditorCommand(editableEl, command, value = '') {
  editableEl.focus();

  try {
    if (command === 'h3' || command === 'h4' || command === 'p' || command === 'blockquote') {
      document.execCommand('formatBlock', false, `<${command}>`);
      return;
    }
    if (command === 'unlink') {
      document.execCommand('unlink', false);
      return;
    }
    if (command === 'removeFormat') {
      document.execCommand('removeFormat', false);
      document.execCommand('formatBlock', false, '<p>');
      return;
    }
    document.execCommand(command, false, value);
  } catch {
    // Fallback silencioso caso o navegador restrinja algum comando específico
  }
}

/**
 * Cria uma instância completa do Editor de Texto Rico para um campo do formulário.
 *
 * @param {{
 *   fieldName: string,
 *   label: string,
 *   hint?: string,
 *   placeholder?: string,
 *   initialValue?: string,
 *   initialMode?: 'paragraphs' | 'lines' | 'inline',
 *   maxLength?: number,
 *   minHeight?: number,
 *   onChange?: (sanitizedHtml: string, mode: 'paragraphs' | 'lines' | 'inline') => void,
 *   onFocusField?: (fieldName: string) => void
 * }} config
 */
export function createRichTextEditor(config) {
  const fieldName = config.fieldName;
  const defaultMode =
    DEFAULT_FIELD_MODES[/** @type {keyof typeof DEFAULT_FIELD_MODES} */ (fieldName)] ||
    'paragraphs';
  let currentMode = normalizeTextMode(config.initialMode, defaultMode);
  const maxLength =
    config.maxLength ||
    FIELD_CHAR_LIMITS[/** @type {keyof typeof FIELD_CHAR_LIMITS} */ (fieldName)] ||
    2000;

  /** @type {string[]} */
  const historyStack = [];
  let historyIndex = -1;
  let isApplyingHistory = false;

  const pushHistory = (/** @type {string} */ snapshot) => {
    if (isApplyingHistory) return;
    if (historyIndex >= 0 && historyStack[historyIndex] === snapshot) return;
    historyStack.splice(historyIndex + 1);
    historyStack.push(snapshot);
    if (historyStack.length > 40) {
      historyStack.shift();
    } else {
      historyIndex += 1;
    }
  };

  // Seletor de "Modo do texto"
  const modeSelect = /** @type {HTMLSelectElement} */ (
    el(
      'select',
      {
        className: 'rte-mode-select',
        'aria-label': `Modo do texto para ${config.label}`,
        title: 'Define como parágrafos e quebras de linha são renderizados na página do produto',
      },
      [
        el('option', { value: 'paragraphs', textContent: 'Modo: Parágrafos (<p>, listas)' }),
        el('option', { value: 'lines', textContent: 'Modo: Quebras de linha (<br>)' }),
        el('option', { value: 'inline', textContent: 'Modo: Texto corrido (sem quebras)' }),
      ]
    )
  );
  modeSelect.value = currentMode;

  // Definição dos botões da Toolbar
  /**
   * @typedef {{
   *   id: string,
   *   icon: string,
   *   label: string,
   *   cmd: string,
   *   blockOnly?: boolean,
   *   queryTag?: string
   * }} ToolbarItem
   */

  /** @type {ToolbarItem[]} */
  const toolbarItems = [
    { id: 'bold', icon: 'fa-solid fa-bold', label: 'Negrito (Ctrl+B)', cmd: 'bold', queryTag: 'STRONG' },
    { id: 'italic', icon: 'fa-solid fa-italic', label: 'Itálico (Ctrl+I)', cmd: 'italic', queryTag: 'EM' },
    { id: 'underline', icon: 'fa-solid fa-underline', label: 'Sublinhado (Ctrl+U)', cmd: 'underline', queryTag: 'U' },
    { id: 'strike', icon: 'fa-solid fa-strikethrough', label: 'Tachado', cmd: 'strikeThrough', queryTag: 'S' },
    { id: 'ul', icon: 'fa-solid fa-list-ul', label: 'Lista com marcadores', cmd: 'insertUnorderedList', blockOnly: true, queryTag: 'UL' },
    { id: 'ol', icon: 'fa-solid fa-list-ol', label: 'Lista numerada', cmd: 'insertOrderedList', blockOnly: true, queryTag: 'OL' },
    { id: 'quote', icon: 'fa-solid fa-quote-left', label: 'Citação / Destaque', cmd: 'blockquote', blockOnly: true, queryTag: 'BLOCKQUOTE' },
    { id: 'h3', icon: 'fa-solid fa-heading', label: 'Subtítulo H3', cmd: 'h3', blockOnly: true, queryTag: 'H3' },
    { id: 'h4', icon: 'fa-solid fa-text-height', label: 'Subtítulo H4', cmd: 'h4', blockOnly: true, queryTag: 'H4' },
    { id: 'link', icon: 'fa-solid fa-link', label: 'Inserir ou remover link', cmd: 'link', queryTag: 'A' },
    { id: 'clear', icon: 'fa-solid fa-eraser', label: 'Limpar formatação', cmd: 'removeFormat' },
    { id: 'undo', icon: 'fa-solid fa-rotate-left', label: 'Desfazer (Ctrl+Z)', cmd: 'undo' },
    { id: 'redo', icon: 'fa-solid fa-rotate-right', label: 'Refazer (Ctrl+Y)', cmd: 'redo' },
  ];

  /** @type {Map<string, HTMLButtonElement>} */
  const toolbarButtons = new Map();

  const toolbarEl = el('div', {
    className: 'rte-toolbar',
    role: 'toolbar',
    'aria-label': `Formatação de ${config.label}`,
  });

  // Popover inline para inserção segura de link
  const linkPopover = el('div', { className: 'rte-link-popover', hidden: true });
  const linkInput = /** @type {HTMLInputElement} */ (
    el('input', {
      type: 'url',
      className: 'form-control rte-link-input',
      placeholder: 'https://exemplo.com.br ou mailto: / tel:',
      'aria-label': 'URL do link',
    })
  );
  const linkApplyBtn = el(
    'button',
    { type: 'button', className: 'btn btn-primary btn-sm', textContent: 'Aplicar' }
  );
  const linkRemoveBtn = el(
    'button',
    { type: 'button', className: 'btn btn-secondary btn-sm', textContent: 'Remover link' }
  );
  const linkCancelBtn = el(
    'button',
    { type: 'button', className: 'btn btn-icon btn-sm', 'aria-label': 'Fechar', onClick: () => { linkPopover.hidden = true; } },
    [createIcon('fa-solid fa-xmark')]
  );
  linkPopover.append(linkInput, linkApplyBtn, linkRemoveBtn, linkCancelBtn);

  /** @type {Range | null} */
  let savedSelectionRange = null;

  const saveCurrentSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editableArea.contains(sel.anchorNode)) {
      savedSelectionRange = sel.getRangeAt(0).cloneRange();
    }
  };

  const restoreSavedSelection = () => {
    if (!savedSelectionRange) return;
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(savedSelectionRange);
    }
  };

  // Área editável principal
  const editableArea = el('div', {
    className: 'rte-editable pd-richtext',
    contenteditable: 'true',
    role: 'textbox',
    'aria-multiline': currentMode === 'inline' ? 'false' : 'true',
    'aria-label': config.label,
    dataset: {
      placeholder: config.placeholder || 'Digite ou cole o texto aqui...',
      field: fieldName,
    },
  });

  if (config.minHeight) {
    const sizeMod =
      config.minHeight >= 180
        ? 'rte-editable--tall'
        : config.minHeight >= 100
          ? 'rte-editable--medium'
          : 'rte-editable--compact';
    editableArea.classList.add(sizeMod);
  }

  // Contador de caracteres
  const charCounterEl = el('span', {
    className: 'char-counter',
    textContent: `0 / ${maxLength} caracteres`,
  });

  const modeHintEl = el('span', {
    className: 'rte-footer-hint',
    textContent: getModeDescription(currentMode),
  });

  function getModeDescription(/** @type {'paragraphs' | 'lines' | 'inline'} */ mode) {
    if (mode === 'inline') return 'Texto corrido (Enter desativado)';
    if (mode === 'lines') return 'Quebras simples (<br>)';
    return 'Parágrafos e listas ativas';
  }

  /**
   * Obtém o HTML sanitizado atual do editor.
   */
  function getSanitizedValue() {
    const rawHtml = serializeDomChildren(editableArea);
    return sanitizeRichHtml(rawHtml, { mode: currentMode });
  }

  /**
   * Atualiza o contador de caracteres e dispara `onChange`.
   */
  function syncEditorState(recordHistory = true) {
    const sanitized = getSanitizedValue();
    const plain = extractPlainText(sanitized);
    const len = plain.length;

    charCounterEl.textContent = `${len} / ${maxLength} caracteres`;
    charCounterEl.classList.toggle('is-warning', len >= maxLength * 0.85 && len <= maxLength);
    charCounterEl.classList.toggle('is-danger', len > maxLength);

    if (recordHistory) {
      pushHistory(sanitized);
    }

    updateToolbarActiveStates();

    if (typeof config.onChange === 'function') {
      config.onChange(sanitized, currentMode);
    }
  }

  /**
   * Atualiza os atributos `aria-pressed` e habilitação dos botões de bloco conforme o modo.
   */
  function updateToolbarActiveStates() {
    const isParagraphMode = currentMode === 'paragraphs';
    const sel = window.getSelection();
    const anchorNode = sel?.anchorNode || null;
    const anchorEl =
      anchorNode instanceof HTMLElement ? anchorNode : anchorNode?.parentElement || null;

    for (const item of toolbarItems) {
      const btn = toolbarButtons.get(item.id);
      if (!btn) continue;

      if (item.blockOnly) {
        btn.disabled = !isParagraphMode;
      }

      if (item.queryTag && anchorEl && editableArea.contains(anchorEl)) {
        const isActive = Boolean(anchorEl.closest(item.queryTag.toLowerCase()));
        btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        btn.classList.toggle('is-active', isActive);
      } else {
        btn.setAttribute('aria-pressed', 'false');
        btn.classList.remove('is-active');
      }
    }
  }

  /**
   * Executa Desfazer (`undo`) ou Refazer (`redo`) usando a pilha de histórico sanitizada.
   * @param {'undo' | 'redo'} direction
   */
  function handleHistoryStep(direction) {
    if (direction === 'undo' && historyIndex > 0) {
      historyIndex -= 1;
    } else if (direction === 'redo' && historyIndex < historyStack.length - 1) {
      historyIndex += 1;
    } else {
      return;
    }

    isApplyingHistory = true;
    const targetHtml = historyStack[historyIndex] || '';
    renderSanitizedRichText(editableArea, targetHtml, { mode: currentMode, isV2: true });
    isApplyingHistory = false;
    syncEditorState(false);
  }

  // Constrói os botões da toolbar com suporte a navegação por setas (Roving Tabindex)
  toolbarItems.forEach((item, index) => {
    const btn = /** @type {HTMLButtonElement} */ (
      el(
        'button',
        {
          type: 'button',
          className: 'rte-toolbar__btn',
          title: item.label,
          'aria-label': item.label,
          'aria-pressed': 'false',
          tabindex: index === 0 ? '0' : '-1',
          onMouseDown: (/** @type {MouseEvent} */ e) => {
            // Preserva a seleção do texto ao clicar no botão da barra
            e.preventDefault();
          },
          onClick: () => {
            if (btn.disabled) return;
            if (item.cmd === 'undo') {
              handleHistoryStep('undo');
              return;
            }
            if (item.cmd === 'redo') {
              handleHistoryStep('redo');
              return;
            }
            if (item.cmd === 'link') {
              saveCurrentSelection();
              linkPopover.hidden = !linkPopover.hidden;
              if (!linkPopover.hidden) {
                linkInput.focus();
              }
              return;
            }
            applyEditorCommand(editableArea, item.cmd);
            syncEditorState(true);
          },
        },
        [createIcon(item.icon)]
      )
    );

    toolbarButtons.set(item.id, btn);
    toolbarEl.appendChild(btn);
  });

  // Navegação por teclado (ArrowLeft / ArrowRight) na toolbar
  toolbarEl.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const enabledButtons = Array.from(toolbarButtons.values()).filter((b) => !b.disabled);
    if (enabledButtons.length === 0) return;

    const currentIndex = enabledButtons.indexOf(/** @type {HTMLButtonElement} */ (document.activeElement));
    if (currentIndex === -1) return;

    event.preventDefault();
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (currentIndex + delta + enabledButtons.length) % enabledButtons.length;
    enabledButtons.forEach((b, i) => b.setAttribute('tabindex', i === nextIndex ? '0' : '-1'));
    enabledButtons[nextIndex].focus();
  });

  // Ações do popover de Link
  linkApplyBtn.addEventListener('click', () => {
    const linkInfo = classifySafeLink(linkInput.value);
    const safeHref = linkInfo.valid ? linkInfo.href : null;
    if (!safeHref) {
      showToast('URL inválida. Use https://, http://, mailto:, tel: ou caminho relativo seguro.', 'warning');
      linkInput.focus();
      return;
    }
    linkPopover.hidden = true;
    editableArea.focus();
    restoreSavedSelection();

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      applyEditorCommand(editableArea, 'createLink', safeHref);
      if (linkInfo.isExternal || linkInfo.kind === 'https' || linkInfo.kind === 'http') {
        editableArea.querySelectorAll('a').forEach((anchorEl) => {
          if (anchorEl.getAttribute('href') === safeHref) {
            anchorEl.setAttribute('target', '_blank');
            anchorEl.setAttribute('rel', 'noopener noreferrer');
          }
        });
      }
    } else {
      // Se não havia texto selecionado, insere um nó <a> seguro na posição do cursor
      const a = document.createElement('a');
      a.href = safeHref;
      if (linkInfo.isExternal || linkInfo.kind === 'https' || linkInfo.kind === 'http') {
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      }
      a.textContent = safeHref;
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        range.insertNode(a);
        range.setStartAfter(a);
        range.collapse(true);
      } else {
        editableArea.appendChild(a);
      }
    }
    linkInput.value = '';
    syncEditorState(true);
  });

  linkRemoveBtn.addEventListener('click', () => {
    linkPopover.hidden = true;
    editableArea.focus();
    restoreSavedSelection();
    applyEditorCommand(editableArea, 'unlink');
    linkInput.value = '';
    syncEditorState(true);
  });

  // Atalhos de teclado e comportamento de Enter conforme o modo
  editableArea.addEventListener('keydown', (event) => {
    const isMod = event.ctrlKey || event.metaKey;
    if (isMod && !event.altKey) {
      const key = event.key.toLowerCase();
      if (key === 'b') {
        event.preventDefault();
        applyEditorCommand(editableArea, 'bold');
        syncEditorState(true);
        return;
      }
      if (key === 'i') {
        event.preventDefault();
        applyEditorCommand(editableArea, 'italic');
        syncEditorState(true);
        return;
      }
      if (key === 'u') {
        event.preventDefault();
        applyEditorCommand(editableArea, 'underline');
        syncEditorState(true);
        return;
      }
      if (key === 'z') {
        event.preventDefault();
        handleHistoryStep(event.shiftKey ? 'redo' : 'undo');
        return;
      }
      if (key === 'y') {
        event.preventDefault();
        handleHistoryStep('redo');
        return;
      }
    }

    if (event.key === 'Enter') {
      if (currentMode === 'inline') {
        event.preventDefault();
        return;
      }
      if (currentMode === 'lines') {
        event.preventDefault();
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          range.deleteContents();
          const br = document.createElement('br');
          range.insertNode(br);
          range.setStartAfter(br);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
        }
        syncEditorState(true);
      }
    }
  });

  // Colagem limpa (Paste sanitizado via AST sem innerHTML)
  editableArea.addEventListener('paste', (event) => {
    event.preventDefault();
    const clipboard = event.clipboardData;
    if (!clipboard) return;

    const rawPaste = clipboard.getData('text/html') || clipboard.getData('text/plain') || '';
    if (!rawPaste) return;

    const tempContainer = document.createElement('div');
    renderSanitizedRichText(tempContainer, rawPaste, { mode: currentMode });

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editableArea.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const frag = document.createDocumentFragment();
      while (tempContainer.firstChild) {
        frag.appendChild(tempContainer.firstChild);
      }
      range.insertNode(frag);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      while (tempContainer.firstChild) {
        editableArea.appendChild(tempContainer.firstChild);
      }
    }

    // Normaliza toda a área editável após a colagem
    const cleanFull = getSanitizedValue();
    renderSanitizedRichText(editableArea, cleanFull, { mode: currentMode });
    syncEditorState(true);
  });

  editableArea.addEventListener('input', () => {
    syncEditorState(true);
  });

  editableArea.addEventListener('keyup', updateToolbarActiveStates);
  editableArea.addEventListener('mouseup', updateToolbarActiveStates);

  editableArea.addEventListener('focus', () => {
    if (typeof config.onFocusField === 'function') {
      config.onFocusField(fieldName);
    }
  });

  // Mudança de modo do texto (paragraphs | lines | inline)
  modeSelect.addEventListener('change', () => {
    currentMode = normalizeTextMode(modeSelect.value, defaultMode);
    editableArea.setAttribute('aria-multiline', currentMode === 'inline' ? 'false' : 'true');
    modeHintEl.textContent = getModeDescription(currentMode);

    const reSanitized = getSanitizedValue();
    renderSanitizedRichText(editableArea, reSanitized, { mode: currentMode, isV2: true });
    syncEditorState(true);
  });

  // Montagem do container do campo
  const headerRow = el(
    'div',
    { className: 'rte-header' },
    [
      el('label', { className: 'form-label', textContent: config.label }),
      modeSelect,
    ]
  );

  const footerRow = el(
    'div',
    { className: 'rte-footer' },
    [modeHintEl, charCounterEl]
  );

  const wrapper = el(
    'div',
    { className: 'form-group rte-field', dataset: { field: fieldName } },
    [
      headerRow,
      config.hint ? el('span', { className: 'form-hint', textContent: config.hint }) : null,
      el('div', { className: 'rte-box' }, [toolbarEl, linkPopover, editableArea, footerRow]),
    ]
  );

  // Inicializa com o valor fornecido
  function setValue(/** @type {string} */ rawValue, /** @type {'paragraphs' | 'lines' | 'inline'} */ [nextMode]) {
    if (nextMode) {
      currentMode = normalizeTextMode(nextMode, defaultMode);
      modeSelect.value = currentMode;
      modeHintEl.textContent = getModeDescription(currentMode);
    }
    renderSanitizedRichText(editableArea, rawValue || '', { mode: currentMode, isV2: true });
    const sanitized = getSanitizedValue();
    historyStack.length = 0;
    historyIndex = -1;
    pushHistory(sanitized);
    syncEditorState(false);
    updateToolbarActiveStates();
  }

  setValue(config.initialValue || '', currentMode);

  return {
    element: wrapper,
    editableArea,
    getValue: () => getSanitizedValue(),
    getPlainText: () => extractPlainText(getSanitizedValue()),
    getMode: () => currentMode,
    setValue,
    focus: () => editableArea.focus(),
    isOverLimit: () => extractPlainText(getSanitizedValue()).length > maxLength,
  };
}

/**
 * Insere uma variável (ex: `{produto}`) ou envolve a seleção com sintaxe do WhatsApp (`*negrito*`, `_itálico_`)
 * em um `<textarea>` de texto puro.
 *
 * @param {HTMLTextAreaElement | null} textarea
 * @param {string} snippetOrWrapper
 * @param {{ wrap?: boolean }} [options]
 */
export function insertPlainTextSnippet(textarea, snippetOrWrapper, options = {}) {
  if (!textarea) return;
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? textarea.value.length;
  const before = textarea.value.slice(0, start);
  const selected = textarea.value.slice(start, end);
  const after = textarea.value.slice(end);

  let inserted = snippetOrWrapper;
  let nextCursorPos = start + inserted.length;

  if (options.wrap) {
    const content = selected || 'texto';
    inserted = `${snippetOrWrapper}${content}${snippetOrWrapper}`;
    nextCursorPos = start + snippetOrWrapper.length + content.length;
  }

  textarea.value = `${before}${inserted}${after}`;
  textarea.focus();
  textarea.setSelectionRange(nextCursorPos, nextCursorPos);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

