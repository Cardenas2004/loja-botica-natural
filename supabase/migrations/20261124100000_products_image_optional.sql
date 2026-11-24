-- ============================================================================
-- Botica Natural — Foto do produto opcional
-- Arquivo: supabase/migrations/20261124100000_products_image_optional.sql
-- Rollback: supabase/rollbacks/20261124100000_products_image_optional_rollback.sql
-- ============================================================================
-- O banco de produção tinha duas CHECK constraints (criadas fora das migrations
-- versionadas) que exigiam image_path/image_url preenchidos. O admin já trata
-- foto como opcional (permite remover a foto) e todo o front público cai em
-- FALLBACK_PRODUCT_IMAGE quando a imagem está vazia, então a regra só gerava
-- erro de constraint ao salvar produto sem foto.
--
-- As colunas continuam NOT NULL DEFAULT '': "sem foto" é sempre string vazia,
-- nunca NULL, mantendo o contrato que o front espera.
-- ============================================================================

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_image_path_not_empty;
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_image_url_not_empty;

UPDATE public.products SET image_path = '' WHERE image_path IS NULL;
UPDATE public.products SET image_url  = '' WHERE image_url  IS NULL;
ALTER TABLE public.products ALTER COLUMN image_path SET DEFAULT '';
ALTER TABLE public.products ALTER COLUMN image_url  SET DEFAULT '';
ALTER TABLE public.products ALTER COLUMN image_path SET NOT NULL;
ALTER TABLE public.products ALTER COLUMN image_url  SET NOT NULL;
