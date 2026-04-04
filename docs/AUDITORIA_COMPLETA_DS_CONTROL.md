# AUDITORIA COMPLETA DS CONTROL

**Escopo:** monorepo na raiz — `frontend-ds-control-main` (Next.js backoffice web), `backend-ds-control-main` (API Fastify), `app-ds-control-main` (Expo/React Native).  
**Data da auditoria (código):** 2026-04-03.  
**Fonte:** ficheiros do repositório; **não** há execução de testes E2E, chamadas HTTP a produção ou inspeção de runtime do browser neste documento. Onde isso for necessário, está marcado como **não confirmado no código**.

---

## 1. Visão geral da arquitetura

### Stack do frontend (backoffice web — `frontend-ds-control-main`)

| Aspeto | Detalhe (evidência: `package.json`) |
|--------|--------------------------------------|
| Framework | Next.js 15.3.3, App Router (`src/app/**`) |
| UI | React 19, Tailwind CSS 4, Radix UI, `lucide-react` |
| Dados remotos | TanStack Query 5 |
| Formulários | `react-hook-form`, Zod (`@hookform/resolvers`) |
| Mapas | `mapbox-gl`, `react-map-gl` (entrada `react-map-gl/mapbox`), estilo `mapbox://styles/mapbox/satellite-streets-v12` |
| Relatórios | `@react-pdf/renderer` |
| Geo / ficheiros | `@tmcw/togeojson`, `xmldom` |

### Stack do backend (`backend-ds-control-main`)

| Aspeto | Detalhe |
|--------|---------|
| HTTP | Fastify 5 |
| Validação / OpenAPI | `fastify-zod-openapi`, Zod |
| ORM | Drizzle ORM + driver `pg` |
| Auth | JWT (`jose`), cookies httpOnly (`@fastify/cookie`) |
| Cache / rate limit | Redis (`@fastify/redis`, `ioredis`, `@fastify/rate-limit`) |
| Jobs | BullMQ, `@fastify/schedule` |
| Email | Resend |
| Build | SWC (`@swc/core`) → `build/` |

### Banco de dados

- **SGBD:** PostgreSQL (variáveis `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT` em `backend-ds-control-main/src/config/index.ts`).
- **Definição de esquema:** `backend-ds-control-main/src/infra/database/schema/` — inclui entre outros `routes.schema.ts`, `farms.schema.ts`, `plot.schema.ts`, `user.schema.ts`, `applications.schema.ts`, `service_order.schema.ts`, `contract.schema.ts`, tabelas de junção de ordens de serviço, etc.

### Serviços externos (rastreados no código)

| Serviço | Uso |
|---------|-----|
| **Mapbox** | Tiles/estilos GL; API Static Images para miniaturas em PDF (`ApplicationsReportPDF.tsx`). |
| **Resend** | Envio de email (reset de password, etc.) — `src/infra/resend/`. |
| **AWS** | CI: ECR + ECS (`us-east-1`) via `.github/workflows/backend-production.yml`. |
| **Google Looker Studio** | Iframe em `src/app/dashboard/metrics/page.tsx` (URL fixa no código). |

**Não** há no código analisado: Google Maps, Leaflet, OpenStreetMap direto, APIs Mapbox Directions/Geocoding dedicadas, ou analytics tipo GA em `frontend-ds-control-main/src`.

### Fluxo de deploy identificado

- **Backend:** `.github/workflows/backend-production.yml` — `push` em `main` com alterações em `backend-ds-control-main/**` ou no próprio workflow: `docker build` em `./backend-ds-control-main`, push para repositório ECR `dscontrol_new`, `aws ecs update-service` em cluster `dscontrol-new-cluster`, serviço `dscontrol-new-isolado`.
- **Frontend web:** **não confirmado no código** um workflow GitHub para o Next; deploy em **Amplify** é contexto de negócio referido pelo utilizador, não há `amplify.yml` na raiz analisada nesta auditoria.

### Principais configurações do projeto

| Área | Ficheiro / nota |
|------|-----------------|
| Next | `frontend-ds-control-main/next.config.ts` — configuração mínima (export default vazio de opções). |
| TypeScript | `frontend-ds-control-main/tsconfig.json` (não expandido linha a linha neste doc). |
| Tailwind | `tailwindcss` 4 + PostCSS (`package.json`). |
| API base URL | `frontend-ds-control-main/src/lib/config.ts` — `NEXT_PUBLIC_DS_CONTROL_API_URL` com `normalizeApiUrl`. |
| Backend env | `backend-ds-control-main/src/config/index.ts` — `envSchema.parse(process.env)`. |
| Entrada servidor | `backend-ds-control-main/src/server.ts` — importa `app.module` e módulos `*module.ts`. |
| Mobile | `app-ds-control-main/app.config.ts` — Expo; tokens Mapbox para download de SDK nativo. |

### Variáveis de ambiente relevantes (resumo; lista completa na secção 9)

- **Frontend web:** `NEXT_PUBLIC_DS_CONTROL_API_URL`, `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`.
- **Backend:** `DB_*`, `REDIS_URL`, `COOKIES_SECRET`, `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `RESEND_API_KEY`, `FRONTEND_URL`, `HTTP_PORT`, etc.
- **Mobile:** `EXPO_PUBLIC_DS_CONTROL_API_URL`, `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`, `EXPO_PUBLIC_MAPBOX_DOWNLOADS_TOKEN`.

> **Complemento operacional (ETAPA 2):** tabela de leitura, fallbacks e impacto na UI — ver **§ ETAPA 2 — Complemento operacional — ambiente publicado** (fim do documento).

---

## 2. Mapeamento completo das rotas do frontend

**Convenção:** rotas = caminhos URL do Next.js App Router em `frontend-ds-control-main/src/app`.

**Layouts**

- Raiz: `src/app/layout.tsx` — `ThemeProvider`, `QueryProvider`, `AuthProvider`, `Toaster`, `lang="pt-BR"`.
- Auth: `src/app/auth/layout.tsx`.
- Dashboard: `src/app/dashboard/layout.tsx` — `'use server'`, `SidebarProvider`, `Sidebar`, `BreadcrumbHeader`, **`AuthGuard`**.

**Proteção global do dashboard:** `src/guards/auth.guard.tsx` — se autenticado e **não** for rota de login e `user?.type !== UserType.BACKOFFICE`, redireciona para `/forbidden`; se não autenticado e não for rota `/auth`, redireciona para `/auth/login`.

**Contextos:** `AuthProvider` (`src/providers/auth.provider.tsx`) — `user`, `isAuthenticated`, `loading`, `setUser`, `refreshUser`. **TanStack Query** — `QueryProvider` (`src/providers/query.provider.tsx`).

**Sidebar / nomes de menu:** `src/types/path.type.ts` (`pathItems`); componente `src/components/Sidebar.tsx`.

Legenda de **status:** **funcionando** = fluxo coerente no código; **parcialmente funcionando** = depende de API, env ou dados; **quebrada** = bloqueio claro no código sem env; **N/A** = placeholder.

### 2.1 Rotas públicas / auth

| Caminho | Nome da tela | Componente (`page.tsx`) | Ficheiro | Principais ficheiros | Layout | Proteção | Hooks / context | APIs (serviços) | Dependências externas | Status | Observações |
|---------|--------------|-------------------------|----------|------------------------|--------|----------|-----------------|-----------------|----------------------|--------|-------------|
| `/` | Redirecionamento | `Home` | `src/app/page.tsx` | `useRouter` | raiz | — | — | Nenhuma (só `router.replace('/dashboard')`) | — | parcialmente funcionando | Depende de auth no destino. |
| `/auth/login` | Login | default export | `src/app/auth/login/page.tsx` | `LoginForm.tsx` | `auth/layout` | Pública | `useAuth`, `useLogin` | `POST /auth/login`, `getMe` → `GET /users/me` | API backend | parcialmente funcionando | Só backoffice segue para `/dashboard` (`LoginForm`). |
| `/auth/forgot-password` | Esqueci senha | default | `src/app/auth/forgot-password/page.tsx` | formulários / `user.service` | auth | Pública | — | password reset request | Resend (backend) | parcialmente funcionando | |
| `/auth/forgot-password/callback` | Callback reset | default | `src/app/auth/forgot-password/callback/page.tsx` | `useResetPassword` | auth | Pública | — | `POST /users/reset-password` (conforme mutation) | — | parcialmente funcionando | |

### 2.2 Rotas `/dashboard/*` (todas: `dashboard/layout.tsx` + `AuthGuard`)

| Caminho | Nome (sidebar / página) | Componente | Ficheiro `page.tsx` | Principais ficheiros | Hooks / context típicos | APIs (padrão) | Deps externas | Status |
|---------|-------------------------|-------------|----------------------|------------------------|-------------------------|---------------|---------------|--------|
| `/dashboard` | Painel | default | `dashboard/page.tsx` | componentes de stats | `useGetStatsApplications`, `useGetStatsServiceorders` | `/applications/stats`, `/service-orders/stats` (via queries) | — | parcialmente funcionando |
| `/dashboard/map` | Mapa | `MapPage` | `dashboard/map/page.tsx` | `MapContent`, `DialogPlotDetails`, `SearchableSelectQuery` | `useQueries`, infinite queries | `GET /farms`, `GET /customers`, `getFarmById` | **Mapbox** | parcialmente funcionando |
| `/dashboard/farms` | Fazendas | default | `dashboard/farms/page.tsx` | tabelas/forms farm | queries farm | `/farms` | Mapbox em forms | parcialmente funcionando |
| `/dashboard/applications` | Aplicações | default | `dashboard/applications/page.tsx` | tabelas application | queries | `/applications` | — | parcialmente funcionando |
| `/dashboard/customers` | Clientes | default | `dashboard/customers/page.tsx` | — | customer queries | `/customers` | — | parcialmente funcionando |
| `/dashboard/customers/[idCustomer]` | Detalhe cliente | default | `dashboard/customers/[idCustomer]/page.tsx` | múltiplas tabelas | várias queries | customers, farms, contracts, applications, service-orders | — | parcialmente funcionando |
| `/dashboard/contracts` | Contratos | default | `dashboard/contracts/page.tsx` | — | contract queries | `/contracts` | — | parcialmente funcionando |
| `/dashboard/routes` | **Rotas** | `RoutesPage` | `dashboard/routes/page.tsx` | **`TableRoutes`**, `FormRegisterNewRoute` | `useGetAllRoutes`, `useDeleteRouteById`, filtros | **`GET /routes`**, `DELETE /routes/:id`, create/update via mutations | **Mapbox** na linha expandida (`MapViewer`) | parcialmente funcionando | Ver secção 7. |
| `/dashboard/service-orders` | Ordens de Serviços | default | `dashboard/service-orders/page.tsx` | — | stats SO | `/service-orders/stats` | — | parcialmente funcionando |
| `/dashboard/service-orders/[idServiceOrder]` | Detalhe OS | default | `dashboard/service-orders/[idServiceOrder]/page.tsx` | — | `useGetServiceOrderById`, applications | `/service-orders/:id`, `/applications` | — | parcialmente funcionando |
| `/dashboard/users` | Usuários | default | `dashboard/users/page.tsx` | — | user queries | `/users` | — | parcialmente funcionando |
| `/dashboard/backoffice` | Administradores | default | `dashboard/backoffice/page.tsx` | — | users tipo admin | `/users` | — | parcialmente funcionando |
| `/dashboard/farmers` | Fazendeiros | default | `dashboard/farmers/page.tsx` | — | user queries | `/users` | — | parcialmente funcionando |
| `/dashboard/pilots` | Pilotos | default | `dashboard/pilots/page.tsx` | — | user queries | `/users` | — | parcialmente funcionando |
| `/dashboard/assistant` | Ajudantes | default | `dashboard/assistant/page.tsx` | — | assistant | `/assistants` | — | parcialmente funcionando |
| `/dashboard/drones` | Drones | default | `dashboard/drones/page.tsx` | — | drone | `/drones` | — | parcialmente funcionando |
| `/dashboard/products` | Produtos | default | `dashboard/products/page.tsx` | — | product | `/products` | — | parcialmente funcionando |
| `/dashboard/culture-types` | Tipos de Cultura | default | `dashboard/culture-types/page.tsx` | — | culture-type | `/culture-types` | — | parcialmente funcionando |
| `/dashboard/account` | Minha Conta | `AccountPage` | `dashboard/account/page.tsx` | `FormEditCurrentUser`, `FormChangePassword` | `useAuth` | `PUT /users/me`, `PUT /users/me/password` | — | parcialmente funcionando |
| `/dashboard/configurations` | (placeholder) | default | `dashboard/configurations/page.tsx` | — | — | Nenhuma | — | parcialmente funcionando | Texto: “indisponíveis na versão de testes”. |
| `/dashboard/metrics` | Métricas (iframe) | default | `dashboard/metrics/page.tsx` | iframe Looker | — | Nenhuma | **Google Looker Studio** | parcialmente funcionando | **Não** está em `pathItems` (trecho comentado em `path.type.ts`). |

### 2.3 Outras rotas (raiz `app`)

| Caminho | Nome | Ficheiro | Proteção | APIs | Status |
|---------|------|----------|----------|------|--------|
| `/forbidden` | Acesso negado | `forbidden/page.tsx` | — | `useLogout` | funcionando |
| `/generate-report` | Gerar relatório | `generate-report/page.tsx` | — | applications, service-order | parcialmente funcionando |
| `/preview-report` | Preview | `preview-report/page.tsx` | — | — | parcialmente funcionando |
| `/preview-report-html` | Preview HTML | `preview-report-html/page.tsx` | — | — | parcialmente funcionando |

### 2.4 Route Handlers Next (API interna)

| Caminho Next | Ficheiro | Finalidade |
|--------------|----------|------------|
| `/api/file-converter` | `src/app/api/file-converter/route.ts` | Conversão de ficheiros (ex.: fazenda) |
| `/api/file-converter-route` | `src/app/api/file-converter-route/route.ts` | Conversão para entidade rota |

Usados por `src/services/file.service.ts` — **não** são os endpoints REST `/v1/routes` do backend.

---

## 3. Mapeamento completo das rotas/endpoints do backend

**Prefixos:** cada `*module.ts` regista `RouteV1Routes` (etc.) com `prefix: '/v1/<recurso>'` (ex.: `route.module.ts` → `/v1/routes`).

**Autenticação:** `AuthenticationJWT` (`src/middleware/authentication-jwt-middleware.ts`) — lê `Authorization: Bearer` ou cookie `@ds-drones/access_token`; valida JWT com `ACCESS_TOKEN_SECRET`.

**Exceções sem JWT** (sem `preHandler: [AuthenticationJWT]` nos ficheiros de rotas analisados): `POST /v1/auth/login`, `POST /v1/auth/refresh-token`, `POST /v1/auth/logout`; `POST /v1/users/reset-password`; `POST /v1/users/request-password-reset`; `GET /` health em `app.routes.ts`.

**Payloads / respostas:** schemas Zod em `src/modules/<domínio>/dto/*.ts`; documentação Swagger em `/documentation` (registo em `app.module.ts`).

### 3.1 Catálogo por módulo (caminho HTTP completo = `https://<host>` + tabela)

| Método | Caminho completo | Ficheiro | Handler (método do controller) | JWT | Notas |
|--------|------------------|----------|-------------------------------|-----|-------|
| GET | `/v1/auth` — *não existe* | — | — | — | Auth só nos subcaminhos abaixo |
| POST | `/v1/auth/login` | `authentication.routes.ts` | `loginWithEmailAndPassword` | Não | Body: `LoginWithEmailAndPasswordSchema` |
| POST | `/v1/auth/refresh-token` | idem | `refreshToken` | Não | Usa cookie refresh |
| POST | `/v1/auth/logout` | idem | `logout` | Não | Usa cookie refresh |
| GET | `/v1/users/` | `user.routes.ts` | `listUsers` | Sim | Query: `GetUserQueryStringSchema` |
| GET | `/v1/users/:id` | idem | `getUserById` | Sim | **Ordem:** declarado **antes** de `GET /me` no ficheiro — ver risco na secção 10 |
| POST | `/v1/users/register` | idem | `createUser` | Sim | |
| POST | `/v1/users/reset-password` | idem | `resetPassword` | Não | |
| POST | `/v1/users/request-password-reset` | idem | `requestPasswordReset` | Não | |
| GET | `/v1/users/me` | idem | `getMe` | Sim | |
| PUT | `/v1/users/me` | idem | `updateMe` | Sim | |
| PUT | `/v1/users/me/password` | idem | `changePassword` | Sim | |
| PUT | `/v1/users/:id` | idem | `updateUser` | Sim | |
| DELETE | `/v1/users/:id` | idem | `deleteUser` | Sim | |
| POST | `/v1/users/:id/activate` | idem | `activateUser` | Sim | |
| GET | `/v1/customers/` | `customer.routes.ts` | (list) | Sim | |
| POST | `/v1/customers/` | idem | (create) | Sim | |
| GET | `/v1/customers/:id` | idem | (get) | Sim | |
| PUT | `/v1/customers/:id` | idem | (update) | Sim | |
| DELETE | `/v1/customers/:id` | idem | (delete) | Sim | |
| GET | `/v1/farms/` | `farm.routes.ts` | list | Sim | |
| POST | `/v1/farms/` | idem | create | Sim | |
| GET | `/v1/farms/allfarms` | idem | getAllFarms literal | Sim | |
| GET | `/v1/farms/:id` | idem | getById | Sim | |
| GET | `/v1/farms/customer/:customerId` | idem | by customer | Sim | |
| PUT | `/v1/farms/:id` | idem | update | Sim | |
| DELETE | `/v1/farms/:id` | idem | delete | Sim | |
| GET | `/v1/plots/` | `plot.routes.ts` | — | Sim | |
| POST | `/v1/plots/` | idem | — | Sim | |
| GET | `/v1/plots/:id` | idem | — | Sim | |
| GET | `/v1/plots/farm/:farmId` | idem | — | Sim | |
| GET | `/v1/plots/customer/:customerId` | idem | — | Sim | |
| PUT | `/v1/plots/:id` | idem | — | Sim | |
| DELETE | `/v1/plots/:id` | idem | — | Sim | |
| GET | `/v1/routes/` | **`route.routes.ts`** | **`listRoutes`** | Sim | Query: `ListRoutesQueryStringSchema` (paginação + filtros) — **usado pelo frontend `getAllRoutes`** |
| POST | `/v1/routes/` | idem | `createRoute` | Sim | Body: `CreateRouteSchema` |
| GET | `/v1/routes/allroutes` | idem | `getAllRoutes` | Sim | Query: `GetAllRoutesQueryStringSchema` — **outro contrato** que o list paginado |
| GET | `/v1/routes/:id` | idem | `getRouteById` | Sim | |
| GET | `/v1/routes/farm/:farmId` | idem | `getRoutesByFarmId` | Sim | |
| GET | `/v1/routes/customer/:customerId` | idem | `getRoutesByCustomerId` | Sim | |
| PUT | `/v1/routes/:id` | idem | `updateRoute` | Sim | |
| DELETE | `/v1/routes/:id` | idem | `deleteRoute` | Sim | |
| GET | `/v1/contracts/` | `contract.routes.ts` | — | Sim | |
| POST | `/v1/contracts/` | idem | — | Sim | |
| GET | `/v1/contracts/:id` | idem | — | Sim | |
| GET | `/v1/contracts/customer/:customerId` | idem | — | Sim | |
| PUT | `/v1/contracts/:id` | idem | — | Sim | |
| DELETE | `/v1/contracts/:id` | idem | — | Sim | |
| GET/POST/PUT/DELETE/PATCH | `/v1/applications/...` | `application.routes.ts` | vários | Sim (rotas analisadas) | Inclui `/summary`, `/performance`, `/stats`, `/dashboard-metrics`, filtros por customer, pilot, farm, service-order, plot |
| GET/POST/PUT/PATCH | `/v1/service-orders/...` | `service-order.routes.ts` | vários | Sim | Inclui `/my-open-orders`, `/stats`, `/:id/status` |
| GET/POST/PUT/DELETE | `/v1/drones/...` | `drone.routes.ts` | vários | Sim | Inclui `/operation` |
| GET/POST/PUT/DELETE | `/v1/products/...` | `product.routes.ts` | vários | Sim | |
| GET/POST/PUT/DELETE | `/v1/culture-types/...` | `culture-type.routes.ts` | vários | Sim | Inclui `/stats` |
| GET/POST/PUT/DELETE | `/v1/assistants/...` | `assistant.routes.ts` | vários | Sim | |
| GET | `/` | `app.routes.ts` | health | Não | |

**Serviços / repositórios:** cada controller delega a `*Service` em `src/modules/<domínio>/services/`, que usa `*Repository` ou `db` em `src/repositories/**` e `src/infra/database`.

**Integrações externas acionadas pelos endpoints:** principalmente **Resend** em fluxos de utilizador (password reset) — chamadas feitas dentro dos serviços; **não** há chamadas Mapbox no backend.

---

## 4. Fluxo de autenticação e sessão

| Etapa | Implementação |
|-------|----------------|
| Login | `POST /v1/auth/login` — `authentication.controller.ts` define cookies httpOnly + body `{ accessToken }`. |
| Armazenamento no cliente | `auth.service.ts` grava `accessToken` em `localStorage` (`AUTH_ACCESS_TOKEN_KEY = 'ds-control-access-token'`). |
| Chamadas API | `api.service.ts` — header `Authorization: Bearer <token>`; `credentials: 'include'` para cookies. |
| Refresh | Em `401`, `POST /v1/auth/refresh-token` com cookies; resposta `{ accessToken }` atualiza `localStorage`. |
| Utilizador atual | `AuthProvider` chama `getMe()` → `GET /v1/users/me` (via `user.service.ts`). |
| Logout | `POST /v1/auth/logout`; `auth.service.ts` limpa storage e redireciona. |
| Guard frontend | `AuthGuard` — só `UserType.BACKOFFICE` no dashboard. |
| Guard backend | `AuthenticationJWT` em quase todas as rotas `/v1/*` exceto as listadas na secção 3. |

**Dependência front/back:** o frontend assume `NEXT_PUBLIC_DS_CONTROL_API_URL` apontando para a origem onde o Fastify expõe `/v1` (ex.: `https://api.exemplo.com/v1`). O backend assume `FRONTEND_URL` e secrets JWT/cookies coerentes com o domínio do cliente para cookies (mesmo site / CORS com `credentials`).

---

## 5. APIs e integrações externas

| Nome | Onde | Ficheiros | Finalidade | Variável | Risco | Status |
|------|------|-----------|------------|----------|-------|--------|
| API própria (REST) | Todo o backoffice | `src/services/*.service.ts` | CRUD domínio | `NEXT_PUBLIC_DS_CONTROL_API_URL` | URL errada → todas as telas falham | crítico se env errada |
| Mapbox GL | Mapas interativos | `MapViewer.tsx`, `MapContent.tsx`, `map/page.tsx`, forms | Mapa satélite + GeoJSON | `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` | Sem token → sem basemap | **principal causa de mapas “mortos” em produção** |
| Mapbox Static API | PDF | `ApplicationsReportPDF.tsx` | Imagem estática `api.mapbox.com/styles/.../static/...` | `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` | Falha em runtime se token inválido | parcial |
| Resend | Backend email | `src/infra/resend/` | Emails transacionais | `RESEND_API_KEY` | Default no schema pode ser inadequado | ver secção 10 |
| AWS ECR/ECS | CI | `.github/workflows/backend-production.yml` | Deploy imagem | Secrets GitHub | IAM | operacional |
| Looker Studio | Métricas | `dashboard/metrics/page.tsx` | iframe | — | bloqueios de iframe / URL | depende do Google |

**Bibliotecas críticas:** `mapbox-gl`, `react-map-gl`, `drizzle-orm`, `fastify`, `jose` (JWT).

---

## 6. Banco de dados e camada de dados

- **ORM:** Drizzle; definições em `src/infra/database/schema/`; `db` exportado em `src/infra/database/index.ts` (inferido pelo uso nos repositórios).
- **Tabelas / entidades:** ver ficheiros `*.schema.ts` (users, customers, farms, plots, **routes**, applications, service_orders, contracts, drones, products, culture_types, assistants, tokens, junções).
- **Relações relevantes para “Rotas”:** tabela `routes` com `farmId`, `customerId`, coluna `geoJson` (schema `routes.schema.ts` — não expandido aqui linha a linha).
- **Repositories:** ex. `RouteRepository` — `getAllRoutesWithRelations` usado pela listagem; **`includeGeoJson` na assinatura não é usado para omitir colunas** — `formatRoute` devolve sempre `geoJson` (evidência em `route.repository.ts`).
- **Pontos de inconsistência:** se o contrato OpenAPI disser que `includeGeoJson=false` omite dados, o comportamento real **não** omite — possível confusão e payload grande; **não** quebra listagem por ausência de GeoJSON.

---

## 7. Auditoria específica da funcionalidade “Rotas”

### Declaração no frontend

- **Menu:** `path.type.ts` — título **“Rotas”**, `url: '/dashboard/routes'`.
- **Rota URL:** `/dashboard/routes`.
- **Página:** `src/app/dashboard/routes/page.tsx` — export default `RoutesPage` — título “Rotas”, `TableRoutes`, diálogo `FormRegisterNewRoute`.

### Componentes e ficheiros

| Papel | Ficheiro |
|-------|----------|
| Página | `src/app/dashboard/routes/page.tsx` |
| Tabela + filtros + expansão | `src/components/Tables/TableRoutes.tsx` |
| Criar | `src/components/Forms/FormRegisterNewRoute.tsx` |
| Editar | `src/components/Forms/FormEditRoute.tsx` |
| API cliente | `src/services/route.service.ts` |
| Query | `src/queries/route.query.ts` — `useGetAllRoutes` |
| Mutations | `src/mutations/route.mutation.ts` |

### Hooks / estado

- `useQuery` via `useGetAllRoutes` com parâmetros (paginação, filtros, `orderBy`/`orderType`).
- Estado local: página, tamanho de página, pesquisa debounced, filtros cliente/fazenda, diálogos delete/edit, linhas expandidas (`expandedRows`).
- **Contexto:** não há `RouteContext` dedicado; usa `AuthProvider` implicitamente (token no `api.service`).

### APIs consumidas (cliente HTTP)

- **Listagem:** `GET` relativo **`/routes`** → com base URL vira **`/v1/routes/`** (listagem paginada) — `RouteController.listRoutes` → `RouteService.listRoutes` → `RouteRepository.getAllRoutesWithRelations`.
- **DELETE:** `/routes/:id`
- **POST/PUT:** criação/edição conforme `route.mutation` e schemas em `src/schemas/route.schema.ts`

### Dependência de mapa

- **Sim, parcial:** a listagem em si **não** exige mapa; o mapa aparece **apenas** na **linha expandida** (`renderExpandedRow`) com `<MapViewer geoData={route.geoJson} />`.
- **Geolocalização do browser:** **não** há `navigator.geolocation` neste fluxo — **não confirmado no código** uso de GPS na tela Rotas.

### Dependência de serviço externo

- **Mapbox** para a pré-visualização na expansão (e para formulários de rota que usam `MapViewer`).
- **Backend** para dados tabulares.

### Comportamento esperado pelo código

1. Carregar tabela com `data`, `page`, `totalPages`, `totalCount` na resposta JSON do list (controller envolve com `message` + spread do resultado paginado).
2. Permitir filtrar, ordenar, paginar, editar, eliminar.
3. Ao expandir linha, mostrar mapa com GeoJSON da rota.

### Comportamento atual identificado (causas de falha **no código**)

| Causa | Evidência |
|-------|-----------|
| Falha de **fetch** (API inatingível ou URL inválida) | `getAllRoutes` lança se `!response.ok`; `DataTable` mostra `isError` |
| **`NEXT_PUBLIC_DS_CONTROL_API_URL`** ausente/errada | `getConfig('apiUrl')` undefined ou host errado — **não confirmado no código** o valor em produção |
| Mapa na expansão invisível | `MapViewer` sem `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` — mostra mensagem **após correções** (secção 11); antes, mapa podia falhar silenciosamente |
| Retry inoperante | Corrigido: `invalidateQueries({ queryKey: ['routes'] })` |

**Conclusão:** a “guia Rotas” **depende do backend responder** à listagem e do **token Mapbox** para a parte de mapa na expansão. A causa **mais frequente** em app já publicado para “nada funcionar” no mapa é **env** (API URL + Mapbox). **Código morto:** não identificado rota frontend órfã para rotas — existe correspondência com `GET /v1/routes/`.

> **Validação de runtime — tela Rotas (ETAPA 2):** fluxo ponta a ponta e o que só se confirma no browser/host — ver **§ ETAPA 2 — Validação de runtime — tela “Rotas”**.

---

## 8. Auditoria específica da exibição de mapas

### Biblioteca

- **mapbox-gl** + **react-map-gl** (import `react-map-gl/mapbox`).

### Componentes

- `MapViewer.tsx` — componente único reutilizado na maior parte dos casos.
- `MapContent.tsx` — camadas GeoJSON (`Source`, `Layer`), lógica `fitBounds`, interação com `uploaded-layer`.
- `dashboard/map/page.tsx` — instancia `Map` diretamente (não via `MapViewer`).

### Páginas / fluxos com mapa

- `/dashboard/map`
- Formulários: `FormRegisterNewFarm`, `FormEditFarm`, `FormRegisterNewRoute`, `FormEditRoute`, `FormRegisterNewServiceOrder`
- `DialogPlotDetails`
- `TableRoutes` (expansão)
- PDF: `ApplicationsReportPDF.tsx` (imagem estática Mapbox)

### Serviços externos

- **Mapbox** — tiles vectoriais e API Static (PDF). **Não** há no repositório web chamadas a **directions**, **geocoding** ou **routing** Mapbox.

### Checklist solicitado

| Tópico | Conclusão (código) |
|--------|-------------------|
| Chave API | **Obrigatória:** `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` (build-time Next). |
| CORS | API própria: CORS permissivo no Fastify; tiles Mapbox: domínio Mapbox. |
| Erro de import | **Não** identificado — imports `mapbox-gl/dist/mapbox-gl.css` presentes. |
| Provider/context Mapbox | Não usa `MapProvider` global; usa `Map` de `react-map-gl` + `useMap()` dentro de `MapContent` como filho de `Map`. |
| SSR/hydration | Componentes `'use client'`; Mapbox só no cliente. |
| CSS / tamanho | `Map` com `width/height` 100%; contentores pais definem altura (ex.: 400px na expansão). |
| Coordenadas inválidas | `fitBounds` protegido com `!bounds.isEmpty()` **após correção**; MultiLineString tratada **após correção**. |
| Versão biblioteca | `package.json` — pinadas; **não confirmado no código** incompatibilidade real. |
| Chamadas front quebradas | Falha principalmente por **env** ou **API**; não por endpoint Mapbox custom no back. |
| Backend | **Não** serve tiles; não é necessário suporte backend para o mapa GL. |
| Silêncio / fallback | **Correção:** mensagem explícita sem token; antes podia ser “mapa branco”. |

### Sintomas / causa raiz / ficheiros / correções

- **Sintoma:** mapas em branco ou inutilizáveis em produção.
- **Causa raiz 1:** `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` não injetado no build do hosting.
- **Causa raiz 2 (geometria):** `MultiLineString` e bounds vazios — **corrigido** em `MapContent.tsx`.
- **Ficheiros:** `MapViewer.tsx`, `dashboard/map/page.tsx`, `MapContent.tsx`, `ApplicationsReportPDF.tsx`.

> **Validação de runtime — mapas (ETAPA 2):** causas prováveis em ambiente publicado e evidência em falta — ver **§ ETAPA 2 — Validação de runtime — mapas**.

---

## 9. Variáveis de ambiente (lista encontrada no repositório)

### `frontend-ds-control-main`

| Variável | Classificação sugerida |
|----------|-------------------------|
| `NEXT_PUBLIC_DS_CONTROL_API_URL` | Obrigatória (funcional); backend/API; suspeita se falta em produção |
| `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` | Obrigatória para mapas; relacionada a mapas; suspeita em produção se mapas falham |

*(Apenas estas duas aparecem em `grep` de `process.env` em `src/` + `.env.example`.)*

### `backend-ds-control-main`

| Variável | Classificação |
|----------|----------------|
| `API_URL`, `NODE_ENV`, `HTTP_PORT` | Deploy / runtime |
| `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT` | Obrigatórias (dados) |
| `FRONTEND_URL` | Opcional (default) — CORS/cookies |
| `REDIS_URL` | Obrigatória com default |
| `RESEND_API_KEY` | Default no schema — **suspeita** para produção |
| `COOKIES_SECRET`, `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET` | Obrigatórias — auth |
| `BCRYPT_SALT_ROUNDS` | Opcional (default) |

### Scripts backend

| Variável | Classificação |
|----------|----------------|
| `CREATE_ADMIN_EMAIL`, `CREATE_ADMIN_NAME`, `CREATE_ADMIN_PASSWORD` | Opcional — `scripts/create-admin.ts` |

### `app-ds-control-main`

| Variável | Classificação |
|----------|----------------|
| `EXPO_PUBLIC_DS_CONTROL_API_URL` | Obrigatória para API mobile |
| `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` | Mapas |
| `EXPO_PUBLIC_MAPBOX_DOWNLOADS_TOKEN` | Build nativo Mapbox |

**Aparentemente não utilizada no código aplicacional:** nenhuma outra `NEXT_PUBLIC_*` além das duas no front web — **confirmado por grep limitado ao padrão acima**.

> **Contrato frontend × backend — rotas/mapas (ETAPA 2):** ver **§ ETAPA 2 — Contrato frontend × backend — rotas e mapas**.

---

## 10. Problemas encontrados

| Problema | Impacto | Severidade | Onde | Causa provável | Correção sugerida | Status |
|----------|---------|------------|------|----------------|-------------------|--------|
| Token Mapbox ausente no build | Todos os mapas GL / static falham | Alta | Amplify/host | Env não configurada | Definir `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` | Pendente (env) / UI melhorada |
| URL API sem esquema | `fetch` inválido | Alta | `.env` produção | Host sem `http(s)://` | `normalizeApiUrl` + exemplo `https://` | Corrigido (código + example) |
| Retry Rotas | Retry não atualizava query | Média | `TableRoutes.tsx` | queryKey | `invalidateQueries(['routes'])` | Corrigido |
| MultiLineString / bounds | Mapa não centra ou erro | Média | `MapContent.tsx` | Geometria | Tratamento + `isEmpty()` | Corrigido |
| `includeGeoJson` ignorado no repo | Payload maior | Baixa | `route.repository.ts` | Parâmetro não usado | Alinhar implementação ou contrato | Pendente |
| Ordem `/users/:id` vs `/users/me` | `getMe` pode não bater | Média | `user.routes.ts` | Ordem registo | Colocar `/me` antes de `/:id` | Pendente / não confirmado em HTTP |
| `RESEND_API_KEY` default | Segurança / email | Alta (ops) | `config/index.ts` | Default no schema | Remover default em prod | Pendente |

---

## 11. Correções aplicadas

| Ficheiro | Alteração | Motivo | Impacto |
|----------|-----------|--------|---------|
| `frontend-ds-control-main/src/lib/config.ts` | `normalizeApiUrl` | URL sem esquema | `fetch` válido |
| `frontend-ds-control-main/.env.example` | `https://` na API | Documentação | Menos erros de cópia |
| `frontend-ds-control-main/src/components/Tables/TableRoutes.tsx` | `onRetry` → `queryKey: ['routes']` | TanStack Query | Retry funcional |
| `frontend-ds-control-main/src/components/MapViewer.tsx` | UI se token ausente | UX / diagnóstico | Mensagem clara |
| `frontend-ds-control-main/src/app/dashboard/map/page.tsx` | idem | idem | idem |
| `frontend-ds-control-main/src/components/MapContent.tsx` | MultiLineString + `!bounds.isEmpty()` | Geometria | Menos falhas ao focar mapa |

---

## 12. Pendências para produção

- Validar no **host publicado** (Amplify ou outro): `NEXT_PUBLIC_DS_CONTROL_API_URL` e `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` para **cada** branch/build.
- Teste manual no **browser**: login backoffice → Rotas → listagem; expandir linha → mapa; página Mapa → talhões.
- Backend a correr e acessível a partir do domínio do front (CORS + HTTPS conforme necessidade de cookies).
- Teste HTTP **não** executado nesta auditoria para `/v1/users/me` vs `/v1/users/:id`.
- IAM e secrets **AWS** para o workflow de deploy.

---

## 13. Resumo executivo final

| Pergunta | Resposta |
|----------|----------|
| O que existe? | API Fastify + PostgreSQL/Drizzle; Next backoffice com Mapbox; Expo mobile; CI ECS para backend. |
| O que está saudável? | Estrutura modular da API, cliente HTTP com refresh, guards de perfil, documentação Swagger. |
| O que está quebrado / frágil em produção típica? | Mapas e chamadas API quando **env** do Next está incompleta; tabela Rotas falha se API falhar. |
| O que corrigir primeiro? | **1)** Variáveis `NEXT_PUBLIC_*` no serviço de hosting. **2)** Confirmar URL da API com esquema e apontador para `/v1`. **3)** Opcional: ordem de rotas `/users/me` no backend. |
| Prioridade prática | **Configuração de ambiente** antes de alterações de código adicionais. |

---

## ETAPA 2 — Complemento operacional e validação runtime (ambiente publicado)

**Nota metodológica:** esta etapa cruza o código já auditado com o **comportamento esperado em runtime**. A confirmação literal no URL publicado (valores de `NEXT_PUBLIC_*` no bundle, respostas HTTP reais, consola do browser) **depende de acesso ao ambiente** e **não foi executada nesta sessão** — onde aplicável usa-se **não confirmado em runtime**.

### Complemento operacional — ambiente publicado

#### Onde cada variável é lida e o que acontece se faltar

| Variável | Onde é lida (ficheiros) | Fallback no código | Se ausente / inválida | Impacto na UI |
|----------|-------------------------|---------------------|-------------------------|----------------|
| **`NEXT_PUBLIC_DS_CONTROL_API_URL`** | `src/lib/config.ts` → `config.apiUrl`; consumida em `api.service.ts` como `` `${getConfig('apiUrl')}${input}` `` | `normalizeApiUrl()` só corrige ausência de esquema (`http`/`https`); **não** substitui valor vazio | Se **undefined** no build: em JS `` `${undefined}/routes` `` → string **`"undefined/routes"`**, interpretada como URL **relativa** ao domínio do Next → pedidos vão para o **próprio site** (404/HTML), não para a API. **Sintoma:** listagem Rotas e outras telas com erro de rede ou resposta não-JSON. | **Crítico** para qualquer chamada `api()`. |
| **`NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`** | `MapViewer.tsx`, `dashboard/map/page.tsx`, `ApplicationsReportPDF.tsx` — `process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` | **Nenhum** (sem default) | Token `undefined` ou string vazia: Mapbox GL não autentica pedidos de estilo/tiles; antes das correções da secção 11, mapa podia aparecer em branco; **após correções**, `MapViewer` e `map/page` mostram mensagem a pedir configuração da variável no build. PDF: `fetch` à API Static pode falhar (tratamento com `console.error` no código do PDF). | **Crítico** para mapas; **não** afeta listagem JSON da tabela Rotas. |
| **`RESEND_API_KEY`** (backend) | `backend-ds-control-main/src/config/index.ts` (`envSchema` com `.default("re_...")`); `src/infra/resend/index.ts` — `new Resend(env.RESEND_API_KEY)` | **Default embutido no schema Zod** | Email (ex.: reset password) pode falhar ou usar chave inválida; **não** afeta Rotas nem mapas no front. | Fluxos de email; **não** explicam falha isolada de Rotas/mapa. |
| **Outras env de deploy** | GitHub Actions: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`; backend: `DB_*`, JWT secrets, `REDIS_URL` | Vários defaults só em dev | Se API em produção estiver em baixo ou mal configurada, o front recebe 5xx/timeout — sintoma semelhante a URL errada na listagem. | **Depende de acesso ao ambiente** para distinguir. |

#### Como confirmar no host publicado (sem inventar resultados)

1. **Build do Next:** variáveis `NEXT_PUBLIC_*` são **inlinadas em build time**. Alterar no painel do host **exige novo build** para refletir no cliente.
2. **No browser (produção):** abrir DevTools → **Network** ao carregar `/dashboard/routes` e verificar se o pedido vai para o host esperado da API (ex.: `https://…/v1/routes?…`) e status **200** vs **401/404/CORS**.
3. **Inspeção do bundle:** procurar no JS servido por `pk.` (prefixo típico de token Mapbox público) — **não confirmado em runtime** nesta auditoria se o bundle publicado contém token.

---

### Validação de runtime — tela “Rotas”

#### Fluxo exato (ponta a ponta, conforme código)

1. **Rota URL:** `/dashboard/routes` — `src/app/dashboard/routes/page.tsx` renderiza `TableRoutes` e diálogo de nova rota.
2. **Componente principal:** `TableRoutes` (`src/components/Tables/TableRoutes.tsx`).
3. **Hook de dados:** `useGetAllRoutes` (`src/queries/route.query.ts`) → `queryFn` chama `RouteService.getAllRoutes(params)`.
4. **Chamada HTTP:** `GET` com URL = `getConfig('apiUrl')` + `` `/routes?` + querystring `` — com base correta resulta em **`{API}/v1/routes?page=…&limit=…&includeCustomer=true&includeFarm=true&includeGeoJson=false&orderBy=…&orderType=…`** (parâmetros exatos conforme estado em `TableRoutes`).
5. **Endpoint backend:** `GET /v1/routes/` — `RouteController.listRoutes` — resposta HTTP 200 com corpo: `{ message, data, page, limit, totalPages, totalCount }` (spread do resultado paginado + `message`).
6. **Shape esperado pelo frontend:** `GetAllRoutesResponse` em `route.service.ts`: `data[]`, `page`, `limit`, `totalPages`, `totalCount`. O campo extra `message` **não** impede `response.json()` de ser parseado.
7. **Tabela:** `DataTable` com `data={routesData?.data ?? []}`; colunas usam `route.farm`, `route.customer`, `route.createdAt`, etc.
8. **Expansão:** `expandedRows` com ids de linha TanStack (`row.id` como `"0"`, `"1"`, …); `renderExpandedRow` renderiza `MapViewer` com `geoData={route.geoJson}` dentro de `div` com **altura fixa 400px**.
9. **Loading / erro / vazio:** `isLoading` → skeleton; `isError` → mensagem `error?.message` e botão retry com `invalidateQueries({ queryKey: ['routes'] })`; lista vazia → `renderEmptyState`.
10. **Retry:** corrigido para invalidar `['routes']` (secção 11).

#### O que quebra **a listagem** (tabela)

| Cenário | Mecanismo no código | Sintoma típico |
|---------|---------------------|------------------|
| URL da API errada / `undefined` | `fetch` para host errado ou rota relativa inválida | `isError`, mensagem genérica **"Failed to fetch routes"** (`getAllRoutes` se `!response.ok` **não** distingue 401 de 404 no texto — mesmo string de erro para qualquer falha) |
| 401 sem refresh válido | `api.service` tenta refresh; se falhar, lança | Erro na query; utilizador pode ser redirecionado por outros fluxos de auth |
| Resposta 200 com shape incompatível (ex.: sem `data`) | `routesData?.data` → `undefined` → tabela com `[]` | Estado “vazio”, **não** necessariamente `isError` — **risco de falha silenciosa** de dados |
| Backend 4xx/5xx | `!response.ok` → throw | `isError` com mensagem fixa |

**Não confirmado em runtime:** qual destes ocorre no URL publicado.

#### O que quebra **a expansão** (sem ser o mapa)

| Cenário | Evidência |
|---------|-----------|
| Dados de `farm`/`customer` ausentes ou malformados | Acesso a `route.farm.name` / `route.customer.name` no cabeçalho da expansão — **ReferenceError** possível se objetos vierem `undefined` (contrato espera `includeFarm`/`includeCustomer` true). |
| `geoJson` nulo ou inválido | `MapContent` pode não desenhar camadas; não impede render da linha expandida. |

#### O que quebra **o mapa embutido** na expansão

| Cenário | Evidência |
|---------|-----------|
| **`NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` ausente no build** | `MapViewer` mostra mensagem (pós-correção); mapa não carrega tiles. |
| GeoJSON incompatível ou vazio | `MapContent` trata `geoData` ausente com `flyTo` zoom 2; camadas podem não aparecer. |

#### O que depende **exclusivamente de ambiente**

- Valores corretos de **`NEXT_PUBLIC_DS_CONTROL_API_URL`** e **`NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`** no **serviço de hosting** no momento do **build** do Next.
- Disponibilidade e CORS/cookies da **API** no domínio configurado.

#### O que já foi **corrigido no código** (repositório)

- Retry da query Rotas; mensagem explícita sem token Mapbox; `normalizeApiUrl`; `MapContent` MultiLineString e `fitBounds` — ver secção 11.

---

### Validação de runtime — mapas

#### Fluxo exato (MapViewer + MapContent)

1. **Entrada:** `MapViewer` recebe `geoData` (GeoJSON opcional), `layerNameToHighlight`, `onPlotClick`.
2. **Token:** `const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` — se falsy → **return antecipado** com UI de aviso (ficheiro `MapViewer.tsx`).
3. **Mapa:** `<Map mapboxAccessToken={token} mapStyle='mapbox://styles/mapbox/satellite-streets-v12' />` — pedidos de vector tiles ao **domínio Mapbox** (não passam pela API DS).
4. **MapContent:** `useMap()`; se `geoData` com `features` e primeira geometria LineString/MultiLineString → modo linha; senão → camadas `fill` para polígonos; `useEffect` calcula `LngLatBounds` e chama `fitBounds` apenas se `!bounds.isEmpty()` (pós-correção).
5. **Erros:** toast em `catch` de `fitBounds`; interações com layer `uploaded-layer`.

#### Hipóteses ordenadas para o ambiente **publicado**

| Ordem | Causa mais provável | Evidência no código | Evidência **ainda em falta** (runtime) |
|-------|---------------------|---------------------|----------------------------------------|
| **1** | **`NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` não definida ou incorreta no build do front** | Next inlinha `process.env` no build; sem token o Mapbox não carrega estilo; UI pós-correção explica o problema | Inspeção do build publicado / variáveis no painel do host; teste Network para `api.mapbox.com` com 401 |
| **2** | **`NEXT_PUBLIC_DS_CONTROL_API_URL` errada** — afeta sobretudo dados; na página **só mapa** `/dashboard/map` o mapa base pode até aparecer, mas **sem** talhões se `getFarmById` falhar | `api()` usa `getConfig('apiUrl')` | Pedido Network a `/v1/farms/...` com falha |
| **3** | **GeoJSON vazio ou inválido** | `MapContent` sem features não desenha sobreposição; mapa base Mapbox pode ser visível | Dados reais da API |
| **4** | **Container altura zero** | Pais com `h-[400px]` na expansão Rotas; `Map` com `height: '100%'` | Inspeção CSS no browser |
| **5** | **Token Mapbox válido mas restrito por URL** (dashboard Mapbox) | **Não confirmado no código** — depende da configuração da conta Mapbox | Consola Mapbox / restrições de referrer |

**Segunda causa possível** (após token): falha de **dados** (API) nas páginas que combinam mapa + `FarmService.getFarmById` — não aplica à expansão de Rotas se só o Mapbox falhar.

---

### Contrato frontend × backend — rotas e mapas

| Aspeto | Frontend | Backend | Avaliação |
|--------|----------|---------|-----------|
| Listagem | `GET /routes` + query paginada; espera `{ data, page, limit, totalPages, totalCount }` | `GET /v1/routes/` → `listRoutes` envia `{ message, ...result }` com `result` = objeto paginado com `data` | **Alinhado**; campo `message` extra é tolerado. |
| `includeGeoJson=false` | Enviado na query em `TableRoutes` | `RouteRepository.getAllRoutesWithRelations` **aceita** o parâmetro mas **não o usa** para omitir colunas — `formatRoute` **sempre** inclui `geoJson` | **Parâmetro sem efeito** no omit; **contrato frouxo**; **risco de payload grande** em listas longas. |
| Formato `geoJson` | `Record<string, unknown>` no tipo `Route`; passado a `MapContent` como GeoJSON | Armazenado em coluna JSON no PG | Deve ser FeatureCollection ou compatível; **formato inválido** → camadas vazias, **não** erro de listagem. |
| Nullability | Tabela assume `farm` e `customer` presentes quando `includeFarm`/`includeCustomer` true | Repositório devolve relações quando pedido | Se backend mudar e omitir campos, **risco de runtime** na UI. |

**Inconsistência documentada:** o pedido `includeGeoJson=false` sugere otimização, mas o repositório **não** retira `geoJson` — não explica listagem vazia, apenas payload maior.

---

### Respostas operacionais consolidadas (ETAPA 2)

| Pergunta | Resposta (base código; runtime onde indicado) |
|----------|-----------------------------------------------|
| A app publicada “recebe” `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` / `NEXT_PUBLIC_DS_CONTROL_API_URL`? | **Só se** estiverem definidas no **ambiente de build** do Next no host. **Não confirmado em runtime** nesta sessão. |
| Rotas: API correta? | Esperado: `{NEXT_PUBLIC_DS_CONTROL_API_URL}/routes` → `/v1/routes/`. Se a env estiver errada, o pedido **não** atinge o backend. |
| Rotas: quebra por auth? | Possível **401** — `api()` faz refresh; se falhar, erro. **Não confirmado em runtime.** |
| Rotas: quebra por shape? | Improvável se backend seguir `listRoutes`; possível **lista vazia** sem `isError` se resposta 200 malformada. |
| Mapas: token ausente | **Causa mais provável** de mapa em branco — explicado acima. |
| Mapas: token inválido | Mapbox retorna erro de autorização nos tiles — **não confirmado em runtime.** |
| Mapas: estilo Mapbox | URL fixa `mapbox://styles/...` — falha se token inválido ou conta sem acesso. |

---

## Apêndice A — Buscas obrigatórias (termos) no código

Execução conceitual (ficheiros já analisados): termos **map**, **mapbox**, **route**/**routes**, **Rotas**, **geoJson**, **latitude**/**longitude** aparecem principalmente em `MapViewer.tsx`, `MapContent.tsx`, `route.service.ts`, `TableRoutes.tsx`, `path.type.ts`, `app-ds-control-main` (Mapbox nativo). **leaflet**, **google maps**, **openstreetmap**, **tilelayer**, **geocode** como dependências **não** aparecem nos `package.json` do front web — **não utilizados** no backoffice Next conforme `package.json`.

---

## Apêndice B — Ficheiros principais inspecionados

- `frontend-ds-control-main`: `src/app/**`, `src/components/MapViewer.tsx`, `MapContent.tsx`, `Tables/TableRoutes.tsx`, `services/api.service.ts`, `lib/config.ts`, `guards/auth.guard.tsx`, `types/path.type.ts`, `package.json`, `next.config.ts`, `.env.example`
- `backend-ds-control-main`: `src/modules/**/routes.ts`, `route/route.controller.ts`, `route/services/route.service.ts`, `repositories/routes/route.repository.ts`, `middleware/authentication-jwt-middleware.ts`, `config/index.ts`, `src/infra/database/schema/`
- `.github/workflows/backend-production.yml`
- `app-ds-control-main`: `lib/config.ts`, `app.config.ts`, componentes Map
