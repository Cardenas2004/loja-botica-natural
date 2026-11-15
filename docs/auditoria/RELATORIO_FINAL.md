# Relatório Final de Auditoria Técnica e Remediação — Botica Natural

**Branch:** `fix/auditoria-2026-11`  
**Data de fechamento:** 2026-11-15  
**Escopo:** Remediação completa de arquitetura estática (HTML5 / CSS3 / ES Modules + Supabase), segurança OWASP, conformidade regulatória ANVISA/LGPD, SEO técnico, acessibilidade WCAG 2.1 AA, performance e ajustes de UX solicitados pelo proprietário.

---

## 1. Resumo Executivo

Todas as fases técnicas da auditoria foram implementadas na branch `fix/auditoria-2026-11` em commits atômicos e revisáveis, mantendo zero dependências de runtime adicionais e zero etapa de build obrigatória para servir o site estático (exceto o gerador opcional `npm run build:products` para pré-renderização SEO de páginas individuais de produto por slug).

| Métrica / Suíte | Linha de Base (`5dbeeec`) | Estado Final (`fix/auditoria-2026-11`) | Observação |
|---|---:|---:|---|
| Testes Unitários (`npm run test` / `test-richtext.mjs`) | `21/21` (`0` falhas) | **`21/21` (`0` falhas)** | Sanitizador HTML idempotente e à prova de XSS |
| Verificação Estática (`npm run verify`) | `60/60` | **`111/111` (`0` falhas)** | CSP, breakpoints, imports, SEO, JSON-LD, zero `innerHTML`, orçamento de ícones |
| Prontidão de Produção (`npm run verify:prod`) | `60/66` (`6` `[PREENCHER]`) | **`111/134`** (`23` `[PREENCHER]`) | Bloqueia apenas os marcadores `[PREENCHER]` que dependem do proprietário |
| Suíte E2E (`npx playwright test`) | `55` por navegador (`54` pass, `1` falha) | **`249/249` aprovados** | **83 testes × 3 motores** (Chromium, Firefox, WebKit), `0` falhas |
| JS da Home (`index.html`, soma raw / gzip) | `451.991 B` / `123.212 B` (`120,32 KB`) | **`198.527 B` / `53.430 B` (`52,18 KB`)** | Redução de `-56,1%` raw e `-56,6%` gzip (sem `swiper` e sem `@supabase/supabase-js` no público) |
| Ícones CSS (`css/icons.css`, raw / gzip) | `110.729 B` / `16.221 B` (`15,84 KB`) | **`17.824 B` / `5.450 B` (`5,32 KB`)** | Redução de `-66,4%` gzip; abaixo do teto de `6 KB` gzip |
| Capturas Visuais (`test-results/after/`) | `30` PNGs em `baseline/` | **`30` PNGs em `after/`** | `10` larguras × `3` páginas (`baseline/` foi limpa pelo executor do Playwright durante execuções E2E; métricas preservadas em `baseline.md`) |

---

## 2. Mapa de Fases, Commits e Entregas

| Fase | Commit | Arquivos Principais | Resultado |
|---|---|---|---|
| **Linha de Base + CMS Compostos** | `5dbeeec` | `docs/auditoria/baseline.md`, `js/admin/views/compounds.js`, `js/shared/compoundShowcaseRenderer.js`, `supabase/migrations/20261113230000_compound_showcase_cards.sql` | Registro da linha de base e edição administrativa completa da vitrine `#compounds-showcase`. |
| **Fase 0 — Higiene Inicial e Domínio** | `f8568fe` | `scripts/set-domain.mjs`, `scripts/verify.mjs`, `js/config.js`, `README.md`, `RELATORIO.md`, HTMLs públicos | Script de troca em massa do domínio (`CRIT-03`), padronização da marca `"Botica Natural"`, horário e endereço confirmados. |
| **Fase 1 — Conformidade Regulatória ANVISA** | `e2d4fea` | `docs/auditoria/revisao-rt.md`, `index.html`, `produtos.html`, `privacidade.html`, `js/admin/views/productForm.js`, `js/shared/productRenderer.js` | Neutralização de textos absolutos, remoção preventiva de menção aos Correios, marcações `<!-- REVISAR COM RT -->` e checagem automatizada por fronteira de palavra em `verify.mjs`. |
| **Fase 2 — Padronização de Breakpoints CSS** | `dfb51d4` | `css/style.css`, `css/product.css`, `css/admin.css`, `scripts/verify.mjs`, `docs/decisoes.md` | Sistema mobile-first restrito a `min-width` em `{480px, 768px, 1024px, 1280px}` validado automaticamente. |
| **Fase 3 — Carrossel Hero Nativo** | `4988e3f` + ajuste em `a726487` | `index.html`, `css/style.css`, `css/admin.css`, `js/app.js`, `js/admin/views/banners.js`, `tests/e2e/hero-carousel.spec.js`, `tests/e2e/mobile-catalog-carousel.spec.js` | Remoção do Swiper (`41,7 KB` gzip) em favor de carrossel nativo em Scroll Snap, sem botão sobreposto de pausa/play (`#hero-carousel-pause` removido), sem moldura/controles manuais X/Y no Admin, proporção `16:5` com ajuste automático desktop/mobile (`--promo-aspect`) e swipe tátil livre (`touch-action: pan-x pan-y`) com loop e reinício do autoplay após toque. |
| **Fase 4 — Exclusividade do Catálogo e Inputs >= 16px** | `3219435` | `css/style.css`, `css/admin.css`, `js/app.js`, `tests/e2e/mobile-catalog-carousel.spec.js` | Separação estrita em `1024px` entre `#catalog-category-mobile` (`< 1024px`) e `.catalog-tabs-wrapper` (`>= 1024px`) e garantia de `font-size >= 16px` em controles de formulário (`ALTO-04`). |
| **Fase 5 — Core Performance, Fontes Locais e CSP Estrita** | `ccbb197` | `js/publicApi.js`, `css/fonts.css`, `fonts/*.woff2`, `css/icons.css`, `_headers`, `vercel.json`, `scripts/verify.mjs` | Vitrine desacoplada de `@supabase/supabase-js` usando cliente REST leve (`fetch`), fontes WOFF2 auto-hospedadas, CSS de ícones reduzido para `5,32 KB` gzip, e CSP sem `'unsafe-inline'` em `script-src`/`style-src` com paridade 100% entre `_headers` e `vercel.json`. |
| **Fase 6 — Concorrência Otimista, Arquivamento e Destaques** | `5d4234b` | `js/admin/api.js`, `js/admin/views/*`, `js/app.js`, `supabase/migrations/20261114110000_products_home_featured.sql`, `tests/e2e/admin-data-integrity.spec.js` | Update atômico condicionado a `updated_at` (`CONCURRENT_MODIFICATION`), alerta recomendando arquivar produto referenciado em banners/vitrine, e controle de `home_featured`/`home_position` pelo Admin. |
| **Fase 7 — SEO Estático por Produto e Slugs (`ALTO-09`)** | `d58a7cb` | `scripts/build-products.mjs`, `produtos/<slug>/index.html`, `sitemap.xml`, `produto.html`, `supabase/migrations/20261114120000_products_slug.sql`, `tests/e2e/product-seo.spec.js` | Páginas estáticas por slug com JSON-LD (`Product` + `BreadcrumbList`), `noindex, follow` em `produto.html`, campo `#prod-slug` no Admin e atualização do `sitemap.xml`. |
| **Fase 8 — Infraestrutura de Analytics LGPD (`ALTO-05`)** | `086e25f` | `js/config.js`, `js/main.js`, `tests/e2e/analytics-consent.spec.js` | Infraestrutura pronta para GA4 e Meta Pixel condicionada ao consentimento granular (`analytics` / `marketing`) e desligada por padrão (`''`). |

---

## 3. Detalhamento da Remediação Final do Carrossel (`a726487`)

Por solicitação direta do proprietário após análise visual em tela real:
1. **Remoção do recorte `16:9` mobile e dos controles de ponto de foco no Admin (`#/banners`):**
   - Removida a sobreposição `"Área visível Mobile 16:9"` e o painel `"Ponto de Foco do Recorte Mobile (16:9)"` (grade 3×3 e sliders/inputs X/Y) de `js/admin/views/banners.js` e `css/admin.css`.
   - Mantido upload único panorâmico com prévia limpa proporcional (`object-fit: contain`) e compatibilidade preservada com as colunas `focus_x`/`focus_y` (`50/50`) no banco.
2. **Enquadramento automático em celular e computador:**
   - `.promo__carousel` e `.promo__slide` usam `aspect-ratio: var(--promo-aspect, 16 / 5)` uniformemente em mobile e desktop (`object-position: center center`), mantendo banners panorâmicos íntegros de ponta a ponta sem cortar textos ou logotipos laterais. Ao carregar o primeiro slide real, `js/app.js` lê `naturalWidth` e `naturalHeight` e ajusta `--promo-aspect` automaticamente para qualquer banner horizontal válido.
3. **Remoção do botão visível de pausa/play:**
   - Botão `#hero-carousel-pause` (`.promo__pause`) removido de `index.html`, `css/style.css` e `js/app.js`, preservando pausa automática em `hover` de mouse, foco de teclado, aba oculta (`visibilitychange`) e supressão de autoplay sob `prefers-reduced-motion: reduce`.
4. **Habilitação completa do swipe manual no telefone + retomada automática:**
   - Corrigida a propriedade CSS `touch-action: pan-y` para `touch-action: pan-x pan-y` com `overscroll-behavior-x: contain` na faixa do carrossel, liberando arraste horizontal com o dedo no celular sem bloquear a rolagem vertical da página.
   - Implementados gestos táteis em `js/app.js` com loop contínuo nas extremidades (`0 ↔ último slide`), proteção contra clique acidental em links ao arrastar, alinhamento em `resize` e isolamento de eventos touch nos bullets (`pointerType === 'mouse'` / `:focus-visible`) para impedir congelamento de hover/foco e garantir que o autoplay de `4,5 s` continue rodando normalmente após o usuário passar os banners manualmente.

---

## 4. Pendências Externas (Não Alterar sem Confirmação)

Os itens abaixo foram preservados integralmente por dependerem de decisão comercial do proprietário, validação formal da Farmacêutica Responsável Técnico ou execução autenticada no painel do Supabase (detalhes em [`PENDENCIAS.md`](../../PENDENCIAS.md), [`docs/auditoria/bloqueios.md`](bloqueios.md) e [`docs/auditoria/revisao-rt.md`](revisao-rt.md)):

1. **Domínio oficial de produção (`CRIT-03`)**: substituir `https://www.boticanatural.com.br` executando `node scripts/set-domain.mjs https://<seu-dominio>` seguido de `npm run build:products`.
2. **Nome do Encarregado de Dados — DPO (`privacidade.html`)**: preencher `[PREENCHER: Nome do Encarregado / Responsável LGPD]`.
3. **GA4 e Meta Pixel (`ALTO-05`)**: definir se serão utilizados e preencher IDs em `ANALYTICS` (`js/config.js`) + diretivas CSP documentadas em `PENDENCIAS.md`.
4. **Indicadores da Seção `#sobre` (`index.html`)**: confirmar `26 anos`, `129.644` clientes e `245.735` fórmulas antes da publicação.
5. **Depoimentos reais (`#depoimentos`) e Revisão do RT (ANVISA / MAPA)**: validar textos do FAQ (`<!-- REVISAR COM RT -->`), política de despacho via Correios e licenciamento da linha veterinária.
6. **Banco Supabase Remoto**: executar no **SQL Editor** do Supabase as migrações em `supabase/migrations/` na ordem documentada em `PENDENCIAS.md`, rodar o `INSERT` em `public.admin_users` para o e-mail do proprietário e verificar com `supabase/tests/rls_checks.sql`.
