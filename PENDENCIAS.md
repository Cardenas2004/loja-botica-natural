# Pendências Operacionais, Dados do Negócio e Validações Regulatórias — Botica Natural

Este documento lista **todas as ações manuais**, **dados reais do negócio** (`[PREENCHER: ...]`) e **validações regulatórias com o Farmacêutico Responsável Técnico (RT)** que não podem ser inventados ou automatizados via código.

---

## 1. Ações Críticas no Painel do Supabase (Fase 1 — Segurança)

### 1.1 Executar Migração de Segurança e Bootstrap do Admin (ORDEM OBRIGATÓRIA)
> **ATENÇÃO À ORDEM:** A migração `supabase/migrations/20261104200000_security_hardening.sql` remove o e-mail hardcoded e a leitura insegura de `user_metadata.role` da função `public.is_admin()`, passando a validar exclusivamente a tabela `public.admin_users`. **Execute o INSERT do administrador imediatamente após rodar a migração** para não ficar sem acesso de escrita no `admin.html`.

1. Abra o painel do Supabase → **SQL Editor**.
2. Cole e execute o conteúdo completo de `supabase/migrations/20261104200000_security_hardening.sql`.
3. **Imediatamente a seguir**, no mesmo **SQL Editor**, substitua o placeholder pelo e-mail real da conta administrativa e execute:
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
- [ ] **Rotação opcional da `anon key`**: a `anon key` é pública por design e a segurança real reside nas policies de RLS recém-endurecidas. Caso deseje rotacionar as chaves por higiene após os ajustes de RLS, gere novas chaves no painel e atualize `js/supabaseClient.js`.

---

## 2. Dados Reais do Negócio para Preenchimento (`[PREENCHER: ...]`)

Substitua os placeholders abaixo pelos dados reais verificados antes ou logo após a publicação:

| Item / Dado | Placeholder Atual | Onde aparece |
|---|---|---|
| **Nome Oficial da Marca** | Confirmar se é oficialmente `"Botica Natural"` (`BRAND_NAME` em `js/config.js`) | `js/config.js`, todas as páginas HTML (`<title>`, rodapé, JSON-LD, políticas) |
| **Domínio Oficial de Produção** | `https://boticanatural.com.br` (`[PREENCHER: confirmar domínio oficial]`) | `js/config.js`, `index.html`, `produtos.html`, `produto.html`, `privacidade.html`, `robots.txt`, `sitemap.xml` |
| **CNPJ da Farmácia** | ✅ Preenchido: `04.063.559/0001-11` (Botica Natural Farmácia de Manipulação LTDA) | `index.html`, `produtos.html`, `produto.html`, `privacidade.html` |
| **Farmacêutico(a) Responsável Técnico(a)** | ✅ Preenchido: `Tainã Cornélius Vargas` | `index.html`, `produtos.html`, `produto.html`, `privacidade.html` |
| **Inscrição no CRF-RS** | ✅ Preenchido: `CRF/RS 17296` | `index.html`, `produtos.html`, `produto.html`, `privacidade.html` |
| **Licença Sanitária / AFE (Anvisa)** | ✅ Preenchido: `AFE n.º 0.04906.7` | `index.html`, `produtos.html`, `produto.html` |
| **E-mail Oficial de Atendimento / DPO (LGPD)** | `[PREENCHER: e-mail oficial]` / `[PREENCHER: e-mail do encarregado LGPD]` | `index.html`, `produtos.html`, `produto.html`, `privacidade.html` |
| **Indicadores da Seção "Sobre"** | `[PREENCHER: anos de atuação]`, `[PREENCHER: clientes atendidos]`, `[PREENCHER: fórmulas manipuladas]` | `index.html` (seção `#sobre` e card lateral do Hero) |
| **Depoimentos Reais de Clientes** | Seção `#depoimentos` oculta (`hidden`) com `<!-- TODO -->` | `index.html` (só remover atributo `hidden` quando houver depoimentos reais autorizados) |

---

## 3. Revisão Regulatória com o Farmacêutico Responsável Técnico (RT) — ANVISA

Os pontos abaixo foram marcados no código com `<!-- REVISAR COM RT: RDC 67/2007 e normas de publicidade da Anvisa -->` e exigem validação formal do(a) Farmacêutico(a) Responsável Técnico(a) antes da operação comercial:

1. **Exibição de Preços e Parcelamento de Fórmulas Manipuladas no Catálogo (`index.html`, `produtos.html`, `produto.html`, `js/app.js`, `js/product.js`)**:
   - Verificar junto ao RT e às normas vigentes da Anvisa (RDC 67/2007, RDC 96/2008 e orientações do CRF-RS) se os itens cadastrados no catálogo podem exibir preço direto (`R$ ...`) na vitrine ou se determinados itens magistrais devem ser exibidos exclusivamente no modo **"Sob consulta"** (cadastrando preço `0` no painel Admin, o que já aciona automaticamente o texto `"Sob consulta"` e oculta `offers` no JSON-LD).
2. **Textos Promocionais de Captação (`index.html` — seção `#orcamento`)**:
   - Revisar a frase *"Envie sua receita ou dúvida e garanta condições especiais no seu primeiro pedido"* para assegurar conformidade com as restrições de publicidade e promoção de medicamentos manipulados (RDC 67/2007 e RDC 96/2008).
3. **Dados obrigatórios no rodapé de farmácias abertas ao público na internet (RDC 44/2009 e RDC 67/2007)**:
   - Preencher razão social completa, CNPJ, endereço físico, telefone, nome do(a) Farmacêutico(a) RT, número do CRF-RS, horário de assistência farmacêutica e número da Autorização de Funcionamento de Empresa (AFE / Licença Sanitária).

---

## 4. Infraestrutura e Hospedagem (Headers HTTP)

Os cabeçalhos de segurança completos foram configurados no repositório através dos arquivos:
- `_headers`: Pronto para Cloudflare Pages e Netlify com HSTS (`max-age=63072000; includeSubDomains; preload`), `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` restritiva e CSP separada para a loja e para o admin.
- `vercel.json`: Pronto para Vercel Edge com os mesmos cabeçalhos mapeados por rota.

Assegure que o serviço de hospedagem escolhido processe esses arquivos sem sobrescrevê-los.

---

## 5. Migrações e Scripts Operacionais do Supabase

### 5.1 Migrações a Aplicar no Supabase (Ordem Cronológica)
1. `supabase/migrations/20261104200000_security_hardening.sql`: Cria `admin_users`, blinda `is_admin()`, remove e-mail hardcoded e restringe RLS.
2. `supabase/migrations/20261104210000_product_richtext_options.sql`: Adiciona coluna `text_options JSONB` em `products`.
3. `supabase/migrations/20261105200000_data_safety_defaults.sql`: Elimina defaults perigosos (`allergen_info`, `quality_note`, `payment_info`), adiciona constraint `check_price_non_negative`, triggers de `updated_at` e isolamento de `site_settings`.

### 5.2 Script de Higiene de Caracteres Especiais no Banco
Se produtos foram cadastrados antes da correção do BUG-ESCAPE, rode:
```bash
node scripts/repair-escapes.mjs --dry-run
node scripts/repair-escapes.mjs
```
O script normaliza entidades HTML repetidas e grava `_v: 2` em `text_options`.

---

## 6. Validação Prévia de Produção

Antes de subir para produção, execute no terminal:
```bash
npm run verify:prod
```
O script verifica se restou algum `[PREENCHER: ...]` nos arquivos HTML públicos. A publicação só deve ocorrer quando todos os placeholders tiverem sido preenchidos com os dados reais do estabelecimento.

