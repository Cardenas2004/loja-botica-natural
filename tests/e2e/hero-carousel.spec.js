// @ts-check
import { test, expect } from '@playwright/test';
import { setupPageMocks } from './helpers.js';

test.describe('Carrossel Hero Nativo — Enquadramento Automático (Desktop & Mobile) e Controles Limpos', () => {
  test('Mantém proporção panorâmica 16:5 automática no mobile e no desktop sem cortes laterais', async ({
    page,
  }) => {
    await setupPageMocks(page);

    // 1. Mobile 390px -> ajuste automático 16:5 proporcional (sem recorte lateral)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });

    const carousel = page.locator('#hero-carousel');
    await expect(carousel).toBeVisible();
    await expect(carousel.locator('.promo__slide')).toHaveCount(2);

    const mobileBox = await carousel.boundingBox();
    expect(mobileBox).not.toBeNull();
    if (mobileBox) {
      expect(Math.abs(mobileBox.height - (390 * 5) / 16)).toBeLessThanOrEqual(3);
    }

    // Sem botão visível de pausa/play
    await expect(carousel.locator('#hero-carousel-pause')).toHaveCount(0);
    await expect(carousel.locator('.promo__pause')).toHaveCount(0);

    // Enquadramento centralizado limpo e carregamento prioritário no 1º slide
    const secondSlideImg = carousel.locator('.promo__slide').nth(1).locator('img.promo__img');
    const objectPosition = await secondSlideImg.evaluate((el) => getComputedStyle(el).objectPosition);
    expect(objectPosition).toBe('50% 50%');

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

  test('Adapta automaticamente a proporção quando um banner horizontal real tem dimensões diferentes (mobile e desktop)', async ({
    page,
  }) => {
    await setupPageMocks(page);
    await page.route('**/storage/v1/object/public/product-images/**', (route) => {
      const svg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="500" viewBox="0 0 1200 500"><rect width="1200" height="500" fill="#5e3286"/></svg>';
      return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: svg });
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });

    const carousel = page.locator('#hero-carousel');
    await expect(carousel).toBeVisible();
    await expect(carousel).toHaveJSProperty('offsetHeight', Math.round((390 * 500) / 1200));

    await page.setViewportSize({ width: 1280, height: 800 });
    const desktopBox = await carousel.boundingBox();
    expect(desktopBox).not.toBeNull();
    if (desktopBox) {
      expect(Math.abs(desktopBox.height - (desktopBox.width * 500) / 1200)).toBeLessThanOrEqual(3);
    }
  });

  test('Navega por bullets (<button>), setas prev/next e teclado (ArrowRight/ArrowLeft) com loop, sem pausa/play', async ({
    page,
  }) => {
    await setupPageMocks(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });

    const carousel = page.locator('#hero-carousel');
    const bullets = carousel.locator('.promo__bullet');
    await expect(bullets).toHaveCount(2);

    // Não renderiza botão de pausa/retomada
    await expect(carousel.locator('#hero-carousel-pause')).toHaveCount(0);
    await expect(carousel.locator('.promo__pause')).toHaveCount(0);

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
  });

  test('Mobile (touch): permite passar banners manualmente por swipe horizontal/toque e continua rotacionando automaticamente', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
    });
    const page = await context.newPage();
    try {
      await page.clock.install();
      await setupPageMocks(page);
      await page.goto('/index.html', { waitUntil: 'domcontentloaded' });

      const carousel = page.locator('#hero-carousel');
      const track = carousel.locator('.promo__track');
      await expect(carousel).toHaveAttribute('data-active-slide', '0');

      // Confirma que CSS libera rolagem tátil horizontal e vertical (pan-x pan-y)
      const touchAction = await track.evaluate((el) => getComputedStyle(el).touchAction);
      expect(touchAction).toContain('pan-x');
      expect(touchAction).toContain('pan-y');

      // Simula swipe manual com dedo da direita para a esquerda (ou toque no bullet se Touch não disponível)
      const box = await track.boundingBox();
      expect(box).not.toBeNull();
      const canConstructTouch = await page.evaluate(() => {
        try {
          return typeof Touch === 'function' && Boolean(new Touch({ identifier: 0, target: document.body }));
        } catch {
          return false;
        }
      });
      if (box && canConstructTouch) {
        const y = box.y + box.height / 2;
        const startX = box.x + box.width * 0.8;
        const endX = box.x + box.width * 0.2;
        await track.evaluate(
          (el, { sx, ex, py }) => {
            const makeTouch = (clientX, clientY) =>
              new Touch({
                identifier: 1,
                target: el,
                clientX,
                clientY,
                pageX: clientX,
                pageY: py,
              });
            const t1 = makeTouch(sx, py);
            el.dispatchEvent(
              new TouchEvent('touchstart', {
                bubbles: true,
                cancelable: true,
                touches: [t1],
                targetTouches: [t1],
                changedTouches: [t1],
              })
            );
            const t2 = makeTouch((sx + ex) / 2, py);
            el.dispatchEvent(
              new TouchEvent('touchmove', {
                bubbles: true,
                cancelable: true,
                touches: [t2],
                targetTouches: [t2],
                changedTouches: [t2],
              })
            );
            const t3 = makeTouch(ex, py);
            el.dispatchEvent(
              new TouchEvent('touchend', {
                bubbles: true,
                cancelable: true,
                touches: [],
                targetTouches: [],
                changedTouches: [t3],
              })
            );
          },
          { sx: startX, ex: endX, py: y }
        );
      } else {
        // WebKit não permite instanciar new Touch() sinteticamente; valida scroll nativo da faixa tátil
        await track.evaluate((el) => {
          el.scrollTo({ left: el.clientWidth, behavior: 'auto' });
          el.dispatchEvent(new Event('scroll'));
        });
      }

      // Slide mudou manualmente para 1
      await expect(carousel).toHaveAttribute('data-active-slide', '1');

      // Autoplay continua ativo após interação manual em dispositivo touch
      await page.clock.runFor(4600);
      await expect(carousel).toHaveAttribute('data-active-slide', '0');

      // Tocar manualmente em um bullet também não congela o autoplay no mobile
      await carousel.locator('.promo__bullet').nth(1).tap();
      await expect(carousel).toHaveAttribute('data-active-slide', '1');
      await page.clock.runFor(4600);
      await expect(carousel).toHaveAttribute('data-active-slide', '0');
    } finally {
      await context.close();
    }
  });

  test('Respeita prefers-reduced-motion: reduce sem exibir botão de pausa', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await setupPageMocks(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });

    const carousel = page.locator('#hero-carousel');
    await expect(carousel).toHaveAttribute('data-active-slide', '0');
    await expect(carousel.locator('#hero-carousel-pause')).toHaveCount(0);

    // Navegação manual continua imediata via teclado
    await carousel.focus();
    await page.keyboard.press('ArrowRight');
    await expect(carousel).toHaveAttribute('data-active-slide', '1');
  });

  test('Admin (#/banners): mantém upload único limpo, sem moldura de recorte e sem controles de foco manual', async ({
    page,
  }) => {
    await setupPageMocks(page);
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.goto('/admin.html#/banners', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#carousel-form')).toBeVisible();

    // Sem upload mobile separado, sem moldura de recorte e sem painel de foco manual
    await expect(page.locator('#slide-mobile-image')).toHaveCount(0);
    await expect(page.locator('#slide-crop-window')).toHaveCount(0);
    await expect(page.locator('#slide-focus-dot')).toHaveCount(0);
    await expect(page.locator('.focus-controls-panel')).toHaveCount(0);
    await expect(page.locator('.focus-grid-3x3__btn')).toHaveCount(0);
    await expect(page.locator('#slide-focus-x')).toHaveCount(0);
    await expect(page.locator('#slide-focus-y')).toHaveCount(0);

    // Exibe aviso informativo sobre ajuste automático em celular e computador
    await expect(page.locator('.banner-guide-box')).toContainText('Ajuste Automático em Celular e Computador');
  });
});
