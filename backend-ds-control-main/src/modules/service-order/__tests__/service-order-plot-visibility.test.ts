import { describe, expect, it, vi } from 'vitest';

vi.mock('@infra/database', () => ({ db: {} }));
vi.mock('@infra/database/schema', () => ({
  applications: {},
  customers: {},
  plots: {},
  serviceOrderFarms: {},
  serviceOrderPilots: {},
  serviceOrderPlots: {},
  serviceOrders: {},
}));

import { ServiceOrderRepository } from '@repositories/service-order/service-order.repository';

const SERVICE_ORDER_ID = '11111111-1111-4111-8111-111111111111';
const PLOT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('service order plot visibility after a farm KML re-upload', () => {
  it('keeps a plot linked via service_order_plots even after the plot itself is soft-deleted', () => {
    // Reproduces: OS created with a plot, then updatePlotsForFarm() runs with a new
    // KML that no longer contains that plot's externalId, soft-deleting the plot row
    // (deletedAt gets set) without ever touching the service_order_plots link.
    const repository = new ServiceOrderRepository() as unknown as {
      mapActiveServiceOrderPlots: (
        serviceOrderPlots?: Array<Record<string, unknown>>,
      ) => Array<Record<string, unknown>>;
    };

    const serviceOrderPlots = [
      {
        serviceOrderId: SERVICE_ORDER_ID,
        plotId: PLOT_ID,
        status: 'PENDING' as const,
        completedAt: null,
        completedBy: null,
        plot: {
          id: PLOT_ID,
          name: 'Talhão 18A',
          hectare: '46.85',
          farmId: 'farm-1',
          externalId: 'ext-18a',
          deletedAt: new Date('2026-08-30T00:00:00Z'),
        },
      },
    ];

    const result = repository.mapActiveServiceOrderPlots(serviceOrderPlots);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: PLOT_ID, status: 'PENDING' });
  });

  it('still omits an association whose plot relation is missing entirely', () => {
    const repository = new ServiceOrderRepository() as unknown as {
      mapActiveServiceOrderPlots: (
        serviceOrderPlots?: Array<Record<string, unknown>>,
      ) => Array<Record<string, unknown>>;
    };

    const result = repository.mapActiveServiceOrderPlots([
      { serviceOrderId: SERVICE_ORDER_ID, plotId: PLOT_ID, status: 'PENDING', plot: null },
    ]);

    expect(result).toHaveLength(0);
  });
});
