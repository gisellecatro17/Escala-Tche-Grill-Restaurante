# Arquitetura — Pulse

## Visão geral

```
pulse/
├── frontend/   Next.js 16 (App Router) + TypeScript + Tailwind v4 + shadcn-style UI
├── backend/    NestJS 11 + TypeScript + Prisma 7 + PostgreSQL
├── docs/       Documentação técnica
├── docker-compose.yml   PostgreSQL local para desenvolvimento
├── .env.example
└── README.md
```

## Multiempresa (organização → empresa → usuário)

- `Organization`: cliente/grupo contratante do Pulse (tenant).
- `Company`: um CNPJ/unidade dentro de uma organização.
- `User`: perfil espelhado do usuário autenticado no Supabase Auth (`users.id` = `auth.users.id`).
- `UserOrganizationRole`: vínculo do usuário a uma organização com um perfil — dá acesso
  automático a todas as empresas dessa organização (ex.: Administrador da organização).
- `UserCompanyRole`: vínculo do usuário a uma empresa específica com um perfil próprio.
  Tem precedência sobre o acesso derivado da organização, permitindo que o mesmo usuário
  tenha perfis diferentes em empresas diferentes (requisito do prompt mestre, seção 5).

O isolamento multiempresa é aplicado no back-end: toda rota que manipula dados
operacionais exige o header `X-Company-Id`, resolvido e validado contra os vínculos
do usuário autenticado (`SupabaseAuthGuard` + `PermissionsGuard`). O front-end nunca é a
única barreira de segurança.

### Autorização por organização vs. por empresa (módulo Cadastro de Empresas)

O módulo de Empresas introduziu um caso que a fundação ainda não cobria: autorizar uma
ação (criar a primeira empresa) **antes de existir uma empresa** para servir de escopo.
Como `RequestUser.memberships` (por empresa) só existe depois que a empresa já foi
criada, `RequestUser` passou a expor também `organizationMemberships` — o vínculo direto
por organização, populado a partir de `UserOrganizationRole` independentemente de a
organização já ter empresas. `common/utils/access-control.util.ts` expõe
`assertOrganizationPermission` (usa `organizationMemberships`) e `assertCompanyPermission`
(usa `memberships`), reaproveitados pelos controllers de Companies, Users e (na correção
do mesmo gap) Organizations.

### Provedores externos desacoplados (CNPJ e CEP)

`CompanyRegistryProvider` (`integrations/company-registry`) e `PostalCodeProvider`
(`integrations/postal-code`) são interfaces com implementação simulada (`mock`, padrão em
desenvolvimento) e uma implementação real opcional (`brasilapi`/`viacep`), selecionadas via
variável de ambiente e injetadas por token (`COMPANY_REGISTRY_PROVIDER`,
`POSTAL_CODE_PROVIDER`). Nenhuma dessas integrações faz raspagem de páginas — usam APIs
públicas documentadas — e o front-end nunca chama esses serviços diretamente nem recebe
chaves de API.

### Status interno vs. situação cadastral

`Company.systemStatus` (`DRAFT` → `IMPLEMENTATION` → `ACTIVE` / `SUSPENDED` / `INACTIVE` /
`CLOSED`) é o ciclo de vida controlado pelo Pulse. `Company.externalRegistrationStatus` é a
situação informada pela Receita Federal (ex.: "ATIVA"), armazenada separadamente e nunca
usada para liberar ou bloquear operações no sistema. `POST /companies` cria com
`IMPLEMENTATION`; `PATCH /companies/:id` promove `DRAFT → IMPLEMENTATION` automaticamente
(uma edição "de verdade" deixa de ser rascunho); apenas `POST /companies/:id/activate`
(que valida as pendências da seção 31 do prompt mestre) leva a `ACTIVE`.

### Cadastro global vs. vínculo por empresa (módulo Cadastro de Fornecedores)

O módulo de Fornecedores introduz uma segunda camada de modelagem: `Supplier` (identidade
fiscal/cadastral, único por CPF/CNPJ em toda a plataforma — nunca duplicado) e
`SupplierCompanyLink` (configuração específica de cada empresa que utiliza aquele
fornecedor: categoria/centro de custo padrão, condições comerciais, retenções, rateios,
regras de automação e contratos, com `supplier_id + company_id` único). Isso permite que o
mesmo fornecedor global tenha categorias, centros de custo e regras completamente
diferentes em cada empresa da organização, sem duplicar CPF/CNPJ, endereços, contas
bancárias ou chaves PIX — que pertencem ao cadastro global. `SuppliersService` cuida do
cadastro global (e dos recursos que pertencem a ele: endereços, contatos, contas
bancárias, PIX, documentos); `SupplierCompanyLinksService` cuida exclusivamente do vínculo
e de tudo que é específico da empresa (classificação, regras, rateios, retenções,
contratos, histórico de status do vínculo).

### Categorias e centros de custo mínimos (`taxonomy`)

O prompt de fornecedores exige que o usuário defina categoria/subcategoria e centro de
custo padrão do vínculo, com cadastro rápido (sem sair do formulário), mas o módulo
completo de categorias/centros de custo ainda não foi construído. `modules/taxonomy`
implementa apenas a estrutura mínima reutilizável (`Category`, com auto-relacionamento
para subcategorias, e `CostCenter`, ambos escopados por empresa) — reaproveitada pelo
front-end via um componente de seleção com "+ incluir novo(a)" embutido
(`components/suppliers/category-select.tsx` e `cost-center-select.tsx`). O módulo completo
(hierarquias mais ricas, orçamento, relatórios) fica para uma etapa futura; os nomes das
tabelas foram escolhidos para que o módulo completo, quando existir, possa estender este
schema em vez de substituí-lo.

### Proteção de dados bancários

Contas bancárias e chaves PIX de fornecedores são tratadas como dados restritos (seção 79
do prompt de fornecedores). Sem a permissão `supplier.view_bank_data`, o back-end nunca
retorna os valores completos — `SuppliersService.findOne` aplica
`common/utils/mask.util.ts` (`maskAccountFragment`, `maskPixKeyValue`) antes de responder,
de forma que o mascaramento não dependa do front-end lembrar de escondê-los.

### Titularidade de terceiro em contas bancárias/PIX

Ao incluir uma conta bancária ou chave PIX cujo titular (CPF/CNPJ) não corresponde ao
fornecedor, o cadastro não é bloqueado — mas exige que o usuário confirme explicitamente
(`isThirdParty: true`) com uma justificativa, e a permissão adicional
`supplier.allow_third_party_bank_account`. A estrutura de aprovação em duas etapas
(`bank_data_change_status`: `PENDING`/`APPROVED`/`REJECTED`/`NOT_REQUIRED`) já existe no
schema para quando o fluxo completo de dupla aprovação for construído; por ora, alterações
em dados bancários marcam `changeStatus: PENDING` mas não bloqueiam o uso imediato.

### Cadastro global vs. vínculo por empresa (módulo Cadastro de Clientes)

Mesmo padrão do Cadastro de Fornecedores, aplicado a `Customer`/`CustomerCompanyLink`
(`customer_id + company_id` único). A diferença de domínio é o ciclo de vida do vínculo:
`CustomerLinkStatus` inclui `PROSPECT` como status **inicial padrão** (em vez de `ACTIVE`,
como em Fornecedores), porque um cliente em prospecção e um cliente ativo são o mesmo
cadastro — a promoção `PROSPECT → ACTIVE` é feita por `CustomerCompanyLinksService.
convertProspect()`, uma transição de status (nunca um novo registro), que valida
pendências mínimas (categoria de receita padrão, uma condição de recebimento, um contato
com `isFinancialContact: true` e dados cadastrais completos) antes de promover.
`CustomerFinancialStatus` é um eixo de status **separado** de `CustomerLinkStatus` —
"vínculo Ativo" e "situação financeira Em atraso" podem coexistir, refletindo o
comportamento de pagamento do cliente independentemente do estágio comercial do vínculo.

### Reaproveitamento de Categoria/Centro de Custo para "categoria de receita" e "centro de resultado"

O prompt de Clientes pede uma categoria de receita e um centro de resultado padrão por
vínculo — conceitualmente equivalentes à categoria/centro de custo já modelados em
`modules/taxonomy` para Fornecedores. Em vez de criar tabelas paralelas
(`RevenueCategory`/`ResultCenter`), `Category` e `CostCenter` foram estendidos com novos
relacionamentos nomeados (`CustomerLinkDefaultRevenueCategory`,
`CustomerLinkDefaultRevenueSubcategory`, `CustomerLinkDefaultResultCenter`, e os
equivalentes em `CustomerContract`) — a mesma tabela, os mesmos endpoints
(`GET/POST /categories` e `/cost-centers`) e o mesmo componente de seleção rápida
(`components/suppliers/category-select.tsx`/`cost-center-select.tsx`, reaproveitados sem
alteração pelo wizard de Clientes) atendem os dois módulos. Isso segue a regra do prompt
mestre de não recriar estruturas já existentes sem necessidade (seção 7); o módulo
completo de categorias/centros de custo, quando existir, estende este schema para ambos os
domínios ao mesmo tempo.

### Limite de crédito: permissão dedicada e mascaramento

O limite de crédito e os campos de risco/estimativas de faturamento (`creditLimit`,
`riskLevel`, `allowOverCreditLimit`, `requiresOverLimitApproval`,
`automaticBlockEnabled`, `automaticBlockDays`) foram deliberadamente extraídos de
`CreateCompanyLinkDto`/`UpdateCompanyLinkDto` para um `UpdateCreditDto` próprio, exposto
apenas em `PATCH /customer-company-links/:id/credit` e protegido pela permissão
**dedicada** `customer.update_credit_limit` — distinta de `customer.manage_credit`, que
cobre apenas leitura/edição das demais regras comerciais do vínculo. Sem a permissão
`customer.view_credit_information`, `CustomerCompanyLinksService.getLink()` retorna esses
campos como `null` (mascarados) em vez de omitir a resposta inteira, para que o restante
do vínculo continue visível. O mesmo serviço mascara telefone/e-mail dos contatos
(`CustomerContact`) para usuários sem `customer.view_sensitive_contacts`.

### Contratos e recorrências "preparados", não "ativos"

Contratos (`CustomerContract`) e recorrências (`CustomerRecurringReceivable`) já podem ser
cadastrados nesta etapa, mas `CustomerRecurringReceivable.processingStatus` nasce e
permanece em `PENDING_FINANCIAL_MODULE` — nenhum lançamento de conta a receber é criado,
pois o módulo de contas a receber ainda não existe. O mesmo vale para
`CustomerBillingRule`/`CustomerCollectionHistory`: registram a configuração e o histórico
manual de cobrança, mas nenhuma mensagem real é enviada (sem integração de e-mail/WhatsApp
nesta etapa). `preferredCompanyBankAccountId`/`companyBankAccountId` e
`CustomerBankIdentifier` seguem o mesmo padrão de "FK de espera" já usado em Fornecedores:
colunas `String @db.Uuid` sem relação Prisma, para reconhecimento bancário futuro (OFX) sem
bloquear o cadastro atual.

## Estrutura Financeira

### Dimensões separadas, não aninhadas

O ponto central do módulo é que **plano de contas, categoria, centro de custo, centro de
resultado, projeto, unidade de negócio, natureza e tags são dimensões independentes** —
não níveis de uma mesma hierarquia. Um lançamento futuro carregará todas simultaneamente,
o que permite responder "quanto gastamos com energia" (categoria), "onde gastamos"
(centro de custo), "de onde veio a receita" (centro de resultado) e "quanto custou o
projeto X" sem precisar de estruturas paralelas. Cada dimensão tem sua própria tabela,
sua própria árvore e suas próprias permissões.

### Três decisões de reaproveitamento (regra 7 do prompt: não recriar o que já existe)

O prompt lista `financial_categories` e `financial_subcategories` entre as tabelas a
criar. Três estruturas equivalentes já existiam e estavam em uso pelos módulos entregues,
então foram **estendidas em vez de recriadas** — recriá-las exigiria migrations
destrutivas (proibidas pela regra 8) e órfãos das FKs de Fornecedores e Clientes:

1. **`categories` continua sendo a tabela de categorias financeiras**, agora com código,
   cor, ícone, nível, caminho materializado, vínculo com plano de contas/natureza e todas
   as dimensões e regras automáticas padrão. Renomeá-la para `financial_categories`
   quebraria as FKs vivas de `supplier_company_links.default_category_id` e
   `customer_company_links.default_revenue_category_id`.
2. **Subcategorias continuam sendo a própria hierarquia de `categories`**
   (`parent_category_id`, profundidade ilimitada), e não uma tabela
   `financial_subcategories` separada. Os dois módulos já entregues apontam
   `default_subcategory_id` para `categories.id`; uma tabela paralela duplicaria o
   conceito e deixaria essas FKs sem destino.
3. **`cost_centers` já existia com exatamente o nome pedido** e ganhou hierarquia,
   código, cor, ícone e controle de conta analítica/sintética.

Os demais cadastros são tabelas novas, com os nomes exatos do prompt:
`financial_account_plans`, `result_centers`, `projects`, `business_units`,
`financial_natures`, `financial_tags`, `financial_tag_links`, `classification_rules`,
`allocation_rules` (+ `allocation_rule_lines`) e `financial_hierarchy_versions`.

Uma quarta colisão foi de **nome de model, não de tabela**: o enum `FinancialNature`
(entregue no módulo de Fornecedores e ainda usado por `SupplierCompanyLink`) já ocupava
esse identificador no Prisma. O novo catálogo virou o model `FinancialNatureCatalog`
mapeado para a tabela `financial_natures` — o nome exigido pelo prompt é preservado no
banco, e nada do módulo anterior precisou ser tocado.

### Centro de resultado: estrutura nova, migração pendente

O Cadastro de Clientes (etapa anterior) apontava seu "centro de resultado" para
`cost_centers`, por ainda não existir estrutura própria. Este módulo cria `result_centers`
como a estrutura definitiva e separada exigida pelo prompt, mas
`customer_company_links.default_result_center_id` **continua apontando para
`cost_centers`** — trocar a FK exige migração de dados e é uma alteração de comportamento
para registros já criados. A troca está documentada como pendência e deve acontecer junto
com o módulo de Contas a Receber, que é quem efetivamente consome esse campo.

### Árvores: caminho materializado e detecção de ciclo

Todas as cinco árvores usam a mesma abordagem: além de `parentId`, cada nó guarda `level`
(profundidade) e `path` (caminho materializado, ex.: `"Ativo > Ativo Circulante >
Caixa"`), recalculados por `recalculateSubtree` sempre que o nó é renomeado ou movido.
Isso torna listagens e buscas hierárquicas baratas sem exigir CTE recursiva.
`common`/`utils/tree.util.ts` concentra a lógica pura — `buildTree` (aninhamento),
`assertNoCycle` (impede mover um nó para dentro de si mesmo ou de um descendente),
`computeLevelAndPath` e `collectSubtreeIds` — e é coberto por testes unitários próprios.
`buildTree` promove a raiz qualquer nó cujo pai foi filtrado (por exemplo, um pai
inativo), para que nenhum registro desapareça silenciosamente da tela.

### Contas sintéticas x analíticas

Uma conta do plano de contas só aceita lançamentos se for **analítica** (folha). O
serviço força `acceptsEntries: false` sempre que a conta é sintética, ignorando o que
vier no payload, e converte automaticamente um pai em sintético quando ele ganha a
primeira conta filha. A mesma regra vale para centros de custo e de resultado.

### Versionamento das árvores

Toda alteração estrutural (mover um nó, aplicar uma importação, restaurar uma versão)
grava antes um snapshot em `financial_hierarchy_versions` — a estrutura completa
serializada em JSON, com número de versão sequencial por organização/empresa/entidade. A
restauração reaplica pai, ordem, nível e caminho de cada item que ainda existe e
**preserva registros criados depois do snapshot** (nada é excluído); itens já removidos
são ignorados silenciosamente (`P2025`). Antes de restaurar, o estado atual também é
versionado, de modo que a operação sempre pode ser desfeita.

### Rateios

`AllocationRule` (cabeçalho) + `AllocationRuleLine` (linhas) suportam seis critérios.
Para `PERCENTAGE`, a soma das linhas precisa fechar 100% com tolerância de 0,01% — o
suficiente para aceitar 33,33 + 33,33 + 33,34 sem aceitar erros reais. Para
`QUANTITY`/`HOURS`/`WEIGHT`/`CUSTOM`, as linhas guardam pesos brutos e o percentual é
derivado da soma no momento do uso. Cada linha declara `targetType` e precisa preencher a
coluna correspondente, validado no serviço com mensagem em português nomeando a dimensão
que faltou.

### Classificação automática: preparada, não ativa

`ClassificationRule` armazena a condição (campo, comparação, valor, faixa de valores,
origem) e as dimensões a aplicar. Nesta etapa o módulo **não classifica nada
automaticamente** — os módulos de importação bancária e de contas a pagar/receber ainda
não existem. O que existe é `POST /classification-rules/simulate`, que roda o motor de
comparação real sobre um lançamento hipotético e devolve qual regra venceria (menor
`priority`), quais outras casaram e o aviso explícito `persisted: false`. Os contadores de
aprendizado (`matchCount`, `confirmedCount`, `rejectedCount`) e o campo
`source: LEARNED` já existem para o motor de inteligência financeira futuro. Uma expressão
regular inválida gravada no passado nunca derruba a simulação: `safeRegexTest` a trata
como "não casou".

### Importação em duas etapas

`POST /financial-structure/imports` apenas **valida** o arquivo e grava a pré-visualização
com os erros por linha; `POST /financial-structure/imports/:id/apply` é que efetivamente
cria os registros, versionando a árvore antes. As linhas são ordenadas por profundidade do
código (`1` antes de `1.1`) para que o pai exista quando o filho for criado. Os "modelos"
de Conta Azul, Omie, SAP e TOTVS não são integrações com esses ERPs — são apenas mapas de
sinônimos de cabeçalho (`codigo`/`code`/`conta`, `nome`/`descricao`/`name`, ...) para o
mesmo formato tabular interno.

### Permissão separada para alterar a árvore

Editar o cadastro de uma conta (`account-plan.manage`) e reorganizar a árvore
(`account-plan.manage_tree`) são permissões distintas, e o mesmo vale para categorias,
centros de custo e centros de resultado. O motivo é prático: renomear uma conta é
reversível e local, mas mover uma conta muda a composição de todos os relatórios
históricos que a agregam.

## Tesouraria

### Uma tabela para conta bancária, caixa e carteira

`financial_accounts` guarda conta corrente, conta de pagamento, conta digital, caixa,
fundo fixo e carteira digital no mesmo lugar, diferenciados por `account_type`. A
alternativa — uma tabela por tipo — obrigaria todo módulo financeiro futuro a consultar
cinco tabelas para responder "de onde saiu esse dinheiro?", e cada nova forma de guardar
dinheiro exigiria uma migration nova. O custo é que campos bancários (agência, conta,
instituição) são opcionais e validados conforme o tipo, em `utils/account-identity.util.ts`
(`isBankAccount`); o front-end esconde as etapas correspondentes do wizard pelo mesmo
critério.

### Segurança decidida no DTO, não na tela

Duas categorias de dado simplesmente não têm campo de entrada:

- **Número completo do cartão, CVV e senha** — `CreateCorporateCardDto` só aceita
  `lastFourDigits`, validado como exatamente quatro numerais. O que não é aceito na
  entrada não pode ser gravado por engano em uma refatoração futura, nem vazar por um
  `PATCH` esquecido.
- **Credencial de integração bancária** — `credentials_reference` é um ponteiro para o
  cofre (`vault://…`). O service recusa valores que se pareçam com segredo (bloco PEM de
  chave privada, blob base64 longo, JSON contendo `client_secret`/`password`/`token`), e
  `findIntegrations` remove o campo da resposta, devolvendo apenas
  `hasCredentials: boolean`. Uma referência não é secreta, mas também não precisa
  trafegar.

### Mascaramento no back-end, reaproveitando o de fornecedores

`utils/treasury-mask.util.ts` usa as mesmas funções que o módulo de fornecedores
(`maskAccountFragment`, `maskPixKeyValue`) e acrescenta `maskBalances`, que troca todo
campo monetário da conta pelo marcador `••••••••`. O mascaramento acontece antes de a
resposta ser montada, então o valor protegido não existe no JSON, no tráfego nem no cache
do navegador. O front-end reconhece o marcador e o exibe como está, em vez de tentar
formatá-lo como número.

### Saldo de implantação: correção que preserva o anterior

Corrigir o saldo inicial não sobrescreve o registro: o anterior passa a
`SUPERSEDED` e um novo é criado. Saldo de implantação é a base de toda conferência futura
com o extrato — se alguém o corrigir, a pergunta "qual era o valor antes, e quem mudou?"
tem de ter resposta. É o mesmo motivo de `financial_account_status_history` guardar
motivo, autor e data de cada mudança de situação.

### `CLOSED` é terminal

A tabela de transições em `financial-accounts.service.ts` (`STATUS_TRANSITIONS`) mapeia
`CLOSED → []`. Uma conta encerrada no banco não volta a existir porque alguém clicou em
"ativar"; se a empresa reabrir a conta, isso é uma conta nova, com nova data de abertura
e novo saldo de implantação. Reaproveitar o registro antigo misturaria dois períodos
distintos no mesmo histórico.

### Duplicidade por identificador normalizado

`1234-5` e `12345` são a mesma conta. A comparação usa
`normalized_account_identifier` (`instituição:agência:conta`, apenas dígitos) em vez dos
campos formatados, e o mesmo vale para `normalized_key` das chaves PIX. Comparar o texto
digitado deixaria a mesma conta entrar duas vezes só por diferença de pontuação — e duas
versões da mesma conta é exatamente o problema que o cadastro existe para evitar.

### DDI da chave PIX decidido pelo comprimento, não pelo prefixo

`utils/pix-key.util.ts` acrescenta o DDI `55` a telefones considerando o **tamanho** do
número (10 ou 11 dígitos = nacional; 12 ou 13 = já tem DDI). Decidir pelo prefixo
quebraria: `55` também é DDD válido (Rio Grande do Sul), então `55999998888` é "DDD 55 +
celular", não um número já internacionalizado.

### Conta de terceiro: comparar documentos, não confiar na flag

`assertThirdPartyAllowed` não aceita `isThirdParty: false` como prova de que a conta é da
própria empresa: compara o documento do titular com o da empresa. Um payload pode mentir;
um CNPJ diferente, não. Quando a conta é de terceiro, exige justificativa e o parâmetro
`allow_third_party_accounts` habilitado na empresa.

### Favorecidos: visão de leitura, não cadastro novo

`GET /treasury/beneficiaries` lê `supplier_bank_accounts` e `supplier_pix_keys` e
apresenta o resultado consolidado. Criar uma tabela `beneficiaries` própria produziria
duas versões da mesma conta bancária, que divergiriam na primeira correção feita em
apenas um dos lados. A tela correspondente é explicitamente somente leitura e aponta para
o cadastro do fornecedor.

### Exigências das formas de pagamento como piso, não como padrão

`PAYMENT_METHOD_REQUIREMENTS` define o mínimo de cada tipo — PIX exige favorecido,
boleto exige linha digitável, transferência/TED/DOC exigem favorecido e dados bancários,
cartão exige conta financeira — e é aplicado por cima do que o usuário enviou: desmarcar
na tela não desliga a exigência. Se a exigência fosse apenas um valor inicial, um
cadastro descuidado permitiria lançar uma transferência sem dados bancários, e o erro só
apareceria no momento do pagamento.

### Nomes de model divergindo do nome da tabela

`PaymentMethodCatalog` mapeia para a tabela `payment_methods`, e `FinancialNatureCatalog`
para `financial_natures`. O sufixo existe porque `enum PaymentMethod` e
`enum FinancialNature` já eram usados por fornecedores e clientes: um model com o mesmo
nome faria o Prisma resolver campos como `defaultPaymentMethod PaymentMethod?` como
relação em vez de enum. Renomear os enums quebraria código aprovado; renomear as tabelas
quebraria migrations. O sufixo no model é a mudança de menor alcance.

### Estrutura de integração pronta, conexão nenhuma

`financial_account_integrations`, `reconciliation_mode`, `settlement_days` e as taxas das
formas de recebimento existem no schema, mas nenhuma conexão bancária é feita nesta
etapa: `POST .../integrations/:id/test` valida o cadastro, não o acesso ao banco. Os
saldos bancário, conciliado e disponível também não são calculados — só existe saldo de
implantação, e apresentá-lo como saldo atual seria informação errada, não informação
incompleta.


## Entrada de Documentos

### Fila no banco, não no Redis

A fila de processamento (`intake_document_processing_jobs`) é uma tabela, consumida com
`SELECT ... WHERE status='PENDING' AND available_at <= NOW() ORDER BY priority, available_at
LIMIT 1 FOR UPDATE SKIP LOCKED`. A alternativa seria Redis com BullMQ.

A tabela ganhou porque não acrescenta infraestrutura para rodar e porque idempotência,
retry com backoff, dead-letter e histórico de tentativas passam a ser auditáveis em SQL e
sobrevivem a reinício do processo. `SKIP LOCKED` dá a exclusão mútua entre workers
concorrentes sem lock global. O custo é polling em vez de push — aceitável em uma fila que
processa dezenas de documentos por dia, não milhares por segundo.

O worker roda dentro do processo da API por padrão (`INTAKE_WORKER_ENABLED`), e desligá-lo
é uma variável de ambiente, não uma mudança de código: quando a fila for consumida por um
processo separado, nada no domínio muda.

### Detecção de tipo de arquivo escrita à mão

`file-type@21` é ESM-only e quebraria os testes em CommonJS. Em vez de reconfigurar o Jest
do projeto inteiro por causa de uma dependência, `utils/file-signature.util.ts` lê as
assinaturas de bytes diretamente.

O efeito colateral foi bom: o detector reconhece explicitamente os formatos que precisam
ser **bloqueados** (MZ, ELF, Mach-O, shebang, ZIP simples), coisa que uma biblioteca
genérica só reportaria como "é um zip" e deixaria a decisão para quem chamou.

### PDF lido com `zlib`, sem biblioteca de PDF

O texto nativo do PDF é extraído inflando os streams `FlateDecode` com o `zlib` do próprio
Node e interpretando os operadores `Tj`, `TJ`, `'` e `"`. Não é um parser completo de PDF —
e não precisa ser: o objetivo é decidir se **existe** texto aproveitável antes de recorrer
ao OCR. Quando o texto nativo fica abaixo do limiar de utilidade, ele é aproveitado assim
mesmo com confiança reduzida, em vez de descartado; descartar levava a OCR e, sem provedor,
a nada.

### Confiança de identificação abaixo do piso de "média"

`TEXT_SIMILARITY` vale 60 pontos — deliberadamente abaixo dos 75 que separam confiança
média de baixa. Um nome parecido nunca preenche o fornecedor sozinho. E quando os dois
melhores candidatos ficam a menos de 5 pontos um do outro, o serviço devolve `ambiguous`
em vez de escolher: um empate resolvido em silêncio é pior que um empate declarado.

### Mascaramento aplicado no back-end

O mesmo padrão da tesouraria e dos fornecedores: o valor protegido é substituído **antes**
de virar resposta. Mascarar no front-end deixaria o valor completo passar pela rede e ficar
no cache do navegador — o mascaramento seria estética, não controle de acesso.

### O documento não é uma obrigação financeira

`intake_documents` guarda um documento em trânsito, não um título. Encaminhar cria o
registro de processamento futuro e nada mais. A separação é o que permite rejeitar, dividir
em parcelas, trocar a empresa de destino e reabrir um documento sem que nada disso tenha
efeito contábil.

### Parcelas sem `onDelete: Cascade`

A divisão em parcelas cria documentos filhos ligados ao pai por `parentDocumentId`, sem
cascade. Excluir o pai não pode apagar as parcelas derivadas em silêncio: cada uma já pode
ter seguido caminho próprio.

### Fator de vencimento do boleto: ambiguidade declarada

O fator tem quatro dígitos e estourou em 21/02/2025, reiniciando em 1000. Fatores de 1000 a
1999 correspondem a duas datas possíveis. O validador devolve os dois candidatos em vez de
escolher — um vencimento errado por um ciclo inteiro é pior que um vencimento em aberto.

Foi por isso também que os boletos de teste passaram a ser **gerados** por
`utils/boleto-fixture.util.ts` em vez de copiados de documentação bancária: as linhas que
circulam por aí costumam ser ilustrativas e falham no dígito verificador geral, o que daria
a impressão de que o validador está errado.

### Nomes de folha na leitura do XML fiscal

`readParty` procura o CNPJ apenas por nomes de **folha**. Incluir contêineres como
`CpfCnpj` ou `IdentificacaoPrestador` na mesma lista os faria ganhar da folha que os
contém, e a NFS-e — que aninha o CNPJ dois níveis abaixo — voltaria com emitente nulo.


## Autenticação

- Login, sessão, recuperação de senha e confirmação de e-mail são delegados ao **Supabase
  Auth**. O front-end usa `@supabase/ssr` para manter a sessão sincronizada via cookies
  entre Server Components, Client Components e o Proxy (`proxy.ts` — no Next.js 16 o antigo
  `middleware.ts` foi renomeado para `proxy.ts`).
- O back-end nunca confia em dados vindos do front-end para autorização: cada requisição
  autenticada tem seu `access_token` do Supabase validado via `supabase.auth.getUser()`
  (service role), e os vínculos/permissões do usuário são recarregados do PostgreSQL a
  cada requisição (`AuthService.loadRequestUser`).

## Prisma 7 — decisão de geração do client

O Prisma 7 introduziu um novo gerador padrão (`prisma-client`), que gera um client
**ESM-only** (usa `import.meta.url`) em uma pasta arbitrária do projeto. Isso é
incompatível, sem uma migração maior, com o restante do ecossistema NestJS usado aqui
(CommonJS, `ts-jest`, `ts-node`, decorators). Por isso este projeto fixa o gerador
legado:

```prisma
generator client {
  provider = "prisma-client-js"
}
```

Esse client é gerado em `node_modules/@prisma/client` (import `from '@prisma/client'`),
continua mantido pela Prisma e é o que a grande maioria dos projetos NestJS usa em
produção hoje. Se o back-end for migrado para ESM no futuro, é possível voltar para o
gerador `prisma-client`.

## Padrão de resposta da API

Toda resposta segue o envelope padrão (seção 19 do prompt mestre), aplicado
automaticamente pelo `ResponseInterceptor` (sucesso) e pelo `HttpExceptionFilter` (erro).
A mensagem de sucesso pode ser customizada por rota com `@ApiMessage('...')`.

## Auditoria

`AuditService.log(...)` é chamado pelos serviços de domínio (Organizations, Companies,
Users) em toda ação crítica (criação, edição, ativação/inativação/bloqueio, convite,
alteração de perfil). A tabela `audit_logs` é exposta somente para leitura em
`GET /audit-logs`, protegida pela permissão `settings.audit`.
