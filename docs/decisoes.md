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
1. **Bundles Locais ESM**: `scripts/bundle-vendor.mjs` gera versões locais e fixadas de `@supabase/supabase-js` (2.49.1) e `Swiper` (11.2.4) em `js/vendor/` e `css/vendor/`.
2. **Sprite SVG Local**: Font Awesome foi completamente descontinuado em favor do sprite SVG local `images/icons.svg` e da folha de estilos `css/icons.css`. O site agora funciona 100% offline ou em redes restritas sem requisições para servidores externos de fontes ou CDNs.
3. **CSP Estrita sem CDNs**: `script-src` e `style-src` das páginas públicas e do admin apontam exclusivamente para `'self'`, sem permissões para `cdn.jsdelivr.net` ou `cdnjs.cloudflare.com`.

---

## 9. Conformidade com a LGPD e Privacidade

### Decisão
1. **Consentimento Granular com 4 Ações**: O banner LGPD oferece Aceitar todos, Rejeitar opcionais e Gerenciar preferências (essenciais vs. analíticos/comunicação), além de um link permanente no rodapé de todas as páginas para alterar ou revogar consentimento a qualquer momento.
2. **Versionamento e Timestamp**: O consentimento é registrado em `localStorage` no formato `{ v: 1, ts: <timestamp>, choices: { analytics: boolean, marketing: boolean } }`.
3. **Página de Privacidade Transparente**: `privacidade.html` detalha a finalidade do processamento dos dados em conformidade com as diretrizes da ANPD e da Anvisa.


