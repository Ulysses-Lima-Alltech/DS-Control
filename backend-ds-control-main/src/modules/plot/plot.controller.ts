import type { FastifyReply, FastifyRequest } from "fastify";
import type { CreatePlotDTO } from "./dto/create-plot.dto";
import type { UpdatePlotDTO } from "./dto/update-plot.dto";

import AppError from "@common/handlers/app-error";
import type { PaginatedRequestQueryString } from "@common/types/paginated-request.types";
import { PlotVM } from "@models/plot.vm";
import { app } from "@modules/app/app.module";
import { PlotService } from "./services/plot.service";

export class PlotController {
  private service: PlotService;

  constructor() {
    this.service = new PlotService();
  }

  public createPlot = async (
    request: FastifyRequest<{ Body: CreatePlotDTO }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info("[PlotController] - Starting plot creation for farm %s", request.body.farmId);

      await this.service.createPlot(request.body);

      app.log.info("[PlotController] - Plot created successfully");
      return reply.status(201).send({
        message: "Plot created successfully",
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[PlotController] - Plot creation failed: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[PlotController] - Unexpected error during plot creation: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };

  public listPlots = async (
    request: FastifyRequest<{
      Querystring: PaginatedRequestQueryString;
    }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info("[PlotController] - Listing plots");
      const page = request.query.page ?? 1;
      const limit = request.query.limit ?? 10;
      const plots = await this.service.listPlots(page, limit);

      app.log.info("[PlotController] - Successfully listed plots");
      return reply.status(200).send({
        message: "Plots listed successfully",
        ...plots,
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[PlotController] - Failed to list plots: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[PlotController] - Unexpected error during plot listing: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };

  public getPlotById = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info("[PlotController] - Fetching plot details for plot %s", request.params.id);
      const plotDb = await this.service.getPlotById(request.params.id);
      const plot = PlotVM.toViewModel(plotDb);

      app.log.info("[PlotController] - Successfully retrieved plot details");
      return reply.status(200).send({
        message: "Plot details retrieved successfully",
        plot,
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[PlotController] - Failed to retrieve plot details: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[PlotController] - Unexpected error during plot details retrieval: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };

  public getPlotsByFarmId = async (
    request: FastifyRequest<{ Params: { farmId: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info("[PlotController] - Fetching plots for farm %s", request.params.farmId);
      const plots = await this.service.getPlotsByFarmId(request.params.farmId);

      app.log.info("[PlotController] - Successfully retrieved plots for farm");
      return reply.status(200).send({
        message: "Plots retrieved successfully",
        plots: plots.map((plot) => PlotVM.toViewModel(plot)),
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[PlotController] - Failed to retrieve plots for farm: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[PlotController] - Unexpected error during plots retrieval: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };

  public getPlotsByCustomerId = async (
    request: FastifyRequest<{ Params: { customerId: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info("[PlotController] - Fetching plots for customer %s", request.params.customerId);
      const plots = await this.service.getPlotsByCustomerId(request.params.customerId);

      app.log.info("[PlotController] - Successfully retrieved plots for customer");
      return reply.status(200).send({
        message: "Plots retrieved successfully",
        plots: plots.map((plot) => PlotVM.toViewModel(plot)),
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[PlotController] - Failed to retrieve plots for customer: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[PlotController] - Unexpected error during plots retrieval: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };

  public updatePlot = async (
    request: FastifyRequest<{ Params: { id: string }; Body: UpdatePlotDTO }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info("[PlotController] - Starting plot update for plot %s", request.params.id);

      const updatedPlot = await this.service.updatePlot(request.params.id, request.body);
      const plot = PlotVM.toViewModel(updatedPlot);

      app.log.info("[PlotController] - Plot updated successfully");
      return reply.status(200).send({
        message: "Plot updated successfully",
        plot,
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[PlotController] - Plot update failed: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[PlotController] - Unexpected error during plot update: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };

  public deletePlot = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info("[PlotController] - Starting plot deletion for plot %s", request.params.id);

      await this.service.deletePlot(request.params.id);

      app.log.info("[PlotController] - Plot deleted successfully");
      return reply.status(200).send({
        message: "Plot deleted successfully",
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[PlotController] - Plot deletion failed: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[PlotController] - Unexpected error during plot deletion: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };
}
