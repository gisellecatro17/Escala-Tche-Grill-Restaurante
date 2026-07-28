# Pulse

> Nós cuidamos da gestão financeira para que você cuide do crescimento.

Plataforma SaaS multiempresa de BPO financeiro: contas a pagar e a receber, aprovação de
pagamentos, importação e conciliação de extratos bancários, organização e inteligência
financeira, relatórios gerenciais e indicadores para tomada de decisão.

Este repositório está sendo desenvolvido **módulo por módulo**. Esta primeira entrega
contém apenas a **fundação do sistema**: estrutura do projeto, autenticação, estrutura
multiempresa (organizações/empresas/usuários), perfis e permissões, auditoria inicial e o
layout principal da aplicação. Os módulos financeiros (cadastros completos, contas a
pagar/receber, importação OFX, conciliação, inteligência financeira) serão adicionados em
etapas futuras, mediante aprovação.

## Visão geral

- **Multiempresa**: um usuário pode participar de uma ou mais organizações e acessar uma
  ou mais empresas, com perfis diferentes em cada uma. O isolamento de dados é aplicado no
  back-end.
- **Módulos do menu**: Visão Geral, Cadastros, Financeiro, Inteligência Financeira e
  Configurações. Nesta etapa, apenas o **Dashboard** (Visão Geral) está navegável; os
  demais itens aparecem no menu como "Em breve".

## Tecnologias

| Camada         | Stack                                                                 |
| -------------- | ---------------------------------------------------------------------|
| Front-end      | Next.js 16 (App Router) · TypeScript · React 19 · Tailwind CSS v4    |
| UI             | Componentes no padrão shadcn/ui (Radix UI) · Lucide Icons            |
| Dados/estado   | TanStack Query · TanStack Table (pronto para as próximas telas)      |
| Formulários    | React Hook Form · Zod                                                |
| Back-end       | NestJS 11 · TypeScript                                               |
| Banco de dados | PostgreSQL                                                           |
| ORM            | Prisma 7 (`prisma-client-js` — ver `docs/arquitetura.md`)             |
| Autenticação   | Supabase Auth (`@supabase/ssr`, `@supabase/supabase-js`)             |
| Armazenamento  | Supabase Storage (a ser usado a partir dos módulos de anexos)        |
| Validação      | class-validator/class-transformer (API) · Zod (front) · `cpf-cnpj-validator` · `libphonenumber-js` |
| Documentação da API | Swagger (`/docs`)                                                |

## Estrutura de pastas

```
pulse/
├── frontend/                 Next.js (App Router)
│   ├── app/
│   │   ├── (app)/            Área autenticada: layout com sidebar + header + página inicial
│   │   ├── login/            Tela de login
│   │   ├── acesso-negado/    Tela de acesso negado (403)
│   │   ├── erro/             Tela de erro genérica
│   │   ├── error.tsx         Error boundary do App Router
│   │   └── not-found.tsx     Página 404
│   ├── components/
│   │   ├── ui/                Primitivas de UI (button, input, table, sheet, dialog, form...)
│   │   └── layout/            Sidebar, Header, Seletor de empresa
│   ├── lib/
│   │   ├── supabase/          Clientes Supabase (browser, server, proxy)
│   │   ├── auth/               Contexto de sessão (usuário, empresa selecionada, permissões)
│   │   ├── api/                 Cliente HTTP da API do Pulse
│   │   ├── format/              Formatação BRL/datas/documentos
│   │   └── menu.ts              Estrutura do menu lateral (módulos do prompt mestre)
│   └── proxy.ts                Proteção de rotas (equivalente ao antigo middleware.ts)
├── backend/                  NestJS
│   ├── prisma/
│   │   ├── schema.prisma      Modelo de dados
│   │   ├── migrations/        Migration inicial
│   │   └── seed.ts             Perfis, permissões e organização/empresa de demonstração
│   └── src/
│       ├── common/             Decorators, guards, filtros, interceptor de resposta padrão
│       ├── modules/
│       │   ├── auth/            Validação de sessão Supabase + carregamento de vínculos
│       │   ├── organizations/   CRUD de organizações
│       │   ├── companies/       CRUD de empresas
│       │   ├── users/           Convite de usuários e gestão de vínculos/perfis
│       │   ├── roles/           Listagem de perfis e permissões
│       │   └── audit/           Trilha de auditoria (somente leitura)
│       └── prisma/              PrismaService/PrismaModule
├── docs/
│   └── arquitetura.md
├── docker-compose.yml         PostgreSQL local
├── .env.example
└── README.md
```

## Pré-requisitos

- Node.js 20+ e npm
- Docker (para subir o PostgreSQL local) — ou uma instância PostgreSQL própria
- Uma conta e um projeto no [Supabase](https://supabase.com) (gratuito para desenvolvimento)

## Instalação

```bash
# 1. Suba o PostgreSQL local
cp .env.example .env
docker compose up -d

# 2. Backend
cd backend
cp .env.example .env      # preencha DATABASE_URL, SUPABASE_URL e as chaves (veja abaixo)
npm install
npm run prisma:migrate     # cria as tabelas
npm run seed                # cria perfis, permissões e a empresa de demonstração "Tchê Grill"
npm run start:dev           # http://localhost:3333 (Swagger em /docs)

# 3. Frontend (em outro terminal)
cd frontend
cp .env.example .env.local  # preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY
npm install
npm run dev                 # http://localhost:3000
```

### Configurando o Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Em **Project Settings → API**, copie:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL` (frontend) e `SUPABASE_URL` (backend);
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY` (frontend) e `SUPABASE_ANON_KEY` (backend);
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (backend apenas — **nunca** exponha
     essa chave no front-end).
3. Em **Authentication → Providers**, mantenha "Email" habilitado.
4. Crie o primeiro usuário (Authentication → Users → "Add user" ou pela tela de login do
   Pulse com "Esqueci minha senha", que envia um e-mail de definição de senha).

### Primeiro acesso (vincular seu usuário como administrador)

Depois de criar sua conta no Supabase Auth, vincule-a como **Administrador da
organização** da empresa de demonstração ("Tchê Grill Restaurante Ltda.") criada pelo
seed:

```bash
cd backend
npm run seed:admin -- seu-email@dominio.com
```

Depois disso, faça login normalmente pela tela `/login` do front-end.

## Variáveis de ambiente

Veja `.env.example` (raiz, usado pelo `docker-compose.yml`), `backend/.env.example` e
`frontend/.env.example` para a lista completa. Nenhuma credencial real é versionada.

## Banco de dados e migrations

O schema fica em `backend/prisma/schema.prisma`. Principais tabelas desta etapa:
`organizations`, `companies`, `users`, `roles`, `permissions`, `role_permissions`,
`user_organization_roles`, `user_company_roles` e `audit_logs`.

```bash
cd backend
npm run prisma:migrate    # aplica migrations em desenvolvimento (cria uma nova a partir de mudanças no schema)
npm run prisma:deploy     # aplica migrations existentes (uso em produção/CI)
npm run prisma:studio     # navegador visual do banco
npm run seed               # reaplica perfis/permissões/dados de demonstração (idempotente)
```

## Testes

```bash
cd backend
npm test        # testes unitários (isolamento multiempresa, permissões, validação de CNPJ, duplicidade)
npm run test:e2e
```

```bash
cd frontend
npm run lint
npm run build    # inclui checagem de tipos
```

## Comandos úteis

| Comando (dentro de `backend/`) | Descrição |
| --- | --- |
| `npm run start:dev` | Sobe a API em modo watch |
| `npm run build` | Build de produção |
| `npm run lint` | ESLint |
| `npm run prisma:studio` | Explorador visual do banco |

| Comando (dentro de `frontend/`) | Descrição |
| --- | --- |
| `npm run dev` | Sobe o front-end em modo desenvolvimento |
| `npm run build` | Build de produção (Next.js) |
| `npm run lint` | ESLint |

## Documentação da API

Com o back-end rodando, o Swagger fica disponível em `http://localhost:3333/docs`.

## Próxima etapa recomendada

Módulo **Cadastros** completo (Empresas, Fornecedores, Clientes, Categorias financeiras,
Centros de custo, Contas bancárias, Formas de pagamento, Cartões e adquirentes), seguindo
o padrão de listagem, formulário em etapas e cadastro rápido definidos no prompt mestre.
