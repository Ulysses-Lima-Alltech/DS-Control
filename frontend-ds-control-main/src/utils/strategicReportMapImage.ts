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
const LABEL_COLLISION_GAP_PX = 4;
const LABEL_MAP_MARGIN_PX = 3;

type LabelDensity = 'large' | 'medium' | 'small';

type LabelBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

type LabelMetrics = {
  width: number;
  height: number;
  primaryHeight: number;
  secondaryHeight: number;
  lineGap: number;
};

type LabelPlacement = {
  x: number;
  y: number;
  code: string;
  showArea: boolean;
  primarySize: number;
  secondarySize: number;
  bounds: LabelBounds;
  lineGap: number;
};

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

function shrinkPlotLabel(label: string): string {
  const normalized = label.trim().toUpperCase().replace(/\s+/g, ' ');
  if (!normalized) return 'TALHAO';
  if (normalized.length <= 12) return normalized;

  const tokens = normalized.split(' ');
  const firstToken = tokens[0];
  if (firstToken.length >= 3 && firstToken.length <= 12) {
    return firstToken;
  }

  return `${normalized.slice(0, 9).trim()}...`;
}

function resolveLabelDensity(
  bboxWidthPx: number,
  bboxHeightPx: number,
  areaPxScaled: number
): LabelDensity {
  const isLarge = bboxWidthPx >= 140 && bboxHeightPx >= 62 && areaPxScaled >= 18000;
  if (isLarge) return 'large';

  const isMedium = bboxWidthPx >= 74 && bboxHeightPx >= 36 && areaPxScaled >= 4500;
  if (isMedium) return 'medium';

  return 'small';
}

function buildLabelAnchorCandidates(
  centerX: number,
  centerY: number,
  bboxWidthPx: number,
  bboxHeightPx: number
): Array<{ x: number; y: number }> {
  const offsetY = clamp(bboxHeightPx * 0.24, 14, 86);
  const offsetX = clamp(bboxWidthPx * 0.24, 16, 98);

  return [
    { x: centerX, y: centerY },
    { x: centerX, y: centerY - offsetY },
    { x: centerX, y: centerY + offsetY },
    { x: centerX - offsetX, y: centerY },
    { x: centerX + offsetX, y: centerY },
  ];
}

function measureLabel(
  context: CanvasRenderingContext2D,
  code: string,
  areaText: string,
  primarySize: number,
  secondarySize: number,
  showArea: boolean
): LabelMetrics {
  context.save();

  context.font = `700 ${primarySize}px Roboto, Arial, sans-serif`;
  const codeWidth = context.measureText(code).width;
  const primaryHeight = primarySize * 1.06;

  let areaWidth = 0;
  let secondaryHeight = 0;
  if (showArea) {
    context.font = `600 ${secondarySize}px Roboto, Arial, sans-serif`;
    areaWidth = context.measureText(areaText).width;
    secondaryHeight = secondarySize * 1.04;
  }

  context.restore();

  const lineGap = showArea ? Math.max(3, primarySize * 0.18) : 0;
  const textWidth = Math.max(codeWidth, areaWidth);
  const textHeight = showArea ? primaryHeight + lineGap + secondaryHeight : primaryHeight;
  const horizontalPadding = clamp(primarySize * 0.28, 6, 14);
  const verticalPadding = clamp(primarySize * 0.18, 4, 11);
  const haloAllowance = clamp(primarySize * 0.22, 3, 8);

  return {
    width: textWidth + horizontalPadding * 2 + haloAllowance,
    height: textHeight + verticalPadding * 2 + haloAllowance,
    primaryHeight,
    secondaryHeight,
    lineGap,
  };
}

function buildLabelBounds(x: number, y: number, metrics: LabelMetrics): LabelBounds {
  const halfWidth = metrics.width / 2;
  const halfHeight = metrics.height / 2;
  return {
    minX: x - halfWidth,
    minY: y - halfHeight,
    maxX: x + halfWidth,
    maxY: y + halfHeight,
  };
}

function intersectsBounds(a: LabelBounds, b: LabelBounds, gap: number): boolean {
  return !(
    a.maxX + gap < b.minX ||
    a.minX - gap > b.maxX ||
    a.maxY + gap < b.minY ||
    a.minY - gap > b.maxY
  );
}

function isInsideMapBounds(
  bounds: LabelBounds,
  mapWidth: number,
  mapHeight: number,
  marginPx: number
): boolean {
  return (
    bounds.minX >= marginPx &&
    bounds.minY >= marginPx &&
    bounds.maxX <= mapWidth - marginPx &&
    bounds.maxY <= mapHeight - marginPx
  );
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
  primarySize: number;
  secondarySize: number;
  lineGap: number;
}): void {
  const { context, x, y, code, areaText, showArea, primarySize, secondarySize, lineGap } = params;
  const primaryHeight = primarySize * 1.06;
  const secondaryHeight = secondarySize * 1.04;
  const codeY = showArea ? y - (secondaryHeight + lineGap) / 2 : y;
  const areaY = y + (primaryHeight + lineGap) / 2;

  context.save();
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.lineJoin = 'round';
  context.lineCap = 'round';
  context.fillStyle = '#FFFFFF';
  context.strokeStyle = '#0F172A';

  context.font = `700 ${primarySize}px Roboto, Arial, sans-serif`;
  context.lineWidth = clamp(primarySize * 0.17, 2.2, 5);
  context.strokeText(code, x, codeY);
  context.fillText(code, x, codeY);

  if (showArea) {
    context.font = `600 ${secondarySize}px Roboto, Arial, sans-serif`;
    context.lineWidth = clamp(secondarySize * 0.15, 1.8, 4.2);
    context.strokeText(areaText, x, areaY);
    context.fillText(areaText, x, areaY);
  }

  context.restore();
}

function resolveLabelPlacement(params: {
  context: CanvasRenderingContext2D;
  mapWidth: number;
  mapHeight: number;
  occupiedBounds: LabelBounds[];
  labelCode: string;
  shortLabelCode: string;
  areaText: string;
  plotAreaHa: number;
  centerX: number;
  centerY: number;
  bboxWidthPx: number;
  bboxHeightPx: number;
  areaPxScaled: number;
}): LabelPlacement | null {
  const {
    context,
    mapWidth,
    mapHeight,
    occupiedBounds,
    labelCode,
    shortLabelCode,
    areaText,
    plotAreaHa,
    centerX,
    centerY,
    bboxWidthPx,
    bboxHeightPx,
    areaPxScaled,
  } = params;

  const density = resolveLabelDensity(bboxWidthPx, bboxHeightPx, areaPxScaled);
  const baseBySize = Math.min(bboxWidthPx, bboxHeightPx) * 0.24;
  const baseByArea = Math.sqrt(Math.max(1, areaPxScaled)) * 0.12;
  const minPrimaryByDensity = density === 'small' ? 11 : density === 'medium' ? 13 : 15;
  const basePrimarySize = clamp(Math.min(baseBySize, baseByArea), minPrimaryByDensity, 34);
  const anchors = buildLabelAnchorCandidates(centerX, centerY, bboxWidthPx, bboxHeightPx);

  const preferredVariants: Array<{
    code: string;
    showArea: boolean;
    fontScale: number;
  }> = [];

  if (density === 'large' && plotAreaHa > 0) {
    preferredVariants.push({ code: labelCode, showArea: true, fontScale: 1 });
    preferredVariants.push({ code: shortLabelCode, showArea: true, fontScale: 0.9 });
  }

  preferredVariants.push({
    code: labelCode,
    showArea: false,
    fontScale: density === 'small' ? 0.92 : 1,
  });
  preferredVariants.push({
    code: shortLabelCode,
    showArea: false,
    fontScale: density === 'small' ? 0.84 : 0.9,
  });

  const triedVariants = new Set<string>();
  const uniqueVariants = preferredVariants.filter((variant) => {
    const key = `${variant.code}|${variant.showArea}|${variant.fontScale.toFixed(2)}`;
    if (triedVariants.has(key)) {
      return false;
    }
    triedVariants.add(key);
    return true;
  });

  for (const variant of uniqueVariants) {
    const primarySize = clamp(basePrimarySize * variant.fontScale, minPrimaryByDensity, 34);
    const secondarySize = clamp(primarySize * 0.72, 10, 23);
    const metrics = measureLabel(
      context,
      variant.code,
      areaText,
      primarySize,
      secondarySize,
      variant.showArea
    );

    if (density === 'small') {
      const smallWidthLimit = Math.max(48, bboxWidthPx * 1.28);
      const smallHeightLimit = Math.max(24, bboxHeightPx * 1.36);
      if (metrics.width > smallWidthLimit || metrics.height > smallHeightLimit) {
        continue;
      }
    }

    for (const anchor of anchors) {
      const bounds = buildLabelBounds(anchor.x, anchor.y, metrics);
      if (!isInsideMapBounds(bounds, mapWidth, mapHeight, LABEL_MAP_MARGIN_PX)) {
        continue;
      }

      const collides = occupiedBounds.some((occupied) =>
        intersectsBounds(bounds, occupied, LABEL_COLLISION_GAP_PX)
      );
      if (collides) {
        continue;
      }

      return {
        x: anchor.x,
        y: anchor.y,
        code: variant.code,
        showArea: variant.showArea,
        primarySize,
        secondarySize,
        lineGap: metrics.lineGap,
        bounds,
      };
    }
  }

  return null;
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
  });

  const occupiedLabelBounds: LabelBounds[] = [];
  let labelsDrawn = 0;
  let labelsOmitted = 0;

  const shapesByPriority = [...mapProjection.shapes].sort((a, b) => {
    const areaA = a.areaPx * scaleX * scaleY;
    const areaB = b.areaPx * scaleX * scaleY;
    return areaB - areaA;
  });

  shapesByPriority.forEach((shape) => {
    const meta = params.plotMetaMap.get(shape.id);
    const labelCode = compactPlotLabel(meta?.label || shape.label);
    const shortLabelCode = shrinkPlotLabel(labelCode);
    const plotAreaHa = meta?.areaHa ?? 0;
    const areaText = formatHectares(plotAreaHa);
    const bboxWidthPx = shape.bbox.width * scaleX;
    const bboxHeightPx = shape.bbox.height * scaleY;
    const areaPxScaled = shape.areaPx * scaleX * scaleY;
    const placement = resolveLabelPlacement({
      context,
      mapWidth: renderedWidth,
      mapHeight: renderedHeight,
      occupiedBounds: occupiedLabelBounds,
      labelCode,
      shortLabelCode,
      areaText,
      plotAreaHa,
      centerX: shape.labelX * scaleX,
      centerY: shape.labelY * scaleY,
      bboxWidthPx,
      bboxHeightPx,
      areaPxScaled,
    });

    if (!placement) {
      labelsOmitted += 1;
      return;
    }

    drawLabel({
      context,
      x: placement.x,
      y: placement.y,
      code: placement.code,
      areaText,
      showArea: placement.showArea,
      primarySize: placement.primarySize,
      secondarySize: placement.secondarySize,
      lineGap: placement.lineGap,
    });

    occupiedLabelBounds.push(placement.bounds);
    labelsDrawn += 1;
  });

  const mapImageDataUrl = canvas.toDataURL('image/png');
  console.info(STRATEGIC_MAP_IMAGE_DEBUG, {
    totalShapes: mapProjection.shapes.length,
    labelsDrawn,
    labelsOmitted,
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
