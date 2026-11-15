// @ts-check
import { test, expect } from '@playwright/test';
import { setupPageMocks } from './helpers.js';

const PAGES = [
  { path: '/index.html', name: 'Home', isPublic: true },
  { path: '/produtos.html', name: 'Catálogo', isPublic: true },
  { path: '/produto.html?id=prod-1', name: 'Produto', isPublic: true },
  { path: '/privacidade.html', name: 'Privacidade', isPublic: true },
  { path: '/admin.html', name: 'Admin', isPublic: false },
];

test.describe('Segurança & CSP: Zero violações de CSP, zero erros no console e zero SDK pesado na vitrine', () => {
  for (const pageDef of PAGES) {
    test(`${pageDef.name} não deve emitir violações de CSP nem erros não capturados`, async ({ page }) => {
      await setupPageMocks(page);

      const cspViolations = [];
      const consoleErrors = [];
      const requestedScripts = [];

      page.on('request', (req) => {
        if (req.resourceType() === 'script') {
          requestedScripts.push(req.url());
        }
      });

      page.on('console', (msg) => {
        const text = msg.text();
        if (msg.type() === 'error') {
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
      await page.waitForTimeout(400);

      expect(cspViolations, `Violações de CSP em ${pageDef.name}: ${cspViolations.join('; ')}`).toEqual([]);
      expect(consoleErrors, `Erros no console em ${pageDef.name}: ${consoleErrors.join('; ')}`).toEqual([]);

      // MED-04 parte 2: páginas públicas não devem carregar supabase-js nem supabaseClient.js
      if (pageDef.isPublic) {
        const heavyRequests = requestedScripts.filter(
          (u) => u.includes('supabase-js') || u.includes('supabaseClient.js')
        );
        expect(
          heavyRequests,
          `Página pública ${pageDef.name} não deve carregar supabase-js: ${heavyRequests.join(', ')}`
        ).toEqual([]);
      }
    });
  }
});
