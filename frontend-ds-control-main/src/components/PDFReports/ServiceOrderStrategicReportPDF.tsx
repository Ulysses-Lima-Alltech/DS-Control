import { Document, Font, Image, Page, Path, Svg, Text, View } from '@react-pdf/renderer';
import React from 'react';

import type { Application } from '@/types/applications.type';
import type { ServiceOrder } from '@/types/service-order.type';
import { OPERATIONAL_TIME_ZONE } from '@/utils/operational-date';
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
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-light-webfont.ttf', fontWeight: 300 },
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf', fontWeight: 400 },
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-medium-webfont.ttf', fontWeight: 500 },
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-bold-webfont.ttf', fontWeight: 700 },
  ],
});

const MAP_CANVAS_WIDTH = 418;
const MAP_CANVAS_HEIGHT = 286;
const MAP_CONTAINER_WIDTH = MAP_CANVAS_WIDTH + 2;
const MAP_CONTAINER_HEIGHT = MAP_CANVAS_HEIGHT + 2;
const MAP_VIEWPORT_PADDING = 8;
const MAP_VIEWPORT_PADDING_SCALE = 0.58;

const BRAND_YELLOW = '#EAAE07';
const DARK_TEXT = '#1F2937';
const MUTED_TEXT = '#6B7280';
const LIGHT_BORDER = '#E5E7EB';

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

interface ServiceOrderStrategicReportPDFProps {
  serviceOrder: ServiceOrder;
  applications: Application[];
  prefetchedMapBaseDataUrl?: string | null;
  mapViewport?: StrategicMapViewport | null;
  mapBaseStyleLabel?: string;
}

function parseNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function formatHectares(value: number): string {
  return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ha`;
}

function formatGeneratedAt(): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: OPERATIONAL_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date());
}

const ServiceOrderStrategicReportPDF: React.FC<ServiceOrderStrategicReportPDFProps> = ({
  serviceOrder,
  applications,
  prefetchedMapBaseDataUrl = null,
  mapViewport = null,
  mapBaseStyleLabel = 'Mapbox Light',
}) => {
  const generatedAt = formatGeneratedAt();

  const applicationsByPlot = new Set(applications.map((app) => app.plotId).filter(Boolean) as string[]);

  const plotRows = (serviceOrder.plots || [])
    .map((plot) => {
      if (!plot.id) return null;
      return {
        plotId: plot.id,
        plotName: plot.name || `Talhao ${plot.id}`,
        farmId: plot.farmId || 'farm-unknown',
        farmName:
          serviceOrder.farms?.find((farm) => farm.id === plot.farmId)?.name || 'Fazenda nao informada',
        hectares: parseNumber(plot.hectare),
        polygons: extractPlotPolygons(plot),
        isApplied: applicationsByPlot.has(plot.id),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => a.farmName.localeCompare(b.farmName, 'pt-BR') || a.plotName.localeCompare(b.plotName, 'pt-BR'));

  const rowsWithGeometry = plotRows.filter((row) => row.polygons.length > 0);
  const rowsWithoutGeometry = plotRows.filter((row) => row.polygons.length === 0);

  const mapShapesInput: StrategicMapShapeInput[] = rowsWithGeometry.map((row) => ({
    id: row.plotId,
    label: row.plotName,
    farmKey: row.farmId,
    polygons: row.polygons,
  }));

  const strategicViewport =
    mapViewport ??
    buildStrategicMapViewport(mapShapesInput, MAP_CANVAS_WIDTH, MAP_CANVAS_HEIGHT, MAP_VIEWPORT_PADDING, {
      paddingScale: MAP_VIEWPORT_PADDING_SCALE,
      minPaddingPx: 2,
      maxPaddingRatio: 0.05,
    });

  const mapProjection = strategicViewport
    ? buildStrategicMapProjectionFromViewport(mapShapesInput, strategicViewport)
    : buildStrategicMapProjection(mapShapesInput, MAP_CANVAS_WIDTH, MAP_CANVAS_HEIGHT, 10);

  const farmSummary = new Map<string, { farmId: string; farmName: string; hectares: number }>();
  plotRows.forEach((row) => {
    const key = `${row.farmId}|||${row.farmName}`;
    const current = farmSummary.get(key) || { farmId: row.farmId, farmName: row.farmName, hectares: 0 };
    current.hectares += row.hectares;
    farmSummary.set(key, current);
  });
  const farmSummaryRows = Array.from(farmSummary.values()).sort((a, b) => b.hectares - a.hectares);

  const farmColorMap = new Map<string, { fill: string; stroke: string }>();
  farmSummaryRows.forEach((farm, index) => {
    farmColorMap.set(farm.farmId, FARM_COLORS[index % FARM_COLORS.length]);
  });

  const totalHectares = plotRows.reduce((sum, row) => sum + row.hectares, 0);
  const title = `${serviceOrder.customer?.name || 'Cliente'} / OS #${serviceOrder.number} - MAPA ESTRATEGICO`;

  return (
    <Document>
      <Page size='A4' style={{ backgroundColor: '#FFFFFF', fontFamily: 'Roboto', fontSize: 10, color: DARK_TEXT, padding: 28 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottom: `2px solid ${BRAND_YELLOW}`, paddingBottom: 10, marginBottom: 12 }}>
          <Image src='/images/pdf-logo-only.png' style={{ width: 126, height: 32, objectFit: 'contain' }} />
          <Text style={{ fontSize: 9, color: MUTED_TEXT }}>Gerado em: {generatedAt}</Text>
        </View>

        <Text style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>{title}</Text>

        <View style={{ flexDirection: 'row', marginBottom: 10 }}>
          <View style={{ width: MAP_CONTAINER_WIDTH, height: MAP_CONTAINER_HEIGHT, border: `1px solid ${LIGHT_BORDER}`, borderRadius: 6, overflow: 'hidden', marginRight: 10 }}>
            {mapProjection ? (
              <>
                {prefetchedMapBaseDataUrl && (
                  <Image src={prefetchedMapBaseDataUrl} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
                <Svg width='100%' height='100%' viewBox={`0 0 ${MAP_CANVAS_WIDTH} ${MAP_CANVAS_HEIGHT}`} preserveAspectRatio='xMidYMid meet'>
                  {mapProjection.shapes.map((shape) => {
                    const source = plotRows.find((row) => row.plotId === shape.id);
                    const color = farmColorMap.get(shape.farmKey) || { fill: '#CBD5E1', stroke: '#64748B' };
                    const isApplied = Boolean(source?.isApplied);
                    return (
                      <Path
                        key={shape.id}
                        d={shape.pathD}
                        fill={color.fill}
                        fillOpacity={isApplied ? 0.78 : 0.45}
                        stroke={isApplied ? '#065F46' : color.stroke}
                        strokeWidth={isApplied ? 1.2 : 0.55}
                        fillRule='evenodd'
                      />
                    );
                  })}
                </Svg>
              </>
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 }}>
                <Text style={{ fontSize: 9, color: MUTED_TEXT, textAlign: 'center' }}>Nao ha geometrias validas para montar o mapa desta OS.</Text>
              </View>
            )}
          </View>

          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 10, fontWeight: 700, marginBottom: 6 }}>Legenda por fazenda</Text>
            {farmSummaryRows.map((farm) => {
              const color = farmColorMap.get(farm.farmId) || { fill: '#CBD5E1', stroke: '#64748B' };
              return (
                <View key={`${farm.farmId}-${farm.farmName}`} style={{ marginBottom: 5 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: color.fill, border: `1px solid ${color.stroke}`, marginRight: 4 }} />
                    <Text style={{ fontSize: 8, flexShrink: 1 }}>{farm.farmName}</Text>
                  </View>
                  <Text style={{ fontSize: 7, color: MUTED_TEXT }}>{formatHectares(farm.hectares)}</Text>
                </View>
              );
            })}

            <View style={{ marginTop: 6, borderTop: `1px solid ${LIGHT_BORDER}`, paddingTop: 6 }}>
              <Text style={{ fontSize: 8, fontWeight: 700, marginBottom: 4 }}>Status operacional</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
                <View style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: '#86EFAC', border: '1px solid #065F46', marginRight: 4 }} />
                <Text style={{ fontSize: 7.5 }}>Aplicado</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: '#D1D5DB', border: '1px solid #64748B', marginRight: 4 }} />
                <Text style={{ fontSize: 7.5 }}>Pendente / Programado</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={{ borderTop: `1px solid ${LIGHT_BORDER}`, paddingTop: 8 }}>
          <Text style={{ fontSize: 10, fontWeight: 700 }}>Total geral: {formatHectares(totalHectares)}</Text>
          <Text style={{ marginTop: 3, fontSize: 7.5, color: MUTED_TEXT }}>
            Talhoes com geometria: {rowsWithGeometry.length} | Talhoes sem geometria: {rowsWithoutGeometry.length}
          </Text>
          <Text style={{ marginTop: 2, fontSize: 7.5, color: MUTED_TEXT }}>
            Base cartografica: {prefetchedMapBaseDataUrl ? mapBaseStyleLabel : 'indisponivel (fallback vetorial)'}
          </Text>
        </View>
      </Page>
    </Document>
  );
};

export default ServiceOrderStrategicReportPDF;
