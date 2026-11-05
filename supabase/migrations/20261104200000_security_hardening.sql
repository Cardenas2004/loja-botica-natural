-- ============================================================================
-- Botica Natural — Fase 1: Hardening de Segurança, RLS e Constraints
-- Migração: 20261104200000_security_hardening.sql
-- Descrição:
--   1.1 Tabela public.admin_users e reescrita segura de public.is_admin()
--       sem leitura de user_metadata/app_metadata e sem e-mail hardcoded.
--   1.2 Policies de leitura pública restritas a registros ativos (ou admin),
--       whitelist em site_settings, policies estritas no Storage (limite 2 MB)
--       e constraints de higiene em products, categories e carousel_slides.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1.1 TABELA DE ADMINISTRADORES E FUNÇÃO public.is_admin()
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id    UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.admin_users IS
  'Lista de controle de acesso (ACL) dos administradores autorizados. Gerenciada exclusivamente via service_role / SQL Editor.';

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Remove quaisquer permissões de escrita/leitura direta para anon e authenticated.
-- A verificação ocorre exclusivamente via função SECURITY DEFINER public.is_admin().
REVOKE ALL ON TABLE public.admin_users FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.admin_users TO service_role;

DROP POLICY IF EXISTS "admin_users_select_self" ON public.admin_users;
DROP POLICY IF EXISTS "admin_users_insert_none" ON public.admin_users;
DROP POLICY IF EXISTS "admin_users_update_none" ON public.admin_users;
DROP POLICY IF EXISTS "admin_users_delete_none" ON public.admin_users;

-- Reescreve public.is_admin() consultando exclusivamente public.admin_users.
-- Sem leitura de user_metadata, app_metadata ou e-mail hardcoded.
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
  );
$$;

COMMENT ON FUNCTION public.is_admin() IS
  'Verifica se o usuário autenticado (auth.uid()) consta na tabela public.admin_users.';

-- Revoga execução pública/anônima e concede apenas para authenticated e service_role
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- BOOTSTRAP MANUAL DO PRIMEIRO ADMINISTRADOR (EXECUTAR NO SQL EDITOR):
-- ATENÇÃO: Execute o comando abaixo manualmente no SQL Editor do Supabase
-- logo após aplicar esta migração para garantir seu acesso ao painel admin.
--
-- insert into public.admin_users (user_id)
-- select id from auth.users where email = '[PREENCHER: email do dono]'
-- on conflict (user_id) do nothing;
-- ----------------------------------------------------------------------------


-- ============================================================================
-- 1.2 CONSTRAINTS DE HIGIENE E VALIDAÇÃO DE DADOS
-- ============================================================================

-- Higieniza eventuais registros legados fora do padrão antes de aplicar CHECKs
UPDATE public.products
SET price = 0
WHERE price < 0;

UPDATE public.products
SET name = 'Produto sem nome'
WHERE char_length(name) = 0;

UPDATE public.products
SET name = left(name, 200)
WHERE char_length(name) > 200;

UPDATE public.categories
SET name = 'Categoria'
WHERE char_length(name) = 0;

UPDATE public.categories
SET name = left(name, 200)
WHERE char_length(name) > 200;

UPDATE public.carousel_slides
SET button_link = ''
WHERE button_link <> ''
  AND button_link !~* '^https?://'
  AND (button_link ~* '^[a-z][a-z0-9+.-]*:' OR button_link ~ '^//');

-- Constraints em public.products
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_price_check,
  DROP CONSTRAINT IF EXISTS products_price_non_negative_chk,
  DROP CONSTRAINT IF EXISTS products_name_length_chk;

ALTER TABLE public.products
  ADD CONSTRAINT products_price_non_negative_chk CHECK (price >= 0),
  ADD CONSTRAINT products_name_length_chk CHECK (char_length(name) BETWEEN 1 AND 200);

-- Constraints em public.categories
ALTER TABLE public.categories
  DROP CONSTRAINT IF EXISTS categories_name_length_chk;

ALTER TABLE public.categories
  ADD CONSTRAINT categories_name_length_chk CHECK (char_length(name) BETWEEN 1 AND 200);

-- Constraint de link seguro em public.carousel_slides (vazio, http(s):// ou caminho relativo)
ALTER TABLE public.carousel_slides
  DROP CONSTRAINT IF EXISTS carousel_slides_button_link_chk;

ALTER TABLE public.carousel_slides
  ADD CONSTRAINT carousel_slides_button_link_chk CHECK (
    button_link = ''
    OR button_link ~* '^https?://'
    OR (
      button_link !~* '^[a-z][a-z0-9+.-]*:'
      AND button_link !~ '^//'
    )
  );


-- ============================================================================
-- 1.3 POLÍTICAS RLS DE LEITURA PÚBLICA E ESCRITA ADMINISTRATIVA
-- ============================================================================
-- Nota técnica: separamos a policy de SELECT de `anon` (USING (is_active = true))
-- da policy de `authenticated` (USING (is_active = true OR public.is_admin()))
-- porque o PostgreSQL valida a ACL de EXECUTE de todas as funções presentes na
-- expressão da policy durante o ExecutorStart; como `anon` teve EXECUTE revogado
-- em `public.is_admin()`, avaliá-la apenas no papel `authenticated` garante
-- leitura pública sem erro 42501 e cumpre a regra de negócio.

-- ----------------------------------------------------------------------------
-- Tabela: public.products
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "products_select_public" ON public.products;
DROP POLICY IF EXISTS "products_select_anon" ON public.products;
DROP POLICY IF EXISTS "products_select_authenticated" ON public.products;
DROP POLICY IF EXISTS "products_insert_admin" ON public.products;
DROP POLICY IF EXISTS "products_update_admin" ON public.products;
DROP POLICY IF EXISTS "products_delete_admin" ON public.products;

CREATE POLICY "products_select_anon"
  ON public.products FOR SELECT
  TO anon
  USING (is_active = true);

CREATE POLICY "products_select_authenticated"
  ON public.products FOR SELECT
  TO authenticated
  USING (is_active = true OR public.is_admin());

CREATE POLICY "products_insert_admin"
  ON public.products FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "products_update_admin"
  ON public.products FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "products_delete_admin"
  ON public.products FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- Tabela: public.categories
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "categories_select_public" ON public.categories;
DROP POLICY IF EXISTS "categories_select_anon" ON public.categories;
DROP POLICY IF EXISTS "categories_select_authenticated" ON public.categories;
DROP POLICY IF EXISTS "categories_insert_admin" ON public.categories;
DROP POLICY IF EXISTS "categories_update_admin" ON public.categories;
DROP POLICY IF EXISTS "categories_delete_admin" ON public.categories;

CREATE POLICY "categories_select_anon"
  ON public.categories FOR SELECT
  TO anon
  USING (is_active = true);

CREATE POLICY "categories_select_authenticated"
  ON public.categories FOR SELECT
  TO authenticated
  USING (is_active = true OR public.is_admin());

CREATE POLICY "categories_insert_admin"
  ON public.categories FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "categories_update_admin"
  ON public.categories FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "categories_delete_admin"
  ON public.categories FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- Tabela: public.carousel_slides
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "carousel_slides_select_public" ON public.carousel_slides;
DROP POLICY IF EXISTS "carousel_slides_select_anon" ON public.carousel_slides;
DROP POLICY IF EXISTS "carousel_slides_select_authenticated" ON public.carousel_slides;
DROP POLICY IF EXISTS "carousel_slides_insert_admin" ON public.carousel_slides;
DROP POLICY IF EXISTS "carousel_slides_update_admin" ON public.carousel_slides;
DROP POLICY IF EXISTS "carousel_slides_delete_admin" ON public.carousel_slides;

CREATE POLICY "carousel_slides_select_anon"
  ON public.carousel_slides FOR SELECT
  TO anon
  USING (is_active = true);

CREATE POLICY "carousel_slides_select_authenticated"
  ON public.carousel_slides FOR SELECT
  TO authenticated
  USING (is_active = true OR public.is_admin());

CREATE POLICY "carousel_slides_insert_admin"
  ON public.carousel_slides FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "carousel_slides_update_admin"
  ON public.carousel_slides FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "carousel_slides_delete_admin"
  ON public.carousel_slides FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- Tabela: public.site_settings (whitelist de chaves públicas)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "site_settings_select_public" ON public.site_settings;
DROP POLICY IF EXISTS "site_settings_select_anon" ON public.site_settings;
DROP POLICY IF EXISTS "site_settings_select_authenticated" ON public.site_settings;
DROP POLICY IF EXISTS "site_settings_insert_admin" ON public.site_settings;
DROP POLICY IF EXISTS "site_settings_update_admin" ON public.site_settings;
DROP POLICY IF EXISTS "site_settings_delete_admin" ON public.site_settings;

CREATE POLICY "site_settings_select_anon"
  ON public.site_settings FOR SELECT
  TO anon
  USING (key IN ('whatsapp_product_message_template'));

CREATE POLICY "site_settings_select_authenticated"
  ON public.site_settings FOR SELECT
  TO authenticated
  USING (key IN ('whatsapp_product_message_template') OR public.is_admin());

CREATE POLICY "site_settings_insert_admin"
  ON public.site_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "site_settings_update_admin"
  ON public.site_settings FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "site_settings_delete_admin"
  ON public.site_settings FOR DELETE
  TO authenticated
  USING (public.is_admin());


-- ============================================================================
-- 1.4 SUPABASE STORAGE: BUCKET product-images (2 MB, IMAGENS, SÓ ADMIN ESCREVE)
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  2097152, -- 2 MB (2 * 1024 * 1024 bytes)
  ARRAY['image/webp', 'image/jpeg', 'image/png']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/webp', 'image/jpeg', 'image/png']::text[];

-- Remove policies antigas permissivas (_auth) e as anteriores (_admin com e-mail hardcoded)
DROP POLICY IF EXISTS "product_images_select_public" ON storage.objects;
DROP POLICY IF EXISTS "product_images_insert_auth" ON storage.objects;
DROP POLICY IF EXISTS "product_images_update_auth" ON storage.objects;
DROP POLICY IF EXISTS "product_images_delete_auth" ON storage.objects;
DROP POLICY IF EXISTS "product_images_insert_admin" ON storage.objects;
DROP POLICY IF EXISTS "product_images_update_admin" ON storage.objects;
DROP POLICY IF EXISTS "product_images_delete_admin" ON storage.objects;

CREATE POLICY "product_images_select_public"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'product-images');

CREATE POLICY "product_images_insert_admin"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND public.is_admin()
  );

CREATE POLICY "product_images_update_admin"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND public.is_admin()
  )
  WITH CHECK (
    bucket_id = 'product-images'
    AND public.is_admin()
  );

CREATE POLICY "product_images_delete_admin"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND public.is_admin()
  );

COMMIT;

NOTIFY pgrst, 'reload schema';

