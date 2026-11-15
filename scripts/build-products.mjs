#!/usr/bin/env node
// @ts-check
/**
 * ============================================================================
 * Botica Natural — Gerador Estático de Páginas SEO de Produtos (`build:products`)
 * ============================================================================
 * Busca produtos ativos via API REST pública (`anon` key, sem `service_role`)
 * e gera páginas estáticas indexáveis em `produtos/<slug>/index.html`, além
 * de reescrever `sitemap.xml` sem listar `produto.html`.
 *
 * Modos:
 *   node scripts/build-products.mjs             -> Tenta Supabase REST; fallback offline se inacessível
 *   node scripts/build-products.mjs --offline   -> Usa diretamente a base local de fallback
 * ============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BRAND_NAME,
  SITE_DOMAIN,
  WHATSAPP_PHONE,
} from '../js/config.js';
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  PUBLIC_SELECT_COLUMNS,
  isTrustedStorageUrl,
  getProductImageUrl,
} from '../js/publicApi.js';
import {
  DEFAULT_FIELD_MODES,
  extractPlainText,
  legacyPlainTextToHtml,
  normalizeTextMode,
  normalizeTextOptions,
  sanitizeRichHtml,
} from '../js/shared/richtext.js';
import { initialData as FALLBACK_SEED_DATA } from '../tests/e2e/fixtures/fake-supabase.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT_DIR = path.resolve(path.dirname(__filename), '..');
const PRODUCTS_OUT_DIR = path.join(ROOT_DIR, 'produtos');
const TEMPLATE_PATH = path.join(ROOT_DIR, 'produto.html');
const SITEMAP_PATH = path.join(ROOT_DIR, 'sitemap.xml');

const FORCE_OFFLINE = process.argv.includes('--offline') || process.argv.includes('--fallback');

/**
 * Escapa caracteres especiais para uso seguro em HTML / atributos.
 * @param {unknown} raw
 * @returns {string}
 */
function escapeHtml(raw) {
  return String(raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Converte um nome ou slug em slug URL-safe compatível com `^[a-z0-9]+(-[a-z0-9]+)*$`.
 * @param {string} rawText
 * @returns {string}
 */
function toUrlSlug(rawText) {
  return String(rawText || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Resolve e deduplica slugs garantindo unicidade para todos os produtos ativos.
 * @param {Array<Record<string, any>>} products
 * @returns {Array<Record<string, any>>}
 */
function assignUniqueSlugs(products) {
  /** @type {Set<string>} */
  const used = new Set();
  return products.map((prod) => {
    const rawCandidate = toUrlSlug(prod.slug || prod.name);
    const idShort = toUrlSlug(String(prod.id || '')).slice(0, 6) || 'item';
    let base = rawCandidate || `produto-${idShort}`;
    let finalSlug = base;
    if (used.has(finalSlug)) {
      finalSlug = `${base}-${idShort}`;
      let suffix = 2;
      while (used.has(finalSlug)) {
        finalSlug = `${base}-${suffix}`;
        suffix += 1;
      }
    }
    used.add(finalSlug);
    return { ...prod, slug: finalSlug };
  });
}

/**
 * Formata valor numérico para moeda BRL (`R$ 0,00`).
 * @param {number} value
 * @returns {string}
 */
function formatBRL(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Busca produtos ativos na REST API pública do Supabase com fallback de colunas e offline.
 * @returns {Promise<{ products: Array<Record<string, any>>, source: 'supabase' | 'fallback' }>}
 */
async function loadActiveProducts() {
  const effectiveUrl = String(process.env.SUPABASE_URL || SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const effectiveAnonKey = String(process.env.SUPABASE_ANON_KEY || SUPABASE_ANON_KEY || '').trim();

  if (!FORCE_OFFLINE && effectiveUrl && effectiveAnonKey) {
    const trySelect = async (/** @type {string} */ selectCols) => {
      const endpoint =
        `${effectiveUrl}/rest/v1/products` +
        `?is_active=eq.true&select=${encodeURIComponent(selectCols)}&order=created_at.desc`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch(endpoint, {
          method: 'GET',
          headers: {
            apikey: effectiveAnonKey,
            Authorization: `Bearer ${effectiveAnonKey}`,
            Accept: 'application/json',
          },
          signal: controller.signal,
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          return { ok: false, status: res.status, errText, rows: null };
        }
        const rows = await res.json();
        return { ok: true, status: res.status, errText: '', rows: Array.isArray(rows) ? rows : [] };
      } finally {
        clearTimeout(timer);
      }
    };

    try {
      let attempt = await trySelect(PUBLIC_SELECT_COLUMNS.PRODUCTS);
      if (!attempt.ok && attempt.status === 400) {
        attempt = await trySelect('*,categories(id,name,slug)');
      }
      if (attempt.ok && attempt.rows) {
        return {
          products: attempt.rows.filter((p) => p && p.is_active !== false),
          source: 'supabase',
        };
      }
      console.warn(`[build-products] Aviso REST (${attempt.status}); usando catálogo de fallback offline.`);
    } catch (err) {
      console.warn(`[build-products] Rede indisponível (${/** @type {Error} */ (err).message}); usando catálogo de fallback offline.`);
    }
  }

  const categoryMap = new Map(
    (FALLBACK_SEED_DATA.categories || []).map((c) => [c.id, c])
  );
  const seeded = (FALLBACK_SEED_DATA.products || [])
    .filter((p) => p && p.is_active !== false)
    .map((p) => ({
      ...p,
      categories: p.category_id ? categoryMap.get(p.category_id) || null : null,
    }));

  return { products: seeded, source: 'fallback' };
}

/**
 * Converte campo rico (v2 HTML ou legado texto) para HTML seguro pronto para injeção estática.
 * @param {Record<string, any>} product
 * @param {keyof typeof DEFAULT_FIELD_MODES} fieldName
 * @returns {string}
 */
function renderProductFieldHtml(product, fieldName) {
  const raw = String(product[fieldName] || '').trim();
  if (!raw) return '';
  const isV2 = Boolean(product?.text_options && Number(product.text_options._v) === 2);
  const modes = normalizeTextOptions(product?.text_options);
  const mode = normalizeTextMode(modes[fieldName], DEFAULT_FIELD_MODES[fieldName]);
  const prepared = isV2 ? raw : legacyPlainTextToHtml(raw, { mode });
  return sanitizeRichHtml(prepared, { mode });
}

/**
 * Resolve a imagem estática segura para o produto dentro de `produtos/<slug>/index.html`.
 * @param {Record<string, any>} product
 * @returns {{ imgSrc: string, ogImageUrl: string }}
 */
function resolveStaticProductImages(product) {
  let trustedRemote = '';
  const rawUrl = String(product.image_url || '').trim();
  if (rawUrl && isTrustedStorageUrl(rawUrl)) {
    trustedRemote = rawUrl;
  } else if (product.image_path) {
    const publicStorage = getProductImageUrl(String(product.image_path).trim());
    if (isTrustedStorageUrl(publicStorage)) {
      trustedRemote = publicStorage;
    }
  }

  if (trustedRemote) {
    return {
      imgSrc: trustedRemote,
      ogImageUrl: trustedRemote,
    };
  }

  return {
    imgSrc: '../../images/logo.png',
    ogImageUrl: `${SITE_DOMAIN}/images/og-image.jpg`,
  };
}

/**
 * Constrói o link oficial de WhatsApp para o produto estático.
 * @param {Record<string, any>} product
 * @param {string} canonicalUrl
 * @returns {string}
 */
function buildStaticWhatsAppHref(product, canonicalUrl) {
  const name = String(product.name || 'Fórmula Manipulada').trim();
  const sku = String(product.sku_ref || '').trim();
  const skuNote = sku ? ` (REF: ${sku.replace(/^REF:\s*/i, '')})` : '';
  const msg = `Olá! Gostaria de solicitar um orçamento de *${name}*${skuNote}.\nLink: ${canonicalUrl}`;
  return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(msg)}`;
}

/**
 * Reescreve caminhos relativos de root para `../../` no HTML gerado em `produtos/<slug>/index.html`.
 * @param {string} html
 * @returns {string}
 */
function rewriteRootRelativeRefs(html) {
  return html
    .replace(
      /\b(href|src)=["'](favicon\.ico|images\/[^"']+|css\/[^"']+|js\/[^"']+|index\.html[^"']*|produtos\.html[^"']*|privacidade\.html[^"']*|produto\.html[^"']*)["']/gi,
      (_m, attr, val) => `${attr}="../../${val}"`
    )
    .replace(
      /\bsrcset=["'](images\/[^"']+)["']/gi,
      (_m, val) => `srcset="../../${val}"`
    );
}

/**
 * Renderiza o HTML completo e indexável para um único produto.
 * @param {string} baseTemplate
 * @param {Record<string, any>} product
 * @returns {string}
 */
function buildProductPageHtml(baseTemplate, product) {
  const slug = String(product.slug);
  const canonicalUrl = `${SITE_DOMAIN}/produtos/${encodeURIComponent(slug)}/`;
  const productName = String(product.name || 'Fórmula Manipulada').trim();
  const categoryName = String(product.categories?.name || 'Fórmulas Manipuladas').trim();
  const numericPrice = Number(product.price);
  const hasValidPrice = Number.isFinite(numericPrice) && numericPrice > 0;
  const formattedPrice = hasValidPrice ? formatBRL(numericPrice) : 'Sob consulta';

  const plainDesc = (
    extractPlainText(product.short_description) ||
    extractPlainText(product.description) ||
    `Fórmula manipulada sob medida na ${BRAND_NAME} com rigoroso controle de qualidade farmacêutico.`
  )
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);

  const pageTitle = `${productName} | ${BRAND_NAME} — Farmácia de Manipulação`;
  const { imgSrc, ogImageUrl } = resolveStaticProductImages(product);
  const waHref = buildStaticWhatsAppHref(product, canonicalUrl);

  /** @type {Record<string, any>} */
  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: productName,
    description: plainDesc,
    image: ogImageUrl,
    brand: {
      '@type': 'Brand',
      name: BRAND_NAME,
    },
  };
  const skuRaw = String(product.sku_ref || '').trim();
  if (skuRaw) {
    productSchema.sku = skuRaw;
  }
  if (hasValidPrice) {
    productSchema.offers = {
      '@type': 'Offer',
      url: canonicalUrl,
      priceCurrency: 'BRL',
      price: numericPrice.toFixed(2),
      availability: 'https://schema.org/InStock',
    };
  }

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Início', item: `${SITE_DOMAIN}/` },
      { '@type': 'ListItem', position: 2, name: 'Catálogo de Fórmulas', item: `${SITE_DOMAIN}/produtos` },
      { '@type': 'ListItem', position: 3, name: productName, item: canonicalUrl },
    ],
  };

  let out = rewriteRootRelativeRefs(baseTemplate);

  // Remove noindex de produto.html e injeta metadados de identificação para hidratação ao vivo
  out = out.replace(/^\s*<meta\s+name=["']robots["'][^>]*>\r?\n?/im, '');
  out = out.replace(
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escapeHtml(pageTitle)}</title>\n` +
      `    <meta name="bn:product-id" content="${escapeHtml(product.id)}">\n` +
      `    <meta name="bn:product-slug" content="${escapeHtml(slug)}">`
  );

  out = out.replace(
    /<meta\s+name=["']description["']\s+content=["'][^"']*["']>/i,
    `<meta name="description" content="${escapeHtml(plainDesc)}">`
  );
  out = out.replace(
    /<link\s+rel=["']canonical["']\s+href=["'][^"']*["']>/i,
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}">`
  );
  out = out.replace(
    /<meta\s+property=["']og:title["']\s+content=["'][^"']*["']>/i,
    `<meta property="og:title" content="${escapeHtml(`${productName} | ${BRAND_NAME}`)}">`
  );
  out = out.replace(
    /<meta\s+property=["']og:description["']\s+content=["'][^"']*["']>/i,
    `<meta property="og:description" content="${escapeHtml(plainDesc)}">`
  );
  out = out.replace(
    /<meta\s+property=["']og:url["']\s+content=["'][^"']*["']>/i,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}">`
  );
  out = out.replace(
    /<meta\s+property=["']og:image["']\s+content=["'][^"']*["']>/i,
    `<meta property="og:image" content="${escapeHtml(ogImageUrl)}">`
  );

  // Injeta JSON-LD no </head>
  out = out.replace(
    /<\/head>/i,
    `    <script id="product-jsonld" type="application/ld+json">${JSON.stringify(productSchema)}</script>\n` +
      `    <script id="product-breadcrumb-jsonld" type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>\n</head>`
  );

  // Preenche HTML estático semântico da ficha técnica (mantém hidden removido para SSR)
  out = out.replace(
    /<span id="pdp-breadcrumb-cat">[\s\S]*?<\/span>/,
    `<span id="pdp-breadcrumb-cat">${escapeHtml(categoryName)}</span>`
  );
  out = out.replace(
    /<span id="pdp-breadcrumb-current" aria-current="page">[\s\S]*?<\/span>/,
    `<span id="pdp-breadcrumb-current" aria-current="page">${escapeHtml(productName)}</span>`
  );

  out = out.replace(
    /<div id="pdp-skeleton" class="pdp-skeleton" aria-busy="true" aria-live="polite">/,
    '<div id="pdp-skeleton" class="pdp-skeleton" aria-busy="false" aria-live="polite" hidden>'
  );
  out = out.replace(
    /<article id="pdp-content" class="pdp-article" hidden>/,
    '<article id="pdp-content" class="pdp-article">'
  );

  out = out.replace(
    /<img id="pdp-thumb-img" class="pdp-thumb-img" src="" alt="Miniatura do produto"/,
    `<img id="pdp-thumb-img" class="pdp-thumb-img" src="${escapeHtml(imgSrc)}" alt="Miniatura de ${escapeHtml(productName)}"`
  );
  out = out.replace(
    /<img id="pdp-main-img" class="pdp-main-img" src="" alt="Foto do produto"/,
    `<img id="pdp-main-img" class="pdp-main-img" src="${escapeHtml(imgSrc)}" alt="${escapeHtml(productName)} — ${BRAND_NAME}"`
  );

  out = out.replace(
    /<h1 id="pdp-title" class="pdp-product-title" data-field="name">[\s\S]*?<\/h1>/,
    `<h1 id="pdp-title" class="pdp-product-title" data-field="name">${escapeHtml(productName)}</h1>`
  );

  if (skuRaw) {
    const formattedSku = skuRaw.toUpperCase().startsWith('REF') ? skuRaw : `REF: ${skuRaw}`;
    out = out.replace(
      /<span id="pdp-sku" class="pdp-sku-badge" data-field="sku_ref" hidden>REF: 0000<\/span>/,
      `<span id="pdp-sku" class="pdp-sku-badge" data-field="sku_ref">${escapeHtml(formattedSku)}</span>`
    );
  }

  const shortDescHtml = renderProductFieldHtml(product, 'short_description') || renderProductFieldHtml(product, 'description');
  if (shortDescHtml) {
    out = out.replace(
      /<div id="pdp-short-desc" class="pdp-short-desc pd-richtext" data-field="short_description"><\/div>/,
      `<div id="pdp-short-desc" class="pdp-short-desc pd-richtext" data-field="short_description">${shortDescHtml}</div>`
    );
  }

  out = out.replace(
    /<strong id="pdp-price" class="pdp-price-val">[\s\S]*?<\/strong>/,
    `<strong id="pdp-price" class="pdp-price-val">${escapeHtml(formattedPrice)}</strong>`
  );

  const paymentHtml = renderProductFieldHtml(product, 'payment_info');
  if (paymentHtml) {
    out = out.replace(
      /<span id="pdp-payment-text">[\s\S]*?<\/span>/,
      `<span id="pdp-payment-text">${paymentHtml}</span>`
    );
  }

  out = out.replace(
    /(<a\s+id="pdp-btn-buy"[\s\S]*?\bhref=")[^"]*(")/i,
    `$1${escapeHtml(waHref)}$2`
  );
  out = out.replace(
    /(<a\s+class="btn btn--wa btn--lg btn--block"\s+id="pdp-mobile-buy-btn"\s+href=")[^"]*(")/i,
    `$1${escapeHtml(waHref)}$2`
  );

  /** @type {Array<[string, string, keyof typeof DEFAULT_FIELD_MODES]>} */
  const richFieldBindings = [
    ['pdp-desc-full', '', 'description'],
    ['pdp-desc-usage-block', 'pdp-desc-usage-text', 'usage_instructions'],
    ['pdp-desc-composition-block', 'pdp-desc-composition-text', 'composition'],
    ['pdp-desc-package-block', 'pdp-desc-package-text', 'package_info'],
    ['pdp-desc-allergens-block', 'pdp-desc-allergens-text', 'allergen_info'],
    ['pdp-desc-quality-block', 'pdp-desc-quality-text', 'quality_note'],
  ];

  for (const [blockId, textId, fieldName] of richFieldBindings) {
    const fieldHtml = renderProductFieldHtml(product, fieldName);
    if (!fieldHtml) continue;

    if (!textId) {
      out = out.replace(
        new RegExp(`<div id="${blockId}" class="([^"]+)" data-field="${fieldName}" hidden><\\/div>`),
        `<div id="${blockId}" class="$1" data-field="${fieldName}">${fieldHtml}</div>`
      );
    } else {
      out = out.replace(
        new RegExp(`(<div id="${blockId}"[^>]*?)\\s+hidden>`),
        '$1>'
      );
      out = out.replace(
        new RegExp(`<div id="${textId}" class="([^"]+)"><\\/div>`),
        `<div id="${textId}" class="$1">${fieldHtml}</div>`
      );
    }
  }

  return out;
}

/**
 * Formata data ISO para `<lastmod>` (`YYYY-MM-DD`).
 * @param {unknown} rawDate
 * @returns {string}
 */
function toIsoDateOnly(rawDate) {
  const parsed = rawDate ? new Date(String(rawDate)) : new Date();
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return parsed.toISOString().slice(0, 10);
}

/**
 * Gera `sitemap.xml` completo listando rotas institucionais e todas as páginas `/produtos/<slug>/`.
 * Nunca lista `produto.html` (`noindex`).
 * @param {Array<Record<string, any>>} products
 * @returns {string}
 */
function buildSitemapXml(products) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: `${SITE_DOMAIN}/`, lastmod: today, changefreq: 'weekly', priority: '1.0' },
    { loc: `${SITE_DOMAIN}/produtos`, lastmod: today, changefreq: 'daily', priority: '0.9' },
    { loc: `${SITE_DOMAIN}/privacidade`, lastmod: today, changefreq: 'yearly', priority: '0.3' },
  ];

  for (const prod of products) {
    urls.push({
      loc: `${SITE_DOMAIN}/produtos/${encodeURIComponent(String(prod.slug))}/`,
      lastmod: toIsoDateOnly(prod.updated_at || prod.created_at),
      changefreq: 'weekly',
      priority: '0.8',
    });
  }

  const urlNodes = urls
    .map(
      (u) =>
        `  <url>\n` +
        `    <loc>${escapeHtml(u.loc)}</loc>\n` +
        `    <lastmod>${escapeHtml(u.lastmod)}</lastmod>\n` +
        `    <changefreq>${u.changefreq}</changefreq>\n` +
        `    <priority>${u.priority}</priority>\n` +
        `  </url>`
    )
    .join('\n');

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<!-- [PREENCHER: confirmar domínio oficial de produção nas tags <loc> abaixo] -->\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${urlNodes}\n` +
    `</urlset>\n`
  );
}

async function main() {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    console.error('Erro: template produto.html não encontrado.');
    process.exit(1);
  }

  const baseTemplate = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  const { products: rawProducts, source } = await loadActiveProducts();
  const products = assignUniqueSlugs(rawProducts);

  fs.mkdirSync(PRODUCTS_OUT_DIR, { recursive: true });

  const targetSlugs = new Set(products.map((p) => String(p.slug)));
  for (const entry of fs.readdirSync(PRODUCTS_OUT_DIR, { withFileTypes: true })) {
    if (entry.isDirectory() && !targetSlugs.has(entry.name)) {
      fs.rmSync(path.join(PRODUCTS_OUT_DIR, entry.name), { recursive: true, force: true });
    }
  }

  for (const product of products) {
    const prodDir = path.join(PRODUCTS_OUT_DIR, String(product.slug));
    fs.mkdirSync(prodDir, { recursive: true });
    const html = buildProductPageHtml(baseTemplate, product);
    fs.writeFileSync(path.join(prodDir, 'index.html'), html, 'utf8');
  }

  const sitemapXml = buildSitemapXml(products);
  fs.writeFileSync(SITEMAP_PATH, sitemapXml, 'utf8');

  console.log(
    `[build-products] ${products.length} página(s) gerada(s) em produtos/<slug>/index.html (fonte: ${source}) e sitemap.xml atualizado.`
  );
}

main().catch((err) => {
  console.error('[build-products] Falha fatal:', err);
  process.exit(1);
});
