# Onde estão os valores de ambiente do backend publicado

Objetivo: localizar os valores reais de ambiente do backend já publicado para usar no script `create-admin.ts` e criar o admin no banco correto.

---

## 1. Variáveis obrigatórias para o script `scripts/create-admin.ts`

O script usa `env` de `backend-ds-control-main\src\config\index.ts`. Ele só precisa das variáveis usadas para **conectar ao PostgreSQL** e ao **bcrypt**:

| Variável | Obrigatória para o script | Uso no script |
|----------|---------------------------|----------------|
| **DB_HOST** | Sim | Conexão PostgreSQL (linha 45) |
| **DB_USER** | Sim | Conexão PostgreSQL (linha 47) |
| **DB_PASSWORD** | Sim | Conexão PostgreSQL (linha 48) |
| **DB_NAME** | Sim | Conexão PostgreSQL (linha 49) |
| **DB_PORT** | Não (default 5432) | Conexão PostgreSQL (linha 46) |
| **BCRYPT_SALT_ROUNDS** | Não (default 10) | Hash da senha (linha 66) |
| **NODE_ENV** | Não | Define se usa SSL na conexão (linha 50: production → SSL) |

As demais (**API_URL**, **HTTP_PORT**, **FRONTEND_URL**, **REDIS_URL**, **RESEND_API_KEY**, **COOKIES_SECRET**, **ACCESS_TOKEN_SECRET**, **REFRESH_TOKEN_SECRET**) **não são usadas** pelo `create-admin.ts`. São necessárias apenas para o servidor HTTP rodando em produção.

---

## 2. Onde o projeto indica ou espera essas variáveis

### Arquivos que existem no repositório

| Arquivo | Conteúdo / finalidade |
|---------|------------------------|
| **backend-ds-control-main\.env.example** | Lista apenas os **nomes** das variáveis (sem valores). Serve de modelo. |
| **backend-ds-control-main\.env** | Existe no projeto (está no `.gitignore`). Normalmente contém valores **locais** (dev). Não é commitado. |
| **backend-ds-control-main\docker-compose.yml** | Define **Postgres e Redis locais** (containers). Variáveis como `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` são para ambiente de desenvolvimento com Docker, **não** para produção. |
| **backend-ds-control-main\Dockerfile** | Só build e run da aplicação. **Não** define variáveis de ambiente. |
| **backend-ds-control-main\.github\workflows\production.ci.yml** | CI/CD que faz build da imagem, push para ECR e deploy no ECS. **Não** define DB_*, nem outras env no YAML. |

Não foi encontrado no repositório:

- `.env.production`
- Arquivo de deploy com valores de produção
- Config de PM2 com env
- Documentação com valores reais de produção

Conclusão: os **valores reais** usados em produção **não estão versionados** no projeto. O backend publicado é implantado na **AWS ECS**; as variáveis de ambiente de produção vêm da **configuração do ECS** (task definition e/ou serviços vinculados), não de arquivos no repo.

---

## 3. Onde o backend em produção está hospedado

O código do repositório indica claramente a hospedagem:

**Arquivo:** `backend-ds-control-main\.github\workflows\production.ci.yml`

Trechos relevantes:

```13:18:backend-ds-control-main/.github/workflows/production.ci.yml
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v1
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
```

```36:55:backend-ds-control-main/.github/workflows/production.ci.yml
      - name: Build, tag, and push image to Amazon ECR
        ...
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          ECR_REPOSITORY: prod-ds-infra-repository
          ...
      - name: Download task definition
        run: |
          aws ecs describe-task-definition --task-definition prod-ds-infra-task \
          --query taskDefinition > task-definition.json
      ...
          task-definition: task-definition.json
          container-name: prod-ds-infra-container
      - name: Deploy Amazon ECS task definition
        ...
          service: prod-ds-infra
          cluster: prod-ds-infra-cluster
```

Resumo:

- **Região AWS:** us-east-1  
- **ECR:** repositório `prod-ds-infra-repository`  
- **ECS:**  
  - cluster: **prod-ds-infra-cluster**  
  - service: **prod-ds-infra**  
  - task definition: **prod-ds-infra-task**  
  - container: **prod-ds-infra-container**  

O backend em produção roda nesse serviço ECS. A URL pública da API depende de como o serviço está exposto (ALB, API Gateway, etc.), e isso não aparece nesse workflow.

---

## 4. Integração com serviços de nuvem

- **AWS ECS (Elastic Container Service):** sim — deploy do backend (imagem no ECR, task e service no ECS).  
- **AWS ECR:** sim — armazenamento da imagem Docker.  
- **Amplify:** não aparece no backend; no projeto, o frontend é que está no Amplify (já mencionado em outros docs).  
- **Elastic Beanstalk, App Runner, Railway, Render, Vercel, Heroku:** não há referência no código do backend.

As variáveis de ambiente do backend publicado ficam na **configuração do ECS**: na task definition **prod-ds-infra-task** (container **prod-ds-infra-container**), seja como variáveis diretas no task definition, seja referenciando **AWS Systems Manager Parameter Store** ou **Secrets Manager**.

---

## 5. Arquivos que você deve abrir para encontrar valores

### No repositório (valores locais ou estrutura)

| Ordem | Arquivo | O que procurar |
|-------|---------|------------------|
| 1 | **backend-ds-control-main\.env** | Valores que você usa **localmente**. Se o backend publicado usar o **mesmo** banco que você usa em dev (improvável em prod), esses DB_* seriam os “reais” para esse cenário. Na prática, .env costuma ser só dev. |
| 2 | **backend-ds-control-main\.env.example** | Apenas a **lista** de variáveis (API_URL, NODE_ENV, DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, etc.). Sem valores reais. |
| 3 | **backend-ds-control-main\.github\workflows\production.ci.yml** | Confirmação do **onde** está publicado (ECS, cluster, service, task, container). Não contém valores de DB_* nem de outros secrets. |

### Fora do repositório (valores reais de produção)

Os valores reais do backend **publicado** não estão em arquivos do projeto. Eles estão em:

- **Console AWS:**  
  ECS → Clusters → **prod-ds-infra-cluster** → Services → **prod-ds-infra** → Task definition **prod-ds-infra-task** → Aba do container **prod-ds-infra-container** → Environment variables (e Secrets, se houver).
- **AWS CLI:**  
  Usar os comandos abaixo para inspecionar a task definition e ver as variáveis (e referências a secrets) que o container de produção usa.

---

## Melhor caminho para obter os valores reais agora

### Objetivo

Obter **DB_HOST**, **DB_USER**, **DB_PASSWORD**, **DB_NAME** (e, se existir, **DB_PORT**) do **mesmo** ambiente que o backend publicado usa, para rodar `create-admin.ts` contra o banco correto.

### Onde procurar primeiro

1. **AWS ECS (recomendado para produção)**  
   - Quem configurou o backend em produção deve ter definido as variáveis na task definition do ECS ou em Parameter Store/Secrets Manager.  
   - Console: **AWS ECS** → região **us-east-1** → cluster **prod-ds-infra-cluster** → serviço **prod-ds-infra** → task definition **prod-ds-infra-task** → container **prod-ds-infra-container** → Environment variables (e Secrets).  
   - Anote os valores de **DB_HOST**, **DB_USER**, **DB_PASSWORD**, **DB_NAME**, **DB_PORT** (se existir). Se estiverem como secrets (ex.: ARN do Secrets Manager), abra o secret correspondente no console da AWS para ver o conteúdo (ou use CLI).

2. **Arquivo .env local (só se for o mesmo banco)**  
   - Abra **backend-ds-control-main\.env** (ele existe e está no .gitignore).  
   - Se esse backend em produção foi configurado para usar o **mesmo** banco que o seu .env local (ex.: um RDS compartilhado), então os **DB_*** do .env já são os “reais” para esse cenário.  
   - Se produção usa outro banco (o mais comum), os valores do .env **não** são os do ambiente publicado.

3. **Quem fez o deploy**  
   - Quem configurou o ECS (task definition, Parameter Store, Secrets Manager) tem os valores ou acesso para vê-los.  
   - Peça a essa pessoa: “Quais são **DB_HOST**, **DB_USER**, **DB_PASSWORD**, **DB_NAME** (e **DB_PORT** se aplicável) usados pelo serviço ECS **prod-ds-infra** / task **prod-ds-infra-task**?”.

### Como obter via AWS CLI (se tiver permissão)

```bash
# Task definition completa (incluindo env e secrets do container)
aws ecs describe-task-definition --task-definition prod-ds-infra-task --region us-east-1 --query "taskDefinition.containerDefinitions[?name=='prod-ds-infra-container'].{environment:environment,secrets:secrets}" --output json
```

Se as variáveis estiverem em **Secrets Manager**, use o nome/ARN retornado em `secrets` para buscar o valor do secret no console ou com `aws secretsmanager get-secret-value`.

### Depois de ter os valores

1. No diretório do backend, crie ou edite o **.env** (ou exporte no terminal) com esses **DB_*** (e, se quiser, **NODE_ENV=production** e **BCRYPT_SALT_ROUNDS=10**).  
2. Rode o script com as variáveis do admin (CREATE_ADMIN_EMAIL, CREATE_ADMIN_NAME, CREATE_ADMIN_PASSWORD), como no documento **CRIAR_ADMIN_E_VALIDAR_APP.md**.  
3. O script usará o mesmo `env` do backend e gravará no banco ao qual essas variáveis apontam — ou seja, no banco correto do backend publicado, se os valores forem os de produção.

### Resumo

- **Obrigatórias para o script:** **DB_HOST**, **DB_USER**, **DB_PASSWORD**, **DB_NAME**. Opcionais: **DB_PORT**, **BCRYPT_SALT_ROUNDS**, **NODE_ENV**.  
- **No projeto:** só há **.env.example** (nomes) e **.env** (geralmente dev; pode ser prod só se for o mesmo banco).  
- **Produção:** backend está na **AWS ECS** (cluster **prod-ds-infra-cluster**, service **prod-ds-infra**, task **prod-ds-infra-task**, container **prod-ds-infra-container**).  
- **Onde ver os valores reais:** Console ECS (task definition / container) ou AWS CLI em cima de **prod-ds-infra-task**; se usar Parameter Store/Secrets Manager, abrir o recurso correspondente.  
- **Melhor caminho:** obter **DB_*** da task definition (ou secrets) do ECS em **us-east-1** e usar esses valores no .env (ou no ambiente) ao rodar **scripts/create-admin.ts**.

Arquivos usados na análise:
- `backend-ds-control-main\scripts\create-admin.ts`
- `backend-ds-control-main\src\config\index.ts`
- `backend-ds-control-main\.env.example`
- `backend-ds-control-main\.gitignore`
- `backend-ds-control-main\docker-compose.yml`
- `backend-ds-control-main\Dockerfile`
- `backend-ds-control-main\.github\workflows\production.ci.yml`
