import type { Feature, FeatureCollection, GeoJSON, MultiPolygon, Polygon, Position } from 'geojson';

import type { Plot } from '@/types/plot.type';
import type { ServiceOrder } from '@/types/service-order.type';

import { buildStrategicPlotColorMap } from './strategicReportPalette';

export type StrategicMapScope = 'completed' | 'pending';
export type StrategicMapDerivedStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
export type StrategicMapDrawableGeometry = Polygon | MultiPolygon;
export type StrategicMapBounds = [[number, number], [number, number]];

export type StrategicMapPlotLegendItem = {
  key: string;
  name: string;
  hectares: number;
  fill: string;
  status: StrategicMapDerivedStatus;
  fillOpacity: number;
};

export type StrategicMapData = {
  plots: Plot[];
  featureCollection: FeatureCollection<StrategicMapDrawableGeometry>;
  legendItems: StrategicMapPlotLegendItem[];
  bounds: StrategicMapBounds | null;
};

export const STRATEGIC_MAP_STATUS_FILL_OPACITY: Record<StrategicMapDerivedStatus, number> = {
  COMPLETED: 0.88,
  IN_PROGRESS: 0.64,
  PENDING: 0.36,
};

export function parseStrategicMapScope(value: string | null | undefined): StrategicMapScope | null {
  return value === 'completed' || value === 'pending' ? value : null;
}

export function resolveStrategicMapPlotStatus(plot: Plot): StrategicMapDerivedStatus | null {
  if (plot.deletedAt || plot.status === 'CANCELLED') return null;
  if (plot.derivedStatus) return plot.derivedStatus;
  if (plot.status === 'COMPLETED') return 'COMPLETED';
  if (plot.status === 'PENDING') return 'PENDING';
  return null;
}

export function filterStrategicMapPlots(
  plots: Plot[] | null | undefined,
  scope: StrategicMapScope
): Plot[] {
  return (plots || []).filter((plot) => {
    const status = resolveStrategicMapPlotStatus(plot);
    return scope === 'completed'
      ? status === 'COMPLETED'
      : status === 'PENDING' || status === 'IN_PROGRESS';
  });
}

export function scopeStrategicMapServiceOrder(
  serviceOrder: ServiceOrder,
  scope: StrategicMapScope
): ServiceOrder {
  return { ...serviceOrder, plots: filterStrategicMapPlots(serviceOrder.plots, scope) };
}

export function getStrategicMapScopeLabel(scope: StrategicMapScope): string {
  return scope === 'completed' ? 'ÁREAS CONCLUÍDAS' : 'ÁREAS PENDENTES E EM ANDAMENTO';
}

export function getStrategicMapDownloadLabel(scope: StrategicMapScope): string {
  return scope === 'completed' ? 'Baixar áreas concluídas' : 'Baixar áreas pendentes';
}

export function getStrategicMapPlotStatusLabel(status: StrategicMapDerivedStatus): string {
  if (status === 'COMPLETED') return 'Concluído';
  if (status === 'IN_PROGRESS') return 'Em andamento';
  return 'Pendente / Programado';
}

export function buildStrategicMapFilename(
  serviceOrderNumber: string | number,
  scope: StrategicMapScope
): string {
  const safeNumber =
    String(serviceOrderNumber)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'os';
  return `mapa-estrategico-os-${safeNumber}-${scope === 'completed' ? 'concluidos' : 'pendentes'}.pdf`;
}

export function buildStrategicMapData(
  serviceOrder: ServiceOrder,
  scope: StrategicMapScope
): StrategicMapData {
  const plots = filterStrategicMapPlots(serviceOrder.plots, scope);
  const drafts: Array<{
    feature: Feature<StrategicMapDrawableGeometry>;
    plotKey: string;
  }> = [];
  const drawablePlots = new Map<
    string,
    { name: string; hectares: number; status: StrategicMapDerivedStatus }
  >();

  plots.forEach((plot) => {
    const status = resolveStrategicMapPlotStatus(plot);
    if (!status) return;

    const plotKey = plot.id || plot.externalId;
    const parsed = parsePlotGeoJson(plot.geoJson);
    if (!parsed) return;

    const drawableFeatures = parsed.features.filter((feature) =>
      isDrawableGeometry(feature.geometry)
    );
    if (drawableFeatures.length === 0) return;

    const hectares = parseNumber(plot.hectare);
    drawablePlots.set(plotKey, {
      name: plot.name || 'Talhão sem nome',
      hectares,
      status,
    });

    drawableFeatures.forEach((feature) => {
      drafts.push({
        plotKey,
        feature: {
          type: 'Feature',
          geometry: feature.geometry as StrategicMapDrawableGeometry,
          properties: {
            ...(feature.properties || {}),
            plot_id: plotKey,
            plot_name: plot.name || 'Talhão sem nome',
            hectare_label: `${formatNumber(hectares)} ha`,
            farm_key: plot.farmId || 'farm-unknown',
            derived_status: status,
          },
        },
      });
    });
  });

  const colorByPlot = buildStrategicPlotColorMap(Array.from(drawablePlots.keys()));
  const featureCollection: FeatureCollection<StrategicMapDrawableGeometry> = {
    type: 'FeatureCollection',
    features: drafts.map(({ feature, plotKey }) => ({
      ...feature,
      properties: {
        ...feature.properties,
        fill: colorByPlot.get(plotKey)?.fill || '#3388ff',
        fill_opacity:
          STRATEGIC_MAP_STATUS_FILL_OPACITY[drawablePlots.get(plotKey)?.status || 'PENDING'],
      },
    })),
  };

  return {
    plots,
    featureCollection,
    legendItems: Array.from(drawablePlots, ([key, plot]) => ({
      key,
      name: plot.name,
      hectares: plot.hectares,
      fill: colorByPlot.get(key)?.fill || '#3388ff',
      status: plot.status,
      fillOpacity: STRATEGIC_MAP_STATUS_FILL_OPACITY[plot.status],
    })).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true })),
    bounds: getStrategicMapBounds(featureCollection),
  };
}

function parsePlotGeoJson(value: unknown): FeatureCollection | null {
  if (!value) return null;
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const geoJson = parsed as GeoJSON;
  if (geoJson.type === 'FeatureCollection' && Array.isArray(geoJson.features)) return geoJson;
  if (geoJson.type === 'Feature') return { type: 'FeatureCollection', features: [geoJson] };
  if (geoJson.type === 'Polygon' || geoJson.type === 'MultiPolygon') {
    return {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: {}, geometry: geoJson }],
    };
  }
  return null;
}

function isDrawableGeometry(
  geometry: GeoJSON.Geometry | null | undefined
): geometry is StrategicMapDrawableGeometry {
  return geometry?.type === 'Polygon' || geometry?.type === 'MultiPolygon';
}

function getStrategicMapBounds(
  collection: FeatureCollection<StrategicMapDrawableGeometry>
): StrategicMapBounds | null {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  collection.features
    .flatMap((feature) => collectPositions(feature.geometry))
    .forEach(([lng, lat]) => {
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
      minLng = Math.min(minLng, lng);
      minLat = Math.min(minLat, lat);
      maxLng = Math.max(maxLng, lng);
      maxLat = Math.max(maxLat, lat);
    });
  return [minLng, minLat, maxLng, maxLat].every(Number.isFinite)
    ? [
        [minLng, minLat],
        [maxLng, maxLat],
      ]
    : null;
}

function collectPositions(geometry: StrategicMapDrawableGeometry): Position[] {
  return geometry.type === 'Polygon' ? geometry.coordinates.flat() : geometry.coordinates.flat(2);
}

function parseNumber(value: unknown): number {
  const number =
    typeof value === 'number' ? value : Number.parseFloat(String(value || '0').replace(',', '.'));
  return Number.isFinite(number) ? number : 0;
}

function formatNumber(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
