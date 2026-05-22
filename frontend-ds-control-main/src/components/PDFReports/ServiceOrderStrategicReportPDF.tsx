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

const PAGE_PADDING = 10;
const HEADER_HEIGHT = 44;
const MAP_CANVAS_WIDTH = 1080;
const MAP_CANVAS_HEIGHT = 660;
const MAP_VIEWPORT_PADDING = 8;
const MAP_VIEWPORT_PADDING_SCALE = 0.78;

const BRAND_YELLOW = '#EAAE07';
const DARK_TEXT = '#111827';
const MUTED_TEXT = '#6B7280';
const LIGHT_BORDER = '#E5E7EB';

const FARM_COLORS = [
  { fill: '#38BDF8', stroke: '#0284C7' },
  { fill: '#34D399', stroke: '#059669' },
  { fill: '#FBBF24', stroke: '#D97706' },
  { fill: '#A78BFA', stroke: '#7C3AED' },
  { fill: '#F97316', stroke: '#C2410C' },
  { fill: '#2DD4BF', stroke: '#0F766E' },
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
  prefetchedMapBaseDataUrl = null,
  mapViewport = null,
}) => {
  const generatedAt = formatGeneratedAt();

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
        hectares: parseNumber(plot.hectare),
        polygons: extractPlotPolygons(plot),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => {
      const byFarm = a.farmName.localeCompare(b.farmName, 'pt-BR');
      return byFarm !== 0 ? byFarm : a.plotName.localeCompare(b.plotName, 'pt-BR');
    });

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
  const observationTitle = (serviceOrder.observation || 'PROGRAMACAO').toUpperCase();
  const title = `${customerName.toUpperCase()} - MAPA ESTRATEGICO - ${observationTitle}`;

  const scaleBarWidthPx = 120;
  const estimatedScaleKm = mapProjection
    ? Math.max(0.1, Number(((mapProjection.extentKm.widthKm * scaleBarWidthPx) / MAP_CANVAS_WIDTH).toFixed(2)))
    : 0.5;

  const legendRows = plotRows.map((row) => ({
    ...row,
    color: farmColorMap.get(row.farmId) || { fill: '#CBD5E1', stroke: '#64748B' },
  }));
  const splitIndex = Math.ceil(legendRows.length / 2);
  const legendColumns = [legendRows.slice(0, splitIndex), legendRows.slice(splitIndex)];

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
            marginBottom: 6,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ width: 100 }}>
            <Text style={{ fontSize: 8, color: MUTED_TEXT }}>OS</Text>
            <Text style={{ fontSize: 12, fontWeight: 700 }}>#{serviceOrder.number || '-'}</Text>
          </View>

          <View style={{ flex: 1, paddingHorizontal: 8 }}>
            <Text style={{ textAlign: 'center', fontSize: 16, fontWeight: 700 }}>{title}</Text>
          </View>

          <View style={{ width: 180, alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 7.2, color: MUTED_TEXT }}>Gerado em</Text>
            <Text style={{ fontSize: 8.4, fontWeight: 700 }}>{generatedAt}</Text>
          </View>
        </View>

        <View style={{ flex: 1, position: 'relative', border: `1px solid ${LIGHT_BORDER}`, overflow: 'hidden' }}>
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
                  const color = farmColorMap.get(shape.farmKey) || { fill: '#CBD5E1', stroke: '#64748B' };
                  return (
                    <Path
                      key={shape.id}
                      d={shape.pathD}
                      fill={color.fill}
                      fillOpacity={prefetchedMapBaseDataUrl ? 0.52 : 0.74}
                      stroke='#0F172A'
                      strokeWidth={1.35}
                      fillRule='evenodd'
                    />
                  );
                })}
              </Svg>

              <View
                style={{
                  position: 'absolute',
                  left: 14,
                  top: 10,
                  width: 36,
                  height: 50,
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: 2,
                }}
              >
                <Text style={{ fontSize: 6.4, fontWeight: 700 }}>N</Text>
                <Svg width='24' height='24' viewBox='0 0 24 24'>
                  <Path d='M 12 1 L 14.6 9 L 12 7.2 L 9.4 9 Z' fill='#111827' />
                  <Path d='M 12 23 L 10.5 16.5 L 12 17.4 L 13.5 16.5 Z' fill='#6B7280' />
                  <Path d='M 1 12 L 7.8 10.7 L 7 12 L 7.8 13.3 Z' fill='#6B7280' />
                  <Path d='M 23 12 L 16.2 13.3 L 17 12 L 16.2 10.7 Z' fill='#6B7280' />
                </Svg>
                <View style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between', paddingHorizontal: 2 }}>
                  <Text style={{ fontSize: 5.8, fontWeight: 700 }}>W</Text>
                  <Text style={{ fontSize: 5.8, fontWeight: 700 }}>E</Text>
                </View>
                <Text style={{ fontSize: 5.8, fontWeight: 700 }}>S</Text>
              </View>

              <View
                style={{
                  position: 'absolute',
                  left: 10,
                  bottom: 10,
                  width: 512,
                  backgroundColor: '#FFFFFFED',
                  border: `1px solid ${LIGHT_BORDER}`,
                  padding: 6,
                }}
              >
                <Text style={{ fontSize: 8.6, fontWeight: 700, marginBottom: 4 }}>LEGENDA (TALHOES / FAZENDAS)</Text>
                <View style={{ flexDirection: 'row' }}>
                  {legendColumns.map((column, columnIndex) => (
                    <View key={`legend-column-${columnIndex}`} style={{ flex: 1, paddingRight: columnIndex === 0 ? 8 : 0 }}>
                      {column.map((row) => (
                        <View key={row.plotId} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 2 }}>
                          <View
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 1,
                              backgroundColor: row.color.fill,
                              border: `1px solid ${row.color.stroke}`,
                              marginTop: 1.2,
                              marginRight: 4,
                            }}
                          />
                          <Text style={{ flex: 1, fontSize: 6.7 }}>
                            {row.farmName} / {row.plotName} - {formatHectares(row.hectares)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
                <Text style={{ fontSize: 8, fontWeight: 700, marginTop: 4 }}>TOTAL GERAL: {formatHectares(totalHectares)}</Text>
              </View>

              <View
                style={{
                  position: 'absolute',
                  right: 12,
                  bottom: 10,
                  alignItems: 'flex-end',
                }}
              >
                <Text style={{ fontSize: 7, color: MUTED_TEXT }}>ESCALA VISUAL</Text>
                <View style={{ marginTop: 2, width: scaleBarWidthPx, height: 2.4, backgroundColor: '#111827' }} />
                <Text style={{ marginTop: 2, fontSize: 7.4, fontWeight: 700 }}>{estimatedScaleKm.toFixed(2).replace('.', ',')} km</Text>
                <Image
                  src='/images/pdf-logo-only.png'
                  style={{ marginTop: 6, width: 94, height: 24, objectFit: 'contain' }}
                />
              </View>
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

