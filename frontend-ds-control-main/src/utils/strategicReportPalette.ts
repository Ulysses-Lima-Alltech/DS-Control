export type StrategicFarmColor = {
  fill: string;
  stroke: string;
};

const DEFAULT_STROKE = '#111827';

export const STRATEGIC_FARM_COLORS: StrategicFarmColor[] = [
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

export const STRATEGIC_PLOT_BASE_COLORS: string[] = [
  '#1D4ED8',
  '#EA580C',
  '#16A34A',
  '#7E22CE',
  '#DC2626',
  '#CA8A04',
  '#0891B2',
  '#BE185D',
  '#A16207',
  '#3F6212',
  '#0F766E',
  '#4F46E5',
  '#9333EA',
  '#C2410C',
  '#0E7490',
  '#B45309',
  '#BE123C',
  '#7C2D12',
  '#8B5CF6',
  '#0369A1',
  '#6D28D9',
  '#B91C1C',
  '#15803D',
  '#334155',
];

export function buildStrategicFarmColorMap(farmIds: string[]): Map<string, StrategicFarmColor> {
  const map = new Map<string, StrategicFarmColor>();
  farmIds.forEach((farmId, index) => {
    map.set(farmId, STRATEGIC_FARM_COLORS[index % STRATEGIC_FARM_COLORS.length]);
  });
  return map;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeHexColor(hex: string): string {
  const normalized = hex.replace('#', '').trim();
  if (normalized.length === 3) {
    return normalized
      .split('')
      .map((char) => `${char}${char}`)
      .join('')
      .toUpperCase();
  }
  if (normalized.length >= 6) {
    return normalized.slice(0, 6).toUpperCase();
  }
  return '64748B';
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = normalizeHexColor(hex);
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function colorDistance(colorA: string, colorB: string): number {
  const a = hexToRgb(colorA);
  const b = hexToRgb(colorB);
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function darkenHex(hex: string, ratio: number): string {
  const { r, g, b } = hexToRgb(hex);
  const factor = clamp(1 - ratio, 0, 1);
  const toHex = (value: number) => Math.round(value).toString(16).padStart(2, '0');
  const darkened = `${toHex(r * factor)}${toHex(g * factor)}${toHex(b * factor)}`;
  return `#${darkened.toUpperCase()}`;
}

function buildPlotColor(color: string): StrategicFarmColor {
  return {
    fill: color,
    stroke: darkenHex(color, 0.34),
  };
}

export function buildStrategicPlotColorMap(
  plotIds: string[],
  adjacencyMap?: Map<string, Set<string>>
): Map<string, StrategicFarmColor> {
  const uniquePlotIds = Array.from(new Set(plotIds)).filter(Boolean);
  const out = new Map<string, StrategicFarmColor>();
  if (uniquePlotIds.length === 0) {
    return out;
  }

  const palette = STRATEGIC_PLOT_BASE_COLORS;
  const usageCount = new Array(palette.length).fill(0);
  const colorIndexByPlotId = new Map<string, number>();
  const sortedPlotIds = [...uniquePlotIds].sort((plotA, plotB) => {
    const degreeA = adjacencyMap?.get(plotA)?.size || 0;
    const degreeB = adjacencyMap?.get(plotB)?.size || 0;
    if (degreeA !== degreeB) {
      return degreeB - degreeA;
    }
    return plotA.localeCompare(plotB);
  });

  sortedPlotIds.forEach((plotId) => {
    const neighborIds = Array.from(adjacencyMap?.get(plotId) || []);
    const neighborColorIndexes = neighborIds
      .map((neighborId) => colorIndexByPlotId.get(neighborId))
      .filter((index): index is number => index !== undefined);

    let bestColorIndex = 0;
    let bestScore = -Infinity;

    for (let index = 0; index < palette.length; index++) {
      const candidate = palette[index];
      const neighborDistances = neighborColorIndexes.map((neighborColorIndex) =>
        colorDistance(candidate, palette[neighborColorIndex])
      );
      const minNeighborDistance =
        neighborDistances.length > 0 ? Math.min(...neighborDistances) : 255;
      const meanNeighborDistance =
        neighborDistances.length > 0
          ? neighborDistances.reduce((sum, distance) => sum + distance, 0) / neighborDistances.length
          : 255;
      const reusePenalty = usageCount[index] * 15;
      const score = minNeighborDistance * 2.4 + meanNeighborDistance * 0.8 - reusePenalty;

      if (score > bestScore) {
        bestScore = score;
        bestColorIndex = index;
      }
    }

    colorIndexByPlotId.set(plotId, bestColorIndex);
    usageCount[bestColorIndex] += 1;
  });

  uniquePlotIds.forEach((plotId) => {
    const colorIndex = colorIndexByPlotId.get(plotId) || 0;
    out.set(plotId, buildPlotColor(palette[colorIndex]));
  });

  return out;
}
