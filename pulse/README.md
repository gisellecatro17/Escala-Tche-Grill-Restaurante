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
4. **Cadastro de Clientes** — mesmo padrão de cadastro global + vínculo por empresa,
   incluindo o ciclo de vida Prospect → Cliente ativo, classificação comercial,
   condições de recebimento, crédito com permissão dedicada, regras de cobrança,
   contratos e recorrências (preparadas para o futuro módulo de contas a receber). Ver
   seção dedicada abaixo.
5. **Estrutura Financeira** — plano de contas, categorias/subcategorias, centros de
   custo, centros de resultado, projetos, unidades de negócio, naturezas financeiras,
   tags, rateios e regras de classificação automática, com árvores de profundidade
   ilimitada, importação/exportação e versionamento. Ver seção dedicada abaixo.
6. **Tesouraria e Cadastros Bancários** — contas bancárias, contas de pagamento, caixas,
   fundos fixos, carteiras digitais, cartões corporativos, chaves PIX da empresa, formas
   de pagamento e de recebimento, favorecidos bancários, parâmetros de tesouraria, saldo
   de implantação e a estrutura preparada para as futuras integrações bancárias. Ver
   seção dedicada abaixo.

Os demais módulos financeiros (contas a pagar/receber, importação OFX, conciliação,
inteligência financeira) serão adicionados em etapas futuras, mediante aprovação.

## Visão geral

- **Multiempresa**: um usuário pode participar de uma ou mais organizações e acessar uma
  ou mais empresas, com perfis diferentes em cada uma. O isolamento de dados é aplicado no
  back-end — inclusive para ações anteriores à existência de uma empresa (ex.: criar a
  primeira empresa de uma organização nova), via vínculo direto por organização
  (`organizationMemberships`).
- **Módulos do menu**: Visão Geral, Cadastros, Financeiro, Inteligência Financeira e
  Configurações. Nesta etapa, o **Dashboard** (Visão Geral) e todo o bloco **Cadastros**
  estão navegáveis; os demais itens aparecem no menu como "Em breve".

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
│   │   ├── suppliers/          Cadastro de Fornecedores: listagem, ações, wizard em 10 etapas, seleção rápida de categoria/centro de custo
│   │   ├── customers/          Cadastro de Clientes: listagem, ações (com conversão de prospect), wizard em 10 etapas
│   │   ├── treasury/            Wizard de 8 etapas da conta financeira, formulário de cartão e campo de formulário compartilhado
│   │   └── financial-structure/ Árvore reutilizável (expandir/recolher/mover), diálogos de nó e página padrão dos cadastros estruturais
│   ├── lib/
│   │   ├── supabase/          Clientes Supabase (browser, server, proxy)
│   │   ├── auth/               Contexto de sessão (usuário, empresa selecionada, permissões)
│   │   ├── api/                 Cliente HTTP da API do Pulse + hooks TanStack Query por módulo
│   │   ├── validation/          Schemas Zod (cadastro de empresa, fornecedor, cliente)
│   │   ├── mappers/              Conversão entre entidades da API e valores de formulário
│   │   ├── format/              Formatação BRL/datas/documentos/máscaras (CNPJ, CPF, CEP, telefone)
│   │   └── menu.ts              Estrutura do menu lateral (módulos do prompt mestre)
│   └── proxy.ts                Proteção de rotas (equivalente ao antigo middleware.ts)
├── backend/                  NestJS
│   ├── prisma/
│   │   ├── schema.prisma      Modelo de dados
│   │   ├── migrations/        Fundação + Empresas + Fornecedores + Clientes + Estrutura Financeira + Tesouraria (incremental)
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
│       │   ├── customers/       Cadastro de Clientes completo (ver seção dedicada abaixo)
│       │   ├── treasury/        Contas financeiras, saldos, limites, chaves PIX, responsáveis, integrações, cartões, formas de pagamento/recebimento e parâmetros
│       │   ├── financial-structure/ Plano de contas, centros de resultado, projetos, unidades, naturezas, tags, rateios, regras, importação/exportação e versionamento
│       │   ├── taxonomy/        Categorias (com subcategorias) e centros de custo — em árvore, com cadastro rápido reaproveitado por Fornecedores e Clientes
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

## Cadastro de Clientes

Mesma arquitetura em duas camadas do Cadastro de Fornecedores: o **cadastro global**
(`customers` — identidade fiscal por CPF/CNPJ, nunca duplicada) e o **vínculo com a
empresa** (`customer_company_links` — classificação comercial, condições de recebimento,
crédito, regras de cobrança, contratos e recorrências, independentes por empresa;
`customer_id + company_id` é único). Um cliente **prospect** e um **cliente ativo** são o
mesmo cadastro — a diferença é apenas o `status` do vínculo (`PROSPECT` é o status inicial
padrão), convertido via `POST /customer-company-links/:id/convert-prospect` depois que as
pendências mínimas forem resolvidas (categoria de receita padrão, condição de recebimento,
um contato financeiro e dados cadastrais completos).

Nesta etapa o módulo **não** emite boletos/PIX/notas fiscais, não envia e-mail/WhatsApp
real, não faz cobrança jurídica, não importa OFX e não tem motor de baixa automática ou
CRM comercial — mas já está preparado para essas integrações futuras (ver
`docs/arquitetura.md`).

Rotas do front-end: `/cadastros/clientes` (listagem, sempre por empresa selecionada),
`/cadastros/clientes/novo` (wizard de 10 etapas, com `?draftId=` para retomar),
`/cadastros/clientes/:id` (detalhes, com abas), `/cadastros/clientes/:id/editar` (dados
cadastrais globais) e `/cadastros/clientes/:id/empresas/:companyLinkId` (configuração do
vínculo — classificação, condições de recebimento, crédito, regras de cobrança, contratos
e recorrências, histórico).

Principais endpoints da API (todos documentados no Swagger):

| Rota | Descrição |
| --- | --- |
| `GET /customers` | Lista os **vínculos** (cliente + empresa), com busca, filtros (status, situação financeira, categoria, centro de resultado, cidade/UF) e paginação |
| `POST /customers` | Cria o cadastro global (opcionalmente já com o vínculo inicial embutido, criado como `PROSPECT`) |
| `POST /customers/drafts` | Cria/atualiza um rascunho |
| `GET/PATCH/DELETE /customers/:id` | Consulta/atualiza/exclui o cadastro global (exclusão só em rascunho sem vínculos) |
| `POST /customers/document-query` | Consulta CPF/CNPJ — reaproveita o mesmo provider do Cadastro de Empresas/Fornecedores |
| `POST /customers/:id/company-links` | Vincula um cliente já existente a uma empresa (como `PROSPECT`) |
| `POST /customers/:id/addresses` \| `/contacts` | Inclui um endereço/contato (não substitui a lista existente) |
| `GET/PATCH/DELETE /customer-company-links/:id` | Consulta/edita/exclui um vínculo (exclusão só em rascunho/prospect sem uso) |
| `PATCH /customer-company-links/:id/credit` | Atualiza limite de crédito/risco — protegido pela permissão dedicada `customer.update_credit_limit` |
| `POST /customer-company-links/:id/convert-prospect` | Converte prospect em cliente ativo (valida pendências mínimas) |
| `POST /customer-company-links/:id/{activate,deactivate,suspend,block,unblock}` | Transições de status do vínculo (bloqueio/suspensão/inativação exigem motivo) |
| `POST /customer-company-links/:id/duplicate` | Duplica o vínculo para outra empresa (nunca duplica o cadastro global) |
| `POST /customer-company-links/:id/billing-rules` \| `/collection-history` \| `/payment-promises` | Regras de cobrança, histórico de contato e promessas de pagamento (nenhuma mensagem real é enviada) |
| `POST /customer-company-links/:id/contracts` \| `/contracts/:contractId/amendments` \| `/recurring-receivables` | Contratos, aditivos e recorrências (ficam com `processingStatus: PENDING_FINANCIAL_MODULE` até o módulo de contas a receber existir) |
| `POST /customers/:id/documents` | Upload de documentos (Supabase Storage) |
| `GET /customer-company-links/:id/audit` | Auditoria do vínculo (somente leitura) |

Permissões granulares: `customer.view`, `customer.create`, `customer.update`,
`customer.activate`, `customer.deactivate`, `customer.suspend`, `customer.block`,
`customer.unblock`, `customer.delete`, `customer.query_document`,
`customer.manage_company_link`, `customer.manage_classification`,
`customer.manage_payment_terms`, `customer.manage_credit`, `customer.manage_risk`,
`customer.manage_billing_rules`, `customer.manage_contracts`,
`customer.manage_recurring_rules`, `customer.manage_documents`,
`customer.manage_payment_promises`, `customer.view_financial_history`,
`customer.view_receivables`, `customer.view_collections`, `customer.view_audit`,
`customer.duplicate_link`, `customer.convert_prospect`,
`customer.view_credit_information`, `customer.update_credit_limit`,
`customer.authorize_over_credit_limit` e `customer.view_sensitive_contacts`. O limite de
crédito tem uma permissão **separada** da classificação geral (`update_credit_limit` ≠
`manage_credit`), e usuários sem `view_credit_information` recebem os campos de crédito
mascarados (`null`) do back-end; usuários sem `view_sensitive_contacts` recebem
telefone/e-mail dos contatos mascarados.

## Estrutura Financeira

Este é o módulo que alimenta praticamente todo o resto do sistema. A ideia central é
separar dimensões que os ERPs tradicionais costumam misturar, de modo que um mesmo
lançamento possa ser analisado por vários ângulos ao mesmo tempo. As dimensões são
**independentes**, não aninhadas: uma despesa pode ter categoria, centro de custo,
centro de resultado, projeto e unidade de negócio ao mesmo tempo.

```
Plano de contas ─┐
Categoria ───────┤
Centro de custo ─┼─→ um único lançamento, analisado por qualquer combinação
Centro de result.┤
Projeto ─────────┤
Unidade de neg. ─┤
Natureza / Tags ─┘
```

Rotas do front-end: `/cadastros/estrutura-financeira` (visão geral),
`/cadastros/estrutura-financeira/importar` (assistente em 7 etapas),
`/cadastros/estrutura-financeira/duplicar`, `/cadastros/estrutura-financeira/historico`,
`/cadastros/plano-de-contas`, `/cadastros/categorias`, `/cadastros/centros-de-custo`,
`/cadastros/centros-de-resultado`, `/cadastros/projetos`,
`/cadastros/unidades-de-negocio`, `/cadastros/naturezas-financeiras`,
`/cadastros/tags-financeiras`, `/cadastros/rateios` e
`/cadastros/regras-de-classificacao`.

Todas as árvores (plano de contas, categorias, centros de custo, centros de resultado e
unidades de negócio) têm **profundidade ilimitada**, podem ser expandidas/recolhidas,
movidas, duplicadas, importadas e exportadas — e qualquer movimentação grava
automaticamente uma **versão** da estrutura anterior, que pode ser restaurada depois. O
plano de contas tem ainda uma **visão em tabela** ao lado da visão em árvore.

Principais endpoints da API (todos documentados no Swagger):

| Rota | Descrição |
| --- | --- |
| `GET/POST /financial-account-plans` · `GET .../tree` | Plano de contas (lista e árvore aninhada) |
| `GET /financial-account-plans/next-code` | Prévia do próximo código, gerada pela mesma função que a criação usa |
| `PATCH/DELETE /financial-account-plans/:id` | Edição e exclusão lógica (bloqueada se houver filhas ou uso) |
| `POST /financial-account-plans/:id/move` \| `/duplicate` | Movimentação na árvore (versiona antes) e duplicação com subárvore |
| `GET/POST /financial-account-plan-versions` | Versões do plano, cada uma com seu próprio ciclo de vida |
| `POST /financial-account-plan-versions/:id/activate` \| `/archive` \| `/duplicate` | Ativação exclusiva, arquivamento e duplicação com as contas |
| `GET/POST /financial-categories` · `GET .../tree` · `POST .../:id/move` \| `/duplicate` | Categorias e subcategorias (mesma hierarquia) |
| `GET/POST /cost-centers` · `GET .../tree` · `POST .../:id/move` | Centros de custo |
| `GET/POST /result-centers` · `GET .../tree` · `POST .../:id/move` | Centros de resultado |
| `GET/POST/PATCH/DELETE /projects` | Projetos (valor realizado e margem ficam a cargo do módulo financeiro futuro) |
| `POST /projects/:id/pause` \| `/resume` \| `/complete` \| `/cancel` | Ciclo operacional do projeto, com transições validadas |
| `GET/POST /business-units` · `GET .../tree` | Unidades de negócio |
| `GET/POST/PATCH/DELETE /financial-natures` | Catálogo de naturezas financeiras |
| `GET/POST/PATCH/DELETE /financial-tags` · `POST .../link` \| `/unlink` | Tags e seus vínculos com qualquer cadastro da estrutura |
| `GET/POST/PATCH/DELETE /allocation-rules` | Rateios padrão (percentuais validados para fechar 100%) |
| `GET/POST/PATCH/DELETE /classification-rules` | Regras de classificação, com condições e ações próprias |
| `POST /classification-rules/test` · `GET .../conflicts` | Testa a regra contra um lançamento hipotético e detecta conflitos — **nada é persistido** |
| `GET /:id/usage` (todos os cadastros) | Vínculos do registro, com `inUse` e `canDelete` |
| `POST /:id/activate` \| `/deactivate` \| `/archive` (todos os cadastros) | Ciclo de vida — **nunca exclui nada** |
| `POST /financial-structure/imports` | Etapas 1-2: lê XLSX/CSV/JSON e sugere o mapeamento de colunas |
| `PATCH /financial-structure/imports/:id/mapping` | Etapa 3: confirma o mapeamento coluna → campo |
| `POST /financial-structure/imports/:id/validate` | Etapas 4-5: valida linha por linha |
| `POST /financial-structure/imports/:id/apply` | Etapas 6-7: aplica ou simula |
| `GET /financial-structure/imports/:id/rows` | Resultado por linha, com o registro que cada uma criou |
| `GET /financial-structure/export` | Exportação em CSV, JSON, XLSX ou PDF |
| `POST /financial-structure/duplicate` | Duplicação da estrutura entre empresas da mesma organização |
| `GET /financial-structure/diagnostics` | Diagnóstico de inconsistências (12 verificações) |
| `GET/POST /financial-structure/versions` · `POST .../:id/restore` | Versionamento e restauração das árvores |

Permissões granulares, em `snake_case`, por cadastro e por operação:
`account_plan.{view,create,update,move,activate,deactivate,delete,import,export,version}`,
`financial_category.*`, `cost_center.*`, `result_center.*`,
`project.{...,pause,complete,cancel,archive}`, `business_unit.*`, `financial_nature.*`,
`financial_tag.*`, `allocation_rule.*`, `classification_rule.{...,test}` e
`financial_structure.{view,manage,import,export,duplicate,manage_versions,view_audit}`.

Duas separações de permissão são deliberadas:

- **`move` ≠ `update`** — mover contas na árvore altera relatórios históricos.
- **`deactivate` ≠ `delete`** — inativar preserva o histórico; excluir só é permitido
  quando o registro não tem nenhum vínculo.

Toda permissão é validada contra a organização/empresa **do próprio registro**, nunca
contra o que veio no payload. O front-end filtra apenas para exibição.

### Ciclo de vida (`structure_status`)

Cada cadastro tem um `structure_status` (`DRAFT`, `ACTIVE`, `INACTIVE`, `ARCHIVED`)
separado do `status` operacional. Inativar e arquivar **apenas mudam o status**: o
`deleted_at` não é tocado, então lançamentos e histórico que referenciam o registro
continuam íntegros. Duas travas:

- inativar/arquivar é recusado quando existem filhos ativos, para não deixá-los órfãos
  dentro de uma subárvore inativa;
- ativar é recusado quando o registro superior está inativo, porque o pai filtra a
  subárvore inteira nas árvores e relatórios.

O projeto é o caso especial: guarda o andamento em `status` (`ProjectStatus`) e a
vigência em `record_status`, então o ciclo de vida nunca escreve no campo de andamento.

### Versionamento do plano de contas

As versões são uma tabela própria (`financial_account_plan_versions`) com ciclo próprio:
`DRAFT` → `IN_REVIEW` → `ACTIVE` → `SUPERSEDED` → `ARCHIVED`. Apenas **uma** versão fica
ativa por tipo de plano e empresa: ativar uma nova marca a anterior como `SUPERSEDED`
dentro da mesma transação. Versões ativas, substituídas e arquivadas não podem ser
editadas — elas são o registro histórico do que estava valendo.

### Codificação automática

Com `autoGenerateCode`, o back-end gera o próximo código a partir da conta superior
(`5.02` com filhas `5.02.001` e `5.02.002` produz `5.02.003`). Sem ele, o código
informado precisa começar pelo código do pai. O `normalized_code` (sem separadores nem
zeros à esquerda) garante que `5.02` e `05.2` sejam reconhecidos como o mesmo código.

### Rateios

Aceitam percentual, valor, quantidade, horas, peso ou critério personalizado. Rateios
percentuais são validados para fechar exatamente 100% (com tolerância de 0,01 para
arredondamento, de modo que 33,33 + 33,33 + 33,34 é aceito), destinos repetidos são
recusados e cada linha precisa apontar para o tipo de dimensão que declarou.

### Classificação automática

As regras têm condições e ações em tabelas próprias. As condições são combinadas com
**E** e uma regra sem nenhuma condição nunca casa — se casasse, ela se aplicaria a todo
lançamento. Quando duas regras de mesma prioridade aplicariam valores diferentes na
mesma dimensão, o conflito é detectado e a automação fica suspensa (`automationSuspended`)
até o desempate.

Nesta etapa as regras são apenas **cadastradas e testáveis**. Nenhum lançamento é
classificado automaticamente, porque os módulos de importação bancária e de contas a
pagar/receber ainda não existem. A estrutura de aprendizado (`matchCount`,
`confirmedCount`, `rejectedCount`, `confidenceThreshold`, `source: LEARNED`) já está no
schema, pronta para o motor de inteligência financeira futuro — sem nenhuma decisão
autônoma agora.

### Importação em 7 etapas

1. envio do arquivo (XLSX via `exceljs`, CSV/TSV ou JSON);
2. escolha do cadastro de destino;
3. mapeamento coluna → campo, com sugestão automática que o usuário confirma;
4. validação linha por linha;
5. revisão das inconsistências;
6. escolha do modo e simulação;
7. resultado.

Cada linha do arquivo é gravada em `financial_structure_import_rows` com o status de
validação e o registro que ela criou, então a origem de qualquer conta é rastreável.
Erro bloqueia a linha (código ou nome ausente, código repetido, registro superior
inexistente); código já cadastrado é apenas **aviso** — a decisão é do usuário.

Os modos são `INSERT_ONLY`, `UPDATE_ONLY`, `INSERT_AND_UPDATE` e `SIMULATE`. **Nenhum
modo exclui registros existentes**, e a atualização toca apenas em nome, nome curto e
observações: código e posição na árvore não são sobrescritos por importação. A árvore é
versionada antes de aplicar, então a importação inteira pode ser desfeita.

Os "modelos" de Conta Azul, Omie, SAP e TOTVS não são integrações — apenas mapeiam nomes
de coluna diferentes para o mesmo formato tabular.

### Duplicação entre empresas

Copia **apenas a estrutura** de uma empresa para outra da mesma organização. Nunca copia
lançamentos, saldos, movimentações, conciliações, orçamentos realizados, histórico de uso
ou a auditoria da origem. O que já existe no destino é preservado, jamais sobrescrito ou
excluído, e os padrões das categorias são remapeados para as cópias — o que não foi
copiado fica nulo em vez de apontar para outra empresa. A permissão é exigida nas **duas**
empresas.

### Diagnóstico de inconsistências

`GET /financial-structure/diagnostics` roda 12 verificações e devolve os achados com os
críticos primeiro: categoria sem conta vinculada, conta analítica com filhas, conta
sintética aceitando lançamentos, centro de custo sem responsável, centro com vigência
encerrada ainda ativo, projeto com prazo vencido em andamento, regra sem condição ou
sem ação, regras conflitantes, rateio que não fecha 100%, códigos equivalentes
duplicados, estrutura sem versão ativa e categoria inativa em uso. A rotina **apenas
relata**: nada é corrigido automaticamente, porque a correção depende de decisão do
usuário.


## Tesouraria e Cadastros Bancários

Onde o dinheiro entra e sai. Este módulo cadastra as **contas financeiras** (contas
bancárias, caixas, fundos fixos e carteiras digitais), os **cartões corporativos**, as
**chaves PIX da empresa** e as **formas de pagamento e recebimento**. Ele não movimenta
nada: toda movimentação futura — contas a pagar, contas a receber, conciliação, fluxo de
caixa — vai apontar para uma conta deste cadastro.

```
Conta financeira ─┬─ saldo de implantação (histórico, nunca sobrescrito)
                  ├─ limites bancários (cheque especial, capital de giro…)
                  ├─ chaves PIX da empresa
                  ├─ responsáveis, com 11 permissões por conta
                  └─ integrações bancárias (estrutura pronta, sem conexão real)

Cartão corporativo ─── portadores, limites individuais, ciclo de fatura
Forma de pagamento ─── o que o lançamento vai exigir (chave PIX, código de barras…)
Forma de recebimento ─ prazo de liquidação e taxas, para o valor líquido
Favorecidos ────────── visão de leitura sobre as contas já cadastradas nos fornecedores
```

Rotas do front-end: `/cadastros/tesouraria` (visão geral com pendências e alertas),
`/cadastros/tesouraria/parametros`, `/cadastros/tesouraria/historico`,
`/cadastros/contas-financeiras` (lista, `nova`, `[id]`, `[id]/editar`),
`/cadastros/cartoes` (lista, `novo`, `[id]`, `[id]/editar`), `/cadastros/chaves-pix`,
`/cadastros/formas-de-pagamento`, `/cadastros/formas-de-recebimento` e
`/cadastros/favorecidos-bancarios`.

A inclusão de conta usa um **wizard de 8 etapas** (identificação, dados bancários,
configuração financeira, saldos e limites, chaves PIX, responsáveis, integrações e
revisão), que pode ser salvo como rascunho em qualquer ponto. As etapas bancárias
desaparecem para caixa, fundo fixo e carteira digital — não faz sentido pedir agência
para um caixa. A tela de visualização traz seis abas espelhando o wizard.

Principais endpoints da API (todos no Swagger):

| Rota | Descrição |
| --- | --- |
| `GET /treasury/overview` | Consolidado: contagens, pendências e últimas alterações de situação |
| `GET/PATCH /treasury/settings` | Parâmetros de tesouraria da empresa (criados com os padrões na primeira consulta) |
| `GET /treasury/status-history` | Histórico paginado das mudanças de situação das contas |
| `GET /treasury/beneficiaries` | Favorecidos bancários — **lê** fornecedores, não duplica cadastro |
| `GET/POST /financial-accounts` · `PATCH/DELETE /:id` | Contas financeiras |
| `POST /financial-accounts/drafts` | Salva rascunho de conta incompleta |
| `GET /financial-accounts/:id/usage` \| `/activation-pendencies` \| `/audit` | Vínculos, o que falta para ativar e trilha de auditoria |
| `POST /financial-accounts/:id/activate` \| `/block` \| `/unblock` \| `/suspend` \| `/deactivate` \| `/close` | Ciclo de vida, com motivo obrigatório e transições validadas |
| `GET/POST /financial-accounts/:id/opening-balance` | Saldo de implantação — a correção **supera** o registro anterior em vez de sobrescrevê-lo |
| `GET/POST /financial-accounts/:id/limits` · `PATCH .../limits/:limitId` | Limites bancários |
| `GET/POST /financial-accounts/:id/users` · `PATCH`/`DELETE .../users/:userId` | Responsáveis e suas 11 permissões por conta |
| `GET/POST /financial-accounts/:id/integrations` | Integrações bancárias (a referência da credencial nunca é devolvida) |
| `POST .../integrations/:id/test` \| `/activate` \| `/disconnect` | Ciclo da integração |
| `GET/POST/PATCH/DELETE /company-pix-keys` · `POST .../:id/activate` \| `/deactivate` | Chaves PIX da empresa |
| `GET/POST /corporate-cards` · `PATCH/DELETE /:id` | Cartões corporativos |
| `GET /corporate-cards/alerts` | Vencendo, vencidos, sem responsável e com conta pagadora inativa |
| `POST /corporate-cards/:id/block` \| `/unblock` \| `/deactivate` | Ciclo de vida do cartão, com motivo |
| `GET/POST /corporate-cards/:id/users` | Portadores e limites individuais |
| `GET/POST/PATCH/DELETE /payment-methods` · `POST .../:id/activate` \| `/deactivate` | Formas de pagamento |
| `GET/POST/PATCH/DELETE /receipt-methods` · `POST .../:id/activate` \| `/deactivate` | Formas de recebimento |

Permissões granulares (49 no total):
`treasury.{view,manage,view_dashboard,manage_settings,view_sensitive_data,allow_third_party_account,approve_bank_data_change,export,view_audit}`,
`financial_account.{view,create,update,activate,block,unblock,suspend,deactivate,close,delete,view_balance,view_bank_data,manage_initial_balance,manage_limits,manage_users,manage_integration,manage_pix,view_audit}`,
`card.{view,create,update,block,unblock,deactivate,delete,manage_limits,manage_users,view_sensitive_data}`,
`payment_method.*` e `receipt_method.*`.

### O que o sistema nunca armazena

Decisões tomadas no **DTO**, não só na tela: o que não é aceito na entrada não pode ser
gravado por engano depois.

- **Cartões** — número completo, código de segurança e senha **não têm campo**. Só os
  quatro últimos dígitos, validados como exatamente quatro numerais, e exibidos como
  `**** **** **** 1234`.
- **Credenciais de integração** — `credentials_reference` é um **ponteiro** para o cofre
  (ex.: `vault://pulse/company/<id>/bb`), nunca a credencial. O back-end recusa valores
  que se pareçam com segredo (chave privada PEM, blob base64 longo, JSON com
  `client_secret`/`password`/`token`) e a rota de leitura devolve apenas
  `hasCredentials: true|false`.

### Mascaramento por permissão

O mascaramento acontece no **back-end**, antes de a resposta existir — o valor protegido
não trafega, não entra no cache do navegador e não aparece no DevTools. Sem
`financial_account.view_bank_data` a agência vira `****-1` e a conta `******-6`; a chave
PIX vira `gi*****@empresa.com`. Sem `financial_account.view_balance` todo campo monetário
da conta vira `••••••••`. Acessos a dados sensíveis são registrados na auditoria.

### Ciclo de vida da conta (`FinancialAccountStatus`)

`DRAFT` → `PENDING_VALIDATION` → `ACTIVE` → `BLOCKED`/`SUSPENDED`/`INACTIVE` → `CONCLUÍDO`
em `CLOSED`. As transições são explícitas: `CLOSED` é **terminal** (nenhuma transição
sai dele), ativar exige que as pendências estejam resolvidas, e toda mudança grava
motivo, autor e data em `financial_account_status_history`. Nada é excluído em cascata:
excluir uma conta só é possível quando ela não tem nenhum vínculo, e movimentos
financeiros **nunca** são apagados junto.

### Duplicidade e integridade

- A mesma conta bancária não entra duas vezes: a comparação usa um identificador
  normalizado (`instituição:agência:conta`, apenas dígitos), então `1234-5` e `12345`
  são reconhecidos como a mesma conta.
- Chaves PIX são normalizadas antes de gravar — telefone recebe DDI pelo **comprimento**
  do número, não pelo prefixo (`55` também é DDD do Rio Grande do Sul).
- Cartões duplicam-se por final + instituição + validade.
- Conta de terceiro exige justificativa e o parâmetro da empresa habilitado; a
  verificação compara os **documentos**, não confia no campo `isThirdParty` do payload.

### O que ainda não existe neste módulo

Contas a pagar e a receber, agendamento e envio de pagamentos ao banco, importação OFX,
conciliação bancária, emissão de boleto, cobrança PIX, gateway, Open Finance, baixa
financeira, fluxo de caixa e Inteligência Financeira. A estrutura está preparada para
todos eles — `financial_account_integrations`, `reconciliation_mode`, prazos de
liquidação e taxas já existem — mas nenhuma conexão real é feita nesta etapa. Os saldos
bancário, conciliado e disponível também não são calculados: só existe saldo de
implantação, e somá-lo como se fosse saldo atual seria enganoso.


## Entrada de Documentos

A porta de entrada do BPO. Todo documento financeiro — boleto, nota fiscal, conta de
consumo, guia, recibo, contrato, planilha — chega por aqui, é validado, lido,
classificado, conferido e só então **encaminhado** para o módulo de processamento.

O encaminhamento **não cria obrigação financeira**. Um documento encaminhado é um
documento pronto para virar um título; quem cria o título é a etapa seguinte.

```
Recebimento ─┬─ upload de arquivo          ┐
             ├─ lote                        │ implementados
             ├─ captura por câmera          │
             └─ digitação manual            ┘
                 e-mail, WhatsApp, API, pasta monitorada,
                 portal do fornecedor, integração contábil ┐ preparados,
                                                            ┘ declarados "não configurado"
        │
        ▼
Validação do arquivo ── conteúdo (não a extensão), MIME, tamanho, hash SHA-256,
                        páginas, PDF protegido/truncado, antivírus por provider
        │
        ▼
Fila de processamento (tabela no banco, SKIP LOCKED, retry com backoff, dead-letter)
        │
        ▼
Extração ── XML > texto nativo do PDF > código de barras > OCR (só em imagem/PDF sem texto)
        │
        ▼
Classificação ── tipo do documento e direção (a pagar / a receber)
        │
        ▼
Identificação ── empresa de destino, fornecedor, cliente
        │
        ▼
Duplicidade ── hash, linha digitável, chave de acesso, número, beneficiário+valor…
        │
        ▼
Validação dos dados ── pendências bloqueantes e de alerta
        │
        ▼
Revisão humana ──▶ Encaminhado / Rejeitado / Arquivado
```

Rotas do front-end: `/financeiro/entrada-documentos` (visão geral), `.../enviar`
(quatro canais em abas), `.../caixa-de-entrada`, `.../processamento`, `.../pendencias`,
`.../erros`, `.../processados`, `.../duplicidades`, `.../importacoes`, `.../historico`,
`.../parametros`, `.../[id]` (documento, com visualizador e seis abas) e
`.../[id]/revisar`.

### O arquivo nunca é servido pela aplicação

O bucket é **privado**. O back-end emite uma URL assinada válida por 5 minutos e
registra a emissão na auditoria — `VIEW_INTAKE_DOCUMENT` ou `DOWNLOAD_INTAKE_DOCUMENT`.
O front-end não guarda essa URL além do cache curto do React Query, e o download exige
`document_intake.download`, uma permissão separada da de visualizar.

O nome do arquivo é normalizado antes de virar caminho no storage (`../../etc/passwd`
vira `etc_passwd`), e a separação por organização e empresa faz parte do caminho.

### Nunca confiar na extensão informada

A extensão e o `Content-Type` que o cliente envia são declarações, não fatos. A
detecção é por **assinatura de bytes**, escrita à mão em
`utils/file-signature.util.ts` — a biblioteca `file-type` disponível é ESM-only e
quebraria os testes em CommonJS. O detector reconhece explicitamente o que precisa ser
**bloqueado**: executáveis MZ/ELF/Mach-O, shebang e ZIP simples. Arquivos compactados
seguem bloqueados até existirem regras específicas para eles.

### OCR não é fonte infalível

A ordem de leitura é obrigatória e nesta sequência: **texto nativo do PDF → XML direto →
código de barras sem OCR → OCR apenas em imagem ou PDF sem texto**. O método usado e a
confiança ficam gravados em cada campo extraído. Sem provedor de OCR configurado, o
sistema **declara** que não leu — gera uma pendência de documento ilegível em vez de
inventar texto.

O sistema não fica preso a um fornecedor: `DocumentExtractionProvider` e
`AntivirusProvider` são abstrações, e a implementação local não faz nenhuma chamada
externa.

### Boleto: ler, conferir, nunca pagar

O `BoletoValidationService` converte linha digitável ↔ código de barras, confere os
dígitos verificadores (módulo 10 por campo, módulo 11 geral), lê banco, moeda, valor e
vencimento, e **registra a regra aplicada** em cada validação. Ele não executa nem
autoriza pagamento — e as regras bancárias ficam no back-end, nunca em componentes da
tela.

O fator de vencimento tem quatro dígitos: estourou em 21/02/2025 e reiniciou em 1000.
Fatores entre 1000 e 1999 são genuinamente ambíguos, e o serviço devolve os candidatos
em vez de escolher um em silêncio.

### Duplicidade: confirmar exige justificativa

A comparação pesa vários sinais — hash do arquivo (100), linha digitável (98), código de
barras (97), chave de acesso (96), número do documento (70), beneficiário+valor (65),
valor+vencimento (45), semelhança de conteúdo (40), nome do arquivo (25). Acima de 75
pontos, **liberar** o documento exige justificativa e a permissão
`document_intake.override_duplicate`.

### Pendência bloqueante impede encaminhamento

Pendências de alerta apenas avisam; as bloqueantes travam o encaminhamento até serem
resolvidas. Documento rejeitado mantém o histórico e o arquivo, não segue para
processamento, pode ser reaberto por quem tem permissão e **nunca é excluído
automaticamente**.

### Mascaramento no back-end

Sem `document_intake.view_sensitive_data`, linha digitável, código de barras, chave PIX
e os CNPJ/CPF de emitente e destinatário chegam já mascarados: o valor completo não
entra na resposta, não trafega e não fica no cache do navegador. O texto extraído
inteiro também é omitido.

### O que ainda não existe neste módulo

Aprovação final de pagamentos, autorização e agendamento bancário, remessa, pagamento
automático, contas a pagar e a receber completas, conciliação, baixa automática, emissão
de boleto e de nota fiscal, inteligência artificial autônoma e integração bancária real.
Os canais de e-mail, WhatsApp, API, pasta monitorada, portal do fornecedor e integração
contábil estão modelados e aparecem na tela marcados como **não configurado** — declarar
o que não existe é mais honesto que omitir.


## Banco de dados e migrations

O schema fica em `backend/prisma/schema.prisma`. Tabelas principais:
`organizations`, `companies`, `company_addresses`, `company_contacts`, `company_cnaes`,
`company_registry_queries`, `company_status_history`, `suppliers`,
`supplier_company_links`, `supplier_addresses`, `supplier_contacts`, `supplier_cnaes`,
`supplier_alternative_names`, `supplier_bank_accounts`, `supplier_pix_keys`,
`supplier_bank_identifiers`, `supplier_classification_rules`,
`supplier_default_allocations`, `supplier_tax_withholdings`, `supplier_contracts`,
`supplier_registry_queries`, `supplier_status_history`, `supplier_recognition_learning`,
`customers`, `customer_company_links`, `customer_addresses`, `customer_contacts`,
`customer_cnaes`, `customer_bank_identifiers`, `customer_billing_rules`,
`customer_collection_history`, `payment_promises`, `customer_contracts`,
`customer_contract_amendments`, `customer_recurring_receivables`,
`customer_registry_queries`, `customer_status_history`, `financial_account_plans`,
`financial_account_plan_versions`, `financial_categories` (categorias **e** subcategorias,
na mesma hierarquia), `cost_centers`, `result_centers`, `projects`, `business_units`,
`financial_natures`, `financial_tags`, `financial_tag_links`, `classification_rules`,
`classification_rule_conditions`, `classification_rule_actions`, `allocation_rules`,
`allocation_rule_items`, `financial_hierarchy_versions`, `financial_hierarchy_history`,
`financial_structure_imports`, `financial_structure_import_rows`,
`financial_accounts`, `financial_account_opening_balances`,
`financial_account_limits`, `financial_account_users`,
`financial_account_integrations`, `financial_account_status_history`,
`company_pix_keys`, `corporate_cards`, `corporate_card_users`, `payment_methods`,
`receipt_methods`, `treasury_settings`,
`intake_documents`, `intake_document_files`, `intake_document_extracted_fields`,
`intake_document_processing_jobs`, `intake_document_issues`,
`intake_document_duplicate_matches`, `intake_document_relations`,
`intake_batch_imports`, `intake_batch_import_items`, `intake_document_assignments`,
`intake_document_status_history`, `document_intake_settings`,
`financial_institutions`, `attachments` (anexos genéricos), `users`, `roles`,
`permissions`, `role_permissions`, `user_organization_roles`, `user_company_roles` e
`audit_logs`.

> As migrations são sempre **incrementais**. A da tesouraria
> (`20260730120000_treasury_module`) e a da entrada de documentos
> (`20260730180000_document_intake_module`) só adicionam: nenhum `DROP`, nenhum
> `ALTER COLUMN`, nenhuma tabela renomeada, nenhuma rota existente alterada.

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
                 # validação de CPF/CNPJ, duplicidade de documento (empresas, fornecedores
                 # e clientes), pendências de ativação, bloqueio/permissão de exclusão de
                 # empresas, vínculo duplicado, conta/PIX de terceiro, mascaramento de
                 # dados bancários e de contatos sensíveis, soma de rateios (até 100%),
                 # bloqueio/motivo obrigatório do vínculo, mascaramento de crédito por
                 # permissão dedicada, conversão de prospect com validação de pendências,
                 # ciclos na árvore, rateio fechando 100%, parsing de importação CSV,
                 # versionamento e simulação de classificação automática, ciclo de vida
                 # (ativar/inativar/arquivar sem excluir nada), ativação exclusiva de
                 # versão do plano, geração automática de código, leitura de XLSX/CSV/JSON,
                 # importação em 7 etapas com simulação, exportação nos quatro formatos,
                 # duplicação entre empresas, diagnóstico de inconsistências,
                 # transições de situação da conta financeira (com CLOSED terminal),
                 # duplicidade por identificador normalizado, recusa de conta de
                 # terceiro sem justificativa, saldo de implantação superado em vez de
                 # sobrescrito, recusa de credencial bruta em credentials_reference,
                 # normalização de chave PIX (inclusive DDI por comprimento), exigências
                 # mínimas por tipo de forma de pagamento e isolamento das rotas da
                 # tesouraria, detecção de tipo de arquivo por assinatura de bytes
                 # (inclusive executáveis e ZIP bloqueados), path traversal no nome do
                 # arquivo, PDF protegido e truncado, dígitos verificadores de boleto
                 # (módulo 10 por campo e módulo 11 geral), reinício do fator de
                 # vencimento em 2025 e vencimentos ambíguos, conversão linha digitável ↔
                 # código de barras, leitura de XML fiscal (NF-e e NFS-e aninhada),
                 # extração de texto nativo de PDF, ordem de precedência dos métodos de
                 # leitura, classificação por palavras-chave, pontuação de duplicidade e
                 # exigência de justificativa acima de 75 pontos, mascaramento da linha
                 # digitável e da chave PIX por permissão, e isolamento das rotas da
                 # entrada de documentos
npm run test:e2e
```

### Testar manualmente a Entrada de Documentos

1. Suba backend e frontend, faça login e selecione a empresa "Tchê Grill".
2. Acesse **Financeiro → Entrada de documentos**. O seed cria 4 documentos fictícios:
   um boleto de energia aguardando revisão, uma NF-e de carnes pronta para
   processamento, uma conta de internet já encaminhada e o reenvio dessa conta em
   possível duplicidade.
3. Abra o boleto de energia. A linha digitável é **válida de verdade** — o seed a gera
   com os dígitos verificadores calculados. Na revisão, cole-a no campo "Conferir uma
   linha digitável" e clique em **Conferir**: o serviço devolve banco 001, R$ 2.450,00,
   vencimento 10/08/2026 e as regras aplicadas, sem executar pagamento nenhum.
4. Os documentos de demonstração não têm arquivo em storage. O visualizador avisa isso
   em vez de mostrar um arquivo inventado.
5. Envie um arquivo de verdade em **Enviar documento → Arquivo**. Renomeie um executável
   para `.pdf` antes: o envio é recusado pelo **conteúdo**, não pela extensão.
6. Envie o mesmo arquivo duas vezes. O segundo é marcado como duplicidade exata pelo
   hash SHA-256, e liberar exige justificativa.
7. Abra o reenvio da conta de internet (`Internet — julho/2026 (reenvio)`). Na aba
   **Duplicidades**, tente **Não é duplicidade**: como a semelhança é de 70 pontos, a
   justificativa é opcional; suba o caso acima de 75 e ela passa a ser exigida.
8. Com um usuário sem `document_intake.view_sensitive_data`, reabra o boleto: a linha
   digitável e a chave PIX chegam mascaradas do back-end — confira na aba de rede do
   navegador que o valor completo não trafega.
9. Com um usuário sem `document_intake.download`, o botão **Baixar** não aparece; chamar
   a rota direto devolve 403.
10. Tente encaminhar um documento com pendência bloqueante: o botão fica desabilitado e
    o motivo é exibido. Resolva a pendência e o encaminhamento passa a ser possível.
11. Rejeite um documento. Ele sai da fila, mantém histórico e arquivo, e continua
    acessível — nada é excluído.

### Testar manualmente a Tesouraria

1. Suba backend e frontend, faça login e selecione a empresa "Tchê Grill".
2. Acesse **Cadastros → Tesouraria**. A visão geral traz a contagem de contas, cartões,
   chaves e formas, o painel de pendências e as últimas mudanças de situação. O seed de
   demonstração já cria 3 contas, 1 cartão, 1 chave PIX e 5 formas de cada tipo.
3. **Incluir nova conta** → escolha "Caixa" no tipo e confirme que as etapas de dados
   bancários desaparecem. Volte para "Conta corrente" e elas reaparecem.
4. Preencha só o nome e clique em **Salvar rascunho**. A conta aparece na lista como
   `Rascunho`.
5. Abra a conta e tente **Ativar**: as pendências que faltam são listadas em vez de a
   ativação passar silenciosamente.
6. Tente cadastrar uma segunda conta com a mesma agência e conta da primeira, mudando a
   formatação (`1234-5` em vez de `12345`). O cadastro é recusado como duplicado.
7. Na aba **Saldos e limites**, lance o saldo de implantação. Lance outro em seguida: o
   primeiro fica como `Superado` — o histórico não é sobrescrito.
8. Na aba **Integrações**, tente colar uma credencial de verdade no campo de referência
   (um JSON com `client_secret`, por exemplo). O back-end recusa: o campo é ponteiro
   para o cofre, não lugar de segredo.
9. Em **Chaves PIX**, cadastre uma chave de telefone como `(51) 99999-8888` e confira que
   ela é gravada normalizada com DDI. Tente cadastrá-la de novo em outro formato: é
   recusada.
10. Em **Cartões corporativos**, repare que não existe campo para número completo, CVV ou
    senha. Cadastre com final `4587` e validade próxima; o cartão aparece no painel de
    alertas.
11. Em **Formas de pagamento**, crie uma forma do tipo PIX com "Exige favorecido"
    desmarcado. Salve e reabra: a exigência volta marcada — as exigências mínimas do tipo
    são aplicadas como piso pelo back-end (PIX exige favorecido, boleto exige linha
    digitável, transferência exige dados bancários, cartão exige conta financeira).
12. Em **Favorecidos bancários**, confirme que as contas vêm do fornecedor de
    demonstração e que a tela não oferece cadastro — para corrigir, edita-se o
    fornecedor.
13. Com um usuário sem `financial_account.view_bank_data`, reabra a conta: agência e
    conta aparecem mascaradas (`****-1`, `******-6`). Sem
    `financial_account.view_balance`, os valores aparecem como `••••••••`. Confirme na
    aba Network que o dado completo **não** está na resposta.
14. Bloqueie a conta informando o motivo e confira o registro em **Tesouraria →
    Histórico**, com situação anterior, nova, motivo e data.

### Testar manualmente a Estrutura Financeira

1. Suba backend e frontend, faça login e selecione a empresa "Tchê Grill".
2. Acesse **Cadastros → Estrutura financeira** — a visão geral traz a contagem de cada
   cadastro e o painel de diagnóstico. Se houver algum achado, confirme que os críticos
   aparecem primeiro e que nada foi corrigido sozinho.
3. Em **Plano de contas**, alterne entre as visões **Árvore** e **Tabela**. Na tabela,
   busque por um código de nível profundo e confirme que os grupos superiores continuam
   visíveis (sem eles a linha apareceria solta).
4. Clique no `+` de uma conta para criar uma conta filha deixando **Gerar o código
   automaticamente** marcado — o próximo código disponível aparece antes de salvar. O pai
   vira automaticamente **sintética** (deixa de aceitar lançamentos).
5. Desmarque a geração automática e tente informar um código que não comece pelo código
   do pai — a operação deve ser recusada.
6. Use "Mover na árvore" para reorganizar uma conta e tente movê-la para dentro de uma
   conta filha — deve ser recusada. Depois confira em **Estrutura financeira → Histórico**
   que a estrutura anterior foi versionada.
7. Use **Inativar** em uma conta que tenha filhas ativas — deve ser recusado. Inative
   primeiro as filhas e confirme, em `GET /financial-account-plans/:id/usage`, que os
   vínculos continuam contabilizados (nada foi excluído).
8. Em **Cadastros → Rateios**, crie um rateio de energia com 60% Restaurante e 40%
   Administrativo; tente salvar com 60% + 30% e confirme que o sistema recusa por não
   fechar 100%. Depois teste 33,33 + 33,33 + 33,34 e confirme que é aceito.
9. Em **Cadastros → Regras de classificação**, crie a regra "descrição contém COELBA →
   categoria Energia" e use **Testar** com a descrição `COELBA FATURA 09/2026`. Confirme
   que o resultado indica a regra aplicada e avisa que nada foi persistido. Crie uma
   segunda regra de mesma prioridade apontando para outra categoria e confirme que o
   conflito é detectado e a automação fica suspensa.
10. Em **Plano de contas → Exportar**, baixe o arquivo nos quatro formatos (XLSX, CSV,
    JSON e PDF).
11. Em **Estrutura financeira → Importar**, reenvie o XLSX exportado e percorra as 7
    etapas. Na etapa de mapeamento, confirme que as colunas foram reconhecidas. Antes de
    aplicar, use **Simular** e confira que o número de registros que seriam criados bate
    com o resultado real da aplicação. Depois tente aplicar o mesmo lote de novo — deve
    ser recusado.
12. Monte um arquivo com uma linha sem código, uma com código repetido e uma apontando
    para um pai inexistente. Confirme que as três aparecem na etapa de inconsistências
    com o motivo de cada uma, e que o restante do arquivo continua importável.
13. Em **Estrutura financeira → Duplicar**, copie a estrutura da "Tchê Grill" para outra
    empresa da mesma organização. Confirme no relatório que apenas a estrutura foi
    copiada e que o que já existia no destino foi preservado. Tente duplicar para uma
    empresa de outra organização — deve ser recusado.

### Testar manualmente o Cadastro de Clientes

1. Suba backend e frontend, faça login e selecione a empresa "Tchê Grill" no cabeçalho.
2. Acesse **Cadastros → Clientes** e clique em **+ Incluir novo cliente**. Percorra o
   wizard informando um CPF/CNPJ válido; o vínculo criado ficará com status **Prospect**.
3. Na tela do vínculo (`.../empresas/:companyLinkId`), tente **Converter em cliente** sem
   preencher categoria de receita/condição de recebimento/contato financeiro — a operação
   deve ser recusada informando a pendência. Complete os dados e converta com sucesso.
4. Teste o limite de crédito com um usuário sem `customer.view_credit_information` (deve
   aparecer mascarado) e depois com um usuário que tenha `customer.update_credit_limit`
   mas não `customer.manage_credit`, confirmando que a edição do limite continua liberada
   pela permissão dedicada.
5. Inclua um contrato e uma recorrência — confirme que nenhum lançamento financeiro real é
   criado (o texto informativo do wizard/tela explica que ficam pendentes do módulo de
   contas a receber).
6. Bloqueie o vínculo (exige motivo) e depois duplique-o para outra empresa, conferindo
   que o cadastro global (CPF/CNPJ, endereços, contatos) não é duplicado.

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

Módulo de **Processamento de Documentos**, que recebe o que a entrada encaminhou e o
transforma em obrigação financeira — contas a pagar e a receber. É ele que consome todos
os cadastros já entregues (fornecedores, clientes, dimensões da estrutura financeira,
contas, cartões e formas de pagamento/recebimento) e finalmente ativa o motor de
classificação automática, hoje apenas simulável. É também onde os saldos bancário,
conciliado e disponível deixam de ser apenas saldo de implantação e passam a ser
calculados.
