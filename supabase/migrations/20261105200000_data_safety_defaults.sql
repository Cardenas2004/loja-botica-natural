-- =============================================================================
-- MIGRAÇÃO: 20261105200000_data_safety_defaults.sql
-- DESCRIÇÃO:
--   1. Altera DEFAULT de allergen_info e quality_note para string vazia (''),
--      impedindo pré-preenchimento automático com afirmações não verificadas.
--      NÃO altera linhas existentes de produtos já cadastrados no banco.
--   2. Adiciona constraints de tamanho para sku_ref e benefits (se presente).
--   3. Cria índice único parcial em sku_ref (onde sku_ref <> '').
-- IDEMPOTÊNCIA: Totalmente idempotente, seguro para reexecução.
-- ROLLBACK: Bloco comentado ao final do arquivo.
-- =============================================================================

BEGIN;

-- 1. Remoção de defaults com afirmações automáticas de alergênicos e qualidade
--    Garante que novos produtos nasçam com campos vazios (dependendo de inserção explícita).
ALTER TABLE public.products
    ALTER COLUMN allergen_info SET DEFAULT '',
    ALTER COLUMN quality_note SET DEFAULT '';

-- Garante existência da coluna benefits (caso schema venha de dump intermediário) e zera seu default
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'benefits'
    ) THEN
        ALTER TABLE public.products ALTER COLUMN benefits SET DEFAULT '';
    ELSE
        ALTER TABLE public.products ADD COLUMN benefits TEXT NOT NULL DEFAULT '';
    END IF;
END
$$;

-- 2. Constraints de validação de tamanho para sku_ref e benefits
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_products_sku_ref_length'
          AND conrelid = 'public.products'::regclass
    ) THEN
        ALTER TABLE public.products
            ADD CONSTRAINT chk_products_sku_ref_length
            CHECK (sku_ref IS NULL OR char_length(sku_ref) <= 100);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_products_benefits_length'
          AND conrelid = 'public.products'::regclass
    ) THEN
        ALTER TABLE public.products
            ADD CONSTRAINT chk_products_benefits_length
            CHECK (benefits IS NULL OR char_length(benefits) <= 5000);
    END IF;
END
$$;

-- 3. Índice Único Parcial para sku_ref (SKU duplicado é proibido quando preenchido)
-- Pré-checagem de duplicatas: caso haja SKUs duplicados não-vazios, a criação de índice único falharia.
-- A consulta em supabase/audit/01_data_integrity.sql permite auditar antes da execução.
DO $$
DECLARE
    duplicate_count integer;
BEGIN
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT sku_ref
        FROM public.products
        WHERE sku_ref IS NOT NULL AND btrim(sku_ref) <> ''
        GROUP BY sku_ref
        HAVING COUNT(*) > 1
    ) dup;

    IF duplicate_count = 0 THEN
        CREATE UNIQUE INDEX IF NOT EXISTS idx_products_sku_ref_unique
        ON public.products (btrim(sku_ref))
        WHERE sku_ref IS NOT NULL AND btrim(sku_ref) <> '';
    ELSE
        RAISE NOTICE 'Atenção: Existem % SKUs duplicados preenchidos. Índice único não criado. Consulte supabase/audit/01_data_integrity.sql para sanear duplicatas.', duplicate_count;
    END IF;
END
$$;

COMMIT;

-- =============================================================================
-- BLOCO DE ROLLBACK (EXECUTAR APENAS SE FOR NECESSÁRIO REVERTER):
-- =============================================================================
-- BEGIN;
-- DROP INDEX IF EXISTS public.idx_products_sku_ref_unique;
-- ALTER TABLE public.products DROP CONSTRAINT IF EXISTS chk_products_sku_ref_length;
-- ALTER TABLE public.products DROP CONSTRAINT IF EXISTS chk_products_benefits_length;
-- ALTER TABLE public.products ALTER COLUMN allergen_info SET DEFAULT 'Não contém lactose e glúten.';
-- ALTER TABLE public.products ALTER COLUMN quality_note SET DEFAULT 'Todas as nossas fórmulas são manipuladas seguindo rigorosamente as Boas Práticas de Manipulação (RDC 67/2007 da ANVISA). Matérias-primas com laudo de pureza e controle de qualidade lote a lote.';
-- COMMIT;
