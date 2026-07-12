import AppError from "@common/handlers/app-error";
import { HTTP_STATUS_CODES } from "@common/types/http-status.types";
import type { FastifyReply, FastifyRequest } from "fastify";

export async function BackofficeOnly(request: FastifyRequest, reply: FastifyReply) {
  if (request.payload?.type !== "backoffice") {
    const error = new AppError("Acesso permitido apenas para administradores", HTTP_STATUS_CODES.FORBIDDEN);
    return reply.status(error.statusCode).send(error.throw());
  }
}
