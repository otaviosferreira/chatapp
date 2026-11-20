# ChatApp — Demo funcional

Aplicação web de comunicação interna, em desenvolvimento, destinada exclusivamente a demonstrações com dados fictícios. Não utilizar com dados reais da Calunga nem como sistema corporativo de produção.

## Ambiente

- Aplicação: Next.js 16, React 19 e TypeScript.
- Backend: Supabase SSR, PostgreSQL, Auth, Realtime e Storage privado.
- Hospedagem: Vercel Preview.
- Branch de trabalho: `feat/foundation-scaffold`.
- Banco de desenvolvimento: projeto Supabase `chatapp-dev`, região São Paulo.
- Pull Request: [#82](https://github.com/otaviosferreira/chatapp/pull/82) — permanece Draft.

## Funcionalidades implementadas

### Acesso e contas
- Login e logout com Supabase Auth.
- Rotas protegidas e sessão SSR.
- Recuperação e atualização de senha.
- Convite e reenvio de convite pela área administrativa.
- Contas precisam estar ativas e possuir papel apropriado para acessar os recursos.
- Cadastro público e login anônimo permanecem desabilitados.

### Comunicação
- Conversas individuais privadas: qualquer funcionário ativo pode iniciar uma conversa com outro funcionário ativo.
- Grupos privados com gestão de membros e limites configuráveis pela TI.
- Mensagens persistidas e atualização em tempo real.
- Recibos de leitura, contadores de mensagens não lidas e histórico paginado.
- Lista de conversas com prévia, remetente/participante, avatar por iniciais e horário.
- Pesquisa global por funcionários, grupos e mensagens, respeitando associação ativa e RLS.

### Administração e auditoria
- Gestão de funcionários, status e papéis.
- Abas de auditoria, registros, configurações e anexos.
- Filtros e paginação de logs.
- Configurações persistidas e validadas no banco.
- Alterações administrativas registradas em auditoria.

### Anexos
- Upload restrito a PDF/JPEG, até 5 MB, com validação de tipo/assinatura e hash SHA-256.
- Arquivos são enviados para quarentena privada.
- **Scanner antimalware real ainda não está integrado.**
- Por segurança, arquivos pendentes/rejeitados não podem ser visualizados ou baixados. O fluxo de anexos não faz parte da demonstração funcional principal.

## Como executar localmente

Requisitos: Node.js 22.x e npm.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Configure as variáveis de ambiente no arquivo local ou no gerenciador de segredos. Nunca comite credenciais.

Scripts disponíveis:

- `npm run dev`: servidor local.
- `npm run lint`: ESLint.
- `npm run typecheck`: verificação TypeScript.
- `npm test`: testes automatizados.
- `npm run build`: build de produção.

## Contas de demonstração

Não existem credenciais padrão no repositório. O acesso é feito por contas fictícias previamente provisionadas no Supabase Auth. Um administrador de TI deve ativar o perfil e atribuir o papel `employee` aos usuários de demonstração pela interface administrativa. Não compartilhar senhas em Issues, commits ou documentação.

## Validação atual e limitações conhecidas

- GitHub Actions CI #307: **SUCCESS** para o commit de referência [c56d6b9](https://github.com/otaviosferreira/chatapp/commit/c56d6b965de36f50f52e2260e213d86d42b2365b).
- Preview Vercel do commit #307: deployment **READY**. O Preview pode exigir autenticação da Vercel.
- RLS está habilitada nas tabelas públicas e as regras de Storage mantêm os anexos em quarentena sem download.
- Testes automatizados e transacionais cobrem busca, autorização, criação de conversas, resumos, configurações administrativas e quarentena.
- Teste E2E autenticado com duas sessões independentes e envio/recebimento real de mensagens ainda precisa de validação manual.
- Inspeção visual manual em dispositivos mobile/tablet/desktop ainda pendente.
- Scanner antimalware real não integrado; anexos permanecem bloqueados.
- O alerta Supabase de proteção contra senhas vazadas permanece como pendência conhecida no plano Free.
- Não declarar o sistema pronto para produção.

## Segurança e uso responsável

- Utilizar exclusivamente dados e contas fictícias.
- Não inserir informações pessoais, documentos, credenciais ou dados reais da empresa.
- Não expor a chave secreta do Supabase em variáveis `NEXT_PUBLIC_*` ou no navegador.
- Não habilitar cadastro público nem login anônimo.
- Não liberar anexos sem scanner antimalware e validação do fluxo completo.
- A demonstração não equivale a homologação ou autorização para uso corporativo.

## Próximas validações da demo

1. Administrador atribuir o papel `employee` ao segundo perfil de demonstração.
2. Entrar com duas contas em navegadores/perfis separados.
3. Criar conversa individual, enviar mensagens nos dois sentidos e validar atualização Realtime.
4. Validar grupo privado, pesquisa, recibos e contadores de não lidas.
5. Fazer inspeção visual em desktop e mobile.
