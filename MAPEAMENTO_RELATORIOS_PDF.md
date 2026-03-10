# Mapeamento técnico – Geração de relatórios em PDF

Objetivo: localizar onde o PDF é montado, quais arquivos controlam layout/estrutura, dependências, fluxo completo e de onde vêm os dados. **Nenhum arquivo foi alterado.**

---

## 1. Bibliotecas de geração de PDF

| Biblioteca | Onde é usada | Função |
|------------|--------------|--------|
| **@react-pdf/renderer** (v4.3.1) | Frontend Next.js | Gera o PDF a partir de componentes React (Document, Page, View, Text, Image, etc.). Única lib de PDF no **frontend**. |
| **expo-print** | App (React Native/Expo) | Converte **HTML** em arquivo PDF no dispositivo (`Print.printToFileAsync({ html })`). O app não usa @react-pdf. |

Não foram encontradas: pdfmake, jsPDF, Puppeteer, pdf-lib, wkhtmltopdf no código do projeto (apenas referências em node_modules de terceiros, ex.: file-type para detecção de tipo).

---

## 2. Arquivos encontrados e função de cada um

### Frontend (Next.js) – relatório PDF de aplicações

| Arquivo | Função |
|---------|--------|
| **frontend-ds-control-main/src/utils/pdfGenerator.ts** | Ponto de entrada da geração: recebe `serviceOrder` e `applications`, chama o componente de layout, usa `pdf(element).toBlob()` do @react-pdf/renderer e exporta `downloadPDF(blob, filename)`. |
| **frontend-ds-control-main/src/components/PDFReports/ApplicationsReportPDF.tsx** | **Arquivo principal do layout do PDF.** Define o documento completo: fontes (Roboto), capa (logo, dados da OS, estatísticas), páginas por talhão (mapa Mapbox, SVG do polígono, lista de aplicações). Todo o layout visual e a estrutura do relatório estão aqui. |
| **frontend-ds-control-main/src/app/generate-report/page.tsx** | Página que gera o relatório por link (query: `serviceOrderId`, `token`). Busca OS e aplicações na API, enriquece aplicações com `plot`, chama `generateApplicationsReportPDF` e `downloadPDF`. |
| **frontend-ds-control-main/src/components/CardServiceOrderDetails.tsx** | Card de detalhes da OS com botão “Gerar relatório de aplicações”. Refetch da OS com includes, usa dados de aplicações do React Query, chama `generateApplicationsReportPDF` e `downloadPDF`. |
| **frontend-ds-control-main/src/services/service-order.service.ts** | `getServiceOrderById(serviceOrderId, params)` – chama API `GET /service-orders/:id` com includes (plots, geoJson, pilots, farms, contracts, customers). Fonte dos dados da OS. |
| **frontend-ds-control-main/src/services/application.service.ts** | `getApplicationsByServiceOrderId(serviceOrderId)` – chama API `GET /applications/service-order/:id`. Fonte dos dados de aplicações. |

### App (Expo/React Native) – relatório da OS (HTML → PDF)

| Arquivo | Função |
|---------|--------|
| **app-ds-control-main/utils/generate-service-order-report.ts** | Gera **HTML** do relatório (função `generateServiceOrderReportHTML`). Template com logo, dados da OS, aplicações, mapas (Mapbox static), estilos inline. Não gera PDF diretamente; o PDF é gerado pelo Expo a partir desse HTML. |
| **app-ds-control-main/components/ButtonGenerateServiceOrderReport.tsx** | Botão “Gerar relatório da OS”. Obtém OS e aplicações via React Query, chama `generateServiceOrderReportHTML`, depois `Print.printToFileAsync({ html })` (expo-print) e `Sharing.shareAsync(uri)` para salvar/compartilhar o PDF. |

### Assets de layout (frontend PDF)

- **ApplicationsReportPDF.tsx** referencia:
  - `/images/pdf-logo-complete.png` (capa)
  - `/images/pdf-logo-only.png` (cabeçalho das páginas internas)
- Em Next.js esses paths são resolvidos a partir de **public/**, ou seja: **public/images/pdf-logo-complete.png** e **public/images/pdf-logo-only.png**. Se não existirem na pasta public, o build ou o runtime podem falhar ao gerar o PDF.

---

## 3. Arquivo principal/padrão do layout do PDF

- **No frontend (relatório de aplicações – web):**  
  **`frontend-ds-control-main/src/components/PDFReports/ApplicationsReportPDF.tsx`**  
  É o único componente de relatório PDF no frontend e contém toda a estrutura e o layout (capa, blocos de informação, páginas por talhão, tabelas de aplicações, mapas, cores, fontes e espaçamentos).

- **No app (relatório da OS – mobile):**  
  **`app-ds-control-main/utils/generate-service-order-report.ts`**  
  É o “template” do relatório: gera uma string HTML que o Expo converte em PDF. Layout e estrutura visuais estão nesse HTML (e nos estilos inline dentro da função).

---

## 4. Fluxo completo (frontend – do disparo ao arquivo final)

1. **Disparo**
   - **Opção A – Página por link:** Usuário acessa `/generate-report?serviceOrderId=...&token=...`.  
     **Arquivo:** `frontend-ds-control-main/src/app/generate-report/page.tsx`.  
   - **Opção B – Card da OS:** Usuário clica em “Gerar relatório de aplicações” no card da ordem de serviço.  
     **Arquivo:** `frontend-ds-control-main/src/components/CardServiceOrderDetails.tsx` (função `handleGeneratePDFReport`).

2. **Dados**
   - OS: `getServiceOrderById(serviceOrderId, { includePlots, includeGeoJson, includePilots, includeFarms, includeContracts, includeCustomers })` → **service-order.service.ts** → API `GET /service-orders/:id?...`.
   - Aplicações: `getApplicationsByServiceOrderId(serviceOrderId)` → **application.service.ts** → API `GET /applications/service-order/:id?limit=1000`.
   - Enriquecimento: cada aplicação recebe `plot` (geoJson, etc.) a partir de `serviceOrder.plots` (por `plotId`).

3. **Geração do PDF**
   - **pdfGenerator.ts:** `generateApplicationsReportPDF({ serviceOrder, applications })` é chamada com esses dados.
   - **pdfGenerator.ts:** Monta o elemento React com `ApplicationsReportPDF({ serviceOrder, applications })`.
   - **@react-pdf/renderer:** `pdf(element).toBlob()` renderiza o documento e retorna um `Blob` (PDF).

4. **Exportação**
   - **pdfGenerator.ts:** `downloadPDF(blob, filename)` cria um link de download com `relatorio-aplicacoes-os-{number}.pdf` e dispara o clique no navegador.

Fluxo em uma linha: **Página ou Card** → **Services (API)** → **pdfGenerator.generateApplicationsReportPDF** → **ApplicationsReportPDF (layout)** → **pdf().toBlob()** → **downloadPDF**.

---

## 5. Partes fixas e dinâmicas do layout (ApplicationsReportPDF.tsx)

### Fixas (texto/estrutura que não dependem dos dados da OS/aplicações)

- Título e dados da empresa na capa: “DS Drones Agrícolas LTDA”, “54.134.198/0001-25”, “Imperatriz - MA”, “+55 99 9174-5656”.
- Rótulos: “Informações da Ordem de Serviço”, “Número da OS:”, “Cliente:”, “Contrato:”, “Data Planejada:”, “Fazendas:”, “Pilotos:”, “Observação:”, “Estatísticas das Aplicações”, “Total de Hectares:”, “Taxa de Fluxo (Vazão) Média:”, “Altitude Média:”, “Espaçamento Médio:”, “Tamanho de Gota Médio:”, “Página X”, “Gerado em:”, “Mapa não disponível”, “Fazenda:”, “Área:”, “Aplicações:”, e todos os rótulos dos campos de cada aplicação (Piloto, Assistente, Drone, Cultura, Hectares, etc.).
- Estrutura de blocos (caixas, bordas, padding), cores (#EAAE07, #6B7280, #1F2937, #E5E7EB, #F9FAFB, etc.), tamanhos de fonte (8, 9, 10, 12, 14, 16, 24), família de fonte (Roboto).
- Imagens: `/images/pdf-logo-complete.png` (capa), `/images/pdf-logo-only.png` (cabeçalho das páginas).
- Tamanho de página: A4.
- Lógica de páginas: 1 capa + N páginas (uma por talhão com aplicações).

### Dinâmicas (dados vindos de `serviceOrder` e `applications`)

- `serviceOrder.number`, `serviceOrder.customer?.name`, `serviceOrder.contract?.name`, `serviceOrder.plannedDate`, `serviceOrder.farms`, `serviceOrder.pilots`, `serviceOrder.observation`.
- Estatísticas calculadas: `totalHectares`, `averageFlowRate`, `averageAltitude`, `averageRouteSpacing`, `averageDropletSize`.
- Por talhão: lista de aplicações (`applicationsByPlot`), nome do talhão (`plot.name`), fazenda (`farmMap`), área (`plot.hectare`), quantidade de aplicações.
- Mapas: URL estática Mapbox (`generateMapboxStaticUrl(bounds, ...)`) e overlay SVG do polígono do talhão (`convertCoordinatesToSvgPath`, `getPlotFillColor`, `getPlotStrokeColor`).
- Por aplicação: produto, data, piloto, assistente, drone, cultura, hectares, taxa de fluxo, altitude, espaçamento, tamanho de gota, observações.
- Data/hora de geração: `generatedDateTime` (calculada no render com `new Date().toLocaleString('pt-BR', ...)`).

---

## 6. De onde vêm os dados que abastecem o PDF

| Dado | Origem |
|------|--------|
| Ordem de serviço (número, cliente, contrato, data planejada, fazendas, pilotos, observação, plots com geoJson) | API `GET /service-orders/:id` com query params de include. Chamada em **service-order.service.ts** (`getServiceOrderById`). |
| Aplicações (produto, data, piloto, assistente, drone, cultura, hectares, flowRate, altitude, routeSpacing, dropletSize, observations, plotId) | API `GET /applications/service-order/:id?limit=1000`. Chamada em **application.service.ts** (`getApplicationsByServiceOrderId`). |
| Vínculo aplicação ↔ talhão (plot com geoJson) | Montado no frontend: `serviceOrder.plots` é usado para preencher `application.plot` para cada aplicação antes de chamar `generateApplicationsReportPDF`. |
| Mapas (imagem de fundo) | Mapbox Static Images API: URL gerada em `generateMapboxStaticUrl` dentro de **ApplicationsReportPDF.tsx** (usa `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`). |
| Logos | Arquivos estáticos: `public/images/pdf-logo-complete.png`, `public/images/pdf-logo-only.png`. |

---

## 7. Mais de um modelo de relatório PDF?

Sim. Existem **dois** fluxos distintos:

1. **Relatório de aplicações (frontend – web)**  
   - **Biblioteca:** @react-pdf/renderer.  
   - **Layout:** **ApplicationsReportPDF.tsx** (React com Document/Page/View/Text/Image/Svg/Path).  
   - **Saída:** PDF gerado no navegador, download com nome `relatorio-aplicacoes-os-{number}.pdf`.  
   - **Disparo:** Página `/generate-report` (link com token) ou botão no **CardServiceOrderDetails**.

2. **Relatório da OS (app – mobile)**  
   - **Biblioteca:** expo-print (HTML → PDF).  
   - **Layout:** **generate-service-order-report.ts** (string HTML com template e estilos inline).  
   - **Saída:** PDF gerado no dispositivo via Expo, compartilhado/salvo com nome tipo `OS-{number}-Relatório.pdf`.  
   - **Disparo:** Botão “Gerar relatório da OS” em **ButtonGenerateServiceOrderReport** (tela da OS no app).

São dois “modelos” diferentes (um em React-PDF, outro em HTML), com conteúdos e estilos próprios.

---

## 8. Pontos exatos para alterar o layout visual do relatório

### Relatório de aplicações (frontend – o principal)

- **Arquivo a mexer:** **`frontend-ds-control-main/src/components/PDFReports/ApplicationsReportPDF.tsx`**.

O que alterar nesse arquivo para mudar o layout:

1. **Capa (primeira página, ~linhas 392–823)**  
   - View com padding 40; Image do logo; textos “DS Drones Agrícolas LTDA” e dados da empresa; bloco “Informações da Ordem de Serviço” (número, cliente, contrato, data, fazendas, pilotos, observação); bloco “Estatísticas das Aplicações” (total ha, médias).  
   - Para mudar capa: editar essa árvore de `<View>`, `<Text>`, `<Image>`, incluindo **styles** inline (fontSize, fontWeight, colors, margins, borders, etc.).

2. **Páginas por talhão (loop `Object.entries(applicationsByPlot)` ~linhas 825–1379)**  
   - Cabeçalho da página (logo pequeno, “Página X”, “Gerado em”); área do mapa (Image Mapbox + Svg/Path do polígono); bloco do talhão (nome, fazenda, área, nº aplicações); lista de aplicações (por aplicação: produto, data, piloto, assistente, drone, cultura, hectares, fluxo, altitude, espaçamento, gota, observações).  
   - Para mudar páginas internas: editar esse bloco e os **styles** de cada View/Text.

3. **Cores, fontes e tamanhos**  
   - Não há arquivo de estilos separado; tudo está em **style={{ ... }}** dentro do próprio **ApplicationsReportPDF.tsx**.  
   - Cores fixas no código: ex. `#EAAE07`, `#6B7280`, `#1F2937`, `#E5E7EB`, `#F9FAFB`, `#FFFFFF`, `#FFF3CD`.  
   - Fonte: Roboto (registrada no topo do arquivo com URLs do cdnjs).  
   - Para mudar aparência global: buscar e alterar esses valores e/ou o registro da fonte.

4. **Imagens do relatório**  
   - Trocar logos: substituir ou renomear arquivos em **public/images/** (`pdf-logo-complete.png`, `pdf-logo-only.png`) ou alterar os `src` nas linhas ~404 e ~874 de **ApplicationsReportPDF.tsx**.

5. **Estrutura do documento**  
   - Número e ordem de páginas: uma página inicial (capa) + uma página por entrada em `applicationsByPlot`. Para mudar (ex.: mais de um talhão por página, ou capa diferente), alterar a lógica e os `<Page>` dentro de **ApplicationsReportPDF.tsx**.

Nenhum outro arquivo define o layout desse PDF. **pdfGenerator.ts** só chama o componente e converte para Blob; não altera estrutura nem estilos.

### Relatório da OS no app (mobile)

- **Arquivo a mexer:** **`app-ds-control-main/utils/generate-service-order-report.ts`**.  
- Layout e estrutura estão no **HTML** montado na função `generateServiceOrderReportHTML` (e nos estilos inline dentro dessa string). Alterar esse HTML e os estilos inline altera o layout do PDF gerado pelo Expo.

---

## 9. Dependências envolvidas na geração (frontend)

| Dependência | Uso |
|-------------|-----|
| **@react-pdf/renderer** | `pdf()`, `Document`, `Page`, `View`, `Text`, `Image`, `Font`, `Svg`, `Path`. |
| **Application** (type) | Estrutura dos dados de aplicação (campos exibidos no PDF). |
| **ServiceOrder** (type) | Estrutura da OS (número, cliente, contrato, farms, pilots, plots, etc.). |
| **Plot** (type) | geoJson, nome, hectare; usado para mapas e blocos por talhão. |
| **NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN** | Geração da URL do mapa estático (Mapbox) em **ApplicationsReportPDF.tsx**. |
| **public/images/pdf-logo-complete.png**, **pdf-logo-only.png** | Logos no PDF. |

---

## Resumo

- **Onde o PDF é montado (frontend):** no componente **ApplicationsReportPDF.tsx**, renderizado por **pdfGenerator.ts** via `pdf(element).toBlob()`.
- **Arquivo que controla todo o layout/estrutura visual desse relatório:** **`frontend-ds-control-main/src/components/PDFReports/ApplicationsReportPDF.tsx`** (único componente PDF do frontend).
- **Para mudar o layout do relatório de aplicações (web):** editar apenas **ApplicationsReportPDF.tsx** (estrutura, textos fixos, styles inline, referências às imagens) e, se quiser trocar logos, os arquivos em **public/images/**.
- **Existe mais de um modelo:** sim – um no frontend (ApplicationsReportPDF + pdfGenerator) e outro no app (generate-service-order-report.ts → HTML → expo-print → PDF).

Nenhum arquivo do projeto foi modificado neste mapeamento.
