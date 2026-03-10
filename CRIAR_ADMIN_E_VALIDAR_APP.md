# Criar admin e validar no app publicado

Objetivo: criar usuário admin (ulysses.lima@alltechbr.com) e garantir que o login funcione no app já publicado.

---

## 1. Caminho correto para criar o usuário admin

### Script `scripts/create-admin.ts` é o caminho adequado

- **Arquivo:** `backend-ds-control-main\scripts\create-admin.ts`
- O script usa a mesma config e bcrypt do backend (`env` em `src/config/index.ts`), insere na tabela `users` com `type: "backoffice"` e não exige nenhum usuário já logado.
- É a opção correta quando você tem acesso ao ambiente (`.env` / variáveis) do backend mas não tem um token para chamar `POST /v1/users/register`.

Trecho que define a role e os dados inseridos:

```68:73:backend-ds-control-main/scripts/create-admin.ts
  await db.insert(schema.users).values({
    name: NAME,
    email: EMAIL,
    password: hashedPassword,
    type: "backoffice",
  });
```

### Role correta no projeto

- No código a role de administrador é **`backoffice`**.
- Definida no enum em `backend-ds-control-main\src\repositories\users\user.types.ts`:

```1:5:backend-ds-control-main/src/repositories/users/user.types.ts
export enum UserType {
  BACKOFFICE = 'backoffice',
  PILOT = 'pilot',
  FARMER = 'farmer',
}
```

- O script já usa `type: "backoffice"` (linha 72 de `create-admin.ts`). Nada a alterar.

### Variáveis de ambiente que o script usa

O script importa `env` de `../src/config/index.ts`, que lê `process.env` (e `dotenv/config` carrega o `.env` do backend). O schema em `backend-ds-control-main\src\config\index.ts` exige:

| Variável | Obrigatória para o script | Uso |
|----------|---------------------------|-----|
| **DB_HOST** | Sim | Host do PostgreSQL |
| **DB_PORT** | Não (default 5432) | Porta do PostgreSQL |
| **DB_USER** | Sim | Usuário do banco |
| **DB_PASSWORD** | Sim | Senha do banco |
| **DB_NAME** | Sim | Nome do banco |
| **BCRYPT_SALT_ROUNDS** | Não (default 10) | Rounds do bcrypt |
| **NODE_ENV** | Não | Usado para SSL (production → usa SSL) |

Variáveis **específicas do script** (podem ser definidas só no PowerShell ou no `.env`):

| Variável | Uso |
|----------|-----|
| **CREATE_ADMIN_EMAIL** | E-mail do novo admin (default: admin@exemplo.com) |
| **CREATE_ADMIN_NAME** | Nome do usuário (default: Admin) |
| **CREATE_ADMIN_PASSWORD** | Senha em texto plano (obrigatória; mín. 3 caracteres e pelo menos uma letra) |

**Importante:** O **frontend** exige senha com **mínimo 6 caracteres** no login (`frontend-ds-control-main\src\schemas\auth.schema.ts`, linha 5). Para conseguir logar no app publicado, use uma senha com **pelo menos 6 caracteres**.

---

## 2. Comando pronto para PowerShell

Diretório do projeto backend:

`C:\Users\ulyss\AllTech\Projetos - Documentos\DS Control\DS Control_Projeto\backend-ds-control-main`

O script não usa `DATABASE_URL`. A conexão usa **DB_HOST**, **DB_USER**, **DB_PASSWORD**, **DB_NAME** (e opcionalmente **DB_PORT**). Essas variáveis vêm do `.env` na pasta do backend quando você roda o script. Para apontar para o **mesmo banco do backend publicado**, use um `.env` com os mesmos valores de DB_* que o backend em produção usa (ou defina essas variáveis no PowerShell antes de rodar).

Comando completo (substitua apenas `<DEFINIR_SENHA_AQUI>` por sua senha real, com pelo menos 6 caracteres):

```powershell
cd "C:\Users\ulyss\AllTech\Projetos - Documentos\DS Control\DS Control_Projeto\backend-ds-control-main"

$env:CREATE_ADMIN_EMAIL = "ulysses.lima@alltechbr.com"
$env:CREATE_ADMIN_NAME = "Ulysses Lima"
$env:CREATE_ADMIN_PASSWORD = "<DEFINIR_SENHA_AQUI>"

npx tsx scripts/create-admin.ts
```

Se o backend usar um `.env` na mesma pasta, ele será carregado automaticamente (`dotenv/config`). Se você não tiver `.env` e quiser definir tudo no PowerShell (apenas para teste local contra um banco conhecido), pode definir também as variáveis de banco, por exemplo:

```powershell
# Opcional: só se não estiver usando .env com DB_* preenchidos
# $env:DB_HOST = "seu-host"
# $env:DB_USER = "seu-user"
# $env:DB_PASSWORD = "sua-senha-db"
# $env:DB_NAME = "seu-database"
```

---

## 3. Gravação no banco correto

### De onde vêm os dados de conexão

- **Não existe `DATABASE_URL`** neste projeto. A conexão é montada com variáveis separadas em `backend-ds-control-main\src\config\index.ts`:

```9:16:backend-ds-control-main/src/config/index.ts
  DB_HOST: z.string(),
  DB_USER: z.string(),
  DB_PASSWORD: z.string(),
  DB_NAME: z.string(),
  DB_PORT: z
    .string()
    .default("5432")
```

- O script usa o mesmo `env` (linhas 44–49 de `create-admin.ts`): `env.DB_HOST`, `env.DB_PORT`, `env.DB_USER`, `env.DB_PASSWORD`, `env.DB_NAME`. Ou seja, **a mesma fonte que o backend** (arquivo `.env` na pasta do backend quando você executa o script a partir dali).

### Será o mesmo banco do backend publicado?

- **Só se** o ambiente em que você roda o script usar **os mesmos** `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` (e `DB_PORT`, se diferente de 5432) que o backend publicado.
- Se você rodar o script na sua máquina com um `.env` que aponta para o banco de **produção** (o mesmo do backend no ar), o usuário será criado nesse banco e o app publicado passará a enxergá-lo.
- Se rodar com `.env` de desenvolvimento, o usuário será criado só no banco de dev.

### Como validar antes de rodar

1. **Conferir o `.env` do backend** na pasta `backend-ds-control-main`: verificar se `DB_HOST`, `DB_NAME`, `DB_USER` são os do ambiente que o app publicado usa.
2. **Testar conexão com o mesmo banco** (PowerShell), por exemplo:
   - Se tiver `psql`: `psql -h $env:DB_HOST -U $env:DB_USER -d $env:DB_NAME -c "SELECT 1"`
   - Ou um script rápido que use as mesmas variáveis e faça `SELECT 1` (ou `SELECT count(*) FROM users`).
3. **Após rodar o script:** consultar a tabela `users` (por exemplo `SELECT id, email, name, type FROM users WHERE email = 'ulysses.lima@alltechbr.com'`) nesse mesmo banco para confirmar que o registro apareceu.

---

## 4. Validação depois que o usuário foi criado

### Confirmar no banco

No PostgreSQL usado pelo backend (produção ou o que estiver no `.env`):

```sql
SELECT id, name, email, type, created_at
FROM users
WHERE email = 'ulysses.lima@alltechbr.com';
```

- Deve retornar uma linha com `type = 'backoffice'`.

### Confirmar via endpoint / login

1. **Login na API** (substitua `BASE_URL` pela URL base da API do app publicado, ex.: `https://api.dscontrol.com.br/v1` ou a que estiver em `NEXT_PUBLIC_DS_CONTROL_API_URL`):

```powershell
# Exemplo (ajuste BASE_URL)
$body = '{"email":"ulysses.lima@alltechbr.com","password":"<SUA_SENHA>"}' 
Invoke-RestMethod -Uri "BASE_URL/auth/login" -Method Post -Body $body -ContentType "application/json"
```

- Resposta 200 com `accessToken` indica que o backend aceitou o login.
2. **No app publicado:** abrir a URL do front (Amplify), ir na tela de login, usar `ulysses.lima@alltechbr.com` e a senha definida. Se o front estiver configurado com a mesma API, o login deve funcionar.

### Confirmar no app publicado

- Acessar o domínio do app (ex.: Amplify), tela de login.
- E-mail: `ulysses.lima@alltechbr.com`, senha: a que você definiu em `CREATE_ADMIN_PASSWORD`.
- Após login, você deve ser redirecionado ao dashboard (usuário backoffice).

---

## 5. Ações necessárias no app publicado

- **Backend precisa estar online** quando você fizer login no app; o front chama a API para autenticar.
- **CORS:** já configurado no backend; não é preciso alterar nada só por criar um usuário.
- **Frontend apontando para a API correta:** a variável **`NEXT_PUBLIC_DS_CONTROL_API_URL`** no build do Amplify deve ser a URL base do backend (ex.: `https://sua-api.com/v1`). Se já estava correta para outros usuários, continua válida.
- **Não é necessário redeploy do frontend** depois de criar o usuário: a criação é só no backend/banco; o front já sabe como fazer login.

Resumo: garantir que o backend publicado está no ar e que o front foi publicado com `NEXT_PUBLIC_DS_CONTROL_API_URL` apontando para esse backend.

---

## 6. Riscos de não conseguir logar após criar o usuário

| Risco | Como testar |
|-------|--------------|
| **Banco diferente** (script usou outro DB que o backend publicado) | Conferir `DB_*` do `.env` usado no script vs variáveis do backend em produção. Ver se o usuário existe no mesmo banco que o backend usa (query em `users` no banco de prod). |
| **E-mail já existe** | Script encerra com "Já existe usuário com email: ...". Se quiser reutilizar o e-mail, usar "Esqueci minha senha" ou alterar a senha por outro meio. |
| **Senha com menos de 6 caracteres** | Backend aceita (mín. 3 + 1 letra), mas o **frontend** exige mín. 6. Login na API pode funcionar e no app falhar. Use sempre senha com **≥ 6 caracteres**. |
| **Frontend apontando para outra API** | Se `NEXT_PUBLIC_DS_CONTROL_API_URL` no Amplify for outra URL ou estiver vazia, o app chama o lugar errado. Verificar variáveis de ambiente do build no Amplify e testar login pela API diretamente (curl/Invoke-RestMethod) na URL correta. |
| **Backend fora do ar ou erro 5xx** | Testar `BASE_URL/auth/login` com o usuário; ver logs do backend. |
| **Conta com `deleted_at` preenchido** | Se por algum motivo o usuário tiver `deleted_at` não nulo, o login pode ser negado. Verificar `SELECT deleted_at FROM users WHERE email = 'ulysses.lima@alltechbr.com'` (e lógica de login no backend, se filtra por `deleted_at`). |

---

## Comando final para criar o admin agora

Use o bloco abaixo no **PowerShell**. Substitua **apenas** `<DEFINIR_SENHA_AQUI>` pela senha desejada (mínimo **6 caracteres** para funcionar no app publicado). Não compartilhe a senha; defina localmente.

```powershell
cd "C:\Users\ulyss\AllTech\Projetos - Documentos\DS Control\DS Control_Projeto\backend-ds-control-main"

$env:CREATE_ADMIN_EMAIL = "ulysses.lima@alltechbr.com"
$env:CREATE_ADMIN_NAME = "Ulysses Lima"
$env:CREATE_ADMIN_PASSWORD = "<DEFINIR_SENHA_AQUI>"

npx tsx scripts/create-admin.ts
```

- Se aparecer **"Usuário admin criado: ulysses.lima@alltechbr.com"**, o usuário foi criado no banco para o qual o `.env` do backend está apontando.
- Para validar no app publicado: abra o app no navegador, faça login com `ulysses.lima@alltechbr.com` e a mesma senha definida em `CREATE_ADMIN_PASSWORD`.
- Para validar antes de rodar: confira se o `.env` dessa pasta tem os mesmos `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` do backend que o app publicado usa.

Arquivos usados na análise:
- `backend-ds-control-main\scripts\create-admin.ts`
- `backend-ds-control-main\src\config\index.ts`
- `backend-ds-control-main\src\infra\database\index.ts`
- `backend-ds-control-main\src\repositories\users\user.types.ts`
- `backend-ds-control-main\.env.example`
- `frontend-ds-control-main\src\schemas\auth.schema.ts`
- `backend-ds-control-main\src\modules\authentication\dto\login-with-email-and-password.dto.ts`
