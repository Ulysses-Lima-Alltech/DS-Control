import type { Feature, FeatureCollection, GeoJSON, MultiPolygon, Polygon, Position } from 'geojson';

import type { Plot } from '@/types/plot.type';
import type { ServiceOrder } from '@/types/service-order.type';

import { buildStrategicFarmColorMap } from './strategicReportPalette';

export type StrategicMapScope = 'completed' | 'pending' | 'all';
export type StrategicMapDerivedStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
export type StrategicMapDrawableGeometry = Polygon | MultiPolygon;
export type StrategicMapBounds = [[number, number], [number, number]];

export type StrategicMapFarmLegendItem = {
  key: string;
  name: string;
  hectares: number;
  fill: string;
  stroke: string;
  fillOpacity: number;
};

export type StrategicMapData = {
  plots: Plot[];
  featureCollection: FeatureCollection<StrategicMapDrawableGeometry>;
  legendItems: StrategicMapFarmLegendItem[];
  totalHectares: number;
  drawablePlotCount: number;
  bounds: StrategicMapBounds | null;
};

export const STRATEGIC_MAP_FILL_OPACITY = 0.82;

export function parseStrategicMapScope(value: string | null | undefined): StrategicMapScope | null {
  return value === 'completed' || value === 'pending' || value === 'all' ? value : null;
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
    if (scope === 'all') return status !== null;
    if (scope === 'completed') return status === 'COMPLETED';
    return status === 'PENDING' || status === 'IN_PROGRESS';
  });
}

export function scopeStrategicMapServiceOrder(
  serviceOrder: ServiceOrder,
  scope: StrategicMapScope
): ServiceOrder {
  return { ...serviceOrder, plots: filterStrategicMapPlots(serviceOrder.plots, scope) };
}

export function getStrategicMapScopeLabel(scope: StrategicMapScope): string {
  if (scope === 'completed') return 'ÁREAS CONCLUÍDAS';
  if (scope === 'pending') return 'ÁREAS PENDENTES E EM ANDAMENTO';
  return 'TODAS AS ÁREAS';
}

export function getStrategicMapDownloadLabel(scope: StrategicMapScope): string {
  if (scope === 'completed') return 'Baixar áreas concluídas';
  if (scope === 'pending') return 'Baixar áreas pendentes';
  return 'Baixar mapa completo';
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
  const scopeSuffix =
    scope === 'completed' ? 'concluidos' : scope === 'pending' ? 'pendentes' : 'completo';
  return `mapa-estrategico-os-${safeNumber}-${scopeSuffix}.pdf`;
}

export function buildStrategicMapData(
  serviceOrder: ServiceOrder,
  scope: StrategicMapScope
): StrategicMapData {
  const plots = filterStrategicMapPlots(serviceOrder.plots, scope);
  const farmById = new Map((serviceOrder.farms || []).map((farm) => [farm.id, farm]));
  const drafts: Array<{
    feature: Feature<StrategicMapDrawableGeometry>;
    farmKey: string;
  }> = [];
  const drawablePlotKeys = new Set<string>();
  const drawableFarms = new Map<string, { name: string; hectares: number }>();

  plots.forEach((plot) => {
    const status = resolveStrategicMapPlotStatus(plot);
    if (!status) return;

    const plotKey = plot.id || plot.externalId;
    const farmKey = plot.farmId || 'farm-unknown';
    const parsed = parsePlotGeoJson(plot.geoJson);
    if (!parsed) return;

    const drawableFeatures = parsed.features.filter((feature) =>
      isDrawableGeometry(feature.geometry)
    );
    if (drawableFeatures.length === 0) return;

    const hectares = parseNumber(plot.hectare);
    drawablePlotKeys.add(plotKey);
    const currentFarm = drawableFarms.get(farmKey);
    drawableFarms.set(farmKey, {
      name: farmById.get(farmKey)?.name || 'Fazenda não informada',
      hectares: (currentFarm?.hectares || 0) + hectares,
    });

    drawableFeatures.forEach((feature) => {
      drafts.push({
        farmKey,
        feature: {
          type: 'Feature',
          geometry: feature.geometry as StrategicMapDrawableGeometry,
          properties: {
            ...(feature.properties || {}),
            plot_id: plotKey,
            plot_name: plot.name || 'Talhão sem nome',
            hectare_label: `${formatNumber(hectares)} ha`,
            farm_key: farmKey,
            derived_status: status,
          },
        },
      });
    });
  });

  const colorByFarm = buildStrategicFarmColorMap(
    Array.from(drawableFarms.keys()).map((farmKey) => farmById.get(farmKey) || { id: farmKey })
  );
  const featureCollection: FeatureCollection<StrategicMapDrawableGeometry> = {
    type: 'FeatureCollection',
    features: drafts.map(({ feature, farmKey }) => ({
      ...feature,
      properties: {
        ...feature.properties,
        fill: colorByFarm.get(farmKey)?.fill || '#3388ff',
        fill_opacity: STRATEGIC_MAP_FILL_OPACITY,
      },
    })),
  };

  return {
    plots,
    featureCollection,
    legendItems: Array.from(drawableFarms, ([key, farm]) => ({
      key,
      name: farm.name,
      hectares: farm.hectares,
      fill: colorByFarm.get(key)?.fill || '#3388ff',
      stroke: colorByFarm.get(key)?.stroke || '#1D4ED8',
      fillOpacity: STRATEGIC_MAP_FILL_OPACITY,
    })).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true })),
    totalHectares: Array.from(drawableFarms.values()).reduce((sum, farm) => sum + farm.hectares, 0),
    drawablePlotCount: drawablePlotKeys.size,
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
