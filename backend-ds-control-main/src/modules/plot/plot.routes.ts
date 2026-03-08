import type {
    FastifyInstance,
    FastifyPluginOptions,
    HookHandlerDoneFunction,
} from "fastify";

import { PaginatedRequestQueryStringSchema, PaginatedRequestSchema } from "@common/types/paginated-request.types";
import { AuthenticationJWT } from "@middleware/authentication-jwt-middleware";
import { PlotViewModelSchema } from "@models/plot.vm";
import type { FastifyZodOpenApiTypeProvider } from "fastify-zod-openapi";
import { z } from "zod";
import { CreatePlotSchema } from "./dto/create-plot.dto";
import { UpdatePlotSchema } from "./dto/update-plot.dto";
import { PlotController } from "./plot.controller";

export function PlotV1Routes(
  app: FastifyInstance,
  _: FastifyPluginOptions,
  done: HookHandlerDoneFunction,
) {
  const controller = new PlotController();

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "GET",
    url: "/",
    schema: {
      description: "List all plots",
      summary: "List plots",
      tags: ["plots"],
      querystring: PaginatedRequestQueryStringSchema,
      response: {
        200: PaginatedRequestSchema(PlotViewModelSchema),
      }
    },
    preHandler: [AuthenticationJWT],
    handler: controller.listPlots,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "POST",
    url: "/",
    schema: {
      body: CreatePlotSchema,
      description: "Create a new plot",
      summary: "Create plot",
      tags: ["plots"],
    },
    preHandler: [AuthenticationJWT],
    handler: controller.createPlot,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "GET",
    url: "/:id",
    schema: {
      description: "Get plot by ID",
      summary: "Get plot by ID",
      tags: ["plots"],
      params: z.object({
        id: z.string().uuid(),
      }),
    },
    preHandler: [AuthenticationJWT],
    handler: controller.getPlotById,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "GET",
    url: "/farm/:farmId",
    schema: {
      description: "Get plots by farm ID",
      summary: "Get plots by farm ID",
      tags: ["plots"],
      params: z.object({
        farmId: z.string().uuid(),
      }),
    },
    preHandler: [AuthenticationJWT],
    handler: controller.getPlotsByFarmId,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "GET",
    url: "/customer/:customerId",
    schema: {
      description: "Get plots by customer ID",
      summary: "Get plots by customer ID",
      tags: ["plots"],
      params: z.object({
        customerId: z.string().uuid(),
      }),
    },
    preHandler: [AuthenticationJWT],
    handler: controller.getPlotsByCustomerId,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "PUT",
    url: "/:id",
    schema: {
      description: "Update a plot by ID",
      summary: "Update plot by ID",
      tags: ["plots"],
      body: UpdatePlotSchema,
      params: z.object({
        id: z.string().uuid(),
      }),
    },
    preHandler: [AuthenticationJWT],
    handler: controller.updatePlot,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "DELETE",
    url: "/:id",
    schema: {
      description: "Delete a plot by ID",
      summary: "Delete plot by ID",
      tags: ["plots"],
      params: z.object({
        id: z.string().uuid(),
      }),
    },
    preHandler: [AuthenticationJWT],
    handler: controller.deletePlot,
  });

  done();
} 