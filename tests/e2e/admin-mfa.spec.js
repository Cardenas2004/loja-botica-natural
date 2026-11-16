// @ts-check
import { test, expect } from '@playwright/test';
import { setupPageMocks } from './helpers.js';

test.describe('Autenticação MFA TOTP no Admin (Fase 2 — Item 5)', () => {
  test('Admin sem TOTP entra normalmente (sem lockout), inscreve TOTP em #/seguranca e respeita CSP', async ({
    page,
  }) => {
    const cspErrors = [];
    page.on('console', (msg) => {
      if (msg.text().toLowerCase().includes('content security policy')) {
        cspErrors.push(msg.text());
      }
    });

    await setupPageMocks(page);
    await page.goto('/admin.html#/seguranca', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#dashboard-view')).toBeVisible();
    await expect(page.locator('#mfa-status-badge')).toContainText('Não Configurado');

    await page.locator('#btn-mfa-enroll-start').click();
    await expect(page.locator('#mfa-enroll-verify-form')).toBeVisible();
    await expect(page.locator('#mfa-enroll-secret')).toHaveText('BOTICA2FAMOCKSECRET1234');

    const qrSrc = await page.locator('#mfa-enroll-qr').getAttribute('src');
    expect(qrSrc).toMatch(/^data:image\/svg\+xml/);

    await page.locator('#mfa-enroll-code').fill('123456');
    await page.locator('#btn-mfa-enroll-confirm').click();

    await expect(page.locator('#mfa-status-badge')).toContainText('TOTP Ativo');
    expect(cspErrors).toEqual([]);
  });

  test('Admin com fator TOTP verificado recebe desafio AAL2 no login antes de entrar no painel', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      globalThis.__bn_fake_initial_logged_out__ = true;
      globalThis.__bn_fake_auth_accounts__ = {
        'admin@boticanatural.com.br': {
          id: 'user-admin-123',
          password: 'SenhaAdminForte!123',
        },
      };
      globalThis.__bn_fake_mfa_aal__ = 'aal1';
      globalThis.__bn_fake_mfa_factors__ = [
        {
          id: 'totp-factor-verified-1',
          friendly_name: 'Celular Principal',
          factor_type: 'totp',
          status: 'verified',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];
      globalThis.__bn_fake_mfa_code__ = '654321';
    });

    await setupPageMocks(page);
    await page.goto('/admin.html', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#login-form')).toBeVisible();
    await page.locator('#email').fill('admin@boticanatural.com.br');
    await page.locator('#password').fill('SenhaAdminForte!123');
    await page.locator('#btn-login').click();

    // Deve exigir o segundo fator AAL2 antes de exibir o dashboard
    await expect(page.locator('#mfa-challenge-form')).toBeVisible();
    await expect(page.locator('#dashboard-view')).toBeHidden();

    // Código TOTP errado permanece bloqueado
    await page.locator('#mfa-code').fill('000000');
    await page.locator('#btn-mfa-verify').click();
    await expect(page.locator('#login-feedback')).toContainText('Código de verificação inválido');
    await expect(page.locator('#dashboard-view')).toBeHidden();

    // Código TOTP correto promove para AAL2 e libera o painel
    await page.locator('#mfa-code').fill('654321');
    await page.locator('#btn-mfa-verify').click();
    await expect(page.locator('#dashboard-view')).toBeVisible();
    await expect(page.locator('#login-view')).toBeHidden();
  });
});
