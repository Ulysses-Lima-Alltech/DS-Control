import { describe, expect, it, vi } from 'vitest';

import { FarmerOnly } from './farmer-only-middleware';

describe('FarmerOnly', () => {
  it('allows a farmer linked to a customer', async () => {
    const status = vi.fn();
    await FarmerOnly(
      { payload: { type: 'farmer', customerId: 'customer-id' } } as never,
      { status } as never,
    );
    expect(status).not.toHaveBeenCalled();
  });

  it.each([
    { type: 'pilot', customerId: null },
    { type: 'backoffice', customerId: null },
    { type: 'farmer', customerId: null },
  ])('rejects non-customer identity %#', async (payload) => {
    const send = vi.fn();
    const status = vi.fn(() => ({ send }));
    await FarmerOnly({ payload } as never, { status } as never);
    expect(status).toHaveBeenCalledWith(403);
  });
});
