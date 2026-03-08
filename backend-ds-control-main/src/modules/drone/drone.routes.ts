import type {
  FastifyInstance,
  FastifyPluginOptions,
  HookHandlerDoneFunction,
} from "fastify";

import { PaginatedRequestQueryStringSchema, PaginatedRequestSchema } from "@common/types/paginated-request.types";
import { AuthenticationJWT } from "@middleware/authentication-jwt-middleware";
import { DroneViewModelSchema } from "@models/drone.vm";
import type { FastifyZodOpenApiTypeProvider } from "fastify-zod-openapi";
import { z } from "zod";
import { DroneController } from "./drone.controller";
import { CreateDroneSchema } from "./dto/create-drone.dto";
import { UpdateDroneSchema } from "./dto/update-drone.dto";

// Extended query string schema for drone search and filters
const DroneSearchQueryStringSchema = PaginatedRequestQueryStringSchema.extend({
  search: z
    .string()
    .optional()
    .describe("Search term to filter drones by name, model, or aircraftRid"),
  status: z
    .enum(["active", "inactive"])
    .optional()
    .describe("Filter by drone status (active = not deleted, inactive = deleted)"),
});

export function DroneV1Routes(
  app: FastifyInstance,
  _: FastifyPluginOptions,
  done: HookHandlerDoneFunction,
) {
  const controller = new DroneController();

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "GET",
    url: "/",
    schema: {
      description: "List all drones with optional search and status filter",
      summary: "List drones",
      tags: ["drones"],
      querystring: DroneSearchQueryStringSchema,
      response: {
        200: PaginatedRequestSchema(DroneViewModelSchema),
      }
    },
    preHandler: [AuthenticationJWT],
    handler: controller.listDrones,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "POST",
    url: "/",
    schema: {
      body: CreateDroneSchema,
      description: "Create a new drone",
      summary: "Create drone",
      tags: ["drones"],
      response: {
        201: z.object({
          message: z.string(),
        }),
      }
    },
    preHandler: [AuthenticationJWT],
    handler: controller.createDrone,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "GET",
    url: "/:id",
    schema: {
      description: "Get drone by ID",
      summary: "Get drone by ID",
      tags: ["drones"],
      params: z.object({
        id: z.string().uuid(),
      }),
      response: {
        200: z.object({
          message: z.string(),
          drone: DroneViewModelSchema,
        }),
      }
    },
    preHandler: [AuthenticationJWT],
    handler: controller.getDroneById,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "GET",
    url: "/operation",
    schema: {
      description: "Get Drones operation",
      summary: "Get Drones operation",
      tags: ["drones"],
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
          operation: z.object({
            avgHectareByDrones: z.number(),
            avgDailyByDrones: z.number(),
            totalHectares: z.number(),
             compareLastMonth: z.array(
              z.object({
                droneName: z.string(),
                droneRID: z.string(),
                day: z.string(),
                month: z.string(),
                applications: z.number(),
                hectares: z.number(),
              })
             )
          }),
        }),
      }
    },
    preHandler: [AuthenticationJWT],
    handler: controller.getDronesOperation,
  })

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "PUT",
    url: "/:id",
    schema: {
      description: "Update a drone by ID",
      summary: "Update drone by ID",
      tags: ["drones"],
      body: UpdateDroneSchema,
      params: z.object({
        id: z.string().uuid(),
      }),
      response: {
        200: z.object({
          message: z.string(),
          drone: DroneViewModelSchema,
        }),
      }
    },
    preHandler: [AuthenticationJWT],
    handler: controller.updateDrone,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "DELETE",
    url: "/:id",
    schema: {
      description: "Delete a drone by ID (soft delete)",
      summary: "Delete drone by ID",
      tags: ["drones"],
      params: z.object({
        id: z.string().uuid(),
      }),
      response: {
        200: z.object({
          message: z.string(),
        }),
      }
    },
    preHandler: [AuthenticationJWT],
    handler: controller.deleteDrone,
  });

  done();
} 