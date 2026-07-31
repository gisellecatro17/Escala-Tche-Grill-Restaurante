# Colocar o Pulse no ar

Guia de ponta a ponta: do projeto Supabase recém-criado até o sistema abrindo no navegador.

O Pulse tem três peças que precisam estar no ar ao mesmo tempo. O Supabase cobre duas
delas — banco de dados e login — o que reduz o que falta contratar.

| Peça | Quem serve | Custo inicial |
| --- | --- | --- |
| Banco de dados (PostgreSQL) | Supabase | grátis |
| Login e senha | Supabase Auth | grátis |
| Arquivos (extratos, boletos) | Supabase Storage | grátis |
| API (NestJS) | Render (plano gratuito) | grátis |
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

**Você não precisa fazer nada aqui.** O `render.yaml` na raiz do repositório manda o Render
criar as tabelas e cadastrar os dados iniciais durante a publicação.

| Comando | O que faz |
| --- | --- |
| `prisma migrate deploy` | Cria as ~110 tabelas |
| `prisma db seed` | Cadastra permissões, perfis e a empresa de demonstração |

Os dois rodam no **build**, não no start. No plano gratuito o serviço hiberna após 15
minutos parado e o start roda de novo a cada despertar — preparar o banco ali somaria
dezenas de segundos a toda primeira visita depois de uma pausa.

Ambos são seguros de repetir: migration já aplicada é pulada e o seed atualiza o que
existe em vez de duplicar.

### Se preferir rodar na sua máquina

```bash
cd pulse/backend
npm install
DIRECT_URL="<a URL da porta 5432>" npx prisma migrate deploy
DIRECT_URL="<a URL da porta 5432>" npx prisma db seed
```

---

## 4. Publicar a API (Render)

O repositório traz um `render.yaml` que descreve o serviço inteiro — raiz, branch,
comandos, plano e verificação de saúde. O Render lê esse arquivo e monta tudo; você só
informa os segredos.

1. Em [render.com](https://render.com), entre com a conta do GitHub
2. **New › Blueprint**
3. Escolha o repositório **Escala-Tche-Grill-Restaurante**
4. O Render mostra o serviço `pulse-api` já configurado. Confirme.
5. Ele pede os valores marcados como secretos. Preencha:

| Variável | O que colar |
| --- | --- |
| `DATABASE_URL` | Pooler do Supabase, porta **6543**, com `?pgbouncer=true&connection_limit=1` |
| `DIRECT_URL` | Conexão direta, porta **5432** |
| `SUPABASE_URL` | Project URL |
| `SUPABASE_ANON_KEY` | Chave `anon` |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave `service_role` |
| `CORS_ORIGINS` | `http://localhost:3000` por enquanto — ajustado no passo 5 |

6. **Apply** e acompanhe o log

O primeiro deploy leva de 5 a 8 minutos: ele instala tudo, compila e cria as tabelas.

### Conferir

Abra `https://pulse-api.onrender.com/health` (o endereço aparece no painel). A resposta
esperada:

```json
{"success":true,"data":{"status":"ok","timestamp":"..."}}
```

E no log, estas duas linhas:

```
[Bootstrap] Pulse API escutando na porta ...
[Bootstrap] Origens liberadas: ...
```

### O que o plano gratuito custa

| | |
| --- | --- |
| **Hibernação** | Após 15 min parado, o serviço dorme. A visita seguinte espera ~30 s para acordar. |
| **Memória** | 512 MB — suficiente para a API, apertado para processar arquivo grande |
| **Horas** | 750 por mês, o bastante para um serviço só |
| **Fila de documentos** | Desligada de propósito: ela consultaria o banco a cada 2 s e manteria o serviço acordado o mês inteiro, gastando as horas sem ninguém usar o sistema |

A hibernação é o único incômodo real, e some ao migrar para o plano pago (US$ 7/mês)
quando o sistema tiver uso de verdade. Para testar e demonstrar, não atrapalha.

### Sobre a região

O plano gratuito oferece Oregon, Ohio, Virginia, Frankfurt e Singapura — não há opção na
América do Sul. Cada consulta ao banco atravessa a distância entre a API e o Supabase, e o
`render.yaml` usa **ohio** por padrão.

| Supabase em | Região do Render que combina |
| --- | --- |
| Canadá (`ca-central-1`) | `ohio` — mesma costa, resposta rápida |
| São Paulo (`sa-east-1`) | `virginia` — o mais próximo disponível |

Para trocar, edite `region:` no `render.yaml`.

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
| Primeira visita do dia demora ~30 s | Normal no plano gratuito: o serviço estava hibernando |
| Documento enviado não é processado sozinho | `INTAKE_WORKER_ENABLED` está `false` — ligue no plano pago |

---

## O que fazer se uma chave vazar

No painel do Supabase, **Project Settings › API › service_role › Reveal › Generate new
key**. A chave antiga para de funcionar na hora. Depois, atualize a variável no Railway e
faça um novo deploy. Leva dois minutos e não derruba nada além da API por alguns segundos.
