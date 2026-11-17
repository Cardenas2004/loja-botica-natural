// @ts-check
/**
 * View: Formulário Dedicado de Produto (`#/produtos/novo` e `#/produtos/:id`)
 * Integra Abas/Seções (Básico, Conteúdo Rich Text, WhatsApp, SEO),
 * Pré-visualização em Tempo Real (Fase 3), Barra Fixa Inferior e Atalho Ctrl/Cmd+S.
 */

import { normalizeSupabaseError } from '../../supabaseClient.js';
import { SITE_DOMAIN, BRAND_NAME } from '../../config.js';
import {
  DEFAULT_PRODUCT_MESSAGE_TEMPLATE,
  interpolateProductMessage,
} from '../../whatsapp.js';
import {
  DEFAULT_FIELD_MODES,
  FIELD_CHAR_LIMITS,
  extractPlainText,
  normalizeTextMode,
  normalizeTextOptions,
  legacyPlainTextToHtml,
  sanitizeRichHtml,
} from '../../shared/richtext.js';
import { state, setState, DRAFT_STORAGE_KEY_PREFIX } from '../state.js';
import {
  saveProductRecord,
  validateImageFile,
  resolveAdminImageUrl,
  fetchProductById,
} from '../api.js';
import { createRichTextEditor, insertPlainTextSnippet } from '../editor.js';
import { createLiveProductPreview } from '../preview.js';
import {
  el,
  createIcon,
  generateSlug,
  showToast,
  setButtonLoading,
  confirmAction,
} from '../ui.js';

const DEFAULT_QUALITY_NOTE =
  'Todos os produtos da Botica Natural são preparados com matérias-primas selecionadas, rastreabilidade e rigoroso controle de qualidade farmacêutico.';
const DEFAULT_ALLERGENS = 'Não contém lactose e glúten.';
const DEFAULT_PAYMENT_INFO = 'Consulte formas de pagamento via WhatsApp / Cartão e Pix';

/**
 * Renderiza a página dedicada de criação/edição de produto com Live Preview ao lado.
 *
 * @param {HTMLElement} container
 * @param {{
 *   productId: string | null,
 *   navigate: (hash: string) => void
 * }} context
 * @returns {() => void} Função de limpeza ao sair da rota
 */
export async function renderProductFormView(container, context) {
  let editingProduct = context.productId
    ? state.products.find((p) => p.id === context.productId) || null
    : null;

  // Garante o carregamento da ficha técnica completa (descrições ricas, modo de usar, etc.)
  if (context.productId && (!editingProduct || editingProduct.description === undefined)) {
    const freshProduct = await fetchProductById(context.productId);
    if (freshProduct) {
      editingProduct = freshProduct;
      const idx = state.products.findIndex((p) => p.id === freshProduct.id);
      if (idx >= 0) {
        state.products[idx] = { ...state.products[idx], ...freshProduct };
      }
    }
  }

  const isEditing = Boolean(editingProduct);
  let currentProductId = editingProduct?.id || '';
  let originalUpdatedAt = editingProduct?.updated_at || null;
  let oldImagePath = editingProduct?.image_path || '';
  let existingImageUrl = editingProduct?.image_url || '';
  /** @type {File | null} */
  let selectedFile = null;
  /** @type {string | null} */
  let activeBlobUrl = null;
  let isImageCleared = false;
  let isInitializing = true;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let draftDebounceTimer = null;
  const DRAFT_STORAGE_KEY = `${DRAFT_STORAGE_KEY_PREFIX}${context.productId || 'new'}`;

  setState({ isFormDirty: false });

  const revokePreviewBlob = () => {
    if (activeBlobUrl) {
      URL.revokeObjectURL(activeBlobUrl);
      activeBlobUrl = null;
    }
  };

  function scheduleDraftSave() {
    if (isInitializing || !state.session) return;
    if (draftDebounceTimer) clearTimeout(draftDebounceTimer);
    draftDebounceTimer = setTimeout(() => {
      if (!state.session) return;
      try {
        const stateToDraft = collectCurrentFormState();
        localStorage.setItem(
          DRAFT_STORAGE_KEY,
          JSON.stringify({
            timestamp: Date.now(),
            productId: context.productId || 'new',
            data: stateToDraft,
          })
        );
      } catch {}
    }, 1000);
  }

  function clearDraftStorage() {
    if (draftDebounceTimer) clearTimeout(draftDebounceTimer);
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {}
  }

  // Instância do Live Preview (Fase 3)
  const livePreview = createLiveProductPreview();

  // Banner discreto de restauração/descarte de rascunho salvo
  const draftBanner = el('div', { className: 'draft-alert-banner', hidden: true });

  function checkDraftBanner() {
    try {
      const rawDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!rawDraft) return;
      const draft = JSON.parse(rawDraft);
      if (!draft || !draft.timestamp || !draft.data) return;

      const productUpdatedAt = editingProduct?.updated_at
        ? new Date(editingProduct.updated_at).getTime()
        : 0;

      if (draft.timestamp > productUpdatedAt) {
        const draftDateStr = new Date(draft.timestamp).toLocaleString('pt-BR');
        draftBanner.replaceChildren(
          el('div', { className: 'draft-alert-banner__content' }, [
            createIcon('fa-solid fa-clock-rotate-left'),
            el('span', {
              textContent: `Existe um rascunho salvo localmente deste produto (${draftDateStr}).`,
            }),
          ]),
          el('div', { className: 'draft-alert-banner__actions' }, [
            el(
              'button',
              {
                type: 'button',
                className: 'btn btn-sm btn-primary',
                onClick: () => restoreDraft(draft.data),
              },
              [createIcon('fa-solid fa-arrow-rotate-left'), el('span', { textContent: 'Restaurar Rascunho' })]
            ),
            el(
              'button',
              {
                type: 'button',
                className: 'btn btn-sm btn-secondary',
                onClick: () => {
                  clearDraftStorage();
                  draftBanner.hidden = true;
                  showToast('Rascunho descartado.', 'info');
                },
              },
              [createIcon('fa-solid fa-trash-can'), el('span', { textContent: 'Descartar' })]
            ),
          ])
        );
        draftBanner.hidden = false;
      }
    } catch {}
  }

  function restoreDraft(data) {
    if (!data) return;
    if (data.name !== undefined) nameInput.value = data.name;
    if (data.slug !== undefined) {
      slugInput.value = data.slug;
      slugManuallyEdited = Boolean(String(data.slug).trim());
    }
    if (data.sku_ref !== undefined) skuInput.value = data.sku_ref;
    if (data.category_id !== undefined) categorySelect.value = data.category_id;
    if (data.price !== undefined) {
      const isZero = Number(data.price) <= 0;
      sobConsultaCheckbox.checked = isZero;
      priceInput.disabled = isZero;
      priceInput.value = Number(data.price).toFixed(2);
    }
    if (data.is_active !== undefined) activeCheckbox.checked = Boolean(data.is_active);
    if (data.is_best_seller !== undefined) bestsellerCheckbox.checked = Boolean(data.is_best_seller);
    if (data.home_featured !== undefined) homeFeaturedCheckbox.checked = Boolean(data.home_featured);
    if (data.home_position !== undefined) homePositionInput.value = String(Math.max(0, Number(data.home_position) || 0));
    if (data.whatsapp_message !== undefined) waTextarea.value = data.whatsapp_message;

    if (data.short_description !== undefined) shortDescEditor.setValue(data.short_description, data.text_options?.short_description);
    if (data.description !== undefined) descriptionEditor.setValue(data.description, data.text_options?.description);
    if (data.usage_instructions !== undefined) usageEditor.setValue(data.usage_instructions, data.text_options?.usage_instructions);
    if (data.composition !== undefined) compositionEditor.setValue(data.composition, data.text_options?.composition);
    if (data.package_info !== undefined) packageEditor.setValue(data.package_info, data.text_options?.package_info);
    if (data.allergen_info !== undefined) allergensEditor.setValue(data.allergen_info, data.text_options?.allergen_info);
    if (data.quality_note !== undefined) qualityEditor.setValue(data.quality_note, data.text_options?.quality_note);
    if (data.payment_info !== undefined) paymentEditor.setValue(data.payment_info, data.text_options?.payment_info);

    draftBanner.hidden = true;
    markDirty();
    showToast('Rascunho restaurado com sucesso!', 'success');
  }

  // Indicador de estado sujo na barra inferior fixa
  const dirtyBadge = el(
    'span',
    { className: 'badge badge-muted dirty-status-badge' },
    [createIcon('fa-solid fa-check'), el('span', { textContent: 'Sem alterações pendentes' })]
  );

  function markDirty() {
    if (isInitializing) return;
    if (!state.isFormDirty) {
      setState({ isFormDirty: true });
      dirtyBadge.className = 'badge badge-warning dirty-status-badge';
      dirtyBadge.replaceChildren(
        createIcon('fa-solid fa-circle-dot'),
        el('span', { textContent: 'Alterações não salvas' })
      );
    }
    syncLivePreviewAndSeo();
    scheduleDraftSave();
  }

  function markSaved() {
    setState({ isFormDirty: false });
    dirtyBadge.className = 'badge badge-success dirty-status-badge';
    dirtyBadge.replaceChildren(
      createIcon('fa-solid fa-circle-check'),
      el('span', { textContent: 'Salvo no banco' })
    );
  }

  /* ========================================================================
     SEÇÃO 1: DADOS BÁSICOS E IMAGEM PRINCIPAL
     ======================================================================== */

  let slugManuallyEdited = Boolean(editingProduct?.slug);

  const slugInput = /** @type {HTMLInputElement} */ (
    el('input', {
      type: 'text',
      id: 'prod-slug',
      className: 'form-control',
      placeholder: 'Ex: composto-magno-6-60-capsulas',
      maxlength: '160',
      value: editingProduct?.slug || generateSlug(editingProduct?.name || ''),
      onInput: () => {
        slugManuallyEdited = slugInput.value.trim().length > 0;
        markDirty();
      },
      onBlur: () => {
        const sanitized = generateSlug(slugInput.value || nameInput.value);
        slugInput.value = sanitized;
        if (!sanitized) slugManuallyEdited = false;
        syncLivePreviewAndSeo();
      },
    })
  );

  const nameInput = /** @type {HTMLInputElement} */ (
    el('input', {
      type: 'text',
      id: 'prod-name',
      className: 'form-control',
      placeholder: 'Ex: Composto Magno 6 — 60 Cápsulas',
      required: true,
      maxlength: '180',
      value: editingProduct?.name || '',
      onInput: () => {
        if (!slugManuallyEdited) {
          slugInput.value = generateSlug(nameInput.value);
        }
        markDirty();
      },
      onFocus: () => livePreview.focusField('name'),
    })
  );

  const skuInput = /** @type {HTMLInputElement} */ (
    el('input', {
      type: 'text',
      id: 'prod-sku',
      className: 'form-control',
      placeholder: 'Ex: REF: 4299',
      maxlength: '60',
      value: editingProduct?.sku_ref || '',
      onInput: markDirty,
      onFocus: () => livePreview.focusField('sku_ref'),
    })
  );

  const categorySelect = /** @type {HTMLSelectElement} */ (
    el(
      'select',
      {
        id: 'prod-category',
        className: 'form-control form-select',
        required: true,
        onChange: markDirty,
      },
      [
        el('option', { value: '', textContent: 'Selecione uma categoria...' }),
        ...state.categories.map((cat) =>
          el('option', {
            value: cat.id,
            textContent: `${cat.name}${cat.is_active ? '' : ' (Oculta)'}`,
          })
        ),
      ]
    )
  );
  categorySelect.value = editingProduct?.category_id || '';

  const isInitialSobConsulta = editingProduct ? Number(editingProduct.price) <= 0 : false;

  const sobConsultaCheckbox = /** @type {HTMLInputElement} */ (
    el('input', {
      type: 'checkbox',
      id: 'prod-price-sob-consulta',
      className: 'form-check-input',
      checked: isInitialSobConsulta,
      onChange: () => {
        if (sobConsultaCheckbox.checked) {
          priceInput.value = '0.00';
          priceInput.disabled = true;
        } else {
          priceInput.disabled = false;
        }
        markDirty();
      },
    })
  );

  const priceInput = /** @type {HTMLInputElement} */ (
    el('input', {
      type: 'number',
      id: 'prod-price',
      className: 'form-control form-control--with-prefix',
      min: '0',
      step: '0.01',
      placeholder: '0.00',
      required: true,
      disabled: isInitialSobConsulta,
      value:
        editingProduct?.price !== undefined
          ? Number(editingProduct.price).toFixed(2)
          : '0.00',
      onInput: markDirty,
      onFocus: () => livePreview.focusField('price'),
    })
  );

  const activeCheckbox = /** @type {HTMLInputElement} */ (
    el('input', {
      type: 'checkbox',
      id: 'prod-active',
      className: 'toggle-switch',
      checked: editingProduct ? Boolean(editingProduct.is_active) : true,
      onChange: markDirty,
    })
  );

  const bestsellerCheckbox = /** @type {HTMLInputElement} */ (
    el('input', {
      type: 'checkbox',
      id: 'prod-bestseller',
      className: 'toggle-switch toggle-switch--gold',
      checked: editingProduct ? Boolean(editingProduct.is_best_seller) : false,
      onChange: markDirty,
    })
  );

  const homeFeaturedCheckbox = /** @type {HTMLInputElement} */ (
    el('input', {
      type: 'checkbox',
      id: 'prod-home-featured',
      className: 'toggle-switch toggle-switch--gold',
      checked: editingProduct ? Boolean(editingProduct.home_featured) : false,
      onChange: markDirty,
    })
  );

  const homePositionInput = /** @type {HTMLInputElement} */ (
    el('input', {
      type: 'number',
      id: 'prod-home-position',
      className: 'form-control',
      min: '0',
      step: '1',
      value: String(Math.max(0, Number(editingProduct?.home_position) || 0)),
      onInput: markDirty,
    })
  );

  // Upload de imagem principal com drag-and-drop e barra de progresso
  const fileInput = /** @type {HTMLInputElement} */ (
    el('input', {
      type: 'file',
      id: 'prod-image',
      className: 'upload-zone__input',
      accept: 'image/jpeg,image/png,image/webp',
    })
  );

  const previewThumbImg = /** @type {HTMLImageElement} */ (
    el('img', {
      id: 'image-preview',
      src: '',
      alt: 'Pré-visualização da foto do produto',
      width: '96',
      height: '96',
    })
  );

  const progressFill = el('div', { className: 'upload-progress__fill' });
  const progressWrap = el('div', { className: 'upload-progress', hidden: true }, [progressFill]);

  const previewBadgeText = el('span', { textContent: 'Conversão WebP 1280px pronta' });
  const previewNoteText = el('p', {
    className: 'image-preview-card__note',
    textContent: 'A imagem já está refletida na pré-visualização ao vivo.',
  });
  const removeBtnLabel = el('span', { textContent: 'Remover nova seleção' });

  const restoreOriginalBtn = el(
    'button',
    {
      type: 'button',
      className: 'btn btn-secondary btn-sm',
      hidden: true,
      onClick: () => {
        selectedFile = null;
        fileInput.value = '';
        isImageCleared = false;
        revokePreviewBlob();
        updateImagePreviewUI(resolveAdminImageUrl({ image_url: existingImageUrl, image_path: oldImagePath }));
        markDirty();
        showToast('Nova seleção descartada. Foto original mantida.', 'info');
      },
    },
    [createIcon('fa-solid fa-rotate-left'), el('span', { textContent: 'Manter foto anterior' })]
  );

  const removeImageBtn = el(
    'button',
    {
      type: 'button',
      className: 'btn btn-secondary btn-sm',
      onClick: () => {
        const hadSavedImage = Boolean(editingProduct && (oldImagePath || existingImageUrl));
        selectedFile = null;
        fileInput.value = '';
        isImageCleared = true;
        revokePreviewBlob();
        updateImagePreviewUI(null);
        markDirty();
        showToast(
          hadSavedImage
            ? 'Foto removida da seleção. Clique em "Salvar Produto" para confirmar.'
            : 'Seleção de imagem removida.',
          'info'
        );
      },
    },
    [createIcon('fa-regular fa-trash-can'), removeBtnLabel]
  );

  const imagePreviewCard = el(
    'div',
    { id: 'image-preview-container', className: 'image-preview-card', hidden: true },
    [
      previewThumbImg,
      el('div', { className: 'image-preview-card__info' }, [
        el('span', { className: 'badge badge-success' }, [
          createIcon('fa-solid fa-wand-magic-sparkles'),
          previewBadgeText,
        ]),
        previewNoteText,
        el('div', { className: 'table-actions' }, [restoreOriginalBtn, removeImageBtn]),
      ]),
    ]
  );

  function updateImagePreviewUI(/** @type {string | null} */ src) {
    if (src) {
      previewThumbImg.src = src;
      imagePreviewCard.hidden = false;
      const hasSaved = Boolean(editingProduct && (oldImagePath || existingImageUrl));
      if (selectedFile) {
        previewBadgeText.textContent = 'Conversão WebP 1280px pronta';
        previewNoteText.textContent = 'Nova imagem refletida na pré-visualização ao vivo.';
        removeBtnLabel.textContent = 'Remover seleção';
        restoreOriginalBtn.hidden = !hasSaved;
      } else {
        previewBadgeText.textContent = 'Foto atual do produto';
        previewNoteText.textContent = 'Clique ou arraste outra imagem acima para substituir, ou remova a foto abaixo.';
        removeBtnLabel.textContent = 'Remover foto';
        restoreOriginalBtn.hidden = true;
      }
    } else {
      previewThumbImg.src = '';
      imagePreviewCard.hidden = true;
      restoreOriginalBtn.hidden = true;
    }
  }

  if (editingProduct && (editingProduct.image_url || editingProduct.image_path)) {
    updateImagePreviewUI(resolveAdminImageUrl(editingProduct));
  }

  const uploadZone = el('div', { className: 'upload-zone' }, [
    fileInput,
    el('div', { className: 'upload-zone__prompt' }, [
      el('div', { className: 'upload-zone__icon', 'aria-hidden': 'true' }, [
        createIcon('fa-solid fa-cloud-arrow-up'),
      ]),
      el('div', { className: 'upload-zone__text' }, [
        el('strong', { textContent: 'Clique ou arraste a foto do produto aqui' }),
        el('span', {
          textContent: 'JPG, PNG ou WebP até 10 MB · Convertido automaticamente para WebP ≤ 2 MB',
        }),
      ]),
    ]),
  ]);

  function handleProductFile(/** @type {File} */ file) {
    const check = validateImageFile(file);
    if (!check.valid) {
      showToast(check.error || 'Imagem inválida.', 'error');
      fileInput.value = '';
      return;
    }
    selectedFile = file;
    isImageCleared = false;
    revokePreviewBlob();
    activeBlobUrl = URL.createObjectURL(file);
    updateImagePreviewUI(activeBlobUrl);
    livePreview.focusField('image');
    markDirty();
  }

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
    const file = e.dataTransfer?.files?.[0];
    if (file) handleProductFile(file);
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) handleProductFile(file);
  });

  /* ========================================================================
     SEÇÃO 2: CONTEÚDO E FICHA TÉCNICA (RICH TEXT EDITORS — FASE 2)
     ======================================================================== */

  const savedTextOptions =
    editingProduct && typeof editingProduct.text_options === 'object' && editingProduct.text_options
      ? editingProduct.text_options
      : {};

  const isProductV2 = Boolean(savedTextOptions._v === 2 || savedTextOptions._v === '2');

  /** @param {keyof typeof DEFAULT_FIELD_MODES} field */
  const getInitialFieldMode = (field) =>
    normalizeTextMode(savedTextOptions[field], DEFAULT_FIELD_MODES[field]);

  /** Inicializa valor do editor: se v2 usa direto; se legado, converte via legacyPlainTextToHtml */
  const getInitialFieldValue = (val, field) => {
    if (!val) return '';
    if (isProductV2) return val;
    return legacyPlainTextToHtml(val, { mode: getInitialFieldMode(field) });
  };

  const shortDescEditor = createRichTextEditor({
    fieldName: 'short_description',
    label: 'Resumo Curto de Benefícios (Topo da Página)',
    hint: 'Exibido logo abaixo do título do produto e nos cartões da vitrine.',
    placeholder: 'Ex: Auxilia no relaxamento muscular, energia física e qualidade do sono.',
    initialValue: getInitialFieldValue(editingProduct?.short_description || '', 'short_description'),
    initialMode: getInitialFieldMode('short_description'),
    maxLength: FIELD_CHAR_LIMITS.short_description,
    minHeight: 84,
    onChange: markDirty,
    onFocusField: (f) => livePreview.focusField(f),
  });

  const descriptionEditor = createRichTextEditor({
    fieldName: 'description',
    label: 'Descrição Detalhada (Ficha Técnica)',
    hint: 'Suporta parágrafos, listas de benefícios, subtítulos H3/H4, citações e links seguros.',
    placeholder: 'Descreva os ativos, mecanismo de ação e diferenciais da fórmula...',
    initialValue: getInitialFieldValue(editingProduct?.description || '', 'description'),
    initialMode: getInitialFieldMode('description'),
    maxLength: FIELD_CHAR_LIMITS.description,
    minHeight: 160,
    onChange: markDirty,
    onFocusField: (f) => livePreview.focusField(f),
  });

  const usageEditor = createRichTextEditor({
    fieldName: 'usage_instructions',
    label: 'Modo de Usar (Posologia)',
    placeholder: 'Ex: Tomar 1 dose (2 cápsulas) ao dia, ou conforme orientação profissional.',
    initialValue: getInitialFieldValue(editingProduct?.usage_instructions || '', 'usage_instructions'),
    initialMode: getInitialFieldMode('usage_instructions'),
    maxLength: FIELD_CHAR_LIMITS.usage_instructions,
    minHeight: 88,
    onChange: markDirty,
    onFocusField: (f) => livePreview.focusField(f),
  });

  const compositionEditor = createRichTextEditor({
    fieldName: 'composition',
    label: 'Composição / Contém',
    placeholder: 'Ex: Bisglicinato de Magnésio, Dimalato, Taurato, Citrato, Óxido e Cloreto.',
    initialValue: getInitialFieldValue(editingProduct?.composition || '', 'composition'),
    initialMode: getInitialFieldMode('composition'),
    maxLength: FIELD_CHAR_LIMITS.composition,
    minHeight: 88,
    onChange: markDirty,
    onFocusField: (f) => livePreview.focusField(f),
  });

  const packageEditor = createRichTextEditor({
    fieldName: 'package_info',
    label: 'Informações da Embalagem / Apresentação',
    placeholder: 'Ex: Pote lacrado contendo 60 cápsulas gelatinosas.',
    initialValue: getInitialFieldValue(editingProduct?.package_info || '', 'package_info'),
    initialMode: getInitialFieldMode('package_info'),
    maxLength: FIELD_CHAR_LIMITS.package_info,
    minHeight: 72,
    onChange: markDirty,
    onFocusField: (f) => livePreview.focusField(f),
  });

  const allergensEditor = createRichTextEditor({
    fieldName: 'allergen_info',
    label: 'Restrições e Alérgenos',
    placeholder: DEFAULT_ALLERGENS,
    initialValue: getInitialFieldValue(editingProduct?.allergen_info ?? '', 'allergen_info'),
    initialMode: getInitialFieldMode('allergen_info'),
    maxLength: FIELD_CHAR_LIMITS.allergen_info,
    minHeight: 68,
    onChange: markDirty,
    onFocusField: (f) => livePreview.focusField(f),
  });

  const qualityEditor = createRichTextEditor({
    fieldName: 'quality_note',
    label: 'Nota de Rigor e Qualidade Farmacêutica',
    placeholder: DEFAULT_QUALITY_NOTE,
    initialValue: getInitialFieldValue(editingProduct?.quality_note ?? '', 'quality_note'),
    initialMode: getInitialFieldMode('quality_note'),
    maxLength: FIELD_CHAR_LIMITS.quality_note,
    minHeight: 88,
    onChange: markDirty,
    onFocusField: (f) => livePreview.focusField(f),
  });

  const paymentEditor = createRichTextEditor({
    fieldName: 'payment_info',
    label: 'Condições de Pagamento (Linha de Preço)',
    placeholder: DEFAULT_PAYMENT_INFO,
    initialValue: getInitialFieldValue(editingProduct?.payment_info ?? '', 'payment_info'),
    initialMode: getInitialFieldMode('payment_info'),
    maxLength: FIELD_CHAR_LIMITS.payment_info,
    minHeight: 64,
    onChange: markDirty,
    onFocusField: (f) => livePreview.focusField(f),
  });

  const allRichEditors = [
    shortDescEditor,
    descriptionEditor,
    usageEditor,
    compositionEditor,
    packageEditor,
    allergensEditor,
    qualityEditor,
    paymentEditor,
  ];

  /* ========================================================================
     SEÇÃO 3: MENSAGEM DE WHATSAPP EXCLUSIVA DO PRODUTO (TEXTO PURO)
     ======================================================================== */

  const waTextarea = /** @type {HTMLTextAreaElement} */ (
    el('textarea', {
      id: 'prod-whatsapp-message',
      className: 'form-control form-textarea whatsapp-textarea',
      rows: '4',
      maxlength: String(FIELD_CHAR_LIMITS.whatsapp_message),
      placeholder:
        'Deixe em branco para usar o Modelo Geral da loja, ou digite uma mensagem exclusiva para este produto...',
      value: editingProduct?.whatsapp_message || '',
      onInput: () => {
        markDirty();
        syncWhatsAppMiniPreview();
      },
      onFocus: () => livePreview.focusField('whatsapp_message'),
    })
  );

  const waBubblePreview = el('p', { className: 'wa-bubble__text' });

  const waPills = [
    { tag: '{produto}', label: 'Produto' },
    { tag: '{categoria}', label: 'Categoria' },
    { tag: '{preco}', label: 'Preço' },
    { tag: '{link}', label: 'Link' },
    { tag: '{sku}', label: 'SKU' },
  ];

  const waToolbar = el('div', { className: 'variables-toolbar variables-toolbar--compact' }, [
    el('span', {
      className: 'variables-toolbar__label',
      textContent: 'Inserir variável ou sintaxe do WhatsApp:',
    }),
    el('div', { className: 'variables-toolbar__pills' }, [
      ...waPills.map((v) =>
        el(
          'button',
          {
            type: 'button',
            className: 'var-pill-btn var-pill-btn--prod',
            onClick: () => insertPlainTextSnippet(waTextarea, v.tag),
          },
          [createIcon('fa-solid fa-plus'), el('code', { textContent: v.tag })]
        )
      ),
      el(
        'button',
        {
          type: 'button',
          className: 'var-pill-btn var-pill-btn--prod',
          onClick: () => insertPlainTextSnippet(waTextarea, '*', { wrap: true }),
        },
        [createIcon('fa-solid fa-bold'), el('code', { textContent: '*negrito*' })]
      ),
      el(
        'button',
        {
          type: 'button',
          className: 'var-pill-btn var-pill-btn--prod',
          onClick: () => insertPlainTextSnippet(waTextarea, '_', { wrap: true }),
        },
        [createIcon('fa-solid fa-italic'), el('code', { textContent: '_itálico_' })]
      ),
    ]),
  ]);

  /* ========================================================================
     SEÇÃO 4: PRÉ-VISUALIZAÇÃO DE SEO (SNIPPET DO GOOGLE)
     ======================================================================== */

  const seoTitlePreview = el('div', { className: 'seo-snippet__title' });
  const seoUrlPreview = el('div', { className: 'seo-snippet__url' });
  const seoDescPreview = el('div', { className: 'seo-snippet__desc' });

  const seoCard = el('div', { className: 'seo-snippet-card' }, [
    el('span', {
      className: 'form-label',
      textContent: 'Simulação de Resultado no Google (SEO Automático)',
    }),
    el('div', { className: 'seo-snippet' }, [
      seoUrlPreview,
      seoTitlePreview,
      seoDescPreview,
    ]),
    el('span', {
      className: 'form-hint',
      textContent:
        'O título, URL canônica e meta description são gerados automaticamente a partir do Nome e do Resumo Curto do produto (sem tags HTML).',
    }),
  ]);

  /* ========================================================================
     COLETA DE DADOS ATUAIS E SINCRONIZAÇÃO COM O PREVIEW AO VIVO
     ======================================================================== */

  function collectCurrentFormState() {
    const selectedCat = state.categories.find((c) => c.id === categorySelect.value);
    let numericPrice = 0;
    if (!sobConsultaCheckbox.checked) {
      const rawPrice = Number.parseFloat(priceInput.value || '0');
      numericPrice = Number.isFinite(rawPrice) && rawPrice >= 0 ? rawPrice : 0;
    }

    const text_options = {
      _v: 2,
      short_description: shortDescEditor.getMode(),
      description: descriptionEditor.getMode(),
      usage_instructions: usageEditor.getMode(),
      composition: compositionEditor.getMode(),
      package_info: packageEditor.getMode(),
      allergen_info: allergensEditor.getMode(),
      quality_note: qualityEditor.getMode(),
      payment_info: paymentEditor.getMode(),
    };

    return {
      id: currentProductId || 'preview-novo',
      name: nameInput.value.trim(),
      slug: generateSlug(slugInput.value.trim() || nameInput.value.trim()),
      sku_ref: skuInput.value.trim(),
      category_id: categorySelect.value || null,
      category_name: selectedCat?.name || 'Fórmulas Manipuladas',
      categories: selectedCat ? { id: selectedCat.id, name: selectedCat.name, slug: selectedCat.slug } : null,
      price: numericPrice,
      short_description: shortDescEditor.getValue(),
      payment_info: paymentEditor.getValue(),
      description: descriptionEditor.getValue(),
      usage_instructions: usageEditor.getValue(),
      composition: compositionEditor.getValue(),
      package_info: packageEditor.getValue(),
      allergen_info: allergensEditor.getValue(),
      quality_note: qualityEditor.getValue(),
      whatsapp_message: waTextarea.value.trim(),
      text_options,
      image_url: isImageCleared && !selectedFile ? '' : existingImageUrl,
      image_path: isImageCleared && !selectedFile ? '' : oldImagePath,
      preview_blob_url: activeBlobUrl || '',
      is_active: Boolean(activeCheckbox.checked),
      is_best_seller: Boolean(bestsellerCheckbox.checked),
      home_featured: Boolean(homeFeaturedCheckbox.checked),
      home_position: Math.max(0, Number.parseInt(homePositionInput.value || '0', 10) || 0),
    };
  }

  function syncWhatsAppMiniPreview() {
    const data = collectCurrentFormState();
    const templateToUse =
      data.whatsapp_message || state.whatsappTemplate || DEFAULT_PRODUCT_MESSAGE_TEMPLATE;
    waBubblePreview.textContent = interpolateProductMessage(templateToUse, {
      ...data,
      name: data.name || 'Exemplo — Nome do Produto',
    });
  }

  function syncLivePreviewAndSeo() {
    const data = collectCurrentFormState();
    livePreview.scheduleUpdate(data, state.whatsappTemplate);
    syncWhatsAppMiniPreview();

    const titleText = `${data.name || 'Exemplo — Nome do Produto'} | ${BRAND_NAME}`;
    const plainDesc =
      shortDescEditor.getPlainText() ||
      descriptionEditor.getPlainText() ||
      `Fórmula manipulada sob medida na ${BRAND_NAME} com controle de qualidade farmacêutico.`;

    seoTitlePreview.textContent = titleText;
    const effectiveSlug = generateSlug(data.slug || data.name);
    seoUrlPreview.textContent = effectiveSlug
      ? `${SITE_DOMAIN}/produtos/${effectiveSlug}/`
      : `${SITE_DOMAIN}/produto.html?id=${currentProductId || 'uuid-do-produto'}`;
    seoDescPreview.textContent = plainDesc.slice(0, 160);
  }

  /* ========================================================================
     ORGANIZAÇÃO EM ABAS (BÁSICO | CONTEÚDO | WHATSAPP | SEO)
     ======================================================================== */

  const tabPanels = {
    basico: el('div', { className: 'product-form-section' }, [
      el('div', { className: 'form-group' }, [
        el('label', { for: 'prod-name', className: 'form-label' }, [
          'Nome Comercial do Produto ',
          el('span', { className: 'required-mark', textContent: '*' }),
        ]),
        nameInput,
      ]),
      el('div', { className: 'form-row form-row--2col' }, [
        el('div', { className: 'form-group' }, [
          el('label', { for: 'prod-category', className: 'form-label' }, [
            'Categoria ',
            el('span', { className: 'required-mark', textContent: '*' }),
          ]),
          categorySelect,
        ]),
        el('div', { className: 'form-group' }, [
          el('label', { for: 'prod-sku', className: 'form-label', textContent: 'Código / REF (SKU)' }),
          skuInput,
        ]),
      ]),
      el('div', { className: 'form-row form-row--2col' }, [
        el('div', { className: 'form-group' }, [
          el('div', { className: 'form-label-row form-label-row--between' }, [
            el('label', { for: 'prod-price', className: 'form-label' }, [
              'Preço de Venda (R$) ',
              el('span', { className: 'required-mark', textContent: '*' }),
            ]),
            el('label', { className: 'form-check-label form-check-inline form-check-inline--small' }, [
              sobConsultaCheckbox,
              el('span', { textContent: 'Sob consulta' }),
            ]),
          ]),
          el('div', { className: 'input-prefix-wrap' }, [
            el('span', { className: 'input-prefix', textContent: 'R$' }),
            priceInput,
          ]),
          el('span', {
            className: 'form-hint',
            textContent: 'Marque "Sob consulta" caso a fórmula requeira avaliação prévia de receita.',
          }),
        ]),
        paymentEditor.element,
      ]),
      el('div', { className: 'form-group' }, [
        el('label', { for: 'prod-image', className: 'form-label', textContent: 'Foto Principal do Produto' }),
        uploadZone,
        progressWrap,
        imagePreviewCard,
      ]),
      el('div', { className: 'form-row form-row--2col' }, [
        el('div', { className: 'form-group toggle-group' }, [
          el('label', { for: 'prod-active', className: 'toggle-card' }, [
            activeCheckbox,
            el('span', { className: 'toggle-content' }, [
              el('strong', { className: 'toggle-title', textContent: 'Produto Ativo' }),
              el('span', { className: 'toggle-desc', textContent: 'Visível na loja pública' }),
            ]),
          ]),
        ]),
        el('div', { className: 'form-group toggle-group' }, [
          el('label', { for: 'prod-bestseller', className: 'toggle-card toggle-card--gold' }, [
            bestsellerCheckbox,
            el('span', { className: 'toggle-content' }, [
              el('strong', { className: 'toggle-title' }, [
                createIcon('fa-solid fa-star'),
                el('span', { textContent: ' Mais Vendido' }),
              ]),
              el('span', {
                className: 'toggle-desc',
                textContent: 'Exibir selo de Mais Vendido no card',
              }),
            ]),
          ]),
        ]),
      ]),
      el('div', { className: 'form-row form-row--2col' }, [
        el('div', { className: 'form-group toggle-group' }, [
          el('label', { for: 'prod-home-featured', className: 'toggle-card toggle-card--gold' }, [
            homeFeaturedCheckbox,
            el('span', { className: 'toggle-content' }, [
              el('strong', { className: 'toggle-title' }, [
                createIcon('fa-solid fa-bolt'),
                el('span', { textContent: ' Destacar na Home' }),
              ]),
              el('span', {
                className: 'toggle-desc',
                textContent: 'Exibir com prioridade na vitrine da página inicial',
              }),
            ]),
          ]),
        ]),
        el('div', { className: 'form-group' }, [
          el('label', {
            for: 'prod-home-position',
            className: 'form-label',
            textContent: 'Posição na Home (0 = primeiro)',
          }),
          homePositionInput,
          el('span', {
            className: 'form-hint',
            textContent: 'Controla a ordem dos produtos destacados na página inicial.',
          }),
        ]),
      ]),
    ]),

    conteudo: el('div', { className: 'product-form-section', hidden: true }, [
      shortDescEditor.element,
      descriptionEditor.element,
      el('div', { className: 'form-row form-row--2col' }, [
        usageEditor.element,
        compositionEditor.element,
      ]),
      el('div', { className: 'form-row form-row--2col' }, [
        packageEditor.element,
        allergensEditor.element,
      ]),
      qualityEditor.element,
    ]),

    whatsapp: el('div', { className: 'product-form-section', hidden: true }, [
      el('div', { className: 'form-group' }, [
        el('label', {
          for: 'prod-whatsapp-message',
          className: 'form-label',
          textContent: 'Mensagem Exclusiva de Compra para este Produto (Opcional)',
        }),
        waToolbar,
        waTextarea,
        el('span', {
          className: 'form-hint',
          textContent:
            'Se deixado em branco, este produto utilizará automaticamente o Modelo Geral da loja.',
        }),
      ]),
      el('div', { className: 'wa-mockup-card' }, [
        el('div', { className: 'wa-mockup-header' }, [
          el('strong', {
            className: 'wa-mockup-name',
            textContent: 'Simulação da Mensagem Enviada pelo Cliente',
          }),
        ]),
        el('div', { className: 'wa-mockup-body' }, [
          el('div', { className: 'wa-bubble-wrap' }, [
            el('div', { className: 'wa-bubble' }, [waBubblePreview]),
          ]),
        ]),
      ]),
    ]),

    seo: el('div', { className: 'product-form-section', hidden: true }, [
      el('div', { className: 'form-group' }, [
        el('label', { for: 'prod-slug', className: 'form-label', textContent: 'Slug da URL (SEO)' }),
        slugInput,
        el('span', {
          className: 'form-hint',
          textContent:
            'Gerado automaticamente a partir do nome. Use apenas letras minúsculas, números e hífens.',
        }),
      ]),
      seoCard,
    ]),
  };

  /** @type {Array<{ id: keyof typeof tabPanels, label: string, icon: string }>} */
  const tabDefs = [
    { id: 'basico', label: '1. Básico & Preço', icon: 'fa-solid fa-circle-info' },
    { id: 'conteudo', label: '2. Conteúdo (Texto Rico)', icon: 'fa-solid fa-pen-ruler' },
    { id: 'whatsapp', label: '3. WhatsApp', icon: 'fa-brands fa-whatsapp' },
    { id: 'seo', label: '4. SEO & Busca', icon: 'fa-solid fa-magnifying-glass' },
  ];

  /** @type {Map<string, HTMLButtonElement>} */
  const tabButtons = new Map();
  const tabsNav = el('div', { className: 'form-tabs-nav', role: 'tablist' });

  function activateTab(/** @type {keyof typeof tabPanels} */ tabId) {
    for (const [id, panel] of Object.entries(tabPanels)) {
      panel.hidden = id !== tabId;
    }
    for (const [id, btn] of tabButtons.entries()) {
      const active = id === tabId;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    }
  }

  tabDefs.forEach((t) => {
    const isFirst = t.id === 'basico';
    const btn = /** @type {HTMLButtonElement} */ (
      el(
        'button',
        {
          type: 'button',
          role: 'tab',
          dataset: { tab: t.id },
          className: `form-tab-btn ${isFirst ? 'is-active' : ''}`,
          'aria-selected': isFirst ? 'true' : 'false',
          onClick: () => activateTab(t.id),
        },
        [createIcon(t.icon), el('span', { textContent: t.label })]
      )
    );
    tabButtons.set(t.id, btn);
    tabsNav.appendChild(btn);
  });

  /* ========================================================================
     PERSISTÊNCIA (SALVAR / SALVAR E CONTINUAR / CTRL+S)
     ======================================================================== */

  const btnSaveAndBack = /** @type {HTMLButtonElement} */ (
    el(
      'button',
      {
        type: 'button',
        className: 'btn btn-primary',
        onClick: () => performSave({ stayOnPage: false }),
      },
      [createIcon('fa-solid fa-check'), el('span', { textContent: 'Salvar Produto' })]
    )
  );

  const btnSaveAndContinue = /** @type {HTMLButtonElement} */ (
    el(
      'button',
      {
        type: 'button',
        className: 'btn btn-secondary',
        title: 'Atalho: Ctrl+S / Cmd+S',
        onClick: () => performSave({ stayOnPage: true }),
      },
      [createIcon('fa-solid fa-floppy-disk'), el('span', { textContent: 'Salvar e continuar' })]
    )
  );

  const btnCancel = /** @type {HTMLButtonElement} */ (
    el(
      'button',
      {
        type: 'button',
        className: 'btn btn-secondary',
        onClick: () => context.navigate('#/produtos'),
      },
      [createIcon('fa-solid fa-arrow-left'), el('span', { textContent: 'Cancelar' })]
    )
  );

  let isSavingNow = false;

  async function performSave({ stayOnPage = false, forceOverwrite = false } = {}) {
    if (isSavingNow) return;

    const data = collectCurrentFormState();
    if (!data.name) {
      activateTab('basico');
      showToast('Informe o nome comercial do produto.', 'warning');
      nameInput.focus();
      return;
    }

    if (!data.category_id) {
      activateTab('basico');
      showToast('Selecione uma categoria para o produto.', 'warning');
      categorySelect.focus();
      return;
    }

    // Validação estrita de preço
    if (!sobConsultaCheckbox.checked) {
      const rawPrice = priceInput.value.trim();
      if (!rawPrice) {
        activateTab('basico');
        showToast('Informe o valor do preço ou marque a opção "Sob consulta".', 'warning');
        priceInput.focus();
        return;
      }
      const numPrice = Number(rawPrice);
      if (Number.isNaN(numPrice) || numPrice < 0) {
        activateTab('basico');
        showToast('Preço inválido. O valor não pode ser negativo ou vazio.', 'warning');
        priceInput.focus();
        return;
      }
      if (numPrice === 0) {
        const confirmZero = await confirmAction({
          title: 'Confirmar Preço Sob Consulta',
          message: 'O valor do produto está preenchido como R$ 0,00. Deseja registrar formalmente como "Sob consulta"?',
          confirmLabel: 'Confirmar como Sob consulta',
          cancelLabel: 'Corrigir preço',
        });
        if (!confirmZero) {
          activateTab('basico');
          priceInput.focus();
          return;
        }
        sobConsultaCheckbox.checked = true;
        priceInput.disabled = true;
      }
    }

    const overLimitEditor = allRichEditors.find((ed) => ed.isOverLimit());
    if (overLimitEditor) {
      activateTab('conteudo');
      showToast('Um dos campos de texto excedeu o limite máximo de caracteres.', 'warning');
      overLimitEditor.focus();
      return;
    }

    isSavingNow = true;
    setButtonLoading(btnSaveAndBack, true, 'Salvando...', 'Salvar Produto');
    setButtonLoading(btnSaveAndContinue, true, 'Salvando...', 'Salvar e continuar', 'fa-solid fa-floppy-disk');

    if (selectedFile) {
      progressWrap.hidden = false;
      progressFill.style.width = '10%';
    }

    try {
      const payload = {
        name: data.name,
        slug: data.slug,
        sku_ref: data.sku_ref,
        category_id: data.category_id,
        price: data.price,
        short_description: data.short_description,
        payment_info: data.payment_info,
        description: data.description,
        usage_instructions: data.usage_instructions,
        composition: data.composition,
        package_info: data.package_info,
        allergen_info: data.allergen_info,
        quality_note: data.quality_note,
        whatsapp_message: data.whatsapp_message,
        text_options: data.text_options,
        is_active: data.is_active,
        is_best_seller: data.is_best_seller,
        home_featured: data.home_featured,
        home_position: data.home_position,
      };

      const saved = await saveProductRecord(payload, {
        editingId: currentProductId,
        oldImagePath,
        originalUpdatedAt,
        forceOverwrite: Boolean(forceOverwrite),
        file: selectedFile,
        clearImage: isImageCleared && !selectedFile,
        onProgress: (pct) => {
          progressFill.style.width = `${pct}%`;
        },
      });

      if (saved) {
        currentProductId = saved.id;
        originalUpdatedAt = saved.updated_at || originalUpdatedAt;
        oldImagePath = saved.image_path ?? '';
        existingImageUrl = saved.image_url ?? '';
        if (saved.slug) {
          slugInput.value = saved.slug;
          slugManuallyEdited = true;
        }
      }

      isImageCleared = false;
      selectedFile = null;
      fileInput.value = '';
      revokePreviewBlob();
      if (saved && (saved.image_url || saved.image_path)) {
        updateImagePreviewUI(resolveAdminImageUrl(saved));
      } else {
        updateImagePreviewUI(null);
      }

      clearDraftStorage();
      markSaved();
      showToast(
        isEditing || currentProductId
          ? 'Produto salvo com sucesso!'
          : 'Novo produto cadastrado com sucesso!',
        'success'
      );

      if (!stayOnPage) {
        context.navigate('#/produtos');
      } else if (!context.productId && currentProductId) {
        // Atualiza o hash para a rota de edição do produto recém-criado
        window.history.replaceState(null, '', `#/produtos/${currentProductId}`);
      }
    } catch (err) {
      if (err?.isConflict) {
        const shouldOverwrite = await confirmAction({
          title: 'Edição concorrente detectada',
          message:
            'Este produto foi alterado por outro usuário (ou em outra aba) enquanto você editava. Deseja sobrescrever as alterações remotas ou descartar e recarregar a versão mais recente?',
          confirmLabel: 'Sobrescrever mesmo assim',
          cancelLabel: 'Recarregar mais recente',
        });
        if (shouldOverwrite) {
          isSavingNow = false;
          await performSave({ stayOnPage, forceOverwrite: true });
          return;
        } else {
          clearDraftStorage();
          context.navigate('#/produtos');
          return;
        }
      }
      if (err?.isDeleted) {
        clearDraftStorage();
        showToast('Este produto foi removido em outra aba ou sessão.', 'warning');
        context.navigate('#/produtos');
        return;
      }
      const normalized = normalizeSupabaseError(err, 'Não foi possível salvar o produto');
      showToast(normalized.userMessage, 'error');
    } finally {
      isSavingNow = false;
      progressWrap.hidden = true;
      setButtonLoading(btnSaveAndBack, false, 'Salvando...', 'Salvar Produto');
      setButtonLoading(
        btnSaveAndContinue,
        false,
        'Salvando...',
        'Salvar e continuar',
        'fa-solid fa-floppy-disk'
      );
    }
  }

  // Atalho global Ctrl/Cmd + S enquanto estiver nesta view
  const onKeyDownSave = (/** @type {KeyboardEvent} */ e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      performSave({ stayOnPage: true });
    }
  };
  window.addEventListener('keydown', onKeyDownSave);

  // Alternador Mobile/Tablet entre "Formulário" e "Preview ao Vivo"
  const mobileModeBar = el('div', { className: 'mobile-editor-preview-switcher' }, [
    el(
      'button',
      {
        type: 'button',
        className: 'btn btn-secondary btn-sm is-active',
        onClick: (/** @type {MouseEvent} */ e) => {
          workspaceLayout.classList.remove('show-mobile-preview');
          const parent = /** @type {HTMLElement} */ (e.currentTarget).parentElement;
          parent?.querySelectorAll('button').forEach((b) => b.classList.remove('is-active'));
          /** @type {HTMLElement} */ (e.currentTarget).classList.add('is-active');
        },
      },
      [createIcon('fa-solid fa-pen'), el('span', { textContent: 'Editar Campos' })]
    ),
    el(
      'button',
      {
        type: 'button',
        className: 'btn btn-secondary btn-sm',
        onClick: (/** @type {MouseEvent} */ e) => {
          workspaceLayout.classList.add('show-mobile-preview');
          const parent = /** @type {HTMLElement} */ (e.currentTarget).parentElement;
          parent?.querySelectorAll('button').forEach((b) => b.classList.remove('is-active'));
          /** @type {HTMLElement} */ (e.currentTarget).classList.add('is-active');
          livePreview.refreshScale();
        },
      },
      [createIcon('fa-regular fa-eye'), el('span', { textContent: 'Ver Preview ao Vivo' })]
    ),
  ]);

  const formColumn = el('div', { className: 'product-editor-column admin-panel' }, [
    draftBanner,
    el('div', { className: 'admin-panel__header' }, [
      el('div', {}, [
        el('span', { className: 'admin-panel__eyebrow' }, [
          createIcon('fa-solid fa-mortar-pestle'),
          el('span', {
            textContent: isEditing ? ' Editando Fórmula' : ' Cadastro de Nova Fórmula',
          }),
        ]),
        el('h2', {
          className: 'admin-panel__title',
          textContent: isEditing ? editingProduct.name : 'Novo Produto',
        }),
      ]),
      el(
        'a',
        { href: '#/produtos', className: 'btn btn-secondary btn-sm' },
        [createIcon('fa-solid fa-arrow-left'), el('span', { textContent: 'Voltar para lista' })]
      ),
    ]),
    tabsNav,
    el(
      'form',
      {
        id: 'product-form',
        className: 'admin-form',
        novalidate: true,
        onSubmit: (/** @type {SubmitEvent} */ e) => {
          e.preventDefault();
          performSave({ stayOnPage: false });
        },
      },
      [tabPanels.basico, tabPanels.conteudo, tabPanels.whatsapp, tabPanels.seo]
    ),
  ]);

  const stickyFooterBar = el('div', { className: 'product-sticky-footer' }, [
    el('div', { className: 'product-sticky-footer__status' }, [
      dirtyBadge,
      el('span', {
        className: 'product-sticky-footer__shortcut',
        textContent: 'Dica: pressione Ctrl+S para salvar sem sair',
      }),
    ]),
    el('div', { className: 'product-sticky-footer__actions' }, [
      btnCancel,
      btnSaveAndContinue,
      btnSaveAndBack,
    ]),
  ]);

  const workspaceLayout = el('div', { className: 'product-editor-split-layout' }, [
    formColumn,
    livePreview.element,
  ]);

  container.replaceChildren(
    el('div', { className: 'product-form-page-wrap' }, [
      mobileModeBar,
      workspaceLayout,
      stickyFooterBar,
    ])
  );

  // Verifica se há rascunho salvo em localStorage
  checkDraftBanner();

  // Conclui inicialização e envia carga inicial para o preview
  isInitializing = false;
  syncLivePreviewAndSeo();

  // Sincronização da barra fixa de ações com o teclado virtual no mobile via visualViewport
  /** @type {(() => void) | null} */
  let cleanupVisualViewport = null;
  if (typeof window !== 'undefined' && window.visualViewport) {
    const handleViewportChange = () => {
      if (!window.visualViewport) return;
      const offset = Math.max(0, window.innerHeight - window.visualViewport.height - window.visualViewport.offsetTop);
      stickyFooterBar.style.bottom = `${offset}px`;
    };
    window.visualViewport.addEventListener('resize', handleViewportChange);
    window.visualViewport.addEventListener('scroll', handleViewportChange);
    cleanupVisualViewport = () => {
      window.visualViewport?.removeEventListener('resize', handleViewportChange);
      window.visualViewport?.removeEventListener('scroll', handleViewportChange);
    };
  }

  return () => {
    if (draftDebounceTimer) clearTimeout(draftDebounceTimer);
    window.removeEventListener('keydown', onKeyDownSave);
    if (cleanupVisualViewport) cleanupVisualViewport();
    revokePreviewBlob();
    livePreview.destroy();
  };
}

