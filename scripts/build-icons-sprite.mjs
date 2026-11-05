import fs from 'node:fs';
import path from 'node:path';
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

const ICONS = [
  // Storefront & Admin Icons
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
  { name: 'cloud-check', type: 'solid' },
  { name: 'toggle-on', type: 'solid' },
  { name: 'toggle-off', type: 'solid' },
  { name: 'grip-vertical', type: 'solid' },
  { name: 'chart-pie', type: 'solid' },
  { name: 'shuffle', type: 'solid' },
  { name: 'wand-magic-sparkles', type: 'solid' },
];

let spriteSymbols = [];
let cssRules = [];

cssRules.push(`/**
 * Botica Natural — Sistema Local de Ícones SVG
 * Substitui o download completo do Font Awesome (120 KB CSS + 1.5 MB de fontes web .woff2)
 * por máscaras vetoriais ultraleves integradas.
 */
.fa-solid, .fa-regular, .fa-brands {
  display: inline-block;
  width: 1em;
  height: 1em;
  vertical-align: -0.125em;
  background-color: currentColor;
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
}
`);

for (const icon of ICONS) {
  let svgPath = path.resolve(FONTAWESOME_DIR, icon.type, `${icon.name}.svg`);
  if (!fs.existsSync(svgPath) && icon.type !== 'solid') {
    svgPath = path.resolve(FONTAWESOME_DIR, 'solid', `${icon.name}.svg`);
  }
  if (!fs.existsSync(svgPath)) {
    console.warn(`Aviso: ícone não encontrado: ${icon.type}/${icon.name}`);
    continue;
  }

  const svgContent = fs.readFileSync(svgPath, 'utf8');
  const viewBoxMatch = svgContent.match(/viewBox="([^"]+)"/);
  const pathMatch = svgContent.match(/<path[^>]*d="([^"]+)"/);

  if (!viewBoxMatch || !pathMatch) {
    console.warn(`Aviso: falha ao extrair viewBox/path do ícone ${icon.name}`);
    continue;
  }

  const viewBox = viewBoxMatch[1];
  const d = pathMatch[1];

  // 1. Adiciona ao sprite SVG
  spriteSymbols.push(`  <symbol id="${icon.name}" viewBox="${viewBox}">\n    <path fill="currentColor" d="${d}"/>\n  </symbol>`);

  // 2. Cria SVG codificado para mask-image no CSS
  const encodedSvg = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='${viewBox}'><path fill='black' d='${d}'/></svg>`;

  cssRules.push(`.fa-${icon.name} {
  -webkit-mask-image: url("${encodedSvg}");
  mask-image: url("${encodedSvg}");
}`);
}

// Salva images/icons.svg
const spriteXml = `<svg xmlns="http://www.w3.org/2000/svg" style="display: none;">\n${spriteSymbols.join('\n')}\n</svg>\n`;
const imagesDir = path.resolve(ROOT_DIR, 'images');
if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
fs.writeFileSync(path.resolve(imagesDir, 'icons.svg'), spriteXml, 'utf8');
console.log(`✓ images/icons.svg gerado com ${spriteSymbols.length} símbolos.`);

// Salva css/icons.css
const cssDir = path.resolve(ROOT_DIR, 'css');
fs.writeFileSync(path.resolve(cssDir, 'icons.css'), cssRules.join('\n\n') + '\n', 'utf8');
console.log(`✓ css/icons.css gerado com ${spriteSymbols.length} regras.`);
