// @ts-check
import { test, expect } from '@playwright/test';
import { setupPageMocks } from './helpers.js';

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
});
