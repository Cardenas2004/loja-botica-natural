// @ts-check
import { test, expect } from '@playwright/test';
import { setupPageMocks } from './helpers.js';

test.describe('Fase 6: Concorrência Otimista Atômica, Exclusão Segura e Destaques da Home (MED-01, MED-02, MED-03)', () => {
  test.beforeEach(async ({ page }) => {
    await setupPageMocks(page);
  });

  test('MED-01: Detecta edição concorrente atomicamente no UPDATE sem sobrescrever silenciosamente', async ({
    page,
  }) => {
    await page.goto('/admin.html#/produtos/prod-1');
    await page.waitForSelector('#product-form');

    // Simula outra aba atualizando `updated_at` de prod-1 no banco enquanto o formulário está aberto
    await page.evaluate(() => {
      const raw = window.sessionStorage.getItem('__bn_fake_db__');
      const currentDb = raw ? JSON.parse(raw) : null;
      if (currentDb && Array.isArray(currentDb.products)) {
        const p = currentDb.products.find((item) => item.id === 'prod-1');
        if (p) {
          p.updated_at = new Date(Date.now() + 60000).toISOString();
          p.name = 'Sérum Alterado Por Outra Aba';
        }
        window.sessionStorage.setItem('__bn_fake_db__', JSON.stringify(currentDb));
      }
    });

    // Tenta salvar uma alteração local
    await page.locator('#prod-name').fill('Sérum Editado Localmente');
    await page.locator('.product-sticky-footer button:has-text("Salvar e continuar")').click();

    // Deve exibir o modal de conflito de concorrência sem sobrescrever silenciosamente
    const modal = page.locator('#confirm-modal');
    await expect(modal).toBeVisible();
    await expect(page.locator('#modal-title')).toContainText('Edição concorrente detectada');
  });

  test('MED-02: Alerta quando produto referenciado em banner ou vitrine é excluído e recomenda arquivar', async ({
    page,
  }) => {
    await page.goto('/admin.html#/produtos');
    await page.waitForSelector('#products-tbody');

    // prod-4 ("Alcachofra + Berinjela 60 cápsulas") está referenciado em comp-1 (button_link: produto.html?id=prod-4)
    const deleteBtn = page.locator(
      'button[aria-label="Excluir permanentemente produto Alcachofra + Berinjela 60 cápsulas"]'
    );
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();

    const modal = page.locator('#confirm-modal');
    await expect(modal).toBeVisible();
    await expect(page.locator('#modal-title')).toContainText('Produto referenciado');
    await expect(page.locator('#modal-btn-confirm')).toContainText('Arquivar Produto');

    // Confirma o arquivamento seguro recomendado
    await page.locator('#modal-btn-confirm').click();
    await expect(page.locator('.toast--success')).toBeVisible();
  });

  test('MED-03: Permite configurar home_featured e home_position e reflete a ordenação na Home', async ({
    page,
  }) => {
    await page.goto('/admin.html#/produtos/prod-5');
    await page.waitForSelector('#product-form');

    const homeFeaturedCheckbox = page.locator('#prod-home-featured');
    const homePositionInput = page.locator('#prod-home-position');

    await expect(homeFeaturedCheckbox).toBeVisible();
    await expect(homePositionInput).toBeVisible();

    await homeFeaturedCheckbox.check();
    await homePositionInput.fill('0');

    await page.locator('.product-sticky-footer button:has-text("Salvar e continuar")').click();
    await expect(page.locator('.toast--success')).toBeVisible();

    await page.goto('/index.html');
    const firstBestsellerTitle = page.locator('#bestsellers-grid .product-card__title').first();
    await expect(firstBestsellerTitle).toContainText('Loção Hidratante com Ureia 10%');
  });
});
