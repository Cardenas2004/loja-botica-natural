// @ts-check
import { test, expect } from '@playwright/test';
import { setupPageMocks } from './helpers.js';

const VIEWPORTS = [
  { width: 320, height: 568, name: '320px' },
  { width: 375, height: 812, name: '375px' },
  { width: 768, height: 1024, name: '768px' },
  { width: 1024, height: 768, name: '1024px' },
  { width: 1440, height: 900, name: '1440px' },
  { width: 1920, height: 1080, name: '1920px' },
  { width: 2560, height: 1440, name: '2560px' },
];

const PAGES = [
  { path: '/index.html', name: 'Home' },
  { path: '/produtos.html', name: 'Catálogo' },
  { path: '/produto.html?id=prod-1', name: 'Produto' },
  { path: '/privacidade.html', name: 'Privacidade' },
  { path: '/admin.html', name: 'Admin' },
];

test.describe('Layout & Responsividade: Ausência de Overflow Horizontal (320px a 1440px)', () => {
  for (const pageDef of PAGES) {
    for (const vp of VIEWPORTS) {
      test(`${pageDef.name} em ${vp.name} (${vp.width}x${vp.height}) não deve ter scroll horizontal`, async ({ page }) => {
        await setupPageMocks(page);
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(pageDef.path);
        await page.waitForLoadState('domcontentloaded');

        const overflow = await page.evaluate(() => {
          const doc = document.documentElement;
          const body = document.body;
          const scrollWidth = Math.max(doc.scrollWidth, body.scrollWidth);
          const clientWidth = doc.clientWidth;
          const hasOverflow = scrollWidth > clientWidth;

          let overflowingElements = [];
          if (hasOverflow) {
            const all = document.querySelectorAll('*');
            for (const el of all) {
              const r = el.getBoundingClientRect();
              if (r.right > clientWidth + 1) {
                const tag = el.tagName.toLowerCase();
                const id = el.id ? `#${el.id}` : '';
                const cls = el.className && typeof el.className === 'string' ? `.${el.className.trim().split(/\s+/)[0]}` : '';
                overflowingElements.push(`${tag}${id}${cls} (right: ${Math.round(r.right)}px > ${clientWidth}px)`);
              }
            }
          }

          return {
            hasOverflow,
            scrollWidth,
            clientWidth,
            overflowingElements: overflowingElements.slice(0, 5),
          };
        });

        expect(
          overflow.hasOverflow,
          `Estouro horizontal detectado em ${pageDef.name} (${vp.name}): scrollWidth=${overflow.scrollWidth} > clientWidth=${overflow.clientWidth}. Elementos: ${overflow.overflowingElements.join(', ')}`
        ).toBe(false);
      });
    }
  }
});
