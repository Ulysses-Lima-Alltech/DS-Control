import AppError from '@common/handlers/app-error';
import { HTTP_STATUS_CODES } from '@common/types/http-status.types';
import type { PaginatedRequest } from '@common/types/paginated-request.types';
import { db } from '@infra/database';
import {
  applications,
  contracts,
  customers,
  farms,
  plots,
  serviceOrderFarms,
  serviceOrderPilots,
  serviceOrderPlots,
  serviceOrders,
  users,
} from '@infra/database/schema';
import { ServiceOrderVM, type ServiceOrderWithDetailsSchema } from '@models/service-order.vm';
import { ServiceOrderRepository } from '@repositories/service-order/service-order.repository';
import type {
  ServiceOrder,
  ServiceOrderWithDetails,
} from '@repositories/service-order/service-order.types';
import { UserRepository } from '@repositories/users/user.repository';
import { UserType } from '@repositories/users/user.types';
import { and, count, countDistinct, eq, exists, gte, inArray, isNull, lt, sum } from 'drizzle-orm';
import type { z } from 'zod';
import type { CreateServiceOrderDTO } from './dto/create-service-order';
import type { GetServiceOrderQueryString } from './dto/get-all-service-order.dto';
import type { ServiceOrderSearchQueryStringByPilot } from './dto/get-all-service-orders-by-pilot-dto';
import type { ServiceOrderDetailsQueryString } from './dto/get-service-order-details.dto';
import type { ServiceOrderStatsDTO, ServiceOrderStatsQueryString } from './dto/stats.dto';
import type { UpdateServiceOrderStatusDTO } from './dto/update-service-order-status.dto';
import type { UpdateServiceOrderDTO } from './dto/update-service-order.dto';
import type { UpdateServiceOrderPlotStatusDTO } from './dto/update-service-order-plot-status.dto';

export class ServiceOrderService {
  private readonly serviceOrderRepository: ServiceOrderRepository;
  private readonly userRepository: UserRepository;

  constructor() {
    this.serviceOrderRepository = new ServiceOrderRepository();
    this.userRepository = new UserRepository();
  }

  /**
   * Creates a new service order after validating pilots, contract, plots, and farms.
   * @param {CreateServiceOrderDTO} dto - Service order data transfer object containing all required fields.
   * @returns {Promise<void>} Resolves if all validations pass and service order is created.
   * @throws {AppError} Throws if any validation fails.
   */
  public async createServiceOrder(dto: CreateServiceOrderDTO): Promise<void> {
    await Promise.all([
      this.validatePilots(dto.pilotsIds),
      this.validateContract(dto.contractId, dto.customerId),
      this.validatePlots(dto.plotsIds, dto.farmsIds),
      this.validateFarms(dto.farmsIds, dto.customerId),
    ]);

    await this.serviceOrderRepository.createServiceOrder(dto);
  }

  /**
   * Retrieves a service order by its ID.
   * @param {string} serviceOrderId - The service order ID.
   * @returns {Promise<z.infer<typeof ServiceOrderWithDetailsSchema>>} The service order details.
   * @throws {AppError} Throws if service order is not found.
   */
  public async getServiceOrderById(
    serviceOrderId: string,
    params: ServiceOrderDetailsQueryString,
    requestUserId?: string,
  ): Promise<z.infer<typeof ServiceOrderWithDetailsSchema>> {
    const currentPilotId = await this.getAuthorizedPilotIdForServiceOrder(
      serviceOrderId,
      requestUserId,
    );

    const serviceOrder = await this.serviceOrderRepository.getServiceOrderById(
      serviceOrderId,
      params.includePlots,
      params.includePilots,
      params.includeFarms,
      params.includeContracts,
      params.includeCustomers,
      params.includeGeoJson,
      currentPilotId,
    );

    if (!serviceOrder) {
      throw new AppError('Ordem de serviço não encontrada', HTTP_STATUS_CODES.NOT_FOUND);
    }

    return ServiceOrderVM.toViewModelWithDetails(serviceOrder);
  }

  /**
   * Retrieves all service orders with pagination, optional search and filters.
   * @param {GetServiceOrderQueryString} params - The search query string.
   * @returns {Promise<PaginatedRequest<typeof ServiceOrderWithDetailsSchema>>} Paginated service orders.
   */
  public async getAllServiceOrders({
    page,
    limit,
    search,
    status,
    farmId,
    pilotId,
    customerId,
    invalidApplication,
    startDate,
    endDate,
    includePlots,
    includePilots,
    includeFarms,
    includeContracts,
    includeCustomers,
    includeGeoJson,
    orderBy,
    orderType,
  }: GetServiceOrderQueryString): Promise<PaginatedRequest<typeof ServiceOrderWithDetailsSchema>> {
    const parsedStartDate = startDate ? new Date(startDate) : undefined;
    const parsedEndDate = endDate ? new Date(endDate) : undefined;

    const filters = {
      status,
      farmId,
      pilotId,
      customerId,
      invalidApplication,
      startDate: parsedStartDate,
      endDate: parsedEndDate,
    };

    const serviceOrders = (await this.serviceOrderRepository.getAllServiceOrders(
      page,
      limit,
      search,
      filters,
      includePlots,
      includePilots,
      includeFarms,
      includeContracts,
      includeCustomers,
      includeGeoJson,
      orderBy,
      orderType,
    )) as ServiceOrderWithDetails[];

    const totalCount = await this.serviceOrderRepository.countServiceOrders(search, filters);

    return {
      data: serviceOrders.map((serviceOrder: ServiceOrderWithDetails) =>
        ServiceOrderVM.toViewModelWithDetails(serviceOrder),
      ),
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
      totalCount,
    };
  }

  /**
   * Updates a service order.
   * @param {string} serviceOrderId - The service order ID.
   * @param {UpdateServiceOrderDTO} dto - The update data.
   * @returns {Promise<ServiceOrder>} The updated service order.
   * @throws {AppError} Throws if service order is not found or validation fails.
   */
  public async updateServiceOrder(
    serviceOrderId: string,
    dto: UpdateServiceOrderDTO,
  ): Promise<ServiceOrder> {
    const existingServiceOrder =
      await this.serviceOrderRepository.getServiceOrderById(serviceOrderId);
    if (!existingServiceOrder) {
      throw new AppError('Ordem de serviço não encontrada', HTTP_STATUS_CODES.NOT_FOUND);
    }

    const validations: Promise<void>[] = [];

    if (dto.pilotsIds) {
      validations.push(this.validatePilots(dto.pilotsIds));
    }

    if (dto.contractId) {
      validations.push(this.validateContract(dto.contractId, existingServiceOrder.customerId));
    }

    if (dto.plotsIds && dto.farmsIds) {
      validations.push(this.validatePlots(dto.plotsIds, dto.farmsIds));
    } else if (dto.plotsIds) {
      const existingFarmsIds = existingServiceOrder.farms.map((farm) => farm.id);
      validations.push(this.validatePlots(dto.plotsIds, existingFarmsIds));
    }

    if (dto.farmsIds) {
      validations.push(this.validateFarms(dto.farmsIds, existingServiceOrder.customerId));
    }

    await Promise.all(validations);

    return await this.serviceOrderRepository.updateServiceOrder(serviceOrderId, dto);
  }

  /**
   * Updates the status of a service order.
   * @param {string} serviceOrderId - The service order ID.
   * @param {UpdateServiceOrderStatusDTO} dto - The status update data.
   * @returns {Promise<ServiceOrder>} The updated service order.
   * @throws {AppError} Throws if service order is not found.
   */
  public async updateServiceOrderStatus(
    serviceOrderId: string,
    dto: UpdateServiceOrderStatusDTO,
  ): Promise<ServiceOrder> {
    const existingServiceOrder =
      await this.serviceOrderRepository.getServiceOrderById(serviceOrderId);
    if (!existingServiceOrder) {
      throw new AppError('Ordem de serviço não encontrada', HTTP_STATUS_CODES.NOT_FOUND);
    }

    return await this.serviceOrderRepository.updateServiceOrderStatus(serviceOrderId, dto);
  }

  /**
   * Retrieves all open service orders for a specific pilot.
   * @param {string} pilotId - The pilot/user ID.
   * @param {number} page - The page number.
   * @param {number} limit - The number of items per page.
   * @returns {Promise<PaginatedRequest<typeof ServiceOrderWithDetailsSchema>>} Paginated open service orders for the pilot.
   * @throws {AppError} Throws if pilot is not found or is not of type pilot.
   */
  public async getOpenServiceOrdersByPilotId(
    pilotId: string,
    params: ServiceOrderSearchQueryStringByPilot,
  ): Promise<PaginatedRequest<typeof ServiceOrderWithDetailsSchema>> {
    await this.validatePilot(pilotId);

    const serviceOrders = await this.serviceOrderRepository.getOpenServiceOrdersByPilotId(
      pilotId,
      params.page,
      params.limit,
      params.includePlots,
      params.includePilots,
      params.includeFarms,
      params.includeContracts,
      params.includeCustomers,
      params.includeGeoJson,
    );
    const totalCount = await this.serviceOrderRepository.countOpenServiceOrdersByPilotId(pilotId);

    return {
      data: serviceOrders.map((serviceOrder: ServiceOrderWithDetails) =>
        ServiceOrderVM.toViewModelWithDetails(serviceOrder),
      ),
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(totalCount / params.limit),
      totalCount,
    };
  }

  /**
   * Validates that all provided user IDs correspond to users of type "pilot".
   * @param {string[]} pilotsIds - Array of user IDs to validate as pilots.
   * @returns {Promise<void>} Resolves if all users are pilots.
   * @throws {AppError} Throws if any user is not a pilot.
   */
  private async validatePilots(pilotsIds: string[]): Promise<void> {
    const pilots = await db
      .select({
        id: users.id,
        deletedAt: users.deletedAt,
      })
      .from(users)
      .where(and(inArray(users.id, pilotsIds), eq(users.type, 'pilot')));

    if (pilots.length !== pilotsIds.length) {
      throw new AppError('Todos os usuários devem ser pilotos', HTTP_STATUS_CODES.BAD_REQUEST);
    }

    const hasInactivePilot = pilots.some((pilot) => pilot.deletedAt !== null);
    if (hasInactivePilot) {
      throw new AppError(
        'Piloto inativo não pode ser vinculado a uma Ordem de Serviço.',
        HTTP_STATUS_CODES.BAD_REQUEST,
      );
    }
  }

  public async updateServiceOrderPlotStatus(
    serviceOrderId: string,
    plotId: string,
    dto: UpdateServiceOrderPlotStatusDTO,
    currentUserId: string,
  ) {
    const authenticatedUser = await this.userRepository.getUserById(currentUserId);
    if (!authenticatedUser) {
      throw new AppError('Usuario autenticado nao encontrado', HTTP_STATUS_CODES.UNAUTHORIZED);
    }

    if (authenticatedUser.type === UserType.PILOT) {
      await this.getAuthorizedPilotIdForServiceOrder(serviceOrderId, currentUserId);
    } else if (authenticatedUser.type !== UserType.BACKOFFICE) {
      throw new AppError(
        'Voce nao tem permissao para atualizar o status deste talhao',
        HTTP_STATUS_CODES.FORBIDDEN,
      );
    }

    const serviceOrder = await this.serviceOrderRepository.getServiceOrderById(
      serviceOrderId,
      false,
      false,
      false,
      false,
      false,
    );
    if (!serviceOrder) {
      throw new AppError('Ordem de serviÃ§o nÃ£o encontrada', HTTP_STATUS_CODES.NOT_FOUND);
    }

    const link = await this.serviceOrderRepository.findServiceOrderPlot(serviceOrderId, plotId);
    if (!link) {
      throw new AppError(
        'TalhÃ£o nÃ£o estÃ¡ vinculado a esta Ordem de ServiÃ§o',
        HTTP_STATUS_CODES.NOT_FOUND,
      );
    }

    return this.serviceOrderRepository.updateServiceOrderPlotStatus(
      serviceOrderId,
      plotId,
      dto.status,
      currentUserId,
    );
  }

  private async getAuthorizedPilotIdForServiceOrder(
    serviceOrderId: string,
    requestUserId?: string,
  ): Promise<string | undefined> {
    if (!requestUserId) return undefined;

    const authenticatedUser = await this.userRepository.getUserById(requestUserId);
    if (!authenticatedUser) {
      throw new AppError('Usuario autenticado nao encontrado', HTTP_STATUS_CODES.UNAUTHORIZED);
    }

    if (authenticatedUser.type !== UserType.PILOT) {
      return undefined;
    }

    const serviceOrderExists = await db.query.serviceOrders.findFirst({
      where: eq(serviceOrders.id, serviceOrderId),
      columns: {
        id: true,
      },
    });

    if (!serviceOrderExists) {
      throw new AppError('Ordem de servico nao encontrada', HTTP_STATUS_CODES.NOT_FOUND);
    }

    const assignment = await db.query.serviceOrderPilots.findFirst({
      where: and(
        eq(serviceOrderPilots.serviceOrderId, serviceOrderId),
        eq(serviceOrderPilots.pilotId, requestUserId),
      ),
      columns: {
        id: true,
      },
    });

    if (!assignment) {
      throw new AppError(
        'Voce nao tem permissao para acessar esta Ordem de Servico',
        HTTP_STATUS_CODES.FORBIDDEN,
      );
    }

    return requestUserId;
  }

  /**
   * Validates that the contract exists, belongs to the customer, and is not expired.
   * @param {string} contractId - The contract ID to validate.
   * @param {string} customerId - The customer ID to check contract ownership.
   * @returns {Promise<void>} Resolves if contract is valid.
   * @throws {AppError} Throws if contract is not found, does not belong to customer, or is expired.
   */
  private async validateContract(contractId: string, customerId: string): Promise<void> {
    const contract = await db.query.contracts.findFirst({
      where: eq(contracts.id, contractId),
    });

    if (!contract) {
      throw new AppError('Contrato não encontrado', HTTP_STATUS_CODES.NOT_FOUND);
    }

    if (contract.customerId !== customerId) {
      throw new AppError('O contrato não pertence ao cliente', HTTP_STATUS_CODES.FORBIDDEN);
    }

    if (contract.date_end < new Date()) {
      throw new AppError('Contrato expirado', HTTP_STATUS_CODES.BAD_REQUEST);
    }
  }

  /**
   * Validates that all provided plot IDs exist and belong to the specified farms.
   * @param {string[]} plotsIds - Array of plot IDs to validate.
   * @param {string[]} farmsIds - Array of farm IDs to check plot ownership.
   * @returns {Promise<void>} Resolves if all plots exist and belong to the farms.
   * @throws {AppError} Throws if any plot does not exist or does not belong to any of the farms.
   */
  private async validatePlots(plotsIds: string[], farmsIds: string[]): Promise<void> {
    // First, get all plots that match the provided IDs
    const allRequestedPlots = await db
      .select({
        id: plots.id,
        farmId: plots.farmId,
      })
      .from(plots)
      .where(inArray(plots.id, plotsIds));

    // Check if all requested plots exist
    if (allRequestedPlots.length !== plotsIds.length) {
      const foundPlotIds = allRequestedPlots.map((plot) => plot.id);
      const missingPlotIds = plotsIds.filter((id) => !foundPlotIds.includes(id));
      throw new AppError(
        `Talhões não encontrado: ${missingPlotIds.join(', ')}`,
        HTTP_STATUS_CODES.NOT_FOUND,
      );
    }

    // Check if all plots belong to the specified farms
    const plotsNotInFarms = allRequestedPlots.filter((plot) => !farmsIds.includes(plot.farmId));

    if (plotsNotInFarms.length > 0) {
      const invalidPlotIds = plotsNotInFarms.map((plot) => plot.id);
      throw new AppError(
        `Os seguintes talhões não pertencem a nenhuma das fazendas especificadas: ${invalidPlotIds.join(', ')}. Todos os talhões devem estar relacionados às fazendas na ordem de serviço.`,
        HTTP_STATUS_CODES.BAD_REQUEST,
      );
    }
  }

  /**
   * Validates that all farms exist and belong to the specified customer.
   * @param {string[]} farmsIds - Array of farm IDs to validate.
   * @param {string} customerId - The customer ID to check farm ownership.
   * @returns {Promise<void>} Resolves if all farms exist and belong to the customer.
   * @throws {AppError} Throws if any farm is not found or does not belong to the customer.
   */
  private async validateFarms(farmsIds: string[], customerId: string): Promise<void> {
    const isAllFarmsExists = await db
      .select()
      .from(farms)
      .where(and(inArray(farms.id, farmsIds), eq(farms.customerId, customerId)));

    if (isAllFarmsExists.length !== farmsIds.length) {
      throw new AppError(
        'Todas as fazendas devem existir e pertencer ao cliente',
        HTTP_STATUS_CODES.BAD_REQUEST,
      );
    }
  }

  /**
   * Validates that the pilot exists and is of type "pilot".
   * @param {string} pilotId - The pilot/user ID to validate.
   * @returns {Promise<void>} Resolves if the pilot exists and is of type "pilot".
   * @throws {AppError} Throws if the pilot is not found or is not of type "pilot".
   */
  private async validatePilot(pilotId: string): Promise<void> {
    const pilot = await db
      .select({
        id: users.id,
        deletedAt: users.deletedAt,
      })
      .from(users)
      .where(and(eq(users.id, pilotId), eq(users.type, 'pilot')));

    if (pilot.length === 0) {
      throw new AppError(
        'Piloto não encontrado ou não é do tipo piloto',
        HTTP_STATUS_CODES.NOT_FOUND,
      );
    }

    if (pilot[0]?.deletedAt) {
      throw new AppError(
        'Piloto inativo não pode ser vinculado a uma Ordem de Serviço.',
        HTTP_STATUS_CODES.BAD_REQUEST,
      );
    }
  }

  /**
   * Gets general statistics for all service orders with optional filters.
   * @param {ServiceOrderStatsQueryString} filters - Optional filters to apply to statistics.
   * @returns {Promise<ServiceOrderStatsDTO>} General statistics.
   */
  public async getGeneralStats(
    filters?: ServiceOrderStatsQueryString,
  ): Promise<ServiceOrderStatsDTO> {
    const parsedStartDate = filters?.startDate ? new Date(filters.startDate) : undefined;
    const parsedEndDate = filters?.endDate ? new Date(filters.endDate) : undefined;

    const filterParams = {
      status: filters?.status,
      farmId: filters?.farmId,
      pilotId: filters?.pilotId,
      customerId: filters?.customerId,
      startDate: parsedStartDate,
      endDate: parsedEndDate,
    };

    const [
      openOrdersCount,
      completedOrdersCount,
      cancelledOrdersCount,
      farmsCount,
      plotsCount,
      totalAreaHectares,
      pilotsWithOpenOrders,
      invalidApplications,
      openOrdersAreaHectares,
      completedOrdersAreaHectares,
      cancelledOrdersAreaHectares,
      openOrdersAppliedHectares,
      completedOrdersAppliedHectares,
      cancelledOrdersAppliedHectares,
    ] = await Promise.all([
      this.getServiceOrdersCountByStatus('open', filterParams),
      this.getServiceOrdersCountByStatus('completed', filterParams),
      this.getServiceOrdersCountByStatus('cancelled', filterParams),
      this.getTotalFarmsCount(filterParams),
      this.getTotalPlotsCount(filterParams),
      this.getTotalAreaHectares(filterParams),
      this.getPilotsWithOpenOrdersCount(filterParams),
      this.getInvalidApplications(filterParams),
      this.getAreaHectaresByStatus('open', filterParams),
      this.getAreaHectaresByStatus('completed', filterParams),
      this.getAreaHectaresByStatus('cancelled', filterParams),
      this.getAppliedHectaresByStatus('open', filterParams),
      this.getAppliedHectaresByStatus('completed', filterParams),
      this.getAppliedHectaresByStatus('cancelled', filterParams),
    ]);

    return {
      openOrdersCount,
      completedOrdersCount,
      cancelledOrdersCount,
      farmsCount,
      plotsCount,
      totalAreaHectares,
      pilotsWithOpenOrders,
      invalidApplications,
      openOrdersAreaHectares,
      completedOrdersAreaHectares,
      cancelledOrdersAreaHectares,
      openOrdersAppliedHectares,
      completedOrdersAppliedHectares,
      cancelledOrdersAppliedHectares,
    };
  }

  /**
   * Gets count of service orders by status with optional filters.
   * @param {string} status - The status to filter by.
   * @param {object} filters - Optional filters to apply.
   * @returns {Promise<number>} Count of service orders.
   */
  private async getServiceOrdersCountByStatus(
    status: 'open' | 'completed' | 'cancelled',
    filters?: {
      status?: string;
      farmId?: string;
      pilotId?: string;
      customerId?: string;
      startDate?: Date;
      endDate?: Date;
    },
  ): Promise<number> {
    const conditions = [eq(serviceOrders.status, status)];

    if (filters?.customerId) {
      conditions.push(eq(serviceOrders.customerId, filters.customerId));
    }

    // Date range filter - match repository pattern
    if (filters?.startDate && filters?.endDate) {
      const adjustEndDate = new Date(filters.endDate);
      adjustEndDate.setDate(adjustEndDate.getDate() + 1);
      conditions.push(
        gte(serviceOrders.plannedDate, filters.startDate),
        lt(serviceOrders.plannedDate, adjustEndDate),
      );
    }

    // Farm filter using exists() with junction table
    if (filters?.farmId) {
      conditions.push(
        exists(
          db
            .select()
            .from(serviceOrderFarms)
            .where(
              and(
                eq(serviceOrderFarms.serviceOrderId, serviceOrders.id),
                eq(serviceOrderFarms.farmId, filters.farmId),
              ),
            ),
        ),
      );
    }

    // Pilot filter using exists() with junction table
    if (filters?.pilotId) {
      conditions.push(
        exists(
          db
            .select()
            .from(serviceOrderPilots)
            .where(
              and(
                eq(serviceOrderPilots.serviceOrderId, serviceOrders.id),
                eq(serviceOrderPilots.pilotId, filters.pilotId),
              ),
            ),
        ),
      );
    }

    const result = await db
      .select({ count: count() })
      .from(serviceOrders)
      .where(and(...conditions));

    return result[0]?.count || 0;
  }

  /**
   * Gets total count of farms with optional filters.
   * @param {object} filters - Optional filters to apply.
   * @returns {Promise<number>} Total farms count.
   */
  private async getTotalFarmsCount(filters?: {
    status?: string;
    farmId?: string;
    pilotId?: string;
    customerId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<number> {
    if (
      !filters ||
      (!filters.customerId &&
        !filters.farmId &&
        !filters.pilotId &&
        !filters.startDate &&
        !filters.endDate)
    ) {
      // No filters applied, return total count
      const result = await db.select({ count: count() }).from(farms);
      return result[0]?.count || 0;
    }

    // When service order filters apply, query from serviceOrderFarms junction table
    const conditions = [];

    if (filters.customerId) {
      conditions.push(eq(farms.customerId, filters.customerId));
    }

    if (filters.farmId) {
      conditions.push(eq(farms.id, filters.farmId));
    }

    // Build service order conditions for exists() subquery
    const serviceOrderConditions = [];

    if (filters.pilotId) {
      serviceOrderConditions.push(
        exists(
          db
            .select()
            .from(serviceOrderPilots)
            .where(
              and(
                eq(serviceOrderPilots.serviceOrderId, serviceOrders.id),
                eq(serviceOrderPilots.pilotId, filters.pilotId),
              ),
            ),
        ),
      );
    }

    // Date range filter - match repository pattern
    if (filters.startDate && filters.endDate) {
      const adjustEndDate = new Date(filters.endDate);
      adjustEndDate.setDate(adjustEndDate.getDate() + 1);
      serviceOrderConditions.push(
        and(
          gte(serviceOrders.plannedDate, filters.startDate),
          lt(serviceOrders.plannedDate, adjustEndDate),
        ),
      );
    }

    // Add service order exists condition if any service order filters are present
    if (serviceOrderConditions.length > 0) {
      conditions.push(
        exists(
          db
            .select()
            .from(serviceOrderFarms)
            .innerJoin(serviceOrders, eq(serviceOrderFarms.serviceOrderId, serviceOrders.id))
            .where(and(eq(serviceOrderFarms.farmId, farms.id), ...serviceOrderConditions)),
        ),
      );
    }

    const result = await db
      .selectDistinct({ farmId: farms.id })
      .from(farms)
      .where(and(...conditions));

    return result.length;
  }

  /**
   * Gets total count of plots with optional filters.
   * @param {object} filters - Optional filters to apply.
   * @returns {Promise<number>} Total plots count.
   */
  private async getTotalPlotsCount(filters?: {
    status?: string;
    farmId?: string;
    pilotId?: string;
    customerId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<number> {
    if (
      !filters ||
      (!filters.customerId &&
        !filters.farmId &&
        !filters.pilotId &&
        !filters.startDate &&
        !filters.endDate)
    ) {
      // No filters applied, return total count
      const result = await db.select({ count: count() }).from(plots);
      return result[0]?.count || 0;
    }

    // When service order filters apply, query from serviceOrderPlots junction table
    const conditions = [];

    if (filters.farmId) {
      conditions.push(eq(plots.farmId, filters.farmId));
    }

    // Build service order conditions for exists() subquery
    const serviceOrderConditions = [];

    if (filters.customerId) {
      serviceOrderConditions.push(eq(serviceOrders.customerId, filters.customerId));
    }

    if (filters.pilotId) {
      serviceOrderConditions.push(
        exists(
          db
            .select()
            .from(serviceOrderPilots)
            .where(
              and(
                eq(serviceOrderPilots.serviceOrderId, serviceOrders.id),
                eq(serviceOrderPilots.pilotId, filters.pilotId),
              ),
            ),
        ),
      );
    }

    // Date range filter - match repository pattern
    if (filters.startDate && filters.endDate) {
      const adjustEndDate = new Date(filters.endDate);
      adjustEndDate.setDate(adjustEndDate.getDate() + 1);
      serviceOrderConditions.push(
        and(
          gte(serviceOrders.plannedDate, filters.startDate),
          lt(serviceOrders.plannedDate, adjustEndDate),
        ),
      );
    }

    // Add service order exists condition if any service order filters are present
    if (serviceOrderConditions.length > 0) {
      conditions.push(
        exists(
          db
            .select()
            .from(serviceOrderPlots)
            .innerJoin(serviceOrders, eq(serviceOrderPlots.serviceOrderId, serviceOrders.id))
            .where(and(eq(serviceOrderPlots.plotId, plots.id), ...serviceOrderConditions)),
        ),
      );
    }

    const result = await db
      .selectDistinct({ plotId: plots.id })
      .from(plots)
      .where(and(...conditions));

    return result.length;
  }

  /**
   * Gets total area in hectares with optional filters.
   * @param {object} filters - Optional filters to apply.
   * @returns {Promise<number>} Total area in hectares.
   */
  private async getTotalAreaHectares(filters?: {
    status?: string;
    farmId?: string;
    pilotId?: string;
    customerId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<number> {
    if (
      !filters ||
      (!filters.customerId &&
        !filters.farmId &&
        !filters.pilotId &&
        !filters.startDate &&
        !filters.endDate)
    ) {
      // No filters applied, return total area
      const result = await db.select({ totalArea: sum(plots.hectare) }).from(plots);
      return Number(result[0]?.totalArea || 0);
    }

    // When service order filters apply, query from serviceOrderPlots junction table
    const conditions = [];

    if (filters.farmId) {
      conditions.push(eq(plots.farmId, filters.farmId));
    }

    // Build service order conditions for exists() subquery
    const serviceOrderConditions = [];

    if (filters.customerId) {
      serviceOrderConditions.push(eq(serviceOrders.customerId, filters.customerId));
    }

    if (filters.pilotId) {
      serviceOrderConditions.push(
        exists(
          db
            .select()
            .from(serviceOrderPilots)
            .where(
              and(
                eq(serviceOrderPilots.serviceOrderId, serviceOrders.id),
                eq(serviceOrderPilots.pilotId, filters.pilotId),
              ),
            ),
        ),
      );
    }

    // Date range filter - match repository pattern
    if (filters.startDate && filters.endDate) {
      const adjustEndDate = new Date(filters.endDate);
      adjustEndDate.setDate(adjustEndDate.getDate() + 1);
      serviceOrderConditions.push(
        and(
          gte(serviceOrders.plannedDate, filters.startDate),
          lt(serviceOrders.plannedDate, adjustEndDate),
        ),
      );
    }

    // Add service order exists condition if any service order filters are present
    if (serviceOrderConditions.length > 0) {
      conditions.push(
        exists(
          db
            .select()
            .from(serviceOrderPlots)
            .innerJoin(serviceOrders, eq(serviceOrderPlots.serviceOrderId, serviceOrders.id))
            .where(and(eq(serviceOrderPlots.plotId, plots.id), ...serviceOrderConditions)),
        ),
      );
    }

    const result = await db
      .select({ totalArea: sum(plots.hectare) })
      .from(plots)
      .where(and(...conditions));

    return Number(result[0]?.totalArea || 0);
  }

  /**
   * Gets total area in hectares for service orders with a specific status.
   * @param {string} status - The status to filter by ('open', 'completed', 'cancelled').
   * @param {object} filters - Optional filters to apply.
   * @returns {Promise<number>} Total area in hectares for the status.
   */
  private async getAreaHectaresByStatus(
    status: 'open' | 'completed' | 'cancelled',
    filters?: {
      status?: string;
      farmId?: string;
      pilotId?: string;
      customerId?: string;
      startDate?: Date;
      endDate?: Date;
    },
  ): Promise<number> {
    // Build where conditions
    const whereConditions = [eq(serviceOrders.status, status)];

    // Filter by customer through the plot's customer (plots have customerId directly)
    if (filters?.customerId) {
      whereConditions.push(eq(plots.customerId, filters.customerId));
    }

    if (filters?.pilotId) {
      whereConditions.push(
        exists(
          db
            .select()
            .from(serviceOrderPilots)
            .where(
              and(
                eq(serviceOrderPilots.serviceOrderId, serviceOrders.id),
                eq(serviceOrderPilots.pilotId, filters.pilotId),
              ),
            ),
        ),
      );
    }

    // Date range filter
    if (filters?.startDate && filters?.endDate) {
      const adjustEndDate = new Date(filters.endDate);
      adjustEndDate.setDate(adjustEndDate.getDate() + 1);
      whereConditions.push(
        and(
          gte(serviceOrders.plannedDate, filters.startDate),
          lt(serviceOrders.plannedDate, adjustEndDate),
        )!,
      );
    }

    // Farm filter
    if (filters?.farmId) {
      whereConditions.push(eq(plots.farmId, filters.farmId));
    }

    // Query plots through serviceOrderPlots junction table
    const result = await db
      .select({ totalArea: sum(plots.hectare) })
      .from(plots)
      .innerJoin(serviceOrderPlots, eq(serviceOrderPlots.plotId, plots.id))
      .innerJoin(serviceOrders, eq(serviceOrderPlots.serviceOrderId, serviceOrders.id))
      .where(and(...whereConditions));

    return Number(result[0]?.totalArea || 0);
  }

  /**
   * Gets total hectares applied (from applications) for service orders with a specific status.
   * @param {string} status - The status to filter by ('open', 'completed', 'cancelled').
   * @param {object} filters - Optional filters to apply.
   * @returns {Promise<number>} Total hectares applied for the status.
   */
  private async getAppliedHectaresByStatus(
    status: 'open' | 'completed' | 'cancelled',
    filters?: {
      status?: string;
      farmId?: string;
      pilotId?: string;
      customerId?: string;
      startDate?: Date;
      endDate?: Date;
    },
  ): Promise<number> {
    // Build where conditions
    const whereConditions = [eq(serviceOrders.status, status), isNull(applications.deletedAt)];

    // Filter by customer through the farm's customer (same as application stats)
    if (filters?.customerId) {
      whereConditions.push(eq(customers.id, filters.customerId));
    }

    if (filters?.pilotId) {
      whereConditions.push(
        exists(
          db
            .select()
            .from(serviceOrderPilots)
            .where(
              and(
                eq(serviceOrderPilots.serviceOrderId, serviceOrders.id),
                eq(serviceOrderPilots.pilotId, filters.pilotId),
              ),
            ),
        ),
      );
    }

    // Date range filter
    if (filters?.startDate && filters?.endDate) {
      const adjustEndDate = new Date(filters.endDate);
      adjustEndDate.setDate(adjustEndDate.getDate() + 1);
      whereConditions.push(
        and(
          gte(serviceOrders.plannedDate, filters.startDate),
          lt(serviceOrders.plannedDate, adjustEndDate),
        )!,
      );
    }

    // Farm filter
    if (filters?.farmId) {
      whereConditions.push(eq(farms.id, filters.farmId));
    }

    // Query applications through serviceOrders with joins to farms and customers
    // This ensures we filter by the farm's customer, not the service order's customer
    const result = await db
      .select({ totalApplied: sum(applications.hectares) })
      .from(applications)
      .innerJoin(serviceOrders, eq(applications.serviceOrderId, serviceOrders.id))
      .leftJoin(farms, eq(applications.farmId, farms.id))
      .leftJoin(customers, eq(farms.customerId, customers.id))
      .where(and(...whereConditions));

    return Number(result[0]?.totalApplied || 0);
  }

  /**
   * Gets count of pilots with open orders with optional filters.
   * @param {object} filters - Optional filters to apply.
   * @returns {Promise<number>} Count of pilots with open orders.
   */
  private async getPilotsWithOpenOrdersCount(filters?: {
    status?: string;
    farmId?: string;
    pilotId?: string;
    customerId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<number> {
    const conditions = [eq(serviceOrders.status, 'open')];

    if (filters?.customerId) {
      conditions.push(eq(serviceOrders.customerId, filters.customerId));
    }

    if (filters?.pilotId) {
      conditions.push(eq(serviceOrderPilots.pilotId, filters.pilotId));
    }

    // Date range filter - match repository pattern
    if (filters?.startDate && filters?.endDate) {
      const adjustEndDate = new Date(filters.endDate);
      adjustEndDate.setDate(adjustEndDate.getDate() + 1);
      conditions.push(
        gte(serviceOrders.plannedDate, filters.startDate),
        lt(serviceOrders.plannedDate, adjustEndDate),
      );
    }

    // Farm filter using exists() with junction table
    if (filters?.farmId) {
      conditions.push(
        exists(
          db
            .select()
            .from(serviceOrderFarms)
            .where(
              and(
                eq(serviceOrderFarms.serviceOrderId, serviceOrders.id),
                eq(serviceOrderFarms.farmId, filters.farmId),
              ),
            ),
        ),
      );
    }

    const result = await db
      .selectDistinct({ pilotId: serviceOrderPilots.pilotId })
      .from(serviceOrderPilots)
      .innerJoin(serviceOrders, eq(serviceOrderPilots.serviceOrderId, serviceOrders.id))
      .where(and(...conditions));

    return result.length;
  }

  /**
   * Gets count of invalid applications with optional filters.
   * @param {object} filters - Optional filters to apply.
   * @returns {Promise<number>} Count of invalid applications.
   */
  private async getInvalidApplications(filters?: {
    status?: string;
    farmId?: string;
    pilotId?: string;
    customerId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<number> {
    const conditions = [
      inArray(
        serviceOrders.id,
        db
          .select({ serviceOrdersId: applications.serviceOrderId })
          .from(applications)
          .where(and(isNull(applications.plotId), isNull(applications.deletedAt))),
      ),
    ];

    if (filters?.customerId) {
      conditions.push(eq(serviceOrders.customerId, filters.customerId));
    }

    // Date range filter - match repository pattern
    if (filters?.startDate && filters?.endDate) {
      const adjustEndDate = new Date(filters.endDate);
      adjustEndDate.setDate(adjustEndDate.getDate() + 1);
      conditions.push(
        gte(serviceOrders.plannedDate, filters.startDate),
        lt(serviceOrders.plannedDate, adjustEndDate),
      );
    }

    // Farm filter using exists() with junction table
    if (filters?.farmId) {
      conditions.push(
        exists(
          db
            .select()
            .from(serviceOrderFarms)
            .where(
              and(
                eq(serviceOrderFarms.serviceOrderId, serviceOrders.id),
                eq(serviceOrderFarms.farmId, filters.farmId),
              ),
            ),
        ),
      );
    }

    // Pilot filter using exists() with junction table
    if (filters?.pilotId) {
      conditions.push(
        exists(
          db
            .select()
            .from(serviceOrderPilots)
            .where(
              and(
                eq(serviceOrderPilots.serviceOrderId, serviceOrders.id),
                eq(serviceOrderPilots.pilotId, filters.pilotId),
              ),
            ),
        ),
      );
    }

    const [result] = await db
      .select({ count: countDistinct(serviceOrders.id) })
      .from(serviceOrders)
      .where(and(...conditions));

    return result?.count ?? 0;
  }
}
