import { AuthenticationJWT } from '@middleware/authentication-jwt-middleware';
import { FarmerOnly } from '@middleware/farmer-only-middleware';
import type { FastifyInstance, FastifyPluginOptions, HookHandlerDoneFunction } from 'fastify';
import type { FastifyZodOpenApiTypeProvider } from 'fastify-zod-openapi';

import { CustomerRequestController } from './customer-request.controller';
import {
  CreateAreaSubmissionRequestSchema,
  CompleteKmlUploadSchema,
  CreateServiceOrderRequestSchema,
  CustomerRequestListQuerySchema,
  PrepareKmlUploadSchema,
  RequestIdParamSchema,
  RequestPlotParamSchema,
  UpdateAreaSubmissionPlotSchema,
} from './customer-request.dto';

export function CustomerRequestV1Routes(
  app: FastifyInstance,
  _: FastifyPluginOptions,
  done: HookHandlerDoneFunction,
) {
  const controller = new CustomerRequestController();
  const preHandler = [AuthenticationJWT, FarmerOnly];
  const route = app
    .withTypeProvider<FastifyZodOpenApiTypeProvider>()
    .route.bind(app.withTypeProvider<FastifyZodOpenApiTypeProvider>());

  route({
    method: 'POST',
    url: '/service-orders',
    schema: { body: CreateServiceOrderRequestSchema, tags: ['customer-requests'] },
    preHandler,
    handler: controller.createServiceOrder,
  });
  route({
    method: 'GET',
    url: '/service-orders',
    schema: { querystring: CustomerRequestListQuerySchema, tags: ['customer-requests'] },
    preHandler,
    handler: controller.listServiceOrders,
  });
  route({
    method: 'GET',
    url: '/service-orders/:id',
    schema: { params: RequestIdParamSchema, tags: ['customer-requests'] },
    preHandler,
    handler: controller.getServiceOrder,
  });
  route({
    method: 'POST',
    url: '/service-orders/:id/submit',
    schema: { params: RequestIdParamSchema, tags: ['customer-requests'] },
    preHandler,
    handler: controller.submitServiceOrder,
  });
  route({
    method: 'POST',
    url: '/service-orders/:id/cancel',
    schema: { params: RequestIdParamSchema, tags: ['customer-requests'] },
    preHandler,
    handler: controller.cancelServiceOrder,
  });

  route({
    method: 'POST',
    url: '/areas',
    schema: { body: CreateAreaSubmissionRequestSchema, tags: ['customer-requests'] },
    preHandler,
    handler: controller.createArea,
  });
  route({
    method: 'GET',
    url: '/areas',
    schema: { querystring: CustomerRequestListQuerySchema, tags: ['customer-requests'] },
    preHandler,
    handler: controller.listAreas,
  });
  route({
    method: 'GET',
    url: '/areas/:id',
    schema: { params: RequestIdParamSchema, tags: ['customer-requests'] },
    preHandler,
    handler: controller.getArea,
  });
  route({
    method: 'PATCH',
    url: '/areas/:id/plots/:plotId',
    schema: {
      params: RequestPlotParamSchema,
      body: UpdateAreaSubmissionPlotSchema,
      tags: ['customer-requests'],
    },
    preHandler,
    handler: controller.updateAreaPlot,
  });
  route({
    method: 'POST',
    url: '/areas/:id/upload',
    schema: {
      params: RequestIdParamSchema,
      body: PrepareKmlUploadSchema,
      tags: ['customer-requests'],
    },
    preHandler,
    handler: controller.prepareAreaUpload,
  });
  route({
    method: 'POST',
    url: '/areas/:id/upload/complete',
    schema: {
      params: RequestIdParamSchema,
      body: CompleteKmlUploadSchema,
      tags: ['customer-requests'],
    },
    preHandler,
    handler: controller.completeAreaUpload,
  });
  route({
    method: 'POST',
    url: '/areas/:id/submit',
    schema: { params: RequestIdParamSchema, tags: ['customer-requests'] },
    preHandler,
    handler: controller.submitArea,
  });
  route({
    method: 'POST',
    url: '/areas/:id/cancel',
    schema: { params: RequestIdParamSchema, tags: ['customer-requests'] },
    preHandler,
    handler: controller.cancelArea,
  });

  done();
}
