# Registro de Decisões Técnicas (ADR) — Painel Administrativo, Rich Text e Live Preview

## 1. Escolha do Editor de Texto Rico (Fase 2)

### Contexto
O projeto exige um editor de texto rico nos campos descritivos do produto (`short_description`, `description`, `usage_instructions`, `composition`, `package_info`, `allergen_info`, `quality_note`, `payment_info`), operando em HTML/CSS/JS puro (ES modules), sem etapa de build, sem frameworks e com segurança estrita contra XSS.

### Alternativas Avaliadas
1. **Quill / TinyMCE / CKEditor via CDN**:
   - *Desvantagens*: Bundles pesados (150 KB a 600 KB+), folhas de estilo externas que conflitam com o Design System e modo escuro, modelos de dados proprietários ou dependências complexas, além de superfície extra de supply-chain.
2. **Trix via CDN**:
   - *Desvantagens*: Não suporta nativamente múltiplos níveis de cabeçalho (`h3`/`h4`) nem controle granular dos modos de texto (`paragraphs`, `lines`, `inline`) sem hacks no modelo interno.
3. **Implementação Própria Enxuta (`js/admin/editor.js` + `js/shared/richtext.js`)**:
   - *Vantagens*: Zero dependências externas (0 KB de bibliotecas de terceiros), integração nativa com os tokens CSS do painel (incluindo dark mode), controle absoluto sobre o DOM gerado, suporte nativo aos três modos de texto (`paragraphs`, `lines`, `inline`), colagem limpa (`paste` interceptado e passado diretamente pelo sanitizador AST) e acessibilidade WAI-ARIA completa (`role="toolbar"`, `aria-pressed`, navegação por setas `ArrowLeft`/`ArrowRight` na toolbar).

### Decisão
Adotamos a **Implementação Própria Enxuta** em `js/admin/editor.js` apoiada pelo sanitizador compartilhado `js/shared/richtext.js`.
- As operações de formatação são encapsuladas em um adaptador interno único (`applyEditorCommand`), isolando `Selection`/`Range` e comandos de edição em um único ponto do código e mantendo histórico próprio de `undo`/`redo` por instância.
- Toda saída (`getValue()`) e toda entrada (`setValue()`, evento `paste`) passam obrigatoriamente por `sanitizeRichText(html, { mode })`.

---

## 2. Arquitetura do Sanitizador HTML (`js/shared/richtext.js`)

### Decisão
- **Whitelist Estrita de Tags**: `p`, `br`, `strong`, `em`, `u`, `s`, `ul`, `ol`, `li`, `h3`, `h4`, `blockquote`, `a`.
- **Normalização Semântica**: `<b>` é convertido em `<strong>` e `<i>` é convertido em `<em>`. Tags como `<script>`, `<style>`, `<iframe>`, `<object>`, `<embed>`, `<svg>`, `<math>`, `<form>`, `<input>`, `<img>` são integralmente removidas junto com seu conteúdo perigoso; elementos de agrupamento não listados (`div`, `span`, `font`, `section`) são desenrolados (*unwrapped*) preservando apenas seus filhos válidos.
- **Atributos e Links**: Nenhum atributo é permitido em nenhuma tag (`style`, `class`, `id`, `on*`, `data-*`, `srcdoc` são todos descartados), exceto `href`, `target` e `rel` em `<a>`. O `href` é validado para aceitar apenas esquemas `https:`, `http:`, `mailto:`, `tel:` ou caminhos relativos seguros (`/`, `#`), bloqueando `javascript:`, `data:`, `vbscript:` (mesmo com entidades HTML, espaços de controle ou maiúsculas/minúsculas). Todo `<a>` válido recebe `rel="noopener noreferrer"` e, para links externos (`http:`/`https:`), `target="_blank"`.
- **Retrocompatibilidade Automática**: Textos legados salvos no banco sem tags HTML da whitelist são detectados como texto puro, têm caracteres especiais escapados e suas quebras `\n` são convertidas conforme o modo do campo (`\n\n` → `<p>` e `\n` → `<br>` em `paragraphs`; `\n` → `<br>` em `lines`; espaço em `inline`).
- **Compatibilidade Browser + Node.js**: No navegador, utiliza `DOMParser` nativo e constrói nós DOM reais via `document.createElement`/`document.createTextNode` (`renderSanitizedRichText`), eliminando o uso de `innerHTML` não confiável. Em ambiente Node.js (para a suíte automatizada `scripts/test-richtext.mjs`), inclui um parser tokenizador puro sem dependências externas que aplica exatamente a mesma árvore de regras.

---

## 3. Persistência do Modo de Texto (`products.text_options`)

### Decisão
Adicionada a coluna `text_options JSONB NOT NULL DEFAULT '{}'::jsonb` na tabela `public.products` via migração idempotente (`supabase/migrations/20261104210000_product_richtext_options.sql`).
- Armazena um mapa `{ "<campo>": "paragraphs" | "lines" | "inline" }`, por exemplo:
  ```json
  {
    "short_description": "lines",
    "description": "paragraphs",
    "payment_info": "inline"
  }
  ```
- Caso o banco ainda não tenha executado a migração, o módulo `js/admin/api.js` faz fallback gracioso salvando os demais campos do produto sem interromper o trabalho do administrador.

---

## 4. Pré-visualização em Tempo Real (`produto.html?preview=1` + `js/shared/productRenderer.js`)

### Decisão
- A lógica de renderização da página de produto foi extraída de `js/product.js` para `js/shared/productRenderer.js` (`renderProduct(container, productData, options)`), garantindo fidelidade visual de 100% entre o preview no painel e a vitrine pública.
- O painel carrega `<iframe src="produto.html?preview=1">`. Quando `preview=1` está presente:
  1. `js/product.js` não consulta o Supabase e garante `<meta name="robots" content="noindex, nofollow">`.
  2. O iframe aceita mensagens `postMessage` exclusivamente quando `event.origin === window.location.origin` e `event.source === window.parent`.
  3. Ao focar em um campo do formulário no admin, o preview faz scroll suave até `[data-field="<nome>"]` e aplica um contorno sutil temporário.

---

## 5. Eliminação do BUG-ESCAPE e Versionamento de Conteúdo (`_v: 2`)

### Contexto
Digitar caracteres especiais como `Dose A & B < 5 mg` causava o acúmulo de entidades HTML (`&amp;amp;` e `&amp;lt;`) porque textos ricos sem tags HTML eram classificados incorretamente como texto puro legado e re-escapados a cada ciclo de salvamento ou renderização.

### Decisão
1. **Versionamento Explícito**: Introduzida a chave `_v: 2` em `products.text_options`. Se `_v >= 2`, o conteúdo foi serializado pelo editor rico moderno e nunca deve sofrer heurísticas legadas de escape duplicado.
2. **Heurística de Detecção Confiável**: A função `isLikelyRichHtml` passou a verificar a presença de tags HTML semânticas da whitelist ou marcação explícita de parágrafos/quebras.
3. **Idempotência**: `sanitizeRichHtml` e `legacyPlainTextToHtml` foram testados e garantidos como idempotentes em 5 ciclos contínuos de salvamento/leitura.
4. **Script de Reparo**: Criado `scripts/repair-escapes.mjs` com suporte a `--dry-run` para normalizar registros legados no Supabase.

---

## 6. Prevenção do BUG-AUTH-RERENDER e Proteção contra Perda de Trabalho

### Contexto
Eventos frequentes da biblioteca do Supabase (`TOKEN_REFRESHED` a cada 60 min e `SIGNED_IN` ao focar na aba) disparavam `fetchAllAdminData({ force: true })` e `renderCurrentRoute()`, limpando o formulário de edição em silêncio e executando RPC síncrono dentro do listener de autenticação.

### Decisão
1. **Desacoplamento do Listener de Auth**: Chamadas assíncronas `supabase.rpc('is_admin')` e recarregamentos de rota foram removidos do corpo direto de `onAuthStateChange`.
2. **Ignorar Eventos Silenciosos**: Eventos de renovação de token e refoco de aba não re-renderizam a rota ativa se o usuário já estiver autenticado e com permissão validada.
3. **Autosave de Rascunho em LocalStorage**: A cada digitação no formulário de produto, um rascunho com timestamp é gravado no storage local. Se a aba for fechada acidentalmente ou atualizada, uma barra de recuperação de rascunho é exibida ao retornar.

---

## 7. Proteção contra Edições Concorrentes e Upload Resiliente

### Decisão
1. **Detecção de Concorrência Otimista**: Ao atualizar um produto (`updateProduct`), o módulo `js/admin/api.js` valida o campo `updated_at`. Caso outro operador tenha modificado o registro entre a abertura e a gravação, a operação é rejeitada com erro `CONCURRENT_MODIFICATION`, permitindo ao usuário mesclar ou revisar os dados antes de sobrescrever.
2. **Upload com Fallback Gracioso**: Caso o navegador ou dispositivo falhe na conversão de imagem para WebP via Canvas (ex.: restrições de memória em dispositivos móveis legados), o pipeline realiza fallback automático para JPEG comprimido com qualidade balanceada.

---

## 8. Eliminação Total de Dependências de CDNs Externos

### Decisão
1. **Bundles Locais ESM**: `scripts/bundle-vendor.mjs` gera versão local e fixada de `@supabase/supabase-js` (2.49.1) em `js/vendor/`.
2. **Ícones via Máscaras CSS SVG Locais**: Font Awesome foi descontinuado em favor da folha de estilos `css/icons.css` gerada por `scripts/build-icons-sprite.mjs` utilizando `mask-image` com data URIs SVG locais.
3. **CSP sem CDNs de Script**: `script-src` das páginas públicas e do admin aponta exclusivamente para `'self'`, sem permissões para `cdn.jsdelivr.net` ou `cdnjs.cloudflare.com` (com auto-hospedagem de fontes e `style-src 'self'` concluídos na Fase 5).

---

## 9. Conformidade com a LGPD e Privacidade

### Decisão
1. **Consentimento Granular com 4 Ações**: O banner LGPD oferece Aceitar todos, Rejeitar opcionais e Gerenciar preferências (essenciais vs. analíticos/comunicação), além de um link permanente no rodapé de todas as páginas para alterar ou revogar consentimento a qualquer momento.
2. **Versionamento e Timestamp**: O consentimento é registrado em `localStorage` no formato `{ v: 1, ts: <timestamp>, choices: { analytics: boolean, marketing: boolean } }`.
3. **Página de Privacidade Transparente**: `privacidade.html` detalha a finalidade do processamento dos dados em conformidade com as diretrizes da ANPD e da Anvisa.

---

## 10. Padronização Mobile-First de Breakpoints Responsivos (MED-07 / Fase 2)

### Contexto
As folhas de estilo (`css/style.css`, `css/product.css` e `css/admin.css`) continham valores dispersos de `@media` misturando `min-width` e `max-width` (`340px`, `359px`, `400px`, `420px`, `639px`, `640px`, `767px`, `900px`, `1023px`, `1120px`), dificultando a manutenção e gerando zonas cinzentas entre dispositivos móveis e tablets.

### Decisão
1. **Quatro Breakpoints Mobile-First Exclusivos**: Todas as media queries de largura do projeto utilizam exclusivamente `min-width` nos valores:
   - `480px`: celulares largos / phablets;
   - `768px`: tablets em retrato;
   - `1024px`: tablets em paisagem / laptops compactos (ex.: transição do seletor mobile de categorias para abas horizontais e abertura da sidebar fixa no admin);
   - `1280px`: desktops amplos.
2. **Verificação Automatizada**: `scripts/verify.mjs` inspeciona todas as diretivas `@media` de `css/style.css`, `css/product.css` e `css/admin.css` e falha imediatamente caso surja qualquer `max-width` ou valor de `min-width` fora do conjunto `{480px, 768px, 1024px, 1280px}`.

---

## 11. Pré-visualização em Iframe na Mesma Origem (EXTRA-01 / Fase 6)

### Contexto
A auditoria sugeriu avaliar o uso do atributo `sandbox` no `<iframe>` de pré-visualização ao vivo de produtos (`js/admin/preview.js` carregando `produto.html?preview=1`). Em `js/product.js` (`initLivePreviewMode`), a comunicação exige verificação estrita de origem (`event.origin === window.location.origin` e `window.parent.location.origin === window.location.origin`), além do transporte de imagens temporárias via URLs `blob:` criadas pelo administrador antes do upload definitivo.

### Decisão
1. **Não utilizar `sandbox="allow-scripts"` isolado**: sem `allow-same-origin`, o iframe assume origem opaca (`'null'`), causando `SecurityError` na checagem de origem, invalidando a validação `event.origin` e bloqueando pré-visualizações `blob:`.
2. **Não utilizar `sandbox="allow-scripts allow-same-origin"`**: combinar ambas as flags anula o isolamento do sandbox (o documento embutido pode remover o próprio atributo `sandbox` via DOM) e gera alertas de segurança nos navegadores.
3. **Mitigação adotada**: manter o iframe na mesma origem sem `sandbox`, com validação rígida de `event.origin === window.location.origin` e `event.source === window.parent` em ambos os lados (`js/admin/preview.js` e `js/product.js`), sanitização/DOM API pura sem `innerHTML` e URLs validadas via `js/shared/richtext.js` e `sanitizeAssetUrl`.

---

## 12. Páginas Estáticas de Produto por Slug (ALTO-09 / Fase 7)

### Contexto
Páginas servidas via `produto.html?id=<uuid>` dependem de `fetch` client-side ao Supabase para preencher `<title>`, `meta description`, `og:*` e JSON-LD. Robôs sem execução de JS (ex.: prévia do WhatsApp) viam metadados genéricos, e URLs com query string UUID prejudicavam SEO.

### Decisão
1. **Coluna Única `products.slug`**: adicionada via `supabase/migrations/20261114120000_products_slug.sql` (com trigger de normalização sem acentos, dedup e `_rollback.sql`).
2. **Gerador Zero-Dependências (`scripts/build-products.mjs`)**: gera `produtos/<slug>/index.html` com SEO completo, JSON-LD `Product` e `BreadcrumbList` e conteúdo principal pré-renderizado a partir do Supabase (ou fallback seguro offline), além de atualizar `sitemap.xml` e integrar-se ao `vercel.json` (`"buildCommand": "npm run build:products"`).
3. **Prevenção de Conteúdo Duplicado**: `produto.html` mantém funcionamento como fallback dinâmico (`?id=` / `?slug=`) com `<meta name="robots" content="noindex, follow">` e `canonical` apontando para `produtos.html`, enquanto cards e links internos passam a apontar para `produtos/<slug>/`.

---

## 13. Infraestrutura de Analytics Condicionada ao Consentimento LGPD (ALTO-05 / Fase 8)

### Contexto
O proprietário ainda não decidiu se ativará GA4 e Meta Pixel nem definiu seus IDs. Era necessário deixar a arquitetura pronta, desligada por padrão, sem violar a CSP estrita (`script-src 'self'`) nem disparar antes do consentimento explícito.

### Decisão
1. **Desligado por Padrão (`js/config.js`)**: exporta `ANALYTICS = Object.freeze({ ga4MeasurementId: '', metaPixelId: '' })` com marcador `[PREENCHER]`. Com IDs vazios, zero scripts ou requisições externas são emitidos mesmo após o aceite de cookies.
2. **Consentimento Granular e Sem Inline Script (`js/main.js`)**: `saveConsentRecord` dispara `bn:cookie-consent-updated`, acionando `initAnalyticsIfConsented()`, que valida os formatos de ID e injeta apenas `<script async>` externos correspondentes às categorias autorizadas (`analytics` para GA4 e `marketing` para Meta Pixel), de forma idempotente.
3. **CSP Conservadora**: mantém `script-src 'self'` em produção enquanto os IDs estiverem vazios; as diretivas exatas para ativação futura ficam documentadas em `PENDENCIAS.md`.

---

## 14. Carrossel Hero — Ajuste Automático Desktop/Mobile e Remoção do Botão Visível de Pausa (Solicitação do Proprietário)

### Contexto
Na validação visual em produção, banners panorâmicos (`16:5`) possuem textos e logotipo distribuídos nas extremidades laterais. O recorte `16:9` no celular e os controles de ponto de foco manual no admin (`Área visível Mobile 16:9`, grade 3×3 e sliders X/Y) cortavam informações laterais e poluíam o painel de cadastro, assim como o botão flutuante `Pausar banners` sobrepunha o canto inferior da arte.

### Decisão
1. **Enquadramento Automático em Celular e Computador**: `.promo__carousel` e `.promo__slide` usam `aspect-ratio: var(--promo-aspect, 16 / 5)` uniformemente em mobile e desktop com `object-position: center center`, mantendo banners `16:5` íntegros de ponta a ponta em qualquer tela. Ao carregar o banner principal (`index === 0`) em `js/app.js`, o controlador lê as dimensões reais (`naturalWidth` / `naturalHeight`, para imagens horizontais reais) e ajusta `--promo-aspect` automaticamente caso outra proporção panorâmica seja cadastrada.
2. **Admin `#/banners` Simplificado**: upload único sem arte mobile separada, sem moldura de recorte e sem controles manuais X/Y (`focus_x`/`focus_y` mantidos em `50`/`50` por compatibilidade com a coluna do banco).
3. **Sem Botão Sobreposto de Pausa/Play e com Swipe Tátil Nativo no Celular**: `#hero-carousel-pause` removido do DOM e do CSS. Habilitado `touch-action: pan-x pan-y` e `overscroll-behavior-x: contain` na faixa do carrossel, com tratamento de gestos (`touchstart`/`touchmove`/`touchend`) que permite passar banners manualmente com o dedo em celulares (com loop contínuo e proteção contra clique acidental durante arraste) e reinicia o temporizador automático de 4,5 s logo ao soltar o toque. Interações touch nos bullets não acionam estados pegajosos de hover/foco (`pointerType === 'mouse'` para hover; `:focus-visible` / teclado para foco), mantendo a pausa automática sob `hover` com mouse, foco via teclado, aba oculta (`visibilitychange`) e `prefers-reduced-motion: reduce`.

---

## 15. Adequação para Produção na Cloudflare Pages / CDN

### Contexto
Ao publicar o site estático na **Cloudflare Pages**, quatro comportamentos específicos da plataforma impactam segurança, cache, roteamento e SEO:
1. O motor de `_headers` concatena regras sobrepostas em vez de sobrescrevê-las, salvo quando o cabeçalho pai é desanexado com `! Header-Name`. Sem isso, `/admin.html` recebia dois cabeçalhos CSP combinados (bloqueando `frame-src 'self' blob:`) e `/css/*` + `/js/*` recebiam `no-cache, public, max-age=31536000, immutable`. Além disso, as Clean URLs redirecionavam `/admin.html` para `/admin` sem regra correspondente.
2. Os módulos ES internos (`import ... from './publicApi.js'`) não possuem hash no nome do arquivo; cachear `/js/*` e `/css/*` com `immutable` por 1 ano mantém visitantes antigos presos em código obsoleto após novos deploys.
3. Sem `404.html` na raiz, a Cloudflare Pages ativa o fallback de SPA e responde `200 OK` com `index.html` para URLs inexistentes (*soft 404*). A coexistência de `produtos.html` com o diretório `produtos/<slug>/index.html` (sem `produtos/index.html`) também exige redirecionar `/produtos/` para `/produtos` e alinhar `canonical`, `og:url` e `sitemap.xml` com as rotas limpas (`/produtos` e `/privacidade`).
4. O recurso **Email Address Obfuscation** (Scrape Shield) reescreve links `mailto:` e injeta script externo incompatível com CSP estrita sem `'unsafe-inline'`.

### Decisão
1. **Cabeçalhos Desanexados e Clean URLs (`_headers` + `vercel.json`)**: adicionadas regras idênticas para `/admin` e `/admin.html` usando `! Content-Security-Policy` e `X-Robots-Tag: noindex, nofollow`, além de `! Cache-Control` em todos os grupos de assets. `/css/*` e `/js/*` passaram para `public, max-age=0, must-revalidate` (validação instantânea por ETag via borda Cloudflare), `/images/*` para `public, max-age=604800, stale-while-revalidate=86400` e `/fonts/*` mantido `immutable`.
2. **Página `404.html` Real e `_redirects`**: criada `404.html` com caminhos raiz absolutos (`/css/...`, `/js/...`, `/images/...`), `noindex, nofollow` e `<h1>` único, além de `_redirects` mapeando `/produtos/ /produtos 301`. `scripts/serve.mjs` reproduz localmente as Clean URLs e o status `404` real.
3. **Empacotamento Opcional Limpo (`scripts/build-cf.mjs` + `.assetsignore`)**: adicionados `.assetsignore` e script `npm run build:pages` que gera `dist/` apenas com ativos públicos, preservando o funcionamento zero-build na raiz.
4. **Proteção Scrape Shield (`<!--email_off-->`)**: todos os links `mailto:` das páginas públicas foram envolvidos em `<!--email_off-->...<!--/email_off-->` e validados por `scripts/verify.mjs`.








---

## 16. Fonte do Logotipo via Adobe Fonts (Exceção Pontual à CSP de Fontes Locais)

### Contexto
O proprietário pediu o nome "Botica Natural" do cabeçalho e do rodapé na tipografia **Roca Two**. A família Roca está disponível no Adobe Fonts da conta do proprietário, mas a licença do Adobe Fonts não permite auto-hospedar os arquivos: o uso na web exige o projeto web servido por `use.typekit.net`. O Adobe Fonts oferece o desenho "Roca One"; o "Roca Two" exato só existe na licença vendida pela My Creative Land.

### Decisão
1. **Projeto web `luq5dht` (Roca Regular e Bold)** carregado com `<link>` em `<head>` nas páginas públicas (`index`, `produtos`, `produto` e páginas geradas, `privacidade`, `404`). O admin continua sem fontes externas.
2. **CSP ampliada só no necessário**: `style-src` passa a incluir `https://use.typekit.net` e `https://p.typekit.net` (contagem de uso da licença) e `font-src` inclui `https://use.typekit.net`. `script-src` continua `'self'`, sem JavaScript da Adobe.
3. **Reserva local**: `--font-brand: 'roca', 'Playfair Display', ...`; se o Adobe Fonts falhar, o logotipo usa a Playfair auto-hospedada.
4. **LGPD**: a Política de Privacidade informa o Adobe Fonts como serviço de terceiros (sem cookies e sem publicidade).
5. **Saída futura**: comprando a licença webfont do Roca Two, basta colocar os `.woff2` em `fonts/`, declarar o `@font-face` em `css/fonts.css` e remover o Adobe Fonts das páginas e da CSP.
