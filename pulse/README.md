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
  exceto contas bancárias, formas de pagamento e adquirentes estão navegáveis; os demais
  itens aparecem no menu como "Em breve".

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
│   │   ├── migrations/        Fundação + Empresas + Fornecedores + Clientes + Estrutura Financeira (incremental)
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
lançamento possa ser analisado por vários ângulos ao mesmo tempo:

```
Plano de contas → Categoria → Subcategoria → Centro de custo → Centro de resultado
                → Projeto → Unidade de negócio → Natureza financeira → Tags
```

Rotas do front-end: `/cadastros/plano-de-contas`, `/cadastros/categorias`,
`/cadastros/centros-de-custo`, `/cadastros/centros-de-resultado`, `/cadastros/projetos`,
`/cadastros/unidades-de-negocio`, `/cadastros/naturezas-financeiras`,
`/cadastros/tags-financeiras`, `/cadastros/rateios` e
`/cadastros/regras-de-classificacao`.

Todas as árvores (plano de contas, categorias, centros de custo, centros de resultado e
unidades de negócio) têm **profundidade ilimitada**, podem ser expandidas/recolhidas,
movidas, duplicadas, importadas e exportadas — e qualquer movimentação grava
automaticamente uma **versão** da estrutura anterior, que pode ser restaurada depois.

Principais endpoints da API (todos documentados no Swagger):

| Rota | Descrição |
| --- | --- |
| `GET/POST /account-plans` · `GET /account-plans/tree` | Plano de contas (lista e árvore aninhada) |
| `PATCH/DELETE /account-plans/:id` | Edição e exclusão lógica (bloqueada se houver filhas ou uso) |
| `POST /account-plans/:id/move` \| `/duplicate` | Movimentação na árvore (versiona antes) e duplicação com subárvore |
| `GET/POST /categories` · `GET /categories/tree` · `POST /categories/:id/move` \| `/duplicate` | Categorias e subcategorias (mesma hierarquia) |
| `GET/POST /cost-centers` · `GET /cost-centers/tree` · `POST /cost-centers/:id/move` | Centros de custo |
| `GET/POST /result-centers` · `GET /result-centers/tree` · `POST /result-centers/:id/move` | Centros de resultado |
| `GET/POST/PATCH/DELETE /projects` | Projetos (valor realizado e margem ficam a cargo do módulo financeiro futuro) |
| `GET/POST /business-units` · `GET /business-units/tree` | Unidades de negócio |
| `GET/POST/PATCH/DELETE /financial-natures` | Catálogo de naturezas financeiras |
| `GET/POST/PATCH/DELETE /financial-tags` · `POST /financial-tags/link` \| `/unlink` · `GET /financial-tags/:id/entities` | Tags e seus vínculos com qualquer cadastro da estrutura |
| `GET/POST/PATCH/DELETE /allocation-rules` | Rateios padrão (percentuais validados para fechar 100%) |
| `GET/POST/PATCH/DELETE /classification-rules` | Regras de classificação automática |
| `POST /classification-rules/simulate` | Simula a classificação de um lançamento hipotético — **nada é persistido** |
| `POST /financial-structure/imports` · `POST /financial-structure/imports/:id/apply` | Importação em duas etapas: valida e pré-visualiza, depois aplica |
| `GET /financial-structure/export` | Exportação em CSV ou JSON |
| `GET/POST /financial-structure/versions` · `POST /financial-structure/versions/:id/restore` | Versionamento e restauração das árvores |

Permissões granulares (todas por cadastro e por tipo de operação):
`account-plan.{view,manage,manage_tree,delete}`,
`categories.{view,manage,manage_tree,manage_rules,delete}`,
`cost-centers.{view,manage,manage_tree,delete}`,
`result-centers.{view,manage,manage_tree,delete}`,
`projects.{view,manage,delete}`, `business-units.{view,manage,delete}`,
`financial-natures.{view,manage,delete}`, `financial-tags.{view,manage,delete}`,
`allocation-rules.{view,manage,delete}`, `classification-rules.{view,manage,delete}` e
`financial-structure.{import,export,duplicate,manage_versions,view_audit}`.
A reorganização da árvore é uma permissão **separada** da edição do cadastro
(`manage_tree` ≠ `manage`), porque mover contas altera relatórios históricos.

**Rateios**: aceitam percentual, valor, quantidade, horas, peso ou critério
personalizado. Rateios percentuais são validados para fechar exatamente 100% (com
tolerância de 0,01% para arredondamento), destinos repetidos são recusados e cada linha
precisa apontar para o tipo de dimensão que declarou.

**Classificação automática**: nesta etapa as regras são apenas **cadastradas e
simuláveis**. Nenhum lançamento é classificado automaticamente, porque os módulos de
importação bancária e de contas a pagar/receber ainda não existem. A estrutura de
aprendizado (`matchCount`, `confirmedCount`, `rejectedCount`, `confidenceThreshold`,
`source: LEARNED`) já está no schema, pronta para o motor de inteligência financeira
futuro.

**Importação**: aceita CSV/TSV com separador `,`, `;` ou tabulação, e reconhece
cabeçalhos em português e inglês. Os "modelos" de Conta Azul, Omie, SAP e TOTVS não são
integrações — apenas mapeiam nomes de coluna diferentes para o mesmo formato tabular. A
importação é sempre feita em duas etapas (validar/pré-visualizar e depois aplicar) e
versiona a árvore antes de aplicar.

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
`categories` (categorias **e** subcategorias, na mesma hierarquia), `cost_centers`,
`result_centers`, `projects`, `business_units`, `financial_natures`, `financial_tags`,
`financial_tag_links`, `classification_rules`, `allocation_rules`,
`allocation_rule_lines`, `financial_hierarchy_versions`, `financial_structure_imports`,
`financial_institutions`, `attachments` (anexos genéricos), `users`, `roles`,
`permissions`, `role_permissions`, `user_organization_roles`, `user_company_roles` e
`audit_logs`.

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
                 # versionamento e simulação de classificação automática
npm run test:e2e
```

### Testar manualmente a Estrutura Financeira

1. Suba backend e frontend, faça login e selecione a empresa "Tchê Grill".
2. Acesse **Cadastros → Plano de contas** — o seed já traz os grupos 1 Ativo, 2 Passivo,
   3 Receitas, 4 Custos e 5 Despesas. Clique no `+` de uma conta para criar uma conta
   filha e observe que o pai vira automaticamente **sintética** (deixa de aceitar
   lançamentos).
3. Use "Mover na árvore" para reorganizar uma conta e tente movê-la para dentro de uma
   conta filha — a operação deve ser recusada. Depois confira em
   `GET /financial-structure/versions` que a estrutura anterior foi versionada.
4. Em **Cadastros → Rateios**, crie um rateio de energia com 60% Restaurante e 40%
   Administrativo; tente salvar com 60% + 30% e confirme que o sistema recusa por não
   fechar 100%.
5. Em **Cadastros → Regras de classificação**, crie a regra "descrição contém COELBA →
   categoria Energia" e use o botão **Simular** com a descrição `COELBA FATURA 09/2026`.
   Confirme que a simulação indica a regra aplicada e avisa que nada foi persistido.
6. Em qualquer árvore, use **Exportar** para baixar o CSV e depois reenvie o mesmo
   arquivo em `POST /financial-structure/imports` para ver a validação em duas etapas.

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

Módulo **Financeiro (Contas a Pagar e Contas a Receber)**, que passa a consumir todos os
cadastros já entregues — fornecedores, clientes e as dimensões da estrutura financeira —
e finalmente ativa o motor de classificação automática, hoje apenas simulável.
