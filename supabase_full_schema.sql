-- ============================================================================
-- Botica Natural — Arquitetura de Banco de Dados Mestre e Definitiva
-- Arquivo: supabase_full_schema.sql
-- Arquitetura: PostgreSQL 15+ (Supabase) · Zero-Trust RLS · 100% Idempotente
-- Criado para execução direta no SQL Editor do Supabase
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. EXTENSÕES DO POSTGRESQL
-- ============================================================================

-- Ativa suporte a UUIDs criptograficamente seguros (v4)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 2. FUNÇÕES DE SUPORTE, AUDITORIA E SEGURANÇA (ZERO-TRUST)
-- ============================================================================

-- 2.1. Função de trigger para atualização automática de timestamps em `updated_at`
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
  'Trigger que sincroniza automaticamente a coluna updated_at com o timestamp UTC atual em updates.';

-- 2.2. Função RPC de verificação de permissão administrativa (Zero-Trust)
-- Valida o e-mail oficial do administrador registrado no Supabase Auth
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT coalesce(
    -- 1. E-mail oficial do administrador configurado
    lower(coalesce(auth.jwt() ->> 'email', '')) = 'eduardodudusants12345@gmail.com'
    -- 2. Papel de administrador nos metadados da conta
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    -- 3. Chamadas diretas de serviço interno (service_role)
    OR (auth.jwt() ->> 'role') = 'service_role'
    -- 4. Compatibilidade com sessão autenticada do admin
    OR (auth.role() = 'authenticated' AND lower(coalesce(auth.jwt() ->> 'email', '')) = 'eduardodudusants12345@gmail.com'),
    false
  );
$$;

COMMENT ON FUNCTION public.is_admin() IS
  'Função de segurança Zero-Trust que valida privilégios de administrador para eduardodudusants12345@gmail.com.';

-- ============================================================================
-- 3. MODELAGEM COMPLETA E MIGRAÇÃO INCREMENTAL DAS TABELAS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 3.1. Tabela: `public.categories`
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categories (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  slug          TEXT        NOT NULL,
  display_order INT         NOT NULL DEFAULT 0,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migração incremental resiliente para colunas
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS slug TEXT NOT NULL DEFAULT '';
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS display_order INT NOT NULL DEFAULT 0;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Índices e Unicidade
CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_name ON public.categories (name);
CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_slug ON public.categories (slug);

COMMENT ON TABLE public.categories IS 'Categorias e formas farmacêuticas dos produtos da Botica Natural.';
COMMENT ON COLUMN public.categories.name IS 'Nome legível da categoria (ex: Cápsulas, Xaropes & Florais).';
COMMENT ON COLUMN public.categories.slug IS 'Identificador textual amigável para URLs e filtros rápidos.';
COMMENT ON COLUMN public.categories.display_order IS 'Ordem numérica crescente de exibição nas listagens e filtros.';
COMMENT ON COLUMN public.categories.is_active IS 'Define se a categoria e seus produtos aparecem na vitrine pública.';

-- ----------------------------------------------------------------------------
-- 3.2. Tabela: `public.products`
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id   UUID          REFERENCES public.categories(id) ON DELETE SET NULL,
  name          TEXT          NOT NULL,
  description   TEXT          NOT NULL DEFAULT '',
  price         NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (price >= 0),
  image_url     TEXT          NOT NULL DEFAULT '',
  image_path    TEXT          NOT NULL DEFAULT '',
  is_active     BOOLEAN       NOT NULL DEFAULT true,
  is_best_seller BOOLEAN      NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Migração incremental das colunas base e auditoria
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price NUMERIC(10,2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_url TEXT NOT NULL DEFAULT '';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_path TEXT NOT NULL DEFAULT '';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_best_seller BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Migração incremental das colunas dedicadas da Página de Produto (`produto.html`) e Painel
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sku_ref TEXT NOT NULL DEFAULT '';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS short_description TEXT NOT NULL DEFAULT '';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS payment_info TEXT NOT NULL DEFAULT 'Consulte formas de pagamento via WhatsApp / Cartão e Pix';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS benefits TEXT NOT NULL DEFAULT '';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS usage_instructions TEXT NOT NULL DEFAULT '';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS composition TEXT NOT NULL DEFAULT '';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS package_info TEXT NOT NULL DEFAULT '';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS allergen_info TEXT NOT NULL DEFAULT 'Não contém lactose e glúten.';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS quality_note TEXT NOT NULL DEFAULT 'Todos os produtos da Botica Natural são preparados com matérias-primas selecionadas e rigoroso controle de qualidade farmacêutico, garantindo melhor eficácia.';

COMMENT ON TABLE public.products IS 'Catálogo geral de fórmulas magistrais e produtos manipulados.';
COMMENT ON COLUMN public.products.sku_ref IS 'Código interno de referência (REF) da fórmula (ex: REF: 4299).';
COMMENT ON COLUMN public.products.short_description IS 'Resumo conciso dos benefícios exibido no topo da página de detalhes e no card da vitrine.';
COMMENT ON COLUMN public.products.payment_info IS 'Informação textual sobre facilidades e opções de pagamento (WhatsApp, Cartão, Pix).';
COMMENT ON COLUMN public.products.benefits IS 'Lista ou texto resumido de benefícios clínicos da fórmula.';
COMMENT ON COLUMN public.products.usage_instructions IS 'Posologia e instruções detalhadas de como usar o medicamento (bloco MODO DE USAR).';
COMMENT ON COLUMN public.products.composition IS 'Lista detalhada de ativos e dosagens (bloco Contém).';
COMMENT ON COLUMN public.products.package_info IS 'Apresentação física do frasco/embalagem (ex: Frasco com 90 cápsulas).';
COMMENT ON COLUMN public.products.allergen_info IS 'Informações sobre alérgenos e restrições (ex: Não contém lactose e glúten).';
COMMENT ON COLUMN public.products.quality_note IS 'Garantia de conformidade farmacêutica e boas práticas de manipulação.';

-- ----------------------------------------------------------------------------
-- 3.3. Tabela: `public.carousel_slides` (Banners do Carrossel Principal)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.carousel_slides (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT        NOT NULL DEFAULT '',
  subtitle      TEXT        NOT NULL DEFAULT '',
  button_text   TEXT        NOT NULL DEFAULT '',
  button_link   TEXT        NOT NULL DEFAULT '',
  image_url     TEXT        NOT NULL CHECK (char_length(trim(image_url)) > 0),
  image_path    TEXT        NOT NULL CHECK (char_length(trim(image_path)) > 0),
  display_order INT         NOT NULL DEFAULT 0,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migração incremental das colunas do carrossel
ALTER TABLE public.carousel_slides ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';
ALTER TABLE public.carousel_slides ADD COLUMN IF NOT EXISTS subtitle TEXT NOT NULL DEFAULT '';
ALTER TABLE public.carousel_slides ADD COLUMN IF NOT EXISTS button_text TEXT NOT NULL DEFAULT '';
ALTER TABLE public.carousel_slides ADD COLUMN IF NOT EXISTS button_link TEXT NOT NULL DEFAULT '';
ALTER TABLE public.carousel_slides ADD COLUMN IF NOT EXISTS image_url TEXT NOT NULL DEFAULT '';
ALTER TABLE public.carousel_slides ADD COLUMN IF NOT EXISTS image_path TEXT NOT NULL DEFAULT '';
ALTER TABLE public.carousel_slides ADD COLUMN IF NOT EXISTS display_order INT NOT NULL DEFAULT 0;
ALTER TABLE public.carousel_slides ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.carousel_slides ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.carousel_slides ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

COMMENT ON TABLE public.carousel_slides IS 'Banners rotativos do carrossel Hero gerenciados pelo painel administrativo.';
COMMENT ON COLUMN public.carousel_slides.title IS 'Título ou descrição de acessibilidade (alt) da imagem.';
COMMENT ON COLUMN public.carousel_slides.button_link IS 'Link opcional de redirecionamento ao clicar no banner.';
COMMENT ON COLUMN public.carousel_slides.image_path IS 'Caminho físico no Storage para deleção sem deixar arquivos órfãos.';

-- ============================================================================
-- 4. ÍNDICES DE PERFORMANCE B-TREE
-- ============================================================================

-- Categorias
CREATE INDEX IF NOT EXISTS idx_categories_active_order
  ON public.categories (is_active, display_order ASC);
CREATE INDEX IF NOT EXISTS idx_categories_slug
  ON public.categories (slug);

-- Produtos
CREATE INDEX IF NOT EXISTS idx_products_category_id
  ON public.products (category_id);
CREATE INDEX IF NOT EXISTS idx_products_active
  ON public.products (is_active);
CREATE INDEX IF NOT EXISTS idx_products_best_seller
  ON public.products (is_best_seller) WHERE is_best_seller = true;
CREATE INDEX IF NOT EXISTS idx_products_active_created
  ON public.products (is_active, created_at DESC);

-- Carrossel
CREATE INDEX IF NOT EXISTS idx_carousel_active_order
  ON public.carousel_slides (is_active, display_order ASC);
CREATE INDEX IF NOT EXISTS idx_carousel_active_created
  ON public.carousel_slides (is_active, created_at DESC);

-- ============================================================================
-- 5. TRIGGERS AUTOMÁTICOS DE ATUALIZAÇÃO (`updated_at`)
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

-- ============================================================================
-- 6. SEGURANÇA ZERO-TRUST: ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Ativa RLS em todas as tabelas
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carousel_slides ENABLE ROW LEVEL SECURITY;

-- Concede privilégios explícitos aos papéis Supabase
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.categories TO authenticated;

GRANT SELECT ON public.products TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;

GRANT SELECT ON public.carousel_slides TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.carousel_slides TO authenticated;

-- ----------------------------------------------------------------------------
-- 6.1. Políticas RLS: `public.categories`
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "categories_select_public" ON public.categories;
CREATE POLICY "categories_select_public"
  ON public.categories FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "categories_insert_admin" ON public.categories;
CREATE POLICY "categories_insert_admin"
  ON public.categories FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "categories_update_admin" ON public.categories;
CREATE POLICY "categories_update_admin"
  ON public.categories FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "categories_delete_admin" ON public.categories;
CREATE POLICY "categories_delete_admin"
  ON public.categories FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 6.2. Políticas RLS: `public.products`
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "products_select_public" ON public.products;
CREATE POLICY "products_select_public"
  ON public.products FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "products_insert_admin" ON public.products;
CREATE POLICY "products_insert_admin"
  ON public.products FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "products_update_admin" ON public.products;
CREATE POLICY "products_update_admin"
  ON public.products FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "products_delete_admin" ON public.products;
CREATE POLICY "products_delete_admin"
  ON public.products FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 6.3. Políticas RLS: `public.carousel_slides`
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "carousel_slides_select_public" ON public.carousel_slides;
CREATE POLICY "carousel_slides_select_public"
  ON public.carousel_slides FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "carousel_slides_insert_admin" ON public.carousel_slides;
CREATE POLICY "carousel_slides_insert_admin"
  ON public.carousel_slides FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "carousel_slides_update_admin" ON public.carousel_slides;
CREATE POLICY "carousel_slides_update_admin"
  ON public.carousel_slides FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "carousel_slides_delete_admin" ON public.carousel_slides;
CREATE POLICY "carousel_slides_delete_admin"
  ON public.carousel_slides FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- 7. SUPABASE STORAGE (BUCKET E POLÍTICAS DE OBJETOS)
-- ============================================================================

-- Garante existência do bucket público 'product-images' com limite de 5MB
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880,
  ARRAY['image/webp', 'image/jpeg', 'image/png']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/webp', 'image/jpeg', 'image/png']::text[];

-- Políticas RLS sobre os objetos de imagem no Storage
DROP POLICY IF EXISTS "product_images_select_public" ON storage.objects;
CREATE POLICY "product_images_select_public"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "product_images_insert_admin" ON storage.objects;
CREATE POLICY "product_images_insert_admin"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND public.is_admin()
  );

DROP POLICY IF EXISTS "product_images_update_admin" ON storage.objects;
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

DROP POLICY IF EXISTS "product_images_delete_admin" ON storage.objects;
CREATE POLICY "product_images_delete_admin"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND public.is_admin()
  );

-- ============================================================================
-- 8. CARGA INICIAL DE CATEGORIAS BÁSICAS (SEEDS IDEMPOTENTES)
-- ============================================================================
INSERT INTO public.categories (name, slug, display_order, is_active)
VALUES
  ('Cápsulas', 'capsulas', 1, true),
  ('Xaropes & Florais', 'xaropes-florais', 2, true),
  ('Cosméticos & Séruns', 'cosmeticos-seruns', 3, true),
  ('Sachês & Chás', 'saches-chas', 4, true)
ON CONFLICT (slug) DO NOTHING;

COMMIT;

-- ============================================================================
-- 9. RECARREGAMENTO DE CACHE DO POSTGREST (EVITA ERRO PGRST204)
-- ============================================================================
NOTIFY pgrst, 'reload schema';

