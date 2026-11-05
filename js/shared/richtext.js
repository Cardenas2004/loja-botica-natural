// @ts-check
/**
 * Sanitizador de HTML e utilitários de Texto Rico (Botica Natural).
 * Compatível com navegadores (DOMParser nativo) e Node.js (parser AST puro sem dependências).
 */

/** @typedef {'paragraphs' | 'lines' | 'inline'} TextMode */

/** Modos padrão por campo de texto do produto */
export const DEFAULT_FIELD_MODES = Object.freeze({
  short_description: 'lines',
  description: 'paragraphs',
  usage_instructions: 'paragraphs',
  composition: 'paragraphs',
  package_info: 'lines',
  allergen_info: 'inline',
  quality_note: 'paragraphs',
  payment_info: 'inline',
});

/** Limites de caracteres visíveis recomendados por campo */
export const FIELD_CHAR_LIMITS = Object.freeze({
  short_description: 280,
  description: 4000,
  usage_instructions: 2500,
  composition: 2500,
  package_info: 1200,
  allergen_info: 500,
  quality_note: 800,
  payment_info: 220,
  whatsapp_message: 1000,
});

/** Tags cujo conteúdo interno deve ser integralmente descartado por segurança */
const DROP_WITH_CONTENT_TAGS = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'svg',
  'math',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'option',
  'noscript',
  'template',
  'head',
  'meta',
  'link',
  'base',
  'applet',
  'frame',
  'frameset',
  'video',
  'audio',
  'source',
  'track',
  'canvas',
  'map',
  'area',
  'img',
]);

/** Tags void do HTML que não possuem tag de fechamento */
const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

/** Tags de bloco que geram quebras estruturais */
const BLOCK_LEVEL_TAGS = new Set([
  'p',
  'div',
  'section',
  'article',
  'header',
  'footer',
  'main',
  'aside',
  'nav',
  'blockquote',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'pre',
  'table',
  'tr',
]);

/** Whitelist de tags permitidas por modo */
const ALLOWED_TAGS_BY_MODE = {
  paragraphs: new Set([
    'p',
    'br',
    'strong',
    'em',
    'u',
    's',
    'ul',
    'ol',
    'li',
    'h3',
    'h4',
    'blockquote',
    'a',
  ]),
  lines: new Set(['br', 'strong', 'em', 'u', 's', 'a']),
  inline: new Set(['strong', 'em', 'u', 's', 'a']),
};

/**
 * Normaliza o modo de texto para um valor válido.
 * @param {string | undefined | null} mode
 * @param {TextMode} [fallback='paragraphs']
 * @returns {TextMode}
 */
export function normalizeTextMode(mode, fallback = 'paragraphs') {
  if (mode === 'paragraphs' || mode === 'lines' || mode === 'inline') {
    return mode;
  }
  return fallback;
}

/**
 * Escapa caracteres especiais HTML em texto puro.
 * @param {string} value
 * @returns {string}
 */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Decodifica entidades HTML básicas e numéricas para inspeção de protocolo e texto.
 * @param {string} str
 * @returns {string}
 */
function decodeHtmlEntities(str) {
  return String(str ?? '')
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&#([0-9]+);?/g, (_, dec) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&colon;/gi, ':')
    .replace(/&tab;/gi, '\t')
    .replace(/&newline;/gi, '\n')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&');
}

/**
 * Valida e normaliza o atributo `href` de links `<a>`.
 * Permite apenas `https:`, `http:`, `mailto:`, `tel:` ou caminhos relativos seguros.
 * @param {string | null | undefined} rawHref
 * @returns {string | null}
 */
export function sanitizeLinkHref(rawHref) {
  if (typeof rawHref !== 'string') return null;

  const trimmed = rawHref.trim();
  if (!trimmed) return null;

  // Decodifica entidades e remove caracteres de controle/espaços invisíveis para checar o esquema real
  const decoded = decodeHtmlEntities(trimmed);
  const compactSchemeCheck = decoded.replace(/[\u0000-\u0020\u007f-\u009f]+/g, '').toLowerCase();

  // Bloqueia protocolo relativo //evil.com ou barras invertidas
  if (compactSchemeCheck.startsWith('//') || compactSchemeCheck.startsWith('\\\\')) {
    return null;
  }

  // Verifica se possui esquema explícito
  const schemeMatch = compactSchemeCheck.match(/^([a-z][a-z0-9+.-]*):/i);
  if (schemeMatch) {
    const scheme = `${schemeMatch[1].toLowerCase()}:`;
    if (scheme !== 'https:' && scheme !== 'http:' && scheme !== 'mailto:' && scheme !== 'tel:') {
      return null;
    }

    if (scheme === 'https:' || scheme === 'http:') {
      try {
        const parsed = new URL(decoded.trim());
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
        return parsed.href;
      } catch {
        return null;
      }
    }

    // mailto: ou tel: sem caracteres de controle nem tags
    const cleanTarget = decoded.trim().replace(/[\u0000-\u001f\u007f<>"]/g, '');
    return cleanTarget || null;
  }

  // Sem esquema: aceita caminho relativo seguro (/produtos, #ancora, produtos.html)
  if (compactSchemeCheck.includes(':')) {
    return null;
  }

  const cleanRelative = decoded.trim().replace(/[\u0000-\u001f\u007f<>"]/g, '');
  return cleanRelative || null;
}

/**
 * Detecta se uma string contém marcação HTML estrutural da whitelist ou se é texto puro legado.
 * @param {string} raw
 * @returns {boolean}
 */
export function isLikelyRichHtml(raw) {
  if (!raw || typeof raw !== 'string') return false;
  return /<\/?(p|br|strong|b|em|i|u|s|ul|ol|li|h[1-6]|blockquote|a|div|span|script|style|iframe|img|svg|form|object|embed)\b/i.test(
    raw
  );
}

/**
 * Converte texto puro legado (com `\n`) para HTML estruturado conforme o modo.
 * @param {string} plainText
 * @param {TextMode} mode
 * @returns {string}
 */
function convertPlainTextToHtml(plainText, mode) {
  const normalized = String(plainText ?? '').replace(/\r\n?/g, '\n').trim();
  if (!normalized) return '';

  if (mode === 'inline') {
    return escapeHtml(normalized.replace(/\s*\n+\s*/g, ' ').replace(/\s{2,}/g, ' '));
  }

  if (mode === 'lines') {
    return normalized
      .split('\n')
      .map((line) => escapeHtml(line))
      .join('<br>');
  }

  // Modo 'paragraphs': blocos separados por linha em branco viram <p>, quebras simples viram <br>
  const blocks = normalized
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks
    .map((block) => {
      const inner = block
        .split('\n')
        .map((line) => escapeHtml(line.trim()))
        .join('<br>');
      return `<p>${inner}</p>`;
    })
    .join('');
}

/**
 * Parser leve de HTML para árvore AST pura (usado em Node.js e como motor unificado).
 * @param {string} html
 * @returns {{ type: 'root', children: Array<any> }}
 */
function parseHtmlToAst(html) {
  const root = { type: 'root', children: [] };
  const stack = [root];
  const tagRegex = /<!--[\s\S]*?-->|<\/?([a-zA-Z][a-zA-Z0-9:-]*)(\s[^<>]*?)?\s*\/?>/g;
  let lastIndex = 0;
  let match;

  while ((match = tagRegex.exec(html)) !== null) {
    if (match.index > lastIndex) {
      const rawText = html.slice(lastIndex, match.index);
      if (rawText) {
        stack[stack.length - 1].children.push({
          type: 'text',
          value: decodeHtmlEntities(rawText),
        });
      }
    }
    lastIndex = tagRegex.lastIndex;

    const fullToken = match[0];
    if (fullToken.startsWith('<!--')) {
      continue;
    }

    const isClosing = fullToken.startsWith('</');
    const tagName = String(match[1] || '').toLowerCase();
    const attrString = match[2] || '';
    const isSelfClosing = fullToken.endsWith('/>') || VOID_TAGS.has(tagName);

    if (isClosing) {
      for (let i = stack.length - 1; i >= 1; i -= 1) {
        if (stack[i].tag === tagName) {
          stack.length = i;
          break;
        }
      }
      continue;
    }

    /** @type {Record<string, string>} */
    const attrs = {};
    if (attrString) {
      const attrRegex =
        /([a-zA-Z_:][a-zA-Z0-9_.:-]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
      let attrMatch;
      while ((attrMatch = attrRegex.exec(attrString)) !== null) {
        const attrName = attrMatch[1].toLowerCase();
        const attrVal = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? '';
        attrs[attrName] = attrVal;
      }
    }

    const node = {
      type: 'element',
      tag: tagName,
      attrs,
      children: [],
    };

    stack[stack.length - 1].children.push(node);
    if (!isSelfClosing) {
      stack.push(node);
    }
  }

  if (lastIndex < html.length) {
    const tailText = html.slice(lastIndex);
    if (tailText) {
      stack[stack.length - 1].children.push({
        type: 'text',
        value: decodeHtmlEntities(tailText),
      });
    }
  }

  return root;
}

/**
 * Converte um DOM Node do navegador (`DOMParser`) para a mesma estrutura AST.
 * @param {Node} domNode
 * @returns {any}
 */
function domNodeToAst(domNode) {
  if (domNode.nodeType === 3) {
    return { type: 'text', value: domNode.nodeValue || '' };
  }
  if (domNode.nodeType !== 1) {
    return null;
  }

  const el = /** @type {Element} */ (domNode);
  const tag = el.tagName.toLowerCase();
  /** @type {Record<string, string>} */
  const attrs = {};
  for (let i = 0; i < el.attributes.length; i += 1) {
    const attr = el.attributes[i];
    attrs[attr.name.toLowerCase()] = attr.value;
  }

  const children = [];
  for (let i = 0; i < el.childNodes.length; i += 1) {
    const childAst = domNodeToAst(el.childNodes[i]);
    if (childAst) children.push(childAst);
  }

  return { type: 'element', tag, attrs, children };
}

/**
 * Constrói a AST a partir do HTML bruto usando `DOMParser` quando disponível no navegador.
 * @param {string} html
 * @returns {{ type: 'root', children: Array<any> }}
 */
function buildAstFromHtml(html) {
  // Remove iterativamente blocos perigosos completos antes de limpar tags órfãs
  let stripped = html;
  let previous;
  do {
    previous = stripped;
    stripped = stripped.replace(
      /<(script|style|iframe|object|embed|svg|math|form|noscript|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
      ''
    );
  } while (stripped !== previous);

  stripped = stripped
    .replace(
      /<(script|style|iframe|object|embed|svg|math|form|noscript|template)\b[^>]*\/?>/gi,
      ''
    )
    .replace(
      /<\/(script|style|iframe|object|embed|svg|math|form|noscript|template)\s*>/gi,
      ''
    );

  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(stripped, 'text/html');
      const root = { type: 'root', children: [] };
      if (doc && doc.body) {
        for (let i = 0; i < doc.body.childNodes.length; i += 1) {
          const childAst = domNodeToAst(doc.body.childNodes[i]);
          if (childAst) root.children.push(childAst);
        }
        return root;
      }
    } catch {
      // Fallback para o parser puro
    }
  }

  return parseHtmlToAst(stripped);
}

/**
 * Normaliza o nome da tag (`b` -> `strong`, `i` -> `em`, `h1`/`h2` -> `h3`, `h5`/`h6` -> `h4`).
 * @param {string} rawTag
 * @returns {string}
 */
function normalizeTagName(rawTag) {
  const tag = String(rawTag || '').toLowerCase();
  if (tag === 'b') return 'strong';
  if (tag === 'i') return 'em';
  if (tag === 'strike' || tag === 'del') return 's';
  if (tag === 'h1' || tag === 'h2') return 'h3';
  if (tag === 'h5' || tag === 'h6') return 'h4';
  return tag;
}

/**
 * Serializa uma lista de nós AST sanitizados para string HTML.
 * @param {Array<any>} nodes
 * @returns {string}
 */
function serializeAstNodes(nodes) {
  let out = '';
  for (const node of nodes) {
    if (!node) continue;
    if (node.type === 'text') {
      out += escapeHtml(node.value);
    } else if (node.type === 'element') {
      if (node.tag === 'br') {
        out += '<br>';
        continue;
      }
      let attrStr = '';
      if (node.tag === 'a' && node.attrs?.href) {
        attrStr = ` href="${escapeHtml(node.attrs.href)}" target="_blank" rel="noopener noreferrer"`;
      }
      const inner = serializeAstNodes(node.children || []);
      out += `<${node.tag}${attrStr}>${inner}</${node.tag}>`;
    }
  }
  return out;
}

/**
 * Percorre e limpa recursivamente os nós da AST conforme o modo selecionado.
 * @param {Array<any>} nodes
 * @param {TextMode} mode
 * @param {boolean} [insideList=false]
 * @returns {Array<any>}
 */
function sanitizeAstNodes(nodes, mode, insideList = false) {
  const allowedTags = ALLOWED_TAGS_BY_MODE[mode];
  /** @type {Array<any>} */
  const result = [];

  for (const node of nodes) {
    if (!node) continue;

    if (node.type === 'text') {
      let textVal = String(node.value ?? '');
      if (mode === 'inline') {
        textVal = textVal.replace(/\r?\n+/g, ' ');
      }
      if (textVal) {
        result.push({ type: 'text', value: textVal });
      }
      continue;
    }

    if (node.type !== 'element') continue;

    const rawTag = String(node.tag || '').toLowerCase();
    if (DROP_WITH_CONTENT_TAGS.has(rawTag)) {
      continue;
    }

    const tag = normalizeTagName(rawTag);

    // Tratamento de <br>
    if (tag === 'br') {
      if (mode === 'inline') {
        result.push({ type: 'text', value: ' ' });
      } else {
        result.push({ type: 'element', tag: 'br', attrs: {}, children: [] });
      }
      continue;
    }

    // Listas <ul> e <ol> só podem conter <li> diretamente no modo 'paragraphs'
    if ((tag === 'ul' || tag === 'ol') && mode === 'paragraphs') {
      const sanitizedChildren = sanitizeAstNodes(node.children || [], mode, true).filter(
        (child) => child.type === 'element' && child.tag === 'li'
      );
      if (sanitizedChildren.length > 0) {
        result.push({
          type: 'element',
          tag,
          attrs: {},
          children: sanitizedChildren,
        });
      }
      continue;
    }

    // Se encontrar <li> fora de <ul>/<ol>, envolve em <ul> no modo paragraphs
    if (tag === 'li' && mode === 'paragraphs') {
      const liChildren = sanitizeAstNodes(node.children || [], mode, false);
      const liNode = { type: 'element', tag: 'li', attrs: {}, children: liChildren };
      if (insideList) {
        result.push(liNode);
      } else {
        result.push({ type: 'element', tag: 'ul', attrs: {}, children: [liNode] });
      }
      continue;
    }

    // Tratamento de <a>
    if (tag === 'a') {
      const safeHref = sanitizeLinkHref(node.attrs?.href);
      const childNodes = sanitizeAstNodes(node.children || [], mode, false);
      if (!safeHref) {
        // Sem href seguro: desenrola mantendo apenas o texto/filhos
        result.push(...childNodes);
      } else if (childNodes.length > 0) {
        result.push({
          type: 'element',
          tag: 'a',
          attrs: {
            href: safeHref,
            target: '_blank',
            rel: 'noopener noreferrer',
          },
          children: childNodes,
        });
      }
      continue;
    }

    // Se a tag está na whitelist do modo atual
    if (allowedTags.has(tag)) {
      const childNodes = sanitizeAstNodes(node.children || [], mode, false);
      result.push({
        type: 'element',
        tag,
        attrs: {},
        children: childNodes,
      });
      continue;
    }

    // Tag não permitida no modo atual (ex: <div>, <span>, <p> em 'lines'/'inline')
    const unwrappedChildren = sanitizeAstNodes(node.children || [], mode, insideList);
    if (unwrappedChildren.length > 0) {
      const isBlock = BLOCK_LEVEL_TAGS.has(rawTag) || BLOCK_LEVEL_TAGS.has(tag);
      if (isBlock && result.length > 0) {
        if (mode === 'lines') {
          const prev = result[result.length - 1];
          if (!(prev.type === 'element' && prev.tag === 'br')) {
            result.push({ type: 'element', tag: 'br', attrs: {}, children: [] });
          }
        } else if (mode === 'inline') {
          result.push({ type: 'text', value: ' ' });
        } else if (mode === 'paragraphs' && rawTag === 'div') {
          result.push({
            type: 'element',
            tag: 'p',
            attrs: {},
            children: unwrappedChildren,
          });
          continue;
        }
      }
      result.push(...unwrappedChildren);
    }
  }

  return result;
}

/**
 * No modo 'paragraphs', garante que nós inline soltos na raiz sejam agrupados em `<p>`.
 * @param {Array<any>} nodes
 * @returns {Array<any>}
 */
function wrapOrphanInlineNodesInParagraphs(nodes) {
  const blockTags = new Set(['p', 'ul', 'ol', 'h3', 'h4', 'blockquote']);
  const hasAnyBlock = nodes.some((n) => n.type === 'element' && blockTags.has(n.tag));
  if (!hasAnyBlock) {
    // Se há apenas texto/inline na raiz, envolve em um único <p> se não estiver vazio
    const trimmed = trimBrNodes(nodes);
    if (trimmed.length === 0) return [];
    const onlyWhitespace = trimmed.every(
      (n) => n.type === 'text' && !String(n.value || '').trim()
    );
    if (onlyWhitespace) return [];
    return [{ type: 'element', tag: 'p', attrs: {}, children: trimmed }];
  }

  /** @type {Array<any>} */
  const grouped = [];
  /** @type {Array<any>} */
  let inlineBuffer = [];

  const flushBuffer = () => {
    const cleaned = trimBrNodes(inlineBuffer);
    inlineBuffer = [];
    const hasContent = cleaned.some(
      (n) => n.type === 'element' || (n.type === 'text' && String(n.value || '').trim().length > 0)
    );
    if (hasContent) {
      grouped.push({ type: 'element', tag: 'p', attrs: {}, children: cleaned });
    }
  };

  for (const node of nodes) {
    if (node.type === 'element' && blockTags.has(node.tag)) {
      flushBuffer();
      // Remove parágrafos totalmente vazios
      if (node.tag === 'p') {
        const cleanedChildren = trimBrNodes(node.children || []);
        const hasVisible = cleanedChildren.some(
          (c) =>
            c.type === 'element' || (c.type === 'text' && String(c.value || '').trim().length > 0)
        );
        if (hasVisible) {
          grouped.push({ ...node, children: cleanedChildren });
        }
      } else {
        grouped.push(node);
      }
    } else {
      inlineBuffer.push(node);
    }
  }
  flushBuffer();

  return grouped;
}

/**
 * Remove tags `<br>` redundantes no início e fim de um bloco.
 * @param {Array<any>} nodes
 * @returns {Array<any>}
 */
function trimBrNodes(nodes) {
  const copy = [...nodes];
  while (copy.length > 0) {
    const first = copy[0];
    if (first.type === 'element' && first.tag === 'br') {
      copy.shift();
    } else if (first.type === 'text' && !String(first.value || '').trim()) {
      copy.shift();
    } else {
      break;
    }
  }
  while (copy.length > 0) {
    const last = copy[copy.length - 1];
    if (last.type === 'element' && last.tag === 'br') {
      copy.pop();
    } else if (last.type === 'text' && !String(last.value || '').trim()) {
      copy.pop();
    } else {
      break;
    }
  }
  return copy;
}

/**
 * Sanitiza HTML rico de acordo com a whitelist da Botica Natural e o modo do campo.
 * Também converte texto puro legado com `\n` de forma retrocompatível.
 *
 * @param {string | null | undefined} input
 * @param {{ mode?: TextMode }} [options]
 * @returns {string}
 */
export function sanitizeRichText(input, options = {}) {
  const mode = normalizeTextMode(options.mode, 'paragraphs');
  const raw = String(input ?? '').trim();
  if (!raw) return '';

  // Retrocompatibilidade: se o valor salvo não possui tags HTML conhecidas, converte quebras de linha
  if (!isLikelyRichHtml(raw)) {
    return convertPlainTextToHtml(raw, mode);
  }

  const ast = buildAstFromHtml(raw);
  let cleanNodes = sanitizeAstNodes(ast.children, mode, false);

  if (mode === 'paragraphs') {
    cleanNodes = wrapOrphanInlineNodesInParagraphs(cleanNodes);
  } else if (mode === 'lines') {
    cleanNodes = trimBrNodes(cleanNodes);
  }

  let html = serializeAstNodes(cleanNodes).trim();
  if (mode === 'inline') {
    html = html.replace(/\s{2,}/g, ' ').trim();
  }
  return html;
}

/**
 * Extrai apenas o texto visível (sem tags HTML) de um conteúdo rico ou texto puro.
 * Útil para contadores de caracteres, resumos na listagem e meta tags SEO.
 *
 * @param {string | null | undefined} htmlOrText
 * @returns {string}
 */
export function extractPlainText(htmlOrText) {
  const raw = String(htmlOrText ?? '').trim();
  if (!raw) return '';

  if (!isLikelyRichHtml(raw)) {
    return raw.replace(/\r\n?/g, '\n').trim();
  }

  const sanitized = sanitizeRichText(raw, { mode: 'lines' });
  const withLineBreaks = sanitized.replace(/<br\s*\/?>/gi, '\n').replace(/<\/?[a-z0-9]+[^>]*>/gi, '');
  return decodeHtmlEntities(withLineBreaks)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Converte um nó da AST sanitizada diretamente em um `Node` DOM real do navegador,
 * evitando atribuição de `innerHTML` no elemento de destino.
 *
 * @param {any} astNode
 * @param {Document} doc
 * @returns {Node | null}
 */
function astNodeToDom(astNode, doc) {
  if (!astNode) return null;
  if (astNode.type === 'text') {
    return doc.createTextNode(String(astNode.value ?? ''));
  }
  if (astNode.type === 'element') {
    const el = doc.createElement(astNode.tag);
    if (astNode.tag === 'a' && astNode.attrs?.href) {
      el.setAttribute('href', astNode.attrs.href);
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    }
    if (Array.isArray(astNode.children)) {
      for (const child of astNode.children) {
        const childDom = astNodeToDom(child, doc);
        if (childDom) el.appendChild(childDom);
      }
    }
    return el;
  }
  return null;
}

/**
 * Renderiza texto rico sanitizado dentro de um container DOM usando construção segura de nós.
 *
 * @param {HTMLElement | null} container
 * @param {string | null | undefined} rawContent
 * @param {{ mode?: TextMode, fallbackText?: string }} [options]
 */
export function renderSanitizedRichText(container, rawContent, options = {}) {
  if (!container) return;

  const mode = normalizeTextMode(options.mode, 'paragraphs');
  const source = String(rawContent ?? '').trim() || String(options.fallbackText ?? '').trim();

  if (!source) {
    container.replaceChildren();
    return;
  }

  const safeHtml = sanitizeRichText(source, { mode });
  const ast = parseHtmlToAst(safeHtml);
  const doc = container.ownerDocument || document;
  const fragment = doc.createDocumentFragment();

  for (const node of ast.children) {
    const domNode = astNodeToDom(node, doc);
    if (domNode) fragment.appendChild(domNode);
  }

  container.replaceChildren(fragment);
}
