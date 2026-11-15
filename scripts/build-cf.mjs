#!/usr/bin/env node
// @ts-check
/**
 * ============================================================================
 * Botica Natural — Empacotador Estático Limpo para Cloudflare Pages (`scripts/build-cf.mjs`)
 * ============================================================================
 * Copia apenas os arquivos públicos de produção para `dist/`, evitando expor
 * `docs/`, `scripts/`, `supabase/`, `tests/`, `node_modules/`, `package.json`,
 * relatórios Markdown ou configurações de ferramentas caso a hospedagem use
 * diretório de saída dedicado.
 *
 * O site continua 100% funcional diretamente pela raiz (sem etapa obrigatória de build).
 * ============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const DIST_DIR = path.join(ROOT, 'dist');

const PUBLIC_FILES = [
  '_headers',
  '_redirects',
  'robots.txt',
  'sitemap.xml',
  'favicon.ico',
  'index.html',
  'produtos.html',
  'produto.html',
  'privacidade.html',
  'admin.html',
  '404.html',
];

const PUBLIC_DIRS = ['css', 'js', 'images', 'fonts', 'produtos'];

/**
 * Copia arquivo ou diretório recursivamente preservando apenas itens visíveis públicos.
 * @param {string} src
 * @param {string} dest
 */
function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === 'Thumbs.db') continue;
      copyRecursive(path.join(src, entry.name), path.join(dest, entry.name));
    }
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function main() {
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
  fs.mkdirSync(DIST_DIR, { recursive: true });

  let copiedFiles = 0;
  for (const rel of PUBLIC_FILES) {
    const src = path.join(ROOT, rel);
    if (!fs.existsSync(src)) {
      console.error(`[build-cf] Arquivo obrigatório ausente: ${rel}`);
      process.exit(1);
    }
    fs.copyFileSync(src, path.join(DIST_DIR, rel));
    copiedFiles += 1;
  }

  for (const dir of PUBLIC_DIRS) {
    const src = path.join(ROOT, dir);
    if (!fs.existsSync(src)) {
      console.warn(`[build-cf] Diretório opcional ausente: ${dir}`);
      continue;
    }
    copyRecursive(src, path.join(DIST_DIR, dir));
  }

  console.log(
    `[build-cf] Pacote limpo gerado em dist/ (${copiedFiles} arquivos raiz + diretórios ${PUBLIC_DIRS.join(', ')}).`
  );
}

main();
