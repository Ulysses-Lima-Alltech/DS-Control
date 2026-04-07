import type {
    FastifyInstance,
    FastifyPluginOptions,
    HookHandlerDoneFunction,
} from "fastify";

import { PaginatedRequestQueryStringSchema, PaginatedRequestSchema } from "@common/types/paginated-request.types";
import { AuthenticationJWT } from "@middleware/authentication-jwt-middleware";
import { ApplicationWithRelationsViewModelSchema } from "@models/application.vm";
import type { FastifyZodOpenApiTypeProvider } from "fastify-zod-openapi";
import { z } from "zod";
import { ApplicationController } from "./application.controller";
import { CreateApplicationSchema } from "./dto/create-application.dto";
import { DashboardMetricsQueryStringSchema, DashboardMetricsResponseSchema } from "./dto/dashboard-metrics.dto";
import { GetApplicationQueryStringSchema } from "./dto/get-all-application.dto";
import { PilotPerformanceSchema } from "./dto/stats-performance.dto";
import { ApplicationSummaryStatsSchema } from "./dto/stats-summary.dto";
import {
  ApplicationEvolutionItemSchema,
  ApplicationEvolutionQueryStringSchema,
} from "./dto/stats-evolution.dto";
import { ApplicationStatsQueryStringSchema } from "./dto/stats.dto";
import { TopFarmStatsSchema, TopFarmsStatsQueryStringSchema } from "./dto/stats-top-farms.dto";
import { UpdateApplicationSchema } from "./dto/update-application.dto";

export function ApplicationV1Routes(
  app: FastifyInstance,
  _: FastifyPluginOptions,
  done: HookHandlerDoneFunction,
) {
  const controller = new ApplicationController();

  // List all applications
  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "GET",
    url: "/",
    schema: {
      description: "List all applications with optional search and filters",
      summary: "List applications",
      tags: ["applications"],
      querystring: GetApplicationQueryStringSchema,
      response: { 
        200: PaginatedRequestSchema(ApplicationWithRelationsViewModelSchema),
      }
    },
    preHandler: [AuthenticationJWT],
    handler: controller.listApplications,
  });

  // Create a new application
  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "POST",
    url: "/",
    schema: {
      body: CreateApplicationSchema,
      description: "Create a new application",
      summary: "Create application",
      tags: ["applications"],
    },
    preHandler: [AuthenticationJWT],
    handler: controller.createApplication,
  });

  // Get application by ID
  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "GET",
    url: "/:id",
    schema: {
      description: "Get application by ID",
      summary: "Get application by ID",
      tags: ["applications"],
      params: z.object({
        id: z.string().uuid(),
      }),
    },
    preHandler: [AuthenticationJWT],
    handler: controller.getApplicationById,
  });

  // Update application by ID
  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "PUT",
    url: "/:id",
    schema: {
      description: "Update an application by ID",
      summary: "Update application by ID",
      tags: ["applications"],
      body: UpdateApplicationSchema,
      params: z.object({
        id: z.string().uuid(),
      }),
    },
    preHandler: [AuthenticationJWT],
    handler: controller.updateApplication,
  });

  //Summary application stats
  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "GET",
    url: "/summary",
    schema: {
      description: "Retrieve summary statistics for applications",
      summary: "Get applications summary",
      tags: ["applications"],
      querystring: z.object({
        startDate: z.string()
          .refine(val => /^\d{4}-\d{2}-\d{2}$/.test(val), {message: "Data Inicial no formato incorreto. Use YYYY-MM-DD. \n"} )
          .refine(val =>  !isNaN(Date.parse(val)), {message: "Data inválida"}),
        endDate: z.string()
          .refine(val => /^\d{4}-\d{2}-\d{2}$/.test(val), {message: " Data Final no formato incorreto. Use YYYY-MM-DD."} )  
          .refine(val =>  !isNaN(Date.parse(val)), {message: "invalid date"}),
      }),
      response:  {
        200: z.object({
          message: z.string(),
          summary: ApplicationSummaryStatsSchema,
        }),
      },
    },
    preHandler: [AuthenticationJWT],
    handler: controller.applicationStatsSummary,
  })

  // Applications Performance
  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "GET",
    url: "/performance",
    schema: {
      description: "Retrieve performance statistics for pilots",
      summary: "Get Applications performance",
      tags: ["applications"],
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
          pilots: PilotPerformanceSchema ,
        }),
      }
    },
    preHandler: [AuthenticationJWT],
    handler: controller.getApplicationsPerformance,
  })

  // Delete application by ID
  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "DELETE",
    url: "/:id",
    schema: {
      description: "Delete an application by ID",
      summary: "Delete application by ID",
      tags: ["applications"],
      params: z.object({
        id: z.string().uuid(),
      }),
    },
    preHandler: [AuthenticationJWT],
    handler: controller.deleteApplication,
  });

  // Get applications by customer ID
  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "GET",
    url: "/customer/:customerId",
    schema: {
      description: "Get applications by customer ID",
      summary: "Get applications by customer ID",
      tags: ["applications"],
      querystring: PaginatedRequestQueryStringSchema,
      params: z.object({
        customerId: z.string().uuid(),
      }),
      response: { 
        200: PaginatedRequestSchema(ApplicationWithRelationsViewModelSchema),
      }
    },
    preHandler: [AuthenticationJWT],
    handler: controller.getApplicationsByCustomerId,
  });

  // Get applications by pilot ID
  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "GET",
    url: "/pilot/:pilotId",
    schema: {
      description: "Get applications by pilot ID",
      summary: "Get applications by pilot ID",
      tags: ["applications"],
      querystring: PaginatedRequestQueryStringSchema,
      params: z.object({
        pilotId: z.string().uuid(),
      }),
      response: { 
        200: PaginatedRequestSchema(ApplicationWithRelationsViewModelSchema),
      }
    },
    preHandler: [AuthenticationJWT],
    handler: controller.getApplicationsByPilotId,
  });

  // Get applications by farm ID
  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "GET",
    url: "/farm/:farmId",
    schema: {
      description: "Get applications by farm ID",
      summary: "Get applications by farm ID",
      tags: ["applications"],
      querystring: PaginatedRequestQueryStringSchema,
      params: z.object({
        farmId: z.string().uuid(),
      }),
      response: { 
        200: PaginatedRequestSchema(ApplicationWithRelationsViewModelSchema),
      }
    },
    preHandler: [AuthenticationJWT],
    handler: controller.getApplicationsByFarmId,
  });

  // Get applications by service order ID
  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "GET",
    url: "/service-order/:serviceOrderId",
    schema: {
      description: "Get applications by service order ID",
      summary: "Get applications by service order ID",
      tags: ["applications"],
      querystring: PaginatedRequestQueryStringSchema,
      params: z.object({
        serviceOrderId: z.string().uuid(),
      }),
      response: { 
        200: PaginatedRequestSchema(ApplicationWithRelationsViewModelSchema),
      }
    },
    preHandler: [AuthenticationJWT],
    handler: controller.getApplicationsByServiceOrderId,
  });

  // Get applications by plot ID
  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "GET",
    url: "/plot/:plotId",
    schema: {
      description: "Get applications by plot ID",
      summary: "Get applications by plot ID",
      tags: ["applications"],
      querystring: PaginatedRequestQueryStringSchema,
      params: z.object({
        plotId: z.string().uuid(),
      }),
      response: { 
        200: PaginatedRequestSchema(ApplicationWithRelationsViewModelSchema),
      }
    },
    preHandler: [AuthenticationJWT],
    handler: controller.getApplicationsByPlotId,
  });

  // Get general statistics
  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "GET",
    url:"/stats",
    schema: {
      querystring: ApplicationStatsQueryStringSchema,
      description: "Retrieve general statistics for all applications with optional filters",
      summary: "Get general statiscs",
      tags: ["applications"],
      response: {
        200: z.object({
          message: z.string(),
          stats: z.object({
            applicationCount: z.number(),
            applicationCountByMonth: z.number(),
            totalAreaHectares: z.number(),
            averageApplicationArea: z.number(),
            typeOfProducts: z.array(
              z.object({
                product: z.string(),
                hectares: z.number(),
              })
            ),
            pilotsCount: z.number(),
            dronesCount: z.number(),
            culturesCount: z.number(),
            averageApplicationByPilot: z.number(),
            averageApplicationByDrone: z.number(),
            averageAreaCoveredApplication: z.number(),
            invalidApplication: z.number(),
            totalHectaresByMonth: z.number(),
            totalHectaresPerDay: z.number(),
            totalHectaresByMonthPerDay: z.number(),
            pendingApplicationsCount: z.number(),
            pendingApplicationsTotalArea: z.number(),
            pendingFarmsCount: z.number(),
            pendingPlotsCount: z.number(),
          }),
        }),
      },
    },
    preHandler: [AuthenticationJWT],
    handler: controller.getGeneralStats,
  })

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "GET",
    url: "/stats/evolution",
    schema: {
      querystring: ApplicationEvolutionQueryStringSchema,
      description: "Retrieve monthly evolution of applications with same stats filters",
      summary: "Get applications evolution",
      tags: ["applications"],
      response: {
        200: z.object({
          message: z.string(),
          evolution: z.array(ApplicationEvolutionItemSchema),
        }),
      },
    },
    preHandler: [AuthenticationJWT],
    handler: controller.getApplicationsEvolution,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "GET",
    url: "/stats/top-farms",
    schema: {
      querystring: TopFarmsStatsQueryStringSchema,
      description: "Retrieve top farms ranked by applied area",
      summary: "Get top farms by applied area",
      tags: ["applications"],
      response: {
        200: z.object({
          message: z.string(),
          topFarms: z.array(TopFarmStatsSchema),
        }),
      },
    },
    preHandler: [AuthenticationJWT],
    handler: controller.getTopFarmsStats,
  });

  // Get dashboard metrics for DashboardCardGeneralMetrics component
  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "GET",
    url: "/dashboard-metrics",
    schema: {
      querystring: DashboardMetricsQueryStringSchema,
      description: "Retrieve dashboard metrics for the general metrics dashboard card",
      summary: "Get dashboard metrics",
      tags: ["applications"],
      response: {
        200: DashboardMetricsResponseSchema,
      },
    },
    preHandler: [AuthenticationJWT],
    handler: controller.getDashboardMetrics,
  })

  done();
} 