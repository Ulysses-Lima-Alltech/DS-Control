import { Document, Font, Image, Page, Path, Svg, Text, View } from '@react-pdf/renderer';
import React from 'react';

import type { Application } from '@/types/applications.type';
import type { ServiceOrder } from '@/types/service-order.type';
import { OPERATIONAL_TIME_ZONE } from '@/utils/operational-date';
import {
  buildStrategicFarmColorMap,
  type StrategicFarmColor,
} from '@/utils/strategicReportPalette';
import {
  buildStrategicMapViewport,
  extractPlotPolygons,
  sanitizeStrategicPolygons,
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

const PAGE_PADDING = 10;
const HEADER_HEIGHT = 42;
const MAP_LOGICAL_WIDTH = 1200;
const MAP_LOGICAL_HEIGHT = 760;
const MAP_VIEWPORT_PADDING = 48;
const MAP_VIEWPORT_PADDING_SCALE = 1.2;
const LEGEND_MAX_ROWS = 10;

const BRAND_YELLOW = '#EAAE07';
const DARK_TEXT = '#0F172A';
const MUTED_TEXT = '#6B7280';
const LIGHT_BORDER = '#E5E7EB';

interface ServiceOrderStrategicReportPDFProps {
  serviceOrder: ServiceOrder;
  applications: Application[];
  prefetchedMapBaseDataUrl?: string | null;
  prefetchedMapImageDataUrl?: string | null;
  mapViewport?: StrategicMapViewport | null;
  farmColorMap?: Map<string, StrategicFarmColor>;
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
  return `${value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ha`;
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
  prefetchedMapImageDataUrl = null,
  mapViewport = null,
  farmColorMap,
}) => {
  const generatedAt = formatGeneratedAt();
  const plotRows = (serviceOrder.plots || [])
    .map((plot) => {
      if (!plot.id) return null;
      const farmName =
        serviceOrder.farms?.find((farm) => farm.id === plot.farmId)?.name ||
        'Fazenda nao informada';

      return {
        plotId: plot.id,
        plotName: plot.name || `Talhao ${plot.id}`,
        farmId: plot.farmId || 'farm-unknown',
        farmName,
        hectares: parseNumber(plot.hectare),
        polygons: sanitizeStrategicPolygons(extractPlotPolygons(plot)),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => {
      const byFarm = a.farmName.localeCompare(b.farmName, 'pt-BR');
      return byFarm !== 0 ? byFarm : a.plotName.localeCompare(b.plotName, 'pt-BR');
    });

  const validPlotRows = plotRows.filter((row) => row.polygons.length > 0);
  const invalidPlotRows = plotRows.filter((row) => row.polygons.length === 0);

  const shapesInput: StrategicMapShapeInput[] = validPlotRows.map((row) => ({
    id: row.plotId,
    label: row.plotName,
    farmKey: row.farmId,
    polygons: row.polygons,
  }));

  const viewport =
    mapViewport ||
    buildStrategicMapViewport(
      shapesInput,
      MAP_LOGICAL_WIDTH,
      MAP_LOGICAL_HEIGHT,
      MAP_VIEWPORT_PADDING,
      {
        paddingScale: MAP_VIEWPORT_PADDING_SCALE,
        minPaddingPx: 2,
        maxPaddingRatio: 0.14,
      }
    );

  const derivedFarmColorMap =
    farmColorMap && farmColorMap.size > 0
      ? farmColorMap
      : buildStrategicFarmColorMap(Array.from(new Set(plotRows.map((row) => row.farmId))));

  const appliedPlotIds = new Set(
    applications
      .filter((application) => application.serviceOrderId === serviceOrder.id)
      .map((application) => application.plotId)
      .filter((plotId): plotId is string => Boolean(plotId))
  );

  const legendFarmMap = new Map<
    string,
    {
      farmId: string;
      farmName: string;
      hectares: number;
      appliedCount: number;
      totalCount: number;
      color: StrategicFarmColor;
    }
  >();

  validPlotRows.forEach((row) => {
    const existing = legendFarmMap.get(row.farmId);
    const color = derivedFarmColorMap.get(row.farmId) || {
      fill: '#CBD5E1',
      stroke: '#64748B',
    };
    const isApplied = appliedPlotIds.has(row.plotId);

    if (existing) {
      existing.hectares += row.hectares;
      existing.totalCount += 1;
      if (isApplied) existing.appliedCount += 1;
      return;
    }

    legendFarmMap.set(row.farmId, {
      farmId: row.farmId,
      farmName: row.farmName,
      hectares: row.hectares,
      appliedCount: isApplied ? 1 : 0,
      totalCount: 1,
      color,
    });
  });

  const legendFarmRows = Array.from(legendFarmMap.values()).sort((a, b) =>
    a.farmName.localeCompare(b.farmName, 'pt-BR')
  );
  const totalValidHectares = legendFarmRows.reduce((sum, row) => sum + row.hectares, 0);

  const customerName = serviceOrder.customer?.name || 'CLIENTE';
  const observationTitle = (serviceOrder.observation || 'PROGRAMACAO').toUpperCase();
  const title = `${customerName.toUpperCase()} - MAPA ESTRATEGICO - ${observationTitle}`;

  const scaleBarWidthPx = 116;
  const estimatedScaleKm = viewport
    ? (() => {
        const lngSpan = viewport.bounds.maxLng - viewport.bounds.minLng;
        const midLatRad =
          ((viewport.bounds.minLat + viewport.bounds.maxLat) / 2) * (Math.PI / 180);
        const widthKm = Math.abs(lngSpan * 111.32 * Math.cos(midLatRad));
        const scaleKm = (widthKm * scaleBarWidthPx) / MAP_LOGICAL_WIDTH;
        return Math.max(0.1, Number(scaleKm.toFixed(2)));
      })()
    : 0.5;

  const mapImageSrc = prefetchedMapImageDataUrl || prefetchedMapBaseDataUrl;
  const hasMap = Boolean(mapImageSrc);

  return (
    <Document>
      <Page
        size='A4'
        orientation='landscape'
        style={{
          backgroundColor: '#FFFFFF',
          fontFamily: 'Roboto',
          fontSize: 9,
          color: DARK_TEXT,
          padding: PAGE_PADDING,
        }}
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
            <Text style={{ fontSize: 7.2, color: MUTED_TEXT }}>OS</Text>
            <Text style={{ fontSize: 12, fontWeight: 700 }}>#{serviceOrder.number || '-'}</Text>
          </View>

          <View style={{ flex: 1, paddingHorizontal: 8 }}>
            <Text style={{ textAlign: 'center', fontSize: 15, fontWeight: 700 }}>{title}</Text>
          </View>

          <View style={{ width: 182, alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 6.8, color: MUTED_TEXT }}>Gerado em</Text>
            <Text style={{ fontSize: 8.2, fontWeight: 700 }}>{generatedAt}</Text>
          </View>
        </View>

        <View
          style={{
            flex: 1,
            position: 'relative',
            border: `1px solid ${LIGHT_BORDER}`,
            overflow: 'hidden',
            backgroundColor: '#F8FAFC',
          }}
        >
          {hasMap ? (
            <Image
              src={mapImageSrc!}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          ) : null}

          <View
            style={{
              position: 'absolute',
              left: 10,
              top: 10,
              width: 40,
              height: 56,
              border: `1px solid ${LIGHT_BORDER}`,
              backgroundColor: '#FFFFFFEB',
              borderRadius: 3,
              alignItems: 'center',
              justifyContent: 'center',
              paddingTop: 2,
            }}
          >
            <Text style={{ fontSize: 6.2, fontWeight: 700, marginBottom: 1 }}>N</Text>
            <Svg width='22' height='22' viewBox='0 0 24 24'>
              <Path d='M 12 1 L 14.6 9 L 12 7.2 L 9.4 9 Z' fill='#111827' />
              <Path d='M 12 23 L 10.5 16.5 L 12 17.4 L 13.5 16.5 Z' fill='#6B7280' />
              <Path d='M 1 12 L 7.8 10.7 L 7 12 L 7.8 13.3 Z' fill='#6B7280' />
              <Path d='M 23 12 L 16.2 13.3 L 17 12 L 16.2 10.7 Z' fill='#6B7280' />
            </Svg>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                width: 24,
                marginTop: 1,
              }}
            >
              <Text style={{ fontSize: 5.4, fontWeight: 700 }}>W</Text>
              <Text style={{ fontSize: 5.4, fontWeight: 700 }}>E</Text>
            </View>
            <Text style={{ fontSize: 5.4, fontWeight: 700, marginTop: 1 }}>S</Text>
          </View>

          <View
            style={{
              position: 'absolute',
              left: 10,
              bottom: 10,
              width: 344,
              maxHeight: 136,
              border: `1px solid ${LIGHT_BORDER}`,
              borderRadius: 4,
              backgroundColor: '#FFFFFFEB',
              paddingHorizontal: 6,
              paddingVertical: 5,
            }}
          >
            <Text style={{ fontSize: 8, fontWeight: 700, marginBottom: 2 }}>LEGENDA</Text>
            {legendFarmRows.slice(0, LEGEND_MAX_ROWS).map((farm) => (
              <View
                key={farm.farmId}
                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 1.8 }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 1,
                    backgroundColor: farm.color.fill,
                    border: `1px solid ${farm.color.stroke}`,
                    marginRight: 4,
                  }}
                />
                <Text style={{ flex: 1, fontSize: 6.7 }}>
                  {farm.farmName.toUpperCase()} ({formatHectares(farm.hectares)})
                </Text>
              </View>
            ))}
            {legendFarmRows.length > LEGEND_MAX_ROWS ? (
              <Text style={{ fontSize: 6.2, color: MUTED_TEXT }}>
                + {legendFarmRows.length - LEGEND_MAX_ROWS} grupo(s)
              </Text>
            ) : null}
            <Text style={{ fontSize: 7.6, fontWeight: 700, marginTop: 2 }}>
              TOTAL: {formatHectares(totalValidHectares).toUpperCase()}
            </Text>
            {invalidPlotRows.length > 0 ? (
              <Text style={{ fontSize: 6.1, color: MUTED_TEXT, marginTop: 1 }}>
                Talhoes sem geometria valida: {invalidPlotRows.length}
              </Text>
            ) : null}
          </View>

          <View
            style={{
              position: 'absolute',
              bottom: 9,
              left: 0,
              right: 0,
              alignItems: 'center',
            }}
          >
            <View
              style={{
                border: `1px solid ${LIGHT_BORDER}`,
                borderRadius: 3,
                backgroundColor: '#FFFFFFE8',
                paddingHorizontal: 8,
                paddingVertical: 4,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 6.1, color: MUTED_TEXT }}>ESCALA VISUAL</Text>
              <View style={{ marginTop: 2, width: scaleBarWidthPx, height: 2.4, backgroundColor: '#111827' }} />
              <Text style={{ marginTop: 2, fontSize: 7, fontWeight: 700 }}>
                {estimatedScaleKm.toFixed(2).replace('.', ',')} km
              </Text>
            </View>
          </View>

          <View
            style={{
              position: 'absolute',
              right: 10,
              bottom: 8,
              width: 106,
              height: 30,
              border: `1px solid ${LIGHT_BORDER}`,
              borderRadius: 3,
              backgroundColor: '#FFFFFFEB',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Image src='/images/pdf-logo-only.png' style={{ width: 90, height: 22, objectFit: 'contain' }} />
          </View>

          {!hasMap ? (
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 24,
              }}
            >
              <Text style={{ fontSize: 11, color: MUTED_TEXT, textAlign: 'center' }}>
                Nao foi possivel montar a imagem do mapa estrategico para esta OS.
              </Text>
              <Text style={{ marginTop: 6, fontSize: 7.5, color: MUTED_TEXT }}>
                Talhoes validos: {validPlotRows.length} | Talhoes sem geometria: {invalidPlotRows.length}
              </Text>
            </View>
          ) : null}
        </View>
      </Page>
    </Document>
  );
};

export default ServiceOrderStrategicReportPDF;
