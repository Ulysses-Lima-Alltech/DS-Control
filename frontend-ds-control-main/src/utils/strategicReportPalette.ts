export type StrategicFarmColor = {
  fill: string;
  stroke: string;
};

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

export function buildStrategicFarmColorMap(farmIds: string[]): Map<string, StrategicFarmColor> {
  const map = new Map<string, StrategicFarmColor>();
  farmIds.forEach((farmId, index) => {
    map.set(farmId, STRATEGIC_FARM_COLORS[index % STRATEGIC_FARM_COLORS.length]);
  });
  return map;
}
