// @ts-check
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initialData } from './fixtures/fake-supabase.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '../..');

const FAKE_SUPABASE_CODE = fs.readFileSync(
  path.join(ROOT, 'tests/e2e/fixtures/fake-supabase.js'),
  'utf8'
);

/**
 * Configura o roteamento da página para usar o fake-supabase (no admin) e REST mock (na vitrine),
 * bloqueando requisições externas.
 * @param {import('@playwright/test').Page} page
 */
export async function setupPageMocks(page) {
  // 1. Intercepta requisição do supabase-js (exclusiva do admin.html)
  await page.route(/.*(@supabase\/supabase-js|supabase-js).*/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript; charset=utf-8',
      body: FAKE_SUPABASE_CODE,
    });
  });

  // 2. Intercepta chamadas REST públicas (/rest/v1/...) originadas de js/publicApi.js
  await page.route(/.*\/rest\/v1\/.*/, async (route) => {
    const reqUrl = new URL(route.request().url());
    const table = reqUrl.pathname.replace(/^.*\/rest\/v1\//, '').replace(/\/+$/, '');

    let dbSnapshot = null;
    try {
      const rawStored = await page.evaluate(() => {
        try {
          return window.sessionStorage.getItem('__bn_fake_db__');
        } catch {
          return null;
        }
      });
      if (rawStored) {
        dbSnapshot = JSON.parse(rawStored);
      }
    } catch {
      // fallback para initialData quando a navegação ainda está inicializando
    }

    const db = dbSnapshot || JSON.parse(JSON.stringify(initialData));
    let rows = Array.isArray(db[table]) ? [...db[table]] : [];

    // Aplica filtros PostgREST (eq.<valor>)
    for (const [paramKey, paramVal] of reqUrl.searchParams.entries()) {
      if (paramKey === 'select' || paramKey === 'order' || paramKey === 'limit' || paramKey === 'offset') {
        continue;
      }
      if (paramVal.startsWith('eq.')) {
        const expected = paramVal.slice(3);
        rows = rows.filter((row) => {
          if (expected === 'true') return row[paramKey] === true;
          if (expected === 'false') return row[paramKey] === false;
          return String(row[paramKey] ?? '') === expected;
        });
      }
    }

    // Join relacional categories(id,name,slug) em products
    const selectParam = reqUrl.searchParams.get('select') || '*';
    if (table === 'products' && selectParam.includes('categories')) {
      const catList = Array.isArray(db.categories) ? db.categories : [];
      rows = rows.map((row) => {
        if (row.categories) return row;
        const foundCat = catList.find((c) => String(c.id) === String(row.category_id)) || null;
        return {
          ...row,
          categories: foundCat
            ? { id: foundCat.id, name: foundCat.name, slug: foundCat.slug }
            : null,
        };
      });
    }

    // Ordenação PostgREST (order=col1.asc,col2.desc)
    const orderParam = reqUrl.searchParams.get('order');
    if (orderParam) {
      const clauses = orderParam
        .split(',')
        .map((part) => {
          const [col, dir] = part.trim().split('.');
          return { column: col, ascending: dir !== 'desc' };
        })
        .filter((c) => Boolean(c.column));

      rows.sort((a, b) => {
        for (const { column, ascending } of clauses) {
          const va = a[column];
          const vb = b[column];
          if (va < vb) return ascending ? -1 : 1;
          if (va > vb) return ascending ? 1 : -1;
        }
        return 0;
      });
    }

    // Limite PostgREST
    const limitParam = reqUrl.searchParams.get('limit');
    if (limitParam) {
      const n = Number(limitParam);
      if (Number.isFinite(n) && n >= 0) {
        rows = rows.slice(0, n);
      }
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify(rows),
    });
  });

  // 3. Intercepta requisições de Storage simulado
  await page.route(/.*(fake-storage\.local|product-images).*/, async (route) => {
    const transparentSvg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#E2D9F3"/></svg>';
    await route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: transparentSvg,
    });
  });
}
