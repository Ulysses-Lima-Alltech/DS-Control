import type { FastifyReply, FastifyRequest } from "fastify";
import type { CreateApplicationDTO } from "./dto/create-application.dto";
import type { ApplicationStatsQueryString } from "./dto/stats.dto";
import type { ApplicationEvolutionQueryString } from "./dto/stats-evolution.dto";
import type { TopFarmsStatsQueryString } from "./dto/stats-top-farms.dto";
import type { ByPilotStatsQueryString } from "./dto/stats-by-pilot.dto";
import type { UpdateApplicationDTO } from "./dto/update-application.dto";
import type { DashboardMetricsQueryString } from "./dto/dashboard-metrics.dto";
import type { ApplicationIssueFilter } from "./dto/get-all-application.dto";

import AppError from "@common/handlers/app-error";
import type { PaginatedRequestQueryString } from "@common/types/paginated-request.types";
import { ApplicationVM } from "@models/application.vm";
import { app } from "@modules/app/app.module";
import { ApplicationOrderBy, ApplicationOrderType } from "@repositories/applications/application.types";
import { ApplicationService } from "./services/application.service";

export class ApplicationController {
  private service: ApplicationService;

  constructor() {
    this.service = new ApplicationService();
  }

  public createApplication = async (
    request: FastifyRequest<{
      Body: CreateApplicationDTO;
    }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info("[ApplicationController] - Starting application creation");

      await this.service.createApplication(request.body);

      app.log.info("[ApplicationController] - Application created successfully");
      return reply.status(201).send({
        message: "Application created successfully",
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[ApplicationController] - Application creation failed: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[ApplicationController] - Unexpected error during application creation: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };

  public listApplications = async (
    request: FastifyRequest<{
      Querystring: PaginatedRequestQueryString & { 
        search?: string;
        serviceOrderStatus?: "open" | "completed" | "cancelled";
        farmId?: string;
        pilotId?: string;
        productId?: string;
        cropSeasonId?: string;
        cropSeasonIds?: string[];
        customerId?: string;
        serviceOrderId?: string;
        assistantId?: string;
        droneId?: string;
        cultureId?: string;
        plotId?: string;
        customerName?: string;
        farmName?: string;
        pilotName?: string;
        assistantName?: string;
        droneName?: string;
        cultureName?: string;
        plotName?: string;
        productName?: string;
        observations?: string;
        serviceOrderNumber?: string;
        hectaresMin?: number;
        hectaresMax?: number;
        flowRateMin?: number;
        flowRateMax?: number;
        altitudeMin?: number;
        altitudeMax?: number;
        routeSpacingMin?: number;
        routeSpacingMax?: number;
        dropletSizeMin?: number;
        dropletSizeMax?: number;
        invalidApplication?: boolean;
        applicationIssue?: ApplicationIssueFilter;
        startDate?: string;
        endDate?: string;
        orderBy?: ApplicationOrderBy;
        orderType?: ApplicationOrderType;
      };
    }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info("[ApplicationController] - Listing applications");
      const page = request.query.page ?? 1;
      const limit = request.query.limit ?? 10;
      const search = request.query.search;
      const filters = {
        serviceOrderStatus: request.query.serviceOrderStatus,
        farmId: request.query.farmId,
        pilotId: request.query.pilotId,
        productId: request.query.productId,
        cropSeasonId: request.query.cropSeasonId,
        cropSeasonIds: request.query.cropSeasonIds,
        customerId: request.query.customerId,
        serviceOrderId: request.query.serviceOrderId,
        assistantId: request.query.assistantId,
        droneId: request.query.droneId,
        cultureId: request.query.cultureId,
        plotId: request.query.plotId,
        customerName: request.query.customerName,
        farmName: request.query.farmName,
        pilotName: request.query.pilotName,
        assistantName: request.query.assistantName,
        droneName: request.query.droneName,
        cultureName: request.query.cultureName,
        plotName: request.query.plotName,
        productName: request.query.productName,
        observations: request.query.observations,
        serviceOrderNumber: request.query.serviceOrderNumber,
        hectaresMin: request.query.hectaresMin,
        hectaresMax: request.query.hectaresMax,
        flowRateMin: request.query.flowRateMin,
        flowRateMax: request.query.flowRateMax,
        altitudeMin: request.query.altitudeMin,
        altitudeMax: request.query.altitudeMax,
        routeSpacingMin: request.query.routeSpacingMin,
        routeSpacingMax: request.query.routeSpacingMax,
        dropletSizeMin: request.query.dropletSizeMin,
        dropletSizeMax: request.query.dropletSizeMax,
        invalidApplication: request.query.invalidApplication,
        applicationIssue: request.query.applicationIssue,
        startDate: request.query.startDate,
        endDate: request.query.endDate,
      };
      const orderBy = request.query.orderBy;
      const orderType = request.query.orderType;

      const result = await this.service.listApplications(
        page,
        limit,
        search,
        filters,
        orderBy,
        orderType,
        request.payload?.userId,
      );

      app.log.info("[ApplicationController] - Successfully listed applications");
      return reply.status(200).send({
        message: "Applications listed successfully",
        ...result,
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[ApplicationController] - Failed to list applications: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[ApplicationController] - Unexpected error during application listing: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };

  public getApplicationById = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info("[ApplicationController] - Fetching application details for application %s", request.params.id);
      const applicationDb = await this.service.getApplicationById(request.params.id);
      const application = ApplicationVM.toViewModelWithRelations(applicationDb);

      app.log.info("[ApplicationController] - Successfully retrieved application details");
      return reply.status(200).send({
        message: "Application details retrieved successfully",
        application,
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[ApplicationController] - Failed to retrieve application details: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[ApplicationController] - Unexpected error during application details retrieval: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };

  public getApplicationsByCustomerId = async (
    request: FastifyRequest<{
      Params: { customerId: string };
      Querystring: PaginatedRequestQueryString;
    }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info(
        "[ApplicationController] - Listing applications for customer %s",
        request.params.customerId,
      );
      
      const page = request.query.page ?? 1;
      const limit = request.query.limit ?? 10;
      const result = await this.service.getApplicationsByCustomerId(
        request.params.customerId,
        page,
        limit,
      );

      app.log.info("[ApplicationController] - Successfully listed applications for customer");
      
      return reply.status(200).send({
        message: "Applications for customer listed successfully",
        ...result,
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[ApplicationController] - Failed to list applications for customer: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[ApplicationController] - Unexpected error during applications listing for customer: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };

  public getApplicationsByPilotId = async (
    request: FastifyRequest<{
      Params: { pilotId: string };
      Querystring: PaginatedRequestQueryString;
    }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info(
        "[ApplicationController] - Listing applications for pilot %s",
        request.params.pilotId,
      );
      
      const page = request.query.page ?? 1;
      const limit = request.query.limit ?? 10;
      const result = await this.service.getApplicationsByPilotId(
        request.params.pilotId,
        page,
        limit,
        request.payload?.userId,
      );

      app.log.info("[ApplicationController] - Successfully listed applications for pilot");
      
      return reply.status(200).send({
        message: "Applications for pilot listed successfully",
        ...result,
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[ApplicationController] - Failed to list applications for pilot: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[ApplicationController] - Unexpected error during applications listing for pilot: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };

  public getApplicationsByFarmId = async (
    request: FastifyRequest<{
      Params: { farmId: string };
      Querystring: PaginatedRequestQueryString;
    }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info(
        "[ApplicationController] - Listing applications for farm %s",
        request.params.farmId,
      );
      
      const page = request.query.page ?? 1;
      const limit = request.query.limit ?? 10;
      const result = await this.service.getApplicationsByFarmId(
        request.params.farmId,
        page,
        limit,
      );

      app.log.info("[ApplicationController] - Successfully listed applications for farm");
      
      return reply.status(200).send({
        message: "Applications for farm listed successfully",
        ...result,
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[ApplicationController] - Failed to list applications for farm: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[ApplicationController] - Unexpected error during applications listing for farm: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };

  public getApplicationsByServiceOrderId = async (
    request: FastifyRequest<{
      Params: { serviceOrderId: string };
      Querystring: PaginatedRequestQueryString;
    }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info(
        "[ApplicationController] - Listing applications for service order %s",
        request.params.serviceOrderId,
      );
      
      const page = request.query.page ?? 1;
      const limit = request.query.limit ?? 10;
      const result = await this.service.getApplicationsByServiceOrderId(
        request.params.serviceOrderId,
        page,
        limit,
        request.payload?.userId,
      );

      app.log.info("[ApplicationController] - Successfully listed applications for service order");
      
      return reply.status(200).send({
        message: "Applications for service order listed successfully",
        ...result,
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[ApplicationController] - Failed to list applications for service order: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[ApplicationController] - Unexpected error during applications listing for service order: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };

  public getApplicationsByPlotId = async (
    request: FastifyRequest<{
      Params: { plotId: string };
      Querystring: PaginatedRequestQueryString;
    }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info(
        "[ApplicationController] - Listing applications for plot %s",
        request.params.plotId,
      );
      
      const page = request.query.page ?? 1;
      const limit = request.query.limit ?? 10;
      const result = await this.service.getApplicationsByPlotId(
        request.params.plotId,
        page,
        limit,
      );

      app.log.info("[ApplicationController] - Successfully listed applications for plot");
      
      return reply.status(200).send({
        message: "Applications for plot listed successfully",
        ...result,
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[ApplicationController] - Failed to list applications for plot: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[ApplicationController] - Unexpected error during applications listing for plot: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };

  public updateApplication = async (
    request: FastifyRequest<{ Params: { id: string }; Body: UpdateApplicationDTO }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info("[ApplicationController] - Starting application update for application %s", request.params.id);

      const updatedApplication = await this.service.updateApplication(request.params.id, request.body);
      const application = ApplicationVM.toViewModel(updatedApplication);

      app.log.info("[ApplicationController] - Application updated successfully");
      return reply.status(200).send({
        message: "Application updated successfully",
        application,
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[ApplicationController] - Application update failed: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[ApplicationController] - Unexpected error during application update: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };

  public applicationStatsSummary = async (
    request: FastifyRequest<{Querystring: {
      startDate: string,
      endDate: string,
    }}>,
    reply: FastifyReply
  ) => {
    try {
       const { startDate, endDate  } = request.query;

       app.log.info("[ApplicationController] - Starting application stats for application %s - %s", startDate, endDate);
       const summary = await this.service.applicationStatsSummary(startDate, endDate);

       app.log.info("[ApplicationController] - Application successfully")
       return reply.status(200).send({
        message: "application stats sucessfully",
        summary,
       });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[ApplicationController] - Application stats failed: %s", error.message)
        reply.status(error.statusCode).send(error.throw());
        return 
      }

      app.log.error("[ApplicationController] - Unexpected error during application stats: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  }


  public getApplicationsPerformance = async (
    request: FastifyRequest<{ Querystring: {
      startDate: string, endDate: string
    }}>,
    reply: FastifyReply
  ) => {
    try {
      const { startDate, endDate } = request.query;

      const pilots = await this.service.getApplicationsPerformance(startDate, endDate);

      return reply.status(200).send({
        message: "Pilots performance retrieved successfully",
        pilots,
      })
    } catch(error) {
      if (error instanceof AppError) {
        app.log.warn("[ApplicationController] - Application stats performance failed: %s", error.message)
        reply.status(error.statusCode).send(error.throw());
        return 
      }
      
      app.log.error("[ApplicationController] - Error on pilots performance: %s", error);
      return reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  }

  public deleteApplication = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info("[ApplicationController] - Starting application deletion for application %s", request.params.id);

      await this.service.deleteApplication(request.params.id);

      app.log.info("[ApplicationController] - Application deleted successfully");
      return reply.status(200).send({
        message: "Application deleted successfully",
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[ApplicationController] - Application deletion failed: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[ApplicationController] - Unexpected error during application deletion: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };

  public getGeneralStats = async (
    request: FastifyRequest<{ Querystring: ApplicationStatsQueryString }>, 
    reply: FastifyReply,
  ) => {
    try {
      app.log.info('[ApplicationController] -  Fetching general statistics');

      const stats = await this.service.getGeneralStats(request.query);

      app.log.info('[ApplicationController] - Successfully retrieved general statistics');
      return reply.status(200).send({
        message: 'General statistics retrieved successfully',
        stats,
      });
    } catch (error) {
      if(error instanceof AppError) {
        app.log.warn(
          '[ApplicationController] - Failed to retrieve general statistics: %s',
          error.message,
        );

        reply.status(error.statusCode).send(error.throw());
        return 
      }

      app.log.error(
        '[ApplicationController] - Unexpected error during general statistics retrieval: %o',
        { error },
      );
      reply.status(500).send(new AppError('Internal server error', 500, error).throw())
    }
  }

  public getTopFarmsStats = async (
    request: FastifyRequest<{ Querystring: TopFarmsStatsQueryString }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info("[ApplicationController] - Fetching top farms statistics");

      const topFarms = await this.service.getTopFarmsStats(request.query);

      app.log.info("[ApplicationController] - Successfully retrieved top farms statistics");
      return reply.status(200).send({
        message: "Top farms statistics retrieved successfully",
        topFarms,
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn(
          "[ApplicationController] - Failed to retrieve top farms statistics: %s",
          error.message,
        );
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error(
        "[ApplicationController] - Unexpected error during top farms statistics retrieval: %o",
        { error },
      );
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  }

  public getApplicationsEvolution = async (
    request: FastifyRequest<{ Querystring: ApplicationEvolutionQueryString }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info("[ApplicationController] - Fetching applications evolution");

      const evolution = await this.service.getApplicationsEvolution(request.query);

      app.log.info("[ApplicationController] - Successfully retrieved applications evolution");
      return reply.status(200).send({
        message: "Applications evolution retrieved successfully",
        evolution,
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn(
          "[ApplicationController] - Failed to retrieve applications evolution: %s",
          error.message,
        );
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error(
        "[ApplicationController] - Unexpected error during applications evolution retrieval: %o",
        { error },
      );
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  }

  public getStatsByPilot = async (
    request: FastifyRequest<{ Querystring: ByPilotStatsQueryString }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info("[ApplicationController] - Fetching by-pilot operational stats");

      const byPilot = await this.service.getStatsByPilot(request.query);

      app.log.info("[ApplicationController] - Successfully retrieved by-pilot operational stats");
      return reply.status(200).send({
        message: "By-pilot operational stats retrieved successfully",
        byPilot,
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn(
          "[ApplicationController] - Failed to retrieve by-pilot operational stats: %s",
          error.message,
        );
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error(
        "[ApplicationController] - Unexpected error during by-pilot stats retrieval: %o",
        { error },
      );
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  }

  public getDashboardMetrics = async (
    request: FastifyRequest<{ Querystring: DashboardMetricsQueryString }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info('[ApplicationController] - Fetching dashboard metrics');

      const metrics = await this.service.getDashboardMetrics(request.query);

      app.log.info('[ApplicationController] - Successfully retrieved dashboard metrics');
      return reply.status(200).send({
        message: 'Dashboard metrics retrieved successfully',
        metrics,
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn(
          '[ApplicationController] - Failed to retrieve dashboard metrics: %s',
          error.message,
        );
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error(
        '[ApplicationController] - Unexpected error during dashboard metrics retrieval: %o',
        { error },
      );
      reply.status(500).send(new AppError('Internal server error', 500, error).throw());
    }
  }
} 
