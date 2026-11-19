# Plano de testes SQA — ChatApp

**Status:** casos especificados; execução ponta a ponta pendente.  
**Ambiente:** Supabase Free de desenvolvimento, somente dados sintéticos.  
**Regra:** nenhum caso será marcado como aprovado sem evidência reproduzível (contas de teste, resultado observado e logs/consulta pertinente).

## Pré-condições
- Duas contas sintéticas independentes: administrador de TI e funcionário.
- Uma terceira conta sintética para validar isolamento e grupos, quando disponível.
- `ALLOWED_EMAIL_DOMAINS` configurado com domínio de teste autorizado.
- Supabase Auth Site URL e Redirect URLs apontando para o ambiente de teste.
- Não usar dados, e-mails ou documentos reais da empresa.

## Casos prioritários

| ID | Tipo | Cenário | Resultado esperado | Status |
|---|---|---|---|---|
| SQA-01 | Segurança/Funcional | Funcionário tenta abrir `/admin` | Acesso negado e redirecionamento para o chat | Pendente |
| SQA-02 | Segurança | Conta `pending_invitation` tenta autenticar | Sessão não acessa áreas protegidas | Pendente |
| SQA-03 | Segurança | Conta desativada tenta reutilizar sessão | Acesso bloqueado no servidor e nas policies RLS | Pendente |
| SQA-04 | Funcional/Segurança | Admin convida e-mail em domínio permitido | Convite enviado, perfil criado pendente e evento auditado | Pendente |
| SQA-05 | Segurança | Admin tenta convidar domínio não permitido | Solicitação recusada sem criar usuário | Pendente |
| SQA-06 | Segurança | Funcionário chama Edge Function de convite | HTTP 403/recusa sem criação de usuário | Pendente |
| SQA-07 | Funcional | TI ativa perfil e atribui papel employee | Funcionário consegue entrar após aceitar convite | Pendente |
| SQA-08 | Segurança | Admin tenta desativar a própria conta ou último admin | Operação recusada e estado permanece inalterado | Pendente |
| SQA-09 | Funcional | Dois funcionários iniciam conversa direta | Uma conversa privada única é criada | Pendente |
| SQA-10 | Segurança/RLS | Usuário não participante consulta conversa/mensagens | Nenhum dado privado é retornado | Pendente |
| SQA-11 | Funcional | Membro cria grupo e adiciona participantes | Apenas membros ativos visualizam o grupo e as mensagens | Pendente |
| SQA-12 | Segurança | Usuário sem papel owner/admin tenta gerir membros | Operação recusada pelo banco | Pendente |
| SQA-13 | Funcional | Destinatário abre conversa com mensagens novas | Recibo de leitura é gravado para o destinatário | Pendente |
| SQA-14 | Funcional | Mensagem é recebida em outra conversa | Contador de não lidas aumenta; notificação do navegador aparece se permitida e aba estiver oculta | Pendente |
| SQA-15 | Funcional | Usuário pesquisa termo em suas conversas | Apenas resultados autorizados são exibidos, até 30 | Pendente |
| SQA-16 | Regressão | Usuário carrega mensagens anteriores | Histórico anterior é anexado sem duplicar ou inverter ordem | Pendente |
| SQA-17 | Segurança | Usuário tenta consultar recibos de conversa alheia | RLS impede acesso | Pendente |
| SQA-18 | Segurança/Arquivo | Usuário tenta baixar objeto em quarentena | Download não é permitido | Pendente |
| SQA-19 | Auditoria | TI ativa/desativa perfil, muda papel ou envia convite | Evento correspondente fica registrado na trilha privada | Pendente |
| SQA-20 | Limite/Regressão | Grupo excede 50 membros ou conversa direta excede 2 | Operação rejeitada pelo banco | Pendente |

## Verificações automatizadas executadas em 2026-11-19

| ID | Verificação | Resultado | Evidência |
|---|---|---|---|
| DB-SEC-01 | Nenhuma função do schema `private` executável por `anon` | Aprovado | Consulta `has_function_privilege('anon', ...)` após migração `20261119011619` retornou `false` para todas as funções auditadas. |
| DB-SEC-02 | Funções auxiliares RLS necessárias disponíveis a `authenticated` | Aprovado | Consulta de privilégios confirmou `EXECUTE` para `can_manage_conversation`, `can_view_profile`, `has_role`, `is_active_profile`, `is_active_user` e `is_conversation_member`. |
| DB-SEC-03 | Funções de trigger sem execução direta por usuários | Aprovado | `audit_group_member_removal`, `audit_message_insert`, `enforce_conversation_member_limit`, `handle_new_auth_user`, `touch_updated_at` e `validate_direct_conversation_insert` retornaram `false` para `authenticated` e `anon`. |

Essas verificações de privilégios não substituem testes de RLS com identidades reais independentes. Os 20 cenários funcionais abaixo continuam pendentes até execução autenticada reproduzível.

## Evidências a coletar
Para cada caso executado:
1. Identificador da conta sintética e papel atribuído (não registrar senhas/tokens).
2. Passos e resultado observado.
3. Captura de tela sem dados pessoais, quando aplicável.
4. Resposta HTTP/erro funcional sem token ou segredo.
5. Consulta SQL de verificação, sem exportar conteúdo privado.
6. Issue GitHub vinculada e resultado Pass/Fail/Blocked.

## Bloqueios conhecidos
- Convites reais dependem de allowlist de domínio e Redirect URLs confirmadas.
- Testes com duas ou mais contas ainda não foram executados.
- Anexos permanecem em quarentena até existir scanner antimalware real; não testar download como funcionalidade liberada.
- Notificações implementadas são do navegador, não notificações push server-side.
- CI valida lint, typecheck e build; não substitui estes testes de integração/E2E.
