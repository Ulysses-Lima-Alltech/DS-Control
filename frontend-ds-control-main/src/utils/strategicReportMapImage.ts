import { fetchRemoteImageAsDataUrl } from '@/utils/fetchRemoteImageAsDataUrl';
import {
  buildStrategicMapProjectionFromViewport,
  type StrategicMapShapeInput,
  type StrategicMapViewport,
} from '@/utils/strategicReportMap2d';

type FarmColor = {
  fill: string;
  stroke: string;
};

export type StrategicPlotRenderMeta = {
  plotId: string;
  label: string;
  areaHa: number;
  isApplied: boolean;
};

export type GenerateStrategicMapImageParams = {
  shapes: StrategicMapShapeInput[];
  viewport: StrategicMapViewport;
  mapBaseUrl?: string | null;
  mapBaseDataUrl?: string | null;
  logicalWidth: number;
  logicalHeight: number;
  pixelRatio?: 1 | 2;
  farmColorMap: Map<string, FarmColor>;
  plotMetaMap: Map<string, StrategicPlotRenderMeta>;
};

export type GenerateStrategicMapImageResult = {
  mapImageDataUrl: string | null;
  mapBaseDataUrl: string | null;
  renderedWidth: number;
  renderedHeight: number;
};

const STRATEGIC_MAP_IMAGE_DEBUG = '[StrategicMapImage]';
const DEFAULT_FILL = '#F3F4F6';
const DEFAULT_STROKE = '#334155';

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function formatHectares(value: number): string {
  return `${value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ha`;
}

function compactPlotLabel(label: string): string {
  const normalized = label.trim().toUpperCase().replace(/\s+/g, ' ');
  if (!normalized) return 'TALHAO';
  if (normalized.length <= 22) return normalized;

  const tokens = normalized.split(' ');
  if (tokens.length >= 2) {
    return `${tokens[0]} ${tokens[1]}`.slice(0, 22);
  }
  return normalized.slice(0, 22);
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '').trim();
  if (!/^[\da-fA-F]{3,8}$/.test(normalized)) {
    return `rgba(148, 163, 184, ${alpha})`;
  }

  if (normalized.length === 3) {
    const r = Number.parseInt(normalized[0] + normalized[0], 16);
    const g = Number.parseInt(normalized[1] + normalized[1], 16);
    const b = Number.parseInt(normalized[2] + normalized[2], 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  const base = normalized.slice(0, 6);
  const r = Number.parseInt(base.slice(0, 2), 16);
  const g = Number.parseInt(base.slice(2, 4), 16);
  const b = Number.parseInt(base.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  if (!src || typeof Image === 'undefined') {
    return null;
  }

  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function createCanvas(width: number, height: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function drawShape(
  context: CanvasRenderingContext2D,
  projectedPolygons: Array<Array<Array<{ x: number; y: number }>>>,
  scaleX: number,
  scaleY: number
): void {
  context.beginPath();
  projectedPolygons.forEach((polygon) => {
    polygon.forEach((ring) => {
      if (!ring.length) return;
      context.moveTo(ring[0].x * scaleX, ring[0].y * scaleY);
      for (let i = 1; i < ring.length; i++) {
        context.lineTo(ring[i].x * scaleX, ring[i].y * scaleY);
      }
      context.closePath();
    });
  });
}

function drawLabel(params: {
  context: CanvasRenderingContext2D;
  x: number;
  y: number;
  code: string;
  areaText: string;
  showArea: boolean;
  bboxWidthPx: number;
  bboxHeightPx: number;
  areaPxScaled: number;
}): void {
  const {
    context,
    x,
    y,
    code,
    areaText,
    showArea,
    bboxWidthPx,
    bboxHeightPx,
    areaPxScaled,
  } = params;

  const baseBySize = Math.min(bboxWidthPx, bboxHeightPx) * 0.24;
  const baseByArea = Math.sqrt(Math.max(1, areaPxScaled)) * 0.12;
  const primarySize = clamp(Math.min(baseBySize, baseByArea), 15, 34);
  const secondarySize = clamp(primarySize * 0.72, 11, 23);
  const lineGap = Math.max(3, primarySize * 0.18);
  const areaY = y + primarySize * 0.65 + lineGap;

  context.save();
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.lineJoin = 'round';
  context.lineCap = 'round';
  context.fillStyle = '#FFFFFF';
  context.strokeStyle = '#0F172A';

  context.font = `700 ${primarySize}px Roboto, Arial, sans-serif`;
  context.lineWidth = clamp(primarySize * 0.17, 2.2, 5);
  context.strokeText(code, x, y);
  context.fillText(code, x, y);

  if (showArea) {
    context.font = `600 ${secondarySize}px Roboto, Arial, sans-serif`;
    context.lineWidth = clamp(secondarySize * 0.15, 1.8, 4.2);
    context.strokeText(areaText, x, areaY);
    context.fillText(areaText, x, areaY);
  }

  context.restore();
}

export async function generateStrategicMapImage(
  params: GenerateStrategicMapImageParams
): Promise<GenerateStrategicMapImageResult> {
  const pixelRatio = params.pixelRatio ?? 2;
  const renderedWidth = Math.max(1, Math.round(params.logicalWidth * pixelRatio));
  const renderedHeight = Math.max(1, Math.round(params.logicalHeight * pixelRatio));

  const mapProjection = buildStrategicMapProjectionFromViewport(params.shapes, params.viewport);
  if (!mapProjection) {
    return {
      mapImageDataUrl: null,
      mapBaseDataUrl: params.mapBaseDataUrl || null,
      renderedWidth,
      renderedHeight,
    };
  }

  let mapBaseDataUrl = params.mapBaseDataUrl || null;
  if (!mapBaseDataUrl && params.mapBaseUrl) {
    mapBaseDataUrl = await fetchRemoteImageAsDataUrl(params.mapBaseUrl);
  }

  const canvas = createCanvas(renderedWidth, renderedHeight);
  if (!canvas) {
    return {
      mapImageDataUrl: mapBaseDataUrl,
      mapBaseDataUrl,
      renderedWidth,
      renderedHeight,
    };
  }

  const context = canvas.getContext('2d');
  if (!context) {
    return {
      mapImageDataUrl: mapBaseDataUrl,
      mapBaseDataUrl,
      renderedWidth,
      renderedHeight,
    };
  }

  context.fillStyle = DEFAULT_FILL;
  context.fillRect(0, 0, renderedWidth, renderedHeight);

  if (mapBaseDataUrl) {
    const baseImage = await loadImage(mapBaseDataUrl);
    if (baseImage) {
      context.drawImage(baseImage, 0, 0, renderedWidth, renderedHeight);
    }
  }

  const scaleX = renderedWidth / Math.max(1, params.viewport.width);
  const scaleY = renderedHeight / Math.max(1, params.viewport.height);
  const hasBaseMap = Boolean(mapBaseDataUrl);

  mapProjection.shapes.forEach((shape) => {
    const color = params.farmColorMap.get(shape.farmKey) || {
      fill: '#93C5FD',
      stroke: DEFAULT_STROKE,
    };
    const meta = params.plotMetaMap.get(shape.id);

    drawShape(context, shape.projectedPolygons, scaleX, scaleY);
    context.fillStyle = hexToRgba(color.fill, hasBaseMap ? 0.52 : 0.8);
    context.strokeStyle = meta?.isApplied ? '#0F172A' : color.stroke;
    context.lineWidth = meta?.isApplied ? 4.2 : 2.6;
    context.fill('evenodd');
    context.stroke();

    const labelCode = compactPlotLabel(meta?.label || shape.label);
    const plotAreaHa = meta?.areaHa ?? 0;
    const areaText = formatHectares(plotAreaHa);
    const bboxWidthPx = shape.bbox.width * scaleX;
    const bboxHeightPx = shape.bbox.height * scaleY;
    const areaPxScaled = shape.areaPx * scaleX * scaleY;
    const showArea =
      plotAreaHa > 0 &&
      bboxWidthPx > 120 &&
      bboxHeightPx > 58 &&
      areaPxScaled > 15000;

    drawLabel({
      context,
      x: shape.labelX * scaleX,
      y: shape.labelY * scaleY,
      code: labelCode,
      areaText,
      showArea,
      bboxWidthPx,
      bboxHeightPx,
      areaPxScaled,
    });
  });

  const mapImageDataUrl = canvas.toDataURL('image/png');
  console.info(STRATEGIC_MAP_IMAGE_DEBUG, {
    totalShapes: mapProjection.shapes.length,
    renderedWidth,
    renderedHeight,
    logicalWidth: params.logicalWidth,
    logicalHeight: params.logicalHeight,
    pixelRatio,
    hasBaseMap,
  });

  return {
    mapImageDataUrl,
    mapBaseDataUrl,
    renderedWidth,
    renderedHeight,
  };
}
