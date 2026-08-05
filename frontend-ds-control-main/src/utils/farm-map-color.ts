export const FARM_MAP_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export const FARM_MAP_COLOR_PALETTE = [
  '#38BDF8',
  '#34D399',
  '#FBBF24',
  '#A78BFA',
  '#F97316',
  '#2DD4BF',
  '#4ADE80',
  '#22D3EE',
  '#94A3B8',
  '#F59E0B',
] as const;

export type FarmColorSource = { id: string; mapColor?: string | null };

export function deriveAutomaticFarmMapColor(farmId: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < farmId.length; index += 1) {
    hash ^= farmId.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return FARM_MAP_COLOR_PALETTE[(hash >>> 0) % FARM_MAP_COLOR_PALETTE.length];
}

export function resolveFarmMapColor(farm: FarmColorSource): string {
  return farm.mapColor && FARM_MAP_COLOR_PATTERN.test(farm.mapColor)
    ? farm.mapColor.toUpperCase()
    : deriveAutomaticFarmMapColor(farm.id);
}

export function deriveFarmStrokeColor(mapColor: string): string {
  const color = FARM_MAP_COLOR_PATTERN.test(mapColor) ? mapColor.slice(1) : '64748B';
  const channel = (offset: number) =>
    Math.round(Number.parseInt(color.slice(offset, offset + 2), 16) * 0.66)
      .toString(16)
      .padStart(2, '0');
  return `#${channel(0)}${channel(2)}${channel(4)}`.toUpperCase();
}

export function getFarmMapColorWarnings(mapColor: string, siblingColors: string[] = []): string[] {
  if (!FARM_MAP_COLOR_PATTERN.test(mapColor)) return [];
  const channels = [1, 3, 5].map((offset) =>
    Number.parseInt(mapColor.slice(offset, offset + 2), 16)
  );
  const luminance = (0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]) / 255;
  const warnings: string[] = [];
  if (luminance > 0.86)
    warnings.push('Cor muito clara; o contorno escuro será usado para contraste.');
  if (siblingColors.some((color) => color.toUpperCase() === mapColor.toUpperCase())) {
    warnings.push('Outra fazenda deste cliente já utiliza esta cor.');
  }
  return warnings;
}
