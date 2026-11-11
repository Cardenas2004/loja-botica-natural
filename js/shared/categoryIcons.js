// @ts-check
/**
 * Módulo compartilhado de ícones semânticos para Categorias de Fórmulas.
 * Constrói SVGs vetoriais duotone de alta legibilidade via DOM API pura (createElementNS),
 * respeitando rigorosamente a política de segurança (CSP / sem innerHTML).
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Normaliza o texto removendo acentos e convertendo para minúsculas.
 * @param {string} value
 * @returns {string}
 */
export function normalizeCategoryKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Resolve a chave semântica do ícone a partir do nome e/ou ID da categoria.
 * @param {string} name
 * @param {string} [id]
 * @returns {string}
 */
export function resolveCategoryIconKey(name, id = '') {
  if (id === 'all') return 'all';

  const key = normalizeCategoryKey(name);
  if (!key || key === 'todos os produtos' || key === 'todas as categorias') {
    return 'all';
  }

  // 1. Fígado, Estômago e Digestão
  if (
    key.includes('figado') ||
    key.includes('estomago') ||
    key.includes('gastr') ||
    key.includes('digest') ||
    key.includes('azia') ||
    key.includes('refluxo') ||
    key.includes('hepat')
  ) {
    return 'gastro';
  }

  // 2. Reguladores Intestino / Flora / Probióticos
  if (
    key.includes('intestin') ||
    key.includes('flora') ||
    key.includes('probiot') ||
    key.includes('fibra') ||
    key.includes('prisao de ventre')
  ) {
    return 'intestine';
  }

  // 3. Saúde da Mulher
  if (
    key.includes('mulher') ||
    key.includes('feminin') ||
    key.includes('menopausa') ||
    key.includes('tpm') ||
    key.includes('gestante') ||
    key.includes('matern')
  ) {
    return 'women';
  }

  // 4. Saúde do Homem
  if (
    key.includes('homem') ||
    key.includes('masculin') ||
    key.includes('prostata') ||
    key.includes('barba') ||
    key.includes('andro')
  ) {
    return 'men';
  }

  // 5. Saúde Articular / Ossos / Cartilagem
  if (
    key.includes('articul') ||
    key.includes('osso') ||
    key.includes('ossea') ||
    key.includes('cartilag') ||
    key.includes('oste') ||
    key.includes('mobilidade')
  ) {
    return 'joint';
  }

  // 6. Ansiolíticos / Calmantes / Melhora do Sono
  if (
    key.includes('ansiolit') ||
    key.includes('calmant') ||
    key.includes('sono') ||
    key.includes('insonia') ||
    key.includes('melatonina') ||
    key.includes('relax') ||
    key.includes('estresse') ||
    key.includes('ansiedade')
  ) {
    return 'sleep';
  }

  // 7. Reumatismos e Dores / Anti-inflamatórios
  if (
    key.includes('reumat') ||
    /\bdor(es)?\b/.test(key) ||
    key.includes('analges') ||
    key.includes('inflam') ||
    key.includes('alivio') ||
    key.includes('enxaqueca')
  ) {
    return 'pain';
  }

  // 8. Varizes e Circulação / Cardiovascular
  if (
    key.includes('variz') ||
    key.includes('circula') ||
    key.includes('vascul') ||
    key.includes('coracao') ||
    key.includes('cardio') ||
    key.includes('pressao') ||
    key.includes('colesterol')
  ) {
    return 'circulation';
  }

  // 9. Disposição Física e Mental / Memória / Foco / Cognição
  if (
    key.includes('disposicao') ||
    key.includes('mental') ||
    key.includes('memoria') ||
    key.includes('foco') ||
    key.includes('cerebro') ||
    key.includes('cognit') ||
    key.includes('energia') ||
    key.includes('concentra')
  ) {
    return 'mind';
  }

  // 10. Saúde Pele / Cabelos / Unhas / Beleza / Dermocosméticos
  if (
    key.includes('pele') ||
    key.includes('cabelo') ||
    key.includes('unha') ||
    key.includes('capilar') ||
    key.includes('beleza') ||
    key.includes('estetica') ||
    key.includes('dermo') ||
    key.includes('facial') ||
    key.includes('colageno') ||
    key.includes('mancha') ||
    key.includes('acne')
  ) {
    return 'beauty';
  }

  // 11. Emagrecedores / Inibidores de Apetite / Peso / Medidas
  if (
    key.includes('emagrec') ||
    key.includes('apetite') ||
    key.includes('peso') ||
    key.includes('medida') ||
    key.includes('termogen') ||
    key.includes('metabol') ||
    key.includes('saciedade') ||
    key.includes('gordura')
  ) {
    return 'weight';
  }

  // 12. Drenantes / Retenção / Detox
  if (
    key.includes('drenant') ||
    key.includes('retencao') ||
    key.includes('diuret') ||
    key.includes('detox') ||
    key.includes('incha') ||
    key.includes('celulite')
  ) {
    return 'drain';
  }

  // 13. Performance Esportiva / Treino
  if (
    key.includes('performance') ||
    key.includes('esport') ||
    key.includes('treino') ||
    key.includes('atleta') ||
    key.includes('forca') ||
    key.includes('hipertrofia') ||
    key.includes('creatina') ||
    key.includes('whey')
  ) {
    return 'sport';
  }

  // 14. Imunidade / Vitaminas / Defesas
  if (
    key.includes('imun') ||
    key.includes('defesa') ||
    key.includes('vitamin') ||
    key.includes('resfriad') ||
    key.includes('gripe') ||
    key.includes('antioxid')
  ) {
    return 'immunity';
  }

  // 15. Diversos / Outros / Geral
  return 'apothecary';
}

/**
 * Definições vetoriais (viewBox 0 0 24 24) com camadas duotone (fill-opacity)
 * e traços precisos para máxima clareza em tamanhos de 18px a 26px.
 * @type {Record<string, Array<{ tag: string, attrs: Record<string, string> }>>}
 */
const ICON_DEFINITIONS = {
  // Todos os Produtos: Vitrine 2x2 com estrela farmacêutica
  all: [
    {
      tag: 'rect',
      attrs: {
        x: '3',
        y: '3',
        width: '7.5',
        height: '7.5',
        rx: '2.2',
        fill: 'currentColor',
        'fill-opacity': '0.22',
        stroke: 'currentColor',
        'stroke-width': '1.9',
      },
    },
    {
      tag: 'rect',
      attrs: {
        x: '3',
        y: '13.5',
        width: '7.5',
        height: '7.5',
        rx: '2.2',
        stroke: 'currentColor',
        'stroke-width': '1.9',
      },
    },
    {
      tag: 'rect',
      attrs: {
        x: '13.5',
        y: '13.5',
        width: '7.5',
        height: '7.5',
        rx: '2.2',
        fill: 'currentColor',
        'fill-opacity': '0.22',
        stroke: 'currentColor',
        'stroke-width': '1.9',
      },
    },
    {
      tag: 'path',
      attrs: {
        d: 'M17.25 2.5L18.45 5.8L21.75 7L18.45 8.2L17.25 11.5L16.05 8.2L12.75 7L16.05 5.8L17.25 2.5Z',
        fill: 'currentColor',
      },
    },
  ],

  // Fígado e Estômago: Silhueta anatômica gástrica/hepática com brilho protetor
  gastro: [
    {
      tag: 'path',
      attrs: {
        d: 'M10 3V6.2C10 7.6 8.8 8.6 7.5 9.2C5.2 10.3 4 12.6 4.3 15.3C4.6 18.5 7.4 20.8 11 20.8C15.6 20.8 19.5 17.2 19.5 12.3C19.5 8.6 16.9 6.2 14.2 6.2C13.3 6.2 12.6 5.5 12.6 4.6V3',
        fill: 'currentColor',
        'fill-opacity': '0.2',
        stroke: 'currentColor',
        'stroke-width': '1.9',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      },
    },
    {
      tag: 'path',
      attrs: {
        d: 'M14.2 6.2C12.2 6.2 11 7.8 11 9.8C11 11.7 12.4 13.2 14.5 13.5',
        stroke: 'currentColor',
        'stroke-width': '1.75',
        'stroke-linecap': 'round',
      },
    },
    {
      tag: 'path',
      attrs: {
        d: 'M9 14.2L9.6 15.6L11 16.2L9.6 16.8L9 18.2L8.4 16.8L7 16.2L8.4 15.6L9 14.2Z',
        fill: 'currentColor',
      },
    },
    {
      tag: 'path',
      attrs: {
        d: 'M4.3 15.3C3.1 15.6 2.5 16.7 2.5 18V20.5',
        stroke: 'currentColor',
        'stroke-width': '1.9',
        'stroke-linecap': 'round',
      },
    },
  ],

  // Saúde da Mulher: Flor de Lótus botânica com emblema feminino
  women: [
    {
      tag: 'path',
      attrs: {
        d: 'M12 3C9.6 6.2 8.8 9.6 12 13.2C15.2 9.6 14.4 6.2 12 3Z',
        fill: 'currentColor',
        'fill-opacity': '0.26',
        stroke: 'currentColor',
        'stroke-width': '1.85',
        'stroke-linejoin': 'round',
      },
    },
    {
      tag: 'path',
      attrs: {
        d: 'M12 13.2C8.5 12.8 5.2 10.5 4.2 6.8C7.2 6.5 9.8 8.2 12 13.2Z',
        fill: 'currentColor',
        'fill-opacity': '0.14',
        stroke: 'currentColor',
        'stroke-width': '1.85',
        'stroke-linejoin': 'round',
      },
    },
    {
      tag: 'path',
      attrs: {
        d: 'M12 13.2C15.5 12.8 18.8 10.5 19.8 6.8C16.8 6.5 14.2 8.2 12 13.2Z',
        fill: 'currentColor',
        'fill-opacity': '0.14',
        stroke: 'currentColor',
        'stroke-width': '1.85',
        'stroke-linejoin': 'round',
      },
    },
    {
      tag: 'path',
      attrs: {
        d: 'M12 13.2V21.2M9 18H15',
        stroke: 'currentColor',
        'stroke-width': '1.95',
        'stroke-linecap': 'round',
      },
    },
  ],

  // Saúde Articular: Articulação óssea com cápsula sinovial protetora
  joint: [
    {
      tag: 'path',
      attrs: {
        d: 'M9.5 3.5V6.8C8.1 7.2 7.2 8.4 7.5 9.7C7.8 10.8 9 11.3 10.2 10.8C11.3 10.3 12.7 10.3 13.8 10.8C15 11.3 16.2 10.8 16.5 9.7C16.8 8.4 15.9 7.2 14.5 6.8V3.5',
        fill: 'currentColor',
        'fill-opacity': '0.22',
        stroke: 'currentColor',
        'stroke-width': '1.85',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      },
    },
    {
      tag: 'path',
      attrs: {
        d: 'M9.5 20.5V17.2C8.1 16.8 7.2 15.6 7.5 14.3C7.8 13.2 9 12.7 10.2 13.2C11.3 13.7 12.7 13.7 13.8 13.2C15 12.7 16.2 13.2 16.5 14.3C16.8 15.6 15.9 16.8 14.5 17.2V20.5',
        fill: 'currentColor',
        'fill-opacity': '0.22',
        stroke: 'currentColor',
        'stroke-width': '1.85',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      },
    },
    {
      tag: 'path',
      attrs: {
        d: 'M4.2 8.5C2.9 10.6 2.9 13.4 4.2 15.5M19.8 8.5C21.1 10.6 21.1 13.4 19.8 15.5',
        stroke: 'currentColor',
        'stroke-width': '1.85',
        'stroke-linecap': 'round',
      },
    },
  ],

  // Ansiolíticos / Calmantes / Melhora do Sono: Lua crescente serena e estrelas
  sleep: [
    {
      tag: 'path',
      attrs: {
        d: 'M20.2 14.4A8.5 8.5 0 0 1 9.6 3.8A8.5 8.5 0 1 0 20.2 14.4Z',
        fill: 'currentColor',
        'fill-opacity': '0.24',
        stroke: 'currentColor',
        'stroke-width': '1.9',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      },
    },
    {
      tag: 'path',
      attrs: {
        d: 'M16.5 3.2L17.2 5L19 5.7L17.2 6.4L16.5 8.2L15.8 6.4L14 5.7L15.8 5L16.5 3.2Z',
        fill: 'currentColor',
      },
    },
    {
      tag: 'path',
      attrs: {
        d: 'M20.2 8.5L20.6 9.6L21.7 10L20.6 10.4L20.2 11.5L19.8 10.4L18.7 10L19.8 9.6L20.2 8.5Z',
        fill: 'currentColor',
      },
    },
  ],

  // Reumatismos e Dores: Alvo terapêutico de alívio analgésico com ondas calmantes
  pain: [
    {
      tag: 'circle',
      attrs: {
        cx: '12',
        cy: '12',
        r: '7.5',
        fill: 'currentColor',
        'fill-opacity': '0.18',
        stroke: 'currentColor',
        'stroke-width': '1.85',
      },
    },
    {
      tag: 'path',
      attrs: {
        d: 'M12 2V4.5M12 19.5V22M2 12H4.5M19.5 12H22',
        stroke: 'currentColor',
        'stroke-width': '1.95',
        'stroke-linecap': 'round',
      },
    },
    {
      tag: 'path',
      attrs: {
        d: 'M12.8 7.5L9.5 12.2H12.3L11.2 16.5L14.5 11.8H11.7L12.8 7.5Z',
        fill: 'currentColor',
        stroke: 'currentColor',
        'stroke-width': '0.8',
        'stroke-linejoin': 'round',
      },
    },
  ],

  // Varizes e Circulação: Coração vascular com pulso circulatório
  circulation: [
    {
      tag: 'path',
      attrs: {
        d: 'M12 20.5C12 20.5 3.5 15 3.5 8.6C3.5 5.7 5.8 3.5 8.5 3.5C10.2 3.5 11.4 4.3 12 5.4C12.6 4.3 13.8 3.5 15.5 3.5C18.2 3.5 20.5 5.7 20.5 8.6C20.5 15 12 20.5 12 20.5Z',
        fill: 'currentColor',
        'fill-opacity': '0.22',
        stroke: 'currentColor',
        'stroke-width': '1.9',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      },
    },
    {
      tag: 'path',
      attrs: {
        d: 'M6.5 11.8H9.2L10.7 8.8L12.9 14.2L14.5 11.8H17.5',
        stroke: 'currentColor',
        'stroke-width': '1.9',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      },
    },
  ],

  // Disposição Física e Mental: Hemisférios cerebrais com centelha de energia
  mind: [
    {
      tag: 'path',
      attrs: {
        d: 'M9.5 4.5C7.3 4.5 5.6 6.2 5.6 8.3C4.4 9 3.8 10.3 4 11.8C4.2 13.3 5.2 14.4 6.5 14.8C6.5 16.8 8.1 18.5 10.2 18.5H12V5.8C11.4 5 10.5 4.5 9.5 4.5Z',
        fill: 'currentColor',
        'fill-opacity': '0.2',
        stroke: 'currentColor',
        'stroke-width': '1.85',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      },
    },
    {
      tag: 'path',
      attrs: {
        d: 'M14.5 4.5C16.7 4.5 18.4 6.2 18.4 8.3C19.6 9 20.2 10.3 20 11.8C19.8 13.3 18.8 14.4 17.5 14.8C17.5 16.8 15.9 18.5 13.8 18.5H12V5.8C12.6 5 13.5 4.5 14.5 4.5Z',
        fill: 'currentColor',
        'fill-opacity': '0.2',
        stroke: 'currentColor',
        'stroke-width': '1.85',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      },
    },
    {
      tag: 'path',
      attrs: {
        d: 'M8.5 9.5C9.5 9.5 10.2 10.2 10.2 11.2M15.5 9.5C14.5 9.5 13.8 10.2 13.8 11.2M12 18.5V21.2',
        stroke: 'currentColor',
        'stroke-width': '1.75',
        'stroke-linecap': 'round',
      },
    },
  ],

  // Saúde Pele / Cabelos / Unhas: Gota de sérum dermocosmético e estrelas de brilho
  beauty: [
    {
      tag: 'path',
      attrs: {
        d: 'M10.5 4.2C10.5 4.2 5 10.6 5 14.6C5 17.8 7.5 20.3 10.5 20.3C13.5 20.3 16 17.8 16 14.6C16 10.6 10.5 4.2 10.5 4.2Z',
        fill: 'currentColor',
        'fill-opacity': '0.22',
        stroke: 'currentColor',
        'stroke-width': '1.9',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      },
    },
    {
      tag: 'path',
      attrs: {
        d: 'M8.2 14.8C8.2 16.3 9.2 17.4 10.6 17.6',
        stroke: 'currentColor',
        'stroke-width': '1.75',
        'stroke-linecap': 'round',
      },
    },
    {
      tag: 'path',
      attrs: {
        d: 'M18.2 3L19 5.3L21.3 6.1L19 6.9L18.2 9.2L17.4 6.9L15.1 6.1L17.4 5.3L18.2 3Z',
        fill: 'currentColor',
      },
    },
    {
      tag: 'path',
      attrs: {
        d: 'M19.2 11.5L19.7 12.8L21 13.3L19.7 13.8L19.2 15.1L18.7 13.8L17.4 13.3L18.7 12.8L19.2 11.5Z',
        fill: 'currentColor',
      },
    },
  ],

  // Saúde do Homem: Emblema de vitalidade masculina com escudo interno
  men: [
    {
      tag: 'circle',
      attrs: {
        cx: '10',
        cy: '14',
        r: '6.2',
        fill: 'currentColor',
        'fill-opacity': '0.22',
        stroke: 'currentColor',
        'stroke-width': '1.95',
      },
    },
    {
      tag: 'path',
      attrs: {
        d: 'M14.5 9.5L20.2 3.8M15.2 3.8H20.2V8.8',
        stroke: 'currentColor',
        'stroke-width': '1.95',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      },
    },
    {
      tag: 'path',
      attrs: {
        d: 'M10 11.5V16.5M7.5 14H12.5',
        stroke: 'currentColor',
        'stroke-width': '1.85',
        'stroke-linecap': 'round',
      },
    },
  ],

  // Emagrecedores / Inibidores de Apetite: Silhueta corporal e fita de medidas
  weight: [
    {
      tag: 'path',
      attrs: {
        d: 'M6.5 3.5C9.5 7.5 9.5 11.5 6.8 15.5C5.8 17 5.5 18.8 5.8 20.5H18.2C18.5 18.8 18.2 17 17.2 15.5C14.5 11.5 14.5 7.5 17.5 3.5H6.5Z',
        fill: 'currentColor',
        'fill-opacity': '0.2',
        stroke: 'currentColor',
        'stroke-width': '1.85',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      },
    },
    {
      tag: 'path',
      attrs: {
        d: 'M4.2 11.5H19.8M4.2 11.5L6.2 9.7M4.2 11.5L6.2 13.3M19.8 11.5L17.8 9.7M19.8 11.5L17.8 13.3',
        stroke: 'currentColor',
        'stroke-width': '1.85',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      },
    },
  ],

  // Drenantes: Gotas linfáticas em cascata e onda de fluidez
  drain: [
    {
      tag: 'path',
      attrs: {
        d: 'M9.5 4.5C9.5 4.5 5 10 5 13.5C5 16.2 7 18.2 9.5 18.2C12 18.2 14 16.2 14 13.5C14 10 9.5 4.5 9.5 4.5Z',
        fill: 'currentColor',
        'fill-opacity': '0.24',
        stroke: 'currentColor',
        'stroke-width': '1.9',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      },
    },
    {
      tag: 'path',
      attrs: {
        d: 'M17.2 3.2C17.2 3.2 14.5 6.6 14.5 8.8C14.5 10.4 15.7 11.6 17.2 11.6C18.7 11.6 19.9 10.4 19.9 8.8C19.9 6.6 17.2 3.2 17.2 3.2Z',
        fill: 'currentColor',
        'fill-opacity': '0.24',
        stroke: 'currentColor',
        'stroke-width': '1.75',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      },
    },
    {
      tag: 'path',
      attrs: {
        d: 'M4 21C6.5 19.8 9 22.2 12 21C15 19.8 17.5 22.2 20 21',
        stroke: 'currentColor',
        'stroke-width': '1.85',
        'stroke-linecap': 'round',
      },
    },
  ],

  // Reguladores Intestino: Curva intestinal equilibrada com folha probiótica
  intestine: [
    {
      tag: 'path',
      attrs: {
        d: 'M7.5 4.5H15C17.2 4.5 19 6.2 19 8.2C19 10.2 17.2 11.8 15 11.8H9C6.8 11.8 5 13.4 5 15.5C5 17.6 6.8 19.2 9 19.2H12.5C14 19.2 15 20 15 21.2',
        stroke: 'currentColor',
        'stroke-width': '2.1',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      },
    },
    {
      tag: 'path',
      attrs: {
        d: 'M7.5 4.5C5.6 4.5 4.2 6 4.2 7.8C4.2 9.6 5.6 11 7.5 11',
        stroke: 'currentColor',
        'stroke-width': '1.9',
        'stroke-linecap': 'round',
      },
    },
    {
      tag: 'circle',
      attrs: {
        cx: '12',
        cy: '11.8',
        r: '4.2',
        fill: 'currentColor',
        'fill-opacity': '0.22',
      },
    },
    {
      tag: 'path',
      attrs: {
        d: 'M17.8 14.5L18.4 16L19.9 16.6L18.4 17.2L17.8 18.7L17.2 17.2L15.7 16.6L17.2 16L17.8 14.5Z',
        fill: 'currentColor',
      },
    },
  ],

  // Performance Esportiva: Halter atlético de alta precisão com centelha de força
  sport: [
    {
      tag: 'rect',
      attrs: {
        x: '4.5',
        y: '7',
        width: '3.2',
        height: '10',
        rx: '1.2',
        fill: 'currentColor',
        'fill-opacity': '0.26',
        stroke: 'currentColor',
        'stroke-width': '1.85',
      },
    },
    {
      tag: 'rect',
      attrs: {
        x: '16.3',
        y: '7',
        width: '3.2',
        height: '10',
        rx: '1.2',
        fill: 'currentColor',
        'fill-opacity': '0.26',
        stroke: 'currentColor',
        'stroke-width': '1.85',
      },
    },
    {
      tag: 'path',
      attrs: {
        d: 'M7.7 12H16.3M2.2 9.5V14.5M21.8 9.5V14.5',
        stroke: 'currentColor',
        'stroke-width': '2',
        'stroke-linecap': 'round',
      },
    },
    {
      tag: 'path',
      attrs: {
        d: 'M12 3.2L12.6 4.8L14.2 5.4L12.6 6L12 7.6L11.4 6L9.8 5.4L11.4 4.8L12 3.2Z',
        fill: 'currentColor',
      },
    },
  ],

  // Imunidade: Escudo protetor farmacêutico com cruz de defesa
  immunity: [
    {
      tag: 'path',
      attrs: {
        d: 'M12 2.8L19.2 5.8V11.4C19.2 16.3 15.9 19.9 12 21.4C8.1 19.9 4.8 16.3 4.8 11.4V5.8L12 2.8Z',
        fill: 'currentColor',
        'fill-opacity': '0.22',
        stroke: 'currentColor',
        'stroke-width': '1.9',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      },
    },
    {
      tag: 'path',
      attrs: {
        d: 'M12 8.5V14.5M9 11.5H15',
        stroke: 'currentColor',
        'stroke-width': '2.1',
        'stroke-linecap': 'round',
      },
    },
  ],

  // Diversos / Geral: Almofariz e pistilo magistral com folha botânica
  apothecary: [
    {
      tag: 'path',
      attrs: {
        d: 'M4.5 11H19.5L18.2 16.2C17.6 18.5 15.5 20.2 13 20.2H11C8.5 20.2 6.4 18.5 5.8 16.2L4.5 11Z',
        fill: 'currentColor',
        'fill-opacity': '0.22',
        stroke: 'currentColor',
        'stroke-width': '1.9',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      },
    },
    {
      tag: 'path',
      attrs: {
        d: 'M3.5 11H20.5M8.5 20.2H15.5M14.2 11L17.5 4.8',
        stroke: 'currentColor',
        'stroke-width': '1.95',
        'stroke-linecap': 'round',
      },
    },
    {
      tag: 'path',
      attrs: {
        d: 'M8.5 5.2C8.5 5.2 11.5 4.8 12.2 7.5C12.2 7.5 9.2 8.2 8.5 5.2Z',
        fill: 'currentColor',
        stroke: 'currentColor',
        'stroke-width': '1.4',
        'stroke-linejoin': 'round',
      },
    },
  ],
};

/**
 * Cria um elemento `<svg>` semântico correspondente à categoria informada.
 * @param {string} categoryName
 * @param {string} [categoryId]
 * @param {string} [className]
 * @returns {SVGSVGElement}
 */
export function createCategoryIconElement(categoryName, categoryId = '', className = 'category-svg-icon') {
  const iconKey = resolveCategoryIconKey(categoryName, categoryId);
  const shapes = ICON_DEFINITIONS[iconKey] || ICON_DEFINITIONS.apothecary;

  const svg = /** @type {SVGSVGElement} */ (document.createElementNS(SVG_NS, 'svg'));
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  if (className) {
    svg.setAttribute('class', className);
  }

  shapes.forEach((shape) => {
    const node = document.createElementNS(SVG_NS, shape.tag);
    Object.entries(shape.attrs).forEach(([attr, val]) => {
      node.setAttribute(attr, val);
    });
    svg.appendChild(node);
  });

  return svg;
}
