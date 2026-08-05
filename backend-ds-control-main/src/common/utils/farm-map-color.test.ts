import { describe, expect, it } from 'vitest';
import {
  deriveAutomaticFarmMapColor,
  deriveFarmStrokeColor,
  resolveFarmMapColor,
} from './farm-map-color';
import { backfillFarmMapColors } from '../../../scripts/backfill-farm-map-colors';

describe('farm map colors', () => {
  it('keeps the backfill import side-effect free', () => {
    expect(backfillFarmMapColors).toBeTypeOf('function');
  });
  it('uses stable automatic colors independent of collection order', () => {
    expect(deriveAutomaticFarmMapColor('00000000-0000-0000-0000-000000000001')).toBe('#94A3B8');
    expect(deriveAutomaticFarmMapColor('00000000-0000-0000-0000-000000000002')).toBe('#F59E0B');
  });

  it('normalizes a persisted color and falls back for old records', () => {
    expect(resolveFarmMapColor({ id: 'farm-a', mapColor: '#71a780' })).toBe('#71A780');
    expect(resolveFarmMapColor({ id: 'farm-a' })).toBe(deriveAutomaticFarmMapColor('farm-a'));
    expect(resolveFarmMapColor({ id: 'farm-a', mapColor: '#fff' })).toBe(
      deriveAutomaticFarmMapColor('farm-a'),
    );
  });

  it('derives a stable darker stroke', () => {
    expect(deriveFarmStrokeColor('#71A780')).toBe('#4B6E54');
  });
});
