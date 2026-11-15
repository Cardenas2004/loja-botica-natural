-- ============================================================================
-- BOTICA NATURAL — Destaques da Home em Produtos (home_featured + home_position)
-- Arquivo: 20261114110000_products_home_featured.sql
-- Ambiente: PostgreSQL 15+ (Supabase) · 100% Idempotente
-- ============================================================================

BEGIN;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS home_featured BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS home_position INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_products_home_position_non_negative'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT chk_products_home_position_non_negative CHECK (home_position >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_home_featured
  ON public.products (home_position ASC, created_at DESC)
  WHERE is_active = true AND home_featured = true;

COMMENT ON COLUMN public.products.home_featured IS
  'Define se o produto é destacado na vitrine principal da página inicial (Home).';

COMMENT ON COLUMN public.products.home_position IS
  'Ordem numérica de exibição na vitrine da página inicial (menor valor aparece primeiro).';

COMMIT;
