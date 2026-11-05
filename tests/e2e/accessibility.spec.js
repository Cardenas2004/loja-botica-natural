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

test.describe('Acessibilidade (WCAG 2.1 AA via axe-core)', () => {
  for (const pageDef of PAGES) {
    test(`${pageDef.name} não deve conter violações graves ou críticas de acessibilidade`, async ({ page }) => {
      await setupPageMocks(page);
      await page.goto(pageDef.path);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(600);

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
