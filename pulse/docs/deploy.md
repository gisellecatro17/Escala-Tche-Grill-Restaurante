# Colocar o Pulse no ar

Guia de ponta a ponta: do projeto Supabase recém-criado até o sistema abrindo no navegador.

O Pulse tem três peças que precisam estar no ar ao mesmo tempo. O Supabase cobre duas
delas — banco de dados e login — o que reduz o que falta contratar.

| Peça | Quem serve | Custo inicial |
| --- | --- | --- |
| Banco de dados (PostgreSQL) | Supabase | grátis |
| Login e senha | Supabase Auth | grátis |
| Arquivos (extratos, boletos) | Supabase Storage | grátis |
| API (NestJS) | Railway ou Render | grátis / ~US$ 5 |
| Telas (Next.js) | Vercel | grátis |

---

## 1. Os quatro valores do Supabase

Todos saem do painel do seu projeto. Abaixo, o caminho exato de cada um.

### 1.1 — Project Settings › API

| Campo no painel | Onde vai |
| --- | --- |
| **Project URL** | `SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_URL` |
| **anon / public** | `SUPABASE_ANON_KEY` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| **service_role / secret** | `SUPABASE_SERVICE_ROLE_KEY` |

> **A `service_role` é uma senha mestra.** Ela ignora todas as regras de segurança do banco
> e lê qualquer tabela de qualquer cliente. Ela vive **só** no servidor da API — nunca no
> front-end, nunca num arquivo versionado, nunca colada num chat. Se ela vazar, o certo é
> girar a chave no painel do Supabase imediatamente.
>
> A `anon` é o contrário: ela é pública por natureza e vai embutida nas telas. Não há
> problema em ela ser vista.

### 1.2 — Project Settings › Database › Connection string

O Supabase oferece dois endereços para o mesmo banco, e **os dois são necessários**:

| Modo | Porta | Para que serve |
| --- | --- | --- |
| **Transaction pooler** | 6543 | O dia a dia da API (`DATABASE_URL`) |
| **Session / Direct** | 5432 | Criar e alterar tabelas (`DIRECT_URL`) |

A distinção existe por um motivo prático: o pooler reaproveita conexões e não sustenta as
transações longas que uma migration exige. Usar só o pooler faz a criação das tabelas
falhar no meio; usar só a conexão direta esgota o limite de conexões assim que o sistema
tiver usuários de verdade.

No `DATABASE_URL` (porta 6543), acrescente `?pgbouncer=true&connection_limit=1` ao final.

---

## 2. Criar os dois buckets de arquivos

No painel: **Storage › New bucket**.

| Nome | Público? | Guarda |
| --- | --- | --- |
| `pulse-public` | **Sim** | Logotipos das empresas |
| `pulse-private` | **Não** | Extratos, boletos, notas fiscais |

O `pulse-private` **precisa** ficar privado. É onde o extrato bancário do cliente é
guardado, e o sistema serve esses arquivos só por link assinado e temporário. Um bucket
público aqui deixaria o extrato inteiro acessível a quem descobrisse o endereço.

---

## 3. Preparar o banco

**Você não precisa fazer nada aqui.** O banco se prepara sozinho quando a API sobe pela
primeira vez — o comando de start do passo 4 cuida disso.

Duas coisas acontecem nesse primeiro boot:

| Comando | O que faz |
| --- | --- |
| `prisma migrate deploy` | Cria as ~110 tabelas |
| `prisma db seed` | Cadastra permissões, perfis e a empresa de demonstração |

Os dois são seguros de repetir. As migrations já aplicadas são puladas, e o seed atualiza
o que existe em vez de duplicar — por isso podem ficar no start sem causar estrago a cada
novo deploy.

### Se preferir rodar na sua máquina

Nada impede, e é útil para conferir antes de publicar:

```bash
cd pulse/backend
npm install
DATABASE_URL="<a URL da porta 5432>" npx prisma migrate deploy
DATABASE_URL="<a URL da porta 5432>" npx prisma db seed
```

Use a conexão **direta** (5432), não a do pooler (6543): o pooler não sustenta as
transações longas de uma migration e ela falha no meio.

---

## 4. Publicar a API (Railway)

1. **New Project › Deploy from GitHub repo** e escolha este repositório
2. Em **Settings**, defina a raiz do serviço como `pulse/backend`
3. Comando de build: `npm install && npx prisma generate && npm run build`
4. Comando de start: `npx prisma migrate deploy && npx prisma db seed && node dist/src/main.js`
5. Em **Variables**, cadastre:

```
NODE_ENV=production
PORT=3333
DATABASE_URL=<pooler, porta 6543, com ?pgbouncer=true&connection_limit=1>
DIRECT_URL=<direta, porta 5432>
SUPABASE_URL=<Project URL>
SUPABASE_ANON_KEY=<anon>
SUPABASE_SERVICE_ROLE_KEY=<service_role>
SUPABASE_STORAGE_BUCKET=pulse-public
SUPABASE_PRIVATE_STORAGE_BUCKET=pulse-private
CORS_ORIGINS=<endereço da Vercel, definido no passo 5>
INTAKE_WORKER_ENABLED=true
CNPJ_LOOKUP_PROVIDER=brasilapi
```

Anote o endereço que o Railway gera — algo como `pulse-api.up.railway.app`.

---

## 5. Publicar as telas (Vercel)

1. **Add New › Project**, importe o repositório
2. **Root Directory**: `pulse/frontend`
3. Em **Environment Variables**:

```
NEXT_PUBLIC_SUPABASE_URL=<Project URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon>
NEXT_PUBLIC_API_URL=https://<endereço do Railway>
```

Repare que a `service_role` **não** aparece aqui. Toda variável `NEXT_PUBLIC_` é embutida
no código que chega ao navegador — colocar a chave mestra ali é o mesmo que publicá-la.

Depois do primeiro deploy, volte ao Railway e ajuste `CORS_ORIGINS` para o endereço da
Vercel. Sem isso o navegador bloqueia as chamadas à API.

---

## 6. Criar o primeiro usuário

1. No Supabase: **Authentication › Users › Add user**, com e-mail e senha
2. Vincule esse usuário como administrador da organização:

```bash
cd pulse/backend
DATABASE_URL="<DIRECT_URL>" npx ts-node --transpile-only prisma/link-first-admin.ts <e-mail>
```

3. Abra o endereço da Vercel e entre com esse e-mail e senha

---

## Conferência rápida

| Sintoma | Causa quase sempre |
| --- | --- |
| Tela de login abre, mas entrar não funciona | `NEXT_PUBLIC_API_URL` errado, ou API fora do ar |
| "Failed to fetch" no navegador | `CORS_ORIGINS` não tem o endereço da Vercel |
| Login entra e cai numa tela vazia | O usuário não foi vinculado (passo 6.2) |
| Migration trava ou dá timeout | Está usando o pooler (6543) em vez da conexão direta (5432) |
| Upload de extrato falha | O bucket `pulse-private` não existe |

---

## O que fazer se uma chave vazar

No painel do Supabase, **Project Settings › API › service_role › Reveal › Generate new
key**. A chave antiga para de funcionar na hora. Depois, atualize a variável no Railway e
faça um novo deploy. Leva dois minutos e não derruba nada além da API por alguns segundos.
