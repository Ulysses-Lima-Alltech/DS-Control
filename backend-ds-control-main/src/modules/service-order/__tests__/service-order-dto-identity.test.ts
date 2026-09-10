import { describe, expect, it } from 'vitest';

import { CreateServiceOrderSchema } from '../dto/create-service-order';
import { UpdateServiceOrderSchema } from '../dto/update-service-order.dto';

const FARM_ID = '11111111-1111-4111-8111-111111111111';
const PLOT_ID = '22222222-2222-4222-8222-222222222222';
const PILOT_ID = '33333333-3333-4333-8333-333333333333';
const CUSTOMER_ID = '44444444-4444-4444-8444-444444444444';
const CONTRACT_ID = '55555555-5555-4555-8555-555555555555';

describe('service-order DTO identity normalization', () => {
  it('normalizes repeated relationship ids on update', () => {
    expect(
      UpdateServiceOrderSchema.parse({
        farmsIds: [FARM_ID, FARM_ID],
        plotsIds: [PLOT_ID, PLOT_ID],
        pilotsIds: [PILOT_ID, PILOT_ID],
      }),
    ).toEqual({ farmsIds: [FARM_ID], plotsIds: [PLOT_ID], pilotsIds: [PILOT_ID] });
  });

  it('normalizes repeated relationship ids on creation', () => {
    const result = CreateServiceOrderSchema.parse({
      customerId: CUSTOMER_ID,
      contractId: CONTRACT_ID,
      farmsIds: [FARM_ID, FARM_ID],
      plotsIds: [PLOT_ID, PLOT_ID],
      pilotsIds: [PILOT_ID, PILOT_ID],
      plannedDate: '2026-09-10',
    });

    expect(result.farmsIds).toEqual([FARM_ID]);
    expect(result.plotsIds).toEqual([PLOT_ID]);
    expect(result.pilotsIds).toEqual([PILOT_ID]);
  });
});
