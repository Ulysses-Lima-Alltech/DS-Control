import { describe, expect, it } from 'vitest';

import { assertCustomerScope, resolveCustomerScope } from './customer-scope';

describe('customer scope', () => {
  const farmer = {
    type: 'farmer' as const,
    customerId: '11111111-1111-4111-8111-111111111111',
  };

  it('derives farmer scope from the authenticated user', () => {
    expect(resolveCustomerScope(farmer)).toBe(farmer.customerId);
    expect(resolveCustomerScope(farmer, farmer.customerId)).toBe(farmer.customerId);
  });

  it('rejects a client-provided customer outside the authenticated farmer scope', () => {
    expect(() =>
      resolveCustomerScope(farmer, '22222222-2222-4222-8222-222222222222'),
    ).toThrow('Acesso não permitido');
  });

  it('rejects a farmer without a customer association', () => {
    expect(() => resolveCustomerScope({ type: 'farmer', customerId: null })).toThrow(
      'sem cliente associado',
    );
  });

  it('hides cross-customer resources from farmers', () => {
    expect(() =>
      assertCustomerScope(farmer, '22222222-2222-4222-8222-222222222222'),
    ).toThrow('Recurso não encontrado');
    expect(() => assertCustomerScope(farmer, farmer.customerId)).not.toThrow();
  });

  it('keeps explicit administrative filters unchanged', () => {
    const requested = '22222222-2222-4222-8222-222222222222';
    expect(resolveCustomerScope({ type: 'backoffice', customerId: null }, requested)).toBe(
      requested,
    );
  });
});
