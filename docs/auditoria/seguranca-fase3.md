# Relatório de Auditoria e Hardening — Botica Natural (Fase 3)

- **Branch:** `security/hardening-fase3`, empilhada sobre `security/hardening-fase2` (PR #1 ainda aberto; partir da `main` reabriria falhas já corrigidas).
- **Data:** 2026-11-16
- **Escopo:** auditoria ofensiva-defensiva do estado **real** (banco Supabase de produção `njdkuhgoophzjxmmempu` e site publicado `boticanaturaltriunfo.com.br`) e do código da branch, com foco no que a Fase 2 não cobriu ou deixou pendente.

---

## 1. Metodologia

| Frente | Como foi verificado | Natureza |
|---|---|---|
| Banco / RLS | Supabase Advisors (security), catálogo `pg_policies`, `pg_proc`, `pg_default_acl`, `has_table_privilege` | Somente leitura |
| Prova de RLS | Escritas como role `anon` (INSERT/UPDATE/DELETE em tabelas e `storage.objects`) dentro de `BEGIN … ROLLBACK`; leituras HTTP reais com a chave anon | Sem persistência |
| Auth | `GET /auth/v1/settings` (cadastro, provedores), contagem de admins e fatores MFA | Somente leitura |
| Front-end | Busca de sinks de DOM; fuzz de 24 payloads XSS/mXSS e 7 variantes de open redirect contra `sanitizeRichHtml`/`sanitizeLinkHref` | Local |
| Produção HTTP | Headers da home e do `/admin`; 20 caminhos internos (`/.git/config`, `/package.json`, `/supabase/…`, `/docs/…`) | GET somente |
| Supply chain / CI | `npm audit`, `npm outdated`, permissões e gatilhos dos workflows, runtime das actions (resolvido via API do GitHub por SHA) | Local / leitura |
| Migração proposta | Ensaio integral em produção dentro de `BEGIN … ROLLBACK` + Teste 5 falhando antes e passando depois | Sem persistência |

Nenhum teste destrutivo, de força bruta ou de alto volume foi executado contra produção.

---

## 2. Achados

| ID | Severidade | Componente | Evidência | Status |
|---|---|---|---|---|
| **F1** | **Alta** | Auth admin | 2 contas em `public.admin_users` e **0** fatores em `auth.mfa_factors`; `is_admin()` não exige `aal2`. O único caminho privilegiado depende só de senha. | Pendente do proprietário (§4, itens 1–2) |
| **F2** | Média | Supabase Auth | Advisor `auth_leaked_password_protection`: verificação contra HaveIBeenPwned desligada. | Pendente do proprietário (§4, item 3) |
| **F3** | Média | Postgres grants | `anon` tem `INSERT/UPDATE/DELETE/TRUNCATE/TRIGGER/REFERENCES` em `carousel_slides`, `categories`, `compound_showcase_cards`, `products`; `pg_default_acl` repete isso em **tabelas novas**. RLS bloqueia hoje (provado), mas é a única barreira, e `TRUNCATE` ignora RLS. | **Corrigido no código**: `20261116100000_least_privilege_grants.sql` (aguarda aplicação) |
| **F4** | Baixa | Funções SQL | Advisor 0011: `slugify_product_text` e `ensure_product_slug` sem `search_path` fixo. | **Corrigido no código** (mesma migração) |
| **F5** | Baixa | RPC | Advisors 0028/0029: `rls_auto_enable()` (SECURITY DEFINER) exposta em `/rest/v1/rpc`. Não explorável (função de event trigger), mas superfície desnecessária. | **Corrigido no código** (mesma migração) |
| **F6** | Baixa | CI/CD | CI em `node-version: '20'` (EOL 2026-04-30) e actions em runtime Node 20 (descontinuado pelo GitHub). | **Corrigido**: Node 24 LTS, actions com runtime `node24` pinadas por SHA, trava em `verify.mjs` |
| **F7** | Média | Deploy | Produção ainda serve a versão **anterior à Fase 2**: CSP pública com `wss://`, `Permissions-Policy` reduzida, `/admin` sem `COOP`, `/.well-known/security.txt` → 404. | Pendente do proprietário (§4, item 4) |
| **F8** | Baixa | CI/CD | CodeQL falha: *default setup* ativo no repositório conflita com o workflow avançado. | Pendente do proprietário (§4, item 5) |
| **F9** | Info | Documentação | `docs/seguranca.md` citava a RPC `update_product_with_optimistic_lock`, inexistente no banco; o controle real é UPDATE condicional em `js/admin/api.js`. | **Corrigido** |

### 2.1 Falsos positivos descartados

- **Reverse tabnabbing em `js/app.js:1876`** (`window.open('', '_blank')`): `popup.opener = null` é aplicado logo em seguida e o destino é sempre slug interno de produto.
- **`is_admin()` executável por `authenticated`** (advisor 0029): necessário, porque as policies o avaliam no contexto do usuário logado; retorna apenas o próprio status.
- **`/%5Cevil.com` e `/%2F%2Fevil.com` aceitos por `sanitizeLinkHref`**: navegadores tratam como caminho do mesmo host, não como autoridade; não há redirect.
- **Bucket `product-images` público**: decisão documentada na Fase 2; MIME restrito a webp/jpeg/png (sem SVG), limite de 2 MB, sem objetos fora de `catalogo/` e `carousel/`.

### 2.2 Controles comprovados como eficazes

- RLS: INSERT anônimo → `42501`; UPDATE/DELETE anônimo → 0 linhas; upload anônimo em Storage → `42501`; `admin_users` → `permission denied`; produtos inativos invisíveis ao anon.
- Auth: `disable_signup = true`, apenas provedor e-mail, usuários anônimos desligados; raiz OpenAPI do PostgREST exige `service_role`.
- Front: CSP sem `unsafe-inline`/`unsafe-eval`; zero `innerHTML`/`insertAdjacentHTML`/`eval`; sanitizador resistiu aos 24 payloads (incluindo mXSS `noscript`/`math`, entidades e quebras de linha em `javascript:`).
- Produção não expõe nenhum dos 20 arquivos internos testados.
- `npm audit`: 0 vulnerabilidades; nenhum `pull_request_target`; `permissions` mínimas nos workflows.

---

## 3. Correções desta branch

| Achado | Arquivos | Teste de regressão |
|---|---|---|
| F6 | `.github/workflows/{ci,codeql,dependency-review}.yml`, `scripts/verify.mjs` | `verify.mjs` reprova `node-version` < 22 (validado reintroduzindo `'20'`) ; `build:vendor` + `git diff --exit-code js/vendor` idêntico em Node 24 |
| F3, F4, F5 | `supabase/migrations/20261116100000_least_privilege_grants.sql` (rollback em `supabase/rollbacks/`, fora do caminho do `db push`), `supabase/tests/rls_checks.sql` (Teste 5) | Teste 5 **falha** no estado atual de produção (`[FALHA TESTE 5.1]`) e **passa** com a migração, ambos em `BEGIN … ROLLBACK`; vitrine continua lendo 48 produtos / 20 categorias / 4 slides como anon |
| F9 | `docs/seguranca.md` | — |

Atualizações das actions (todas `runs.using: node24`, SHA de commit resolvido do tag via API do GitHub):

| Action | Antes | Depois |
|---|---|---|
| `actions/checkout` | v4.4.0 | v6.1.0 `d23441a48e516b6c34aea4fa41551a30e30af803` |
| `actions/setup-node` | v4.4.0 | v6.5.0 `249970729cb0ef3589644e2896645e5dc5ba9c38` |
| `actions/upload-artifact` | v4.6.2 | v7.0.2 `cf430e030ddbb5b0abf93d22962f4752f3646cd9` |
| `actions/dependency-review-action` | v4.9.0 | v5.0.0 `a1d282b36b6f3519aa1f3fc636f609c47dddb294` |

---

## 4. Checklist do proprietário (ordem recomendada)

1. **Cadastrar TOTP nas 2 contas admin (F1):** `/admin` → **Segurança (MFA)** (`#/seguranca`) → *Configurar TOTP*. Guarde a chave secreta em cofre. Faça logout/login para validar o desafio. Confirme com:
   `SELECT u.email, f.status FROM auth.mfa_factors f JOIN auth.users u ON u.id = f.user_id;` (esperado: `verified` para cada admin).
2. **Exigir AAL2 (F1):** somente após o item 1, rode `supabase/pending/20261115120000_require_aal2_admin.sql` no **Supabase Dashboard → SQL Editor**.
3. **Leaked Password Protection (F2):** **Supabase Dashboard → Authentication → Sign In / Providers → Email → Password security → "Prevent use of leaked passwords"** (ative; requer plano Pro). Ajuste também o tamanho mínimo de senha para ≥ 12.
4. **Publicar a Fase 2 (F7):** faça merge do PR #1 e confirme em **Cloudflare Dashboard → Workers & Pages → (projeto) → Settings → Builds** que o *Build command* é `npm run build:cf` e o *Build output directory* é `dist`. Depois verifique: `curl -sI https://boticanaturaltriunfo.com.br/admin | grep -i cross-origin-opener` e `curl -s https://boticanaturaltriunfo.com.br/.well-known/security.txt`.
5. **CodeQL (F8):** **GitHub → Settings → Code security → Code scanning → CodeQL analysis → ⋯ → Disable CodeQL** (o workflow avançado do repositório assume) e rode de novo o job.
6. **Aplicar a migração da Fase 3 (F3–F5):** após aprovação, rode `supabase/migrations/20261116100000_least_privilege_grants.sql` no SQL Editor e em seguida `supabase/tests/rls_checks.sql` (deve terminar com `[OK TESTE 5]`). Rode novamente **Advisors → Security**: os lints 0011 e 0028 devem sumir.
7. **Tirar o painel da internet aberta (residual):** o login vai direto para `njdkuhgoophzjxmmempu.supabase.co`, que não passa pelo Cloudflare, então uma regra de WAF no site não limita tentativas de senha. O controle eficaz é **Cloudflare Zero Trust → Access → Applications → Add → Self-hosted** cobrindo `boticanaturaltriunfo.com.br/admin*`, com política "Allow" apenas para os e-mails dos administradores. Isso esconde a interface, mas **não** impede chamadas diretas à API de Auth do Supabase; quem torna uma senha vazada inútil é o item 2 (AAL2 obrigatório no banco).

---

## 5. Riscos residuais

1. **Admin com fator único até o checklist 1–2** — maior risco atual: phishing ou reuso de senha dá controle total do catálogo, banners e links de WhatsApp (vetor de golpe contra clientes).
2. **Produção defasada até o deploy da Fase 2** — headers e isolamento do admin publicados são os antigos.
3. **Chave anon pública por design** — segura enquanto RLS e grants (F3) estiverem íntegros; o Teste 5 e os advisors devem rodar após toda migração.
4. **Brute force no endpoint de Auth do Supabase** — mitigado pelos limites nativos do Supabase Auth; só deixa de importar com AAL2 obrigatório (checklist 2).
