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


## Processamento de Documentos

### O título para em `OPEN`

Não existe `PAID` — nem no lançamento nem na parcela. A tentação era prever a situação para
"quando o módulo de pagamentos chegar", mas uma situação que nada produz é uma promessa no
schema: relatórios passariam a filtrar por ela, telas a exibi-la, e o dia em que a
liquidação existir de verdade a semântica já teria sido definida por acidente. Quando o
módulo existir, ele acrescenta a situação junto com o comportamento.

### Unicidade no banco, não na aplicação

`source_intake_document_id` é `@unique`. A verificação na aplicação existe para dar uma
mensagem decente, mas a garantia é do PostgreSQL: duas requisições simultâneas passariam
pela checagem em memória e só uma passa pela restrição.

O efeito colateral é que cancelar precisa **desfazer** o vínculo, senão um cancelamento por
engano travaria aquele documento para sempre.

### A origem de cada dimensão, não só o valor

`classification_sources` guarda um mapa `dimensão -> origem`. A alternativa era gravar só os
IDs, que é o que o relatório precisa. Mas quem revisa não precisa do valor: precisa saber se
aquilo foi decidido por uma regra, herdado de um cadastro ou digitado por alguém. Sem essa
coluna, a revisão é adivinhação — e a revisão é justamente o que separa um BPO de um
lançador de notas.

### A revisão vence a regra automática

A ordem de resolução é: documento > regra > vínculo > categoria. Poderia ser o contrário —
a regra é mais "inteligente" que o campo preenchido à mão. Mas o campo preenchido no
documento é o ato humano mais recente sobre aquele caso específico, e uma regra que
sobrescreve o que uma pessoa acabou de decidir é uma regra que ninguém confia.

Cada dimensão é resolvida isoladamente. Misturar origens no mesmo lançamento é o
comportamento correto; o que não pode é perder o registro de qual venceu.

### Retenção sugerida não desconta

Confirmar a retenção é o que altera o valor líquido. Descontar no cálculo e "desfazer" se
alguém recusar deixaria o título com um líquido provisório circulando — e líquido provisório
é o número que alguém copia para uma planilha.

Pela mesma razão, uma retenção **confirmada** não pode ser descartada: ela já mudou o valor.
A saída é cancelar o lançamento e processar de novo.

### Rateio materializado

O rateio é gravado no lançamento em vez de resolvido a cada leitura. A regra é um cadastro
vivo; o título é um fato histórico. Critérios não percentuais (quantidade, horas, peso,
área, consumo) viram percentual no momento da aplicação: a regra guarda o peso, o lançamento
guarda a fração que aquele peso representou naquele dia.

### Sobra de arredondamento na última linha

Vale para parcelas e para rateio: 100,00 em três partes dá 33,33 três vezes e perde um
centavo. Distribuir a sobra é a convenção de mercado e a única forma de a soma fechar
exatamente com o título. Um centavo perdido em cada lançamento vira divergência de
conciliação meses depois.

### Dia fixo limitado ao último dia do mês

Vencimento no dia 31 com dia fixo cai em 28 de fevereiro, não em 3 de março.
`new Date(2026, 1, 31)` transborda em silêncio — e um vencimento errado por três dias é o
tipo de defeito que só aparece quando o boleto vence.

### Editar só antes de abrir

Depois de `OPEN` o título já está em relatório. A alternativa — permitir edição com
histórico — parece mais flexível, mas faz o relatório de ontem discordar do de hoje sem que
ninguém perceba. Cancelar com motivo e processar de novo deixa os dois fatos visíveis.


## Autorizações

### A alçada mora na etapa do fluxo

O pedido descrevia faixas ("até R$ 1.000 → Supervisor; acima de R$ 100.000 → Diretor +
Sócio") e o desenho óbvio seria uma tabela de alçadas separada. Não existe. Cada etapa do
fluxo carrega `minimumAmount` / `maximumAmount`, e a faixa é a alçada.

A tabela separada criaria duas fontes de verdade sobre quem aprova o quê: o fluxo diria uma
coisa, a alçada outra, e alguém teria de escrever a regra de desempate. Com a faixa na
etapa, "quatro alçadas" é um fluxo com quatro etapas de faixas diferentes — as que não se
aplicam ao valor entram na solicitação como `SKIPPED`, visíveis, em vez de sumirem. Quem
audita vê que a etapa existia e por que não foi exigida.

Como o cadastro é por empresa, a exigência de alçadas "totalmente configuráveis por empresa"
sai de graça.

### As etapas da solicitação são cópias, não referências

`approval_request_steps` copia a etapa do fluxo no momento da abertura. Referenciar
`approval_flow_steps` economizaria a duplicação, mas editar um fluxo reescreveria o passado:
uma solicitação aberta sob a regra antiga passaria a exibir a regra nova, e o histórico de
aprovação deixaria de explicar a decisão que foi tomada.

O preço é que mudanças de fluxo só valem para o que abrir depois. É o preço certo.

### Duas assinaturas precisam de duas linhas

`approval_step_approvals` existe por causa da dupla aprovação. Guardar só `decidedBy` na
etapa registraria quem fechou — e o que a governança quer auditar é justamente o segundo
assinante, aquele cuja concordância era o ponto do controle. A tabela extra é o que impede
a dupla aprovação de virar aprovação simples com carimbo duplo.

### Delegar não concede permissão

Uma delegação nunca amplia acesso. Quem recebe já precisa ter `approvals.approve` na
empresa; a delegação só permite agir **no lugar de** outra pessoa, e o teto efetivo é
`min(limite de quem delegou, teto da delegação)` — nunca o maior dos dois.

Delegação em cadeia é recusada. A → B → C parece conveniência de férias sobrepostas, mas o
histórico resultante não responde quem decidiu de fato, que é a única pergunta que o
registro precisa responder.

### Quatro perguntas antes de aceitar uma decisão

Na ordem: a pessoa é aprovadora daquela etapa (direto, por papel ou por delegação vigente)?
o valor cabe no limite individual dela? não é ela quem criou o lançamento? a etapa está
realmente em andamento? Falhar em qualquer uma recusa a decisão. Verificar tudo no mesmo
lugar evita a variante clássica do defeito: uma rota nova que esquece uma das checagens.

### O portão fica em `FinancialEntriesService.open`

O critério era "nenhum documento aprovado segue para Contas a Pagar sem concluir todas as
etapas obrigatórias". A verificação poderia ficar no módulo de autorizações, mas abrir o
título é o instante exato em que ele vira obrigação — e é esse instante que precisa ser
defendido, não a tela que o antecede.

Por isso a seta entre os módulos aponta em um sentido só: processamento importa
autorizações, autorizações lê `FinancialEntry` direto pelo Prisma. Importação mútua seria
dependência circular, e o NestJS resolveria com `forwardRef` — que funciona e esconde o
problema.

### Expirar não é reprovar

Uma solicitação vencida vira `EXPIRED`, não `REJECTED`. Reprovar é uma decisão de alguém;
expirar é a ausência dela. Tratar as duas como a mesma coisa produziria o relatório em que
"o Diretor reprovou 40 pedidos" quando o Diretor estava de férias. Expirada sai da fila e
exige reiniciar o fluxo — o que é, de novo, um ato registrado.

### Notificações: estrutura, sem envio

Os canais (e-mail, push, WhatsApp, Teams, Slack) ficam declarados em `approval_settings` e
nada é enviado. O pedido pedia só a estrutura, e um envio parcial — e-mail funcionando,
resto silencioso — treinaria o usuário a não confiar na notificação, que é pior do que não
ter nenhuma.


## Contas a Pagar

### Título e lançamento são tabelas diferentes

O prompt separa "pré-lançamento" de "conta a pagar" no próprio fluxo, e o schema segue.
Reaproveitar `financial_entries` como título economizaria uma tabela e custaria a distinção
que importa: o lançamento é editável e cancelável porque ainda é uma proposta; o título é
uma obrigação e a partir dele sai dinheiro. Uma tabela só obrigaria cada regra a perguntar
"em que fase isto está?" antes de decidir se pode mudar.

Os valores e a classificação são copiados, não referenciados — mesma razão do rateio
materializado do módulo anterior. Um título é um fato histórico.

### Vencido e bloqueado calculados, não gravados

Nove das onze situações da seção 4 são colunas. Vencido não é: guardar exigiria um job para
transformar o passado em passado, e entre duas execuções o relatório mentiria. Bloqueado
também não: ele **convive** com a etapa de pagamento — um título pago pela metade e
bloqueado continua pago pela metade — e virar situação faria o desbloqueio ter que adivinhar
para onde voltar.

A API devolve `situation` com as onze, calculado na leitura. O que não existe é uma coluna
que possa discordar dos fatos.

### Um único motor de saldo

`PayableBalanceService.recompute` é o único lugar que escreve valor derivado. Todo movimento
— baixa, ajuste, retenção, adiantamento, renegociação — grava sua linha e chama o recálculo
dentro da mesma transação.

A alternativa (cada operação ajustando o saldo que conhece) é mais rápida e é como nasce o
defeito clássico de contas a pagar: dois caminhos de código com regras ligeiramente
diferentes, e um saldo que não bate com a soma das próprias parcelas.

Toda a aritmética é feita em centavos inteiros. `0.1 + 0.2` em ponto flutuante dá
`0.30000000000000004`; um saldo assim nunca zera, e um título que nunca zera nunca sai da
fila.

### O que é lançado no título é rateado entre as parcelas

Retenções e ajustes sem parcela indicada incidem sobre o título inteiro e precisam reduzir
cada parcela proporcionalmente. Sem o rateio, o líquido do título discordaria da soma das
suas parcelas — e é a parcela que se paga.

### Linhas imutáveis com estorno

Pagamentos, ajustes e abatimentos de adiantamento nunca são editados nem apagados: viram
`REVERSED`. O valor sai da conta e o fato antigo continua legível. Editar seria mais simples
e apagaria a pergunta que a auditoria faz — "por que este título mudou de valor?".

### Renegociação fotografa o cronograma

`previous_schedule` guarda as parcelas anteriores em JSON antes de qualquer escrita, porque
as parcelas em aberto são de fato substituídas. Referenciar as antigas em vez de fotografar
não funcionaria: elas mudam de situação, e o que se quer preservar é o acordo como ele era.

O novo total é validado ao centavo contra `saldo + juros + multa − desconto`. Aceitar um
cronograma que não fecha transformaria a renegociação num caminho silencioso para alterar
valor sem registro.

### Bloqueio barra movimento, não só agendamento

A seção 12 pede que o título bloqueado não siga para agendamento bancário. Bloquear apenas
naquele ponto deixaria o título ser pago, ajustado e renegociado no caminho. O bloqueio é
verificado na entrada de todo movimento financeiro.

`blocked_at` na tabela do título é espelho de `accounts_payable_blocks`, escrito na mesma
transação. Existe para a listagem filtrar bloqueados sem subconsulta; a verdade continua na
tabela de bloqueios, que preserva o histórico depois da liberação.

### Bloquear e liberar são permissões distintas

Quem segura um título suspeito não é necessariamente quem decide que ele está resolvido.
Uma permissão só transformaria o bloqueio em post-it.

### IP e dispositivo no histórico

A seção 18 pede os dois. Eles são lidos no controlador, por um decorador que devolve o
usuário acrescido de onde ele estava — em vez de empurrar o objeto de requisição camada
adentro, o que tornaria todo serviço dependente do Express e impossível de testar sem
falsificar uma requisição.

### Adiantamento fora do título

Ele nasce antes da nota. Prendê-lo a um título obrigaria a inventar um título fantasma para
recebê-lo. A relação com os títulos é N:N e mora em
`accounts_payable_advance_applications` — um campo no título esconderia essa relação e
"sobrou saldo de adiantamento?" viraria planilha paralela.

### Mora sugerida, nunca aplicada sozinha

A prévia de juros e multa calcula e não grava. Aplicar automaticamente faria o saldo mudar
todo dia sem ato humano nenhum — e um saldo que muda sozinho é um saldo que ninguém
consegue conferir com o fornecedor.

### O grafo de módulos continua acíclico

`document-processing → approvals → accounts-payable` e `document-processing →
accounts-payable`. O contas a pagar importa apenas Prisma e Auditoria: ele não sabe que
autorizações existem. Importação mútua seria resolvida pelo NestJS com `forwardRef`, que
funciona e esconde o problema.

A geração do título roda **depois** da transação da aprovação. A decisão de aprovar já está
gravada e não pode ser desfeita porque a geração falhou — e aninhar transação no Prisma cria
um cliente que não enxerga o que a primeira ainda não confirmou.


## Agendamento Bancário

### A programação é um desembolso, com itens

`payment_schedules` é o cabeçalho de **um pagamento**; `payment_schedule_items` são as
parcelas incluídas. A alternativa — uma programação por parcela — pareceria mais simples e
produziria, para um título parcelado pago de uma vez, várias linhas de remessa ao mesmo
fornecedor no mesmo dia. O banco enxergaria vários pagamentos, e a conciliação depois teria
de reagrupá-los.

`installment_id` é `UNIQUE`: a mesma parcela não entra em duas programações vivas. É a
única defesa real contra pagar a mesma dívida duas vezes, e ela precisa estar no banco.

### Reprogramado e bloqueado calculados, de novo

Mesma decisão do Contas a Pagar, aplicada de propósito pela mesma razão. Bloqueado convive
com a etapa da fila (uma programação bloqueada dentro de um lote continua no lote), e
reprogramado descreve a história da data, não a posição atual. Guardá-los como situação
faria a liberação ter de adivinhar para onde voltar.

`reschedule_count` responde ao indicador "pagamentos reprogramados" sem criar uma segunda
fonte de verdade.

### Cancelar a programação apaga os itens

Parece contraintuitivo guardar histórico e apagar linhas. Mas o `UNIQUE` em
`installment_id` prende a parcela enquanto o item existir: manter os itens "para histórico"
travaria aquela parcela para sempre. O registro do cancelamento vive em
`payment_schedule_history`, que é onde ele pertence.

### Um lote é de uma conta

O CNAB é por convênio bancário, e convênio é por conta. Permitir lote misto adiaria a
descoberta do erro para a geração do arquivo — depois de o lote ter sido conferido e
aprovado por alguém. A restrição está na criação, na inclusão e no fechamento.

`payment_batch_items` existe além do `batch_id` na programação porque é ali que mora a
**ordem** dos registros no arquivo e o valor conferido no fechamento; quando o retorno
bancário existir, cada linha recebe seu código de resposta individualmente. Uma chave
estrangeira solta não teria onde guardar isso.

### Saldo derivado do que existe, não do que se imagina

Não há movimento bancário no Pulse. O disponível é o saldo de abertura aprovado menos o
bloqueado; os limites contratados entram à parte, sob um parâmetro da empresa. Calcular um
"saldo atual" a partir de títulos pagos produziria um número que não bate com nenhum
extrato — e seria usado como se batesse.

Todo o cálculo vive em um serviço só. Quando a conciliação bancária chegar, ela troca a
fonte lá dentro e o resto do sistema não muda.

Programação bloqueada não entra no comprometido: dinheiro travado não vai sair, e contá-lo
faria o sistema recusar programações por causa de um gasto que não acontecerá.

### Saldo insuficiente é alerta, não trava — por padrão

O cheque de saldo devolve diagnóstico em vez de lançar exceção. Quem decide se o déficit
impede a programação é o parâmetro da empresa. Travar por padrão pareceria mais seguro e
seria errado: quem sabe que o dinheiro entra na véspera não quer o sistema recusando o
agendamento.

### A simulação é pura

Recebe as alterações hipotéticas, projeta em memória e devolve. Nenhuma escrita, nem
temporária. A alternativa comum — gravar um cenário e desfazer depois — é como uma
simulação vira uma alteração acidental que ninguém percebeu.

Ela não tem entradas de caixa porque o Pulse não tem Contas a Receber. Projetar recebimento
inexistente daria uma folga que não existe, que é pior do que não projetar.

### Ações em massa isolam cada item

Cada programação é processada sozinha e o resultado diz quais falharam e por quê. Uma
transação única seria mais consistente e obrigaria quem selecionou trinta títulos a
descobrir sozinho qual deles travou o lote inteiro.

### O grafo continua acíclico

`payment-scheduling` importa só Prisma e Auditoria. Ele **lê** Contas a Pagar e Tesouraria
direto pelo Prisma, e nenhum dos dois sabe que o agendamento existe. A seta segue apontando
em um sentido só, como nos módulos anteriores.


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
