# Checklist Manual de Segurança do Proprietário — Botica Natural (Fase 2)

> Este checklist reúne exclusivamente as ações que exigem acesso direto ao **Supabase Dashboard**, **Cloudflare Dashboard**, **GitHub Settings** ou **aprovação legal/comercial do proprietário**. Nenhuma destas etapas foi executada via código e **todas permanecem pendentes de ação humana antes do go-live definitivo**.

---

## 1. Bloqueadores Obrigatórios Antes de Publicar em Produção (`npm run verify:prod`)

Atualmente `npm run verify:prod` **falha intencionalmente** enquanto houver marcadores `[PREENCHER` em arquivos de produção (`privacidade.html`, `index.html`, `js/config.js`):

- [ ] **Nome do Encarregado pelo Tratamento de Dados Pessoais — DPO (LGPD) — BLOQUEADOR CRÍTICO**
  - Arquivo: `privacidade.html` (linha 108) -> `[PREENCHER: Nome do Encarregado / Responsável LGPD]`.
  - O nome **não foi inventado** por obrigação legal (Art. 41 da LGPD). Defina o responsável real e substitua no HTML antes do deploy.
  - O comando `npm run verify:prod` está configurado para falhar sempre que `[PREENCHER` aparecer em qualquer HTML público (`PUBLIC_HTML_FILES`) ou arquivo de configuração publicado.
- [ ] **Decisão sobre Analytics (`js/config.js`)**
  - Arquivo: `js/config.js` (linha 66) -> `// [PREENCHER: ...]`.
  - Caso não utilize GA4/Meta Pixel no lançamento, remova o comentário `[PREENCHER...]` mantendo `ga4MeasurementId: ''` e `metaPixelId: ''`. Caso decida ativar, preencha os IDs e adicione os domínios exatos documentados em `docs/seguranca.md` (Seção 2) no `_headers`, `vercel.json` e tags `<meta>` CSP, regerando as páginas com `npm run build:products`.
- [ ] **Seção de Depoimentos (`index.html`)**
  - Linhas `587`, `595`, `603`, `607`, `608`: permanecer com `#depoimentos` oculto (`hidden`) caso ainda não existam depoimentos reais autorizados, ou preencher com depoimentos reais e nota verídica (caso opte por manter oculto/desabilitado no lançamento e ainda assim liberar `verify:prod`, remova os textos placeholder ou preencha depoimentos reais autorizados antes do go-live).
- [ ] **Confirmar canal de contato de segurança em `.well-known/security.txt` e `SECURITY.md`**
  - Atualmente configurado com `mailto:boticanatural@terra.com.br` (único e-mail público oficial já constante em `privacidade.html`).
  - Confirmar se deseja manter `boticanatural@terra.com.br` ou direcionar para alias dedicado (ex.: `seguranca@boticanaturaltriunfo.com.br`) com encaminhamento monitorado, além de renovar o campo `Expires:` antes de **`2027-11-16`**.

---

## 2. Aplicação de Migrações SQL no Supabase (ORDEM EXATA)

Acesse **Supabase Dashboard → SQL Editor** e execute na ordem exata abaixo (somente após validar que as migrações anteriores até `20261114120000_products_slug.sql` e `20261104200000_security_hardening.sql` já foram aplicadas):

1. **Passo 1 — Allowlist anti-open-redirect no banco**
   - Arquivo: `supabase/migrations/20261115100000_harden_button_links_allowlist.sql`
   - Efeito: sanitiza eventuais links inseguros pré-existentes (registrando contagem via `RAISE NOTICE`) e aplica CHECK constraints (`chk_carousel_slides_button_link_safe` e `chk_compound_showcase_cards_cta_href_safe`) rejeitando `//`, `/\`, `\/`, `javascript:`, `data:`, `vbscript:` diretamente no Postgres.
2. **Passo 2 — Restauração do hardening do bucket `product-images`**
   - Arquivo: `supabase/migrations/20261115110000_restore_storage_hardening.sql`
   - Efeito: restaura `file_size_limit = 2097152` (2 MB) e `allowed_mime_types = ['image/webp', 'image/jpeg', 'image/png']`, remove policies antigas duplicadas (`product_images_public_read`, `product_images_admin_insert`, `product_images_admin_update`, `product_images_admin_delete`) e restringe uploads/atualizações autenticadas do admin estritamente às pastas `catalogo/` e `carousel/`.
   - *Observação sobre `product_images_select_public`:* a policy `product_images_select_public` (`SELECT` em `storage.objects` para `bucket_id = 'product-images'`) foi preservada nesta migração porque as URLs públicas (`/storage/v1/object/public/product-images/...`) continuam servindo as imagens do catálogo e nenhum código cliente chama `.list()`. Se no futuro decidir servir mídias apenas por proxy/URLs assinadas ou bloquear listagem anônima via API PostgREST/Storage, avalie remover `product_images_select_public` após testar o carregamento público das imagens no ambiente de homologação.
3. **Passo 3 — Bootstrap de MFA TOTP antes da trava AAL2 (OBRIGATÓRIO PARA NÃO GERAR LOCKOUT)**
   - [ ] Faça login normalmente no painel `/admin` com **todas** as contas administrativas ativas.
   - [ ] Acesse o menu **Segurança (MFA)** (`#/seguranca`), gere o QR Code TOTP, escaneie em seu aplicativo autenticador (Google Authenticator / 1Password / Bitwarden) e conclua a confirmação com o código de 6 dígitos (`verified`).
   - [ ] Somente **depois** que todos os administradores estiverem com pelo menos 1 fator TOTP `verified`, aplique no SQL Editor o arquivo **`supabase/pending/20261115120000_require_aal2_admin.sql`** (ele permanece fora de `supabase/migrations/` justamente para impedir aplicação prematura antes do cadastro de TOTP).
   - *Contingência em caso de perda do celular:* siga o runbook de recuperação via SQL Editor documentado em `docs/seguranca.md` (Seção 1).

---

## 3. Verificações Obrigatórias no Supabase SQL Editor (Pós-Aplicação)

Execute cada consulta abaixo no **SQL Editor** do Supabase e compare com a saída esperada:

### 3.1 Confirmar RLS habilitado em todas as tabelas públicas
```sql
SELECT tablename, rowsecurity
  FROM pg_tables
 WHERE schemaname = 'public'
 ORDER BY tablename;
```
- **Saída esperada:** `rowsecurity = true` para todas as tabelas: `admin_users`, `carousel_slides`, `categories`, `compound_showcase_cards`, `products`, `site_settings`.

### 3.2 Confirmar limites do bucket `product-images`
```sql
SELECT id, public, file_size_limit, allowed_mime_types
  FROM storage.buckets
 WHERE id = 'product-images';
```
- **Saída esperada:** `1` linha com `id = 'product-images'`, `public = true`, `file_size_limit = 2097152`, `allowed_mime_types = {image/webp,image/jpeg,image/png}`.

### 3.3 Confirmar limpeza das policies antigas de `storage.objects`
```sql
SELECT policyname, cmd
  FROM pg_policies
 WHERE schemaname = 'storage'
   AND tablename = 'objects'
 ORDER BY policyname;
```
- **Saída esperada:** **ausência** de `product_images_public_read`, `product_images_admin_insert`, `product_images_admin_update` e `product_images_admin_delete`; presença das policies correntes endurecidas (INSERT/UPDATE limitadas a prefixos `^(catalogo|carousel)/`).

### 3.4 Confirmar CHECK constraints anti-open-redirect
```sql
SELECT conrelid::regclass AS tabela, conname, pg_get_constraintdef(oid) AS definicao
  FROM pg_constraint
 WHERE conrelid IN ('public.carousel_slides'::regclass, 'public.compound_showcase_cards'::regclass)
   AND contype = 'c'
 ORDER BY conname;
```
- **Saída esperada:** presença de `chk_carousel_slides_button_link_safe` e `chk_compound_showcase_cards_cta_href_safe` com allowlist `https://`, `http://`, `/`, `#`, rejeição de `//` e barra invertida (`chr(92)`).

### 3.5 Confirmar função `public.is_admin()` (e AAL2 após Passo 3)
```sql
SELECT pg_get_functiondef('public.is_admin()'::regprocedure);
```
- **Saída esperada (após `20261115120000_require_aal2_admin.sql`):** definição contendo `SECURITY DEFINER`, consulta a `public.admin_users`, `SET search_path = public, auth, pg_temp` e a exigência `COALESCE(auth.jwt() ->> 'aal', '') = 'aal2'`.

### 3.6 Confirmar fatores TOTP cadastrados antes de ativar AAL2
```sql
SELECT f.id, u.email, f.factor_type, f.status, f.created_at
  FROM auth.mfa_factors f
  JOIN auth.users u ON u.id = f.user_id
  JOIN public.admin_users a ON a.user_id = f.user_id
 ORDER BY f.created_at;
```
- **Saída esperada:** ao menos `1` linha com `factor_type = 'totp'` e `status = 'verified'` para **cada** conta presente em `public.admin_users`.

### 3.7 Rodar bateria automatizada `supabase/tests/rls_checks.sql`
- [ ] Copie e execute `supabase/tests/rls_checks.sql` no SQL Editor dentro de transação segura (`BEGIN ... ROLLBACK` conforme cabeçalho do script) e confirme que **todos os asserts passam sem erro**.

---

## 4. Configurações no Painel do Supabase (Authentication & Infraestrutura)

- [ ] **Desativar novos cadastros (`Enable new user signups = OFF`)**: em *Authentication → Providers → Email / Sign In*, desative cadastros públicos para evitar criação de usuários não autorizados. Novos admins só devem ser convidados manualmente pelo painel e inseridos em `public.admin_users`.
- [ ] **Leaked Password Protection**: em *Authentication → Policies / Password Security*, ative **"Prevent use of leaked passwords"** (verificação HaveIBeenPwned) e configure tamanho mínimo >= 12 caracteres com complexidade mista.
- [ ] **Multi-Factor Authentication (MFA)**: em *Authentication → Multi-Factor Authentication*, habilite **TOTP (App Authenticator)** em produção.
- [ ] **URL Configuration restrita**: em *Authentication → URL Configuration*:
  - **Site URL:** `https://boticanaturaltriunfo.com.br`
  - **Redirect URLs:** manter apenas `https://boticanaturaltriunfo.com.br/admin` e `https://boticanaturaltriunfo.com.br/admin.html` (remover eventuais URLs `http://localhost:*` temporárias após concluir homologação).
- [ ] **Rate Limits & Sessão**: revisar limites de tentativas de login/OTP em *Authentication → Rate Limits* e expiração JWT em *Authentication → Sessions / JWT*.
- [ ] **Backups & Logs**: confirmar rotina de backups ativos no projeto Supabase e verificar retenção de Auth/Postgres Logs.

---

## 5. Configurações na Cloudflare Pages, WAF & Access

- [ ] **Build & Output Directory (Cloudflare Pages → Settings → Builds & deployments)**:
  - **Build command:** `npm run build:pages` (equivalente a `npm run build:products && npm run build:cf`)
  - **Build output directory:** `dist`
  - Garantir que a publicação **não** aponte mais para a raiz `.` (impedindo servir `docs/`, `supabase/`, `scripts/`, `tests/`, `package.json`, `SECURITY.md`, `.github/`).
- [ ] **Cloudflare Zero Trust / Access na rota `/admin*` (Recomendado em produção)**:
  - Criar aplicação Access protegendo `boticanaturaltriunfo.com.br/admin` e `boticanaturaltriunfo.com.br/admin.html` (política Allow apenas para e-mails administrativos via OTP). Isso cria segunda barreira de perímetro antes da tela de login do Supabase.
- [ ] **Rate Limiting (WAF)**:
  - Criar regra WAF para limitar rajadas excessivas em `/admin*` e proteção anti-bot na borda.
- [ ] **SSL/TLS & Rede**:
  - **SSL/TLS Mode:** `Full (strict)`
  - **Always Use HTTPS:** `ON`
  - **Automatic HTTPS Rewrites:** `ON`
  - **Scrape Shield → Email Address Obfuscation:** `OFF` (ou confiar nos marcadores `<!--email_off-->` já aplicados para não quebrar a CSP estrita `script-src 'self'`).
  - **Speed → Optimization → Rocket Loader:** `OFF` (evita injeção de script externo bloqueado pela CSP).
  - **HSTS Preload (`hstspreload.org`)**: o header `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` já é emitido; só submeter o domínio no portal `hstspreload.org` quando tiver certeza absoluta de HTTPS permanente em **todos** os subdomínios.

---

## 6. Validação Obrigatória Pós-Deploy em Produção

Após publicar no domínio `https://boticanaturaltriunfo.com.br`:

- [ ] Verificar headers e status HTTP:
  ```bash
  curl -sI https://boticanaturaltriunfo.com.br/
  curl -sI https://boticanaturaltriunfo.com.br/admin
  curl -sI https://boticanaturaltriunfo.com.br/.well-known/security.txt
  curl -sI https://boticanaturaltriunfo.com.br/package.json
  curl -sI https://boticanaturaltriunfo.com.br/docs/seguranca.md
  curl -sI https://boticanaturaltriunfo.com.br/supabase/schema_reference.sql
  ```
  - Resultados esperados: `/` (`200`, CSP sem `wss://`), `/admin` (`200`, `Cross-Origin-Opener-Policy: same-origin`, `X-Robots-Tag: noindex, nofollow`, `frame-src 'self' blob:`), `/.well-known/security.txt` (`200`), e os caminhos internos (`/package.json`, `/docs/seguranca.md`, `/supabase/schema_reference.sql`) retornando `404`.
- [ ] Testar nota **A+** em `https://securityheaders.com/` e no **Mozilla HTTP Observatory** (`https://developer.mozilla.org/en-US/observatory`).
- [ ] Habilitar no repositório GitHub (**Settings → Code security and analysis**): *Dependabot alerts*, *Dependabot security updates*, *Secret scanning* e *Code scanning (CodeQL)*.
