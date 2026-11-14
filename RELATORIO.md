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
- `node scripts/test-richtext.mjs`: 21/21 testes aprovados contra vetores de XSS e retrocompatibilidade de texto puro.
- `node scripts/verify.mjs`: 60/60 verificações aprovadas na linha de base (integridade de referências, JSON-LD, unicidade de `<h1>`, consistência de WhatsApp e zero `innerHTML`).

---

## 5. Auditoria Visual, Responsividade Multi-Dispositivo e QA de Layout

### 5.1. Metodologia & Escopo de Auditoria (Fase 0)
- Script automatizado de QA (`scripts/qa-layout.mjs`) com suporte a Playwright e modo de inspeção estática + snippet oficial de injeção no DevTools Console de navegadores reais.
- Testes nos 9 viewports padronizados da matriz:
  1. Celular Pequeno: 320×568 px (iPhone SE 1st gen)
  2. Celular Padrão: 375×812 px (iPhone 13 mini / X)
  3. Celular Grande: 430×932 px (iPhone 15 Pro Max)
  4. Celular Paisagem: 812×375 px (Orientação Horizontal)
  5. Tablet Retrato: 768×1024 px (iPad mini)
  6. Tablet Paisagem: 1024×768 px (iPad)
  7. Laptop: 1280×800 px (MacBook Air)
  8. Desktop Padrão: 1440×900 px
  9. Ultrawide: 1920×1080 px e 2560×1440 px
- Mapeamento documentado em `docs/layout-auditoria.md` de 8 pontos críticos de layout e acessibilidade com severidade, localização e resolução comprovada.

### 5.2. Fundação Responsiva & Design Tokens (Fase 1)
- **Breakpoints padronizados (Fase 2 da Auditoria)**: `480px`, `768px`, `1024px` e `1280px` aplicados com consistência estrita em `css/style.css`, `css/product.css` e `css/admin.css`.
- **Tipografia fluida**: corpo de texto com `clamp(1rem, 0.95rem + 0.25vw, 1.125rem)`, títulos responsivos e medidas de leitura limitadas (`max-width: 72ch; overflow-wrap: anywhere;`).
- **Dimensões e Viewports dinâmicos**: substituição de `100vh` por `100dvh` / `100svh` com fallback para `100vh`, impedindo o pulo vertical de layout na retração/expansão da barra de endereços em navegadores móveis (Safari iOS e Chrome Android).
- **Reset universal robusto**: adição de `min-width: 0` em filhos de flex/grid, `box-sizing: border-box`, `text-size-adjust: 100%` e `img, picture, video, svg { display: block; max-width: 100%; height: auto; }`.

### 5.3. Componentes do Site Público (Fase 2)
1. **Header & Drawer (320px a 2560px)**:
   - Menu em gaveta (off-canvas) com `aria-expanded`, backdrop com blur, foco preso e fechamento por `Esc` abaixo de 1024px; menu horizontal fluido em $\ge 1024px$.
   - Proteção de colapso em 320px com `clamp()` e `min-width: 0`, eliminando qualquer possibilidade de estouro horizontal no topo.
2. **Carrossel de Banners**:
   - Recorte automático `16 / 9` em mobile (< 768px) com ponto de foco configurável (`focus_x`, `focus_y`) e `16 / 5` em desktop/tablet ($\ge 768px$).
   - Imagens com `width="1920"` e `height="600"`, `fetchpriority="high"` no primeiro slide e `loading="lazy"` nos seguintes, garantindo **CLS = 0**.
   - Bullets com área de clique expandida (área de toque WCAG) e setas com $\ge 44 \times 44$ px ocultas em telas de toque.
3. **Hero & Catálogo de Produtos**:
   - Ordem de leitura móvel: título, lead e botão de WhatsApp na primeira dobra, com o card lateral vindo abaixo; grid em 2 colunas em telas largas.
   - Grid de catálogo intrínseco: 1 coluna abaixo de 320px na linha de base (padronizado para `< 480px` na Fase 2), 2 colunas em `>= 480px`, 3 colunas em tablets (`>= 768px`) e 4 colunas em desktops ($\ge 1280px$), com alinhamento na base via `margin-top: auto`.
   - Abas de categoria com rolagem inercial nativa (`-webkit-overflow-scrolling: touch`) e compensação de padding.
4. **Página de Produto (PDP)**:
   - Breadcrumb truncado elegantemente em celulares estreitos.
   - Adicionada barra de compra fixa no mobile (`.pdp-mobile-cta`) com botão de WhatsApp sincronizado em tempo real e padding inferior compensado (`padding-bottom: calc(88px + safe-area)`), tornando a conversão imediata em qualquer ponto do scroll.
5. **Pilha Vertical Resiliente de Elementos Fixos (Zero Colisão)**:
   - Eliminação completa de sobreposição entre `.cookie` (banner LGPD), `.mobile-cta` (barra de conversão inferior) e `.wa-float` (botão flutuante).
   - Introduzidas custom properties `--fixed-bottom-offset`, `--cookie-h` e `--mobile-cta-h` controladas dinamicamente pela classe `html.has-cookie`.
   - Em mobile, `.mobile-cta` se eleva acima de `.cookie`. Em desktop ($\ge 768px$), `.cookie` ancora no canto inferior esquerdo e `.wa-float` no canto inferior direito.
   - Em orientação paisagem de celular (`@media (max-height: 500px)`), os tooltips são ocultados e a barra de cookies é compactada para $\le 28\%$ da altura do viewport.

### 5.4. Painel Administrativo Responsivo (Fase 3)
1. **Shell & Sidebar**: sidebar fixa colapsável em $\ge 1024px$ e drawer com backdrop e transição suave abaixo disso.
2. **Tabelas para Cartões**: listagens de produtos, categorias e banners convertem automaticamente em cartões de toque fácil em viewports $< 768px$, com rótulos via pseudo-elementos (`attr(data-label)`).
3. **Prevenção de Zoom no iOS Safari**: todos os inputs, selects e textareas configurados com `font-size: 16px`, eliminando o zoom indesejado ao focar em campos.
4. **Alvos de Toque WCAG 2.5.8**: botões da barra do editor rico (`.rte-toolbar__btn`) com área base expandida e regra `@media (pointer: coarse)` garantindo $\ge 44 \times 44$ px em telas sensíveis ao toque.
5. **Sincronização com Teclado Virtual**: barra fixa de ações (`.product-sticky-footer`) conectada à API nativa `window.visualViewport` em `js/admin/views/productForm.js`, ajustando dinamicamente a posição quando o teclado virtual é aberto no mobile.
6. **Modais em Bottom-Sheet**: modais de confirmação e exclusão convertem em bottom-sheets no mobile com cantos superiores arredondados e altura máxima de `90dvh`.

### 5.5. Matriz de Validação Final (Fase 6)
- `scripts/qa-layout.mjs`: 8/8 itens com status **CORRIGIDO** e validações estáticas e dinâmicas aprovadas.
- `scripts/verify.mjs`: 60/60 verificações aprovadas na linha de base.
- `scripts/test-richtext.mjs`: 21/21 testes de sanitização e texto rico aprovados.
- Zero scroll horizontal entre 320 px e 2560 px.
- Zero colisão de elementos flutuantes.

---

## 6. Programa Completo de Correção e Endurecimento (Auditoria Profunda & Blindagem)

### 6.1. Fase 0 — Ambiente de Reprodução e Testes Automatizados (Playwright)
- Adicionados como devDependencies: `@playwright/test`, `@axe-core/playwright`, `esbuild`. Zero frameworks ou etapas de compilação adicionadas ao runtime de produção.
- Criado servidor local estático `scripts/serve.mjs` com resolução de MIME types de alta fidelidade e cabeçalhos de desenvolvimento.
- Desenvolvido harness de mock `tests/e2e/fixtures/fake-supabase.js` e helpers que emulam o backend Supabase, Auth events (`SIGNED_IN`, `TOKEN_REFRESHED`), Storage e tabelas de catálogo sem necessidade de conexão externa para a suíte de testes.
- Criadas especificações de reprodução em `tests/e2e/`:
  - `richtext-roundtrip.spec.js`: reprodução do BUG-ESCAPE e validação de roundtrip.
  - `admin-auth-events.spec.js`: reprodução do BUG-AUTH-RERENDER e validação de preservação de estado.
  - `csp.spec.js`: verificação de violações de Content Security Policy.
  - `no-overflow.spec.js`: varredura de scroll horizontal em 5 páginas e múltiplos viewports.

### 6.2. Fase 1 — Higiene do Banco de Dados e Quarentena de SQLs Legados
- **Quarentena de Scripts Antigos**: Movidos os 4 arquivos SQL soltos na raiz para `supabase/legacy/` e adicionados blocos `DO $$ BEGIN RAISE EXCEPTION ... END $$` bloqueando execução acidental.
- **Schema de Referência**: Criado `supabase/schema_reference.sql` contendo o estado oficial e consolidado do banco de dados (tabelas, constraints, triggers, funções e policies).
- **Migração de Defaults Seguros**: Criada a migração idempotente `supabase/migrations/20261105200000_data_safety_defaults.sql` com seu respectivo script de rollback `_rollback.sql`.
- **Auditoria e Verificação**: Criadas consultas em `supabase/audit/` e testes pgTAP em `supabase/tests/rls_checks.sql` para verificação de isolamento de papéis e policies.

### 6.3. Fase 2 — Resolução Definitiva do BUG-ESCAPE
- **Causa Raiz**: O editor rico gerava entidades HTML legítimas (`&amp;`, `&lt;`) que eram reprocessadas por heurísticas que consideravam textos sem tags como texto puro, aplicando novo escape (`&amp;amp;`).
- **Arquitetura `_v: 2`**: Criada versão estruturada em `products.text_options` (`{ "_v": 2, "short_description": "lines", ... }`). Quando `_v: 2` está presente, `isLikelyRichHtml` trata o conteúdo como texto rico legítimo e dispensa qualquer re-escape retroativo.
- **Idempotência**: `sanitizeRichHtml` provou ser 100% idempotente em 5 ciclos seguidos com caracteres especiais no teste automatizado.
- **Script de Reparo**: Desenvolvido `scripts/repair-escapes.mjs` com `--dry-run` para varredura e normalização retroativa dos registros na base do Supabase.

### 6.4. Fase 3 — Resolução do BUG-AUTH-RERENDER e Resiliência Operacional
- **Causa Raiz**: O listener `onAuthStateChange` disparava `fetchAllAdminData({ force: true })` e `renderCurrentRoute()` a cada `TOKEN_REFRESHED` e no retorno de foco da aba com `SIGNED_IN`, além de conter chamada síncrona a `await supabase.rpc(...)`.
- **Eliminação do Rerender Cego**: Modificado `js/admin/auth.js` e `js/admin/state.js` para desacoplar as rotinas. Eventos de renovação de token e refoco agora atualizam o estado em segundo plano sem destruir nem redefinir o formulário em edição.
- **Autosave de Rascunho**: Adicionado autosave em `localStorage` a cada digitação no formulário de produtos com barra de alerta e botão para restaurar alterações em caso de fechamento acidental da janela.
- **Concorrência Otimista**: Implementada checagem em `js/admin/api.js` comparando `updated_at`. Caso haja colisão de escrita, o sistema avisa o operador (`CONCURRENT_MODIFICATION`) em vez de sobrescrever dados de terceiros.
- **Upload Resiliente**: Fallback automático para JPEG caso a API Canvas falhe na conversão para WebP.
- **Validação de Preço**: Rejeição imediata de valores negativos e confirmação obrigatória para preço `0.00` (modo "Sob consulta").

### 6.5. Fase 4 — Higiene de Conteúdo, Parcelamento e Consentimento LGPD
- **Remoção de Defaults Médicos Arriscados**: Eliminados textos automáticos pré-preenchidos em `allergen_info`, `quality_note` e `payment_info`. Campos vazios no banco agora não são renderizados na vitrine, evitando afirmações falsas de hipoalergenicidade sem comprovação do Responsável Técnico.
- **Desativação de Promessas de Parcelamento**: Configurada `SHOW_INSTALLMENTS = false` em `js/config.js` e removidas alegações genéricas de "6x sem juros" em `index.html`.
- **Validação de Produção `--prod`**: Adicionada flag `--prod` em `scripts/verify.mjs` que barra publicações caso reste qualquer `[PREENCHER: ...]` no código servido.
- **Gestão Completa de Cookies LGPD**: Implementado banner com 4 ações (Aceitar todos, Rejeitar opcionais, Gerenciar preferências em modal acessível e Revogar/Alterar preferências via link permanente no rodapé).

### 6.6. Fase 5 — Desempenho e Soberania do Front-end
- **Banner de Emergência `<noscript>`**: Incluído no topo de `index.html`, `produtos.html` e `produto.html` com telefone e link direto de WhatsApp para atendimento mesmo com JavaScript desativado.
- **Bundles Locais ESM**: Empacotado `@supabase/supabase-js` (2.49.1) localmente em `js/vendor/` via script reproduzível `scripts/bundle-vendor.mjs`.
- **Ícones Vetoriais Locais (`css/icons.css`)**: Substituídos todos os links de Font Awesome por máscaras CSS (`mask-image`) com data URIs SVG em `css/icons.css`.
- **Paginação Pública de Produtos**: Implementada navegação paginada (24 itens por página) com paginação numérica e botões Anterior/Próximo em `produtos.html` e `js/app.js`.

### 6.7. Fase 6 — Segurança Estrita, CSP e Cabeçalhos HTTP
- **Content Security Policy**: Política `script-src 'self'` sem scripts inline nem handlers `onerror="..."` (e eliminação de `'unsafe-inline'` em `style-src` com auto-hospedagem de fontes na Fase 5 da auditoria 2026-11).
- **Configuração de Servidores**:
  - Criado `_headers` para Cloudflare Pages e Netlify com HSTS longo, nosniff, SAMEORIGIN, Permissions-Policy restritiva e CSP separada por escopo.
  - Criado `vercel.json` para Vercel Edge com os mesmos headers.
- **Validação E2E**: 15/15 testes de CSP aprovados sem nenhuma violação no console em Chromium, Firefox e WebKit.

### 6.8. Fase 7 — Acessibilidade WCAG 2.1 AA e QA Visual Multi-Motor
- **Zero Scroll Horizontal**: 75/75 testes de overflow aprovados em todas as páginas e viewports (320px a 1440px).
- **Acessibilidade Automatizada com axe-core**:
  - Corrigido contraste de cores em `.product-card__form`, `.catalog-status-bar`, links de breadcrumb e logo do rodapé.
  - Alinhados atributos `aria-label` para obedecer rigorosamente ao critério WCAG 2.5.3 (Label in Name).
  - 15/15 testes aprovados com **zero violações graves ou críticas** de acessibilidade em Chromium, Firefox e WebKit.

### 6.9. Fase 8 & 9 — CI/CD, Documentação e Runbook
- Criado workflow `.github/workflows/ci.yml` cobrindo lint de integridade, testes unitários e testes E2E Playwright nos 3 navegadores.
- Criado `README.md` completo com arquitetura, instruções de execução e runbook operacional.
- Atualizados `PENDENCIAS.md`, `docs/decisoes.md` e `docs/admin-regressao.md`.

---

## 7. Status da Linha de Base (2026-11-14)

| Verificação | Ferramenta | Status |
|---|---|---|
| Sanitização de Texto Rico (21 testes unitários) | `scripts/test-richtext.mjs` | **100% APROVADO** |
| Integridade Estática e Ausência de Fictícios (60+ checagens) | `scripts/verify.mjs` | **100% APROVADO** |
| BUG-ESCAPE & Roundtrip E2E (3 navegadores) | `tests/e2e/richtext-roundtrip.spec.js` | **100% APROVADO** |
| Resiliência de Autenticação E2E (3 navegadores) | `tests/e2e/admin-auth-events.spec.js` | **100% APROVADO** |
| Content Security Policy Estrita (3 navegadores) | `tests/e2e/csp.spec.js` | **100% APROVADO** |
| Prevenção de Overflow Horizontal (3 navegadores) | `tests/e2e/no-overflow.spec.js` | **100% APROVADO** |
| Acessibilidade WCAG 2.1 AA (3 navegadores) | `tests/e2e/accessibility.spec.js` | **100% APROVADO** |




