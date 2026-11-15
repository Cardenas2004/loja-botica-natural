-- ============================================================================
-- BOTICA NATURAL — SUÍTE DE TESTES DE SEGURANÇA RLS COMPLETA
-- Arquivo: supabase/tests/rls_checks.sql
-- Escopo: products, categories, carousel_slides, site_settings, storage.objects, admin_users e is_admin().
--
-- COMO EXECUTAR:
-- 1. No painel web do Supabase (SQL Editor):
--    Copie todo o conteúdo deste script, cole no SQL Editor e clique em "Run".
--    O script roda dentro de `BEGIN ... ROLLBACK`, sem persistir nenhuma alteração em produção.
--
-- 2. Localmente via Supabase CLI + psql:
--    supabase start
--    supabase db reset
--    psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/tests/rls_checks.sql
-- ============================================================================

BEGIN;

DO $$
DECLARE
  v_regular_user_id UUID := '00000000-0000-4000-a000-000000000001';
  v_admin_user_id   UUID := '00000000-0000-4000-a000-000000000002';
  v_inactive_prod   UUID := '00000000-0000-4000-b000-000000000001';
  v_active_prod     UUID := '00000000-0000-4000-b000-000000000002';
  v_admin_new_prod  UUID := '00000000-0000-4000-b000-000000000003';
  v_inactive_cat    UUID := '00000000-0000-4000-c000-000000000001';
  v_active_cat      UUID := '00000000-0000-4000-c000-000000000002';
  v_inactive_slide  UUID := '00000000-0000-4000-d000-000000000001';
  v_active_slide    UUID := '00000000-0000-4000-d000-000000000002';
  v_inactive_card   UUID := '00000000-0000-4000-e000-000000000001';
  v_active_card     UUID := '00000000-0000-4000-e000-000000000002';
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

  -- Categorias de teste
  INSERT INTO public.categories (id, name, slug, display_order, is_active)
  VALUES
    (v_inactive_cat, 'Categoria Inativa', 'cat-inativa', 99, false),
    (v_active_cat,   'Categoria Ativa',   'cat-ativa',   1,  true)
  ON CONFLICT (id) DO NOTHING;

  -- Produtos de teste
  INSERT INTO public.products (id, category_id, name, description, price, is_active)
  VALUES
    (v_inactive_prod, v_active_cat, 'Produto Secreto Inativo Teste', 'Não deve vazar para anon', 99.90, false),
    (v_active_prod,   v_active_cat, 'Produto Público Ativo Teste',   'Visível na vitrine',       49.90, true)
  ON CONFLICT (id) DO NOTHING;

  -- Banners de teste
  INSERT INTO public.carousel_slides (id, title, image_url, button_link, display_order, is_active)
  VALUES
    (v_inactive_slide, 'Banner Inativo', 'https://example.com/banner-inativo.webp', '', 99, false),
    (v_active_slide,   'Banner Ativo',   'https://example.com/banner-ativo.webp',   '', 1,  true)
  ON CONFLICT (id) DO NOTHING;

  -- Cards de compostos de teste
  INSERT INTO public.compound_showcase_cards (id, title, label_title, card_theme, botanical_theme, display_order, is_active)
  VALUES
    (v_inactive_card, 'Composto Inativo', 'INATIVO', 'green', 'alcachofra', 99, false),
    (v_active_card,   'Composto Ativo',   'ATIVO',   'purple', 'berries',   1,  true)
  ON CONFLICT (id) DO NOTHING;

  -- Configurações globais de teste
  INSERT INTO public.site_settings (key, value)
  VALUES
    ('whatsapp_product_message_template', 'Template público autorizado'),
    ('internal_secret_key', 'chave_privada_nao_deve_vazar_para_anon')
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

  -- --------------------------------------------------------------------------
  -- TESTE 1: Como `anon`, leitura de itens inativos retorna 0 linhas
  -- --------------------------------------------------------------------------
  EXECUTE 'SET LOCAL ROLE anon';
  PERFORM set_config('request.jwt.claim.role', 'anon', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);

  -- 1.1 Products
  SELECT COUNT(*) INTO v_count FROM public.products WHERE id = v_inactive_prod;
  IF v_count <> 0 THEN
    RAISE EXCEPTION '[FALHA TESTE 1.1] Usuário anon conseguiu ler produto inativo (linhas=%).', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.products WHERE id = v_active_prod;
  IF v_count <> 1 THEN
    RAISE EXCEPTION '[FALHA TESTE 1.1] Usuário anon não conseguiu ler produto ativo (linhas=%).', v_count;
  END IF;

  -- 1.2 Categories
  SELECT COUNT(*) INTO v_count FROM public.categories WHERE id = v_inactive_cat;
  IF v_count <> 0 THEN
    RAISE EXCEPTION '[FALHA TESTE 1.2] Usuário anon conseguiu ler categoria inativa (linhas=%).', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.categories WHERE id = v_active_cat;
  IF v_count <> 1 THEN
    RAISE EXCEPTION '[FALHA TESTE 1.2] Usuário anon não conseguiu ler categoria ativa (linhas=%).', v_count;
  END IF;

  -- 1.3 Carousel Slides
  SELECT COUNT(*) INTO v_count FROM public.carousel_slides WHERE id = v_inactive_slide;
  IF v_count <> 0 THEN
    RAISE EXCEPTION '[FALHA TESTE 1.3] Usuário anon conseguiu ler banner inativo (linhas=%).', v_count;
  END IF;

  -- 1.3b Compound Showcase Cards
  SELECT COUNT(*) INTO v_count FROM public.compound_showcase_cards WHERE id = v_inactive_card;
  IF v_count <> 0 THEN
    RAISE EXCEPTION '[FALHA TESTE 1.3b] Usuário anon conseguiu ler card de composto inativo (linhas=%).', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.compound_showcase_cards WHERE id = v_active_card;
  IF v_count <> 1 THEN
    RAISE EXCEPTION '[FALHA TESTE 1.3b] Usuário anon não conseguiu ler card de composto ativo (linhas=%).', v_count;
  END IF;

  -- 1.4 Site Settings (whitelist estrita)
  SELECT COUNT(*) INTO v_count FROM public.site_settings WHERE key = 'whatsapp_product_message_template';
  IF v_count <> 1 THEN
    RAISE EXCEPTION '[FALHA TESTE 1.4] Usuário anon não conseguiu ler chave permitida de site_settings (linhas=%).', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.site_settings WHERE key = 'internal_secret_key';
  IF v_count <> 0 THEN
    RAISE EXCEPTION '[FALHA TESTE 1.4] Usuário anon conseguiu ler chave secreta de site_settings (linhas=%).', v_count;
  END IF;

  -- 1.5 Tentativa de leitura direta em admin_users por anon deve falhar
  v_blocked := false;
  BEGIN
    SELECT COUNT(*) INTO v_count FROM public.admin_users;
  EXCEPTION
    WHEN insufficient_privilege THEN
      v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION '[FALHA TESTE 1.5] Usuário anon conseguiu executar SELECT em public.admin_users!';
  END IF;

  EXECUTE 'RESET ROLE';
  RAISE NOTICE '[OK TESTE 1] Papel anon respeita leitura segregada de inativos, whitelist e bloqueio de admin_users.';

  -- --------------------------------------------------------------------------
  -- TESTE 2: Como usuário comum autenticado, escrita é proibida em todas as tabelas
  -- --------------------------------------------------------------------------
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_regular_user_id::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', v_regular_user_id::text)::text,
    true
  );

  -- 2.1 is_admin() DEVE ser estritamente FALSE para usuário comum
  IF public.is_admin() IS NOT FALSE THEN
    RAISE EXCEPTION '[FALHA TESTE 2.1] public.is_admin() retornou true para usuário autenticado comum!';
  END IF;

  -- 2.2 Bloqueio de INSERT em products
  v_blocked := false;
  BEGIN
    INSERT INTO public.products (name, slug, price, is_active)
    VALUES ('Tentativa Invasao Insert', 'tentativa-invasao-insert', 10.00, true);
  EXCEPTION
    WHEN insufficient_privilege OR check_violation OR OTHERS THEN
      v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION '[FALHA TESTE 2.2] Usuário autenticado comum conseguiu fazer INSERT em products!';
  END IF;

  -- 2.3 Bloqueio de UPDATE em categories
  UPDATE public.categories SET name = 'Hacked' WHERE id = v_active_cat;
  GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
  IF v_updated_rows <> 0 THEN
    RAISE EXCEPTION '[FALHA TESTE 2.3] Usuário autenticado comum conseguiu fazer UPDATE em categories!';
  END IF;

  -- 2.4 Bloqueio de INSERT em carousel_slides
  v_blocked := false;
  BEGIN
    INSERT INTO public.carousel_slides (title, image_url, is_active)
    VALUES ('Banner Hack', 'https://example.com/hack.webp', true);
  EXCEPTION
    WHEN insufficient_privilege OR check_violation OR OTHERS THEN
      v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION '[FALHA TESTE 2.4] Usuário autenticado comum conseguiu fazer INSERT em carousel_slides!';
  END IF;

  -- 2.4b Bloqueio de INSERT em compound_showcase_cards
  v_blocked := false;
  BEGIN
    INSERT INTO public.compound_showcase_cards (title, label_title, is_active)
    VALUES ('Card Hack', 'HACK', true);
  EXCEPTION
    WHEN insufficient_privilege OR check_violation OR OTHERS THEN
      v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION '[FALHA TESTE 2.4b] Usuário autenticado comum conseguiu fazer INSERT em compound_showcase_cards!';
  END IF;

  -- 2.5 Bloqueio de UPDATE em site_settings
  UPDATE public.site_settings SET value = 'hacked' WHERE key = 'whatsapp_product_message_template';
  GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
  IF v_updated_rows <> 0 THEN
    RAISE EXCEPTION '[FALHA TESTE 2.5] Usuário autenticado comum conseguiu fazer UPDATE em site_settings!';
  END IF;

  -- 2.6 Leitura direta em admin_users por authenticated é negada
  v_blocked := false;
  BEGIN
    SELECT COUNT(*) INTO v_count FROM public.admin_users;
  EXCEPTION
    WHEN insufficient_privilege THEN
      v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION '[FALHA TESTE 2.6] Usuário autenticado comum conseguiu executar SELECT em public.admin_users!';
  END IF;

  EXECUTE 'RESET ROLE';
  RAISE NOTICE '[OK TESTE 2] Usuário autenticado comum bloqueado em escrita e sem acesso a admin_users.';

  -- --------------------------------------------------------------------------
  -- TESTE 3: Manipulação de user_metadata / app_metadata NÃO concede is_admin()
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
    RAISE EXCEPTION '[FALHA TESTE 3] Escalada de privilégio via metadata concedeu is_admin() = true!';
  END IF;

  EXECUTE 'RESET ROLE';
  RAISE NOTICE '[OK TESTE 3] Injeção de metadata role=admin foi neutralizada.';

  -- --------------------------------------------------------------------------
  -- TESTE 4: Administrador registrado em public.admin_users possui controle total
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
    RAISE EXCEPTION '[FALHA TESTE 4] Administrador cadastrado em public.admin_users recebeu is_admin() = false!';
  END IF;

  -- 4.1 Admin enxerga itens inativos
  SELECT COUNT(*) INTO v_count FROM public.products WHERE id = v_inactive_prod;
  IF v_count <> 1 THEN
    RAISE EXCEPTION '[FALHA TESTE 4.1] Administrador não conseguiu consultar produto inativo!';
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.categories WHERE id = v_inactive_cat;
  IF v_count <> 1 THEN
    RAISE EXCEPTION '[FALHA TESTE 4.1] Administrador não conseguiu consultar categoria inativa!';
  END IF;

  -- 4.2 Admin consegue inserir, atualizar e deletar
  INSERT INTO public.products (id, name, slug, description, price, is_active)
  VALUES (v_admin_new_prod, 'Produto Criado Pelo Admin', 'produto-criado-pelo-admin', 'Teste de escrita admin', 120.00, true);

  UPDATE public.products SET price = 135.00 WHERE id = v_admin_new_prod;
  GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
  IF v_updated_rows <> 1 THEN
    RAISE EXCEPTION '[FALHA TESTE 4.2] Administrador não conseguiu atualizar produto!';
  END IF;

  DELETE FROM public.products WHERE id = v_admin_new_prod;
  GET DIAGNOSTICS v_deleted_rows = ROW_COUNT;
  IF v_deleted_rows <> 1 THEN
    RAISE EXCEPTION '[FALHA TESTE 4.2] Administrador não conseguiu excluir produto!';
  END IF;

  EXECUTE 'RESET ROLE';
  RAISE NOTICE '[OK TESTE 4] Administrador em public.admin_users possui permissões completas.';
  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'SUCESSO: Todas as checagens de RLS e autorização foram APROVADAS!';
  RAISE NOTICE '====================================================================';
END $$;

ROLLBACK;
