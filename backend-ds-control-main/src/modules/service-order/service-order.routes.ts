import type { FastifyInstance, FastifyPluginOptions, HookHandlerDoneFunction } from 'fastify';

import { PaginatedRequestSchema } from '@common/types/paginated-request.types';
import { AuthenticationJWT } from '@middleware/authentication-jwt-middleware';
import { BackofficeOnly } from '@middleware/backoffice-only-middleware';
import { ServiceOrderWithDetailsSchema } from '@models/service-order.vm';
import type { FastifyZodOpenApiTypeProvider } from 'fastify-zod-openapi';
import z from 'zod';
import { CreateServiceOrderSchema } from './dto/create-service-order';
import { GetServiceOrderQueryStringSchema } from './dto/get-all-service-order.dto';
import { ServiceOrderSearchQueryStringByPilotSchema } from './dto/get-all-service-orders-by-pilot-dto';
import { ServiceOrderDetailsQueryStringSchema } from './dto/get-service-order-details.dto';
import { ServiceOrderStatsQueryStringSchema } from './dto/stats.dto';
import { UpdateServiceOrderStatusSchema } from './dto/update-service-order-status.dto';
import { UpdateServiceOrderSchema } from './dto/update-service-order.dto';
import {
  ServiceOrderPlotStatusResponseSchema,
  UpdateServiceOrderPlotStatusSchema,
} from './dto/update-service-order-plot-status.dto';
import { ServiceOrderController } from './service-order.controller';

// Common parameters schemas
const ServiceOrderIdParamSchema = z.object({
  id: z.string().uuid(),
});

const ServiceOrderPlotParamSchema = z.object({
  serviceOrderId: z.string().uuid(),
  plotId: z.string().uuid(),
});

export function ServiceOrderV1Routes(
  app: FastifyInstance,
  _: FastifyPluginOptions,
  done: HookHandlerDoneFunction,
) {
  const controller = new ServiceOrderController();

  // Create service order
  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: 'POST',
    url: '/',
    schema: {
      body: CreateServiceOrderSchema,
      description: 'Create a new service order',
      summary: 'Create service order',
      tags: ['service-orders'],
    },
    preHandler: [AuthenticationJWT],
    handler: controller.createServiceOrder,
  });

  // Get all service orders
  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: 'GET',
    url: '/',
    schema: {
      querystring: GetServiceOrderQueryStringSchema,
      description: 'Retrieve all service orders with optional search and filters',
      summary: 'Get all service orders',
      tags: ['service-orders'],
      // response: {
      //   200: PaginatedRequestSchema(ServiceOrderWithDetailsSchema),
      // },
    },
    preHandler: [AuthenticationJWT],
    handler: controller.getAllServiceOrders,
  });

  // Get service order by ID
  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: 'GET',
    url: '/:id',
    schema: {
      params: ServiceOrderIdParamSchema,
      querystring: ServiceOrderDetailsQueryStringSchema,
      description: 'Retrieve a service order by its ID',
      summary: 'Get service order by ID',
      tags: ['service-orders'],
      response: {
        200: ServiceOrderWithDetailsSchema,
      },
    },
    preHandler: [AuthenticationJWT],
    handler: controller.getServiceOrderById,
  });

  // Update service order
  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: 'PUT',
    url: '/:id',
    schema: {
      params: ServiceOrderIdParamSchema,
      body: UpdateServiceOrderSchema,
      description: 'Update a service order',
      summary: 'Update service order',
      tags: ['service-orders'],
      response: {
        200: ServiceOrderWithDetailsSchema,
      },
    },
    preHandler: [AuthenticationJWT],
    handler: controller.updateServiceOrder,
  });

  // Update service order status
  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: 'PATCH',
    url: '/:serviceOrderId/plots/:plotId/status',
    schema: {
      params: ServiceOrderPlotParamSchema,
      body: UpdateServiceOrderPlotStatusSchema,
      description: 'Update the official status of a plot linked to a service order',
      summary: 'Update service order plot status',
      tags: ['service-orders'],
      response: {
        200: ServiceOrderPlotStatusResponseSchema,
      },
    },
    preHandler: [AuthenticationJWT, BackofficeOnly],
    handler: controller.updateServiceOrderPlotStatus,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: 'PATCH',
    url: '/:id/status',
    schema: {
      params: ServiceOrderIdParamSchema,
      body: UpdateServiceOrderStatusSchema,
      description: 'Update the status of a service order',
      summary: 'Update service order status',
      tags: ['service-orders'],
      response: {
        200: ServiceOrderWithDetailsSchema,
      },
    },
    preHandler: [AuthenticationJWT],
    handler: controller.updateServiceOrderStatus,
  });

  // Get logged pilot's open service orders
  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: 'GET',
    url: '/my-open-orders',
    schema: {
      querystring: ServiceOrderSearchQueryStringByPilotSchema,
      description: 'Retrieve all open service orders for the logged pilot with pagination',
      summary: 'Get my open service orders',
      tags: ['service-orders'],
      response: {
        200: PaginatedRequestSchema(ServiceOrderWithDetailsSchema),
      },
    },
    preHandler: [AuthenticationJWT],
    handler: controller.getMyOpenServiceOrders,
  });

  // Get general statistics
  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: 'GET',
    url: '/stats',
    schema: {
      querystring: ServiceOrderStatsQueryStringSchema,
      description: 'Retrieve general statistics for all service orders with optional filters',
      summary: 'Get general statistics',
      tags: ['service-orders'],
      response: {
        200: z.object({
          message: z.string(),
          stats: z.object({
            openOrdersCount: z.number(),
            completedOrdersCount: z.number(),
            cancelledOrdersCount: z.number(),
            farmsCount: z.number(),
            plotsCount: z.number(),
            totalAreaHectares: z.number(),
            pilotsWithOpenOrders: z.number(),
            invalidApplications: z.number(),
            openOrdersAreaHectares: z.number(),
            completedOrdersAreaHectares: z.number(),
            cancelledOrdersAreaHectares: z.number(),
            openOrdersAppliedHectares: z.number(),
            completedOrdersAppliedHectares: z.number(),
            cancelledOrdersAppliedHectares: z.number(),
          }),
        }),
      },
    },
    preHandler: [AuthenticationJWT],
    handler: controller.getGeneralStats,
  });

  done();
}
