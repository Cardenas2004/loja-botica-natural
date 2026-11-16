# Segurança Operacional e Arquitetura de Defesa — Botica Natural

Este documento consolida a postura de segurança da aplicação Botica Natural, incluindo autenticação MFA (TOTP), plano de recuperação contra bloqueio, políticas de CSP e procedimento de resposta a incidentes.

---

## 1. Autenticação MFA (TOTP) e Prevenção de Lockout

O painel administrativo (`/admin`) oferece suporte nativo a autenticação de dois fatores via TOTP (`supabase.auth.mfa`), compatível com aplicativos autenticadores (Google Authenticator, 1Password, Authy, Bitwarden, Microsoft Authenticator):

### Passo a passo seguro para ativação obrigatória (AAL2)

1. **Habilitar TOTP no Supabase Dashboard:**
   Em *Authentication → Multi-Factor Authentication*, ative a opção **TOTP (App Authenticator)**.
2. **Inscrever o fator do administrador:**
   Acesse `/admin`, entre com seu e-mail e senha, navegue até **Segurança (MFA)** (`#/seguranca`) e clique em **Configurar TOTP**.
   - Escaneie o QR Code (`data:image/svg+xml` emitido localmente pelo endpoint de autenticação do Supabase, sem chamadas a serviços de terceiros) ou copie manualmente a chave secreta exibida na tela.
   - Confirme o pareamento digitando o código de 6 dígitos gerado pelo aplicativo autenticador.
   - **Guarde a chave secreta em cofre de senhas offline/seguro** como cópia de recuperação, além do aplicativo principal.
3. **Validar login completo com desafio AAL2:**
   Clique em **Sair**, entre novamente em `/admin` e confirme que a tela de desafio TOTP (`Código de verificação`) aparece e conclui o acesso normalmente.
4. **Aplicar a exigência estrita no banco (`supabase/pending/`):**
   Somente depois de validar o Passo 3, execute o arquivo pendente [`supabase/pending/20261115120000_require_aal2_admin.sql`](../supabase/pending/20261115120000_require_aal2_admin.sql) no SQL Editor do Supabase. Esse arquivo exige `aal = 'aal2'` no JWT dentro de `public.is_admin()`.

### Plano de Recuperação em Caso de Perda do Dispositivo MFA

Caso o administrador perca acesso ao aplicativo autenticador (troca de celular sem backup da chave secreta):

1. Acesse o **Supabase Dashboard** com a conta proprietária (recomendado ter acesso protegido com 2FA próprio da conta Supabase).
2. Abra o **SQL Editor** (executado com privilégio administrativo/service role) e localize os fatores do usuário:
   ```sql
   SELECT f.id AS factor_id, u.email, f.factor_type, f.status, f.created_at
   FROM auth.mfa_factors f
   JOIN auth.users u ON u.id = f.user_id
   WHERE lower(u.email) = lower('<email_do_administrador>');
   ```
3. Caso o administrador ainda possua outro fator backup ou precise apenas remover o dispositivo perdido antes de cadastrar um novo:
   - **Opção A (recomendada, sem rebaixar RLS):** exclua o fator perdido no schema `auth` (ou via Auth API `auth.admin.mfa.deleteFactor`) e, se `aal2` estiver ativo em `public.is_admin()`, aplique temporariamente o bloco de rollback comentado em `supabase/pending/20261115120000_require_aal2_admin.sql` para permitir login e novo cadastro TOTP em `#/seguranca`:
     ```sql
     DELETE FROM auth.mfa_factors
     WHERE id = '<factor_id_perdido>';
     ```
   - Faça login em `/admin`, cadastre o novo autenticador em `#/seguranca`, valide um login completo e **reaplique imediatamente** `supabase/pending/20261115120000_require_aal2_admin.sql`.
4. **Importância da guarda de recuperação:** o TOTP do Supabase Auth não emite códigos descartáveis padrão na interface administrativa; portanto, **guardar a chave secreta (`seed` TOTP) em cofre criptografado ou cadastrar um segundo aplicativo autenticador de reserva** evita downtime operacional e reduz a necessidade de intervenções emergenciais no banco.
