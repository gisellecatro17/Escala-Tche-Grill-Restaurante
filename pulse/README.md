# Pulse

> Nós cuidamos da gestão financeira para que você cuide do crescimento.

Plataforma SaaS multiempresa de BPO financeiro: contas a pagar e a receber, aprovação de
pagamentos, importação e conciliação de extratos bancários, organização e inteligência
financeira, relatórios gerenciais e indicadores para tomada de decisão.

Este repositório está sendo desenvolvido **módulo por módulo**. Já foram entregues:

1. **Fundação do sistema** — estrutura do projeto, autenticação, estrutura multiempresa
   (organizações/empresas/usuários), perfis e permissões, auditoria inicial e o layout
   principal da aplicação.
2. **Cadastro de Empresas** — cadastro completo em etapas (identificação, dados
   cadastrais, endereços, contatos, informações fiscais, configurações financeiras,
   usuários e revisão), consulta automática de CNPJ e de CEP, ativação/inativação/
   suspensão, upload de logo, duplicação de configurações (estrutura extensível) e
   auditoria detalhada.
3. **Cadastro de Fornecedores** — cadastro global (por CPF/CNPJ, nunca duplicado) +
   vínculo independente por empresa (classificação financeira, condições comerciais,
   dados bancários/PIX com proteção por permissão, retenções, rateios, regras de
   automação, contratos e documentos). Ver seção dedicada abaixo.

Os demais módulos financeiros (clientes, categorias/centros de custo completos, contas a
pagar/receber, importação OFX, conciliação, inteligência financeira) serão adicionados em
etapas futuras, mediante aprovação.

## Visão geral

- **Multiempresa**: um usuário pode participar de uma ou mais organizações e acessar uma
  ou mais empresas, com perfis diferentes em cada uma. O isolamento de dados é aplicado no
  back-end — inclusive para ações anteriores à existência de uma empresa (ex.: criar a
  primeira empresa de uma organização nova), via vínculo direto por organização
  (`organizationMemberships`).
- **Módulos do menu**: Visão Geral, Cadastros, Financeiro, Inteligência Financeira e
  Configurações. Nesta etapa, o **Dashboard** (Visão Geral) e **Cadastros → Empresas /
  Fornecedores** estão navegáveis; os demais itens aparecem no menu como "Em breve".

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
│   │   ├── ui/                Primitivas de UI (button, input, table, sheet, dialog, form, checkbox, switch...)
│   │   ├── layout/             Sidebar, Header, Seletor de empresa
│   │   ├── companies/          Cadastro de Empresas: listagem, ações, wizard em etapas, diálogos
│   │   └── suppliers/          Cadastro de Fornecedores: listagem, ações, wizard em 10 etapas, seleção rápida de categoria/centro de custo
│   ├── lib/
│   │   ├── supabase/          Clientes Supabase (browser, server, proxy)
│   │   ├── auth/               Contexto de sessão (usuário, empresa selecionada, permissões)
│   │   ├── api/                 Cliente HTTP da API do Pulse + hooks TanStack Query por módulo
│   │   ├── validation/          Schemas Zod (cadastro de empresa, cadastro de fornecedor)
│   │   ├── mappers/              Conversão entre entidades da API e valores de formulário
│   │   ├── format/              Formatação BRL/datas/documentos/máscaras (CNPJ, CPF, CEP, telefone)
│   │   └── menu.ts              Estrutura do menu lateral (módulos do prompt mestre)
│   └── proxy.ts                Proteção de rotas (equivalente ao antigo middleware.ts)
├── backend/                  NestJS
│   ├── prisma/
│   │   ├── schema.prisma      Modelo de dados
│   │   ├── migrations/        Fundação + Cadastro de Empresas + Cadastro de Fornecedores (incremental)
│   │   └── seed.ts             Perfis, permissões e organização/empresa de demonstração
│   └── src/
│       ├── common/             Decorators, guards, filtros, interceptor de resposta padrão, controle de acesso
│       ├── integrations/
│       │   ├── company-registry/  Consulta cadastral de CNPJ (provider desacoplado: mock/BrasilAPI)
│       │   └── postal-code/        Consulta de CEP (provider desacoplado: mock/ViaCEP)
│       ├── storage/             Upload/remoção de arquivos no Supabase Storage (logo da empresa, documentos de fornecedor)
│       ├── modules/
│       │   ├── auth/            Validação de sessão Supabase + carregamento de vínculos
│       │   ├── organizations/   CRUD de organizações
│       │   ├── companies/       Cadastro de Empresas completo (ver seção dedicada abaixo)
│       │   ├── suppliers/       Cadastro de Fornecedores completo (ver seção dedicada abaixo)
│       │   ├── taxonomy/        Categorias e centros de custo (estrutura mínima reutilizável, com cadastro rápido)
│       │   ├── financial-institutions/  Catálogo de bancos (seed + busca)
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

## Cadastro de Empresas

Rotas do front-end: `/cadastros/empresas` (listagem), `/cadastros/empresas/nova`
(cadastro em etapas, com `?draftId=` para retomar um rascunho),
`/cadastros/empresas/:id` (detalhes, com abas) e `/cadastros/empresas/:id/editar`.

Principais endpoints da API (todos documentados no Swagger):

| Rota | Descrição |
| --- | --- |
| `GET /companies` | Lista com busca, filtros (status, situação cadastral, matriz/filial, cidade/UF, organização) e paginação |
| `POST /companies` | Conclui o cadastro (status inicial `IMPLEMENTATION`) |
| `POST /companies/drafts` | Cria ou atualiza um rascunho (`id` opcional no corpo) |
| `GET /companies/:id` | Detalhe completo (endereços, contatos, CNAEs, matriz/filiais, histórico) |
| `GET /companies/:id/activation-pendencies` | Lista o que falta para poder ativar |
| `PATCH /companies/:id` | Atualiza; promove rascunho para `IMPLEMENTATION` |
| `POST /companies/:id/activate` \| `/reactivate` \| `/deactivate` \| `/suspend` | Transições de status (as duas últimas exigem motivo) |
| `DELETE /companies/:id` | Exclusão física — somente rascunho sem vínculos |
| `POST /companies/document-query` | Consulta CNPJ (provider desacoplado) + verificação de duplicidade |
| `POST /companies/postal-code-query` | Consulta CEP (provider desacoplado) |
| `POST/DELETE /companies/:id/logo` | Upload/remoção da logo (Supabase Storage) |
| `POST /companies/:id/duplicate-settings` | Duplicação de configurações (estrutura extensível — todos os itens ainda retornam "indisponível nesta etapa", pois dependem de módulos futuros) |
| `GET /companies/:id/audit` | Auditoria da empresa (somente leitura) |
| `POST/DELETE /companies/:id/users[/:userId]` | Vincula/remove usuário da empresa (reaproveita `UserCompanyRole`) |

Permissões granulares: `company.view`, `company.create`, `company.update`,
`company.activate`, `company.deactivate`, `company.suspend`, `company.delete`,
`company.manage_users`, `company.manage_settings`, `company.view_audit`,
`company.query_document`, `company.duplicate_settings`, `company.manage_logo` — validadas
no back-end (`assertOrganizationPermission`/`assertCompanyPermission` em
`common/utils/access-control.util.ts`) e usadas no front para ocultar ações sem permissão.

Consulta cadastral: por padrão usa um **provider simulado** (`COMPANY_REGISTRY_PROVIDER=mock`),
sem nenhuma chamada externa — ideal para desenvolvimento. Defina
`COMPANY_REGISTRY_PROVIDER=brasilapi` para consultar a
[BrasilAPI](https://brasilapi.com.br) (API pública, sem chave). O CEP usa o
[ViaCEP](https://viacep.com.br) por padrão (`POSTAL_CODE_PROVIDER=viacep`), com um modo
`mock` para testes offline. Nenhum dos dois acessa diretamente o site da Receita Federal.

## Cadastro de Fornecedores

O cadastro tem duas camadas: o **cadastro global** (`suppliers` — identidade fiscal por
CPF/CNPJ, nunca duplicado na plataforma) e o **vínculo com a empresa**
(`supplier_company_links` — classificação financeira, condições comerciais, retenções,
rateios, regras de automação e contratos, independentes por empresa; `supplier_id +
company_id` é único).

Rotas do front-end: `/cadastros/fornecedores` (listagem, sempre por empresa selecionada),
`/cadastros/fornecedores/novo` (wizard de 10 etapas, com `?draftId=` para retomar),
`/cadastros/fornecedores/:id` (detalhes, com abas), `/cadastros/fornecedores/:id/editar`
(dados cadastrais globais) e `/cadastros/fornecedores/:id/empresas/:companyLinkId`
(configuração do vínculo com a empresa — classificação, comercial, retenções/rateios,
automações, contratos, histórico).

Principais endpoints da API (todos documentados no Swagger):

| Rota | Descrição |
| --- | --- |
| `GET /suppliers` | Lista os **vínculos** (fornecedor + empresa), com busca, filtros e paginação |
| `POST /suppliers` | Cria o cadastro global (opcionalmente já com o vínculo inicial embutido) |
| `POST /suppliers/drafts` | Cria/atualiza um rascunho |
| `GET/PATCH /suppliers/:id` | Consulta/atualiza o cadastro global |
| `POST /suppliers/document-query` | Consulta CPF/CNPJ — reaproveita o provider do Cadastro de Empresas |
| `POST /suppliers/:id/company-links` | Vincula um fornecedor já existente a uma empresa |
| `GET/PATCH/DELETE /supplier-company-links/:id` | Consulta/edita/exclui um vínculo (exclusão só em rascunho sem uso) |
| `POST /supplier-company-links/:id/{activate,deactivate,suspend,block,unblock}` | Transições de status do vínculo (bloqueio/suspensão/inativação exigem motivo) |
| `POST /supplier-company-links/:id/duplicate` | Duplica o vínculo para outra empresa (nunca duplica o cadastro global) |
| `POST /suppliers/:id/bank-accounts` \| `/pix-keys` | Inclui conta bancária/chave PIX — exige confirmação e motivo quando o titular é um terceiro |
| `POST /supplier-company-links/:id/classification-rules` \| `/allocations` \| `/tax-withholdings` \| `/contracts` | Regras de classificação alternativa, rateios (validados até 100%), retenções tributárias e contratos |
| `POST /suppliers/:id/documents` | Upload de documentos (Supabase Storage) |
| `GET /supplier-company-links/:id/audit` | Auditoria do vínculo (somente leitura) |
| `GET/POST /categories` \| `/cost-centers` | Estrutura mínima reutilizável para o cadastro rápido de categoria/centro de custo, sem sair do formulário |
| `GET /financial-institutions` | Catálogo de bancos (busca por código, ISPB ou nome) |

Permissões granulares: `supplier.view`, `supplier.create`, `supplier.update`,
`supplier.activate`, `supplier.deactivate`, `supplier.suspend`, `supplier.block`,
`supplier.unblock`, `supplier.delete`, `supplier.query_document`,
`supplier.manage_company_link`, `supplier.manage_bank_data`, `supplier.manage_pix_keys`,
`supplier.manage_classification`, `supplier.manage_rules`, `supplier.manage_allocations`,
`supplier.manage_withholdings`, `supplier.manage_contracts`, `supplier.manage_documents`,
`supplier.view_movements`, `supplier.view_audit`, `supplier.duplicate_link`,
`supplier.allow_third_party_bank_account` e `supplier.view_bank_data`. Usuários sem
`supplier.view_bank_data` recebem agência/conta/chave PIX mascaradas do back-end (nunca o
valor completo).

**Reconhecimento automático futuro**: a estrutura de dados para identificação em
importações (nomes alternativos, identificadores bancários, base de aprendizado por
confirmação) já existe (`supplier_alternative_names`, `supplier_bank_identifiers`,
`supplier_recognition_learning`), mas nesta etapa apenas armazena — nenhuma decisão
automática é tomada, e a simples identificação do fornecedor nunca gera conciliação
automática sozinha.

## Banco de dados e migrations

O schema fica em `backend/prisma/schema.prisma`. Tabelas principais:
`organizations`, `companies`, `company_addresses`, `company_contacts`, `company_cnaes`,
`company_registry_queries`, `company_status_history`, `suppliers`,
`supplier_company_links`, `supplier_addresses`, `supplier_contacts`, `supplier_cnaes`,
`supplier_alternative_names`, `supplier_bank_accounts`, `supplier_pix_keys`,
`supplier_bank_identifiers`, `supplier_classification_rules`,
`supplier_default_allocations`, `supplier_tax_withholdings`, `supplier_contracts`,
`supplier_registry_queries`, `supplier_status_history`, `supplier_recognition_learning`,
`financial_institutions`, `categories`, `cost_centers`, `attachments` (anexos genéricos),
`users`, `roles`, `permissions`, `role_permissions`, `user_organization_roles`,
`user_company_roles` e `audit_logs`.

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
npm test        # testes unitários: isolamento multiempresa/organização, permissões,
                 # validação de CPF/CNPJ, duplicidade de documento (empresas e fornecedores),
                 # pendências de ativação, bloqueio/permissão de exclusão de empresas,
                 # vínculo duplicado, conta/PIX de terceiro, mascaramento de dados bancários,
                 # soma de rateios (até 100%), bloqueio/motivo obrigatório do vínculo
npm run test:e2e
```

### Testar manualmente o Cadastro de Fornecedores

1. Suba backend e frontend, faça login e selecione a empresa "Tchê Grill" no cabeçalho.
2. Acesse **Cadastros → Fornecedores** — o fornecedor de demonstração "Frigorífico Boi
   Forte" (criado pelo seed, já vinculado à empresa com categoria "Carnes e proteínas" e
   centro de custo "Churrasqueira") deve aparecer na listagem.
3. Clique em **+ Incluir novo fornecedor** e percorra o wizard: informe um CNPJ diferente
   do já cadastrado, teste "Consultar CNPJ" (provider mock), inclua um endereço (com
   "Buscar CEP"), uma conta bancária com titular diferente do fornecedor (deve exigir
   confirmação de conta de terceiro) e uma categoria/centro de custo pelo cadastro rápido
   (sem sair do formulário).
4. Tente cadastrar novamente o mesmo CNPJ do fornecedor de demonstração — o sistema deve
   identificar a duplicidade e oferecer vincular à empresa em vez de duplicar o cadastro.
5. Na tela de detalhes, teste bloquear (exige motivo), desbloquear e duplicar o vínculo
   para outra empresa.

### Testar manualmente o Cadastro de Empresas

1. Suba backend e frontend (seção Instalação) e faça login com um usuário
   `organization_admin` (veja "Primeiro acesso").
2. Acesse **Cadastros → Empresas** e clique em **+ Incluir nova empresa**.
3. Na etapa "Identificação", selecione pessoa jurídica e informe um CNPJ válido (ex.:
   `11.222.333/0001-81`, usado no seed) — o botão "Consultar CNPJ" chama o provider mock e
   preenche os campos após você confirmar "Usar estes dados".
4. Avance pelas etapas, use "Salvar como rascunho" a qualquer momento (o rascunho passa a
   aparecer na listagem com o status "Rascunho" e pode ser retomado clicando nele) e
   conclua em "Revisão".
5. Na tela de detalhes, teste ativar (mostra pendências se faltar algo, como usuário
   administrador vinculado), inativar/suspender (exigem motivo) e o upload de logo.

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

Cadastro de **Clientes**, seguindo o mesmo padrão de cadastro global + vínculo por empresa
já estabelecido no Cadastro de Fornecedores.
