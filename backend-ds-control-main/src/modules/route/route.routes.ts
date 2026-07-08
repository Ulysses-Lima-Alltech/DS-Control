import type { FastifyInstance, FastifyPluginOptions, HookHandlerDoneFunction } from 'fastify';

import { PaginatedRequestSchema } from '@common/types/paginated-request.types';
import { AuthenticationJWT } from '@middleware/authentication-jwt-middleware';
import { RouteViewModelSchema } from '@models/route.vm';
import type { FastifyZodOpenApiTypeProvider } from 'fastify-zod-openapi';
import { z } from 'zod';
import { CreateRouteSchema } from './dto/create-route.dto';
import { CreateRoutesBatchSchema } from './dto/create-routes-batch.dto';
import { GetAllRoutesQueryStringSchema } from './dto/get-all-routes.dto';
import { GetRouteByIdQueryStringSchema } from './dto/get-route-by-id.dto';
import { ListRoutesQueryStringSchema } from './dto/list-all-routes.dto';
import { UpdateRouteSchema } from './dto/update-route.dto';
import { RouteController } from './route.controller';

export function RouteV1Routes(
  app: FastifyInstance,
  _: FastifyPluginOptions,
  done: HookHandlerDoneFunction,
) {
  const controller = new RouteController();

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: 'GET',
    url: '/',
    schema: {
      description: 'List all routes with optional search and filters',
      summary: 'List routes',
      tags: ['routes'],
      querystring: ListRoutesQueryStringSchema,
      response: {
        200: PaginatedRequestSchema(z.any()),
      },
    },
    preHandler: [AuthenticationJWT],
    handler: controller.listRoutes,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: 'POST',
    url: '/',
    schema: {
      body: CreateRouteSchema,
      description: 'Create a new route',
      summary: 'Create route',
      tags: ['routes'],
    },
    preHandler: [AuthenticationJWT],
    handler: controller.createRoute,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: 'POST',
    url: '/batch',
    schema: {
      body: CreateRoutesBatchSchema,
      description: 'Create many routes for the same farm',
      summary: 'Create routes batch',
      tags: ['routes'],
      response: {
        201: z.object({
          message: z.string(),
          createdCount: z.number(),
          skippedCount: z.number(),
          routes: z.array(RouteViewModelSchema),
          errors: z.array(
            z.object({
              name: z.string().optional(),
              sourceFileName: z.string().optional(),
              message: z.string(),
            }),
          ),
        }),
      },
    },
    preHandler: [AuthenticationJWT],
    handler: controller.createRoutesBatch,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: 'GET',
    url: '/allroutes',
    schema: {
      description: 'List all routes with optional filters',
      summary: 'List all routes',
      tags: ['routes'],
      querystring: GetAllRoutesQueryStringSchema,
    },
    preHandler: [AuthenticationJWT],
    handler: controller.getAllRoutes,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: 'GET',
    url: '/:id',
    schema: {
      description: 'Get route by ID with optional relations',
      summary: 'Get route by ID',
      tags: ['routes'],
      params: z.object({
        id: z.string().uuid(),
      }),
      querystring: GetRouteByIdQueryStringSchema,
    },
    preHandler: [AuthenticationJWT],
    handler: controller.getRouteById,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: 'GET',
    url: '/farm/:farmId',
    schema: {
      description: 'Get routes by farm ID',
      summary: 'Get routes by farm ID',
      tags: ['routes'],
      params: z.object({
        farmId: z.string().uuid(),
      }),
      response: {
        200: z.object({
          message: z.string(),
          routes: z.array(RouteViewModelSchema),
        }),
      },
    },
    preHandler: [AuthenticationJWT],
    handler: controller.getRoutesByFarmId,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: 'GET',
    url: '/customer/:customerId',
    schema: {
      description: 'Get routes by customer ID',
      summary: 'Get routes by customer ID',
      tags: ['routes'],
      params: z.object({
        customerId: z.string().uuid(),
      }),
      response: {
        200: z.object({
          message: z.string(),
          routes: z.array(RouteViewModelSchema),
        }),
      },
    },
    preHandler: [AuthenticationJWT],
    handler: controller.getRoutesByCustomerId,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: 'PUT',
    url: '/:id',
    schema: {
      description: 'Update a route by ID',
      summary: 'Update route by ID',
      tags: ['routes'],
      body: UpdateRouteSchema,
      params: z.object({
        id: z.string().uuid(),
      }),
    },
    preHandler: [AuthenticationJWT],
    handler: controller.updateRoute,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: 'DELETE',
    url: '/:id',
    schema: {
      description: 'Delete a route by ID',
      summary: 'Delete route by ID',
      tags: ['routes'],
      params: z.object({
        id: z.string().uuid(),
      }),
    },
    preHandler: [AuthenticationJWT],
    handler: controller.deleteRoute,
  });

  done();
}
