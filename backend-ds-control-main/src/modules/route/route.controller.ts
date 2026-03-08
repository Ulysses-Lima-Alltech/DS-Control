import type { FastifyReply, FastifyRequest } from 'fastify';
import type { CreateRouteDTO } from './dto/create-route.dto';
import type { UpdateRouteDTO } from './dto/update-route.dto';

import AppError from '@common/handlers/app-error';
import { RouteVM } from '@models/route.vm';
import { app } from '@modules/app/app.module';
import type { GetAllRoutesQueryString } from './dto/get-all-routes.dto';
import type { GetRouteByIdQueryString } from './dto/get-route-by-id.dto';
import type { RouteSearchQueryString } from './dto/list-all-routes.dto';
import { RouteService } from './services/route.service';

export class RouteController {
  private service: RouteService;

  constructor() {
    this.service = new RouteService();
  }

  public createRoute = async (
    request: FastifyRequest<{
      Body: CreateRouteDTO;
    }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info(
        '[RouteController] - Starting route creation for farm %s',
        request.body.farmId,
      );

      await this.service.createRoute(request.body);

      app.log.info('[RouteController] - Route created successfully');
      return reply.status(201).send({
        message: 'Route created successfully',
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn('[RouteController] - Route creation failed: %s', error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error('[RouteController] - Unexpected error during route creation: %o', {
        error,
      });
      reply.status(500).send(new AppError('Internal server error', 500, error).throw());
    }
  };

  public listRoutes = async (
    request: FastifyRequest<{
      Querystring: RouteSearchQueryString;
    }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info('[RouteController] - Listing routes');

      const result = await this.service.listRoutes(request.query);

      app.log.info('[RouteController] - Successfully listed routes');
      return reply.status(200).send({
        message: 'Routes listed successfully',
        ...result,
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn('[RouteController] - Failed to list routes: %s', error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error('[RouteController] - Unexpected error during route listing: %o', { error });
      reply.status(500).send(new AppError('Internal server error', 500, error).throw());
    }
  };

  public getAllRoutes = async (
    request: FastifyRequest<{
      Querystring: GetAllRoutesQueryString;
    }>,
    reply: FastifyReply,
  ) => {
    try {
      const { routeId, farmId, customerId } = request.query;

      app.log.info(
        '[RouteController] - Fetching routes with routeId=%s, farmId=%s and customerId=%s',
        routeId ?? '',
        farmId ?? '',
        customerId ?? '',
      );
      const routes = await this.service.getAllRoutes(
        request.query.includeFarm,
        request.query.includeCustomer,
        request.query.includeGeoJson,
        routeId,
        farmId,
        customerId,
        request.query.orderBy,
        request.query.orderType
      );

      app.log.info('[RouteController] - Successfully retrieved route details');
      return reply.status(200).send({
        message: 'Route details retrieved successfully',
        routes,
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn('[RouteController] - Failed to list routes: %s', error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error('[RouteController] - Unexpected error during route listing: %o', {
        error,
      });
      reply.status(500).send(new AppError('Internal server error', 500, error).throw());
    }
  };

  public getRouteById = async (
    request: FastifyRequest<{ Params: { id: string }; Querystring: GetRouteByIdQueryString }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info('[RouteController] - Fetching route details for route %s', request.params.id);
      const routeDb = await this.service.getRouteById(
        request.params.id,
        request.query.includeFarm ?? false,
        request.query.includeCustomer ?? false,
        request.query.includeGeoJson ?? false,
      );
      
      let route;
      if (request.query.includeFarm && request.query.includeCustomer) {
        route = RouteVM.toViewModelWithFarmAndCustomer(routeDb as any);
      } else if (request.query.includeFarm) {
        route = RouteVM.toViewModelWithFarm(routeDb as any);
      } else if (request.query.includeCustomer) {
        route = RouteVM.toViewModelWithCustomer(routeDb as any);
      } else {
        route = RouteVM.toViewModel(routeDb as any);
      }

      app.log.info('[RouteController] - Successfully retrieved route details');
      return reply.status(200).send({
        message: 'Route details retrieved successfully',
        route,
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn('[RouteController] - Failed to retrieve route details: %s', error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error('[RouteController] - Unexpected error during route details retrieval: %o', {
        error,
      });
      reply.status(500).send(new AppError('Internal server error', 500, error).throw());
    }
  };

  public getRoutesByFarmId = async (
    request: FastifyRequest<{ Params: { farmId: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info('[RouteController] - Fetching routes for farm %s', request.params.farmId);
      const routes = await this.service.getRoutesByFarmId(request.params.farmId);

      app.log.info('[RouteController] - Successfully retrieved routes for farm');
      return reply.status(200).send({
        message: 'Routes retrieved successfully',
        routes: routes.map((route) => RouteVM.toViewModel(route)),
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn('[RouteController] - Failed to retrieve routes for farm: %s', error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error('[RouteController] - Unexpected error during routes retrieval: %o', {
        error,
      });
      reply.status(500).send(new AppError('Internal server error', 500, error).throw());
    }
  };

  public getRoutesByCustomerId = async (
    request: FastifyRequest<{ Params: { customerId: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info('[RouteController] - Fetching routes for customer %s', request.params.customerId);
      const routes = await this.service.getRoutesByCustomerId(request.params.customerId);

      app.log.info('[RouteController] - Successfully retrieved routes for customer');
      return reply.status(200).send({
        message: 'Routes retrieved successfully',
        routes: routes.map((route) => RouteVM.toViewModel(route)),
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn('[RouteController] - Failed to retrieve routes for customer: %s', error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error('[RouteController] - Unexpected error during routes retrieval: %o', {
        error,
      });
      reply.status(500).send(new AppError('Internal server error', 500, error).throw());
    }
  };

  public updateRoute = async (
    request: FastifyRequest<{ Params: { id: string }; Body: UpdateRouteDTO }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info('[RouteController] - Starting route update for route %s', request.params.id);

      const updatedRoute = await this.service.updateRoute(request.params.id, request.body);
      const route = RouteVM.toViewModel(updatedRoute);

      app.log.info('[RouteController] - Route updated successfully');
      return reply.status(200).send({
        message: 'Route updated successfully',
        route,
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn('[RouteController] - Route update failed: %s', error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error('[RouteController] - Unexpected error during route update: %o', {
        error,
      });
      reply.status(500).send(new AppError('Internal server error', 500, error).throw());
    }
  };

  public deleteRoute = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info('[RouteController] - Starting route deletion for route %s', request.params.id);

      await this.service.deleteRoute(request.params.id);

      app.log.info('[RouteController] - Route deleted successfully');
      return reply.status(200).send({
        message: 'Route deleted successfully',
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn('[RouteController] - Route deletion failed: %s', error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error('[RouteController] - Unexpected error during route deletion: %o', {
        error,
      });
      reply.status(500).send(new AppError('Internal server error', 500, error).throw());
    }
  };
}
