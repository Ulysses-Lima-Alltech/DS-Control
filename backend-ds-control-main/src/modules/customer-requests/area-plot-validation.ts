import AppError from '@common/handlers/app-error';
import { HTTP_STATUS_CODES } from '@common/types/http-status.types';

type PlotValidationStatus = 'PENDING' | 'VALID' | 'INVALID' | 'EXCLUDED';

export function resolveAreaPlotValidationStatus(
  current: PlotValidationStatus,
  validationErrors: unknown,
  excluded: boolean | undefined,
): PlotValidationStatus {
  if (excluded === undefined) return current;
  if (excluded) return 'EXCLUDED';
  if (Array.isArray(validationErrors) && validationErrors.length > 0) {
    throw new AppError(
      'Talhão com erro de geometria não pode ser reincluído',
      HTTP_STATUS_CODES.CONFLICT,
    );
  }
  return 'VALID';
}
