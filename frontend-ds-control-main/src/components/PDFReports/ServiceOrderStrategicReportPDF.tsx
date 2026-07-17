import { Document, Font, Image, Page, Path, Svg, Text, View } from '@react-pdf/renderer';
import React from 'react';

import type { Application } from '@/types/applications.type';
import type { ServiceOrder } from '@/types/service-order.type';
import { OPERATIONAL_TIME_ZONE } from '@/utils/operational-date';
import {
  buildStrategicMapProjectionFromViewport,
  buildStrategicMapViewport,
  extractPlotPolygons,
  sanitizeStrategicPolygons,
  type StrategicMapShapeInput,
  type StrategicMapShapeProjected,
  type StrategicMapViewport,
} from '@/utils/strategicReportMap2d';
import {
  buildStrategicPlotColorMap,
  type StrategicFarmColor,
} from '@/utils/strategicReportPalette';

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
const MAP_SAFE_AREA_INSETS_PX = {
  top: 12,
  right: 24,
  bottom: 152,
  left: 344,
} as const;
const LEGEND_MAX_ROWS = 6;

const BRAND_YELLOW = '#EAAE07';
const DARK_TEXT = '#0F172A';
const MUTED_TEXT = '#6B7280';
const LIGHT_BORDER = '#E5E7EB';
const STRATEGIC_POLYGON_STROKE = '#111827';
const STRATEGIC_LABEL_TEXT = '#F8FAFC';
const STRATEGIC_LABEL_HALO = '#0F172A';
const LABEL_COLLISION_GAP_PX = 1.6;
const LABEL_MAP_MARGIN_PX = 3;
const APPLIED_FILL_OPACITY = 0.88;
const PENDING_FILL_OPACITY = 0.32;

interface ServiceOrderStrategicReportPDFProps {
  serviceOrder: ServiceOrder;
  applications: Application[];
  prefetchedMapBaseDataUrl?: string | null;
  prefetchedMapImageDataUrl?: string | null;
  mapViewport?: StrategicMapViewport | null;
  farmColorMap?: Map<string, StrategicFarmColor>;
}

type LabelDensity = 'large' | 'medium' | 'small';

type LabelBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

type LabelPlacement = {
  x: number;
  y: number;
  codeY: number;
  areaY: number;
  code: string;
  areaText: string;
  showArea: boolean;
  primarySize: number;
  secondarySize: number;
  bounds: LabelBounds;
};

type StrategicVectorShape = {
  shape: StrategicMapShapeProjected;
  labelCode: string;
  areaText: string;
  areaHa: number;
  color: StrategicFarmColor;
  isApplied: boolean;
};

type ServiceOrderMetrics = {
  plannedHectares: number;
  totalAppliedHectares: number;
  progressPercent: number;
  plotsWithApplications: number;
  totalPlots: number;
};

function parseNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function parseOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatHectares(value: number): string {
  return `${value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ha`;
}

function formatPercent(value: number): string {
  return `${value.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function resolveServiceOrderMetrics(
  serviceOrder: ServiceOrder,
  applications: Application[]
): ServiceOrderMetrics {
  const fallbackPlannedHectares = (serviceOrder.plots || []).reduce(
    (sum, plot) => sum + parseNumber(plot.hectare),
    0
  );
  const serviceOrderApplications = applications.filter(
    (application) => application.serviceOrderId === serviceOrder.id
  );
  const fallbackAppliedHectares = serviceOrderApplications.reduce(
    (sum, application) => sum + parseNumber(application.hectares),
    0
  );
  const fallbackAppliedPlotIds = new Set(
    serviceOrderApplications
      .map((application) => application.plotId)
      .filter((plotId): plotId is string => Boolean(plotId))
  );
  const plannedHectares =
    parseOptionalNumber(serviceOrder.plannedHectares) ?? fallbackPlannedHectares;
  const totalAppliedHectares =
    parseOptionalNumber(serviceOrder.grossAppliedAreaHa) ??
    parseOptionalNumber(serviceOrder.totalAppliedHectares) ??
    fallbackAppliedHectares;
  const fallbackProgressPercent =
    plannedHectares > 0 ? (totalAppliedHectares / plannedHectares) * 100 : 0;
  const progressPercent =
    parseOptionalNumber(serviceOrder.grossAppliedProgressPercent) ?? fallbackProgressPercent;

  return {
    plannedHectares,
    totalAppliedHectares,
    progressPercent,
    plotsWithApplications:
      parseOptionalNumber(serviceOrder.plotsWithApplications) ?? fallbackAppliedPlotIds.size,
    totalPlots:
      parseOptionalNumber(serviceOrder.totalPlots) ??
      serviceOrder.plots?.length ??
      serviceOrder.plotsIds?.length ??
      0,
  };
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

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '').trim();
  if (!/^[\da-fA-F]{3,8}$/.test(normalized)) {
    return `rgba(15, 23, 42, ${alpha})`;
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function bboxEdgeDistance(
  a: StrategicMapShapeProjected['bbox'],
  b: StrategicMapShapeProjected['bbox']
): number {
  const dx = Math.max(0, Math.max(a.minX - b.maxX, b.minX - a.maxX));
  const dy = Math.max(0, Math.max(a.minY - b.maxY, b.minY - a.maxY));
  return Math.sqrt(dx * dx + dy * dy);
}

function buildShapeAdjacencyMap(shapes: StrategicMapShapeProjected[]): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>();
  shapes.forEach((shape) => adjacency.set(shape.id, new Set<string>()));

  for (let i = 0; i < shapes.length; i++) {
    for (let j = i + 1; j < shapes.length; j++) {
      const shapeA = shapes[i];
      const shapeB = shapes[j];
      const distance = bboxEdgeDistance(shapeA.bbox, shapeB.bbox);
      if (distance > 28) {
        continue;
      }
      adjacency.get(shapeA.id)?.add(shapeB.id);
      adjacency.get(shapeB.id)?.add(shapeA.id);
    }
  }

  return adjacency;
}

function compactPlotCode(label: string, fallbackPlotId: string): string {
  const normalized = label.trim().toUpperCase().replace(/\s+/g, ' ');
  if (!normalized) {
    return `TALHAO ${fallbackPlotId.slice(0, 6).toUpperCase()}`;
  }

  const farmMatch = normalized.match(/\bF\s*[-_/]?\s*(\d+[A-Z]?)\b/);
  const plotMatch = normalized.match(/\bT\s*[-_/]?\s*(\d+[A-Z]?)\b/);
  if (farmMatch && plotMatch) {
    return `F${farmMatch[1]} T${plotMatch[1]}`;
  }
  if (farmMatch) {
    return `F${farmMatch[1]}`;
  }
  if (plotMatch) {
    return `T${plotMatch[1]}`;
  }

  const compact = normalized
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!compact) {
    return `TALHAO ${fallbackPlotId.slice(0, 6).toUpperCase()}`;
  }

  const tokens = compact.split(' ');
  if (tokens.length >= 2) {
    return `${tokens[0]} ${tokens[1]}`.slice(0, 22);
  }
  return compact.slice(0, 22);
}

function resolveLabelDensity(shape: StrategicMapShapeProjected): LabelDensity {
  const isLarge = shape.bbox.width >= 132 && shape.bbox.height >= 58 && shape.areaPx >= 15600;
  if (isLarge) return 'large';

  const isMedium = shape.bbox.width >= 74 && shape.bbox.height >= 34 && shape.areaPx >= 4300;
  if (isMedium) return 'medium';

  return 'small';
}

function estimateTextWidth(text: string, fontSize: number): number {
  let units = 0;
  for (const char of text) {
    if (char === ' ') {
      units += 0.34;
      continue;
    }

    if ('WMWQ@#'.includes(char)) {
      units += 0.9;
      continue;
    }

    if ('I1JLT'.includes(char)) {
      units += 0.46;
      continue;
    }

    if (',.;:'.includes(char)) {
      units += 0.3;
      continue;
    }

    units += 0.64;
  }
  return units * fontSize;
}

function measureLabel(
  code: string,
  areaText: string,
  primarySize: number,
  secondarySize: number,
  showArea: boolean
): {
  width: number;
  height: number;
  primaryHeight: number;
  secondaryHeight: number;
  lineGap: number;
} {
  const codeWidth = estimateTextWidth(code, primarySize * 0.99);
  const areaWidth = showArea ? estimateTextWidth(areaText, secondarySize * 0.99) : 0;

  const primaryHeight = primarySize * 1.04;
  const secondaryHeight = showArea ? secondarySize * 1.02 : 0;
  const lineGap = showArea ? Math.max(2.2, primarySize * 0.15) : 0;
  const textWidth = Math.max(codeWidth, areaWidth);
  const textHeight = showArea ? primaryHeight + lineGap + secondaryHeight : primaryHeight;
  const padX = clamp(primarySize * 0.3, 3.8, 10);
  const padY = clamp(primarySize * 0.2, 2.4, 8);

  return {
    width: textWidth + padX * 2,
    height: textHeight + padY * 2,
    primaryHeight,
    secondaryHeight,
    lineGap,
  };
}

function buildLabelBounds(x: number, y: number, width: number, height: number): LabelBounds {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
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

function isInsideMapBounds(bounds: LabelBounds, mapWidth: number, mapHeight: number): boolean {
  return (
    bounds.minX >= LABEL_MAP_MARGIN_PX &&
    bounds.minY >= LABEL_MAP_MARGIN_PX &&
    bounds.maxX <= mapWidth - LABEL_MAP_MARGIN_PX &&
    bounds.maxY <= mapHeight - LABEL_MAP_MARGIN_PX
  );
}

function pointInRing(
  point: { x: number; y: number },
  ring: Array<{ x: number; y: number }>
): boolean {
  if (ring.length < 3) {
    return false;
  }

  const { x: px, y: py } = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const { x: xi, y: yi } = ring[i];
    const { x: xj, y: yj } = ring[j];
    const intersects =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInProjectedPolygons(
  point: { x: number; y: number },
  projectedPolygons: StrategicMapShapeProjected['projectedPolygons']
): boolean {
  return projectedPolygons.some((polygon) => {
    const outerRing = polygon[0];
    if (!outerRing || !pointInRing(point, outerRing)) {
      return false;
    }

    for (let holeIndex = 1; holeIndex < polygon.length; holeIndex++) {
      if (pointInRing(point, polygon[holeIndex])) {
        return false;
      }
    }

    return true;
  });
}

function isLabelBoundsInsideProjectedShape(
  bounds: LabelBounds,
  projectedPolygons: StrategicMapShapeProjected['projectedPolygons'],
  strict: boolean
): boolean {
  const center = {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  };
  const corePoints = [
    center,
    { x: center.x, y: bounds.minY },
    { x: center.x, y: bounds.maxY },
    { x: bounds.minX, y: center.y },
    { x: bounds.maxX, y: center.y },
  ];
  const cornerPoints = [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.minX, y: bounds.maxY },
    { x: bounds.maxX, y: bounds.maxY },
  ];
  const testPoints = strict ? [...corePoints, ...cornerPoints] : corePoints;

  return testPoints.every((point) => pointInProjectedPolygons(point, projectedPolygons));
}

function buildLabelAnchorCandidates(
  shape: StrategicMapShapeProjected
): Array<{ x: number; y: number }> {
  const { labelX, labelY } = shape;
  const offsetX = clamp(shape.bbox.width * 0.24, 10, 64);
  const offsetY = clamp(shape.bbox.height * 0.24, 10, 54);

  const out: Array<{ x: number; y: number }> = [
    { x: labelX, y: labelY },
    { x: labelX - offsetX, y: labelY },
    { x: labelX + offsetX, y: labelY },
    { x: labelX, y: labelY - offsetY },
    { x: labelX, y: labelY + offsetY },
    { x: labelX - offsetX, y: labelY - offsetY },
    { x: labelX + offsetX, y: labelY - offsetY },
    { x: labelX - offsetX, y: labelY + offsetY },
    { x: labelX + offsetX, y: labelY + offsetY },
  ];

  const minDim = Math.max(1, Math.min(shape.bbox.width, shape.bbox.height));
  const radialStep = clamp(minDim * 0.18, 8, 34);
  for (let ring = 1; ring <= 3; ring++) {
    const radius = radialStep * ring;
    for (let angleIdx = 0; angleIdx < 12; angleIdx++) {
      const angle = (Math.PI * 2 * angleIdx) / 12;
      out.push({
        x: labelX + Math.cos(angle) * radius,
        y: labelY + Math.sin(angle) * radius,
      });
    }
  }

  const gridStepX = clamp(shape.bbox.width * 0.18, 7, 30);
  const gridStepY = clamp(shape.bbox.height * 0.18, 7, 30);
  for (let gx = -2; gx <= 2; gx++) {
    for (let gy = -2; gy <= 2; gy++) {
      if (gx === 0 && gy === 0) continue;
      out.push({
        x: labelX + gx * gridStepX,
        y: labelY + gy * gridStepY,
      });
    }
  }

  const deduped: Array<{ x: number; y: number }> = [];
  const seen = new Set<string>();
  out.forEach((point) => {
    const key = `${Math.round(point.x * 2) / 2}|${Math.round(point.y * 2) / 2}`;
    if (seen.has(key)) return;
    seen.add(key);
    deduped.push(point);
  });
  return deduped;
}

function resolveLabelPlacement(params: {
  vectorShape: StrategicVectorShape;
  mapWidth: number;
  mapHeight: number;
  occupiedBounds: LabelBounds[];
  forceCodeOnly?: boolean;
  relaxedPass?: boolean;
}): LabelPlacement | null {
  const { vectorShape, mapWidth, mapHeight, occupiedBounds, forceCodeOnly, relaxedPass } = params;
  const { shape } = vectorShape;
  const density = resolveLabelDensity(shape);
  const minPrimaryByDensity = density === 'small' ? 8.2 : density === 'medium' ? 9.4 : 10.8;
  const baseBySize = Math.min(shape.bbox.width, shape.bbox.height) * 0.24;
  const baseByArea = Math.sqrt(Math.max(1, shape.areaPx)) * 0.14;
  const basePrimary = clamp(
    Math.min(baseBySize, baseByArea),
    relaxedPass ? 6.8 : minPrimaryByDensity,
    13.6
  );
  const condensedCode = vectorShape.labelCode.replace(/\s+/g, '');
  const anchors = buildLabelAnchorCandidates(shape);

  const variants: Array<{ code: string; showArea: boolean; fontScale: number }> = [];
  const allowArea = !forceCodeOnly && vectorShape.areaHa > 0 && density !== 'small';

  if (allowArea && density === 'large') {
    variants.push({ code: vectorShape.labelCode, showArea: true, fontScale: 1 });
    variants.push({ code: vectorShape.labelCode, showArea: true, fontScale: 0.9 });
  }

  if (allowArea && density === 'medium') {
    variants.push({ code: vectorShape.labelCode, showArea: true, fontScale: 0.92 });
  }

  variants.push({
    code: vectorShape.labelCode,
    showArea: false,
    fontScale: density === 'small' ? 0.9 : 1,
  });
  variants.push({
    code: vectorShape.labelCode,
    showArea: false,
    fontScale: density === 'small' ? 0.8 : 0.88,
  });

  if (condensedCode && condensedCode !== vectorShape.labelCode) {
    variants.push({ code: condensedCode, showArea: false, fontScale: 0.8 });
  }

  const maxCollisionGap = relaxedPass ? 0.6 : LABEL_COLLISION_GAP_PX;
  const triedVariants = new Set<string>();
  const uniqueVariants = variants.filter((variant) => {
    const key = `${variant.code}|${variant.showArea}|${variant.fontScale.toFixed(3)}`;
    if (triedVariants.has(key)) return false;
    triedVariants.add(key);
    return true;
  });

  for (const variant of uniqueVariants) {
    const primarySize = clamp(
      basePrimary * variant.fontScale,
      relaxedPass ? 6.6 : minPrimaryByDensity,
      13.6
    );
    const secondarySize = clamp(primarySize * 0.72, 6.2, 10.4);
    const metrics = measureLabel(
      variant.code,
      vectorShape.areaText,
      primarySize,
      secondarySize,
      variant.showArea
    );
    const widthLimit = Math.max(28, shape.bbox.width * (density === 'small' ? 1.55 : 1.85));
    const heightLimit = Math.max(14, shape.bbox.height * (density === 'small' ? 1.72 : 2.05));
    if (metrics.width > widthLimit || metrics.height > heightLimit) {
      continue;
    }

    for (const anchor of anchors) {
      if (!pointInProjectedPolygons(anchor, shape.projectedPolygons)) {
        continue;
      }

      const bounds = buildLabelBounds(anchor.x, anchor.y, metrics.width, metrics.height);
      if (!isInsideMapBounds(bounds, mapWidth, mapHeight)) {
        continue;
      }

      if (!isLabelBoundsInsideProjectedShape(bounds, shape.projectedPolygons, !relaxedPass)) {
        continue;
      }

      const collides = occupiedBounds.some((occupied) =>
        intersectsBounds(bounds, occupied, maxCollisionGap)
      );
      if (collides) {
        continue;
      }

      const codeY = variant.showArea
        ? anchor.y - (metrics.secondaryHeight + metrics.lineGap) / 2
        : anchor.y;
      const areaY = variant.showArea
        ? anchor.y + (metrics.primaryHeight + metrics.lineGap) / 2
        : anchor.y;

      return {
        x: anchor.x,
        y: anchor.y,
        codeY,
        areaY,
        code: variant.code,
        areaText: vectorShape.areaText,
        showArea: variant.showArea,
        primarySize,
        secondarySize,
        bounds,
      };
    }
  }

  return null;
}

function buildStrategicLabelPlacements(
  vectorShapes: StrategicVectorShape[],
  mapWidth: number,
  mapHeight: number
): { placements: Map<string, LabelPlacement>; labelsDrawn: number; labelsOmitted: number } {
  const occupiedBounds: LabelBounds[] = [];
  const placements = new Map<string, LabelPlacement>();
  const sortedShapes = [...vectorShapes].sort((a, b) => b.shape.areaPx - a.shape.areaPx);
  const unresolved: StrategicVectorShape[] = [];

  sortedShapes.forEach((vectorShape) => {
    const placement = resolveLabelPlacement({
      vectorShape,
      mapWidth,
      mapHeight,
      occupiedBounds,
    });

    if (!placement) {
      unresolved.push(vectorShape);
      return;
    }

    placements.set(vectorShape.shape.id, placement);
    occupiedBounds.push(placement.bounds);
  });

  unresolved.forEach((vectorShape) => {
    const placement = resolveLabelPlacement({
      vectorShape,
      mapWidth,
      mapHeight,
      occupiedBounds,
      forceCodeOnly: true,
      relaxedPass: true,
    });

    if (!placement) {
      return;
    }

    placements.set(vectorShape.shape.id, placement);
    occupiedBounds.push(placement.bounds);
  });

  return {
    placements,
    labelsDrawn: placements.size,
    labelsOmitted: Math.max(0, vectorShapes.length - placements.size),
  };
}

const ServiceOrderStrategicReportPDF: React.FC<ServiceOrderStrategicReportPDFProps> = ({
  serviceOrder,
  applications,
  prefetchedMapBaseDataUrl = null,
  prefetchedMapImageDataUrl = null,
  mapViewport = null,
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
        safeAreaInsetsPx: MAP_SAFE_AREA_INSETS_PX,
      }
    );

  const plotRowsById = new Map(validPlotRows.map((row) => [row.plotId, row]));
  const serviceOrderMetrics = resolveServiceOrderMetrics(serviceOrder, applications);

  const appliedPlotIds = new Set(
    applications
      .filter((application) => application.serviceOrderId === serviceOrder.id)
      .map((application) => application.plotId)
      .filter((plotId): plotId is string => Boolean(plotId))
  );
  const progressBarWidth = `${clamp(serviceOrderMetrics.progressPercent, 0, 100)}%`;

  const customerName = serviceOrder.customer?.name || 'CLIENTE';
  const observationTitle = (serviceOrder.observation || 'PROGRAMACAO').toUpperCase();
  const title = `${customerName.toUpperCase()} - MAPA ESTRATEGICO - ${observationTitle}`;

  const scaleBarWidthPx = 116;
  const estimatedScaleKm = viewport
    ? (() => {
        const lngSpan = viewport.bounds.maxLng - viewport.bounds.minLng;
        const midLatRad = ((viewport.bounds.minLat + viewport.bounds.maxLat) / 2) * (Math.PI / 180);
        const widthKm = Math.abs(lngSpan * 111.32 * Math.cos(midLatRad));
        const scaleKm = (widthKm * scaleBarWidthPx) / MAP_LOGICAL_WIDTH;
        return Math.max(0.1, Number(scaleKm.toFixed(2)));
      })()
    : 0.5;

  const mapImageSrc = prefetchedMapBaseDataUrl || prefetchedMapImageDataUrl;
  const hasMap = Boolean(mapImageSrc);
  const strategicProjection = viewport
    ? buildStrategicMapProjectionFromViewport(shapesInput, viewport)
    : null;
  const plotAdjacencyMap = strategicProjection
    ? buildShapeAdjacencyMap(strategicProjection.shapes)
    : new Map<string, Set<string>>();
  const plotColorMap = buildStrategicPlotColorMap(
    strategicProjection?.shapes.map((shape) => shape.id) || [],
    plotAdjacencyMap
  );

  const strategicVectorShapes: StrategicVectorShape[] =
    strategicProjection?.shapes.map((shape) => {
      const row = plotRowsById.get(shape.id);
      const plotColor = plotColorMap.get(shape.id) || {
        fill: '#60A5FA',
        stroke: '#1D4ED8',
      };

      const plotLabel = compactPlotCode(row?.plotName || shape.label, shape.id);
      const areaHa = row?.hectares || 0;

      return {
        shape,
        labelCode: plotLabel,
        areaText: formatHectares(areaHa),
        areaHa,
        color: plotColor,
        isApplied: appliedPlotIds.has(shape.id),
      };
    }) || [];

  const legendPlotRows = strategicVectorShapes
    .map((shape) => ({
      plotId: shape.shape.id,
      labelCode: shape.labelCode,
      areaHa: shape.areaHa,
      color: shape.color,
      isApplied: shape.isApplied,
    }))
    .sort((a, b) => a.labelCode.localeCompare(b.labelCode, 'pt-BR'));
  const legendSampleColor = legendPlotRows[0]?.color.fill || '#1D4ED8';

  const strategicLabelLayout = buildStrategicLabelPlacements(
    strategicVectorShapes,
    MAP_LOGICAL_WIDTH,
    MAP_LOGICAL_HEIGHT
  );

  if (strategicProjection) {
    console.info('[StrategicPDF][VectorMap]', {
      totalShapes: strategicVectorShapes.length,
      labelsDrawn: strategicLabelLayout.labelsDrawn,
      labelsOmitted: strategicLabelLayout.labelsOmitted,
      adjacencyPairsApprox:
        Array.from(plotAdjacencyMap.values()).reduce((sum, neighbors) => sum + neighbors.size, 0) /
        2,
      hasBaseMap: hasMap,
      appliedOpacity: APPLIED_FILL_OPACITY,
      pendingOpacity: PENDING_FILL_OPACITY,
      mapLogicalWidth: MAP_LOGICAL_WIDTH,
      mapLogicalHeight: MAP_LOGICAL_HEIGHT,
    });
  }

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
                objectFit: 'fill',
              }}
            />
          ) : null}

          {strategicProjection ? (
            <Svg
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: '100%',
                height: '100%',
              }}
              viewBox={`0 0 ${MAP_LOGICAL_WIDTH} ${MAP_LOGICAL_HEIGHT}`}
              preserveAspectRatio='none'
            >
              {strategicVectorShapes.map(({ shape, color, isApplied }) => (
                <Path
                  key={`shape-${shape.id}`}
                  d={shape.pathD}
                  fill={color.fill}
                  fillOpacity={isApplied ? APPLIED_FILL_OPACITY : PENDING_FILL_OPACITY}
                  fillRule='evenodd'
                  stroke={STRATEGIC_POLYGON_STROKE}
                  strokeOpacity={0.9}
                  strokeWidth={1.05}
                />
              ))}

              {strategicVectorShapes.map(({ shape }) => {
                const placement = strategicLabelLayout.placements.get(shape.id);
                if (!placement) {
                  return null;
                }

                const haloCodeWidth = clamp(placement.primarySize * 0.085, 0.62, 1.25);
                const haloAreaWidth = clamp(placement.secondarySize * 0.085, 0.56, 1.1);

                return (
                  <React.Fragment key={`label-${shape.id}`}>
                    <Text
                      x={placement.x}
                      y={placement.codeY}
                      textAnchor='middle'
                      dominantBaseline='middle'
                      fill={STRATEGIC_LABEL_TEXT}
                      stroke={STRATEGIC_LABEL_HALO}
                      strokeWidth={haloCodeWidth}
                      strokeLinejoin='round'
                      strokeLinecap='round'
                      style={{
                        fontFamily: 'Roboto',
                        fontWeight: 600,
                        fontSize: placement.primarySize,
                      }}
                    >
                      {placement.code}
                    </Text>

                    {placement.showArea ? (
                      <Text
                        x={placement.x}
                        y={placement.areaY}
                        textAnchor='middle'
                        dominantBaseline='middle'
                        fill={STRATEGIC_LABEL_TEXT}
                        stroke={STRATEGIC_LABEL_HALO}
                        strokeWidth={haloAreaWidth}
                        strokeLinejoin='round'
                        strokeLinecap='round'
                        style={{
                          fontFamily: 'Roboto',
                          fontWeight: 500,
                          fontSize: placement.secondarySize,
                        }}
                      >
                        {placement.areaText}
                      </Text>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </Svg>
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
              width: 332,
              maxHeight: 132,
              border: `1px solid ${LIGHT_BORDER}`,
              borderRadius: 4,
              backgroundColor: '#FFFFFFEB',
              paddingHorizontal: 6,
              paddingVertical: 5,
            }}
          >
            <Text style={{ fontSize: 8, fontWeight: 700, marginBottom: 2 }}>LEGENDA</Text>
            {legendPlotRows.slice(0, LEGEND_MAX_ROWS).map((plotLegend) => (
              <View
                key={plotLegend.plotId}
                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 1.8 }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 1,
                    backgroundColor: plotLegend.color.fill,
                    border: `1px solid ${STRATEGIC_POLYGON_STROKE}`,
                    marginRight: 4,
                  }}
                />
                <Text style={{ flex: 1, fontSize: 6.7 }}>
                  {plotLegend.labelCode} ({formatHectares(plotLegend.areaHa)})
                </Text>
              </View>
            ))}
            {legendPlotRows.length > LEGEND_MAX_ROWS ? (
              <Text style={{ fontSize: 6.2, color: MUTED_TEXT }}>
                + {legendPlotRows.length - LEGEND_MAX_ROWS} talhao(es)
              </Text>
            ) : null}
            <View style={{ marginTop: 2, borderTop: `1px solid ${LIGHT_BORDER}`, paddingTop: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 1.2 }}>
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 1,
                    backgroundColor: hexToRgba(legendSampleColor, APPLIED_FILL_OPACITY),
                    border: `1px solid ${STRATEGIC_POLYGON_STROKE}`,
                    marginRight: 4,
                  }}
                />
                <Text style={{ fontSize: 6.15, color: MUTED_TEXT }}>
                  Aplicado: preenchimento forte
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 1.2 }}>
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 1,
                    backgroundColor: hexToRgba(legendSampleColor, PENDING_FILL_OPACITY),
                    border: `1px solid ${STRATEGIC_POLYGON_STROKE}`,
                    marginRight: 4,
                  }}
                />
                <Text style={{ fontSize: 6.15, color: MUTED_TEXT }}>
                  Pendente/Programado: preenchimento claro
                </Text>
              </View>
            </View>
            <View style={{ marginTop: 2, borderTop: `1px solid ${LIGHT_BORDER}`, paddingTop: 2 }}>
              <View
                style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 1.4 }}
              >
                <Text style={{ fontSize: 6.3, color: MUTED_TEXT }}>Progresso real da OS</Text>
                <Text style={{ fontSize: 6.6, fontWeight: 700 }}>
                  {formatPercent(serviceOrderMetrics.progressPercent)}
                </Text>
              </View>
              <View
                style={{
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: '#E5E7EB',
                  overflow: 'hidden',
                  marginBottom: 1.6,
                }}
              >
                <View
                  style={{
                    width: progressBarWidth,
                    height: 4,
                    backgroundColor: BRAND_YELLOW,
                  }}
                />
              </View>
              <Text style={{ fontSize: 6.15, color: MUTED_TEXT }}>
                Aplicado: {formatHectares(serviceOrderMetrics.totalAppliedHectares)} de{' '}
                {formatHectares(serviceOrderMetrics.plannedHectares)}
              </Text>
              <Text style={{ fontSize: 6.15, color: MUTED_TEXT }}>
                Talhoes com aplicacao: {serviceOrderMetrics.plotsWithApplications}/
                {serviceOrderMetrics.totalPlots}
              </Text>
            </View>
            {invalidPlotRows.length > 0 ? (
              <Text style={{ fontSize: 6.1, color: MUTED_TEXT, marginTop: 1 }}>
                Talhoes sem geometria valida: {invalidPlotRows.length}
              </Text>
            ) : null}
            {strategicProjection && strategicLabelLayout.labelsOmitted > 0 ? (
              <Text style={{ fontSize: 5.8, color: MUTED_TEXT, marginTop: 1 }}>
                Labels omitidos por sobreposicao extrema: {strategicLabelLayout.labelsOmitted}
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
              <View
                style={{
                  marginTop: 2,
                  width: scaleBarWidthPx,
                  height: 2.4,
                  backgroundColor: '#111827',
                }}
              />
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
            <Image
              src='/images/pdf-logo-only.png'
              style={{ width: 90, height: 22, objectFit: 'contain' }}
            />
          </View>

          {!hasMap && !strategicProjection ? (
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
                Talhoes validos: {validPlotRows.length} | Talhoes sem geometria:{' '}
                {invalidPlotRows.length}
              </Text>
            </View>
          ) : null}
        </View>
      </Page>
    </Document>
  );
};

export default ServiceOrderStrategicReportPDF;
