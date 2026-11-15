#!/usr/bin/env node
// @ts-check
/**
 * ============================================================================
 * Botica Natural — Script de Troca Idempotente de Domínio (`scripts/set-domain.mjs`)
 * ============================================================================
 * Uso:
 *   node scripts/set-domain.mjs https://boticanaturaltriunfo.com.br
 *
 * O que este script faz:
 *   1. Valida o formato do domínio (deve iniciar com https://, sem barra final,
 *      sem caminho, query ou fragmento).
 *   2. Lê o valor atual de `SITE_DOMAIN` em `js/config.js`.
 *   3. Substitui de forma idempotente todas as ocorrências (literais e URL-encoded) em:
 *      - `js/config.js`
 *      - `index.html`, `produtos.html`, `produto.html`, `privacidade.html`
 *      - páginas estáticas geradas em `produtos/<slug>/index.html` (se existirem)
 *      - `robots.txt`
 *      - `sitemap.xml`
 *   4. Executa `node scripts/verify.mjs` para atestar consistência total.
 * ============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');

/**
 * Valida se o argumento é uma origem HTTPS estrita sem barra final.
 * @param {string | undefined} rawInput
 * @returns {string}
 */
function validateDomainInput(rawInput) {
  const input = String(rawInput || '').trim();
  if (!input) {
    console.error('Erro: informe o domínio oficial. Exemplo: node scripts/set-domain.mjs https://boticanaturaltriunfo.com.br');
    process.exit(1);
  }

  if (!input.startsWith('https://')) {
    console.error(`Erro: o domínio deve utilizar HTTPS ("https://..."). Recebido: "${input}"`);
    process.exit(1);
  }

  if (input.endsWith('/')) {
    console.error(`Erro: o domínio não deve terminar com barra ("/"). Recebido: "${input}"`);
    process.exit(1);
  }

  let parsed;
  try {
    parsed = new URL(input);
  } catch {
    console.error(`Erro: URL inválida: "${input}"`);
    process.exit(1);
  }

  if (parsed.origin !== input || !parsed.hostname.includes('.')) {
    console.error(`Erro: informe apenas o protocolo e o host (sem caminhos ou parâmetros). Recebido: "${input}"`);
    process.exit(1);
  }

  return parsed.origin;
}

/**
 * Coleta páginas estáticas geradas em `produtos/<slug>/index.html`.
 * @param {string} dir
 * @returns {string[]}
 */
function collectGeneratedProductPages(dir) {
  if (!fs.existsSync(dir)) return [];
  /** @type {string[]} */
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectGeneratedProductPages(full));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      results.push(path.relative(ROOT, full));
    }
  }
  return results;
}

function main() {
  const targetDomain = validateDomainInput(process.argv[2]);
  const configPath = path.join(ROOT, 'js/config.js');
  const configContent = fs.readFileSync(configPath, 'utf8');

  const match = configContent.match(/export\s+const\s+SITE_DOMAIN\s*=\s*['"]([^'"]+)['"]/);
  if (!match) {
    console.error('Erro: não foi possível localizar SITE_DOMAIN em js/config.js.');
    process.exit(1);
  }

  const currentDomain = match[1];
  const targetFiles = [
    'js/config.js',
    'index.html',
    'produtos.html',
    'produto.html',
    'privacidade.html',
    'robots.txt',
    'sitemap.xml',
    ...collectGeneratedProductPages(path.join(ROOT, 'produtos')),
  ];

  const currentEncoded = encodeURIComponent(currentDomain);
  const targetEncoded = encodeURIComponent(targetDomain);

  let updatedFilesCount = 0;

  for (const relPath of targetFiles) {
    const absPath = path.join(ROOT, relPath);
    if (!fs.existsSync(absPath)) continue;

    const before = fs.readFileSync(absPath, 'utf8');
    const after = before
      .split(currentDomain)
      .join(targetDomain)
      .split(currentEncoded)
      .join(targetEncoded);

    if (after !== before) {
      fs.writeFileSync(absPath, after, 'utf8');
      updatedFilesCount++;
      console.log(`  [ATUALIZADO] ${relPath}`);
    } else {
      console.log(`  [IDEMPOTENTE] ${relPath} (já utiliza ${targetDomain})`);
    }
  }

  console.log(`\nDomínio configurado para: ${targetDomain} (${updatedFilesCount} arquivo(s) modificado(s)).`);
  console.log('Executando verificação estática (scripts/verify.mjs)...\n');

  const verifyResult = spawnSync(process.execPath, [path.join(ROOT, 'scripts/verify.mjs')], {
    cwd: ROOT,
    stdio: 'inherit',
  });

  if (verifyResult.status !== 0) {
    process.exit(verifyResult.status || 1);
  }
}

main();
