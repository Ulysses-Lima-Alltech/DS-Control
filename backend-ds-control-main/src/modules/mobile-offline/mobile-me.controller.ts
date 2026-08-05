import AppError from '@common/handlers/app-error';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { MobileMeService } from './mobile-me.service';

export class MobileMeController {
  private readonly service = new MobileMeService();

  public pilotSummary = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const summary = await this.service.getPilotSummary(
        request.payload!.userId,
        request.payload!.type,
      );
      return reply.status(200).send(summary);
    } catch (error) {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send(error.throw());
      }

      return reply.status(500).send(new AppError('Internal server error', 500, error).throw());
    }
  };
}
