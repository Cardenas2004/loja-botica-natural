# Segurança Operacional e Arquitetura de Defesa — Botica Natural

Este documento consolida a postura de segurança da aplicação Botica Natural, incluindo autenticação MFA (TOTP), plano de recuperação contra bloqueio, políticas de CSP e procedimento de resposta a incidentes.

---

## 1. Autenticação MFA (TOTP) e Prevenção de Lockout

O painel administrativo (`/admin`) oferece suporte nativo a autenticação de dois fatores via TOTP (`supabase.auth.mfa`), compatível com aplicativos autenticadores (Google Authenticator, 1Password, Authy, Bitwarden, Microsoft Authenticator):

### Passo a passo seguro para ativação obrigatória (AAL2)

1. **Habilitar TOTP no Supabase Dashboard:**
   Em *Authentication → Multi-Factor Authentication*, ative a opção **TOTP (App Authenticator)**.
2. **Inscrever o fator do administrador:**
   Acesse `/admin`, entre com seu e-mail e senha, navegue até **Segurança (MFA)** (`#/seguranca`) e clique em **Configurar TOTP**.
   - Escaneie o QR Code (`data:image/svg+xml` emitido localmente pelo endpoint de autenticação do Supabase, sem chamadas a serviços de terceiros) ou copie manualmente a chave secreta exibida na tela.
   - Confirme o pareamento digitando o código de 6 dígitos gerado pelo aplicativo autenticador.
   - **Guarde a chave secreta em cofre de senhas offline/seguro** como cópia de recuperação, além do aplicativo principal.
3. **Validar login completo com desafio AAL2:**
   Clique em **Sair**, entre novamente em `/admin` e confirme que a tela de desafio TOTP (`Código de verificação`) aparece e conclui o acesso normalmente.
4. **Aplicar a exigência estrita no banco (`supabase/pending/`):**
   Somente depois de validar o Passo 3, execute o arquivo pendente [`supabase/pending/20261115120000_require_aal2_admin.sql`](../supabase/pending/20261115120000_require_aal2_admin.sql) no SQL Editor do Supabase. Esse arquivo exige `aal = 'aal2'` no JWT dentro de `public.is_admin()`.

### Plano de Recuperação em Caso de Perda do Dispositivo MFA

Caso o administrador perca acesso ao aplicativo autenticador (troca de celular sem backup da chave secreta):

1. Acesse o **Supabase Dashboard** com a conta proprietária (recomendado ter acesso protegido com 2FA próprio da conta Supabase).
2. Abra o **SQL Editor** (executado com privilégio administrativo/service role) e localize os fatores do usuário:
   ```sql
   SELECT f.id AS factor_id, u.email, f.factor_type, f.status, f.created_at
   FROM auth.mfa_factors f
   JOIN auth.users u ON u.id = f.user_id
   WHERE lower(u.email) = lower('<email_do_administrador>');
   ```
3. Caso o administrador ainda possua outro fator backup ou precise apenas remover o dispositivo perdido antes de cadastrar um novo:
   - **Opção A (recomendada, sem rebaixar RLS):** exclua o fator perdido no schema `auth` (ou via Auth API `auth.admin.mfa.deleteFactor`) e, se `aal2` estiver ativo em `public.is_admin()`, aplique temporariamente o bloco de rollback comentado em `supabase/pending/20261115120000_require_aal2_admin.sql` para permitir login e novo cadastro TOTP em `#/seguranca`:
     ```sql
     DELETE FROM auth.mfa_factors
     WHERE id = '<factor_id_perdido>';
     ```
   - Faça login em `/admin`, cadastre o novo autenticador em `#/seguranca`, valide um login completo e **reaplique imediatamente** `supabase/pending/20261115120000_require_aal2_admin.sql`.
4. **Importância da guarda de recuperação:** o TOTP do Supabase Auth não emite códigos descartáveis padrão na interface administrativa; portanto, **guardar a chave secreta (`seed` TOTP) em cofre criptografado ou cadastrar um segundo aplicativo autenticador de reserva** evita downtime operacional e reduz a necessidade de intervenções emergenciais no banco.

---

## 2. Política de Segurança de Conteúdo (CSP) e Cabeçalhos HTTP

As políticas estão configuradas de forma sincronizada entre [`_headers`](../_headers) (Cloudflare Pages) e [`vercel.json`](../vercel.json), com validação automática de paridade em `scripts/verify.mjs`.

### Decisões específicas de diretivas

- **`upgrade-insecure-requests`:** aplicado nos cabeçalhos HTTP (`_headers` e `vercel.json`) tanto nas páginas públicas quanto em `/admin` e `/admin.html`, promovendo sub-recursos HTTP legados para HTTPS em produção.
- **`wss://` removido da vitrine pública:** busca estática e suíte E2E confirmam que nenhuma página pública abre WebSocket (apenas chamadas REST em `js/publicApi.js`); `wss://njdkuhgoophzjxmmempu.supabase.co` foi mantido exclusivamente no painel `/admin`.
- **`data:` mantido em `img-src`:** obrigatório nas páginas públicas e no `/admin` porque os ícones SVG locais de [`css/icons.css`](../css/icons.css) (`--icon: url("data:image/svg+xml...")`), bem como os placeholders offline de imagem (`FALLBACK_IMG` em `js/app.js` e `FALLBACK_PRODUCT_IMAGE` em `js/shared/productRenderer.js`), carregam SVGs via `data:image/svg+xml`.
- **`Cross-Origin-Opener-Policy: same-origin` restrito a `/admin` e `/admin.html`:** isola o contexto de navegação administrativo sem adicionar `Cross-Origin-Resource-Policy` global (evitando bloquear leitura de Open Graph / imagens por crawlers externos).
- **`Permissions-Policy` estendida:** bloqueia `camera=()`, `microphone=()`, `geolocation=()`, `payment=()`, `usb=()`, `bluetooth=()`, `serial=()`, `accelerometer=()`, `gyroscope=()` e `magnetometer=()`.
- **HSTS (`Strict-Transport-Security`):** o atributo `preload` (`max-age=63072000; includeSubDomains; preload`) só deve ser mantido caso o domínio `boticanaturaltriunfo.com.br` seja formalmente submetido à lista HSTS Preload (`hstspreload.org`) e **todos** os subdomínios respondam com HTTPS válido.

### Como habilitar relatórios CSP (`report-to`) quando houver coletor

Nenhum endpoint fictício foi configurado no momento. Quando a equipe provisionar um coletor compatível (ex.: endpoint HTTPS próprio ou serviço de observabilidade):

1. Adicione o cabeçalho de resposta `Reporting-Endpoints: csp-endpoint="https://<seu-coletor>/csp-reports"`.
2. Acrescente `; report-to csp-endpoint` ao final da diretiva `Content-Security-Policy` em `_headers` e `vercel.json`.

### Domínios necessários se Analytics (GA4 / Meta Pixel) forem ativados

A infraestrutura em `js/main.js` só injeta scripts externos após consentimento explícito na categoria correspondente e permanece desligada por padrão (`ANALYTICS` vazio em `js/config.js`). **Com a CSP atual, esses scripts são intencionalmente bloqueados.** Caso o proprietário opte por ativá-los no futuro, será necessário atualizar a CSP pública em `_headers`, `vercel.json` e nos `<meta http-equiv="Content-Security-Policy">` (além de regenerar `produtos/*/index.html` com `npm run build:products`):

- **Google Analytics 4 (GA4):**
  - `script-src`: `https://www.googletagmanager.com`
  - `connect-src`: `https://www.google-analytics.com https://region1.google-analytics.com https://analytics.google.com`
  - `img-src`: `https://www.google-analytics.com https://www.googletagmanager.com`
- **Meta Pixel:**
  - `script-src`: `https://connect.facebook.net`
  - `connect-src`: `https://www.facebook.com https://graph.facebook.com`
  - `img-src`: `https://www.facebook.com`

---

## 3. Threat Model (Modelo de Ameaças)

### 3.1 Ativos Críticos
1. **Integridade do catálogo, vitrine e redirecionamentos:** nomes, descrições sanitizadas, preços, URLs de banners, cards de compostos e links de atendimento WhatsApp (`boticanaturaltriunfo.com.br`).
2. **Controle de acesso ao painel `/admin`:** sessão Supabase Auth de administradores listados em `public.admin_users`, segundo fator TOTP (`aal2`) e rascunhos locais temporários durante edição.
3. **Integridade e limites do Storage (`product-images`):** imagens `.webp`/`.jpeg`/`.png` nas pastas `catalogo/` e `carousel/`.
4. **Cadeia de suprimentos e artefatos de build:** módulos locais em `js/`, bundle vendored em `js/vendor/`, migrações em `supabase/`, segredos de operadores e pipeline GitHub Actions.
5. **Conformidade regulatória (LGPD e ANVISA):** ausência de rastreamento sem consentimento, minimização de coleta de dados no site e precisão de textos regulatórios e DPO em `privacidade.html`.

### 3.2 Atores de Ameaça
- **Atacante externo oportunista:** explora open redirect (`//evil.com`, `/\evil.com`), XSS em conteúdo rico, brute force ou enumeração de contas/schema no login de `/admin`, ou acesso direto a arquivos internos (`.git`, `docs/`, `supabase/`, `package.json`) se publicados junto com o site estático.
- **Operador acidental / sessão compartilhada:** administrador que deixa `/admin` aberto em estação compartilhada da farmácia (rascunhos em `localStorage` ou sessão persistente) ou copia URLs malformadas no CMS.
- **Atacante de cadeia de suprimentos:** comprometimento de tag mutável (`@v4`) em GitHub Action, vulnerabilidade em dependência transitiva npm (`swiper`, `@supabase/auth-js`), ou commit acidental de token `service_role` em código/PR.

### 3.3 Superfícies de Ataque e Controles Aplicados

| Superfície | Controles Existentes (Fase 1) | Novos Controles (Fase 2) |
|---|---|---|
| **Vitrine pública (HTML/CSS/JS)** | Zero `innerHTML`; sanitização DOM API (`richtext.js`); desacoplamento do SDK pesado (`publicApi.js`); analytics desligado e condicionado ao consentimento LGPD | `urlSafety.js` bloqueando `//`, `/\`, `\/` e esquemas perigosos; remoção de `wss://` da CSP pública; `upgrade-insecure-requests`; bloqueio `--prod` para `[PREENCHER` em qualquer HTML público |
| **Painel administrativo (`/admin`)** | RPC `public.is_admin()` via `admin_users`; otimistic lock atômico (`update_product_with_optimistic_lock`); limpeza básica na saída | Erro genérico único em credenciais e conta não-admin + telemetria `console.debug` redigida; limpeza automática de `bn_admin_product_draft_*` ao sair e timeout por inatividade (aviso em 29 min com "Prolongar sessão", encerramento em 30 min); suporte TOTP nativo (`#/seguranca`) + desafio `aal2` antes de `is_admin()`; `COOP: same-origin` |
| **Banco Postgres & Storage (Supabase)** | RLS habilitado nas tabelas públicas; `SECURITY DEFINER` com `search_path` fixo em `is_admin()` | Migração `20261115100000` (CHECK allowlist em `button_link`/`cta_href`); Migração `20261115110000` (`file_size_limit = 2 MB`, remoção de policies antigas duplicadas, escrita restrita a `catalogo/` e `carousel/`); Migração pendente `20261115120000` (`aal2` obrigatório após enrollment TOTP) |
| **Hospedagem & Cabeçalhos HTTP** | Paridade `_headers`/`vercel.json`; `X-Frame-Options: SAMEORIGIN`; `HSTS`; Clean URLs `/admin`; `404.html` | `vercel.json` publicando apenas `dist/`; `dist/.well-known/security.txt`; remoção da enumeração de diretórios internos em `robots.txt`; `Permissions-Policy` estendida; `Permissions-Policy`, `COOP` e paridade validados em `verify.mjs` |
| **CI/CD & Dependências** | Workflow único de testes + Playwright cross-browser | Workflows SHA-pinados com `permissions: contents: read`, `concurrency` e `timeout-minutes`; remoção de pacote órfão crítico (`swiper`); upgrade `@supabase/supabase-js@2.119.0` (0 vulnerabilidades); `npm audit`, `vendor-repro`, `Gitleaks`, `CodeQL`, `dependency-review` e `Dependabot` |

### 3.4 Riscos Residuais e Decisões Restritivas
1. **Chave `anon` pública por design:** está exposta intencionalmente no cliente estático para leitura de catálogo; sua segurança depende integralmente da integridade das policies RLS e da ausência total de chaves `service_role` no repositório (protegido via `.gitleaks.toml`).
2. **Bucket `product-images` com `product_images_select_public` preservado:** decidido preservar `product_images_select_public` porque as URLs públicas de imagem em `/storage/v1/object/public/product-images/...` continuam servindo os produtos sem `.list()` no front-end. Fica registrado em `docs/seguranca-manual.md` como opcional para revisão futura caso deseje proxy/URLs assinadas.
3. **Trava `aal2` em `supabase/pending/`:** mantida propositalmente fora de `supabase/migrations/` para evitar lockout imediato até o proprietário inscrever seu autenticador TOTP em `/admin#/seguranca`.
4. **Controles de borda e painel externos ao repositório:** desativação de cadastros públicos no Supabase Auth, Leaked Password Protection, Cloudflare Access/WAF Rate Limiting em `/admin*` e preenchimento do DPO em `privacidade.html` dependem exclusivamente de ação humana do proprietário (`docs/seguranca-manual.md`).

---

## 4. Runbook de Resposta a Incidentes

Em caso de suspeita de comprometimento de credencial administrativa, alteração indevida no catálogo ou vazamento de chave/token:

1. **Contenção imediata (primeiros 15 minutos):**
   - No **Supabase Dashboard → Authentication → Users**, localize a conta afetada e force **Sign out / Ban** imediato, ou execute no SQL Editor:
     ```sql
     DELETE FROM auth.sessions WHERE user_id = '<user_id_comprometido>';
     DELETE FROM public.admin_users WHERE user_id = '<user_id_comprometido>';
     ```
   - Caso exista suspeita sobre o segundo fator, remova os fatores antigos em `auth.mfa_factors` do usuário comprometido.
   - Se configurado o **Cloudflare Zero Trust / Access**, restrinja temporariamente a política de `/admin*` ou ative **Under Attack / WAF Block** na rota administrativa.
2. **Rotação de credenciais:**
   - Redefina a senha da conta Supabase do proprietário, das contas administrativas e do repositório GitHub.
   - Em caso de comprometimento de token privado (`service_role`, tokens de deploy Cloudflare/Vercel ou PAT GitHub), revogue e gere novas chaves imediatamente nos respectivos painéis (a `anon key` é pública, mas pode ser rotacionada juntamente com o JWT Secret caso ocorra incidente severo de sessão, atualizando `js/publicApi.js`, `js/supabaseClient.js`, `scripts/repair-escapes.mjs` e republicando).
3. **Verificação de integridade de dados e mídias:**
   - Audite registros recentes no banco:
     ```sql
     SELECT id, title, button_link, updated_at FROM public.carousel_slides ORDER BY updated_at DESC;
     SELECT id, name, cta_href, updated_at FROM public.compound_showcase_cards ORDER BY updated_at DESC;
     SELECT id, name, price, is_active, updated_at FROM public.products ORDER BY updated_at DESC;
     SELECT id, name, created_at, metadata FROM storage.objects WHERE bucket_id = 'product-images' ORDER BY created_at DESC LIMIT 50;
     ```
   - Remova qualquer objeto não autorizado ou altere via painel/SQL, restaurando ponto anterior via **Supabase Backups (PITR)** se necessário.
   - Regere o pacote estático limpo (`npm run build:pages`) e dispare novo deploy na Cloudflare Pages / Vercel.
4. **Preservação de evidências, LGPD e Pós-Mortem:**
   - Exporte os logs de **Supabase Auth**, **Postgres** e **Cloudflare Security Events** do período afetado antes de expiração da janela de retenção.
   - Avalie impacto a titulares de dados pessoais (o catálogo estático não armazena receituários nem dados de clientes no Supabase; se o incidente envolveu canal externo como WhatsApp ou e-mail institucional, siga a obrigação de comunicação à ANPD e aos titulares prevista no Art. 48 da LGPD junto ao Encarregado/DPO indicado em `privacidade.html`).
   - Documente causa raiz, janela temporal e ação corretiva preventiva antes de restaurar acessos normais.


