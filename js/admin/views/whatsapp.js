// @ts-check
/**
 * View: Personalização de Mensagens do WhatsApp (`#/whatsapp`)
 * Gerencia o Modelo Geral da Loja (`site_settings`) e as mensagens exclusivas por produto,
 * com pílulas de variáveis, atalhos `*negrito*` / `_itálico_` e preview do balão do WhatsApp.
 */

import { normalizeSupabaseError } from '../../supabaseClient.js';
import {
  DEFAULT_PRODUCT_MESSAGE_TEMPLATE,
  interpolateProductMessage,
} from '../../whatsapp.js';
import { state, setState } from '../state.js';
import { saveWhatsAppConfiguration } from '../api.js';
import { insertPlainTextSnippet } from '../editor.js';
import {
  el,
  createIcon,
  showToast,
  confirmAction,
  setButtonLoading,
} from '../ui.js';

const MAX_WA_CHARS = 1000;

/**
 * Obtém um produto para alimentar o balão de pré-visualização.
 * Caso não haja produtos reais no banco, retorna um item claramente marcado como "Exemplo".
 */
function getPreviewSampleProduct() {
  if (state.whatsappScope && state.whatsappScope !== '__global__') {
    const prod = state.products.find((p) => p.id === state.whatsappScope);
    if (prod) return prod;
  }

  if (state.products.length > 0) {
    const idx = Math.abs(state.selectedSampleIndex) % state.products.length;
    return state.products[idx];
  }

  return {
    id: 'exemplo-01',
    name: 'Exemplo — Composto Calmante Natural',
    category_name: 'Exemplo de Categoria',
    categories: { name: 'Exemplo de Categoria' },
    price: 0,
    sku_ref: 'REF: EXEMPLO-01',
  };
}

/**
 * Renderiza a view do editor de mensagens do WhatsApp.
 * @param {HTMLElement} container
 */
export function renderWhatsAppView(container) {
  const scopeSelect = /** @type {HTMLSelectElement} */ (
    el('select', {
      id: 'whatsapp-scope-select',
      className: 'form-control form-select wa-scope-select',
    })
  );

  const statusBanner = el('div', { className: 'wa-scope-status-banner' });

  const textarea = /** @type {HTMLTextAreaElement} */ (
    el('textarea', {
      id: 'whatsapp-template-text',
      className: 'form-control form-textarea whatsapp-textarea',
      rows: '6',
      maxlength: String(MAX_WA_CHARS),
      placeholder:
        'Ex: Olá! Gostaria de comprar o produto *{produto}* ({preco}) que vi no site da Botica Natural...',
    })
  );

  const charCounter = el('span', {
    className: 'char-counter',
    textContent: `0 / ${MAX_WA_CHARS} caracteres`,
  });

  const bubbleText = el('p', {
    id: 'whatsapp-preview-bubble-text',
    className: 'wa-bubble__text',
  });

  const saveBtn = /** @type {HTMLButtonElement} */ (
    el(
      'button',
      { type: 'submit', id: 'btn-save-whatsapp', className: 'btn btn-primary' },
      [createIcon('fa-solid fa-floppy-disk'), el('span', { textContent: 'Salvar Modelo Geral' })]
    )
  );

  const restoreBtn = /** @type {HTMLButtonElement} */ (
    el(
      'button',
      { type: 'button', id: 'btn-restore-whatsapp', className: 'btn btn-secondary' },
      [createIcon('fa-solid fa-rotate-left'), el('span', { textContent: 'Restaurar Padrão' })]
    )
  );

  const cycleSampleBtn = /** @type {HTMLButtonElement} */ (
    el(
      'button',
      {
        type: 'button',
        id: 'btn-cycle-preview-prod',
        className: 'btn btn-secondary btn-sm',
        onClick: () => {
          setState({ selectedSampleIndex: state.selectedSampleIndex + 1 });
          syncPreviewBubble();
          const current = getPreviewSampleProduct();
          showToast(`Simulando com: "${current.name}"`, 'info');
        },
      },
      [createIcon('fa-solid fa-shuffle'), el('span', { textContent: 'Trocar Produto de Exemplo' })]
    )
  );

  // Barra de variáveis + formatação nativa do WhatsApp (*negrito*, _itálico_)
  const variables = [
    { tag: '{produto}', label: 'Nome do Produto' },
    { tag: '{categoria}', label: 'Categoria' },
    { tag: '{preco}', label: 'Preço (R$)' },
    { tag: '{link}', label: 'Link da Página' },
    { tag: '{sku}', label: 'Código REF' },
  ];

  const pillsToolbar = el('div', { className: 'variables-toolbar' }, [
    el('span', {
      className: 'variables-toolbar__label',
      textContent: 'Inserir variáveis dinâmicas e formatação WhatsApp:',
    }),
    el('div', { className: 'variables-toolbar__pills' }, [
      ...variables.map((v) =>
        el(
          'button',
          {
            type: 'button',
            className: 'var-pill-btn',
            onClick: () => insertPlainTextSnippet(textarea, v.tag),
          },
          [
            createIcon('fa-solid fa-plus'),
            el('span', { textContent: v.label }),
            el('code', { textContent: v.tag }),
          ]
        )
      ),
      el(
        'button',
        {
          type: 'button',
          className: 'var-pill-btn',
          title: 'Negrito no WhatsApp (*texto*)',
          onClick: () => insertPlainTextSnippet(textarea, '*', { wrap: true }),
        },
        [createIcon('fa-solid fa-bold'), el('code', { textContent: '*negrito*' })]
      ),
      el(
        'button',
        {
          type: 'button',
          className: 'var-pill-btn',
          title: 'Itálico no WhatsApp (_texto_)',
          onClick: () => insertPlainTextSnippet(textarea, '_', { wrap: true }),
        },
        [createIcon('fa-solid fa-italic'), el('code', { textContent: '_itálico_' })]
      ),
    ]),
  ]);

  function populateScopeOptions() {
    const globalOpt = el('option', {
      value: '__global__',
      textContent: '🌐 Modelo Geral da Loja (Padrão para todos os produtos)',
    });

    const optgroup = el('optgroup', {
      label: '📦 Mensagem Exclusiva por Produto Individual',
    });

    const sorted = [...state.products].sort((a, b) =>
      String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR')
    );

    sorted.forEach((prod) => {
      const hasCustom = Boolean(prod.whatsapp_message && prod.whatsapp_message.trim() !== '');
      optgroup.appendChild(
        el('option', {
          value: prod.id,
          textContent: `${hasCustom ? '★ [Personalizado] ' : ''}${prod.name}`,
        })
      );
    });

    scopeSelect.replaceChildren(globalOpt, optgroup);
    scopeSelect.value = state.whatsappScope || '__global__';
  }

  function syncScopeUI() {
    const scope = scopeSelect.value || '__global__';
    setState({ whatsappScope: scope });

    const globalTemplate = state.whatsappTemplate || DEFAULT_PRODUCT_MESSAGE_TEMPLATE;

    if (scope === '__global__') {
      textarea.value = globalTemplate;
      statusBanner.className = 'wa-scope-status-banner';
      statusBanner.replaceChildren(
        createIcon('fa-solid fa-circle-info'),
        el('span', {
          textContent:
            'Editando o Modelo Geral: todos os produtos sem mensagem exclusiva usarão este texto.',
        })
      );
      setButtonLoading(saveBtn, false, 'Salvando...', 'Salvar Modelo Geral', 'fa-solid fa-floppy-disk');
      restoreBtn.replaceChildren(
        createIcon('fa-solid fa-rotate-left'),
        el('span', { textContent: 'Restaurar Padrão' })
      );
      cycleSampleBtn.hidden = false;
    } else {
      const product = state.products.find((p) => p.id === scope);
      const customMsg = product?.whatsapp_message ? product.whatsapp_message.trim() : '';
      textarea.value = customMsg || globalTemplate;

      statusBanner.className = customMsg
        ? 'wa-scope-status-banner wa-scope-status-banner--custom'
        : 'wa-scope-status-banner';
      statusBanner.replaceChildren(
        createIcon(customMsg ? 'fa-solid fa-star' : 'fa-solid fa-circle-info'),
        el('span', {
          textContent: customMsg
            ? `Editando Mensagem Exclusiva de "${product?.name || 'Produto'}".`
            : `"${product?.name || 'Produto'}" usa o Modelo Geral. Salve abaixo para criar uma mensagem exclusiva.`,
        })
      );
      setButtonLoading(
        saveBtn,
        false,
        'Salvando...',
        'Salvar Mensagem do Produto',
        'fa-solid fa-floppy-disk'
      );
      restoreBtn.replaceChildren(
        createIcon('fa-solid fa-link-slash'),
        el('span', { textContent: 'Usar Modelo Geral (Remover Exclusiva)' })
      );
      cycleSampleBtn.hidden = true;
    }

    syncPreviewBubble();
  }

  function syncPreviewBubble() {
    const raw = textarea.value || '';
    const len = raw.length;
    charCounter.textContent = `${len} / ${MAX_WA_CHARS} caracteres`;
    charCounter.classList.toggle('is-warning', len >= 850 && len < MAX_WA_CHARS);
    charCounter.classList.toggle('is-danger', len >= MAX_WA_CHARS);

    const sampleProduct = getPreviewSampleProduct();
    const interpolated = interpolateProductMessage(raw || DEFAULT_PRODUCT_MESSAGE_TEMPLATE, sampleProduct);
    bubbleText.textContent = interpolated;
  }

  scopeSelect.addEventListener('change', syncScopeUI);
  textarea.addEventListener('input', syncPreviewBubble);

  restoreBtn.addEventListener('click', async () => {
    if (state.whatsappScope === '__global__') {
      const confirmed = await confirmAction({
        title: 'Restaurar Modelo Padrão Geral',
        message:
          'Deseja restaurar o modelo padrão original da Botica Natural no editor? Clique em Salvar em seguida para aplicar.',
        confirmLabel: 'Restaurar Modelo',
        variant: 'primary',
      });
      if (!confirmed) return;
      textarea.value = DEFAULT_PRODUCT_MESSAGE_TEMPLATE;
      syncPreviewBubble();
      showToast('Modelo padrão restaurado no editor. Clique em Salvar para gravar.', 'info');
    } else {
      const prod = state.products.find((p) => p.id === state.whatsappScope);
      const confirmed = await confirmAction({
        title: 'Remover Mensagem Exclusiva',
        message: `Deseja remover a mensagem exclusiva de "${prod?.name || 'este produto'}" para que ele volte a usar o Modelo Geral da loja?`,
        confirmLabel: 'Remover Exclusiva',
      });
      if (!confirmed) return;

      try {
        await saveWhatsAppConfiguration({
          scope: state.whatsappScope,
          templateText: '',
          adminEmail: state.userEmail || 'admin',
        });
        populateScopeOptions();
        syncScopeUI();
        showToast('Mensagem exclusiva removida. O produto agora herda o Modelo Geral.', 'success');
      } catch (err) {
        const normalized = normalizeSupabaseError(err, 'Erro ao remover mensagem exclusiva');
        showToast(normalized.userMessage, 'error');
      }
    }
  });

  const formEl = el(
    'form',
    {
      id: 'whatsapp-settings-form',
      className: 'admin-form',
      novalidate: true,
      onSubmit: async (/** @type {SubmitEvent} */ e) => {
        e.preventDefault();
        const text = textarea.value.trim();
        if (!text) {
          showToast('A mensagem do WhatsApp não pode ficar vazia.', 'warning');
          textarea.focus();
          return;
        }

        const isGlobal = state.whatsappScope === '__global__';
        setButtonLoading(
          saveBtn,
          true,
          'Salvando...',
          isGlobal ? 'Salvar Modelo Geral' : 'Salvar Mensagem do Produto'
        );

        try {
          await saveWhatsAppConfiguration({
            scope: state.whatsappScope,
            templateText: text,
            adminEmail: state.userEmail || 'admin',
          });
          populateScopeOptions();
          syncScopeUI();
          showToast(
            isGlobal
              ? 'Modelo Geral do WhatsApp salvo com sucesso!'
              : 'Mensagem exclusiva do produto salva com sucesso!',
            'success'
          );
        } catch (err) {
          const normalized = normalizeSupabaseError(err, 'Não foi possível salvar a mensagem');
          showToast(normalized.userMessage, 'error');
        } finally {
          setButtonLoading(
            saveBtn,
            false,
            'Salvando...',
            isGlobal ? 'Salvar Modelo Geral' : 'Salvar Mensagem do Produto',
            'fa-solid fa-floppy-disk'
          );
        }
      },
    },
    [
      el('div', { className: 'wa-scope-selector-card' }, [
        el('label', {
          for: 'whatsapp-scope-select',
          className: 'form-label wa-scope-label',
        }, [
          createIcon('fa-solid fa-sliders'),
          el('span', { textContent: 'Escopo da Mensagem:' }),
        ]),
        scopeSelect,
        statusBanner,
      ]),
      pillsToolbar,
      el('div', { className: 'form-group' }, [
        el('label', {
          for: 'whatsapp-template-text',
          className: 'form-label',
          textContent: 'Texto da Mensagem Automática (Texto puro com variáveis)',
        }),
        textarea,
        el('div', { className: 'editor-meta-row' }, [
          el('span', {
            className: 'form-hint',
            textContent: 'Quebras de linha e emojis são preservados automaticamente.',
          }),
          charCounter,
        ]),
      ]),
      el('div', { className: 'form-actions' }, [saveBtn, restoreBtn]),
    ]
  );

  // Coluna direita: Mockup de conversa do WhatsApp
  const previewCol = el('div', { className: 'whatsapp-preview-column' }, [
    el('div', { className: 'preview-header-row' }, [
      el('span', {
        className: 'form-label',
        textContent: 'Pré-visualização em Tempo Real (WhatsApp)',
      }),
      cycleSampleBtn,
    ]),
    el('div', { className: 'wa-mockup-card' }, [
      el('div', { className: 'wa-mockup-header' }, [
        el('div', { className: 'wa-mockup-avatar' }, [
          el('img', {
            src: 'images/logo.jpg',
            alt: 'Botica Natural',
            width: '38',
            height: '38',
          }),
        ]),
        el('div', { className: 'wa-mockup-info' }, [
          el('strong', { className: 'wa-mockup-name', textContent: 'Botica Natural — Atendimento' }),
          el('span', { className: 'wa-mockup-status' }, [
            createIcon('fa-solid fa-circle wa-status-dot'),
            el('span', { textContent: 'Online no WhatsApp' }),
          ]),
        ]),
      ]),
      el('div', { className: 'wa-mockup-body' }, [
        el('div', { className: 'wa-bubble-wrap' }, [
          el('div', { className: 'wa-bubble' }, [
            bubbleText,
            el('div', { className: 'wa-bubble__meta' }, [
              el('span', { className: 'wa-bubble__time', textContent: 'Agora' }),
              createIcon('fa-solid fa-check-double wa-bubble__ticks'),
            ]),
          ]),
        ]),
      ]),
      el('div', { className: 'wa-mockup-footer' }, [
        createIcon('fa-solid fa-shield-halved'),
        el('span', {
          textContent:
            'Codificação URL-safe automática ao abrir wa.me no celular ou WhatsApp Web.',
        }),
      ]),
    ]),
  ]);

  populateScopeOptions();
  syncScopeUI();

  const panel = el('section', { className: 'admin-panel admin-panel--whatsapp' }, [
    el('div', { className: 'admin-panel__header' }, [
      el('div', {}, [
        el('span', { className: 'admin-panel__eyebrow' }, [
          createIcon('fa-brands fa-whatsapp'),
          el('span', { textContent: ' Conversão Comercial' }),
        ]),
        el('h2', {
          className: 'admin-panel__title',
          textContent: 'Mensagens Automáticas de Compra no WhatsApp',
        }),
      ]),
    ]),
    el('div', { className: 'whatsapp-editor-layout' }, [
      el('div', { className: 'whatsapp-editor-column' }, [formEl]),
      previewCol,
    ]),
  ]);

  container.replaceChildren(panel);
}

