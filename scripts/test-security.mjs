// @ts-check
/**
 * Testes unitários de sanitização de erros e telemetria (`normalizeSupabaseError`).
 */

import assert from 'node:assert/strict';
import { normalizeSupabaseError } from '../js/publicApi.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  ✗ ${name}`);
    console.error(`    ${err instanceof Error ? err.message : String(err)}`);
  }
}

console.log('\n=== Testes de Normalização Segura de Erros (js/publicApi.js) ===\n');

test('normalizeSupabaseError nunca vaza tabelas, policies, SQL codes ou stack traces em userMessage', () => {
  const samples = [
    { code: '42P01', message: 'relation "public.admin_users" does not exist\n    at query (db.js:12)' },
    { code: 'PGRST205', message: 'Could not find the table public.compound_showcase_cards in schema cache' },
    { code: '42501', message: 'new row violates row-level security policy "products_insert_admin"' },
    { code: 'PGRST999', message: 'column "price" of relation "products" violates check constraint\nError: stack' },
    new Error('SELECT * FROM public.carousel_slides failed for user@example.com token=secret123'),
  ];

  for (const err of samples) {
    const out = normalizeSupabaseError(err, 'Falha na operação');
    assert.ok(!/admin_users|compound_showcase_cards|carousel_slides|products|is_admin|policy|42P01|42501|PGRST|\bat\b\s+/i.test(out.userMessage), `Vazou detalhe interno: ${out.userMessage}`);
    assert.ok(!out.userMessage.includes('user@example.com'));
    assert.ok(!out.userMessage.includes('secret123'));
  }
});

test('normalizeSupabaseError usa console.debug e redige e-mails e tokens JWT/Bearer', () => {
  const origDebug = console.debug;
  const origError = console.error;
  /** @type {any[]} */
  const debugCalls = [];
  let errorCalled = false;

  console.debug = (...args) => debugCalls.push(args);
  console.error = () => {
    errorCalled = true;
  };

  try {
    normalizeSupabaseError(
      {
        code: 'invalid_credentials',
        status: 400,
        message: 'Invalid login for dono@botica.com.br with Bearer eyJhbGciOiJIUzI1NiJ9.abcdef123456.sig',
      },
      'Falha na autenticação'
    );
  } finally {
    console.debug = origDebug;
    console.error = origError;
  }

  assert.equal(errorCalled, false, 'normalizeSupabaseError não deve usar console.error');
  assert.equal(debugCalls.length, 1);
  const serialized = JSON.stringify(debugCalls[0]);
  assert.ok(!serialized.includes('dono@botica.com.br'), 'E-mail vazou no console.debug');
  assert.ok(!serialized.includes('abcdef123456'), 'JWT vazou no console.debug');
  assert.ok(serialized.includes('[redacted-email]'));
});

test('normalizeSupabaseError uniformiza mensagens de erro de credenciais / conta inexistente', () => {
  for (const code of ['invalid_credentials', 'user_not_found', 'email_not_confirmed']) {
    const out = normalizeSupabaseError({ code, status: 400, message: code }, 'Login');
    assert.equal(out.userMessage, 'E-mail ou senha inválidos.');
  }
});

console.log(`\nResultado: ${passed} passaram, ${failed} falharam.\n`);
if (failed > 0) process.exit(1);
