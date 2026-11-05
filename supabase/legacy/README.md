# Arquivos SQL Legados — Quarentena de Segurança

> **AVISO CRÍTICO:** Os scripts SQL neste diretório (`supabase/legacy/`) são versões antigas mantidas exclusivamente para histórico de auditoria. **NUNCA execute nenhum destes arquivos no banco de dados.**

## Por que estes arquivos foram colocados em quarentena?

1. **Risco de sobrescrita de segurança (RLS):**
   - O arquivo `supabase_carousel.sql` continha uma versão arcaica da função `public.is_admin()` que retornava `true` para qualquer usuário logado (`auth.role() = 'authenticated'`) e recriava políticas permissivas `USING (true)`.
   - Executar qualquer um destes arquivos sobrescreveria as migrações seguras do diretório `supabase/migrations/`.
2. **Drift de Schema:**
   - O script `supabase_full_schema.sql` mantinha permissões `GRANT SELECT` em `admin_users` para papéis não autorizados, violando o princípio de menor privilégio estabelecido pela migração `20261104200000_security_hardening.sql`.
3. **Trava de Aborto Ativa:**
   - Todos os arquivos nesta pasta possuem como primeira instrução:
     ```sql
     DO $$ BEGIN RAISE EXCEPTION 'ARQUIVO LEGADO — NÃO EXECUTAR. Use supabase/migrations/.'; END $$;
     ```
     impedindo execução acidental mesmo que alguém copie e cole no SQL Editor do Supabase.

## Fonte Única da Verdade (SSoT)

- O schema do banco de dados da Botica Natural é regido exclusivamente pelas migrações versionadas em `supabase/migrations/`, aplicadas em ordem cronológica de timestamp.
- Para consulta somente-leitura do schema de referência consolidado, utilize `supabase/schema_reference.sql`.
