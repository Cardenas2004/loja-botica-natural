// @ts-check
/**
 * Suíte automatizada de segurança de URLs e proteção contra Open Redirect (`js/shared/urlSafety.js`).
 * Execução: `node scripts/test-urlsafety.mjs` (incluída em `npm test`).
 */

import assert from 'node:assert/strict';
import { classifySafeLink, isSafeNavigationLink } from '../js/shared/urlSafety.js';
import { sanitizeLinkHref } from '../js/shared/richtext.js';
import { resolveSafeProductHref } from '../js/whatsapp.js';
import {
  isValidCompoundLink,
  resolveCompoundDestination,
} from '../js/shared/compoundShowcaseRenderer.js';

const BASE_ORIGIN = 'https://boticanaturaltriunfo.com.br';

let passed = 0;
let failed = 0;

/**
 * @param {string} name
 * @param {() => void} fn
 */
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

console.log('\n=== Testes de Segurança de Links / Open Redirect (js/shared/urlSafety.js) ===\n');

const MALICIOUS_PAYLOADS = [
  '//evil.com',
  '/\\evil.com',
  '\\/evil.com',
  '/\\/evil.com',
  '\\\\evil.com',
  '///evil.com',
  '\u200B/\u200B/evil.com',
  '&#47;&#92;evil.com',
  '&#x2f;&#x2f;evil.com',
  'javascript:alert(1)',
  'java\tscript:alert(1)',
  'java script:alert(1)',
  '&#106;avascript:',
  '&amp;#106;avascript:alert(1)',
  'data:text/html,x',
  'vbscript:msgbox(1)',
  'file:///etc/passwd',
  'blob:https://x/1',
  'intent://x#Intent;scheme=http;end',
  'https:///evil.com',
  'https://\\evil.com',
  'https://boticanaturaltriunfo.com.br@evil.com',
];

test('Bloqueia todos os payloads de open redirect e esquemas perigosos em classifySafeLink', () => {
  for (const payload of MALICIOUS_PAYLOADS) {
    const res = classifySafeLink(payload, { baseOrigin: BASE_ORIGIN });
    assert.equal(res.valid, false, `Payload deveria ser bloqueado: ${JSON.stringify(payload)}`);
    assert.equal(res.kind, 'invalid', `Kind esperado invalid para: ${JSON.stringify(payload)}`);
    assert.equal(res.href, null, `Href esperado null para: ${JSON.stringify(payload)}`);
  }
});

test('Bloqueia todos os payloads maliciosos em sanitizeLinkHref, isValidCompoundLink, resolveSafeProductHref e isSafeNavigationLink', () => {
  for (const payload of MALICIOUS_PAYLOADS) {
    assert.equal(
      sanitizeLinkHref(payload),
      null,
      `sanitizeLinkHref deveria retornar null para: ${JSON.stringify(payload)}`
    );
    assert.equal(
      isValidCompoundLink(payload),
      false,
      `isValidCompoundLink deveria retornar false para: ${JSON.stringify(payload)}`
    );
    assert.equal(
      isSafeNavigationLink(payload),
      false,
      `isSafeNavigationLink deveria retornar false para: ${JSON.stringify(payload)}`
    );
    assert.equal(
      resolveSafeProductHref(payload, []),
      '',
      `resolveSafeProductHref deveria retornar "" para: ${JSON.stringify(payload)}`
    );
  }
});

test('Classifica link externo https://ok.com com target="_blank" e rel="noopener noreferrer"', () => {
  const res = classifySafeLink('https://ok.com', { baseOrigin: BASE_ORIGIN });
  assert.equal(res.valid, true);
  assert.equal(res.isEmpty, false);
  assert.equal(res.kind, 'https');
  assert.equal(res.href, 'https://ok.com/');
  assert.equal(res.isExternal, true);
  assert.equal(res.target, '_blank');
  assert.equal(res.rel, 'noopener noreferrer');
  assert.equal(isValidCompoundLink('https://ok.com'), true);
});

test('Resolve caminhos relativos seguros (/produtos, #produtos, produtos.html?x=1) exigindo mesma origem', () => {
  const p1 = classifySafeLink('/produtos', { baseOrigin: BASE_ORIGIN });
  assert.deepEqual(
    { valid: p1.valid, kind: p1.kind, href: p1.href, isExternal: p1.isExternal },
    { valid: true, kind: 'relative', href: '/produtos', isExternal: false }
  );

  const p2 = classifySafeLink('#produtos', { baseOrigin: BASE_ORIGIN });
  assert.deepEqual(
    { valid: p2.valid, kind: p2.kind, href: p2.href, isExternal: p2.isExternal },
    { valid: true, kind: 'relative', href: '/#produtos', isExternal: false }
  );

  const p3 = classifySafeLink('produtos.html?x=1', { baseOrigin: BASE_ORIGIN });
  assert.deepEqual(
    { valid: p3.valid, kind: p3.kind, href: p3.href, isExternal: p3.isExternal },
    { valid: true, kind: 'relative', href: '/produtos.html?x=1', isExternal: false }
  );
});

test('Permite mailto: e tel: em classifySafeLink/richtext, mas restringe em isSafeNavigationLink/compostos', () => {
  const mail = classifySafeLink('mailto:contato@exemplo.com', { baseOrigin: BASE_ORIGIN });
  assert.equal(mail.valid, true);
  assert.equal(mail.kind, 'mailto');

  const phone = classifySafeLink('tel:+5551985543448', { baseOrigin: BASE_ORIGIN });
  assert.equal(phone.valid, true);
  assert.equal(phone.kind, 'tel');

  assert.equal(isSafeNavigationLink('mailto:contato@exemplo.com'), false);
  assert.equal(isSafeNavigationLink('tel:+5551985543448'), false);
  assert.equal(isValidCompoundLink('mailto:contato@exemplo.com'), false);
});

test('resolveCompoundDestination descarta /\\evil.com e nunca produz href externo perigoso', () => {
  const resolved = resolveCompoundDestination(
    { title: 'Card Injetado', button_link: '/\\evil.com', product_id: null },
    []
  );
  assert.equal(resolved.href, '#produtos');
  assert.equal(resolved.isExternal, false);

  const resolvedExternal = resolveCompoundDestination(
    { title: 'Parceiro', button_link: 'https://ok.com', product_id: null, open_in_new_tab: false },
    []
  );
  assert.equal(resolvedExternal.href, 'https://ok.com/');
  assert.equal(resolvedExternal.isExternal, true);
});

console.log(`\nResultado: ${passed} passaram, ${failed} falharam.\n`);
if (failed > 0) {
  process.exit(1);
}
