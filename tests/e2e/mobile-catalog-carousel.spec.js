// @ts-check
import { test, expect } from '@playwright/test';
import { setupPageMocks } from './helpers.js';

test.describe('Mobile Responsiveness — Carrossel, Abas de Categorias e Grid 2B', () => {
  const VIEWPORTS = [
    { name: 'Micro (Galaxy S9+)', width: 320, height: 658 },
    { name: 'iPhone SE', width: 375, height: 667 },
    { name: 'iPhone 13 / 14', width: 390, height: 844 },
    { name: 'Pixel 7 (Android)', width: 412, height: 915 },
    { name: 'iPhone 15 Pro Max', width: 430, height: 932 },
  ];

  for (const vp of VIEWPORTS) {
    test(`[${vp.name}] Carrossel ocupa 100% da largura, sem faixa preta e com bullets discretos`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await setupPageMocks(page);

      await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
      const carousel = page.locator('.promo__carousel');
      await expect(carousel).toBeVisible();

      // Verifica dimensões e proporção 16:9 no mobile (< 768px)
      const box = await carousel.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.width).toBeGreaterThanOrEqual(vp.width - 2);
        // Proporção 16:9: para 320px a altura é ~180px
        const expectedHeight = vp.width * (9 / 16);
        expect(Math.abs(box.height - expectedHeight)).toBeLessThanOrEqual(4);
      }

      // Verifica que a pílula de paginação é compacta (altura <= 24px)
      const pagination = page.locator('.promo__carousel .promo__pagination');
      if (await pagination.isVisible()) {
        const pagBox = await pagination.boundingBox();
        expect(pagBox).not.toBeNull();
        if (pagBox) {
          expect(pagBox.height).toBeLessThanOrEqual(24);
        }
      }

      // Verifica que não há overflow horizontal
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
    });

    test(`[${vp.name}] Abas de categoria em produtos.html não viram círculos e mantêm padding legível`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await setupPageMocks(page);

      await page.goto('/produtos.html', { waitUntil: 'domcontentloaded' });
      const tabs = page.locator('.catalog-tab');
      const count = await tabs.count();
      expect(count).toBeGreaterThan(0);

      for (let i = 0; i < count; i++) {
        const tab = tabs.nth(i);
        const box = await tab.boundingBox();
        expect(box).not.toBeNull();
        if (box) {
          // Altura mínima de acessibilidade de toque
          expect(box.height).toBeGreaterThanOrEqual(40);
          // Largura deve acomodar o texto sem esmagar em círculo (largura > altura * 1.2)
          expect(box.width).toBeGreaterThan(box.height * 1.15);
        }

        // Verifica que o texto não estourou do botão
        const isOverflowing = await tab.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
        expect(isOverflowing).toBe(false);
      }
    });

    test(`[${vp.name}] Grid de produtos exibe 2 colunas lado a lado (>= 340px) com cards alinhados`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await setupPageMocks(page);

      await page.goto('/produtos.html', { waitUntil: 'domcontentloaded' });
      const cards = page.locator('.product-card:not(.product-card--skeleton)');
      const count = await cards.count();
      if (count >= 2) {
        const card0 = await cards.nth(0).boundingBox();
        const card1 = await cards.nth(1).boundingBox();

        if (card0 && card1) {
          // Em todas as larguras mobile-first (>= 320px), os dois primeiros cards ficam lado a lado em 2 colunas
          expect(Math.abs(card0.y - card1.y)).toBeLessThanOrEqual(6);
          expect(card1.x).toBeGreaterThan(card0.x + card0.width - 2);
        }
      }
    });
  }
});
