# Botica Natural — Catálogo Digital & Painel Administrativo

Plataforma digital para farmácia de manipulação desenvolvida com arquitetura **100% estática (HTML5 semântico, CSS3 moderno e JavaScript puro com ES Modules)**, sem frameworks de runtime, sem compiladores e sem etapa de build em produção. O backend é provido pelo **Supabase** (PostgreSQL com RLS estrita, Auth e Storage).

---

## 1. Visão Geral da Arquitetura

- **Front-end Público**: Páginas estáticas (`index.html`, `produtos.html`, `produto.html`, `privacidade.html`) que consomem a API pública do Supabase com chave anônima (`anon key`) e se comunicam com o cliente via WhatsApp oficial com mensagens customizadas.
- **Painel Administrativo (`admin.html`)**: SPA modular em ES modules (`js/admin/`) com sistema de rotas por hash (`#/`), gestão de catálogo, upload e compressão client-side de imagens (WebP/JPEG), editor de texto rico proprietário e pré-visualização em tempo real da página de produto dentro de um sandbox `iframe` via `postMessage`.
- **Segurança & Zero-Trust**:
  - Autorização estrita baseada na tabela `public.admin_users` via RPC `is_admin() SECURITY DEFINER` (sem leitura de `user_metadata` nem e-mails hardcoded).
  - Sanitizador de HTML em árvore AST puro (`js/shared/richtext.js`) com proteção contra XSS/mXSS e arquitetura `_v: 2` imune a acúmulo de entidades (`&amp;`).
  - Content Security Policy (CSP) com `script-src 'self'` estrito (evoluindo para `style-src 'self'` e fontes locais na Fase 5 da auditoria).
  - Conformidade LGPD com gestão granular de consentimento de cookies (Aceitar todos, Rejeitar opcionais, Configurar e Revogar no rodapé).
  - Acessibilidade WCAG 2.1 AA auditada sem violações graves/críticas via `@axe-core/playwright`.

---

## 2. Estrutura do Repositório

```text
├── index.html                  # Página inicial com vitrine de destaques e benefícios
├── produtos.html               # Catálogo completo com busca, filtros de categoria e paginação
├── produto.html                # Detalhes do produto com renderização rica e modo ?preview=1
├── privacidade.html            # Política de Privacidade e Encarregado LGPD
├── admin.html                  # Painel administrativo seguro
│
├── css/
│   ├── style.css               # Design System principal e estilos da vitrine pública
│   ├── product.css             # Estilos dedicados da página de produto e blocos ricos
│   ├── admin.css               # Estilos da interface administrativa e modo escuro
│   ├── icons.css               # Ícones vetoriais via CSS mask-image com data URIs SVG locais
│   └── vendor/
│       └── swiper-11.2.4.bundle.min.css # Bundle local do Swiper (zero CDN)
│
├── js/
│   ├── config.js               # Constantes de negócio, marca, paginação e regras
│   ├── supabaseClient.js       # Cliente singleton Supabase apontando para bundle ESM local
│   ├── main.js                 # Inicialização da vitrine, banner LGPD e drawer mobile
│   ├── app.js                  # Lógica do catálogo público e paginação
│   ├── product.js              # Inicialização pública da página de detalhes do produto
│   ├── whatsapp.js             # Formatação canônica de mensagens WhatsApp da vitrine pública
│   ├── shared/
│   │   ├── richtext.js         # Sanitizador de texto rico AST, normalizador e conversor legado
│   │   └── productRenderer.js  # Renderizador compartilhado entre a vitrine pública e o live preview
│   ├── admin/                  # Módulos do painel administrativo
│   │   ├── main.js             # Bootstrap do painel e roteamento por hash
│   │   ├── auth.js             # Autenticação Supabase Auth e verificação RPC is_admin
│   │   ├── state.js            # Estado reativo e cache administrativo
│   │   ├── api.js              # Camada de comunicação Supabase (select restrito e trava de concorrência)
│   │   ├── editor.js           # Editor de texto rico nativo com toolbar e histórico
│   │   └── views/              # Telas do painel (dashboard, produtos, banners, categorias, whatsapp)
│   └── vendor/
│       ├── supabase-js-2.49.1.esm.js    # Bundle local consolidado do @supabase/supabase-js
│       └── swiper-11.2.4.bundle.min.js  # Bundle local consolidado do Swiper 11
│
├── images/
│   ├── logo.png / logo.webp    # Identidade visual da farmácia
│   └── og-image.jpg            # Imagem Open Graph para compartilhamento social
│
├── supabase/
│   ├── migrations/             # Migrações versionadas com timestamp e idempotência
│   ├── schema_reference.sql    # Schema consolidado de referência para auditoria
│   ├── legacy/                 # SQLs legados arquivados com travas de aborto ativas
│   ├── audit/                  # Consultas SQL para auditoria de segurança e integridade
│   └── tests/                  # Testes pgTAP / verificações de RLS
│
├── tests/
│   └── e2e/                    # Suíte de testes ponta a ponta (Playwright)
│       ├── richtext-roundtrip.spec.js   # Validação de roundtrip e eliminação do BUG-ESCAPE
│       ├── admin-auth-events.spec.js    # Resiliência de autenticação e preservação de formulário
│       ├── csp.spec.js                  # Verificação estrita de ausência de violações de CSP
│       ├── no-overflow.spec.js          # Prevenção de overflow horizontal (320px a 1440px)
│       └── accessibility.spec.js        # Auditoria WCAG 2.1 AA via axe-core (0 violações)
│
├── scripts/
│   ├── serve.mjs               # Servidor local estático com MIME types corretos
│   ├── verify.mjs              # Verificador estático de integridade, links e ausência de dados fictícios
│   ├── test-richtext.mjs       # Suíte unitária do sanitizador AST (21 testes)
│   ├── repair-escapes.mjs      # Script de reparo de entidades acumuladas no banco
│   ├── bundle-vendor.mjs       # Script de geração dos bundles ESM locais em js/vendor/
│   └── build-icons-sprite.mjs  # Gerador de css/icons.css com máscaras SVG locais
│
├── docs/
│   ├── decisoes.md             # Architecture Decision Records (ADR)
│   └── admin-regressao.md      # Checklist exaustiva de regressão do painel
│
├── .github/workflows/
│   └── ci.yml                  # Pipeline de Integração Contínua (GitHub Actions)
├── _headers                    # Cabeçalhos HTTP de segurança para Cloudflare Pages / Netlify
├── vercel.json                 # Configuração de cabeçalhos de segurança para Vercel
├── PENDENCIAS.md               # Dados reais do negócio e validações com RT da Anvisa
└── RELATORIO.md                # Relatório executivo e técnico detalhado da auditoria
```

---

## 3. Instalação e Desenvolvimento Local

### Pré-requisitos
- **Node.js**: v20.x ou superior (utilizado apenas para ferramentas de desenvolvimento e testes; o runtime da aplicação continua 100% estático sem Node em produção).
- **NPM**: v10.x ou superior.

### Instalação das dependências de desenvolvimento
```bash
npm install
```

### Inicialização do servidor de desenvolvimento local
```bash
npm run serve
```
Acesse a aplicação no navegador em `http://127.0.0.1:3000/`.

---

## 4. Suíte de Testes e Validação Contínua

A qualidade, segurança e integridade do repositório são mantidas através de testes automatizados executados tanto localmente quanto no pipeline de CI:

```bash
# Executa testes unitários do sanitizador e verificação estática do projeto
npm test

# Executa verificação estática profunda (integridade de imports, CSP, ausência de dados fictícios)
npm run verify

# Verificação prévia de publicação em produção (falha se houver placeholders [PREENCHER: ...])
npm run verify:prod

# Executa todos os testes E2E com Playwright nos 3 motores de renderização (Chromium, Firefox, WebKit)
npx playwright test

# Executa testes E2E específicos
npx playwright test tests/e2e/richtext-roundtrip.spec.js
npx playwright test tests/e2e/accessibility.spec.js
```

---

## 5. Scripts Operacionais e Manutenção do Banco

### Reparo de Entidades HTML no Banco de Dados
Caso o banco contenha produtos cadastrados durante versões anteriores que acumularam entidades (`&amp;amp;`), execute o script de reparo seguro:

```bash
# Modo de simulação (dry-run): não altera o banco, apenas lista as correções
node scripts/repair-escapes.mjs --dry-run

# Execução real: aplica as correções no Supabase e marca os campos com _v: 2
node scripts/repair-escapes.mjs
```

### Atualização dos Bundles Locais de Terceiros
Para atualizar o cliente Supabase mantendo a entrega 100% estática e local:
```bash
node scripts/bundle-vendor.mjs
```

---

## 6. Hospedagem & Cabeçalhos HTTP de Segurança

O repositório já inclui configurações prontas para as principais plataformas de hospedagem estática:

- **Cloudflare Pages / Netlify**: O arquivo `_headers` na raiz define cabeçalhos obrigatórios de produção:
  - `Content-Security-Policy` estrita diferenciada por escopo (público vs. `/admin.html`).
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: SAMEORIGIN`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()` (evoluindo para incluir `payment=()` na Fase 5)
- **Vercel**: O arquivo `vercel.json` aplica as mesmas diretivas via rotas do Vercel Edge Network.

---

## 7. Dados Pendentes & Validação Regulatória

Consulte o arquivo **[`PENDENCIAS.md`](PENDENCIAS.md)** antes de realizar o deploy em ambiente produtivo. Ele consolida os dados reais obrigatórios do estabelecimento (CNPJ, CRF-RS, Licença Sanitária/AFE, nome do Farmacêutico RT) e os itens sujeitos a parecer técnico do Responsável Técnico conforme a **RDC 67/2007** e **RDC 96/2008** da Anvisa.
