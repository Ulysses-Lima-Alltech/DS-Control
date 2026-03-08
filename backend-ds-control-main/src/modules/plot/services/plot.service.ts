import AppError from "@common/handlers/app-error";
import { HTTP_STATUS_CODES } from "@common/types/http-status.types";
import { db } from "@infra/database";
import { customers, farms, plots } from "@infra/database/schema";
import { and, count, eq, isNull } from "drizzle-orm";

import type { PaginatedRequest } from "@common/types/paginated-request.types";
import { PlotVM, type PlotViewModelSchema, type Plot as PlotVMType } from "@models/plot.vm";
import { app } from "@modules/app/app.module";
import { PlotRepository } from "@repositories/plots/plot.repository";
import type { Plot } from "@repositories/plots/plot.types";
import type { CreatePlotDTO } from "../dto/create-plot.dto";
import type { UpdatePlotDTO } from "../dto/update-plot.dto";

export class PlotService {
  private readonly plotRepository = new PlotRepository();

  /**
   * @description Create a new plot
   * @param {CreatePlotDTO} data - The plot data
   * @throws {AppError} If the farm or customer doesn't exist, or if plot name already exists for the farm
   */
  public async createPlot({
    name,
    farmId,
    customerId,
    geoJson,
    externalId,
    hectare,
  }: CreatePlotDTO): Promise<void> {
    app.log.info("[PlotService] - Starting plot creation for farm %s", farmId);

    const farm = await db.query.farms.findFirst({
      where: and(eq(farms.id, farmId), eq(farms.customerId, customerId)),
    });

    if (!farm) {
      app.log.warn(
        "[PlotService] - Plot creation failed: Farm %s not found or doesn't belong to customer %s",
        farmId,
        customerId,
      );
      throw new AppError(
        "Fazenda não encontrada ou não pertence ao cliente especificado",
        HTTP_STATUS_CODES.NOT_FOUND,
      );
    }

    const customer = await db.query.customers.findFirst({
      where: eq(customers.id, customerId),
    });

    if (!customer) {
      app.log.warn("[PlotService] - Plot creation failed: Customer %s not found", customerId);
      throw new AppError("Cliente não encontrado", HTTP_STATUS_CODES.NOT_FOUND);
    }

    const existingPlot = await db.query.plots.findFirst({
      where: and(
        eq(plots.externalId, externalId), 
        eq(plots.farmId, farmId),
        isNull(plots.deletedAt)
      ),
    });

    if (existingPlot) {
      app.log.warn(
        "[PlotService] - Plot creation failed: Plot name %s already exists for farm %s",
        name,
        farmId,
      );
      throw new AppError(
        "Já existe talhão com este nome para esta fazenda",
        HTTP_STATUS_CODES.CONFLICT,
      );
    }

    const plot = await this.plotRepository.createPlot({
      name,
      farmId,
      customerId,
      geoJson,
      externalId,
      hectare,
    });

    app.log.info("[PlotService] - Plot created successfully with ID %s", plot.id);
  }

  /**
   * @description Get all plots
   * @returns {Promise<Plot[]>} The list of plots
   */
  public async listPlots(
    page: number,
    limit: number,
  ): Promise<PaginatedRequest<typeof PlotViewModelSchema>> {
    app.log.info("[PlotService] - Listing all plots");

    const queryResult = await this.plotRepository.getAllPlots(page, limit);
    const [countResult] = await db.select({ count: count() }).from(plots);

    console.log(queryResult);
    app.log.info("[PlotService] - Retrieved %d plots", countResult.count);

    return {
      data: queryResult.map((plot) => PlotVM.toViewModel(plot)),
      page,
      limit,
      totalPages: Math.ceil(countResult.count / limit),
      totalCount: countResult.count,
    };
  }

  /**
   * @description Get plot by ID
   * @param {string} plotId - The plot's ID
   * @returns {Promise<PlotVMType>} The plot details
   * @throws {AppError} If the plot is not found
   */
  public async getPlotById(plotId: string): Promise<PlotVMType> {
    app.log.info("[PlotService] - Fetching plot details for plot %s", plotId);

    try {
      const plot = await this.plotRepository.getPlotById(plotId);

      if (!plot) {
        app.log.warn("[PlotService] - Plot not found: %s", plotId);
        throw new AppError("Talhão nao encontrado", HTTP_STATUS_CODES.NOT_FOUND);
      }

      app.log.info("[PlotService] - Successfully retrieved plot details for %s", plotId);
      return plot as PlotVMType;
    } catch (error) {
      app.log.error("[PlotService] - Failed to fetch plot details: %s", error);
      throw error;
    }
  }

  /**
   * @description Get plots by farm ID
   * @param {string} farmId - The farm's ID
   * @returns {Promise<Plot[]>} The list of plots for the farm
   */
  public async getPlotsByFarmId(farmId: string): Promise<Plot[]> {
    app.log.info("[PlotService] - Fetching plots for farm %s", farmId);

    // Validate that farm exists
    const farm = await db.query.farms.findFirst({
      where: eq(farms.id, farmId),
    });

    if (!farm) {
      app.log.warn("[PlotService] - Farm not found: %s", farmId);
      throw new AppError("Fazenda não encontrada", HTTP_STATUS_CODES.NOT_FOUND);
    }

    const plots = await this.plotRepository.getPlotsByFarmId(farmId);

    app.log.info("[PlotService] - Retrieved %d plots for farm %s", plots.length, farmId);
    return plots;
  }

  /**
   * @description Get plots by customer ID
   * @param {string} customerId - The customer's ID
   * @returns {Promise<Plot[]>} The list of plots for the customer
   */
  public async getPlotsByCustomerId(customerId: string): Promise<Plot[]> {
    app.log.info("[PlotService] - Fetching plots for customer %s", customerId);

    // Validate that customer exists
    const customer = await db.query.customers.findFirst({
      where: eq(customers.id, customerId),
    });

    if (!customer) {
      app.log.warn("[PlotService] - Customer not found: %s", customerId);
      throw new AppError("Cliente não encontrado", HTTP_STATUS_CODES.NOT_FOUND);
    }

    const plots = await this.plotRepository.getPlotsByCustomerId(customerId);

    app.log.info("[PlotService] - Retrieved %d plots for customer %s", plots.length, customerId);
    return plots;
  }

  /**
   * @description Update plot by ID
   * @param {string} plotId - The plot's ID
   * @param {UpdatePlotDTO} data - The plot data to update
   * @returns {Promise<PlotVMType>} The updated plot
   * @throws {AppError} If the plot is not found or validation fails
   */
  public async updatePlot(plotId: string, data: UpdatePlotDTO): Promise<PlotVMType> {
    app.log.info("[PlotService] - Starting plot update for plot %s", plotId);

    try {
      const existingPlot = await this.plotRepository.getPlotById(plotId);

      if (!existingPlot) {
        app.log.warn("[PlotService] - Plot update failed: Plot %s not found", plotId);
        throw new AppError("Talhão não encontrado", HTTP_STATUS_CODES.NOT_FOUND);
      }

      if (data.farmId || data.customerId) {
        const farmId = data.farmId || existingPlot.farmId;
        const customerId = data.customerId || existingPlot.customerId;

        const farm = await db.query.farms.findFirst({
          where: and(eq(farms.id, farmId), eq(farms.customerId, customerId)),
        });

        if (!farm) {
          app.log.warn(
            "[PlotService] - Plot update failed: Farm %s not found or doesn't belong to customer %s",
            farmId,
            customerId,
          );
          throw new AppError(
            "Fazenda não encontrada ou não pertence ao cliente especificado",
            HTTP_STATUS_CODES.NOT_FOUND,
          );
        }
      }

      if (data.externalId && data.externalId !== existingPlot.externalId) {
        const farmId = data.farmId || existingPlot.farmId;
        const externalIdExists = await db.query.plots.findFirst({
          where: and(
            eq(plots.externalId, data.externalId), 
            eq(plots.farmId, farmId),
            isNull(plots.deletedAt)
          ),
        });

        if (externalIdExists) {
          app.log.warn(
            "[PlotService] - Plot update failed: Plot external ID %s already exists for farm %s",
            data.externalId,
            farmId,
          );
          throw new AppError(
            "O talhão com este ID externo já existe para esta fazenda",
            HTTP_STATUS_CODES.CONFLICT,
          );
        }
      }

      const updatedPlot = await this.plotRepository.updatePlot(plotId, data);

      if (!updatedPlot) {
        app.log.error("[PlotService] - Plot update failed: Unable to update plot %s", plotId);
        throw new AppError("Falha ao atualizar o talhão", HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR);
      }

      app.log.info("[PlotService] - Plot updated successfully with ID %s", plotId);
      return updatedPlot as PlotVMType;
    } catch (error) {
      app.log.error("[PlotService] - Plot update failed: %s", error);
      throw error;
    }
  }

  /**
   * @description Delete a plot
   * @param {string} plotId - The plot's ID to delete
   * @returns {Promise<void>}
   * @throws {AppError} If the plot is not found
   */
  public async deletePlot(plotId: string): Promise<void> {
    app.log.info("[PlotService] - Starting plot deletion for plot %s", plotId);

    try {
      const existingPlot = await this.plotRepository.getPlotById(plotId);

      if (!existingPlot) {
        app.log.warn("[PlotService] - Plot deletion failed: Plot %s not found", plotId);
        throw new AppError("Talhão não encontrado", HTTP_STATUS_CODES.NOT_FOUND);
      }

      await this.plotRepository.deletePlot(plotId);

      app.log.info("[PlotService] - Plot deleted successfully with ID %s", plotId);
    } catch (error) {
      app.log.error("[PlotService] - Plot deletion failed: %s", error);
      throw error;
    }
  }
}
