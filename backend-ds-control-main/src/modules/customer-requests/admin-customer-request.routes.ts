import { AuthenticationJWT } from '@middleware/authentication-jwt-middleware';
import { BackofficeOnly } from '@middleware/backoffice-only-middleware';
import type { FastifyInstance, FastifyPluginOptions, HookHandlerDoneFunction } from 'fastify';
import type { FastifyZodOpenApiTypeProvider } from 'fastify-zod-openapi';

import { AdminCustomerRequestController } from './admin-customer-request.controller';
import {
  AdminCustomerRequestListQuerySchema,
  AdminRequestParamSchema,
  ApproveCustomerRequestSchema,
  ReviewReasonSchema,
} from './customer-request.dto';

export function AdminCustomerRequestV1Routes(
  app: FastifyInstance,
  _: FastifyPluginOptions,
  done: HookHandlerDoneFunction,
) {
  const controller = new AdminCustomerRequestController();
  const preHandler = [AuthenticationJWT, BackofficeOnly];
  const route = app
    .withTypeProvider<FastifyZodOpenApiTypeProvider>()
    .route.bind(app.withTypeProvider<FastifyZodOpenApiTypeProvider>());

  route({
    method: 'GET',
    url: '/',
    schema: { querystring: AdminCustomerRequestListQuerySchema, tags: ['admin-customer-requests'] },
    preHandler,
    handler: controller.list,
  });
  route({
    method: 'GET',
    url: '/:type/:id',
    schema: { params: AdminRequestParamSchema, tags: ['admin-customer-requests'] },
    preHandler,
    handler: controller.get,
  });
  route({
    method: 'POST',
    url: '/:type/:id/request-changes',
    schema: {
      params: AdminRequestParamSchema,
      body: ReviewReasonSchema,
      tags: ['admin-customer-requests'],
    },
    preHandler,
    handler: controller.requestChanges,
  });
  route({
    method: 'POST',
    url: '/:type/:id/reject',
    schema: {
      params: AdminRequestParamSchema,
      body: ReviewReasonSchema,
      tags: ['admin-customer-requests'],
    },
    preHandler,
    handler: controller.reject,
  });
  route({
    method: 'POST',
    url: '/:type/:id/approve',
    schema: {
      params: AdminRequestParamSchema,
      body: ApproveCustomerRequestSchema,
      tags: ['admin-customer-requests'],
    },
    preHandler,
    handler: controller.approve,
  });

  done();
}
