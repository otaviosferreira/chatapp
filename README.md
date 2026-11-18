# ChatApp

Aplicação web de comunicação privada em desenvolvimento. O projeto utiliza exclusivamente dados fictícios e não está autorizado para uso corporativo real.

## Estado atual

- Documentação de arquitetura: `docs/ARQUITETURA-TECNICA.md`.
- Backlog oficial: 70 Issues abertas, distribuídas por responsabilidade.
- Fundação inicial: Next.js, React, TypeScript, Tailwind CSS e configuração de lint.
- Backend, autenticação, banco, RLS, Realtime, Storage, administração e testes automatizados ainda precisam ser implementados e validados.

## Requisitos

- Node.js 20.9 ou superior.
- npm 10 ou compatível.

## Instalação

```bash
npm install
cp .env.example .env.local
npm run dev
```

Acesse http://localhost:3000.

## Comandos

- `npm run dev`: servidor de desenvolvimento.
- `npm run build`: build de produção.
- `npm run start`: inicia o build.
- `npm run lint`: análise estática.
- `npm run typecheck`: verificação TypeScript.

## Segurança e dados

- Não habilitar cadastro público.
- Não inserir dados pessoais, documentos, credenciais ou informações reais da Calunga.
- Nunca expor `SUPABASE_SERVICE_ROLE_KEY` no navegador ou em variáveis `NEXT_PUBLIC_*`.
- Não habilitar upload até que quarentena, verificação antimalware e autorização de download estejam implementadas e testadas.
- O ambiente gratuito é destinado apenas a desenvolvimento/demonstração, sujeito às limitações descritas na arquitetura.

## Próximas etapas

1. Integrar Supabase Auth e middleware de sessão, sem signup público.
2. Criar migrations, modelo de dados e políticas RLS.
3. Implementar RBAC e bloqueio de contas desabilitadas.
4. Implementar conversas e mensagens persistidas com Realtime.
5. Adicionar grupos privados, pesquisa e notificações.
6. Implementar administração e auditoria.
7. Configurar testes unitários, integração, E2E e segurança.

Consulte as Issues do repositório para rastreabilidade das atividades.
