# Linha de Base da Auditoria — Botica Natural (`2026-11-14`)

Este documento registra o estado exato do repositório antes das correções das Fases 0 a 9 na branch `fix/auditoria-2026-11`.

---

## 1. Execução da Suíte de Testes na Linha de Base

### 1.1 Testes Unitários do Sanitizador (`node scripts/test-richtext.mjs`)
- **Total**: `21/21` testes aprovados (`0` falhas).

### 1.2 Verificação Estática (`npm run verify`)
- **Total**: `60/60` checagens aprovadas (`0` falhas).

### 1.3 Verificação de Produção (`npm run verify:prod`)
- **Total**: `60/66` checagens aprovadas (`6` falhas referentes a placeholders `[PREENCHER: ...]` em `index.html`, `produtos.html`, `produto.html`, `privacidade.html`, `js/config.js` e `js/main.js`).

### 1.4 Suíte E2E Playwright (`npx playwright test`)
- **Total por navegador**: `55` testes (`54` aprovados, `1` falha pré-existente).
- **Falha identificada na linha de base**:
  - `tests/e2e/mobile-catalog-carousel.spec.js:78` (`[Micro (Galaxy S9+)] Grid de produtos exibe 2 colunas lado a lado (>= 340px) com cards alinhados`): em `320px`, o CSS real usava `@media (max-width: 319px)` (2 colunas em `320px`), enquanto a asserção do teste esperava 1 coluna abaixo de `340px`.

---

## 2. Medições de Peso de Assets na Linha de Base (Raw vs. Gzip)

Medição realizada com `node:zlib` (`gzipSync`, nível padrão) sobre os arquivos servidos:

| Arquivo | Tamanho Bruto (Bytes) | Tamanho Gzip (Bytes) | Tamanho Gzip (KB) |
|---|---:|---:|---:|
| `index.html` | 89.191 B | 17.191 B | 16,79 KB |
| `produtos.html` | 30.460 B | 7.286 B | 7,12 KB |
| `produto.html` | 25.402 B | 6.535 B | 6,38 KB |
| `css/style.css` | 116.517 B | 22.289 B | 21,77 KB |
| `css/product.css` | 14.193 B | 3.526 B | 3,44 KB |
| `css/icons.css` | 110.729 B | 16.221 B | 15,84 KB |
| `css/vendor/swiper-11.2.4.bundle.min.css` | 18.469 B | 4.856 B | 4,74 KB |
| `js/main.js` | 24.588 B | 6.649 B | 6,49 KB |
| `js/app.js` | 54.507 B | 12.978 B | 12,67 KB |
| `js/config.js` | 2.152 B | 1.080 B | 1,05 KB |
| `js/whatsapp.js` | 12.559 B | 4.172 B | 4,07 KB |
| `js/supabaseClient.js` | 24.551 B | 7.994 B | 7,81 KB |
| `js/shared/richtext.js` | 26.086 B | 7.484 B | 7,31 KB |
| `js/shared/categoryIcons.js` | 21.849 B | 4.838 B | 4,72 KB |
| `js/shared/compoundShowcaseRenderer.js` | 27.691 B | 6.877 B | 6,72 KB |
| `js/vendor/supabase-js-2.49.1.esm.js` | 104.669 B | 28.435 B | 27,77 KB |
| `js/vendor/swiper-11.2.4.bundle.min.js` | 153.378 B | 42.705 B | 41,70 KB |
| **Total JS Inicial da Home (`index.html`)** | **451.991 B** | **123.212 B** | **120,32 KB** |

---

## 3. Screenshots de Referência Visual (`test-results/baseline/`)

Foram capturadas 30 screenshots em `test-results/baseline/` via `scripts/capture-screenshots.mjs` nas larguras `320, 375, 390, 430, 768, 1024, 1280, 1440, 1920, 2560` px para:
- `index-{width}px.png`
- `produtos-{width}px.png`
- `produto-{width}px.png`
