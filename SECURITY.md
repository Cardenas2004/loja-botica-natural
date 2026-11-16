# Política de Segurança — Botica Natural

A Botica Natural trata a segurança da vitrine estática, do painel administrativo e dos dados no Supabase com prioridade. Se você identificar uma vulnerabilidade ou comportamento inesperado de segurança, siga as instruções abaixo para divulgação responsável.

## Como reportar uma vulnerabilidade

- **Canal oficial (provisório — confirmar com o proprietário antes de publicar):** `boticanatural@terra.com.br`
- **Idiomas aceitos:** Português (`pt-BR`) ou Inglês (`en`).
- **O que incluir no relato:**
  - URL afetada ou arquivo/componente envolvido;
  - Passos objetivos para reproduzir o problema (proof of concept mínimo e não destrutivo);
  - Impacto estimado e eventuais capturas de tela sem exposição de dados reais de clientes.

## Escopo

- **Dentro do escopo:**
  - `https://boticanaturaltriunfo.com.br` (vitrine pública, catálogo, páginas de produtos e privacidade)
  - Fluxo administrativo `/admin` e políticas de controle de acesso / RLS / Storage do projeto
- **Fora do escopo:**
  - Ataques de negação de serviço (DoS/DDoS), spam ou engenharia social contra a equipe;
  - Testes automatizados destrutivos que alterem catálogo, banners ou armazenamento em produção;
  - Vulnerabilidades em serviços de terceiros fora do controle direto da farmácia (reportar aos respectivos provedores).

## Compromissos de resposta

- Não empreendemos ações contra pesquisadores que reportem falhas de boa-fé, sem acesso indevido a dados, exfiltração ou degradação do serviço.
- Solicitamos sigilo coordenado até que a correção seja publicada e validada.
- Este documento permanece apenas no repositório (`SECURITY.md`); o arquivo público conforme RFC 9116 fica em `/.well-known/security.txt` (renovar campo `Expires` anualmente antes de `2027-11-16`).
