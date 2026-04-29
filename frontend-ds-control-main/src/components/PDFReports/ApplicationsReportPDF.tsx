import { Document, Font, Image, Page, Path, Svg, Text, View } from '@react-pdf/renderer';
import React from 'react';

import { Application } from '@/types/applications.type';
import { Plot } from '@/types/plot.type';
import { ServiceOrder } from '@/types/service-order.type';
import { formatApplicationDate } from '@/utils/application-date-formatter';
import { formatOperationalDateBR } from '@/utils/operational-date';
import {
  buildReportMapboxStaticUrl,
  getReportMapPlaceholderMessage,
} from '@/utils/mapboxStaticReportMap';
import { buildPlotPolygonSvgPathDs } from '@/utils/reportPlotPolygonSvg';

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

interface ApplicationsReportPDFProps {
  serviceOrder: ServiceOrder;
  applications: Application[];
  /** Data URLs pré-carregadas por plotId (evita <Image> com URL remota no react-pdf). */
  prefetchedMapImageDataUrls?: Record<string, string | null>;
}

const ApplicationsReportPDF: React.FC<ApplicationsReportPDFProps> = ({
  serviceOrder,
  applications,
  prefetchedMapImageDataUrls,
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
                {formatOperationalDateBR(serviceOrder.plannedDate)}
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

        const mapWidth = 1280;
        const mapHeight = 480;
        const plotPolygonPathDs = buildPlotPolygonSvgPathDs(plot, mapWidth, mapHeight);
        // Temporário: mesmo fallback que MapViewer até NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN no build do Amplify.
        const mapResult = buildReportMapboxStaticUrl({
          plot,
          mapWidth,
          mapHeight,
          accessToken:
            process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ||
            'pk.eyJ1IjoiYW50b25pb3Zpbmk0NyIsImEiOiJjbWJoNW9wM2swNmlyMmlvbGlmb3J6NW4xIn0.wKznYpMm2m5Z0Opjjkpa-Q',
        });
        const mapUrl = mapResult.url;
        const mapPlaceholderMessage = mapUrl
          ? null
          : getReportMapPlaceholderMessage(mapResult.unavailableReason);

        const prefetchedSrc = prefetchedMapImageDataUrls?.[plotId];
        const usePrefetchedMap = prefetchedMapImageDataUrls !== undefined;
        const mapImageSrc = usePrefetchedMap ? prefetchedSrc ?? undefined : mapUrl ?? undefined;
        const showMapImage = Boolean(mapImageSrc);

        if (!showMapImage && typeof console !== 'undefined') {
          const key = plotId;
          const hasPrefetchKey =
            prefetchedMapImageDataUrls !== undefined && Object.prototype.hasOwnProperty.call(
              prefetchedMapImageDataUrls,
              key
            );
          console.log('[REPORT_PREFETCH_DEBUG]', {
            phase: 'ApplicationsReportPDF:placeholder',
            plotId: plot.id,
            loopPlotId: plotId,
            mapUrlExists: Boolean(mapUrl),
            usePrefetchedMap,
            hasPrefetchKey,
            prefetchedEntryType:
              prefetchedMapImageDataUrls === undefined
                ? 'prefetch_prop_undefined'
                : prefetchedMapImageDataUrls[key] === null
                  ? 'null'
                  : typeof prefetchedMapImageDataUrls[key],
            prefetchedStringLength:
              typeof prefetchedSrc === 'string' ? prefetchedSrc.length : 0,
            placeholderText: mapPlaceholderMessage ?? 'Mapa indisponível',
          });
        }

        if (typeof console !== 'undefined') {
          console.log('[REPORT_MAP_DEBUG]', {
            phase: 'ApplicationsReportPDF',
            plotId: plot.id,
            plotName: plot.name,
            mapUrl: mapUrl ?? null,
            mapUrlLength: mapUrl?.length ?? 0,
            usedLongUrlFallback: mapResult.usedLongUrlFallback,
            usePrefetchedMap,
            prefetchedDataUrlLength: typeof prefetchedSrc === 'string' ? prefetchedSrc.length : 0,
          });
        }

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
              {showMapImage && (
                <>
                  {/* eslint-disable-next-line jsx-a11y/alt-text */}
                  <Image
                    src={mapImageSrc!}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'fill',
                    }}
                  />
                  {plotPolygonPathDs?.length ? (
                    <Svg
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                      }}
                      viewBox={`0 0 ${mapWidth} ${mapHeight}`}
                      preserveAspectRatio='none'
                    >
                      {plotPolygonPathDs.map((d, i) => (
                        <Path
                          key={`plot-poly-${plotId}-${i}`}
                          d={d}
                          fill='#3388ff'
                          fillOpacity={0.35}
                          fillRule='evenodd'
                          stroke='#1d4ed8'
                          strokeWidth={2}
                        />
                      ))}
                    </Svg>
                  ) : null}
                </>
              )}
              {!showMapImage && (
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
                    {mapPlaceholderMessage ?? 'Mapa indisponível'}
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
                    {formatApplicationDate(application.date)}
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
