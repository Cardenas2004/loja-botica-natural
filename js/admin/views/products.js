// @ts-check
/**
 * View: Listagem de Produtos (`#/produtos`)
 * Tabela responsiva (cards no mobile), busca com debounce, filtros, ordenação,
 * paginação, ações em linha (editar, duplicar, ativar/desativar, excluir) e seleção em massa.
 */

import { normalizeSupabaseError } from '../../supabaseClient.js';
import { extractPlainText } from '../../shared/richtext.js';
import { state, setState } from '../state.js';
import {
  resolveAdminImageUrl,
  duplicateProductRecord,
  toggleProductStatus,
  bulkUpdateProductsStatus,
  deleteProductRecord,
} from '../api.js';
import {
  el,
  createIcon,
  formatBRL,
  debounce,
  showToast,
  confirmAction,
  createEmptyState,
} from '../ui.js';

/**
 * Filtra e ordena os produtos em memória conforme `state.productFilters`.
 * @returns {Array<any>}
 */
function getFilteredAndSortedProducts() {
  const { search, categoryId, status, bestseller, sort } = state.productFilters;
  const term = String(search || '').trim().toLowerCase();

  const filtered = state.products.filter((prod) => {
    const plainShort = extractPlainText(prod.short_description || prod.description || '').toLowerCase();
    const catName = String(prod.categories?.name || '').toLowerCase();
    const sku = String(prod.sku_ref || '').toLowerCase();
    const name = String(prod.name || '').toLowerCase();

    const matchesSearch =
      !term ||
      name.includes(term) ||
      plainShort.includes(term) ||
      sku.includes(term) ||
      catName.includes(term);

    const matchesCategory = categoryId === 'all' || prod.category_id === categoryId;

    const matchesStatus =
      status === 'all' ||
      (status === 'active' && Boolean(prod.is_active)) ||
      (status === 'inactive' && !prod.is_active);

    const matchesBestseller =
      bestseller === 'all' ||
      (bestseller === 'yes' && Boolean(prod.is_best_seller)) ||
      (bestseller === 'no' && !prod.is_best_seller);

    return matchesSearch && matchesCategory && matchesStatus && matchesBestseller;
  });

  filtered.sort((a, b) => {
    if (sort === 'name-asc') {
      return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR');
    }
    if (sort === 'price-asc') {
      return (Number(a.price) || 0) - (Number(b.price) || 0);
    }
    if (sort === 'price-desc') {
      return (Number(b.price) || 0) - (Number(a.price) || 0);
    }
    // 'newest' padrão
    const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
    const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
    return dateB - dateA;
  });

  return filtered;
}

/**
 * Renderiza a view de listagem de produtos.
 * @param {HTMLElement} container
 * @param {{ navigate: (hash: string) => void }} router
 */
export function renderProductsView(container, router) {
  const filters = state.productFilters;

  // Controles de busca, filtro e ordenação
  const searchInput = /** @type {HTMLInputElement} */ (
    el('input', {
      type: 'search',
      id: 'search-products',
      className: 'form-control form-control--with-icon',
      placeholder: 'Buscar por nome, SKU, descrição ou categoria...',
      value: filters.search,
      'aria-label': 'Buscar produtos no catálogo',
    })
  );

  const catSelect = /** @type {HTMLSelectElement} */ (
    el(
      'select',
      {
        id: 'filter-category',
        className: 'form-control form-select',
        'aria-label': 'Filtrar por categoria',
      },
      [
        el('option', { value: 'all', textContent: 'Todas as categorias' }),
        ...state.categories.map((cat) =>
          el('option', { value: cat.id, textContent: cat.name })
        ),
      ]
    )
  );
  catSelect.value = filters.categoryId;

  const statusSelect = /** @type {HTMLSelectElement} */ (
    el(
      'select',
      {
        id: 'filter-status',
        className: 'form-control form-select',
        'aria-label': 'Filtrar por status',
      },
      [
        el('option', { value: 'all', textContent: 'Todos os status' }),
        el('option', { value: 'active', textContent: 'Apenas Ativos' }),
        el('option', { value: 'inactive', textContent: 'Apenas Inativos' }),
      ]
    )
  );
  statusSelect.value = filters.status;

  const bestSelect = /** @type {HTMLSelectElement} */ (
    el(
      'select',
      {
        id: 'filter-bestseller',
        className: 'form-control form-select',
        'aria-label': 'Filtrar mais vendidos',
      },
      [
        el('option', { value: 'all', textContent: 'Todos (Mais vendidos)' }),
        el('option', { value: 'yes', textContent: '★ Mais Vendidos' }),
        el('option', { value: 'no', textContent: 'Comuns' }),
      ]
    )
  );
  bestSelect.value = filters.bestseller;

  const sortSelect = /** @type {HTMLSelectElement} */ (
    el(
      'select',
      {
        id: 'sort-products',
        className: 'form-control form-select',
        'aria-label': 'Ordenar produtos',
      },
      [
        el('option', { value: 'newest', textContent: 'Ordenar: Mais recentes' }),
        el('option', { value: 'name-asc', textContent: 'Ordenar: Nome (A–Z)' }),
        el('option', { value: 'price-asc', textContent: 'Ordenar: Menor preço' }),
        el('option', { value: 'price-desc', textContent: 'Ordenar: Maior preço' }),
      ]
    )
  );
  sortSelect.value = filters.sort;

  // Barra de ações em massa (Bulk Actions)
  const bulkBar = el('div', { className: 'bulk-action-bar', hidden: true });
  const selectAllCheckbox = /** @type {HTMLInputElement} */ (
    el('input', {
      type: 'checkbox',
      className: 'row-checkbox',
      'aria-label': 'Selecionar todos os produtos desta página',
    })
  );

  const tbody = el('tbody', { id: 'products-tbody' });
  const tableWrap = el('div', { className: 'table-responsive' }, [
    el('table', { className: 'admin-table', 'aria-label': 'Catálogo de produtos' }, [
      el('thead', {}, [
        el('tr', {}, [
          el('th', { scope: 'col', className: 'col-check' }, [selectAllCheckbox]),
          el('th', { scope: 'col', className: 'col-thumb', textContent: 'Foto' }),
          el('th', { scope: 'col', textContent: 'Produto' }),
          el('th', { scope: 'col', textContent: 'Categoria' }),
          el('th', { scope: 'col', textContent: 'Preço' }),
          el('th', { scope: 'col', textContent: 'Status' }),
          el('th', { scope: 'col', className: 'col-actions', textContent: 'Ações' }),
        ]),
      ]),
      tbody,
    ]),
  ]);

  const emptyStateSlot = el('div', {});
  const paginationSlot = el('div', { className: 'pagination-bar' });

  function updateBulkBar() {
    const count = state.selectedProductIds.size;
    if (count === 0) {
      bulkBar.hidden = true;
      bulkBar.replaceChildren();
      return;
    }

    bulkBar.hidden = false;
    bulkBar.replaceChildren(
      el('span', {
        className: 'bulk-action-bar__count',
        textContent: `${count} produto(s) selecionado(s)`,
      }),
      el('div', { className: 'bulk-action-bar__actions' }, [
        el(
          'button',
          {
            type: 'button',
            className: 'btn btn-secondary btn-sm',
            onClick: async () => {
              const ids = Array.from(state.selectedProductIds);
              try {
                await bulkUpdateProductsStatus(ids, true);
                state.selectedProductIds.clear();
                showToast(`${ids.length} produto(s) ativado(s) com sucesso!`, 'success');
                renderTableContent();
              } catch (err) {
                const normalized = normalizeSupabaseError(err, 'Erro ao ativar em massa');
                showToast(normalized.userMessage, 'error');
              }
            },
          },
          [createIcon('fa-solid fa-eye'), el('span', { textContent: 'Ativar selecionados' })]
        ),
        el(
          'button',
          {
            type: 'button',
            className: 'btn btn-secondary btn-sm',
            onClick: async () => {
              const ids = Array.from(state.selectedProductIds);
              try {
                await bulkUpdateProductsStatus(ids, false);
                state.selectedProductIds.clear();
                showToast(`${ids.length} produto(s) desativado(s) com sucesso!`, 'success');
                renderTableContent();
              } catch (err) {
                const normalized = normalizeSupabaseError(err, 'Erro ao desativar em massa');
                showToast(normalized.userMessage, 'error');
              }
            },
          },
          [createIcon('fa-solid fa-eye-slash'), el('span', { textContent: 'Desativar selecionados' })]
        ),
        el(
          'button',
          {
            type: 'button',
            className: 'btn btn-secondary btn-sm',
            onClick: () => {
              state.selectedProductIds.clear();
              renderTableContent();
            },
          },
          [createIcon('fa-solid fa-xmark'), el('span', { textContent: 'Limpar seleção' })]
        ),
      ])
    );
  }

  function renderTableContent() {
    const allFiltered = getFilteredAndSortedProducts();
    const totalItems = allFiltered.length;
    const pageSize = filters.pageSize || 12;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    if (filters.page > totalPages) {
      filters.page = totalPages;
    }
    const startIdx = (filters.page - 1) * pageSize;
    const pageItems = allFiltered.slice(startIdx, startIdx + pageSize);

    updateBulkBar();

    if (totalItems === 0) {
      tableWrap.hidden = true;
      paginationSlot.hidden = true;
      const hasActiveFilters =
        filters.search ||
        filters.categoryId !== 'all' ||
        filters.status !== 'all' ||
        filters.bestseller !== 'all';

      emptyStateSlot.replaceChildren(
        createEmptyState({
          icon: hasActiveFilters ? 'fa-solid fa-magnifying-glass' : 'fa-solid fa-box-open',
          title: hasActiveFilters
            ? 'Nenhum produto corresponde aos filtros'
            : 'Nenhum produto cadastrado no catálogo',
          description: hasActiveFilters
            ? 'Tente ajustar o termo de busca ou limpar os filtros selecionados.'
            : 'Cadastre sua primeira fórmula manipulada para exibi-la na vitrine.',
          ctaLabel: hasActiveFilters ? 'Limpar Filtros' : 'Novo Produto',
          onCtaClick: () => {
            if (hasActiveFilters) {
              filters.search = '';
              filters.categoryId = 'all';
              filters.status = 'all';
              filters.bestseller = 'all';
              filters.page = 1;
              searchInput.value = '';
              catSelect.value = 'all';
              statusSelect.value = 'all';
              bestSelect.value = 'all';
              renderTableContent();
            } else {
              router.navigate('#/produtos/novo');
            }
          },
        })
      );
      return;
    }

    tableWrap.hidden = false;
    emptyStateSlot.replaceChildren();

    const allOnPageSelected =
      pageItems.length > 0 && pageItems.every((p) => state.selectedProductIds.has(p.id));
    selectAllCheckbox.checked = allOnPageSelected;
    selectAllCheckbox.onchange = () => {
      if (selectAllCheckbox.checked) {
        pageItems.forEach((p) => state.selectedProductIds.add(p.id));
      } else {
        pageItems.forEach((p) => state.selectedProductIds.delete(p.id));
      }
      renderTableContent();
    };

    const rows = pageItems.map((product) => {
      const isChecked = state.selectedProductIds.has(product.id);
      const rowCheckbox = /** @type {HTMLInputElement} */ (
        el('input', {
          type: 'checkbox',
          className: 'row-checkbox',
          checked: isChecked,
          'aria-label': `Selecionar ${product.name}`,
          onChange: () => {
            if (rowCheckbox.checked) {
              state.selectedProductIds.add(product.id);
            } else {
              state.selectedProductIds.delete(product.id);
            }
            updateBulkBar();
          },
        })
      );

      const plainExcerpt = extractPlainText(
        product.short_description || product.description || ''
      );
      const skuInfo = product.sku_ref ? `[${product.sku_ref}] ` : '';
      const categoryName =
        product.categories?.name ||
        state.categories.find((c) => c.id === product.category_id)?.name ||
        'Sem categoria';

      const statusBadges = [
        el('span', {
          className: product.is_active ? 'badge badge-success' : 'badge badge-muted',
          textContent: product.is_active ? 'Ativo' : 'Inativo',
        }),
      ];

      if (product.is_best_seller) {
        statusBadges.push(
          el('span', { className: 'badge badge-gold' }, [
            createIcon('fa-solid fa-star'),
            el('span', { textContent: 'Mais Vendido' }),
          ])
        );
      }

      if (product.whatsapp_message && product.whatsapp_message.trim() !== '') {
        statusBadges.push(
          el('span', {
            className: 'badge badge-muted',
            title: 'Possui mensagem exclusiva de WhatsApp',
          }, [
            createIcon('fa-brands fa-whatsapp'),
            el('span', { textContent: 'Msg Própria' }),
          ])
        );
      }

      return el('tr', { className: isChecked ? 'is-selected' : '' }, [
        el('td', { className: 'col-check', 'data-label': 'Selecionar' }, [rowCheckbox]),
        el('td', { className: 'col-thumb', 'data-label': 'Foto' }, [
          el('img', {
            className: 'product-thumb',
            src: resolveAdminImageUrl(product),
            alt: `Miniatura de ${product.name}`,
            width: '56',
            height: '56',
            loading: 'lazy',
          }),
        ]),
        el('td', { 'data-label': 'Produto' }, [
          el(
            'a',
            {
              href: `#/produtos/${product.id}`,
              className: 'product-cell-title',
              textContent: product.name,
            }
          ),
          el('span', {
            className: 'product-cell-desc',
            textContent: `${skuInfo}${plainExcerpt || 'Sem descrição cadastrada.'}`,
          }),
        ]),
        el('td', { 'data-label': 'Categoria' }, [
          el('span', { className: 'badge badge-muted', textContent: categoryName }),
        ]),
        el('td', { 'data-label': 'Preço' }, [
          el('span', {
            className: 'product-cell-price',
            textContent: Number(product.price) > 0 ? formatBRL(product.price) : 'Sob consulta',
          }),
        ]),
        el('td', { 'data-label': 'Status' }, [
          el('div', { className: 'status-badges-stack' }, statusBadges),
        ]),
        el('td', { className: 'col-actions', 'data-label': 'Ações' }, [
          el('div', { className: 'table-actions' }, [
            el(
              'button',
              {
                type: 'button',
                className: 'btn btn-secondary btn-icon',
                title: 'Editar produto',
                'aria-label': `Editar produto ${product.name}`,
                onClick: () => router.navigate(`#/produtos/${product.id}`),
              },
              [createIcon('fa-regular fa-pen-to-square')]
            ),
            el(
              'button',
              {
                type: 'button',
                className: 'btn btn-secondary btn-icon',
                title: 'Duplicar produto',
                'aria-label': `Duplicar produto ${product.name}`,
                onClick: async () => {
                  try {
                    const copy = await duplicateProductRecord(product);
                    showToast(
                      `Cópia "${copy?.name || product.name}" criada como inativa!`,
                      'success'
                    );
                    renderTableContent();
                  } catch (err) {
                    const normalized = normalizeSupabaseError(err, 'Erro ao duplicar produto');
                    showToast(normalized.userMessage, 'error');
                  }
                },
              },
              [createIcon('fa-regular fa-copy')]
            ),
            el(
              'button',
              {
                type: 'button',
                className: 'btn btn-secondary btn-icon',
                title: product.is_active ? 'Desativar produto' : 'Ativar produto',
                'aria-label': `${product.is_active ? 'Desativar' : 'Ativar'} produto ${product.name}`,
                onClick: async () => {
                  try {
                    await toggleProductStatus(product.id, !product.is_active);
                    showToast(
                      `Produto "${product.name}" ${!product.is_active ? 'ativado' : 'desativado'}.`,
                      'success'
                    );
                    renderTableContent();
                  } catch (err) {
                    const normalized = normalizeSupabaseError(err, 'Erro ao alterar status');
                    showToast(normalized.userMessage, 'error');
                  }
                },
              },
              [createIcon(product.is_active ? 'fa-solid fa-toggle-on' : 'fa-solid fa-toggle-off')]
            ),
            el(
              'button',
              {
                type: 'button',
                className: 'btn btn-danger btn-icon',
                title: 'Excluir produto',
                'aria-label': `Excluir produto ${product.name}`,
                onClick: async () => {
                  const confirmed = await confirmAction({
                    title: 'Excluir produto',
                    message: `Tem certeza que deseja excluir permanentemente "${product.name}"? Esta ação não poderá ser desfeita.`,
                    confirmLabel: 'Confirmar Exclusão',
                  });
                  if (!confirmed) return;

                  try {
                    await deleteProductRecord(product);
                    state.selectedProductIds.delete(product.id);
                    showToast(`Produto "${product.name}" excluído com sucesso.`, 'success');
                    renderTableContent();
                  } catch (err) {
                    const normalized = normalizeSupabaseError(err, 'Erro ao excluir produto');
                    showToast(normalized.userMessage, 'error');
                  }
                },
              },
              [createIcon('fa-regular fa-trash-can')]
            ),
          ]),
        ]),
      ]);
    });

    tbody.replaceChildren(...rows);

    // Paginação
    paginationSlot.hidden = totalPages <= 1;
    if (totalPages > 1) {
      paginationSlot.replaceChildren(
        el('span', {
          className: 'pagination-bar__info',
          textContent: `Exibindo ${startIdx + 1}–${Math.min(startIdx + pageSize, totalItems)} de ${totalItems} produtos`,
        }),
        el('div', { className: 'pagination-bar__controls' }, [
          el(
            'button',
            {
              type: 'button',
              className: 'btn btn-secondary btn-sm',
              disabled: filters.page <= 1,
              onClick: () => {
                filters.page -= 1;
                renderTableContent();
              },
            },
            [createIcon('fa-solid fa-chevron-left'), el('span', { textContent: 'Anterior' })]
          ),
          el('span', {
            className: 'pagination-bar__page',
            textContent: `Página ${filters.page} de ${totalPages}`,
          }),
          el(
            'button',
            {
              type: 'button',
              className: 'btn btn-secondary btn-sm',
              disabled: filters.page >= totalPages,
              onClick: () => {
                filters.page += 1;
                renderTableContent();
              },
            },
            [el('span', { textContent: 'Próxima' }), createIcon('fa-solid fa-chevron-right')]
          ),
        ])
      );
    }
  }

  // Eventos de busca e filtros
  const onDebouncedSearch = debounce((/** @type {string} */ val) => {
    filters.search = val;
    filters.page = 1;
    renderTableContent();
  }, 200);

  searchInput.addEventListener('input', () => onDebouncedSearch(searchInput.value));
  catSelect.addEventListener('change', () => {
    filters.categoryId = catSelect.value;
    filters.page = 1;
    renderTableContent();
  });
  statusSelect.addEventListener('change', () => {
    filters.status = statusSelect.value;
    filters.page = 1;
    renderTableContent();
  });
  bestSelect.addEventListener('change', () => {
    filters.bestseller = bestSelect.value;
    filters.page = 1;
    renderTableContent();
  });
  sortSelect.addEventListener('change', () => {
    filters.sort = sortSelect.value;
    filters.page = 1;
    renderTableContent();
  });

  renderTableContent();

  const panel = el('section', { className: 'admin-panel' }, [
    el('div', { className: 'admin-panel__header' }, [
      el('div', {}, [
        el('span', { className: 'admin-panel__eyebrow' }, [
          createIcon('fa-solid fa-table-list'),
          el('span', { textContent: ' Inventário de Fórmulas' }),
        ]),
        el('h2', { className: 'admin-panel__title', textContent: 'Produtos Cadastrados' }),
      ]),
      el(
        'button',
        {
          type: 'button',
          className: 'btn btn-primary',
          onClick: () => router.navigate('#/produtos/novo'),
        },
        [createIcon('fa-solid fa-plus'), el('span', { textContent: 'Novo Produto' })]
      ),
    ]),
    el('div', { className: 'catalog-toolbar' }, [
      el('div', { className: 'catalog-toolbar__search' }, [
        createIcon('fa-solid fa-magnifying-glass catalog-toolbar__search-icon'),
        searchInput,
      ]),
      el('div', { className: 'catalog-toolbar__filters' }, [
        catSelect,
        statusSelect,
        bestSelect,
        sortSelect,
      ]),
    ]),
    bulkBar,
    tableWrap,
    emptyStateSlot,
    paginationSlot,
  ]);

  container.replaceChildren(panel);
}

