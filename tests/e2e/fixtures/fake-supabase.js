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
  ],
  carousel_slides: [
    {
      id: 'banner-1',
      title: 'Fórmulas Personalizadas para sua Saúde',
      image_url: 'https://fake-storage.local/carousel/banner1.webp',
      image_path: 'carousel/banner1.webp',
      button_link: 'https://wa.me/555185543448',
      display_order: 1,
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
  admin_users: ['user-admin-123'],
};

// Cópia mutável em memória
let db = JSON.parse(JSON.stringify(initialData));

export function resetFakeDatabase() {
  db = JSON.parse(JSON.stringify(initialData));
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
    const list = db[this.table] || [];

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
