-- ============================================================================
-- Botica Natural — Hardening Fase 2 (Item 2): Restauração do Bucket Storage
-- Arquivo: supabase/migrations/20261115110000_restore_storage_hardening.sql
-- ============================================================================
-- POR QUE ESTA MIGRAÇÃO EXISTE:
--   A migração `20261113230000_compound_showcase_cards.sql` executou um novo
--   `INSERT INTO storage.buckets ... ON CONFLICT DO UPDATE` que sobrescreveu
--   silenciosamente os limites definidos em `20261104200000_security_hardening.sql`,
--   elevando `file_size_limit` de 2 MB (2097152) para 5 MB (5242880) e incluindo
--   `image/gif`, além de criar um segundo conjunto de policies duplicadas em
--   `storage.objects` (`product_images_public_read`, `product_images_admin_*`).
--
--   Para impedir nova deriva em migrações futuras:
--     * Nenhuma migração de funcionalidade/tabela deve alterar `storage.buckets`
--       nem recriar policies já padronizadas no hardening;
--     * Consulte `docs/seguranca-manual.md` e `scripts/verify.mjs` ao revisar
--       novos scripts SQL antes de aplicá-los no Supabase.
--
-- OBSERVAÇÃO SOBRE ENUMERAÇÃO DE STORAGE (`product_images_select_public`):
--   Busca estática no código (`js/`) confirmou ZERO chamadas a `.list(...)`.
--   Um bucket com `public = true` entrega arquivos por URL pública sem exigir
--   policy de SELECT para listagem em `storage.objects`. Mantemos
--   `product_images_select_public` nesta migração para não quebrar fluxo sem
--   confirmação explícita do proprietário; sua remoção opcional está documentada
--   em `docs/auditoria/seguranca-fase2.md` e `docs/seguranca-manual.md`.
-- ============================================================================

BEGIN;

-- 1. Restaura parâmetros estritos do bucket `product-images` (2 MB, sem image/gif)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  2097152, -- 2 MB (2 * 1024 * 1024 bytes)
  ARRAY['image/webp', 'image/jpeg', 'image/png']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/webp', 'image/jpeg', 'image/png']::text[];

-- 2. Remove o conjunto duplicado introduzido em 20261113230000_compound_showcase_cards.sql
DROP POLICY IF EXISTS "product_images_public_read" ON storage.objects;
DROP POLICY IF EXISTS "product_images_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "product_images_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "product_images_admin_delete" ON storage.objects;

-- 3. Recria idempotentemente o conjunto original padronizado + prefixo seguro de pastas
--    Pastas derivadas de `uploadStorageWebpImage` e seus chamadores em `js/admin/api.js`:
--      * 'catalogo' (saveProductRecord, saveCompoundCard)
--      * 'carousel' (saveCarouselSlide)
DROP POLICY IF EXISTS "product_images_select_public" ON storage.objects;
DROP POLICY IF EXISTS "product_images_insert_admin" ON storage.objects;
DROP POLICY IF EXISTS "product_images_update_admin" ON storage.objects;
DROP POLICY IF EXISTS "product_images_delete_admin" ON storage.objects;

CREATE POLICY "product_images_select_public"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'product-images');

CREATE POLICY "product_images_insert_admin"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND public.is_admin()
    AND name ~ '^(catalogo|carousel)/'
  );

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
    AND name ~ '^(catalogo|carousel)/'
  );

CREATE POLICY "product_images_delete_admin"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND public.is_admin()
  );

NOTIFY pgrst, 'reload schema';

COMMIT;
