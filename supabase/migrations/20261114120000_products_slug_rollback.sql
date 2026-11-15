-- ============================================================================
-- Rollback Migração Fase 7 (ALTO-09): Remover slug de public.products
-- ============================================================================

DROP TRIGGER IF EXISTS trg_products_ensure_slug ON public.products;
DROP FUNCTION IF EXISTS public.ensure_product_slug();
DROP INDEX IF EXISTS uq_products_slug_idx;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS chk_products_slug_format;

ALTER TABLE public.products
  DROP COLUMN IF EXISTS slug;

DROP FUNCTION IF EXISTS public.slugify_product_text(TEXT);
