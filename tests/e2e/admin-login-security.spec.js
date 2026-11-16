// @ts-check
import { test, expect } from '@playwright/test';
import { setupPageMocks } from './helpers.js';

test.describe('Segurança de Autenticação Admin (Fase 2 — Item 3)', () => {
  test('Senha errada e usuário não-admin exibem exatamente a mesma mensagem genérica sem vazar schema', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      globalThis.__bn_fake_initial_logged_out__ = true;
      globalThis.__bn_fake_auth_accounts__ = {
        'comum@boticanatural.com.br': {
          id: 'user-regular-999',
          password: 'SenhaUserComum!123',
        },
        'admin@boticanatural.com.br': {
          id: 'user-admin-123',
          password: 'SenhaAdminForte!123',
        },
      };
    });

    await setupPageMocks(page);
    await page.goto('/admin.html', { waitUntil: 'domcontentloaded' });

    const loginView = page.locator('#login-view');
    const feedback = page.locator('#login-feedback');
    const emailInput = page.locator('#email');
    const passwordInput = page.locator('#password');
    const submitBtn = page.locator('#btn-login');

    await expect(loginView).toBeVisible();
    await expect(emailInput).toHaveAttribute('autocomplete', 'email');
    await expect(passwordInput).toHaveAttribute('autocomplete', 'current-password');

    // 1. Tentativa com senha errada
    await emailInput.fill('admin@boticanatural.com.br');
    await passwordInput.fill('SenhaErrada!000');
    await submitBtn.click();

    await expect(feedback).toBeVisible();
    const wrongPasswordMessage = (await feedback.textContent())?.trim() || '';
    expect(wrongPasswordMessage).toBe('E-mail ou senha inválidos.');

    // 2. Tentativa com credenciais válidas de usuário NÃO administrador
    await page.evaluate(() => {
      globalThis.__log = [];
    });
    await emailInput.fill('comum@boticanatural.com.br');
    await passwordInput.fill('SenhaUserComum!123');
    await submitBtn.click();

    await expect(feedback).toBeVisible();
    const nonAdminMessage = (await feedback.textContent())?.trim() || '';
    expect(nonAdminMessage).toBe(wrongPasswordMessage);
    expect(nonAdminMessage).not.toMatch(/admin_users|is_admin|policy|public\.|SQL|PGRST/i);

    // Confirma que signOut foi executado para o não-admin e o dashboard permanece oculto
    await expect(page.locator('#dashboard-view')).toBeHidden();
    const logs = await page.evaluate(() => globalThis.__log || []);
    expect(logs.some((entry) => entry.operation === 'AUTH_SIGNOUT')).toBe(true);
  });
});
