# Status do backend — 18/11/2026

## Ambiente

- Projeto Supabase: `chatapp-dev`
- Região: `sa-east-1` (São Paulo)
- Plano consultado: Free; custo de criação informado pelo Supabase: US$ 0/mês.
- Status na última verificação: `ACTIVE_HEALTHY`.
- Uso permitido nesta fase: somente dados fictícios.

## Migrations aplicadas e versionadas

| Versão | Migration | Conteúdo |
|---|---|---|
| `20261118203212` | `initial_chat_schema_rls_storage` | Schema inicial, tabelas, funções auxiliares, triggers, políticas RLS e buckets |
| `20261118203243` | `tighten_membership_and_audit_access` | Restringe atribuição de papéis de grupo, adiciona saída de membros, políticas deny-by-default para auditoria e índices |
| `20261118203300` | `enable_message_realtime_and_dedupe_policy` | Remove política redundante e adiciona `public.messages` à publicação Realtime |
| `20261118203538` | `add_transactional_conversation_creation` | Adiciona RPC `create_conversation` com validação de participantes, direct_key canônica e criação de membros |
| `20261118203551` | `restore_rls_guarded_conversation_insert_grants` | Mantém a RPC como caminho recomendado e restaura permissões de INSERT ainda protegidas por RLS |
| `20261118203939` | `expose_minimal_active_employee_directory` | Concede leitura de colunas mínimas do diretório e não expõe e-mails corporativos |
| `20261118204036` | `combine_profile_directory_select_policy` | Consolida regras de leitura de perfil em uma única política RLS |
| `20261118204056` | `enforce_direct_and_group_membership_limits` | Valida direct_key canônica, limita conversas diretas a 2 participantes e grupos a 50 |

## Estrutura criada

Tabelas públicas:
- `departments`
- `roles`
- `profiles`
- `profile_roles`
- `conversations`
- `conversation_members`
- `messages`
- `attachments`
- `message_receipts`

Tabelas internas no schema não exposto:
- `private.audit_logs`
- `private.admin_actions`

Também foram criados:
- Papéis iniciais: `employee`, `it_admin`, `security_admin`.
- Status de perfil: `pending_invitation`, `active`, `disabled`.
- Trigger de perfil após criação de usuário Auth (novo perfil começa como `pending_invitation`).
- Trigger de auditoria para inserção de mensagens (metadados, sem conteúdo da mensagem).
- Funções auxiliares de autorização em schema privado.
- RLS em todas as tabelas públicas e privadas.
- Publicação `supabase_realtime` para a tabela `messages`.
- RPC `public.create_conversation` (SECURITY INVOKER), com validação de conta ativa, limite de participantes, deduplicação de participantes e chave canônica para conversa direta. O caminho recomendado no cliente é chamar esta RPC.
- Diretório mínimo de funcionários: leitura limitada a `id`, `full_name`, `status` e `avatar_path`; `corporate_email` não tem privilégio SELECT para usuários autenticados comuns.
- Trigger valida a chave canônica de conversas diretas; trigger serializado limita conversa direta a 2 pessoas e grupo a 50 participantes.

## Storage e restrições atuais

- Buckets `chat-quarantine` e `chat-attachments`, ambos privados.
- Tipos permitidos no bucket: PDF (`application/pdf`) e JPEG (`image/jpeg`).
- Limite técnico definido: 5 MiB por arquivo.
- Upload para quarentena condicionado a usuário ativo e participante ativo da conversa.
- Download permitido apenas para objetos em `chat-attachments` associados a metadados com `scan_status='clean'` e membro autorizado.
- **Não existe scanner antimalware integrado.** Não mover arquivos para o bucket aprovado nem liberar anexos no frontend até implementar e testar o scanner. A existência dos buckets não significa que o fluxo de anexos esteja pronto.

## Verificações executadas

- Projeto: `ACTIVE_HEALTHY`.
- Migrations: 8 registradas no Supabase e versionadas no repositório.
- Tabelas: 9 públicas e 2 privadas.
- RLS: habilitada em todas as tabelas públicas; sem tabela pública sem RLS.
- Políticas: 18 públicas e 2 privadas na última inspeção.
- Buckets: 2, ambos privados.
- Realtime: `public.messages` confirmada na publicação.
- Supabase Security Advisor: sem findings na última execução.
- Supabase Health Advisor: sem findings na última execução.
- Performance Advisor: somente índices ainda não utilizados em banco vazio; revisar após dados e consultas de teste.

## Pendências obrigatórias antes de autenticação/uso funcional

1. No Supabase Dashboard, confirmar que cadastro público (signups) e login anônimo estão desabilitados. Essa configuração ainda não foi verificada via ferramenta.
2. Definir e executar o bootstrap do primeiro administrador de TI por processo controlado; não usar `user_metadata` como fonte de autorização.
3. Implementar fluxo server-side de convite/criação de usuários, atribuição de papel, ativação e desativação/revogação de sessão.
4. Configurar as variáveis de ambiente do Supabase no ambiente local/deploy; a chave publicável pode ficar no browser e qualquer chave secreta permanece exclusivamente no servidor.
5. Executar testes positivos e negativos de RLS com usuários sintéticos: usuário ativo, usuário pendente, desabilitado, membro e não membro, admin e funcionário.
6. Testar a RPC `create_conversation` com sessões autenticadas, incluindo direct_key duplicada, usuário inativo, participantes inválidos e limites de participantes.
7. Testar ponta a ponta a interface inicial de conversas, envio de mensagens, paginação/histórico e sincronização Realtime; implementar receipts visuais.
8. Implementar gestão de grupos pela interface, busca, notificações e painel de TI.
9. Implementar scanner antimalware e validar assinatura real do arquivo antes de disponibilizar download.
10. Revisar políticas de retenção, auditoria, exportação independente e limites de recursos do plano Free.

## Interface inicial de conversas e CI

Implementado no branch `feat/foundation-scaffold`:
- Lista as conversas ativas do usuário, usando RLS para restringir membership.
- Diretório mínimo de funcionários ativos e início de conversa individual via RPC.
- Envio de mensagens com `client_message_id` para idempotência e limite de 4.000 caracteres.
- Listener Realtime para INSERT em `public.messages`; eventos são deduplicados na interface.
- Tela protegida exige JWT verificado e perfil `active`.

Verificação CI do commit `dc6f320119042598e8c30685d4327c5813ff50a9`: lint, typecheck e build de produção concluídos com sucesso. O workflow gerou e comitou `package-lock.json` em commit posterior. Isso valida compilação, não substitui testes de integração com Supabase Auth.

## Critério de conclusão

A estrutura de banco, RLS e integração inicial do chat estão aplicadas, mas o módulo não está concluído. Não marcar Issues como Done até haver configuração de ambiente, provisionamento seguro do primeiro administrador, testes autenticados e evidências reproduzíveis.


## Integração inicial de autenticação no Next.js

Implementado no branch `feat/foundation-scaffold`:
- Dependências Supabase SSR e JS fixadas em versões exatas (`@supabase/ssr@0.12.7` e `@supabase/supabase-js@2.119.1`).
- Cliente Supabase server-side com cookies e cliente browser tipado.
- Tipos TypeScript gerados a partir do schema atual em `lib/supabase/database.types.ts`.
- `proxy.ts` do Next.js 16 usa `auth.getClaims()` para validar/renovar sessão.
- Tela de login sem opção de cadastro público; Server Action de login/logout.
- Rota `/chat` verifica JWT e exige `profiles.status='active'`; contas pendentes/desabilitadas não entram.
- Sem variáveis configuradas, a aplicação mostra orientação de configuração em vez de tentar autenticar.

**Ainda não validado em runtime:** variáveis de ambiente não foram configuradas no ambiente de execução; não existe usuário Auth de teste; a opção de signup público/anônimo ainda precisa ser conferida no Dashboard; primeiro administrador ainda não foi provisionado. Portanto, o login foi implementado no código, mas não foi testado ponta a ponta e não está liberado para uso.
