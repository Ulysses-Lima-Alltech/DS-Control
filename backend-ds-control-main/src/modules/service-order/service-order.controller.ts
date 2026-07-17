import type { FastifyReply, FastifyRequest } from 'fastify';
import type { CreateServiceOrderDTO } from './dto/create-service-order';
import type { CompletedPlotsReportRequestDTO } from './dto/completed-plots-report.dto';
import type { UpdateServiceOrderStatusDTO } from './dto/update-service-order-status.dto';
import type { UpdateServiceOrderDTO } from './dto/update-service-order.dto';
import type { UpdateServiceOrderPlotStatusDTO } from './dto/update-service-order-plot-status.dto';

import AppError from '@common/handlers/app-error';
import { app } from '@modules/app/app.module';
import type { GetServiceOrderQueryString } from './dto/get-all-service-order.dto';
import type { ServiceOrderSearchQueryStringByPilot } from './dto/get-all-service-orders-by-pilot-dto';
import type { ServiceOrderDetailsQueryString } from './dto/get-service-order-details.dto';
import type { ServiceOrderStatsQueryString } from './dto/stats.dto';
import { ServiceOrderService } from './service-order.service';

export class ServiceOrderController {
  private service: ServiceOrderService;

  constructor() {
    this.service = new ServiceOrderService();
  }

  public createServiceOrder = async (
    request: FastifyRequest<{ Body: CreateServiceOrderDTO }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info(
        '[ServiceOrderController] - Starting service order creation for customer %s',
        request.body.customerId,
      );

      await this.service.createServiceOrder(request.body);

      app.log.info('[ServiceOrderController] - Service order created successfully');
      return reply.status(201).send({
        message: 'Service order created successfully',
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn('[ServiceOrderController] - Service order creation failed: %s', error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error(
        '[ServiceOrderController] - Unexpected error during service order creation: %o',
        { error },
      );
      reply.status(500).send(new AppError('Internal server error', 500, error).throw());
    }
  };

  public getServiceOrderById = async (
    request: FastifyRequest<{
      Params: { id: string };
      Querystring: ServiceOrderDetailsQueryString;
    }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info(
        '[ServiceOrderController] - Fetching service order details for service order %s',
        request.params.id,
      );

      const serviceOrder = await this.service.getServiceOrderById(
        request.params.id,
        request.query,
        request.payload?.userId,
      );

      app.log.info('[ServiceOrderController] - Successfully retrieved service order details');
      return reply.status(200).send(serviceOrder);
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn(
          '[ServiceOrderController] - Failed to retrieve service order details: %s',
          error.message,
        );
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error(
        '[ServiceOrderController] - Unexpected error during service order details retrieval: %o',
        { error },
      );
      reply.status(500).send(new AppError('Internal server error', 500, error).throw());
    }
  };

  public getCompletedPlotsReportData = async (
    request: FastifyRequest<{
      Params: { id: string };
      Body: CompletedPlotsReportRequestDTO;
    }>,
    reply: FastifyReply,
  ) => {
    try {
      const reportData = await this.service.getCompletedPlotsReportData(
        request.params.id,
        request.body,
        request.payload?.userId,
      );
      return reply.status(200).send(reportData);
    } catch (error) {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send(error.throw());
      }
      app.log.error('[ServiceOrderController] - Unexpected completed report error: %o', {
        error,
      });
      return reply.status(500).send(new AppError('Internal server error', 500, error).throw());
    }
  };

  public getAllServiceOrders = async (
    request: FastifyRequest<{
      Querystring: GetServiceOrderQueryString;
    }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info('[ServiceOrderController] - Listing service orders');

      const serviceOrders = await this.service.getAllServiceOrders(request.query);

      app.log.info('[ServiceOrderController] - Successfully listed service orders');

      return reply.status(200).send({
        message: 'Service orders listed successfully',
        ...serviceOrders,
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn('[ServiceOrderController] - Failed to list service orders: %s', error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error(
        '[ServiceOrderController] - Unexpected error during service orders listing: %o',
        { error },
      );
      reply.status(500).send(new AppError('Internal server error', 500, error).throw());
    }
  };

  public updateServiceOrder = async (
    request: FastifyRequest<{ Params: { id: string }; Body: UpdateServiceOrderDTO }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info(
        '[ServiceOrderController] - Starting service order update for service order %s',
        request.params.id,
      );

      const updatedServiceOrder = await this.service.updateServiceOrder(
        request.params.id,
        request.body,
      );

      app.log.info('[ServiceOrderController] - Service order updated successfully');
      return reply.status(200).send(updatedServiceOrder);
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn('[ServiceOrderController] - Service order update failed: %s', error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error('[ServiceOrderController] - Unexpected error during service order update: %o', {
        error,
      });
      reply.status(500).send(new AppError('Internal server error', 500, error).throw());
    }
  };

  public updateServiceOrderStatus = async (
    request: FastifyRequest<{ Params: { id: string }; Body: UpdateServiceOrderStatusDTO }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info(
        '[ServiceOrderController] - Starting service order status update for service order %s',
        request.params.id,
      );

      const updatedServiceOrder = await this.service.updateServiceOrderStatus(
        request.params.id,
        request.body,
      );

      app.log.info('[ServiceOrderController] - Service order status updated successfully');
      return reply.status(200).send(updatedServiceOrder);
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn(
          '[ServiceOrderController] - Service order status update failed: %s',
          error.message,
        );
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error(
        '[ServiceOrderController] - Unexpected error during service order status update: %o',
        { error },
      );
      reply.status(500).send(new AppError('Internal server error', 500, error).throw());
    }
  };

  public updateServiceOrderPlotStatus = async (
    request: FastifyRequest<{
      Params: { serviceOrderId: string; plotId: string };
      Body: UpdateServiceOrderPlotStatusDTO;
    }>,
    reply: FastifyReply,
  ) => {
    try {
      const updatedLink = await this.service.updateServiceOrderPlotStatus(
        request.params.serviceOrderId,
        request.params.plotId,
        request.body,
        request.payload!.userId,
      );
      return reply.status(200).send(updatedLink);
    } catch (error) {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send(error.throw());
      }
      app.log.error('[ServiceOrderController] - Unexpected plot status update error: %o', {
        error,
      });
      return reply.status(500).send(new AppError('Internal server error', 500, error).throw());
    }
  };

  public getMyOpenServiceOrders = async (
    request: FastifyRequest<{
      Querystring: ServiceOrderSearchQueryStringByPilot;
    }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info(
        '[ServiceOrderController] - Listing open service orders for logged pilot %s',
        String(request.payload?.userId),
      );

      const serviceOrders = await this.service.getOpenServiceOrdersByPilotId(
        request.payload?.userId!,
        request.query,
      );

      app.log.info(
        '[ServiceOrderController] - Successfully listed open service orders for logged pilot',
      );

      return reply.status(200).send({
        message: 'Open service orders for logged pilot listed successfully',
        ...serviceOrders,
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn(
          '[ServiceOrderController] - Failed to list open service orders for logged pilot: %s',
          error.message,
        );
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error(
        '[ServiceOrderController] - Unexpected error during open service orders listing for logged pilot: %o',
        { error },
      );
      reply.status(500).send(new AppError('Internal server error', 500, error).throw());
    }
  };

  public getGeneralStats = async (
    request: FastifyRequest<{
      Querystring: ServiceOrderStatsQueryString;
    }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info('[ServiceOrderController] - Fetching general statistics');

      const stats = await this.service.getGeneralStats(request.query);

      app.log.info('[ServiceOrderController] - Successfully retrieved general statistics');
      return reply.status(200).send({
        message: 'General statistics retrieved successfully',
        stats,
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn(
          '[ServiceOrderController] - Failed to retrieve general statistics: %s',
          error.message,
        );
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error(
        '[ServiceOrderController] - Unexpected error during general statistics retrieval: %o',
        { error },
      );
      reply.status(500).send(new AppError('Internal server error', 500, error).throw());
    }
  };
}
