-- ============================================================================
-- BOTICA NATURAL — SUÍTE DE TESTES DE SEGURANÇA RLS (FASE 5)
-- Arquivo: supabase/tests/rls_checks.sql
-- Execução: Cole e execute no SQL Editor do Supabase APÓS aplicar a migração
--           `supabase/migrations/20261104200000_security_hardening.sql`.
-- Nota: Todo o teste roda dentro de `BEGIN ... ROLLBACK`, portanto não altera
--       nem suja os dados reais de produção.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  v_regular_user_id UUID := '00000000-0000-4000-a000-000000000001';
  v_admin_user_id   UUID := '00000000-0000-4000-a000-000000000002';
  v_inactive_prod   UUID := '00000000-0000-4000-b000-000000000001';
  v_active_prod     UUID := '00000000-0000-4000-b000-000000000002';
  v_admin_new_prod  UUID := '00000000-0000-4000-b000-000000000003';
  v_count           INTEGER;
  v_updated_rows    INTEGER;
  v_deleted_rows    INTEGER;
  v_blocked         BOOLEAN;
BEGIN
  -- --------------------------------------------------------------------------
  -- 0. PREPARAÇÃO DE FIXTURES (COMO SUPERUSER / POSTGRES DENTRO DA TRANSAÇÃO)
  -- --------------------------------------------------------------------------
  INSERT INTO auth.users (id, email, raw_user_meta_data, created_at, updated_at)
  VALUES
    (v_regular_user_id, 'usuario.comum.teste@example.com', '{}'::jsonb, NOW(), NOW()),
    (v_admin_user_id,   'admin.legitimo.teste@example.com', '{}'::jsonb, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

  -- Registra apenas v_admin_user_id na tabela public.admin_users
  INSERT INTO public.admin_users (user_id)
  VALUES (v_admin_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Insere 1 produto INATIVO e 1 produto ATIVO para validação
  INSERT INTO public.products (id, name, description, price, is_active)
  VALUES
    (v_inactive_prod, 'Produto Secreto Inativo Teste', 'Não deve vazar para anon', 99.90, false),
    (v_active_prod,   'Produto Público Ativo Teste',   'Visível na vitrine',       49.90, true);

  -- --------------------------------------------------------------------------
  -- TESTE (a): Como `anon`, SELECT em produto inativo retorna 0 linhas
  -- --------------------------------------------------------------------------
  EXECUTE 'SET LOCAL ROLE anon';
  PERFORM set_config('request.jwt.claim.role', 'anon', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);

  SELECT COUNT(*) INTO v_count
    FROM public.products
   WHERE id = v_inactive_prod;

  IF v_count <> 0 THEN
    RAISE EXCEPTION '[FALHA TESTE A] Usuário anon conseguiu ler produto inativo (linhas=%).', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count
    FROM public.products
   WHERE id = v_active_prod;

  IF v_count <> 1 THEN
    RAISE EXCEPTION '[FALHA TESTE A] Usuário anon não conseguiu ler produto ativo (linhas=%).', v_count;
  END IF;

  EXECUTE 'RESET ROLE';
  RAISE NOTICE '[OK TESTE A] Papel anon retorna 0 linhas para produto inativo e 1 linha para ativo.';

  -- --------------------------------------------------------------------------
  -- TESTE (b): Como usuário comum autenticado, INSERT/UPDATE/DELETE em `products` falha
  -- --------------------------------------------------------------------------
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_regular_user_id::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', v_regular_user_id::text)::text,
    true
  );

  -- b.1) Tenta INSERT
  v_blocked := false;
  BEGIN
    INSERT INTO public.products (name, price, is_active)
    VALUES ('Tentativa Invasao Insert', 10.00, true);
  EXCEPTION
    WHEN insufficient_privilege OR check_violation OR OTHERS THEN
      v_blocked := true;
  END;

  IF NOT v_blocked THEN
    RAISE EXCEPTION '[FALHA TESTE B.1] Usuário autenticado comum conseguiu fazer INSERT em products!';
  END IF;

  -- b.2) Tenta UPDATE (RLS com USING(public.is_admin()) filtra 0 linhas para não-admin)
  UPDATE public.products
     SET price = 1.00
   WHERE id = v_active_prod;
  GET DIAGNOSTICS v_updated_rows = ROW_COUNT;

  IF v_updated_rows <> 0 THEN
    RAISE EXCEPTION '[FALHA TESTE B.2] Usuário autenticado comum conseguiu fazer UPDATE em products!';
  END IF;

  -- b.3) Tenta DELETE
  DELETE FROM public.products
   WHERE id = v_active_prod;
  GET DIAGNOSTICS v_deleted_rows = ROW_COUNT;

  IF v_deleted_rows <> 0 THEN
    RAISE EXCEPTION '[FALHA TESTE B.3] Usuário autenticado comum conseguiu fazer DELETE em products!';
  END IF;

  EXECUTE 'RESET ROLE';
  RAISE NOTICE '[OK TESTE B] Usuário autenticado comum bloqueado em INSERT, UPDATE e DELETE.';

  -- --------------------------------------------------------------------------
  -- TESTE (c): `UPDATE auth.users SET raw_user_meta_data = '{"role":"admin"}'`
  --            NÃO concede privilégio administrativo
  -- --------------------------------------------------------------------------
  UPDATE auth.users
     SET raw_user_meta_data = '{"role":"admin"}'::jsonb,
         raw_app_meta_data  = '{"role":"admin"}'::jsonb
   WHERE id = v_regular_user_id;

  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_regular_user_id::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'role', 'authenticated',
      'sub', v_regular_user_id::text,
      'user_metadata', json_build_object('role', 'admin'),
      'app_metadata', json_build_object('role', 'admin')
    )::text,
    true
  );

  IF public.is_admin() IS TRUE THEN
    RAISE EXCEPTION '[FALHA TESTE C] Escalada de privilégio via user_metadata/app_metadata concedeu is_admin() = true!';
  END IF;

  v_blocked := false;
  BEGIN
    INSERT INTO public.products (name, price, is_active)
    VALUES ('Tentativa Escalada Metadata', 10.00, true);
  EXCEPTION
    WHEN OTHERS THEN
      v_blocked := true;
  END;

  IF NOT v_blocked THEN
    RAISE EXCEPTION '[FALHA TESTE C] Usuário com raw_user_meta_data={"role":"admin"} conseguiu inserir produto!';
  END IF;

  EXECUTE 'RESET ROLE';
  RAISE NOTICE '[OK TESTE C] raw_user_meta_data = {"role":"admin"} NÃO concede acesso administrativo.';

  -- --------------------------------------------------------------------------
  -- TESTE (d): O administrador cadastrado em `public.admin_users` consegue ler inativos e escrever
  -- --------------------------------------------------------------------------
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_admin_user_id::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', v_admin_user_id::text)::text,
    true
  );

  IF public.is_admin() IS NOT TRUE THEN
    RAISE EXCEPTION '[FALHA TESTE D] Administrador cadastrado em public.admin_users recebeu is_admin() = false!';
  END IF;

  -- Admin consegue enxergar produto inativo
  SELECT COUNT(*) INTO v_count
    FROM public.products
   WHERE id = v_inactive_prod;

  IF v_count <> 1 THEN
    RAISE EXCEPTION '[FALHA TESTE D] Administrador não conseguiu consultar produto inativo!';
  END IF;

  -- Admin consegue fazer INSERT, UPDATE e DELETE
  INSERT INTO public.products (id, name, description, price, is_active)
  VALUES (v_admin_new_prod, 'Produto Criado Pelo Admin', 'Teste de escrita admin', 120.00, true);

  UPDATE public.products
     SET price = 135.00
   WHERE id = v_admin_new_prod;
  GET DIAGNOSTICS v_updated_rows = ROW_COUNT;

  IF v_updated_rows <> 1 THEN
    RAISE EXCEPTION '[FALHA TESTE D] Administrador não conseguiu atualizar produto!';
  END IF;

  DELETE FROM public.products
   WHERE id = v_admin_new_prod;
  GET DIAGNOSTICS v_deleted_rows = ROW_COUNT;

  IF v_deleted_rows <> 1 THEN
    RAISE EXCEPTION '[FALHA TESTE D] Administrador não conseguiu excluir produto!';
  END IF;

  EXECUTE 'RESET ROLE';
  RAISE NOTICE '[OK TESTE D] Administrador cadastrado em public.admin_users possui acesso completo de leitura e escrita.';
  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'TODOS OS 4 TESTES DE SEGURANÇA RLS (A, B, C, D) PASSARAM COM SUCESSO!';
  RAISE NOTICE '====================================================================';
END $$;

ROLLBACK;

