import { describe, expect, it } from 'vitest';
import { UpdateServiceOrderPlotStatusSchema } from '../dto/update-service-order-plot-status.dto';
import {
  buildServiceOrderPlotStatusUpdate,
  calculateOfficialPlotProgress,
} from '../service-order-plot-status';

describe('official service order plot status', () => {
  const userId = '2813b99f-b2f0-400c-a8ec-7de63afcf3b2';
  const now = new Date('2026-07-14T15:00:00.000Z');

  it.each(['PENDING', 'COMPLETED', 'CANCELLED'] as const)('accepts %s', (status) => {
    expect(UpdateServiceOrderPlotStatusSchema.parse({ status })).toEqual({ status });
  });

  it('accepts an optional override reason with at least 10 characters', () => {
    expect(
      UpdateServiceOrderPlotStatusSchema.parse({
        status: 'COMPLETED',
        reason: 'Cobertura confirmada em campo',
      }),
    ).toEqual({ status: 'COMPLETED', reason: 'Cobertura confirmada em campo' });
  });

  it('rejects an override reason shorter than 10 characters', () => {
    expect(() =>
      UpdateServiceOrderPlotStatusSchema.parse({ status: 'COMPLETED', reason: 'curto' }),
    ).toThrow();
  });

  it('fills completedAt and completedBy only when completed', () => {
    expect(buildServiceOrderPlotStatusUpdate('COMPLETED', userId, null, now)).toEqual({
      status: 'COMPLETED',
      completedAt: now,
      completedBy: userId,
      manualOverride: false,
      overrideReason: null,
      updatedAt: now,
    });
    expect(buildServiceOrderPlotStatusUpdate('PENDING', userId, null, now)).toMatchObject({
      status: 'PENDING',
      completedAt: null,
      completedBy: null,
      manualOverride: false,
      overrideReason: null,
    });
    expect(buildServiceOrderPlotStatusUpdate('CANCELLED', userId, null, now)).toMatchObject({
      status: 'CANCELLED',
      completedAt: null,
      completedBy: null,
      manualOverride: false,
      overrideReason: null,
    });
  });

  it('records the manual override reason when the status is forced', () => {
    expect(
      buildServiceOrderPlotStatusUpdate(
        'COMPLETED',
        userId,
        'Talhão pulverizado em 3 passadas separadas (mapa dividido); cobertura real confirmada em campo.',
        now,
      ),
    ).toEqual({
      status: 'COMPLETED',
      completedAt: now,
      completedBy: userId,
      manualOverride: true,
      overrideReason:
        'Talhão pulverizado em 3 passadas separadas (mapa dividido); cobertura real confirmada em campo.',
      updatedAt: now,
    });
  });

  it('does not use applications and does not duplicate a plot in official totals', () => {
    expect(
      calculateOfficialPlotProgress([
        { plotId: 'plot-1', status: 'COMPLETED', hectare: '10.50' },
        { plotId: 'plot-1', status: 'COMPLETED', hectare: '10.50' },
        { plotId: 'plot-2', status: 'PENDING', hectare: '5.25' },
        { plotId: 'plot-3', status: 'CANCELLED', hectare: '2.00' },
      ]),
    ).toEqual({
      plannedHectares: 17.75,
      completedHectares: 10.5,
      pendingHectares: 5.25,
      completedPlots: 1,
      pendingPlots: 1,
      progressPercent: 59.15,
    });
  });

  it('matches the confirmed OS 142 totals', () => {
    const result = calculateOfficialPlotProgress([
      { plotId: 'completed', status: 'COMPLETED', hectare: 1131.03 },
      { plotId: 'pending', status: 'PENDING', hectare: 991.29 },
    ]);
    expect(result).toMatchObject({
      plannedHectares: 2122.32,
      completedHectares: 1131.03,
      pendingHectares: 991.29,
    });
  });
});
