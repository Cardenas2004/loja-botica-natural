-- =============================================================================
-- MIGRAÇÃO: 20261104210000_product_richtext_options.sql
-- DESCRIÇÃO: Adiciona suporte a opções de modo de texto rico (`text_options` JSONB)
--            e constraints de tamanho máximo nos campos descritivos de `products`.
-- SEGURANÇA: Preserva integralmente `public.admin_users`, `public.is_admin()` e
--            todas as policies de RLS existentes.
-- =============================================================================

BEGIN;

-- 1. Coluna `text_options` (JSONB) para persistir o modo de texto por campo
--    Valores suportados por chave: "paragraphs" | "lines" | "inline"
ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS text_options JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 2. Constraint garantindo que `text_options` seja sempre um objeto JSON
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_products_text_options_object'
          AND conrelid = 'public.products'::regclass
    ) THEN
        ALTER TABLE public.products
            ADD CONSTRAINT chk_products_text_options_object
            CHECK (jsonb_typeof(text_options) = 'object');
    END IF;
END
$$;

-- 3. Constraints de limite razoável de tamanho (char_length) nos campos de texto
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_products_text_lengths'
          AND conrelid = 'public.products'::regclass
    ) THEN
        ALTER TABLE public.products
            ADD CONSTRAINT chk_products_text_lengths
            CHECK (
                (short_description IS NULL OR char_length(short_description) <= 2000) AND
                (description IS NULL OR char_length(description) <= 25000) AND
                (usage_instructions IS NULL OR char_length(usage_instructions) <= 15000) AND
                (composition IS NULL OR char_length(composition) <= 15000) AND
                (package_info IS NULL OR char_length(package_info) <= 10000) AND
                (allergen_info IS NULL OR char_length(allergen_info) <= 5000) AND
                (quality_note IS NULL OR char_length(quality_note) <= 5000) AND
                (payment_info IS NULL OR char_length(payment_info) <= 2000) AND
                (whatsapp_message IS NULL OR char_length(whatsapp_message) <= 4000)
            ) NOT VALID;
        ALTER TABLE public.products VALIDATE CONSTRAINT chk_products_text_lengths;
    END IF;
END
$$;

COMMIT;

-- =============================================================================
-- INSTRUÇÕES DE ROLLBACK (executar manualmente apenas se desejar reverter):
--
-- BEGIN;
-- ALTER TABLE public.products DROP CONSTRAINT IF EXISTS chk_products_text_lengths;
-- ALTER TABLE public.products DROP CONSTRAINT IF EXISTS chk_products_text_options_object;
-- ALTER TABLE public.products DROP COLUMN IF EXISTS text_options;
-- COMMIT;
-- =============================================================================

