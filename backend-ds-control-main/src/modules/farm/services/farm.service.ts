import AppError from '@common/handlers/app-error';
import { HTTP_STATUS_CODES } from '@common/types/http-status.types';
import { db } from '@infra/database';
import { customers, farms, plots } from '@infra/database/schema';
import { and, count, eq, isNull } from 'drizzle-orm';

import type { PaginatedRequest } from '@common/types/paginated-request.types';
import {
  FarmVM,
  type FarmWithPlotsViewModel,
  type FarmWithPlotsViewModelSchema,
} from '@models/farm.vm';
import { app } from '@modules/app/app.module';
import { FarmRepository } from '@repositories/farms/farm.repository';
import type { FarmOrderBy, FarmOrderType, FarmWithPlots } from '@repositories/farms/farm.types';
import { PlotRepository } from '@repositories/plots/plot.repository';
import type { CreateFarmDTO, CreateFarmPlotDTO } from '../dto/create-farm.dto';
import type { FarmSearchQueryString } from '../dto/list-all-farms.dto';
import type { UpdateFarmDTO, UpdateFarmPlotDTO } from '../dto/update-farm.dto';

export class FarmService {
  private readonly farmRepository = new FarmRepository();
  private readonly plotRepository = new PlotRepository();

  /**
   * @description Create a new farm with optional plots
   * @param {CreateFarmDTO} data - The farm data with optional plots
   * @throws {AppError} If the customer doesn't exist or validation fails
   */
  public async createFarm({
    name,
    customerId,
    plots: plotsData,
  }: CreateFarmDTO): Promise<void> {
    app.log.info(
      '[FarmService] - Starting farm creation for customer %s',
      customerId,
    );

    // Validate that customer exists
    const customer = await db.query.customers.findFirst({
      where: eq(customers.id, customerId),
    });

    if (!customer) {
      app.log.warn(
        '[FarmService] - Farm creation failed: Customer %s not found',
        customerId,
      );
      throw new AppError(
        'Cliente não encontrado',
        HTTP_STATUS_CODES.NOT_FOUND,
      );
    }

    // Check if farm name already exists for this customer
    const existingFarm = await db.query.farms.findFirst({
      where: and(eq(farms.name, name), eq(farms.customerId, customerId)),
    });

    if (existingFarm) {
      app.log.warn(
        '[FarmService] - Farm creation failed: Farm name %s already exists for customer %s',
        name,
        customerId,
      );
      throw new AppError(
        'Ja existe uma fazenda com este nome para esse cliente',
        HTTP_STATUS_CODES.CONFLICT,
      );
    }

    // Create the farm
    const farm = await this.farmRepository.createFarm({
      name,
      customerId,
    });

    app.log.info(
      '[FarmService] - Farm created successfully with ID %s',
      farm.id,
    );

    // Create plots if provided
    if (plotsData && plotsData.length > 0) {
      await this.createPlotsForFarm(farm.id, customerId, plotsData);
    }
  }

  /**
   * @description Get all farms with plots and optional search
   * @param {FarmSearchQueryString} query - The query string
   * @returns {Promise<FarmWithPlots[]>} The list of farms with plots
   */
  public async listFarms({
    page,
    limit,
    search,
    customerId,
    includePlots,
    includeGeoJson,
    includeCustomer,
    orderBy,
    orderType,
  }: FarmSearchQueryString): Promise<
    PaginatedRequest<typeof FarmWithPlotsViewModelSchema>
  > {
    app.log.info('[FarmService] - Listing all farms with plots');

    const queryResult =
      await this.farmRepository.getAllFarmsWithPlots(
        page,
        limit,
        search,
        customerId,
        includePlots,
        includeGeoJson,
        includeCustomer,
        orderBy,
        orderType, 
      );
    const totalCount = await this.farmRepository.getFarmsCount(search);

    app.log.info('[FarmService] - Retrieved %d farms', totalCount);

    return {
      data: queryResult.map((farm) => FarmVM.toViewModelWithPlots(farm)),
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
      totalCount,
    };
  }

  /**
   * @description Get all farms
   * @param {string} farmId - The farm's ID
   * @param {string} customerId - The customer's ID
   * @returns {Promise<FarmWithPlots[]>} The farms list
   */
  public async getAllFarms(
    includePlots: boolean,
    includeGeoJson: boolean,
    includeCustomer: boolean,
    farmId?: string,
    customerId?: string,
    orderBy?: FarmOrderBy,
    orderType?: FarmOrderType,
  ): Promise<FarmWithPlots[]> {
    app.log.info('[FarmService] - Listing all farms with plots');

    const queryResult = await this.farmRepository.getAllFarms(
      farmId,
      customerId,
      includePlots,
      includeGeoJson,
      includeCustomer,
      orderBy,
      orderType,
    );

    if (farmId && customerId && queryResult.length === 0) {
      app.log.warn(
        '[FarmService] - The farm does not belong to this customer: %s : %s',
        farmId,
        customerId,
      );
      throw new AppError(
        'A fazenda não pertence a este cliente',
        HTTP_STATUS_CODES.BAD_REQUEST,
      );
    }

    if (customerId && queryResult.length === 0) {
      app.log.warn(
        '[FarmService] - Customer not found: %s',
        customerId,
      );
      throw new AppError(
        'Cliente não encontrado',
        HTTP_STATUS_CODES.NOT_FOUND,
      );
    }

    if (farmId && !customerId && queryResult.length === 0) {
      app.log.warn(
        '[FarmService] - Farm not found: %s',
        farmId,
      );
      throw new AppError(
        'Fazenda não encontrada',
        HTTP_STATUS_CODES.NOT_FOUND,
      );
    }

    return queryResult;
  }

  /**
   * @description Get farm by ID with plots
   * @param {string} farmId - The farm's ID
   * @returns {Promise<FarmWithPlotsViewModel>} The farm details with plots
   * @throws {AppError} If the farm is not found
   */
  public async getFarmById(
    farmId: string, 
    includePlots: boolean,
    includeGeoJson: boolean,
    includeCustomer: boolean,
  ): Promise<FarmWithPlots> {
    app.log.info(
      '[FarmService] - Fetching farm details for farm %s',
      farmId,
    );

    const farm = await this.farmRepository.getFarmWithPlotsById(farmId, includePlots, includeGeoJson, includeCustomer);

    if (!farm) {
      app.log.warn(
        '[FarmService] - Farm not found: %s',
        farmId,
      );
      throw new AppError(
        'Fazenda não encontrada',
        HTTP_STATUS_CODES.NOT_FOUND,
      );
    }

    app.log.info(
      '[FarmService] - Successfully retrieved farm details for %s',
      farmId,
    );
    return farm;
  }

  /**
   * @description Get farms by customer ID with plots
   * @param {string} customerId - The customer's ID
   * @returns {Promise<FarmWithPlots[]>} The list of farms for the customer
   */
  public async getFarmsByCustomerId(
    customerId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedRequest<typeof FarmWithPlotsViewModelSchema>> {
    app.log.info(
      '[FarmService] - Fetching farms for customer %s',
      customerId,
    );

    // Validate that customer exists
    const customer = await db.query.customers.findFirst({
      where: eq(customers.id, customerId),
    });

    if (!customer) {
      app.log.warn(
        '[FarmService] - Customer not found: %s',
        customerId,
      );
      throw new AppError(
        'Cliente não encontrado',
        HTTP_STATUS_CODES.NOT_FOUND,
      );
    }

    const queryResult =
      await this.farmRepository.getFarmsByCustomerIdWithPlots(
        customerId,
        page,
        limit,
      );
    const [countResult] = await db
      .select({ count: count() })
      .from(farms)
      .where(eq(farms.customerId, customerId));

    app.log.info(
      '[FarmService] - Retrieved %d farms for customer %s',
      countResult.count,
      customerId,
    );

    return {
      data: queryResult.map((farm) => FarmVM.toViewModelWithPlots(farm)),
      page,
      limit,
      totalPages: Math.ceil(countResult.count / limit),
      totalCount: countResult.count,
    };
  }

  /**
   * @description Update farm by ID with optional plots management
   * @param {string} farmId - The farm's ID
   * @param {UpdateFarmDTO} data - The farm data to update
   * @returns {Promise<FarmWithPlots>} The updated farm with plots
   * @throws {AppError} If the farm is not found or validation fails
   */
  public async updateFarm(
    farmId: string,
    data: UpdateFarmDTO,
  ): Promise<FarmWithPlots> {
    app.log.info(
      '[FarmService] - Starting farm update for farm %s',
      farmId,
    );

    const existingFarm = await this.farmRepository.getFarmById(farmId);

    if (!existingFarm) {
      app.log.warn(
        '[FarmService] - Farm update failed: Farm %s not found',
        farmId,
      );
      throw new AppError(
        'Fazenda não encontrada',
        HTTP_STATUS_CODES.NOT_FOUND,
      );
    }

    if (data.customerId && data.customerId !== existingFarm.customerId) {
      const customer = await db.query.customers.findFirst({
        where: eq(customers.id, data.customerId),
      });

      if (!customer) {
        app.log.warn(
          '[FarmService] - Farm update failed: Customer %s not found',
          data.customerId,
        );
        throw new AppError(
          'Cliente não encontrado',
          HTTP_STATUS_CODES.NOT_FOUND,
        );
      }
    }

    if (data.name && data.name !== existingFarm.name) {
      const customerId = data.customerId || existingFarm.customerId;
      const nameExists = await db.query.farms.findFirst({
        where: and(
          eq(farms.name, data.name),
          eq(farms.customerId, customerId),
        ),
      });

      if (nameExists) {
        app.log.warn(
          '[FarmService] - Farm update failed: Farm name %s already exists for customer %s',
          data.name,
          customerId,
        );
        throw new AppError(
          'Ja existe uma fazenda com este nome para esse cliente',
          HTTP_STATUS_CODES.CONFLICT,
        );
      }
    }

    const updateData: { name?: string; customerId?: string } = {};
    if (data.name) updateData.name = data.name;
    if (data.customerId) updateData.customerId = data.customerId;

    if (Object.keys(updateData).length > 0) {
      await this.farmRepository.updateFarm(farmId, updateData);
    }

    const finalCustomerId = data.customerId || existingFarm.customerId;
    await this.updatePlotsForFarm(farmId, finalCustomerId, data.plots);

    const updatedFarm = await this.farmRepository.getFarmWithPlotsById(farmId);

    if (!updatedFarm) {
      app.log.error(
        '[FarmService] - Farm update failed: Unable to retrieve updated farm %s',
        farmId,
      );
      throw new AppError(
        'Falha ao atualizar a fazenda',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
      );
    }

    app.log.info(
      '[FarmService] - Farm updated successfully with ID %s',
      farmId,
    );
    return updatedFarm;
  }

  /**
   * @description soft Delete a farm
   * @param {string} farmId - The farm's ID to delete
   * @returns {Promise<void>}
   * @throws {AppError} If the farm is not found
   */
  public async deleteFarm(farmId: string): Promise<void> {
    app.log.info(
      '[FarmService] - Starting farm deletion for farm %s',
      farmId,
    );

    // Check if farm exists
    const existingFarm = await this.farmRepository.getFarmById(farmId);

    if (!existingFarm) {
      app.log.warn(
        '[FarmService] - Farm deletion failed: Farm %s not found',
        farmId,
      );
      throw new AppError(
        'Fazenda não encontrada',
        HTTP_STATUS_CODES.NOT_FOUND,
      );
    }

    // Check if Service status open
    const openService = await this.farmRepository.OpenServiceOrders(farmId);

    if (openService) {
      throw new AppError(
        'Cannot delete farm with open service orders',
        HTTP_STATUS_CODES.BAD_REQUEST,
      );
    }

    await this.farmRepository.deleteFarm(farmId);

    app.log.info(
      '[FarmService] - Farm deleted successfully with ID %s',
      farmId,
    );
  }

  /**
   * @description Create plots for a farm
   * @private
   */
  private async createPlotsForFarm(
    farmId: string,
    customerId: string,
    plotsData: Array<CreateFarmPlotDTO>,
  ): Promise<void> {
    app.log.info(
      '[FarmService] - Creating %d plots for farm %s',
      plotsData.length,
      farmId,
    );

    for (const plotData of plotsData) {
      const existingPlot = await db.query.plots.findFirst({
        where: and(
          eq(plots.farmId, farmId),
          eq(plots.externalId, plotData.externalId),
          isNull(plots.deletedAt),
        ),
      });

      if (existingPlot) {
        app.log.warn(
          '[FarmService] - Skipping plot creation: Plot external ID %s already exists for farm %s',
          plotData.externalId,
          farmId,
        );
        continue;
      }

      await this.plotRepository.createPlot({
        name: plotData.name,
        farmId,
        customerId,
        geoJson: plotData.geoJson,
        externalId: plotData.externalId,
        hectare: plotData.hectare,
      });
    }

    app.log.info(
      '[FarmService] - Successfully created plots for farm %s',
      farmId,
    );
  }

  /**
   * @description Update plots for a farm
   * @private
   */
  private async updatePlotsForFarm(
    farmId: string,
    customerId: string,
    plotsData: Array<UpdateFarmPlotDTO>,
  ): Promise<void> {
    app.log.info(
      '[FarmService] - Updating plots for farm %s',
      farmId,
    );
    const currentPlots = await this.plotRepository.getPlotsByFarmId(farmId);

    const incomingExternalIds = plotsData.map((plot) => plot.externalId);
    const plotsToDelete = currentPlots.filter(
      (currentPlot) =>
        !incomingExternalIds.includes(currentPlot.externalId),
    );

    await db.transaction(async () => {
      // Soft delete plots that are no longer in the incoming data
      if (plotsToDelete.length > 0) {
        await this.plotRepository.softDeletePlotsByExternalIds(
          plotsToDelete.map((plot) => plot.externalId),
          farmId,
        );
      }

      for (const plotData of plotsData) {
        const existingPlot = currentPlots.find(
          (plot) => plot.externalId === plotData.externalId,
        );

        if (existingPlot) {
          app.log.info(
            '[FarmService] - Updating plot with external ID %s for farm %s',
            plotData.externalId,
            farmId,
          );

          await this.plotRepository.updatePlot(existingPlot.id, {
            name: plotData.name,
            geoJson: plotData.geoJson,
            externalId: plotData.externalId,
          });
        } else {
          app.log.info(
            '[FarmService] - Creating new plot with external ID %s for farm %s',
            plotData.externalId,
            farmId,
          );

          await this.plotRepository.createPlot({
            name: plotData.name,
            farmId,
            customerId,
            geoJson: plotData.geoJson,
            externalId: plotData.externalId,
            hectare: plotData.hectare,
          });
        }
      }
    });

    app.log.info(
      '[FarmService] - Successfully updated plots for farm %s',
      farmId,
    );
  }
}
