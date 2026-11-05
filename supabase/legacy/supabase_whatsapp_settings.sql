DO $$ BEGIN RAISE EXCEPTION 'ARQUIVO LEGADO — NÃO EXECUTAR. Use supabase/migrations/.'; END $$;

-- ============================================================================
-- BOTICA NATURAL — TABELA DE CONFIGURAÇÕES GLOBAIS (SITE_SETTINGS)
-- Arquivo: supabase_whatsapp_settings.sql
-- Objetivo: Armazenar e gerenciar dinamicamente o template de mensagem
--           pré-preenchida do WhatsApp para os produtos da vitrine e PDP.
-- Ambiente: PostgreSQL 15+ (Supabase) · Zero-Trust RLS · Idempotente
-- Instruções: Execute este script no SQL Editor do painel Supabase.
-- ============================================================================

BEGIN;

-- 1. Garante a função de auditoria de timestamps caso ainda não exista
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 2. Criação da Tabela `public.site_settings`
CREATE TABLE IF NOT EXISTS public.site_settings (
  key         TEXT        PRIMARY KEY,
  value       TEXT        NOT NULL DEFAULT '',
  description TEXT        NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  TEXT        NOT NULL DEFAULT ''
);

-- Migração incremental resiliente para colunas
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS value TEXT NOT NULL DEFAULT '';
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS updated_by TEXT NOT NULL DEFAULT '';

-- Correção retroativa: Se a coluna 'updated_by' foi criada anteriormente como UUID ou com FK em auth.users,
-- remove a restrição e converte para TEXT de forma limpa e sem perda de dados
DO $$
BEGIN
  ALTER TABLE public.site_settings DROP CONSTRAINT IF EXISTS site_settings_updated_by_fkey;
  ALTER TABLE public.site_settings ALTER COLUMN updated_by TYPE TEXT USING coalesce(updated_by::text, '');
  ALTER TABLE public.site_settings ALTER COLUMN updated_by SET DEFAULT '';
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

COMMENT ON TABLE public.site_settings IS 
  'Configurações dinâmicas e parâmetros globais do sistema (ex: template de WhatsApp).';
COMMENT ON COLUMN public.site_settings.key IS 
  'Chave identificadora única da configuração (Primary Key).';
COMMENT ON COLUMN public.site_settings.value IS 
  'Conteúdo da configuração salvo em formato de texto.';
COMMENT ON COLUMN public.site_settings.description IS 
  'Descrição detalhada da finalidade do parâmetro.';
COMMENT ON COLUMN public.site_settings.updated_by IS 
  'E-mail ou identificador do usuário administrador responsável pela alteração.';

-- 3. Trigger para atualização automática da coluna `updated_at`
DROP TRIGGER IF EXISTS trg_site_settings_updated_at ON public.site_settings;
CREATE TRIGGER trg_site_settings_updated_at
  BEFORE UPDATE ON public.site_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 4. Segurança Zero-Trust: Row Level Security (RLS)
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Concede privilégios explícitos aos papéis do Supabase
GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.site_settings TO authenticated;

-- Política 1: Leitura pública irrestrita (anon + authenticated)
-- Necessária para que a vitrine (index.html/produtos.html) e a página do produto (produto.html)
-- possam recuperar o template salvo mesmo para visitantes não autenticados.
DROP POLICY IF EXISTS "site_settings_select_public" ON public.site_settings;
CREATE POLICY "site_settings_select_public"
  ON public.site_settings FOR SELECT
  TO anon, authenticated
  USING (true);

-- Política 2: Inserção restrita a administradores validados
DROP POLICY IF EXISTS "site_settings_insert_admin" ON public.site_settings;
CREATE POLICY "site_settings_insert_admin"
  ON public.site_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Política 3: Atualização restrita a administradores validados
DROP POLICY IF EXISTS "site_settings_update_admin" ON public.site_settings;
CREATE POLICY "site_settings_update_admin"
  ON public.site_settings FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Política 4: Exclusão restrita a administradores validados
DROP POLICY IF EXISTS "site_settings_delete_admin" ON public.site_settings;
CREATE POLICY "site_settings_delete_admin"
  ON public.site_settings FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- 5. Registro Inicial Padrão (Seed Idempotente com ON CONFLICT DO NOTHING)
INSERT INTO public.site_settings (key, value, description, updated_by)
VALUES (
  'whatsapp_product_message_template',
  'Olá! Tenho interesse no produto *{produto}* (Categoria: {categoria} | Valor: {preco}). Vi no site da Botica Natural ({link}) e gostaria de tirar dúvidas com o farmacêutico e fazer meu pedido!',
  'Template de mensagem personalizada pré-preenchida no WhatsApp para interesse em produtos do catálogo e PDP.',
  'sistema'
)
ON CONFLICT (key) DO NOTHING;

-- 6. Coluna para Mensagens Exclusivas por Produto (Polimorfismo de Templates)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS whatsapp_message TEXT NOT NULL DEFAULT '';
COMMENT ON COLUMN public.products.whatsapp_message IS 
  'Mensagem exclusiva do WhatsApp para este produto específico. Se vazia, herda o modelo geral de site_settings.';

COMMIT;

NOTIFY pgrst, 'reload schema';

