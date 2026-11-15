// @ts-check
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import { setupPageMocks } from './helpers.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '../..');

const RAW_CONFIG_JS = fs.readFileSync(path.join(ROOT, 'js/config.js'), 'utf8');
const RAW_INDEX_HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const MOCK_CONFIG_JS = RAW_CONFIG_JS
  .replace("ga4MeasurementId: ''", "ga4MeasurementId: 'G-TEST123456'")
  .replace("metaPixelId: ''", "metaPixelId: '123456789012345'");

const MOCK_INDEX_HTML = RAW_INDEX_HTML.replace(
  "script-src 'self';",
  "script-src 'self' https://www.googletagmanager.com https://connect.facebook.net;"
);

/**
 * Configura mocks de Analytics (IDs fictícios + stub de scripts externos) mantendo
 * toda a lógica real de main.js / config.js.
 * @param {import('@playwright/test').Page} page
 */
async function setupMockAnalyticsHarness(page) {
  const analyticsRequests = [];
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

  await page.route(/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/(index\.html)?(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: MOCK_INDEX_HTML,
    });
  });

  await page.route(/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/js\/config\.js(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript; charset=utf-8',
      body: MOCK_CONFIG_JS,
    });
  });

  await page.route(/^https:\/\/(www\.googletagmanager\.com|connect\.facebook\.net)\/.*/, async (route) => {
    analyticsRequests.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript; charset=utf-8',
      body: '// mock analytics script',
    });
  });

  return { analyticsRequests, cspErrors, pageErrors };
}

test.describe('Fase 8 — Analytics Condicionado a Consentimento LGPD (ALTO-05)', () => {
  test('Por padrão (IDs vazios), não carrega scripts externos mesmo após aceitar cookies', async ({
    page,
  }) => {
    const externalRequests = [];
    const cspErrors = [];
    const pageErrors = [];

    await setupPageMocks(page);
    await page.route(/^https:\/\/(www\.googletagmanager\.com|connect\.facebook\.net)\/.*/, async (route) => {
      externalRequests.push(route.request().url());
      await route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
    });

    page.on('console', (msg) => {
      const text = msg.text();
      if (msg.type() === 'error') pageErrors.push(text);
      if (text.toLowerCase().includes('content security policy')) cspErrors.push(text);
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
    await page.locator('[data-cookie-accept]').click();

    const stored = await page.evaluate(() => localStorage.getItem('bn_lgpd_consent'));
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored || '{}').choices).toEqual({
      essential: true,
      analytics: true,
      marketing: true,
    });

    await expect(page.locator('script[data-analytics]')).toHaveCount(0);
    expect(externalRequests).toEqual([]);
    expect(cspErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Com IDs configurados, não carrega nada antes do consentimento ou após recusar', async ({
    page,
  }) => {
    const { analyticsRequests, cspErrors, pageErrors } = await setupMockAnalyticsHarness(page);

    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.cookie')).toBeVisible();

    await expect(page.locator('script[data-analytics]')).toHaveCount(0);
    expect(analyticsRequests).toEqual([]);
    expect(await page.evaluate(() => ({ gtag: typeof window.gtag, fbq: typeof window.fbq }))).toEqual({
      gtag: 'undefined',
      fbq: 'undefined',
    });

    await page.locator('[data-cookie-reject]').click();
    await expect(page.locator('.cookie')).toBeHidden();

    await expect(page.locator('script[data-analytics]')).toHaveCount(0);
    expect(analyticsRequests).toEqual([]);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('script[data-analytics]')).toHaveCount(0);
    expect(analyticsRequests).toEqual([]);
    expect(cspErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Com IDs configurados, consentimento granular carrega apenas GA4 quando apenas Estatísticas é aceito', async ({
    page,
  }) => {
    const { analyticsRequests, cspErrors, pageErrors } = await setupMockAnalyticsHarness(page);

    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
    await page.locator('[data-cookie-manage]').click();
    await expect(page.locator('#cookie-preferences-dialog')).toBeVisible();

    await page.locator('#cookie-pref-analytics').check();
    await page.locator('#cookie-pref-marketing').uncheck();
    await page.locator('[data-cookie-save-prefs]').click();

    await expect(page.locator('script[data-analytics="ga4"]')).toHaveCount(1);
    await expect(page.locator('script[data-analytics="meta-pixel"]')).toHaveCount(0);

    await expect
      .poll(() => analyticsRequests.filter((u) => u.includes('googletagmanager.com')).length)
      .toBe(1);
    expect(analyticsRequests.filter((u) => u.includes('connect.facebook.net'))).toEqual([]);

    const telemetry = await page.evaluate(() => ({
      hasGtag: typeof window.gtag === 'function',
      hasFbq: typeof window.fbq === 'function',
      gaSrc: document.querySelector('script[data-analytics="ga4"]')?.getAttribute('src'),
      dataLayerEntries: Array.from(window.dataLayer || []).map((entry) => Array.from(entry)),
    }));
    expect(telemetry.hasGtag).toBe(true);
    expect(telemetry.hasFbq).toBe(false);
    expect(telemetry.gaSrc).toBe('https://www.googletagmanager.com/gtag/js?id=G-TEST123456');
    expect(
      telemetry.dataLayerEntries.some(
        (args) => args[0] === 'config' && args[1] === 'G-TEST123456'
      )
    ).toBe(true);

    expect(cspErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Com IDs configurados, Aceitar todos carrega GA4 e Meta Pixel uma única vez e persiste no reload', async ({
    page,
  }) => {
    const { analyticsRequests, cspErrors, pageErrors } = await setupMockAnalyticsHarness(page);

    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
    await page.locator('[data-cookie-accept]').click();

    await expect(page.locator('script[data-analytics="ga4"]')).toHaveCount(1);
    await expect(page.locator('script[data-analytics="meta-pixel"]')).toHaveCount(1);

    await expect.poll(() => analyticsRequests.length).toBe(2);

    // Idempotência ao re-disparar evento sem recarregar
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('bn:cookie-consent-updated'));
    });
    await expect(page.locator('script[data-analytics="ga4"]')).toHaveCount(1);
    await expect(page.locator('script[data-analytics="meta-pixel"]')).toHaveCount(1);

    const fbQueue = await page.evaluate(() =>
      Array.from(window.fbq?.queue || []).map((entry) => Array.from(entry))
    );
    expect(fbQueue).toEqual([
      ['init', '123456789012345'],
      ['track', 'PageView'],
    ]);

    // Persistência após recarregar a página
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('script[data-analytics="ga4"]')).toHaveCount(1);
    await expect(page.locator('script[data-analytics="meta-pixel"]')).toHaveCount(1);
    await expect.poll(() => analyticsRequests.length).toBe(4);

    const domViolations = await page.evaluate(() => window.__bnCspViolations || []);
    expect([...cspErrors, ...domViolations]).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
