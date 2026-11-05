// @ts-check
import { test, expect } from '@playwright/test';
import { setupPageMocks } from './helpers.js';

test.describe('BUG-AUTH-RERENDER: Proteção contra perda de dados por eventos de autenticação', () => {
  test.beforeEach(async ({ page }) => {
    await setupPageMocks(page);
  });

  test('Eventos TOKEN_REFRESHED e SIGNED_IN não devem resetar formulário em edição nem refazer consultas completas', async ({ page }) => {
    await page.goto('/admin.html#/produtos/novo');
    await page.waitForSelector('#product-form');

    // Preenche campo de nome com alteração pendente (formulário sujo)
    const nameInput = page.locator('#prod-name');
    await nameInput.fill('Fórmula Personalizada em Andamento');

    // Preenche campo no editor
    await page.locator('button[data-tab="conteudo"]').click();
    const shortDescEditor = page.locator('[data-field="short_description"] .rte-editable');
    await shortDescEditor.fill('Texto não salvo em edição ativa.');

    // Zera contagem de requisições de log
    await page.evaluate(() => {
      // @ts-ignore
      globalThis.__log = [];
    });

    // Dispara TOKEN_REFRESHED para o mesmo usuário
    await page.evaluate(() => {
      // @ts-ignore
      globalThis.__dispatchAuthEvent('TOKEN_REFRESHED');
    });

    // Aguarda ciclo de microtasks/event loop
    await page.waitForTimeout(300);

    // O valor do campo deve permanecer intacto (sem ser apagado pelo re-render)
    const currentName = await nameInput.inputValue();
    expect(currentName).toBe('Fórmula Personalizada em Andamento');

    const currentShortDesc = await shortDescEditor.textContent();
    expect(currentShortDesc).toBe('Texto não salvo em edição ativa.');

    // Verifica que NÃO foram refeitas 4 consultas completas (fetchAllAdminData)
    const logs = await page.evaluate(() => {
      // @ts-ignore
      return globalThis.__log.filter((entry) => entry.operation === 'SELECT');
    });

    // Atualmente FALHA porque o callback dispara fetchAllAdminData({force:true}) e renderCurrentRoute()
    expect(logs.length).toBe(0);
  });
});
