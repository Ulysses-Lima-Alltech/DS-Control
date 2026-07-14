import { Document, Font, Image, Page, Path, Svg, Text, View } from '@react-pdf/renderer';
import React from 'react';

import { Application } from '@/types/applications.type';
import { ServiceOrder } from '@/types/service-order.type';
import { formatApplicationDate } from '@/utils/application-date-formatter';
import {
  buildReportMapboxStaticUrl,
  getReportMapPlaceholderMessage,
} from '@/utils/mapboxStaticReportMap';
import { formatOperationalDateBR } from '@/utils/operational-date';
import { buildPlotPolygonSvgOverlay, buildPlotReportLabel } from '@/utils/reportPlotPolygonSvg';

const DJI_REPORT_IMAGE_HEIGHT = 280;

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

export type ApplicationsReportMode = 'operational' | 'completedPlannedArea';

export interface ApplicationsReportPDFProps {
  serviceOrder: ServiceOrder;
  applications: Application[];
  mode?: ApplicationsReportMode;
  completedPlotIds?: string[];
  /** Data URLs pré-carregadas por plotId (evita <Image> com URL remota no react-pdf). */
  prefetchedMapImageDataUrls?: Record<string, string | null>;
  djiImagesByApplicationId?: Record<
    string,
    {
      imageSrc: string;
      imageStatus: string;
      imageUrl?: string;
      imageScope?: 'application' | 'day' | string;
      matchType?: 'exact_application' | 'high_confidence' | 'date_only' | 'no_match' | string;
      djiMetadata?: Application['djiMetadata'];
    }
  >;
}

function isTrustedDjiReportImage(
  image: NonNullable<ApplicationsReportPDFProps['djiImagesByApplicationId']>[string] | undefined
) {
  return (
    Boolean(image?.imageSrc) &&
    image?.imageScope === 'application' &&
    (image.matchType === 'exact_application' || image.matchType === 'high_confidence')
  );
}

function formatDjiArea(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;

  return `${value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ha`;
}

function formatRegisteredAreaCoverage(
  applicationHectares: string,
  plotHectares: string
): string | null {
  const appliedArea = parseFloat(applicationHectares);
  const registeredPlotArea = parseFloat(plotHectares);

  if (
    !Number.isFinite(appliedArea) ||
    !Number.isFinite(registeredPlotArea) ||
    registeredPlotArea <= 0
  ) {
    return null;
  }

  return `${((appliedArea / registeredPlotArea) * 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function buildDjiEvidenceCaption(
  application: Application,
  metadata: Application['djiMetadata'] | undefined,
  hideAreaValues = false
): string {
  const dsArea = hideAreaValues ? null : formatDjiArea(metadata?.dsAreaHa);
  const djiArea = hideAreaValues ? null : formatDjiArea(metadata?.djiAreaHa);
  const details = [
    typeof metadata?.flightCount === 'number'
      ? `Voos registrados na DJI: ${metadata.flightCount}`
      : null,
    dsArea ? `Área aplicada registrada no DS: ${dsArea}` : null,
    djiArea ? `Área aplicada registrada na DJI: ${djiArea}` : null,
    'Confiança do vínculo: alta',
  ].filter(Boolean);

  return [
    `Evidência DJI SmartFarm - ${formatApplicationDate(application.date)}`,
    details.length ? details.join(' | ') : null,
  ]
    .filter(Boolean)
    .join(' | ');
}

const ApplicationsReportPDF: React.FC<ApplicationsReportPDFProps> = ({
  serviceOrder,
  applications,
  prefetchedMapImageDataUrls,
  djiImagesByApplicationId,
  mode = 'operational',
  completedPlotIds = [],
}) => {
  const isCompletedPlannedArea = mode === 'completedPlannedArea';
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

  const formatNumber = (value: number) =>
    value.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const formatHectares = (hectares: string | number) => {
    const numericValue = typeof hectares === 'number' ? hectares : parseFloat(hectares);
    return `${formatNumber(numericValue)} ha`;
  };

  const totalHectares = applications.reduce((sum, app) => sum + parseFloat(app.hectares), 0);
  const plannedHectares = Number(serviceOrder.plannedHectares) || 0;
  const serviceOrderProgress = Number(serviceOrder.progressPercent) || 0;
  const completedIds = new Set(completedPlotIds);
  const completedPlotsById = new Map(
    (serviceOrder.plots || [])
      .filter((plot) => Boolean(plot.id && completedIds.has(plot.id)))
      .map((plot) => [plot.id!, plot])
  );

  Object.values(applicationsByPlot).forEach((plotApplications) => {
    const plot = plotApplications[0]?.plot;
    if (plot?.id && completedIds.has(plot.id)) {
      completedPlotsById.set(plot.id, plot);
    }
  });

  const completedPlannedHectares = Array.from(completedPlotsById.values()).reduce(
    (total, plot) => total + (Number.parseFloat(plot.hectare) || 0),
    0
  );
  const reportPlannedHectares = isCompletedPlannedArea ? completedPlannedHectares : plannedHectares;
  const reportProgress = isCompletedPlannedArea ? 100 : serviceOrderProgress;

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
    <Document
      title={
        isCompletedPlannedArea
          ? `Relatório de Área Total Concluída - OS ${serviceOrder.number}`
          : `Relatório de Aplicações - OS ${serviceOrder.number}`
      }
    >
      <Page
        wrap={false}
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
            padding: 30,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image
            src={`/images/pdf-logo-complete.png`}
            style={{
              width: 300,
              height: 100,
              marginBottom: 18,
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
              fontSize: 16,
              fontWeight: 500,
              marginBottom: 8,
              color: '#6B7280',
              textAlign: 'center',
            }}
          >
            {isCompletedPlannedArea
              ? 'Relatório de Área Total Concluída'
              : 'Relatório de Aplicações'}
          </Text>
          <Text
            style={{
              fontSize: 12,
              textAlign: 'center',
              marginBottom: 24,
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
              marginTop: 12,
              padding: 14,
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
              Identificação da Ordem de Serviço
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
                Data Planejada da OS:
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
                  Fazendas Vinculadas:
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
                  Pilotos Vinculados:
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
                  Observação da OS:
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
              marginTop: 14,
              padding: 14,
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
              {isCompletedPlannedArea ? 'Resumo da Área Total Concluída' : 'Resumo das Aplicações'}
            </Text>
            <Text
              style={{
                fontSize: 8,
                color: '#6B7280',
                marginTop: -9,
                marginBottom: 12,
              }}
            >
              {isCompletedPlannedArea
                ? 'Este relatório considera integralmente concluída a área cadastrada dos talhões classificados como concluídos.'
                : 'Indicadores calculados a partir das aplicações incluídas neste relatório.'}
            </Text>

            <View style={{ flexDirection: 'row', marginBottom: 12 }}>
              <View
                style={{
                  width: '32%',
                  padding: 10,
                  marginRight: '2%',
                  borderRadius: 6,
                  border: '1px solid #E5E7EB',
                  backgroundColor: '#F9FAFB',
                }}
              >
                <Text style={{ fontSize: 9, fontWeight: 700, color: '#6B7280' }}>
                  {isCompletedPlannedArea ? 'Área Total Concluída' : 'Área Total Planejada da OS'}
                </Text>
                <Text style={{ fontSize: 14, fontWeight: 700, color: '#1F2937', marginTop: 5 }}>
                  {formatHectares(reportPlannedHectares)}
                </Text>
                <Text style={{ fontSize: 7, color: '#6B7280', marginTop: 5, lineHeight: 1.3 }}>
                  {isCompletedPlannedArea
                    ? 'Soma das áreas cadastradas dos talhões classificados como concluídos.'
                    : 'Soma das áreas cadastradas dos mapas vinculados à Ordem de Serviço.'}
                </Text>
              </View>

              <View
                style={{
                  width: '32%',
                  padding: 10,
                  marginRight: '2%',
                  borderRadius: 6,
                  border: '2px solid #EAAE07',
                  backgroundColor: '#FFF3CD',
                }}
              >
                <Text style={{ fontSize: 9, fontWeight: 700, color: '#6B7280' }}>
                  {isCompletedPlannedArea ? 'Talhões Concluídos' : 'Área Total Aplicada'}
                </Text>
                <Text style={{ fontSize: 14, fontWeight: 700, color: '#EAAE07', marginTop: 5 }}>
                  {isCompletedPlannedArea ? completedPlotsById.size : formatHectares(totalHectares)}
                </Text>
                <Text style={{ fontSize: 7, color: '#6B7280', marginTop: 5, lineHeight: 1.3 }}>
                  {isCompletedPlannedArea
                    ? 'Quantidade de talhões incluídos neste relatório.'
                    : 'Soma das áreas informadas nas aplicações incluídas neste relatório.'}
                </Text>
              </View>

              <View
                style={{
                  width: '32%',
                  padding: 10,
                  borderRadius: 6,
                  border: '1px solid #EAAE07',
                  backgroundColor: '#FFFBEB',
                }}
              >
                <Text style={{ fontSize: 9, fontWeight: 700, color: '#6B7280' }}>
                  {isCompletedPlannedArea ? 'Progresso' : 'Progresso da OS'}
                </Text>
                <Text style={{ fontSize: 14, fontWeight: 700, color: '#EAAE07', marginTop: 5 }}>
                  {formatNumber(reportProgress)}%
                </Text>
                <Text style={{ fontSize: 7, color: '#6B7280', marginTop: 5, lineHeight: 1.3 }}>
                  {isCompletedPlannedArea
                    ? 'Os talhões deste relatório estão classificados como integralmente concluídos.'
                    : 'Relação entre a área total aplicada e a área total planejada da Ordem de Serviço.'}
                </Text>
              </View>
            </View>

            {isCompletedPlannedArea && (
              <>
                <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                  <Text style={{ fontSize: 10, fontWeight: 700, width: '50%', color: '#6B7280' }}>
                    Aplicações Realizadas:
                  </Text>
                  <Text style={{ fontSize: 10, width: '50%', color: '#1F2937' }}>
                    {applications.length}
                  </Text>
                </View>
              </>
            )}

            {!isCompletedPlannedArea && (
              <>
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
                    Taxa de Aplicação Média:
                  </Text>
                  <Text
                    style={{
                      fontSize: 10,
                      width: '50%',
                      color: '#1F2937',
                    }}
                  >
                    {formatNumber(averageFlowRate)} L/ha
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
                    Altitude Média de Voo:
                  </Text>
                  <Text
                    style={{
                      fontSize: 10,
                      width: '50%',
                      color: '#1F2937',
                    }}
                  >
                    {formatNumber(averageAltitude)} m
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
                    Espaçamento Médio entre Rotas:
                  </Text>
                  <Text
                    style={{
                      fontSize: 10,
                      width: '50%',
                      color: '#1F2937',
                    }}
                  >
                    {formatNumber(averageRouteSpacing)} m
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
                    Tamanho Médio de Gota:
                  </Text>
                  <Text
                    style={{
                      fontSize: 10,
                      width: '50%',
                      color: '#1F2937',
                    }}
                  >
                    {formatNumber(averageDropletSize)} µm
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>
      </Page>

      {Object.entries(applicationsByPlot).map(([plotId, plotApplications], plotIndex) => {
        const firstApp = plotApplications[0];
        const plot = firstApp.plot;

        const mapWidth = 1280;
        const mapHeight = 480;
        const plotPolygonOverlay = buildPlotPolygonSvgOverlay(plot, mapWidth, mapHeight);
        const plotLabel = buildPlotReportLabel(plot);
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
        const mapImageSrc = usePrefetchedMap ? (prefetchedSrc ?? undefined) : (mapUrl ?? undefined);
        const plotDjiApplication = plotApplications.find((application) =>
          isTrustedDjiReportImage(djiImagesByApplicationId?.[application.id])
        );
        const plotDjiImage = plotDjiApplication
          ? djiImagesByApplicationId?.[plotDjiApplication.id]
          : undefined;
        const reportImageSrc = plotDjiImage?.imageSrc || mapImageSrc;
        const showDjiImage = Boolean(plotDjiImage?.imageSrc);
        const showMapImage = Boolean(reportImageSrc);
        const djiCaption = plotDjiApplication
          ? buildDjiEvidenceCaption(
              plotDjiApplication,
              plotDjiImage?.djiMetadata,
              isCompletedPlannedArea
            )
          : null;
        const reportVisualHeight = plotApplications.length > 1 ? 120 : DJI_REPORT_IMAGE_HEIGHT;
        const reportMapHeight = plotApplications.length > 1 ? 120 : 200;

        if (!showMapImage && typeof console !== 'undefined') {
          const key = plotId;
          const hasPrefetchKey =
            prefetchedMapImageDataUrls !== undefined &&
            Object.prototype.hasOwnProperty.call(prefetchedMapImageDataUrls, key);
          // eslint-disable-next-line no-console
          console.log('[REPORT_PREFETCH_DEBUG]', {
            phase: 'ApplicationsReportPDF:placeholder',
            plotId: plot.id,
            loopPlotId: plotId,
            djiImageExists: showDjiImage,
            mapUrlExists: Boolean(mapUrl),
            usePrefetchedMap,
            hasPrefetchKey,
            prefetchedEntryType:
              prefetchedMapImageDataUrls === undefined
                ? 'prefetch_prop_undefined'
                : prefetchedMapImageDataUrls[key] === null
                  ? 'null'
                  : typeof prefetchedMapImageDataUrls[key],
            prefetchedStringLength: typeof prefetchedSrc === 'string' ? prefetchedSrc.length : 0,
            placeholderText: mapPlaceholderMessage ?? 'Mapa indisponível',
          });
        }

        if (typeof console !== 'undefined') {
          // eslint-disable-next-line no-console
          console.log('[REPORT_MAP_DEBUG]', {
            phase: 'ApplicationsReportPDF',
            plotId: plot.id,
            plotName: plot.name,
            djiImageExists: showDjiImage,
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

            {showDjiImage ? (
              <View
                wrap={false}
                style={{
                  width: '100%',
                  marginBottom: 18,
                  padding: 7,
                  border: '1px solid #E5E7EB',
                  borderRadius: 6,
                  backgroundColor: '#FFFFFF',
                }}
              >
                <View
                  style={{
                    width: '100%',
                    height: reportVisualHeight,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: '#F9FAFB',
                    overflow: 'hidden',
                  }}
                >
                  {/* eslint-disable-next-line jsx-a11y/alt-text */}
                  <Image
                    src={plotDjiImage!.imageSrc}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                    }}
                  />
                </View>
                {djiCaption && (
                  <Text
                    style={{
                      fontSize: 8,
                      color: '#6B7280',
                      textAlign: 'center',
                      marginTop: 6,
                    }}
                  >
                    {djiCaption}
                  </Text>
                )}
              </View>
            ) : (
              <View
                style={{
                  width: '100%',
                  height: reportMapHeight,
                  position: 'relative',
                  marginBottom: 20,
                  border: '1px solid #E5E7EB',
                }}
              >
                {showMapImage && (
                  <>
                    {/* eslint-disable-next-line jsx-a11y/alt-text */}
                    <Image
                      src={reportImageSrc!}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'fill',
                      }}
                    />
                    {!showDjiImage && plotPolygonOverlay ? (
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
                        {plotPolygonOverlay.paths.map((d, i) => (
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
                        <Text
                          x={plotPolygonOverlay.labelPoint.x}
                          y={plotPolygonOverlay.labelPoint.y - 10}
                          textAnchor='middle'
                          dominantBaseline='middle'
                          fill='#FFFFFF'
                          stroke='#111827'
                          strokeOpacity={0.8}
                          strokeWidth={6}
                          strokeLinejoin='round'
                          style={{ fontFamily: 'Roboto', fontSize: 32, fontWeight: 700 }}
                        >
                          {plotLabel.title}
                        </Text>
                        <Text
                          x={plotPolygonOverlay.labelPoint.x}
                          y={plotPolygonOverlay.labelPoint.y + 28}
                          textAnchor='middle'
                          dominantBaseline='middle'
                          fill='#FFFFFF'
                          stroke='#111827'
                          strokeOpacity={0.8}
                          strokeWidth={5}
                          strokeLinejoin='round'
                          style={{ fontFamily: 'Roboto', fontSize: 27, fontWeight: 700 }}
                        >
                          {plotLabel.area}
                        </Text>
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
            )}

            <View
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
                Talhão: {plot.name}
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
                  Fazenda do Talhão:
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
                  {isCompletedPlannedArea
                    ? 'Área Total Concluída do Talhão:'
                    : 'Área Cadastrada do Talhão:'}
                </Text>
                <View style={{ width: '60%' }}>
                  <Text style={{ fontSize: 9, color: '#1F2937' }}>
                    {formatHectares(plot.hectare)}
                  </Text>
                  {!isCompletedPlannedArea && (
                    <Text style={{ fontSize: 7, marginTop: 2, color: '#9CA3AF' }}>
                      Área delimitada no mapa do cadastro.
                    </Text>
                  )}
                </View>
              </View>
              {isCompletedPlannedArea && (
                <>
                  <View style={{ flexDirection: 'row', marginBottom: 5 }}>
                    <Text style={{ fontSize: 9, fontWeight: 700, width: '40%', color: '#6B7280' }}>
                      Situação:
                    </Text>
                    <Text style={{ fontSize: 9, width: '60%', color: '#166534', fontWeight: 700 }}>
                      Concluído
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', marginBottom: 5 }}>
                    <Text style={{ fontSize: 9, fontWeight: 700, width: '40%', color: '#6B7280' }}>
                      Cobertura:
                    </Text>
                    <Text style={{ fontSize: 9, width: '60%', color: '#166534', fontWeight: 700 }}>
                      100,00%
                    </Text>
                  </View>
                </>
              )}
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
                  Quantidade de Aplicações:
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

            {plotApplications.map((application) => {
              const registeredAreaCoverage = isCompletedPlannedArea
                ? null
                : formatRegisteredAreaCoverage(application.hectares, plot.hectare);

              return (
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
                      Produto Aplicado: {application.product?.name || 'N/A'}
                    </Text>
                    <Text
                      style={{
                        fontSize: 10,
                        color: '#6B7280',
                      }}
                    >
                      Data da Aplicação: {formatApplicationDate(application.date)}
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
                        Piloto Responsável:
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
                        Assistente Responsável:
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
                        Drone Utilizado:
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
                    {!isCompletedPlannedArea && (
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
                          Área Aplicada:
                        </Text>
                        <View>
                          <Text style={{ fontSize: 8, color: '#1F2937' }}>
                            {formatHectares(application.hectares)}
                          </Text>
                          <Text style={{ fontSize: 7, color: '#9CA3AF', marginTop: 2 }}>
                            Área informada nesta aplicação.
                          </Text>
                        </View>
                      </View>
                    )}
                    {registeredAreaCoverage && (
                      <View
                        style={{
                          width: '50%',
                          marginBottom: 6,
                          padding: 8,
                          flexDirection: 'column',
                          backgroundColor: '#FFFBEB',
                          border: '1px solid #FDE68A',
                          borderRadius: 5,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 8,
                            fontWeight: 700,
                            color: '#6B7280',
                          }}
                        >
                          Cobertura desta Aplicação
                        </Text>
                        <Text
                          style={{ fontSize: 11, fontWeight: 700, color: '#EAAE07', marginTop: 4 }}
                        >
                          {registeredAreaCoverage}
                        </Text>
                        <Text
                          style={{ fontSize: 7, color: '#6B7280', marginTop: 4, lineHeight: 1.3 }}
                        >
                          Relação entre a área aplicada nesta operação e a área cadastrada do
                          talhão.
                        </Text>
                      </View>
                    )}
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
                        Taxa de Aplicação:
                      </Text>
                      <Text
                        style={{
                          fontSize: 8,
                          color: '#1F2937',
                        }}
                      >
                        {formatNumber(parseFloat(application.flowRate))} L/ha
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
                        Altitude de Voo:
                      </Text>
                      <Text
                        style={{
                          fontSize: 8,
                          color: '#1F2937',
                        }}
                      >
                        {formatNumber(parseFloat(application.altitude))} m
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
                        Espaçamento entre Rotas:
                      </Text>
                      <Text
                        style={{
                          fontSize: 8,
                          color: '#1F2937',
                        }}
                      >
                        {formatNumber(parseFloat(application.routeSpacing))} m
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
                        {formatNumber(parseFloat(application.dropletSize))} µm
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
                          Observações da Aplicação:
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
              );
            })}
          </Page>
        );
      })}
    </Document>
  );
};

export default ApplicationsReportPDF;
