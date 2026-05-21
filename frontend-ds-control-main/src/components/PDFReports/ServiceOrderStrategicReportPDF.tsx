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

const PAGE_PADDING = 16;
const HEADER_HEIGHT = 56;
const MAP_CANVAS_WIDTH = 1080;
const MAP_CANVAS_HEIGHT = 660;
const MAP_VIEWPORT_PADDING = 10;
const MAP_VIEWPORT_PADDING_SCALE = 0.58;

const BRAND_YELLOW = '#EAAE07';
const DARK_TEXT = '#111827';
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
  { fill: '#94A3B8', stroke: '#475569' },
  { fill: '#F59E0B', stroke: '#B45309' },
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
      const farmName =
        serviceOrder.farms?.find((farm) => farm.id === plot.farmId)?.name || 'Fazenda nao informada';
      return {
        plotId: plot.id,
        plotName: plot.name || `Talhao ${plot.id}`,
        farmId: plot.farmId || 'farm-unknown',
        farmName,
        label: `${plot.name || `Talhao ${plot.id}`} (${farmName})`,
        hectares: parseNumber(plot.hectare),
        polygons: extractPlotPolygons(plot),
        isApplied: applicationsByPlot.has(plot.id),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => a.plotName.localeCompare(b.plotName, 'pt-BR'));

  const rowsWithGeometry = plotRows.filter((row) => row.polygons.length > 0);
  const rowsWithoutGeometry = plotRows.filter((row) => row.polygons.length === 0);

  const shapesInput: StrategicMapShapeInput[] = rowsWithGeometry.map((row) => ({
    id: row.plotId,
    label: row.plotName,
    farmKey: row.farmId,
    polygons: row.polygons,
  }));

  const viewport =
    mapViewport ??
    buildStrategicMapViewport(shapesInput, MAP_CANVAS_WIDTH, MAP_CANVAS_HEIGHT, MAP_VIEWPORT_PADDING, {
      paddingScale: MAP_VIEWPORT_PADDING_SCALE,
      minPaddingPx: 2,
      maxPaddingRatio: 0.05,
    });

  const mapProjection = viewport
    ? buildStrategicMapProjectionFromViewport(shapesInput, viewport)
    : buildStrategicMapProjection(shapesInput, MAP_CANVAS_WIDTH, MAP_CANVAS_HEIGHT, MAP_VIEWPORT_PADDING);

  const farmColorMap = new Map<string, { fill: string; stroke: string }>();
  const orderedFarmIds = Array.from(new Set(plotRows.map((row) => row.farmId)));
  orderedFarmIds.forEach((farmId, index) => {
    farmColorMap.set(farmId, FARM_COLORS[index % FARM_COLORS.length]);
  });

  const totalHectares = plotRows.reduce((sum, row) => sum + row.hectares, 0);
  const customerName = serviceOrder.customer?.name || 'CLIENTE';
  const observationTitle = (serviceOrder.observation || 'PROGRAMAÇÃO').toUpperCase();
  const title = `${customerName.toUpperCase()} - MAPA ESTRATÉGICO - ${observationTitle}`;

  const estimatedScaleKm = mapProjection
    ? Math.max(0.2, Number((mapProjection.extentKm.widthKm * 0.18).toFixed(2)))
    : 0.5;

  return (
    <Document>
      <Page
        size='A4'
        orientation='landscape'
        style={{ backgroundColor: '#FFFFFF', fontFamily: 'Roboto', fontSize: 9, color: DARK_TEXT, padding: PAGE_PADDING }}
      >
        <View
          style={{
            height: HEADER_HEIGHT,
            borderBottom: `2px solid ${BRAND_YELLOW}`,
            marginBottom: 10,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ width: 130 }}>
            <Text style={{ fontSize: 11, fontWeight: 700 }}>DS CONTROL</Text>
            <Text style={{ fontSize: 8, color: MUTED_TEXT }}>Mapa estratégico operacional</Text>
          </View>

          <View style={{ flex: 1, paddingHorizontal: 8 }}>
            <Text style={{ textAlign: 'center', fontSize: 16, fontWeight: 700 }}>{title}</Text>
          </View>

          <View
            style={{
              width: 170,
              border: `1px solid ${LIGHT_BORDER}`,
              borderRadius: 4,
              padding: 6,
              alignItems: 'flex-start',
            }}
          >
            <Text style={{ fontSize: 7.5, color: MUTED_TEXT }}>Gerado em</Text>
            <Text style={{ fontSize: 8.5, fontWeight: 700 }}>{generatedAt}</Text>
          </View>
        </View>

        <View style={{ flex: 1, position: 'relative', border: `1px solid ${LIGHT_BORDER}`, borderRadius: 6, overflow: 'hidden' }}>
          {mapProjection ? (
            <>
              {prefetchedMapBaseDataUrl && (
                <Image
                  src={prefetchedMapBaseDataUrl}
                  style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                />
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
                      fillOpacity={prefetchedMapBaseDataUrl ? 0.56 : 0.72}
                      stroke={isApplied ? '#111827' : color.stroke}
                      strokeWidth={isApplied ? 1.85 : 0.9}
                      fillRule='evenodd'
                    />
                  );
                })}
              </Svg>

              <View
                style={{
                  position: 'absolute',
                  left: 12,
                  top: 12,
                  width: 34,
                  height: 46,
                  border: `1px solid ${LIGHT_BORDER}`,
                  borderRadius: 4,
                  backgroundColor: '#FFFFFFE6',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 8, fontWeight: 700 }}>N</Text>
                <Text style={{ fontSize: 12, marginTop: -2 }}>?</Text>
              </View>

              <View
                style={{
                  position: 'absolute',
                  left: 12,
                  bottom: 12,
                  width: 330,
                  backgroundColor: '#FFFFFFED',
                  border: `1px solid ${LIGHT_BORDER}`,
                  borderRadius: 4,
                  padding: 7,
                }}
              >
                <Text style={{ fontSize: 9, fontWeight: 700, marginBottom: 5 }}>LEGENDA</Text>
                {plotRows.slice(0, 8).map((row) => {
                  const color = farmColorMap.get(row.farmId) || { fill: '#CBD5E1', stroke: '#64748B' };
                  return (
                    <View key={row.plotId} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
                      <View
                        style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: color.fill, border: `1px solid ${color.stroke}`, marginRight: 4 }}
                      />
                      <Text style={{ flex: 1, fontSize: 7.6 }}>
                        {row.plotName} ({row.hectares.toFixed(2)} ha)
                      </Text>
                    </View>
                  );
                })}
                {plotRows.length > 8 && (
                  <Text style={{ fontSize: 7.2, color: MUTED_TEXT, marginBottom: 2 }}>
                    + {plotRows.length - 8} talhão(ões) na OS
                  </Text>
                )}
                <Text style={{ fontSize: 8.2, fontWeight: 700, marginTop: 3 }}>
                  TOTAL: {totalHectares.toFixed(2)} HA
                </Text>
              </View>

              <View
                style={{
                  position: 'absolute',
                  right: 12,
                  bottom: 12,
                  width: 220,
                  backgroundColor: '#FFFFFFED',
                  border: `1px solid ${LIGHT_BORDER}`,
                  borderRadius: 4,
                  padding: 6,
                }}
              >
                <Text style={{ fontSize: 7.5, fontWeight: 700, marginBottom: 3 }}>STATUS OPERACIONAL</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                  <View style={{ width: 10, height: 8, border: '2px solid #111827', marginRight: 4 }} />
                  <Text style={{ fontSize: 7.2 }}>Aplicado</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
                  <View style={{ width: 10, height: 8, border: '1px solid #64748B', marginRight: 4 }} />
                  <Text style={{ fontSize: 7.2 }}>Pendente / Programado</Text>
                </View>

                <View style={{ borderTop: `1px solid ${LIGHT_BORDER}`, paddingTop: 4, marginTop: 2 }}>
                  <Text style={{ fontSize: 7.2, color: MUTED_TEXT }}>Escala aprox.: {estimatedScaleKm.toFixed(2).replace('.', ',')} km</Text>
                  <View style={{ marginTop: 2, width: 92, height: 3, backgroundColor: '#111827' }} />
                  <Text style={{ marginTop: 2, fontSize: 7, color: MUTED_TEXT }}>
                    Base: {prefetchedMapBaseDataUrl ? mapBaseStyleLabel : 'fallback vetorial'}
                  </Text>
                </View>
              </View>

              <Image
                src='/images/pdf-logo-only.png'
                style={{ position: 'absolute', right: 14, top: 14, width: 95, height: 24, objectFit: 'contain' }}
              />
            </>
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
              <Text style={{ fontSize: 12, color: MUTED_TEXT, textAlign: 'center' }}>
                Não há geometrias válidas para montar o mapa estratégico desta OS.
              </Text>
              <Text style={{ marginTop: 6, fontSize: 8, color: MUTED_TEXT }}>
                Talhões sem geometria: {rowsWithoutGeometry.length}
              </Text>
            </View>
          )}
        </View>
      </Page>
    </Document>
  );
};

export default ServiceOrderStrategicReportPDF;

