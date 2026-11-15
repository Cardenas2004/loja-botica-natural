// @ts-check
import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { setupPageMocks } from './helpers.js';
import { initialData } from './fixtures/fake-supabase.js';

/**
 * Registra no BrowserContext um banco simulado contendo um produto e card de vitrine
 * ("Composto Drente") sem diretório estático gerado em `produtos/composto-drente/`.
 * @param {import('@playwright/test').BrowserContext} context
 */
async function setupDynamicDrenteRoutes(context) {
  const customDb = JSON.parse(JSON.stringify(initialData));
  customDb.products.unshift({
    id: 'prod-drente',
    category_id: 'cat-1',
    name: 'Composto Drente',
    slug: 'composto-drente',
    sku_ref: 'BN-DRENTE',
    short_description: 'Composto fitoterápico manipulado para bem-estar diário.',
    description: 'Fórmula personalizada.',
    price: 129.9,
    is_active: true,
    is_best_seller: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    categories: { id: 'cat-1', name: 'Cápsulas & Compostos', slug: 'capsulas-e-compostos' },
  });
  customDb.compound_showcase_cards.unshift({
    id: 'comp-drente',
    title: 'COMPOSTO DRENTE',
    label_subtitle: 'FÓRMULA EXCLUSIVA',
    label_title: 'COMPOSTO DRENTE',
    label_badge: '60 CÁPSULAS',
    show_label: true,
    button_text: 'COMPRAR',
    button_link: 'produtos/composto-drente/',
    product_id: 'prod-drente',
    open_in_new_tab: true,
    show_button: true,
    card_theme: 'green',
    badge_color: 'green',
    title_align: 'center',
    botanical_theme: 'alcachofra',
    show_capsules: true,
    display_order: -1,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  await context.route(/.*\/rest\/v1\/.*/, async (route) => {
    const reqUrl = new URL(route.request().url());
    const table = reqUrl.pathname.replace(/^.*\/rest\/v1\//, '').replace(/\/+$/, '');
    let rows = Array.isArray(customDb[table]) ? [...customDb[table]] : [];
    for (const [k, v] of reqUrl.searchParams.entries()) {
      if (k === 'select' || k === 'order' || k === 'limit' || k === 'offset') continue;
      if (v.startsWith('eq.')) {
        const expected = v.slice(3);
        rows = rows.filter((row) => {
          if (expected === 'true') return row[k] === true;
          if (expected === 'false') return row[k] === false;
          return String(row[k] ?? '') === expected;
        });
      }
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify(rows),
    });
  });
}

test.describe('Fase 7 — SEO Estático por Produto e Slugs Amigáveis (ALTO-09)', () => {
  test('Página estática /produtos/serum-renovador-c/ contém SEO completo sem noindex e hidrata sem erros', async ({
    page,
  }) => {
    const cspErrors = [];
    const pageErrors = [];
    await page.addInitScript(() => {
      window.__bnCspViolations = [];
      document.addEventListener('securitypolicyviolation', (e) => {
        window.__bnCspViolations.push(`${e.violatedDirective}: ${e.blockedURI}`);
      });
    });
    page.on('console', (msg) => {
      const text = msg.text();
      if (msg.type() === 'error') pageErrors.push(text);
      if (text.toLowerCase().includes('content security policy')) cspErrors.push(text);
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));
    await setupPageMocks(page);

    const response = await page.goto('/produtos/serum-renovador-c/', {
      waitUntil: 'domcontentloaded',
    });
    expect(response?.status()).toBe(200);

    await expect(page).toHaveTitle(/Sérum Renovador C \| Botica Natural/);
    await expect(page.locator('h1#pdp-title')).toHaveText('Sérum Renovador C');
    await expect(page.locator('head meta[name="robots"]')).toHaveCount(0);

    const canonical = await page.locator('head link[rel="canonical"]').getAttribute('href');
    expect(canonical).toMatch(/\/produtos\/serum-renovador-c\/$/);

    const jsonLdProduct = await page.locator('#product-jsonld').textContent();
    expect(jsonLdProduct).toBeTruthy();
    const parsedProduct = JSON.parse(jsonLdProduct || '{}');
    expect(parsedProduct['@type']).toBe('Product');
    expect(parsedProduct.name).toBe('Sérum Renovador C');

    const jsonLdBreadcrumb = await page.locator('#product-breadcrumb-jsonld').textContent();
    expect(jsonLdBreadcrumb).toBeTruthy();
    const parsedBreadcrumb = JSON.parse(jsonLdBreadcrumb || '{}');
    expect(parsedBreadcrumb['@type']).toBe('BreadcrumbList');

    const domViolations = await page.evaluate(() => window.__bnCspViolations || []);
    expect([...cspErrors, ...domViolations]).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('produto.html possui noindex, follow e links internos da vitrine apontam para /produtos/<slug>/', async ({
    page,
  }) => {
    await setupPageMocks(page);
    await page.goto('/produto.html?id=prod-1', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('head meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex, follow'
    );
    await expect(page.locator('h1#pdp-title')).toHaveText('Sérum Renovador C');

    await page.goto('/produtos.html', { waitUntil: 'domcontentloaded' });
    const slugLinks = page.locator('a[href="produtos/serum-renovador-c/"]');
    await expect(slugLinks.first()).toBeVisible();
  });

  test('Admin (#/produtos/novo): preenche slug automaticamente a partir do nome e exibe URL amigável na aba SEO', async ({
    page,
  }) => {
    await setupPageMocks(page, { authenticated: true });
    await page.goto('/admin.html#/produtos/novo', { waitUntil: 'domcontentloaded' });

    const nameInput = page.locator('#prod-name');
    await expect(nameInput).toBeVisible();
    await nameInput.fill('Magnésio Dimalato & Quelato');

    await page.locator('[data-tab="seo"]').click();
    const slugInput = page.locator('#prod-slug');
    await expect(slugInput).toHaveValue('magnesio-dimalato-quelato');
    await expect(page.locator('.seo-snippet__url')).toContainText(
      '/produtos/magnesio-dimalato-quelato/'
    );
  });

  test('Produto dinâmico recém-criado sem pasta estática (composto-drente) abre em nova aba e via URL direta sem 404', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    await setupDynamicDrenteRoutes(context);

    const page = await context.newPage();
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });

    // Produto estático já publicado mantém slug limpo; produto dinâmico resolve para rota fallback segura
    await expect(page.locator('a[href="produtos/serum-renovador-c/"]').first()).toBeVisible();
    const drenteShowcaseBtn = page
      .locator('.compound-card__btn')
      .filter({ hasText: 'COMPRAR' })
      .first();
    await expect(drenteShowcaseBtn).toHaveAttribute(
      'href',
      'produto.html?id=prod-drente&slug=composto-drente'
    );
    await expect(drenteShowcaseBtn).toHaveAttribute('target', '_blank');

    // Abre a nova aba sem cair em Cannot GET / 404
    const [newTab] = await Promise.all([
      context.waitForEvent('page'),
      drenteShowcaseBtn.click(),
    ]);
    await newTab.waitForLoadState('domcontentloaded');
    expect(newTab.url()).toContain('/produto.html?id=prod-drente&slug=composto-drente');
    await expect(newTab.locator('h1#pdp-title')).toHaveText('Composto Drente');
    await newTab.close();

    // Acesso direto à URL amigável não construída no servidor de desenvolvimento também resolve sem 404
    const directResponse = await page.goto('/produtos/composto-drente/', {
      waitUntil: 'domcontentloaded',
    });
    expect(directResponse?.status()).toBe(200);
    await expect(page.locator('h1#pdp-title')).toHaveText('Composto Drente');

    // Simula servidor estático sem _redirects (ex.: Vercel/GitHub Pages servindo 404.html)
    const notFoundHtml = fs.readFileSync(path.resolve('404.html'), 'utf8');
    await page.route('**/produtos/composto-drente/', async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'text/html; charset=utf-8',
        body: notFoundHtml,
      });
    });
    await page.goto('/produtos/composto-drente/', { waitUntil: 'load' });
    await expect(page.locator('h1#pdp-title')).toHaveText('Composto Drente');
    expect(page.url()).toContain('/produto.html?slug=composto-drente');

    await context.close();
  });

  test('Fallback defensivo de clique resgata aba nova quando sitemap.xml falha e link aponta para /produtos/<slug>/ inexistente', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    await setupDynamicDrenteRoutes(context);

    await context.route('**/sitemap.xml', (route) => route.fulfill({ status: 404, body: '' }));
    await context.route('**/produtos/composto-drente/', (route) => {
      if (route.request().method() === 'HEAD') {
        return route.fulfill({ status: 404, body: '' });
      }
      return route.fulfill({ status: 404, body: 'Cannot GET /produtos/composto-drente/' });
    });

    const page = await context.newPage();
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });

    const btn = page.locator('.compound-card__btn').filter({ hasText: 'COMPRAR' }).first();
    await expect(btn).toHaveAttribute('href', 'produtos/composto-drente/');

    const [newTab] = await Promise.all([context.waitForEvent('page'), btn.click()]);
    await newTab.waitForLoadState('domcontentloaded');
    await expect(newTab.locator('h1#pdp-title')).toHaveText('Composto Drente');
    expect(newTab.url()).toContain('/produto.html?id=prod-drente&slug=composto-drente');

    await context.close();
  });
});
