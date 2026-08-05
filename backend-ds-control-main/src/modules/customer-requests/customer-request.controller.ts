import AppError from '@common/handlers/app-error';
import type { FastifyReply, FastifyRequest } from 'fastify';

import type {
  CreateAreaSubmissionRequestDTO,
  CompleteKmlUploadDTO,
  CreateServiceOrderRequestDTO,
  CustomerRequestListQuery,
  PrepareKmlUploadDTO,
  UpdateAreaSubmissionPlotDTO,
} from './customer-request.dto';
import { CustomerRequestService } from './customer-request.service';
import { CustomerRequestStorageService } from './customer-request-storage.service';

type RequestIdParams = { id: string };
type RequestPlotParams = { id: string; plotId: string };

export class CustomerRequestController {
  private readonly service = new CustomerRequestService();
  private readonly storageService = new CustomerRequestStorageService();

  private identity(request: FastifyRequest) {
    return {
      userId: request.payload!.userId,
      customerId: request.payload!.customerId!,
    };
  }

  private handleError(reply: FastifyReply, error: unknown) {
    if (error instanceof AppError) return reply.status(error.statusCode).send(error.throw());
    return reply.status(500).send(new AppError('Internal server error', 500).throw());
  }

  public createServiceOrder = async (
    request: FastifyRequest<{ Body: CreateServiceOrderRequestDTO }>,
    reply: FastifyReply,
  ) => {
    try {
      const data = await this.service.createServiceOrderRequest(
        this.identity(request),
        request.body,
      );
      return reply.status(201).send({ message: 'Solicitação criada', data });
    } catch (error) {
      return this.handleError(reply, error);
    }
  };

  public listServiceOrders = async (
    request: FastifyRequest<{ Querystring: CustomerRequestListQuery }>,
    reply: FastifyReply,
  ) => {
    try {
      return reply
        .status(200)
        .send(await this.service.listServiceOrderRequests(this.identity(request), request.query));
    } catch (error) {
      return this.handleError(reply, error);
    }
  };

  public getServiceOrder = async (
    request: FastifyRequest<{ Params: RequestIdParams }>,
    reply: FastifyReply,
  ) => {
    try {
      return reply
        .status(200)
        .send(await this.service.getServiceOrderRequest(this.identity(request), request.params.id));
    } catch (error) {
      return this.handleError(reply, error);
    }
  };

  public submitServiceOrder = async (
    request: FastifyRequest<{ Params: RequestIdParams }>,
    reply: FastifyReply,
  ) => {
    try {
      return reply
        .status(200)
        .send(
          await this.service.submitServiceOrderRequest(this.identity(request), request.params.id),
        );
    } catch (error) {
      return this.handleError(reply, error);
    }
  };

  public cancelServiceOrder = async (
    request: FastifyRequest<{ Params: RequestIdParams }>,
    reply: FastifyReply,
  ) => {
    try {
      return reply
        .status(200)
        .send(
          await this.service.cancelServiceOrderRequest(this.identity(request), request.params.id),
        );
    } catch (error) {
      return this.handleError(reply, error);
    }
  };

  public createArea = async (
    request: FastifyRequest<{ Body: CreateAreaSubmissionRequestDTO }>,
    reply: FastifyReply,
  ) => {
    try {
      const data = await this.service.createAreaSubmissionRequest(
        this.identity(request),
        request.body,
      );
      return reply.status(201).send({ message: 'Solicitação criada', data });
    } catch (error) {
      return this.handleError(reply, error);
    }
  };

  public listAreas = async (
    request: FastifyRequest<{ Querystring: CustomerRequestListQuery }>,
    reply: FastifyReply,
  ) => {
    try {
      return reply
        .status(200)
        .send(await this.service.listAreaSubmissionRequests(this.identity(request), request.query));
    } catch (error) {
      return this.handleError(reply, error);
    }
  };

  public getArea = async (
    request: FastifyRequest<{ Params: RequestIdParams }>,
    reply: FastifyReply,
  ) => {
    try {
      return reply
        .status(200)
        .send(
          await this.service.getAreaSubmissionRequest(this.identity(request), request.params.id),
        );
    } catch (error) {
      return this.handleError(reply, error);
    }
  };

  public updateAreaPlot = async (
    request: FastifyRequest<{ Params: RequestPlotParams; Body: UpdateAreaSubmissionPlotDTO }>,
    reply: FastifyReply,
  ) => {
    try {
      return reply
        .status(200)
        .send(
          await this.service.updateAreaSubmissionPlot(
            this.identity(request),
            request.params.id,
            request.params.plotId,
            request.body,
          ),
        );
    } catch (error) {
      return this.handleError(reply, error);
    }
  };

  public prepareAreaUpload = async (
    request: FastifyRequest<{ Params: RequestIdParams; Body: PrepareKmlUploadDTO }>,
    reply: FastifyReply,
  ) => {
    try {
      return reply
        .status(201)
        .send(
          await this.storageService.prepareUpload(
            this.identity(request),
            request.params.id,
            request.body,
          ),
        );
    } catch (error) {
      return this.handleError(reply, error);
    }
  };

  public completeAreaUpload = async (
    request: FastifyRequest<{ Params: RequestIdParams; Body: CompleteKmlUploadDTO }>,
    reply: FastifyReply,
  ) => {
    try {
      return reply
        .status(200)
        .send(
          await this.storageService.completeUpload(
            this.identity(request),
            request.params.id,
            request.body,
          ),
        );
    } catch (error) {
      return this.handleError(reply, error);
    }
  };

  public submitArea = async (
    request: FastifyRequest<{ Params: RequestIdParams }>,
    reply: FastifyReply,
  ) => {
    try {
      return reply
        .status(200)
        .send(
          await this.service.submitAreaSubmissionRequest(this.identity(request), request.params.id),
        );
    } catch (error) {
      return this.handleError(reply, error);
    }
  };

  public cancelArea = async (
    request: FastifyRequest<{ Params: RequestIdParams }>,
    reply: FastifyReply,
  ) => {
    try {
      return reply
        .status(200)
        .send(
          await this.service.cancelAreaSubmissionRequest(this.identity(request), request.params.id),
        );
    } catch (error) {
      return this.handleError(reply, error);
    }
  };
}
