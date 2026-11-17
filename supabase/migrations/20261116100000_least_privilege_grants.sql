-- ============================================================================
-- Botica Natural — Hardening Fase 3: Menor Privilégio em Grants e Funções
-- Arquivo: supabase/migrations/20261116100000_least_privilege_grants.sql
-- Rollback: supabase/rollbacks/20261116100000_least_privilege_grants_rollback.sql (fora de migrations/ para nunca ser aplicado por `supabase db push`)
-- ============================================================================
-- POR QUE ESTA MIGRAÇÃO EXISTE (achados F3, F4 e F5 de docs/auditoria/seguranca-fase3.md):
--
--   F3 — Grants de tabela excessivos. O padrão do Supabase concede
--        `INSERT/UPDATE/DELETE/TRUNCATE/TRIGGER/REFERENCES` ao `anon` em toda
--        tabela de `public`, e os default privileges repetem isso em tabelas
--        NOVAS. Hoje o RLS bloqueia a escrita anônima (comprovado na auditoria,
--        com BEGIN/ROLLBACK), mas o RLS vira a ÚNICA barreira: basta uma tabela
--        futura criada sem policy, ou um `DISABLE ROW LEVEL SECURITY` acidental,
--        para o catálogo ficar gravável por qualquer visitante. Além disso,
--        `TRUNCATE` ignora RLS por definição.
--        → O `anon` passa a ter apenas SELECT (somente leitura da vitrine).
--        → `authenticated` mantém DML (o admin escreve via RLS + is_admin()),
--          mas perde TRUNCATE/TRIGGER/REFERENCES, que nenhum fluxo usa.
--
--   F4 — `public.slugify_product_text` e `public.ensure_product_slug` sem
--        `search_path` fixo (lint 0011). Fixado em '' (corpos usam somente
--        funções de pg_catalog e tabelas já qualificadas com `public.`).
--
--   F5 — `public.rls_auto_enable()` (função de event trigger, SECURITY DEFINER)
--        executável por `anon`/`authenticated` via /rest/v1/rpc (lint 0028/0029).
--        Não é explorável hoje (funções de event trigger não podem ser chamadas
--        diretamente), mas não há motivo para expô-la. O event trigger
--        `ensure_rls` continua funcionando: o EXECUTE não é checado no disparo.
--
-- O QUE NÃO MUDA:
--   * Policies RLS existentes (nenhuma é recriada).
--   * `public.is_admin()` continua executável por `authenticated` — as policies
--     a invocam no contexto do usuário logado; revogar quebraria o admin.
--   * Leitura pública do catálogo (SELECT do anon) e o bucket `product-images`.
--
-- COMO VALIDAR APÓS APLICAR: supabase/tests/rls_checks.sql (seção "Fase 3").
-- ============================================================================

BEGIN;

-- F3.1 — anon: somente leitura nas tabelas expostas da vitrine
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES
  ON ALL TABLES IN SCHEMA public FROM anon;

-- F3.2 — authenticated: mantém DML (governado por RLS), remove o resto
REVOKE TRUNCATE, TRIGGER, REFERENCES
  ON ALL TABLES IN SCHEMA public FROM authenticated;

-- F3.3 — Tabelas FUTURAS criadas pelo role `postgres` (SQL Editor / migrações)
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM authenticated;

-- F4 — search_path imutável nas funções de slug
ALTER FUNCTION public.slugify_product_text(text) SET search_path = '';
ALTER FUNCTION public.ensure_product_slug() SET search_path = '';

-- F5 — função de event trigger fora da API pública
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

COMMIT;
