import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateServiceOrder = vi.fn();

vi.mock('@modules/app/app.module', () => ({
  app: {
    log: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  },
}));

vi.mock('../service-order.service', () => ({
  ServiceOrderService: function MockServiceOrderService() {
    return {
      createServiceOrder: mockCreateServiceOrder,
    };
  },
}));

import type { FastifyReply, FastifyRequest } from 'fastify';
import { ServiceOrderController } from '../service-order.controller';

function createReplyMock() {
  const send = vi.fn();
  const status = vi.fn().mockReturnValue({ send });
  return { send, status, reply: { status } as unknown as FastifyReply };
}

const ownCustomerId = '11111111-1111-4111-8111-111111111111';
const otherCustomerId = '22222222-2222-4222-8222-222222222222';
const farmId = '33333333-3333-4333-8333-333333333333';
const contractId = '44444444-4444-4444-8444-444444444444';
const pilotId = '55555555-5555-4555-8555-555555555555';

describe('ServiceOrderController.createServiceOrder — autorização por papel', () => {
  let controller: ServiceOrderController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new ServiceOrderController();
  });

  it('permite backoffice criar OS sem alterar o corpo da requisição', async () => {
    mockCreateServiceOrder.mockResolvedValue(undefined);
    const { status, reply } = createReplyMock();
    const body = {
      farmsIds: [farmId],
      customerId: ownCustomerId,
      contractId,
      plannedDate: '2026-08-20',
      pilotsIds: [pilotId],
      plotsIds: [],
    };
    const request = {
      body,
      payload: { type: 'backoffice' },
    } as unknown as FastifyRequest;

    await controller.createServiceOrder(request as never, reply);

    expect(mockCreateServiceOrder).toHaveBeenCalledWith(body);
    expect(status).toHaveBeenCalledWith(201);
  });

  it('força customerId do farmer autenticado e zera pilotsIds enviados', async () => {
    mockCreateServiceOrder.mockResolvedValue(undefined);
    const { status, reply } = createReplyMock();
    const body = {
      farmsIds: [farmId],
      customerId: ownCustomerId,
      contractId,
      plannedDate: '2026-08-20',
      pilotsIds: [pilotId],
      plotsIds: [],
    };
    const request = {
      body,
      payload: { type: 'farmer', customerId: ownCustomerId },
    } as unknown as FastifyRequest;

    await controller.createServiceOrder(request as never, reply);

    expect(mockCreateServiceOrder).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: ownCustomerId, pilotsIds: [] }),
    );
    expect(status).toHaveBeenCalledWith(201);
  });

  it('rejeita farmer tentando criar OS para outro cliente', async () => {
    const { status, reply } = createReplyMock();
    const body = {
      farmsIds: [farmId],
      customerId: otherCustomerId,
      contractId,
      plannedDate: '2026-08-20',
      pilotsIds: [],
      plotsIds: [],
    };
    const request = {
      body,
      payload: { type: 'farmer', customerId: ownCustomerId },
    } as unknown as FastifyRequest;

    await controller.createServiceOrder(request as never, reply);

    expect(status).toHaveBeenCalledWith(403);
    expect(mockCreateServiceOrder).not.toHaveBeenCalled();
  });

  it('rejeita usuário piloto tentando criar OS', async () => {
    const { status, reply } = createReplyMock();
    const body = {
      farmsIds: [farmId],
      customerId: ownCustomerId,
      contractId,
      plannedDate: '2026-08-20',
      pilotsIds: [],
      plotsIds: [],
    };
    const request = {
      body,
      payload: { type: 'pilot', customerId: null },
    } as unknown as FastifyRequest;

    await controller.createServiceOrder(request as never, reply);

    expect(status).toHaveBeenCalledWith(403);
    expect(mockCreateServiceOrder).not.toHaveBeenCalled();
  });
});
