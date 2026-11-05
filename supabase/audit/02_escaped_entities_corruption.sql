-- =============================================================================
-- AUDITORIA SOMENTE-LEITURA: Produtos afetados por corrupção de escape duplo (BUG-ESCAPE)
-- Objetivo: Listar campos de texto que contenham entidades acumuladas
--           como &amp;amp;, &amp;lt;, &amp;gt;, &amp;quot;.
-- =============================================================================

SELECT
    id,
    name,
    sku_ref,
    is_active,
    (short_description LIKE '%&amp;amp;%' OR short_description LIKE '%&amp;lt;%' OR short_description LIKE '%&amp;gt;%') AS corrupt_short_desc,
    (description LIKE '%&amp;amp;%' OR description LIKE '%&amp;lt;%' OR description LIKE '%&amp;gt;%') AS corrupt_desc,
    (usage_instructions LIKE '%&amp;amp;%' OR usage_instructions LIKE '%&amp;lt;%' OR usage_instructions LIKE '%&amp;gt;%') AS corrupt_usage,
    (composition LIKE '%&amp;amp;%' OR composition LIKE '%&amp;lt;%' OR composition LIKE '%&amp;gt;%') AS corrupt_comp,
    (package_info LIKE '%&amp;amp;%' OR package_info LIKE '%&amp;lt;%' OR package_info LIKE '%&amp;gt;%') AS corrupt_pack,
    (allergen_info LIKE '%&amp;amp;%' OR allergen_info LIKE '%&amp;lt;%' OR allergen_info LIKE '%&amp;gt;%') AS corrupt_allerg,
    (quality_note LIKE '%&amp;amp;%' OR quality_note LIKE '%&amp;lt;%' OR quality_note LIKE '%&amp;gt;%') AS corrupt_qual,
    (payment_info LIKE '%&amp;amp;%' OR payment_info LIKE '%&amp;lt;%' OR payment_info LIKE '%&amp;gt;%') AS corrupt_pay
FROM public.products
WHERE short_description LIKE '%&amp;amp;%' OR short_description LIKE '%&amp;lt;%' OR short_description LIKE '%&amp;gt;%'
   OR description LIKE '%&amp;amp;%' OR description LIKE '%&amp;lt;%' OR description LIKE '%&amp;gt;%'
   OR usage_instructions LIKE '%&amp;amp;%' OR usage_instructions LIKE '%&amp;lt;%' OR usage_instructions LIKE '%&amp;gt;%'
   OR composition LIKE '%&amp;amp;%' OR composition LIKE '%&amp;lt;%' OR composition LIKE '%&amp;gt;%'
   OR package_info LIKE '%&amp;amp;%' OR package_info LIKE '%&amp;lt;%' OR package_info LIKE '%&amp;gt;%'
   OR allergen_info LIKE '%&amp;amp;%' OR allergen_info LIKE '%&amp;lt;%' OR allergen_info LIKE '%&amp;gt;%'
   OR quality_note LIKE '%&amp;amp;%' OR quality_note LIKE '%&amp;lt;%' OR quality_note LIKE '%&amp;gt;%'
   OR payment_info LIKE '%&amp;amp;%' OR payment_info LIKE '%&amp;lt;%' OR payment_info LIKE '%&amp;gt;%'
ORDER BY name ASC;
