// @ts-check
import { test, expect } from '@playwright/test';
import { setupPageMocks } from './helpers.js';

test.describe('Fase 3 — Carrossel Hero Nativo Acessível (16:9 mobile, 16:5 desktop, Ponto de Foco)', () => {
  test('Aplica proporção 16:9 no mobile (< 768px) e 16:5 no desktop (>= 768px) e respeita focus_x / focus_y', async ({
    page,
  }) => {
    await setupPageMocks(page);

    // 1. Mobile 390px -> 16:9
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });

    const carousel = page.locator('#hero-carousel');
    await expect(carousel).toBeVisible();
    await expect(carousel.locator('.promo__slide')).toHaveCount(2);

    const mobileBox = await carousel.boundingBox();
    expect(mobileBox).not.toBeNull();
    if (mobileBox) {
      expect(Math.abs(mobileBox.height - (390 * 9) / 16)).toBeLessThanOrEqual(3);
    }

    // Verifica que o segundo slide (focus_x: 35, focus_y: 65) aplica object-position 35% 65%
    const secondSlideImg = carousel.locator('.promo__slide').nth(1).locator('img.promo__img');
    const objectPosition = await secondSlideImg.evaluate((el) => getComputedStyle(el).objectPosition);
    expect(objectPosition).toBe('35% 65%');

    // Verifica primeiro slide eager + high priority e segundo lazy
    const firstSlideImg = carousel.locator('.promo__slide').nth(0).locator('img.promo__img');
    await expect(firstSlideImg).toHaveAttribute('loading', 'eager');
    await expect(firstSlideImg).toHaveAttribute('fetchpriority', 'high');
    await expect(secondSlideImg).toHaveAttribute('loading', 'lazy');

    // 2. Desktop 1280px -> 16:5
    await page.setViewportSize({ width: 1280, height: 800 });
    const desktopBox = await carousel.boundingBox();
    expect(desktopBox).not.toBeNull();
    if (desktopBox) {
      expect(Math.abs(desktopBox.height - (desktopBox.width * 5) / 16)).toBeLessThanOrEqual(3);
    }
  });

  test('Navega por bullets (<button>), setas prev/next, teclado (ArrowRight/ArrowLeft) com loop e botão de pausa', async ({
    page,
  }) => {
    await setupPageMocks(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });

    const carousel = page.locator('#hero-carousel');
    const bullets = carousel.locator('.promo__bullet');
    await expect(bullets).toHaveCount(2);

    // Estado inicial: slide 0 ativo
    await expect(bullets.nth(0)).toHaveAttribute('aria-current', 'true');
    await expect(bullets.nth(1)).not.toHaveAttribute('aria-current', 'true');

    // Clique no bullet 2
    await bullets.nth(1).click();
    await expect(bullets.nth(1)).toHaveAttribute('aria-current', 'true');
    await expect(carousel).toHaveAttribute('data-active-slide', '1');

    // Clique na seta próximo no último slide faz loop para o primeiro (0)
    const nextBtn = carousel.locator('[data-hero-carousel-next]');
    await expect(nextBtn).toBeVisible();
    await nextBtn.click();
    await expect(carousel).toHaveAttribute('data-active-slide', '0');

    // Clique na seta anterior no primeiro slide faz loop para o último (1)
    const prevBtn = carousel.locator('[data-hero-carousel-prev]');
    await prevBtn.click();
    await expect(carousel).toHaveAttribute('data-active-slide', '1');

    // Navegação por teclado ArrowLeft -> volta para 0; ArrowRight -> avança para 1
    await carousel.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(carousel).toHaveAttribute('data-active-slide', '0');
    await page.keyboard.press('ArrowRight');
    await expect(carousel).toHaveAttribute('data-active-slide', '1');

    // Botão de pausa/retomada (WCAG 2.2.2)
    const pauseBtn = carousel.locator('#hero-carousel-pause');
    await expect(pauseBtn).toBeVisible();
    await expect(pauseBtn).toHaveAttribute('aria-pressed', 'false');
    await pauseBtn.click();
    await expect(pauseBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(pauseBtn).toHaveAttribute('aria-label', 'Retomar banners — rotação automática');
    await pauseBtn.click();
    await expect(pauseBtn).toHaveAttribute('aria-pressed', 'false');
  });

  test('Inicia pausado automaticamente quando prefers-reduced-motion: reduce está ativo', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await setupPageMocks(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });

    const pauseBtn = page.locator('#hero-carousel-pause');
    await expect(pauseBtn).toBeVisible();
    await expect(pauseBtn).toHaveAttribute('aria-pressed', 'true');
  });

  test('Admin (#/banners): remove upload mobile e permite ajustar ponto de foco 16:9 por grade 3x3 e inputs', async ({
    page,
  }) => {
    await setupPageMocks(page);
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.goto('/admin.html#/banners', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#carousel-form')).toBeVisible();

    // Não existe campo de upload de arte mobile
    await expect(page.locator('#slide-mobile-image')).toHaveCount(0);

    // Exibe aviso informativo sobre recorte 16:9
    await expect(page.locator('.banner-guide-box')).toContainText('recortada automaticamente em 16:9');

    // Seleciona um botão da grade 3x3 (ex: Topo Direita -> 85%, 20%)
    const topRightPreset = page.locator('.focus-grid-3x3__btn[data-focus-x="85"][data-focus-y="20"]');
    await topRightPreset.click();
    await expect(page.locator('#slide-focus-x')).toHaveValue('85');
    await expect(page.locator('#slide-focus-y')).toHaveValue('20');
    await expect(topRightPreset).toHaveAttribute('aria-pressed', 'true');
  });
});
