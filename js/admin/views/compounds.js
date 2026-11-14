// @ts-check
/**
 * View de Gerenciamento Completo da Vitrine de Compostos Manipulados (`#/compostos`):
 *   - Edição individual de textos (título do card, subtítulo do rótulo, nome principal do rótulo, selo de cápsulas, botão)
 *   - Vínculo direto com produtos do catálogo ou URL personalizada validada
 *   - Escolha de temas visuais (cores da marca, selo, alinhamento) e ilustrações botânicas vetoriais
 *   - Upload WebP (Supabase Storage) para imagem de frasco/produto e ilustração botânica personalizada
 *   - Pré-visualização interativa em tempo real (Card individual, Faixa Desktop e Mobile)
 *   - Reordenação via Drag-and-Drop e botões acessíveis (Subir/Descer), duplicação, ativação/desativação e restauração dos padrões
 */

import { state, setState, subscribe } from '../state.js';
import {
  el,
  clearElement,
  createIcon,
  showToast,
  confirmAction,
  setButtonLoading,
  formatBRL,
} from '../ui.js';
import {
  validateImageFile,
  saveCompoundCard,
  deleteCompoundCard,
  reorderCompoundCards,
  toggleCompoundCardStatus,
  seedDefaultCompoundCards,
} from '../api.js';
import { normalizeSupabaseError } from '../../supabaseClient.js';
import {
  DEFAULT_BOTTLE_IMAGE_URL,
  CARD_THEMES,
  BADGE_COLORS,
  TITLE_ALIGNMENTS,
  BOTANICAL_THEMES,
  createCompoundCardElement,
  resolveCompoundDestination,
  isValidCompoundLink,
} from '../../shared/compoundShowcaseRenderer.js';

/**
 * Renderiza a tela administrativa da Vitrine de Compostos Manipulados.
 * @param {HTMLElement} container
 * @returns {() => void} Cleanup function
 */
export function renderCompoundsView(container) {
  clearElement(container);

  let editingId = '';
  let oldImagePath = '';
  let oldBotanicalImagePath = '';
  let currentBottleImageUrl = '';
  let currentBotanicalImageUrl = '';
  let clearBottleImageFlag = false;
  let clearBotanicalImageFlag = false;

  /** @type {File | null} */
  let selectedBottleFile = null;
  let bottlePreviewObjectUrl = '';

  /** @type {File | null} */
  let selectedBotanicalFile = null;
  let botanicalPreviewObjectUrl = '';

  /** @type {'single' | 'strip' | 'mobile'} */
  let previewMode = 'single';

  /** @type {'all' | 'active' | 'inactive'} */
  let listFilterStatus = 'all';
  let listSearchTerm = '';

  function revokePreviewUrls() {
    if (bottlePreviewObjectUrl) {
      URL.revokeObjectURL(bottlePreviewObjectUrl);
      bottlePreviewObjectUrl = '';
    }
    if (botanicalPreviewObjectUrl) {
      URL.revokeObjectURL(botanicalPreviewObjectUrl);
      botanicalPreviewObjectUrl = '';
    }
  }

  /* ==========================================================================
     1. BARRA DE ESTADO VISUAL DO EDITOR
     ========================================================================== */
  const editorStatusBadge = el(
    'span',
    { className: 'badge badge-neutral', id: 'compound-editor-status' },
    createIcon('fa-solid fa-circle-check'),
    ' Pronto para edição'
  );

  function setEditorStatus(mode, text) {
    clearElement(editorStatusBadge);
    if (mode === 'dirty') {
      editorStatusBadge.className = 'badge badge-warning';
      editorStatusBadge.append(createIcon('fa-solid fa-pen'), ` ${text || 'Alterações não salvas'}`);
    } else if (mode === 'saving') {
      editorStatusBadge.className = 'badge badge-info';
      editorStatusBadge.append(createIcon('fa-solid fa-circle-notch fa-spin'), ` ${text || 'Salvando no Supabase...'}`);
    } else if (mode === 'saved') {
      editorStatusBadge.className = 'badge badge-success';
      editorStatusBadge.append(createIcon('fa-solid fa-check'), ` ${text || 'Salvo com sucesso'}`);
    } else if (mode === 'error') {
      editorStatusBadge.className = 'badge badge-danger';
      editorStatusBadge.append(createIcon('fa-solid fa-triangle-exclamation'), ` ${text || 'Erro ao salvar'}`);
    } else if (mode === 'image') {
      editorStatusBadge.className = 'badge badge-info';
      editorStatusBadge.append(createIcon('fa-solid fa-wand-magic-sparkles'), ` ${text || 'Imagem pronta para envio'}`);
    } else {
      editorStatusBadge.className = 'badge badge-neutral';
      editorStatusBadge.append(createIcon('fa-solid fa-circle-check'), ` ${text || 'Pronto para edição'}`);
    }
  }

  function markFormDirty(customMsg = '') {
    if (!state.isFormDirty) {
      setState({ isFormDirty: true });
    }
    setEditorStatus('dirty', customMsg || 'Alterações pendentes');
  }

  /* ==========================================================================
     2. CAMPOS DO FORMULÁRIO ORGANIZADOS POR GRUPOS
     ========================================================================== */
  const formTitleEl = el('h2', { className: 'admin-panel__title' }, 'Novo Card de Composto');

  // --- GRUPO A: Conteúdo Textual ---
  const titleInput = /** @type {HTMLTextAreaElement} */ (
    el('textarea', {
      id: 'compound-title',
      className: 'form-control',
      rows: '2',
      maxlength: '90',
      placeholder: 'Ex.: COMPOSTO\nALCACHOFRA + BERINJELA',
      required: true,
    })
  );

  const showLabelCheck = /** @type {HTMLInputElement} */ (
    el('input', {
      type: 'checkbox',
      id: 'compound-show-label',
      className: 'toggle-switch',
      checked: true,
    })
  );

  const labelSubtitleInput = /** @type {HTMLInputElement} */ (
    el('input', {
      type: 'text',
      id: 'compound-label-subtitle',
      className: 'form-control',
      maxlength: '50',
      placeholder: 'Ex.: COMPOSTO DIGESTIVO',
    })
  );

  const labelTitleInput = /** @type {HTMLTextAreaElement} */ (
    el('textarea', {
      id: 'compound-label-title',
      className: 'form-control',
      rows: '2',
      maxlength: '60',
      placeholder: 'Ex.: ALCACHOFRA\n+ BERINJELA',
    })
  );

  const labelBadgeInput = /** @type {HTMLInputElement} */ (
    el('input', {
      type: 'text',
      id: 'compound-label-badge',
      className: 'form-control',
      maxlength: '32',
      value: '60 CÁPSULAS',
      placeholder: 'Ex.: 60 CÁPSULAS ou 30ML',
    })
  );

  // --- GRUPO B: Botão, Vínculo de Produto e Link ---
  const showButtonCheck = /** @type {HTMLInputElement} */ (
    el('input', {
      type: 'checkbox',
      id: 'compound-show-button',
      className: 'toggle-switch',
      checked: true,
    })
  );

  const buttonTextInput = /** @type {HTMLInputElement} */ (
    el('input', {
      type: 'text',
      id: 'compound-button-text',
      className: 'form-control',
      maxlength: '28',
      value: 'COMPRAR',
      placeholder: 'Ex.: COMPRAR ou VER FÓRMULA',
    })
  );

  const productSelect = /** @type {HTMLSelectElement} */ (
    el('select', { id: 'compound-product-id', className: 'form-control' })
  );

  const autoFillFromProductBtn = /** @type {HTMLButtonElement} */ (
    el(
      'button',
      {
        type: 'button',
        className: 'btn btn-secondary btn-sm',
        title: 'Preenche automaticamente o título e o rótulo com o nome do produto selecionado',
      },
      createIcon('fa-solid fa-wand-magic-sparkles'),
      el('span', { textContent: 'Preencher textos com o produto selecionado' })
    )
  );

  const buttonLinkInput = /** @type {HTMLInputElement} */ (
    el('input', {
      type: 'text',
      id: 'compound-button-link',
      className: 'form-control',
      placeholder: 'produto.html?id=... ou #produtos ou https://...',
    })
  );

  const openNewTabCheck = /** @type {HTMLInputElement} */ (
    el('input', {
      type: 'checkbox',
      id: 'compound-open-new-tab',
      className: 'toggle-switch',
    })
  );

  function populateProductSelect(selectedProductId = '') {
    clearElement(productSelect);
    productSelect.appendChild(
      el('option', { value: '' }, '— Sem vínculo fixo (usar URL personalizada ou busca automática) —')
    );

    const sortedProducts = [...(state.products || [])].sort((a, b) =>
      String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR')
    );

    sortedProducts.forEach((prod) => {
      const statusSuffix = prod.is_active === false ? ' [Inativo]' : '';
      const priceLabel = prod.price !== undefined ? ` — ${formatBRL(prod.price)}` : '';
      const option = el(
        'option',
        { value: String(prod.id) },
        `${prod.name}${priceLabel}${statusSuffix}`
      );
      if (String(prod.id) === String(selectedProductId)) {
        option.selected = true;
      }
      productSelect.appendChild(option);
    });
  }

  // --- GRUPO C: Personalização Visual e Ilustração Botânica ---
  const cardThemeSelect = /** @type {HTMLSelectElement} */ (
    el(
      'select',
      { id: 'compound-card-theme', className: 'form-control' },
      ...CARD_THEMES.map((theme) => el('option', { value: theme.id }, theme.label))
    )
  );

  const themeSwatchesRow = el(
    'div',
    { className: 'compound-theme-swatches', role: 'group', 'aria-label': 'Atalhos de cor do card' },
    ...CARD_THEMES.map((theme) => {
      const btn = el(
        'button',
        {
          type: 'button',
          className: 'compound-theme-swatch',
          dataset: { themeId: theme.id },
          title: `${theme.label}: ${theme.description}`,
          style: `--swatch-color: ${theme.swatch}`,
        },
        el('span', { className: 'compound-theme-swatch__dot' }),
        el('span', { className: 'compound-theme-swatch__name' }, theme.label.split(' ')[0])
      );
      btn.addEventListener('click', () => {
        cardThemeSelect.value = theme.id;
        syncThemeSwatchesUI();
        markFormDirty();
        refreshLivePreview();
      });
      return btn;
    })
  );

  function syncThemeSwatchesUI() {
    const current = cardThemeSelect.value;
    themeSwatchesRow.querySelectorAll('.compound-theme-swatch').forEach((node) => {
      const htmlNode = /** @type {HTMLElement} */ (node);
      htmlNode.classList.toggle('is-selected', htmlNode.dataset.themeId === current);
    });
  }

  const badgeColorSelect = /** @type {HTMLSelectElement} */ (
    el(
      'select',
      { id: 'compound-badge-color', className: 'form-control' },
      ...BADGE_COLORS.map((item) => el('option', { value: item.id }, item.label))
    )
  );

  const titleAlignSelect = /** @type {HTMLSelectElement} */ (
    el(
      'select',
      { id: 'compound-title-align', className: 'form-control' },
      ...TITLE_ALIGNMENTS.map((item) => el('option', { value: item.id }, item.label))
    )
  );

  const botanicalThemeSelect = /** @type {HTMLSelectElement} */ (
    el(
      'select',
      { id: 'compound-botanical-theme', className: 'form-control' },
      ...BOTANICAL_THEMES.map((item) => el('option', { value: item.id }, item.label))
    )
  );

  const showCapsulesCheck = /** @type {HTMLInputElement} */ (
    el('input', {
      type: 'checkbox',
      id: 'compound-show-capsules',
      className: 'toggle-switch',
      checked: true,
    })
  );

  // --- GRUPO D: Imagens (Frasco/Produto e Botânico Personalizado) ---
  const bottleFileInput = /** @type {HTMLInputElement} */ (
    el('input', {
      type: 'file',
      id: 'compound-bottle-file',
      className: 'upload-zone__input',
      accept: 'image/webp,image/png,image/jpeg',
    })
  );

  const bottleThumbImg = /** @type {HTMLImageElement} */ (
    el('img', {
      className: 'compound-upload-thumb',
      src: DEFAULT_BOTTLE_IMAGE_URL,
      alt: 'Prévia do frasco atual',
    })
  );

  const bottleStatusText = el(
    'span',
    { className: 'form-hint' },
    'Usando o frasco 3D oficial da Botica Natural (com rótulo dinâmico).'
  );

  const resetBottleToDefaultBtn = /** @type {HTMLButtonElement} */ (
    el(
      'button',
      {
        type: 'button',
        className: 'btn btn-secondary btn-sm',
        style: 'display:none',
      },
      createIcon('fa-solid fa-rotate-left'),
      el('span', { textContent: 'Usar frasco 3D oficial padrão' })
    )
  );

  const botanicalFileInput = /** @type {HTMLInputElement} */ (
    el('input', {
      type: 'file',
      id: 'compound-botanical-file',
      className: 'upload-zone__input',
      accept: 'image/webp,image/png,image/jpeg',
    })
  );

  const botanicalPreviewRow = el('div', { className: 'compound-upload-preview-row', style: 'display:none' });

  // --- GRUPO E: Organização e Visibilidade ---
  const orderInput = /** @type {HTMLInputElement} */ (
    el('input', {
      type: 'number',
      id: 'compound-order',
      className: 'form-control',
      min: '0',
      step: '1',
      value: String((state.compoundCards || []).length),
    })
  );

  const activeCheck = /** @type {HTMLInputElement} */ (
    el('input', {
      type: 'checkbox',
      id: 'compound-active',
      className: 'toggle-switch',
      checked: true,
    })
  );

  // --- Botões de Ação do Formulário ---
  const submitBtn = /** @type {HTMLButtonElement} */ (
    el(
      'button',
      { type: 'submit', id: 'btn-save-compound', className: 'btn btn-primary' },
      createIcon('fa-solid fa-floppy-disk'),
      el('span', { textContent: 'Salvar Card na Vitrine' })
    )
  );

  const cancelEditBtn = /** @type {HTMLButtonElement} */ (
    el(
      'button',
      {
        type: 'button',
        id: 'btn-cancel-compound',
        className: 'btn btn-secondary',
        style: 'display:none',
      },
      createIcon('fa-solid fa-xmark'),
      el('span', { textContent: 'Cancelar Edição' })
    )
  );

  /* ==========================================================================
     3. PRÉ-VISUALIZAÇÃO INTERATIVA EM TEMPO REAL (LIVE PREVIEW)
     ========================================================================== */
  const previewStageMount = el('div', {
    className: 'compound-admin-preview__stage',
    id: 'compound-live-preview-stage',
  });

  const previewDestinationInfo = el('div', {
    className: 'compound-admin-preview__meta',
  });

  const modeBtnSingle = el(
    'button',
    { type: 'button', className: 'btn btn-secondary btn-sm is-active' },
    createIcon('fa-solid fa-image'),
    el('span', { textContent: 'Card Focado' })
  );
  const modeBtnStrip = el(
    'button',
    { type: 'button', className: 'btn btn-secondary btn-sm' },
    createIcon('fa-solid fa-desktop'),
    el('span', { textContent: 'Contexto Vitrine (Desktop)' })
  );
  const modeBtnMobile = el(
    'button',
    { type: 'button', className: 'btn btn-secondary btn-sm' },
    createIcon('fa-solid fa-mobile-screen'),
    el('span', { textContent: 'Mobile (360px)' })
  );

  function setPreviewMode(nextMode) {
    previewMode = nextMode;
    modeBtnSingle.classList.toggle('is-active', nextMode === 'single');
    modeBtnStrip.classList.toggle('is-active', nextMode === 'strip');
    modeBtnMobile.classList.toggle('is-active', nextMode === 'mobile');
    previewStageMount.dataset.previewMode = nextMode;
    refreshLivePreview();
  }

  modeBtnSingle.addEventListener('click', () => setPreviewMode('single'));
  modeBtnStrip.addEventListener('click', () => setPreviewMode('strip'));
  modeBtnMobile.addEventListener('click', () => setPreviewMode('mobile'));

  function getDraftCardFromForm() {
    const effectiveBottleUrl =
      bottlePreviewObjectUrl ||
      (clearBottleImageFlag ? '' : currentBottleImageUrl) ||
      '';

    const effectiveBotanicalUrl =
      botanicalPreviewObjectUrl ||
      (clearBotanicalImageFlag ? '' : currentBotanicalImageUrl) ||
      '';

    return {
      id: editingId || 'draft-preview',
      title: titleInput.value.trim() || 'COMPOSTO\nALCACHOFRA + BERINJELA',
      label_subtitle: labelSubtitleInput.value.trim(),
      label_title: labelTitleInput.value.trim(),
      label_badge: labelBadgeInput.value.trim(),
      show_label: showLabelCheck.checked,
      button_text: buttonTextInput.value.trim() || 'COMPRAR',
      button_link: buttonLinkInput.value.trim(),
      product_id: productSelect.value || null,
      open_in_new_tab: openNewTabCheck.checked,
      show_button: showButtonCheck.checked,
      card_theme: cardThemeSelect.value || 'green',
      badge_color: badgeColorSelect.value || 'green',
      title_align: titleAlignSelect.value || 'center',
      botanical_theme: botanicalThemeSelect.value || 'alcachofra',
      show_capsules: showCapsulesCheck.checked,
      image_url: effectiveBottleUrl || null,
      botanical_image_url: effectiveBotanicalUrl || null,
      display_order: Math.max(0, Number(orderInput.value) || 0),
      is_active: activeCheck.checked,
    };
  }

  function syncBottleUploadUI() {
    const effectiveBottleUrl =
      bottlePreviewObjectUrl ||
      (clearBottleImageFlag ? '' : currentBottleImageUrl) ||
      DEFAULT_BOTTLE_IMAGE_URL;

    bottleThumbImg.src = effectiveBottleUrl;

    if (bottlePreviewObjectUrl) {
      bottleStatusText.textContent =
        'Nova imagem selecionada (será convertida para WebP e enviada ao salvar).';
      resetBottleToDefaultBtn.style.display = 'inline-flex';
    } else if (!clearBottleImageFlag && currentBottleImageUrl) {
      bottleStatusText.textContent = 'Usando imagem personalizada armazenada no Supabase Storage.';
      resetBottleToDefaultBtn.style.display = 'inline-flex';
    } else {
      bottleStatusText.textContent =
        'Usando o frasco 3D oficial da Botica Natural (images/frasco-botica-showcase.webp).';
      resetBottleToDefaultBtn.style.display = 'none';
    }
  }

  function syncBotanicalUploadUI() {
    clearElement(botanicalPreviewRow);
    const effectiveBotanicalUrl =
      botanicalPreviewObjectUrl || (clearBotanicalImageFlag ? '' : currentBotanicalImageUrl);

    if (!effectiveBotanicalUrl) {
      botanicalPreviewRow.style.display = 'none';
      return;
    }

    botanicalPreviewRow.style.display = 'flex';
    const thumb = el('img', {
      className: 'compound-upload-thumb',
      src: effectiveBotanicalUrl,
      alt: 'Prévia da ilustração botânica personalizada',
    });

    const removeBtn = el(
      'button',
      {
        type: 'button',
        className: 'btn btn-secondary btn-sm',
      },
      createIcon('fa-solid fa-trash-can'),
      el('span', { textContent: 'Remover imagem botânica personalizada' })
    );

    removeBtn.addEventListener('click', () => {
      if (botanicalPreviewObjectUrl) {
        URL.revokeObjectURL(botanicalPreviewObjectUrl);
        botanicalPreviewObjectUrl = '';
      }
      selectedBotanicalFile = null;
      botanicalFileInput.value = '';
      if (currentBotanicalImageUrl) {
        clearBotanicalImageFlag = true;
      }
      if (botanicalThemeSelect.value === 'custom') {
        botanicalThemeSelect.value = 'alcachofra';
      }
      markFormDirty();
      syncBotanicalUploadUI();
      refreshLivePreview();
    });

    botanicalPreviewRow.append(
      thumb,
      el(
        'div',
        { className: 'compound-upload-meta' },
        el(
          'span',
          { className: 'badge badge-info' },
          createIcon('fa-solid fa-leaf'),
          botanicalPreviewObjectUrl ? ' Nova arte botânica pronta' : ' Arte botânica personalizada ativa'
        ),
        removeBtn
      )
    );
  }

  function refreshLivePreview() {
    clearElement(previewStageMount);
    const draft = getDraftCardFromForm();

    if (previewMode === 'strip') {
      const strip = el('div', { className: 'compounds-showcase__track compound-admin-preview__strip' });
      const activeCardEl = createCompoundCardElement(draft, {
        products: state.products,
        isPreview: true,
        uniqueIndex: 900,
      });
      activeCardEl.classList.add('is-preview-highlighted');
      strip.appendChild(activeCardEl);

      const otherCards = (state.compoundCards || [])
        .filter((c) => c.id !== editingId && c.is_active !== false)
        .slice(0, 2);

      otherCards.forEach((other, idx) => {
        const elCard = createCompoundCardElement(other, {
          products: state.products,
          isPreview: true,
          uniqueIndex: 901 + idx,
        });
        elCard.style.opacity = '0.72';
        strip.appendChild(elCard);
      });

      previewStageMount.appendChild(strip);
    } else {
      const singleWrap = el(
        'div',
        {
          className:
            previewMode === 'mobile'
              ? 'compound-admin-preview__single compound-admin-preview__single--mobile'
              : 'compound-admin-preview__single',
        },
        createCompoundCardElement(draft, {
          products: state.products,
          isPreview: true,
          uniqueIndex: 999,
        })
      );
      previewStageMount.appendChild(singleWrap);
    }

    // Atualiza resumo do destino do botão
    clearElement(previewDestinationInfo);
    const resolved = resolveCompoundDestination(draft, state.products);
    const targetBadge = draft.open_in_new_tab ? ' (Abre em nova aba)' : ' (Mesma aba)';

    if (!draft.show_button) {
      previewDestinationInfo.append(
        createIcon('fa-solid fa-eye-slash'),
        ' Botão oculto neste card.'
      );
    } else if (resolved.matchedProduct) {
      previewDestinationInfo.append(
        createIcon('fa-solid fa-link'),
        ` Vinculado ao produto: "${resolved.matchedProduct.name}" → ${resolved.href}${targetBadge}`
      );
    } else {
      previewDestinationInfo.append(
        createIcon('fa-solid fa-arrow-up-right-from-square'),
        ` Destino do botão: ${resolved.href}${targetBadge}`
      );
    }
  }

  /* ==========================================================================
     4. INTERAÇÕES DOS CAMPOS DO FORMULÁRIO
     ========================================================================== */
  [
    titleInput,
    labelSubtitleInput,
    labelTitleInput,
    labelBadgeInput,
    buttonTextInput,
    buttonLinkInput,
    orderInput,
  ].forEach((inputEl) => {
    inputEl.addEventListener('input', () => {
      markFormDirty();
      refreshLivePreview();
    });
  });

  [
    showLabelCheck,
    showButtonCheck,
    openNewTabCheck,
    cardThemeSelect,
    badgeColorSelect,
    titleAlignSelect,
    botanicalThemeSelect,
    showCapsulesCheck,
    activeCheck,
  ].forEach((controlEl) => {
    controlEl.addEventListener('change', () => {
      syncThemeSwatchesUI();
      markFormDirty();
      refreshLivePreview();
    });
  });

  productSelect.addEventListener('change', () => {
    const selectedId = productSelect.value;
    if (selectedId) {
      buttonLinkInput.value = `produto.html?id=${selectedId}`;
    }
    markFormDirty();
    refreshLivePreview();
  });

  autoFillFromProductBtn.addEventListener('click', () => {
    const selectedId = productSelect.value;
    if (!selectedId) {
      showToast('Selecione primeiro um produto do catálogo na lista acima.', 'warning');
      return;
    }
    const prod = (state.products || []).find((item) => String(item.id) === String(selectedId));
    if (!prod) return;

    const upperName = String(prod.name || '').trim().toUpperCase();
    if (upperName.startsWith('COMPOSTO ')) {
      const rest = upperName.replace(/^COMPOSTO\s+(PARA\s+)?/i, '');
      const prefix = upperName.startsWith('COMPOSTO PARA ') ? 'COMPOSTO PARA' : 'COMPOSTO';
      titleInput.value = `${prefix}\n${rest}`;
      labelSubtitleInput.value = prefix;
      labelTitleInput.value = rest;
    } else {
      titleInput.value = upperName;
      labelSubtitleInput.value = 'FÓRMULA MAGISTRAL';
      labelTitleInput.value = upperName;
    }

    if (prod.package_info) {
      const matchCaps = String(prod.package_info).match(/(\d+\s*(cápsulas|capsulas|ml|g|sachês|saches))/i);
      if (matchCaps) {
        labelBadgeInput.value = matchCaps[1].toUpperCase();
      }
    }

    buttonLinkInput.value = `produto.html?id=${prod.id}`;
    markFormDirty('Textos preenchidos a partir do produto');
    refreshLivePreview();
    showToast(`Textos preenchidos com base em "${prod.name}".`, 'info');
  });

  bottleFileInput.addEventListener('change', () => {
    const file = bottleFileInput.files?.[0] || null;
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      showToast(validation.error || 'Imagem inválida.', 'error');
      bottleFileInput.value = '';
      return;
    }

    if (bottlePreviewObjectUrl) {
      URL.revokeObjectURL(bottlePreviewObjectUrl);
    }
    selectedBottleFile = file;
    clearBottleImageFlag = false;
    bottlePreviewObjectUrl = URL.createObjectURL(file);

    setEditorStatus('image', 'Imagem do frasco pronta para envio');
    markFormDirty('Nova imagem de frasco selecionada');
    syncBottleUploadUI();
    refreshLivePreview();
  });

  resetBottleToDefaultBtn.addEventListener('click', () => {
    if (bottlePreviewObjectUrl) {
      URL.revokeObjectURL(bottlePreviewObjectUrl);
      bottlePreviewObjectUrl = '';
    }
    selectedBottleFile = null;
    bottleFileInput.value = '';
    if (currentBottleImageUrl) {
      clearBottleImageFlag = true;
    }
    markFormDirty('Frasco oficial padrão restaurado');
    syncBottleUploadUI();
    refreshLivePreview();
  });

  botanicalFileInput.addEventListener('change', () => {
    const file = botanicalFileInput.files?.[0] || null;
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      showToast(validation.error || 'Imagem botânica inválida.', 'error');
      botanicalFileInput.value = '';
      return;
    }

    if (botanicalPreviewObjectUrl) {
      URL.revokeObjectURL(botanicalPreviewObjectUrl);
    }
    selectedBotanicalFile = file;
    clearBotanicalImageFlag = false;
    botanicalPreviewObjectUrl = URL.createObjectURL(file);
    botanicalThemeSelect.value = 'custom';

    setEditorStatus('image', 'Ilustração botânica pronta para envio');
    markFormDirty('Nova imagem botânica selecionada');
    syncBotanicalUploadUI();
    refreshLivePreview();
  });

  /* ==========================================================================
     5. RESET / CARREGAMENTO DE CARD PARA EDIÇÃO
     ========================================================================== */
  function resetForm(preserveStatus = false) {
    editingId = '';
    oldImagePath = '';
    oldBotanicalImagePath = '';
    currentBottleImageUrl = '';
    currentBotanicalImageUrl = '';
    clearBottleImageFlag = false;
    clearBotanicalImageFlag = false;
    selectedBottleFile = null;
    selectedBotanicalFile = null;
    revokePreviewUrls();

    formTitleEl.textContent = 'Novo Card de Composto';
    titleInput.value = 'COMPOSTO\nALCACHOFRA + BERINJELA';
    showLabelCheck.checked = true;
    labelSubtitleInput.value = 'COMPOSTO DIGESTIVO';
    labelTitleInput.value = 'ALCACHOFRA\n+ BERINJELA';
    labelBadgeInput.value = '60 CÁPSULAS';
    showButtonCheck.checked = true;
    buttonTextInput.value = 'COMPRAR';
    populateProductSelect('');
    buttonLinkInput.value = '';
    openNewTabCheck.checked = false;
    cardThemeSelect.value = 'green';
    badgeColorSelect.value = 'green';
    titleAlignSelect.value = 'center';
    botanicalThemeSelect.value = 'alcachofra';
    showCapsulesCheck.checked = true;
    orderInput.value = String((state.compoundCards || []).length);
    activeCheck.checked = true;
    bottleFileInput.value = '';
    botanicalFileInput.value = '';
    cancelEditBtn.style.display = 'none';

    setButtonLoading(
      submitBtn,
      false,
      'Salvando...',
      'Salvar Card na Vitrine',
      'fa-solid fa-floppy-disk'
    );

    setState({ isFormDirty: false });
    if (!preserveStatus) {
      setEditorStatus('ready', 'Pronto para edição');
    }
    syncThemeSwatchesUI();
    syncBottleUploadUI();
    syncBotanicalUploadUI();
    refreshLivePreview();
  }

  function populateFormForEdit(card) {
    editingId = String(card.id);
    oldImagePath = card.image_path || '';
    oldBotanicalImagePath = card.botanical_image_path || '';
    currentBottleImageUrl = card.image_url || '';
    currentBotanicalImageUrl = card.botanical_image_url || '';
    clearBottleImageFlag = false;
    clearBotanicalImageFlag = false;
    selectedBottleFile = null;
    selectedBotanicalFile = null;
    revokePreviewUrls();

    const cleanHeading = String(card.title || '').replace(/\s+/g, ' ').trim();
    formTitleEl.textContent = `Editando: ${cleanHeading}`;

    titleInput.value = card.title || '';
    showLabelCheck.checked = card.show_label !== false;
    labelSubtitleInput.value = card.label_subtitle || '';
    labelTitleInput.value = card.label_title || '';
    labelBadgeInput.value = card.label_badge || '';
    showButtonCheck.checked = card.show_button !== false;
    buttonTextInput.value = card.button_text || 'COMPRAR';
    populateProductSelect(card.product_id || '');
    buttonLinkInput.value = card.button_link || '';
    openNewTabCheck.checked = Boolean(card.open_in_new_tab);
    cardThemeSelect.value = card.card_theme || 'green';
    badgeColorSelect.value = card.badge_color || 'green';
    titleAlignSelect.value = card.title_align || 'center';
    botanicalThemeSelect.value = card.botanical_theme || 'alcachofra';
    showCapsulesCheck.checked = card.show_capsules !== false;
    orderInput.value = String(card.display_order ?? 0);
    activeCheck.checked = card.is_active !== false;
    bottleFileInput.value = '';
    botanicalFileInput.value = '';
    cancelEditBtn.style.display = 'inline-flex';

    setButtonLoading(
      submitBtn,
      false,
      'Salvando...',
      'Salvar Alterações do Card',
      'fa-solid fa-floppy-disk'
    );

    setState({ isFormDirty: false });
    setEditorStatus('ready', `Editando "${cleanHeading}"`);
    syncThemeSwatchesUI();
    syncBottleUploadUI();
    syncBotanicalUploadUI();
    refreshLivePreview();
    titleInput.focus();
  }

  cancelEditBtn.addEventListener('click', async () => {
    if (state.isFormDirty) {
      const discard = await confirmAction({
        title: 'Descartar alterações não salvas?',
        message: 'Você modificou campos deste card de composto. Deseja descartar as alterações?',
        confirmLabel: 'Descartar alterações',
        variant: 'danger',
      });
      if (!discard) return;
    }
    resetForm();
  });

  /* ==========================================================================
     6. SUBMISSÃO DO FORMULÁRIO (PERSISTÊNCIA REAL NO SUPABASE)
     ========================================================================== */
  const formEl = el(
    'form',
    { id: 'compound-form', className: 'admin-form', novalidate: true },
    // GRUPO A
    el(
      'div',
      { className: 'compound-form-group' },
      el(
        'h3',
        { className: 'compound-form-group__title' },
        createIcon('fa-solid fa-heading'),
        ' A. Conteúdo Textual (Topo do Card e Rótulo do Frasco)'
      ),
      el(
        'div',
        { className: 'form-group' },
        el(
          'label',
          { className: 'form-label', for: 'compound-title' },
          'Título Principal no Topo do Card *'
        ),
        titleInput,
        el(
          'span',
          { className: 'form-hint' },
          'Pressione Enter para dividir em 2 linhas (ex.: COMPOSTO na 1ª linha e ALCACHOFRA + BERINJELA na 2ª linha).'
        )
      ),
      el(
        'label',
        { className: 'compound-toggle-row', for: 'compound-show-label' },
        showLabelCheck,
        el('span', {}, 'Exibir rótulo dinâmico impresso sobre o frasco')
      ),
      el(
        'div',
        { className: 'form-row form-row--2col' },
        el(
          'div',
          { className: 'form-group' },
          el('label', { className: 'form-label', for: 'compound-label-subtitle' }, 'Subtítulo do Rótulo (Linha Superior)'),
          labelSubtitleInput
        ),
        el(
          'div',
          { className: 'form-group' },
          el('label', { className: 'form-label', for: 'compound-label-badge' }, 'Selo de Cápsulas / Dosagem'),
          labelBadgeInput
        )
      ),
      el(
        'div',
        { className: 'form-group' },
        el('label', { className: 'form-label', for: 'compound-label-title' }, 'Nome Principal Impresso no Rótulo'),
        labelTitleInput,
        el('span', { className: 'form-hint' }, 'Texto em destaque no centro do frasco. Aceita até 2 linhas.')
      )
    ),

    // GRUPO B
    el(
      'div',
      { className: 'compound-form-group' },
      el(
        'h3',
        { className: 'compound-form-group__title' },
        createIcon('fa-solid fa-link'),
        ' B. Botão de Compra e Vínculo com Produto'
      ),
      el(
        'div',
        { className: 'form-row form-row--2col' },
        el(
          'label',
          { className: 'compound-toggle-row', for: 'compound-show-button' },
          showButtonCheck,
          el('span', {}, 'Exibir botão na base do card')
        ),
        el(
          'label',
          { className: 'compound-toggle-row', for: 'compound-open-new-tab' },
          openNewTabCheck,
          el('span', {}, 'Abrir link em uma nova aba')
        )
      ),
      el(
        'div',
        { className: 'form-group' },
        el('label', { className: 'form-label', for: 'compound-product-id' }, 'Vincular Diretamente a um Produto do Catálogo'),
        productSelect,
        el('div', { style: 'margin-top:0.45rem' }, autoFillFromProductBtn)
      ),
      el(
        'div',
        { className: 'form-row form-row--2col' },
        el(
          'div',
          { className: 'form-group' },
          el('label', { className: 'form-label', for: 'compound-button-text' }, 'Texto do Botão'),
          buttonTextInput
        ),
        el(
          'div',
          { className: 'form-group' },
          el('label', { className: 'form-label', for: 'compound-button-link' }, 'URL de Destino'),
          buttonLinkInput
        )
      )
    ),

    // GRUPO C
    el(
      'div',
      { className: 'compound-form-group' },
      el(
        'h3',
        { className: 'compound-form-group__title' },
        createIcon('fa-solid fa-shapes'),
        ' C. Personalização Visual e Ilustração Botânica'
      ),
      el(
        'div',
        { className: 'form-group' },
        el('label', { className: 'form-label', for: 'compound-card-theme' }, 'Tema de Cor do Card'),
        themeSwatchesRow,
        cardThemeSelect
      ),
      el(
        'div',
        { className: 'form-row form-row--2col' },
        el(
          'div',
          { className: 'form-group' },
          el('label', { className: 'form-label', for: 'compound-badge-color' }, 'Cor do Selo no Rótulo'),
          badgeColorSelect
        ),
        el(
          'div',
          { className: 'form-group' },
          el('label', { className: 'form-label', for: 'compound-title-align' }, 'Alinhamento do Título'),
          titleAlignSelect
        )
      ),
      el(
        'div',
        { className: 'form-group' },
        el('label', { className: 'form-label', for: 'compound-botanical-theme' }, 'Ilustração Botânica Lateral'),
        botanicalThemeSelect
      ),
      el(
        'label',
        { className: 'compound-toggle-row', for: 'compound-show-capsules' },
        showCapsulesCheck,
        el('span', {}, 'Exibir as 4 cápsulas 3D flutuantes ao redor do frasco')
      )
    ),

    // GRUPO D
    el(
      'div',
      { className: 'compound-form-group' },
      el(
        'h3',
        { className: 'compound-form-group__title' },
        createIcon('fa-solid fa-image'),
        ' D. Imagens (Frasco e Arte Botânica — Supabase Storage)'
      ),
      el(
        'div',
        { className: 'form-group' },
        el('label', { className: 'form-label', for: 'compound-bottle-file' }, 'Imagem do Frasco / Produto (Opcional)'),
        el(
          'div',
          { className: 'compound-upload-preview-row', style: 'margin-bottom:0.5rem' },
          bottleThumbImg,
          el(
            'div',
            { className: 'compound-upload-meta' },
            bottleStatusText,
            resetBottleToDefaultBtn
          )
        ),
        el(
          'label',
          { className: 'upload-zone', for: 'compound-bottle-file' },
          bottleFileInput,
          el(
            'div',
            { className: 'upload-zone__prompt' },
            el('div', { className: 'upload-zone__icon' }, createIcon('fa-solid fa-cloud-arrow-up')),
            el(
              'div',
              { className: 'upload-zone__text' },
              el('strong', { textContent: 'Enviar foto de frasco ou embalagem personalizada' }),
              el('span', { textContent: 'PNG transparente ou WebP recomendado (máx. 2 MB)' })
            )
          )
        )
      ),
      el(
        'div',
        { className: 'form-group' },
        el('label', { className: 'form-label', for: 'compound-botanical-file' }, 'Ilustração Botânica Personalizada (Opcional)'),
        el(
          'label',
          { className: 'upload-zone', for: 'compound-botanical-file' },
          botanicalFileInput,
          el(
            'div',
            { className: 'upload-zone__prompt' },
            el('div', { className: 'upload-zone__icon' }, createIcon('fa-solid fa-seedling')),
            el(
              'div',
              { className: 'upload-zone__text' },
              el('strong', { textContent: 'Enviar ingrediente/planta recortada em PNG/WebP' }),
              el('span', { textContent: 'Substitui o SVG vetorial lateral por sua própria imagem' })
            )
          )
        ),
        botanicalPreviewRow
      )
    ),

    // GRUPO E
    el(
      'div',
      { className: 'compound-form-group' },
      el(
        'h3',
        { className: 'compound-form-group__title' },
        createIcon('fa-solid fa-sliders'),
        ' E. Ordem de Exibição e Publicação'
      ),
      el(
        'div',
        { className: 'form-row form-row--2col' },
        el(
          'div',
          { className: 'form-group' },
          el('label', { className: 'form-label', for: 'compound-order' }, 'Ordem na Vitrine (0 = primeiro)'),
          orderInput
        ),
        el(
          'div',
          { className: 'form-group', style: 'justify-content:flex-end' },
          el(
            'label',
            { className: 'compound-toggle-row', for: 'compound-active' },
            activeCheck,
            el('span', {}, 'Card ativo e visível na loja pública')
          )
        )
      )
    ),

    el(
      'div',
      { style: 'display:flex;gap:0.65rem;flex-wrap:wrap;margin-top:0.5rem' },
      submitBtn,
      cancelEditBtn
    )
  );

  formEl.addEventListener('submit', async (event) => {
    event.preventDefault();

    const title = titleInput.value.trim();
    if (title.length < 2) {
      setEditorStatus('error', 'Informe o título principal');
      showToast('Informe o título superior do card (mínimo 2 caracteres).', 'warning');
      titleInput.focus();
      return;
    }

    const buttonLink = buttonLinkInput.value.trim();
    if (!isValidCompoundLink(buttonLink)) {
      setEditorStatus('error', 'URL de destino inválida');
      showToast('O link de destino informado é inválido. Use um link relativo ou https://.', 'error');
      buttonLinkInput.focus();
      return;
    }

    setEditorStatus('saving', 'Salvando no Supabase...');
    setButtonLoading(
      submitBtn,
      true,
      'Salvando...',
      editingId ? 'Salvar Alterações do Card' : 'Salvar Card na Vitrine',
      'fa-solid fa-floppy-disk'
    );

    try {
      await saveCompoundCard(
        {
          title,
          label_subtitle: labelSubtitleInput.value,
          label_title: labelTitleInput.value,
          label_badge: labelBadgeInput.value,
          show_label: showLabelCheck.checked,
          button_text: buttonTextInput.value,
          button_link: buttonLink,
          product_id: productSelect.value || null,
          open_in_new_tab: openNewTabCheck.checked,
          show_button: showButtonCheck.checked,
          card_theme: cardThemeSelect.value,
          badge_color: badgeColorSelect.value,
          title_align: titleAlignSelect.value,
          botanical_theme: botanicalThemeSelect.value,
          show_capsules: showCapsulesCheck.checked,
          display_order: Number(orderInput.value) || 0,
          is_active: activeCheck.checked,
        },
        {
          editingId,
          oldImagePath,
          oldBotanicalImagePath,
          bottleFile: selectedBottleFile,
          botanicalFile: selectedBotanicalFile,
          clearBottleImage: clearBottleImageFlag,
          clearBotanicalImage: clearBotanicalImageFlag,
        }
      );

      setState({ isFormDirty: false });
      setEditorStatus('saved', 'Salvo com sucesso no Supabase');
      showToast(
        editingId
          ? 'Card da vitrine de compostos atualizado com sucesso!'
          : 'Novo card adicionado à vitrine de compostos!',
        'success'
      );
      resetForm(true);
    } catch (err) {
      const normalized = normalizeSupabaseError(err, 'Erro ao salvar card de composto');
      setEditorStatus('error', 'Erro ao salvar');
      showToast(normalized.userMessage, 'error');
    } finally {
      setButtonLoading(
        submitBtn,
        false,
        'Salvando...',
        editingId ? 'Salvar Alterações do Card' : 'Salvar Card na Vitrine',
        'fa-solid fa-floppy-disk'
      );
    }
  });

  /* ==========================================================================
     7. LISTAGEM, FILTROS, ORDENAÇÃO DRAG & DROP E AÇÕES RÁPIDAS
     ========================================================================== */
  const listBody = el('div', {
    className: 'compound-list-body',
    id: 'compounds-admin-list',
    style: 'display:flex;flex-direction:column;gap:0.85rem;padding:16px 20px',
  });

  const counterSummaryBadge = el('span', { className: 'badge badge-info' }, '0 ativos');

  const searchListInput = /** @type {HTMLInputElement} */ (
    el('input', {
      type: 'search',
      className: 'form-control',
      placeholder: 'Filtrar cards por nome ou rótulo...',
      'aria-label': 'Filtrar cards por nome ou rótulo',
    })
  );

  const statusFilterSelect = /** @type {HTMLSelectElement} */ (
    el(
      'select',
      { className: 'form-control', 'aria-label': 'Filtrar cards por status' },
      el('option', { value: 'all' }, 'Todos os status'),
      el('option', { value: 'active' }, 'Somente ativos'),
      el('option', { value: 'inactive' }, 'Somente ocultos/inativos')
    )
  );

  searchListInput.addEventListener('input', () => {
    listSearchTerm = searchListInput.value.trim().toLowerCase();
    renderCompoundsList();
  });

  statusFilterSelect.addEventListener('change', () => {
    listFilterStatus = /** @type {'all' | 'active' | 'inactive'} */ (statusFilterSelect.value);
    renderCompoundsList();
  });

  async function moveCardPosition(index, direction) {
    const cards = [...(state.compoundCards || [])];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= cards.length) return;

    const temp = cards[index];
    cards[index] = cards[targetIndex];
    cards[targetIndex] = temp;

    try {
      await reorderCompoundCards(cards.map((c) => c.id));
      showToast('Ordem de exibição atualizada na loja!', 'success');
    } catch (err) {
      const normalized = normalizeSupabaseError(err, 'Erro ao reordenar vitrine');
      showToast(normalized.userMessage, 'error');
    }
  }

  async function duplicateCard(card) {
    try {
      setEditorStatus('saving', 'Duplicando card...');
      await saveCompoundCard({
        title: `${card.title} (CÓPIA)`,
        label_subtitle: card.label_subtitle,
        label_title: card.label_title,
        label_badge: card.label_badge,
        show_label: card.show_label,
        button_text: card.button_text,
        button_link: card.button_link,
        product_id: card.product_id,
        open_in_new_tab: card.open_in_new_tab,
        show_button: card.show_button,
        card_theme: card.card_theme,
        badge_color: card.badge_color,
        title_align: card.title_align,
        botanical_theme: card.botanical_theme,
        show_capsules: card.show_capsules,
        display_order: (state.compoundCards || []).length,
        is_active: false,
      });
      setEditorStatus('saved', 'Card duplicado');
      showToast('Card duplicado como rascunho inativo. Edite e ative quando desejar!', 'success');
    } catch (err) {
      const normalized = normalizeSupabaseError(err, 'Erro ao duplicar card');
      setEditorStatus('error', 'Erro ao duplicar');
      showToast(normalized.userMessage, 'error');
    }
  }

  function renderCompoundsList() {
    clearElement(listBody);
    const allCards = state.compoundCards || [];
    const activeCount = allCards.filter((c) => c.is_active !== false).length;
    counterSummaryBadge.textContent = `${activeCount} ativos de ${allCards.length}`;

    if (allCards.length === 0) {
      const seedBtn = /** @type {HTMLButtonElement} */ (
        el(
          'button',
          { type: 'button', id: 'btn-seed-compounds', className: 'btn btn-primary' },
          createIcon('fa-solid fa-wand-magic-sparkles'),
          el('span', { textContent: 'Carregar os 6 Compostos Oficiais da Botica Natural' })
        )
      );
      seedBtn.addEventListener('click', async () => {
        setButtonLoading(
          seedBtn,
          true,
          'Populando vitrine...',
          'Carregar os 6 Compostos Oficiais da Botica Natural',
          'fa-solid fa-wand-magic-sparkles'
        );
        try {
          await seedDefaultCompoundCards();
          showToast('Os 6 compostos oficiais foram carregados no banco de dados!', 'success');
        } catch (err) {
          const normalized = normalizeSupabaseError(err, 'Erro ao carregar padrões da vitrine');
          showToast(normalized.userMessage, 'error');
        } finally {
          setButtonLoading(
            seedBtn,
            false,
            'Populando vitrine...',
            'Carregar os 6 Compostos Oficiais da Botica Natural',
            'fa-solid fa-wand-magic-sparkles'
          );
        }
      });

      listBody.appendChild(
        el(
          'div',
          { className: 'empty-state' },
          el('div', { className: 'empty-state__icon' }, createIcon('fa-solid fa-vial')),
          el('h3', { className: 'empty-state__title' }, 'Sua vitrine de compostos está vazia no banco'),
          el(
            'p',
            { className: 'empty-state__desc' },
            'Enquanto não houver registros salvos, a loja pública exibe os 6 compostos padrões de segurança. Clique abaixo para importá-los para o painel e editá-los livremente.'
          ),
          seedBtn
        )
      );
      return;
    }

    const filteredCards = allCards.filter((card) => {
      if (listFilterStatus === 'active' && card.is_active === false) return false;
      if (listFilterStatus === 'inactive' && card.is_active !== false) return false;
      if (listSearchTerm) {
        const hay = `${card.title || ''} ${card.label_title || ''} ${card.label_subtitle || ''}`.toLowerCase();
        return hay.includes(listSearchTerm);
      }
      return true;
    });

    if (filteredCards.length === 0) {
      listBody.appendChild(
        el(
          'div',
          { className: 'empty-state' },
          el('div', { className: 'empty-state__icon' }, createIcon('fa-solid fa-magnifying-glass')),
          el('h3', { className: 'empty-state__title' }, 'Nenhum card corresponde ao filtro'),
          el('p', { className: 'empty-state__desc' }, 'Limpe a busca ou altere o filtro de status acima.')
        )
      );
      return;
    }

    /** @type {string | null} */
    let draggedId = null;

    filteredCards.forEach((card, idx) => {
      const fullIndex = allCards.findIndex((c) => c.id === card.id);
      const isEditingThis = String(card.id) === editingId;
      const cleanTitle = String(card.title || '').replace(/\s+/g, ' ').trim();
      const themeInfo = CARD_THEMES.find((t) => t.id === card.card_theme) || CARD_THEMES[0];
      const resolvedDest = resolveCompoundDestination(card, state.products);

      const miniPreviewWrap = el(
        'div',
        { className: 'compound-list-item__mini' },
        createCompoundCardElement(card, {
          products: state.products,
          isPreview: true,
          uniqueIndex: idx + 1,
        })
      );

      const toggleActiveBtn = el(
        'button',
        {
          type: 'button',
          className: `btn btn-sm ${card.is_active !== false ? 'btn-secondary' : 'btn-ghost'}`,
          title: card.is_active !== false ? 'Desativar card na vitrine' : 'Ativar card na vitrine',
        },
        createIcon(card.is_active !== false ? 'fa-solid fa-toggle-on' : 'fa-solid fa-toggle-off'),
        el('span', { textContent: card.is_active !== false ? 'Ativo' : 'Oculto' })
      );

      toggleActiveBtn.addEventListener('click', async () => {
        try {
          await toggleCompoundCardStatus(card.id, card.is_active === false);
          showToast(
            card.is_active === false
              ? `"${cleanTitle}" ativado na loja pública!`
              : `"${cleanTitle}" ocultado da loja pública.`,
            'success'
          );
        } catch (err) {
          const normalized = normalizeSupabaseError(err, 'Erro ao alterar visibilidade');
          showToast(normalized.userMessage, 'error');
        }
      });

      const moveUpBtn = el(
        'button',
        {
          type: 'button',
          className: 'btn btn-ghost btn-icon btn-sm',
          title: 'Mover para cima',
          'aria-label': `Mover ${cleanTitle} para cima`,
          disabled: fullIndex <= 0,
        },
        createIcon('fa-solid fa-arrow-up')
      );
      moveUpBtn.addEventListener('click', () => moveCardPosition(fullIndex, -1));

      const moveDownBtn = el(
        'button',
        {
          type: 'button',
          className: 'btn btn-ghost btn-icon btn-sm',
          title: 'Mover para baixo',
          'aria-label': `Mover ${cleanTitle} para baixo`,
          disabled: fullIndex >= allCards.length - 1,
        },
        createIcon('fa-solid fa-arrow-down')
      );
      moveDownBtn.addEventListener('click', () => moveCardPosition(fullIndex, 1));

      const editBtn = el(
        'button',
        {
          type: 'button',
          className: 'btn btn-secondary btn-sm',
          title: 'Editar este card',
        },
        createIcon('fa-solid fa-pen'),
        el('span', { textContent: 'Editar' })
      );
      editBtn.addEventListener('click', async () => {
        if (state.isFormDirty && editingId !== String(card.id)) {
          const discard = await confirmAction({
            title: 'Alternar card em edição?',
            message: 'Existem alterações não salvas no formulário atual. Deseja descartá-las?',
            confirmLabel: 'Sim, trocar de card',
            variant: 'danger',
          });
          if (!discard) return;
        }
        populateFormForEdit(card);
        refreshLivePreview();
      });

      const duplicateBtn = el(
        'button',
        {
          type: 'button',
          className: 'btn btn-ghost btn-icon btn-sm',
          title: 'Duplicar card',
          'aria-label': `Duplicar ${cleanTitle}`,
        },
        createIcon('fa-solid fa-copy')
      );
      duplicateBtn.addEventListener('click', () => duplicateCard(card));

      const deleteBtn = el(
        'button',
        {
          type: 'button',
          className: 'btn btn-ghost btn-icon btn-sm',
          title: 'Excluir card',
          'aria-label': `Excluir ${cleanTitle}`,
        },
        createIcon('fa-solid fa-trash-can')
      );
      deleteBtn.addEventListener('click', async () => {
        const confirmed = await confirmAction({
          title: 'Excluir Card da Vitrine',
          message: `Tem certeza que deseja excluir "${cleanTitle}" da Vitrine de Compostos?`,
          confirmLabel: 'Excluir Card',
          variant: 'danger',
        });
        if (!confirmed) return;

        try {
          await deleteCompoundCard(card);
          showToast('Card removido da vitrine com sucesso.', 'success');
          if (editingId === String(card.id)) {
            resetForm();
          }
        } catch (err) {
          const normalized = normalizeSupabaseError(err, 'Erro ao excluir card');
          showToast(normalized.userMessage, 'error');
        }
      });

      const row = el(
        'div',
        {
          className: `compound-list-item ${isEditingThis ? 'is-editing' : ''}`,
          draggable: 'true',
          dataset: { id: String(card.id) },
        },
        el(
          'div',
          { className: 'compound-list-item__handle', title: 'Arraste para reordenar' },
          createIcon('fa-solid fa-grip-vertical')
        ),
        miniPreviewWrap,
        el(
          'div',
          { className: 'compound-list-item__info' },
          el(
            'div',
            { className: 'compound-list-item__header' },
            el('strong', { className: 'compound-list-item__title' }, cleanTitle),
            el(
              'span',
              { className: 'badge badge-neutral' },
              `#${(card.display_order ?? fullIndex) + 1}`
            ),
            el(
              'span',
              {
                className: 'badge',
                style: `background:${themeInfo.swatch};color:#fff`,
              },
              themeInfo.label.split(' ')[0]
            )
          ),
          el(
            'div',
            { className: 'compound-list-item__sub' },
            `Rótulo: ${card.label_subtitle ? `${card.label_subtitle} — ` : ''}${String(card.label_title || '').replace(/\s+/g, ' ')} (${card.label_badge || 'Sem selo'})`
          ),
          el(
            'div',
            { className: 'compound-list-item__dest' },
            createIcon('fa-solid fa-link'),
            resolvedDest.matchedProduct
              ? ` Produto: ${resolvedDest.matchedProduct.name}`
              : ` Destino: ${resolvedDest.href}`
          )
        ),
        el(
          'div',
          { className: 'compound-list-item__actions' },
          toggleActiveBtn,
          moveUpBtn,
          moveDownBtn,
          editBtn,
          duplicateBtn,
          deleteBtn
        )
      );

      row.addEventListener('dragstart', (event) => {
        draggedId = String(card.id);
        row.classList.add('is-dragging');
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = 'move';
        }
      });

      row.addEventListener('dragend', () => {
        draggedId = null;
        row.classList.remove('is-dragging');
      });

      row.addEventListener('dragover', (event) => {
        event.preventDefault();
      });

      row.addEventListener('drop', async (event) => {
        event.preventDefault();
        const targetId = String(card.id);
        if (!draggedId || draggedId === targetId) return;

        const currentOrder = (state.compoundCards || []).map((s) => String(s.id));
        const fromIdx = currentOrder.indexOf(draggedId);
        const toIdx = currentOrder.indexOf(targetId);
        if (fromIdx === -1 || toIdx === -1) return;

        currentOrder.splice(fromIdx, 1);
        currentOrder.splice(toIdx, 0, draggedId);

        try {
          await reorderCompoundCards(currentOrder);
          showToast('Ordem da vitrine de compostos atualizada!', 'success');
        } catch (err) {
          const normalized = normalizeSupabaseError(err, 'Erro ao reordenar cards');
          showToast(normalized.userMessage, 'error');
        }
      });

      listBody.appendChild(row);
    });
  }

  /* ==========================================================================
     8. CABEÇALHO SUPERIOR E ESTRUTURA DA PÁGINA
     ========================================================================== */
  const restoreDefaultsHeaderBtn = /** @type {HTMLButtonElement} */ (
    el(
      'button',
      {
        type: 'button',
        id: 'btn-restore-compounds-defaults',
        className: 'btn btn-secondary btn-sm',
        title: 'Recria ou restaura os 6 cards oficiais da Botica Natural',
      },
      createIcon('fa-solid fa-rotate-left'),
      el('span', { textContent: 'Restaurar 6 Compostos Oficiais' })
    )
  );

  restoreDefaultsHeaderBtn.addEventListener('click', async () => {
    const ok = await confirmAction({
      title: 'Restaurar os 6 Compostos Oficiais?',
      message:
        'Isso garantirá que os 6 cards originais da Botica Natural (Alcachofra + Berinjela, Menopausa, Anti-Reumático, Drenante, Calmante e Manchas na Pele) estejam salvos e ativos no banco de dados.',
      confirmLabel: 'Sim, restaurar padrões',
      variant: 'primary',
    });
    if (!ok) return;

    setButtonLoading(
      restoreDefaultsHeaderBtn,
      true,
      'Restaurando...',
      'Restaurar 6 Compostos Oficiais',
      'fa-solid fa-rotate-left'
    );
    try {
      await seedDefaultCompoundCards();
      showToast('Vitrine oficial de compostos restaurada com sucesso!', 'success');
    } catch (err) {
      const normalized = normalizeSupabaseError(err, 'Erro ao restaurar compostos padrões');
      showToast(normalized.userMessage, 'error');
    } finally {
      setButtonLoading(
        restoreDefaultsHeaderBtn,
        false,
        'Restaurando...',
        'Restaurar 6 Compostos Oficiais',
        'fa-solid fa-rotate-left'
      );
    }
  });

  const newCardHeaderBtn = el(
    'button',
    { type: 'button', id: 'btn-new-compound', className: 'btn btn-primary btn-sm' },
    createIcon('fa-solid fa-plus'),
    el('span', { textContent: 'Novo Card' })
  );

  newCardHeaderBtn.addEventListener('click', async () => {
    if (state.isFormDirty) {
      const discard = await confirmAction({
        title: 'Criar novo card?',
        message: 'Há alterações não salvas no formulário atual. Deseja descartá-las?',
        confirmLabel: 'Descartar e criar novo',
        variant: 'danger',
      });
      if (!discard) return;
    }
    resetForm();
    titleInput.focus();
  });

  const headerBanner = el(
    'div',
    { className: 'admin-panel', style: 'margin-bottom:1.25rem' },
    el(
      'div',
      { className: 'admin-panel__header' },
      el(
        'div',
        {},
        el(
          'h2',
          { className: 'admin-panel__title' },
          createIcon('fa-solid fa-vial'),
          ' Gerenciador da Vitrine de Compostos Manipulados'
        ),
        el(
          'p',
          { className: 'admin-panel__subtitle' },
          'Controle total sobre a faixa visual exibida abaixo dos Mais Vendidos: edite textos, rótulos impressos dos frascos, cores, ilustrações botânicas, imagens e links em tempo real.'
        )
      ),
      el(
        'div',
        { style: 'display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center' },
        counterSummaryBadge,
        restoreDefaultsHeaderBtn,
        newCardHeaderBtn,
        el(
          'a',
          {
            href: 'index.html#compounds-showcase',
            target: '_blank',
            rel: 'noopener noreferrer',
            className: 'btn btn-secondary btn-sm',
          },
          createIcon('fa-solid fa-arrow-up-right-from-square'),
          el('span', { textContent: 'Ver Seção na Loja' })
        )
      )
    )
  );

  const previewCard = el(
    'div',
    { className: 'admin-panel compound-admin-preview-card', style: 'margin-bottom:1.25rem' },
    el(
      'div',
      { className: 'admin-panel__header' },
      el(
        'div',
        {},
        el('h3', { className: 'admin-panel__title' }, createIcon('fa-solid fa-eye'), ' Pré-visualização Real em Tempo Real'),
        el('p', { className: 'admin-panel__subtitle' }, 'Idêntica à renderização da loja pública')
      ),
      el(
        'div',
        { className: 'compound-admin-preview__modes', role: 'group', 'aria-label': 'Modo de visualização' },
        modeBtnSingle,
        modeBtnStrip,
        modeBtnMobile
      )
    ),
    previewStageMount,
    previewDestinationInfo
  );

  const editorColumn = el(
    'div',
    { className: 'compound-admin-editor-col' },
    previewCard,
    el(
      'div',
      { className: 'admin-panel' },
      el(
        'div',
        { className: 'admin-panel__header' },
        formTitleEl,
        editorStatusBadge
      ),
      formEl
    )
  );

  const listColumn = el(
    'div',
    { className: 'admin-panel compound-admin-list-col' },
    el(
      'div',
      { className: 'admin-panel__header' },
      el(
        'div',
        {},
        el('h2', { className: 'admin-panel__title' }, 'Cards da Vitrine (Ordem de Exibição)'),
        el(
          'p',
          { className: 'admin-panel__subtitle' },
          'Arraste os cards ou use as setas para alterar a sequência na página inicial.'
        )
      )
    ),
    el(
      'div',
      { className: 'compound-list-toolbar' },
      searchListInput,
      statusFilterSelect
    ),
    listBody
  );

  const layout = el(
    'div',
    { className: 'compound-admin-grid' },
    editorColumn,
    listColumn
  );

  container.append(headerBanner, layout);

  // Inicialização
  resetForm();
  renderCompoundsList();

  const unsubscribe = subscribe((_state, changedKeys) => {
    if (changedKeys.includes('products')) {
      populateProductSelect(productSelect.value);
      refreshLivePreview();
    }
    if (changedKeys.includes('compoundCards')) {
      renderCompoundsList();
      refreshLivePreview();
    }
  });

  return () => {
    unsubscribe();
    revokePreviewUrls();
  };
}
