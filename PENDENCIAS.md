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
| **Domínio Oficial de Produção (`CRIT-03`)** | ✅ Confirmado e aplicado (`https://boticanaturaltriunfo.com.br`) | `index.html`, `produtos.html`, `produto.html`, `privacidade.html`, `produtos/*/index.html`, `js/config.js`, `js/whatsapp.js`, `robots.txt`, `sitemap.xml` |
| **Encarregado de Dados — DPO (LGPD)** | `[PREENCHER: Nome do Encarregado / Responsável LGPD]` (e-mail preenchido: `boticanatural@terra.com.br`) | `privacidade.html` (seção Encarregado pelo Tratamento de Dados Pessoais) |
| **GA4 e Meta Pixel (`ALTO-05`)** | Desligado por padrão (`ga4MeasurementId: ''`, `metaPixelId: ''`) com `[PREENCHER]` | Se decidir ativar, preencher IDs em `ANALYTICS` (`js/config.js`) e liberar os domínios na CSP (ver seção 4.1) |
| **Números da Seção "Sobre"** | Valores mantidos sem alteração (`26 anos`, `129.644` clientes, `245.735` fórmulas); o card "Farmacêutico Responsável" e o selo "26 anos de tradição" foram removidos a pedido do proprietário | `index.html` (seção `#sobre` e card lateral do Hero) — confirmar exatidão antes da publicação |
| **Depoimentos Reais de Clientes** | Seção `#depoimentos` oculta (`hidden`) com `[PREENCHER: ...]` | `index.html` — só remover o atributo `hidden` e preencher quando houver depoimentos reais autorizados |
| **Nome Oficial, CNPJ, RT, CRF-RS, AFE, WhatsApp, Horário e Endereço** | ✅ Confirmados/preenchidos (`Botica Natural`, `04.063.559/0001-11`, `Tainã Cornélius Vargas – CRF/RS 17296`, `AFE n.º 0.04906.7`, `(51) 98554-3448`, `Seg a Sex 08:30–12:00 e 13:30–18:00; Sáb 08:30–12:00`, `Rua Assis Brasil, 31, Centro, Triunfo/RS`). RT e AFE ficam no rodapé legal de todas as páginas (o selo do topo da home foi removido) | Páginas públicas e `js/config.js` |
| **Telefone x link do WhatsApp** | O site exibe `(51) 98554-3448` e o `tel:` usa `+55 51 98554-3448`. Os links `wa.me` continuam com o ID antigo da conta (`555185543448`, sem o 9), que já abre a conversa certa | `js/config.js` (`WHATSAPP_PHONE` x `PHONE_E164`). Só trocar o `wa.me` para o formato com 9 depois de testar o link em um celular |
| **Fonte do logotipo (Roca)** | O nome "Botica Natural" usa **Roca** via Adobe Fonts (projeto web `luq5dht` na conta Adobe do proprietário). A Adobe oferece o desenho "Roca One"; o "Roca Two" exato só existe na licença comprada da My Creative Land | Se quiser o "Roca Two" exato: comprar a licença webfont, colocar os `.woff2` em `fonts/` e remover o Adobe Fonts da CSP e das páginas. No painel do Adobe Fonts, vale ajustar `font-display` para `swap` |
| **Nomes das categorias no painel** | O catálogo padroniza a caixa dos nomes ("SAÚDE DA MULHER" → "Saúde da Mulher"), mas não corrige a grafia. Há acentos faltando ou trocados no cadastro: `ESTOMAGO`, `ANSIOLITICOS`, `ARTÍCULAR`, `REUMÁTISMOS`, `SAUDE DO HOMEM` | Painel administrativo → Categorias |

---

## 3. Revisão Regulatória com o Farmacêutico Responsável Técnico (RT) — ANVISA

Os pontos abaixo estão documentados em `docs/auditoria/revisao-rt.md` e marcados no HTML com `<!-- REVISAR COM RT ... -->`:

1. **Textos neutralizados da Fase 1 (`index.html`, `produtos.html`, `privacidade.html`)**: validar a redação revisada das perguntas do FAQ (`#duvidas`) e da descrição de qualidade.
2. **Envio pelos Correios / abrangência de entrega (`index.html`, `privacidade.html`)**: confirmar com o RT a política formal de despacho postal segundo a RDC nº 67/2007 antes de mencionar envio nacional pelos Correios.
3. **Linha Veterinária (`index.html`, `produtos.html`)**: confirmar regularidade/licenciamento específico junto ao MAPA/órgão competente.
4. **Exibição de Preços e Parcelamento (`SHOW_INSTALLMENTS = false`)**: confirmar quais fórmulas podem exibir preço público vs modo `"Sob consulta"` (cadastrando preço `0,00` no Admin).

---

## 4. Infraestrutura, Hospedagem e Analytics Opcional

### 4.1 Headers HTTP, Cache, Exposição de Arquivos e Hospedagem (Cloudflare / Vercel)
- > **Checklist completo do proprietário (Fase 2):** consulte `docs/seguranca-manual.md` para todas as ações manuais no Supabase, Cloudflare Access/WAF, validação pós-deploy e verificação de `security.txt`.
- `_headers` e `vercel.json`: mantidos com paridade 100%, incluindo HSTS (`max-age=63072000; includeSubDomains; preload`), `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`, `Permissions-Policy` estendida (`usb`, `bluetooth`, `serial`, sensores, pagamento), CSP estrita (`script-src 'self'`; `style-src 'self'`; `font-src 'self'`; `upgrade-insecure-requests`; vitrine pública sem `wss://`), `Cross-Origin-Opener-Policy: same-origin` nas rotas administrativas `/admin` e `/admin.html`, desanexo explícito (`! Content-Security-Policy` e `! Cache-Control`) e cache seguro para módulos ESM.
- `404.html` e `_redirects`: impedem o modo SPA Soft-404 da Cloudflare Pages (retornando HTTP `404` real com caminhos absolutos `/...` que funcionam em qualquer profundidade) e redirecionam `/produtos/` para `/produtos` (`301`).
- **Deploy estrito em `dist/` (obrigatório):** tanto `vercel.json` quanto a Cloudflare Pages devem publicar exclusivamente o diretório `dist/` gerado por `npm run build:pages` (`npm run build:products && npm run build:cf`), impedindo a exposição de `docs/`, `supabase/`, `tests/`, `scripts/`, `package.json`, `SECURITY.md` e `.github/`. Apenas `/.well-known/security.txt` é incluído intencionalmente para divulgação responsável (confirmar endereço de contato e renovar `Expires:` antes de `2027-11-16`).
- **Checklist no Painel da Cloudflare (produção)**:
  1. Confirmar **Build command** `npm run build:pages` e **Output directory** `dist`.
  2. Em **Security → Scrape Shield → Email Address Obfuscation**, manter **desligado** (ou confiar nos marcadores `<!--email_off-->` já aplicados nos HTMLs) para evitar injeção de script de decodificação incompatível com `script-src 'self'`.
  3. Em **Speed → Optimization → Content Optimization**, manter **Rocket Loader** desligado para não injetar scripts externos (`ajax.cloudflare.com`) bloqueados pela CSP estrita.
  4. Em **SSL/TLS → Overview**, utilizar modo **Full (strict)** ao apontar o domínio oficial `boticanaturaltriunfo.com.br` (configurando regra de redirecionamento `301` de `https://www.boticanaturaltriunfo.com.br/*` para `https://boticanaturaltriunfo.com.br/$1` para evitar conteúdo duplicado), e em **Supabase Dashboard → Authentication → URL Configuration**, definir *Site URL* como `https://boticanaturaltriunfo.com.br` e restringir *Redirect URLs* estritamente a `https://boticanaturaltriunfo.com.br/admin` e `https://boticanaturaltriunfo.com.br/admin.html`.
  5. Configurar **Cloudflare Access** e **Rate Limiting WAF** para `/admin*` (ver `docs/seguranca-manual.md`).

### 4.2 Caso Decida Ativar GA4 e/ou Meta Pixel no Futuro
A infraestrutura em `js/main.js` já carrega os scripts **somente após consentimento explícito por categoria**. Se o proprietário optar por preencher `ANALYTICS` em `js/config.js`:
- Atualize a diretiva CSP (`_headers`, `vercel.json` e tags `<meta http-equiv="Content-Security-Policy">` das páginas públicas + `scripts/build-products.mjs`) seguindo exatamente os domínios documentados em `docs/seguranca.md` (Seção 2):
  - Para **GA4**: `https://www.googletagmanager.com` em `script-src` e `https://www.google-analytics.com https://region1.google-analytics.com https://stats.g.doubleclick.net` em `connect-src`.
  - Para **Meta Pixel**: `https://connect.facebook.net` em `script-src` e `https://www.facebook.com` em `img-src` e `connect-src`.
- Regenere as páginas de produto rodando `npm run build:products`.

---

## 5. Migrações e Scripts Operacionais do Supabase

### 5.1 Migrações no Supabase (Ordem Cronológica)
Todas possuem equivalentes de reversão (`*_rollback.sql` ou rollback documentado) quando alteram estrutura existente:
1. `supabase/migrations/20261104200000_security_hardening.sql`: cria `admin_users`, blinda `is_admin()`, remove e-mail hardcoded e restringe RLS.
2. `supabase/migrations/20261104210000_product_richtext_options.sql`: adiciona coluna `text_options JSONB` em `products`.
3. `supabase/migrations/20261105200000_data_safety_defaults.sql`: remove defaults arriscados (`allergen_info`, `quality_note`, `payment_info`), adiciona `check_price_non_negative`, triggers de `updated_at` e isolamento de `site_settings`.
4. `supabase/migrations/20261106020000_carousel_mobile_art.sql`: campos legados de arte mobile no carrossel.
5. `supabase/migrations/20261106214500_increase_short_description_limit.sql`: amplia limite de `short_description`.
6. `supabase/migrations/20261113230000_compound_showcase_cards.sql`: cria tabela e RLS de `compound_showcase_cards` para a vitrine de compostos editável pelo Admin.
7. `supabase/migrations/20261114100000_carousel_focus_point.sql`: adiciona `focus_x` e `focus_y` em `carousel_slides` (mantidos por compatibilidade com padrão central `50/50` após ativação do ajuste automático desktop/mobile).
8. `supabase/migrations/20261114110000_products_home_featured.sql`: adiciona `home_featured` e `home_position` (com índice parcial `idx_products_home_featured`) em `products`.
9. `supabase/migrations/20261114120000_products_slug.sql`: adiciona `slug` único com trigger de normalização sem acentos, dedup e índice `uq_products_slug_idx` em `products`.
10. `supabase/migrations/20261115100000_harden_button_links_allowlist.sql`: sanitiza links existentes em `carousel_slides.button_link` e `compound_showcase_cards.cta_href` e aplica CHECK constraints allowlist contra `//`, `/\`, `\/` e esquemas inseguros.
11. `supabase/migrations/20261115110000_restore_storage_hardening.sql`: restaura `file_size_limit = 2097152` (2 MB) e `allowed_mime_types` do bucket `product-images`, remove policies antigas duplicadas e restringe uploads/atualizações autenticadas aos prefixos `catalogo/` e `carousel/`.
12. **Pendente (NÃO aplicar antes do cadastro MFA TOTP):** `supabase/pending/20261115120000_require_aal2_admin.sql`: exige nível `aal2` em `public.is_admin()`. Só deve ser aplicada **depois** que todos os administradores ativarem MFA TOTP em `/admin#/seguranca` (ver `docs/seguranca-manual.md`).

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
