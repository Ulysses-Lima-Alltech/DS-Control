import AppError from '@common/handlers/app-error';
import { HTTP_STATUS_CODES } from '@common/types/http-status.types';

export const CUSTOMER_REQUEST_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'PARSING',
  'UNDER_REVIEW',
  'CHANGES_REQUESTED',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
] as const;

export type CustomerRequestStatus = (typeof CUSTOMER_REQUEST_STATUSES)[number];

const ALLOWED_TRANSITIONS: Readonly<Record<CustomerRequestStatus, readonly CustomerRequestStatus[]>> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['PARSING', 'CANCELLED'],
  PARSING: ['UNDER_REVIEW', 'CHANGES_REQUESTED'],
  UNDER_REVIEW: ['CHANGES_REQUESTED', 'APPROVED', 'REJECTED'],
  CHANGES_REQUESTED: ['SUBMITTED'],
  APPROVED: [],
  REJECTED: [],
  CANCELLED: [],
};

export function canTransitionCustomerRequest(
  from: CustomerRequestStatus,
  to: CustomerRequestStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertCustomerRequestTransition(
  from: CustomerRequestStatus,
  to: CustomerRequestStatus,
): void {
  if (!canTransitionCustomerRequest(from, to)) {
    throw new AppError(
      `Transição de solicitação inválida: ${from} -> ${to}`,
      HTTP_STATUS_CODES.CONFLICT,
    );
  }
}
