// @ts-check
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setupPageMocks } from './helpers.js';

const PAGES = [
  { path: '/index.html', name: 'Home' },
  { path: '/produtos.html', name: 'Catálogo' },
  { path: '/produto.html?id=prod-1', name: 'Produto' },
  { path: '/privacidade.html', name: 'Privacidade' },
  { path: '/admin.html', name: 'Admin' },
];

async function waitForStablePage(page) {
  await page.waitForLoadState('load');
  await page.waitForFunction(() =>
    [...document.querySelectorAll('[aria-busy="true"]')].every((el) => el.getClientRects().length === 0)
  );

  if ((await page.locator('.cookie').count()) > 0) {
    await page.locator('.cookie').waitFor({ state: 'visible' });
  }

  await page.evaluate(async () => {
    const waitFrame = () =>
      new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

    const step = Math.max(Math.floor(window.innerHeight * 0.75), 240);
    for (let y = 0; y <= document.documentElement.scrollHeight; y += step) {
      window.scrollTo({ top: y, behavior: 'instant' });
      await waitFrame();
    }

    for (const el of document.querySelectorAll('.reveal')) {
      if (el.getClientRects().length > 0 && !el.classList.contains('is-visible')) {
        el.scrollIntoView({ behavior: 'instant', block: 'center' });
        await waitFrame();
      }
    }

    window.scrollTo({ top: 0, behavior: 'instant' });
    await waitFrame();

    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
  });

  await page.waitForFunction(() => {
    const isRenderedAndOpaque = (el) => {
      if (el.getClientRects().length === 0) return true;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return true;
      return parseFloat(style.opacity) >= 0.99;
    };

    const cookie = document.querySelector('.cookie');
    if (cookie && !cookie.hasAttribute('hidden') && !isRenderedAndOpaque(cookie)) {
      return false;
    }

    const targets = document.querySelectorAll('.reveal, .product-card--fade-in');
    for (const el of targets) {
      if (!isRenderedAndOpaque(el)) {
        return false;
      }
    }

    if (typeof document.getAnimations === 'function') {
      for (const anim of document.getAnimations()) {
        const iterations = anim.effect?.getComputedTiming?.().iterations;
        if (iterations === Infinity) continue;
        const target = anim.effect && 'target' in anim.effect ? anim.effect.target : null;
        if (target instanceof Element) {
          if (target.getClientRects().length === 0) continue;
          if (target.closest('details:not([open])')) continue;
        }
        if (anim.playState === 'running') {
          return false;
        }
      }
    }

    return true;
  });
}

test.describe('Acessibilidade (WCAG 2.1 AA via axe-core)', () => {
  for (const pageDef of PAGES) {
    test(`${pageDef.name} não deve conter violações graves ou críticas de acessibilidade`, async ({ page }) => {
      await setupPageMocks(page);
      await page.goto(pageDef.path, { waitUntil: 'load' });
      await waitForStablePage(page);

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      const seriousOrCritical = accessibilityScanResults.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical'
      );

      expect(
        seriousOrCritical,
        `Violações graves/críticas de acessibilidade em ${pageDef.name}:\n` +
          JSON.stringify(
            seriousOrCritical.map((v) => ({
              id: v.id,
              impact: v.impact,
              description: v.description,
              nodes: v.nodes.map((n) => n.target),
            })),
            null,
            2
          )
      ).toEqual([]);
    });
  }
});
