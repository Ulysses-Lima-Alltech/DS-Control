import AppError from '@common/handlers/app-error';
import { HTTP_STATUS_CODES } from '@common/types/http-status.types';
import type { FastifyReply, FastifyRequest } from 'fastify';

export async function FarmerOnly(request: FastifyRequest, reply: FastifyReply) {
  if (request.payload?.type !== 'farmer' || !request.payload.customerId) {
    const error = new AppError(
      'Acesso permitido apenas para clientes farmer vinculados',
      HTTP_STATUS_CODES.FORBIDDEN,
    );
    return reply.status(error.statusCode).send(error.throw());
  }
}
