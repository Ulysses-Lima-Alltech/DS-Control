import type { Feature, FeatureCollection, GeoJSON, MultiPolygon, Polygon, Position } from 'geojson';

import type { Plot } from '@/types/plot.type';
import type { ServiceOrder } from '@/types/service-order.type';

import { resolveFarmMapColor } from './farm-map-color';

export type StrategicMapScope = 'completed' | 'pending';
export type StrategicMapDerivedStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
export type StrategicMapDrawableGeometry = Polygon | MultiPolygon;
export type StrategicMapBounds = [[number, number], [number, number]];

export type StrategicMapFarmLegendItem = {
  key: string;
  name: string;
  fill: string;
};

export type StrategicMapData = {
  plots: Plot[];
  featureCollection: FeatureCollection<StrategicMapDrawableGeometry>;
  farms: StrategicMapFarmLegendItem[];
  bounds: StrategicMapBounds | null;
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
  const farmById = new Map((serviceOrder.farms || []).map((farm) => [farm.id, farm]));
  const farmKeys: string[] = [];
  const drafts: Array<{ feature: Feature<StrategicMapDrawableGeometry>; farmKey: string }> = [];

  plots.forEach((plot) => {
    const farmKey = plot.farmId || 'farm-unknown';
    const parsed = parsePlotGeoJson(plot.geoJson);
    if (!parsed) return;

    parsed.features.forEach((feature) => {
      if (!isDrawableGeometry(feature.geometry)) return;
      if (!farmKeys.includes(farmKey)) farmKeys.push(farmKey);
      const hectares = parseNumber(plot.hectare);
      drafts.push({
        farmKey,
        feature: {
          type: 'Feature',
          geometry: feature.geometry,
          properties: {
            ...(feature.properties || {}),
            plot_id: plot.id || plot.externalId,
            plot_name: plot.name || 'Talhão sem nome',
            hectare_label: `${formatNumber(hectares)} ha`,
            farm_key: farmKey,
          },
        },
      });
    });
  });

  const colorByFarm = new Map(
    farmKeys.map((farmKey) => [
      farmKey,
      resolveFarmMapColor(farmById.get(farmKey) ?? { id: farmKey }),
    ])
  );
  const featureCollection: FeatureCollection<StrategicMapDrawableGeometry> = {
    type: 'FeatureCollection',
    features: drafts.map(({ feature, farmKey }) => ({
      ...feature,
      properties: { ...feature.properties, fill: colorByFarm.get(farmKey) || '#3388ff' },
    })),
  };

  return {
    plots,
    featureCollection,
    farms: farmKeys.map((key) => ({
      key,
      name: farmById.get(key)?.name || 'Fazenda não informada',
      fill: colorByFarm.get(key) || '#3388ff',
    })),
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
