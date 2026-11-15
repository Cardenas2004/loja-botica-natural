/**
 * @file compoundShowcaseRenderer.js
 * @description Renderizador DOM seguro (zero innerHTML) compartilhado entre a Vitrine Pública
 * (`js/app.js`) e a Pré-visualização em Tempo Real do Painel Administrativo (`js/admin/views/compounds.js`).
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

export const DEFAULT_BOTTLE_IMAGE_URL = 'images/frasco-botica-showcase.webp';

export const CARD_THEMES = [
  {
    id: 'green',
    label: 'Verde Botânico Oficial',
    description: 'Gradiente verde vivo clássico da vitrine Botica Natural',
    swatch: '#2FA83B'
  },
  {
    id: 'purple',
    label: 'Roxo Real Magistral',
    description: 'Gradiente roxo profundo institucional da Botica Natural',
    swatch: '#521B7C'
  },
  {
    id: 'emerald',
    label: 'Esmeralda Farmacêutico',
    description: 'Verde esmeralda escuro sofisticado para linhas premium',
    swatch: '#136F48'
  },
  {
    id: 'plum',
    label: 'Ameixa & Hibisco',
    description: 'Tom vinho/ameixa acolhedor para linhas de beleza e bem-estar',
    swatch: '#6E1E52'
  },
  {
    id: 'gold',
    label: 'Âmbar & Cúrcuma',
    description: 'Dourado botânico terroso para vitalidade e articulações',
    swatch: '#8F5B14'
  }
];

export const BADGE_COLORS = [
  { id: 'green', label: 'Verde Cápsula (#39A845)' },
  { id: 'purple', label: 'Roxo Institucional (#5B2182)' },
  { id: 'gold', label: 'Dourado Magistral (#B26A00)' },
  { id: 'dark', label: 'Grafite Escuro (#23192D)' }
];

export const TITLE_ALIGNMENTS = [
  { id: 'center', label: 'Centralizado (Padrão)' },
  { id: 'left', label: 'Alinhado à Esquerda' },
  { id: 'right', label: 'Alinhado à Direita' }
];

export const BOTANICAL_THEMES = [
  {
    id: 'alcachofra',
    label: 'Alcachofra & Berinjela (Digestivo / Colesterol)',
    description: 'Folhas verdes de alcachofra e berinjela roxa fatiada'
  },
  {
    id: 'berries',
    label: 'Amora & Framboesa (Menopausa / Saúde Feminina)',
    description: 'Amoras pretas e framboesas frescas com folhas verdes'
  },
  {
    id: 'turmeric',
    label: 'Cúrcuma & Garra do Diabo (Articulações / Dor)',
    description: 'Raízes medicinais e pó dourado de cúrcuma'
  },
  {
    id: 'hibiscus',
    label: 'Hibisco & Chá Verde (Drenante / Detox)',
    description: 'Folhas de chá verde, cavalinha e flor de hibisco'
  },
  {
    id: 'chamomile',
    label: 'Camomila & Passiflora (Calmante / Sono)',
    description: 'Flores brancas de camomila e folhas calmantes'
  },
  {
    id: 'rosehip',
    label: 'Rosa Mosqueta & Romã (Pele / Beleza)',
    description: 'Pétalas rosadas botânicas e folhas frescas'
  },
  {
    id: 'custom',
    label: 'Imagem Botânica Personalizada (Upload)',
    description: 'Exibe uma imagem recortada enviada para o Supabase Storage'
  },
  {
    id: 'none',
    label: 'Sem Ilustração Lateral',
    description: 'Exibe apenas o frasco centralizado no palco'
  }
];

export const DEFAULT_COMPOUND_CARDS = [
  {
    id: '2b90c101-0000-4000-a000-000000000001',
    title: 'COMPOSTO\nALCACHOFRA + BERINJELA',
    label_subtitle: 'COMPOSTO DIGESTIVO',
    label_title: 'ALCACHOFRA\n+ BERINJELA',
    label_badge: '60 CÁPSULAS',
    show_label: true,
    button_text: 'COMPRAR',
    button_link: 'produto.html?id=f341446b-d225-447e-a119-bbf20acb1f9e',
    product_id: 'f341446b-d225-447e-a119-bbf20acb1f9e',
    open_in_new_tab: false,
    show_button: true,
    card_theme: 'green',
    badge_color: 'green',
    title_align: 'center',
    botanical_theme: 'alcachofra',
    show_capsules: true,
    image_url: null,
    image_path: null,
    botanical_image_url: null,
    botanical_image_path: null,
    display_order: 0,
    is_active: true
  },
  {
    id: '2b90c101-0000-4000-a000-000000000002',
    title: 'COMPOSTO PARA\nMENOPAUSA',
    label_subtitle: 'COMPOSTO PARA',
    label_title: 'MENOPAUSA',
    label_badge: '60 CÁPSULAS',
    show_label: true,
    button_text: 'COMPRAR',
    button_link: 'produto.html?id=53ecb53e-d202-4a7d-b60f-b70983e18d66',
    product_id: '53ecb53e-d202-4a7d-b60f-b70983e18d66',
    open_in_new_tab: false,
    show_button: true,
    card_theme: 'purple',
    badge_color: 'green',
    title_align: 'center',
    botanical_theme: 'berries',
    show_capsules: true,
    image_url: null,
    image_path: null,
    botanical_image_url: null,
    botanical_image_path: null,
    display_order: 1,
    is_active: true
  },
  {
    id: '2b90c101-0000-4000-a000-000000000003',
    title: 'COMPOSTO\nANTI-REUMÁTICO',
    label_subtitle: 'COMPOSTO PARA DOR',
    label_title: 'ANTI-REUMÁTICO',
    label_badge: '60 CÁPSULAS',
    show_label: true,
    button_text: 'COMPRAR',
    button_link: 'produto.html?id=2b1a1375-d801-484e-b6fc-5fae76e72f9e',
    product_id: '2b1a1375-d801-484e-b6fc-5fae76e72f9e',
    open_in_new_tab: false,
    show_button: true,
    card_theme: 'green',
    badge_color: 'green',
    title_align: 'center',
    botanical_theme: 'turmeric',
    show_capsules: true,
    image_url: null,
    image_path: null,
    botanical_image_url: null,
    botanical_image_path: null,
    display_order: 2,
    is_active: true
  },
  {
    id: '2b90c101-0000-4000-a000-000000000004',
    title: 'COMPOSTO\nDRENANTE',
    label_subtitle: 'AÇÃO DETOX E DIURÉTICA',
    label_title: 'COMPOSTO\nDRENANTE',
    label_badge: '60 CÁPSULAS',
    show_label: true,
    button_text: 'COMPRAR',
    button_link: 'produto.html?id=74f956d1-77a2-4c30-9e12-401fc77af8f2',
    product_id: '74f956d1-77a2-4c30-9e12-401fc77af8f2',
    open_in_new_tab: false,
    show_button: true,
    card_theme: 'purple',
    badge_color: 'green',
    title_align: 'center',
    botanical_theme: 'hibiscus',
    show_capsules: true,
    image_url: null,
    image_path: null,
    botanical_image_url: null,
    botanical_image_path: null,
    display_order: 3,
    is_active: true
  },
  {
    id: '2b90c101-0000-4000-a000-000000000005',
    title: 'COMPOSTO\nCALMANTE NATURAL',
    label_subtitle: 'EQUILÍBRIO E SONO',
    label_title: 'COMPOSTO\nCALMANTE',
    label_badge: '60 CÁPSULAS',
    show_label: true,
    button_text: 'COMPRAR',
    button_link: 'produto.html?id=ffb5e893-4525-4d95-81ee-5abf61223e73',
    product_id: 'ffb5e893-4525-4d95-81ee-5abf61223e73',
    open_in_new_tab: false,
    show_button: true,
    card_theme: 'green',
    badge_color: 'green',
    title_align: 'center',
    botanical_theme: 'chamomile',
    show_capsules: true,
    image_url: null,
    image_path: null,
    botanical_image_url: null,
    botanical_image_path: null,
    display_order: 4,
    is_active: true
  },
  {
    id: '2b90c101-0000-4000-a000-000000000006',
    title: 'COMPOSTO\nMANCHAS NA PELE',
    label_subtitle: 'UNIFORMIZAÇÃO DA PELE',
    label_title: 'MANCHAS\nNA PELE',
    label_badge: '60 CÁPSULAS',
    show_label: true,
    button_text: 'COMPRAR',
    button_link: 'produto.html?id=b25df4bf-26a9-4599-b596-90d707b16435',
    product_id: 'b25df4bf-26a9-4599-b596-90d707b16435',
    open_in_new_tab: false,
    show_button: true,
    card_theme: 'purple',
    badge_color: 'green',
    title_align: 'center',
    botanical_theme: 'rosehip',
    show_capsules: true,
    image_url: null,
    image_path: null,
    botanical_image_url: null,
    botanical_image_path: null,
    display_order: 5,
    is_active: true
  }
];

/**
 * Valida se o endereço de destino de um card de composto é seguro.
 * Rejeita esquemas executáveis como javascript:, data:, vbscript:.
 */
export function isValidCompoundLink(rawLink) {
  const link = String(rawLink || '').trim();
  if (!link) return true;
  if (/^(javascript|data|vbscript|file):/i.test(link)) return false;
  if (link.startsWith('#') || link.startsWith('/')) return true;
  if (/^[a-zA-Z0-9._-]+(\.html?)?(\?[^\s]*)?(#[^\s]*)?$/.test(link)) return true;

  try {
    const parsed = new URL(link);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeMatchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function resolveProductHref(product) {
  const slug = String(product?.slug || '').trim().toLowerCase();
  if (slug && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    return `produtos/${encodeURIComponent(slug)}/`;
  }
  if (product?.id) {
    return `produto.html?id=${encodeURIComponent(String(product.id))}`;
  }
  return '#produtos';
}

/**
 * Resolve o link final de destino do botão do card considerando:
 * 1. `product_id` vinculado a um produto ativo do catálogo;
 * 2. `button_link` personalizado seguro;
 * 3. Correspondência inteligente por nome no catálogo de produtos;
 * 4. Fallback seguro para `#produtos`.
 */
export function resolveCompoundDestination(card, products = []) {
  const safeCard = card || {};
  const productList = Array.isArray(products) ? products : [];

  if (safeCard.product_id) {
    const byId = productList.find((item) => String(item.id) === String(safeCard.product_id));
    if (byId) {
      return {
        href: resolveProductHref(byId),
        matchedProduct: byId
      };
    }
  }

  const customLink = String(safeCard.button_link || '').trim();
  if (customLink && isValidCompoundLink(customLink)) {
    const idMatch = customLink.match(/[?&]id=([^&#]+)/i);
    if (idMatch && productList.length > 0) {
      const linkedProd = productList.find((item) => String(item.id) === idMatch[1]);
      if (linkedProd) {
        return {
          href: resolveProductHref(linkedProd),
          matchedProduct: linkedProd
        };
      }
    }
    return {
      href: customLink,
      matchedProduct: null
    };
  }

  if (productList.length > 0) {
    const needle = normalizeMatchText(safeCard.label_title || safeCard.title).replace(/\s+/g, ' ');
    if (needle) {
      const matched = productList.find((item) => {
        const nameNorm = normalizeMatchText(item.name);
        return nameNorm === needle || nameNorm.includes(needle) || needle.includes(nameNorm);
      });
      if (matched) {
        return {
          href: resolveProductHref(matched),
          matchedProduct: matched
        };
      }
    }
  }

  if (safeCard.product_id) {
    return {
      href: `produto.html?id=${encodeURIComponent(safeCard.product_id)}`,
      matchedProduct: null
    };
  }

  return {
    href: '#produtos',
    matchedProduct: null
  };
}

/**
 * Cria um elemento SVG recursivamente a partir de uma especificação declarativa,
 * sem utilizar innerHTML.
 */
function buildSvgElement(tag, attrs = {}, children = []) {
  const el = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      el.setAttribute(key, String(value));
    }
  });
  children.forEach((child) => {
    if (child) el.appendChild(child);
  });
  return el;
}

/**
 * Constrói o elemento SVG vetorial botânico correspondente ao tema selecionado.
 */
export function createBotanicalSvgElement(themeKey, uniqueSuffix = '0') {
  const theme = String(themeKey || 'alcachofra').toLowerCase();
  if (theme === 'none' || theme === 'custom') return null;

  const gradSuffix = String(uniqueSuffix).replace(/[^a-zA-Z0-9_-]/g, '');

  if (theme === 'berries') {
    return buildSvgElement(
      'svg',
      { class: 'compound-card__botanical', viewBox: '0 0 110 86', fill: 'none' },
      [
        buildSvgElement('ellipse', { cx: 56, cy: 76, rx: 46, ry: 7, fill: '#180426', 'fill-opacity': '0.45' }),
        buildSvgElement('path', { d: 'M22 52C26 36 42 28 56 34C48 48 35 55 22 52Z', fill: '#2E9438' }),
        buildSvgElement('path', { d: 'M54 44C66 32 84 30 96 40C84 52 68 54 54 44Z', fill: '#3FB04A' }),
        buildSvgElement('g', { fill: '#E02447' }, [
          buildSvgElement('circle', { cx: 26, cy: 60, r: 6 }),
          buildSvgElement('circle', { cx: 34, cy: 57, r: 6 }),
          buildSvgElement('circle', { cx: 22, cy: 67, r: 6 }),
          buildSvgElement('circle', { cx: 30, cy: 66, r: 6.5 }),
          buildSvgElement('circle', { cx: 38, cy: 65, r: 6 }),
          buildSvgElement('circle', { cx: 27, cy: 72, r: 5.5 }),
          buildSvgElement('circle', { cx: 35, cy: 72, r: 5.5 })
        ]),
        buildSvgElement('g', { fill: '#FF6B88', opacity: '0.65' }, [
          buildSvgElement('circle', { cx: 24, cy: 58, r: 2 }),
          buildSvgElement('circle', { cx: 32, cy: 55, r: 2 }),
          buildSvgElement('circle', { cx: 29, cy: 64, r: 2.2 }),
          buildSvgElement('circle', { cx: 36, cy: 63, r: 2 })
        ]),
        buildSvgElement('g', { fill: '#D91E41' }, [
          buildSvgElement('circle', { cx: 72, cy: 58, r: 6 }),
          buildSvgElement('circle', { cx: 80, cy: 56, r: 6 }),
          buildSvgElement('circle', { cx: 69, cy: 66, r: 6 }),
          buildSvgElement('circle', { cx: 77, cy: 65, r: 6.5 }),
          buildSvgElement('circle', { cx: 85, cy: 64, r: 6 }),
          buildSvgElement('circle', { cx: 73, cy: 72, r: 5.5 }),
          buildSvgElement('circle', { cx: 81, cy: 72, r: 5.5 })
        ]),
        buildSvgElement('g', { fill: '#FF6B88', opacity: '0.65' }, [
          buildSvgElement('circle', { cx: 71, cy: 56, r: 2 }),
          buildSvgElement('circle', { cx: 79, cy: 54, r: 2 }),
          buildSvgElement('circle', { cx: 76, cy: 63, r: 2.2 }),
          buildSvgElement('circle', { cx: 84, cy: 62, r: 2 })
        ]),
        buildSvgElement('g', { fill: '#260B38' }, [
          buildSvgElement('circle', { cx: 49, cy: 58, r: 5.8 }),
          buildSvgElement('circle', { cx: 57, cy: 58, r: 5.8 }),
          buildSvgElement('circle', { cx: 45, cy: 65, r: 6 }),
          buildSvgElement('circle', { cx: 53, cy: 65, r: 6.5 }),
          buildSvgElement('circle', { cx: 61, cy: 65, r: 6 }),
          buildSvgElement('circle', { cx: 49, cy: 72, r: 5.8 }),
          buildSvgElement('circle', { cx: 57, cy: 72, r: 5.8 })
        ]),
        buildSvgElement('g', { fill: '#9F70C4', opacity: '0.7' }, [
          buildSvgElement('circle', { cx: 48, cy: 56, r: 2 }),
          buildSvgElement('circle', { cx: 56, cy: 56, r: 2 }),
          buildSvgElement('circle', { cx: 52, cy: 63, r: 2.2 }),
          buildSvgElement('circle', { cx: 60, cy: 63, r: 2 }),
          buildSvgElement('circle', { cx: 48, cy: 70, r: 1.8 }),
          buildSvgElement('circle', { cx: 56, cy: 70, r: 1.8 })
        ])
      ]
    );
  }

  if (theme === 'turmeric') {
    const gradId = `turmericGrad_${gradSuffix}`;
    return buildSvgElement(
      'svg',
      { class: 'compound-card__botanical', viewBox: '0 0 110 86', fill: 'none' },
      [
        buildSvgElement('ellipse', { cx: 56, cy: 76, rx: 46, ry: 7, fill: '#0B3B10', 'fill-opacity': '0.38' }),
        buildSvgElement('path', {
          d: 'M18 64C24 50 44 44 62 49C74 52 88 58 94 66C80 71 42 72 18 64Z',
          fill: '#8C5828'
        }),
        buildSvgElement('rect', {
          x: 28,
          y: 42,
          width: 44,
          height: 14,
          rx: 7,
          transform: 'rotate(-18 28 42)',
          fill: '#A96E38'
        }),
        buildSvgElement('rect', {
          x: 48,
          y: 38,
          width: 42,
          height: 13,
          rx: 6.5,
          transform: 'rotate(14 48 38)',
          fill: '#935C2B'
        }),
        buildSvgElement('circle', { cx: 72, cy: 54, r: 7, fill: '#E8830C' }),
        buildSvgElement('circle', { cx: 72, cy: 54, r: 4.5, fill: '#FFA726' }),
        buildSvgElement('path', {
          d: 'M22 73C28 56 41 48 52 48C63 48 75 57 82 73C66 77 38 77 22 73Z',
          fill: `url(#${gradId})`
        }),
        buildSvgElement('circle', { cx: 44, cy: 58, r: 1.5, fill: '#FFD54F' }),
        buildSvgElement('circle', { cx: 55, cy: 54, r: 1.8, fill: '#FFD54F' }),
        buildSvgElement('circle', { cx: 62, cy: 63, r: 1.4, fill: '#FFD54F' }),
        buildSvgElement('circle', { cx: 38, cy: 66, r: 1.4, fill: '#FFE082' }),
        buildSvgElement('defs', {}, [
          buildSvgElement(
            'linearGradient',
            { id: gradId, x1: 52, y1: 48, x2: 52, y2: 76, gradientUnits: 'userSpaceOnUse' },
            [
              buildSvgElement('stop', { 'stop-color': '#FFA000' }),
              buildSvgElement('stop', { offset: '0.55', 'stop-color': '#E66C00' }),
              buildSvgElement('stop', { offset: '1', 'stop-color': '#B24A00' })
            ]
          )
        ])
      ]
    );
  }

  if (theme === 'hibiscus') {
    return buildSvgElement(
      'svg',
      { class: 'compound-card__botanical', viewBox: '0 0 110 86', fill: 'none' },
      [
        buildSvgElement('ellipse', { cx: 56, cy: 76, rx: 46, ry: 7, fill: '#180426', 'fill-opacity': '0.45' }),
        buildSvgElement('path', { d: 'M18 68C18 46 36 30 56 30C56 50 40 68 18 68Z', fill: '#2E9B38' }),
        buildSvgElement('path', { d: 'M46 70C50 48 68 34 90 36C86 56 68 70 46 70Z', fill: '#46B950' }),
        buildSvgElement('path', {
          d: 'M24 64L48 38',
          stroke: '#85E08C',
          'stroke-width': '1.8',
          'stroke-linecap': 'round'
        }),
        buildSvgElement('path', {
          d: 'M54 65L78 43',
          stroke: '#9DF0A4',
          'stroke-width': '1.8',
          'stroke-linecap': 'round'
        }),
        buildSvgElement('circle', { cx: 48, cy: 60, r: 11, fill: '#C2185B' }),
        buildSvgElement('circle', { cx: 60, cy: 58, r: 10, fill: '#D81B60' }),
        buildSvgElement('circle', { cx: 53, cy: 67, r: 10, fill: '#AD1457' }),
        buildSvgElement('circle', { cx: 54, cy: 61, r: 4, fill: '#FFCA28' })
      ]
    );
  }

  if (theme === 'chamomile') {
    return buildSvgElement(
      'svg',
      { class: 'compound-card__botanical', viewBox: '0 0 110 86', fill: 'none' },
      [
        buildSvgElement('ellipse', { cx: 56, cy: 76, rx: 46, ry: 7, fill: '#0B3B10', 'fill-opacity': '0.38' }),
        buildSvgElement('path', { d: 'M20 68C26 52 42 40 60 42C52 56 38 66 20 68Z', fill: '#2B8A34' }),
        buildSvgElement('g', { fill: '#FFFFFF' }, [
          buildSvgElement('circle', { cx: 42, cy: 54, r: 5 }),
          buildSvgElement('circle', { cx: 52, cy: 50, r: 5 }),
          buildSvgElement('circle', { cx: 58, cy: 58, r: 5 }),
          buildSvgElement('circle', { cx: 54, cy: 67, r: 5 }),
          buildSvgElement('circle', { cx: 44, cy: 68, r: 5 }),
          buildSvgElement('circle', { cx: 38, cy: 62, r: 5 })
        ]),
        buildSvgElement('circle', { cx: 48, cy: 60, r: 6.5, fill: '#FFB300' }),
        buildSvgElement('g', { fill: '#FFFFFF' }, [
          buildSvgElement('circle', { cx: 72, cy: 58, r: 4.2 }),
          buildSvgElement('circle', { cx: 80, cy: 56, r: 4.2 }),
          buildSvgElement('circle', { cx: 84, cy: 63, r: 4.2 }),
          buildSvgElement('circle', { cx: 78, cy: 70, r: 4.2 }),
          buildSvgElement('circle', { cx: 70, cy: 68, r: 4.2 })
        ]),
        buildSvgElement('circle', { cx: 76, cy: 63, r: 5.2, fill: '#FFA000' })
      ]
    );
  }

  if (theme === 'rosehip') {
    return buildSvgElement(
      'svg',
      { class: 'compound-card__botanical', viewBox: '0 0 110 86', fill: 'none' },
      [
        buildSvgElement('ellipse', { cx: 56, cy: 76, rx: 46, ry: 7, fill: '#180426', 'fill-opacity': '0.45' }),
        buildSvgElement('path', { d: 'M22 66C26 48 44 36 62 40C54 56 38 66 22 66Z', fill: '#32993C' }),
        buildSvgElement('circle', { cx: 52, cy: 58, r: 10, fill: '#F06292' }),
        buildSvgElement('circle', { cx: 64, cy: 56, r: 10, fill: '#EC407A' }),
        buildSvgElement('circle', { cx: 58, cy: 66, r: 10, fill: '#E91E63' }),
        buildSvgElement('circle', { cx: 46, cy: 66, r: 9, fill: '#F48FB1' }),
        buildSvgElement('circle', { cx: 56, cy: 61, r: 5, fill: '#FFD54F' })
      ]
    );
  }

  // Default: alcachofra + berinjela
  const gradId = `eggplantGrad_${gradSuffix}`;
  return buildSvgElement(
    'svg',
    { class: 'compound-card__botanical', viewBox: '0 0 110 86', fill: 'none' },
    [
      buildSvgElement('ellipse', { cx: 56, cy: 76, rx: 46, ry: 7, fill: '#0B3B10', 'fill-opacity': '0.38' }),
      buildSvgElement('path', { d: 'M22 68C14 54 18 36 32 28C36 42 32 58 22 68Z', fill: '#1F6E27' }),
      buildSvgElement('path', { d: 'M32 66C25 50 31 32 46 26C49 42 43 58 32 66Z', fill: '#32963B' }),
      buildSvgElement('path', { d: 'M16 70C10 60 12 45 24 39C27 51 24 63 16 70Z', fill: '#4BB553' }),
      buildSvgElement('path', { d: 'M29 44C34 33 45 26 55 29C51 41 41 49 29 44Z', fill: '#68C96E' }),
      buildSvgElement('path', {
        d: 'M52 38C68 30 92 38 96 55C99 68 85 76 66 74C49 72 41 58 46 45C48 41 50 39 52 38Z',
        fill: `url(#${gradId})`
      }),
      buildSvgElement('path', {
        d: 'M60 44C70 40 83 45 86 53',
        stroke: '#9B6BC2',
        'stroke-width': '2.5',
        'stroke-linecap': 'round',
        opacity: '0.6'
      }),
      buildSvgElement('path', {
        d: 'M44 46C48 39 56 36 62 40C56 43 52 48 50 54C46 51 43 49 44 46Z',
        fill: '#2E8B36'
      }),
      buildSvgElement('ellipse', {
        cx: 52,
        cy: 66,
        rx: 16,
        ry: 10,
        transform: 'rotate(-12 52 66)',
        fill: '#3A104B'
      }),
      buildSvgElement('ellipse', {
        cx: 52,
        cy: 66,
        rx: 13.5,
        ry: 8,
        transform: 'rotate(-12 52 66)',
        fill: '#EDE6D3'
      }),
      buildSvgElement('circle', { cx: 48, cy: 65, r: 1.1, fill: '#B59B6D' }),
      buildSvgElement('circle', { cx: 53, cy: 63, r: 1.1, fill: '#B59B6D' }),
      buildSvgElement('circle', { cx: 56, cy: 66, r: 1.1, fill: '#B59B6D' }),
      buildSvgElement('circle', { cx: 51, cy: 68, r: 1.1, fill: '#B59B6D' }),
      buildSvgElement('defs', {}, [
        buildSvgElement(
          'linearGradient',
          { id: gradId, x1: 46, y1: 34, x2: 95, y2: 75, gradientUnits: 'userSpaceOnUse' },
          [
            buildSvgElement('stop', { 'stop-color': '#6B258C' }),
            buildSvgElement('stop', { offset: '0.55', 'stop-color': '#3E0F54' }),
            buildSvgElement('stop', { offset: '1', 'stop-color': '#1E052B' })
          ]
        )
      ])
    ]
  );
}

/**
 * Anexa texto com suporte seguro a quebras de linha (`\n`) usando nós de texto e `<br>`.
 */
export function appendMultilineText(targetEl, rawText) {
  while (targetEl.firstChild) {
    targetEl.removeChild(targetEl.firstChild);
  }
  const text = String(rawText || '').trim();
  if (!text) return;

  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (index > 0) {
      targetEl.appendChild(document.createElement('br'));
    }
    targetEl.appendChild(document.createTextNode(line));
  });
}

/**
 * Constrói o elemento `<article class="compound-card">` completo e seguro.
 */
export function createCompoundCardElement(card, options = {}) {
  const {
    products = [],
    isPreview = false,
    uniqueIndex = 0
  } = options;

  const safeCard = card || {};
  const validThemes = new Set(['green', 'purple', 'emerald', 'plum', 'gold']);
  const theme = validThemes.has(safeCard.card_theme) ? safeCard.card_theme : 'green';

  const validAlignments = new Set(['left', 'center', 'right']);
  const titleAlign = validAlignments.has(safeCard.title_align) ? safeCard.title_align : 'center';

  const validBadgeColors = new Set(['green', 'purple', 'gold', 'dark']);
  const badgeColor = validBadgeColors.has(safeCard.badge_color) ? safeCard.badge_color : 'green';

  const article = document.createElement('article');
  article.className = `compound-card compound-card--${theme} compound-card--align-${titleAlign}`;
  if (safeCard.id) {
    article.dataset.compoundRecordId = String(safeCard.id);
  }
  if (safeCard.product_id) {
    article.dataset.compoundId = String(safeCard.product_id);
  }
  const plainTitle = String(safeCard.title || 'COMPOSTO MANIPULADO').replace(/\s+/g, ' ').trim();
  article.dataset.compoundMatch = plainTitle;

  const titleEl = document.createElement('h3');
  titleEl.className = 'compound-card__title';
  appendMultilineText(titleEl, safeCard.title || 'COMPOSTO\nMANIPULADO');
  article.appendChild(titleEl);

  const stage = document.createElement('div');
  stage.className = 'compound-card__stage';
  stage.setAttribute('aria-hidden', 'true');

  const showCapsules = safeCard.show_capsules !== false;
  if (showCapsules) {
    ['tl', 'bl', 'tr', 'br'].forEach((pos) => {
      const pill = document.createElement('span');
      pill.className = `compound-card__pill compound-card__pill--${pos}`;
      stage.appendChild(pill);
    });
  }

  const bottleWrap = document.createElement('div');
  bottleWrap.className = 'compound-card__bottle-wrap';

  const bottleImg = document.createElement('img');
  bottleImg.className = 'compound-card__bottle';
  const customBottleUrl = String(safeCard.image_url || '').trim();
  bottleImg.src = customBottleUrl || DEFAULT_BOTTLE_IMAGE_URL;
  bottleImg.alt = '';
  bottleImg.width = 400;
  bottleImg.height = 705;
  bottleImg.loading = isPreview ? 'eager' : 'lazy';
  bottleImg.decoding = 'async';
  bottleImg.addEventListener('error', () => {
    if (bottleImg.src && !bottleImg.src.endsWith(DEFAULT_BOTTLE_IMAGE_URL)) {
      bottleImg.src = DEFAULT_BOTTLE_IMAGE_URL;
    }
  });
  bottleWrap.appendChild(bottleImg);

  const showLabel = safeCard.show_label !== false;
  if (showLabel) {
    const labelWrap = document.createElement('div');
    labelWrap.className = 'compound-card__label';

    const subText = String(safeCard.label_subtitle ?? '').trim();
    if (subText) {
      const subEl = document.createElement('span');
      subEl.className = 'compound-card__label-sub';
      subEl.textContent = subText;
      labelWrap.appendChild(subEl);
    }

    const mainText = String(safeCard.label_title ?? '').trim();
    if (mainText) {
      const mainEl = document.createElement('strong');
      mainEl.className = 'compound-card__label-main';
      appendMultilineText(mainEl, mainText);
      labelWrap.appendChild(mainEl);
    }

    const badgeText = String(safeCard.label_badge ?? '').trim();
    if (badgeText) {
      const doseEl = document.createElement('span');
      doseEl.className = `compound-card__label-dose compound-card__label-dose--${badgeColor}`;
      doseEl.textContent = badgeText;
      labelWrap.appendChild(doseEl);
    }

    bottleWrap.appendChild(labelWrap);
  }

  stage.appendChild(bottleWrap);

  const botanicalTheme = String(safeCard.botanical_theme || 'alcachofra').toLowerCase();
  const customBotanicalUrl = String(safeCard.botanical_image_url || '').trim();

  if (customBotanicalUrl && (botanicalTheme === 'custom' || customBotanicalUrl.length > 0)) {
    const botImg = document.createElement('img');
    botImg.className = 'compound-card__botanical compound-card__botanical--img';
    botImg.src = customBotanicalUrl;
    botImg.alt = '';
    botImg.loading = isPreview ? 'eager' : 'lazy';
    botImg.decoding = 'async';
    stage.appendChild(botImg);
  } else if (botanicalTheme !== 'none') {
    const svgEl = createBotanicalSvgElement(
      botanicalTheme === 'custom' ? 'alcachofra' : botanicalTheme,
      `${safeCard.id || 'card'}_${uniqueIndex}`
    );
    if (svgEl) {
      stage.appendChild(svgEl);
    }
  }

  article.appendChild(stage);

  const showButton = safeCard.show_button !== false;
  if (showButton) {
    const resolved = resolveCompoundDestination(safeCard, products);
    const btn = document.createElement('a');
    btn.className = 'compound-card__btn';
    btn.href = resolved.href;
    btn.dataset.compoundLink = '';
    btn.textContent = String(safeCard.button_text || 'COMPRAR').trim() || 'COMPRAR';
    btn.setAttribute('aria-label', `${btn.textContent} — ${plainTitle}`);

    if (safeCard.open_in_new_tab) {
      btn.target = '_blank';
      btn.rel = 'noopener noreferrer';
    }

    if (isPreview) {
      btn.addEventListener('click', (event) => {
        event.preventDefault();
      });
    }

    article.appendChild(btn);
  }

  return article;
}
