import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT_DIR = path.resolve(path.dirname(__filename), '..');

const FONTAWESOME_DIR = path.resolve(
  ROOT_DIR,
  'node_modules',
  '@fortawesome',
  'fontawesome-free',
  'svgs'
);

const CANDIDATE_ICONS = [
  { name: 'whatsapp', type: 'brands' },
  { name: 'facebook-f', type: 'brands' },
  { name: 'instagram', type: 'brands' },
  { name: 'phone', type: 'solid' },
  { name: 'clock', type: 'regular' },
  { name: 'location-dot', type: 'solid' },
  { name: 'envelope', type: 'solid' },
  { name: 'bars', type: 'solid' },
  { name: 'xmark', type: 'solid' },
  { name: 'check', type: 'solid' },
  { name: 'check-double', type: 'solid' },
  { name: 'plus', type: 'solid' },
  { name: 'arrow-right', type: 'solid' },
  { name: 'arrow-left', type: 'solid' },
  { name: 'arrow-up', type: 'solid' },
  { name: 'arrow-down', type: 'solid' },
  { name: 'chevron-right', type: 'solid' },
  { name: 'chevron-left', type: 'solid' },
  { name: 'chevron-down', type: 'solid' },
  { name: 'filter', type: 'solid' },
  { name: 'bars-staggered', type: 'solid' },
  { name: 'award', type: 'solid' },
  { name: 'shield-halved', type: 'solid' },
  { name: 'leaf', type: 'solid' },
  { name: 'seedling', type: 'solid' },
  { name: 'capsules', type: 'solid' },
  { name: 'vial', type: 'solid' },
  { name: 'bottle-droplet', type: 'solid' },
  { name: 'pump-medical', type: 'solid' },
  { name: 'mortar-pestle', type: 'solid' },
  { name: 'user-doctor', type: 'solid' },
  { name: 'truck-fast', type: 'solid' },
  { name: 'credit-card', type: 'solid' },
  { name: 'boxes-stacked', type: 'solid' },
  { name: 'box-open', type: 'solid' },
  { name: 'magnifying-glass', type: 'solid' },
  { name: 'house', type: 'solid' },
  { name: 'quote-left', type: 'solid' },
  { name: 'quote-right', type: 'solid' },
  { name: 'shapes', type: 'solid' },
  { name: 'bolt', type: 'solid' },
  { name: 'fire', type: 'solid' },
  { name: 'star', type: 'solid' },
  { name: 'circle-check', type: 'solid' },
  { name: 'circle-exclamation', type: 'solid' },
  { name: 'circle-info', type: 'solid' },
  { name: 'circle-notch', type: 'solid' },
  { name: 'triangle-exclamation', type: 'solid' },
  { name: 'eye', type: 'solid' },
  { name: 'eye-slash', type: 'solid' },
  { name: 'pen', type: 'solid' },
  { name: 'pen-to-square', type: 'solid' },
  { name: 'pen-ruler', type: 'solid' },
  { name: 'floppy-disk', type: 'solid' },
  { name: 'trash-can', type: 'solid' },
  { name: 'rotate-left', type: 'solid' },
  { name: 'rotate-right', type: 'solid' },
  { name: 'clock-rotate-left', type: 'solid' },
  { name: 'arrow-rotate-left', type: 'solid' },
  { name: 'copy', type: 'solid' },
  { name: 'image', type: 'solid' },
  { name: 'images', type: 'solid' },
  { name: 'panorama', type: 'solid' },
  { name: 'tags', type: 'solid' },
  { name: 'table-list', type: 'solid' },
  { name: 'layer-group', type: 'solid' },
  { name: 'bold', type: 'solid' },
  { name: 'italic', type: 'solid' },
  { name: 'underline', type: 'solid' },
  { name: 'strikethrough', type: 'solid' },
  { name: 'heading', type: 'solid' },
  { name: 'list-ul', type: 'solid' },
  { name: 'list-ol', type: 'solid' },
  { name: 'link', type: 'solid' },
  { name: 'link-slash', type: 'solid' },
  { name: 'eraser', type: 'solid' },
  { name: 'text-height', type: 'solid' },
  { name: 'desktop', type: 'solid' },
  { name: 'tablet-screen-button', type: 'solid' },
  { name: 'mobile-screen', type: 'solid' },
  { name: 'expand', type: 'solid' },
  { name: 'compress', type: 'solid' },
  { name: 'sliders', type: 'solid' },
  { name: 'right-to-bracket', type: 'solid' },
  { name: 'arrow-right-from-bracket', type: 'solid' },
  { name: 'lock', type: 'solid' },
  { name: 'cloud-arrow-up', type: 'solid' },
  { name: 'toggle-on', type: 'solid' },
  { name: 'toggle-off', type: 'solid' },
  { name: 'grip-vertical', type: 'solid' },
  { name: 'chart-pie', type: 'solid' },
  { name: 'shuffle', type: 'solid' },
  { name: 'wand-magic-sparkles', type: 'solid' },
  { name: 'moon', type: 'solid' },
  { name: 'sun', type: 'solid' },
  { name: 'arrow-up-right-from-square', type: 'solid' },
  { name: 'angles-left', type: 'solid' },
  { name: 'angles-right', type: 'solid' },
  { name: 'circle-dot', type: 'solid' },
  { name: 'circle', type: 'solid' },
  { name: 'pause', type: 'solid' },
  { name: 'play', type: 'solid' },
  { name: 'box-archive', type: 'solid' },
];

function collectPublicCorpus() {
  const files = ['index.html', 'produtos.html', 'produto.html', 'privacidade.html'];
  const chunks = files
    .filter((f) => fs.existsSync(path.join(ROOT_DIR, f)))
    .map((f) => fs.readFileSync(path.join(ROOT_DIR, f), 'utf8'));

  function walkPublicJs(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'vendor' && entry.name !== 'admin') {
          walkPublicJs(full);
        }
      } else if (entry.isFile() && entry.name.endsWith('.js') && entry.name !== 'admin.js') {
        chunks.push(fs.readFileSync(full, 'utf8'));
      }
    }
  }
  walkPublicJs(path.join(ROOT_DIR, 'js'));
  return chunks.join('\n');
}

function collectAdminCorpus() {
  const chunks = [];
  if (fs.existsSync(path.join(ROOT_DIR, 'admin.html'))) {
    chunks.push(fs.readFileSync(path.join(ROOT_DIR, 'admin.html'), 'utf8'));
  }
  if (fs.existsSync(path.join(ROOT_DIR, 'js', 'admin.js'))) {
    chunks.push(fs.readFileSync(path.join(ROOT_DIR, 'js', 'admin.js'), 'utf8'));
  }
  function walkAdminJs(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkAdminJs(full);
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        chunks.push(fs.readFileSync(full, 'utf8'));
      }
    }
  }
  walkAdminJs(path.join(ROOT_DIR, 'js', 'admin'));
  return chunks.join('\n');
}

const publicCorpus = collectPublicCorpus();
const adminCorpus = collectAdminCorpus();

// Margem de ícones dinâmicos compartilhados para vitrine/categorias/alertas
const SHARED_FALLBACK_ICONS = new Set([
  'bars',
  'capsules',
  'bottle-droplet',
  'pump-medical',
  'shapes',
  'star',
  'circle-check',
  'circle-exclamation',
  'circle-notch',
  'triangle-exclamation',
]);

function buildIconCssRule(icon) {
  let svgPath = path.resolve(FONTAWESOME_DIR, icon.type, `${icon.name}.svg`);
  if (!fs.existsSync(svgPath) && icon.type !== 'solid') {
    svgPath = path.resolve(FONTAWESOME_DIR, 'solid', `${icon.name}.svg`);
  }
  if (!fs.existsSync(svgPath)) {
    console.warn(`Aviso: ícone não encontrado: ${icon.type}/${icon.name}`);
    return null;
  }

  const svgContent = fs.readFileSync(svgPath, 'utf8');
  const viewBoxMatch = svgContent.match(/viewBox="([^"]+)"/);
  const pathMatch = svgContent.match(/<path[^>]*d="([^"]+)"/);

  if (!viewBoxMatch || !pathMatch) {
    console.warn(`Aviso: falha ao extrair viewBox/path do ícone ${icon.name}`);
    return null;
  }

  const viewBox = viewBoxMatch[1];
  // Arredonda coordenadas decimais em canvas 512x512 para inteiros (reduz ~48% no gzip sem perda visual em 1em)
  const d = pathMatch[1].replace(/(\d+)\.\d+/g, (_, intPart) => intPart);
  const encodedSvg = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='${viewBox}'><path d='${d}'/></svg>`;
  return `.fa-${icon.name}{--icon:url("${encodedSvg}")}`;
}

const publicRules = [
  `/**
 * Botica Natural — Sistema Local de Ícones SVG (css/icons.css)
 * Cada ícone define --icon apenas uma vez; .fa-solid/.fa-regular/.fa-brands aplica mask-image: var(--icon).
 */
.fa-solid, .fa-regular, .fa-brands {
  display: inline-block;
  width: 1em;
  height: 1em;
  vertical-align: -0.125em;
  background-color: currentColor;
  -webkit-mask-image: var(--icon);
  mask-image: var(--icon);
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-size: contain;
  mask-size: contain;
  -webkit-mask-position: center;
  mask-position: center;
}

.fa-2x { font-size: 2em; }
.fa-3x { font-size: 3em; }
.fa-lg { font-size: 1.25em; }
.fa-sm { font-size: 0.875em; }
.fa-xs { font-size: 0.75em; }
.fa-fw { width: 1.25em; text-align: center; }

.fa-spin {
  animation: fa-spin 1.2s infinite linear;
}
@keyframes fa-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}`,
];

const adminOnlyRules = [];
let publicCount = 0;
let adminCount = 0;

for (const icon of CANDIDATE_ICONS) {
  const pattern = new RegExp(`fa-${icon.name}(?![a-z0-9-])`);
  const inPublic = pattern.test(publicCorpus) || SHARED_FALLBACK_ICONS.has(icon.name);
  const inAdmin = pattern.test(adminCorpus);

  if (!inPublic && !inAdmin) {
    continue;
  }

  const rule = buildIconCssRule(icon);
  if (!rule) continue;

  if (inPublic) {
    publicRules.push(rule);
    publicCount++;
  } else if (inAdmin) {
    adminOnlyRules.push(rule);
    adminCount++;
  }
}

const cssDir = path.resolve(ROOT_DIR, 'css');
const finalIconsCss = publicRules.join('\n') + '\n';
fs.writeFileSync(path.resolve(cssDir, 'icons.css'), finalIconsCss, 'utf8');

// Atualiza bloco de ícones exclusivos do admin em css/admin.css
const adminCssPath = path.resolve(cssDir, 'admin.css');
if (fs.existsSync(adminCssPath)) {
  const START_MARKER = '/* BEGIN GENERATED ADMIN ICONS */';
  const END_MARKER = '/* END GENERATED ADMIN ICONS */';
  const adminBlock = `${START_MARKER}\n${adminOnlyRules.join('\n')}\n${END_MARKER}`;
  let adminCss = fs.readFileSync(adminCssPath, 'utf8');
  if (adminCss.includes(START_MARKER) && adminCss.includes(END_MARKER)) {
    const startIdx = adminCss.indexOf(START_MARKER);
    const endIdx = adminCss.indexOf(END_MARKER) + END_MARKER.length;
    adminCss = adminCss.slice(0, startIdx) + adminBlock + adminCss.slice(endIdx);
  } else {
    adminCss = adminCss.trimEnd() + `\n\n${adminBlock}\n`;
  }
  fs.writeFileSync(adminCssPath, adminCss, 'utf8');
}

const rawBytes = Buffer.byteLength(finalIconsCss, 'utf8');
const gzipBytes = zlib.gzipSync(Buffer.from(finalIconsCss, 'utf8')).length;
console.log(
  `✓ css/icons.css gerado com ${publicCount} ícones públicos (${rawBytes} B raw / ${gzipBytes} B gzip = ${(gzipBytes / 1024).toFixed(2)} KB gzip) + ${adminCount} ícones exclusivos de admin em css/admin.css.`
);
