import type { Farm } from '@/types/farm.type';
import type { Plot } from '@/types/plot.type';
import { deriveFarmStrokeColor, resolveFarmMapColor } from '@/utils/farm-map-color';
import { fetchRemoteImageAsDataUrl } from '@/utils/fetchRemoteImageAsDataUrl';
import {
  buildReportMapboxStaticUrl,
  getReportPaddedBoundsForPlot,
  type ReportPaddedBoundsWorld,
} from '@/utils/mapboxStaticReportMap';
import { buildPlotPolygonSvgPathDs } from '@/utils/reportPlotPolygonSvg';
import {
  buildStrategicMapProjection,
  extractPlotPolygons,
  sanitizeStrategicPolygons,
} from '@/utils/strategicReportMap2d';

export type ReportMapAssetStatus = 'mapbox' | 'vector-only' | 'unavailable';

export type ReportMapAsset = {
  plotId: string;
  farmId?: string;
  plot: Plot;
  imageDataUrl?: string;
  overlayPathDs: string[];
  vectorPathD?: string;
  bounds?: ReportPaddedBoundsWorld;
  fillColor: string;
  strokeColor: string;
  status: ReportMapAssetStatus;
  message?: string;
  errorCode?: string;
};

export type ReportMapPlotInput = {
  plot: Plot;
  farm?: Pick<Farm, 'id' | 'mapColor'> | null;
};

export type ReportMapAssetDiagnostic = {
  plotId: string;
  status: ReportMapAssetStatus;
  errorCode?: string;
};

export type ReportMapAssetBatch = {
  assets: ReportMapAsset[];
  byPlotId: Record<string, ReportMapAsset>;
  stats: {
    requested: number;
    distinctPlots: number;
    mapbox: number;
    vectorOnly: number;
    unavailable: number;
  };
};

export const REPORT_MAP_PROGRESS_EVENT = 'icontrol:report-map-progress';
export type ReportMapProgress = { completed: number; total: number };
export const REPORT_MAP_POLICY = {
  applicationIndividual: true,
  serviceOrderApplications: true,
  completedPlots: true,
  pendingPlots: true,
  serviceOrdersDetailed: true,
  farms: true,
  general: true,
  pilot: false,
  assistant: false,
  strategic: 'existing',
} as const;

export type BuildReportMapAssetsOptions = {
  accessToken?: string;
  width?: number;
  height?: number;
  concurrency?: number;
  timeoutMs?: number;
  retries?: number;
  signal?: AbortSignal;
  onDiagnostic?: (diagnostic: ReportMapAssetDiagnostic) => void;
};

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 480;

export async function buildReportMapAssets(
  inputs: ReportMapPlotInput[],
  options: BuildReportMapAssetsOptions = {}
): Promise<ReportMapAssetBatch> {
  const width = options.width ?? DEFAULT_WIDTH;
  const height = options.height ?? DEFAULT_HEIGHT;
  const distinct = deduplicatePlotInputs(inputs);
  const cache = new Map<string, Promise<ReportMapAsset>>();
  const assets = new Array<ReportMapAsset>(distinct.length);
  let cursor = 0;
  let completedCount = 0;
  emitProgress({ completed: 0, total: distinct.length });

  const worker = async () => {
    while (cursor < distinct.length) {
      if (options.signal?.aborted) break;
      const index = cursor;
      cursor += 1;
      const input = distinct[index];
      const cacheKey = buildCacheKey(input, width, height);
      let pending = cache.get(cacheKey);
      if (!pending) {
        pending = buildSingleAsset(input, { ...options, width, height });
        cache.set(cacheKey, pending);
      }
      const asset = await pending;
      assets[index] = asset;
      completedCount += 1;
      emitProgress({ completed: completedCount, total: distinct.length });
      options.onDiagnostic?.({
        plotId: asset.plotId,
        status: asset.status,
        errorCode: asset.errorCode,
      });
    }
  };

  const concurrency = Math.max(1, Math.min(options.concurrency ?? 3, distinct.length || 1));
  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  const completed = assets.filter((asset): asset is ReportMapAsset => Boolean(asset));
  return {
    assets: completed,
    byPlotId: Object.fromEntries(completed.map((asset) => [asset.plotId, asset])),
    stats: {
      requested: inputs.length,
      distinctPlots: completed.length,
      mapbox: completed.filter((asset) => asset.status === 'mapbox').length,
      vectorOnly: completed.filter((asset) => asset.status === 'vector-only').length,
      unavailable: completed.filter((asset) => asset.status === 'unavailable').length,
    },
  };
}

function emitProgress(progress: ReportMapProgress): void {
  if (typeof window === 'undefined' || typeof CustomEvent === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<ReportMapProgress>(REPORT_MAP_PROGRESS_EVENT, { detail: progress })
  );
}

async function buildSingleAsset(
  input: ReportMapPlotInput,
  options: BuildReportMapAssetsOptions & { width: number; height: number }
): Promise<ReportMapAsset> {
  const plotId = input.plot.id || `plot-${hashText(JSON.stringify(input.plot.geoJson ?? null))}`;
  const farmSource = input.farm ?? { id: input.plot.farmId || 'farm-unknown' };
  const fillColor = resolveFarmMapColor(farmSource);
  const strokeColor = deriveFarmStrokeColor(fillColor);
  const polygons = sanitizeStrategicPolygons(extractPlotPolygons(input.plot));

  if (polygons.length === 0) {
    return {
      plotId,
      farmId: input.plot.farmId,
      plot: input.plot,
      overlayPathDs: [],
      fillColor,
      strokeColor,
      status: 'unavailable',
      message: 'Geometria do talhão indisponível.',
      errorCode: 'geometry_unavailable',
    };
  }

  const projection = buildStrategicMapProjection(
    [
      {
        id: plotId,
        label: input.plot.name || `Talhão ${plotId}`,
        farmKey: input.plot.farmId || 'farm-unknown',
        polygons,
      },
    ],
    options.width,
    options.height,
    12
  );
  const vectorPathD = projection?.shapes[0]?.pathD;
  const overlayPathDs = safeOverlayPaths(input.plot, options.width, options.height);
  const bounds = getReportPaddedBoundsForPlot(
    input.plot,
    0.1,
    options.width / options.height
  );
  const mapResult = buildReportMapboxStaticUrl({
    plot: input.plot,
    mapWidth: options.width,
    mapHeight: options.height,
    accessToken: options.accessToken,
  });

  if (mapResult.url) {
    const imageDataUrl = await fetchRemoteImageAsDataUrl(mapResult.url, {
      timeoutMs: options.timeoutMs ?? 8_000,
      retries: options.retries ?? 1,
      signal: options.signal,
    });
    if (imageDataUrl) {
      return {
        plotId,
        farmId: input.plot.farmId,
        plot: input.plot,
        imageDataUrl,
        overlayPathDs,
        vectorPathD,
        bounds: bounds ?? undefined,
        fillColor,
        strokeColor,
        status: 'mapbox',
      };
    }
  }

  return {
    plotId,
    farmId: input.plot.farmId,
    plot: input.plot,
    overlayPathDs,
    vectorPathD,
    bounds: bounds ?? undefined,
    fillColor,
    strokeColor,
    status: vectorPathD ? 'vector-only' : 'unavailable',
    message: vectorPathD
      ? 'Mapa base indisponível — limite do talhão exibido.'
      : 'Geometria do talhão indisponível.',
    errorCode: mapResult.unavailableReason ?? 'mapbox_fetch_failed',
  };
}

function deduplicatePlotInputs(inputs: ReportMapPlotInput[]): ReportMapPlotInput[] {
  const byId = new Map<string, ReportMapPlotInput>();
  for (const input of inputs) {
    const id = input.plot.id || `plot-${hashText(JSON.stringify(input.plot.geoJson ?? null))}`;
    const current = byId.get(id);
    if (!current || (!current.plot.geoJson && input.plot.geoJson)) byId.set(id, input);
  }
  return Array.from(byId.values());
}

function buildCacheKey(input: ReportMapPlotInput, width: number, height: number): string {
  const plotId = input.plot.id || 'plot-without-id';
  const color = resolveFarmMapColor(input.farm ?? { id: input.plot.farmId || 'farm-unknown' });
  const geometryHash = hashText(JSON.stringify(input.plot.geoJson ?? null));
  return `${plotId}:${geometryHash}:${color}:${width}x${height}:p10`;
}

function safeOverlayPaths(plot: Plot, width: number, height: number): string[] {
  try {
    return buildPlotPolygonSvgPathDs(plot, width, height) ?? [];
  } catch {
    return [];
  }
}

function hashText(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
