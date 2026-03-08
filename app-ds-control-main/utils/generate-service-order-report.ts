import { Application } from '@/types/applications.type';
import { ServiceOrder } from '@/types/service-order.type';
import { Plot } from '@/types/plot.type';
import { Image } from 'react-native';

const resolveImageUri = (imagePath: any): string => {
  if (typeof imagePath === 'number') {
    return Image.resolveAssetSource(imagePath).uri;
  }
  return imagePath;
};

// Utility functions for map generation (matching frontend)
type BoundingBox = {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
  centerLng: number;
  centerLat: number;
};

const calculatePlotBounds = (plot: Plot): BoundingBox | null => {
  try {
    let geoJson = plot.geoJson;

    // Parse if string
    if (typeof geoJson === 'string') {
      try {
        geoJson = JSON.parse(geoJson);
      } catch (error) {
        console.error('Failed to parse geoJson string:', error);
        return null;
      }
    }

    // Check if geoJson has features
    if (!geoJson) {
      console.error('GeoJSON is null or undefined for plot:', plot.name || plot.id);
      return null;
    }

    if (!geoJson.features || geoJson.features.length === 0) {
      console.error('GeoJSON has no features for plot:', plot.name || plot.id);
      return null;
    }

    let minLng = Infinity;
    let minLat = Infinity;
    let maxLng = -Infinity;
    let maxLat = -Infinity;

    geoJson.features.forEach((feature: any) => {
      if (!feature.geometry) {
        console.error('Feature has no geometry');
        return;
      }

      if (feature.geometry.type === 'Polygon') {
        feature.geometry.coordinates.forEach((ring: any) => {
          ring.forEach((coord: any) => {
            const [lng, lat] = coord;
            minLng = Math.min(minLng, lng);
            minLat = Math.min(minLat, lat);
            maxLng = Math.max(maxLng, lng);
            maxLat = Math.max(maxLat, lat);
          });
        });
      } else if (feature.geometry.type === 'MultiPolygon') {
        feature.geometry.coordinates.forEach((polygon: any) => {
          polygon.forEach((ring: any) => {
            ring.forEach((coord: any) => {
              const [lng, lat] = coord;
              minLng = Math.min(minLng, lng);
              minLat = Math.min(minLat, lat);
              maxLng = Math.max(maxLng, lng);
              maxLat = Math.max(maxLat, lat);
            });
          });
        });
      }
    });

    // Check if we got valid bounds
    if (
      minLng === Infinity ||
      maxLng === -Infinity ||
      minLat === Infinity ||
      maxLat === -Infinity
    ) {
      console.error('Failed to calculate valid bounds');
      return null;
    }

    const bounds = {
      minLng,
      minLat,
      maxLng,
      maxLat,
      centerLng: (minLng + maxLng) / 2,
      centerLat: (minLat + maxLat) / 2,
    };

    return bounds;
  } catch (error) {
    console.error('Error in calculatePlotBounds:', error);
    return null;
  }
};

const generateMapboxStaticUrl = (bounds: BoundingBox, width: number, height: number): string => {
  const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

  // Use bbox approach with padding for better reliability (matching frontend)
  const padding = 0.1; // 10% padding
  const lngPadding = (bounds.maxLng - bounds.minLng) * padding;
  const latPadding = (bounds.maxLat - bounds.minLat) * padding;

  const bbox = [
    bounds.minLng - lngPadding,
    bounds.minLat - latPadding,
    bounds.maxLng + lngPadding,
    bounds.maxLat + latPadding,
  ].join(',');

  return `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/[${bbox}]/${width}x${height}?access_token=${MAPBOX_ACCESS_TOKEN}`;
};

const convertCoordinatesToSvgPath = (
  plot: Plot,
  bounds: BoundingBox,
  width: number,
  height: number
): string[] => {
  let geoJson = plot.geoJson;
  if (typeof geoJson === 'string') {
    try {
      geoJson = JSON.parse(geoJson);
    } catch (error) {
      console.error('Failed to parse geoJson string in convertCoordinatesToSvgPath:', error);
      return [];
    }
  }

  if (!geoJson?.features || geoJson.features.length === 0) {
    return [];
  }

  // Use Web Mercator projection to match Mapbox exactly
  const padding = 0.1; // Same padding as map generation
  const lngPadding = (bounds.maxLng - bounds.minLng) * padding;
  const latPadding = (bounds.maxLat - bounds.minLat) * padding;

  const paddedMinLng = bounds.minLng - lngPadding;
  const paddedMaxLng = bounds.maxLng + lngPadding;
  const paddedMinLat = bounds.minLat - latPadding;
  const paddedMaxLat = bounds.maxLat + latPadding;

  // Calculate the zoom level that Mapbox would use for this bbox
  const calculateZoomForBbox = (
    minLng: number,
    minLat: number,
    maxLng: number,
    maxLat: number
  ): number => {
    const latDiff = maxLat - minLat;
    const lngDiff = maxLng - minLng;

    const latZoom = Math.floor(Math.log2(360 / latDiff));
    const lngZoom = Math.floor(Math.log2(360 / lngDiff));

    const zoom = Math.min(latZoom, lngZoom, 18);
    return Math.max(zoom, 1);
  };

  const zoom = calculateZoomForBbox(paddedMinLng, paddedMinLat, paddedMaxLng, paddedMaxLat);
  const scale = Math.pow(2, zoom);

  // Web Mercator projection functions with proper zoom scaling
  const lngToX = (lng: number): number => {
    return ((lng + 180) / 360) * 256 * scale;
  };

  const latToY = (lat: number): number => {
    const latRad = (lat * Math.PI) / 180;
    const mercatorY = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
    return (256 * scale * (1 - mercatorY / Math.PI)) / 2;
  };

  // Calculate bounds in Web Mercator coordinates
  const minX = lngToX(paddedMinLng);
  const maxX = lngToX(paddedMaxLng);
  const minY = latToY(paddedMaxLat);
  const maxY = latToY(paddedMinLat);

  const xRange = maxX - minX;
  const yRange = maxY - minY;

  // Calculate the aspect ratio distortion
  const mapAspectRatio = xRange / yRange;
  const containerAspectRatio = width / height;
  const horizontalCompression = mapAspectRatio / containerAspectRatio;

  // Convert Web Mercator coordinates to SVG coordinates
  const coordinateToPixel = (lng: number, lat: number): [number, number] => {
    const mercatorX = lngToX(lng);
    const mercatorY = latToY(lat);

    const x = ((mercatorX - minX) / xRange) * width;
    const y = ((mercatorY - minY) / yRange) * height;

    const compressedX = (x - width / 2) * horizontalCompression + width / 2;
    return [compressedX, y];
  };

  const paths: string[] = [];

  geoJson.features.forEach((feature: any) => {
    if (feature.geometry.type === 'Polygon') {
      feature.geometry.coordinates.forEach((ring: any) => {
        const pathData =
          ring
            .map((coord: any, index: number) => {
              const [x, y] = coordinateToPixel(coord[0], coord[1]);
              return index === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
            })
            .join(' ') + ' Z';
        paths.push(pathData);
      });
    } else if (feature.geometry.type === 'MultiPolygon') {
      feature.geometry.coordinates.forEach((polygon: any) => {
        polygon.forEach((ring: any) => {
          const pathData =
            ring
              .map((coord: any, index: number) => {
                const [x, y] = coordinateToPixel(coord[0], coord[1]);
                return index === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
              })
              .join(' ') + ' Z';
          paths.push(pathData);
        });
      });
    }
  });

  return paths;
};

const getPlotFillColor = (plot: Plot): string => {
  let geoJson = plot.geoJson;
  if (typeof geoJson === 'string') {
    try {
      geoJson = JSON.parse(geoJson);
    } catch (error) {
      return '#3388ff';
    }
  }

  if (geoJson?.features && geoJson.features.length > 0) {
    const fill = geoJson.features[0]?.properties?.fill;
    if (fill && typeof fill === 'string') {
      return fill;
    }
  }
  return '#3388ff';
};

const getPlotStrokeColor = (plot: Plot): string => {
  let geoJson = plot.geoJson;
  if (typeof geoJson === 'string') {
    try {
      geoJson = JSON.parse(geoJson);
    } catch (error) {
      return '#3388ff';
    }
  }

  if (geoJson?.features && geoJson.features.length > 0) {
    const stroke = geoJson.features[0]?.properties?.stroke;
    if (stroke && typeof stroke === 'string') {
      return stroke;
    }
  }
  return '#3388ff';
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

      // Generate map with bbox approach (matching frontend)
      const mapWidth = 1280;
      const mapHeight = 480;
      const bounds = calculatePlotBounds(plot);
      const mapUrl = bounds ? generateMapboxStaticUrl(bounds, mapWidth, mapHeight) : null;
      const svgPaths = bounds ? convertCoordinatesToSvgPath(plot, bounds, mapWidth, mapHeight) : [];
      const fillColor = getPlotFillColor(plot);
      const strokeColor = getPlotStrokeColor(plot);

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
          <svg viewBox="0 0 ${mapWidth} ${mapHeight}" class="svg-overlay">
            ${svgPaths
              .map(
                (pathData) => `
              <path
                d="${pathData}"
                fill="${fillColor}"
                fill-opacity="0.3"
                stroke="${strokeColor}"
                stroke-width="3"
              />
            `
              )
              .join('')}
          </svg>
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
          object-fit: fill;
          display: block;
        }

        .svg-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
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
