# Bloqueios, Limitações de Ambiente e Dependências do Proprietário / RT

Este documento registra com transparência todos os itens que **dependem de decisão externa do proprietário, validação regulatória do Farmacêutico Responsável Técnico (RT) ou credenciais privilegiadas de infraestrutura**, e que portanto não podem ser alterados unilateralmente no código.

---

## 1. Dependências do Proprietário (Não Inventar / Marcadores Preservados)

1. **Domínio oficial de produção (`CRIT-03`)**
   - **Estado atual:** `https://www.boticanatural.com.br` mantido como provisório com marcadores `<!-- [PREENCHER: confirmar domínio oficial de produção] -->` e equivalente em `js/config.js`, `robots.txt` e `sitemap.xml`.
   - **Solução pronta:** após confirmação do domínio, executar:
     ```bash
     node scripts/set-domain.mjs https://<seu-dominio-oficial>
     npm run build:products
     ```

2. **Nome do Encarregado pelo Tratamento de Dados — DPO (`privacidade.html`)**
   - **Estado atual:** `[PREENCHER: Nome do Encarregado / Responsável LGPD]` preservado visivelmente em `privacidade.html` (e-mail preenchido: `boticanatural@terra.com.br`).
   - **Ação necessária:** informar o nome completo do responsável LGPD para substituição do marcador.

3. **Decisão e IDs de Analytics — GA4 e Meta Pixel (`ALTO-05`)**
   - **Estado atual:** infraestrutura completa e condicionada ao consentimento implementada em `js/main.js`, desligada por padrão em `js/config.js` (`ANALYTICS.ga4MeasurementId = ''`, `ANALYTICS.metaPixelId = ''`) com marcador `[PREENCHER]`.
   - **Ação necessária:** decidir se utilizará GA4 / Meta Pixel e fornecer os IDs; caso ative, atualizar também as diretivas CSP documentadas em `PENDENCIAS.md` (Seção 4.2) e rodar `npm run build:products`.

4. **Confirmação dos Indicadores da Seção `#sobre` (`index.html`)**
   - **Estado atual:** valores originais preservados integralmente (`26 anos`, `129.644` clientes atendidos, `245.735` fórmulas manipuladas, `1` Farmacêutico Responsável).
   - **Ação necessária:** confirmação formal dos números reais antes da publicação definitiva.

5. **Depoimentos Reais (`index.html`, seção `#depoimentos`)**
   - **Estado atual:** bloco mantido oculto (`hidden`) com placeholders `[PREENCHER: ...]` preservados.
   - **Ação necessária:** fornecer depoimentos reais com autorização expressa de uso de nome/imagem ou manter oculto.

---

## 2. Validações Regulatórias com o Farmacêutico RT (ANVISA)

Registradas em detalhe em `docs/auditoria/revisao-rt.md`:
1. **Aprovação dos textos neutralizados da FAQ (`index.html`)** marcados com `<!-- REVISAR COM RT -->`.
2. **Política de envio pelos Correios (`index.html` e `privacidade.html`)**: remoção preventiva mantida até aval do RT diante da RDC nº 67/2007.
3. **Linha Veterinária (`index.html`, `produtos.html`)**: mantida com alerta de necessidade de confirmação de licenciamento específico (MAPA).
4. **Precificação pública (`SHOW_INSTALLMENTS = false`)**: validação do RT sobre quais fórmulas exibem preço vs modo `"Sob consulta"`.

---

## 3. Bloqueios / Restrições de Ambiente Local e Banco Remoto

1. **Execução das Migrações SQL e `rls_checks.sql` no Supabase Remoto**
   - **Causa:** por segurança estrita (Regra Zero-Trust / ausência de `service_role` no front e no repositório), não há acesso administrativo direto ao PostgreSQL remoto via terminal para aplicar migrações DDL ou rodar a suíte `supabase/tests/rls_checks.sql`.
   - **Evidência:** todas as migrações novas (`20261113230000` até `20261114120000`) com seus respectivos scripts `_rollback.sql` e `supabase/schema_reference.sql` foram geradas de forma idempotente e revisadas; os testes automatizados E2E validam o contrato completo em `tests/e2e/fixtures/fake-supabase.js`.
   - **Ação necessária:** aplicar as migrações na ordem documentada em `PENDENCIAS.md` pelo **SQL Editor** do Supabase e executar `supabase/tests/rls_checks.sql`.

2. **`npm run verify:prod` com saída controlada (`exit code 1`)**
   - **Causa:** `scripts/verify.mjs --prod` verifica ausência de qualquer marcador `[PREENCHER: ...]` e exige explicitamente falha enquanto os 23 marcadores dependentes do proprietário (domínio, DPO, analytics IDs, depoimentos ocultos) estiverem preservados.
   - **Evidência:** `npm run verify` (checagens estruturais, segurança, SEO, CSP, breakpoints e orçamento de ícones) aprova **111/111** checagens; no modo `--prod`, falham exclusivamente os **23 marcadores `[PREENCHER]`** intencionalmente mantidos.
