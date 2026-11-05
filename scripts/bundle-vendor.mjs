import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const ROOT_DIR = path.resolve(path.dirname(__filename), '..');
const VENDOR_DIR = path.resolve(ROOT_DIR, 'js', 'vendor');

if (!fs.existsSync(VENDOR_DIR)) {
  fs.mkdirSync(VENDOR_DIR, { recursive: true });
}

console.log('Gerando vendor bundles para produção estática...');

// 1. Supabase JS 2.49.1 ESM Standalone
const supabaseTempEntry = path.resolve(VENDOR_DIR, '_supabase_entry.js');
fs.writeFileSync(supabaseTempEntry, `export * from '@supabase/supabase-js';`);

const supabaseOutputFile = path.resolve(VENDOR_DIR, 'supabase-js-2.49.1.esm.js');
await esbuild.build({
  entryPoints: [supabaseTempEntry],
  outfile: supabaseOutputFile,
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: ['es2022'],
  minify: true,
  banner: {
    js: `/**
 * @supabase/supabase-js v2.49.1 — Standalone ESM Vendor Bundle (Botica Natural)
 * Bundled with esbuild for zero-dependency static production execution.
 */`,
  },
});
fs.unlinkSync(supabaseTempEntry);
console.log('✓ js/vendor/supabase-js-2.49.1.esm.js criado com sucesso.');

// 2. Swiper 11.2.4 JS e CSS
const swiperJsSrc = path.resolve(ROOT_DIR, 'node_modules', 'swiper', 'swiper-bundle.min.js');
const swiperCssSrc = path.resolve(ROOT_DIR, 'node_modules', 'swiper', 'swiper-bundle.min.css');

if (fs.existsSync(swiperJsSrc)) {
  fs.copyFileSync(swiperJsSrc, path.resolve(VENDOR_DIR, 'swiper-11.2.4.bundle.min.js'));
  console.log('✓ js/vendor/swiper-11.2.4.bundle.min.js copiado.');
}

if (fs.existsSync(swiperCssSrc)) {
  const cssVendorDir = path.resolve(ROOT_DIR, 'css', 'vendor');
  if (!fs.existsSync(cssVendorDir)) fs.mkdirSync(cssVendorDir, { recursive: true });
  fs.copyFileSync(swiperCssSrc, path.resolve(cssVendorDir, 'swiper-11.2.4.bundle.min.css'));
  console.log('✓ css/vendor/swiper-11.2.4.bundle.min.css copiado.');
}

console.log('Vendor bundles gerados com sucesso.');
