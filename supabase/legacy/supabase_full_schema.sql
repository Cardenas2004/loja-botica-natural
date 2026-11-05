DO $$ BEGIN RAISE EXCEPTION 'ARQUIVO LEGADO — NÃO EXECUTAR. Use supabase/migrations/.'; END $$;

-- ============================================================================
-- BOTICA NATURAL — SCRIPT SQL MESTRE DEFINITIVO (SUPABASE SQL EDITOR)
-- Arquivo: supabase_full_schema.sql
-- Compatibilidade: PostgreSQL 15+ (Supabase) · 100% Idempotente · Zero-Trust RLS
-- Como usar:
--   1. Copie todo este script, cole no "SQL Editor" do Supabase e clique em "Run".
--   2. Em seguida, descomente e execute o bloco final (Seção 10) com o seu e-mail
--      de login para habilitar sua conta como administradora em `public.admin_users`.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. EXTENSÕES DO POSTGRESQL
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 2. TABELA DE ADMINISTRADORES E FUNÇÕES DE SEGURANÇA (ZERO-TRUST)
-- ============================================================================

-- 2.1. Trigger genérica para atualizar `updated_at` automaticamente em qualquer UPDATE
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_updated_at() IS
  'Atualiza automaticamente a coluna updated_at com NOW() antes de cada UPDATE.';

-- 2.2. Tabela de Administradores Autorizados (`public.admin_users`)
-- Sem policies de escrita para `anon` ou `authenticated` (somente `service_role` / SQL Editor gerenciam)
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id    UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.admin_users IS
  'Lista de user_ids (auth.users) com permissão de administrador no painel da Botica Natural.';

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.admin_users FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.admin_users TO authenticated;
GRANT ALL ON TABLE public.admin_users TO service_role;

DROP POLICY IF EXISTS "admin_users_select_self" ON public.admin_users;
CREATE POLICY "admin_users_select_self"
  ON public.admin_users
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 2.3. Função `public.is_admin()` (SECURITY DEFINER + STABLE + search_path fixo)
-- Não confia em `user_metadata` nem `app_metadata` do JWT; consulta apenas `public.admin_users`
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.admin_users
     WHERE user_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.is_admin() IS
  'Retorna true exclusivamente quando auth.uid() consta em public.admin_users.';

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- ============================================================================
-- 3. TABELAS DE NEGÓCIO E MIGRAÇÃO INCREMENTAL DE COLUNAS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 3.1. Tabela: `public.categories`
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categories (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL DEFAULT 'Categoria',
  slug          TEXT        NOT NULL DEFAULT '',
  display_order INT         NOT NULL DEFAULT 0,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'Categoria';
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS slug TEXT NOT NULL DEFAULT '';
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS display_order INT NOT NULL DEFAULT 0;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_name ON public.categories (name);
CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_slug ON public.categories (slug);

COMMENT ON TABLE public.categories IS 'Categorias e formas farmacêuticas dos produtos da Botica Natural.';

-- ----------------------------------------------------------------------------
-- 3.2. Tabela: `public.products`
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
  id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id        UUID          REFERENCES public.categories(id) ON DELETE SET NULL,
  name               TEXT          NOT NULL DEFAULT 'Produto',
  sku_ref            TEXT          NOT NULL DEFAULT '',
  short_description  TEXT          NOT NULL DEFAULT '',
  description        TEXT          NOT NULL DEFAULT '',
  price              NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  payment_info       TEXT          NOT NULL DEFAULT 'Consulte formas de pagamento via WhatsApp / Cartão e Pix',
  benefits           TEXT          NOT NULL DEFAULT '',
  usage_instructions TEXT          NOT NULL DEFAULT '',
  composition        TEXT          NOT NULL DEFAULT '',
  package_info       TEXT          NOT NULL DEFAULT '',
  allergen_info      TEXT          NOT NULL DEFAULT 'Não contém lactose e glúten.',
  quality_note       TEXT          NOT NULL DEFAULT 'Todos os produtos da Botica Natural são preparados com matérias-primas selecionadas e rigoroso controle de qualidade farmacêutico, garantindo melhor eficácia.',
  whatsapp_message   TEXT          NOT NULL DEFAULT '',
  text_options       JSONB         NOT NULL DEFAULT '{}'::jsonb,
  image_url          TEXT          NOT NULL DEFAULT '',
  image_path         TEXT          NOT NULL DEFAULT '',
  is_active          BOOLEAN       NOT NULL DEFAULT true,
  is_best_seller     BOOLEAN       NOT NULL DEFAULT false,
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'Produto';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sku_ref TEXT NOT NULL DEFAULT '';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS short_description TEXT NOT NULL DEFAULT '';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price NUMERIC(10,2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS payment_info TEXT NOT NULL DEFAULT 'Consulte formas de pagamento via WhatsApp / Cartão e Pix';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS benefits TEXT NOT NULL DEFAULT '';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS usage_instructions TEXT NOT NULL DEFAULT '';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS composition TEXT NOT NULL DEFAULT '';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS package_info TEXT NOT NULL DEFAULT '';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS allergen_info TEXT NOT NULL DEFAULT 'Não contém lactose e glúten.';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS quality_note TEXT NOT NULL DEFAULT 'Todos os produtos da Botica Natural são preparados com matérias-primas selecionadas e rigoroso controle de qualidade farmacêutico, garantindo melhor eficácia.';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS whatsapp_message TEXT NOT NULL DEFAULT '';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS text_options JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_url TEXT NOT NULL DEFAULT '';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_path TEXT NOT NULL DEFAULT '';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_best_seller BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

COMMENT ON TABLE public.products IS 'Catálogo geral de fórmulas magistrais e produtos manipulados.';

-- ----------------------------------------------------------------------------
-- 3.3. Tabela: `public.carousel_slides`
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.carousel_slides (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT        NOT NULL DEFAULT '',
  button_link       TEXT        NOT NULL DEFAULT '',
  image_url         TEXT        NOT NULL DEFAULT '',
  image_path        TEXT        NOT NULL DEFAULT '',
  mobile_image_url  TEXT        NOT NULL DEFAULT '',
  mobile_image_path TEXT        NOT NULL DEFAULT '',
  display_order     INT         NOT NULL DEFAULT 0,
  is_active         BOOLEAN     NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.carousel_slides ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';
ALTER TABLE public.carousel_slides ADD COLUMN IF NOT EXISTS button_link TEXT NOT NULL DEFAULT '';
ALTER TABLE public.carousel_slides ADD COLUMN IF NOT EXISTS image_url TEXT NOT NULL DEFAULT '';
ALTER TABLE public.carousel_slides ADD COLUMN IF NOT EXISTS image_path TEXT NOT NULL DEFAULT '';
ALTER TABLE public.carousel_slides ADD COLUMN IF NOT EXISTS mobile_image_url TEXT NOT NULL DEFAULT '';
ALTER TABLE public.carousel_slides ADD COLUMN IF NOT EXISTS mobile_image_path TEXT NOT NULL DEFAULT '';
ALTER TABLE public.carousel_slides ADD COLUMN IF NOT EXISTS display_order INT NOT NULL DEFAULT 0;
ALTER TABLE public.carousel_slides ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.carousel_slides ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.carousel_slides ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

COMMENT ON TABLE public.carousel_slides IS 'Banners rotativos do carrossel Hero gerenciados pelo painel administrativo.';

-- ----------------------------------------------------------------------------
-- 3.4. Tabela: `public.site_settings`
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.site_settings (
  key         TEXT        PRIMARY KEY,
  value       TEXT        NOT NULL DEFAULT '',
  description TEXT        NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  TEXT        NOT NULL DEFAULT ''
);

ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS value TEXT NOT NULL DEFAULT '';
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS updated_by TEXT NOT NULL DEFAULT '';

DO $$
BEGIN
  ALTER TABLE public.site_settings DROP CONSTRAINT IF EXISTS site_settings_updated_by_fkey;
  ALTER TABLE public.site_settings ALTER COLUMN updated_by TYPE TEXT USING coalesce(updated_by::text, '');
  ALTER TABLE public.site_settings ALTER COLUMN updated_by SET DEFAULT '';
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

COMMENT ON TABLE public.site_settings IS 'Parâmetros dinâmicos e configurações globais (ex.: template de WhatsApp).';

-- ============================================================================
-- 4. SANEAMENTO DEFENSIVO E CONSTRAINTS DE HIGIENE (CHECK)
-- ============================================================================

-- Saneia eventuais registros legados inválidos antes de aplicar as constraints CHECK,
-- garantindo que o script nunca falhe com erro 23514 em bancos já populados.
UPDATE public.products
   SET price = 0
 WHERE price IS NULL OR price < 0;

UPDATE public.products
   SET name = 'Produto sem nome'
 WHERE btrim(coalesce(name, '')) = '';

UPDATE public.products
   SET name = left(btrim(name), 200)
 WHERE char_length(btrim(name)) > 200;

UPDATE public.products
   SET text_options = '{}'::jsonb
 WHERE text_options IS NULL OR jsonb_typeof(text_options) <> 'object';

UPDATE public.products
   SET short_description  = left(coalesce(short_description, ''), 2000),
       description        = left(coalesce(description, ''), 25000),
       usage_instructions = left(coalesce(usage_instructions, ''), 15000),
       composition        = left(coalesce(composition, ''), 15000),
       package_info       = left(coalesce(package_info, ''), 10000),
       allergen_info      = left(coalesce(allergen_info, ''), 5000),
       quality_note       = left(coalesce(quality_note, ''), 5000),
       payment_info       = left(coalesce(payment_info, ''), 2000),
       whatsapp_message   = left(coalesce(whatsapp_message, ''), 4000);

UPDATE public.categories
   SET name = 'Categoria ' || left(id::text, 8)
 WHERE btrim(coalesce(name, '')) = '';

UPDATE public.categories
   SET name = left(btrim(name), 200)
 WHERE char_length(btrim(name)) > 200;

UPDATE public.carousel_slides
   SET button_link = ''
 WHERE btrim(coalesce(button_link, '')) <> ''
   AND NOT (
     button_link ~* '^https?://[^[:space:]]+$'
     OR (
       button_link !~* '^[a-z][a-z0-9+.-]*:'
       AND button_link !~ '^//'
       AND button_link !~ '[[:cntrl:]]'
     )
   );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'chk_products_price_non_negative'
       AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT chk_products_price_non_negative
      CHECK (price >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'chk_products_name_length'
       AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT chk_products_name_length
      CHECK (char_length(btrim(name)) BETWEEN 1 AND 200);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'chk_products_text_options_object'
       AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT chk_products_text_options_object
      CHECK (jsonb_typeof(text_options) = 'object');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'chk_products_text_lengths'
       AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT chk_products_text_lengths
      CHECK (
        (short_description IS NULL OR char_length(short_description) <= 2000) AND
        (description IS NULL OR char_length(description) <= 25000) AND
        (usage_instructions IS NULL OR char_length(usage_instructions) <= 15000) AND
        (composition IS NULL OR char_length(composition) <= 15000) AND
        (package_info IS NULL OR char_length(package_info) <= 10000) AND
        (allergen_info IS NULL OR char_length(allergen_info) <= 5000) AND
        (quality_note IS NULL OR char_length(quality_note) <= 5000) AND
        (payment_info IS NULL OR char_length(payment_info) <= 2000) AND
        (whatsapp_message IS NULL OR char_length(whatsapp_message) <= 4000)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'chk_categories_name_length'
       AND conrelid = 'public.categories'::regclass
  ) THEN
    ALTER TABLE public.categories
      ADD CONSTRAINT chk_categories_name_length
      CHECK (char_length(btrim(name)) BETWEEN 1 AND 200);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'chk_carousel_slides_button_link_safe'
       AND conrelid = 'public.carousel_slides'::regclass
  ) THEN
    ALTER TABLE public.carousel_slides
      ADD CONSTRAINT chk_carousel_slides_button_link_safe
      CHECK (
        btrim(button_link) = ''
        OR button_link ~* '^https?://[^[:space:]]+$'
        OR (
          button_link !~* '^[a-z][a-z0-9+.-]*:'
          AND button_link !~ '^//'
          AND button_link !~ '[[:cntrl:]]'
        )
      );
  END IF;
END $$;

-- ============================================================================
-- 5. ÍNDICES DE PERFORMANCE B-TREE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_categories_active_order
  ON public.categories (is_active, display_order ASC);
CREATE INDEX IF NOT EXISTS idx_categories_slug
  ON public.categories (slug);

CREATE INDEX IF NOT EXISTS idx_products_category_id
  ON public.products (category_id);
CREATE INDEX IF NOT EXISTS idx_products_active
  ON public.products (is_active);
CREATE INDEX IF NOT EXISTS idx_products_best_seller
  ON public.products (is_best_seller) WHERE is_best_seller = true;
CREATE INDEX IF NOT EXISTS idx_products_active_created
  ON public.products (is_active, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_carousel_active_order
  ON public.carousel_slides (is_active, display_order ASC);
CREATE INDEX IF NOT EXISTS idx_carousel_active_created
  ON public.carousel_slides (is_active, created_at DESC);

-- ============================================================================
-- 6. TRIGGERS AUTOMÁTICOS DE ATUALIZAÇÃO (`updated_at`)
-- ============================================================================
DROP TRIGGER IF EXISTS trg_categories_updated_at ON public.categories;
CREATE TRIGGER trg_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_products_updated_at ON public.products;
CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_carousel_slides_updated_at ON public.carousel_slides;
CREATE TRIGGER trg_carousel_slides_updated_at
  BEFORE UPDATE ON public.carousel_slides
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_site_settings_updated_at ON public.site_settings;
CREATE TRIGGER trg_site_settings_updated_at
  BEFORE UPDATE ON public.site_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 7. SEGURANÇA ZERO-TRUST: ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carousel_slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.categories TO authenticated;

GRANT SELECT ON public.products TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;

GRANT SELECT ON public.carousel_slides TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.carousel_slides TO authenticated;

GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.site_settings TO authenticated;

-- ----------------------------------------------------------------------------
-- 7.1. Políticas RLS: `public.categories`
-- (Separadas para `anon` e `authenticated` pois `is_admin()` tem REVOKE para `anon`)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "categories_select_public" ON public.categories;
DROP POLICY IF EXISTS "categories_select_anon" ON public.categories;
DROP POLICY IF EXISTS "categories_select_authenticated" ON public.categories;
DROP POLICY IF EXISTS "categories_insert_admin" ON public.categories;
DROP POLICY IF EXISTS "categories_update_admin" ON public.categories;
DROP POLICY IF EXISTS "categories_delete_admin" ON public.categories;

CREATE POLICY "categories_select_anon"
  ON public.categories FOR SELECT
  TO anon
  USING (is_active = true);

CREATE POLICY "categories_select_authenticated"
  ON public.categories FOR SELECT
  TO authenticated
  USING (is_active = true OR public.is_admin());

CREATE POLICY "categories_insert_admin"
  ON public.categories FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "categories_update_admin"
  ON public.categories FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "categories_delete_admin"
  ON public.categories FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 7.2. Políticas RLS: `public.products`
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "products_select_public" ON public.products;
DROP POLICY IF EXISTS "products_select_anon" ON public.products;
DROP POLICY IF EXISTS "products_select_authenticated" ON public.products;
DROP POLICY IF EXISTS "products_insert_admin" ON public.products;
DROP POLICY IF EXISTS "products_update_admin" ON public.products;
DROP POLICY IF EXISTS "products_delete_admin" ON public.products;

CREATE POLICY "products_select_anon"
  ON public.products FOR SELECT
  TO anon
  USING (is_active = true);

CREATE POLICY "products_select_authenticated"
  ON public.products FOR SELECT
  TO authenticated
  USING (is_active = true OR public.is_admin());

CREATE POLICY "products_insert_admin"
  ON public.products FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "products_update_admin"
  ON public.products FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "products_delete_admin"
  ON public.products FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 7.3. Políticas RLS: `public.carousel_slides`
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "carousel_slides_select_public" ON public.carousel_slides;
DROP POLICY IF EXISTS "carousel_slides_select_anon" ON public.carousel_slides;
DROP POLICY IF EXISTS "carousel_slides_select_authenticated" ON public.carousel_slides;
DROP POLICY IF EXISTS "carousel_slides_insert_admin" ON public.carousel_slides;
DROP POLICY IF EXISTS "carousel_slides_update_admin" ON public.carousel_slides;
DROP POLICY IF EXISTS "carousel_slides_delete_admin" ON public.carousel_slides;

CREATE POLICY "carousel_slides_select_anon"
  ON public.carousel_slides FOR SELECT
  TO anon
  USING (is_active = true);

CREATE POLICY "carousel_slides_select_authenticated"
  ON public.carousel_slides FOR SELECT
  TO authenticated
  USING (is_active = true OR public.is_admin());

CREATE POLICY "carousel_slides_insert_admin"
  ON public.carousel_slides FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "carousel_slides_update_admin"
  ON public.carousel_slides FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "carousel_slides_delete_admin"
  ON public.carousel_slides FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 7.4. Políticas RLS: `public.site_settings` (Whitelist de chaves públicas)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "site_settings_select_public" ON public.site_settings;
DROP POLICY IF EXISTS "site_settings_select_anon" ON public.site_settings;
DROP POLICY IF EXISTS "site_settings_select_authenticated" ON public.site_settings;
DROP POLICY IF EXISTS "site_settings_insert_admin" ON public.site_settings;
DROP POLICY IF EXISTS "site_settings_update_admin" ON public.site_settings;
DROP POLICY IF EXISTS "site_settings_delete_admin" ON public.site_settings;

CREATE POLICY "site_settings_select_anon"
  ON public.site_settings FOR SELECT
  TO anon
  USING (key IN ('whatsapp_product_message_template'));

CREATE POLICY "site_settings_select_authenticated"
  ON public.site_settings FOR SELECT
  TO authenticated
  USING (key IN ('whatsapp_product_message_template') OR public.is_admin());

CREATE POLICY "site_settings_insert_admin"
  ON public.site_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "site_settings_update_admin"
  ON public.site_settings FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "site_settings_delete_admin"
  ON public.site_settings FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- 8. SUPABASE STORAGE (`product-images` — LIMITE 2 MB, ESCRITA SÓ ADMIN)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  2097152,
  ARRAY['image/webp', 'image/jpeg', 'image/png']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/webp', 'image/jpeg', 'image/png']::text[];

DROP POLICY IF EXISTS "product_images_select_public" ON storage.objects;
DROP POLICY IF EXISTS "product_images_insert_auth" ON storage.objects;
DROP POLICY IF EXISTS "product_images_update_auth" ON storage.objects;
DROP POLICY IF EXISTS "product_images_delete_auth" ON storage.objects;
DROP POLICY IF EXISTS "product_images_insert_admin" ON storage.objects;
DROP POLICY IF EXISTS "product_images_update_admin" ON storage.objects;
DROP POLICY IF EXISTS "product_images_delete_admin" ON storage.objects;

CREATE POLICY "product_images_select_public"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'product-images');

CREATE POLICY "product_images_insert_admin"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND public.is_admin()
  );

CREATE POLICY "product_images_update_admin"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND public.is_admin()
  )
  WITH CHECK (
    bucket_id = 'product-images'
    AND public.is_admin()
  );

CREATE POLICY "product_images_delete_admin"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND public.is_admin()
  );

-- ============================================================================
-- 9. SEEDS INICIAIS IDEMPOTENTES (CATEGORIAS E TEMPLATE DE WHATSAPP)
-- ============================================================================
INSERT INTO public.categories (name, slug, display_order, is_active)
VALUES
  ('Cápsulas', 'capsulas', 1, true),
  ('Xaropes & Florais', 'xaropes-florais', 2, true),
  ('Cosméticos & Séruns', 'cosmeticos-seruns', 3, true),
  ('Sachês & Chás', 'saches-chas', 4, true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.site_settings (key, value, description, updated_by)
VALUES (
  'whatsapp_product_message_template',
  'Olá! Tenho interesse no produto *{produto}* (Categoria: {categoria} | Valor: {preco}). Vi no site da Botica Natural ({link}) e gostaria de tirar dúvidas com o farmacêutico e fazer meu pedido!',
  'Template de mensagem personalizada pré-preenchida no WhatsApp para interesse em produtos do catálogo e PDP.',
  'sistema'
)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 10. BOOTSTRAP DO PRIMEIRO ADMINISTRADOR (EXECUTAR COM O SEU E-MAIL REAL)
-- ============================================================================
-- Descomente as 4 linhas abaixo, substitua [PREENCHER: email do dono] pelo
-- e-mail da sua conta criada em Supabase -> Authentication -> Users e execute:
--
-- INSERT INTO public.admin_users (user_id)
-- SELECT id FROM auth.users
--  WHERE lower(email) = lower('[PREENCHER: email do dono]')
-- ON CONFLICT (user_id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_users LIMIT 1) THEN
    RAISE NOTICE 'ATENÇÃO: A tabela public.admin_users ainda está vazia. Execute o INSERT da Seção 10 com o seu e-mail para liberar seu acesso no painel admin.html.';
  END IF;
END $$;

COMMIT;

-- Recarrega o cache de schema da API PostgREST
NOTIFY pgrst, 'reload schema';
