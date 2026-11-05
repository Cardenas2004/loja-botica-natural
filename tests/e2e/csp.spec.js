// @ts-check
import { test, expect } from '@playwright/test';
import { setupPageMocks } from './helpers.js';

const PAGES = [
  { path: '/index.html', name: 'Home' },
  { path: '/produtos.html', name: 'Catálogo' },
  { path: '/produto.html?id=prod-1', name: 'Produto' },
  { path: '/privacidade.html', name: 'Privacidade' },
  { path: '/admin.html', name: 'Admin' },
];

test.describe('Segurança & CSP: Zero violações de CSP e zero erros no console', () => {
  for (const pageDef of PAGES) {
    test(`${pageDef.name} não deve emitir violações de CSP nem erros não capturados`, async ({ page }) => {
      await setupPageMocks(page);

      const cspViolations = [];
      const consoleErrors = [];

      page.on('console', (msg) => {
        const text = msg.text();
        if (msg.type() === 'error') {
          // Ignora erros de rede propositalmente simulados/bloqueados
          if (!text.includes('Failed to load resource') && !text.includes('net::ERR_')) {
            consoleErrors.push(text);
          }
        }
        if (text.toLowerCase().includes('content security policy') || text.toLowerCase().includes('violates')) {
          cspViolations.push(text);
        }
      });

      page.on('pageerror', (err) => {
        consoleErrors.push(err.message);
      });

      await page.goto(pageDef.path);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(500);

      expect(cspViolations, `Violações de CSP em ${pageDef.name}: ${cspViolations.join('; ')}`).toEqual([]);
      expect(consoleErrors, `Erros no console em ${pageDef.name}: ${consoleErrors.join('; ')}`).toEqual([]);
    });
  }
});
