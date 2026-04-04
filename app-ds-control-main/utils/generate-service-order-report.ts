import { Application } from '@/types/applications.type';
import { ServiceOrder } from '@/types/service-order.type';
import { Plot } from '@/types/plot.type';
import { Image } from 'react-native';

import { buildReportMapboxStaticUrl } from '@/utils/mapboxStaticReportMap';

const resolveImageUri = (imagePath: any): string => {
  if (typeof imagePath === 'number') {
    return Image.resolveAssetSource(imagePath).uri;
  }
  return imagePath;
};

const formatDate = (dateString: string | Date) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const formatHectares = (hectares: string) => {
  return `${parseFloat(hectares).toFixed(2)} ha`;
};

export const generateServiceOrderReportHTML = (
  serviceOrder: ServiceOrder,
  applications: Application[]
): string => {
  // Load PDF logos
  let PDF_LOGO_COMPLETE: string;
  let PDF_LOGO_ONLY: string;

  try {
    PDF_LOGO_COMPLETE = resolveImageUri(require('@/assets/images/pdf-logo-complete.png'));
  } catch {
    PDF_LOGO_COMPLETE = resolveImageUri(require('@/assets/images/top_banner_logo.png'));
  }

  try {
    PDF_LOGO_ONLY = resolveImageUri(require('@/assets/images/pdf-logo-only.png'));
  } catch {
    PDF_LOGO_ONLY = resolveImageUri(require('@/assets/images/top_banner_logo.png'));
  }

  // Create a map of plot IDs to full plot data (with GeoJSON) from service order
  const plotDataMap = new Map<string, Plot>();
  if (serviceOrder.farms && Array.isArray(serviceOrder.farms)) {
    serviceOrder.farms.forEach((farm) => {
      if (farm.plots && Array.isArray(farm.plots)) {
        farm.plots.forEach((plot) => {
          if (plot.id) {
            plotDataMap.set(plot.id, plot);
          }
        });
      }
    });
  }

  // Also check if service order has plots directly
  if (serviceOrder.plots && Array.isArray(serviceOrder.plots)) {
    serviceOrder.plots.forEach((plot) => {
      if (plot.id) {
        plotDataMap.set(plot.id, plot);
      }
    });
  }

  // Filter applications with plots and group by plot
  const applicationsWithPlot = applications.filter((app) => app.plotId !== null);
  const applicationsByPlot = applicationsWithPlot.reduce(
    (acc, app) => {
      const plotId = app.plotId;
      if (!acc[plotId]) {
        acc[plotId] = [];
      }
      acc[plotId].push(app);
      return acc;
    },
    {} as Record<string, Application[]>
  );

  // Create farm map
  const farmMap = new Map<string, string>();
  if (serviceOrder.farms && Array.isArray(serviceOrder.farms)) {
    serviceOrder.farms.forEach((farm) => {
      if (farm.plots && Array.isArray(farm.plots)) {
        farm.plots.forEach((plot) => {
          if (plot.id) {
            farmMap.set(plot.id, farm.name);
          }
        });
      }
    });
  }

  // Generate cover page (matching frontend exactly)
  const coverPage = `
    <div class="cover-page">
      <div class="cover-header">
        <img src="${PDF_LOGO_COMPLETE}" alt="Logo" class="cover-logo" />
        <h1 class="company-name">DS Drones Agrícolas LTDA</h1>
        <p class="company-info">
          54.134.198/0001-25<br/>
          Imperatriz - MA<br/>
          +55 99 9174-5656
        </p>
      </div>

      <div class="service-order-info">
        <h2 class="section-title">Informações da Ordem de Serviço</h2>
        
        <div class="info-row">
          <span class="info-label">Número da OS:</span>
          <span class="info-value">#${serviceOrder.number}</span>
        </div>
        
        <div class="info-row">
          <span class="info-label">Cliente:</span>
          <span class="info-value">${serviceOrder.customer?.name || 'N/A'}</span>
        </div>
        
        <div class="info-row">
          <span class="info-label">Contrato:</span>
          <span class="info-value">${serviceOrder.contract?.name || 'N/A'}</span>
        </div>
        
        <div class="info-row">
          <span class="info-label">Data Planejada:</span>
          <span class="info-value">${formatDate(serviceOrder.plannedDate)}</span>
        </div>
        
        ${
          serviceOrder.farms && serviceOrder.farms.length > 0
            ? `
        <div class="info-row">
          <span class="info-label">Fazendas:</span>
          <div class="info-value">
            ${serviceOrder.farms.map((farm) => `<span class="badge">${farm.name}</span>`).join('')}
          </div>
        </div>
        `
            : ''
        }
        
        ${
          serviceOrder.pilots && serviceOrder.pilots.length > 0
            ? `
        <div class="info-row">
          <span class="info-label">Pilotos:</span>
          <div class="info-value">
            ${serviceOrder.pilots
              .map((pilot) => `<span class="badge">${pilot.name}</span>`)
              .join('')}
          </div>
        </div>
        `
            : ''
        }
        
        ${
          serviceOrder.observation
            ? `
        <div class="info-row">
          <span class="info-label">Observação:</span>
          <span class="info-value">${serviceOrder.observation}</span>
        </div>
        `
            : ''
        }
      </div>
    </div>
  `;

  // Generate application pages grouped by plot (matching frontend exactly)
  const applicationPages = Object.entries(applicationsByPlot).map(
    ([plotId, plotApplications], plotIndex) => {
      const firstApp = plotApplications[0];

      // Get plot data with GeoJSON from service order data
      const plot = plotDataMap.get(plotId) || firstApp.plot;

      const mapWidth = 1280;
      const mapHeight = 480;
      const mapUrl = buildReportMapboxStaticUrl({
        plot,
        mapWidth,
        mapHeight,
        accessToken: process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN,
      });

      return `
      <div class="page">
        <div class="page-header">
          <img src="${PDF_LOGO_ONLY}" alt="Logo" class="header-logo" />
          <span class="page-number">Página ${plotIndex + 1}</span>
        </div>

        <div class="map-container">
          ${
            mapUrl
              ? `
          <img src="${mapUrl}" alt="Mapa do Talhão" class="map-image" />
          `
              : `
          <div class="map-placeholder">
            <p>Mapa não disponível</p>
          </div>
          `
          }
        </div>

        <div class="plot-info-card">
          <h3 class="plot-name">${plot.name}</h3>
          <div class="plot-detail">
            <span class="plot-label">Fazenda:</span>
            <span class="plot-value">${farmMap.get(firstApp.plotId) || 'N/A'}</span>
          </div>
          <div class="plot-detail">
            <span class="plot-label">Área:</span>
            <span class="plot-value">${formatHectares(plot.hectare)}</span>
          </div>
          <div class="plot-detail">
            <span class="plot-label">Aplicações:</span>
            <span class="plot-value">${plotApplications.length}</span>
          </div>
        </div>

        ${plotApplications
          .map(
            (application) => `
        <div class="application-card">
          <div class="application-header">
            <h4 class="product-name">${application.product?.name || 'N/A'}</h4>
            <span class="application-date">${formatDate(application.date)}</span>
          </div>

          <div class="application-details">
            <div class="detail-col">
              <span class="detail-label">Piloto:</span>
              <span class="detail-value">${application.pilot?.name || 'N/A'}</span>
            </div>
            <div class="detail-col">
              <span class="detail-label">Assistente:</span>
              <span class="detail-value">${application.assistant?.name || 'N/A'}</span>
            </div>
            <div class="detail-col">
              <span class="detail-label">Drone:</span>
              <span class="detail-value">${application.drone?.name || 'N/A'} - ${application.drone?.model || 'N/A'}</span>
            </div>
            <div class="detail-col">
              <span class="detail-label">Cultura:</span>
              <span class="detail-value">${application.culture?.name || 'N/A'}</span>
            </div>
            <div class="detail-col">
              <span class="detail-label">Hectares:</span>
              <span class="detail-value">${formatHectares(application.hectares)}</span>
            </div>
            <div class="detail-col">
              <span class="detail-label">Taxa de Fluxo:</span>
              <span class="detail-value">${parseFloat(application.flowRate).toFixed(2)} L/ha</span>
            </div>
            <div class="detail-col">
              <span class="detail-label">Altitude:</span>
              <span class="detail-value">${parseFloat(application.altitude).toFixed(2)} m</span>
            </div>
            <div class="detail-col">
              <span class="detail-label">Espaçamento:</span>
              <span class="detail-value">${parseFloat(application.routeSpacing).toFixed(2)} m</span>
            </div>
            <div class="detail-col">
              <span class="detail-label">Tamanho de Gota:</span>
              <span class="detail-value">${parseFloat(application.dropletSize).toFixed(2)} µm</span>
            </div>
            ${
              application.observations
                ? `
            <div class="detail-col-full">
              <span class="detail-label">Observações:</span>
              <span class="detail-value">${application.observations}</span>
            </div>
            `
                : ''
            }
          </div>
        </div>
        `
          )
          .join('')}
      </div>
    `;
    }
  );

  // Generate complete HTML
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Relatório OS ${serviceOrder.number}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'Helvetica', 'Arial', sans-serif;
          color: #1F2937;
          font-size: 10px;
          line-height: 1.6;
          background: #FFFFFF;
        }

        /* Cover Page Styles - Matching Frontend */
        .cover-page {
          page-break-after: always;
          display: flex;
          flex-direction: column;
          padding: 40px;
          background-color: #FFFFFF;
          min-height: 100vh;
        }

        .cover-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          margin-bottom: 40px;
        }

        .cover-logo {
          width: 300px;
          height: 100px;
          object-fit: contain;
          margin-bottom: 30px;
        }

        .company-name {
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 10px;
          color: #1F2937;
        }

        .company-info {
          font-size: 12px;
          text-align: center;
          margin-bottom: 40px;
          line-height: 1.5;
          color: #1F2937;
        }

        .service-order-info {
          width: 100%;
          margin-top: 20px;
          padding: 20px;
          border: 1px solid #E5E7EB;
          border-radius: 8px;
        }

        .section-title {
          font-size: 14px;
          font-weight: 700;
          margin-bottom: 15px;
          color: #1F2937;
        }

        .info-row {
          display: flex;
          margin-bottom: 8px;
        }

        .info-label {
          font-size: 10px;
          font-weight: 700;
          width: 40%;
          color: #6B7280;
        }

        .info-value {
          font-size: 10px;
          width: 60%;
          color: #1F2937;
        }

        .badge {
          background-color: #FFF3CD;
          color: #EAAE07;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 8px;
          margin-right: 4px;
          margin-bottom: 4px;
          display: inline-block;
        }

        /* Page Styles - Matching Frontend */
        .page {
          page-break-after: always;
          padding: 30px;
          background-color: #FFFFFF;
          font-size: 10px;
        }

        .page:last-child {
          page-break-after: auto;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 10px;
          border-bottom: 2px solid #EAAE07;
        }

        .header-logo {
          width: 120px;
          height: 30px;
          object-fit: contain;
        }

        .page-number {
          font-size: 10px;
          color: #6B7280;
        }

        /* Map Container */
        .map-container {
          width: 100%;
          height: 200px;
          position: relative;
          margin-bottom: 20px;
          border: 1px solid #E5E7EB;
        }

        .map-image {
          width: 100%;
          height: 100%;
          object-fit: contain;
          display: block;
        }

        .map-placeholder {
          width: 100%;
          height: 100%;
          background-color: #F3F4F6;
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .map-placeholder p {
          font-size: 14px;
          color: #6B7280;
          font-weight: 500;
        }

        /* Plot Info Card */
        .plot-info-card {
          background-color: #F9FAFB;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 15px;
          border: 1px solid #E5E7EB;
        }

        .plot-name {
          font-size: 14px;
          font-weight: 700;
          margin-bottom: 10px;
          color: #EAAE07;
        }

        .plot-detail {
          display: flex;
          margin-bottom: 5px;
        }

        .plot-label {
          font-size: 9px;
          font-weight: 700;
          width: 40%;
          color: #6B7280;
        }

        .plot-value {
          font-size: 9px;
          width: 60%;
          color: #1F2937;
        }

        /* Application Card */
        .application-card {
          background-color: #FFFFFF;
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 10px;
          border: 1px solid #E5E7EB;
          page-break-inside: avoid;
        }

        .application-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
          padding-bottom: 8px;
          border-bottom: 1px solid #E5E7EB;
        }

        .product-name {
          font-size: 12px;
          font-weight: 700;
          color: #EAAE07;
        }

        .application-date {
          font-size: 10px;
          color: #6B7280;
        }

        /* Application Details */
        .application-details {
          display: flex;
          flex-wrap: wrap;
        }

        .detail-col {
          width: 50%;
          margin-bottom: 4px;
          display: flex;
          flex-direction: column;
        }

        .detail-col-full {
          width: 100%;
          margin-top: 6px;
        }

        .detail-label {
          font-size: 8px;
          font-weight: 700;
          color: #6B7280;
          margin-bottom: 2px;
        }

        .detail-value {
          font-size: 8px;
          color: #1F2937;
        }

        /* Print Styles */
        @media print {
          .page {
            page-break-after: always;
          }

          .cover-page {
            page-break-after: always;
          }

          .application-card {
            page-break-inside: avoid;
          }
        }
      </style>
    </head>
    <body>
      ${coverPage}
      ${applicationPages.join('')}
    </body>
    </html>
  `;
};
