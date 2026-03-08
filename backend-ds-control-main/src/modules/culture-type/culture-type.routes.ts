import type {
  FastifyInstance,
  FastifyPluginOptions,
  HookHandlerDoneFunction,
} from "fastify";

import { PaginatedRequestSchema } from "@common/types/paginated-request.types";
import { AuthenticationJWT } from "@middleware/authentication-jwt-middleware";
import { CultureTypeViewModelSchema } from "@models/culture-type.vm";
import type { FastifyZodOpenApiTypeProvider } from "fastify-zod-openapi";
import { z } from "zod";
import { CultureTypeController } from "./culture-type.controller";
import { CreateCultureTypeSchema } from "./dto/create-culture-type.dto";
import { CultureTypeQueryStringSchema } from "./dto/culture-type-query.dto";
import { UpdateCultureTypeSchema } from "./dto/update-culture-type.dto";

export function CultureTypeV1Routes(
  app: FastifyInstance,
  _: FastifyPluginOptions,
  done: HookHandlerDoneFunction,
) {
  const controller = new CultureTypeController();

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "GET",
    url: "/",
    schema: {
      description: "List all culture types with optional search and status filter",
      summary: "List culture types",
      tags: ["culture-types"],
      querystring: CultureTypeQueryStringSchema,
      response: { 
        200: PaginatedRequestSchema(CultureTypeViewModelSchema),
      }
    },
    preHandler: [AuthenticationJWT],
    handler: controller.listCultureTypes,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "GET",
    url: "/stats",
    schema: {
      description: "Get Culture Types stats",
      summary: "Get culture Types stats",
      tags: ["culture-types"],
      querystring: z.object({
        startDate: z.string()
          .refine(val => /^\d{4}-\d{2}-\d{2}$/.test(val), {message: "Data Inicial no formato incorreto. Use YYYY-MM-DD. \n"} )
          .refine(val =>  !isNaN(Date.parse(val)), {message: "Data inválida"}),
        endDate: z.string()
          .refine(val => /^\d{4}-\d{2}-\d{2}$/.test(val), {message: " Data Final no formato incorreto. Use YYYY-MM-DD."} )  
          .refine(val =>  !isNaN(Date.parse(val)), {message: "invalid date"}),
      }),
      response: {
        200: z.object({
          message: z.string(),
          statsCulture: z.object({
            totalHectares: z.number(),
            compareLastMonth: z.array(
              z.object({
                cultureTypeName: z.string(),
                day: z.string(),
                month: z.string(),
                applications: z.number(),
                hectares: z.number()
              })
            )
          }),
        }),
      }
    },
    preHandler: [AuthenticationJWT],
    handler: controller.getStatsCultureTypes,
  })

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "POST",
    url: "/",
    schema: {
      body: CreateCultureTypeSchema,
      description: "Create a new culture type",
      summary: "Create culture type",
      tags: ["culture-types"],
    },
    preHandler: [AuthenticationJWT],
    handler: controller.createCultureType,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "GET",
    url: "/:id",
    schema: {
      description: "Get culture type by ID",
      summary: "Get culture type by ID",
      tags: ["culture-types"],
      params: z.object({
        id: z.string().uuid(),
      }),
    },
    preHandler: [AuthenticationJWT],
    handler: controller.getCultureTypeById,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "PUT",
    url: "/:id",
    schema: {
      description: "Update a culture type by ID",
      summary: "Update culture type by ID",
      tags: ["culture-types"],
      body: UpdateCultureTypeSchema,
      params: z.object({
        id: z.string().uuid(),
      }),
    },
    preHandler: [AuthenticationJWT],
    handler: controller.updateCultureType,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "DELETE",
    url: "/:id",
    schema: {
      description: "Delete a culture type by ID (soft delete)",
      summary: "Delete culture type by ID",
      tags: ["culture-types"],
      params: z.object({
        id: z.string().uuid(),
      }),
    },
    preHandler: [AuthenticationJWT],
    handler: controller.deleteCultureType,
  });

  done();
} 