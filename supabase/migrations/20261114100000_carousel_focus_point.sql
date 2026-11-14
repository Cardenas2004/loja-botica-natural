-- ============================================================================
-- BOTICA NATURAL — Ponto de Foco do Carrossel para Recorte Automático 16:9 no Celular
-- Arquivo: 20261114100000_carousel_focus_point.sql
-- Ambiente: PostgreSQL 15+ (Supabase) · 100% Idempotente
-- ============================================================================

BEGIN;

ALTER TABLE public.carousel_slides
  ADD COLUMN IF NOT EXISTS focus_x NUMERIC NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS focus_y NUMERIC NOT NULL DEFAULT 50;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_carousel_slides_focus_x_range'
  ) THEN
    ALTER TABLE public.carousel_slides
      ADD CONSTRAINT chk_carousel_slides_focus_x_range CHECK (focus_x BETWEEN 0 AND 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_carousel_slides_focus_y_range'
  ) THEN
    ALTER TABLE public.carousel_slides
      ADD CONSTRAINT chk_carousel_slides_focus_y_range CHECK (focus_y BETWEEN 0 AND 100);
  END IF;
END $$;

COMMENT ON COLUMN public.carousel_slides.focus_x IS
  'Coordenada horizontal do ponto de foco (0 a 100%) usada no recorte automático 16:9 mobile.';

COMMENT ON COLUMN public.carousel_slides.focus_y IS
  'Coordenada vertical do ponto de foco (0 a 100%) usada no recorte automático 16:9 mobile.';

COMMENT ON COLUMN public.carousel_slides.mobile_image_url IS
  '[OBSOLETO — mantido apenas por histórico] A versão mobile agora utiliza recorte automático 16:9 da arte principal 16:5 guiado por focus_x e focus_y.';

COMMENT ON COLUMN public.carousel_slides.mobile_image_path IS
  '[OBSOLETO — mantido apenas por histórico] Caminho legado de imagem mobile no bucket product-images.';

COMMIT;
