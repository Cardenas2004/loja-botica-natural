// @ts-check
/**
 * @fileoverview Fake Supabase Client para Testes E2E (Playwright)
 * Simula supabase-js de forma determinística, offline e sem rede externa.
 */

if (!globalThis.__log) {
  globalThis.__log = [];
}

/**
 * Fixtures padrão de teste
 */
export const initialData = {
  categories: [
    { id: 'cat-1', name: 'Dermocosméticos', slug: 'dermocosmeticos', display_order: 1, is_active: true },
    { id: 'cat-2', name: 'Fitoterapia', slug: 'fitoterapia', display_order: 2, is_active: true },
  ],
  products: [
    {
      id: 'prod-1',
      name: 'Sérum Renovador C',
      sku_ref: 'SER-001',
      category_id: 'cat-1',
      price: 89.9,
      image_url: 'https://fake-storage.local/catalogo/serum.webp',
      image_path: 'catalogo/serum.webp',
      is_active: true,
      is_best_seller: true,
      short_description: 'Vitamina C a 10% pura & Ácido Hialurônico.',
      description: 'Fórmula antioxidante de alta estabilidade para rejuvenescimento facial.',
      usage_instructions: 'Aplicar 4 a 5 gotas pela manhã antes do protetor solar.',
      composition: 'Vitamina C estabilizada 10%, Ácido Hialurônico 1%, Base Sérum q.s.p.',
      package_info: 'Frasco conta-gotas de vidro âmbar 30ml.',
      allergen_info: '',
      quality_note: 'Manipulado conforme Boas Práticas Farmacêuticas.',
      payment_info: 'Pagamento via PIX ou cartão.',
      whatsapp_message: '',
      text_options: {
        _v: 2,
        short_description: 'lines',
        description: 'paragraphs',
        usage_instructions: 'paragraphs',
        composition: 'paragraphs',
        package_info: 'lines',
        allergen_info: 'inline',
        quality_note: 'paragraphs',
        payment_info: 'inline',
      },
      created_at: new Date(Date.now() - 86400000).toISOString(),
      updated_at: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 'prod-2',
      name: 'Composto Calmante Passiflora & Mulungu',
      sku_ref: 'FIT-002',
      category_id: 'cat-2',
      price: 54.9,
      image_url: 'https://fake-storage.local/catalogo/passiflora.webp',
      image_path: 'catalogo/passiflora.webp',
      is_active: true,
      is_best_seller: true,
      short_description: 'Auxilia na modulação do estresse e qualidade do descanso natural.',
      description: 'Extratos padronizados de Passiflora incarnata e Erythrina mulungu para bem-estar integrativo.',
      usage_instructions: 'Tomar 1 cápsula à noite antes de deitar ou conforme orientação.',
      composition: 'Passiflora extrato seco 200mg, Mulungu 150mg, excipiente q.s.p.',
      package_info: 'Pote com 60 cápsulas vegetais.',
      allergen_info: 'Não contém glúten.',
      quality_note: 'Matérias-primas com laudo botânico rastreado.',
      payment_info: 'Consulte condições pelo WhatsApp.',
      whatsapp_message: '',
      text_options: { _v: 2, short_description: 'lines', description: 'paragraphs' },
      created_at: new Date(Date.now() - 80000000).toISOString(),
      updated_at: new Date(Date.now() - 3000000).toISOString(),
    },
    {
      id: 'prod-3',
      name: 'Gel Creme Clareador Ácido Tranexâmico 3%',
      sku_ref: 'DER-003',
      category_id: 'cat-1',
      price: 119.0,
      image_url: 'https://fake-storage.local/catalogo/clareador.webp',
      image_path: 'catalogo/clareador.webp',
      is_active: true,
      is_best_seller: true,
      short_description: 'Auxilia na uniformização do tom da pele e redução de manchas solares.',
      description: 'Fórmula despigmentante avançada para cuidado facial noturno.',
      usage_instructions: 'Aplicar fina camada à noite com a pele limpa e seca.',
      composition: 'Ácido Tranexâmico 3%, Niacinamide 4%, Gel Creme toque seco q.s.p.',
      package_info: 'Bisnaga airless 30g.',
      allergen_info: '',
      quality_note: 'Dermatologicamente testado.',
      payment_info: 'Consulte condições pelo WhatsApp.',
      whatsapp_message: '',
      text_options: { _v: 2 },
      created_at: new Date(Date.now() - 70000000).toISOString(),
      updated_at: new Date(Date.now() - 2000000).toISOString(),
    },
    {
      id: 'prod-4',
      name: 'Alcachofra + Berinjela 60 cápsulas',
      sku_ref: 'FIT-004',
      category_id: 'cat-2',
      price: 49.9,
      image_url: 'https://fake-storage.local/catalogo/alcachofra.webp',
      image_path: 'catalogo/alcachofra.webp',
      is_active: true,
      is_best_seller: true,
      short_description: 'Suporte à digestão saudável e equilíbrio lipídico.',
      description: 'Combinação clássica de fitoterápicos auxiliares da função hepática e digestiva.',
      usage_instructions: 'Ingerir 1 cápsula antes do almoço e 1 antes do jantar.',
      composition: 'Cynara scolymus 250mg, Solanum melongena 250mg.',
      package_info: 'Frasco com 60 cápsulas.',
      allergen_info: '',
      quality_note: 'Rigoroso controle de pureza.',
      payment_info: 'Consulte condições pelo WhatsApp.',
      whatsapp_message: '',
      text_options: { _v: 2 },
      created_at: new Date(Date.now() - 60000000).toISOString(),
      updated_at: new Date(Date.now() - 1500000).toISOString(),
    },
    {
      id: 'prod-5',
      name: 'Loção Hidratante com Ureia 10%',
      sku_ref: 'DER-005',
      category_id: 'cat-1',
      price: 42.0,
      image_url: 'https://fake-storage.local/catalogo/ureia.webp',
      image_path: 'catalogo/ureia.webp',
      is_active: true,
      is_best_seller: false,
      short_description: 'Hidratação profunda e restauração da barreira cutânea para peles secas.',
      description: 'Emulsão cremosa emoliente formulada com ureia purificada.',
      usage_instructions: 'Aplicar 2 a 3 vezes ao dia nas áreas ressecadas.',
      composition: 'Ureia 10%, Óleo de Amêndoas Doces 5%, Loção cremosa q.s.p.',
      package_info: 'Frasco com válvula pump 200ml.',
      allergen_info: '',
      quality_note: 'Controle farmacêutico rigoroso.',
      payment_info: 'Consulte condições pelo WhatsApp.',
      whatsapp_message: '',
      text_options: { _v: 2 },
      created_at: new Date(Date.now() - 50000000).toISOString(),
      updated_at: new Date(Date.now() - 1000000).toISOString(),
    },
    {
      id: 'prod-6',
      name: 'Extrato Concentrado de Própolis Verde 30ml',
      sku_ref: 'FIT-006',
      category_id: 'cat-2',
      price: 38.5,
      image_url: 'https://fake-storage.local/catalogo/propolis.webp',
      image_path: 'catalogo/propolis.webp',
      is_active: true,
      is_best_seller: false,
      short_description: 'Alta concentração de artepillin-C e flavonoides naturais.',
      description: 'Extrato hidroalcoólico padronizado de própolis verde brasileira.',
      usage_instructions: 'Diluir 20 a 30 gotas em água ou suco pela manhã.',
      composition: 'Extrato alcoólico de própolis verde mínima 11% p/v.',
      package_info: 'Frasco de vidro âmbar com conta-gotas 30ml.',
      allergen_info: 'Contém álcool de cereais.',
      quality_note: 'Origem botânica rastreada.',
      payment_info: 'Consulte condições pelo WhatsApp.',
      whatsapp_message: '',
      text_options: { _v: 2 },
      created_at: new Date(Date.now() - 40000000).toISOString(),
      updated_at: new Date(Date.now() - 800000).toISOString(),
    },
    {
      id: 'prod-7',
      name: 'Colágeno Verisol com Ácido Hialurônico e Biotina',
      sku_ref: 'DER-007',
      category_id: 'cat-1',
      price: 135.0,
      image_url: 'https://fake-storage.local/catalogo/colageno.webp',
      image_path: 'catalogo/colageno.webp',
      is_active: true,
      is_best_seller: false,
      short_description: 'Nutricosmético para sustentação cutânea, elasticidade e saúde capilar.',
      description: 'Peptídeos bioativos de colágeno Verisol enriquecidos com vitaminas antioxidantes.',
      usage_instructions: 'Tomar 1 sachê ao dia dissolvido em 200ml de água.',
      composition: 'Peptídeos Verisol 2,5g, Ácido Hialurônico 100mg, Biotina 45mcg, Vit C 100mg.',
      package_info: 'Caixa com 30 sachês sabor frutas vermelhas.',
      allergen_info: '',
      quality_note: 'Matéria-prima patenteada internacional.',
      payment_info: 'Consulte condições pelo WhatsApp.',
      whatsapp_message: '',
      text_options: { _v: 2 },
      created_at: new Date(Date.now() - 30000000).toISOString(),
      updated_at: new Date(Date.now() - 500000).toISOString(),
    },
    {
      id: 'prod-8',
      name: 'Fórmula Magistral Personalizada Sob Medida',
      sku_ref: 'ESP-008',
      category_id: 'cat-2',
      price: 0.0,
      image_url: 'https://fake-storage.local/catalogo/personalizada.webp',
      image_path: 'catalogo/personalizada.webp',
      is_active: true,
      is_best_seller: false,
      short_description: 'Manipulada estritamente conforme a sua prescrição médica ou nutricional.',
      description: 'Envie sua receita médica para orçamento individualizado e manipulação sob medida.',
      usage_instructions: 'Conforme prescrição médica.',
      composition: 'Ativos personalizados conforme receita.',
      package_info: 'Embalagem farmacêutica adequada à forma prescrita.',
      allergen_info: '',
      quality_note: 'Conferência farmacêutica em dupla checagem.',
      payment_info: 'Sob consulta via WhatsApp.',
      whatsapp_message: '',
      text_options: { _v: 2 },
      created_at: new Date(Date.now() - 20000000).toISOString(),
      updated_at: new Date(Date.now() - 200000).toISOString(),
    },
  ],
  carousel_slides: [
    {
      id: 'banner-1',
      title: 'Fórmulas Personalizadas para sua Saúde',
      image_url:
        'https://njdkuhgoophzjxmmempu.supabase.co/storage/v1/object/public/product-images/carousel/banner1.webp',
      image_path: 'carousel/banner1.webp',
      button_link: 'https://wa.me/555185543448',
      focus_x: 50,
      focus_y: 50,
      display_order: 1,
      is_active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 'banner-2',
      title: 'Manipulação Magistral com Qualidade e Rastreabilidade',
      image_url:
        'https://njdkuhgoophzjxmmempu.supabase.co/storage/v1/object/public/product-images/carousel/banner2.webp',
      image_path: 'carousel/banner2.webp',
      button_link: 'produtos.html',
      focus_x: 35,
      focus_y: 65,
      display_order: 2,
      is_active: true,
      created_at: new Date().toISOString(),
    },
  ],
  site_settings: [
    {
      key: 'whatsapp_product_message_template',
      value: 'Olá! Gostaria de encomendar a fórmula *{produto}* (Ref: {sku}) anunciada por {preco}. {link}',
      updated_at: new Date().toISOString(),
    },
  ],
  compound_showcase_cards: [
    {
      id: 'comp-1',
      title: 'COMPOSTO\nALCACHOFRA + BERINJELA',
      label_subtitle: 'COMPOSTO DIGESTIVO',
      label_title: 'ALCACHOFRA\n+ BERINJELA',
      label_badge: '60 CÁPSULAS',
      show_label: true,
      button_text: 'COMPRAR',
      button_link: 'produto.html?id=prod-4',
      product_id: 'prod-4',
      open_in_new_tab: false,
      show_button: true,
      card_theme: 'green',
      badge_color: 'green',
      title_align: 'center',
      botanical_theme: 'alcachofra',
      show_capsules: true,
      image_url: null,
      image_path: null,
      botanical_image_url: null,
      botanical_image_path: null,
      display_order: 0,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'comp-2',
      title: 'COMPOSTO PARA\nMENOPAUSA',
      label_subtitle: 'COMPOSTO PARA',
      label_title: 'MENOPAUSA',
      label_badge: '60 CÁPSULAS',
      show_label: true,
      button_text: 'COMPRAR',
      button_link: '#produtos',
      product_id: null,
      open_in_new_tab: false,
      show_button: true,
      card_theme: 'purple',
      badge_color: 'green',
      title_align: 'center',
      botanical_theme: 'amora',
      show_capsules: true,
      image_url: null,
      image_path: null,
      botanical_image_url: null,
      botanical_image_path: null,
      display_order: 1,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'comp-3',
      title: 'COMPOSTO\nANTI-REUMÁTICO',
      label_subtitle: 'COMPOSTO PARA DOR',
      label_title: 'ANTI-REUMÁTICO',
      label_badge: '60 CÁPSULAS',
      show_label: true,
      button_text: 'COMPRAR',
      button_link: '#produtos',
      product_id: null,
      open_in_new_tab: false,
      show_button: true,
      card_theme: 'green',
      badge_color: 'green',
      title_align: 'center',
      botanical_theme: 'curcuma',
      show_capsules: true,
      image_url: null,
      image_path: null,
      botanical_image_url: null,
      botanical_image_path: null,
      display_order: 2,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'comp-4',
      title: 'COMPOSTO\nDRENANTE',
      label_subtitle: 'AÇÃO DETOX E DIURÉTICA',
      label_title: 'COMPOSTO\nDRENANTE',
      label_badge: '60 CÁPSULAS',
      show_label: true,
      button_text: 'COMPRAR',
      button_link: '#produtos',
      product_id: null,
      open_in_new_tab: false,
      show_button: true,
      card_theme: 'purple',
      badge_color: 'green',
      title_align: 'center',
      botanical_theme: 'hibisco',
      show_capsules: true,
      image_url: null,
      image_path: null,
      botanical_image_url: null,
      botanical_image_path: null,
      display_order: 3,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'comp-5',
      title: 'COMPOSTO\nCALMANTE',
      label_subtitle: 'EQUILÍBRIO E SONO',
      label_title: 'COMPOSTO\nCALMANTE',
      label_badge: '60 CÁPSULAS',
      show_label: true,
      button_text: 'COMPRAR',
      button_link: 'produto.html?id=prod-2',
      product_id: 'prod-2',
      open_in_new_tab: false,
      show_button: true,
      card_theme: 'green',
      badge_color: 'green',
      title_align: 'center',
      botanical_theme: 'maracuja',
      show_capsules: true,
      image_url: null,
      image_path: null,
      botanical_image_url: null,
      botanical_image_path: null,
      display_order: 4,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'comp-6',
      title: 'COMPOSTO PARA\nMANCHAS NA PELE',
      label_subtitle: 'CUIDADO DERMATOLÓGICO',
      label_title: 'MANCHAS\nNA PELE',
      label_badge: '60 CÁPSULAS',
      show_label: true,
      button_text: 'COMPRAR',
      button_link: 'produto.html?id=prod-3',
      product_id: 'prod-3',
      open_in_new_tab: false,
      show_button: true,
      card_theme: 'purple',
      badge_color: 'green',
      title_align: 'center',
      botanical_theme: 'romana',
      show_capsules: true,
      image_url: null,
      image_path: null,
      botanical_image_url: null,
      botanical_image_path: null,
      display_order: 5,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  admin_users: ['user-admin-123'],
};

const DB_STORAGE_KEY = '__bn_fake_db__';

function loadDb() {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const stored = window.sessionStorage.getItem(DB_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    }
  } catch {}
  return JSON.parse(JSON.stringify(initialData));
}

function persistDb() {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(DB_STORAGE_KEY, JSON.stringify(db));
    }
  } catch {}
}

// Cópia mutável em memória persistida no sessionStorage da aba
let db = loadDb();

export function resetFakeDatabase() {
  db = JSON.parse(JSON.stringify(initialData));
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem(DB_STORAGE_KEY);
    }
  } catch {}
  globalThis.__log = [];
}

const authListeners = new Set();
let currentUser = {
  id: 'user-admin-123',
  email: 'admin@boticanatural.com.br',
  role: 'authenticated',
};
let currentSession = {
  user: currentUser,
  access_token: 'fake-jwt-token-123',
};

// Expõe disparador global de eventos para testes
globalThis.__dispatchAuthEvent = (event, customSession = null) => {
  const sess = customSession !== null ? customSession : currentSession;
  for (const listener of authListeners) {
    try {
      listener(event, sess);
    } catch (e) {
      console.error('[fake-supabase] Erro no listener auth:', e);
    }
  }
};

globalThis.__setFakeAdmin = (isAdmin) => {
  if (isAdmin) {
    if (!db.admin_users.includes(currentUser.id)) db.admin_users.push(currentUser.id);
  } else {
    db.admin_users = db.admin_users.filter((id) => id !== currentUser.id);
  }
};

class FakeQueryBuilder {
  constructor(table) {
    this.table = table;
    this.filters = [];
    this.orderClause = null;
    this.limitCount = null;
    this.rangeFrom = null;
    this.rangeTo = null;
    this.isSingle = false;
    this.isMaybeSingle = false;
    this.operation = 'SELECT';
    this.mutationData = null;
  }

  select(columns = '*', options = {}) {
    this.columns = columns;
    this.selectOptions = options;
    return this;
  }

  eq(column, value) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  in(column, values) {
    const set = new Set(values);
    this.filters.push((row) => set.has(row[column]));
    return this;
  }

  order(column, { ascending = true } = {}) {
    this.orderClause = { column, ascending };
    return this;
  }

  limit(n) {
    this.limitCount = n;
    return this;
  }

  range(from, to) {
    this.rangeFrom = from;
    this.rangeTo = to;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    return this;
  }

  insert(data) {
    this.operation = 'INSERT';
    this.mutationData = Array.isArray(data) ? data : [data];
    return this;
  }

  update(data) {
    this.operation = 'UPDATE';
    this.mutationData = data;
    return this;
  }

  delete() {
    this.operation = 'DELETE';
    return this;
  }

  async then(resolve, reject) {
    try {
      const result = this._execute();
      resolve(result);
    } catch (err) {
      reject(err);
    }
  }

  _execute() {
    if (!db[this.table]) {
      db[this.table] = [];
    }
    const list = db[this.table];

    globalThis.__log.push({
      timestamp: Date.now(),
      operation: this.operation,
      table: this.table,
      mutationData: this.mutationData,
    });

    if (this.operation === 'INSERT') {
      const inserted = [];
      for (const item of this.mutationData) {
        const row = {
          ...item,
          id: item.id || `id-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        list.push(row);
        inserted.push(row);
      }
      persistDb();
      return { data: inserted, error: null };
    }

    if (this.operation === 'UPDATE') {
      let matchedCount = 0;
      const updatedRows = [];
      for (const row of list) {
        const matches = this.filters.every((fn) => fn(row));
        if (matches) {
          matchedCount++;
          Object.assign(row, this.mutationData, { updated_at: new Date().toISOString() });
          updatedRows.push(row);
        }
      }
      persistDb();
      return { data: updatedRows, error: null, count: matchedCount };
    }

    if (this.operation === 'DELETE') {
      const remaining = [];
      const deleted = [];
      for (const row of list) {
        const matches = this.filters.every((fn) => fn(row));
        if (matches) {
          deleted.push(row);
        } else {
          remaining.push(row);
        }
      }
      db[this.table] = remaining;
      persistDb();
      return { data: deleted, error: null };
    }

    // SELECT
    let result = list.filter((row) => this.filters.every((fn) => fn(row)));
    const totalCount = result.length;

    if (this.orderClause) {
      const { column, ascending } = this.orderClause;
      result.sort((a, b) => {
        if (a[column] < b[column]) return ascending ? -1 : 1;
        if (a[column] > b[column]) return ascending ? 1 : -1;
        return 0;
      });
    }

    if (this.rangeFrom !== null && this.rangeTo !== null) {
      result = result.slice(this.rangeFrom, this.rangeTo + 1);
    } else if (this.limitCount !== null) {
      result = result.slice(0, this.limitCount);
    }

    if (this.isSingle) {
      if (result.length === 0) {
        return { data: null, error: { message: 'Row not found', code: 'PGRST116' }, count: 0 };
      }
      return { data: result[0], error: null, count: 1 };
    }

    if (this.isMaybeSingle) {
      return { data: result.length > 0 ? result[0] : null, error: null, count: result.length };
    }

    return {
      data: result,
      error: null,
      count: this.selectOptions?.count ? totalCount : result.length,
    };
  }
}

export function createClient(supabaseUrl, supabaseKey, options = {}) {
  return {
    from(table) {
      return new FakeQueryBuilder(table);
    },
    async rpc(fnName, params = {}) {
      globalThis.__log.push({
        timestamp: Date.now(),
        operation: 'RPC',
        fnName,
        params,
      });

      if (fnName === 'is_admin') {
        const isAdmin = Boolean(currentUser && db.admin_users.includes(currentUser.id));
        return { data: isAdmin, error: null };
      }
      return { data: null, error: { message: `Unknown RPC ${fnName}` } };
    },
    auth: {
      async getSession() {
        return { data: { session: currentSession }, error: null };
      },
      async getUser() {
        return { data: { user: currentUser }, error: null };
      },
      async signInWithPassword({ email, password }) {
        currentUser = {
          id: 'user-admin-123',
          email: email || 'admin@boticanatural.com.br',
          role: 'authenticated',
        };
        currentSession = { user: currentUser, access_token: 'fake-token' };
        for (const listener of authListeners) {
          listener('SIGNED_IN', currentSession);
        }
        return { data: { user: currentUser, session: currentSession }, error: null };
      },
      async signOut() {
        currentUser = null;
        currentSession = null;
        for (const listener of authListeners) {
          listener('SIGNED_OUT', null);
        }
        return { error: null };
      },
      onAuthStateChange(callback) {
        authListeners.add(callback);
        return {
          data: {
            subscription: {
              unsubscribe: () => authListeners.delete(callback),
            },
          },
        };
      },
    },
    storage: {
      from(bucket) {
        return {
          async upload(filePath, fileBody, fileOptions = {}) {
            globalThis.__log.push({
              timestamp: Date.now(),
              operation: 'STORAGE_UPLOAD',
              bucket,
              filePath,
              fileOptions,
            });
            return {
              data: { path: filePath },
              error: null,
            };
          },
          async remove(paths) {
            globalThis.__log.push({
              timestamp: Date.now(),
              operation: 'STORAGE_REMOVE',
              bucket,
              paths,
            });
            return { data: paths, error: null };
          },
          getPublicUrl(filePath) {
            return {
              data: {
                publicUrl: `https://fake-storage.local/${bucket}/${filePath}`,
              },
            };
          },
        };
      },
    },
  };
}
