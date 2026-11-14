# Revisão Regulatória com o Farmacêutico Responsável Técnico (RT) — Fase 1 (ALTO-06)

**Responsável Técnico:** Tainã Cornélius Vargas – CRF/RS 17296  
**Referências Normativas:** RDC nº 67/2007 e RDC nº 96/2008 da ANVISA  
**Objetivo:** Registro completo (antes e depois) de todas as adequações textuais realizadas nas páginas públicas da **Botica Natural** para eliminar alegações absolutas, generalizações terapêuticas, menções logísticas não confirmadas e termos promocionais sensíveis, submetendo a redação final à validação técnica do RT.

---

## 1. Alterações Realizadas (Antes e Depois)

### 1.1. FAQ — Generalização sobre manipulação (`index.html`, seção `#duvidas`)
- **Antes:**
  > **Pergunta:** Qualquer remédio pode ser manipulado?  
  > **Resposta:** A maioria dos medicamentos, suplementos e cosméticos pode ser manipulada, desde que haja prescrição de um profissional habilitado e a matéria-prima seja liberada pela ANVISA.
- **Depois (com marcador `<!-- REVISAR COM RT -->`):**
  > **Pergunta:** Quais fórmulas podem ser manipuladas?  
  > **Resposta:** Muitas fórmulas podem ser manipuladas conforme a disponibilidade de insumos autorizados pela ANVISA. Medicamentos sob prescrição exigem receita de profissional habilitado; nossa equipe orienta pelo WhatsApp.
- **Motivo:** Evita generalização sobre classes terapêuticas sujeitas a restrições sanitárias específicas.

---

### 1.2. FAQ — Prazo de entrega e menção aos Correios (`index.html`, seção `#duvidas`)
- **Antes:**
  > **Pergunta:** Qual o prazo de entrega?  
  > **Resposta:** A manipulação leva de 24 a 48 horas úteis após a aprovação do pagamento. Entregamos via motoboy em Triunfo e região, e pelos Correios para todo o Brasil.
- **Depois (com marcador `<!-- REVISAR COM RT: confirmar política de envio e abrangência geográfica de entrega -->`):**
  > **Pergunta:** Qual o prazo de entrega?  
  > **Resposta:** A manipulação leva de 24 a 48 horas úteis após a confirmação do pedido. Realizamos entregas em Triunfo e região; consulte condições e modalidades pelo WhatsApp.
- **Motivo:** A remessa postal de medicamentos manipulados para todo o território nacional possui restrições regulatórias na RDC 67/2007 e depende de confirmação formal do RT e do proprietário.

---

### 1.3. Política de Privacidade — Menção aos Correios (`privacidade.html`, seção 4)
- **Antes:**
  > A **Botica Natural** não comercializa dados pessoais. O compartilhamento restringe-se ao estritamente necessário para a prestação do serviço (como operadores logísticos/motoboy ou Correios para entrega domiciliar, meios de pagamento e autoridades sanitárias quando exigido por lei), sob dever de confidencialidade e sigilo farmacêutico.
- **Depois (com marcador `<!-- REVISAR COM RT: confirmar política de envio e operadores logísticos -->`):**
  > A **Botica Natural** não comercializa dados pessoais. O compartilhamento restringe-se ao estritamente necessário para a prestação do serviço (como operadores logísticos para entrega domiciliar, meios de pagamento e autoridades sanitárias quando exigido por lei), sob dever de confidencialidade e sigilo farmacêutico.
- **Motivo:** Alinhamento com a remoção preventiva da menção aos Correios até confirmação do RT.

---

### 1.4. FAQ — Comparação de eficácia com industrializados (`index.html`, seção `#duvidas`)
- **Antes:**
  > **Pergunta:** O manipulado é tão eficaz quanto o industrializado?  
  > **Resposta:** Sim. Ambos utilizam princípios ativos com eficácia comprovada. A vantagem do manipulado é a dose personalizada, a ausência de componentes indesejados e a possibilidade de unir vários ativos em uma só fórmula.
- **Depois (com marcador `<!-- REVISAR COM RT -->`):**
  > **Pergunta:** Como funciona o medicamento manipulado?  
  > **Resposta:** O manipulado permite dose personalizada e a combinação de ativos em uma fórmula preparada sob medida, seguindo rigoroso controle de qualidade. A indicação e a escolha do tratamento devem ser feitas com profissional de saúde habilitado.
- **Motivo:** Remove comparação direta de eficácia e a expressão absoluta *"eficácia comprovada"*, substituindo por orientação técnica neutra e encaminhamento ao profissional prescritor.

---

### 1.5. Rodapé — Promessa de horário de WhatsApp não confirmado (`index.html`, `produtos.html`, `produto.html`, `privacidade.html`)
- **Antes:**
  ```html
  <li><span>Seg a Sex</span> 08:30–12:00 e 13:30–18:00</li>
  <li><span>Sáb</span> 08:30–12:00</li>
  <li><span>WhatsApp</span> respostas até 22h</li>
  ```
- **Depois:**
  ```html
  <li><span>Seg a Sex</span> 08:30–12:00 e 13:30–18:00</li>
  <li><span>Sáb</span> 08:30–12:00</li>
  ```
- **Motivo:** O horário confirmado pelo proprietário é exclusivamente Seg a Sex 08:30–12:00 e 13:30–18:00; Sáb 08:30–12:00.

---

### 1.6. Catálogo — Meta description, subtítulo, placeholder de busca e estado vazio (`produtos.html`)
1. **Meta description (`produtos.html`):**
   - **Antes:** `"Explore o catálogo completo da Botica Natural: dermocosméticos, suplementos, emagrecimento, fitoterápicos e veterinária. Peça pelo WhatsApp com orientação farmacêutica."`
   - **Depois:** `"Catálogo da Botica Natural: dermocosméticos, suplementos, cápsulas, fitoterápicos e linha veterinária. Solicite orçamento pelo WhatsApp com suporte técnico."`
2. **Subtítulo do catálogo (`.catalog-hero__desc`):**
   - **Antes:** `"Explore nossas fórmulas manipuladas com matérias-primas puras, laudos de qualidade e eficácia comprovada. Selecione a categoria ou pesquise o produto desejado."`
   - **Depois:** `"Explore nossas fórmulas manipuladas com matérias-primas selecionadas, laudos de qualidade e rastreabilidade farmacêutica. Selecione a categoria ou pesquise o produto desejado."`
3. **Placeholder de busca (`.catalog-search-input`):**
   - **Antes:** `"Buscar por produto, ativo ou benefício (ex: colágeno, emagrecimento, calmante)..."`
   - **Depois:** `"Buscar por produto, ativo ou forma farmacêutica (ex: colágeno, cápsulas, cremes)..."`
4. **Descrição do estado vazio (`#catalog-empty-desc`):**
   - **Antes:** `"Não encontrou o produto desejado? Nós manipulamos qualquer fórmula sob prescrição médica ou indicação personalizada!"`
   - **Depois:** `"Não encontrou o produto desejado? Consulte nossa equipe farmacêutica pelo WhatsApp para orçamento de fórmulas sob prescrição de profissional habilitado."`

---

### 1.7. Nota padrão de qualidade no preview administrativo (`js/admin/views/productForm.js` e `js/shared/productRenderer.js`)
- **Antes:**
  > `"Todos os produtos da Botica Natural são preparados com matérias-primas selecionadas e rigoroso controle de qualidade farmacêutico, garantindo melhor eficácia."`
- **Depois:**
  > `"Todos os produtos da Botica Natural são preparados com matérias-primas selecionadas, rastreabilidade e rigoroso controle de qualidade farmacêutico."`

---

## 2. Resultado da Varredura por Fronteira de Palavra (HTML Público)

Varredura executada sobre `index.html`, `produtos.html`, `produto.html` e `privacidade.html` (fora de comentários HTML) para os termos:
- `cura`, `curar`, `garante`, `100%`, `sem efeitos colaterais`, `emagrec*`, `milagr*`, `comprovad*`, `sem contraindica*`, `tratamento garantido`.
- **Resultado:** **0 ocorrências** em todas as páginas públicas. A verificação foi incorporada permanentemente ao `scripts/verify.mjs`.

---

## 3. Itens Pendentes de Confirmação pelo RT / Proprietário

1. **Aprovação dos textos neutros da FAQ (`index.html`)**: validar a redação das respostas marcadas com `<!-- REVISAR COM RT -->`.
2. **Modalidade de envio pelos Correios**: confirmar se a farmácia realiza despacho postal e para quais localidades/formas farmacêuticas.
3. **Linha Veterinária (`index.html` e `produtos.html`)**: mantida conforme orientação do proprietário, aguardando confirmação de regularidade/licenciamento específico junto ao MAPA/órgão competente.
