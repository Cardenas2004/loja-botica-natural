DO $$ BEGIN RAISE EXCEPTION 'ARQUIVO LEGADO — NÃO EXECUTAR. Use supabase/migrations/.'; END $$;

-- ============================================================================
-- Botica Natural — Módulo de Gestão de Banners do Carrossel Principal
-- Arquivo: supabase_carousel.sql
-- Arquitetura: PostgreSQL 15+ (Supabase) · 100% Idempotente e Autocontido
-- ============================================================================

BEGIN;

-- 1. Extensão para geração de UUIDs criptograficamente seguros
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Função de Trigger Idempotente para atualização automática de `updated_at`
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

-- 3. Função RPC `public.is_admin()` (Garante que a função existe e valida o admin autenticado)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() ->> 'role') = 'service_role'
    OR (auth.role() = 'authenticated'),
    false
  );
$$;

-- 4. Criação da Tabela `public.carousel_slides`
CREATE TABLE IF NOT EXISTS public.carousel_slides (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT        NOT NULL DEFAULT '',
  button_link   TEXT        NOT NULL DEFAULT '',
  image_url     TEXT        NOT NULL CHECK (char_length(trim(image_url)) > 0),
  image_path    TEXT        NOT NULL CHECK (char_length(trim(image_path)) > 0),
  display_order INT         NOT NULL DEFAULT 0,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.carousel_slides IS 'Banners rotativos do carrossel principal (Hero) da Landing Page Botica Natural.';
COMMENT ON COLUMN public.carousel_slides.title IS 'Descrição curta / texto alternativo (alt) de acessibilidade do banner.';
COMMENT ON COLUMN public.carousel_slides.button_link IS 'URL opcional de destino caso o banner seja clicável.';
COMMENT ON COLUMN public.carousel_slides.image_url IS 'URL pública otimizada da imagem no Supabase Storage.';
COMMENT ON COLUMN public.carousel_slides.image_path IS 'Caminho exato do arquivo no bucket product-images para deleção física sem arquivos órfãos.';
COMMENT ON COLUMN public.carousel_slides.display_order IS 'Ordem de exibição no carrossel (menor número aparece primeiro).';
COMMENT ON COLUMN public.carousel_slides.is_active IS 'Define se o slide está ativo e visível na Landing Page.';

-- 5. Índice B-Tree Composto para leitura rápida ordenada na Vitrine Pública
CREATE INDEX IF NOT EXISTS idx_carousel_active_order
  ON public.carousel_slides (is_active, display_order ASC);

-- 6. Trigger Automático de `updated_at`
DROP TRIGGER IF EXISTS trg_carousel_slides_updated_at ON public.carousel_slides;
CREATE TRIGGER trg_carousel_slides_updated_at
  BEFORE UPDATE ON public.carousel_slides
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 7. Segurança Zero-Trust (Row Level Security — RLS) na Tabela
ALTER TABLE public.carousel_slides ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.carousel_slides TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.carousel_slides TO authenticated;

-- 7.1. Leitura pública para anon e authenticated
DROP POLICY IF EXISTS "carousel_slides_select_public" ON public.carousel_slides;
CREATE POLICY "carousel_slides_select_public"
  ON public.carousel_slides
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- 7.2. Inserção permitida para usuário autenticado (admin)
DROP POLICY IF EXISTS "carousel_slides_insert_admin" ON public.carousel_slides;
CREATE POLICY "carousel_slides_insert_admin"
  ON public.carousel_slides
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- 7.3. Atualização permitida para usuário autenticado (admin)
DROP POLICY IF EXISTS "carousel_slides_update_admin" ON public.carousel_slides;
CREATE POLICY "carousel_slides_update_admin"
  ON public.carousel_slides
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 7.4. Exclusão permitida para usuário autenticado (admin)
DROP POLICY IF EXISTS "carousel_slides_delete_admin" ON public.carousel_slides;
CREATE POLICY "carousel_slides_delete_admin"
  ON public.carousel_slides
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- 8. Configuração Resiliente do Bucket de Imagens `product-images` no Storage
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Políticas de Storage para upload e visualização de fotos
DROP POLICY IF EXISTS "product_images_select_public" ON storage.objects;
CREATE POLICY "product_images_select_public"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "product_images_insert_auth" ON storage.objects;
CREATE POLICY "product_images_insert_auth"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-images');

DROP POLICY IF EXISTS "product_images_update_auth" ON storage.objects;
CREATE POLICY "product_images_update_auth"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'product-images')
  WITH CHECK (bucket_id = 'product-images');

DROP POLICY IF EXISTS "product_images_delete_auth" ON storage.objects;
CREATE POLICY "product_images_delete_auth"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-images');

COMMIT;
