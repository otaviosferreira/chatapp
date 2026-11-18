# ChatApp

Aplicação web de comunicação privada em desenvolvimento. O projeto utiliza exclusivamente dados fictícios e não está autorizado para uso corporativo real.

## Diagnóstico e arquitetura

- Diagnóstico inicial: `docs/DIAGNOSTICO-ESTADO-2026-11-18.md`.
- Arquitetura técnica: `docs/ARQUITETURA-TECNICA.md`.
- Status do backend: `docs/STATUS-BACKEND-2026-11-18.md`.
- Backlog oficial: 70 Issues abertas, distribuídas por responsabilidade.

## Estado atual

- Fundação inicial: Next.js, React, TypeScript, Tailwind CSS e configuração de lint.
- Supabase de desenvolvimento criado na região São Paulo.
- Schema inicial aplicado e versionado em `supabase/migrations/`.
- RLS aplicada nas tabelas públicas; buckets privados e publicação Realtime de mensagens configurados.
- Autenticação na aplicação, provisionamento de contas, interface de chat, scanner de anexos e testes autenticados ainda não implementados.
- CI valida lint, TypeScript e build; consulte GitHub Actions para o resultado do commit mais recente.

## Requisitos

- Node.js 22.0.0 ou superior.
- npm 10 ou compatível.

## Instalação

```bash
npm install
cp .env.example .env.local
npm run dev
```

Acesse http://localhost:3000.

## Variáveis de ambiente

- `NEXT_PUBLIC_SUPABASE_URL`: URL do projeto Supabase.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: chave publicável, permitida no navegador.
- `SUPABASE_SECRET_KEY`: chave secreta somente no servidor; nunca usar prefixo `NEXT_PUBLIC_`.

Configure valores apenas em ambiente local ou no gerenciador de segredos. Não comitar credenciais.

## Comandos

- `npm run dev`: servidor de desenvolvimento.
- `npm run build`: build de produção.
- `npm run start`: inicia o build.
- `npm run lint`: análise estática.
- `npm run typecheck`: verificação TypeScript.

## Segurança e dados

- Não habilitar cadastro público nem login anônimo.
- Não inserir dados pessoais, documentos, credenciais ou informações reais da Calunga.
- Não expor a chave secreta Supabase no navegador ou em variáveis `NEXT_PUBLIC_*`.
- Anexos permanecem em quarentena até existir scanner antimalware aprovado e fluxo de validação completo.
- O ambiente gratuito é destinado apenas a desenvolvimento/demonstração, sujeito às limitações descritas na arquitetura.

## Próximas etapas

1. Integrar Supabase Auth e middleware de sessão, sem signup público.
2. Implementar provisionamento administrativo e bootstrap seguro do primeiro administrador.
3. Implementar operações de conversa/mensagem e testar RLS com usuários sintéticos.
4. Conectar Supabase Realtime à interface.
5. Implementar scanner antimalware antes de liberar anexos.
6. Implementar grupos, busca, notificações, painel de TI e auditoria.
7. Configurar testes unitários, integração, E2E e segurança.

Consulte as Issues do repositório para rastreabilidade das atividades.
