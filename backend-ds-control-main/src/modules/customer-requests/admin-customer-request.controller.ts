import AppError from '@common/handlers/app-error';
import type { FastifyReply, FastifyRequest } from 'fastify';

import type {
  AdminCustomerRequestListQuery,
  AdminRequestParams,
  ApproveCustomerRequestDTO,
  ReviewReasonDTO,
} from './customer-request.dto';
import { AdminCustomerRequestService } from './admin-customer-request.service';

export class AdminCustomerRequestController {
  private readonly service = new AdminCustomerRequestService();

  private identity(request: FastifyRequest) {
    return { userId: request.payload!.userId };
  }

  private handleError(reply: FastifyReply, error: unknown) {
    if (error instanceof AppError) return reply.status(error.statusCode).send(error.throw());
    return reply.status(500).send(new AppError('Internal server error', 500).throw());
  }

  public list = async (
    request: FastifyRequest<{ Querystring: AdminCustomerRequestListQuery }>,
    reply: FastifyReply,
  ) => {
    try {
      return reply.status(200).send(await this.service.list(request.query));
    } catch (error) {
      return this.handleError(reply, error);
    }
  };

  public get = async (
    request: FastifyRequest<{ Params: AdminRequestParams }>,
    reply: FastifyReply,
  ) => {
    try {
      return reply.status(200).send(await this.service.get(request.params));
    } catch (error) {
      return this.handleError(reply, error);
    }
  };

  public requestChanges = async (
    request: FastifyRequest<{ Params: AdminRequestParams; Body: ReviewReasonDTO }>,
    reply: FastifyReply,
  ) => {
    try {
      return reply
        .status(200)
        .send(
          await this.service.requestChanges(
            this.identity(request),
            request.params,
            request.body.reason,
          ),
        );
    } catch (error) {
      return this.handleError(reply, error);
    }
  };

  public reject = async (
    request: FastifyRequest<{ Params: AdminRequestParams; Body: ReviewReasonDTO }>,
    reply: FastifyReply,
  ) => {
    try {
      return reply
        .status(200)
        .send(
          await this.service.reject(this.identity(request), request.params, request.body.reason),
        );
    } catch (error) {
      return this.handleError(reply, error);
    }
  };

  public approve = async (
    request: FastifyRequest<{ Params: AdminRequestParams; Body: ApproveCustomerRequestDTO }>,
    reply: FastifyReply,
  ) => {
    try {
      return reply
        .status(200)
        .send(await this.service.approve(this.identity(request), request.params, request.body));
    } catch (error) {
      return this.handleError(reply, error);
    }
  };
}
