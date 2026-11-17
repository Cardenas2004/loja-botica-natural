/**
 * @fileoverview Script de Verificação Automatizada — Auditoria Botica Natural (Fase 5)
 * @description Executa checagens estáticas sem dependências externas (Node.js puro):
 *   1. Consistência do número de WhatsApp em todos os arquivos do projeto.
 *   2. Ausência de dados fictícios proibidos (CNPJ 00.000.000/0001-00, CRF-RS 12345,
 *      Dr. João Silva, aggregateRating, depoimentos inventados, status falso "online agora").
 *   3. Integridade de todas as referências a arquivos locais em HTML, CSS e JS.
 *   4. Validade sintática e semântica dos blocos JSON-LD nas páginas HTML.
 *   5. Ausência de `innerHTML` com interpolação de variáveis em `js/`.
 *   6. Unicidade de `<h1>` por página HTML e presença dos arquivos obrigatórios de SEO/LGPD.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import {
  WHATSAPP_PHONE,
  PHONE_E164,
  WHATSAPP_DISPLAY,
  BRAND_NAME,
  SITE_DOMAIN,
  BUSINESS_HOURS_TEXT,
  BUSINESS_ADDRESS_TEXT,
} from '../js/config.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT_DIR = path.resolve(path.dirname(__filename), '..');

const ROOT_HTML_FILES = [
  'index.html',
  'produtos.html',
  'produto.html',
  'privacidade.html',
  '404.html',
  'admin.html',
];

/**
 * Coleta páginas estáticas geradas em `produtos/<slug>/index.html` se existirem.
 * @returns {string[]}
 */
function collectGeneratedProductHtmlFiles() {
  const produtosDir = path.join(ROOT_DIR, 'produtos');
  if (!fs.existsSync(produtosDir)) return [];
  /** @type {string[]} */
  const list = [];
  for (const entry of fs.readdirSync(produtosDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const rel = path.posix.join('produtos', entry.name, 'index.html');
    if (fs.existsSync(path.join(ROOT_DIR, rel))) {
      list.push(rel);
    }
  }
  return list.sort();
}

const GENERATED_PRODUCT_HTML_FILES = collectGeneratedProductHtmlFiles();
const HTML_FILES = [...ROOT_HTML_FILES, ...GENERATED_PRODUCT_HTML_FILES];

const CSS_FILES = ['css/style.css', 'css/product.css', 'css/admin.css', 'css/icons.css', 'css/fonts.css'];

const JS_FILES = [
  'js/config.js',
  'js/publicApi.js',
  'js/supabaseClient.js',
  'js/whatsapp.js',
  'js/main.js',
  'js/app.js',
  'js/product.js',
  'js/admin.js',
  'js/shared/richtext.js',
  'js/shared/urlSafety.js',
  'js/shared/productRenderer.js',
  'js/shared/categoryIcons.js',
  'js/shared/compoundShowcaseRenderer.js',
  'js/admin/main.js',
  'js/admin/sessionTimeout.js',
  'js/admin/state.js',
  'js/admin/ui.js',
  'js/admin/api.js',
  'js/admin/auth.js',
  'js/admin/editor.js',
  'js/admin/preview.js',
  'js/admin/views/dashboard.js',
  'js/admin/views/products.js',
  'js/admin/views/productForm.js',
  'js/admin/views/categories.js',
  'js/admin/views/banners.js',
  'js/admin/views/compounds.js',
  'js/admin/views/whatsapp.js',
  'js/admin/views/security.js',
];

const REQUIRED_SEO_FILES = [
  '_headers',
  '_redirects',
  '.assetsignore',
  '404.html',
  'scripts/build-products.mjs',
  'scripts/build-cf.mjs',
  'robots.txt',
  'sitemap.xml',
  'privacidade.html',
  'favicon.ico',
  'images/favicon-32x32.png',
  'images/apple-touch-icon.png',
  'images/logo.png',
  'images/og-image.jpg',
  'css/fonts.css',
  'css/icons.css',
  'js/publicApi.js',
  'js/vendor/supabase-js-2.119.0.esm.js',
  'supabase/migrations/20261104200000_security_hardening.sql',
  'supabase/migrations/20261104210000_product_richtext_options.sql',
  'supabase/migrations/20261105200000_data_safety_defaults.sql',
  'supabase/migrations/20261106020000_carousel_mobile_art.sql',
  'supabase/migrations/20261106214500_increase_short_description_limit.sql',
  'supabase/migrations/20261113230000_compound_showcase_cards.sql',
  'supabase/migrations/20261114100000_carousel_focus_point.sql',
  'supabase/migrations/20261114100000_carousel_focus_point_rollback.sql',
  'supabase/migrations/20261114110000_products_home_featured.sql',
  'supabase/migrations/20261114110000_products_home_featured_rollback.sql',
  'supabase/migrations/20261114120000_products_slug.sql',
  'supabase/migrations/20261114120000_products_slug_rollback.sql',
  'supabase/migrations/20261115100000_harden_button_links_allowlist.sql',
  'supabase/migrations/20261115110000_restore_storage_hardening.sql',
  'supabase/pending/20261115120000_require_aal2_admin.sql',
  'supabase/schema_reference.sql',
  'supabase/legacy/README.md',
  'supabase/audit/README.md',
  'supabase/tests/rls_checks.sql',
  'docs/admin-regressao.md',
  'docs/decisoes.md',
];

const FORBIDDEN_PATTERNS = [
  { pattern: /00\.000\.000\/0001-00/, label: 'CNPJ fictício (00.000.000/0001-00)' },
  { pattern: /CRF-RS\s*12345/i, label: 'CRF fictício (CRF-RS 12345)' },
  { pattern: /Dr\.\s*Jo[aã]o\s*Silva/i, label: 'Farmacêutico fictício (Dr. João Silva)' },
  { pattern: /aggregateRating/i, label: 'Schema aggregateRating não verificado' },
  { pattern: /1[.,]240\s*avalia/i, label: 'Contagem fictícia de 1.240 avaliações' },
  { pattern: /4[.,]9\s*no\s*Google/i, label: 'Nota fictícia 4,9 no Google' },
  { pattern: /Mariana\s+Silva|Juliana\s+Costa|Carlos\s+Eduardo|Ana\s+Paula\s+Ferreira/, label: 'Nomes de depoimentos fictícios' },
  { pattern: /Farmac[eê]utico\s+online\s+agora|est[aá]\s+online\s+agora/i, label: 'Indicador falso fixo de farmacêutico online agora' },
  { pattern: /Resposta\s+m[eé]dia\s+em\s+5\s+minutos/i, label: 'Promessa fixa "Resposta média em 5 minutos"' },
  { pattern: /contato@boticanatural\.com\.br/i, label: 'E-mail não confirmado contato@boticanatural.com.br' },
];

const FORBIDDEN_EMAIL_SHA256 = '20275d345d5925c101800d71d8baed9cbec4620bf72b0761c1726ef5fc817bf8';

let totalChecks = 0;
let failedChecks = 0;

function pass(msg) {
  totalChecks += 1;
  console.log(`  [OK] ${msg}`);
}

function fail(msg) {
  totalChecks += 1;
  failedChecks += 1;
  console.error(`  [ERRO] ${msg}`);
}

function readUtf8(relPath) {
  return fs.readFileSync(path.join(ROOT_DIR, relPath), 'utf8');
}

/* ==========================================================================
   1. PRESENÇA DE ARQUIVOS OBRIGATÓRIOS E REMOÇÃO DE IMAGENS SEM USO
   ========================================================================== */
console.log('\n1. Verificando arquivos obrigatórios e limpeza de assets sem uso...');
for (const rel of REQUIRED_SEO_FILES) {
  const full = path.join(ROOT_DIR, rel);
  if (fs.existsSync(full) && fs.statSync(full).size > 0) {
    pass(`Arquivo obrigatório presente: ${rel}`);
  } else {
    fail(`Arquivo obrigatório ausente ou vazio: ${rel}`);
  }
}

const UNUSED_IMAGES = [
  'images/hero-img.jpg',
  'images/bg-lavender.jpg',
  'images/icone-serum.jpg',
  'images/icone-serum-cropped.jpg',
  'images/icons.svg',
  'images/icone-homeopatia-transparent.png',
  'images/icone-sache-transparent.png',
  'images/icone-serum-transparent.png',
  'images/icone-xarope-transparent.png',
];
for (const unused of UNUSED_IMAGES) {
  if (!fs.existsSync(path.join(ROOT_DIR, unused))) {
    pass(`Imagem sem uso removida: ${unused}`);
  } else {
    fail(`Imagem sem uso ainda presente no repositório: ${unused}`);
  }
}

// Verifica ausência de arquivos .sql soltos na raiz do projeto
const rootSqlFiles = fs.readdirSync(ROOT_DIR).filter((f) => f.endsWith('.sql'));
if (rootSqlFiles.length === 0) {
  pass('Nenhum arquivo SQL executável solto na raiz do projeto.');
} else {
  fail(`Arquivos SQL encontrados na raiz do projeto: ${rootSqlFiles.join(', ')}`);
}

// Verifica trava de aborto em todos os SQLs legados em supabase/legacy/
const legacyDir = path.join(ROOT_DIR, 'supabase/legacy');
if (fs.existsSync(legacyDir)) {
  const legacyFiles = fs.readdirSync(legacyDir).filter((f) => f.endsWith('.sql'));
  for (const lf of legacyFiles) {
    const content = fs.readFileSync(path.join(legacyDir, lf), 'utf8');
    if (content.includes("RAISE EXCEPTION 'ARQUIVO LEGADO — NÃO EXECUTAR")) {
      pass(`Trava de aborto ativa no script legado: supabase/legacy/${lf}`);
    } else {
      fail(`Script legado sem trava de aborto: supabase/legacy/${lf}`);
    }
  }
}

/* ==========================================================================
   2. CONSISTÊNCIA DO NÚMERO DE WHATSAPP EM TODOS OS ARQUIVOS
   ========================================================================== */
console.log(`\n2. Verificando consistência do WhatsApp (${WHATSAPP_PHONE}) e do telefone (${PHONE_E164})...`);
const filesToScanWhatsApp = [
  ...HTML_FILES,
  ...JS_FILES,
  'supabase/schema_reference.sql',
  'supabase/migrations/20261104200000_security_hardening.sql',
  'supabase/migrations/20261105200000_data_safety_defaults.sql',
];

let whatsappConsistent = true;
for (const rel of filesToScanWhatsApp) {
  const content = readUtf8(rel);

  // wa.me usa o ID da conta de WhatsApp; tel: usa o número discável com o nono dígito.
  const waLinks = [...content.matchAll(/wa\.me\/(\d+)/g)].map((m) => m[1]);
  const telLinks = [...content.matchAll(/tel:\+(\d+)/g)].map((m) => m[1]);

  for (const num of waLinks) {
    if (num !== WHATSAPP_PHONE) {
      whatsappConsistent = false;
      fail(`Link wa.me divergente em ${rel}: encontrado "${num}", esperado "${WHATSAPP_PHONE}"`);
    }
  }
  for (const num of telLinks) {
    if (num !== PHONE_E164) {
      whatsappConsistent = false;
      fail(`Link tel: divergente em ${rel}: encontrado "${num}", esperado "${PHONE_E164}"`);
    }
  }

  if (content.includes('555197731564') || content.includes('9773-1564')) {
    whatsappConsistent = false;
    fail(`Número antigo (555197731564) encontrado em ${rel}`);
  }
  // Exibição antiga sem o nono dígito, ex.: "(51) 8554-3448"
  if (/\(51\)\s*8554-3448/.test(content)) {
    whatsappConsistent = false;
    fail(`Telefone exibido sem o nono dígito em ${rel}; use "${WHATSAPP_DISPLAY}".`);
  }
}
if (whatsappConsistent) {
  pass(`WhatsApp (${WHATSAPP_PHONE}) e telefone (${PHONE_E164}, exibido como ${WHATSAPP_DISPLAY}) consistentes em HTML, JS e SQL ativos.`);
}

/* ==========================================================================
   2.1. CONSISTÊNCIA DE HORÁRIO, ENDEREÇO E DOMÍNIO (MED-08 / CRIT-03)
   ========================================================================== */
console.log(`\n2.1. Verificando consistência de horário, endereço e domínio (${SITE_DOMAIN})...`);
const ROOT_PUBLIC_HTML_FILES = ['index.html', 'produtos.html', 'produto.html', 'privacidade.html', '404.html'];
const PUBLIC_HTML_FILES = [...ROOT_PUBLIC_HTML_FILES, ...GENERATED_PRODUCT_HTML_FILES];
let hoursAndAddressConsistent = true;
for (const htmlFile of PUBLIC_HTML_FILES) {
  const content = readUtf8(htmlFile);
  if (!content.includes(BUSINESS_HOURS_TEXT)) {
    hoursAndAddressConsistent = false;
    fail(`${htmlFile}: string oficial de horário ("${BUSINESS_HOURS_TEXT}") ausente.`);
  }
  if (
    !content.includes('<li><span>Seg a Sex</span> 08:30–12:00 e 13:30–18:00</li>') ||
    !content.includes('<li><span>Sáb</span> 08:30–12:00</li>')
  ) {
    hoursAndAddressConsistent = false;
    fail(`${htmlFile}: rodapé de horários (.footer__hours) diverge do padrão oficial.`);
  }
  if (!content.includes(BUSINESS_ADDRESS_TEXT)) {
    hoursAndAddressConsistent = false;
    fail(`${htmlFile}: endereço oficial ("${BUSINESS_ADDRESS_TEXT}") ausente.`);
  }
}
const indexContentForHours = readUtf8('index.html');
if (
  !indexContentForHours.includes(`<p class="cta-final__note"><i class="fa-regular fa-clock" aria-hidden="true"></i> ${BUSINESS_HOURS_TEXT}</p>`)
) {
  hoursAndAddressConsistent = false;
  fail('index.html: nota de horário em #orcamento (.cta-final__note) diverge de BUSINESS_HOURS_TEXT.');
}
if (hoursAndAddressConsistent) {
  pass(`Horário ("${BUSINESS_HOURS_TEXT}") e endereço ("${BUSINESS_ADDRESS_TEXT}") idênticos em todas as páginas públicas.`);
}

let domainConsistent = true;
for (const htmlFile of PUBLIC_HTML_FILES) {
  const content = readUtf8(htmlFile);
  const canonicalMatch = content.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
  if (canonicalMatch && !canonicalMatch[1].startsWith(SITE_DOMAIN) && !canonicalMatch[1].startsWith('produtos.html')) {
    domainConsistent = false;
    fail(`${htmlFile}: canonical "${canonicalMatch[1]}" não utiliza SITE_DOMAIN (${SITE_DOMAIN}).`);
  }
  const ogUrlMatch = content.match(/<meta\s+property=["']og:url["']\s+content=["']([^"']+)["']/i);
  if (ogUrlMatch && !ogUrlMatch[1].startsWith(SITE_DOMAIN)) {
    domainConsistent = false;
    fail(`${htmlFile}: og:url "${ogUrlMatch[1]}" não utiliza SITE_DOMAIN (${SITE_DOMAIN}).`);
  }
  const ogImageMatch = content.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
  const isGeneratedProd = htmlFile.startsWith('produtos/');
  const allowedOgImage =
    ogImageMatch &&
    (ogImageMatch[1].startsWith(SITE_DOMAIN) ||
      (isGeneratedProd && ogImageMatch[1].startsWith('https://njdkuhgoophzjxmmempu.supabase.co/')));
  if (ogImageMatch && !allowedOgImage) {
    domainConsistent = false;
    fail(`${htmlFile}: og:image "${ogImageMatch[1]}" não utiliza SITE_DOMAIN (${SITE_DOMAIN}).`);
  }
  const jsonLdScripts = [
    ...content.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
  ];
  for (const [idx, m] of jsonLdScripts.entries()) {
    try {
      const ld = JSON.parse(m[1].trim());
      for (const field of ['url', '@id']) {
        if (typeof ld[field] === 'string' && !ld[field].startsWith(SITE_DOMAIN)) {
          domainConsistent = false;
          fail(`${htmlFile} (JSON-LD #${idx + 1}): campo "${field}" ("${ld[field]}") não utiliza SITE_DOMAIN (${SITE_DOMAIN}).`);
        }
      }
      if (typeof ld.image === 'string') {
        const validImg =
          ld.image.startsWith(SITE_DOMAIN) ||
          (isGeneratedProd && ld.image.startsWith('https://njdkuhgoophzjxmmempu.supabase.co/'));
        if (!validImg) {
          domainConsistent = false;
          fail(`${htmlFile} (JSON-LD #${idx + 1}): campo "image" ("${ld.image}") não utiliza SITE_DOMAIN (${SITE_DOMAIN}).`);
        }
      }
      if (ld.offers && typeof ld.offers.url === 'string' && !ld.offers.url.startsWith(SITE_DOMAIN)) {
        domainConsistent = false;
        fail(`${htmlFile} (JSON-LD #${idx + 1}): campo "offers.url" ("${ld.offers.url}") não utiliza SITE_DOMAIN (${SITE_DOMAIN}).`);
      }
      if (Array.isArray(ld.itemListElement)) {
        for (const item of ld.itemListElement) {
          if (typeof item?.item === 'string' && !item.item.startsWith(SITE_DOMAIN)) {
            domainConsistent = false;
            fail(`${htmlFile} (JSON-LD #${idx + 1}): Breadcrumb item ("${item.item}") não utiliza SITE_DOMAIN (${SITE_DOMAIN}).`);
          }
        }
      }
    } catch {
      // Erros de sintaxe JSON-LD são reportados na seção 5
    }
  }
}
if (!SITE_DOMAIN.includes('www.boticanatural.com.br')) {
  const provisionalUrlPattern = /(?:https?:\/\/|https%3A%2F%2F)www\.boticanatural\.com\.br/i;
  for (const activeFile of [...HTML_FILES, ...JS_FILES, 'robots.txt', 'sitemap.xml']) {
    const fileText = readUtf8(activeFile);
    if (provisionalUrlPattern.test(fileText)) {
      domainConsistent = false;
      fail(`${activeFile}: ainda contém referência ao domínio provisório www.boticanatural.com.br.`);
    }
  }
}
const produtoHtmlContent = readUtf8('produto.html');
if (!/<meta\s+name=["']robots["']\s+content=["']noindex,\s*follow["']/i.test(produtoHtmlContent)) {
  domainConsistent = false;
  fail('produto.html: <meta name="robots" content="noindex, follow"> ausente (ALTO-09).');
}
const notFoundHtmlContent = readUtf8('404.html');
if (!/<meta\s+name=["']robots["']\s+content=["']noindex,\s*nofollow["']/i.test(notFoundHtmlContent)) {
  domainConsistent = false;
  fail('404.html: <meta name="robots" content="noindex, nofollow"> ausente.');
}
const robotsContent = readUtf8('robots.txt');
if (
  !robotsContent.includes(`Sitemap: ${SITE_DOMAIN}/sitemap.xml`) ||
  !robotsContent.includes('Disallow: /admin') ||
  !robotsContent.includes('Disallow: /admin.html')
) {
  domainConsistent = false;
  fail(`robots.txt: Sitemap ou bloqueios /admin e /admin.html inconsistentes.`);
}
const sitemapContent = readUtf8('sitemap.xml');
const sitemapLocs = [...sitemapContent.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
if (
  sitemapLocs.length === 0 ||
  sitemapLocs.some((loc) => !loc.startsWith(SITE_DOMAIN)) ||
  sitemapLocs.some((loc) => loc.includes('/produto.html'))
) {
  domainConsistent = false;
  fail(`sitemap.xml: uma ou mais tags <loc> são inválidas ou listam /produto.html.`);
}
if (domainConsistent) {
  pass(`Domínio canônico (${SITE_DOMAIN}) consistente em canonical, og:url, og:image, robots.txt e sitemap.xml.`);
}

// Proteção contra Scrape Shield (Email Obfuscation) em páginas com CSP script-src 'self'
let unprotectedMailtoCount = 0;
for (const htmlFile of PUBLIC_HTML_FILES) {
  const html = readUtf8(htmlFile);
  const mailtoMatches = [...html.matchAll(/href=["']mailto:[^"']+["']/gi)];
  for (const m of mailtoMatches) {
    const start = Math.max(0, (m.index || 0) - 60);
    const end = Math.min(html.length, (m.index || 0) + 200);
    const snippet = html.slice(start, end);
    if (!snippet.includes('<!--email_off-->') || !snippet.includes('<!--/email_off-->')) {
      unprotectedMailtoCount += 1;
      fail(`${htmlFile}: link mailto: sem <!--email_off-->...<!--/email_off--> (risco de conflito Cloudflare Scrape Shield com CSP).`);
    }
  }
}
if (unprotectedMailtoCount === 0) {
  pass('Todos os links mailto: nas páginas públicas estão protegidos por <!--email_off--> para compatibilidade com Cloudflare CSP.');
}

/* ==========================================================================
   3. AUSÊNCIA DE CONTEÚDO FICTÍCIO E DADOS HARDCODED PROIBIDOS
   ========================================================================== */
console.log('\n3. Verificando ausência de dados fictícios e hardcoded...');
const filesToScanForbidden = [
  ...HTML_FILES,
  ...JS_FILES,
  'supabase/schema_reference.sql',
  'supabase/migrations/20261104200000_security_hardening.sql',
  'supabase/migrations/20261105200000_data_safety_defaults.sql',
];

for (const { pattern, label } of FORBIDDEN_PATTERNS) {
  let foundIn = [];
  for (const rel of filesToScanForbidden) {
    const content = readUtf8(rel);
    if (pattern.test(content)) {
      foundIn.push(rel);
    }
  }
  if (foundIn.length === 0) {
    pass(`Ausente em todo o código ativo: ${label}`);
  } else {
    fail(`Encontrado ${label} em: ${foundIn.join(', ')}`);
  }
}

// Checagem por hash SHA-256 de e-mail pessoal proibido (MED-06: sem string literal no código)
let forbiddenEmailFoundIn = [];
for (const rel of [...filesToScanForbidden, 'scripts/verify.mjs']) {
  const content = readUtf8(rel);
  const emails = [...content.matchAll(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)].map((m) =>
    m[0].toLowerCase()
  );
  for (const em of emails) {
    const digest = crypto.createHash('sha256').update(em).digest('hex');
    if (digest === FORBIDDEN_EMAIL_SHA256) {
      forbiddenEmailFoundIn.push(rel);
      break;
    }
  }
}
if (forbiddenEmailFoundIn.length === 0) {
  pass('Ausente em todo o código ativo: E-mail pessoal hardcoded (verificado por hash SHA-256)');
} else {
  fail(`E-mail pessoal hardcoded encontrado em: ${forbiddenEmailFoundIn.join(', ')}`);
}

// Checagem de ausência de caminhos locais de máquina com nome de usuário (MED-06 / DOC)
const filesToScanMachinePaths = [
  ...HTML_FILES,
  ...JS_FILES,
  ...CSS_FILES,
  'README.md',
  'RELATORIO.md',
  'PENDENCIAS.md',
  'docs/decisoes.md',
  'docs/layout-auditoria.md',
  'docs/admin-regressao.md',
  'artifacts/audit-baseline-report.json',
];
const machinePathRegex = /[cC]:[/\\][uU]sers[/\\]|file:\/\/\/[cC]:/i;
const machinePathFound = [];
for (const rel of filesToScanMachinePaths) {
  const full = path.join(ROOT_DIR, rel);
  if (!fs.existsSync(full)) continue;
  if (machinePathRegex.test(fs.readFileSync(full, 'utf8'))) {
    machinePathFound.push(rel);
  }
}
if (machinePathFound.length === 0) {
  pass('Ausente em todo o repositório e documentação: caminhos absolutos de máquina local');
} else {
  fail(`Caminhos de máquina local encontrados em: ${machinePathFound.join(', ')}`);
}

// Checagem regulatória de termos proibidos no HTML público fora de comentários (ALTO-06 / Fase 1)
const regulatoryTermRegex =
  /(?:^|[^\p{L}])(cura|curar|garante|100%|sem\s+efeitos\s+colaterais|emagrec\p{L}*|milagr\p{L}*|comprovad\p{L}*|sem\s+contraindica\p{L}*|tratamento\s+garantido|respostas\s+at[eé]\s+22h|pelos\s+Correios)(?=$|[^\p{L}])/giu;
const regulatoryViolations = [];
for (const htmlFile of PUBLIC_HTML_FILES) {
  const withoutComments = readUtf8(htmlFile).replace(/<!--[\s\S]*?-->/g, '');
  const matches = [...withoutComments.matchAll(regulatoryTermRegex)].map((m) => m[1]);
  if (matches.length > 0) {
    regulatoryViolations.push(`${htmlFile} (${[...new Set(matches)].join(', ')})`);
  }
}
if (regulatoryViolations.length === 0) {
  pass('Ausente no HTML público (fora de comentários): alegações regulatórias proibidas (ALTO-06)');
} else {
  fail(`Termos regulatórios proibidos encontrados em: ${regulatoryViolations.join('; ')}`);
}

/* ==========================================================================
   4. VERIFICAÇÃO DE REFERÊNCIAS A ARQUIVOS LOCAIS (HTML, CSS, JS)
   ========================================================================== */
console.log('\n4. Verificando referências a arquivos locais em HTML, CSS e JS...');
let brokenRefs = 0;

function isExternalOrSpecialRef(rawRef) {
  return (
    !rawRef ||
    rawRef.startsWith('#') ||
    rawRef.startsWith('http://') ||
    rawRef.startsWith('https://') ||
    rawRef.startsWith('//') ||
    rawRef.startsWith('data:') ||
    rawRef.startsWith('blob:') ||
    rawRef.startsWith('mailto:') ||
    rawRef.startsWith('tel:') ||
    rawRef.startsWith('javascript:')
  );
}

function checkLocalTarget(sourceFile, rawRef) {
  if (isExternalOrSpecialRef(rawRef)) return;
  const cleanRef = rawRef.split('#')[0].split('?')[0].trim();
  if (!cleanRef) return;

  const baseDir = path.dirname(path.join(ROOT_DIR, sourceFile));
  const resolved = cleanRef.startsWith('/')
    ? path.join(ROOT_DIR, cleanRef.slice(1))
    : path.resolve(baseDir, cleanRef);

  if (!fs.existsSync(resolved)) {
    brokenRefs += 1;
    fail(`Referência quebrada em ${sourceFile}: "${rawRef}" -> arquivo não existe (${path.relative(ROOT_DIR, resolved)})`);
  }
}

for (const htmlFile of HTML_FILES) {
  const content = readUtf8(htmlFile);
  const attrMatches = content.matchAll(/\b(href|src|srcset)\s*=\s*["']([^"']+)["']/gi);
  for (const match of attrMatches) {
    const attrName = match[1].toLowerCase();
    const val = match[2].trim();
    if (attrName === 'srcset') {
      for (const part of val.split(',')) {
        const urlCandidate = part.trim().split(/\s+/)[0];
        checkLocalTarget(htmlFile, urlCandidate);
      }
    } else {
      checkLocalTarget(htmlFile, val);
    }
  }
}

for (const cssFile of CSS_FILES) {
  const content = readUtf8(cssFile);
  const urlMatches = content.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi);
  for (const match of urlMatches) {
    checkLocalTarget(cssFile, match[1].trim());
  }
}

for (const jsFile of JS_FILES) {
  const content = readUtf8(jsFile);
  const importMatches = content.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g);
  for (const match of importMatches) {
    checkLocalTarget(jsFile, match[1].trim());
  }
}

if (brokenRefs === 0) {
  pass('Todas as referências locais em HTML, CSS e JS apontam para arquivos existentes.');
}

/* ==========================================================================
   5. VALIDAÇÃO DE JSON-LD E UNICIDADE DE <H1> NAS PÁGINAS HTML
   ========================================================================== */
console.log('\n5. Validando blocos JSON-LD, <title> e unicidade de <h1>...');
for (const htmlFile of HTML_FILES) {
  const content = readUtf8(htmlFile);

  // Checa presença de BRAND_NAME no <title>
  const titleMatch = content.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch && titleMatch[1].includes(BRAND_NAME)) {
    pass(`${htmlFile}: <title> contém a marca padronizada "${BRAND_NAME}".`);
  } else {
    fail(`${htmlFile}: <title> ausente ou sem a marca "${BRAND_NAME}".`);
  }

  // Checa unicidade de <h1>
  const h1Matches = [...content.matchAll(/<h1\b[^>]*>/gi)];
  if (h1Matches.length === 1) {
    pass(`${htmlFile}: exatamente 1 elemento <h1> encontrado.`);
  } else {
    fail(`${htmlFile}: encontrados ${h1Matches.length} elementos <h1> (esperado exatamente 1).`);
  }

  // Checa blocos JSON-LD
  const jsonLdScripts = [
    ...content.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
  ];
  for (const [idx, match] of jsonLdScripts.entries()) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (!parsed['@context'] || !parsed['@type']) {
        fail(`${htmlFile} (JSON-LD #${idx + 1}): @context ou @type ausente.`);
      } else if (parsed.aggregateRating) {
        fail(`${htmlFile} (JSON-LD #${idx + 1}): contém aggregateRating proibido.`);
      } else {
        pass(`${htmlFile} (JSON-LD #${idx + 1}): JSON válido (@type="${parsed['@type']}").`);
      }
    } catch (err) {
      fail(`${htmlFile} (JSON-LD #${idx + 1}): erro de sintaxe JSON (${err.message}).`);
    }
  }
}

/* ==========================================================================
   6. VERIFICAÇÃO DE INNERHTML EM JS/ (ZERO XSS)
   ========================================================================== */
console.log('\n6. Verificando ausência de innerHTML com interpolação em js/...');
let unsafeInnerHtmlCount = 0;
for (const jsFile of JS_FILES) {
  const content = readUtf8(jsFile);
  // Remove comentários de linha e de bloco antes de inspecionar atribuições a .innerHTML
  const stripped = content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  const matches = [...stripped.matchAll(/\.innerHTML\s*[+]?=/g)];
  if (matches.length > 0) {
    unsafeInnerHtmlCount += matches.length;
    fail(`${jsFile}: encontradas ${matches.length} atribuições a .innerHTML.`);
  }
}

if (unsafeInnerHtmlCount === 0) {
  pass('Nenhuma atribuição a .innerHTML encontrada em nenhum módulo de js/ (100% DOM API segura).');
}

/* ==========================================================================
   7. VERIFICAÇÃO DE IMPORTS E EXPORTS (ZERO IMPORT RESOLUTION ERRORS)
   ========================================================================== */
console.log('\n7. Verificando integridade de todos os imports e exports em js/...');
const exportMap = new Map();
for (const jsFile of JS_FILES) {
  const fullPath = path.resolve(ROOT_DIR, jsFile);
  if (!fs.existsSync(fullPath)) continue;
  const code = fs.readFileSync(fullPath, 'utf8');
  const exports = new Set();

  const declRegex = /export\s+(?:async\s+)?(?:const|function|let|var|class)\s+([a-zA-Z0-9_$]+)/g;
  let match;
  while ((match = declRegex.exec(code)) !== null) {
    exports.add(match[1]);
  }

  const blockRegex = /export\s*\{([^}]+)\}/g;
  while ((match = blockRegex.exec(code)) !== null) {
    const items = match[1].split(',').map(s => s.trim()).filter(Boolean);
    for (const item of items) {
      const parts = item.split(/\s+as\s+/);
      exports.add(parts[parts.length - 1].trim());
    }
  }

  exportMap.set(fullPath, exports);
}

let importResolutionErrors = 0;
for (const jsFile of JS_FILES) {
  const fullPath = path.resolve(ROOT_DIR, jsFile);
  if (!fs.existsSync(fullPath)) continue;
  const code = fs.readFileSync(fullPath, 'utf8');
  const importRegex = /import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(code)) !== null) {
    const importedList = match[1].split(',').map(s => s.trim()).filter(Boolean);
    const source = match[2];
    if (source.startsWith('http://') || source.startsWith('https://')) continue;
    const targetPath = path.resolve(path.dirname(fullPath), source);
    if (source.includes('vendor/')) {
      if (!fs.existsSync(targetPath)) {
        fail(`${jsFile}: vendor bundle inexistente: ${source}`);
        importResolutionErrors++;
      }
      continue;
    }
    const targetExports = exportMap.get(targetPath);
    if (!targetExports) {
      fail(`${jsFile}: importa de arquivo inexistente ou não mapeado: ${source}`);
      importResolutionErrors++;
      continue;
    }
    for (const item of importedList) {
      const [orig] = item.split(/\s+as\s+/);
      const symbol = orig.trim();
      if (!targetExports.has(symbol)) {
        fail(`${jsFile}: importa símbolo '${symbol}' ausente em ${source}`);
        importResolutionErrors++;
      }
    }
  }
}

if (importResolutionErrors === 0) {
  pass('Todos os 100% dos imports nomeados correspondem a exports válidos nos arquivos de destino.');
}

/* ==========================================================================
   7.1. VERIFICAÇÃO DE BREAKPOINTS RESPONSIVOS PADRONIZADOS (MED-07 / FASE 2)
   ========================================================================== */
console.log('\n7.1. Verificando padronização de breakpoints CSS (340px para grid 1→2 col e 480px, 768px, 1024px, 1280px mobile-first)...');
const ALLOWED_WIDTH_BREAKPOINTS = new Set(['340px', '480px', '768px', '1024px', '1280px']);
const CSS_FILES_BREAKPOINT_CHECK = ['css/style.css', 'css/product.css', 'css/admin.css'];
let invalidBreakpointCount = 0;

for (const cssFile of CSS_FILES_BREAKPOINT_CHECK) {
  const strippedCss = readUtf8(cssFile).replace(/\/\*[\s\S]*?\*\//g, '');
  const mediaMatches = [...strippedCss.matchAll(/@media\s*([^{]+)\{/g)];
  for (const m of mediaMatches) {
    const cond = m[1].trim();
    const widthConds = [...cond.matchAll(/\(\s*(min-width|max-width)\s*:\s*([^)]+)\)/gi)];
    for (const wc of widthConds) {
      const prop = wc[1].toLowerCase();
      const val = wc[2].trim().toLowerCase();
      if (prop !== 'min-width' || !ALLOWED_WIDTH_BREAKPOINTS.has(val)) {
        invalidBreakpointCount += 1;
        fail(`${cssFile}: breakpoint fora do padrão mobile-first permitido -> @media ${cond} (${prop}: ${val})`);
      }
    }
  }
}

if (invalidBreakpointCount === 0) {
  pass('Todos os breakpoints de largura em css/style.css, css/product.css e css/admin.css usam min-width em {340px, 480px, 768px, 1024px, 1280px}.');
}

/* ==========================================================================
   7.2. VERIFICAÇÃO DE PERFORMANCE E CABEÇALHOS (FASE 5: MED-04, MED-05, ALTO-07, BX-04)
   ========================================================================== */
console.log('\n7.2. Verificando orçamento de ícones, separação de SDK público, CSP e paridade _headers vs vercel.json...');

const iconsCssRaw = fs.readFileSync(path.join(ROOT_DIR, 'css/icons.css'));
const iconsCssGzipBytes = zlib.gzipSync(iconsCssRaw).length;
if (iconsCssGzipBytes <= 6 * 1024) {
  pass(`css/icons.css respeita o orçamento de <= 6 KB gzip (${iconsCssGzipBytes} B = ${(iconsCssGzipBytes / 1024).toFixed(2)} KB gzip).`);
} else {
  fail(`css/icons.css excedeu 6 KB gzip (${iconsCssGzipBytes} B).`);
}

const PUBLIC_JS_ENTRY_MODULES = [
  'js/main.js',
  'js/app.js',
  'js/product.js',
  'js/whatsapp.js',
  'js/shared/productRenderer.js',
];
let sdkInPublicCount = 0;
for (const pubMod of PUBLIC_JS_ENTRY_MODULES) {
  const src = readUtf8(pubMod);
  if (/supabaseClient\.js|supabase-js/i.test(src)) {
    sdkInPublicCount += 1;
    fail(`${pubMod} ainda importa supabaseClient.js ou supabase-js no bundle público.`);
  }
}
if (sdkInPublicCount === 0) {
  pass('Módulos públicos usam exclusivamente js/publicApi.js (zero @supabase/supabase-js na vitrine).');
}

// Paridade de headers de segurança entre _headers e vercel.json + CSP sem 'unsafe-inline' em style-src
const headersText = readUtf8('_headers');
const vercelConfig = JSON.parse(readUtf8('vercel.json'));
const REQUIRED_SECURITY_HEADERS = [
  'Strict-Transport-Security',
  'X-Content-Type-Options',
  'X-Frame-Options',
  'Referrer-Policy',
  'Permissions-Policy',
  'Content-Security-Policy',
];

const parseCloudflareSection = (sectionHeader) => {
  const lines = headersText.split(/\r?\n/);
  const startIdx = lines.findIndex((l) => l.trim() === sectionHeader);
  /** @type {{ headers: Record<string, string>, detaches: Set<string> }} */
  const result = { headers: {}, detaches: new Set() };
  if (startIdx === -1) return result;
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    if (!/^\s+/.test(line)) break;
    const trimmed = line.trim();
    if (trimmed.startsWith('!')) {
      const detachedName = trimmed.slice(1).trim();
      if (detachedName) result.detaches.add(detachedName);
      continue;
    }
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const k = line.slice(0, colonIdx).trim();
      const v = line.slice(colonIdx + 1).trim();
      result.headers[k] = v;
    }
  }
  return result;
};

const getVercelHeadersMap = (sourcePattern) => {
  const entry = (vercelConfig.headers || []).find((h) => h.source === sourcePattern);
  /** @type {Record<string, string>} */
  const map = {};
  if (entry && Array.isArray(entry.headers)) {
    for (const h of entry.headers) {
      map[h.key] = h.value;
    }
  }
  return map;
};

const netlifyRootHeaders = parseCloudflareSection('/*').headers;
const vercelRootHeaders = getVercelHeadersMap('/(.*)');

let headerParityErrors = 0;
for (const key of REQUIRED_SECURITY_HEADERS) {
  if (!netlifyRootHeaders[key] || netlifyRootHeaders[key] !== vercelRootHeaders[key]) {
    headerParityErrors += 1;
    fail(`Divergência no header "${key}" entre _headers ("${netlifyRootHeaders[key]}") e vercel.json ("${vercelRootHeaders[key]}").`);
  }
}
if (
  netlifyRootHeaders['Content-Security-Policy'] &&
  (netlifyRootHeaders['Content-Security-Policy'].includes("'unsafe-inline'") ||
    netlifyRootHeaders['Content-Security-Policy'].includes('fonts.googleapis.com') ||
    !netlifyRootHeaders['Content-Security-Policy'].includes('upgrade-insecure-requests') ||
    netlifyRootHeaders['Content-Security-Policy'].includes('wss://'))
) {
  headerParityErrors += 1;
  fail('CSP pública em _headers/vercel.json deve incluir upgrade-insecure-requests e excluir unsafe-inline, fonts.googleapis.com e wss://.');
}
for (const reqPerm of ['usb=()', 'bluetooth=()', 'serial=()', 'accelerometer=()', 'gyroscope=()', 'magnetometer=()']) {
  if (!netlifyRootHeaders['Permissions-Policy']?.includes(reqPerm)) {
    headerParityErrors += 1;
    fail(`Permissions-Policy em _headers/vercel.json não inclui ${reqPerm}.`);
  }
}
if (netlifyRootHeaders['Cross-Origin-Opener-Policy'] || vercelRootHeaders['Cross-Origin-Opener-Policy']) {
  headerParityErrors += 1;
  fail('Cross-Origin-Opener-Policy deve ser aplicado apenas em /admin e /admin.html, não globalmente.');
}
if (netlifyRootHeaders['Cross-Origin-Resource-Policy'] || vercelRootHeaders['Cross-Origin-Resource-Policy']) {
  headerParityErrors += 1;
  fail('Cross-Origin-Resource-Policy global não deve ser aplicado para não quebrar previews sociais.');
}

// Verifica remoção de wss:// nas tags <meta> de CSP públicas
for (const pubHtml of PUBLIC_HTML_FILES) {
  const htmlContent = readUtf8(pubHtml);
  const cspMetaMatch = htmlContent.match(
    /<meta\s+http-equiv=["']Content-Security-Policy["']\s+content=["']([^"']+)["']/i
  );
  if (!cspMetaMatch) {
    headerParityErrors += 1;
    fail(`${pubHtml}: meta tag Content-Security-Policy ausente.`);
  } else if (cspMetaMatch[1].includes('wss://')) {
    headerParityErrors += 1;
    fail(`${pubHtml}: meta tag CSP pública ainda contém wss:// desnecessário.`);
  }
}

// Regras específicas de Cloudflare Pages: Clean URLs (/admin) e desanexo (!) sem concatenação de headers
for (const adminRoute of ['/admin', '/admin.html']) {
  const cfAdmin = parseCloudflareSection(adminRoute);
  const vcAdmin = getVercelHeadersMap(adminRoute);
  if (!cfAdmin.detaches.has('Content-Security-Policy')) {
    headerParityErrors += 1;
    fail(`_headers (${adminRoute}): falta "! Content-Security-Policy" para evitar concatenação com /* na Cloudflare.`);
  }
  if (
    !cfAdmin.headers['Content-Security-Policy'] ||
    !cfAdmin.headers['Content-Security-Policy'].includes("frame-src 'self' blob:") ||
    !cfAdmin.headers['Content-Security-Policy'].includes('upgrade-insecure-requests')
  ) {
    headerParityErrors += 1;
    fail(`_headers (${adminRoute}): CSP deve permitir "frame-src 'self' blob:" e incluir "upgrade-insecure-requests".`);
  }
  if (cfAdmin.headers['Content-Security-Policy'] !== vcAdmin['Content-Security-Policy']) {
    headerParityErrors += 1;
    fail(`Divergência de CSP em ${adminRoute} entre _headers e vercel.json.`);
  }
  if (
    cfAdmin.headers['Cross-Origin-Opener-Policy'] !== 'same-origin' ||
    vcAdmin['Cross-Origin-Opener-Policy'] !== 'same-origin'
  ) {
    headerParityErrors += 1;
    fail(`${adminRoute}: Cross-Origin-Opener-Policy deve ser "same-origin" em _headers e vercel.json.`);
  }
  if (cfAdmin.headers['X-Robots-Tag'] !== 'noindex, nofollow' || vcAdmin['X-Robots-Tag'] !== 'noindex, nofollow') {
    headerParityErrors += 1;
    fail(`${adminRoute}: X-Robots-Tag deve ser "noindex, nofollow" em _headers e vercel.json.`);
  }
}

const CACHE_ROUTE_PAIRS = [
  ['/css/*', '/css/(.*)', false],
  ['/js/*', '/js/(.*)', false],
  ['/images/*', '/images/(.*)', false],
  ['/fonts/*', '/fonts/(.*)', true],
];
for (const [cfPath, vcPath, allowImmutable] of CACHE_ROUTE_PAIRS) {
  const cfSec = parseCloudflareSection(cfPath);
  const vcMap = getVercelHeadersMap(vcPath);
  if (!cfSec.detaches.has('Cache-Control')) {
    headerParityErrors += 1;
    fail(`_headers (${cfPath}): falta "! Cache-Control" antes do novo valor para não concatenar com "no-cache" de /*.`);
  }
  if (!cfSec.headers['Cache-Control'] || cfSec.headers['Cache-Control'] !== vcMap['Cache-Control']) {
    headerParityErrors += 1;
    fail(`Divergência de Cache-Control entre _headers (${cfPath}) e vercel.json (${vcPath}).`);
  }
  if (!allowImmutable && cfSec.headers['Cache-Control']?.includes('immutable')) {
    headerParityErrors += 1;
    fail(`${cfPath}: arquivos sem hash no nome não devem usar Cache-Control immutable.`);
  }
}

if (headerParityErrors === 0) {
  pass('Paridade 100% entre _headers e vercel.json, com regras Cloudflare Clean URLs (/admin), desanexo (!) e cache seguro para ESM.');
}

console.log('\n7.3. Verificando segurança de publicação (security.txt, robots.txt, vercel.json e pacote dist/)...');
const SECURITY_TXT_PATH = path.resolve(ROOT_DIR, '.well-known/security.txt');
if (!fs.existsSync(SECURITY_TXT_PATH)) {
  fail('.well-known/security.txt ausente.');
} else {
  const secTxt = fs.readFileSync(SECURITY_TXT_PATH, 'utf8');
  const expiresMatch = secTxt.match(/^Expires:\s*(.+)$/m);
  const hasContact = /^Contact:\s*mailto:/m.test(secTxt);
  const hasCanonical = /^Canonical:\s*https:\/\/boticanaturaltriunfo\.com\.br\/\.well-known\/security\.txt$/m.test(secTxt);
  const hasLang = /^Preferred-Languages:/m.test(secTxt);
  const expiresMs = expiresMatch ? Date.parse(expiresMatch[1].trim()) : NaN;
  if (!hasContact || !hasCanonical || !hasLang || !Number.isFinite(expiresMs) || expiresMs <= Date.now()) {
    fail('.well-known/security.txt deve conter Contact, Canonical, Preferred-Languages e Expires futuro válido.');
  } else {
    pass('.well-known/security.txt presente e conforme RFC 9116.');
  }
}

if (!fs.existsSync(path.resolve(ROOT_DIR, 'SECURITY.md'))) {
  fail('SECURITY.md ausente na raiz do repositório.');
} else {
  pass('SECURITY.md presente na raiz do repositório.');
}

const robotsTxtContent = fs.readFileSync(path.resolve(ROOT_DIR, 'robots.txt'), 'utf8');
if (/^Disallow:\s*\/(?:docs|scripts|supabase|tests|\.github)\b/im.test(robotsTxtContent)) {
  fail('robots.txt não deve listar diretórios internos (docs, scripts, supabase, tests, .github).');
} else if (!/^Disallow:\s*\/admin\b/m.test(robotsTxtContent) || !/^Disallow:\s*\/admin\.html\b/m.test(robotsTxtContent)) {
  fail('robots.txt deve manter Disallow: /admin e Disallow: /admin.html.');
} else {
  pass('robots.txt bloqueia apenas rotas administrativas sem enumerar diretórios internos.');
}

const vercelDeployConfig = JSON.parse(fs.readFileSync(path.resolve(ROOT_DIR, 'vercel.json'), 'utf8'));
if (
  vercelDeployConfig.outputDirectory !== 'dist' ||
  vercelDeployConfig.buildCommand !== 'npm run build:products && npm run build:cf'
) {
  fail('vercel.json deve publicar exclusivamente outputDirectory "dist" com buildCommand "npm run build:products && npm run build:cf".');
} else {
  pass('vercel.json configurado para gerar e publicar apenas o pacote limpo dist/.');
}

const buildCfContent = fs.readFileSync(path.resolve(ROOT_DIR, 'scripts/build-cf.mjs'), 'utf8');
if (!buildCfContent.includes("'.well-known'")) {
  fail('scripts/build-cf.mjs deve incluir ".well-known" na lista de diretórios públicos.');
} else {
  pass('scripts/build-cf.mjs inclui .well-known no pacote de deploy dist/.');
}

const DIST_DIR = path.resolve(ROOT_DIR, 'dist');
const REQUIRE_DIST = process.argv.includes('--dist');
if (!fs.existsSync(DIST_DIR)) {
  if (REQUIRE_DIST) {
    fail('Diretório dist/ não encontrado; execute "npm run build:cf" antes de verificar.');
  }
} else {
  const forbiddenTopDirs = new Set(['docs', 'supabase', 'scripts', 'tests', '.github', '.git', 'node_modules', 'artifacts', 'backups', 'test-results', 'playwright-report']);
  const forbiddenRootFiles = new Set(['package.json', 'package-lock.json', 'playwright.config.js', 'vercel.json', 'SECURITY.md', '.env', '.gitignore']);
  const distLeaks = [];
  function scanDistDirectory(currentDir, relPrefix = '') {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const relPath = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (!relPrefix && forbiddenTopDirs.has(entry.name)) {
          distLeaks.push(relPath);
          continue;
        }
        scanDistDirectory(path.join(currentDir, entry.name), relPath);
      } else {
        if (!relPrefix && forbiddenRootFiles.has(entry.name)) {
          distLeaks.push(relPath);
        } else if (entry.name.startsWith('.env') || entry.name.endsWith('.md') || entry.name.endsWith('.sql')) {
          distLeaks.push(relPath);
        }
      }
    }
  }
  scanDistDirectory(DIST_DIR);
  if (distLeaks.length > 0) {
    fail(`dist/ contém arquivos internos proibidos: ${distLeaks.join(', ')}`);
  } else if (
    !fs.existsSync(path.join(DIST_DIR, '.well-known/security.txt')) ||
    !fs.existsSync(path.join(DIST_DIR, '_headers')) ||
    !fs.existsSync(path.join(DIST_DIR, 'index.html'))
  ) {
    fail('dist/ está incompleto: faltam .well-known/security.txt, _headers ou index.html.');
  } else {
    pass('Pacote dist/ validado sem arquivos internos (docs, supabase, scripts, tests, .md, .sql, package.json, .env) e com .well-known/security.txt.');
  }
}

console.log('\n7.4. Verificando endurecimento de CI/CD e cadeia de suprimentos...');
const lockfileRaw = fs.readFileSync(path.resolve(ROOT_DIR, 'package-lock.json'), 'utf8');
if (lockfileRaw.includes('"node_modules/swiper"')) {
  fail('package-lock.json ainda referencia o pacote inutilizado "swiper". Execute npm uninstall swiper.');
} else {
  pass('package-lock.json sincronizado sem o pacote órfão/vulnerável "swiper".');
}

const REQUIRED_WORKFLOWS = ['ci.yml', 'codeql.yml', 'dependency-review.yml'];
let workflowErrors = 0;
for (const wfName of REQUIRED_WORKFLOWS) {
  const wfPath = path.resolve(ROOT_DIR, '.github/workflows', wfName);
  if (!fs.existsSync(wfPath)) {
    workflowErrors += 1;
    fail(`.github/workflows/${wfName} ausente.`);
    continue;
  }
  const wfContent = fs.readFileSync(wfPath, 'utf8');
  if (/pull_request_target\b/.test(wfContent)) {
    workflowErrors += 1;
    fail(`.github/workflows/${wfName} não deve usar "pull_request_target".`);
  }
  if (!/^permissions:\s*$/m.test(wfContent) || !/^\s+contents:\s*read\b/m.test(wfContent)) {
    workflowErrors += 1;
    fail(`.github/workflows/${wfName} deve declarar "permissions: contents: read" explícito.`);
  }
  if (!/^concurrency:/m.test(wfContent) || !/timeout-minutes:\s*\d+/m.test(wfContent)) {
    workflowErrors += 1;
    fail(`.github/workflows/${wfName} deve definir "concurrency" e "timeout-minutes".`);
  }
  const usesLines = wfContent.match(/^\s*(?:-\s*)?uses:\s*.+$/gm) || [];
  if (usesLines.length === 0) {
    workflowErrors += 1;
    fail(`.github/workflows/${wfName} não possui ações fixadas verificáveis.`);
  }
  for (const usesLine of usesLines) {
    if (!/@[0-9a-f]{40}(?:\s+#.*)?$/.test(usesLine.trim())) {
      workflowErrors += 1;
      fail(`.github/workflows/${wfName}: action sem commit SHA completo de 40 caracteres -> ${usesLine.trim()}`);
    }
  }
  if (/run:[^\n]*\$\{\{\s*github\.event\.(?:issue|pull_request|comment|head_commit)\./.test(wfContent)) {
    workflowErrors += 1;
    fail(`.github/workflows/${wfName}: possível script injection via github.event.* em bloco run.`);
  }
  // Node 20 saiu de suporte (EOL 2026-04-30): CI não pode rodar runtime sem patches de segurança.
  const MIN_CI_NODE_MAJOR = 22;
  for (const [, major] of wfContent.matchAll(/node-version:\s*['"]?(\d+)/g)) {
    if (Number(major) < MIN_CI_NODE_MAJOR) {
      workflowErrors += 1;
      fail(`.github/workflows/${wfName}: node-version ${major} fora de suporte (mínimo ${MIN_CI_NODE_MAJOR} LTS).`);
    }
  }
}
if (!fs.existsSync(path.resolve(ROOT_DIR, '.github/dependabot.yml')) || !fs.existsSync(path.resolve(ROOT_DIR, '.gitleaks.toml'))) {
  workflowErrors += 1;
  fail('.github/dependabot.yml ou .gitleaks.toml ausente.');
} else {
  // Allowlists ancoradas (^...$) devem mirar o segredo extraído, não o "match":
  // regras como `jwt` incluem o delimitador final no match e a âncora nunca casa.
  const gitleaksToml = fs.readFileSync(path.resolve(ROOT_DIR, '.gitleaks.toml'), 'utf8');
  if (/^\s*regexTarget\s*=\s*["']match["']/m.test(gitleaksToml)) {
    workflowErrors += 1;
    fail('.gitleaks.toml: use regexTarget = "secret" nas allowlists de token (o "match" inclui delimitadores e quebra âncoras ^...$).');
  }
}
if (workflowErrors === 0) {
  pass('Workflows GitHub Actions (ci, codeql, dependency-review), Dependabot e Gitleaks configurados com pinagem por SHA e menor privilégio.');
}

/* ==========================================================================
   8. [MODO PRODUÇÃO] VERIFICAÇÃO DE PLACEHOLDERS [PREENCHER (APENAS --prod)
   ========================================================================== */
// Workers Static Assets avalia _redirects ANTES dos arquivos estáticos: regra dinâmica em
// /produtos/:slug sequestraria as páginas pré-renderizadas do sitemap (regressão de SEO).
{
  const redirectRules = readUtf8('_redirects')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
  const hijacking = redirectRules.filter((rule) => /^\/produtos\/(?::|\*)/.test(rule.split(/\s+/)[0]));
  if (hijacking.length > 0) {
    fail(`_redirects: regra dinâmica em /produtos/ sobrepõe páginas estáticas no Workers -> ${hijacking.join(' | ')}`);
  } else {
    pass('_redirects sem regras dinâmicas em /produtos/ (páginas pré-renderizadas servidas diretamente; fallback via 404.html).');
  }
}

const IS_PROD = process.argv.includes('--prod');
if (IS_PROD) {
  console.log('\n8. [MODO PRODUÇÃO] Verificando ausência de placeholders [PREENCHER...');
  let placeholdersFound = 0;
  const prodScanFiles = Array.from(new Set([...PUBLIC_HTML_FILES, ...HTML_FILES, ...JS_FILES, 'robots.txt', 'sitemap.xml', '.well-known/security.txt']));
  for (const file of prodScanFiles) {
    const fullPath = path.resolve(ROOT_DIR, file);
    if (!fs.existsSync(fullPath)) continue;
    const isJs = file.endsWith('.js');
    const pattern = isJs ? /\[PREENCHER:[^\]]+\]/g : /\[PREENCHER[^\]]*\]?/gi;
    const lines = fs.readFileSync(fullPath, 'utf8').split(/\r?\n/);
    lines.forEach((lineText, idx) => {
      const matches = lineText.match(pattern);
      if (matches) {
        for (const placeholder of matches) {
          fail(`${file}:${idx + 1} -> ${placeholder}`);
          placeholdersFound += 1;
        }
      }
    });
  }
  if (placeholdersFound === 0) {
    pass('Nenhum placeholder [PREENCHER...] encontrado nos arquivos de produção.');
  }
}


/* ==========================================================================
   RESUMO FINAL
   ========================================================================== */
console.log('\n====================================================================');
if (failedChecks === 0) {
  console.log(`VERIFICAÇÃO CONCLUÍDA COM SUCESSO: ${totalChecks}/${totalChecks} checagens aprovadas.`);
  console.log('====================================================================\n');
  process.exit(0);
} else {
  console.error(`VERIFICAÇÃO FALHOU: ${failedChecks} erro(s) em ${totalChecks} checagens.`);
  console.error('====================================================================\n');
  process.exit(1);
}
