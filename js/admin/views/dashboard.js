// @ts-check
/**
 * View: Dashboard Inicial (`#/`)
 * Exibe cartões de métricas reais, atalhos de ação rápida e últimos itens editados.
 */

import { state } from '../state.js';
import { el, createIcon, formatBRL, formatDateShort, createEmptyState } from '../ui.js';
import { resolveAdminImageUrl } from '../api.js';

/**
 * Renderiza a tela inicial do painel administrativo.
 * @param {HTMLElement} container
 * @param {{ navigate: (hash: string) => void }} router
 */
export function renderDashboardView(container, router) {
  const totalProducts = state.products.length;
  const activeProducts = state.products.filter((p) => p.is_active).length;
  const inactiveProducts = totalProducts - activeProducts;
  const bestSellers = state.products.filter((p) => p.is_best_seller).length;
  const activeCategories = state.categories.filter((c) => c.is_active).length;
  const activeBanners = state.carouselSlides.filter((s) => s.is_active).length;

  // 1. Cartões de KPIs (apenas dados reais do banco)
  const kpiCards = [
    {
      label: 'Produtos Ativos / Inativos',
      value: `${activeProducts} / ${inactiveProducts}`,
      sub: `${totalProducts} cadastrados no total`,
      icon: 'fa-solid fa-capsules',
      tone: 'primary',
      hash: '#/produtos',
    },
    {
      label: 'Mais Vendidos',
      value: String(bestSellers),
      sub: 'Em destaque na vitrine',
      icon: 'fa-solid fa-star',
      tone: 'gold',
      hash: '#/produtos',
    },
    {
      label: 'Categorias Ativas',
      value: String(activeCategories),
      sub: `${state.categories.length} categorias no total`,
      icon: 'fa-solid fa-layer-group',
      tone: 'accent',
      hash: '#/categorias',
    },
    {
      label: 'Banners Ativos',
      value: String(activeBanners),
      sub: `${state.carouselSlides.length} slides no carrossel`,
      icon: 'fa-solid fa-images',
      tone: 'success',
      hash: '#/banners',
    },
  ];

  const kpiGrid = el(
    'section',
    { className: 'kpi-grid', 'aria-label': 'Resumo do catálogo' },
    kpiCards.map((kpi) =>
      el(
        'a',
        {
          href: kpi.hash,
          className: 'kpi-card kpi-card--interactive',
        },
        [
          el(
            'div',
            { className: `kpi-card__icon kpi-card__icon--${kpi.tone}`, 'aria-hidden': 'true' },
            [createIcon(kpi.icon)]
          ),
          el('div', { className: 'kpi-card__content' }, [
            el('span', { className: 'kpi-card__label', textContent: kpi.label }),
            el('strong', { className: 'kpi-card__value', textContent: kpi.value }),
            el('span', { className: 'kpi-card__sub', textContent: kpi.sub }),
          ]),
        ]
      )
    )
  );

  // 2. Atalhos de Ação Rápida
  const quickActions = el('section', { className: 'admin-panel' }, [
    el('div', { className: 'admin-panel__header' }, [
      el('div', {}, [
        el('span', { className: 'admin-panel__eyebrow' }, [
          createIcon('fa-solid fa-bolt'),
          el('span', { textContent: 'Acesso Rápido' }),
        ]),
        el('h2', { className: 'admin-panel__title', textContent: 'O que você deseja fazer agora?' }),
      ]),
    ]),
    el('div', { className: 'quick-actions-grid' }, [
      el(
        'button',
        {
          type: 'button',
          className: 'quick-action-card',
          onClick: () => router.navigate('#/produtos/novo'),
        },
        [
          el('div', { className: 'quick-action-card__icon' }, [createIcon('fa-solid fa-plus')]),
          el('div', { className: 'quick-action-card__body' }, [
            el('strong', { textContent: 'Novo Produto' }),
            el('span', { textContent: 'Cadastrar fórmula com texto rico e preview ao vivo' }),
          ]),
        ]
      ),
      el(
        'button',
        {
          type: 'button',
          className: 'quick-action-card',
          onClick: () => router.navigate('#/banners'),
        },
        [
          el('div', { className: 'quick-action-card__icon' }, [createIcon('fa-solid fa-panorama')]),
          el('div', { className: 'quick-action-card__body' }, [
            el('strong', { textContent: 'Novo Banner' }),
            el('span', { textContent: 'Adicionar ou reordenar slides do carrossel 1920x650' }),
          ]),
        ]
      ),
      el(
        'button',
        {
          type: 'button',
          className: 'quick-action-card',
          onClick: () => router.navigate('#/categorias'),
        },
        [
          el('div', { className: 'quick-action-card__icon' }, [createIcon('fa-solid fa-tags')]),
          el('div', { className: 'quick-action-card__body' }, [
            el('strong', { textContent: 'Gerenciar Categorias' }),
            el('span', { textContent: 'Organizar linhas farmacêuticas e ordem da vitrine' }),
          ]),
        ]
      ),
      el(
        'button',
        {
          type: 'button',
          className: 'quick-action-card',
          onClick: () => router.navigate('#/compostos'),
        },
        [
          el('div', { className: 'quick-action-card__icon' }, [createIcon('fa-solid fa-vial')]),
          el('div', { className: 'quick-action-card__body' }, [
            el('strong', { textContent: 'Vitrine de Compostos' }),
            el('span', { textContent: 'Personalizar cards especiais abaixo dos Mais Vendidos' }),
          ]),
        ]
      ),
      el(
        'button',
        {
          type: 'button',
          className: 'quick-action-card',
          onClick: () => router.navigate('#/whatsapp'),
        },
        [
          el('div', { className: 'quick-action-card__icon quick-action-card__icon--wa' }, [
            createIcon('fa-brands fa-whatsapp'),
          ]),
          el('div', { className: 'quick-action-card__body' }, [
            el('strong', { textContent: 'Mensagem de WhatsApp' }),
            el('span', { textContent: 'Personalizar template global ou por produto' }),
          ]),
        ]
      ),
      el(
        'button',
        {
          type: 'button',
          className: 'quick-action-card',
          onClick: () => router.navigate('#/seguranca'),
        },
        [
          el('div', { className: 'quick-action-card__icon' }, [
            createIcon('fa-solid fa-shield-halved'),
          ]),
          el('div', { className: 'quick-action-card__body' }, [
            el('strong', { textContent: 'Segurança (MFA TOTP)' }),
            el('span', { textContent: 'Configurar autenticação em dois fatores do painel' }),
          ]),
        ]
      ),
    ]),
  ]);

  // 3. Lista dos últimos produtos editados
  const recentProducts = [...state.products]
    .sort((a, b) => {
      const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
      const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
      return dateB - dateA;
    })
    .slice(0, 6);

  const recentBody =
    recentProducts.length === 0
      ? createEmptyState({
          icon: 'fa-solid fa-mortar-pestle',
          title: 'Nenhum produto cadastrado ainda',
          description: 'Comece adicionando sua primeira fórmula manipulada ao catálogo.',
          ctaLabel: 'Cadastrar Primeiro Produto',
          onCtaClick: () => router.navigate('#/produtos/novo'),
        })
      : el(
          'div',
          { className: 'recent-items-list' },
          recentProducts.map((prod) =>
            el('div', { className: 'recent-item-row' }, [
              el('div', { className: 'recent-item-row__main' }, [
                el('img', {
                  className: 'product-thumb',
                  src: resolveAdminImageUrl(prod),
                  alt: prod.name || 'Produto',
                  width: '48',
                  height: '48',
                  loading: 'lazy',
                }),
                el('div', { className: 'recent-item-row__info' }, [
                  el('strong', { className: 'recent-item-row__title', textContent: prod.name }),
                  el('span', {
                    className: 'recent-item-row__meta',
                    textContent: `${prod.categories?.name || 'Sem categoria'} · ${formatBRL(prod.price)} · Atualizado em ${formatDateShort(prod.updated_at || prod.created_at)}`,
                  }),
                ]),
              ]),
              el('div', { className: 'recent-item-row__actions' }, [
                el(
                  'span',
                  {
                    className: prod.is_active ? 'badge badge-success' : 'badge badge-muted',
                    textContent: prod.is_active ? 'Ativo' : 'Inativo',
                  }
                ),
                el(
                  'button',
                  {
                    type: 'button',
                    className: 'btn btn-secondary btn-sm',
                    onClick: () => router.navigate(`#/produtos/${prod.id}`),
                  },
                  [createIcon('fa-regular fa-pen-to-square'), el('span', { textContent: 'Editar' })]
                ),
              ]),
            ])
          )
        );

  const recentPanel = el('section', { className: 'admin-panel' }, [
    el('div', { className: 'admin-panel__header' }, [
      el('div', {}, [
        el('span', { className: 'admin-panel__eyebrow' }, [
          createIcon('fa-regular fa-clock'),
          el('span', { textContent: 'Atividade Recente' }),
        ]),
        el('h2', { className: 'admin-panel__title', textContent: 'Últimos Produtos Editados' }),
      ]),
      el(
        'a',
        { href: '#/produtos', className: 'btn btn-secondary btn-sm' },
        [el('span', { textContent: 'Ver todos os produtos' }), createIcon('fa-solid fa-arrow-right')]
      ),
    ]),
    recentBody,
  ]);

  container.replaceChildren(
    el('div', { className: 'admin-view-stack' }, [kpiGrid, quickActions, recentPanel])
  );
}

