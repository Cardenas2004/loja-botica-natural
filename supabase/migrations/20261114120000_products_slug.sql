-- ============================================================================
-- Migração Fase 7 (ALTO-09): Slug único e SEO por Produto em public.products
-- ============================================================================
-- Descrição:
--   1. Adiciona coluna `slug` em `public.products`.
--   2. Gera backfill determinístico a partir de `name`, garantindo unicidade com
--      sufixo curto do UUID quando houver colisão.
--   3. Garante padrão URL-safe `^[a-z0-9]+(-[a-z0-9]+)*$`, `NOT NULL` e `UNIQUE`.
--   4. Trigger `BEFORE INSERT OR UPDATE` preenche `slug` automaticamente caso
--      inserções legadas não enviem o campo explicitamente.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.slugify_product_text(input_text TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(
    both '-' FROM regexp_replace(
      translate(
        lower(COALESCE(input_text, '')),
        'áàâãäåéèêëíìîïóòôõöøúùûüýÿçñ',
        'aaaaaaeeeeiiiioooooouuuuyycn'
      ),
      '[^a-z0-9]+',
      '-',
      'g'
    )
  );
$$;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS slug TEXT;

-- Backfill idempotente para todos os registros sem slug válido
WITH normalized AS (
  SELECT
    id,
    COALESCE(
      NULLIF(public.slugify_product_text(name), ''),
      'produto-' || left(replace(id::text, '-', ''), 8)
    ) AS base_slug,
    created_at
  FROM public.products
),
ranked AS (
  SELECT
    id,
    base_slug,
    ROW_NUMBER() OVER (PARTITION BY base_slug ORDER BY created_at ASC, id ASC) AS rn
  FROM normalized
)
UPDATE public.products p
SET slug = CASE
  WHEN r.rn = 1 THEN r.base_slug
  ELSE r.base_slug || '-' || left(replace(r.id::text, '-', ''), 6)
END
FROM ranked r
WHERE p.id = r.id
  AND (
    p.slug IS NULL
    OR btrim(p.slug) = ''
    OR p.slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  );

-- Resolver quaisquer colisões remanescentes caso slugs manuais pré-existam
WITH dupes AS (
  SELECT
    id,
    slug,
    ROW_NUMBER() OVER (PARTITION BY slug ORDER BY created_at ASC, id ASC) AS rn
  FROM public.products
)
UPDATE public.products p
SET slug = d.slug || '-' || left(replace(d.id::text, '-', ''), 6)
FROM dupes d
WHERE p.id = d.id AND d.rn > 1;

CREATE OR REPLACE FUNCTION public.ensure_product_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_base TEXT;
  v_candidate TEXT;
BEGIN
  v_base := public.slugify_product_text(COALESCE(NULLIF(btrim(NEW.slug), ''), NEW.name));
  IF v_base IS NULL OR v_base = '' THEN
    v_base := 'produto-' || left(replace(COALESCE(NEW.id, gen_random_uuid())::text, '-', ''), 8);
  END IF;

  IF NEW.slug IS NULL OR btrim(NEW.slug) = '' THEN
    v_candidate := v_base;
    IF EXISTS (
      SELECT 1 FROM public.products
      WHERE slug = v_candidate AND id IS DISTINCT FROM NEW.id
    ) THEN
      v_candidate := v_base || '-' || left(replace(COALESCE(NEW.id, gen_random_uuid())::text, '-', ''), 6);
    END IF;
    NEW.slug := v_candidate;
  ELSE
    NEW.slug := public.slugify_product_text(NEW.slug);
    IF NEW.slug = '' THEN
      NEW.slug := v_base;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_ensure_slug ON public.products;
CREATE TRIGGER trg_products_ensure_slug
  BEFORE INSERT OR UPDATE OF name, slug ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_product_slug();

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS chk_products_slug_format;

ALTER TABLE public.products
  ADD CONSTRAINT chk_products_slug_format
  CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

ALTER TABLE public.products
  ALTER COLUMN slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_products_slug_idx
  ON public.products (slug);

COMMENT ON COLUMN public.products.slug IS
  'Identificador amigável único de URL para páginas estáticas SEO /produtos/<slug>/.';
