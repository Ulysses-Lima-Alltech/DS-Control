import { HTTP_STATUS_CODES } from '@common/types/http-status.types';

export default class AppError extends Error {
  public readonly message: string;

  public readonly statusCode: number;

  public readonly details: string | undefined;

  public readonly error?: unknown;

  constructor(
    message: string,
    statusCode = HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
    error?: unknown,
    details?: string,
  ) {
    super(message);
    this.message = message;
    this.statusCode = statusCode;
    this.details = details;
    this.error = error;
  }

  public throw() {
    return {
      statusCode: this.statusCode,
      message: this.message,
      details: this.details,
      error: this.error,
    };
  }
}
