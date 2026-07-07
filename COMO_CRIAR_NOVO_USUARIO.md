# Como criar um novo usuário no projeto IControl

Análise baseada no código do backend. Arquivos citados com caminho completo do projeto.

---

## 1. Método correto para criar um novo usuário

No projeto existem **duas formas oficiais** suportadas pelo código:

| Forma | Suportada? | Quando usar |
|-------|------------|-------------|
| **Endpoint POST /v1/users/register** | Sim | Quando já existe pelo menos um usuário autenticado (ex.: backoffice). |
| **Seed (database:seed)** | Sim | Quando a tabela `users` está **vazia** (primeiro acesso). |
| **Insert direto no banco** | Não é rota/feature oficial | Possível tecnicamente se você gerar o hash bcrypt igual ao do projeto (ver seção 5). |
| **Script dedicado** | Não existia | Foi criado um script de exemplo para criar um admin quando não há ninguém logado (seção 7). |
| **Painel admin** | Sim (via front) | O frontend chama o mesmo endpoint `POST /v1/users/register`; não é outro método. |

Não há endpoint público de “registro sem autenticação”. Não há outro script oficial além do seed.

---

## 2. Endpoint para criar usuário

### Rota exata

- **URL:** `POST /v1/users/register`  
- **Prefixo:** `/v1/users` (definido em `backend-ds-control-main\src\modules\user\user.module.ts`, linha 7).  
- **Path:** `/register` (definido em `backend-ds-control-main\src\modules\user\user.routes.ts`, linhas 62–78).

### Método HTTP

- **POST**

### Autenticação

- **Obrigatória.** A rota usa `preHandler: [AuthenticationJWT]` (linha 76 de `user.routes.ts`).  
- É necessário enviar um **JWT válido** no header: `Authorization: Bearer <access_token>`.  
- O middleware está em `backend-ds-control-main\src\middleware\authentication-jwt-middleware.ts`.  
- O código **não** verifica role: qualquer usuário autenticado (backoffice, pilot ou farmer) pode chamar esse endpoint.

### Payload completo esperado

Schema Zod em `backend-ds-control-main\src\modules\user\dto\create-user.dto.ts`:

```7:26:backend-ds-control-main/src/modules/user/dto/create-user.dto.ts
export const CreateUserSchema = z.object({
  email: z.string().email(),
  password: DefaultPasswordSchema,
  name: z.string().min(1),
  type: z.nativeEnum(UserType),
  customerId: z.string().uuid().nullish(),
}).refine(
  (data) => {
    // If type is FARMER, customerId can be present or null
    if (data.type === UserType.FARMER) {
      return true;
    }
    // If type is not FARMER, customerId must be null or undefined
    return data.customerId === null || data.customerId === undefined;
  },
  ...
);
```

`DefaultPasswordSchema` em `backend-ds-control-main\src\common\types\password.schema.ts`:

```4:6:backend-ds-control-main/src/common/types/password.schema.ts
export const DefaultPasswordSchema = z.string()
  .min(3, "Password must be at least 3 characters long")
  .regex(/[A-Za-z]/, "Password must contain at least one letter")
```

**Payload JSON:**

- **email** (string): e-mail válido.  
- **password** (string): mínimo 3 caracteres, pelo menos uma letra (A–Z ou a–z).  
- **name** (string): não vazio.  
- **type** (string): exatamente um de `"backoffice"` | `"pilot"` | `"farmer"`.  
- **customerId** (string UUID ou null/omitido): obrigatório **apenas** se `type === "farmer"` (e aí pode ser null); para backoffice/pilot deve ser null ou omitido.

### Validações obrigatórias

- Email único (checado no service: “Já existe usuário com este Email” → 409).  
- Senha: mínimo 3 caracteres, pelo menos uma letra.  
- Para `type === "farmer"`, `customerId` pode ser UUID ou null; para outros tipos deve ser null/undefined.

### Tipos/roles aceitos

Enum em `backend-ds-control-main\src\repositories\users\user.types.ts`:

```1:5:backend-ds-control-main/src/repositories/users/user.types.ts
export enum UserType {
  BACKOFFICE = 'backoffice',
  PILOT = 'pilot',
  FARMER = 'farmer',
}
```

Valores aceitos no JSON: **`"backoffice"`**, **`"pilot"`**, **`"farmer"`**.

### Resposta esperada

- **Sucesso:** status **201**, body: `{ "message": "User created successfully" }` (controller, linhas 33–35 de `user.controller.ts`).  
- **Erro:** 409 se email já existe; 401 se não autenticado; 400 se validação falhar.

---

## 3. Necessidade de estar autenticado para criar usuário

- **Sim.** O endpoint `POST /v1/users/register` **sempre** exige JWT (middleware `AuthenticationJWT`). Não há “registro público” no backend.

**Alternativas para o primeiro acesso quando ninguém consegue entrar:**

1. **Rodar o seed** – Se a tabela `users` estiver vazia, o seed cria 6 usuários (incluindo backoffice). Ver seção 4.  
2. **Inserir um usuário direto no banco** – Com senha hasheada com bcrypt da mesma forma que o projeto (ver seção 5).  
3. **Usar o script de exemplo** – Script TypeScript que usa o mesmo `bcrypt` e config do projeto para inserir um admin (seção 7).

---

## 4. Seed utilizável

### Como rodar

No diretório do backend:

```bash
cd "c:\Users\ulyss\AllTech\Projetos - Documentos\DS Control\DS Control_Projeto\backend-ds-control-main"
npm run database:seed
```

Script no `package.json` (linha 18):

```json
"database:seed": "tsx src/infra/database/seed.ts"
```

Ou diretamente:

```bash
npx tsx src/infra/database/seed.ts
```

Requer variáveis de ambiente do backend (`.env` com DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, etc.).

### Condição em que os usuários são inseridos

Trecho em `backend-ds-control-main\src\infra\database\seed.ts` (linhas 326–347):

```326:347:backend-ds-control-main/src/infra/database/seed.ts
    // Check if users already exist
    const existingUsers = await db.query.users.findMany();
    
    if (existingUsers.length === 0) {
      // Hash passwords and prepare user data
      const hashedUsers = await Promise.all(
        seedUsers.map(async (user) => ({
          ...user,
          password: await bcrypt.hash(user.password, Number(env.BCRYPT_SALT_ROUNDS)),
        }))
      );

      // Insert users
      await db.insert(users).values(hashedUsers);
      ...
    } else {
      app.log.info("Database already contains users. Skipping user seeding.");
    }
```

- **Inserção de usuários ocorre somente quando `existingUsers.length === 0`**, ou seja, quando **não existe nenhum usuário** na tabela `users`.  
- Se já existir pelo menos um usuário, o seed **não** insere usuários (apenas loga “Database already contains users. Skipping user seeding.”).

### Uso em ambiente já populado

- Em ambiente que já tem usuários, o seed **não** adiciona novos usuários e **não** altera os existentes.  
- Não há risco de duplicar ou sobrescrever usuários; o único “risco” é esperar que novos usuários sejam criados pelo seed quando isso não acontecerá (porque a tabela não está vazia).

---

## 5. Criar usuário direto no banco

### Estrutura da tabela `users`

Definida em `backend-ds-control-main\src\infra\database\schema\user.schema.ts`:

```6:21:backend-ds-control-main/src/infra/database/schema/user.schema.ts
export const UserType = pgEnum('user_type', ['backoffice', 'pilot', 'farmer']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  type: UserType('type').notNull().default('backoffice'),
  createdAt: timestamp('created_at', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  customerId: uuid('customer_id').references(() => customers.id),
  updatedAt: timestamp('updated_at', { mode: 'date' }).$onUpdate(() => new Date()),
  deletedAt: timestamp('deleted_at', { mode: 'date' }),
}, ...);
```

### Campos obrigatórios (insert manual)

- **name** (text, notNull)  
- **email** (text, notNull, unique)  
- **password** (text, notNull) – deve ser o **hash bcrypt**, não texto plano.  
- **type** (enum `user_type`: `'backoffice'` | `'pilot'` | `'farmer'`) – default no schema é `'backoffice'`.

### Campos opcionais / gerados

- **id**: UUID; pode omitir e deixar o default `gen_random_uuid()`.  
- **created_at**: default `CURRENT_TIMESTAMP` se omitir.  
- **customer_id**: null para backoffice/pilot; para farmer pode ser UUID de um customer existente.  
- **updated_at**, **deleted_at**: null.

### Como a senha deve ser armazenada

- **Sempre** em formato **hash bcrypt**. Nunca inserir senha em texto plano.  
- O projeto usa `bcrypt.hash(senhaEmTexto, BCRYPT_SALT_ROUNDS)`.  
- Salt rounds vêm de `env.BCRYPT_SALT_ROUNDS` (`backend-ds-control-main\src\config\index.ts`), default **10**.

### Onde o bcrypt é aplicado

- **Criação via API:** `backend-ds-control-main\src\modules\user\services\user.service.ts`, linha 44:  
  `const hashedPassword = await bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS);`  
- **Seed:** `backend-ds-control-main\src\infra\database\seed.ts`, linha 334:  
  `password: await bcrypt.hash(user.password, Number(env.BCRYPT_SALT_ROUNDS))`.

### Role para admin/backoffice

- Use **`type = 'backoffice'`** para um usuário admin/backoffice.  
- No enum da tabela o valor é exatamente a string **`'backoffice'`**.

---

## 6. Forma mais segura e prática de criar um novo usuário admin/backoffice

- **Se a tabela `users` estiver vazia:** use o **seed** (`npm run database:seed`). É o fluxo oficial, cria usuários já hasheados e evita erro de formato. Depois troque a senha pelo “Esqueci minha senha” ou “Alterar senha” se as senhas do seed forem conhecidas no código.  
- **Se já existir algum usuário e você tiver acesso de backoffice:** use o **frontend** (cadastro de usuário) ou **POST /v1/users/register** com JWT. Não precisa adivinhar nada; payload e validações estão definidos no código (seção 2).  
- **Se já existir usuário e você não conseguir logar (e tiver acesso ao backend/banco):** use o **script de exemplo** da seção 7, que reutiliza a mesma config e bcrypt do projeto para inserir um admin sem expor senha em SQL.

---

## 7. Exemplo pronto para criar um usuário admin

### 7.1 Payload JSON (para POST /v1/users/register)

Requer um **Bearer token** válido (usuário já logado). Base URL da API: por exemplo `https://sua-api.com`; a rota é `POST /v1/users/register`.

```json
{
  "email": "novo-admin@exemplo.com",
  "password": "MinhaSenhaSegura123",
  "name": "Novo Admin",
  "type": "backoffice"
}
```

Não envie `customerId` para backoffice (ou envie `null`).

Exemplo com curl (substitua `BASE_URL` e `SEU_ACCESS_TOKEN`):

```bash
curl -X POST "BASE_URL/v1/users/register" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN" \
  -d "{\"email\":\"novo-admin@exemplo.com\",\"password\":\"MinhaSenhaSegura123\",\"name\":\"Novo Admin\",\"type\":\"backoffice\"}"
```

### 7.2 Script Node/TS para criar um admin (quando não há ninguém logado)

O projeto não inclui esse script por padrão; abaixo está um exemplo que usa a mesma config e bcrypt do backend. Salve como `backend-ds-control-main/scripts/create-admin.ts` (ou outro path dentro do backend).

Requisitos: variáveis de ambiente do backend (`.env`), em especial `DB_*` e `BCRYPT_SALT_ROUNDS`. A senha do novo admin pode ser passada por variável de ambiente para não ficar no histórico do terminal.

```ts
import "dotenv/config";
import { env } from "../src/config/index";
import bcrypt from "bcrypt";
import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import { users } from "../src/infra/database/schema";

const EMAIL = process.env.CREATE_ADMIN_EMAIL ?? "admin@exemplo.com";
const NAME = process.env.CREATE_ADMIN_NAME ?? "Admin";
const PASSWORD = process.env.CREATE_ADMIN_PASSWORD;
if (!PASSWORD || PASSWORD.length < 3) {
  console.error("Defina CREATE_ADMIN_PASSWORD (mín. 3 caracteres, com pelo menos uma letra)");
  process.exit(1);
}

async function main() {
  const client = new Client({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    ssl: env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  });
  await client.connect();
  const db = drizzle(client, { schema: { users } });

  const existing = await db.query.users.findFirst({ where: (u, { eq }) => eq(u.email, EMAIL) });
  if (existing) {
    console.error("Já existe usuário com email:", EMAIL);
    await client.end();
    process.exit(1);
  }

  const hashedPassword = await bcrypt.hash(PASSWORD, env.BCRYPT_SALT_ROUNDS);
  await db.insert(users).values({
    name: NAME,
    email: EMAIL,
    password: hashedPassword,
    type: "backoffice",
  });
  console.log("Usuário admin criado:", EMAIL);
  await client.end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

Uso (na raiz do backend):

```bash
# Com senha e email por variável (recomendado)
set CREATE_ADMIN_EMAIL=meu-admin@exemplo.com
set CREATE_ADMIN_NAME=Meu Admin
set CREATE_ADMIN_PASSWORD=MinhaSenhaSegura123
npx tsx scripts/create-admin.ts
```

No PowerShell:

```powershell
$env:CREATE_ADMIN_EMAIL="meu-admin@exemplo.com"
$env:CREATE_ADMIN_NAME="Meu Admin"
$env:CREATE_ADMIN_PASSWORD="MinhaSenhaSegura123"
npx tsx scripts/create-admin.ts
```

### 7.3 SQL direto (apenas se você gerar o hash fora)

O projeto não fornece SQL com senha; você precisa gerar o hash com o mesmo salt rounds (10). Exemplo em Node (uma linha):

```bash
node -e "require('bcrypt').hash('MinhaSenha123', 10).then(h => console.log(h))"
```

Use o hash retornado no INSERT (substitua `'HASH_AQUI'` e o email/nome):

```sql
INSERT INTO users (id, name, email, password, type, created_at)
VALUES (
  gen_random_uuid(),
  'Meu Admin',
  'meu-admin@exemplo.com',
  'HASH_AQUI',
  'backoffice',
  CURRENT_TIMESTAMP
);
```

---

## Melhor caminho para criar um novo usuário agora

- **Use este caminho:**  
  - Se **não há nenhum usuário** no sistema → rodar o **seed** e, se quiser, trocar a senha depois.  
  - Se **já há usuário** e você consegue logar (backoffice) → usar o **endpoint** `POST /v1/users/register` (pelo front ou por curl) com o payload da seção 7.1.  
  - Se **já há usuário** e **ninguém consegue entrar** → usar o **script** da seção 7.2 (com `CREATE_ADMIN_*` no `.env` ou no ambiente) para criar um admin; em seguida fazer login com esse usuário.

- **Por que é o melhor:**  
  - Seed e endpoint são os únicos fluxos oficiais do projeto; o script reutiliza a mesma config e bcrypt, sem inventar formato de senha ou role.  
  - Evita “chute” de campos ou roles: tudo está comprovado nos arquivos citados (user.routes.ts, create-user.dto.ts, user.schema.ts, user.service.ts, seed.ts, config/index.ts).

- **Passo a passo mínimo:**  
  1. Verificar se existe algum usuário (ex.: `SELECT COUNT(*) FROM users;` ou rodar o seed e ver se aparece “Skipping user seeding”).  
  2. **Se 0 usuários:** rodar `npm run database:seed` no backend; usar um dos usuários backoffice do seed (e-mails no seed) e trocar a senha depois se necessário.  
  3. **Se já existem usuários e você tem token:**  
     - `POST /v1/users/register`  
     - Headers: `Content-Type: application/json`, `Authorization: Bearer <token>`  
     - Body: `{ "email": "novo-admin@exemplo.com", "password": "MinhaSenhaSegura123", "name": "Novo Admin", "type": "backoffice" }`.  
  4. **Se já existem usuários e você não tem token:**  
     - Colocar no `.env` (ou exportar): `CREATE_ADMIN_EMAIL`, `CREATE_ADMIN_NAME`, `CREATE_ADMIN_PASSWORD`.  
     - Rodar `npx tsx scripts/create-admin.ts` no diretório do backend (após criar o script da seção 7.2).  
     - Fazer login no front com esse email e senha.

- **Payload/script/comando pronto:**  
  - Payload: seção 7.1 (JSON e curl).  
  - Script: seção 7.2 (código completo e comandos de execução).  
  - SQL: seção 7.3 (apenas se você gerar o hash bcrypt com 10 rounds fora do projeto).

Arquivos que comprovam as informações:  
`backend-ds-control-main\src\modules\user\user.routes.ts`,  
`backend-ds-control-main\src\modules\user\dto\create-user.dto.ts`,  
`backend-ds-control-main\src\repositories\users\user.types.ts`,  
`backend-ds-control-main\src\common\types\password.schema.ts`,  
`backend-ds-control-main\src\infra\database\schema\user.schema.ts`,  
`backend-ds-control-main\src\modules\user\services\user.service.ts`,  
`backend-ds-control-main\src\infra\database\seed.ts`,  
`backend-ds-control-main\src\config\index.ts`,  
`backend-ds-control-main\src\modules\user\user.module.ts`.
