-- =============================================================================
-- BOTICA NATURAL — SCHEMA DE REFERÊNCIA DO BANCO DE DADOS (POSTGRESQL 15+)
-- Arquivo: supabase/schema_reference.sql
-- Status: SOMENTE LEITURA / DOCUMENTAÇÃO TÉCNICA DO ESTADO ATUAL
-- Fonte da verdade: Migrações em supabase/migrations/ aplicadas em ordem
-- =============================================================================
-- ATENÇÃO:
-- Não execute este arquivo diretamente como migração em produção.
-- Novas alterações estruturais devem ser criadas como migrações incrementais
-- e idempotentes dentro do diretório `supabase/migrations/<timestamp>_<nome>.sql`.
-- =============================================================================

-- 1. EXTENSÕES
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TRIGGER GENÉRICO DE TIMESTAMP (updated_at)
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 3. TABELA DE ADMINISTRADORES (ACL ZERO-TRUST)
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id    UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Permissões estritas: nenhuma leitura ou escrita direta para anon ou authenticated.
REVOKE ALL ON TABLE public.admin_users FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.admin_users TO service_role;

-- 4. FUNÇÃO DE AUTORIZAÇÃO ADMINISTRATIVA
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- 5. TABELA DE CATEGORIAS
CREATE TABLE IF NOT EXISTS public.categories (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  slug          TEXT        NOT NULL UNIQUE,
  display_order INTEGER     NOT NULL DEFAULT 0,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_categories_name_not_empty CHECK (char_length(btrim(name)) > 0 AND char_length(name) <= 200),
  CONSTRAINT chk_categories_display_order_positive CHECK (display_order >= 0)
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categories_select_public" ON public.categories
  FOR SELECT TO anon
  USING (is_active = true);

CREATE POLICY "categories_select_authenticated" ON public.categories
  FOR SELECT TO authenticated
  USING (is_active = true OR public.is_admin());

CREATE POLICY "categories_insert_admin" ON public.categories
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "categories_update_admin" ON public.categories
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "categories_delete_admin" ON public.categories
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- 6. TABELA DE PRODUTOS
CREATE TABLE IF NOT EXISTS public.products (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id        UUID        REFERENCES public.categories(id) ON DELETE SET NULL,
  name               TEXT        NOT NULL,
  sku_ref            TEXT        NOT NULL DEFAULT '',
  short_description  TEXT        NOT NULL DEFAULT '',
  description        TEXT        DEFAULT '',
  usage_instructions TEXT        NOT NULL DEFAULT '',
  composition        TEXT        NOT NULL DEFAULT '',
  package_info       TEXT        NOT NULL DEFAULT '',
  allergen_info      TEXT        NOT NULL DEFAULT '',
  quality_note       TEXT        NOT NULL DEFAULT '',
  payment_info       TEXT        NOT NULL DEFAULT '',
  whatsapp_message   TEXT        NOT NULL DEFAULT '',
  benefits           TEXT        NOT NULL DEFAULT '',
  text_options       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  price              NUMERIC     NOT NULL DEFAULT 0,
  image_url          TEXT,
  image_path         TEXT,
  is_active          BOOLEAN     NOT NULL DEFAULT true,
  is_best_seller     BOOLEAN     NOT NULL DEFAULT false,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_products_name_not_empty CHECK (char_length(btrim(name)) > 0 AND char_length(name) <= 200),
  CONSTRAINT chk_products_price_non_negative CHECK (price >= 0),
  CONSTRAINT chk_products_text_options_object CHECK (jsonb_typeof(text_options) = 'object'),
  CONSTRAINT chk_products_sku_ref_length CHECK (sku_ref IS NULL OR char_length(sku_ref) <= 100),
  CONSTRAINT chk_products_benefits_length CHECK (benefits IS NULL OR char_length(benefits) <= 5000),
  CONSTRAINT chk_products_text_lengths CHECK (
    (short_description IS NULL OR char_length(short_description) <= 5000) AND
    (description IS NULL OR char_length(description) <= 25000) AND
    (usage_instructions IS NULL OR char_length(usage_instructions) <= 15000) AND
    (composition IS NULL OR char_length(composition) <= 15000) AND
    (package_info IS NULL OR char_length(package_info) <= 10000) AND
    (allergen_info IS NULL OR char_length(allergen_info) <= 5000) AND
    (quality_note IS NULL OR char_length(quality_note) <= 5000) AND
    (payment_info IS NULL OR char_length(payment_info) <= 2000) AND
    (whatsapp_message IS NULL OR char_length(whatsapp_message) <= 4000)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_sku_ref_unique
  ON public.products (btrim(sku_ref))
  WHERE sku_ref IS NOT NULL AND btrim(sku_ref) <> '';

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_select_public" ON public.products
  FOR SELECT TO anon
  USING (is_active = true);

CREATE POLICY "products_select_authenticated" ON public.products
  FOR SELECT TO authenticated
  USING (is_active = true OR public.is_admin());

CREATE POLICY "products_insert_admin" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "products_update_admin" ON public.products
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "products_delete_admin" ON public.products
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- 7. TABELA DE BANNERS DO CARROSSEL
CREATE TABLE IF NOT EXISTS public.carousel_slides (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT        NOT NULL DEFAULT '',
  image_url         TEXT        NOT NULL,
  image_path        TEXT        NOT NULL DEFAULT '',
  mobile_image_url  TEXT        NOT NULL DEFAULT '', -- [OBSOLETO] Mantido apenas por histórico
  mobile_image_path TEXT        NOT NULL DEFAULT '', -- [OBSOLETO] Mantido apenas por histórico
  focus_x           NUMERIC     NOT NULL DEFAULT 50,
  focus_y           NUMERIC     NOT NULL DEFAULT 50,
  button_link       TEXT        NOT NULL DEFAULT '',
  display_order     INTEGER     NOT NULL DEFAULT 0,
  is_active         BOOLEAN     NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_carousel_slides_display_order_positive CHECK (display_order >= 0),
  CONSTRAINT chk_carousel_slides_focus_x_range CHECK (focus_x BETWEEN 0 AND 100),
  CONSTRAINT chk_carousel_slides_focus_y_range CHECK (focus_y BETWEEN 0 AND 100),
  CONSTRAINT chk_carousel_slides_button_link_scheme CHECK (
    button_link = '' OR button_link ~* '^(https?://|/[^/])'
  )
);

ALTER TABLE public.carousel_slides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "carousel_slides_select_public" ON public.carousel_slides
  FOR SELECT TO anon
  USING (is_active = true);

CREATE POLICY "carousel_slides_select_authenticated" ON public.carousel_slides
  FOR SELECT TO authenticated
  USING (is_active = true OR public.is_admin());

CREATE POLICY "carousel_slides_insert_admin" ON public.carousel_slides
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "carousel_slides_update_admin" ON public.carousel_slides
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "carousel_slides_delete_admin" ON public.carousel_slides
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- 8. TABELA DE CONFIGURAÇÕES GLOBAIS (SITE_SETTINGS)
CREATE TABLE IF NOT EXISTS public.site_settings (
  key        TEXT        PRIMARY KEY,
  value      TEXT        NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_settings_select_public_whitelist" ON public.site_settings
  FOR SELECT TO anon
  USING (key = 'whatsapp_product_message_template');

CREATE POLICY "site_settings_select_authenticated" ON public.site_settings
  FOR SELECT TO authenticated
  USING (key = 'whatsapp_product_message_template' OR public.is_admin());

CREATE POLICY "site_settings_insert_admin" ON public.site_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "site_settings_update_admin" ON public.site_settings
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "site_settings_delete_admin" ON public.site_settings
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- 9. TABELA DE VITRINE DE COMPOSTOS MANIPULADOS (COMPOUND_SHOWCASE_CARDS)
CREATE TABLE IF NOT EXISTS public.compound_showcase_cards (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title                TEXT        NOT NULL CHECK (char_length(trim(title)) >= 2),
  label_subtitle       TEXT        NOT NULL DEFAULT '',
  label_title          TEXT        NOT NULL DEFAULT '',
  label_badge          TEXT        NOT NULL DEFAULT '60 CÁPSULAS',
  show_label           BOOLEAN     NOT NULL DEFAULT true,
  button_text          TEXT        NOT NULL DEFAULT 'COMPRAR',
  button_link          TEXT        NOT NULL DEFAULT '',
  product_id           UUID        REFERENCES public.products(id) ON DELETE SET NULL,
  open_in_new_tab      BOOLEAN     NOT NULL DEFAULT false,
  show_button          BOOLEAN     NOT NULL DEFAULT true,
  card_theme           TEXT        NOT NULL DEFAULT 'green'
                       CHECK (card_theme IN ('green', 'purple', 'emerald', 'plum', 'gold')),
  badge_color          TEXT        NOT NULL DEFAULT 'green'
                       CHECK (badge_color IN ('green', 'purple', 'gold', 'dark')),
  title_align          TEXT        NOT NULL DEFAULT 'center'
                       CHECK (title_align IN ('left', 'center', 'right')),
  botanical_theme      TEXT        NOT NULL DEFAULT 'alcachofra'
                       CHECK (botanical_theme IN ('alcachofra', 'berries', 'turmeric', 'hibiscus', 'chamomile', 'rosehip', 'custom', 'none')),
  show_capsules        BOOLEAN     NOT NULL DEFAULT true,
  image_url            TEXT,
  image_path           TEXT,
  botanical_image_url  TEXT,
  botanical_image_path TEXT,
  display_order        INTEGER     NOT NULL DEFAULT 0,
  is_active            BOOLEAN     NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.compound_showcase_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compound_showcase_cards_select_public" ON public.compound_showcase_cards
  FOR SELECT TO anon
  USING (is_active = true);

CREATE POLICY "compound_showcase_cards_select_authenticated" ON public.compound_showcase_cards
  FOR SELECT TO authenticated
  USING (is_active = true OR public.is_admin());

CREATE POLICY "compound_showcase_cards_insert_admin" ON public.compound_showcase_cards
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "compound_showcase_cards_update_admin" ON public.compound_showcase_cards
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "compound_showcase_cards_delete_admin" ON public.compound_showcase_cards
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- 10. STORAGE: BUCKET 'product-images' E POLICIES
-- Leituras públicas permitidas para entrega estática de imagens
-- Escritas (INSERT, UPDATE, DELETE) restritas exclusivamente a public.is_admin()
