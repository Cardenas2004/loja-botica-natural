-- =============================================================================
-- Migração: Aumento do Limite de Caracteres para short_description
-- Data: 2026-11-06
-- Permite até 5000 caracteres no banco para comportar 3000 caracteres visíveis
-- e tags HTML de formatação rica (<br>, <strong>, etc.)
-- =============================================================================

BEGIN;

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS chk_products_text_lengths;

ALTER TABLE public.products
    ADD CONSTRAINT chk_products_text_lengths
    CHECK (
        (short_description IS NULL OR char_length(short_description) <= 5000) AND
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

COMMIT;
