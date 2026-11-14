// @ts-check
import { test, expect } from '@playwright/test';
import { setupPageMocks } from './helpers.js';

test.describe('CMS Vitrine de Compostos (#/compostos -> #compounds-showcase)', () => {
  test.beforeEach(async ({ page }) => {
    await setupPageMocks(page);
  });

  test('Permite editar card no painel administrativo com prévia ao vivo e reflete automaticamente na loja pública', async ({
    page,
  }) => {
    await page.goto('/admin.html#/compostos');

    // 1. Verifica que a view carregou os 6 compostos iniciais e a pré-visualização ao vivo
    await expect(page.locator('#compound-form')).toBeVisible();
    await expect(page.locator('#compound-live-preview-stage .compound-card')).toHaveCount(1);
    await expect(page.locator('#compounds-admin-list .compound-list-item')).toHaveCount(6);

    // 2. Clica em "Editar" no primeiro card ("COMPOSTO ALCACHOFRA + BERINJELA")
    const firstItem = page.locator('#compounds-admin-list .compound-list-item').first();
    await firstItem.locator('button:has-text("Editar")').click();

    // 3. Modifica título, rótulo impresso, selo de cápsulas, texto do botão e tema visual
    await page.locator('#compound-title').fill('COMPOSTO ESPECIAL\nCOLESTEROL & FÍGADO');
    await page.locator('#compound-label-subtitle').fill('FÓRMULA AVANÇADA');
    await page.locator('#compound-label-title').fill('COLESTEROL\n& FÍGADO');
    await page.locator('#compound-label-badge').fill('90 CÁPSULAS');
    await page.locator('#compound-button-text').fill('EU QUERO');
    await page.locator('#compound-card-theme').selectOption('purple');

    // 4. Verifica atualização imediata na Pré-visualização em Tempo Real antes de salvar
    const previewCard = page.locator('#compound-live-preview-stage .compound-card');
    await expect(previewCard).toHaveClass(/compound-card--purple/);
    await expect(previewCard.locator('.compound-card__title')).toContainText('COLESTEROL & FÍGADO');
    await expect(previewCard.locator('.compound-card__label-sub')).toHaveText('FÓRMULA AVANÇADA');
    await expect(previewCard.locator('.compound-card__label-dose')).toHaveText('90 CÁPSULAS');
    await expect(previewCard.locator('.compound-card__btn')).toHaveText('EU QUERO');

    // 5. Salva no Supabase e aguarda confirmação visual
    await page.locator('#btn-save-compound').click();
    await expect(page.locator('.toast--success')).toBeVisible();

    // 6. Navega para a loja pública e comprova que a seção #compounds-showcase reflete as alterações
    await page.goto('/index.html');
    const publicFirstCard = page.locator('#compounds-showcase .compound-card').first();
    await expect(publicFirstCard).toBeVisible();
    await expect(publicFirstCard).toHaveClass(/compound-card--purple/);
    await expect(publicFirstCard.locator('.compound-card__title')).toContainText('COLESTEROL & FÍGADO');
    await expect(publicFirstCard.locator('.compound-card__label-sub')).toHaveText('FÓRMULA AVANÇADA');
    await expect(publicFirstCard.locator('.compound-card__label-dose')).toHaveText('90 CÁPSULAS');
    await expect(publicFirstCard.locator('.compound-card__btn')).toHaveText('EU QUERO');
  });

  test('Preserva fallback seguro com os 6 cards oficiais se a tabela retornar vazia', async ({
    page,
  }) => {
    await page.goto('/index.html');
    await page.evaluate(() => {
      window.sessionStorage.setItem(
        '__bn_fake_db__',
        JSON.stringify({
          categories: [],
          products: [],
          carousel_slides: [],
          site_settings: [],
          compound_showcase_cards: [],
          admin_users: ['user-admin-123'],
        })
      );
    });

    await page.reload();
    const cards = page.locator('#compounds-showcase .compound-card');
    await expect(cards).toHaveCount(6);
    await expect(cards.first().locator('.compound-card__title')).toContainText('ALCACHOFRA + BERINJELA');
  });
});
