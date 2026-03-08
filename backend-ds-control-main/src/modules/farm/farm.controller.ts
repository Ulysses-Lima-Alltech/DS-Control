import type { FastifyReply, FastifyRequest } from 'fastify';
import type { CreateFarmDTO } from './dto/create-farm.dto';
import type { UpdateFarmDTO } from './dto/update-farm.dto';

import AppError from '@common/handlers/app-error';
import type { PaginatedRequestQueryString } from '@common/types/paginated-request.types';
import { FarmVM } from '@models/farm.vm';
import { app } from '@modules/app/app.module';
import type { GetAllFarmsQueryString } from './dto/get-all-farms.dto';
import type { GetFarmByIdQueryString } from './dto/get-farm-by-id.dto';
import type { FarmSearchQueryString } from './dto/list-all-farms.dto';
import { FarmService } from './services/farm.service';

export class FarmController {
  private service: FarmService;

  constructor() {
    this.service = new FarmService();
  }

  public createFarm = async (
    request: FastifyRequest<{
      Body: CreateFarmDTO;
    }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info(
        '[FarmController] - Starting farm creation for customer %s',
        request.body.customerId,
      );

      await this.service.createFarm(request.body);

      app.log.info('[FarmController] - Farm created successfully');
      return reply.status(201).send({
        message: 'Farm created successfully',
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn('[FarmController] - Farm creation failed: %s', error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error('[FarmController] - Unexpected error during farm creation: %o', {
        error,
      });
      reply.status(500).send(new AppError('Internal server error', 500, error).throw());
    }
  };

  public listFarms = async (
    request: FastifyRequest<{
      Querystring: FarmSearchQueryString;
    }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info('[FarmController] - Listing farms');

      const result = await this.service.listFarms(request.query);

      app.log.info('[FarmController] - Successfully listed farms');
      return reply.status(200).send({
        message: 'Farms listed successfully',
        ...result,
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn('[FarmController] - Failed to list farms: %s', error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error('[FarmController] - Unexpected error during farm listing: %o', { error });
      reply.status(500).send(new AppError('Internal server error', 500, error).throw());
    }
  };

  public getAllFarms = async (
    request: FastifyRequest<{
      Querystring: GetAllFarmsQueryString;
    }>,
    reply: FastifyReply,
  ) => {
    try {
      const { farmId, customerId } = request.query;

      app.log.info(
        '[FarmController] - Fetching farms with farmId=%s and customerId=%s',
        farmId ?? '',
        customerId ?? '',
      );
      const farms = await this.service.getAllFarms(
        request.query.includePlots,
        request.query.includeGeoJson,
        request.query.includeCustomer,
        farmId,
        customerId,
        request.query.orderBy,
        request.query.orderType
      );

      app.log.info('[FarmController] -  Sucessfully retrived farm details');
      return reply.status(200).send({
        message: 'Farm details retived sucessfully',
        farms,
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn('[FarmController] - Failed to list farms: %s', error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error('[FarmController] - Unexpected error during farm listing: %o', {
        error,
      });
      reply.status(500).send(new AppError('Internal server error', 500, error).throw());
    }
  };

  public getFarmById = async (
    request: FastifyRequest<{ Params: { id: string }; Querystring: GetFarmByIdQueryString }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info('[FarmController] - Fetching farm details for farm %s', request.params.id);
      const farmDb = await this.service.getFarmById(
        request.params.id,
        request.query.includePlots ?? false,
        request.query.includeGeoJson ?? false,
        request.query.includeCustomer ?? false,
      );
      const farm = FarmVM.toViewModelWithPlots(farmDb);

      app.log.info('[FarmController] - Successfully retrieved farm details');
      return reply.status(200).send({
        message: 'Farm details retrieved successfully',
        farm,
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn('[FarmController] - Failed to retrieve farm details: %s', error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error('[FarmController] - Unexpected error during farm details retrieval: %o', {
        error,
      });
      reply.status(500).send(new AppError('Internal server error', 500, error).throw());
    }
  };

  public getFarmsByCustomerId = async (
    request: FastifyRequest<{
      Params: { customerId: string };
      Querystring: PaginatedRequestQueryString;
    }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info('[FarmController] - Fetching farms for customer %s', request.params.customerId);
      const page = request.query.page ?? 1;
      const limit = request.query.limit ?? 10;
      const farms = await this.service.getFarmsByCustomerId(request.params.customerId, page, limit);

      app.log.info('[FarmController] - Successfully retrieved farms for customer');
      return reply.status(200).send({
        message: 'Farms retrieved successfully',
        ...farms,
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn('[FarmController] - Failed to retrieve farms for customer: %s', error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error('[FarmController] - Unexpected error during farms retrieval: %o', {
        error,
      });
      reply.status(500).send(new AppError('Internal server error', 500, error).throw());
    }
  };

  public updateFarm = async (
    request: FastifyRequest<{ Params: { id: string }; Body: UpdateFarmDTO }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info('[FarmController] - Starting farm update for farm %s', request.params.id);

      const updatedFarm = await this.service.updateFarm(request.params.id, request.body);
      const farm = FarmVM.toViewModelWithPlots(updatedFarm);

      app.log.info('[FarmController] - Farm updated successfully');
      return reply.status(200).send({
        message: 'Farm updated successfully',
        farm,
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn('[FarmController] - Farm update failed: %s', error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error('[FarmController] - Unexpected error during farm update: %o', {
        error,
      });
      reply.status(500).send(new AppError('Internal server error', 500, error).throw());
    }
  };

  public deleteFarm = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info('[FarmController] - Starting farm deletion for farm %s', request.params.id);

      await this.service.deleteFarm(request.params.id);

      app.log.info('[FarmController] - Farm deleted successfully');
      return reply.status(200).send({
        message: 'Farm deleted successfully',
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn('[FarmController] - Farm deletion failed: %s', error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error('[FarmController] - Unexpected error during farm deletion: %o', {
        error,
      });
      reply.status(500).send(new AppError('Internal server error', 500, error).throw());
    }
  };
}
