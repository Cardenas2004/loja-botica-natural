-- ============================================================================
-- BOTICA NATURAL — Rollback do Ponto de Foco do Carrossel
-- Arquivo: 20261114100000_carousel_focus_point_rollback.sql
-- Ambiente: PostgreSQL 15+ (Supabase) · 100% Idempotente
-- ============================================================================

BEGIN;

ALTER TABLE public.carousel_slides
  DROP CONSTRAINT IF EXISTS chk_carousel_slides_focus_x_range,
  DROP CONSTRAINT IF EXISTS chk_carousel_slides_focus_y_range;

ALTER TABLE public.carousel_slides
  DROP COLUMN IF EXISTS focus_x,
  DROP COLUMN IF EXISTS focus_y;

COMMIT;
