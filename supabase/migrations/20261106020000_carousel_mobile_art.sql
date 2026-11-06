-- ============================================================================
-- BOTICA NATURAL — Suporte a Arte Mobile Dedicada (4:5 / 1080x1350)
-- Arquivo: 20261106020000_carousel_mobile_art.sql
-- Ambiente: PostgreSQL 15+ (Supabase) · 100% Idempotente
-- ============================================================================

BEGIN;

ALTER TABLE public.carousel_slides
  ADD COLUMN IF NOT EXISTS mobile_image_url TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS mobile_image_path TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN public.carousel_slides.mobile_image_url IS
  'URL pública da arte vertical/quadrada otimizada para celulares (proporção 4:5 / 1080x1350).';

COMMENT ON COLUMN public.carousel_slides.mobile_image_path IS
  'Caminho relativo da imagem mobile no bucket product-images.';

COMMIT;

