// @ts-check
import { test, expect } from '@playwright/test';
import { setupPageMocks } from './helpers.js';
import { initialData } from './fixtures/fake-supabase.js';

test.describe('Segurança de Links e Proteção contra Open Redirect (Fase 2 — Item 1)', () => {
  test('Banner e card de composto com /\\evil.com ou //evil.com NÃO geram href externo; links externos recebem rel="noopener noreferrer"', async ({
    page,
  }) => {
    const customDb = JSON.parse(JSON.stringify(initialData));

    customDb.carousel_slides = [
      {
        id: 'banner-malicioso-1',
        title: 'Banner Teste Backslash',
        image_url:
          'https://njdkuhgoophzjxmmempu.supabase.co/storage/v1/object/public/product-images/carousel/banner1.webp',
        image_path: 'carousel/banner1.webp',
        button_link: '/\\evil.com',
        focus_x: 50,
        focus_y: 50,
        display_order: 1,
        is_active: true,
      },
      {
        id: 'banner-malicioso-2',
        title: 'Banner Teste Protocol Relative',
        image_url:
          'https://njdkuhgoophzjxmmempu.supabase.co/storage/v1/object/public/product-images/carousel/banner2.webp',
        image_path: 'carousel/banner2.webp',
        button_link: '//evil.com',
        focus_x: 50,
        focus_y: 50,
        display_order: 2,
        is_active: true,
      },
    ];

    customDb.compound_showcase_cards = [
      {
        id: 'comp-malicioso',
        title: 'COMPOSTO INOFENSIVO',
        label_subtitle: 'TESTE',
        label_title: 'SEGURO',
        label_badge: '60 CÁPSULAS',
        show_label: true,
        button_text: 'COMPRAR',
        button_link: '/\\evil.com',
        product_id: null,
        open_in_new_tab: false,
        show_button: true,
        card_theme: 'green',
        badge_color: 'green',
        title_align: 'center',
        botanical_theme: 'alcachofra',
        show_capsules: true,
        display_order: 0,
        is_active: true,
      },
      {
        id: 'comp-externo',
        title: 'LINK EXTERNO',
        label_subtitle: 'INFO',
        label_title: 'EXTERNO',
        label_badge: '60 CÁPSULAS',
        show_label: true,
        button_text: 'SAIBA MAIS',
        button_link: 'https://ok.com',
        product_id: null,
        open_in_new_tab: false,
        show_button: true,
        card_theme: 'purple',
        badge_color: 'purple',
        title_align: 'center',
        botanical_theme: 'berries',
        show_capsules: true,
        display_order: 1,
        is_active: true,
      },
    ];

    await page.addInitScript((dbPayload) => {
      window.sessionStorage.setItem('__bn_fake_db__', JSON.stringify(dbPayload));
    }, customDb);

    await setupPageMocks(page);
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });

    const carousel = page.locator('#hero-carousel');
    await expect(carousel.locator('.promo__slide')).toHaveCount(2);

    // Nenhum slide com /\evil.com ou //evil.com deve gerar <a> com href
    await expect(carousel.locator('a[href]')).toHaveCount(0);

    const showcase = page.locator('#compounds-showcase');
    const maliciousCardBtn = showcase.locator('.compound-card').nth(0).locator('.compound-card__btn');
    await expect(maliciousCardBtn).toBeVisible();

    const maliciousHref = await maliciousCardBtn.getAttribute('href');
    expect(maliciousHref).not.toBeNull();
    expect(maliciousHref).not.toContain('evil.com');
    expect(maliciousHref?.startsWith('//')).toBe(false);
    expect(maliciousHref?.startsWith('/\\')).toBe(false);
    expect(maliciousHref).toBe('#produtos');

    // Card externo com open_in_new_tab: false deve receber obrigatoriamente target="_blank" e rel="noopener noreferrer"
    const externalCardBtn = showcase.locator('.compound-card').nth(1).locator('.compound-card__btn');
    await expect(externalCardBtn).toHaveAttribute('href', 'https://ok.com/');
    await expect(externalCardBtn).toHaveAttribute('target', '_blank');
    await expect(externalCardBtn).toHaveAttribute('rel', 'noopener noreferrer');

    // Nenhum <a> na página inteira deve apontar para evil.com
    await expect(page.locator('a[href*="evil.com"]')).toHaveCount(0);
  });
});
