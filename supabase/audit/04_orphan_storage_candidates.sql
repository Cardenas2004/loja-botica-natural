-- =============================================================================
-- AUDITORIA SOMENTE-LEITURA: Objetos do bucket de Storage sem referência ativa
-- Objetivo: Identificar arquivos no bucket 'product-images' que não constam em
--           nenhum produto (image_path ou image_url) nem em banner (carousel_slides).
-- NOTA: Executar no SQL Editor com permissões de leitura em storage.objects.
-- =============================================================================

SELECT
    o.id,
    o.name AS storage_path,
    o.created_at,
    o.metadata->>'size' AS size_bytes,
    o.metadata->>'mimetype' AS mimetype
FROM storage.objects o
WHERE o.bucket_id = 'product-images'
  AND NOT EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.image_path = o.name
         OR p.image_url LIKE '%' || o.name || '%'
  )
  AND NOT EXISTS (
      SELECT 1 FROM public.carousel_slides s
      WHERE s.image_path = o.name
         OR s.image_url LIKE '%' || o.name || '%'
  )
ORDER BY o.created_at DESC;
