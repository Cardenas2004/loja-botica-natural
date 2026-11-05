-- =============================================================================
-- AUDITORIA SOMENTE-LEITURA: Produtos com texto padrão antigo de alergênicos ou qualidade
-- Objetivo: Identificar produtos que herdaram o texto genérico antigo
--           ('Não contém lactose e glúten.' ou 'Todas as nossas fórmulas...')
--           para que o Responsável Técnico (RT) revise produto a produto.
-- =============================================================================

SELECT
    id,
    name,
    sku_ref,
    is_active,
    CASE
        WHEN allergen_info ILIKE '%Não contém lactose e glúten%' THEN 'TEXTO_PADRÃO_HERDADO'
        WHEN allergen_info = '' OR allergen_info IS NULL THEN 'VAZIO'
        ELSE 'PERSONALIZADO'
    END AS status_alergenos,
    allergen_info,
    CASE
        WHEN quality_note ILIKE '%Boas Práticas de Manipulação%' THEN 'TEXTO_PADRÃO_HERDADO'
        WHEN quality_note = '' OR quality_note IS NULL THEN 'VAZIO'
        ELSE 'PERSONALIZADO'
    END AS status_nota_qualidade,
    quality_note
FROM public.products
WHERE allergen_info ILIKE '%Não contém lactose e glúten%'
   OR quality_note ILIKE '%Boas Práticas de Manipulação%'
ORDER BY is_active DESC, name ASC;
