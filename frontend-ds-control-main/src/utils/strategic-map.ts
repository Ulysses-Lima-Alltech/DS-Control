import { ServiceOrder } from '@/types/service-order.type';

/**
 * Converts GeoJSON coordinates to KML coordinate format
 * GeoJSON: [longitude, latitude, elevation?]
 * KML: longitude,latitude,elevation (space separated tuples)
 */
function formatCoordinatesForKML(coordinates: number[][]): string {
  return coordinates
    .map((coord) => {
      const [lon, lat, elevation = 0] = coord;
      return `${lon},${lat},${elevation}`;
    })
    .join(' ');
}

/**
 * Generates KML content for a single plot
 */
function generatePlotKML(plotName: string, geoJson: GeoJSON.FeatureCollection): string {
  let kmlContent = '';

  geoJson.features.forEach((feature, index) => {
    const geometry = feature.geometry;
    const plotDisplayName = `${plotName}${geoJson.features.length > 1 ? ` - Parte ${index + 1}` : ''}`;

    kmlContent += `
    <Placemark>
      <name>${plotDisplayName}</name>
      <description>Talhão: ${plotName}</description>
      <Style>
        <LineStyle>
          <color>ff0000ff</color>
          <width>2</width>
        </LineStyle>
        <PolyStyle>
          <color>4d0000ff</color>
          <fill>1</fill>
          <outline>1</outline>
        </PolyStyle>
      </Style>`;

    if (geometry.type === 'Polygon') {
      kmlContent += `
      <Polygon>
        <extrude>1</extrude>
        <altitudeMode>relativeToGround</altitudeMode>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>
              ${formatCoordinatesForKML(geometry.coordinates[0] as number[][])}
            </coordinates>
          </LinearRing>
        </outerBoundaryIs>`;

      if (geometry.coordinates.length > 1) {
        for (let i = 1; i < geometry.coordinates.length; i++) {
          kmlContent += `
        <innerBoundaryIs>
          <LinearRing>
            <coordinates>
              ${formatCoordinatesForKML(geometry.coordinates[i] as number[][])}
            </coordinates>
          </LinearRing>
        </innerBoundaryIs>`;
        }
      }

      kmlContent += `
      </Polygon>`;
    } else if (geometry.type === 'MultiPolygon') {
      geometry.coordinates.forEach((polygon) => {
        kmlContent += `
      <Polygon>
        <extrude>1</extrude>
        <altitudeMode>relativeToGround</altitudeMode>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>
              ${formatCoordinatesForKML(polygon[0] as number[][])}
            </coordinates>
          </LinearRing>
        </outerBoundaryIs>`;

        if (polygon.length > 1) {
          for (let i = 1; i < polygon.length; i++) {
            kmlContent += `
        <innerBoundaryIs>
          <LinearRing>
            <coordinates>
              ${formatCoordinatesForKML(polygon[i] as number[][])}
            </coordinates>
          </LinearRing>
        </innerBoundaryIs>`;
          }
        }

        kmlContent += `
      </Polygon>`;
      });
    }

    kmlContent += `
    </Placemark>`;
  });

  return kmlContent;
}

/**
 * Generates a KML file with all plots from a service order
 * @param serviceOrder - The service order containing plots to include in the KML
 * @returns Promise that resolves when the KML file is downloaded
 */
export async function generateStrategicMap(serviceOrder: ServiceOrder): Promise<void> {
  if (!serviceOrder.plots || serviceOrder.plots.length === 0) {
    throw new Error('Nenhum talhão encontrado para esta ordem de serviço.');
  }

  const serviceOrderName = `OS ${serviceOrder.number}`;
  const customerName = serviceOrder.customer?.name || 'Cliente';
  const kmlHeader = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Mapa Estratégico - ${serviceOrderName}</name>
    <description>Mapa estratégico dos talhões da ${serviceOrderName} - Cliente: ${customerName}</description>
    
    <Style id="plotStyle">
      <LineStyle>
        <color>ff0000ff</color>
        <width>2</width>
      </LineStyle>
      <PolyStyle>
        <color>4d0000ff</color>
        <fill>1</fill>
        <outline>1</outline>
      </PolyStyle>
    </Style>
    
    <Folder>
      <name>Talhões - ${serviceOrderName}</name>
      <description>Todos os talhões da ordem de serviço ${serviceOrder.number}</description>`;

  let kmlContent = kmlHeader;

  serviceOrder.plots.forEach((plot) => {
    if (plot.geoJson && plot.geoJson.features && plot.geoJson.features.length > 0) {
      kmlContent += generatePlotKML(plot.name, plot.geoJson);
    }
  });

  const kmlFooter = `
    </Folder>
  </Document>
</kml>`;

  kmlContent += kmlFooter;

  const blob = new Blob([kmlContent], { type: 'application/vnd.google-earth.kml+xml' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `mapa-estrategico-OS-${serviceOrder.number}-${customerName.replace(/\s+/g, '-')}.kml`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
