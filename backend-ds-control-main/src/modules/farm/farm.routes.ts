import type {
  FastifyInstance,
  FastifyPluginOptions,
  HookHandlerDoneFunction,
} from "fastify";

import { PaginatedRequestQueryStringSchema, PaginatedRequestSchema } from "@common/types/paginated-request.types";
import { AuthenticationJWT } from "@middleware/authentication-jwt-middleware";
import { FarmWithPlotsViewModelSchema } from "@models/farm.vm";
import type { FastifyZodOpenApiTypeProvider } from "fastify-zod-openapi";
import { z } from "zod";
import { CreateFarmSchema } from "./dto/create-farm.dto";
import { GetAllFarmsQueryStringSchema } from "./dto/get-all-farms.dto";
import { GetFarmByIdQueryStringSchema } from "./dto/get-farm-by-id.dto";
import { GetFarmQueryStringSchema } from "./dto/list-all-farms.dto";
import { UpdateFarmSchema } from "./dto/update-farm.dto";
import { FarmController } from "./farm.controller";

export function FarmV1Routes(
  app: FastifyInstance,
  _: FastifyPluginOptions,
  done: HookHandlerDoneFunction,
) {
  const controller = new FarmController();

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "GET",
    url: "/",
    schema: {
      description: "List all farms with their plots and optional search",
      summary: "List farms",
      tags: ["farms"],
      querystring: GetFarmQueryStringSchema,
      response: { 
        200: PaginatedRequestSchema(FarmWithPlotsViewModelSchema),
      }
    },
    preHandler: [AuthenticationJWT],
    handler: controller.listFarms,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "POST",
    url: "/",
    schema: {
      body: CreateFarmSchema,
      description: "Create a new farm with optional plots",
      summary: "Create farm",
      tags: ["farms"],
    },
    preHandler: [AuthenticationJWT],
    handler: controller.createFarm,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "GET",
    url: "/allfarms",
    schema: {
      description: "List all farms with their plots  with optional farmId and customerId",
      summary: "List all farms",
      tags: ["farms"],
      querystring: GetAllFarmsQueryStringSchema,
    },
    preHandler: [AuthenticationJWT],
    handler: controller.getAllFarms,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "GET",
    url: "/:id",
    schema: {
      description: "Get farm by ID with its plots",
      summary: "Get farm by ID",
      tags: ["farms"],
      params: z.object({
        id: z.string().uuid(),
      }),
      querystring: GetFarmByIdQueryStringSchema,
    },
    preHandler: [AuthenticationJWT],
    handler: controller.getFarmById,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "GET",
    url: "/customer/:customerId",
    schema: {
      description: "Get farms by customer ID with their plots",
      summary: "Get farms by customer ID",
      tags: ["farms"],
      params: z.object({
        customerId: z.string().uuid(),
      }),
      querystring: PaginatedRequestQueryStringSchema,
      response: { 
        200: PaginatedRequestSchema(FarmWithPlotsViewModelSchema),
      }
    },
    preHandler: [AuthenticationJWT],
    handler: controller.getFarmsByCustomerId,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "PUT",
    url: "/:id",
    schema: {
      description: "Update a farm by ID with optional plot management",
      summary: "Update farm by ID",
      tags: ["farms"],
      body: UpdateFarmSchema,
      params: z.object({
        id: z.string().uuid(),
      }),
    },
    preHandler: [AuthenticationJWT],
    handler: controller.updateFarm,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "DELETE",
    url: "/:id",
    schema: {
      description: "Delete a farm by ID (cascades to plots)",
      summary: "Delete farm by ID",
      tags: ["farms"],
      params: z.object({
        id: z.string().uuid(),
      }),
    },
    preHandler: [AuthenticationJWT],
    handler: controller.deleteFarm,
  });

  done();
} 