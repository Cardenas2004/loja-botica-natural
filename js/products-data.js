/**
 * ============================================================================
 * Botica Natural — Camada de Dados / Repositório de Produtos (Mock Database)
 * ============================================================================
 * Arquitetura: Clean Code · Single Responsibility Principle (SRP)
 * Imutabilidade garantida via Object.freeze para prevenir mutações acidentais.
 * Zero dependência de DOM — este módulo contém apenas dados e consultas puras.
 */
(() => {
  'use strict';

  /**
   * @typedef {Object} CompositionItem
   * @property {string} active - Nome do insumo farmacêutico ativo
   * @property {string} concentration - Dosagem ou concentração por unidade farmacotécnica
   * @property {string} role - Função farmacológica ou farmacotécnica na fórmula
   */

  /**
   * @typedef {Object} SpecificationItem
   * @property {string} label - Nome do atributo técnico
   * @property {string} value - Valor técnico correspondente
   */

  /**
   * @typedef {Object} Product
   * @property {string} id - Identificador único numérico em string ('1' a '9')
   * @property {string} slug - Identificador semântico amigável para URL
   * @property {string} sku - Código interno de controle farmacotécnico
   * @property {string} name - Nome comercial/técnico da fórmula manipulada
   * @property {string} category - Identificador da categoria no catálogo
   * @property {string} categoryLabel - Nome de exibição da categoria
   * @property {string} highlightBadge - Texto do selo de destaque
   * @property {string} highlightIcon - Classe de ícone FontAwesome do selo
   * @property {string} pharmaceuticalForm - Apresentação e volume/quantidade
   * @property {string} formIcon - Classe de ícone FontAwesome da forma farmacêutica
   * @property {number} price - Preço unitário base em Reais (BRL)
   * @property {number} installmentsCount - Número máximo de parcelas sem juros
   * @property {string} image - Caminho relativo seguro para a imagem do produto
   * @property {string} imageAlt - Texto alternativo descritivo (acessibilidade)
   * @property {string} shortDescription - Resumo executivo da fórmula
   * @property {string} pharmacologicalAction - Síntese do mecanismo de ação
   * @property {string[]} technicalDescription - Parágrafos da descrição técnica farmacêutica
   * @property {CompositionItem[]} composition - Lista de ativos e concentrações
   * @property {string[]} benefits - Lista de benefícios clínicos e diferenciais
   * @property {string} posology - Orientação posológica padrão
   * @property {SpecificationItem[]} specifications - Ficha técnica de bancada e conservação
   * @property {string} contraindications - Advertências legais e contraindicações
   */

  /** @type {ReadonlyArray<Readonly<Product>>} */
  const PRODUCTS_COLLECTION = Object.freeze([
    Object.freeze({
      id: '1',
      slug: 'okralin-500mg',
      sku: 'BN-EMG-001',
      name: 'Okralin™ 500mg',
      category: 'emagrecimento',
      categoryLabel: 'Emagrecimento & Metabolismo',
      highlightBadge: 'Mais Vendido',
      highlightIcon: 'fa-solid fa-fire',
      pharmaceuticalForm: '60 Cápsulas Vegetais',
      formIcon: 'fa-solid fa-capsules',
      price: 139.90,
      installmentsCount: 6,
      image: 'images/produtos/okralin-500mg.jpg',
      imageAlt: 'Frasco de Okralin 500mg com 60 cápsulas — Botica Natural',
      shortDescription:
        'Complexo 100% natural patenteado, obtido do quiabo (Abelmoschus esculentus) cultivado na Tunísia. Fórmula clinicamente comprovada para gerenciamento inteligente de peso e redução de medidas.',
      pharmacologicalAction:
        'Aglutina até 40% da gordura ingerida nas refeições antes de sua absorção intestinal, auxiliando na redução de medidas sem comprometer a absorção de vitaminas lipossolúveis (A, D, E e K).',
      technicalDescription: Object.freeze([
        'O Okralin™ é um ativo nutracêutico francês padronizado em fibras solúveis da mucilagem do Abelmoschus esculentus associadas à inulina e ácido cítrico em proporção sinérgica patenteada.',
        'Após ser ingerido cerca de 15 minutos após a refeição principal, o complexo forma um gel hidrocoloide lipofílico no estômago que encapsula os triglicerídeos provenientes da dieta, impedindo a atuação das lipases pancreáticas.',
        'Diferente dos inibidores sintéticos de lipase, o complexo gordura-fibra é eliminado naturalmente pelo trânsito intestinal sem causar desconfortos gastrointestinais, esteatorreia ou depleção da microbiota.'
      ]),
      composition: Object.freeze([
        Object.freeze({
          active: 'Okralin™ (Abelmoschus esculentus padronizado)',
          concentration: '500mg por cápsula (1.000mg por dose de 2 cápsulas)',
          role: 'Complexo aglutinador lipofílico de gorduras dietéticas'
        }),
        Object.freeze({
          active: 'Excipiente q.s.p. (Celulose Microcristalina + Dióxido de Silício Coloidal)',
          concentration: '1 cápsula vegetal Vcaps®',
          role: 'Estabilidade farmacotécnica isenta de lactose e glúten'
        })
      ]),
      benefits: Object.freeze([
        'Redução de até 40% na absorção calórica proveniente de gorduras das refeições',
        'Auxilia na diminuição expressiva da circunferência abdominal e do quadril em 12 semanas',
        'Não interfere na absorção das vitaminas lipossolúveis essenciais (A, D, E e K)',
        'Ativo 100% vegetal, livre de estimulantes centrais e sem efeitos colaterais intestinais'
      ]),
      posology:
        'Ingerir 1 dose (2 cápsulas de 500mg) com um copo de água, 15 minutos após o almoço ou jantar (refeição com maior teor lipídico), ou conforme prescrição médica/nutricional.',
      specifications: Object.freeze([
        Object.freeze({ label: 'Apresentação', value: 'Pote farmacêutico opaco com 60 cápsulas (30 doses)' }),
        Object.freeze({ label: 'Tipo de Cápsula', value: 'Vegetal (HPMC) — Livre de corantes artificiais' }),
        Object.freeze({ label: 'Alergênicos', value: 'Zero Glúten · Zero Lactose · Zero Açúcar' }),
        Object.freeze({ label: 'Validade Padrão', value: '6 meses após a data de manipulação' }),
        Object.freeze({ label: 'Conservação', value: 'Manter em temperatura ambiente (15°C a 30°C), protegido da luz e umidade' })
      ]),
      contraindications:
        'Não recomendado para gestantes, lactantes e crianças sem orientação médica ou nutricional. Pessoas com hipersensibilidade aos componentes da fórmula devem evitar o consumo.'
    }),

    Object.freeze({
      id: '2',
      slug: 'serum-vitamina-c',
      sku: 'BN-DER-002',
      name: 'Sérum Vitamina C 20% + Ácido Hialurônico',
      category: 'dermocosmeticos',
      categoryLabel: 'Dermocosméticos',
      highlightBadge: 'Mais Vendido',
      highlightIcon: 'fa-solid fa-star',
      pharmaceuticalForm: 'Frasco Conta-gotas 30ml',
      formIcon: 'fa-solid fa-droplet',
      price: 89.90,
      installmentsCount: 6,
      image: 'images/produtos/serum-vitamina-c.jpg',
      imageAlt: 'Sérum Facial Vitamina C 20% com Ácido Hialurônico 30ml — Botica Natural',
      shortDescription:
        'Concentrado antioxidante estabilizado de toque seco e rápida absorção cutânea. Promove revitalização profunda, luminosidade imediata e sustentação dérmica.',
      pharmacologicalAction:
        'Estimula a síntese natural de colágeno tipo I e III pelos fibroblastos, uniformiza o tom da pele ao inibir a tirosinase, clareia manchas solares e atenua linhas finas com escudo antipoluição.',
      technicalDescription: Object.freeze([
        'Desenvolvido na bancada dermocosmética da Botica Natural com Vitamina C estabilizada em nanovetores biopoliméricos (Ascorbil Fosfato de Magnésio + Tetraisopalmitato de Ascorbila), garantindo permeação profunda até a camada basal sem oxidar no frasco.',
        'A associação com o Ácido Hialurônico de baixo e médio peso molecular promove preenchimento hídrico tridimensional da epiderme, retendo até 1.000 vezes seu peso em moléculas de água.',
        'Enriquecido com Vitamina E (Alfa-Tocoferol) e Ácido Ferúlico, que multiplicam em até 8 vezes a fotoproteção biológica contra radicais livres induzidos pela radiação UVA/UVB e luz azul.'
      ]),
      composition: Object.freeze([
        Object.freeze({
          active: 'Complexo Vitamina C Estabilizada Nanoencapsulada',
          concentration: '20%',
          role: 'Antioxidante potente, despigmentante e indutor de neocolagênese'
        }),
        Object.freeze({
          active: 'Ácido Hialurônico Duplo Peso Molecular',
          concentration: '5%',
          role: 'Hidratação epidérmica profunda e preenchimento de linhas finas'
        }),
        Object.freeze({
          active: 'Ácido Ferúlico + Alfa-Tocoferol (Vitamina E)',
          concentration: '1,5%',
          role: 'Sinergia antioxidante estabilizadora e reparo da barreira lipídica'
        }),
        Object.freeze({
          active: 'Base Sérum Toque Seco Oil-Free q.s.p.',
          concentration: '30ml',
          role: 'Veículo dermocosmético não comedogênico adaptado para peles brasileiras'
        })
      ]),
      benefits: Object.freeze([
        'Luminosidade e viço renovados já nas primeiras semanas de aplicação contínua',
        'Atenuação visível de manchas de melasma leve, hiperpigmentação pós-inflamatória e fotoenvelhecimento',
        'Toque aveludado oil-free: não deixa brilho excessivo e não obstrui os poros (não comedogênico)',
        'Potencializa a eficácia do protetor solar quando aplicado na rotina diurna'
      ]),
      posology:
        'Com a pele limpa e seca, aplicar de 4 a 5 gotas na face, pescoço e colo pela manhã (antes do filtro solar) e/ou à noite, espalhando com movimentos suaves ascendentes até completa absorção.',
      specifications: Object.freeze([
        Object.freeze({ label: 'Apresentação', value: 'Frasco de vidro âmbar fotoprotetor 30ml com cânula conta-gotas' }),
        Object.freeze({ label: 'Tipo de Pele', value: 'Todos os tipos de pele, inclusive mistas e oleosas' }),
        Object.freeze({ label: 'pH Fisiológico', value: '5,0 a 5,5 (alta tolerabilidade cutânea)' }),
        Object.freeze({ label: 'Validade Padrão', value: '4 meses após a manipulação' }),
        Object.freeze({ label: 'Conservação', value: 'Manter o frasco bem fechado, ao abrigo do calor e da luz solar direta' })
      ]),
      contraindications:
        'Uso exclusivamente externo. Evitar contato direto com a mucosa ocular. Em caso de sensibilidade ou rubor persistente, suspender o uso e consultar o farmacêutico ou dermatologista.'
    }),

    Object.freeze({
      id: '3',
      slug: 'morosil-500mg',
      sku: 'BN-EMG-003',
      name: 'Morosil® 500mg Autêntico Galena',
      category: 'emagrecimento',
      categoryLabel: 'Emagrecimento & Metabolismo',
      highlightBadge: 'Mais Vendido',
      highlightIcon: 'fa-solid fa-fire',
      pharmaceuticalForm: '60 Cápsulas',
      formIcon: 'fa-solid fa-capsules',
      price: 124.90,
      installmentsCount: 6,
      image: 'images/produtos/morosil-500mg.jpg',
      imageAlt: 'Morosil 500mg Autêntico Galena com 60 cápsulas — Botica Natural',
      shortDescription:
        'Extrato seco padronizado obtido exclusivamente do suco das laranjas vermelhas Moro (Citrus sinensis L. Osbeck) cultivadas no solo vulcânico ao redor do Etna, na Sicília (Itália).',
      pharmacologicalAction:
        'Atua diretamente na modulação genética dos adipócitos, promovendo redução de até 50% da gordura abdominal localizada, melhora da sensibilidade à insulina e controle de triglicerídeos.',
      technicalDescription: Object.freeze([
        'O Morosil® autêntico distribuído pela Galena possui altíssima concentração padronizada de antocianinas específicas (especialmente a Cianidina-3-glicosídeo — C3G), flavanonas, ácidos hidroxicinâmicos e ácido ascórbico.',
        'Seus fitocomplexos atuam regulando a expressão de genes lipogênicos (como PPAR-γ e FAS) e estimulando a adiponectina, hormônio essencial para a lipólise (quebra de gordura armazenada nos adipócitos hipertrofiados da região da cintura).',
        'Além do remodelamento corporal, estudos clínicos demonstram excelente ação hepatoprotetora, auxiliando no cuidado complementar da esteatose hepática (gordura no fígado).'
      ]),
      composition: Object.freeze([
        Object.freeze({
          active: 'Morosil® (Citrus sinensis L. Osbeck padronizado em C3G)',
          concentration: '500mg',
          role: 'Modulador do metabolismo lipídico e redutor de hipertrofia de adipócitos'
        }),
        Object.freeze({
          active: 'Excipiente Farmacêutico Padrão q.s.p.',
          concentration: '1 cápsula',
          role: 'Proteção contra umidade e liberação gástrica imediata'
        })
      ]),
      benefits: Object.freeze([
        'Insumo original com selo de autenticidade e laudo analítico de procedência italiana',
        'Foco comprovado na perda de medidas na região abdominal e flancos (até -7 cm de cintura nos estudos)',
        'Coadjuvante na redução do colesterol LDL, triglicerídeos e esteatose hepática',
        'Potente ação antioxidante sistêmica graças às antocianinas da Laranja Moro'
      ]),
      posology:
        'Tomar 1 cápsula (500mg) ao dia, preferencialmente pela manhã ou 30 minutos antes do almoço, acompanhada de água.',
      specifications: Object.freeze([
        Object.freeze({ label: 'Apresentação', value: 'Frasco lacrado com 60 cápsulas de 500mg (tratamento para 60 dias)' }),
        Object.freeze({ label: 'Certificação do Ativo', value: 'Matéria-prima autêntica Bionap® (Itália) / Galena®' }),
        Object.freeze({ label: 'Alergênicos', value: 'Isento de glúten, lactose e sacarose' }),
        Object.freeze({ label: 'Validade Padrão', value: '6 meses após a manipulação' }),
        Object.freeze({ label: 'Conservação', value: 'Conservar em local seco e fresco (15°C a 30°C) com a sílica dessecante no frasco' })
      ]),
      contraindications:
        'Contraindicado para gestantes, lactantes e menores de 18 anos sem acompanhamento médico. Como o extrato é hidrofílico, mantenha o pote sempre bem vedado após abrir.'
    }),

    Object.freeze({
      id: '4',
      slug: 'creme-anti-aging-retinol-like',
      sku: 'BN-DER-004',
      name: 'Creme Facial Anti-Aging Retinol-Like',
      category: 'dermocosmeticos',
      categoryLabel: 'Dermocosméticos',
      highlightBadge: 'Fórmula Premium',
      highlightIcon: 'fa-solid fa-wand-magic-sparkles',
      pharmaceuticalForm: 'Pote Airless 50g',
      formIcon: 'fa-solid fa-pump-medical',
      price: 119.90,
      installmentsCount: 6,
      image: 'images/produtos/creme-antiaging.jpg',
      imageAlt: 'Creme Facial Anti-Aging Retinol-Like 50g — Botica Natural',
      shortDescription:
        'Creme rejuvenescedor dermoestruturante com Bakuchiol (fito-retinol de alta tolerância) e peptídeos biomiméticos tensores para renovação celular sem descamação ou vermelhidão.',
      pharmacologicalAction:
        'Estimula os receptores retinoides dérmicos aumentando a densidade de colágeno e elastina, suaviza rugas profundas, redefine o contorno facial e restaura a barreira hidrolipídica.',
      technicalDescription: Object.freeze([
        'Formulado especialmente para peles que buscam a eficácia rejuvenescedora do Ácido Retinoico, mas não toleram a irritação, ardência ou fotossensibilidade dos retinoides tradicionais.',
        'O Bakuchiol 99% puro (extraído das sementes da Psoralea corylifolia) apresenta equivalência clínica ao Retinol na ativação genética de colágeno tipos I, III e IV, além de inibir as metaloproteinases (enzimas que degradam a matriz dérmica).',
        'Combinado ao Matrixyl™ (peptídeos pró-colágeno), Niacinamida PC 4% e Esqualano Vegetal, proporciona efeito lifting progressivo, redução de poros dilatados e hidratação biomimética.'
      ]),
      composition: Object.freeze([
        Object.freeze({
          active: 'Bakuchiol Purificado (Fito-Retinol)',
          concentration: '1%',
          role: 'Renovador celular e estimulador dérmico de colágeno sem irritação'
        }),
        Object.freeze({
          active: 'Peptídeos Biomiméticos (Matrixyl™)',
          concentration: '3%',
          role: 'Efeito tensor, redensificador e suavizador de linhas de expressão'
        }),
        Object.freeze({
          active: 'Niacinamida PC (Grau Cosmético Puríssimo) + Esqualano',
          concentration: '4% + 3%',
          role: 'Uniformização do tom, fortalecimento da barreira cutânea e maciez'
        }),
        Object.freeze({
          active: 'Base Second-Skin Fosfolipídica q.s.p.',
          concentration: '50g',
          role: 'Emulsão sensorial aveludada de alta biocompatibilidade'
        })
      ]),
      benefits: Object.freeze([
        'Alternativa botânica segura ao Retinol: não descama, não arde e pode ser usada o ano todo',
        'Suaviza linhas ao redor dos olhos, sulco nasogeniano e rugas frontais',
        'Melhora a elasticidade, firmeza e textura global da pele madura ou desvitalizada',
        'Fórmula hipoalergênica livre de parabenos, óleo mineral e petrolatos'
      ]),
      posology:
        'Aplicar uma fina camada sobre a face e pescoço limpos todas as noites (e/ou pela manhã antes do protetor solar), massageando suavemente de dentro para fora.',
      specifications: Object.freeze([
        Object.freeze({ label: 'Apresentação', value: 'Embalagem protetora de 50g com dosador higiênico' }),
        Object.freeze({ label: 'Indicação Cutânea', value: 'Peles normais, secas, maduras ou sensíveis aos retinoides clássicos' }),
        Object.freeze({ label: 'Textura', value: 'Creme aveludado de rápida absorção (Second-Skin)' }),
        Object.freeze({ label: 'Validade Padrão', value: '4 meses após a data de manipulação' }),
        Object.freeze({ label: 'Conservação', value: 'Conservar em temperatura ambiente, longe de fontes de calor' })
      ]),
      contraindications:
        'Uso externo. Embora o Bakuchiol seja fotoestável e seguro, recomenda-se sempre o uso de filtro solar diurno para potencializar os resultados antienvelhecimento.'
    }),

    Object.freeze({
      id: '5',
      slug: 'greenselect-phytosome-120mg',
      sku: 'BN-EMG-005',
      name: 'GreenSelect Phytosome® 120mg',
      category: 'emagrecimento',
      categoryLabel: 'Emagrecimento & Metabolismo',
      highlightBadge: 'Descafeinado',
      highlightIcon: 'fa-solid fa-leaf',
      pharmaceuticalForm: '60 Cápsulas',
      formIcon: 'fa-solid fa-capsules',
      price: 98.90,
      installmentsCount: 6,
      image: 'images/produtos/greenselect-phytosome.jpg',
      imageAlt: 'GreenSelect Phytosome 120mg com 60 cápsulas — Botica Natural',
      shortDescription:
        'Extrato purificado de catequinas do chá verde com tecnologia italiana Phytosome® (fosfolipídios de girassol) que triplica a biodisponibilidade intestinal. 100% livre de cafeína.',
      pharmacologicalAction:
        'Termogênico celular inteligente: ativa a beta-oxidação lipídica e o gasto energético basal sem provocar taquicardia, ansiedade, tremores ou insônia. Seguro para pacientes sensíveis a estimulantes.',
      technicalDescription: Object.freeze([
        'Desenvolvido pela Indena® (Itália), o GreenSelect Phytosome® é um extrato de Camellia sinensis altamente padronizado em 60% de catequinas (sendo no mínimo 40% de Galato de Epigalocatequina — EGCG) e completamente descafeinado (< 0,1%).',
        'As catequinas convencionais possuem baixa absorção no trato digestivo. A tecnologia patenteada Phytosome® complexa o EGCG a fosfolipídios vegetais, permitindo atravessar facilmente as membranas celulares enterocitárias.',
        'Atua estimulando a AMPK (proteína quinase ativada por AMP), promovendo termogênese nos tecidos periféricos, redução do IMC e combate ao estresse oxidativo metabólico.'
      ]),
      composition: Object.freeze([
        Object.freeze({
          active: 'GreenSelect Phytosome® (Camellia sinensis descafeinada + Fosfolipídios)',
          concentration: '120mg',
          role: 'Ativador termogênico mitocondrial e antioxidante metabólico'
        }),
        Object.freeze({
          active: 'Excipiente Vegetal Padrão q.s.p.',
          concentration: '1 cápsula',
          role: 'Dispersão uniforme e conservação do fitocomplexo'
        })
      ]),
      benefits: Object.freeze([
        'Acelera o metabolismo e a queima de gordura corporal sem conter cafeína',
        'Ideal para pessoas com hipertensão controlada, ansiedade, enxaqueca ou insônia que não podem usar termogênicos comuns',
        'Tecnologia Phytosome® com absorção até 3x superior ao extrato de chá verde tradicional',
        'Auxilia no controle do perfil lipídico (colesterol total e triglicerídeos) e glicemia'
      ]),
      posology:
        'Tomar 1 cápsula (120mg) duas vezes ao dia (1 cápsula antes do café da manhã e 1 cápsula antes do almoço ou jantar), ou conforme orientação profissional.',
      specifications: Object.freeze([
        Object.freeze({ label: 'Apresentação', value: 'Frasco com 60 cápsulas de 120mg' }),
        Object.freeze({ label: 'Teor de Cafeína', value: 'Isento (< 0,1% — Descafeinado)' }),
        Object.freeze({ label: 'Origem do Ativo', value: 'Indena® S.p.A. — Milão, Itália' }),
        Object.freeze({ label: 'Validade Padrão', value: '6 meses após a manipulação' }),
        Object.freeze({ label: 'Conservação', value: 'Manter em local fresco, seco e ao abrigo da luz solar' })
      ]),
      contraindications:
        'Gestantes, nutrizes e crianças somente devem consumir este produto sob orientação médica ou de nutricionista.'
    }),

    Object.freeze({
      id: '6',
      slug: 'coenzima-q10-100mg',
      sku: 'BN-SUP-006',
      name: 'Coenzima Q10 Ubiquinona 100mg + Vit. E',
      category: 'suplementos',
      categoryLabel: 'Suplementos & Longevidade',
      highlightBadge: 'Longevidade',
      highlightIcon: 'fa-solid fa-heart-pulse',
      pharmaceuticalForm: '60 Cápsulas',
      formIcon: 'fa-solid fa-capsules',
      price: 79.90,
      installmentsCount: 6,
      image: 'images/produtos/coenzima-q10.jpg',
      imageAlt: 'Coenzima Q10 Ubiquinona 100mg + Vitamina E com 60 cápsulas — Botica Natural',
      shortDescription:
        'Fórmula bioenergética de alta biodisponibilidade associada à Vitamina E lipofílica para otimização da produção de energia celular (ATP), saúde cardiovascular e neuroproteção.',
      pharmacologicalAction:
        'Atua diretamente na cadeia transportadora de elétrons das mitocôndrias, restaurando o vigor físico e mental, protegendo o miocárdio e repondo os níveis de CoQ10 depletados pelo uso de estatinas.',
      technicalDescription: Object.freeze([
        'A Coenzima Q10 (Ubiquinona) é um cofator endógeno indispensável para a síntese de Trifosfato de Adenosina (ATP) no interior das mitocôndrias, especialmente em órgãos de alta demanda energética como o coração, cérebro, fígado e musculatura esquelética.',
        'Por ser uma molécula essencialmente lipossolúvel, nossa formulação associa 100mg de Coenzima Q10 puríssima à Vitamina E (Acetato de Racealfatocoferol), garantindo proteção contra a peroxidação lipídica e excelente absorção linfática.',
        'É amplamente recomendada como suplementação essencial para pacientes que utilizam medicamentos redutores de colesterol (estatinas como sinvastatina, rosuvastatina e atorvastatina), pois esses fármacos bloqueiam a via do mevalonato e reduzem drasticamente a CoQ10 muscular.'
      ]),
      composition: Object.freeze([
        Object.freeze({
          active: 'Coenzima Q10 (Ubiquinona Bioidêntica)',
          concentration: '100mg',
          role: 'Cofator bioenergético mitocondrial e antioxidante cardiovascular'
        }),
        Object.freeze({
          active: 'Vitamina E (Alfa-Tocoferol)',
          concentration: '15mg (100% IDR)',
          role: 'Carreador lipofílico sinérgico e protetor de membranas celulares'
        }),
        Object.freeze({
          active: 'Excipiente Lipofílico Otimizado q.s.p.',
          concentration: '1 cápsula',
          role: 'Maximização da biodisponibilidade intestinal'
        })
      ]),
      benefits: Object.freeze([
        'Aumento da disposição física diária, resistência muscular e recuperação pós-treino',
        'Suporte fundamental para quem faz uso contínuo de estatinas (previne dores e fadiga muscular)',
        'Ação cardioprotetora e neuroprotetora contra o envelhecimento celular precoce',
        'Auxilia na redução da frequência e intensidade de crises de enxaqueca'
      ]),
      posology:
        'Ingerir 1 cápsula ao dia junto com o almoço ou jantar (a presença de alimentos com gorduras boas potencializa a absorção da Coenzima Q10).',
      specifications: Object.freeze([
        Object.freeze({ label: 'Apresentação', value: 'Frasco com 60 cápsulas (suprimento para 2 meses)' }),
        Object.freeze({ label: 'Grau de Pureza', value: 'USP Grade (Farmacopeia Americana — 99,8% pureza)' }),
        Object.freeze({ label: 'Alergênicos', value: 'Sem glúten · Sem lactose · Sem açúcar' }),
        Object.freeze({ label: 'Validade Padrão', value: '6 meses após a manipulação' }),
        Object.freeze({ label: 'Conservação', value: 'Conservar entre 15°C e 30°C, protegido da luz e umidade' })
      ]),
      contraindications:
        'Pacientes em uso de anticoagulantes cumarínicos (ex: varfarina) ou gestantes devem consultar o médico antes de iniciar a suplementação.'
    }),

    Object.freeze({
      id: '7',
      slug: 'propolis-mais-blend',
      sku: 'BN-IMU-007',
      name: 'Própolis Mais Blend (Vermelha + Verde)',
      category: 'imunidade',
      categoryLabel: 'Saúde & Imunidade',
      highlightBadge: 'Imunidade',
      highlightIcon: 'fa-solid fa-shield-halved',
      pharmaceuticalForm: 'Frasco Conta-gotas 30ml',
      formIcon: 'fa-solid fa-vial',
      price: 59.90,
      installmentsCount: 6,
      image: 'images/produtos/propolis-mais.jpg',
      imageAlt: 'Própolis Mais Blend Vermelha + Verde 30ml — Botica Natural',
      shortDescription:
        'Fórmula exclusiva que une a raríssima Própolis Vermelha dos manguezais de Alagoas (Dalbergia ecastophyllum) à consagrada Própolis Verde do Alecrim-do-Campo (Baccharis dracunculifolia).',
      pharmacologicalAction:
        'Blindagem imunológica de amplo espectro: combina a alta concentração de Artepillin-C (Própolis Verde) às Isoflavonas e Neovestitol (Própolis Vermelha), com ação antimicrobiana, antiviral e anti-inflamatória.',
      technicalDescription: Object.freeze([
        'Enquanto os extratos comuns oferecem apenas um tipo de própolis, o Própolis Mais Blend da Botica Natural entrega um perfil fitoquímico completo ao reunir os dois compostos mais estudados pela ciência brasileira.',
        'A Própolis Verde é mundialmente reconhecida pelo seu teor elevado de Artepillin-C, um fenilpropanoide que ativa macrófagos e células NK (Natural Killer) na defesa rápida contra patógenos respiratórios.',
        'Já a Própolis Vermelha (com Indicação Geográfica protegida) aporta isoflavonas raras, formononetina e neovestitol, proporcionando potente ação antioxidante, regeneradora de mucosas e moduladora da resposta inflamatória.'
      ]),
      composition: Object.freeze([
        Object.freeze({
          active: 'Extrato Padronizado de Própolis Vermelha (Dalbergia ecastophyllum)',
          concentration: '50% do blend ativo (Extrato seco mín. 11% w/v)',
          role: 'Rico em isoflavonas bioativas, neovestitol e ação antioxidante superior'
        }),
        Object.freeze({
          active: 'Extrato Padronizado de Própolis Verde (Baccharis dracunculifolia)',
          concentration: '50% do blend ativo (Alto teor de Artepillin-C)',
          role: 'Imunomodulador natural, antibacteriano e protetor das vias aéreas'
        }),
        Object.freeze({
          active: 'Veículo Hidroalcoólico Farmacêutico Purificado q.s.p.',
          concentration: '30ml',
          role: 'Extração máxima de compostos fenólicos e flavonoides totais'
        })
      ]),
      benefits: Object.freeze([
        'Dupla proteção imunológica: une Artepillin-C + Isoflavonas da Própolis Vermelha em um único frasco',
        'Alívio rápido para irritações de garganta, amigdalites, aftas e desconfortos de vias aéreas superiores',
        'Altíssima concentração de compostos fenólicos e bioflavonoides ativos por gota',
        'Matéria-prima rastreada com controle microbiológico e físico-químico rigoroso'
      ]),
      posology:
        'Uso preventivo adulto: diluir de 15 a 20 gotas em meio copo de água, suco natural ou chá morno, 1 vez ao dia (pela manhã). Em períodos de baixa imunidade ou desconforto na garganta: 20 gotas até 3 vezes ao dia.',
      specifications: Object.freeze([
        Object.freeze({ label: 'Apresentação', value: 'Frasco de vidro âmbar 30ml com conta-gotas dosador' }),
        Object.freeze({ label: 'Extrato Seco Mínimo', value: 'Acima de 11% m/v (Alta concentração)' }),
        Object.freeze({ label: 'Glúten / Açúcar', value: 'Não contém glúten · Zero adição de açúcares ou corantes' }),
        Object.freeze({ label: 'Validade Padrão', value: '12 meses após o envase' }),
        Object.freeze({ label: 'Conservação', value: 'Conservar em local fresco e seco, longe da luz solar' })
      ]),
      contraindications:
        'Contraindicado para pessoas com alergia conhecida a própolis, mel ou derivados apícolas. Crianças menores de 2 anos e gestantes devem consultar o médico antes do uso.'
    }),

    Object.freeze({
      id: '8',
      slug: 'composto-calmante-fitoterapico',
      sku: 'BN-FIT-008',
      name: 'Composto Calmante Fitoterápico',
      category: 'fitoterapicos',
      categoryLabel: 'Fitoterápicos & Bem-Estar',
      highlightBadge: 'Bem-Estar',
      highlightIcon: 'fa-solid fa-moon',
      pharmaceuticalForm: '60 Cápsulas',
      formIcon: 'fa-solid fa-capsules',
      price: 54.90,
      installmentsCount: 6,
      image: 'images/produtos/composto-calmante.jpg',
      imageAlt: 'Composto Calmante Fitoterápico com 60 cápsulas — Botica Natural',
      shortDescription:
        'Associação sinérgica de extratos secos padronizados de Passiflora incarnata, Valeriana officinalis e Crataegus oxyacantha/Mulungu para equilíbrio emocional e qualidade do sono.',
      pharmacologicalAction:
        'Modula suavemente os receptores GABAérgicos no sistema nervoso central, reduzindo a hiperexcitabilidade neural, a ansiedade diurna e a latência do sono sem gerar sonolência residual ou dependência.',
      technicalDescription: Object.freeze([
        'Desenvolvido com extratos secos padronizados (e não apenas pó da planta moída), o Composto Calmante da Botica Natural garante concentração exata dos marcadores fitoquímicos em cada cápsula.',
        'A Passiflora incarnata (padronizada em vitexina e flavonoides) atua em sinergia com os ácidos valerênicos da Valeriana officinalis, diminuindo o tempo necessário para adormecer e aprofundando as fases reparadoras do sono.',
        'O Mulungu (Erythrina mulungu) e o Crataegus complementam a fórmula reduzindo sintomas somáticos da tensão nervosa, como palpitações leves, inquietação noturna e irritabilidade.'
      ]),
      composition: Object.freeze([
        Object.freeze({
          active: 'Passiflora incarnata (Extrato Seco Padronizado em Flavonoides)',
          concentration: '200mg',
          role: 'Ansiolítico natural e relaxante do sistema nervoso central'
        }),
        Object.freeze({
          active: 'Valeriana officinalis (Extrato Seco Padronizado em Ácidos Valerênicos)',
          concentration: '150mg',
          role: 'Indutor fisiológico do sono e redutor de despertares noturnos'
        }),
        Object.freeze({
          active: 'Mulungu (Erythrina mulungu Extrato Seco)',
          concentration: '100mg',
          role: 'Equilíbrio emocional e alívio da agitação e tensão física'
        }),
        Object.freeze({
          active: 'Excipiente Farmacêutico Vegetal q.s.p.',
          concentration: '1 cápsula',
          role: 'Estabilidade e desintegração controlada'
        })
      ]),
      benefits: Object.freeze([
        'Alívio natural da ansiedade, estresse mental e irritabilidade do dia a dia',
        'Melhora a arquitetura do sono profundo sem causar sensação de "ressaca" na manhã seguinte',
        'Fórmula 100% fitoterápica que não causa dependência química nem tolerância',
        'Extratos padronizados com laudo de teor de princípios ativos'
      ]),
      posology:
        'Para ansiedade diurna: tomar 1 cápsula pela manhã e 1 cápsula ao final da tarde. Para qualidade do sono: tomar de 1 a 2 cápsulas cerca de 45 minutos antes de deitar.',
      specifications: Object.freeze([
        Object.freeze({ label: 'Apresentação', value: 'Frasco com 60 cápsulas' }),
        Object.freeze({ label: 'Padronização', value: 'Extratos secos concentrados (grau farmacêutico)' }),
        Object.freeze({ label: 'Alergênicos', value: 'Livre de glúten, lactose e açúcares' }),
        Object.freeze({ label: 'Validade Padrão', value: '6 meses após a manipulação' }),
        Object.freeze({ label: 'Conservação', value: 'Manter em temperatura ambiente (15°C a 30°C), protegido da umidade' })
      ]),
      contraindications:
        'Evitar o uso concomitante com bebidas alcoólicas ou outros depressores do sistema nervoso central sem orientação médica. Não recomendado para gestantes e lactantes.'
    }),

    Object.freeze({
      id: '9',
      slug: 'biscoito-pet-articulacoes',
      sku: 'BN-VET-009',
      name: 'Biscoito Pet Articulações (Condroitina + Glucosamina)',
      category: 'veterinaria',
      categoryLabel: 'Linha Pet Veterinária',
      highlightBadge: 'Sabor Picanha',
      highlightIcon: 'fa-solid fa-bone',
      pharmaceuticalForm: '30 Biscoitos Palatáveis',
      formIcon: 'fa-solid fa-paw',
      price: 84.90,
      installmentsCount: 6,
      image: 'images/produtos/biscoito-pet.jpg',
      imageAlt: 'Biscoito Pet Articulações com Condroitina e Glucosamina — Botica Natural Veterinária',
      shortDescription:
        'Suplemento condroprotetor veterinário manipulado em forma de petisco macio altamente palatável com aroma idêntico ao natural de picanha. Tratamento articular sem estresse para cães e gatos.',
      pharmacologicalAction:
        'Fornece os precursores estruturais dos proteoglicanos e do líquido sinovial, regenerando a cartilagem articular, inibindo enzimas degradativas e aliviando a dor e a rigidez locomotora.',
      technicalDescription: Object.freeze([
        'Administrar comprimidos tradicionais para cães e gatos frequentemente gera estresse tanto para o animal quanto para o tutor. Nossa linha veterinária transforma a prescrição em biscoitos funcionais macios de alta aceitação.',
        'A combinação sinérgica de Sulfato de Condroitina A, Sulfato de Glucosamina e Colágeno Tipo II Não Desnaturado (UC-II® Pet) atua diretamente na proteção das articulações submetidas a desgaste por idade avançada, sobrepeso ou predisposição racial.',
        'Formulado sem adição de açúcar, sal excessivo ou conservantes tóxicos para pets, garantindo segurança hepática e renal em tratamentos contínuos.'
      ]),
      composition: Object.freeze([
        Object.freeze({
          active: 'Sulfato de Glucosamina + Sulfato de Condroitina Grau Veterinário',
          concentration: '500mg + 400mg por biscoito',
          role: 'Lubrificação sinovial e reconstrução da matriz cartilaginosa'
        }),
        Object.freeze({
          active: 'Colágeno Tipo II Não Desnaturado + MSM (Enxofre Orgânico)',
          concentration: '20mg + 100mg por biscoito',
          role: 'Redução da inflamação articular e melhora da mobilidade'
        }),
        Object.freeze({
          active: 'Base Biscoito Pet Hipersaborizada (Aroma Picanha Hipoalergênico) q.s.p.',
          concentration: '1 biscoito macio',
          role: 'Adesão fácil ao tratamento como recompensa diária'
        })
      ]),
      benefits: Object.freeze([
        'Alta palatabilidade: o pet consome espontaneamente como se fosse um petisco de agrado',
        'Melhora a disposição para passear, subir escadas e levantar-se em cães e gatos idosos',
        'Ação condroprotetora preventiva para raças predispostas à displasia coxofemoral e artrose',
        'A dosagem pode ser personalizada sob medida de acordo com o peso exato (kg) do seu pet'
      ]),
      posology:
        'Cães até 10kg e gatos: meio (1/2) a 1 biscoito ao dia. Cães de 10kg a 25kg: 1 biscoito ao dia. Cães acima de 25kg: 2 biscoitos ao dia, ou conforme prescrição do Médico Veterinário.',
      specifications: Object.freeze([
        Object.freeze({ label: 'Apresentação', value: 'Pote vedado com 30 biscoitos macios palatáveis' }),
        Object.freeze({ label: 'Sabor Disponível', value: 'Picanha (também manipulamos nos sabores Bacon, Frango ou Queijo sob pedido)' }),
        Object.freeze({ label: 'Espécies Indicadas', value: 'Cães e Gatos (uso exclusivo veterinário)' }),
        Object.freeze({ label: 'Validade Padrão', value: '3 meses após a manipulação' }),
        Object.freeze({ label: 'Conservação', value: 'Manter o pote bem fechado em local fresco e fora do alcance dos animais e crianças' })
      ]),
      contraindications:
        'Uso exclusivo na alimentação/suplementação animal (proibido o uso humano). Em caso de ingestão acidental de grande quantidade do pote pelo animal, procure orientação veterinária.'
    })
  ]);

  /**
   * Normaliza e sanitiza o identificador recebido para consulta segura.
   * Blinda contra Prototype Pollution (__proto__, constructor, toString) e caracteres de controle.
   * @param {unknown} rawValue
   * @returns {string}
   */
  const sanitizeIdentifier = (rawValue) => {
    if (typeof rawValue !== 'string' && typeof rawValue !== 'number') return '';
    const cleaned = String(rawValue).trim().toLowerCase();
    if (!/^[a-z0-9_-]{1,64}$/.test(cleaned)) return '';
    if (cleaned === '__proto__' || cleaned === 'constructor' || cleaned === 'prototype') return '';
    return cleaned;
  };

  // Índices em memória O(1) para busca instantânea por ID ou Slug (sem Prototype Chain)
  /** @type {Map<string, Readonly<Product>>} */
  const PRODUCTS_BY_ID = new Map();
  /** @type {Map<string, Readonly<Product>>} */
  const PRODUCTS_BY_SLUG = new Map();

  PRODUCTS_COLLECTION.forEach((product) => {
    PRODUCTS_BY_ID.set(product.id, product);
    PRODUCTS_BY_SLUG.set(product.slug, product);
  });

  /**
   * Repositório de consulta aos produtos (Data Access Layer).
   */
  const ProductRepository = Object.freeze({
    /**
     * Retorna todos os produtos do catálogo.
     * @returns {ReadonlyArray<Readonly<Product>>}
     */
    findAll() {
      return PRODUCTS_COLLECTION;
    },

    /**
     * Busca um produto em tempo constante O(1) pelo seu ID ('1'..'9') ou slug ('okralin-500mg').
     * @param {string | number | null | undefined} idOrSlug
     * @returns {Readonly<Product> | null}
     */
    findById(idOrSlug) {
      const normalized = sanitizeIdentifier(idOrSlug);
      if (!normalized) return null;

      return PRODUCTS_BY_ID.get(normalized) || PRODUCTS_BY_SLUG.get(normalized) || null;
    },

    /**
     * Retorna produtos relacionados (priorizando a mesma categoria), excluindo o produto atual.
     * @param {Readonly<Product>} currentProduct
     * @param {number} [limit=3]
     * @returns {ReadonlyArray<Readonly<Product>>}
     */
    findRelated(currentProduct, limit = 3) {
      if (!currentProduct || typeof currentProduct.id !== 'string') return Object.freeze([]);
      const safeLimit = Math.max(1, Math.min(Number(limit) || 3, PRODUCTS_COLLECTION.length));

      const sameCategory = PRODUCTS_COLLECTION.filter(
        (item) => item.id !== currentProduct.id && item.category === currentProduct.category
      );

      const others = PRODUCTS_COLLECTION.filter(
        (item) => item.id !== currentProduct.id && item.category !== currentProduct.category
      );

      return Object.freeze([...sameCategory, ...others].slice(0, safeLimit));
    }
  });

  // Exposição controlada e imutável no namespace global da aplicação
  Object.defineProperty(window, 'BoticaProductRepository', {
    value: ProductRepository,
    writable: false,
    configurable: false,
    enumerable: true,
  });
})();

