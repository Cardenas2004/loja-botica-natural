// @ts-check
import { test, expect } from '@playwright/test';
import { setupPageMocks } from './helpers.js';

test.describe('Mobile Responsiveness — Carrossel, Seletor de Categorias e Grid 2B', () => {
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

      // Verifica dimensões e proporção panorâmica automática 16:5 no mobile
      const box = await carousel.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.width).toBeGreaterThanOrEqual(vp.width - 2);
        // Proporção 16:5: para 320px a altura é ~100px (mantendo laterais visíveis)
        const expectedHeight = vp.width * (5 / 16);
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

    test(`[${vp.name}] Seletor único de categorias visível, legível e sem cortar o nome selecionado`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await setupPageMocks(page);

      await page.goto('/produtos.html', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#catalog-grid')).toHaveAttribute('aria-busy', 'false');
      await expect(page.locator('#catalog-category-picker')).toBeVisible();
      // A antiga fileira de abas de categoria não existe mais
      await expect(page.locator('#catalog-tabs-wrapper, .catalog-tab')).toHaveCount(0);

      // Rótulo de categoria ativa tem >= 16px e cabe inteiro ("Todos os Produtos")
      const label = page.locator('#category-picker-label');
      await expect(label).toHaveText('Todos os Produtos');
      const { fontSize, isTruncated } = await label.evaluate((el) => ({
        fontSize: parseFloat(getComputedStyle(el).fontSize),
        isTruncated: el.scrollWidth > el.clientWidth + 1,
      }));
      expect(fontSize).toBeGreaterThanOrEqual(16);
      if (vp.width >= 360) {
        expect(isTruncated).toBe(false);
      }
    });

    test(`[${vp.name}] Grid de produtos exibe 1 coluna (< 340px) ou 2 colunas lado a lado (>= 340px) sem overflow`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await setupPageMocks(page);

      await page.goto('/produtos.html', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#catalog-grid')).toHaveAttribute('aria-busy', 'false');
      const cards = page.locator('.product-card:not(.product-card--skeleton)');
      await expect(cards.nth(1)).toBeVisible();

      const card0 = await cards.nth(0).boundingBox();
      const card1 = await cards.nth(1).boundingBox();
      expect(card0).not.toBeNull();
      expect(card1).not.toBeNull();

      if (card0 && card1) {
        if (vp.width >= 340) {
          // Em telas >= 340px, os dois primeiros cards devem ficar na mesma linha (2 colunas lado a lado)
          expect(Math.abs(card0.y - card1.y)).toBeLessThanOrEqual(6);
          expect(card1.x).toBeGreaterThan(card0.x + card0.width - 2);
        } else {
          // Em telas < 340px (ex: 320px), os cards empilham em 1 coluna
          expect(card1.y).toBeGreaterThan(card0.y + card0.height - 2);
        }
      }

      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
    });
  }

  test('Fronteira responsiva do grid em 339px (1 coluna) vs 340px (2 colunas) sem overflow horizontal', async ({
    page,
  }) => {
    await setupPageMocks(page);

    for (const target of [
      { url: '/produtos.html', gridSelector: '#catalog-grid' },
      { url: '/index.html', gridSelector: '#bestsellers-grid' },
    ]) {
      for (const width of [339, 340]) {
        await page.setViewportSize({ width, height: 658 });
        await page.goto(target.url, { waitUntil: 'domcontentloaded' });
        await expect(page.locator(target.gridSelector)).toHaveAttribute('aria-busy', 'false');

        const cards = page.locator(`${target.gridSelector} .product-card:not(.product-card--skeleton)`);
        await expect(cards.nth(1)).toBeVisible();

        const card0 = await cards.nth(0).boundingBox();
        const card1 = await cards.nth(1).boundingBox();
        expect(card0).not.toBeNull();
        expect(card1).not.toBeNull();

        if (card0 && card1) {
          if (width < 340) {
            expect(card1.y).toBeGreaterThan(card0.y + card0.height - 2);
          } else {
            expect(Math.abs(card0.y - card1.y)).toBeLessThanOrEqual(6);
            expect(card1.x).toBeGreaterThan(card0.x + card0.width - 2);
          }
        }

        const { scrollWidth, clientWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        expect(scrollWidth, `Overflow horizontal em ${target.url} a ${width}px`).toBeLessThanOrEqual(
          clientWidth + 1
        );
      }
    }
  });

  test('Seleção feita no celular (390px) se mantém no seletor único ao passar para o desktop (>= 1024px)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setupPageMocks(page);

    await page.goto('/produtos.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#catalog-grid')).toHaveAttribute('aria-busy', 'false');
    await expect(page.locator('#catalog-category-picker')).toBeVisible();

    // Abre o painel inferior no celular e seleciona uma categoria específica
    await page.locator('#btn-open-category-modal').click();
    const sheet = page.locator('#category-bottom-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet).toHaveClass(/is-open/);
    await expect(page.locator('body')).toHaveClass(/category-sheet-lock/);

    const categoryButtons = sheet.locator('.category-sheet__item');
    await expect(categoryButtons.nth(1)).toBeVisible();
    expect(await categoryButtons.count()).toBeGreaterThan(1);

    const secondCatBtn = categoryButtons.nth(1);
    const selectedCategoryId = await secondCatBtn.getAttribute('data-category');
    await secondCatBtn.click();

    // Filtro aplicado, painel fechado e foco devolvido ao seletor
    await expect(sheet).not.toHaveClass(/is-open/);
    await expect(page.locator('#category-picker-label')).not.toHaveText('Todos os Produtos');
    await expect(page.locator('#btn-open-category-modal')).toBeFocused();
    const selectedLabel = await page.locator('#category-picker-label').textContent();

    // No desktop, o mesmo seletor continua visível com a mesma seleção
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.locator('#catalog-category-picker')).toBeVisible();
    await expect(page.locator('#category-picker-label')).toHaveText(selectedLabel || '');

    // Ao abrir no desktop, a lista fica ancorada logo abaixo do seletor, com a categoria marcada
    await page.locator('#btn-open-category-modal').click();
    await expect(sheet).toHaveClass(/is-open/);
    await expect(page.locator('#btn-open-category-modal')).toHaveAttribute('aria-expanded', 'true');
    const triggerBox = await page.locator('#btn-open-category-modal').boundingBox();
    const sheetBox = await sheet.boundingBox();
    expect(triggerBox).not.toBeNull();
    expect(sheetBox).not.toBeNull();
    if (triggerBox && sheetBox) {
      expect(sheetBox.y).toBeGreaterThanOrEqual(triggerBox.y + triggerBox.height - 1);
      expect(sheetBox.y - (triggerBox.y + triggerBox.height)).toBeLessThanOrEqual(24);
    }
    await expect(
      sheet.locator(`.category-sheet__item[data-category="${selectedCategoryId}"]`)
    ).toHaveAttribute('aria-selected', 'true');
    // No desktop a página não fica travada
    await expect(page.locator('body')).not.toHaveClass(/category-sheet-lock/);

    // Esc fecha e devolve o foco ao seletor
    await page.keyboard.press('Escape');
    await expect(sheet).not.toHaveClass(/is-open/);
    await expect(page.locator('#btn-open-category-modal')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#btn-open-category-modal')).toBeFocused();
  });

  test('Lista de categorias funciona só pelo teclado (busca, setas e Enter)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await setupPageMocks(page);

    await page.goto('/produtos.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#catalog-grid')).toHaveAttribute('aria-busy', 'false');

    await page.locator('#btn-open-category-modal').focus();
    await page.keyboard.press('Enter');
    const sheet = page.locator('#category-bottom-sheet');
    await expect(sheet).toHaveClass(/is-open/);
    await expect(page.locator('#category-sheet-search')).toBeFocused();

    // Seta para baixo entra na lista; a primeira opção é "Todos os Produtos"
    await page.keyboard.press('ArrowDown');
    const items = sheet.locator('.category-sheet__item');
    await expect(items.first()).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(items.nth(1)).toBeFocused();
    const targetId = await items.nth(1).getAttribute('data-category');

    await page.keyboard.press('Enter');
    await expect(sheet).not.toHaveClass(/is-open/);
    await expect(page.locator('#category-picker-label')).not.toHaveText('Todos os Produtos');

    // Reabre: a opção escolhida está marcada e é a única parada de Tab dentro da lista
    await page.locator('#btn-open-category-modal').click();
    await expect(
      sheet.locator(`.category-sheet__item[data-category="${targetId}"]`)
    ).toHaveAttribute('tabindex', '0');
    expect(await sheet.locator('.category-sheet__item[tabindex="0"]').count()).toBe(1);
  });

  test('Bottom sheet de categorias permanece acima do banner de cookies e clicável no mobile', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setupPageMocks(page);

    await page.goto('/produtos.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#catalog-grid')).toHaveAttribute('aria-busy', 'false');

    // Aguarda condição observável real: banner LGPD visível sobre a parte inferior da tela
    await expect(page.locator('.cookie')).toBeVisible({ timeout: 3000 });

    await page.locator('#btn-open-category-modal').click();
    const sheet = page.locator('#category-bottom-sheet');
    await expect(sheet).toHaveClass(/is-open/);

    const secondCatBtn = sheet.locator('.category-sheet__item').nth(1);
    await expect(secondCatBtn).toBeVisible();
    await secondCatBtn.click();

    await expect(page.locator('#category-picker-label')).not.toHaveText('Todos os Produtos');
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
