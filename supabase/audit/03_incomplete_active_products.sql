-- =============================================================================
-- AUDITORIA SOMENTE-LEITURA: Produtos ativos com cadastro incompleto
-- Objetivo: Identificar produtos ativos na vitrine que estejam sem categoria,
--           sem imagem válida ou com preço zerado/nulo.
-- =============================================================================

SELECT
    p.id,
    p.name,
    p.sku_ref,
    p.price,
    p.category_id,
    c.name AS category_name,
    p.image_url,
    p.image_path,
    CASE WHEN p.category_id IS NULL THEN 'SEM_CATEGORIA' ELSE 'OK' END AS flag_categoria,
    CASE WHEN p.image_url IS NULL OR btrim(p.image_url) = '' THEN 'SEM_IMAGEM' ELSE 'OK' END AS flag_imagem,
    CASE WHEN p.price <= 0 THEN 'PRECO_ZERADO_OU_SOB_CONSULTA' ELSE 'OK' END AS flag_preco
FROM public.products p
LEFT JOIN public.categories c ON c.id = p.category_id
WHERE p.is_active = true
  AND (
      p.category_id IS NULL
      OR p.image_url IS NULL
      OR btrim(p.image_url) = ''
      OR p.price <= 0
  )
ORDER BY p.name ASC;
