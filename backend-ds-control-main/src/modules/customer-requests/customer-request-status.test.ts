import { describe, expect, it } from 'vitest';

import {
  assertCustomerRequestTransition,
  canTransitionCustomerRequest,
  type CustomerRequestStatus,
} from './customer-request-status';

describe('customer request status transitions', () => {
  const allowed: Array<[CustomerRequestStatus, CustomerRequestStatus]> = [
    ['DRAFT', 'SUBMITTED'],
    ['DRAFT', 'CANCELLED'],
    ['SUBMITTED', 'PARSING'],
    ['SUBMITTED', 'CANCELLED'],
    ['PARSING', 'UNDER_REVIEW'],
    ['PARSING', 'CHANGES_REQUESTED'],
    ['UNDER_REVIEW', 'CHANGES_REQUESTED'],
    ['UNDER_REVIEW', 'APPROVED'],
    ['UNDER_REVIEW', 'REJECTED'],
    ['CHANGES_REQUESTED', 'SUBMITTED'],
  ];

  it.each(allowed)('allows %s -> %s', (from, to) => {
    expect(canTransitionCustomerRequest(from, to)).toBe(true);
    expect(() => assertCustomerRequestTransition(from, to)).not.toThrow();
  });

  it.each([
    ['APPROVED', 'APPROVED'],
    ['APPROVED', 'UNDER_REVIEW'],
    ['REJECTED', 'APPROVED'],
    ['CANCELLED', 'SUBMITTED'],
    ['DRAFT', 'APPROVED'],
    ['SUBMITTED', 'APPROVED'],
  ] as Array<[CustomerRequestStatus, CustomerRequestStatus]>)('rejects %s -> %s', (from, to) => {
    expect(canTransitionCustomerRequest(from, to)).toBe(false);
    expect(() => assertCustomerRequestTransition(from, to)).toThrow(
      'Transição de solicitação inválida',
    );
  });
});
