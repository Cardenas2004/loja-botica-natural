// @ts-check
/**
 * View: Gerenciador de Banners do Carrossel (`#/banners`)
 * Upload WebP HD (1920x600 / 16:5), ajuste de ponto de foco (focus_x, focus_y) para recorte 16:9 mobile,
 * seletor 3x3 acessível por teclado, validação de links e reordenação por Drag-and-Drop + Teclado.
 */

import { normalizeSupabaseError } from '../../supabaseClient.js';
import { state } from '../state.js';
import {
  saveCarouselSlide,
  deleteCarouselSlide,
  reorderCarouselSlides,
  validateImageFile,
  resolveAdminImageUrl,
  FALLBACK_SLIDE_THUMB,
  isValidBannerLink,
} from '../api.js';
import {
  el,
  createIcon,
  showToast,
  confirmAction,
  setButtonLoading,
  createEmptyState,
} from '../ui.js';

const FOCUS_PRESETS_3X3 = [
  { label: 'Topo Esquerda', x: 15, y: 20 },
  { label: 'Topo Centro', x: 50, y: 20 },
  { label: 'Topo Direita', x: 85, y: 20 },
  { label: 'Centro Esquerda', x: 15, y: 50 },
  { label: 'Centro', x: 50, y: 50 },
  { label: 'Centro Direita', x: 85, y: 50 },
  { label: 'Base Esquerda', x: 15, y: 80 },
  { label: 'Base Centro', x: 50, y: 80 },
  { label: 'Base Direita', x: 85, y: 80 },
];

/**
 * Renderiza a view de gerenciamento de banners do carrossel.
 * @param {HTMLElement} container
 */
export function renderBannersView(container) {
  let editingId = '';
  let oldImagePath = '';
  /** @type {File | null} */
  let selectedFile = null;
  /** @type {string | null} */
  let activeBlobUrl = null;
  let isDesktopImageCleared = false;
  let draggedSlideId = '';
  let currentFocusX = 50;
  let currentFocusY = 50;

  const revokePreviewBlobs = () => {
    if (activeBlobUrl) {
      URL.revokeObjectURL(activeBlobUrl);
      activeBlobUrl = null;
    }
  };

  const formTitleEl = el('h2', {
    className: 'admin-panel__title',
    textContent: 'Adicionar Novo Banner (1920 × 600)',
  });

  // Aviso informativo (não bloqueante) sobre recorte automático 16:9 no celular
  const guideBox = el('div', { className: 'banner-guide-box', role: 'note' }, [
    el('div', { className: 'banner-guide-box__header' }, [
      createIcon('fa-solid fa-circle-info'),
      el('strong', { textContent: 'Enquadramento e Recorte Automático Mobile (16:9):' }),
    ]),
    el('p', {
      className: 'banner-guide-box__desc',
      textContent:
        'No celular, a arte 16:5 é recortada automaticamente em 16:9. Mantenha textos e logo dentro da moldura central (~55% da largura).',
    }),
  ]);

  // ==========================================
  // 1. UPLOAD DA ARTE DESKTOP (1920x600 / 16:5) + MOLDURA 16:9 SOBREPOSTA
  // ==========================================
  const fileInput = /** @type {HTMLInputElement} */ (
    el('input', {
      type: 'file',
      id: 'slide-image',
      className: 'upload-zone__input',
      accept: 'image/jpeg,image/png,image/webp',
    })
  );

  const previewImg = /** @type {HTMLImageElement} */ (
    el('img', {
      id: 'slide-preview',
      src: '',
      alt: 'Pré-visualização panorâmica do banner com moldura de recorte mobile 16:9',
      width: '480',
      height: '150',
    })
  );

  const cropWindowEl = el(
    'div',
    {
      id: 'slide-crop-window',
      className: 'slide-preview-card__crop-window',
      title: 'Área visível no celular (recorte 16:9)',
      'aria-hidden': 'true',
    },
    [
      el('span', {
        className: 'slide-preview-card__crop-badge',
        textContent: 'Área visível Mobile 16:9',
      }),
    ]
  );

  const focusPointDotEl = el('span', {
    id: 'slide-focus-dot',
    className: 'slide-preview-card__focus-dot',
    'aria-hidden': 'true',
  });

  const previewFrameEl = el(
    'div',
    {
      id: 'slide-preview-frame',
      className: 'slide-preview-card__frame slide-preview-card__frame--interactive',
      title: 'Clique em qualquer ponto da imagem para ajustar o ponto de foco mobile',
    },
    [previewImg, cropWindowEl, focusPointDotEl]
  );

  previewFrameEl.addEventListener('click', (e) => {
    const rect = previewFrameEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const xPct = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const yPct = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    setFocusCoordinates(xPct, yPct);
  });

  const desktopRatioMsg = el('span', { textContent: '' });
  const desktopWarningBadge = el(
    'span',
    { className: 'badge badge-warning', hidden: true },
    [createIcon('fa-solid fa-triangle-exclamation'), desktopRatioMsg]
  );

  const progressFill = el('div', { className: 'upload-progress__fill' });
  const progressWrap = el('div', { className: 'upload-progress', hidden: true }, [progressFill]);

  // Controles de ponto de foco: sliders/numéricos + seletor 3x3 acessível por teclado
  const focusXInput = /** @type {HTMLInputElement} */ (
    el('input', {
      type: 'number',
      id: 'slide-focus-x',
      className: 'form-control',
      min: '0',
      max: '100',
      step: '1',
      value: '50',
      'aria-label': 'Ponto de foco horizontal (%)',
    })
  );

  const focusXRange = /** @type {HTMLInputElement} */ (
    el('input', {
      type: 'range',
      id: 'slide-focus-x-range',
      className: 'focus-slider',
      min: '0',
      max: '100',
      step: '1',
      value: '50',
      'aria-label': 'Controle deslizante de foco horizontal (%)',
    })
  );

  const focusYInput = /** @type {HTMLInputElement} */ (
    el('input', {
      type: 'number',
      id: 'slide-focus-y',
      className: 'form-control',
      min: '0',
      max: '100',
      step: '1',
      value: '50',
      'aria-label': 'Ponto de foco vertical (%)',
    })
  );

  const focusYRange = /** @type {HTMLInputElement} */ (
    el('input', {
      type: 'range',
      id: 'slide-focus-y-range',
      className: 'focus-slider',
      min: '0',
      max: '100',
      step: '1',
      value: '50',
      'aria-label': 'Controle deslizante de foco vertical (%)',
    })
  );

  /** @type {HTMLButtonElement[]} */
  const presetButtons = FOCUS_PRESETS_3X3.map((preset) => {
    const btn = /** @type {HTMLButtonElement} */ (
      el(
        'button',
        {
          type: 'button',
          className: 'focus-grid-3x3__btn',
          'aria-label': `Foco: ${preset.label} (${preset.x}%, ${preset.y}%)`,
          'aria-pressed': preset.x === 50 && preset.y === 50 ? 'true' : 'false',
          dataset: { focusX: String(preset.x), focusY: String(preset.y) },
          onClick: () => setFocusCoordinates(preset.x, preset.y),
        },
        [el('span', { className: 'focus-grid-3x3__dot', 'aria-hidden': 'true' })]
      )
    );
    return btn;
  });

  const focusGrid3x3El = el(
    'div',
    {
      className: 'focus-grid-3x3',
      role: 'group',
      'aria-label': 'Grade rápida de 9 posições do ponto de foco',
    },
    presetButtons
  );

  function setFocusCoordinates(/** @type {number} */ rawX, /** @type {number} */ rawY) {
    const clamp = (v) => Math.min(100, Math.max(0, Math.round(Number(v) || 0)));
    currentFocusX = clamp(rawX);
    currentFocusY = clamp(rawY);

    focusXInput.value = String(currentFocusX);
    focusXRange.value = String(currentFocusX);
    focusYInput.value = String(currentFocusY);
    focusYRange.value = String(currentFocusY);

    // Moldura 16:9 dentro de 16:5 tem largura de (5/9) = 55.5556%
    const cropWidthPct = 55.5556;
    const maxLeftPct = 100 - cropWidthPct;
    const leftPct = (currentFocusX / 100) * maxLeftPct;

    cropWindowEl.style.left = `${leftPct.toFixed(2)}%`;
    cropWindowEl.style.width = `${cropWidthPct.toFixed(2)}%`;
    focusPointDotEl.style.left = `${currentFocusX}%`;
    focusPointDotEl.style.top = `${currentFocusY}%`;

    presetButtons.forEach((btn) => {
      const bx = Number(btn.dataset.focusX);
      const by = Number(btn.dataset.focusY);
      const isMatch = Math.abs(bx - currentFocusX) <= 4 && Math.abs(by - currentFocusY) <= 4;
      btn.classList.toggle('is-active', isMatch);
      btn.setAttribute('aria-pressed', String(isMatch));
    });
  }

  focusXInput.addEventListener('input', () =>
    setFocusCoordinates(Number(focusXInput.value), currentFocusY)
  );
  focusXRange.addEventListener('input', () =>
    setFocusCoordinates(Number(focusXRange.value), currentFocusY)
  );
  focusYInput.addEventListener('input', () =>
    setFocusCoordinates(currentFocusX, Number(focusYInput.value))
  );
  focusYRange.addEventListener('input', () =>
    setFocusCoordinates(currentFocusX, Number(focusYRange.value))
  );

  const focusControlsPanel = el('div', { className: 'focus-controls-panel' }, [
    el('div', { className: 'focus-controls-panel__header' }, [
      el('strong', {
        className: 'form-label',
        textContent: 'Ponto de Foco do Recorte Mobile (16:9)',
      }),
      el('span', {
        className: 'form-hint',
        textContent:
          'Clique na imagem acima, use a grade 3×3 ou ajuste as coordenadas X/Y para posicionar a moldura 16:9.',
      }),
    ]),
    el('div', { className: 'focus-controls-panel__body' }, [
      focusGrid3x3El,
      el('div', { className: 'focus-controls-panel__sliders' }, [
        el('div', { className: 'form-group' }, [
          el('label', {
            for: 'slide-focus-x',
            className: 'form-label',
            textContent: 'Foco Horizontal X (%)',
          }),
          el('div', { className: 'focus-input-pair' }, [focusXRange, focusXInput]),
        ]),
        el('div', { className: 'form-group' }, [
          el('label', {
            for: 'slide-focus-y',
            className: 'form-label',
            textContent: 'Foco Vertical Y (%)',
          }),
          el('div', { className: 'focus-input-pair' }, [focusYRange, focusYInput]),
        ]),
      ]),
    ]),
  ]);

  const previewCard = el(
    'div',
    { id: 'slide-preview-container', className: 'slide-preview-card', hidden: true },
    [
      previewFrameEl,
      el('div', { className: 'slide-preview-card__info' }, [
        el('span', { className: 'badge badge-success' }, [
          createIcon('fa-solid fa-wand-magic-sparkles'),
          el('span', { textContent: 'Otimização WebP 1920px ativa' }),
        ]),
        desktopWarningBadge,
        el(
          'button',
          {
            type: 'button',
            className: 'btn btn-secondary btn-sm',
            onClick: () => {
              selectedFile = null;
              fileInput.value = '';
              isDesktopImageCleared = true;
              if (activeBlobUrl) {
                URL.revokeObjectURL(activeBlobUrl);
                activeBlobUrl = null;
              }
              desktopWarningBadge.hidden = true;
              updatePreviewUI(null);
            },
          },
          [createIcon('fa-solid fa-rotate-left'), el('span', { textContent: 'Limpar seleção' })]
        ),
      ]),
    ]
  );

  const uploadZone = el('div', { className: 'upload-zone' }, [
    fileInput,
    el('div', { className: 'upload-zone__prompt' }, [
      el('div', { className: 'upload-zone__icon', 'aria-hidden': 'true' }, [
        createIcon('fa-solid fa-panorama'),
      ]),
      el('div', { className: 'upload-zone__text' }, [
        el('strong', { textContent: 'Clique ou arraste a arte panorâmica (16:5) aqui' }),
        el('span', {
          textContent:
            'Proporção 1920 × 600 px (16:5) · JPG, PNG ou WebP (recorte automático 16:9 no celular)',
        }),
      ]),
    ]),
  ]);

  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('is-dragover');
  });
  uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('is-dragover');
  });
  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('is-dragover');
    const droppedFile = e.dataTransfer?.files?.[0];
    if (droppedFile) handleDesktopFileChosen(droppedFile);
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0] || null;
    if (file) handleDesktopFileChosen(file);
  });

  function handleDesktopFileChosen(/** @type {File} */ file) {
    const validation = validateImageFile(file);
    if (!validation.valid) {
      showToast(validation.error || 'Arquivo inválido.', 'error');
      fileInput.value = '';
      return;
    }
    selectedFile = file;
    isDesktopImageCleared = false;
    if (activeBlobUrl) {
      URL.revokeObjectURL(activeBlobUrl);
    }
    activeBlobUrl = URL.createObjectURL(file);
    updatePreviewUI(activeBlobUrl);
    checkDesktopRatio(file);
  }

  function checkDesktopRatio(/** @type {File} */ file) {
    const img = new Image();
    const tempUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(tempUrl);
      const ratio = img.naturalWidth / img.naturalHeight;
      if (ratio < 2.5 || ratio > 3.8) {
        desktopWarningBadge.hidden = false;
        desktopRatioMsg.textContent = `Proporção ${ratio.toFixed(2)}:1 (${img.naturalWidth}x${img.naturalHeight}). Recomendado: 16:5 (1920×600).`;
      } else {
        desktopWarningBadge.hidden = true;
      }
    };
    img.src = tempUrl;
  }

  function updatePreviewUI(/** @type {string | null} */ src) {
    if (src) {
      previewImg.src = src;
      previewCard.hidden = false;
      setFocusCoordinates(currentFocusX, currentFocusY);
    } else {
      previewImg.src = '';
      previewCard.hidden = true;
    }
  }

  const orderInput = /** @type {HTMLInputElement} */ (
    el('input', {
      type: 'number',
      id: 'slide-order',
      className: 'form-control',
      min: '0',
      step: '1',
      value: String(state.carouselSlides.length + 1),
      required: true,
    })
  );

  const activeCheckbox = /** @type {HTMLInputElement} */ (
    el('input', {
      type: 'checkbox',
      id: 'slide-active',
      className: 'toggle-switch',
      checked: true,
    })
  );

  const titleInput = /** @type {HTMLInputElement} */ (
    el('input', {
      type: 'text',
      id: 'slide-title',
      className: 'form-control',
      placeholder: 'Ex: Manipulação magistral sob medida em Triunfo/RS',
      maxlength: '140',
    })
  );

  const linkInput = /** @type {HTMLInputElement} */ (
    el('input', {
      type: 'text',
      id: 'slide-link',
      className: 'form-control',
      placeholder: 'Ex: produtos.html ou https://wa.me/555185543448',
    })
  );

  const saveBtn = /** @type {HTMLButtonElement} */ (
    el(
      'button',
      { type: 'submit', id: 'btn-save-slide', className: 'btn btn-primary' },
      [createIcon('fa-solid fa-cloud-arrow-up'), el('span', { textContent: 'Adicionar Banner' })]
    )
  );

  const cancelBtn = /** @type {HTMLButtonElement} */ (
    el(
      'button',
      {
        type: 'button',
        id: 'btn-cancel-slide',
        className: 'btn btn-secondary',
        hidden: true,
        onClick: () => resetForm(),
      },
      [createIcon('fa-solid fa-xmark'), el('span', { textContent: 'Cancelar Edição' })]
    )
  );

  function resetForm() {
    editingId = '';
    oldImagePath = '';
    selectedFile = null;
    fileInput.value = '';
    isDesktopImageCleared = false;
    revokePreviewBlobs();
    setFocusCoordinates(50, 50);
    updatePreviewUI(null);
    desktopWarningBadge.hidden = true;
    titleInput.value = '';
    linkInput.value = '';
    orderInput.value = String(state.carouselSlides.length + 1);
    activeCheckbox.checked = true;
    cancelBtn.hidden = true;
    progressWrap.hidden = true;
    formTitleEl.textContent = 'Adicionar Novo Banner (1920 × 600)';
    setButtonLoading(
      saveBtn,
      false,
      'Salvando...',
      'Adicionar Banner',
      'fa-solid fa-cloud-arrow-up'
    );
    renderGallery();
  }

  function startEdit(/** @type {any} */ slide) {
    editingId = slide.id;
    oldImagePath = slide.image_path || '';
    selectedFile = null;
    fileInput.value = '';
    isDesktopImageCleared = false;
    revokePreviewBlobs();
    desktopWarningBadge.hidden = true;

    titleInput.value = slide.title || '';
    linkInput.value = slide.button_link || '';
    orderInput.value = String(slide.display_order ?? 1);
    activeCheckbox.checked = Boolean(slide.is_active);
    setFocusCoordinates(Number(slide.focus_x ?? 50), Number(slide.focus_y ?? 50));
    cancelBtn.hidden = false;

    const currentImg = resolveAdminImageUrl(slide, FALLBACK_SLIDE_THUMB);
    updatePreviewUI(currentImg);

    const slideLabel = slide.title ? `"${slide.title}"` : `#${slide.display_order ?? 1}`;
    formTitleEl.textContent = `Editando Banner ${slideLabel}`;
    setButtonLoading(
      saveBtn,
      false,
      'Salvando...',
      'Salvar Alterações / Trocar Foto',
      'fa-solid fa-floppy-disk'
    );
    renderGallery();

    const formPanel = formEl.closest('.admin-panel');
    if (formPanel && typeof formPanel.scrollIntoView === 'function') {
      formPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    titleInput.focus({ preventScroll: true });
    showToast(`Modo de edição ativado para ${slideLabel}.`, 'info');
  }

  const formEl = el(
    'form',
    {
      id: 'carousel-form',
      className: 'admin-form',
      novalidate: true,
      onSubmit: async (/** @type {SubmitEvent} */ e) => {
        e.preventDefault();

        if ((!editingId || isDesktopImageCleared) && !selectedFile) {
          showToast('Selecione uma imagem panorâmica para adicionar ao carrossel.', 'warning');
          fileInput.focus();
          return;
        }

        const buttonLink = linkInput.value.trim();
        if (!isValidBannerLink(buttonLink)) {
          showToast(
            'Link inválido. Use https://, http:// ou um caminho relativo (ex: produtos.html).',
            'warning'
          );
          linkInput.focus();
          return;
        }

        setButtonLoading(
          saveBtn,
          true,
          selectedFile ? 'Otimizando WebP e enviando...' : 'Salvando...',
          editingId ? 'Salvar Alterações / Trocar Foto' : 'Adicionar Banner'
        );

        if (selectedFile) {
          progressWrap.hidden = false;
          progressFill.style.width = '10%';
        }

        try {
          await saveCarouselSlide(
            {
              title: titleInput.value.trim(),
              button_link: buttonLink,
              display_order: Math.max(0, Number.parseInt(orderInput.value || '1', 10) || 1),
              is_active: Boolean(activeCheckbox.checked),
              focus_x: currentFocusX,
              focus_y: currentFocusY,
            },
            {
              editingId,
              oldImagePath,
              file: selectedFile,
              onProgress: (pct) => {
                progressFill.style.width = `${pct}%`;
              },
            }
          );

          showToast(
            editingId
              ? 'Banner atualizado com sucesso!'
              : 'Novo banner adicionado ao carrossel!',
            'success'
          );
          resetForm();
        } catch (err) {
          const normalized = normalizeSupabaseError(err, 'Erro ao salvar banner');
          showToast(normalized.userMessage, 'error');
        } finally {
          progressWrap.hidden = true;
          setButtonLoading(
            saveBtn,
            false,
            'Salvando...',
            editingId ? 'Salvar Alterações / Trocar Foto' : 'Adicionar Banner',
            editingId ? 'fa-solid fa-floppy-disk' : 'fa-solid fa-cloud-arrow-up'
          );
        }
      },
    },
    [
      guideBox,
      el('div', { className: 'form-group' }, [
        el('label', { for: 'slide-image', className: 'form-label' }, [
          'Arte Panorâmica (1920 × 600 / 16:5) ',
          el('span', { className: 'required-mark', textContent: '*' }),
        ]),
        uploadZone,
        progressWrap,
        previewCard,
      ]),
      focusControlsPanel,
      el('div', { className: 'form-row form-row--2col' }, [
        el('div', { className: 'form-group' }, [
          el('label', {
            for: 'slide-order',
            className: 'form-label',
            textContent: 'Ordem do Slide',
          }),
          orderInput,
          el('span', {
            className: 'form-hint',
            textContent: 'Você também pode arrastar os cartões ao lado.',
          }),
        ]),
        el('div', { className: 'form-group toggle-group' }, [
          el('label', { for: 'slide-active', className: 'toggle-card' }, [
            activeCheckbox,
            el('span', { className: 'toggle-content' }, [
              el('strong', { className: 'toggle-title', textContent: 'Banner Visível' }),
              el('span', { className: 'toggle-desc', textContent: 'Exibir no topo do site' }),
            ]),
          ]),
        ]),
      ]),
      el('div', { className: 'form-group' }, [
        el('label', {
          for: 'slide-title',
          className: 'form-label',
          textContent: 'Texto Alternativo (Acessibilidade / SEO)',
        }),
        titleInput,
      ]),
      el('div', { className: 'form-group' }, [
        el('label', {
          for: 'slide-link',
          className: 'form-label',
          textContent: 'Link ao Clicar no Banner (Opcional)',
        }),
        linkInput,
      ]),
      el('div', { className: 'form-actions' }, [saveBtn, cancelBtn]),
    ]
  );

  const galleryContainer = el('div', {
    id: 'carousel-admin-grid',
    className: 'carousel-admin-grid',
  });
  const countBadge = el('span', { className: 'badge badge-muted', textContent: '0 banners' });

  /**
   * Move um banner na lista e persiste a nova ordem no Supabase.
   * @param {number} fromIdx
   * @param {number} toIdx
   */
  async function moveSlideOrder(fromIdx, toIdx) {
    if (
      fromIdx < 0 ||
      toIdx < 0 ||
      fromIdx >= state.carouselSlides.length ||
      toIdx >= state.carouselSlides.length ||
      fromIdx === toIdx
    ) {
      return;
    }

    const ordered = [...state.carouselSlides];
    const [moved] = ordered.splice(fromIdx, 1);
    ordered.splice(toIdx, 0, moved);

    try {
      await reorderCarouselSlides(ordered.map((s) => s.id));
      showToast('Ordem dos banners atualizada!', 'success');
      renderGallery();
    } catch (err) {
      const normalized = normalizeSupabaseError(err, 'Não foi possível reordenar os banners');
      showToast(normalized.userMessage, 'error');
    }
  }

  function renderGallery() {
    const slides = state.carouselSlides;
    const activeCount = slides.filter((s) => s.is_active).length;
    countBadge.textContent = `${slides.length} total (${activeCount} ativos)`;

    if (slides.length === 0) {
      galleryContainer.replaceChildren(
        createEmptyState({
          icon: 'fa-regular fa-images',
          title: 'Nenhum banner no carrossel',
          description:
            'Envie uma foto panorâmica ao lado para exibir no carrossel principal da página inicial.',
        })
      );
      return;
    }

    const cards = slides.map((slide, index) => {
      const isEditingThis = editingId === slide.id;
      const thumbSrc = resolveAdminImageUrl(slide, FALLBACK_SLIDE_THUMB);
      const titleText = slide.title || `Banner #${index + 1}`;
      const fx = Math.round(Number(slide.focus_x ?? 50));
      const fy = Math.round(Number(slide.focus_y ?? 50));

      const card = el(
        'article',
        {
          className: `carousel-slide-card ${isEditingThis ? 'is-editing' : ''}`,
          draggable: 'true',
          dataset: { id: slide.id, index: String(index) },
        },
        [
          el('div', { className: 'carousel-slide-card__media' }, [
            el('img', {
              className: 'carousel-slide-card__img',
              src: thumbSrc,
              alt: titleText,
              loading: 'lazy',
            }),
            el('div', { className: 'carousel-slide-card__badges' }, [
              el('span', {
                className: 'badge-order',
                textContent: `#${index + 1}`,
              }),
              el('span', {
                className: slide.is_active ? 'badge badge-success' : 'badge badge-muted',
                textContent: slide.is_active ? 'Visível' : 'Oculto',
              }),
              el('span', {
                className: 'badge badge-muted',
                title: 'Ponto de foco do recorte mobile 16:9',
                textContent: `Foco ${fx}%/${fy}%`,
              }),
            ]),
          ]),
          el('div', { className: 'carousel-slide-card__body' }, [
            el('strong', { className: 'carousel-slide-card__title', textContent: titleText }),
            el('span', { className: 'carousel-slide-card__link' }, [
              createIcon(slide.button_link ? 'fa-solid fa-link' : 'fa-regular fa-image'),
              el('span', {
                textContent: slide.button_link
                  ? `Destino: ${slide.button_link}`
                  : 'Apenas imagem (sem link)',
              }),
            ]),
          ]),
          el('div', { className: 'carousel-slide-card__actions' }, [
            el(
              'button',
              {
                type: 'button',
                className: 'btn btn-secondary btn-icon',
                title: 'Mover para cima / anterior',
                'aria-label': `Mover banner ${titleText} para cima`,
                disabled: index === 0,
                onClick: () => moveSlideOrder(index, index - 1),
              },
              [createIcon('fa-solid fa-arrow-up')]
            ),
            el(
              'button',
              {
                type: 'button',
                className: 'btn btn-secondary btn-icon',
                title: 'Mover para baixo / próximo',
                'aria-label': `Mover banner ${titleText} para baixo`,
                disabled: index === slides.length - 1,
                onClick: () => moveSlideOrder(index, index + 1),
              },
              [createIcon('fa-solid fa-arrow-down')]
            ),
            el(
              'button',
              {
                type: 'button',
                className: 'btn btn-secondary btn-sm',
                'aria-pressed': String(isEditingThis),
                onClick: () => startEdit(slide),
              },
              [
                createIcon('fa-regular fa-pen-to-square'),
                el('span', { textContent: isEditingThis ? 'Editando' : 'Editar' }),
              ]
            ),
            el(
              'button',
              {
                type: 'button',
                className: 'btn btn-danger btn-icon',
                title: 'Excluir banner',
                'aria-label': `Excluir banner ${titleText}`,
                onClick: async () => {
                  const confirmed = await confirmAction({
                    title: 'Excluir Banner do Carrossel',
                    message: `Tem certeza que deseja excluir permanentemente "${titleText}"? A imagem também será removida do servidor.`,
                    confirmLabel: 'Excluir Banner',
                  });
                  if (!confirmed) return;

                  try {
                    await deleteCarouselSlide(slide);
                    if (editingId === slide.id) resetForm();
                    showToast('Banner excluído com sucesso.', 'success');
                    renderGallery();
                  } catch (err) {
                    const normalized = normalizeSupabaseError(err, 'Erro ao excluir banner');
                    showToast(normalized.userMessage, 'error');
                  }
                },
              },
              [createIcon('fa-regular fa-trash-can')]
            ),
          ]),
        ]
      );

      // Eventos Drag-and-Drop para reordenação
      card.addEventListener('dragstart', (e) => {
        draggedSlideId = slide.id;
        card.classList.add('is-dragging');
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', slide.id);
        }
      });

      card.addEventListener('dragend', () => {
        draggedSlideId = '';
        card.classList.remove('is-dragging');
        galleryContainer
          .querySelectorAll('.carousel-slide-card')
          .forEach((c) => c.classList.remove('is-drop-target'));
      });

      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (draggedSlideId && draggedSlideId !== slide.id) {
          card.classList.add('is-drop-target');
        }
      });

      card.addEventListener('dragleave', () => {
        card.classList.remove('is-drop-target');
      });

      card.addEventListener('drop', (e) => {
        e.preventDefault();
        card.classList.remove('is-drop-target');
        if (!draggedSlideId || draggedSlideId === slide.id) return;
        const fromIdx = slides.findIndex((s) => s.id === draggedSlideId);
        const toIdx = index;
        moveSlideOrder(fromIdx, toIdx);
      });

      return card;
    });

    galleryContainer.replaceChildren(...cards);
  }

  setFocusCoordinates(50, 50);
  renderGallery();

  const layout = el('div', { className: 'carousel-manager-layout' }, [
    el('section', { className: 'admin-panel' }, [
      el('div', { className: 'admin-panel__header' }, [
        el('div', {}, [
          el('span', { className: 'admin-panel__eyebrow' }, [
            createIcon('fa-solid fa-images'),
            el('span', { textContent: ' Carrossel da Página Inicial' }),
          ]),
          formTitleEl,
        ]),
      ]),
      formEl,
    ]),
    el('section', { className: 'admin-panel carousel-gallery-column' }, [
      el('div', { className: 'admin-panel__header' }, [
        el('div', {}, [
          el('span', { className: 'admin-panel__eyebrow' }, [
            createIcon('fa-solid fa-grip-vertical'),
            el('span', { textContent: ' Arraste ou use as setas para reordenar' }),
          ]),
          el('h2', { className: 'admin-panel__title', textContent: 'Banners Cadastrados' }),
        ]),
        countBadge,
      ]),
      galleryContainer,
    ]),
  ]);

  container.replaceChildren(layout);
}
