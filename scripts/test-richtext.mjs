// @ts-check
/**
 * Suíte automatizada de testes de segurança (XSS) e retrocompatibilidade do sanitizador de texto rico.
 * Execução: `node scripts/test-richtext.mjs` (sem dependências externas).
 */

import assert from 'node:assert/strict';
import {
  sanitizeRichText,
  sanitizeLinkHref,
  extractPlainText,
  normalizeTextMode,
} from '../js/shared/richtext.js';

let passed = 0;
let failed = 0;

/**
 * Executa um caso de teste isolado.
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

console.log('\n=== Testes do Sanitizador de Texto Rico (js/shared/richtext.js) ===\n');

// 1. Vetores diretos de execução de script
test('Remove <script>alert(1)</script> integralmente', () => {
  const out = sanitizeRichText('<script>alert(1)</script><p>Seguro</p>');
  assert.equal(out, '<p>Seguro</p>');
  assert.ok(!out.includes('script'));
  assert.ok(!out.includes('alert'));
});

test('Remove <img src=x onerror=alert(1)>', () => {
  const out = sanitizeRichText('<p>Texto <img src=x onerror=alert(1)> limpo</p>');
  assert.equal(out, '<p>Texto  limpo</p>');
  assert.ok(!out.includes('<img'));
  assert.ok(!out.includes('onerror'));
});

// 2. Vetores de links maliciosos (javascript:, data:, vbscript:, entidades HTML, case-insensitive)
test('Bloqueia <a href="javascript:alert(1)">x</a> mantendo apenas o texto', () => {
  const out = sanitizeRichText('<p><a href="javascript:alert(1)">x</a></p>');
  assert.equal(out, '<p>x</p>');
  assert.ok(!out.includes('javascript:'));
});

test('Bloqueia <a href="JaVaScRiPt:alert(1)"> case-insensitive', () => {
  const out = sanitizeRichText('<p><a href="JaVaScRiPt:alert(1)">clique</a></p>');
  assert.equal(out, '<p>clique</p>');
  assert.ok(!out.toLowerCase().includes('javascript'));
});

test('Bloqueia <a href="&#106;avascript:alert(1)"> codificado com entidades HTML', () => {
  const out = sanitizeRichText('<p><a href="&#106;avascript:alert(1)">entidade</a></p>');
  assert.equal(out, '<p>entidade</p>');
  assert.ok(!out.toLowerCase().includes('javascript'));
});

test('Bloqueia <a href="&#x6A;avascript:alert(1)"> codificado em hexadecimal e com tab/newline', () => {
  const out = sanitizeRichText('<p><a href="&#x6A;ava\tscript:alert(1)">hex</a></p>');
  assert.equal(out, '<p>hex</p>');
});

test('Bloqueia <a href="data:text/html,<script>alert(1)</script>">', () => {
  const out = sanitizeRichText('<p><a href="data:text/html,<script>alert(1)</script>">data-uri</a></p>');
  assert.equal(out, '<p>data-uri</p>');
  assert.ok(!out.includes('data:'));
});

// 3. Atributos maliciosos (onclick, on*, style com url(javascript:...))
test('Remove atributos onclick e style malicioso em <p>', () => {
  const out = sanitizeRichText(
    '<p onclick="alert(1)" onmouseover="alert(2)" style="background:url(javascript:alert(1))">ok</p>'
  );
  assert.equal(out, '<p>ok</p>');
  assert.ok(!out.includes('onclick'));
  assert.ok(!out.includes('style'));
});

// 4. Tags proibidas: <svg>, <iframe srcdoc>, <math>, <form>, <object>, <embed>, <style>
test('Remove <svg onload=alert(1)>, <iframe srcdoc>, <math> e <form>', () => {
  const payload = [
    '<svg onload=alert(1)><circle r="10"/></svg>',
    '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
    '<math><mi xlink:href="javascript:alert(1)">x</mi></math>',
    '<form action="javascript:alert(1)"><input name="x"><button>Enviar</button></form>',
    '<p>Conteúdo válido</p>',
  ].join('');
  const out = sanitizeRichText(payload);
  assert.equal(out, '<p>Conteúdo válido</p>');
});

// 5. Aninhamento malformado
test('Neutraliza aninhamento malformado <<script>script>alert(1)<</script>/script>', () => {
  const out = sanitizeRichText('<<script>script>alert(1)<</script>/script>');
  assert.ok(!out.toLowerCase().includes('<script'));
  assert.ok(!out.includes('alert(1)'));
});

test('Neutraliza duplo aninhamento <<script></script>script>alert(1)</script>', () => {
  const out = sanitizeRichText('<<script></script>script>alert(1)</script>');
  assert.ok(!out.toLowerCase().includes('<script'));
  assert.ok(!out.includes('alert(1)'));
});

// 6. Preservação correta da whitelist e normalização semântica
test('Preserva <strong>, <em>, <ul><li> e adiciona rel="noopener noreferrer" em <a href="https://exemplo.com">', () => {
  const input =
    '<p><b>Negrito</b> e <i>Itálico</i> com <a href="https://exemplo.com">Link seguro</a></p><ul><li>Item 1</li><li>Item 2</li></ul>';
  const out = sanitizeRichText(input, { mode: 'paragraphs' });
  assert.equal(
    out,
    '<p><strong>Negrito</strong> e <em>Itálico</em> com <a href="https://exemplo.com/" target="_blank" rel="noopener noreferrer">Link seguro</a></p><ul><li>Item 1</li><li>Item 2</li></ul>'
  );
});

test('Normaliza <h1> e <h2> para <h3> (nunca permite h1/h2 em conteúdo de produto)', () => {
  const out = sanitizeRichText('<h1>Título 1</h1><h2>Título 2</h2><h4>Subtítulo 4</h4>');
  assert.equal(out, '<h3>Título 1</h3><h3>Título 2</h3><h4>Subtítulo 4</h4>');
  assert.ok(!out.includes('<h1'));
  assert.ok(!out.includes('<h2'));
});

// 7. Retrocompatibilidade com texto puro legado (\n e \n\n) nos 3 modos
test('Retrocompatibilidade no modo "paragraphs": converte \\n\\n em <p> e \\n em <br>', () => {
  const legacyText = 'Tomar 1 cápsula ao dia.\nPreferencialmente junto às refeições.\n\nUso adulto.';
  const out = sanitizeRichText(legacyText, { mode: 'paragraphs' });
  assert.equal(
    out,
    '<p>Tomar 1 cápsula ao dia.<br>Preferencialmente junto às refeições.</p><p>Uso adulto.</p>'
  );
});

test('Retrocompatibilidade no modo "lines": converte \\n em <br> sem criar <p>', () => {
  const legacyText = 'Linha 1\nLinha 2\nLinha 3';
  const out = sanitizeRichText(legacyText, { mode: 'lines' });
  assert.equal(out, 'Linha 1<br>Linha 2<br>Linha 3');
});

test('Retrocompatibilidade no modo "inline": remove quebras de linha e blocos mantendo inline', () => {
  const legacyText = 'Não contém lactose\ne glúten.';
  const out = sanitizeRichText(legacyText, { mode: 'inline' });
  assert.equal(out, 'Não contém lactose e glúten.');

  const htmlInline = sanitizeRichText('<p>Em até <strong>3x sem juros</strong></p><p>no cartão</p>', {
    mode: 'inline',
  });
  assert.equal(htmlInline, 'Em até <strong>3x sem juros</strong> no cartão');
});

// 8. Utilitários auxiliares
test('sanitizeLinkHref aceita https:, http:, mailto:, tel: e rejeita protocolos perigosos', () => {
  assert.equal(sanitizeLinkHref('https://boticanatural.com.br/produtos'), 'https://boticanatural.com.br/produtos');
  assert.equal(sanitizeLinkHref('mailto:contato@exemplo.com'), 'mailto:contato@exemplo.com');
  assert.equal(sanitizeLinkHref('tel:+5511999999999'), 'tel:+5511999999999');
  assert.equal(sanitizeLinkHref('javascript:void(0)'), null);
  assert.equal(sanitizeLinkHref('vbscript:msgbox(1)'), null);
  assert.equal(sanitizeLinkHref('//atacante.com/phishing'), null);
});

test('extractPlainText extrai texto limpo para contadores e SEO', () => {
  const plain = extractPlainText('<p>Fórmula <strong>manipulada</strong> com <em>controle</em>.</p>');
  assert.equal(plain, 'Fórmula manipulada com controle.');
  assert.equal(normalizeTextMode('invalid', 'lines'), 'lines');
});

console.log(`\nResultado: ${passed} passaram, ${failed} falharam.\n`);
if (failed > 0) {
  process.exit(1);
}

