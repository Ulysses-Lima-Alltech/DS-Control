import { Document, Font, Image, Page, Path, Svg, Text, View } from '@react-pdf/renderer';
import React from 'react';

import { Application } from '@/types/applications.type';
import { Plot } from '@/types/plot.type';
import { ServiceOrder } from '@/types/service-order.type';

Font.register({
  family: 'Roboto',
  fonts: [
    {
      src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-light-webfont.ttf',
      fontWeight: 300,
    },
    {
      src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf',
      fontWeight: 400,
    },
    {
      src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-medium-webfont.ttf',
      fontWeight: 500,
    },
    {
      src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-bold-webfont.ttf',
      fontWeight: 700,
    },
  ],
});

// Utility functions for map generation
type BoundingBox = {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
  centerLng: number;
  centerLat: number;
};

const calculatePlotBounds = (plot: Plot): BoundingBox | null => {
  // Check if geoJson is a string and parse it
  let geoJson = plot.geoJson;
  if (typeof geoJson === 'string') {
    try {
      geoJson = JSON.parse(geoJson);
    } catch (error) {
      console.error('Failed to parse geoJson string:', error);
      return null;
    }
  }

  if (!geoJson?.features || geoJson.features.length === 0) {
    return null;
  }

  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  geoJson.features.forEach((feature) => {
    if (feature.geometry.type === 'Polygon') {
      feature.geometry.coordinates.forEach((ring) => {
        ring.forEach((coord) => {
          const [lng, lat] = coord;
          minLng = Math.min(minLng, lng);
          minLat = Math.min(minLat, lat);
          maxLng = Math.max(maxLng, lng);
          maxLat = Math.max(maxLat, lat);
        });
      });
    } else if (feature.geometry.type === 'MultiPolygon') {
      feature.geometry.coordinates.forEach((polygon) => {
        polygon.forEach((ring) => {
          ring.forEach((coord) => {
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

  return {
    minLng,
    minLat,
    maxLng,
    maxLat,
    centerLng: (minLng + maxLng) / 2,
    centerLat: (minLat + maxLat) / 2,
  };
};

const generateMapboxStaticUrl = (bounds: BoundingBox, width: number, height: number): string => {
  const MAPBOX_ACCESS_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

  // Use bbox approach with padding for better reliability
  const padding = 0.1; // 10% padding
  const lngPadding = (bounds.maxLng - bounds.minLng) * padding;
  const latPadding = (bounds.maxLat - bounds.minLat) * padding;

  const bbox = [
    bounds.minLng - lngPadding,
    bounds.minLat - latPadding,
    bounds.maxLng + lngPadding,
    bounds.maxLat + latPadding,
  ].join(',');

  const url = `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/[${bbox}]/${width}x${height}?access_token=${MAPBOX_ACCESS_TOKEN}`;

  // Test the URL by making a request to see if it's valid
  fetch(url)
    .then((response) => {
      if (!response.ok) {
        console.error('Mapbox API error:', response.status, response.statusText);
      }
    })
    .catch((error) => {
      console.error('Mapbox API fetch error:', error);
    });

  // Use Mapbox Static Images API with bbox
  return url;
};

const convertCoordinatesToSvgPath = (
  plot: Plot,
  bounds: BoundingBox,
  width: number,
  height: number
): string[] => {
  // Check if geoJson is a string and parse it
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

    // Calculate zoom based on the larger dimension
    const latZoom = Math.floor(Math.log2(360 / latDiff));
    const lngZoom = Math.floor(Math.log2(360 / lngDiff));

    // Use the smaller zoom to ensure the bbox fits
    const zoom = Math.min(latZoom, lngZoom, 18);

    return Math.max(zoom, 1); // Minimum zoom of 1
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
  const minY = latToY(paddedMaxLat); // Note: inverted for top-left origin
  const maxY = latToY(paddedMinLat);

  const xRange = maxX - minX;
  const yRange = maxY - minY;

  // Calculate the aspect ratio distortion that the map image will have
  // The map image will be stretched to fill the container, so we need to compress the polygon
  const mapAspectRatio = xRange / yRange; // Original map aspect ratio
  const containerAspectRatio = width / height; // Container aspect ratio
  const horizontalCompression = mapAspectRatio / containerAspectRatio; // Inverse of stretch

  // Convert Web Mercator coordinates to SVG coordinates
  const coordinateToPixel = (lng: number, lat: number): [number, number] => {
    const mercatorX = lngToX(lng);
    const mercatorY = latToY(lat);

    // Map to SVG coordinates with horizontal compression correction
    const x = ((mercatorX - minX) / xRange) * width;
    const y = ((mercatorY - minY) / yRange) * height;

    // Apply horizontal compression to match the stretched map image
    const compressedX = (x - width / 2) * horizontalCompression + width / 2;
    return [compressedX, y];
  };

  const paths: string[] = [];

  geoJson.features.forEach((feature) => {
    if (feature.geometry.type === 'Polygon') {
      feature.geometry.coordinates.forEach((ring) => {
        const pathData =
          ring
            .map((coord, index) => {
              const [x, y] = coordinateToPixel(coord[0], coord[1]);
              return index === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
            })
            .join(' ') + ' Z';
        paths.push(pathData);
      });
    } else if (feature.geometry.type === 'MultiPolygon') {
      feature.geometry.coordinates.forEach((polygon) => {
        polygon.forEach((ring) => {
          const pathData =
            ring
              .map((coord, index) => {
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
  // Check if geoJson is a string and parse it
  let geoJson = plot.geoJson;
  if (typeof geoJson === 'string') {
    try {
      geoJson = JSON.parse(geoJson);
    } catch (error) {
      console.error('Failed to parse geoJson string in getPlotFillColor:', error);
      return '#3388ff';
    }
  }

  // Extract fill color from geoJson properties if available
  if (geoJson?.features && geoJson.features.length > 0) {
    const fill = geoJson.features[0]?.properties?.fill;
    if (fill && typeof fill === 'string') {
      return fill;
    }
  }
  return '#3388ff'; // Default blue color
};

const getPlotStrokeColor = (plot: Plot): string => {
  // Check if geoJson is a string and parse it
  let geoJson = plot.geoJson;
  if (typeof geoJson === 'string') {
    try {
      geoJson = JSON.parse(geoJson);
    } catch (error) {
      console.error('Failed to parse geoJson string in getPlotStrokeColor:', error);
      return '#3388ff';
    }
  }

  // Extract stroke color from geoJson properties if available
  if (geoJson?.features && geoJson.features.length > 0) {
    const stroke = geoJson.features[0]?.properties?.stroke;
    if (stroke && typeof stroke === 'string') {
      return stroke;
    }
  }
  return '#3388ff'; // Default blue color
};

interface ApplicationsReportPDFProps {
  serviceOrder: ServiceOrder;
  applications: Application[];
}

const ApplicationsReportPDF: React.FC<ApplicationsReportPDFProps> = ({
  serviceOrder,
  applications,
}) => {
  const applicationsWithPlot = applications.filter((app) => app.plotId !== null);

  const applicationsByPlot = applicationsWithPlot.reduce(
    (acc, app) => {
      const plotId = app.plotId!;
      if (!acc[plotId]) {
        acc[plotId] = [];
      }
      acc[plotId].push(app);
      return acc;
    },
    {} as Record<string, Application[]>
  );

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

  const generatedDateTime = new Date().toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

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

  const totalHectares = applications.reduce((sum, app) => sum + parseFloat(app.hectares), 0);

  const averageFlowRate =
    applications.length > 0
      ? applications.reduce((sum, app) => sum + parseFloat(app.flowRate), 0) / applications.length
      : 0;

  const averageAltitude =
    applications.length > 0
      ? applications.reduce((sum, app) => sum + parseFloat(app.altitude), 0) / applications.length
      : 0;

  const averageRouteSpacing =
    applications.length > 0
      ? applications.reduce((sum, app) => sum + parseFloat(app.routeSpacing), 0) /
        applications.length
      : 0;

  const averageDropletSize =
    applications.length > 0
      ? applications.reduce((sum, app) => sum + parseFloat(app.dropletSize), 0) /
        applications.length
      : 0;

  return (
    <Document>
      <Page
        size='A4'
        style={{
          flexDirection: 'column',
          backgroundColor: '#FFFFFF',
          fontFamily: 'Roboto',
          fontSize: 10,
        }}
      >
        <View
          style={{
            padding: 40,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image
            src={`/images/pdf-logo-complete.png`}
            style={{
              width: 300,
              height: 100,
              marginBottom: 30,
              objectFit: 'contain',
            }}
          />
          <Text
            style={{
              fontSize: 24,
              fontWeight: 700,
              marginBottom: 10,
              textAlign: 'center',
            }}
          >
            DS Drones Agrícolas LTDA
          </Text>
          <Text
            style={{
              fontSize: 12,
              textAlign: 'center',
              marginBottom: 40,
              lineHeight: 1.5,
            }}
          >
            54.134.198/0001-25{'\n'}
            Imperatriz - MA{'\n'}
            +55 99 9174-5656
          </Text>

          <View
            style={{
              width: '100%',
              marginTop: 20,
              padding: 20,
              border: '1px solid #E5E7EB',
              borderRadius: 8,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: 700,
                marginBottom: 15,
                color: '#1F2937',
              }}
            >
              Informações da Ordem de Serviço
            </Text>
            <View
              style={{
                flexDirection: 'row',
                marginBottom: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  width: '40%',
                  color: '#6B7280',
                }}
              >
                Número da OS:
              </Text>
              <Text
                style={{
                  fontSize: 10,
                  width: '60%',
                  color: '#1F2937',
                }}
              >
                #{serviceOrder.number}
              </Text>
            </View>
            <View
              style={{
                flexDirection: 'row',
                marginBottom: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  width: '40%',
                  color: '#6B7280',
                }}
              >
                Cliente:
              </Text>
              <Text
                style={{
                  fontSize: 10,
                  width: '60%',
                  color: '#1F2937',
                }}
              >
                {serviceOrder.customer?.name || 'N/A'}
              </Text>
            </View>
            <View
              style={{
                flexDirection: 'row',
                marginBottom: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  width: '40%',
                  color: '#6B7280',
                }}
              >
                Contrato:
              </Text>
              <Text
                style={{
                  fontSize: 10,
                  width: '60%',
                  color: '#1F2937',
                }}
              >
                {serviceOrder.contract?.name || 'N/A'}
              </Text>
            </View>
            <View
              style={{
                flexDirection: 'row',
                marginBottom: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  width: '40%',
                  color: '#6B7280',
                }}
              >
                Data Planejada:
              </Text>
              <Text
                style={{
                  fontSize: 10,
                  width: '60%',
                  color: '#1F2937',
                }}
              >
                {formatDate(serviceOrder.plannedDate)}
              </Text>
            </View>
            {serviceOrder.farms && serviceOrder.farms.length > 0 && (
              <View
                style={{
                  flexDirection: 'row',
                  marginBottom: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    width: '40%',
                    color: '#6B7280',
                  }}
                >
                  Fazendas:
                </Text>
                <View style={{ width: '60%', flexDirection: 'row', flexWrap: 'wrap' }}>
                  {serviceOrder.farms.map((farm) => (
                    <Text
                      key={farm.id}
                      style={{
                        backgroundColor: '#FFF3CD',
                        color: '#EAAE07',
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 4,
                        fontSize: 8,
                        marginRight: 4,
                        marginBottom: 4,
                      }}
                    >
                      {farm.name}
                    </Text>
                  ))}
                </View>
              </View>
            )}
            {serviceOrder.pilots && serviceOrder.pilots.length > 0 && (
              <View
                style={{
                  flexDirection: 'row',
                  marginBottom: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    width: '40%',
                    color: '#6B7280',
                  }}
                >
                  Pilotos:
                </Text>
                <View style={{ width: '60%', flexDirection: 'row', flexWrap: 'wrap' }}>
                  {serviceOrder.pilots.map((pilot) => (
                    <Text
                      key={pilot.id}
                      style={{
                        backgroundColor: '#FFF3CD',
                        color: '#EAAE07',
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 4,
                        fontSize: 8,
                        marginRight: 4,
                        marginBottom: 4,
                      }}
                    >
                      {pilot.name}
                    </Text>
                  ))}
                </View>
              </View>
            )}
            {serviceOrder.observation && (
              <View
                style={{
                  flexDirection: 'row',
                  marginBottom: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    width: '40%',
                    color: '#6B7280',
                  }}
                >
                  Observação:
                </Text>
                <Text
                  style={{
                    fontSize: 10,
                    width: '60%',
                    color: '#1F2937',
                  }}
                >
                  {serviceOrder.observation}
                </Text>
              </View>
            )}
          </View>

          <View
            style={{
              width: '100%',
              marginTop: 30,
              padding: 20,
              border: '1px solid #E5E7EB',
              borderRadius: 8,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: 700,
                marginBottom: 15,
                color: '#1F2937',
              }}
            >
              Estatísticas das Aplicações
            </Text>

            <View
              style={{
                backgroundColor: '#FFF3CD',
                padding: 12,
                borderRadius: 6,
                marginBottom: 12,
                border: '2px solid #EAAE07',
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#6B7280',
                  }}
                >
                  Total de Hectares:
                </Text>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: '#EAAE07',
                  }}
                >
                  {totalHectares.toFixed(2)} ha
                </Text>
              </View>
            </View>

            <View
              style={{
                flexDirection: 'row',
                marginBottom: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  width: '50%',
                  color: '#6B7280',
                }}
              >
                Taxa de Fluxo (Vazão) Média:
              </Text>
              <Text
                style={{
                  fontSize: 10,
                  width: '50%',
                  color: '#1F2937',
                }}
              >
                {averageFlowRate.toFixed(2)} L/ha
              </Text>
            </View>

            <View
              style={{
                flexDirection: 'row',
                marginBottom: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  width: '50%',
                  color: '#6B7280',
                }}
              >
                Altitude Média:
              </Text>
              <Text
                style={{
                  fontSize: 10,
                  width: '50%',
                  color: '#1F2937',
                }}
              >
                {averageAltitude.toFixed(2)} m
              </Text>
            </View>

            <View
              style={{
                flexDirection: 'row',
                marginBottom: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  width: '50%',
                  color: '#6B7280',
                }}
              >
                Espaçamento Médio:
              </Text>
              <Text
                style={{
                  fontSize: 10,
                  width: '50%',
                  color: '#1F2937',
                }}
              >
                {averageRouteSpacing.toFixed(2)} m
              </Text>
            </View>

            <View
              style={{
                flexDirection: 'row',
                marginBottom: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  width: '50%',
                  color: '#6B7280',
                }}
              >
                Tamanho de Gota Médio:
              </Text>
              <Text
                style={{
                  fontSize: 10,
                  width: '50%',
                  color: '#1F2937',
                }}
              >
                {averageDropletSize.toFixed(2)} µm
              </Text>
            </View>
          </View>
        </View>
      </Page>

      {Object.entries(applicationsByPlot).map(([plotId, plotApplications], plotIndex) => {
        const firstApp = plotApplications[0];
        const plot = firstApp.plot;

        // Generate map data
        // Use dimensions that match the PDF container aspect ratio better
        // A4 width with 30px padding on each side = ~535 points, height = 200 points
        // Aspect ratio ~2.675:1, we'll use 1280x480 (~2.67:1) for high quality
        const mapWidth = 1280;
        const mapHeight = 480;
        const bounds = calculatePlotBounds(plot);
        const mapUrl = bounds ? generateMapboxStaticUrl(bounds, mapWidth, mapHeight) : null;
        const svgPaths = bounds
          ? convertCoordinatesToSvgPath(plot, bounds, mapWidth, mapHeight)
          : [];
        const fillColor = getPlotFillColor(plot);
        const strokeColor = getPlotStrokeColor(plot);

        return (
          <Page
            key={plotId}
            size='A4'
            style={{
              flexDirection: 'column',
              backgroundColor: '#FFFFFF',
              fontFamily: 'Roboto',
              fontSize: 10,
              padding: 30,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 20,
                paddingBottom: 10,
                borderBottom: '2px solid #EAAE07',
              }}
            >
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <Image
                src={`/images/pdf-logo-only.png`}
                style={{
                  width: 120,
                  height: 30,
                  objectFit: 'contain',
                }}
              />

              <View style={{ alignItems: 'flex-end' }}>
                <Text
                  style={{
                    fontSize: 10,
                    color: '#6B7280',
                  }}
                >
                  Página {plotIndex + 1}
                </Text>
                <Text
                  style={{
                    fontSize: 8,
                    color: '#9CA3AF',
                    marginTop: 2,
                  }}
                >
                  Gerado em: {generatedDateTime}
                </Text>
              </View>
            </View>

            <View
              style={{
                width: '100%',
                height: 200,
                position: 'relative',
                marginBottom: 20,
                border: '1px solid #E5E7EB',
              }}
            >
              {mapUrl && (
                <>
                  {/* eslint-disable-next-line jsx-a11y/alt-text */}
                  <Image
                    src={mapUrl}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'fill',
                    }}
                  />
                  <Svg
                    viewBox={`0 0 ${mapWidth} ${mapHeight}`}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                    }}
                  >
                    {svgPaths.map((pathData, index) => (
                      <Path
                        key={index}
                        d={pathData}
                        fill={fillColor}
                        fillOpacity={0.3}
                        stroke={strokeColor}
                        strokeWidth={3}
                      />
                    ))}
                  </Svg>
                </>
              )}
              {!mapUrl && (
                <View
                  style={{
                    width: '100%',
                    height: '100%',
                    backgroundColor: '#F3F4F6',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      color: '#6B7280',
                      fontWeight: 500,
                    }}
                  >
                    Mapa não disponível
                  </Text>
                </View>
              )}
            </View>

            <View
              wrap={false}
              style={{
                backgroundColor: '#F9FAFB',
                padding: 15,
                borderRadius: 8,
                marginBottom: 15,
                border: '1px solid #E5E7EB',
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  marginBottom: 10,
                  color: '#EAAE07',
                }}
              >
                {plot.name}
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  marginBottom: 5,
                }}
              >
                <Text
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    width: '40%',
                    color: '#6B7280',
                  }}
                >
                  Fazenda:
                </Text>
                <Text
                  style={{
                    fontSize: 9,
                    width: '60%',
                    color: '#1F2937',
                  }}
                >
                  {farmMap.get(firstApp.plotId!) || 'N/A'}
                </Text>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  marginBottom: 5,
                }}
              >
                <Text
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    width: '40%',
                    color: '#6B7280',
                  }}
                >
                  Área:
                </Text>
                <Text
                  style={{
                    fontSize: 9,
                    width: '60%',
                    color: '#1F2937',
                  }}
                >
                  {formatHectares(plot.hectare)}
                </Text>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  marginBottom: 5,
                }}
              >
                <Text
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    width: '40%',
                    color: '#6B7280',
                  }}
                >
                  Aplicações:
                </Text>
                <Text
                  style={{
                    fontSize: 9,
                    width: '60%',
                    color: '#1F2937',
                  }}
                >
                  {plotApplications.length}
                </Text>
              </View>
            </View>

            {plotApplications.map((application) => (
              <View
                wrap={false}
                key={application.id}
                style={{
                  backgroundColor: '#FFFFFF',
                  padding: 12,
                  borderRadius: 8,
                  marginBottom: 10,
                  border: '1px solid #E5E7EB',
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    marginBottom: 10,
                    paddingBottom: 8,
                    borderBottom: '1px solid #E5E7EB',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#EAAE07',
                    }}
                  >
                    {application.product?.name || 'N/A'}
                  </Text>
                  <Text
                    style={{
                      fontSize: 10,
                      color: '#6B7280',
                    }}
                  >
                    {formatDate(application.date)}
                  </Text>
                </View>

                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                  }}
                >
                  <View
                    style={{
                      width: '50%',
                      marginBottom: 4,
                      flexDirection: 'row',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 8,
                        fontWeight: 700,
                        color: '#6B7280',
                        marginRight: 4,
                      }}
                    >
                      Piloto:
                    </Text>
                    <Text
                      style={{
                        fontSize: 8,
                        color: '#1F2937',
                      }}
                    >
                      {application.pilot?.name || 'N/A'}
                    </Text>
                  </View>
                  <View
                    style={{
                      width: '50%',
                      marginBottom: 4,
                      flexDirection: 'row',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 8,
                        fontWeight: 700,
                        color: '#6B7280',
                        marginRight: 4,
                      }}
                    >
                      Assistente:
                    </Text>
                    <Text
                      style={{
                        fontSize: 8,
                        color: '#1F2937',
                      }}
                    >
                      {application.assistant?.name || 'N/A'}
                    </Text>
                  </View>
                  <View
                    style={{
                      width: '50%',
                      marginBottom: 4,
                      flexDirection: 'row',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 8,
                        fontWeight: 700,
                        color: '#6B7280',
                        marginRight: 4,
                      }}
                    >
                      Drone:
                    </Text>
                    <Text
                      style={{
                        fontSize: 8,
                        color: '#1F2937',
                      }}
                    >
                      {application.drone?.name || 'N/A'} - {application.drone?.model || 'N/A'}
                    </Text>
                  </View>
                  <View
                    style={{
                      width: '50%',
                      marginBottom: 4,
                      flexDirection: 'row',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 8,
                        fontWeight: 700,
                        color: '#6B7280',
                        marginRight: 4,
                      }}
                    >
                      Cultura:
                    </Text>
                    <Text
                      style={{
                        fontSize: 8,
                        color: '#1F2937',
                      }}
                    >
                      {application.culture?.name || 'N/A'}
                    </Text>
                  </View>
                  <View
                    style={{
                      width: '50%',
                      marginBottom: 4,
                      flexDirection: 'row',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 8,
                        fontWeight: 700,
                        color: '#6B7280',
                        marginRight: 4,
                      }}
                    >
                      Hectares:
                    </Text>
                    <Text
                      style={{
                        fontSize: 8,
                        color: '#1F2937',
                      }}
                    >
                      {formatHectares(application.hectares)}
                    </Text>
                  </View>
                  <View
                    style={{
                      width: '50%',
                      marginBottom: 4,
                      flexDirection: 'row',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 8,
                        fontWeight: 700,
                        color: '#6B7280',
                        marginRight: 4,
                      }}
                    >
                      Taxa de Fluxo:
                    </Text>
                    <Text
                      style={{
                        fontSize: 8,
                        color: '#1F2937',
                      }}
                    >
                      {parseFloat(application.flowRate).toFixed(2)} L/ha
                    </Text>
                  </View>
                  <View
                    style={{
                      width: '50%',
                      marginBottom: 4,
                      flexDirection: 'row',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 8,
                        fontWeight: 700,
                        color: '#6B7280',
                        marginRight: 4,
                      }}
                    >
                      Altitude:
                    </Text>
                    <Text
                      style={{
                        fontSize: 8,
                        color: '#1F2937',
                      }}
                    >
                      {parseFloat(application.altitude).toFixed(2)} m
                    </Text>
                  </View>
                  <View
                    style={{
                      width: '50%',
                      marginBottom: 4,
                      flexDirection: 'row',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 8,
                        fontWeight: 700,
                        color: '#6B7280',
                        marginRight: 4,
                      }}
                    >
                      Espaçamento:
                    </Text>
                    <Text
                      style={{
                        fontSize: 8,
                        color: '#1F2937',
                      }}
                    >
                      {parseFloat(application.routeSpacing).toFixed(2)} m
                    </Text>
                  </View>
                  <View
                    style={{
                      width: '50%',
                      marginBottom: 4,
                      flexDirection: 'row',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 8,
                        fontWeight: 700,
                        color: '#6B7280',
                        marginRight: 4,
                      }}
                    >
                      Tamanho de Gota:
                    </Text>
                    <Text
                      style={{
                        fontSize: 8,
                        color: '#1F2937',
                      }}
                    >
                      {parseFloat(application.dropletSize).toFixed(2)} µm
                    </Text>
                  </View>
                  {application.observations && (
                    <View style={{ width: '100%', marginTop: 6 }}>
                      <Text
                        style={{
                          fontSize: 8,
                          fontWeight: 700,
                          color: '#6B7280',
                          marginRight: 4,
                        }}
                      >
                        Observações:
                      </Text>
                      <Text
                        style={{
                          fontSize: 8,
                          color: '#1F2937',
                        }}
                      >
                        {application.observations}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </Page>
        );
      })}
    </Document>
  );
};

export default ApplicationsReportPDF;
