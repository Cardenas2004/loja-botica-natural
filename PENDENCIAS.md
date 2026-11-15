# Pendências Operacionais, Dados do Negócio e Validações Regulatórias — Botica Natural

Este documento lista **todas as ações manuais**, **dados reais do negócio** (`[PREENCHER: ...]`) e **validações regulatórias com o Farmacêutico Responsável Técnico (RT)** que não podem ser inventados ou automatizados via código.

---

## 1. Ações Críticas no Painel do Supabase

### 1.1 Executar Migração de Segurança e Bootstrap do Admin (ORDEM OBRIGATÓRIA)
> **ATENÇÃO À ORDEM:** A migração `supabase/migrations/20261104200000_security_hardening.sql` remove o e-mail hardcoded e a leitura insegura de `user_metadata.role` da função `public.is_admin()`, passando a validar exclusivamente a tabela `public.admin_users`. **Execute o INSERT do administrador imediatamente após rodar a migração** para não ficar sem acesso de escrita no `admin.html`.

1. Abra o painel do Supabase → **SQL Editor**.
2. Cole e execute as migrações pendentes na ordem cronológica listada na **Seção 5**.
3. **Imediatamente após a migração `20261104200000_security_hardening.sql`**, substitua o placeholder pelo e-mail real da conta administrativa e execute:
   ```sql
   INSERT INTO public.admin_users (user_id)
   SELECT id
     FROM auth.users
    WHERE lower(email) = lower('[PREENCHER: email do dono]')
   ON CONFLICT (user_id) DO NOTHING;
   ```
4. Verifique se o cadastro funcionou executando:
   ```sql
   SELECT a.user_id, u.email, a.created_at
     FROM public.admin_users a
     JOIN auth.users u ON u.id = a.user_id;
   ```

### 1.2 Configurações de Autenticação (Supabase Dashboard → Authentication)
Como o site não possui área de cliente final (apenas o painel administrativo), ajuste no painel do Supabase:
- [ ] **Desativar novos cadastros públicos**: em *Authentication → Providers → Email* (ou *User Signups*), **desmarque** `"Allow new users to sign up"`. Isso impede que terceiros criem contas autenticadas na instância do projeto.
- [ ] **Proteção contra senhas vazadas e força de senha**: em *Authentication → Policies / Password Security*, ative **"Prevent use of leaked passwords (HaveIBeenPwned)"** e exija senha forte (mínimo de 12 caracteres com letras, números e símbolos).
- [ ] **Autenticação em Dois Fatores (MFA)**: em *Authentication → Multi-Factor Authentication*, habilite TOTP (App Autenticador) para a conta do administrador.
- [ ] **Rate Limits e Política de E-mails**: em *Authentication → Rate Limits*, revise os limites de tentativas de login e recuperação de senha; configure SMTP customizado do domínio próprio se desejar envio transacional em produção.
- [ ] **Rotação opcional da `anon key`**: a `anon key` é pública por design e a segurança real reside nas policies de RLS endurecidas. Caso deseje rotacionar as chaves por higiene após os ajustes de RLS, gere novas chaves no painel e atualize `js/supabaseClient.js` e `js/publicApi.js`.

---

## 2. Itens Dependentes do Proprietário (`[PREENCHER: ...]`)

Substitua os placeholders abaixo após decisão/confirmação final antes de rodar `npm run verify:prod`:

| Item / Dado | Estado / Placeholder Atual | Onde aparece / Como atualizar |
|---|---|---|
| **Domínio Oficial de Produção (`CRIT-03`)** | Provisório `https://www.boticanatural.com.br` com `[PREENCHER: confirmar domínio oficial]` | Rodar `node scripts/set-domain.mjs https://<seu-dominio-oficial>` e depois `npm run build:products` (`index.html`, `produtos.html`, `produto.html`, `privacidade.html`, `produtos/*/index.html`, `js/config.js`, `robots.txt`, `sitemap.xml`) |
| **Encarregado de Dados — DPO (LGPD)** | `[PREENCHER: Nome do Encarregado / Responsável LGPD]` (e-mail preenchido: `boticanatural@terra.com.br`) | `privacidade.html` (seção Encarregado pelo Tratamento de Dados Pessoais) |
| **GA4 e Meta Pixel (`ALTO-05`)** | Desligado por padrão (`ga4MeasurementId: ''`, `metaPixelId: ''`) com `[PREENCHER]` | Se decidir ativar, preencher IDs em `ANALYTICS` (`js/config.js`) e liberar os domínios na CSP (ver seção 4.1) |
| **Números da Seção "Sobre"** | Valores mantidos sem alteração (`26 anos`, `129.644` clientes, `245.735` fórmulas, `1` Farmacêutico Responsável) | `index.html` (seção `#sobre` e card lateral do Hero) — confirmar exatidão antes da publicação |
| **Depoimentos Reais de Clientes** | Seção `#depoimentos` oculta (`hidden`) com `[PREENCHER: ...]` | `index.html` — só remover o atributo `hidden` e preencher quando houver depoimentos reais autorizados |
| **Nome Oficial, CNPJ, RT, CRF-RS, AFE, WhatsApp, Horário e Endereço** | ✅ Confirmados/preenchidos (`Botica Natural`, `04.063.559/0001-11`, `Tainã Cornélius Vargas – CRF/RS 17296`, `AFE n.º 0.04906.7`, `(51) 8554-3448`, `Seg a Sex 08:30–12:00 e 13:30–18:00; Sáb 08:30–12:00`, `Rua Assis Brasil, 31, Centro, Triunfo/RS`) | Páginas públicas e `js/config.js` |

---

## 3. Revisão Regulatória com o Farmacêutico Responsável Técnico (RT) — ANVISA

Os pontos abaixo estão documentados em `docs/auditoria/revisao-rt.md` e marcados no HTML com `<!-- REVISAR COM RT ... -->`:

1. **Textos neutralizados da Fase 1 (`index.html`, `produtos.html`, `privacidade.html`)**: validar a redação revisada das perguntas do FAQ (`#duvidas`) e da descrição de qualidade.
2. **Envio pelos Correios / abrangência de entrega (`index.html`, `privacidade.html`)**: confirmar com o RT a política formal de despacho postal segundo a RDC nº 67/2007 antes de mencionar envio nacional pelos Correios.
3. **Linha Veterinária (`index.html`, `produtos.html`)**: confirmar regularidade/licenciamento específico junto ao MAPA/órgão competente.
4. **Exibição de Preços e Parcelamento (`SHOW_INSTALLMENTS = false`)**: confirmar quais fórmulas podem exibir preço público vs modo `"Sob consulta"` (cadastrando preço `0,00` no Admin).

---

## 4. Infraestrutura, Hospedagem e Analytics Opcional

### 4.1 Headers HTTP de Segurança
- `_headers`: pronto para Cloudflare Pages / Netlify com HSTS (`max-age=63072000; includeSubDomains; preload`), `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`, `Permissions-Policy` com `payment=()`, CSP com `style-src 'self'` e `font-src 'self'`, e `Cache-Control` imutável para `/css/*`, `/js/*`, `/images/*` e `/fonts/*`.
- `vercel.json`: espelha exatamente os mesmos headers para Vercel Edge Network e define `"buildCommand": "npm run build:products"`.

### 4.2 Caso Decida Ativar GA4 e/ou Meta Pixel no Futuro
A infraestrutura em `js/main.js` já carrega os scripts **somente após consentimento explícito por categoria**. Se o proprietário optar por preencher `ANALYTICS` em `js/config.js`:
- Atualize a diretiva CSP (`_headers`, `vercel.json` e tags `<meta http-equiv="Content-Security-Policy">` das páginas públicas + `scripts/build-products.mjs`):
  - Para **GA4**: adicionar `https://www.googletagmanager.com` em `script-src` e `https://www.google-analytics.com https://region1.google-analytics.com` em `connect-src`.
  - Para **Meta Pixel**: adicionar `https://connect.facebook.net` em `script-src`, `https://www.facebook.com` em `img-src` e `connect-src`.
- Regenere as páginas de produto rodando `npm run build:products`.

---

## 5. Migrações e Scripts Operacionais do Supabase

### 5.1 Migrações no Supabase (Ordem Cronológica)
Todas possuem equivalentes de reversão (`*_rollback.sql`) quando alteram estrutura existente:
1. `supabase/migrations/20261104200000_security_hardening.sql`: cria `admin_users`, blinda `is_admin()`, remove e-mail hardcoded e restringe RLS.
2. `supabase/migrations/20261104210000_product_richtext_options.sql`: adiciona coluna `text_options JSONB` em `products`.
3. `supabase/migrations/20261105200000_data_safety_defaults.sql`: remove defaults arriscados (`allergen_info`, `quality_note`, `payment_info`), adiciona `check_price_non_negative`, triggers de `updated_at` e isolamento de `site_settings`.
4. `supabase/migrations/20261106020000_carousel_mobile_art.sql`: campos legados de arte mobile no carrossel.
5. `supabase/migrations/20261106214500_increase_short_description_limit.sql`: amplia limite de `short_description`.
6. `supabase/migrations/20261113230000_compound_showcase_cards.sql`: cria tabela e RLS de `compound_showcase_cards` para a vitrine de compostos editável pelo Admin.
7. `supabase/migrations/20261114100000_carousel_focus_point.sql`: adiciona `focus_x` e `focus_y` em `carousel_slides` (mantidos por compatibilidade com padrão central `50/50` após ativação do ajuste automático desktop/mobile).
8. `supabase/migrations/20261114110000_products_home_featured.sql`: adiciona `home_featured` e `home_position` (com índice parcial `idx_products_home_featured`) em `products`.
9. `supabase/migrations/20261114120000_products_slug.sql`: adiciona `slug` único com trigger de normalização sem acentos, dedup e índice `uq_products_slug_idx` em `products`.

### 5.2 Geração Estática de Produtos e Higiene de Dados
- Após configurar o domínio oficial ou atualizar produtos no Supabase:
  ```bash
  npm run build:products
  ```
- Caso existam textos legados cadastrados antes da arquitetura `_v: 2`:
  ```bash
  node scripts/repair-escapes.mjs --dry-run
  node scripts/repair-escapes.mjs
  ```

---

## 6. Validação Prévia de Produção

Antes do deploy definitivo em produção (após substituir os itens do proprietário na Seção 2):
```bash
npm run verify:prod
```
A publicação em produção só deve ocorrer quando **todos** os marcadores `[PREENCHER: ...]` pertinentes estiverem resolvidos e `verify:prod` retornar código `0`.
