-- ============================================================================
-- MIGRAÇÃO SÊNIOR: VITRINE ESPECIAL DE COMPOSTOS MANIPULADOS (CMS COMPLETO)
-- Arquivo: supabase/migrations/20261113230000_compound_showcase_cards.sql
-- Data: 2026-11-13
-- Compatibilidade: PostgreSQL 15+ / Supabase (100% Idempotente e Autossuficiente)
-- ============================================================================
-- O QUE ESTE SCRIPT FAZ:
--   1. Garante extensões, função `public.handle_updated_at()`, ACL `public.admin_users`
--      e função `public.is_admin()` (Zero-Trust).
--   2. Cria a tabela `public.compound_showcase_cards` com constraints de integridade
--      para textos, temas de cores, alinhamento, selos, ilustrações botânicas e links seguros.
--   3. Cria índices otimizados para leitura ordenada na vitrine pública e busca por produto.
--   4. Ativa Row Level Security (RLS) com políticas estritas:
--      - `anon`: SELECT apenas em cards ativos (`is_active = true`)
--      - `authenticated`: SELECT em cards ativos ou todos se `public.is_admin()`
--      - `INSERT`, `UPDATE`, `DELETE`: exclusivos para `public.is_admin()`
--   5. Garante o bucket público `product-images` no Supabase Storage e políticas RLS
--      de leitura pública e escrita restrita a `public.is_admin()`.
--   6. Popula idempotentemente os 6 Compostos Oficiais da Botica Natural, vinculando-os
--      automaticamente aos produtos reais da tabela `public.products`.
--   7. Executa `NOTIFY pgrst, 'reload schema'` para atualizar o cache da API REST imediatamente.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. PRÉ-REQUISITOS DE INFRAESTRUTURA E FUNÇÕES BASE (IDEMPOTENTES)
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id    UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.admin_users FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.admin_users TO service_role;

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

-- ----------------------------------------------------------------------------
-- 2. TABELA PRINCIPAL: public.compound_showcase_cards
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.compound_showcase_cards (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title                TEXT        NOT NULL,
  label_subtitle       TEXT        NOT NULL DEFAULT '',
  label_title          TEXT        NOT NULL DEFAULT '',
  label_badge          TEXT        NOT NULL DEFAULT '60 CÁPSULAS',
  show_label           BOOLEAN     NOT NULL DEFAULT true,
  button_text          TEXT        NOT NULL DEFAULT 'COMPRAR',
  button_link          TEXT        NOT NULL DEFAULT '',
  product_id           UUID        REFERENCES public.products(id) ON DELETE SET NULL,
  open_in_new_tab      BOOLEAN     NOT NULL DEFAULT false,
  show_button          BOOLEAN     NOT NULL DEFAULT true,
  card_theme           TEXT        NOT NULL DEFAULT 'green',
  badge_color          TEXT        NOT NULL DEFAULT 'green',
  title_align          TEXT        NOT NULL DEFAULT 'center',
  botanical_theme      TEXT        NOT NULL DEFAULT 'alcachofra',
  show_capsules        BOOLEAN     NOT NULL DEFAULT true,
  image_url            TEXT,
  image_path           TEXT,
  botanical_image_url  TEXT,
  botanical_image_path TEXT,
  display_order        INTEGER     NOT NULL DEFAULT 0,
  is_active            BOOLEAN     NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_compound_cards_title_len
    CHECK (char_length(btrim(title)) >= 2 AND char_length(title) <= 120),
  CONSTRAINT chk_compound_cards_label_subtitle_len
    CHECK (char_length(label_subtitle) <= 80),
  CONSTRAINT chk_compound_cards_label_title_len
    CHECK (char_length(label_title) <= 100),
  CONSTRAINT chk_compound_cards_label_badge_len
    CHECK (char_length(label_badge) <= 50),
  CONSTRAINT chk_compound_cards_button_text_len
    CHECK (char_length(button_text) <= 40),
  CONSTRAINT chk_compound_cards_theme_valid
    CHECK (card_theme IN ('green', 'purple', 'emerald', 'plum', 'gold')),
  CONSTRAINT chk_compound_cards_badge_color_valid
    CHECK (badge_color IN ('green', 'purple', 'gold', 'dark')),
  CONSTRAINT chk_compound_cards_title_align_valid
    CHECK (title_align IN ('left', 'center', 'right')),
  CONSTRAINT chk_compound_cards_botanical_valid
    CHECK (botanical_theme IN ('alcachofra', 'berries', 'turmeric', 'hibiscus', 'chamomile', 'rosehip', 'custom', 'none')),
  CONSTRAINT chk_compound_cards_display_order_non_negative
    CHECK (display_order >= 0),
  CONSTRAINT chk_compound_cards_safe_button_link
    CHECK (
      button_link = ''
      OR (
        button_link !~* '^\s*(javascript|data|vbscript|file):'
        AND char_length(button_link) <= 500
      )
    )
);

-- ----------------------------------------------------------------------------
-- 3. ÍNDICES E TRIGGER DE AUDITORIA (updated_at)
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_compound_showcase_cards_order
  ON public.compound_showcase_cards (display_order ASC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_compound_showcase_cards_active
  ON public.compound_showcase_cards (is_active, display_order ASC);

CREATE INDEX IF NOT EXISTS idx_compound_showcase_cards_product_id
  ON public.compound_showcase_cards (product_id);

DROP TRIGGER IF EXISTS set_updated_at_compound_showcase_cards ON public.compound_showcase_cards;
CREATE TRIGGER set_updated_at_compound_showcase_cards
  BEFORE UPDATE ON public.compound_showcase_cards
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ----------------------------------------------------------------------------
-- 4. SEGURANÇA E ROW LEVEL SECURITY (RLS)
-- ----------------------------------------------------------------------------
ALTER TABLE public.compound_showcase_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "compound_showcase_cards_select_public" ON public.compound_showcase_cards;
CREATE POLICY "compound_showcase_cards_select_public" ON public.compound_showcase_cards
  FOR SELECT TO anon
  USING (is_active = true);

DROP POLICY IF EXISTS "compound_showcase_cards_select_authenticated" ON public.compound_showcase_cards;
CREATE POLICY "compound_showcase_cards_select_authenticated" ON public.compound_showcase_cards
  FOR SELECT TO authenticated
  USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "compound_showcase_cards_insert_admin" ON public.compound_showcase_cards;
CREATE POLICY "compound_showcase_cards_insert_admin" ON public.compound_showcase_cards
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "compound_showcase_cards_update_admin" ON public.compound_showcase_cards;
CREATE POLICY "compound_showcase_cards_update_admin" ON public.compound_showcase_cards
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "compound_showcase_cards_delete_admin" ON public.compound_showcase_cards;
CREATE POLICY "compound_showcase_cards_delete_admin" ON public.compound_showcase_cards
  FOR DELETE TO authenticated
  USING (public.is_admin());

GRANT SELECT ON public.compound_showcase_cards TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.compound_showcase_cards TO authenticated;
GRANT ALL ON public.compound_showcase_cards TO service_role;

-- ----------------------------------------------------------------------------
-- 5. SUPABASE STORAGE: BUCKET `product-images` E POLÍTICAS DE UPLOAD
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880,
  ARRAY['image/webp', 'image/png', 'image/jpeg', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET
  public = true,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "product_images_public_read" ON storage.objects;
CREATE POLICY "product_images_public_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "product_images_admin_insert" ON storage.objects;
CREATE POLICY "product_images_admin_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

DROP POLICY IF EXISTS "product_images_admin_update" ON storage.objects;
CREATE POLICY "product_images_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images' AND public.is_admin())
  WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

DROP POLICY IF EXISTS "product_images_admin_delete" ON storage.objects;
CREATE POLICY "product_images_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND public.is_admin());

-- ----------------------------------------------------------------------------
-- 6. SEED INICIAL IDEMPOTENTE DOS 6 COMPOSTOS OFICIAIS DA BOTICA NATURAL
--    Resolve automaticamente o `product_id` caso o produto exista por ID ou nome.
-- ----------------------------------------------------------------------------
INSERT INTO public.compound_showcase_cards (
  id,
  title,
  label_subtitle,
  label_title,
  label_badge,
  show_label,
  button_text,
  button_link,
  product_id,
  open_in_new_tab,
  show_button,
  card_theme,
  badge_color,
  title_align,
  botanical_theme,
  show_capsules,
  display_order,
  is_active
)
VALUES
  (
    '2b90c101-0000-4000-a000-000000000001',
    E'COMPOSTO\nALCACHOFRA + BERINJELA',
    'COMPOSTO DIGESTIVO',
    E'ALCACHOFRA\n+ BERINJELA',
    '60 CÁPSULAS',
    true,
    'COMPRAR',
    'produto.html?id=f341446b-d225-447e-a119-bbf20acb1f9e',
    COALESCE(
      (SELECT id FROM public.products WHERE id = 'f341446b-d225-447e-a119-bbf20acb1f9e' LIMIT 1),
      (SELECT id FROM public.products WHERE name ILIKE '%Alcachofra%' LIMIT 1)
    ),
    false,
    true,
    'green',
    'green',
    'center',
    'alcachofra',
    true,
    0,
    true
  ),
  (
    '2b90c101-0000-4000-a000-000000000002',
    E'COMPOSTO PARA\nMENOPAUSA',
    'COMPOSTO PARA',
    'MENOPAUSA',
    '60 CÁPSULAS',
    true,
    'COMPRAR',
    'produto.html?id=53ecb53e-d202-4a7d-b60f-b70983e18d66',
    COALESCE(
      (SELECT id FROM public.products WHERE id = '53ecb53e-d202-4a7d-b60f-b70983e18d66' LIMIT 1),
      (SELECT id FROM public.products WHERE name ILIKE '%Menopausa%' LIMIT 1)
    ),
    false,
    true,
    'purple',
    'green',
    'center',
    'berries',
    true,
    1,
    true
  ),
  (
    '2b90c101-0000-4000-a000-000000000003',
    E'COMPOSTO\nANTI-REUMÁTICO',
    'COMPOSTO PARA DOR',
    'ANTI-REUMÁTICO',
    '60 CÁPSULAS',
    true,
    'COMPRAR',
    'produto.html?id=2b1a1375-d801-484e-b6fc-5fae76e72f9e',
    COALESCE(
      (SELECT id FROM public.products WHERE id = '2b1a1375-d801-484e-b6fc-5fae76e72f9e' LIMIT 1),
      (SELECT id FROM public.products WHERE name ILIKE '%Reum%' LIMIT 1)
    ),
    false,
    true,
    'green',
    'green',
    'center',
    'turmeric',
    true,
    2,
    true
  ),
  (
    '2b90c101-0000-4000-a000-000000000004',
    E'COMPOSTO\nDRENANTE',
    'AÇÃO DETOX E DIURÉTICA',
    E'COMPOSTO\nDRENANTE',
    '60 CÁPSULAS',
    true,
    'COMPRAR',
    'produto.html?id=74f956d1-77a2-4c30-9e12-401fc77af8f2',
    COALESCE(
      (SELECT id FROM public.products WHERE id = '74f956d1-77a2-4c30-9e12-401fc77af8f2' LIMIT 1),
      (SELECT id FROM public.products WHERE name ILIKE '%Drenante%' LIMIT 1)
    ),
    false,
    true,
    'purple',
    'green',
    'center',
    'hibiscus',
    true,
    3,
    true
  ),
  (
    '2b90c101-0000-4000-a000-000000000005',
    E'COMPOSTO\nCALMANTE NATURAL',
    'EQUILÍBRIO E SONO',
    E'COMPOSTO\nCALMANTE',
    '60 CÁPSULAS',
    true,
    'COMPRAR',
    'produto.html?id=ffb5e893-4525-4d95-81ee-5abf61223e73',
    COALESCE(
      (SELECT id FROM public.products WHERE id = 'ffb5e893-4525-4d95-81ee-5abf61223e73' LIMIT 1),
      (SELECT id FROM public.products WHERE name ILIKE '%Calmante%' LIMIT 1)
    ),
    false,
    true,
    'green',
    'green',
    'center',
    'chamomile',
    true,
    4,
    true
  ),
  (
    '2b90c101-0000-4000-a000-000000000006',
    E'COMPOSTO\nMANCHAS NA PELE',
    'UNIFORMIZAÇÃO DA PELE',
    E'MANCHAS\nNA PELE',
    '60 CÁPSULAS',
    true,
    'COMPRAR',
    'produto.html?id=b25df4bf-26a9-4599-b596-90d707b16435',
    COALESCE(
      (SELECT id FROM public.products WHERE id = 'b25df4bf-26a9-4599-b596-90d707b16435' LIMIT 1),
      (SELECT id FROM public.products WHERE name ILIKE '%Manchas%' LIMIT 1)
    ),
    false,
    true,
    'purple',
    'green',
    'center',
    'rosehip',
    true,
    5,
    true
  )
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.compound_showcase_cards IS 'Cards administráveis da Vitrine Especial de Compostos Manipulados (#compounds-showcase).';

-- Recarrega imediatamente o cache de schema do PostgREST (API REST do Supabase)
NOTIFY pgrst, 'reload schema';

COMMIT;
