import AppError from '@common/handlers/app-error';
import { HTTP_STATUS_CODES } from '@common/types/http-status.types';

export type AuthenticatedCustomerScope = {
  type: 'backoffice' | 'pilot' | 'farmer';
  customerId?: string | null;
};

export function resolveCustomerScope(
  payload: AuthenticatedCustomerScope | undefined,
  requestedCustomerId?: string,
): string | undefined {
  if (payload?.type !== 'farmer') return requestedCustomerId;

  if (!payload.customerId) {
    throw new AppError(
      'Usuário farmer sem cliente associado',
      HTTP_STATUS_CODES.FORBIDDEN,
    );
  }

  if (requestedCustomerId && requestedCustomerId !== payload.customerId) {
    throw new AppError(
      'Acesso não permitido para este cliente',
      HTTP_STATUS_CODES.FORBIDDEN,
    );
  }

  return payload.customerId;
}

export function assertCustomerScope(
  payload: AuthenticatedCustomerScope | undefined,
  resourceCustomerId: string | null | undefined,
): void {
  const customerId = resolveCustomerScope(payload);
  if (customerId && resourceCustomerId !== customerId) {
    throw new AppError('Recurso não encontrado', HTTP_STATUS_CODES.NOT_FOUND);
  }
}
