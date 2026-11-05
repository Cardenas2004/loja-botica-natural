# Checklist de Regressão do Painel Administrativo — Botica Natural

Mapeamento completo das funcionalidades existentes no painel administrativo (`admin.html`, `js/admin.js`, `css/admin.css`) antes da refatoração modular, acrescido das novas capacidades das Fases 1 a 5. Nenhuma funcionalidade prévia pode ser perdida.

---

## 1. Autenticação, Autorização e Sessão
- [x] **Login via Supabase Auth**: Autenticação por e-mail e senha (`supabase.auth.signInWithPassword`) com feedback visual de erro traduzido (`#login-feedback`) e estado de carregamento no botão.
- [x] **Guardião Zero-Trust (`public.is_admin()`)**: Verificação server-side via `supabase.rpc('is_admin')` antes de liberar o painel. Contas autenticadas sem registro em `public.admin_users` sofrem logout imediato e recebem mensagem de acesso negado.
- [x] **Restauração e Monitoramento de Sessão**: Checagem inicial via `getCurrentSession()` e assinatura em `supabase.auth.onAuthStateChange` (`SIGNED_IN`, `TOKEN_REFRESHED`, `SIGNED_OUT`).
- [x] **Logout Seguro**: Limpeza de estado em memória, revogação de `ObjectURL`s ativos e retorno à tela `#login-view`.
- [x] **Exibição do Usuário Logado**: E-mail do administrador exibido na top bar.

## 2. Layout, Navegação e Design System (Fase 1)
- [x] **Shell Responsivo**: Sidebar fixa colapsável no desktop, top bar com busca global, alternador de tema (claro/escuro com `prefers-color-scheme` + persistência em `localStorage`), usuário logado e botão sair. No mobile/tablet, sidebar vira drawer com backdrop e foco preso (`Escape` fecha).
- [x] **Roteamento por Hash**: `#/` (Dashboard), `#/produtos` (Listagem), `#/produtos/novo` (Novo Produto), `#/produtos/:id` (Editar Produto), `#/banners` (Carrossel), `#/categorias` (Categorias), `#/whatsapp` (Mensagens de WhatsApp), com atualização de título, breadcrumb e suporte ao botão Voltar do navegador.
- [x] **Dashboard Inicial**: KPIs reais do banco (Total de Produtos, Produtos Ativos/Inativos, Mais Vendidos, Categorias Ativas, Banners Ativos), atalhos de ação rápida ("Novo produto", "Novo banner", "Nova categoria") e lista dos últimos itens editados.

## 3. Pipeline de Imagens e Supabase Storage (`product-images`)
- [x] **Validação de Arquivo**: Aceita `image/jpeg`, `image/png` e `image/webp` até 10 MB na entrada bruta.
- [x] **Compressão Client-Side para WebP**: Redimensionamento automático via `<canvas>` (`1280px` para produtos em `catalogo/`, `1920px` para banners em `carousel/`) com redução iterativa de qualidade garantindo saída `<= 2 MB`.
- [x] **Drag-and-Drop + Pré-visualização Local**: Zona de upload com arrastar e soltar, barra de progresso/status, preview imediato via `URL.createObjectURL` e limpeza com `URL.revokeObjectURL`.
- [x] **Validação de Host Seguro**: `isTrustedStorageUrl()` garante que apenas URLs públicas do próprio projeto Supabase Storage (ou `blob:` local no preview) sejam renderizadas.
- [x] **Prevenção de Arquivos Órfãos**: Exclusão automática da imagem antiga no bucket `product-images` ao substituir foto de produto/banner ou ao excluir o registro, além de rollback físico caso o `insert`/`update` no banco falhe após o upload.

## 4. Gestão de Categorias (`#/categorias`)
- [x] **Listagem Ordenada**: Exibição por `display_order ASC, name ASC` com badge de ordem, nome, `slug`, status (Ativa/Oculta) e contagem de produtos vinculados.
- [x] **Criação e Edição**: Formulário com geração automática de `slug` (`generateSlug`), `display_order` numérico e switch `is_active`.
- [x] **Exclusão com Confirmação**: Modal `<dialog>` informando quantos produtos estão vinculados à categoria antes de excluir.

## 5. Gestão de Banners do Carrossel (`#/banners`)
- [x] **Galeria Widescreen (`1920x650`)**: Cards com miniatura proporcional, badge de ordem, status (Visível/Oculto), texto alternativo (`title`) e link opcional (`button_link`).
- [x] **Criação, Edição e Substituição de Foto**: Upload WebP HD (`1920px`), validação de `button_link` (`https://`, `http://` ou caminho relativo) e exclusão com remoção física no Storage.
- [x] **Reordenação de Banners**: Suporte a arrastar e soltar (drag-and-drop) e botões acessíveis Subir/Descer via teclado para atualizar `display_order` no Supabase.

## 6. Listagem e Operações em Massa de Produtos (`#/produtos`)
- [x] **Tabela Responsiva (vira Cards no Mobile)**: Miniatura, nome, SKU, categoria, preço formatado (`BRL`), status (Ativo/Inativo) e selo "Mais Vendido".
- [x] **Busca, Filtros, Ordenação e Paginação**: Busca com debounce (por nome, descrição, SKU ou categoria), filtros por categoria, status e mais vendidos, ordenação (Mais recentes, Nome A–Z, Menor/Maior preço) e paginação.
- [x] **Ações em Linha**: Editar (`#/produtos/:id`), Duplicar produto, Ativar/Desativar rápido e Excluir com confirmação em `<dialog>`.
- [x] **Ações em Massa (Bulk Actions)**: Seleção múltipla via checkbox para ativar ou desativar vários produtos de uma só vez.

## 7. Formulário de Produto Dedicado, Editor Rico e Preview ao Vivo (`#/produtos/novo` e `#/produtos/:id`)
- [x] **Organização em Seções/Abas**:
  1. *Básico*: Nome, SKU (`sku_ref`), Categoria (`category_id`), Preço (`price`), Imagem principal (`image_url`/`image_path`), Status (`is_active`), Mais vendido (`is_best_seller`).
  2. *Conteúdo (Rich Text)*: Resumo curto (`short_description`), Descrição detalhada (`description`), Modo de usar (`usage_instructions`), Composição (`composition`), Informações da embalagem (`package_info`), Alérgenos (`allergen_info`), Nota de qualidade (`quality_note`), Condições de pagamento (`payment_info`).
  3. *WhatsApp*: Mensagem customizada (`whatsapp_message`, texto puro com variáveis `{produto}`, `{categoria}`, `{preco}`, `{link}`, `{sku}` e botões `*negrito*` / `_itálico_`).
  4. *SEO & Resumo*: Pré-visualização de snippet de busca e status de preenchimento.
- [x] **Barra Inferior Fixa e Proteção contra Perda de Dados**: Botões "Salvar", "Salvar e continuar editando" e "Cancelar", indicador de alterações não salvas ("Alterações não salvas" / "Salvo"), atalho `Ctrl/Cmd+S` e confirmação em `beforeunload` e na troca de rota interna quando o formulário estiver sujo (`isDirty`).
- [x] **Editor de Texto Rico Seguro (Fase 2)**:
  - Toolbar acessível (`role="toolbar"`, `aria-pressed`, navegação por setas) com Negrito (`Ctrl+B`), Itálico (`Ctrl+I`), Sublinhado (`Ctrl+U`), Tachado, Lista com marcadores (`ul`), Lista numerada (`ol`), Citação (`blockquote`), Subtítulos (`h3`, `h4` — nunca `h1`/`h2`), Link seguro (`https:`, `http:`, `mailto:`, `tel:` com `rel="noopener noreferrer"` e `target="_blank"`), Limpar formatação e Desfazer/Refazer (`Ctrl+Z`/`Ctrl+Y`).
  - Seletor **"Modo do texto"** por campo (`paragraphs`, `lines`, `inline`) persistido em `products.text_options` (`jsonb`).
  - Colagem limpa (`paste` sanitizado descartando estilos inline, classes, `span`, `font` e HTML de Word/Docs).
  - Contador de caracteres visíveis com limite configurável por campo.
  - Sanitizador rigoroso `sanitizeRichText(html, options)` em `js/shared/richtext.js` com retrocompatibilidade automática para textos antigos em texto puro (`\n`).
- [x] **Pré-visualização em Tempo Real (Fase 3)**:
  - `<iframe>` apontando para `produto.html?preview=1` compartilhando `renderProduct(container, productData, options)` (`js/shared/productRenderer.js`).
  - Atualização via `postMessage` (validando `event.origin === window.location.origin` e `event.source === window.parent`) com debounce de ~150 ms.
  - Alternador de viewport (`Mobile 375px`, `Tablet 768px`, `Desktop 1280px`) com escala proporcional, scroll e highlight automático da seção correspondente ao focar em um campo (`data-field="..."`), e botão para abrir preview em tela cheia.

## 8. Editor Dedicado de Mensagens do WhatsApp (`#/whatsapp`)
- [x] **Seletor de Escopo**: Alterna entre Modelo Geral da Loja (`site_settings.whatsapp_product_template`) e Mensagem Exclusiva por Produto (`products.whatsapp_message`).
- [x] **Inserção de Variáveis e Formatação WhatsApp**: Pílulas clicáveis (`{produto}`, `{categoria}`, `{preco}`, `{link}`, `{sku}`), botões `*negrito*` e `_itálico_`, contador de caracteres (`1000` máx.), botão Restaurar Padrão / Remover Mensagem Exclusiva e botão Alternar Produto de Exemplo.
- [x] **Mockup de Conversa em Tempo Real**: Balão estilizado do WhatsApp exibindo a mensagem interpolada ao vivo.

## 9. Responsividade, Mobile & Acessibilidade WCAG (Fase Layout)
- [x] **Shell Responsivo (< 1024px)**: Sidebar oculta por padrão e acessada via botão de menu na top bar, com gaveta lateral (drawer), backdrop escuro e fechamento por `Escape`.
- [x] **Tabelas para Cartões (< 768px)**: Listagens de produtos, categorias e banners convertem automaticamente em cartões de toque fácil em viewports mobile, mantendo seleção em lote.
- [x] **Prevenção de Zoom no iOS Safari**: Inputs, selects e textareas com `font-size: 1rem` (16px), eliminando o zoom indesejado ao focar em campos.
- [x] **Alvos de Toque WCAG 2.5.8**: Botões da barra do editor rico (`.rte-toolbar__btn`) com área base expandida e regra `@media (pointer: coarse)` garantindo $\ge 44 \times 44$ px em telas de toque.
- [x] **Sincronização com Teclado Virtual**: Barra fixa de ações (`.product-sticky-footer`) conectada à API nativa `window.visualViewport` em `js/admin/views/productForm.js`, ajustando dinamicamente a posição quando o teclado virtual é aberto no mobile.
- [x] **Modais em Bottom-Sheet**: Diálogos `<dialog>` de confirmação e exclusão convertem em bottom-sheets no mobile com cantos superiores arredondados e altura máxima de `90dvh`.

## 10. Resiliência Operacional, Integridade e Concorrência (Fase Endurecimento)
- [x] **Prevenção do BUG-AUTH-RERENDER**: Nenhuma perda de dados no formulário quando ocorrem eventos `TOKEN_REFRESHED` ou foco da aba com `SIGNED_IN`.
- [x] **Autosave de Rascunho em LocalStorage**: Salva estado do produto a cada modificação com recuperação visual através de banner no topo do formulário.
- [x] **Validação Segura de Preço**: Rejeição imediata de valores negativos ou inválidos; confirmação explícita ao cadastrar preço `0,00` (modo "Sob consulta").
- [x] **Detecção de Concorrência Otimista**: Impede sobrescrita acidental se outro usuário tiver alterado o produto simultaneamente (`CONCURRENT_MODIFICATION`).
- [x] **Upload Resiliente com Fallback**: Converte para WebP de até 1280px e faz fallback transparente para JPEG caso o motor Canvas não suporte WebP.
- [x] **Zero Violações de CSP**: Sem nenhum script inline, sem `onerror` inline e sem estilos inline em todo o HTML do painel.
- [x] **Zero Violações WCAG 2.1 AA**: Auditado via `@axe-core/playwright` com zero erros críticos ou sérios de acessibilidade.


