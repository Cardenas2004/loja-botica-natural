// @ts-check
import { test, expect } from '@playwright/test';
import { setupPageMocks } from './helpers.js';

test.describe('BUG-ESCAPE: Preservação de caracteres especiais e roundtrip de Rich Text', () => {
  test.beforeEach(async ({ page }) => {
    await setupPageMocks(page);
  });

  test('Roundtrip de 5 ciclos não deve acumular escapes compostos (&amp;amp;)', async ({ page }) => {
    await page.goto('/admin.html#/produtos/prod-1');

    // Aguarda carregamento do formulário e ativa a aba de Conteúdo (Rich Text)
    await page.waitForSelector('#product-form');
    await page.locator('button[data-tab="conteudo"]').click();

    const testInput = 'A & B < C > D "aspas"';
    const shortDescEditor = page.locator('[data-field="short_description"] .rte-editable');
    await expect(shortDescEditor).toBeVisible();

    // Digita o texto de teste
    await shortDescEditor.fill(testInput);

    // Salva o produto
    const saveBtn = page.locator('.product-sticky-footer button:has-text("Salvar e continuar")');
    await saveBtn.click();
    await page.waitForSelector('.toast--success', { timeout: 5000 });

    // Avalia o log de mutações gravado no fake database
    const mutationLog = await page.evaluate(() => {
      // @ts-ignore
      return globalThis.__log.filter((entry) => entry.operation === 'UPDATE' && entry.table === 'products');
    });

    expect(mutationLog.length).toBeGreaterThan(0);
    const lastUpdate = mutationLog[mutationLog.length - 1];
    const savedShortDesc = lastUpdate.mutationData.short_description;

    // Não pode conter escape duplo (&amp;amp; ou &amp;lt;)
    expect(savedShortDesc).not.toContain('&amp;amp;');
    expect(savedShortDesc).not.toContain('&amp;lt;');
    expect(savedShortDesc).not.toContain('&amp;gt;');

    // Valida exibição na página pública do produto (produto.html?id=prod-1)
    await page.goto('/produto.html?id=prod-1');
    await page.waitForSelector('#pdp-short-desc');
    const renderedText = await page.locator('#pdp-short-desc').textContent();
    expect(renderedText).toContain('A & B < C > D');
    expect(renderedText).not.toContain('&amp;');
    expect(renderedText).not.toContain('&lt;');
  });

  test('Verificação isolada de roundtrip nos 3 modos (paragraphs, lines, inline)', async ({ page }) => {
    await page.goto('/index.html');

    // Executa a função de sanitização no contexto real do navegador
    const roundtripResults = await page.evaluate(async () => {
      // @ts-ignore
      const module = await import('/js/shared/richtext.js');
      const input = 'A & B < C > D "aspas"';
      const modes = ['paragraphs', 'lines', 'inline'];
      const results = {};

      for (const mode of modes) {
        let cur = input;
        for (let i = 1; i <= 5; i++) {
          cur = module.sanitizeRichText(cur, { mode });
        }
        results[mode] = {
          finalValue: cur,
          hasCompoundedEscape: cur.includes('&amp;amp;') || cur.includes('&amp;lt;'),
        };
      }
      return results;
    });

    // Atualmente FALHA devido ao BUG-ESCAPE
    expect(roundtripResults.paragraphs.hasCompoundedEscape).toBe(false);
    expect(roundtripResults.lines.hasCompoundedEscape).toBe(false);
    expect(roundtripResults.inline.hasCompoundedEscape).toBe(false);
  });
});
