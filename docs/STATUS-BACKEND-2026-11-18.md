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

## Storage e restrições atuais

- Buckets `chat-quarantine` e `chat-attachments`, ambos privados.
- Tipos permitidos no bucket: PDF (`application/pdf`) e JPEG (`image/jpeg`).
- Limite técnico definido: 5 MiB por arquivo.
- Upload para quarentena condicionado a usuário ativo e participante ativo da conversa.
- Download permitido apenas para objetos em `chat-attachments` associados a metadados com `scan_status='clean'` e membro autorizado.
- **Não existe scanner antimalware integrado.** Não mover arquivos para o bucket aprovado nem liberar anexos no frontend até implementar e testar o scanner. A existência dos buckets não significa que o fluxo de anexos esteja pronto.

## Verificações executadas

- Projeto: `ACTIVE_HEALTHY`.
- Migrations: 3 registradas no Supabase.
- Tabelas: 9 públicas e 2 privadas.
- RLS: habilitada em todas as tabelas públicas; sem tabela pública sem RLS.
- Políticas: 19 públicas e 2 privadas na última inspeção.
- Buckets: 2, ambos privados.
- Realtime: `public.messages` confirmada na publicação.
- Supabase Security Advisor: sem findings na última execução.
- Supabase Health Advisor: sem findings na última execução.
- Performance Advisor: somente índices ainda não utilizados em banco vazio; revisar após dados e consultas de teste.

## Pendências obrigatórias antes de autenticação/uso funcional

1. No Supabase Dashboard, confirmar que cadastro público (signups) e login anônimo estão desabilitados. Essa configuração ainda não foi verificada via ferramenta.
2. Definir e executar o bootstrap do primeiro administrador de TI por processo controlado; não usar `user_metadata` como fonte de autorização.
3. Implementar fluxo server-side de convite/criação de usuários, atribuição de papel, ativação e desativação/revogação de sessão.
4. Integrar Auth no Next.js usando somente chave publicável no browser e chave secreta exclusivamente no servidor.
5. Executar testes positivos e negativos de RLS com usuários sintéticos: usuário ativo, usuário pendente, desabilitado, membro e não membro, admin e funcionário.
6. Integrar e testar a RPC `create_conversation` com sessões autenticadas, incluindo casos de direct_key duplicada, usuário inativo e participantes inválidos.
7. Implementar persistência de mensagens, receipts e sincronização Realtime na interface.
8. Implementar scanner antimalware e validar assinatura real do arquivo antes de disponibilizar download.
9. Revisar políticas de retenção, auditoria, exportação independente e limites de recursos do plano Free.

## Critério de conclusão

A estrutura de banco e a camada inicial de RLS estão aplicadas, mas o módulo de backend não está concluído. Não marcar Issues como Done até haver integração no código, testes autenticados e evidências reproduzíveis.
