// @ts-check
/**
 * View: Gestão de Categorias (`#/categorias`)
 * CRUD completo com geração automática de slug, ordenação e contagem de produtos vinculados.
 */

import { normalizeSupabaseError } from '../../supabaseClient.js';
import { createCategoryIconElement } from '../../shared/categoryIcons.js';
import { state } from '../state.js';
import { saveCategory, deleteCategoryById } from '../api.js';
import {
  el,
  createIcon,
  generateSlug,
  showToast,
  confirmAction,
  setButtonLoading,
  createEmptyState,
} from '../ui.js';

/**
 * Renderiza a view de gerenciamento de categorias.
 * @param {HTMLElement} container
 */
export function renderCategoriesView(container) {
  let editingId = '';

  const idInput = /** @type {HTMLInputElement} */ (el('input', { type: 'hidden', id: 'cat-id' }));
  const nameInput = /** @type {HTMLInputElement} */ (
    el('input', {
      type: 'text',
      id: 'cat-name',
      className: 'form-control',
      placeholder: 'Ex: Saúde & Bem-Estar',
      required: true,
      maxlength: '120',
    })
  );
  const slugInput = /** @type {HTMLInputElement} */ (
    el('input', {
      type: 'text',
      id: 'cat-slug',
      className: 'form-control form-control--readonly',
      placeholder: 'saude-bem-estar',
      readonly: true,
      tabindex: '-1',
    })
  );
  const orderInput = /** @type {HTMLInputElement} */ (
    el('input', {
      type: 'number',
      id: 'cat-order',
      className: 'form-control',
      min: '0',
      step: '1',
      value: '0',
      required: true,
    })
  );
  const activeCheckbox = /** @type {HTMLInputElement} */ (
    el('input', {
      type: 'checkbox',
      id: 'cat-active',
      className: 'toggle-switch',
      checked: true,
    })
  );

  const formTitleEl = el('h2', {
    className: 'admin-panel__title',
    textContent: 'Nova Categoria',
  });

  const saveBtn = /** @type {HTMLButtonElement} */ (
    el(
      'button',
      { type: 'submit', id: 'btn-save-cat', className: 'btn btn-primary' },
      [createIcon('fa-solid fa-check'), el('span', { textContent: 'Salvar Categoria' })]
    )
  );

  const cancelBtn = /** @type {HTMLButtonElement} */ (
    el(
      'button',
      {
        type: 'button',
        id: 'btn-cancel-cat',
        className: 'btn btn-secondary',
        hidden: true,
        onClick: () => resetForm(),
      },
      [createIcon('fa-solid fa-xmark'), el('span', { textContent: 'Cancelar Edição' })]
    )
  );

  nameInput.addEventListener('input', () => {
    slugInput.value = generateSlug(nameInput.value);
  });

  function resetForm() {
    editingId = '';
    idInput.value = '';
    nameInput.value = '';
    slugInput.value = '';
    orderInput.value = '0';
    activeCheckbox.checked = true;
    cancelBtn.hidden = true;
    formTitleEl.textContent = 'Nova Categoria';
    setButtonLoading(saveBtn, false, 'Salvando...', 'Salvar Categoria');
  }

  function startEdit(/** @type {any} */ cat) {
    editingId = cat.id;
    idInput.value = cat.id;
    nameInput.value = cat.name || '';
    slugInput.value = cat.slug || generateSlug(cat.name || '');
    orderInput.value = String(cat.display_order ?? 0);
    activeCheckbox.checked = Boolean(cat.is_active);
    cancelBtn.hidden = false;
    formTitleEl.textContent = `Editando: ${cat.name}`;
    setButtonLoading(saveBtn, false, 'Atualizando...', 'Atualizar Categoria');
    nameInput.focus();
  }

  const formEl = el(
    'form',
    {
      id: 'category-form',
      className: 'admin-form',
      novalidate: true,
      onSubmit: async (/** @type {SubmitEvent} */ e) => {
        e.preventDefault();
        const name = nameInput.value.trim();
        const slug = generateSlug(slugInput.value || name);
        const display_order = Math.max(0, Number.parseInt(orderInput.value || '0', 10) || 0);
        const is_active = Boolean(activeCheckbox.checked);

        if (!name || !slug) {
          showToast('Informe um nome válido para a categoria.', 'warning');
          nameInput.focus();
          return;
        }

        const isEditing = Boolean(editingId);
        setButtonLoading(
          saveBtn,
          true,
          isEditing ? 'Atualizando...' : 'Salvando...',
          isEditing ? 'Atualizar Categoria' : 'Salvar Categoria'
        );

        try {
          await saveCategory({ name, slug, display_order, is_active }, editingId);
          showToast(
            isEditing ? 'Categoria atualizada com sucesso!' : 'Categoria criada com sucesso!',
            'success'
          );
          resetForm();
          renderList();
        } catch (err) {
          const normalized = normalizeSupabaseError(err, 'Não foi possível salvar a categoria');
          showToast(normalized.userMessage, 'error');
        } finally {
          setButtonLoading(
            saveBtn,
            false,
            'Salvando...',
            editingId ? 'Atualizar Categoria' : 'Salvar Categoria'
          );
        }
      },
    },
    [
      idInput,
      el('div', { className: 'form-group' }, [
        el('label', { for: 'cat-name', className: 'form-label' }, [
          'Nome da Categoria ',
          el('span', { className: 'required-mark', textContent: '*' }),
        ]),
        nameInput,
      ]),
      el('div', { className: 'form-row form-row--2col' }, [
        el('div', { className: 'form-group' }, [
          el('label', { for: 'cat-slug', className: 'form-label', textContent: 'Slug (URL)' }),
          slugInput,
          el('span', { className: 'form-hint', textContent: 'Gerado automaticamente.' }),
        ]),
        el('div', { className: 'form-group' }, [
          el('label', {
            for: 'cat-order',
            className: 'form-label',
            textContent: 'Ordem de Exibição',
          }),
          orderInput,
          el('span', { className: 'form-hint', textContent: 'Menor número aparece primeiro.' }),
        ]),
      ]),
      el('div', { className: 'form-group toggle-group' }, [
        el('label', { for: 'cat-active', className: 'toggle-card' }, [
          activeCheckbox,
          el('span', { className: 'toggle-content' }, [
            el('strong', { className: 'toggle-title', textContent: 'Categoria Ativa' }),
            el('span', {
              className: 'toggle-desc',
              textContent: 'Exibir abas desta categoria na loja pública',
            }),
          ]),
        ]),
      ]),
      el('div', { className: 'form-actions' }, [saveBtn, cancelBtn]),
    ]
  );

  const listContainer = el('div', { id: 'categories-list', className: 'categories-list' });
  const countBadge = el('span', { className: 'badge badge-muted', textContent: '0' });

  function renderList() {
    countBadge.textContent = `${state.categories.length} categorias`;

    if (state.categories.length === 0) {
      listContainer.replaceChildren(
        createEmptyState({
          icon: 'fa-solid fa-layer-group',
          title: 'Nenhuma categoria cadastrada',
          description: 'Utilize o formulário ao lado para criar a primeira categoria do catálogo.',
        })
      );
      return;
    }

    const items = state.categories.map((cat) => {
      const linkedCount = state.products.filter((p) => p.category_id === cat.id).length;

      return el('div', { className: 'category-item' }, [
        el('div', { className: 'category-item__info' }, [
          el('span', {
            className: 'badge-order',
            title: 'Ordem de exibição',
            textContent: String(cat.display_order ?? 0),
          }),
          el(
            'span',
            { className: 'category-item__icon', 'aria-hidden': 'true' },
            [createCategoryIconElement(cat.name, cat.id)]
          ),
          el('div', { className: 'category-item__text' }, [
            el('strong', { className: 'category-item__name', textContent: cat.name }),
            el('span', {
              className: 'category-item__slug',
              textContent: `/${cat.slug} · ${linkedCount} produto(s)`,
            }),
          ]),
        ]),
        el('div', { className: 'category-item__actions' }, [
          el('span', {
            className: cat.is_active ? 'badge badge-success' : 'badge badge-muted',
            textContent: cat.is_active ? 'Ativa' : 'Oculta',
          }),
          el(
            'button',
            {
              type: 'button',
              className: 'btn btn-secondary btn-icon',
              title: 'Editar categoria',
              'aria-label': `Editar categoria ${cat.name}`,
              onClick: () => startEdit(cat),
            },
            [createIcon('fa-regular fa-pen-to-square')]
          ),
          el(
            'button',
            {
              type: 'button',
              className: 'btn btn-danger btn-icon',
              title: 'Excluir categoria',
              'aria-label': `Excluir categoria ${cat.name}`,
              onClick: async () => {
                const warningDetail =
                  linkedCount > 0
                    ? ` Atenção: existem ${linkedCount} produto(s) vinculados a "${cat.name}".`
                    : '';
                const confirmed = await confirmAction({
                  title: 'Excluir categoria',
                  message: `Deseja realmente excluir a categoria "${cat.name}"?${warningDetail}`,
                  confirmLabel: 'Confirmar Exclusão',
                });
                if (!confirmed) return;

                try {
                  await deleteCategoryById(cat.id);
                  if (editingId === cat.id) resetForm();
                  showToast(`Categoria "${cat.name}" excluída com sucesso.`, 'success');
                  renderList();
                } catch (err) {
                  const normalized = normalizeSupabaseError(err, 'Erro ao excluir categoria');
                  showToast(normalized.userMessage, 'error');
                }
              },
            },
            [createIcon('fa-regular fa-trash-can')]
          ),
        ]),
      ]);
    });

    listContainer.replaceChildren(...items);
  }

  renderList();

  const layout = el('div', { className: 'admin-workspace-grid' }, [
    el('section', { className: 'admin-panel' }, [
      el('div', { className: 'admin-panel__header' }, [
        el('div', {}, [
          el('span', { className: 'admin-panel__eyebrow' }, [
            createIcon('fa-solid fa-layer-group'),
            el('span', { textContent: ' Estrutura da Vitrine' }),
          ]),
          formTitleEl,
        ]),
      ]),
      formEl,
    ]),
    el('section', { className: 'admin-panel' }, [
      el('div', { className: 'admin-panel__header' }, [
        el('div', {}, [
          el('span', { className: 'admin-panel__eyebrow' }, [
            createIcon('fa-solid fa-list-ol'),
            el('span', { textContent: ' Categorias Cadastradas' }),
          ]),
          el('h2', { className: 'admin-panel__title', textContent: 'Ordem na Loja Pública' }),
        ]),
        countBadge,
      ]),
      listContainer,
    ]),
  ]);

  container.replaceChildren(layout);
}

