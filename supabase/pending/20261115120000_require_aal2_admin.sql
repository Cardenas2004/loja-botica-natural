-- ============================================================================
-- Botica Natural — Hardening Fase 2 (Item 5): Exigência Obrigatória de AAL2 (MFA)
-- Arquivo: supabase/pending/20261115120000_require_aal2_admin.sql
-- ============================================================================
-- ATENÇÃO — MANTIDO EM `supabase/pending/` INTENCIONALMENTE PARA EVITAR LOCKOUT!
-- NÃO execute este script antes de concluir TODOS os 4 passos do runbook abaixo:
--
--   RUNBOOK OBRIGATÓRIO ANTES DE APLICAR:
--   (1) No painel do Supabase -> Authentication -> Multi-Factor Authentication,
--       habilite TOTP (App Autenticador).
--   (2) Acesse o painel `/admin` com a conta administrativa em `#/seguranca` e
--       inscreva o fator TOTP (`supabase.auth.mfa.enroll` + confirmação do código).
--   (3) Faça logout completo e teste um novo login em `/admin` preenchendo
--       e-mail, senha e o código de 6 dígitos do aplicativo autenticador.
--   (4) Somente após confirmar que o login com TOTP funciona, cole e execute
--       este script no SQL Editor do Supabase.
--
-- Documentação completa e plano de recuperação em caso de perda do dispositivo:
--   `docs/seguranca.md`
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE user_id = auth.uid()
  )
  AND COALESCE(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

COMMENT ON FUNCTION public.is_admin() IS
  'Verifica se o usuário autenticado (auth.uid()) consta em public.admin_users e possui nível MFA AAL2.';

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ============================================================================
-- ROLLBACK DE EMERGÊNCIA (CASO OCORRA PERDA DE DISPOSITIVO OU LOCKOUT)
-- Execute no SQL Editor do Supabase (service role) apenas após confirmar a
-- identidade do proprietário e remover o fator comprometido em auth.mfa_factors:
-- ============================================================================
-- BEGIN;
--
-- CREATE OR REPLACE FUNCTION public.is_admin()
-- RETURNS boolean
-- LANGUAGE sql
-- SECURITY DEFINER
-- SET search_path = public, auth
-- STABLE
-- AS $$
--   SELECT EXISTS (
--     SELECT 1
--     FROM public.admin_users
--     WHERE user_id = auth.uid()
--   );
-- $$;
--
-- COMMENT ON FUNCTION public.is_admin() IS
--   'Verifica se o usuário autenticado (auth.uid()) consta na tabela public.admin_users.';
--
-- REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
-- GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
--
-- NOTIFY pgrst, 'reload schema';
--
-- COMMIT;
