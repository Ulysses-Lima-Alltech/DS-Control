# Auditoria do sistema de autenticação – DS Control

Documento gerado para auditoria interna. **Não exponha este arquivo nem as credenciais referenciadas.**

---

## 1. Pontos onde usuários podem ser criados

### 1.1 Seed (backend)

| Item | Detalhe |
|------|--------|
| **Arquivo** | `c:\Users\ulyss\AllTech\Projetos - Documentos\DS Control\DS Control_Projeto\backend-ds-control-main\src\infra\database\seed.ts` |
| **Trecho** | Array `seedUsers` (linhas 73–113), inserção em `db.insert(users).values(hashedUsers)` (linhas 328–340). |
| **Condição** | Só insere usuários se `existingUsers.length === 0`. Senhas são hasheadas com `bcrypt.hash(user.password, Number(env.BCRYPT_SALT_ROUNDS))` antes do insert. |

### 1.2 Migrations

| Item | Detalhe |
|------|--------|
| **Arquivos** | `backend-ds-control-main\drizzle\0000_add_users_and_users_tokens.sql` (e demais em `drizzle\`) |
| **Conteúdo** | Apenas criação/alteração de tabelas (`CREATE TABLE "users"`, `ALTER TABLE "users"`). **Nenhuma migration faz INSERT em usuários.** |

### 1.3 Endpoint de criação de usuário

| Item | Detalhe |
|------|--------|
| **Rota** | `POST /v1/users/register` |
| **Arquivo de rotas** | `backend-ds-control-main\src\modules\user\user.routes.ts` (linhas 62–78). |
| **Handler** | `UserController.createUser` → `UserService.createUser`. |
| **Proteção** | `preHandler: [AuthenticationJWT]` — exige usuário autenticado (normalmente backoffice). |
| **Body** | `CreateUserSchema`: email, password, name, type (backoffice | pilot | farmer), customerId (opcional para farmer). |

Trecho relevante:

```62:78:backend-ds-control-main/src/modules/user/user.routes.ts
  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "POST",
    url: "/register",
    schema: {
      body: CreateUserSchema,
      description: "Create a new user account with email and password",
      ...
    },
    preHandler: [AuthenticationJWT],
    handler: controller.createUser,
  });
```

### 1.4 Fluxo no backend (service + repository)

- **Service:** `backend-ds-control-main\src\modules\user\services\user.service.ts` — `createUser` faz hash da senha com `bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS)` e chama o repositório.
- **Repository:** `backend-ds-control-main\src\repositories\users\user.repository.ts` — `createUser` faz `db.insert(users).values({ ... })` (recebe senha já hasheada).

### 1.5 Frontend que dispara criação

- **Componente:** `frontend-ds-control-main\src\components\Forms\FormRegisterNewUser.tsx` (e telas que o usam).
- **Service:** `frontend-ds-control-main\src\services\user.service.ts` — `registerNewUser` chama `api('/users/register', { method: 'POST', body: JSON.stringify(userData) })`.
- **URL efetiva:** `{baseApi}/v1/users/register` (base vem de `NEXT_PUBLIC_DS_CONTROL_API_URL`).

### 1.6 Scripts, SQL, JSON/CSV e inserts manuais

- **Scripts:** Nenhum script adicional de criação de usuário encontrado além do seed.
- **Arquivos .sql:** Nenhum INSERT em `users` nos arquivos em `backend-ds-control-main\drizzle\`.
- **Arquivos .json/.csv:** Em `backend-ds-control-main\imports\data.csv` e referências em `app.routes.ts` não há coluna de usuário/login; carga é de aplicações/dados de negócio, não de usuários.
- **Inserts manuais:** Apenas via seed ou via API `POST /v1/users/register` (com usuário já logado).

---

## 2. Lista de usuários identificados no projeto

Todos os usuários abaixo aparecem **apenas no seed** (`backend-ds-control-main\src\infra\database\seed.ts`). Senhas estão **mascaradas**; no código há senhas em texto plano no array `seedUsers` — não devem ser expostas em relatórios.

| E-mail / login | Nome | Perfil / role | Arquivo de origem | Tipo (teste/admin/seed/produção) |
|----------------|------|----------------|-------------------|-----------------------------------|
| admin@dsc.com | Admin User | backoffice | seed.ts | seed / admin |
| pilot@dsc.com | John Pilot | pilot | seed.ts | seed / teste |
| gaipara@dsc.com | Fazenda Gaipara Manager | farmer | seed.ts | seed / teste |
| acude@dsc.com | Fazenda Açude Manager | farmer | seed.ts | seed / teste |
| mundonovo@dsc.com | Mundo Novo Manager | farmer | seed.ts | seed / teste |
| demo@dsc.com | Demo Backoffice | backoffice | seed.ts | seed / demo |

**Senhas no seed (mascaradas):**

- admin@dsc.com: senha no formato `admin_****\`8` (prefixo distinto dos demais).
- Demais (pilot, gaipara, acude, mundonovo, demo): senha no formato `fq****\`8`.

Nenhum outro usuário está definido em migrations, SQL, JSON ou CSV no repositório analisado.

---

## 3. Fluxos de autenticação

### 3.1 Login

| Aspecto | Detalhe |
|--------|--------|
| **Backend** | `POST /v1/auth/login` — `authentication.routes.ts`, handler `loginWithEmailAndPassword`. |
| **Service** | `authentication.service.ts`: busca usuário por email, `bcrypt.compare(password, user.password)`, gera access + refresh token, grava refresh em `user_tokens`. |
| **Frontend** | `LoginForm` → `useLogin` → `AuthService.login` → `api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })`. |
| **Resposta** | 200 + `{ accessToken }` + cookies (access_token, refresh_token). |

### 3.2 Forgot password (solicitar reset)

| Aspecto | Detalhe |
|--------|--------|
| **Backend** | `POST /v1/users/request-password-reset` — body: `{ email }`. |
| **Arquivos** | `user.routes.ts` (linhas 93–108), `user.controller.ts` → `requestPasswordReset`, `user.service.ts` → `requestPasswordReset(email)`. |
| **Fluxo** | Busca usuário por email; gera token aleatório; hash do token com bcrypt; insert em `user_tokens` (context PASSWORD_RESET, expiresAt 15 min); envia e-mail com link `${FRONTEND_URL}/auth/forgot-password/callback?token=${token}&userId=${user.id}`. |
| **Frontend** | Formulário em `FormRequestResetPassword.tsx` / página `auth/forgot-password`; chama `requestResetUserPasswordByEmail` → `api('/users/request-password-reset', { method: 'POST', body: JSON.stringify({ email }) })`. |

### 3.3 Reset password (definir nova senha com token)

| Aspecto | Detalhe |
|--------|--------|
| **Backend** | `POST /v1/users/reset-password` — body: `{ token, userId, password }`. |
| **Arquivos** | `user.routes.ts` (linhas 81–91), `user.controller.ts` → `resetPassword`, `user.service.ts` → `resetPassword(token, newPassword, userId)`. |
| **Fluxo** | Busca token em `user_tokens` (context PASSWORD_RESET, userId, expiresAt > now); `bcrypt.compare(token, resetTokenRecord.token)`; hash da nova senha; update em `users.password`; remove token de reset. |
| **Frontend** | Página `auth/forgot-password/callback` lê `token` e `userId` da URL; formulário chama `resetPassword` → `api('/users/reset-password', { method: 'POST', body: JSON.stringify({ token, userId, password }) })`. |

### 3.4 Change password (trocar senha logado)

| Aspecto | Detalhe |
|--------|--------|
| **Backend** | `PUT /v1/users/me/password` — body: `{ oldPassword, newPassword }`. Requer JWT. |
| **Arquivos** | `user.routes.ts` (linhas 135–146), `user.controller.ts` → `changePassword`, `user.service.ts` → `changePassword(userId, { oldPassword, newPassword })`. |
| **Fluxo** | userId do JWT; busca usuário; `bcrypt.compare(oldPassword, user.password)`; hash da nova senha; update em `users.password`. |
| **Frontend** | Formulário de troca de senha (ex.: `FormChangePassword.tsx`) → `changeCurrentUserPassword` → `api('/users/me/password', { method: 'PUT', ... })`. |

### 3.5 Criação de usuário

- Ver **1.3** e **1.4**: único fluxo é `POST /v1/users/register` com JWT (admin/backoffice). Não há “convite” com link mágico; o novo usuário recebe email/senha definidos no cadastro (e pode usar “forgot password” no primeiro acesso se quiser).

### 3.6 Convite / acesso inicial

- **Não implementado.** Novos usuários são criados via “Register” com email + senha; o primeiro acesso é login normal. Reset inicial pode ser feito via “Esqueci minha senha” após o primeiro usuário admin ter criado a conta.

---

## 4. Tratamento de senhas

| Aspecto | Detalhe |
|--------|--------|
| **Hash** | Sim. Todas as senhas persistidas são hasheadas com **bcrypt**. |
| **Algoritmo** | bcrypt (biblioteca `bcrypt`). |
| **Onde ocorre o hash** | (1) **Login:** não hasheia; só compara com `bcrypt.compare(password, user.password)`. (2) **Criação de usuário (API):** `user.service.ts` → `createUser` → `bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS)` antes de passar ao repository. (3) **Seed:** `seed.ts` → `bcrypt.hash(user.password, Number(env.BCRYPT_SALT_ROUNDS))` antes do insert. (4) **Reset password:** `user.service.ts` → `resetPassword` → `bcrypt.hash(newPassword, env.BCRYPT_SALT_ROUNDS)`. (5) **Change password:** `user.service.ts` → `changePassword` → `bcrypt.hash(newPassword, env.BCRYPT_SALT_ROUNDS)`. |
| **Salt rounds** | `env.BCRYPT_SALT_ROUNDS` (config em `backend-ds-control-main\src\config\index.ts`, default `"10"`). |
| **Senha default em seed** | Sim. O seed define senhas em texto no array `seedUsers`; são hasheadas em memória antes do insert. **Não há senha única “default” em variável de ambiente.** |
| **Senha temporária automática** | Não. Não existe geração de senha temporária; o reset envia link para o usuário definir a nova senha. |

---

## 5. Credenciais hardcoded (mascaradas)

| Arquivo | Tipo | Exibição (mascarada) | Observação |
|---------|------|----------------------|------------|
| `backend-ds-control-main\src\config\index.ts` | API key (default) | `RESEND_API_KEY`: re_****Pup | Valor default no schema Zod; em produção deve vir de variável de ambiente. |
| `backend-ds-control-main\src\infra\database\seed.ts` | E-mails de usuários seed | admin@dsc.com, pilot@dsc.com, gaipara@dsc.com, acude@dsc.com, mundonovo@dsc.com, demo@dsc.com | Apenas e-mails; senhas não são exibidas aqui (ver seção 2 para máscaras). |
| `backend-ds-control-main\src\infra\database\seed.ts` | Senhas em texto no código | admin: ad****8; demais: fq****8 | **Não use essas senhas em produção.** Recomenda-se mover para env ou remover após primeiro deploy. |
| `backend-ds-control-main\src\modules\user\services\user.service.ts` | E-mail remetente (Resend) | from: "DS Control <no****@dstechbrasil.com.br>" | E-mail de envio de “esqueci senha”; não é credencial de login. |

Nenhum token JWT, ACCESS_TOKEN_SECRET ou REFRESH_TOKEN_SECRET está hardcoded; vêm de `process.env` em `config/index.ts`. Arquivos `.env` não foram lidos (geralmente no .gitignore).

---

## 6. Recuperação de acesso de forma segura

### 6.1 Resetar senha de um usuário existente

- **Pelo fluxo normal (recomendado):**  
  - Na tela de login, usar “Esqueci minha senha”.  
  - Informar o e-mail do usuário.  
  - O backend envia e-mail com link para `.../auth/forgot-password/callback?token=...&userId=...`.  
  - O usuário define a nova senha nessa tela.  
- **Endpoints:**  
  - `POST /v1/users/request-password-reset` (body: `{ email }`).  
  - `POST /v1/users/reset-password` (body: `{ token, userId, password }`).  

Requisitos: `RESEND_API_KEY` e `FRONTEND_URL` configurados para o e-mail chegar e o link apontar para o front correto. Nenhum script adicional é necessário para “resetar senha” além desse fluxo.

### 6.2 Criar um novo admin

- **Se já existe um backoffice logado:**  
  Logar no front com um usuário backoffice e usar a tela de “Cadastrar usuário” (FormRegisterNewUser), que chama `POST /v1/users/register` com tipo `backoffice`.  
- **Se não existe nenhum usuário (banco vazio):**  
  Rodar o seed (ver seção 7). Isso cria, entre outros, `admin@dsc.com` e `demo@dsc.com` (backoffice). **As senhas estão no código do seed; em produção recomenda-se alterar assim que possível** (troca de senha pelo fluxo “change password” ou “forgot password”).  
- **Se existem usuários mas nenhum admin:**  
  Não há endpoint “virar admin” sem ser admin. É necessário acesso ao banco ou um script interno que faça update em `users.type` para um usuário existente (fora do escopo desta auditoria de código; fazer com cuidado e registro de auditoria).

### 6.3 Redefinir senha sem quebrar o sistema

- Usar apenas **forgot password** + **reset password** (fluxo acima) ou **change password** (usuário logado).  
- Todos os fluxos gravam senha já hasheada; não há “senha em texto” persistida.  
- Tokens de reset expiram em 15 minutos e são de uso único (removidos após uso).  
- Não alterar manualmente no banco sem hash bcrypt; caso seja estritamente necessário, gerar o hash com as mesmas `BCRYPT_SALT_ROUNDS` e atualizar a coluna `users.password`.

---

## 7. Seeds com usuários de teste

### 7.1 Comando para carregar o seed

No diretório do backend:

```bash
cd "c:\Users\ulyss\AllTech\Projetos - Documentos\DS Control\DS Control_Projeto\backend-ds-control-main"
npm run database:seed
```

Ou, via package.json:

```json
"database:seed": "tsx src/infra/database/seed.ts"
```

Ou seja: `npx tsx src/infra/database/seed.ts` (com variáveis de ambiente do backend configuradas, inclusive banco).

### 7.2 Usuários que seriam criados

Só são inseridos se **não houver nenhum usuário** na tabela `users`. Os usuários criados são exatamente os da **tabela da seção 2** (admin@dsc.com, pilot@dsc.com, gaipara@dsc.com, acude@dsc.com, mundonovo@dsc.com, demo@dsc.com), com nomes e perfis listados lá. Senhas são hasheadas no próprio seed; **não são exibidas em claro** neste documento (apenas máscaras na seção 2).

---

## Plano prático de recuperação de acesso

- **Quais usuários existem**  
  Em ambiente que rodou o seed e não teve outros cadastros: os 6 usuários da seção 2 (admin@dsc.com, pilot@dsc.com, gaipara@dsc.com, acude@dsc.com, mundonovo@dsc.com, demo@dsc.com). Em produção, podem existir apenas alguns deles ou usuários criados pela API.

- **Admin mais provável**  
  **admin@dsc.com** (Admin User, backoffice). Alternativa: **demo@dsc.com** (Demo Backoffice). As senhas reais estão apenas no código do seed (não repetidas aqui).

- **Como resetar a senha com segurança**  
  1) Usar “Esqueci minha senha” na tela de login com o e-mail do usuário.  
  2) Garantir que o backend tenha `RESEND_API_KEY` e `FRONTEND_URL` corretos para envio do e-mail e link.  
  3) Abrir o link do e-mail e definir uma nova senha forte.  
  4) Se o e-mail não for recebido, verificar logs do backend e caixa de spam; em último caso, com acesso ao banco, pode-se gerar um hash bcrypt da nova senha (mesmo salt rounds) e atualizar `users.password` para esse usuário (evitar em produção sem política de mudança de senha obrigatória).

- **Como criar um novo acesso admin se necessário**  
  1) Se já existe um backoffice logado: usar a funcionalidade de “Cadastrar usuário” no front, tipo backoffice.  
  2) Se o banco estiver vazio: rodar `npm run database:seed` no backend (com env e banco configurados) e usar admin@dsc.com ou demo@dsc.com com a senha definida no seed; em seguida trocar a senha pelo fluxo “change password” ou “forgot password”.  
  3) Não criar novos admins com senhas em código; sempre usar a API de registro e depois troca de senha ou forgot password.

---

*Fim da auditoria. Não exponha este arquivo nem as credenciais referenciadas.*
