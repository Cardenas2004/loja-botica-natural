DO $$ BEGIN RAISE EXCEPTION 'ARQUIVO LEGADO — NÃO EXECUTAR. Use supabase/migrations/.'; END $$;

-- ============================================================================
-- Botica Natural — Migração Incremental: Ficha Técnica e Detalhes do Produto
-- Arquivo: supabase_product_details.sql
-- Arquitetura: PostgreSQL 15+ (Supabase) · 100% Idempotente e Seguro
-- ============================================================================

BEGIN;

-- 1. Expansão da tabela `public.products` com as novas colunas da página de detalhes
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sku_ref TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS short_description TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS payment_info TEXT NOT NULL DEFAULT 'Consulte formas de pagamento via WhatsApp / Cartão e Pix',
  ADD COLUMN IF NOT EXISTS usage_instructions TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS composition TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS package_info TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS allergen_info TEXT NOT NULL DEFAULT 'Não contém lactose e glúten.',
  ADD COLUMN IF NOT EXISTS quality_note TEXT NOT NULL DEFAULT 'Todos os produtos da Botica Natural são preparados com matérias-primas selecionadas e rigoroso controle de qualidade farmacêutico, garantindo melhor eficácia.';

-- 2. Documentação e comentários semânticos das novas colunas
COMMENT ON COLUMN public.products.sku_ref IS 'Código de referência da fórmula ou SKU interno (ex: REF: 4299).';
COMMENT ON COLUMN public.products.short_description IS 'Resumo conciso dos benefícios exibido no topo da página de detalhes e no card da vitrine.';
COMMENT ON COLUMN public.products.payment_info IS 'Informação resumida sobre meios de pagamento exibida ao lado do ícone de cartão.';
COMMENT ON COLUMN public.products.usage_instructions IS 'Posologia e instruções detalhadas de como usar o medicamento magistral.';
COMMENT ON COLUMN public.products.composition IS 'Lista de ativos e composição exibida no bloco "Contém:".';
COMMENT ON COLUMN public.products.package_info IS 'Apresentação física da embalagem (ex: Frasco com 90 cápsulas).';
COMMENT ON COLUMN public.products.allergen_info IS 'Avisos de restrições alimentares e alergênicos (ex: Não contém lactose e glúten).';
COMMENT ON COLUMN public.products.quality_note IS 'Nota em destaque de compromisso com rigor e qualidade farmacêutica no final da descrição.';

COMMIT;

