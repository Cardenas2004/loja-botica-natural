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
import { fileURLToPath } from 'node:url';
import {
  WHATSAPP_PHONE,
  BRAND_NAME,
  SITE_DOMAIN,
  BUSINESS_HOURS_TEXT,
  BUSINESS_ADDRESS_TEXT,
} from '../js/config.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT_DIR = path.resolve(path.dirname(__filename), '..');

const HTML_FILES = [
  'index.html',
  'produtos.html',
  'produto.html',
  'privacidade.html',
  'admin.html',
];

const CSS_FILES = ['css/style.css', 'css/product.css', 'css/admin.css', 'css/icons.css'];

const JS_FILES = [
  'js/config.js',
  'js/supabaseClient.js',
  'js/whatsapp.js',
  'js/main.js',
  'js/app.js',
  'js/product.js',
  'js/admin.js',
  'js/shared/richtext.js',
  'js/shared/productRenderer.js',
  'js/shared/categoryIcons.js',
  'js/shared/compoundShowcaseRenderer.js',
  'js/admin/main.js',
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
];

const REQUIRED_SEO_FILES = [
  'robots.txt',
  'sitemap.xml',
  'privacidade.html',
  'favicon.ico',
  'images/favicon-32x32.png',
  'images/apple-touch-icon.png',
  'images/logo.png',
  'images/og-image.jpg',
  'images/icons.svg',
  'css/icons.css',
  'js/vendor/supabase-js-2.49.1.esm.js',
  'js/vendor/swiper-11.2.4.bundle.min.js',
  'css/vendor/swiper-11.2.4.bundle.min.css',
  'supabase/migrations/20261104200000_security_hardening.sql',
  'supabase/migrations/20261104210000_product_richtext_options.sql',
  'supabase/migrations/20261105200000_data_safety_defaults.sql',
  'supabase/migrations/20261106020000_carousel_mobile_art.sql',
  'supabase/migrations/20261106214500_increase_short_description_limit.sql',
  'supabase/migrations/20261113230000_compound_showcase_cards.sql',
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
console.log(`\n2. Verificando consistência do WhatsApp (${WHATSAPP_PHONE})...`);
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

  // Captura qualquer wa.me/<digitos> ou tel:+<digitos>
  const waLinks = [...content.matchAll(/wa\.me\/(\d+)/g)].map((m) => m[1]);
  const telLinks = [...content.matchAll(/tel:\+(\d+)/g)].map((m) => m[1]);

  for (const num of [...waLinks, ...telLinks]) {
    if (num !== WHATSAPP_PHONE) {
      whatsappConsistent = false;
      fail(`Número de WhatsApp/telefone divergente em ${rel}: encontrado "${num}", esperado "${WHATSAPP_PHONE}"`);
    }
  }

  if (content.includes('555197731564') || content.includes('9773-1564')) {
    whatsappConsistent = false;
    fail(`Número antigo (555197731564) encontrado em ${rel}`);
  }
}
if (whatsappConsistent) {
  pass(`Número de WhatsApp (${WHATSAPP_PHONE}) idêntico em todos os arquivos HTML, JS e SQL ativos.`);
}

/* ==========================================================================
   2.1. CONSISTÊNCIA DE HORÁRIO, ENDEREÇO E DOMÍNIO (MED-08 / CRIT-03)
   ========================================================================== */
console.log(`\n2.1. Verificando consistência de horário, endereço e domínio (${SITE_DOMAIN})...`);
const PUBLIC_HTML_FILES = ['index.html', 'produtos.html', 'produto.html', 'privacidade.html'];
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
  if (ogImageMatch && !ogImageMatch[1].startsWith(SITE_DOMAIN)) {
    domainConsistent = false;
    fail(`${htmlFile}: og:image "${ogImageMatch[1]}" não utiliza SITE_DOMAIN (${SITE_DOMAIN}).`);
  }
}
const robotsContent = readUtf8('robots.txt');
if (!robotsContent.includes(`Sitemap: ${SITE_DOMAIN}/sitemap.xml`)) {
  domainConsistent = false;
  fail(`robots.txt: Sitemap não utiliza SITE_DOMAIN (${SITE_DOMAIN}).`);
}
const sitemapContent = readUtf8('sitemap.xml');
const sitemapLocs = [...sitemapContent.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
if (sitemapLocs.length === 0 || sitemapLocs.some((loc) => !loc.startsWith(SITE_DOMAIN))) {
  domainConsistent = false;
  fail(`sitemap.xml: uma ou mais tags <loc> não utilizam SITE_DOMAIN (${SITE_DOMAIN}).`);
}
if (domainConsistent) {
  pass(`Domínio canônico (${SITE_DOMAIN}) consistente em canonical, og:url, og:image, robots.txt e sitemap.xml.`);
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
   8. [MODO PRODUÇÃO] VERIFICAÇÃO DE PLACEHOLDERS [PREENCHER (APENAS --prod)
   ========================================================================== */
const IS_PROD = process.argv.includes('--prod');
if (IS_PROD) {
  console.log('\n8. [MODO PRODUÇÃO] Verificando ausência de placeholders [PREENCHER...');
  let placeholdersFound = 0;
  const prodScanFiles = [...HTML_FILES, ...JS_FILES, 'robots.txt', 'sitemap.xml'];
  for (const file of prodScanFiles) {
    const fullPath = path.resolve(ROOT_DIR, file);
    if (!fs.existsSync(fullPath)) continue;
    const lines = fs.readFileSync(fullPath, 'utf8').split(/\r?\n/);
    lines.forEach((lineText, idx) => {
      const matches = lineText.match(/\[PREENCHER:[^\]]+\]/g);
      if (matches) {
        for (const placeholder of matches) {
          fail(`${file}:${idx + 1} -> ${placeholder}`);
          placeholdersFound += 1;
        }
      }
    });
  }
  if (placeholdersFound === 0) {
    pass('Nenhum placeholder [PREENCHER: ...] encontrado nos arquivos de produção.');
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
