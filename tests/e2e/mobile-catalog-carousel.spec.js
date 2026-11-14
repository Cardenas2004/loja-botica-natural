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

    test(`[${vp.name}] Em < 1024px exibe apenas #catalog-category-mobile e oculta #catalog-tabs-wrapper`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await setupPageMocks(page);

      await page.goto('/produtos.html', { waitUntil: 'domcontentloaded' });
      const mobileSelector = page.locator('#catalog-category-mobile');
      const desktopTabsWrapper = page.locator('#catalog-tabs-wrapper');

      await expect(mobileSelector).toBeVisible();
      await expect(desktopTabsWrapper).toBeHidden();

      // Rótulo de categoria ativa tem >= 16px
      const labelFontSize = await page
        .locator('#category-mobile-selected-label')
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      expect(labelFontSize).toBeGreaterThanOrEqual(16);
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

  test('Em >= 1024px exibe apenas #catalog-tabs-wrapper sem máscara de opacidade e sincroniza seleção do bottom sheet mobile', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setupPageMocks(page);

    await page.goto('/produtos.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#catalog-category-mobile')).toBeVisible();
    await expect(page.locator('#catalog-tabs-wrapper')).toBeHidden();

    // Abre bottom sheet no mobile e seleciona uma categoria específica
    await page.locator('#btn-open-category-modal').click();
    const sheet = page.locator('#category-bottom-sheet');
    await expect(sheet).toBeVisible();

    const categoryButtons = sheet.locator('.category-sheet__item');
    expect(await categoryButtons.count()).toBeGreaterThan(1);

    const secondCatBtn = categoryButtons.nth(1);
    const selectedCategoryId = await secondCatBtn.getAttribute('data-category');
    await secondCatBtn.click();

    // Verifica que o filtro foi aplicado no mobile
    await expect(page.locator('#category-mobile-selected-label')).not.toHaveText('Todos os Produtos');

    // Redimensiona para desktop (>= 1024px) e verifica que a seleção foi mantida e apenas #catalog-tabs-wrapper está visível
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.locator('#catalog-tabs-wrapper')).toBeVisible();
    await expect(page.locator('#catalog-category-mobile')).toBeHidden();

    const activeDesktopTab = page.locator(
      `#category-filters .catalog-tab[data-category="${selectedCategoryId}"]`
    );
    await expect(activeDesktopTab).toHaveClass(/is-active/);
    await expect(activeDesktopTab).toHaveAttribute('aria-pressed', 'true');

    // Verifica que nenhuma aba ou nav tem mask-image ou opacidade reduzida
    const navStyles = await page.locator('#category-filters').evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        maskImage: cs.maskImage || cs.webkitMaskImage || 'none',
        opacity: parseFloat(cs.opacity),
      };
    });
    expect(navStyles.maskImage).toBe('none');
    expect(navStyles.opacity).toBe(1);

    const tabs = page.locator('.catalog-tab');
    const tabCount = await tabs.count();
    for (let i = 0; i < tabCount; i++) {
      const tab = tabs.nth(i);
      const box = await tab.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(40);
        expect(box.width).toBeGreaterThan(box.height * 1.15);
      }
      const opacity = await tab.evaluate((el) => parseFloat(getComputedStyle(el).opacity));
      expect(opacity).toBe(1);
    }
  });

  test('Todos os <input>, <select> e <textarea> em index.html, produtos.html e admin.html possuem font-size >= 16px (ALTO-04)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await setupPageMocks(page);

    for (const url of ['/index.html', '/produtos.html', '/admin.html']) {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      const badInputs = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('input, select, textarea'));
        return elements
          .map((el) => ({
            tag: el.tagName.toLowerCase(),
            id: el.id || '',
            className: el.className || '',
            fontSize: parseFloat(getComputedStyle(el).fontSize),
          }))
          .filter((item) => item.fontSize < 16);
      });
      expect(badInputs, `Inputs com font-size < 16px em ${url}`).toEqual([]);
    }
  });
});
