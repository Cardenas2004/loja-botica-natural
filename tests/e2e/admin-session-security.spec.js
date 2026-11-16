// @ts-check
import { test, expect } from '@playwright/test';
import { setupPageMocks } from './helpers.js';

test.describe('Sessão Administrativa, Limpeza de Rascunhos e Inatividade (Fase 2 — Item 4)', () => {
  test('Logout limpa o rascunho de produto em localStorage (DRAFT_STORAGE_KEY)', async ({
    page,
  }) => {
    await setupPageMocks(page);
    await page.goto('/admin.html#/produtos/novo', { waitUntil: 'domcontentloaded' });

    const nameInput = page.locator('#prod-name');
    await expect(nameInput).toBeVisible();
    await nameInput.fill('Produto Rascunho Confidencial');

    // Aguarda debounce de 1s gravar rascunho em localStorage
    await expect
      .poll(async () => page.evaluate(() => window.localStorage.getItem('botica_draft_product_new')))
      .not.toBeNull();

    await page.locator('#btn-logout').click();

    // Confirma saída com alterações não salvas no modal
    const confirmModal = page.locator('#confirm-modal');
    await expect(confirmModal).toBeVisible();
    await page.locator('#modal-btn-confirm').click();

    await expect(page.locator('#login-view')).toBeVisible();
    const draftAfterLogout = await page.evaluate(() =>
      window.localStorage.getItem('botica_draft_product_new')
    );
    expect(draftAfterLogout).toBeNull();
  });

  test('Queda de sessão (SIGNED_OUT) apaga rascunhos salvos em localStorage', async ({ page }) => {
    await setupPageMocks(page);
    await page.goto('/admin.html#/produtos/prod-1', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#product-form')).toBeVisible();

    await page.evaluate(() => {
      window.localStorage.setItem(
        'botica_draft_product_prod-1',
        JSON.stringify({ timestamp: Date.now() + 10000, productId: 'prod-1', data: { name: 'X' } })
      );
      globalThis.__dispatchAuthEvent('SIGNED_OUT', null);
    });

    await expect(page.locator('#login-view')).toBeVisible();
    const draftAfterDrop = await page.evaluate(() =>
      window.localStorage.getItem('botica_draft_product_prod-1')
    );
    expect(draftAfterDrop).toBeNull();
  });

  test('Inatividade de 29 min exibe aviso com opção de prolongar sessão preservando formulário sujo e 30 min encerra sessão', async ({
    page,
  }) => {
    await page.clock.install();
    await setupPageMocks(page);
    await page.goto('/admin.html#/produtos/prod-1', { waitUntil: 'domcontentloaded' });

    const nameInput = page.locator('#prod-name');
    await expect(nameInput).toBeVisible();
    await nameInput.fill('Fórmula Editada Antes da Inatividade');

    // Avança 29 minutos sem interação -> deve abrir aviso 1 min antes do vencimento
    await page.clock.fastForward(29 * 60 * 1000 + 200);

    const idleModal = page.locator('#idle-warning-modal');
    await expect(idleModal).toBeVisible();
    await expect(page.locator('#idle-modal-message')).toContainText('não salvas');
    const extendBtn = page.locator('#idle-modal-btn-extend');
    await expect(extendBtn).toBeVisible();

    // Prolongar sessão mantém formulário sujo intacto
    await extendBtn.click();
    await expect(idleModal).toBeHidden();
    await expect(page.locator('#dashboard-view')).toBeVisible();
    await expect(nameInput).toHaveValue('Fórmula Editada Antes da Inatividade');

    // Novo ciclo completo de 30 minutos de inatividade sem clicar em prolongar -> logout automático e limpeza do rascunho
    await page.clock.fastForward(29 * 60 * 1000 + 200);
    await expect(idleModal).toBeVisible();
    await page.clock.fastForward(60 * 1000 + 500);

    await expect(page.locator('#login-view')).toBeVisible();
    await expect(page.locator('#login-feedback')).toContainText('inatividade');
    const remainingDrafts = await page.evaluate(() =>
      Object.keys(window.localStorage).filter((k) => k.startsWith('botica_draft_product_'))
    );
    expect(remainingDrafts).toEqual([]);
  });
});
