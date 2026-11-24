# Etapa 1 — Especificação técnica, modelo de dados e segurança

**Projeto:** Chat corporativo interno da Calunga  
**Versão:** 1.0  
**Data:** 24/11/2026  
**Status:** Especificação concluída; validações de banco executadas; pendências de implementação futura explicitadas  
**Branch:** `feat/foundation-scaffold`  
**Pull request:** [#82 — foundation scaffold](https://github.com/otaviosferreira/chatapp/pull/82)  
**Ambiente validado:** Supabase `chatapp-dev` — plano Free, região `sa-east-1`, PostgreSQL 17  
**Dados:** somente dados sintéticos/de demonstração. Não autorizado para produção.

---

## 1. Objetivo, escopo e decisões

O sistema é um canal web privado de comunicação entre funcionários da Calunga. O acesso será feito por URL HTTPS em navegadores desktop, Android e iOS, sem aplicativo nativo obrigatório.

Regras inegociáveis:

1. Não existe cadastro público, login anônimo, cliente externo ou fornecedor.
2. A TI provisiona contas individualmente e pode habilitar/desabilitar; desligamento é feito por desativação lógica.
3. Conta, perfil e histórico não podem ser fisicamente excluídos por operações da aplicação.
4. Funcionários só consultam conversas em que são participantes ativos.
5. TI autorizada pode auditar mensagens, com justificativa e trilha de acesso.
6. Mensagens de texto e anexos PDF/JPEG são os únicos conteúdos previstos.
7. Áudio, gravação, captura de câmera, PNG, Excel, CSV, DOC/DOCX e comunicados oficiais em massa não fazem parte do produto.
8. Comunicados institucionais/departamentais continuam no e-mail corporativo.
9. A aplicação não substitui os procedimentos jurídicos, de RH, segurança da informação ou resposta a incidentes da Calunga.

## 2. Arquitetura de nuvem e aplicações

### 2.1. Arquitetura lógica

| Camada | Tecnologia/serviço | Responsabilidade |
|---|---|---|
| Interface web | Next.js + React + TypeScript | Aplicação responsiva e acessível |
| Hospedagem web | Vercel | CDN, TLS, deploy e funções server-side |
| Identidade | Supabase Auth | Login, sessão, recuperação e identidade |
| Dados | Supabase PostgreSQL | Perfis, conversas, mensagens e auditoria |
| Autorização | PostgreSQL RLS + grants + funções privadas | Controle por papel e por conversa |
| Tempo real | Supabase Realtime | Distribuição de eventos após persistência |
| Arquivos | Supabase Storage privado | Quarentena e anexos liberados |
| Código e CI | GitHub Actions | Versionamento, revisão e testes |

O PostgreSQL é a fonte de verdade. Uma mensagem só é considerada enviada depois da confirmação de persistência; Realtime distribui a atualização, mas não substitui a gravação no banco.

### 2.2. Região, ambientes e limites

O projeto Supabase `chatapp-dev` está em `sa-east-1` (São Paulo). A arquitetura de referência mantém aplicação Vercel e banco próximos, mas a TI deve aprovar região, subprocessadores, transferência internacional, contrato, retenção e residência de dados antes de produção.

**Limitação dos planos atuais:** Vercel Hobby é destinado a uso pessoal/não comercial e Supabase Free não oferece o conjunto de backup, recuperação e garantias necessário para histórico corporativo crítico. A combinação atual serve apenas para desenvolvimento/demonstração com dados sintéticos. Não inserir mensagens, documentos ou dados pessoais reais da Calunga. Produção exige plano/provedor com uso comercial permitido, backup automatizado, restauração testada, SLA, RPO/RTO e controles formalmente aprovados.

## 3. Modelo de dados

O projeto já utiliza tabelas relacionais. O conceito de `users` é representado por `auth.users` (identidade de autenticação) associado a `public.profiles` (cadastro funcional); não se cria uma segunda tabela pública `users` para duplicar credenciais.

| Entidade conceitual | Implementação atual / proposta | Dados e regras principais |
|---|---|---|
| `users` | `auth.users` + `public.profiles` | UUID compartilhado, nome, e-mail corporativo, matrícula, departamento, status e datas de ativação/desativação. Status: pending_invitation, active, disabled. |
| `departments` | `public.departments` | Departamento ativo, nome e código únicos. |
| `roles` | `public.roles` | Papéis controlados: employee, it_admin e security_admin. |
| `profile_roles` | `public.profile_roles` | Associação perfil/papel; alteração administrativa auditada. |
| `conversations` | `public.conversations` | Tipo direct/group, título, criador e chave canônica para conversa direta. |
| `conversation_members` | `public.conversation_members` | Participantes, papel no grupo, entrada e saída lógica; membro ativo quando left_at é nulo. |
| `messages` | `public.messages` | Conversa, remetente, UUID idempotente, texto, resposta e timestamp. Conteúdo de 1 a 4.000 caracteres. |
| `attachments` | `public.attachments` | Mensagem, remetente, nome, MIME, tamanho, hash, bucket, caminho e estado de análise. |
| `audit_logs` | `private.audit_logs` | Eventos append-only, ator, ação, recurso, justificativa, request_id, metadados e hashes encadeáveis. |
| Ações administrativas | `private.admin_actions` | Convites, alterações de status/papel, resultado, justificativa e alvo. |
| `access_requests` | **A criar em etapa posterior** | Registro privado de solicitação formal de acesso a dados, análise jurídica, autorização, notificação e cumprimento. |

### 3.1. Regras de integridade

- Chaves estrangeiras de perfis, participantes, mensagens, anexos e auditoria usam `ON DELETE RESTRICT` nas relações de negócio.
- Conversa direta é única por par de participantes, com IDs ordenados.
- Mensagem possui chave idempotente por remetente/conversa.
- Mensagem e recibo não são apagados quando uma pessoa sai da empresa.
- Anexo não é armazenado como binário no PostgreSQL.
- Paginação e índices por conversa/data são obrigatórios para histórico.
- `audit_logs` e `admin_actions` ficam no schema privado, não exposto diretamente pela API pública.

### 3.2. Modelo proposto para `access_requests`

A futura tabela ficará no schema privado e deverá conter, no mínimo: UUID, tipo de solicitação, órgão/solicitante, número de protocolo, fundamento e documento de origem, escopo de dados solicitado, datas de recebimento e análise, responsável jurídico/TI, decisão (pendente/aprovada/negada), se a notificação é legalmente permitida, data e meio de notificação, eventual fundamento de sigilo que impeça notificar, dados efetivamente entregues, data de cumprimento e referência das evidências.

Nenhuma consulta extraordinária será executada apenas por solicitação informal. O fluxo exige registro, validação de autenticidade/competência, análise jurídica, aprovação interna, escopo mínimo, execução pela TI e auditoria.

**Limite jurídico importante:** a aplicação pode exigir notificação prévia sempre que legalmente permitida, mas não pode prometer notificar quando uma ordem válida impuser sigilo ou proibir comunicação. Nesse caso, o sistema deve registrar a proibição, limitar o acesso ao necessário e permitir notificação posterior assim que a restrição deixar de existir. A política final deve ser aprovada pelo Jurídico da Calunga.

## 4. Matriz de permissões (RBAC + RLS)

| Operação | Funcionário ativo | TI (`it_admin`) | Segurança (`security_admin`) |
|---|---:|---:|---:|
| Entrar no sistema | Sim | Sim | Sim |
| Ver diretório mínimo de funcionários ativos | Sim | Sim | Conforme necessidade |
| Criar conversa 1:1 ou grupo interno | Sim | Sim | Conforme necessidade |
| Ler/enviar mensagem | Apenas em conversas das quais participa | Apenas se também for membro; auditoria é fluxo separado | Apenas se também for membro; auditoria é fluxo separado |
| Enviar PDF/JPEG | Sim, sujeito à validação e quarentena | Sim, sujeito às mesmas regras | Sim, sujeito às mesmas regras |
| Criar/convidar conta | Não | Sim | Não por padrão |
| Habilitar/desabilitar conta | Não | Sim | Não por padrão |
| Excluir conta/perfil | **Nunca** | **Nunca** | **Nunca** |
| Consultar auditoria de conteúdo | Não | Sim, com motivo e registro | Sim, com motivo e registro |
| Consultar logs administrativos | Não | Sim | Sim |
| Alterar papéis e configurações administrativas | Não | Sim, com trilha | Não por padrão |

RLS é aplicada no banco, além da validação server-side. A interface não é mecanismo de autorização. Papéis não devem ser derivados de `user_metadata` editável pelo próprio usuário; a fonte de autorização é a associação protegida no banco.

## 5. Proibição absoluta de exclusão de contas

Desativar uma conta significa atualizar o status para `disabled`, registrar `disabled_at`, impedir novas operações e revogar/encerrar sessões conforme o fluxo de autenticação. O perfil, identidade e histórico permanecem preservados.

Na validação inicial foi identificado que a role `service_role` possuía privilégio SQL de DELETE em `public.profiles`, apesar das políticas RLS. Isso foi corrigido nesta etapa com a migração:

`20261124190407_prevent_employee_account_physical_deletion.sql`

A migração:
- cria trigger BEFORE DELETE em `public.profiles`;
- cria trigger BEFORE DELETE em `auth.users`;
- rejeita a operação com SQLSTATE `55000`;
- revoga DELETE em `public.profiles` de PUBLIC, anon, authenticated e service_role;
- mantém a desativação lógica como único procedimento de desligamento.

A proteção aplica-se às operações da aplicação e aos papéis de banco usados pelos serviços. Acesso de proprietário/superusuário capaz de desabilitar triggers é um poder de infraestrutura e deve ser restrito à governança de banco, com acesso emergencial controlado e auditado.

## 6. Política de mídia e anexos

### 6.1. Permitido

- Mensagens de texto.
- PDF: `application/pdf`.
- JPEG: `image/jpeg`, extensões `.jpg` e `.jpeg`.

O banco e os buckets atuais impõem limite de 5 MiB por arquivo. Esse limite deve ser confirmado pela TI antes de homologação.

### 6.2. Bloqueado

- Áudio, voz, gravação e arquivos de áudio.
- Captura de foto pela câmera dentro do app.
- PNG e demais formatos de imagem.
- Excel: XLS, XLSX e CSV.
- Word: DOC e DOCX.
- Vídeo, executáveis, arquivos compactados e qualquer formato fora da lista permitida.

### 6.3. Camadas de enforcement

1. **Interface:** seletor com `accept=".pdf,.jpg,.jpeg,application/pdf,image/jpeg"`; não há controle de gravação/áudio nem atributo de captura de câmera.
2. **Cliente:** verifica MIME informado, extensão e assinatura inicial (magic bytes) de PDF/JPEG antes do upload.
3. **Storage:** buckets `chat-quarantine` e `chat-attachments` são privados, limitados a PDF/JPEG e 5 MiB.
4. **Banco/RPC:** constraint de MIME aceita apenas `application/pdf` e `image/jpeg`; metadados validam tamanho, hash e associação à mensagem/conversa.
5. **Quarentena:** todo upload começa em `pending`; download normal só é permitido após status `clean` e movimentação/liberação para o bucket final.

**Pendência de segurança para a Etapa 5:** a verificação de assinatura identificada no código atual está no cliente. MIME e extensão podem ser falsificados por chamadas diretas à API/Storage. Antes de liberar anexos, a validação de assinatura e a inspeção antimalware precisam ocorrer no servidor, sem confiar no navegador. O scanner antimalware ainda não está integrado; portanto, os anexos permanecem em quarentena e indisponíveis. Não declarar upload seguro nem liberar arquivos até essa etapa ser concluída e testada.

## 7. Criptografia e gestão de segredos

- APIs Supabase (Auth, Data API, Storage, Realtime e Edge Functions) usam HTTPS/TLS 1.2 ou TLS 1.3.
- O Supabase declara criptografia de dados armazenados em AES-256. Isso é criptografia de infraestrutura/at-rest gerenciada pelo provedor.
- Conexões diretas PostgreSQL devem usar SSL; a TI deve validar a configuração de enforcement e certificado para conexões administrativas.
- Chaves secret/service role ficam exclusivamente no servidor; nunca em variáveis `NEXT_PUBLIC_...` ou no bundle do navegador.
- Sessões, tokens e credenciais não são gravados em logs. Logs não devem incluir conteúdo de mensagens.
- A aplicação atual armazena o texto da mensagem no campo PostgreSQL `messages.body`; portanto, não há criptografia ponta a ponta (E2EE) implementada.

**Decisão arquitetural:** para permitir auditoria de conteúdo pela TI, o serviço precisa conseguir recuperar o texto autorizado. Criptografia de transporte e em repouso não é E2EE. E2EE verdadeira impediria a inspeção central de conteúdo sem um mecanismo explícito de custódia/escrow de chaves, que exigiria decisão formal da Calunga. Não anunciar E2EE nem “criptografia entre usuários” até existir projeto e validação próprios.

## 8. Auditoria e governança de acesso

A TI pode consultar conteúdo de conversas para finalidade legítima e autorizada. Toda consulta privilegiada deve gerar evento de auditoria contendo:
- ator e papel;
- data/hora UTC;
- justificativa obrigatória;
- conversa/escopo consultado;
- protocolo de solicitação, quando aplicável;
- resultado e request_id;
- evidência de aprovação e de eventual notificação.

O funcionário comum não pode acessar tabelas nem RPCs de auditoria. As consultas administrativas devem ser paginadas, filtráveis e protegidas no banco. A consulta de conteúdo precisa registrar o próprio ato de leitura, não apenas a criação da mensagem.

A tabela `private.audit_logs` e os RPCs administrativos já existem. A cobertura integral do evento de leitura de conteúdo, justificativa obrigatória e fluxo `access_requests` será completada na Etapa 6; a existência da tabela de logs, isoladamente, não prova que todo acesso de auditoria esteja registrado.

## 9. Testes de validação da Etapa 1

Os testes abaixo foram executados no banco `chatapp-dev`. Os casos que inserem dados usaram fixtures transacionais; não deixam mensagens/anexos de teste persistidos.

| ID | Cenário | Resultado observado | Status |
|---|---|---|---|
| E1-DB-01 | Tabelas públicas com RLS | 9 tabelas públicas com RLS habilitada; tabelas privadas de auditoria/configuração também com RLS | PASS |
| E1-RBAC-01 | Funcionário consulta RPC de auditoria | RPC rejeitou funcionário sem papel administrativo com 42501 | PASS |
| E1-RBAC-02 | Administrador TI consulta RPC de auditoria | RPC permitiu o papel administrativo | PASS |
| E1-DEL-01 | DELETE físico em `public.profiles` | Trigger rejeita com SQLSTATE 55000 | PASS |
| E1-DEL-02 | DELETE físico em `auth.users` | Trigger rejeita com SQLSTATE 55000 | PASS |
| E1-DEL-03 | Privilégio DELETE em `public.profiles` | `has_table_privilege` retornou false para authenticated e service_role após a migração | PASS |
| E1-MEDIA-01 | MIME de MP3/áudio | Constraint do banco rejeita | PASS |
| E1-MEDIA-02 | MIME de PNG | Constraint do banco rejeita | PASS |
| E1-MEDIA-03 | MIME de XLS/XLSX/CSV | Constraint do banco rejeita | PASS |
| E1-MEDIA-04 | MIME de DOC/DOCX | Constraint do banco rejeita | PASS |
| E1-MEDIA-05 | MIME de PDF/JPG/JPEG | Constraint aceita os três nomes/tipos permitidos | PASS |
| E1-STORAGE-01 | Buckets de anexos | Ambos privados, 5 MiB e allowlist PDF/JPEG | PASS |
| E1-DATA-01 | Entidade `access_requests` | Ainda não existe no banco; modelo e campos definidos neste documento para implementação posterior | PENDENTE DE IMPLEMENTAÇÃO |
| E1-MEDIA-06 | Arquivo malicioso/renomeado com MIME permitido enviado diretamente à API | Validação server-side de assinatura e scanner ainda não integrados | PENDENTE — BLOQUEIA LIBERAÇÃO DE ANEXOS |
| E1-SEC-01 | Supabase Leaked Password Protection | Security Advisor continua com WARN; limitação do plano Free permanece registrada | PENDENTE / RISCO ACEITO SOMENTE PARA DEMO |

### 9.1. Evidências técnicas

- Projeto Supabase: `chatapp-dev`, estado `ACTIVE_HEALTHY`, PostgreSQL 17.
- Migrações existentes aplicadas e nova migração de bloqueio de exclusão registrada como `20261124190407`.
- Consulta de catálogo confirmou RLS nas 9 tabelas públicas.
- Buckets verificados: `chat-quarantine` e `chat-attachments`, ambos privados, allowlist PDF/JPEG, limite 5 MiB.
- Security Advisor consultado em 24/11/2026: `auth_leaked_password_protection` permanece WARN.
- O teste automatizado de regressão da migração foi adicionado em `tests/account-deletion-guard.test.mjs`. A execução do CI após o commit deve ser conferida na PR; a validação SQL acima foi executada diretamente no projeto.

## 10. Pendências registradas sem antecipar etapas

- **Etapa 2:** validar sessão, bloqueio imediato de conta desabilitada e ausência de cadastro público em testes de navegador.
- **Etapa 3:** finalizar painel TI de criação individual, ativação/desativação e envio seguro de convite; manter proibição de exclusão já protegida no banco.
- **Etapa 5:** implementar validação de assinatura no servidor e scanner antimalware; manter anexos indisponíveis até liberação segura.
- **Etapa 6:** criar `access_requests`, registrar toda consulta de conteúdo e concluir o fluxo jurídico de notificação/atendimento.
- **Etapa 8:** E2E com duas sessões independentes, navegador desktop e mobile, anexos e auditoria.
- A exceção de proteção contra senhas vazadas continua aberta no plano Free. Não declarar resolvida.

---

## 11. Conclusão da Etapa 1

A arquitetura, o modelo conceitual, a matriz RBAC, a política de mídia, a estratégia de criptografia e o fluxo de governança foram especificados. Os testes de banco para RLS, RBAC, exclusão de conta e allowlist MIME foram executados. A proteção de exclusão física de contas foi reforçada no Supabase e versionada na branch.

**Resultado:** Etapa 1 concluída para fins de especificação e validação estrutural, com pendências de implementação explicitamente bloqueadas para as etapas correspondentes. Isso não significa que o produto esteja pronto para produção ou que anexos possam ser liberados.

## Referências técnicas

- [Supabase — Security](https://supabase.com/security)
- [Supabase — TLS for project APIs](https://supabase.com/docs/guides/security/tls)
- [Supabase — Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase — Cascade Deletes / ON DELETE RESTRICT](https://supabase.com/docs/guides/database/postgres/cascade-deletes)
- [Supabase — Password Security](https://supabase.com/docs/guides/auth/password-security)
