// @ts-check
/**
 * Script de Auditoria e Reparação de Entidades Duplamente Escapadas (BUG-ESCAPE).
 *
 * Varre a tabela `products` do Supabase identificando campos com `&amp;amp;`, `&amp;lt;`, etc.,
 * exibe relatório detalhado no console e, quando executado com `--apply`, salva backup JSON
 * local e grava os dados reparados atualizando `text_options._v = 2`.
 *
 * Uso:
 *   node scripts/repair-escapes.mjs            # Modo simulação (dry-run)
 *   node scripts/repair-escapes.mjs --apply    # Aplica as correções no Supabase com backup prévio
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// 1. Campos de texto auditados
const TEXT_FIELDS = [
  'short_description',
  'description',
  'usage_instructions',
  'composition',
  'package_info',
  'allergen_info',
  'quality_note',
  'payment_info',
];

// 2. Regex para detectar entidades compostas/duplamente escapadas
const COMPOUND_REGEX = /&amp;(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/gi;

/**
 * Remove escapes compostos repetidamente até que o texto se estabilize.
 * @param {string | null | undefined} text
 * @returns {string}
 */
export function repairCompoundedEscapes(text) {
  if (typeof text !== 'string' || !text) return text || '';
  let current = text;
  let previous = '';
  while (current !== previous) {
    previous = current;
    current = current.replace(COMPOUND_REGEX, '&$1;');
  }
  return current;
}

/**
 * Conta quantas entidades duplamente escapadas existem no texto.
 * @param {string | null | undefined} text
 * @returns {number}
 */
function countCompoundedEscapes(text) {
  if (typeof text !== 'string' || !text) return 0;
  const matches = text.match(COMPOUND_REGEX);
  return matches ? matches.length : 0;
}

// 3. Resolução de credenciais
const args = process.argv.slice(2);
const isApply = args.includes('--apply');

const envUrl = process.env.SUPABASE_URL;
const envKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_ANON_KEY;

// Fallback padrão para configuração local
const DEFAULT_URL = 'https://njdkuhgoophzjxmmempu.supabase.co';
const DEFAULT_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qZGt1aGdvb3Boemp4bW1lbXB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwNTUzMTcsImV4cCI6MjEwODYzMTMxN30._OoxbYVB16sKWtH5vyOygPvcMOQtPdOluS15x1pJgq0';

const supabaseUrl = (envUrl || DEFAULT_URL).replace(/\/+$/, '');
const supabaseKey = (envKey || DEFAULT_KEY).trim();

async function main() {
  console.log('====================================================================');
  console.log('Botica Natural — Auditoria e Reparação de Escapes Compostos (v2)');
  console.log('====================================================================');
  console.log(`URL do Supabase : ${supabaseUrl}`);
  console.log(`Modo de Operação: ${isApply ? 'APLICAR CORREÇÕES (--apply)' : 'SIMULAÇÃO / DRY-RUN'}`);
  console.log('--------------------------------------------------------------------\n');

  console.log('Consultando tabela "products"...');

  const selectCols = ['id', 'name', 'text_options', ...TEXT_FIELDS].join(',');
  const queryUrl = `${supabaseUrl}/rest/v1/products?select=${encodeURIComponent(selectCols)}&order=name.asc`;

  const response = await fetch(queryUrl, {
    method: 'GET',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`Erro ao consultar produtos: HTTP ${response.status} — ${errorBody}`);
    process.exit(1);
  }

  /** @type {Array<Record<string, any>>} */
  const products = await response.json();
  console.log(`Total de produtos encontrados: ${products.length}\n`);

  const affectedProducts = [];

  for (const prod of products) {
    let totalCorrupted = 0;
    const fieldDetails = {};
    const repairedFields = {};

    for (const field of TEXT_FIELDS) {
      const val = prod[field];
      const count = countCompoundedEscapes(val);
      if (count > 0) {
        totalCorrupted += count;
        fieldDetails[field] = count;
        repairedFields[field] = repairCompoundedEscapes(val);
      }
    }

    if (totalCorrupted > 0) {
      affectedProducts.push({
        id: prod.id,
        name: prod.name,
        totalCorrupted,
        fieldDetails,
        repairedFields,
        originalRecord: prod,
      });
    }
  }

  if (affectedProducts.length === 0) {
    console.log('[OK] Nenhum produto com entidades duplamente escapadas foi encontrado.');
    console.log('A base de dados de produtos está íntegra.');
    return;
  }

  console.log(`Foram identificados ${affectedProducts.length} produto(s) com corrupção de escape:\n`);
  for (const item of affectedProducts) {
    console.log(`• [${item.id}] "${item.name}"`);
    console.log(`  Total de entidades corrompidas: ${item.totalCorrupted}`);
    for (const [field, cnt] of Object.entries(item.fieldDetails)) {
      console.log(`    - ${field}: ${cnt} ocorrência(s)`);
    }
  }

  if (!isApply) {
    console.log('\n====================================================================');
    console.log('[SIMULAÇÃO CONCLUÍDA] Nenhuma alteração foi persistida no banco.');
    console.log('Para aplicar o reparo e atualizar text_options._v = 2, execute:');
    console.log('  node scripts/repair-escapes.mjs --apply');
    console.log('====================================================================');
    return;
  }

  // Modo --apply: grava backup antes de qualquer mutação
  const backupsDir = path.join(PROJECT_ROOT, 'backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFilePath = path.join(backupsDir, `products-escapes-${timestamp}.json`);
  const backupData = affectedProducts.map((p) => p.originalRecord);

  fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2), 'utf-8');
  console.log(`\n[BACKUP] Backup de segurança salvo em: ${backupFilePath}`);

  console.log('\nAplicando correções no Supabase...');
  let successCount = 0;
  let failCount = 0;

  for (const item of affectedProducts) {
    const rawOptions = item.originalRecord.text_options;
    const nextOptions = {
      ...(typeof rawOptions === 'object' && rawOptions !== null ? rawOptions : {}),
      _v: 2,
    };

    const patchPayload = {
      ...item.repairedFields,
      text_options: nextOptions,
    };

    const patchUrl = `${supabaseUrl}/rest/v1/products?id=eq.${encodeURIComponent(item.id)}`;
    const patchRes = await fetch(patchUrl, {
      method: 'PATCH',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(patchPayload),
    });

    if (patchRes.ok) {
      successCount++;
      console.log(`  ✓ [${item.id}] "${item.name}" atualizado.`);
    } else {
      failCount++;
      const errTxt = await patchRes.text();
      console.error(`  ✗ [${item.id}] Erro: HTTP ${patchRes.status} — ${errTxt}`);
    }
  }

  console.log('\n====================================================================');
  console.log(`REPARO FINALIZADO: ${successCount} atualizados com sucesso, ${failCount} falhas.`);
  console.log('====================================================================');
}

main().catch((err) => {
  console.error('Erro fatal durante a execução:', err);
  process.exit(1);
});
