import { Document, Font, Image, Page, Path, Svg, Text, View } from '@react-pdf/renderer';
import React from 'react';

import type { Application } from '@/types/applications.type';
import type { ServiceOrder } from '@/types/service-order.type';
import { OPERATIONAL_TIME_ZONE, formatOperationalDateBR } from '@/utils/operational-date';
import {
  buildStrategicMapProjection,
  buildStrategicMapProjectionFromViewport,
  buildStrategicMapViewport,
  extractPlotPolygons,
  type StrategicMapShapeInput,
  type StrategicMapViewport,
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
const MAP_BACKGROUND = '#E8EEF6';
const MAP_GRID = '#C8D6EA';
const MAP_FALLBACK_TAG = '#D97706';

const MAP_CANVAS_WIDTH = 418;
const MAP_CANVAS_HEIGHT = 286;
const MAP_CONTAINER_WIDTH = MAP_CANVAS_WIDTH + 2;
const MAP_CONTAINER_HEIGHT = MAP_CANVAS_HEIGHT + 2;
const MAP_LEGEND_WIDTH = 109;
const MAP_ROW_GAP = 8;

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

type PlotStatus = 'Pendente' | 'Parcial' | 'Concluido';

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
  prefetchedMapBaseDataUrl?: string | null;
  mapViewport?: StrategicMapViewport | null;
  mapBaseStyleLabel?: string;
}

type MapLabelPlacement = {
  id: string;
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
};

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
    return 'Concluida';
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

  return farmByNestedPlot?.name || 'Fazenda nao informada';
}

function resolvePlotStatus(plannedHectares: number, appliedHectares: number, applicationsCount: number): PlotStatus {
  if (applicationsCount === 0 || appliedHectares <= 0) {
    return 'Pendente';
  }

  if (plannedHectares > 0 && appliedHectares >= plannedHectares * 0.98) {
    return 'Concluido';
  }

  return 'Parcial';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function rectanglesOverlap(
  a: { left: number; top: number; width: number; height: number },
  b: { left: number; top: number; width: number; height: number },
  padding: number = 2
): boolean {
  return !(
    a.left + a.width + padding <= b.left ||
    b.left + b.width + padding <= a.left ||
    a.top + a.height + padding <= b.top ||
    b.top + b.height + padding <= a.top
  );
}

function simplifyPlotLabel(label: string): string {
  const compact = label.replace(/\s+/g, ' ').trim();
  if (compact.length <= 18) {
    return compact;
  }

  const firstPart = compact.split(' ')[0];
  return firstPart.length <= 12 ? firstPart : `${firstPart.slice(0, 12)}...`;
}

function buildMapLabelPlacements(
  shapes: Array<{
    id: string;
    label: string;
    labelX: number;
    labelY: number;
    areaPx: number;
    bbox: { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number };
  }>,
  mapWidth: number,
  mapHeight: number
): MapLabelPlacement[] {
  const sorted = [...shapes].sort((a, b) => b.areaPx - a.areaPx);
  const placed: MapLabelPlacement[] = [];

  sorted.forEach((shape) => {
    if (shape.areaPx < 260 || shape.bbox.width < 24 || shape.bbox.height < 12) {
      return;
    }

    const label = simplifyPlotLabel(shape.label);
    const width = clamp(label.length * 3.5 + 10, 30, 90);
    const height = 11;

    let left = shape.labelX - width / 2;
    let top = shape.labelY - height / 2;

    const bboxMinLeft = shape.bbox.minX - 3;
    const bboxMaxLeft = shape.bbox.maxX - width + 3;
    if (bboxMaxLeft >= bboxMinLeft) {
      left = clamp(left, bboxMinLeft, bboxMaxLeft);
    }

    const bboxMinTop = shape.bbox.minY - 2;
    const bboxMaxTop = shape.bbox.maxY - height + 2;
    if (bboxMaxTop >= bboxMinTop) {
      top = clamp(top, bboxMinTop, bboxMaxTop);
    }

    left = clamp(left, 2, mapWidth - width - 2);
    top = clamp(top, 2, mapHeight - height - 2);

    const candidate = { left, top, width, height };
    const hasCollision = placed.some((existing) => rectanglesOverlap(candidate, existing, 1.5));
    if (hasCollision) {
      return;
    }

    placed.push({
      id: shape.id,
      text: label,
      left,
      top,
      width,
      height,
    });
  });

  return placed;
}

function buildMapGridPaths(width: number, height: number, step: number): string[] {
  const paths: string[] = [];

  for (let x = step; x < width; x += step) {
    paths.push(`M ${x} 0 L ${x} ${height}`);
  }

  for (let y = step; y < height; y += step) {
    paths.push(`M 0 ${y} L ${width} ${y}`);
  }

  return paths;
}

function buildTinyShapeMarkerPath(x: number, y: number, size: number = 2.5): string {
  return [
    `M ${x.toFixed(2)} ${(y - size).toFixed(2)}`,
    `L ${(x + size).toFixed(2)} ${y.toFixed(2)}`,
    `L ${x.toFixed(2)} ${(y + size).toFixed(2)}`,
    `L ${(x - size).toFixed(2)} ${y.toFixed(2)}`,
    'Z',
  ].join(' ');
}

const ServiceOrderStrategicReportPDF: React.FC<ServiceOrderStrategicReportPDFProps> = ({
  serviceOrder,
  applications,
  prefetchedMapBaseDataUrl = null,
  mapViewport = null,
  mapBaseStyleLabel = 'Base cartografica 2D',
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
        plotName: plot.name || `Talhao ${plot.id}`,
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
    label: row.plotName,
    farmKey: row.farmId,
    polygons: row.polygons,
  }));

  const strategicViewport =
    mapViewport ??
    buildStrategicMapViewport(mapShapesInput, MAP_CANVAS_WIDTH, MAP_CANVAS_HEIGHT, 10);

  const mapProjection = strategicViewport
    ? buildStrategicMapProjectionFromViewport(mapShapesInput, strategicViewport)
    : buildStrategicMapProjection(mapShapesInput, MAP_CANVAS_WIDTH, MAP_CANVAS_HEIGHT, 10);
  const mapLabelPlacements = mapProjection
    ? buildMapLabelPlacements(mapProjection.shapes, MAP_CANVAS_WIDTH, MAP_CANVAS_HEIGHT)
    : [];
  const mapGridPaths = buildMapGridPaths(MAP_CANVAS_WIDTH, MAP_CANVAS_HEIGHT, 36);
  const shouldShowMapBaseFallback = mapProjection && !prefetchedMapBaseDataUrl;

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
  const consistencyMessages: string[] = [];
  if (rowsWithoutGeometry.length > 0) {
    consistencyMessages.push(
      `${rowsWithoutGeometry.length} talhao(oes) sem geometria no cadastro.`
    );
  }
  if (applicationsWithoutPlot.length > 0) {
    consistencyMessages.push(
      `${applicationsWithoutPlot.length} aplicacao(oes) sem vinculo de talhao.`
    );
  }
  if (applicationsWithUnknownPlot.length > 0) {
    consistencyMessages.push(
      `${applicationsWithUnknownPlot.length} aplicacao(oes) com plot fora da lista planejada da OS.`
    );
  }

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
            <Text style={{ fontSize: 14, fontWeight: 700 }}>Relatorio da OS</Text>
            <Text style={{ fontSize: 10, color: MUTED_TEXT, marginTop: 2 }}>
              Mapa Estrategico Consolidado
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
          <Text style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Resumo da Ordem de Servico</Text>

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
              <Text style={{ fontSize: 9, color: MUTED_TEXT, marginBottom: 2 }}>Observacao / Tipo</Text>
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
          <Text style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Mapa 2D consolidado dos talhoes</Text>

          <View style={{ flexDirection: 'row' }}>
            <View
              style={{
                width: MAP_CONTAINER_WIDTH,
                height: MAP_CONTAINER_HEIGHT,
                border: `1px solid ${LIGHT_BORDER}`,
                borderRadius: 6,
                backgroundColor: MAP_BACKGROUND,
                position: 'relative',
                overflow: 'hidden',
                marginRight: MAP_ROW_GAP,
              }}
            >
              {mapProjection ? (
                <>
                  {prefetchedMapBaseDataUrl && (
                    // eslint-disable-next-line jsx-a11y/alt-text
                    <Image
                      src={prefetchedMapBaseDataUrl}
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  )}
                  <Svg
                    width='100%'
                    height='100%'
                    viewBox={`0 0 ${MAP_CANVAS_WIDTH} ${MAP_CANVAS_HEIGHT}`}
                    preserveAspectRatio='xMidYMid meet'
                  >
                    {!prefetchedMapBaseDataUrl &&
                      mapGridPaths.map((gridPath, index) => (
                        <Path
                          key={`grid-${index}`}
                          d={gridPath}
                          fill='none'
                          stroke={MAP_GRID}
                          strokeWidth={0.7}
                          strokeOpacity={0.55}
                        />
                      ))}
                    <Path
                      d={`M 0 0 L ${MAP_CANVAS_WIDTH} 0 L ${MAP_CANVAS_WIDTH} ${MAP_CANVAS_HEIGHT} L 0 ${MAP_CANVAS_HEIGHT} Z`}
                      fill={prefetchedMapBaseDataUrl ? 'none' : '#FFFFFF'}
                      fillOpacity={prefetchedMapBaseDataUrl ? 0 : 0.08}
                      stroke={prefetchedMapBaseDataUrl ? '#AFC1D8' : '#B8C8DD'}
                      strokeWidth={1}
                    />
                    {mapProjection.shapes.map((shape) => {
                      const color = farmColorMap.get(shape.farmKey) || {
                        fill: '#CBD5E1',
                        stroke: '#64748B',
                      };
                      const isTinyShape = shape.areaPx < 130;
                      const strokeWidth = isTinyShape ? 2.3 : shape.areaPx < 600 ? 2.2 : 2.8;
                      const fillOpacity = prefetchedMapBaseDataUrl
                        ? isTinyShape
                          ? 0.66
                          : 0.54
                        : isTinyShape
                          ? 0.84
                          : 0.74;

                      return (
                        <React.Fragment key={`shape-${shape.id}`}>
                          <Path
                            d={shape.pathD}
                            fill={color.fill}
                            fillOpacity={fillOpacity}
                            fillRule='evenodd'
                            stroke={color.stroke}
                            strokeWidth={strokeWidth}
                          />
                          {isTinyShape && (
                            <Path
                              d={buildTinyShapeMarkerPath(shape.labelX, shape.labelY)}
                              fill={color.stroke}
                              stroke='#FFFFFF'
                              strokeWidth={0.8}
                            />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </Svg>

                  {mapLabelPlacements.map((label) => (
                    <Text
                      key={`label-${label.id}`}
                      style={{
                        position: 'absolute',
                        left: label.left,
                        top: label.top,
                        width: label.width,
                        height: label.height,
                        textAlign: 'center',
                        fontSize: 6.6,
                        fontWeight: 500,
                        color: '#111827',
                        backgroundColor: '#FFFFFFE5',
                        border: '0.5px solid #CBD5E1',
                        borderRadius: 3,
                        lineHeight: 1.15,
                        paddingTop: 1.3,
                      }}
                    >
                      {label.text}
                    </Text>
                  ))}

                    <View
                      style={{
                        position: 'absolute',
                        right: 8,
                        top: 8,
                      alignItems: 'center',
                      border: '0.5px solid #B9C8DA',
                      borderRadius: 4,
                      paddingHorizontal: 4,
                      paddingVertical: 2,
                      backgroundColor: '#FFFFFFD9',
                    }}
                  >
                      <Text style={{ fontSize: 6, color: '#4B5563', marginBottom: 1 }}>N</Text>
                      <Text style={{ fontSize: 7, color: '#111827' }}>^</Text>
                    </View>

                    {shouldShowMapBaseFallback && (
                      <View
                        style={{
                          position: 'absolute',
                          left: 8,
                          bottom: 8,
                          border: `0.5px solid ${MAP_FALLBACK_TAG}`,
                          borderRadius: 4,
                          backgroundColor: '#FFF7ED',
                          paddingHorizontal: 5,
                          paddingVertical: 3,
                        }}
                      >
                        <Text style={{ fontSize: 6.4, color: '#9A3412' }}>
                          Base cartografica indisponivel. Exibindo malha vetorial.
                        </Text>
                      </View>
                    )}
                </>
              ) : (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 }}>
                  <Text style={{ fontSize: 10, color: MUTED_TEXT, textAlign: 'center' }}>
                    Nao ha geometrias validas para montar o mapa 2D desta OS.
                  </Text>
                </View>
              )}
            </View>

            <View style={{ width: MAP_LEGEND_WIDTH, paddingTop: 2 }}>
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
            <View style={{ marginTop: 6 }}>
              <Text style={{ fontSize: 8, color: MUTED_TEXT }}>
                Extensao aproximada: {mapProjection.extentKm.widthKm.toFixed(2).replace('.', ',')} km x{' '}
                {mapProjection.extentKm.heightKm.toFixed(2).replace('.', ',')} km
              </Text>
              <Text style={{ marginTop: 2, fontSize: 7.5, color: MUTED_TEXT }}>
                Base cartografica: {prefetchedMapBaseDataUrl ? mapBaseStyleLabel : 'indisponivel (fallback vetorial)'}
              </Text>
            </View>
          )}
        </View>

        {consistencyMessages.length > 0 && (
          <View
            style={{
              border: `1px solid ${LIGHT_BORDER}`,
              borderRadius: 8,
              padding: 8,
              backgroundColor: '#FCFCFD',
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: 700, marginBottom: 4 }}>Observacoes de consistencia</Text>
            {consistencyMessages.map((message, index) => (
              <Text key={`consistency-${index}`} style={{ fontSize: 8, color: MUTED_TEXT, marginBottom: 2 }}>
                - {message}
              </Text>
            ))}
          </View>
        )}

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
          <Text style={{ fontSize: 8, color: MUTED_TEXT }}>DS Control - Gerado em {generatedAt}</Text>
          <Text
            style={{ fontSize: 8, color: MUTED_TEXT }}
            render={({ pageNumber, totalPages }) => `Pagina ${pageNumber} de ${totalPages}`}
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
              <Text style={{ fontSize: 13, fontWeight: 700 }}>Detalhamento dos Talhoes</Text>
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
              <Text style={{ width: '24%', fontSize: 8, fontWeight: 700 }}>Talhao</Text>
              <Text style={{ width: '13%', fontSize: 8, fontWeight: 700, textAlign: 'right' }}>Area</Text>
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

          {index === detailPages.length - 1 && (
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
          )}

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
            <Text style={{ fontSize: 8, color: MUTED_TEXT }}>DS Control - Gerado em {generatedAt}</Text>
            <Text
              style={{ fontSize: 8, color: MUTED_TEXT }}
              render={({ pageNumber, totalPages }) => `Pagina ${pageNumber} de ${totalPages}`}
            />
          </View>
        </Page>
      ))}
    </Document>
  );
};

export default ServiceOrderStrategicReportPDF;
