import { Document, Font, Image, Page, Path, Svg, Text, View } from '@react-pdf/renderer';
import React from 'react';

import type { Application } from '@/types/applications.type';
import type { ServiceOrder } from '@/types/service-order.type';
import { OPERATIONAL_TIME_ZONE, formatOperationalDateBR } from '@/utils/operational-date';
import {
  buildStrategicMapProjection,
  extractPlotPolygons,
  type StrategicMapShapeInput,
} from '@/utils/strategicReportMap2d';

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

const BRAND_YELLOW = '#EAAE07';
const DARK_TEXT = '#1F2937';
const MUTED_TEXT = '#6B7280';
const LIGHT_BORDER = '#E5E7EB';
const BACKGROUND_SUBTLE = '#F9FAFB';

const MAP_WIDTH = 460;
const MAP_HEIGHT = 300;

const FARM_COLORS = [
  { fill: '#38BDF8', stroke: '#0284C7' },
  { fill: '#34D399', stroke: '#059669' },
  { fill: '#FBBF24', stroke: '#D97706' },
  { fill: '#A78BFA', stroke: '#7C3AED' },
  { fill: '#F472B6', stroke: '#DB2777' },
  { fill: '#FB7185', stroke: '#E11D48' },
  { fill: '#4ADE80', stroke: '#16A34A' },
  { fill: '#22D3EE', stroke: '#0891B2' },
];

type PlotStatus = 'Pendente' | 'Parcial' | 'Concluído';

type PlotDetailRow = {
  plotId: string;
  plotName: string;
  farmId: string;
  farmName: string;
  plannedHectares: number;
  appliedHectares: number;
  applicationsCount: number;
  status: PlotStatus;
  polygons: ReturnType<typeof extractPlotPolygons>;
};

interface ServiceOrderStrategicReportPDFProps {
  serviceOrder: ServiceOrder;
  applications: Application[];
}

function parseNumber(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const normalized = Number.parseFloat(value.replace(',', '.'));
    return Number.isFinite(normalized) ? normalized : 0;
  }

  return 0;
}

function formatHectares(value: number): string {
  return `${value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ha`;
}

function formatStatus(status: ServiceOrder['status']): string {
  if (status === 'completed') {
    return 'Concluída';
  }
  if (status === 'cancelled') {
    return 'Cancelada';
  }
  return 'Aberta';
}

function formatGeneratedAt(): string {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: OPERATIONAL_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  return formatter.format(new Date());
}

function chunkRows<T>(rows: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size));
  }
  return chunks;
}

function resolveFarmNameByPlot(serviceOrder: ServiceOrder, plotId: string, farmId?: string): string {
  if (farmId) {
    const directFarm = serviceOrder.farms?.find((farm) => farm.id === farmId);
    if (directFarm?.name) {
      return directFarm.name;
    }
  }

  const farmByNestedPlot = serviceOrder.farms?.find((farm) =>
    (farm.plots || []).some((plot) => plot.id === plotId)
  );

  return farmByNestedPlot?.name || 'Fazenda não informada';
}

function resolvePlotStatus(plannedHectares: number, appliedHectares: number, applicationsCount: number): PlotStatus {
  if (applicationsCount === 0 || appliedHectares <= 0) {
    return 'Pendente';
  }

  if (plannedHectares > 0 && appliedHectares >= plannedHectares * 0.98) {
    return 'Concluído';
  }

  return 'Parcial';
}

const ServiceOrderStrategicReportPDF: React.FC<ServiceOrderStrategicReportPDFProps> = ({
  serviceOrder,
  applications,
}) => {
  const generatedAt = formatGeneratedAt();

  const applicationsByPlotId = applications.reduce(
    (acc, application) => {
      if (!application.plotId) {
        return acc;
      }

      if (!acc[application.plotId]) {
        acc[application.plotId] = [];
      }

      acc[application.plotId].push(application);
      return acc;
    },
    {} as Record<string, Application[]>
  );

  const plotIdsSet = new Set((serviceOrder.plots || []).map((plot) => plot.id).filter(Boolean) as string[]);

  const plotRows: PlotDetailRow[] = (serviceOrder.plots || [])
    .map((plot) => {
      if (!plot.id) {
        return null;
      }

      const plotApplications = applicationsByPlotId[plot.id] || [];
      const plannedHectares = parseNumber(plot.hectare);
      const appliedHectares = plotApplications.reduce(
        (sum, application) => sum + parseNumber(application.hectares),
        0
      );
      const applicationsCount = plotApplications.length;
      const polygons = extractPlotPolygons(plot);

      return {
        plotId: plot.id,
        plotName: plot.name || `Talhão ${plot.id}`,
        farmId: plot.farmId || 'farm-unknown',
        farmName: resolveFarmNameByPlot(serviceOrder, plot.id, plot.farmId),
        plannedHectares,
        appliedHectares,
        applicationsCount,
        status: resolvePlotStatus(plannedHectares, appliedHectares, applicationsCount),
        polygons,
      };
    })
    .filter((row): row is PlotDetailRow => row !== null)
    .sort((a, b) => {
      const farmCompare = a.farmName.localeCompare(b.farmName, 'pt-BR');
      if (farmCompare !== 0) {
        return farmCompare;
      }
      return a.plotName.localeCompare(b.plotName, 'pt-BR');
    });

  const rowsWithGeometry = plotRows.filter((row) => row.polygons.length > 0);
  const rowsWithoutGeometry = plotRows.filter((row) => row.polygons.length === 0);

  const farmsOrder = Array.from(
    new Set(
      plotRows.map((row) => `${row.farmId}|||${row.farmName}`)
    )
  );

  const farmColorMap = new Map<string, { fill: string; stroke: string }>();
  farmsOrder.forEach((farmKeyWithName, index) => {
    const [farmId] = farmKeyWithName.split('|||');
    farmColorMap.set(farmId, FARM_COLORS[index % FARM_COLORS.length]);
  });

  const mapShapesInput: StrategicMapShapeInput[] = rowsWithGeometry.map((row) => ({
    id: row.plotId,
    label:
      rowsWithGeometry.length <= 18
        ? `${row.plotName} • ${formatHectares(row.plannedHectares)}`
        : row.plotName,
    farmKey: row.farmId,
    polygons: row.polygons,
  }));

  const mapProjection = buildStrategicMapProjection(mapShapesInput, MAP_WIDTH, MAP_HEIGHT, 20);

  const farmSummaryMap = new Map<
    string,
    { farmId: string; farmName: string; plannedHectares: number; appliedHectares: number; plotsCount: number }
  >();

  plotRows.forEach((row) => {
    const key = `${row.farmId}|||${row.farmName}`;
    const current = farmSummaryMap.get(key) || {
      farmId: row.farmId,
      farmName: row.farmName,
      plannedHectares: 0,
      appliedHectares: 0,
      plotsCount: 0,
    };

    current.plannedHectares += row.plannedHectares;
    current.appliedHectares += row.appliedHectares;
    current.plotsCount += 1;
    farmSummaryMap.set(key, current);
  });

  const farmSummaryRows = Array.from(farmSummaryMap.values()).sort(
    (a, b) => b.plannedHectares - a.plannedHectares
  );

  const totalPlannedHectares = plotRows.reduce((sum, row) => sum + row.plannedHectares, 0);
  const totalAppliedHectares = applications.reduce(
    (sum, application) => sum + parseNumber(application.hectares),
    0
  );

  const applicationsWithoutPlot = applications.filter((application) => !application.plotId);
  const applicationsWithUnknownPlot = applications.filter(
    (application) => application.plotId && !plotIdsSet.has(application.plotId)
  );

  const detailPages = chunkRows(plotRows, 18);

  return (
    <Document>
      <Page
        size='A4'
        style={{
          backgroundColor: '#FFFFFF',
          fontFamily: 'Roboto',
          fontSize: 10,
          color: DARK_TEXT,
          paddingTop: 24,
          paddingHorizontal: 28,
          paddingBottom: 44,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: `2px solid ${BRAND_YELLOW}`,
            paddingBottom: 10,
            marginBottom: 14,
          }}
        >
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src='/images/pdf-logo-only.png' style={{ width: 126, height: 32, objectFit: 'contain' }} />
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 14, fontWeight: 700 }}>Relatório da OS</Text>
            <Text style={{ fontSize: 10, color: MUTED_TEXT, marginTop: 2 }}>
              Mapa Estratégico Consolidado
            </Text>
          </View>
        </View>

        <View
          style={{
            border: `1px solid ${LIGHT_BORDER}`,
            borderRadius: 8,
            padding: 12,
            backgroundColor: BACKGROUND_SUBTLE,
            marginBottom: 12,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Resumo da Ordem de Serviço</Text>

          <View style={{ flexDirection: 'row', marginBottom: 6 }}>
            <View style={{ width: '50%' }}>
              <Text style={{ fontSize: 9, color: MUTED_TEXT, marginBottom: 2 }}>Cliente</Text>
              <Text style={{ fontSize: 10, fontWeight: 500 }}>{serviceOrder.customer?.name || 'N/A'}</Text>
            </View>
            <View style={{ width: '50%' }}>
              <Text style={{ fontSize: 9, color: MUTED_TEXT, marginBottom: 2 }}>OS</Text>
              <Text style={{ fontSize: 10, fontWeight: 500 }}>#{serviceOrder.number}</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', marginBottom: 6 }}>
            <View style={{ width: '50%' }}>
              <Text style={{ fontSize: 9, color: MUTED_TEXT, marginBottom: 2 }}>Contrato / Safra</Text>
              <Text style={{ fontSize: 10, fontWeight: 500 }}>{serviceOrder.contract?.name || 'N/A'}</Text>
            </View>
            <View style={{ width: '50%' }}>
              <Text style={{ fontSize: 9, color: MUTED_TEXT, marginBottom: 2 }}>Data planejada</Text>
              <Text style={{ fontSize: 10, fontWeight: 500 }}>
                {formatOperationalDateBR(serviceOrder.plannedDate)}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', marginBottom: 6 }}>
            <View style={{ width: '50%' }}>
              <Text style={{ fontSize: 9, color: MUTED_TEXT, marginBottom: 2 }}>Status</Text>
              <Text style={{ fontSize: 10, fontWeight: 500 }}>{formatStatus(serviceOrder.status)}</Text>
            </View>
            <View style={{ width: '50%' }}>
              <Text style={{ fontSize: 9, color: MUTED_TEXT, marginBottom: 2 }}>Pilotos</Text>
              <Text style={{ fontSize: 10, fontWeight: 500 }}>
                {(serviceOrder.pilots || []).length > 0
                  ? (serviceOrder.pilots || []).map((pilot) => pilot.name).join(', ')
                  : 'N/A'}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', marginBottom: 8 }}>
            <View style={{ width: '50%' }}>
              <Text style={{ fontSize: 9, color: MUTED_TEXT, marginBottom: 2 }}>Fazendas</Text>
              <Text style={{ fontSize: 10, fontWeight: 500 }}>
                {(serviceOrder.farms || []).length > 0
                  ? (serviceOrder.farms || []).map((farm) => farm.name).join(', ')
                  : 'N/A'}
              </Text>
            </View>
            <View style={{ width: '50%' }}>
              <Text style={{ fontSize: 9, color: MUTED_TEXT, marginBottom: 2 }}>Observação / Tipo</Text>
              <Text style={{ fontSize: 10, fontWeight: 500 }}>{serviceOrder.observation || 'N/A'}</Text>
            </View>
          </View>

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              borderTop: `1px solid ${LIGHT_BORDER}`,
              paddingTop: 8,
            }}
          >
            <View style={{ width: '49%', backgroundColor: '#FFFBEB', borderRadius: 6, padding: 8 }}>
              <Text style={{ fontSize: 9, color: MUTED_TEXT, marginBottom: 2 }}>Total planejado</Text>
              <Text style={{ fontSize: 13, fontWeight: 700, color: BRAND_YELLOW }}>
                {formatHectares(totalPlannedHectares)}
              </Text>
            </View>
            <View style={{ width: '49%', backgroundColor: '#EFF6FF', borderRadius: 6, padding: 8 }}>
              <Text style={{ fontSize: 9, color: MUTED_TEXT, marginBottom: 2 }}>Total aplicado</Text>
              <Text style={{ fontSize: 13, fontWeight: 700, color: '#1D4ED8' }}>
                {formatHectares(totalAppliedHectares)}
              </Text>
            </View>
          </View>
        </View>

        <View
          style={{
            border: `1px solid ${LIGHT_BORDER}`,
            borderRadius: 8,
            padding: 10,
            marginBottom: 12,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Mapa 2D consolidado dos talhões</Text>

          <View style={{ flexDirection: 'row' }}>
            <View
              style={{
                width: 472,
                height: 312,
                border: `1px solid ${LIGHT_BORDER}`,
                borderRadius: 6,
                backgroundColor: '#F8FAFC',
                position: 'relative',
                overflow: 'hidden',
                marginRight: 10,
              }}
            >
              {mapProjection ? (
                <>
                  <Svg
                    width='100%'
                    height='100%'
                    viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
                    preserveAspectRatio='xMidYMid meet'
                  >
                    {mapProjection.shapes.map((shape) => {
                      const color = farmColorMap.get(shape.farmKey) || {
                        fill: '#CBD5E1',
                        stroke: '#64748B',
                      };

                      return (
                        <Path
                          key={`shape-${shape.id}`}
                          d={shape.pathD}
                          fill={color.fill}
                          fillOpacity={0.48}
                          fillRule='evenodd'
                          stroke={color.stroke}
                          strokeWidth={1.4}
                        />
                      );
                    })}
                  </Svg>

                  {mapProjection.shapes.map((shape) => (
                    <Text
                      key={`label-${shape.id}`}
                      style={{
                        position: 'absolute',
                        left: Math.max(0, shape.labelX - 42),
                        top: Math.max(0, shape.labelY - 6),
                        width: 84,
                        textAlign: 'center',
                        fontSize: 7,
                        color: '#111827',
                        backgroundColor: '#FFFFFFCC',
                        borderRadius: 3,
                        paddingVertical: 1,
                      }}
                    >
                      {shape.label}
                    </Text>
                  ))}
                </>
              ) : (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 }}>
                  <Text style={{ fontSize: 10, color: MUTED_TEXT, textAlign: 'center' }}>
                    Não há geometrias válidas para montar o mapa 2D desta OS.
                  </Text>
                </View>
              )}
            </View>

            <View style={{ width: 76, paddingTop: 2 }}>
              <Text style={{ fontSize: 10, fontWeight: 700, marginBottom: 6 }}>Legenda</Text>
              {farmSummaryRows.map((farm) => {
                const color = farmColorMap.get(farm.farmId) || { fill: '#CBD5E1', stroke: '#64748B' };
                return (
                  <View key={`${farm.farmId}-${farm.farmName}`} style={{ marginBottom: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                      <View
                        style={{
                          width: 9,
                          height: 9,
                          borderRadius: 2,
                          backgroundColor: color.fill,
                          border: `1px solid ${color.stroke}`,
                          marginRight: 4,
                        }}
                      />
                      <Text style={{ fontSize: 8, fontWeight: 500, flexShrink: 1 }}>{farm.farmName}</Text>
                    </View>
                    <Text style={{ fontSize: 7, color: MUTED_TEXT }}>{formatHectares(farm.plannedHectares)}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {mapProjection && (
            <Text style={{ marginTop: 6, fontSize: 8, color: MUTED_TEXT }}>
              Extensão aproximada: {mapProjection.extentKm.widthKm.toFixed(2).replace('.', ',')} km x{' '}
              {mapProjection.extentKm.heightKm.toFixed(2).replace('.', ',')} km
            </Text>
          )}
        </View>

        <View style={{ flexDirection: 'row' }}>
          <View
            style={{
              width: '49%',
              border: `1px solid ${LIGHT_BORDER}`,
              borderRadius: 8,
              padding: 8,
              marginRight: '2%',
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: 700, marginBottom: 6 }}>Talhões sem geometria</Text>
            {rowsWithoutGeometry.length > 0 ? (
              rowsWithoutGeometry.slice(0, 7).map((row) => (
                <Text key={`no-geo-${row.plotId}`} style={{ fontSize: 8, color: MUTED_TEXT, marginBottom: 3 }}>
                  {row.plotName} ({row.farmName}) - {formatHectares(row.plannedHectares)}
                </Text>
              ))
            ) : (
              <Text style={{ fontSize: 8, color: MUTED_TEXT }}>Todos os talhões possuem geometria.</Text>
            )}
            {rowsWithoutGeometry.length > 7 && (
              <Text style={{ fontSize: 8, color: MUTED_TEXT, marginTop: 2 }}>
                +{rowsWithoutGeometry.length - 7} talhão(ões) adicionais no detalhamento.
              </Text>
            )}
          </View>

          <View style={{ width: '49%', border: `1px solid ${LIGHT_BORDER}`, borderRadius: 8, padding: 8 }}>
            <Text style={{ fontSize: 10, fontWeight: 700, marginBottom: 6 }}>Aplicações sem vínculo de talhão</Text>
            {applicationsWithoutPlot.length > 0 ? (
              applicationsWithoutPlot.slice(0, 7).map((application) => (
                <Text key={`app-no-plot-${application.id}`} style={{ fontSize: 8, color: MUTED_TEXT, marginBottom: 3 }}>
                  {application.product?.name || 'Produto N/A'} - {formatHectares(parseNumber(application.hectares))}
                </Text>
              ))
            ) : (
              <Text style={{ fontSize: 8, color: MUTED_TEXT }}>Sem aplicações sem talhão vinculado.</Text>
            )}
            {applicationsWithUnknownPlot.length > 0 && (
              <Text style={{ fontSize: 8, color: MUTED_TEXT, marginTop: 3 }}>
                {applicationsWithUnknownPlot.length} aplicação(ões) com plot fora da lista planejada da OS.
              </Text>
            )}
          </View>
        </View>

        <View
          fixed
          style={{
            position: 'absolute',
            bottom: 16,
            left: 28,
            right: 28,
            borderTop: `1px solid ${LIGHT_BORDER}`,
            paddingTop: 6,
            flexDirection: 'row',
            justifyContent: 'space-between',
          }}
        >
          <Text style={{ fontSize: 8, color: MUTED_TEXT }}>DS Control • Gerado em {generatedAt}</Text>
          <Text
            style={{ fontSize: 8, color: MUTED_TEXT }}
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          />
        </View>
      </Page>

      {detailPages.map((rows, index) => (
        <Page
          key={`detail-page-${index}`}
          size='A4'
          style={{
            backgroundColor: '#FFFFFF',
            fontFamily: 'Roboto',
            fontSize: 9,
            color: DARK_TEXT,
            paddingTop: 24,
            paddingHorizontal: 28,
            paddingBottom: 44,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: `2px solid ${BRAND_YELLOW}`,
              paddingBottom: 10,
              marginBottom: 12,
            }}
          >
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src='/images/pdf-logo-only.png' style={{ width: 126, height: 32, objectFit: 'contain' }} />
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 13, fontWeight: 700 }}>Detalhamento dos Talhões</Text>
              <Text style={{ fontSize: 9, color: MUTED_TEXT }}>OS #{serviceOrder.number}</Text>
            </View>
          </View>

          <View style={{ border: `1px solid ${LIGHT_BORDER}`, borderRadius: 6, overflow: 'hidden' }}>
            <View
              style={{
                flexDirection: 'row',
                backgroundColor: '#FFF8E5',
                borderBottom: `1px solid ${LIGHT_BORDER}`,
                paddingVertical: 6,
                paddingHorizontal: 6,
              }}
            >
              <Text style={{ width: '24%', fontSize: 8, fontWeight: 700 }}>Fazenda</Text>
              <Text style={{ width: '24%', fontSize: 8, fontWeight: 700 }}>Talhão</Text>
              <Text style={{ width: '13%', fontSize: 8, fontWeight: 700, textAlign: 'right' }}>Área</Text>
              <Text style={{ width: '13%', fontSize: 8, fontWeight: 700, textAlign: 'right' }}>Aplicado</Text>
              <Text style={{ width: '11%', fontSize: 8, fontWeight: 700, textAlign: 'center' }}>Aplic.</Text>
              <Text style={{ width: '15%', fontSize: 8, fontWeight: 700, textAlign: 'center' }}>Status</Text>
            </View>

            {rows.map((row, rowIndex) => (
              <View
                key={`detail-${row.plotId}`}
                style={{
                  flexDirection: 'row',
                  paddingVertical: 6,
                  paddingHorizontal: 6,
                  backgroundColor: rowIndex % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
                  borderBottom: rowIndex === rows.length - 1 ? 0 : `1px solid ${LIGHT_BORDER}`,
                }}
              >
                <Text style={{ width: '24%', fontSize: 8 }}>{row.farmName}</Text>
                <Text style={{ width: '24%', fontSize: 8 }}>{row.plotName}</Text>
                <Text style={{ width: '13%', fontSize: 8, textAlign: 'right' }}>
                  {formatHectares(row.plannedHectares)}
                </Text>
                <Text style={{ width: '13%', fontSize: 8, textAlign: 'right' }}>
                  {formatHectares(row.appliedHectares)}
                </Text>
                <Text style={{ width: '11%', fontSize: 8, textAlign: 'center' }}>
                  {row.applicationsCount}
                </Text>
                <Text style={{ width: '15%', fontSize: 8, textAlign: 'center' }}>{row.status}</Text>
              </View>
            ))}
          </View>

          <View style={{ marginTop: 10, border: `1px solid ${LIGHT_BORDER}`, borderRadius: 6, padding: 8 }}>
            <Text style={{ fontSize: 9, fontWeight: 700, marginBottom: 5 }}>Resumo por fazenda</Text>
            {farmSummaryRows.map((farm) => (
              <View
                key={`farm-summary-${farm.farmId}-${farm.farmName}`}
                style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}
              >
                <Text style={{ fontSize: 8 }}>{farm.farmName}</Text>
                <Text style={{ fontSize: 8, color: MUTED_TEXT }}>
                  Planejado: {formatHectares(farm.plannedHectares)} | Aplicado:{' '}
                  {formatHectares(farm.appliedHectares)}
                </Text>
              </View>
            ))}
          </View>

          <View
            fixed
            style={{
              position: 'absolute',
              bottom: 16,
              left: 28,
              right: 28,
              borderTop: `1px solid ${LIGHT_BORDER}`,
              paddingTop: 6,
              flexDirection: 'row',
              justifyContent: 'space-between',
            }}
          >
            <Text style={{ fontSize: 8, color: MUTED_TEXT }}>DS Control • Gerado em {generatedAt}</Text>
            <Text
              style={{ fontSize: 8, color: MUTED_TEXT }}
              render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
            />
          </View>
        </Page>
      ))}
    </Document>
  );
};

export default ServiceOrderStrategicReportPDF;
