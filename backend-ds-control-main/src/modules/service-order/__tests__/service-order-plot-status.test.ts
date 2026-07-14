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

  it('fills completedAt and completedBy only when completed', () => {
    expect(buildServiceOrderPlotStatusUpdate('COMPLETED', userId, now)).toEqual({
      status: 'COMPLETED',
      completedAt: now,
      completedBy: userId,
      updatedAt: now,
    });
    expect(buildServiceOrderPlotStatusUpdate('PENDING', userId, now)).toMatchObject({
      status: 'PENDING',
      completedAt: null,
      completedBy: null,
    });
    expect(buildServiceOrderPlotStatusUpdate('CANCELLED', userId, now)).toMatchObject({
      status: 'CANCELLED',
      completedAt: null,
      completedBy: null,
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
