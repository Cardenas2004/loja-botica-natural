-- ============================================================================
-- Botica Natural — Hardening Fase 2 (Item 1): Allowlist de Links Seguros
-- Arquivo: supabase/migrations/20261115100000_harden_button_links_allowlist.sql
-- ============================================================================
-- Substitui os CHECK constraints baseados em blocklist de
-- `public.carousel_slides.button_link` e `public.compound_showcase_cards.button_link`
-- por lista de permissão estrita (allowlist) usando Postgres ARE com lookahead.
--
-- Regra de permissão (máximo 500 caracteres, sem espaços ou barras invertidas `\`):
--   1. Vazio (`''`)
--   2. URL absoluta `http://` ou `https://` (`^https?://(?![/?#])[^[:space:]]{1,490}$`)
--   3. Caminho relativo com `/` (`^/(?!/)[^[:space:]]*$`) ou âncora `#` (`^#(?![/#])[^[:space:]]+$`)
--   4. Nome de arquivo simples (`^[A-Za-z0-9][A-Za-z0-9._-]*(\.html?)?([?#][^[:space:]]*)?$`)
--
-- Estimativa de impacto em linhas existentes:
--   - Os seeds oficiais em `20261113230000_compound_showcase_cards.sql` usam
--     exclusivamente `'produto.html?id=<uuid>'` (0 linhas de seed afetadas).
--   - Em bases de produção pré-existentes, apenas registros legados de
--     `carousel_slides` ou `compound_showcase_cards` contendo `//`, `/\`, `\/`,
--     esquemas bloqueados (`javascript:`, `data:`, `blob:`, `intent:`, `file:`,
--     `vbscript:`), espaços em branco ou >500 caracteres terão `button_link` zerado
--     para `''` antes da criação dos constraints.
-- ============================================================================

BEGIN;

-- 1. Higienização prévia idempotente (zera apenas registros fora da allowlist)
DO $$
DECLARE
  v_slides_affected INTEGER := 0;
  v_cards_affected INTEGER := 0;
BEGIN
  UPDATE public.carousel_slides
  SET button_link = ''
  WHERE button_link IS NULL
     OR NOT (
       char_length(button_link) <= 500
       AND (
         button_link = ''
         OR (
           button_link !~ '[[:space:]]'
           AND position(chr(92) in button_link) = 0
           AND (
             button_link ~* '^https?://(?![/?#])[^[:space:]]{1,490}$'
             OR button_link ~ '^/(?!/)[^[:space:]]*$'
             OR button_link ~ '^#(?![/#])[^[:space:]]+$'
             OR button_link ~ '^[A-Za-z0-9][A-Za-z0-9._-]*(\.html?)?([?#][^[:space:]]*)?$'
           )
         )
       )
     );
  GET DIAGNOSTICS v_slides_affected = ROW_COUNT;

  UPDATE public.compound_showcase_cards
  SET button_link = ''
  WHERE button_link IS NULL
     OR NOT (
       char_length(button_link) <= 500
       AND (
         button_link = ''
         OR (
           button_link !~ '[[:space:]]'
           AND position(chr(92) in button_link) = 0
           AND (
             button_link ~* '^https?://(?![/?#])[^[:space:]]{1,490}$'
             OR button_link ~ '^/(?!/)[^[:space:]]*$'
             OR button_link ~ '^#(?![/#])[^[:space:]]+$'
             OR button_link ~ '^[A-Za-z0-9][A-Za-z0-9._-]*(\.html?)?([?#][^[:space:]]*)?$'
           )
         )
       )
     );
  GET DIAGNOSTICS v_cards_affected = ROW_COUNT;

  RAISE NOTICE '[Hardening Fase 2] button_link higienizado — carousel_slides afetadas: %, compound_showcase_cards afetadas: %',
    v_slides_affected,
    v_cards_affected;
END
$$;

-- 2. Substituição do CHECK em public.carousel_slides
ALTER TABLE public.carousel_slides
  DROP CONSTRAINT IF EXISTS carousel_slides_button_link_chk;

ALTER TABLE public.carousel_slides
  ADD CONSTRAINT carousel_slides_button_link_chk CHECK (
    char_length(button_link) <= 500
    AND (
      button_link = ''
      OR (
        button_link !~ '[[:space:]]'
        AND position(chr(92) in button_link) = 0
        AND (
          button_link ~* '^https?://(?![/?#])[^[:space:]]{1,490}$'
          OR button_link ~ '^/(?!/)[^[:space:]]*$'
          OR button_link ~ '^#(?![/#])[^[:space:]]+$'
          OR button_link ~ '^[A-Za-z0-9][A-Za-z0-9._-]*(\.html?)?([?#][^[:space:]]*)?$'
        )
      )
    )
  );

-- 3. Substituição do CHECK em public.compound_showcase_cards
ALTER TABLE public.compound_showcase_cards
  DROP CONSTRAINT IF EXISTS chk_compound_cards_safe_button_link;

ALTER TABLE public.compound_showcase_cards
  ADD CONSTRAINT chk_compound_cards_safe_button_link CHECK (
    char_length(button_link) <= 500
    AND (
      button_link = ''
      OR (
        button_link !~ '[[:space:]]'
        AND position(chr(92) in button_link) = 0
        AND (
          button_link ~* '^https?://(?![/?#])[^[:space:]]{1,490}$'
          OR button_link ~ '^/(?!/)[^[:space:]]*$'
          OR button_link ~ '^#(?![/#])[^[:space:]]+$'
          OR button_link ~ '^[A-Za-z0-9][A-Za-z0-9._-]*(\.html?)?([?#][^[:space:]]*)?$'
        )
      )
    )
  );

NOTIFY pgrst, 'reload schema';

COMMIT;
