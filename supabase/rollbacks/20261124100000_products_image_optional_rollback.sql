-- Rollback de 20261124100000_products_image_optional.sql
-- ATENÇÃO: falha se existir produto sem foto; cadastre as fotos antes de aplicar.
ALTER TABLE public.products
  ADD CONSTRAINT products_image_path_not_empty CHECK (char_length(TRIM(BOTH FROM image_path)) > 0),
  ADD CONSTRAINT products_image_url_not_empty  CHECK (char_length(TRIM(BOTH FROM image_url)) > 0);
