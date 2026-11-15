-- ============================================================================
-- BOTICA NATURAL — Rollback de Destaques da Home em Produtos
-- Arquivo: 20261114110000_products_home_featured_rollback.sql
-- Ambiente: PostgreSQL 15+ (Supabase) · 100% Idempotente
-- ============================================================================

BEGIN;

DROP INDEX IF EXISTS public.idx_products_home_featured;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS chk_products_home_position_non_negative;

ALTER TABLE public.products
  DROP COLUMN IF EXISTS home_position,
  DROP COLUMN IF EXISTS home_featured;

COMMIT;
