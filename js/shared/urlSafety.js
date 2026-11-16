// @ts-check
/**
 * Sanitização e classificação centralizada de URLs e links (Botica Natural).
 * Fonte única de verdade para a vitrine pública e o painel administrativo.
 * Bloqueia Open Redirect por `//`, `/\`, `\/`, `\\`, esquemas perigosos
 * (`javascript:`, `data:`, `vbscript:`, `file:`, `blob:`, `intent:`) e
 * ofuscações via entidades HTML, caracteres de controle ou espaços Unicode invisíveis.
 *
 * @module js/shared/urlSafety
 */

import { SITE_DOMAIN } from '../config.js';

const CONTROL_AND_INVISIBLE_RE =
  /[\u0000-\u001F\u007F-\u009F\u00AD\u034F\u061C\u180E\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g;

const EDGE_WHITESPACE_RE =
  /^[\s\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+|[\s\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+$/g;

const ALL_WHITESPACE_RE =
  /[\s\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+/g;

const ALLOWED_SCHEMES = new Set(['https:', 'http:', 'mailto:', 'tel:']);

/**
 * Decodifica entidades HTML básicas e numéricas para inspeção de protocolo e texto.
 *
 * @param {string} str
 * @returns {string}
 */
export function decodeHtmlEntities(str) {
  return String(str ?? '')
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : '';
    })
    .replace(/&#([0-9]+);?/g, (_, dec) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : '';
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
 * Resolve a origem base padrão (browser atual ou domínio canônico do projeto).
 *
 * @param {string | undefined} explicitBaseOrigin
 * @returns {string}
 */
function resolveBaseOrigin(explicitBaseOrigin) {
  if (typeof explicitBaseOrigin === 'string' && explicitBaseOrigin.trim()) {
    try {
      const parsed = new URL(explicitBaseOrigin.trim());
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        return parsed.origin;
      }
    } catch {
      /* fallback */
    }
  }

  if (
    typeof window !== 'undefined' &&
    window.location &&
    /^https?:$/i.test(window.location.protocol)
  ) {
    return window.location.origin;
  }

  return new URL(SITE_DOMAIN).origin;
}

/**
 * @typedef {{
 *   valid: boolean,
 *   isEmpty: boolean,
 *   kind: 'https' | 'http' | 'mailto' | 'tel' | 'relative' | 'empty' | 'invalid',
 *   href: string | null,
 *   isExternal: boolean,
 *   target: '_blank' | null,
 *   rel: 'noopener noreferrer' | null,
 * }} SafeLinkClassification
 */

/**
 * Normaliza, valida e classifica um link bruto (URL absoluta ou caminho relativo).
 *
 * @param {string | null | undefined} raw
 * @param {{ baseOrigin?: string }} [options={}]
 * @returns {SafeLinkClassification}
 */
export function classifySafeLink(raw, options = {}) {
  /** @returns {SafeLinkClassification} */
  const invalid = () => ({
    valid: false,
    isEmpty: false,
    kind: 'invalid',
    href: null,
    isExternal: false,
    target: null,
    rel: null,
  });

  if (raw === null || raw === undefined) {
    return {
      valid: false,
      isEmpty: true,
      kind: 'empty',
      href: null,
      isExternal: false,
      target: null,
      rel: null,
    };
  }

  if (typeof raw !== 'string') {
    return invalid();
  }

  const rawTrimmed = raw.replace(EDGE_WHITESPACE_RE, '');
  if (!rawTrimmed) {
    return {
      valid: false,
      isEmpty: true,
      kind: 'empty',
      href: null,
      isExternal: false,
      target: null,
      rel: null,
    };
  }

  let decoded = decodeHtmlEntities(rawTrimmed);
  // Segunda passagem apenas se restarem entidades numéricas/de controle após desempacotar &amp;
  if (/&#|&(?:colon|tab|newline);/i.test(decoded)) {
    decoded = decodeHtmlEntities(decoded);
  }

  const normalized = decoded
    .replace(CONTROL_AND_INVISIBLE_RE, '')
    .replace(EDGE_WHITESPACE_RE, '');

  if (!normalized) {
    return invalid();
  }

  const compact = normalized.replace(ALL_WHITESPACE_RE, '');

  // Bloqueia prefixos protocol-relative e combinações de barra invertida (//, /\, \/, \\)
  if (
    /^[\\/]{2}/.test(normalized) ||
    /^[\\/]{2}/.test(compact) ||
    normalized.startsWith('\\') ||
    compact.startsWith('\\')
  ) {
    return invalid();
  }

  const baseOrigin = resolveBaseOrigin(options?.baseOrigin);
  const schemeMatch = compact.match(/^([a-z][a-z0-9+.-]*):/i);

  // Qualquer `:` antes do caminho/query/hash sem casar esquema válido é suspeito
  if (!schemeMatch && compact.split(/[?#]/)[0].includes(':')) {
    return invalid();
  }

  if (schemeMatch) {
    const scheme = `${schemeMatch[1].toLowerCase()}:`;
    if (!ALLOWED_SCHEMES.has(scheme)) {
      return invalid();
    }

    if (scheme === 'https:' || scheme === 'http:') {
      if (
        !/^https?:\/\//i.test(normalized) ||
        /^https?:\/\/[\\/]/i.test(normalized) ||
        /^https?:\/\/[^/?#]*[\\@]/i.test(normalized)
      ) {
        return invalid();
      }

      try {
        const parsed = new URL(normalized);
        if (
          parsed.protocol !== scheme ||
          !parsed.hostname ||
          parsed.username ||
          parsed.password
        ) {
          return invalid();
        }
        const isExternal = parsed.origin !== baseOrigin;
        return {
          valid: true,
          isEmpty: false,
          kind: scheme === 'https:' ? 'https' : 'http',
          href: parsed.href,
          isExternal,
          target: isExternal ? '_blank' : null,
          rel: isExternal ? 'noopener noreferrer' : null,
        };
      } catch {
        return invalid();
      }
    }

    // mailto: ou tel:
    if (!normalized.toLowerCase().startsWith(scheme)) {
      return invalid();
    }
    if (/[<>"']/.test(normalized)) {
      return invalid();
    }
    const targetValue = normalized.slice(scheme.length).trim();
    if (!targetValue) {
      return invalid();
    }
    if (scheme === 'tel:' && !/[0-9]/.test(targetValue)) {
      return invalid();
    }
    if (scheme === 'mailto:' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetValue.split('?')[0])) {
      return invalid();
    }

    return {
      valid: true,
      isEmpty: false,
      kind: scheme === 'mailto:' ? 'mailto' : 'tel',
      href: normalized,
      isExternal: false,
      target: null,
      rel: null,
    };
  }

  // Caminho relativo: rejeita barra invertida antes da query/hash e exige mesma origem
  const pathPart = normalized.split(/[?#]/)[0];
  if (pathPart.includes('\\')) {
    return invalid();
  }

  try {
    const parsed = new URL(normalized, baseOrigin);
    if (parsed.origin !== baseOrigin || /^[\\/]{2}/.test(parsed.pathname)) {
      return invalid();
    }

    return {
      valid: true,
      isEmpty: false,
      kind: 'relative',
      href: `${parsed.pathname}${parsed.search}${parsed.hash}`,
      isExternal: false,
      target: null,
      rel: null,
    };
  } catch {
    return invalid();
  }
}

/**
 * Helper de validação booleana para campos opcionais de navegação (banners e compostos),
 * aceitando apenas vazio, `https:`, `http:` ou caminho relativo de mesma origem.
 *
 * @param {string | null | undefined} raw
 * @param {{ allowEmpty?: boolean, baseOrigin?: string }} [options={}]
 * @returns {boolean}
 */
export function isSafeNavigationLink(raw, options = {}) {
  const { allowEmpty = true, baseOrigin } = options;
  const classified = classifySafeLink(raw, { baseOrigin });
  if (classified.isEmpty) {
    return Boolean(allowEmpty);
  }
  if (!classified.valid) {
    return false;
  }
  return (
    classified.kind === 'https' ||
    classified.kind === 'http' ||
    classified.kind === 'relative'
  );
}
