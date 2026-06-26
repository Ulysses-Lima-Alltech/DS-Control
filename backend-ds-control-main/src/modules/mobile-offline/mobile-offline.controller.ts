import AppError from "@common/handlers/app-error";
import type { FastifyReply, FastifyRequest } from "fastify";
import { MobileOfflineService } from "./mobile-offline.service";

export class MobileOfflineController {
  private readonly service = new MobileOfflineService();

  public bootstrap = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const bootstrap = await this.service.getBootstrap(request.payload?.userId!);
      return reply.status(200).send(bootstrap);
    } catch (error) {
      if (error instanceof AppError) {
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };

  public sync = async (
    request: FastifyRequest<{ Querystring: { since?: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      const bootstrap = await this.service.getBootstrap(request.payload?.userId!);
      return reply.status(200).send({
        ...bootstrap,
        since: request.query.since ?? null,
        incremental: false,
      });
    } catch (error) {
      if (error instanceof AppError) {
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };
}
