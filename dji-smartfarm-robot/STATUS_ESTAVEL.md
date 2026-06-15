# DJI SmartFarm Robot - Status Estável

Data do checkpoint: 2026-06-15

## Estado validado

O robô DJI SmartFarm está estável para coleta silenciosa/headless de evidências por voo.

Modo validado:

node .\dji-inventario-dia.js --os-id 134 --date 2026/05/20 --capture-mode map-crop-centered

## Resultado validado na OS 134 - 20/05/2026

- 27 voos detectados
- 27 voos válidos
- 0 ignorados
- 37.53 ha DJI
- 560.1 L
- coverageByFlightsPercent: 100
- coverageByAreaPercent: 100
- screenshotStatus READY: 27

## Captura de imagem

Modo estável:

--capture-mode map-crop-centered

Características:

- roda em headless
- mantém sidebar aberta para navegação
- não exibe sidebar/lista/drawer na imagem final
- detecta o bbox verde da aplicação
- centraliza a aplicação no mapa
- salva imagePath e mapOnlyImagePath
- usa imageCaptureMode: map_crop_centered_screenshot
- usa cropMode: centered_application
- usa centerStatus: CENTERED

## Agrupamento validado

Script:

node .\dji-agrupar-aplicacoes-os.js --os-id 134 --date 2026/05/20 --allow-fallback

Grupos gerados:

- F78 T06: 13 voos, 18.63 ha DJI vs 19.93 ha DS, candidate
- F44 T38: 12 voos, 16.26 ha DJI vs 14.82 ha DS, candidate
- F44 T07: 2 voos, 2.64 ha DJI vs 2.55 ha DS, strong

## Observação

Ainda falta substituir o fallback por leitura real do arquivo os_134_aplicacoes_v2.json no fluxo definitivo.

O relatório DS Control não deve executar o robô. O robô deve rodar separado, gerar imagens e manifest, e o PDF deve apenas consumir evidências prontas.
