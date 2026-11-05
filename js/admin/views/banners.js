// @ts-check
/**
 * View: Gerenciador de Banners do Carrossel (`#/banners`)
 * Upload WebP HD (1920x650), validação de links e reordenação por Drag-and-Drop + Teclado (Subir/Descer).
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
  let draggedSlideId = '';

  const revokePreviewBlob = () => {
    if (activeBlobUrl) {
      URL.revokeObjectURL(activeBlobUrl);
      activeBlobUrl = null;
    }
  };

  const formTitleEl = el('h2', {
    className: 'admin-panel__title',
    textContent: 'Adicionar Novo Banner (1920 × 650)',
  });

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
      alt: 'Pré-visualização panorâmica do banner',
      width: '480',
      height: '162',
    })
  );

  const progressFill = el('div', { className: 'upload-progress__fill' });
  const progressWrap = el('div', { className: 'upload-progress', hidden: true }, [progressFill]);

  const previewCard = el(
    'div',
    { id: 'slide-preview-container', className: 'slide-preview-card', hidden: true },
    [
      el('div', { className: 'slide-preview-card__frame' }, [previewImg]),
      el('div', { className: 'slide-preview-card__info' }, [
        el('span', { className: 'badge badge-success' }, [
          createIcon('fa-solid fa-wand-magic-sparkles'),
          el('span', { textContent: 'Otimização WebP 1920px ativa' }),
        ]),
        el(
          'button',
          {
            type: 'button',
            className: 'btn btn-secondary btn-sm',
            onClick: () => {
              selectedFile = null;
              fileInput.value = '';
              revokePreviewBlob();
              if (editingId) {
                const current = state.carouselSlides.find((s) => s.id === editingId);
                updatePreviewUI(current ? resolveAdminImageUrl(current, FALLBACK_SLIDE_THUMB) : null);
              } else {
                updatePreviewUI(null);
              }
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
        el('strong', { textContent: 'Clique ou arraste a arte panorâmica aqui' }),
        el('span', {
          textContent: 'Proporção 1920 × 650 px · JPG, PNG ou WebP (conversão automática ≤ 2 MB)',
        }),
      ]),
    ]),
  ]);

  // Suporte visual a Drag & Drop na zona de upload
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
    if (droppedFile) handleFileChosen(droppedFile);
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0] || null;
    if (file) handleFileChosen(file);
  });

  function handleFileChosen(/** @type {File} */ file) {
    const validation = validateImageFile(file);
    if (!validation.valid) {
      showToast(validation.error || 'Arquivo inválido.', 'error');
      fileInput.value = '';
      return;
    }
    selectedFile = file;
    revokePreviewBlob();
    activeBlobUrl = URL.createObjectURL(file);
    updatePreviewUI(activeBlobUrl);
  }

  function updatePreviewUI(/** @type {string | null} */ src) {
    if (src) {
      previewImg.src = src;
      previewCard.hidden = false;
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
      placeholder: 'Ex: Campanha de Inverno — Fórmulas Manipuladas',
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
    revokePreviewBlob();
    updatePreviewUI(null);
    titleInput.value = '';
    linkInput.value = '';
    orderInput.value = String(state.carouselSlides.length + 1);
    activeCheckbox.checked = true;
    cancelBtn.hidden = true;
    progressWrap.hidden = true;
    formTitleEl.textContent = 'Adicionar Novo Banner (1920 × 650)';
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
    revokePreviewBlob();

    titleInput.value = slide.title || '';
    linkInput.value = slide.button_link || '';
    orderInput.value = String(slide.display_order ?? 1);
    activeCheckbox.checked = Boolean(slide.is_active);
    cancelBtn.hidden = false;

    const currentImg = resolveAdminImageUrl(slide, FALLBACK_SLIDE_THUMB);
    updatePreviewUI(currentImg);

    formTitleEl.textContent = `Editando Banner #${slide.display_order ?? 1}`;
    setButtonLoading(
      saveBtn,
      false,
      'Salvando...',
      'Salvar Alterações / Trocar Foto',
      'fa-solid fa-floppy-disk'
    );
    renderGallery();
    titleInput.focus();
  }

  const formEl = el(
    'form',
    {
      id: 'carousel-form',
      className: 'admin-form',
      novalidate: true,
      onSubmit: async (/** @type {SubmitEvent} */ e) => {
        e.preventDefault();

        if (!editingId && !selectedFile) {
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
      el('div', { className: 'form-group' }, [
        el('label', { for: 'slide-image', className: 'form-label' }, [
          'Arte Panorâmica do Banner ',
          el('span', { className: 'required-mark', textContent: '*' }),
        ]),
        uploadZone,
        progressWrap,
        previewCard,
      ]),
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
                onClick: () => startEdit(slide),
              },
              [createIcon('fa-regular fa-pen-to-square'), el('span', { textContent: 'Editar' })]
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

