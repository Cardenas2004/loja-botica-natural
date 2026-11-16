-- ============================================================================
-- Rollback de supabase/migrations/20261116100000_least_privilege_grants.sql
-- Restaura os grants padrão do Supabase. Use APENAS se algum fluxo legítimo
-- quebrar após a migração; o RLS volta a ser a única barreira de escrita.
-- ============================================================================

BEGIN;

GRANT INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES
  ON ALL TABLES IN SCHEMA public TO anon;
GRANT TRUNCATE, TRIGGER, REFERENCES
  ON ALL TABLES IN SCHEMA public TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT TRUNCATE, TRIGGER, REFERENCES ON TABLES TO authenticated;

ALTER FUNCTION public.slugify_product_text(text) RESET search_path;
ALTER FUNCTION public.ensure_product_slug() RESET search_path;

GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO PUBLIC, anon, authenticated;

COMMIT;
