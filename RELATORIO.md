# Relatório de Auditoria Corretiva — Botica Natural

**Escopo:** Auditoria corretiva completa (Segurança de Banco/RLS + Front-end Zero-XSS + Conformidade Regulatória ANVISA/LGPD + SEO Técnico + Performance/Manutenção + Verificação Automatizada).

---

## 1. Resumo do que foi corrigido por Fase

### Fase 1 — Segurança do Banco (Supabase/PostgreSQL) e Front-end
**Arquivos criados/alterados:**
- `supabase/migrations/20261104200000_security_hardening.sql` *(novo)*
- `supabase_full_schema.sql` *(schema de referência atualizado)*
- `js/supabaseClient.js`
- `js/product.js`
- `js/app.js`
- `js/admin.js`
- `PENDENCIAS.md` *(novo)*

**Correções aplicadas:**
1. **Eliminação de escalada de privilégio em `public.is_admin()`:**
   - Criada a tabela `public.admin_users (user_id uuid primary key references auth.users(id) on delete cascade, created_at timestamptz default now())` com RLS ativada e **sem policies de escrita** para `anon` ou `authenticated` (gerenciada exclusivamente via `service_role` / SQL Editor).
   - `public.is_admin()` reescrita como `SECURITY DEFINER`, `STABLE`, `SET search_path = public, auth`, consultando exclusivamente `EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())`. Removidos a leitura insegura de `user_metadata.role`, `app_metadata.role` e o e-mail pessoal hardcoded.
   - Aplicado `REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon` e `GRANT EXECUTE` apenas para `authenticated` e `service_role`.
   - Incluído bloco comentado de bootstrap para o proprietário cadastrar seu UID no SQL Editor imediatamente após rodar a migração.
2. **Endurecimento de Policies de Leitura Pública (RLS) e Storage:**
   - Em `products`, `categories` e `carousel_slides`: substituído `SELECT USING (true)` por policies segregadas por papel (`USING (is_active = true)` para `anon` e `USING (is_active = true OR public.is_admin())` para `authenticated`), impedindo a exposição de produtos/categorias/banners inativos via API REST ou `produto.html?id=`.
   - Em `site_settings`: leitura pública restrita por whitelist apenas à chave `'whatsapp_product_message_template'` (ou `public.is_admin()`).
   - Em `storage.objects` (`product-images`): removidas policies legadas permissivas (`_auth`) e e-mail hardcoded; escrita (`INSERT`, `UPDATE`, `DELETE`) restrita estritamente a `public.is_admin()`, e limite do bucket reduzido para **2 MB** (`2097152` bytes) aceitando apenas `image/webp`, `image/jpeg` e `image/png`.
   - Adicionadas constraints `CHECK` de higiene: `price >= 0`, `char_length(btrim(name)) BETWEEN 1 AND 200` (em `products` e `categories`) e whitelist de esquema em `carousel_slides.button_link`.
3. **Blindagem de Front-end:**
   - `js/product.js`: adicionado `.eq('is_active', true)` e `.maybeSingle()` na busca do produto (defesa em profundidade) e tratamento amigável de "Produto não encontrado".
   - `js/admin.js`: substituídas todas as atribuições a `.innerHTML` (incluindo a interpolação de `product.name` em `#whatsapp-scope-status` e os ícones de `#whatsapp-sync-badge`) por construção segura via DOM (`createElement`, `textContent`, `replaceChildren`). Zero `.innerHTML` restante em `js/`.
   - `js/app.js`: `sanitizeBannerLink()` reescrita com whitelist estrita via `new URL()`, aceitando apenas `https:`, `http:` ou caminhos relativos seguros e bloqueando `javascript:`, `data:`, `vbscript:` e URLs protocol-relative (`//`).
   - `js/supabaseClient.js`, `js/app.js`, `js/product.js`, `js/admin.js`: criada e aplicada `resolveSafeStorageImageUrl()`, garantindo que `image_url`/`image_path` vindos do banco só renderizem se o host pertencer exatamente ao Supabase Storage do projeto (`njdkuhgoophzjxmmempu.supabase.co/storage/v1/object/public/product-images/`).

---

### Fase 2 — Conteúdo Fictício e Conformidade (ANVISA & LGPD)
**Arquivos criados/alterados:**
- `privacidade.html` *(novo)*
- `index.html`
- `produtos.html`
- `produto.html`
- `js/main.js`
- `js/config.js` *(novo)*
- `PENDENCIAS.md`

**Correções aplicadas:**
1. **Remoção integral de dados fictícios e indicadores falsos:**
   - Removidos `aggregateRating` / `reviewCount` do JSON-LD, `"4,9 no Google"`, `"1.240 avaliações"`, `"+10 mil clientes"`, `"50.000+ fórmulas"`, `"26 anos"`, depoimentos inventados (`Mariana Silva`, `Juliana Costa`, `Carlos Eduardo`, `Ana Paula Ferreira`), CNPJ `00.000.000/0001-00`, `"Dr. João Silva – CRF-RS 12345"`, `"contato@boticanatural.com.br"`, `"Resposta média em 5 minutos"` e o indicador falso fixo `"Farmacêutico online agora"`.
   - Seção `#depoimentos` ocultada (`hidden` + comentário `<!-- TODO -->`) até haver avaliações reais verificadas.
   - Contadores animados em `js/main.js` (`initCounters`) ajustados para ler apenas valores numéricos reais do HTML e preservar intactos os placeholders `[PREENCHER: ...]`.
2. **Conformidade ANVISA (RDC 67/2007 e RDC 44/2009):**
   - `"Certificada ANVISA"` substituído por `"Licença Sanitária / AFE nº [PREENCHER: número da AFE/Licença]"`.
   - Marcados com `<!-- REVISAR COM RT: RDC 67/2007 e normas de publicidade da Anvisa -->` os pontos de exibição de preços de fórmulas manipuladas e textos promocionais de captação, listados em `PENDENCIAS.md` para validação formal do Farmacêutico Responsável Técnico.
3. **Conformidade LGPD:**
   - Criada `privacidade.html` com identificação do controlador, encarregado (DPO), bases legais (Art. 7º e Art. 11 da LGPD), direitos do titular e placeholders `[PREENCHER: ...]`.
   - Banner de cookies conectado a `privacidade.html` em todas as páginas públicas.
   - Em `js/main.js`, bloqueado qualquer envio de eventos para `dataLayer`/`gtag`/`fbq` antes do consentimento explícito (`hasCookieConsent()`).
4. **Padronização da Marca:**
   - Padronizada a constante `BRAND_NAME = "Botica Natural"` em `js/config.js` e em todas as páginas HTML.

---

### Fase 3 — SEO Técnico
**Arquivos criados/alterados:**
- `robots.txt` *(novo)*
- `sitemap.xml` *(novo)*
- `favicon.ico`, `images/favicon-32x32.png`, `images/apple-touch-icon.png`, `images/logo.png`, `images/og-image.jpg` *(novos)*
- `index.html`, `produtos.html`, `produto.html`, `privacidade.html`, `admin.html`
- `js/product.js`

**Correções aplicadas:**
1. **`robots.txt` e `sitemap.xml`:** criados permitindo rastreamento público, bloqueando `/admin.html` e referenciando as páginas estáticas canônicas.
2. **Favicons reais e Open Graph (`1200×630`):** gerados `favicon.ico`, `images/favicon-32x32.png`, `images/apple-touch-icon.png`, `images/logo.png` e `images/og-image.jpg` (`1200×630`) a partir dos assets reais da farmácia (`logo.jpg` e `fachada_botica_natural.jpg`), substituindo o favicon em emoji.
3. **SEO Dinâmico em `produto.html` (`js/product.js`):** ao carregar o produto, atualiza dinamicamente `<title>`, `<meta name="description">`, `<link rel="canonical">` (com `?id=`), `og:title`, `og:description`, `og:url`, `og:image` e injeta JSON-LD `Product` (omitindo `offers` automaticamente caso o preço seja `"Sob consulta"` / `<= 0`).
4. **Semântica de Headings e Acessibilidade:** garantido exatamente um único `<h1>` por página em todas as 5 páginas HTML, hierarquia lógica (`h1` → `h2` → `h3`) e atributos `alt` descritivos em todas as imagens.

---

### Fase 4 — Performance e Manutenção
**Arquivos criados/alterados:**
- Removidos: `images/hero-img.jpg`, `images/bg-lavender.jpg`, `images/icone-serum.jpg`, `images/icone-serum-cropped.jpg` (confirmado via grep zero referências em HTML/CSS/JS/SQL, reduzindo ~1,09 MB do repositório).
- Criados em WebP: `images/fachada_botica_natural.webp` (-72%), `images/icone-homeopatia-transparent.webp` (-95%), `images/icone-sache-transparent.webp` (-95%), `images/icone-serum-transparent.webp` (-96%), `images/icone-xarope-transparent.webp` (-95%), `images/logo.webp` (-38%).
- `js/config.js`, `js/supabaseClient.js`, `js/whatsapp.js`, `js/main.js`, `js/app.js`, `js/product.js`
- `index.html`, `produtos.html`, `produto.html`, `privacidade.html`, `admin.html`

**Correções aplicadas:**
1. **Imagens `<picture>` WebP com fallback:** aplicadas em `index.html`, `produtos.html`, `produto.html` e `privacidade.html` com `width`/`height` explícitos, `loading="lazy"` e `decoding="async"` (e `fetchpriority="high"` na imagem principal do LCP).
2. **Pinagem de versões de CDN e SRI:**
   - `@supabase/supabase-js` fixado em `@2.49.1/+esm` em `js/supabaseClient.js`.
   - `swiper` fixado em `@11.2.4` com `crossorigin="anonymous"`.
   - `font-awesome` fixado em `6.5.1` com hash SRI SHA-512 oficial (`integrity="sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA=="`) e `crossorigin="anonymous"`.
   - *Avaliação sobre Font Awesome vs. SVGs inline:* o projeto utiliza cerca de 28 ícones distintos (inclusive criados dinamicamente via classes JS em `app.js` e `admin.js`). Manter o CSS com SRI evita refatorar a renderização dinâmica de ícones no admin; em uma evolução futura de performance extrema, pode-se substituir por um sprite SVG único (`icons.svg#icon-name`), economizando ~70 KB de fonte externa.
3. **Configuração Centralizada e Cache-Busting Único:**
   - `js/config.js` centraliza `BRAND_NAME`, `SITE_DOMAIN`, `WHATSAPP_PHONE`, `ASSET_VERSION = '20261104'` e `LGPD_CONSENT_KEY`, sendo importado por `app.js`, `main.js`, `whatsapp.js` e `product.js`.
   - Removido o script inline `<script>document.documentElement.classList.add('js');</script>` do `<head>` das páginas (movido para o topo de `js/main.js`), permitindo uma política CSP `script-src` sem `'unsafe-inline'`.
4. **CSP via `<meta http-equiv>` e Fallback Resiliente do Supabase:**
   - Adicionada `<meta http-equiv="Content-Security-Policy" ...>` e `<meta name="referrer" content="strict-origin-when-cross-origin">` em todas as páginas HTML.
   - Em `js/app.js` e `produto.html`, falhas de conexão/consulta ao Supabase exibem mensagem amigável com botão CTA direto para o WhatsApp da farmácia, sem quebrar a página.

---

### Fase 5 — Verificação Automatizada e Testes de RLS
**Arquivos criados:**
- `scripts/verify.mjs` *(script Node.js zero-dependências)*
- `supabase/tests/rls_checks.sql` *(suíte de testes SQL para o Supabase)*

**Como validar:**
1. **Verificação estática automatizada (Node.js):**
   ```bash
   node scripts/verify.mjs
   ```
   Valida 39 checagens automatizadas (arquivos obrigatórios, remoção de imagens órfãs, número de WhatsApp único `555185543448`, ausência de todos os dados fictícios/hardcoded, integridade de caminhos locais em HTML/CSS/JS, sintaxe de JSON-LD, unicidade de `<h1>` e zero atribuições a `.innerHTML` em `js/`).
2. **Testes de RLS no Supabase:**
   Após aplicar `supabase/migrations/20261104200000_security_hardening.sql` no SQL Editor do Supabase, cole e execute `supabase/tests/rls_checks.sql` para validar em transação isolada (`BEGIN ... ROLLBACK`) os cenários (a), (b), (c) e (d).

---

## 2. Riscos Residuais e Headers HTTP no Servidor de Hospedagem

1. **Limitação de indexação de `produto.html?id=...` (Client-Side Rendering):**
   - Embora `js/product.js` atualize `<title>`, `meta description`, `canonical`, Open Graph e injete JSON-LD `Product` assim que o Supabase responde, crawlers que **não executam JavaScript** (como o scraper de pré-visualização do WhatsApp, Facebook/Instagram, LinkedIn e alguns bots secundários) verão apenas as meta tags estáticas iniciais de `produto.html`. O Googlebot executa JavaScript (WRS), mas com atraso na fila de renderização e menor eficiência de crawl budget para URLs parametrizadas (`?id=`). Veja a seção 3 abaixo para a solução definitiva.
2. **Headers HTTP de Segurança no Host (Vercel / Netlify / Cloudflare / Nginx):**
   - A tag `<meta http-equiv="Content-Security-Policy">` protege contra XSS no navegador, mas **não substitui** cabeçalhos exclusivos de camada HTTP como `Strict-Transport-Security (HSTS)`, `X-Frame-Options` / `frame-ancestors`, `X-Content-Type-Options: nosniff` e `Permissions-Policy`.
   - Recomenda-se configurar no servidor/CDN os seguintes headers de resposta HTTP:
     ```http
     Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
     X-Content-Type-Options: nosniff
     X-Frame-Options: DENY
     Referrer-Policy: strict-origin-when-cross-origin
     Permissions-Policy: camera=(), microphone=(), geolocation=()
     ```

---

## 3. Proposta Técnica: Pré-renderização Estática por Produto (SSG Leve via Script Node)

### 3.1. Problema Atual
Atualmente, todas as fórmulas compartilham um único arquivo `produto.html?id=<uuid>` renderizado no navegador via `fetch` ao Supabase. Isso traz duas limitações:
1. **Compartilhamento Social (WhatsApp / Instagram):** quando um cliente ou atendente envia o link `https://www.boticanatural.com.br/produto.html?id=...` no WhatsApp, o robô do WhatsApp não executa JavaScript; portanto, o card de preview mostra a imagem e o título genéricos da loja em vez da foto, nome e descrição daquela fórmula específica.
2. **SEO de Cauda Longa:** URLs semânticas com slug (`/produtos/magno-6/index.html`) têm CTR orgânico e indexação significativamente superiores a URLs com query string UUID (`produto.html?id=...`).

### 3.2. Arquitetura Proposta (Sem Frameworks Pesados)
Criar um script Node.js zero-dependências (`scripts/prerender-products.mjs`, usando `fetch` nativo do Node 20+) executado no deploy (CI/CD da Vercel/Netlify/GitHub Actions ou via webhook do Supabase quando um produto é salvo no Admin):

1. **Leitura do Supabase:** o script consulta `GET /rest/v1/products?is_active=eq.true&select=*,categories(name,slug)` usando a `SUPABASE_URL` e `SUPABASE_ANON_KEY`.
2. **Geração de Slug Semântico:** para cada produto ativo, gera um slug limpo (ex.: `magno-6`) — ou lê uma coluna `slug` adicionada à tabela `public.products`.
3. **Injeção no Template `produto.html`:** para cada produto, gera `/produtos/<slug>/index.html` com:
   - `<title>`, `<meta name="description">`, `<link rel="canonical">`, `<meta property="og:title">`, `<meta property="og:description">`, `<meta property="og:image">` e `<script type="application/ld+json">` **já preenchidos estaticamente no HTML**.
   - O HTML principal (`#pdp-title`, `#pdp-short-desc`, `#pdp-main-img`, `#pdp-desc-full`, link do WhatsApp) já pré-renderizado no DOM, eliminando o skeleton loading inicial.
4. **Atualização Automática do `sitemap.xml`:** o mesmo script regenera `sitemap.xml` incluindo todas as URLs `/produtos/<slug>` com `<lastmod>` igual a `product.updated_at`.
5. **Compatibilidade Retroativa:** `produto.html?id=<uuid>` permanece funcionando como fallback dinâmico para produtos recém-criados antes do próximo build.

### 3.3. Prós e Contras

| Critério | Prós da Pré-renderização Estática | Contras / Trade-offs |
|---|---|---|
| **SEO & Indexação Google** | Indexação instantânea na primeira passagem do crawler (HTML completo sem depender de fila de JS). URLs amigáveis (`/produtos/nome-da-formula`). | Exige rodar o script de build sempre que um produto for criado, editado ou desativado no painel Admin (ou configurar um Deploy Hook no Supabase). |
| **Preview no WhatsApp / Redes Sociais** | O link enviado no WhatsApp exibe imediatamente a foto real do frasco, o nome e o resumo daquela fórmula específica. | Pequeno atraso ( ~30 a 60 segundos de deploy estático) entre salvar uma alteração no `admin.html` e o HTML estático atualizar no CDN. |
| **Performance (LCP / TTFB)** | LCP quase instantâneo: o navegador já recebe o texto e a URL da imagem no documento HTML inicial, sem esperar o round-trip ao Supabase. | Adiciona uma etapa leve de pós-processamento (`node scripts/prerender-products.mjs`) no pipeline de hospedagem. |
| **Resiliência (Uptime)** | Mesmo que o Supabase passe por manutenção temporária, todas as páginas de produtos continuam 100% no ar e convertendo para o WhatsApp. | Requer adicionar coluna `slug` única em `public.products` e redirecionar slugs antigos caso o nome do produto mude. |

---

## 4. Refatoração do Painel Administrativo, Editor Rico e Live Preview

### 4.1. Arquitetura Modular e Design System (Fase 1)
- **Módulos ES6+ (`js/admin/*` e `js/shared/*`)**:
  - `js/admin/main.js`: bootstrap, preferências de shell, guardião de formulários com alterações não salvas (`beforeunload` + `hashchange`) e roteador por hash (`#/`, `#/produtos`, `#/produtos/novo`, `#/produtos/:id`, `#/banners`, `#/categorias`, `#/whatsapp`).
  - `js/admin/state.js`: estado reativo com `subscribe`, persistência de tema claro/escuro (`localStorage` + `prefers-color-scheme`) e colapso da sidebar.
  - `js/admin/api.js`: camada de dados usando o singleton `supabaseClient.js`, cache em memória com invalidação automática em escritas, compressão de imagens `<canvas>` para WebP (`<= 2 MB`), ações em massa (ativar/desativar selecionados), duplicação de produto e reordenação de banners.
  - `js/admin/auth.js`: login/logout e verificação server-side via `supabase.rpc('is_admin')`.
  - `js/admin/ui.js`: construtor DOM seguro (`el()`), toasts empilháveis (`aria-live="polite"`), diálogo de confirmação nativo `<dialog>` e estados vazios ilustrados.
  - `js/admin/views/*`: views isoladas para Dashboard (`dashboard.js`), Listagem de Produtos (`products.js`), Formulário Dedicado de Produto (`productForm.js`), Categorias (`categories.js`), Banners com Drag-and-Drop e setas acessíveis (`banners.js`) e WhatsApp (`whatsapp.js`).
- **Folha de Estilos Enxuta (`css/admin.css`)**:
  - Reduzida de ~45 KB para ~28 KB com Design Tokens semânticos, suporte completo a tema claro/escuro, `prefers-reduced-motion` e tabela responsiva que se transforma em cartões no mobile (`< 768px`).

### 4.2. Editor de Texto Rico e Sanitização Estrita (Fase 2)
- **Editor Próprio Acessível (`js/admin/editor.js`)**:
  - Aplicado aos 8 campos descritivos do produto (`short_description`, `description`, `usage_instructions`, `composition`, `package_info`, `allergen_info`, `quality_note`, `payment_info`).
  - Toolbar acessível (`role="toolbar"`, `aria-pressed`, navegação por setas `ArrowLeft`/`ArrowRight`) com negrito (`Ctrl+B`), itálico (`Ctrl+I`), sublinhado (`Ctrl+U`), tachado, listas (`ul`/`ol`), citação (`blockquote`), subtítulos (`h3`/`h4`), link seguro (`https:`, `http:`, `mailto:`, `tel:`), limpar formatação e histórico próprio de desfazer/refazer (`Ctrl+Z`/`Ctrl+Y`).
  - Seletor **"Modo do texto"** por campo (`paragraphs`, `lines`, `inline`) persistido na coluna `products.text_options` (`jsonb`) criada pela migração `supabase/migrations/20261104210000_product_richtext_options.sql`.
- **Sanitizador Compartilhado (`js/shared/richtext.js`)**:
  - Whitelist estrita (`p, br, strong, em, u, s, ul, ol, li, h3, h4, blockquote, a`), remoção de todos os atributos exceto `href`, `target="_blank"` e `rel="noopener noreferrer"` em `<a>`, conversão retrocompatível de textos antigos em texto puro (`\n`) e construção direta de nós DOM via `renderSanitizedRichText()` (zero uso de `innerHTML`).

### 4.3. Pré-visualização em Tempo Real da Página de Produto (Fase 3)
- **Renderizador Compartilhado (`js/shared/productRenderer.js`)**:
  - Extraído de `js/product.js` e compartilhado entre a loja pública e o modo `produto.html?preview=1`.
- **Comunicação Segura por `postMessage` (`js/admin/preview.js`)**:
  - Atualização ao vivo com debounce de 150 ms conforme o administrador digita ou seleciona uma nova foto (`URL.createObjectURL`), alternador de largura de tela (`375px`, `768px`, `1280px`), modo tela cheia e scroll/destaque automático da seção correspondente (`[data-field="..."]`) ao focar em qualquer campo do formulário.

### 4.4. Testes e Validação (Fase 5)
- `node scripts/test-richtext.mjs`: 18/18 testes aprovados contra vetores de XSS e retrocompatibilidade de texto puro.
- `node scripts/verify.mjs`: 42/42 verificações aprovadas (integridade de referências, JSON-LD, unicidade de `<h1>`, consistência de WhatsApp e zero `innerHTML`).


