import AppError from "@common/handlers/app-error";
import { HTTP_STATUS_CODES } from "@common/types/http-status.types";
import type { PaginatedRequest } from "@common/types/paginated-request.types";
import { db } from "@infra/database";
import { applications, assistants, cultureTypes, customers, drones, farms, plots, products, serviceOrders, users } from "@infra/database/schema";
import { and, avg, count, countDistinct, eq, exists, gte, ilike, inArray, isNull, lt, not, or, sql, sum } from "drizzle-orm";

import { ApplicationVM, type ApplicationWithRelationsViewModelSchema } from "@models/application.vm";
import { app } from "@modules/app/app.module";
import { ApplicationRepository } from "@repositories/applications/application.repository";
import type { Application, ApplicationOrderBy, ApplicationOrderType, ApplicationWithRelations } from "@repositories/applications/application.types";
import { CustomerRepository } from "@repositories/customers/customer.repository";
import { FarmRepository } from "@repositories/farms/farm.repository";
import { PlotRepository } from "@repositories/plots/plot.repository";
import { ServiceOrderRepository } from "@repositories/service-order/service-order.repository";
import { UserRepository } from "@repositories/users/user.repository";
import type { CreateApplicationDTO } from "../dto/create-application.dto";
import type { ApplicationIssueFilter } from "../dto/get-all-application.dto";
import { PilotPerformanceDTO } from "../dto/stats-performance.dto";
import { ApplicationSummaryStatsDTO } from "../dto/stats-summary.dto";
import type { ApplicationEvolutionQueryString } from "../dto/stats-evolution.dto";
import type { TopFarmsStatsQueryString } from "../dto/stats-top-farms.dto";
import type { ByPilotStatsQueryString } from "../dto/stats-by-pilot.dto";
import type { UpdateApplicationDTO } from "../dto/update-application.dto";

import type { DashboardMetricsDTO, DashboardMetricsQueryString, MonthlySprayedArea, YesterdayStats } from "../dto/dashboard-metrics.dto";
import { ApplicationStatsDTO, type ApplicationStatsQueryString } from "../dto/stats.dto";

// Timezone constant for Brazilian time (GMT-3)
const BRAZIL_TIMEZONE = 'America/Sao_Paulo';
const BRAZIL_TIMEZONE_OFFSET_HOURS = -3;

// Service orders to exclude from "aplicações avulsas" and invalid applications metrics
// These are special service orders used to organize loose/invalid applications in the system
const EXCLUDED_SERVICE_ORDER_IDS = [
  '9498337e-bb62-4be6-a8b6-881a8fec67f6',
  '82f2ad51-e0f1-4b1d-8bb2-138c976f2429',
  '738e9a95-4083-4aa7-82a9-342af43197f3',
  'c34c4dd3-0bab-4aa1-aa68-82e7f6e78652',
  '0202c849-2114-44d0-a564-37db28a0ae22',
  'badfb92b-4e41-4b6b-b7cf-a5985ae5f4a3',
];



/**
 * Get current date/time adjusted for Brazil timezone (GMT-3)
 * @returns {Date} Current date in Brazil timezone
 */
function getBrazilNow(): Date {
  const now = new Date();
  // Convert UTC to Brazil time by adding the offset
  const brazilTime = new Date(now.getTime() + (BRAZIL_TIMEZONE_OFFSET_HOURS * 60 * 60 * 1000));
  return brazilTime;
}

/**
 * Get start of day in Brazil timezone, converted to UTC for database queries
 * @param {Date} date - Date to get start of day for (in any timezone)
 * @returns {Date} Start of day in UTC that corresponds to 00:00 in Brazil
 * 
 * Example: If date represents 2025-12-08 in Brazil timezone,
 * this returns 2025-12-08 03:00:00 UTC (which is 00:00 GMT-3)
 */
function getStartOfDayBrazilInUTC(date: Date): Date {
  // Get the date as it appears in Brazil timezone (GMT-3)
  // We need to convert the local date to what it would be in Brazil
  const localDate = new Date(date);
  
  // Get UTC components
  const year = localDate.getUTCFullYear();
  const month = localDate.getUTCMonth();
  const day = localDate.getUTCDate();
  
  // Create date at 00:00:00 Brazil time (GMT-3)
  // 00:00 GMT-3 = 03:00 UTC on the same calendar date
  const startOfDayUTC = new Date(Date.UTC(year, month, day, 3, 0, 0, 0));
  
  return startOfDayUTC;
}

export class ApplicationService {
  private readonly applicationRepository = new ApplicationRepository();
  private readonly customerRepository = new CustomerRepository();
  private readonly pilotRepository = new UserRepository();
  private readonly farmRepository = new FarmRepository();
  private readonly serviceOrdersRepository = new ServiceOrderRepository();
  private readonly plotRepository = new PlotRepository();

  /**
   * Build WHERE conditions for application queries based on filters
   * @param {ApplicationStatsQueryString} filters - Optional filters to apply
   * @returns {object} Object with whereClause and joins needed
   */
  private buildApplicationWhereConditions(filters?: ApplicationStatsQueryString) {
    if (!filters) {
      return {
        whereClause: isNull(applications.deletedAt),
        needsJoins: false
      };
    }

    const whereConditions = [isNull(applications.deletedAt)];
    let needsJoins = false;

    // Search conditions
    if (filters.search) {
      whereConditions.push(
        or(
          ilike(applications.observations, `%${filters.search}%`),
          ilike(users.name, `%${filters.search}%`), // pilot name
          ilike(customers.name, `%${filters.search}%`), // customer name
          ilike(farms.name, `%${filters.search}%`) // farm name
        )!
      );
      needsJoins = true;
    }

    // Filter conditions
    if (filters.serviceOrderStatus) {
      whereConditions.push(eq(serviceOrders.status, filters.serviceOrderStatus));
      needsJoins = true;
    }

    if (filters.farmId) {
      whereConditions.push(eq(farms.id, filters.farmId));
      needsJoins = true;
    }

    if (filters.pilotId) {
      whereConditions.push(eq(applications.pilotId, filters.pilotId));
    }

    if (filters.productId) {
      whereConditions.push(eq(applications.productId, filters.productId));
    }

    if (filters.customerId) {
      whereConditions.push(eq(customers.id, filters.customerId));
      needsJoins = true;
    }

    if (filters.serviceOrderId) {
      whereConditions.push(eq(applications.serviceOrderId, filters.serviceOrderId));
    }

    if (filters.invalidApplication) {
      whereConditions.push(isNull(applications.plotId));
      // Exclude applications from special "avulso" service orders when filtering for invalid applications
      whereConditions.push(
        not(inArray(applications.serviceOrderId, EXCLUDED_SERVICE_ORDER_IDS))
      );
    }

    if (filters.startDate && filters.endDate) {
      /**
       * Filtro por dia civil (YYYY-MM-DD), alinhado ao GROUP BY em getApplicationsEvolution
       * (`DATE(applications.date)` / `::date`). Comparar com `new Date('YYYY-MM-DD')` (UTC) + `lt`
       * gerava recorte diferente do bucket diário em `timestamp without time zone`, e com
       * `ORDER BY ... DESC LIMIT n` o gráfico podia mostrar 0 no dia do painel com contagem > 0 nos stats.
       */
      const startD = filters.startDate.slice(0, 10);
      const endD = filters.endDate.slice(0, 10);
      whereConditions.push(sql`(${applications.date})::date >= ${sql.raw(`'${startD}'`)}::date`);
      whereConditions.push(sql`(${applications.date})::date <= ${sql.raw(`'${endD}'`)}::date`);
    }

    return {
      whereClause: whereConditions.length > 1 ? and(...whereConditions) : whereConditions[0],
      needsJoins
    };
  }

  private async getOperationalDayCount(filters?: ApplicationStatsQueryString): Promise<number> {
    if (filters?.startDate && filters?.endDate) {
      const startDate = new Date(`${filters.startDate}T00:00:00`);
      const endDate = new Date(`${filters.endDate}T00:00:00`);
      const diffInMs = endDate.getTime() - startDate.getTime();
      const diffDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24)) + 1;
      return Math.max(1, diffDays);
    }

    const { whereClause } = this.buildApplicationWhereConditions(filters);
    const result = await db
      .select({
        days: sql<number>`COUNT(DISTINCT (${applications.date})::date)`,
      })
      .from(applications)
      .leftJoin(users, eq(applications.pilotId, users.id))
      .leftJoin(plots, eq(applications.plotId, plots.id))
      .leftJoin(farms, eq(applications.farmId, farms.id))
      .leftJoin(customers, eq(farms.customerId, customers.id))
      .leftJoin(serviceOrders, eq(applications.serviceOrderId, serviceOrders.id))
      .where(whereClause);

    return Number(result[0]?.days || 0);
  }

  /**
   * @description Create a new application
   * @param {CreateApplicationDTO} data - The application data
   * @throws {AppError} If validation fails
   */
  public async createApplication(data: CreateApplicationDTO): Promise<void> {
    app.log.info("[ApplicationService] - Starting application creation");

    // Validate all required foreign key relationships
    await this.validateForeignKeys(data);

    // Create the application
    const applicationData = {
      ...data,
      assistantId: data.assistantId || undefined,
      farmId: data.farmId || null,
      observations: data.observations || undefined,
    };
    const application = await this.applicationRepository.createApplication(applicationData);

    app.log.info("[ApplicationService] - Application created successfully with ID %s", application.id);
  }

  /**
   * @description Get all applications with optional search and filters
   * @param {number} page - The page number
   * @param {number} limit - The limit per page
   * @param {string} search - Optional search term to filter by observations, customer name, pilot name, or farm name
   * @param {object} filters - Optional filters for serviceOrderStatus, farmId, pilotId, customerId, serviceOrderId
   * @returns {Promise<PaginatedRequest<ApplicationWithRelationsViewModelSchema>>} The list of applications with relations
   */
  public async listApplications(
    page: number,
    limit: number,
    search?: string,
    filters?: {
      serviceOrderStatus?: "open" | "completed" | "cancelled";
      farmId?: string;
      pilotId?: string;
      productId?: string;
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
    },
    orderBy?: ApplicationOrderBy,
    orderType?: ApplicationOrderType,
  ): Promise<PaginatedRequest<typeof ApplicationWithRelationsViewModelSchema>> {
    app.log.info("[ApplicationService] - Listing all applications");

    const queryResult = await this.applicationRepository.getAllApplications(page, limit, search, filters, orderBy, orderType);
    const totalCount = await this.applicationRepository.countApplications(search, filters);

    app.log.info("[ApplicationService] - Retrieved %d applications", totalCount);

    return {
      data: queryResult.map((application) => ApplicationVM.toViewModelWithRelations(application)),
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
      totalCount,
    };
  }

  /**
   * @description Get application by ID
   * @param {string} applicationId - The application's ID
   * @returns {Promise<ApplicationWithRelations>} The application details with relations
   * @throws {AppError} If the application is not found
   */
  public async getApplicationById(applicationId: string): Promise<ApplicationWithRelations> {
    app.log.info("[ApplicationService] - Fetching application details for application %s", applicationId);

    try {
      const application = await this.applicationRepository.getApplicationWithRelationsById(applicationId);

      if (!application) {
        app.log.warn("[ApplicationService] - Application not found: %s", applicationId);
        throw new AppError("Aplicação não encontrada", HTTP_STATUS_CODES.NOT_FOUND);
      }

      app.log.info("[ApplicationService] - Successfully retrieved application details for %s", applicationId);
      return application;
    } catch (error) {
      app.log.error("[ApplicationService] - Failed to fetch application details: %s", error);
      throw error;
    }
  }

  /**
   * @description Get applications by customer ID
   * @param {string} customerId - The customer's ID
   * @param {number} page - The page number
   * @param {number} limit - The limit per page
   * @returns {Promise<PaginatedRequest<ApplicationWithRelationsViewModelSchema>>} The list of applications with relations
   */
  public async getApplicationsByCustomerId(
    customerId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedRequest<typeof ApplicationWithRelationsViewModelSchema>> {
    app.log.info("[ApplicationService] - Fetching applications for customer %s", customerId);

    const customer = await this.customerRepository.getCustomerById(customerId);

    if(!customer) {
        app.log.warn("[ApplicationService] - CustomerId not Found: %s", customerId);
        throw new AppError("Id do Cliente não encontrado", HTTP_STATUS_CODES.NOT_FOUND);
    }

    const queryResult = await this.applicationRepository.getApplicationsByCustomerId(customerId, page, limit);
    const totalCount = await this.applicationRepository.countApplicationsByCustomerId(customerId);

    app.log.info("[ApplicationService] - Retrieved %d applications for customer %s", totalCount, customerId);

    return {
      data: queryResult.map((application) => ApplicationVM.toViewModelWithRelations(application)),
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
      totalCount,
    };
  }

  /**
   * @description Get applications by pilot ID
   * @param {string} pilotId - The pilot's ID
   * @param {number} page - The page number
   * @param {number} limit - The limit per page
   * @returns {Promise<PaginatedRequest<ApplicationWithRelationsViewModelSchema>>} The list of applications with relations
   */
  public async getApplicationsByPilotId(
    pilotId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedRequest<typeof ApplicationWithRelationsViewModelSchema>> {
    app.log.info("[ApplicationService] - Fetching applications for pilot %s", pilotId);

    const pilot = await this.pilotRepository.getUserById(pilotId);

    if(!pilot) {
      app.log.warn("[ApplicationService] - Pilot Id not found: %s", pilotId);
      throw new AppError("ID do piloto não encontrado", HTTP_STATUS_CODES.NOT_FOUND);
    }

    const queryResult = await this.applicationRepository.getApplicationsByPilotId(pilotId, page, limit);
    const totalCount = await this.applicationRepository.countApplicationsByPilotId(pilotId);

    app.log.info("[ApplicationService] - Retrieved %d applications for pilot %s", totalCount, pilotId);

    return {
      data: queryResult.map((application) => ApplicationVM.toViewModelWithRelations(application)),
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
      totalCount,
    };
  }

  /**
   * @description Get applications by farm ID
   * @param {string} farmId - The farm's ID
   * @param {number} page - The page number
   * @param {number} limit - The limit per page
   * @returns {Promise<PaginatedRequest<ApplicationWithRelationsViewModelSchema>>} The list of applications with relations
   */
  public async getApplicationsByFarmId(
    farmId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedRequest<typeof ApplicationWithRelationsViewModelSchema>> {
    app.log.info("[ApplicationService] - Fetching applications for farm %s", farmId);

    const farm = await this.farmRepository.getFarmById(farmId);

    if(!farm) {
      app.log.warn("[ApplicationService] -  Farm ID not found: %s", farmId);
      throw new AppError("ID da fazenda não encontrado", HTTP_STATUS_CODES.NOT_FOUND);
    }

    const queryResult = await this.applicationRepository.getApplicationsByFarmId(farmId, page, limit);
    const totalCount = await this.applicationRepository.countApplicationsByFarmId(farmId);

    app.log.info("[ApplicationService] - Retrieved %d applications for farm %s", totalCount, farmId);

    return {
      data: queryResult.map((application) => ApplicationVM.toViewModelWithRelations(application)),
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
      totalCount,
    };
  }

  /**
   * @description Get applications by service order ID
   * @param {string} serviceOrderId - The service order's ID
   * @param {number} page - The page number
   * @param {number} limit - The limit per page
   * @returns {Promise<PaginatedRequest<ApplicationWithRelationsViewModelSchema>>} The list of applications with relations
   */
  public async getApplicationsByServiceOrderId(
    serviceOrderId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedRequest<typeof ApplicationWithRelationsViewModelSchema>> {
    app.log.info("[ApplicationService] - Fetching applications for service order %s", serviceOrderId);

    const serviceOrder = await this.serviceOrdersRepository.getServiceOrderById(serviceOrderId);

    if(!serviceOrder) {
        app.log.warn("[ApplicationService] - Service Order ID not Found: %s", serviceOrder);
        throw new AppError("Id da ordem de serviço não encontrado", HTTP_STATUS_CODES.NOT_FOUND);
    }


    const queryResult = await this.applicationRepository.getApplicationsByServiceOrderId(serviceOrderId, page, limit);
    const totalCount = await this.applicationRepository.countApplicationsByServiceOrderId(serviceOrderId);

    app.log.info("[ApplicationService] - Retrieved %d applications for service order %s", totalCount, serviceOrderId);

    return {
      data: queryResult.map((application) => ApplicationVM.toViewModelWithRelations(application)),
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
      totalCount,
    };
  }

  /**
   * @description Get applications by plot ID
   * @param {string} plotId - The plot's ID
   * @param {number} page - The page number
   * @param {number} limit - The limit per page
   * @returns {Promise<PaginatedRequest<ApplicationWithRelationsViewModelSchema>>} The list of applications with relations
   */
  public async getApplicationsByPlotId(
    plotId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedRequest<typeof ApplicationWithRelationsViewModelSchema>> {
    app.log.info("[ApplicationService] - Fetching applications for plot %s", plotId);

    const plot = await this.plotRepository.getPlotById(plotId);

    if(!plot) {
      app.log.warn("[ApplicationService] - Plot ID not found");
      throw new AppError("ID do talhão não encontrado", HTTP_STATUS_CODES.BAD_REQUEST);
    }

    const queryResult = await this.applicationRepository.getApplicationsByPlotId(plotId, page, limit);
    const totalCount = await this.applicationRepository.countApplicationsByPlotId(plotId);

    app.log.info("[ApplicationService] - Retrieved %d applications for plot %s", totalCount, plotId);

    return {
      data: queryResult.map((application) => ApplicationVM.toViewModelWithRelations(application)),
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
      totalCount,
    };
  }

  /**
   * @description Update application by ID
   * @param {string} applicationId - The application's ID
   * @param {UpdateApplicationDTO} data - The application data to update
   * @returns {Promise<Application>} The updated application
   * @throws {AppError} If the application is not found or validation fails
   */
  public async updateApplication(applicationId: string, data: UpdateApplicationDTO): Promise<Application> {
    app.log.info("[ApplicationService] - Starting application update for application %s", applicationId);

    try {
      const existingApplication = await this.applicationRepository.getApplicationById(applicationId);

      if (!existingApplication) {
        app.log.warn("[ApplicationService] - Application update failed: Application %s not found", applicationId);
        throw new AppError("Aplicação não encontrada", HTTP_STATUS_CODES.NOT_FOUND);
      }

      // Validate foreign keys for update data
      await this.validateForeignKeys(data, true);

      // Clean up the data for update
      const updateData = {
        ...data,
        serviceOrderId: data.serviceOrderId || undefined,
        plotId: data.plotId || undefined,
        farmId: data.farmId || undefined,
      };

      const updatedApplication = await this.applicationRepository.updateApplication(applicationId, updateData);

      if (!updatedApplication) {
        app.log.error(
          "[ApplicationService] - Application update failed: Unable to retrieve updated application %s",
          applicationId,
        );
        throw new AppError("Falha ao atualizar a aplicação", HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR);
      }

      app.log.info("[ApplicationService] - Application updated successfully with ID %s", applicationId);
      return updatedApplication;
    } catch (error) {
      app.log.error("[ApplicationService] - Application update failed: %s", error);
      throw error;
    }
  }

  public async applicationStatsSummary(startDate: Date, endDate: Date): Promise<ApplicationSummaryStatsDTO> {
    const [
      openOrdersCount,
      completedOrdersCount,
      cancelledOrdersCount,
      avgHectarebyApplication,
      totalHectares,
      comparisonLastMonths,
      openOrdersAreaHectares,
      completedOrdersAreaHectares,
      cancelledOrdersAreaHectares,
      openOrdersAppliedHectares,
      completedOrdersAppliedHectares,
      cancelledOrdersAppliedHectares,
    ] = await Promise.all([
      this.applicationRepository.countServiceOrdersByStatus(startDate, endDate, 'open'),
      this.applicationRepository.countServiceOrdersByStatus(startDate, endDate, 'completed'),
      this.applicationRepository.countServiceOrdersByStatus(startDate, endDate, 'cancelled'),
      this.applicationRepository.avgHectarebyApplication(startDate, endDate),
      this.applicationRepository.countHectares(startDate, endDate),
      this.applicationRepository.compareLastMonths(startDate, endDate),
      this.applicationRepository.getAreaHectaresByStatus('open', startDate, endDate),
      this.applicationRepository.getAreaHectaresByStatus('completed', startDate, endDate),
      this.applicationRepository.getAreaHectaresByStatus('cancelled', startDate, endDate),
      this.applicationRepository.getAppliedHectaresByStatus('open', startDate, endDate),
      this.applicationRepository.getAppliedHectaresByStatus('completed', startDate, endDate),
      this.applicationRepository.getAppliedHectaresByStatus('cancelled', startDate, endDate),
    ]);

    // Calculate avgDaily using calendar days with applications (unique days from comparisonLastMonths)
    const uniqueDaysWithApplications = new Set(comparisonLastMonths.map(item => item.day)).size;
    const totalHectaresInPeriod = comparisonLastMonths.reduce((acc, curr) => acc + curr.hectares, 0);
    const avgDaily = uniqueDaysWithApplications > 0 ? totalHectaresInPeriod / uniqueDaysWithApplications : 0;

    return {
      openOrdersCount,
      completedOrdersCount,
      cancelledOrdersCount,
      avgHectarebyApplication,
      avgDaily,
      totalHectares,
      comparisonLastMonths,
      openOrdersAreaHectares,
      completedOrdersAreaHectares,
      cancelledOrdersAreaHectares,
      openOrdersAppliedHectares,
      completedOrdersAppliedHectares,
      cancelledOrdersAppliedHectares,
    }
  }

  public async getApplicationsPerformance(startDate: Date, endDate: Date): Promise<PilotPerformanceDTO>{
    const [
      avgHectaresByPilot, 
      totalHectares,
      comparelaLastMonth,
    ] =  await Promise.all([
      this.applicationRepository.avgHectaresByPilot(startDate, endDate),
      this.applicationRepository.countHectaresPerfomance(startDate, endDate),
      this.applicationRepository.applicationsByPilotsLastMonths(startDate, endDate),
    ]);

    return {
      avgHectaresByPilot,
      avgDailyByPilot: (comparelaLastMonth.reduce((acc, curr) => acc + curr.hectares, 0) / comparelaLastMonth.length) || 0,
      totalHectares,
      comparelaLastMonth,
    };
  }

  /**
   * @description Delete an application
   * @param {string} applicationId - The application's ID to delete
   * @returns {Promise<void>}
   * @throws {AppError} If the application is not found
   */
  public async deleteApplication(applicationId: string): Promise<void> {
    app.log.info("[ApplicationService] - Starting application deletion for application %s", applicationId);

    try {
      // Check if application exists
      const existingApplication = await this.applicationRepository.getApplicationById(applicationId);

      if (!existingApplication) {
        app.log.warn("[ApplicationService] - Application deletion failed: Application %s not found", applicationId);
        throw new AppError("Aplicação não encontrada", HTTP_STATUS_CODES.NOT_FOUND);
      }

      await this.applicationRepository.deleteApplication(applicationId);

      app.log.info("[ApplicationService] - Application deleted successfully with ID %s", applicationId);
    } catch (error) {
      app.log.error("[ApplicationService] - Application deletion failed: %s", error);
      throw error;
    }
  }

  /**
   * @description Gets genreal statistics for all service orders
   * @param {ApplicationStatsQueryString} filters - Optional filters to apply
   * @returns {Promise<ApplicationStatsDTO>}
   */ 
  public async getGeneralStats(filters?: ApplicationStatsQueryString): Promise<ApplicationStatsDTO> {
    const effectiveFilters = filters?.ignoreFilters ? undefined : filters;
    const [
      applicationCount,
      applicationCountByMonth,
      totalAreaHectares,
      averageApplicationArea,
      typeOfProducts,
      pilotsCount,
      dronesCount,
      culturesCount,
      averageApplicationByPilot,
      averageApplicationByDrone,
      averageAreaCoveredApplication,
      invalidApplication,
      totalHectaresByMonth,
      firstApplicationDate,
      pendingApplicationsCount,
      pendingApplicationsTotalArea,
      pendingFarmsCount,
      pendingPlotsCount,
      pendingApplicationsMissingFarmCount,
      pendingApplicationsOtherThanInvalidOpenCount,
      operationalDayCount,
    ] = await Promise.all([
      this.getApplicationCount(effectiveFilters),
      this.getApplicationCountByMonth(), // Keep this unfiltered as per requirement
      this.getTotalAreaHectares(effectiveFilters),
      this.getAverageApplicationArea(effectiveFilters),
      this.getTypeOfProducts(effectiveFilters),
      this.getPilotsCount(effectiveFilters),
      this.getDronesCount(effectiveFilters), 
      this.getCulturesCount(effectiveFilters),
      this.getAverageApplicationByPilot(effectiveFilters),
      this.getAverageApplicationByDrone(effectiveFilters),
      this.averageAreaCoveredApplication(effectiveFilters),
      this.getInvalidadApplication(effectiveFilters),
      this.getTotalAreaHectaresByMonth(effectiveFilters),
      this.getFirstApplicationDate(effectiveFilters),
      this.getPendingApplicationsCount(effectiveFilters),
      this.getPendingApplicationsTotalArea(effectiveFilters),
      this.getPendingFarmsCount(effectiveFilters),
      this.getPendingPlotsCount(effectiveFilters),
      this.getPendingApplicationsMissingFarmCount(effectiveFilters),
      this.getPendingApplicationsOtherThanInvalidOpen(effectiveFilters),
      this.getOperationalDayCount(effectiveFilters),
    ]);

    // Calculate days elapsed for total hectares
    const today = new Date();
    const daysElapsedTotal = this.calculateDaysElapsed(firstApplicationDate, today);
    const totalHectaresPerDay = daysElapsedTotal > 0 ? totalAreaHectares / daysElapsedTotal : 0;

    // Calculate days elapsed for current month (from day 1 to today)
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const daysElapsedMonth = this.calculateDaysElapsed(firstDayOfMonth, today);
    const totalHectaresByMonthPerDay = daysElapsedMonth > 0 ? totalHectaresByMonth / daysElapsedMonth : 0;
    const operationalAverageHectaresPerDay =
      operationalDayCount > 0 ? totalAreaHectares / operationalDayCount : 0;
    const operationalAverageHectaresPerDrone = dronesCount > 0 ? totalAreaHectares / dronesCount : 0;
    const operationalAverageHectaresPerPilot = pilotsCount > 0 ? totalAreaHectares / pilotsCount : 0;

    return {
      applicationCount,
      applicationCountByMonth,
      totalAreaHectares,
      averageApplicationArea,
      typeOfProducts,
      pilotsCount,
      dronesCount,
      culturesCount,
      averageApplicationByPilot,
      averageApplicationByDrone,
      averageAreaCoveredApplication,
      invalidApplication,
      totalHectaresByMonth,
      totalHectaresPerDay,
      totalHectaresByMonthPerDay,
      pendingApplicationsCount,
      pendingApplicationsTotalArea,
      pendingFarmsCount,
      pendingPlotsCount,
      pendingApplicationsMissingFarmCount,
      pendingApplicationsOtherThanInvalidOpenCount,
      operationalAverageHectaresPerDay,
      operationalAverageHectaresPerDrone,
      operationalAverageHectaresPerPilot,
    }
  }

  public async getStatsByPilot(filters?: ByPilotStatsQueryString): Promise<Array<{
    pilotId: string | null;
    pilotName: string;
    applicationsCount: number;
    totalAreaHectares: number;
    averageAreaPerApplication: number;
  }>> {
    const { whereClause } = this.buildApplicationWhereConditions(filters);
    const limit = filters?.limit ?? 10;

    const result = await db
      .select({
        pilotId: users.id,
        pilotName: sql<string>`COALESCE(${users.name}, 'Piloto não informado')`,
        applicationsCount: countDistinct(applications.id),
        totalAreaHectares: sum(applications.hectares),
      })
      .from(applications)
      .leftJoin(users, eq(applications.pilotId, users.id))
      .leftJoin(plots, eq(applications.plotId, plots.id))
      .leftJoin(farms, eq(applications.farmId, farms.id))
      .leftJoin(customers, eq(farms.customerId, customers.id))
      .leftJoin(serviceOrders, eq(applications.serviceOrderId, serviceOrders.id))
      .where(and(whereClause, isNull(users.deletedAt)))
      .groupBy(users.id, users.name)
      .orderBy(sql`COALESCE(SUM(${applications.hectares}), 0) DESC`)
      .limit(limit);

    return result.map((row) => {
      const totalArea = Number(row.totalAreaHectares || 0);
      const applicationsCount = Number(row.applicationsCount || 0);
      return {
        pilotId: row.pilotId,
        pilotName: row.pilotName,
        applicationsCount,
        totalAreaHectares: totalArea,
        averageAreaPerApplication: applicationsCount > 0 ? totalArea / applicationsCount : 0,
      };
    });
  }

  public async getTopFarmsStats(filters?: TopFarmsStatsQueryString): Promise<Array<{
    farmId: string | null;
    farmName: string;
    applicationsCount: number;
    totalAreaHectares: number;
  }>> {
    const { whereClause } = this.buildApplicationWhereConditions(filters);
    const limit = filters?.limit ?? 5;

    const results = await db
      .select({
        farmId: farms.id,
        farmName: sql<string>`COALESCE(${farms.name}, 'Fazenda não informada')`,
        applicationsCount: countDistinct(applications.id),
        totalAreaHectares: sum(applications.hectares),
      })
      .from(applications)
      .leftJoin(users, eq(applications.pilotId, users.id))
      .leftJoin(plots, eq(applications.plotId, plots.id))
      .leftJoin(farms, eq(applications.farmId, farms.id))
      .leftJoin(customers, eq(farms.customerId, customers.id))
      .leftJoin(serviceOrders, eq(applications.serviceOrderId, serviceOrders.id))
      .where(whereClause)
      .groupBy(farms.id, farms.name)
      .orderBy(sql`COALESCE(SUM(${applications.hectares}), 0) DESC`)
      .limit(limit);

    return results.map((result) => ({
      farmId: result.farmId,
      farmName: result.farmName,
      applicationsCount: Number(result.applicationsCount || 0),
      totalAreaHectares: Number(result.totalAreaHectares || 0),
    }));
  }

  public async getApplicationsEvolution(filters?: ApplicationEvolutionQueryString): Promise<Array<{
    date: string;
    applicationsCount: number;
  }>> {
    const { whereClause } = this.buildApplicationWhereConditions(filters);
    const granularity = filters?.granularity ?? "month";
    const bucketDateSql =
      granularity === "day"
        ? sql`(${applications.date})::date`
        : granularity === "month"
          ? sql`DATE_TRUNC('month', ${applications.date})::date`
          : sql`DATE_TRUNC('year', ${applications.date})::date`;

    const rows = await db
      .select({
        date: sql<string>`TO_CHAR(${bucketDateSql}, 'YYYY-MM-DD')`,
        applicationsCount: countDistinct(applications.id),
      })
      .from(applications)
      .leftJoin(users, eq(applications.pilotId, users.id))
      .leftJoin(plots, eq(applications.plotId, plots.id))
      .leftJoin(farms, eq(applications.farmId, farms.id))
      .leftJoin(customers, eq(farms.customerId, customers.id))
      .leftJoin(serviceOrders, eq(applications.serviceOrderId, serviceOrders.id))
      .where(whereClause)
      .groupBy(bucketDateSql)
      .orderBy(sql`${bucketDateSql} ASC`)
      .limit(5000);

    return rows
      .map((item) => ({
        date: item.date,
        applicationsCount: Number(item.applicationsCount || 0),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Gets count of Applications.
   * @param {ApplicationStatsQueryString} filters - Optional filters to apply
   * @returns {Promise<number>} Count of Applications.
   */
  private async getApplicationCount(filters?: ApplicationStatsQueryString): Promise<number> {
    if (!filters) {
      const result = await db
        .select({ count: count() })
        .from(applications)
        .where(isNull(applications.deletedAt));

      return Number(result[0]?.count || 0);
    }

    // Use the repository method that already handles all filters
    return await this.applicationRepository.countApplications(
      filters.search,
      {
        serviceOrderStatus: filters.serviceOrderStatus,
        farmId: filters.farmId,
        pilotId: filters.pilotId,
        productId: filters.productId,
        customerId: filters.customerId,
        serviceOrderId: filters.serviceOrderId,
        invalidApplication: filters.invalidApplication,
        startDate: filters.startDate,
        endDate: filters.endDate,
      }
    );
  }

  /**
   * Gets count of Applications by current month.
   * @returns {Promise<number>} Count of Applications.
   */
  private async getApplicationCountByMonth(): Promise<number> {
    const result =  await db
      .select({ count: count()})
      .from(applications)
      .where(
        and(
          isNull(applications.deletedAt),
          sql`EXTRACT(MONTH FROM ${applications.date}) = EXTRACT(MONTH FROM CURRENT_DATE)
            AND EXTRACT(YEAR FROM ${applications.date}) = EXTRACT(YEAR FROM CURRENT_DATE)`
        )
      )

    return Number(result[0]?.count || 0);
  }

  /**
   * Gets total count of Hectares.
   * @param {ApplicationStatsQueryString} filters - Optional filters to apply
   * @returns {Promise<number>} Count of Hectares.
   */
  private async getTotalAreaHectares(filters?: ApplicationStatsQueryString): Promise<number> {
    const { whereClause, needsJoins } = this.buildApplicationWhereConditions(filters);

    if (!needsJoins) {
      const result = await db
        .select({ totalArea: sum(applications.hectares) })
        .from(applications)
        .where(whereClause);

      return Number(result[0]?.totalArea || 0);
    }

    // With joins
    const result = await db
      .select({ totalArea: sum(applications.hectares) })
      .from(applications)
      .leftJoin(users, eq(applications.pilotId, users.id))
      .leftJoin(plots, eq(applications.plotId, plots.id))
      .leftJoin(farms, eq(applications.farmId, farms.id))
      .leftJoin(customers, eq(farms.customerId, customers.id))
      .leftJoin(serviceOrders, eq(applications.serviceOrderId, serviceOrders.id))
      .where(whereClause);

    return Number(result[0]?.totalArea || 0);
  }

  /**
   * Gets total count of Hectares by current month.
   * @param {ApplicationStatsQueryString} filters - Optional filters to apply
   * @returns {Promise<number>} Total hectares of current month.
   */
  private async getTotalAreaHectaresByMonth(filters?: ApplicationStatsQueryString): Promise<number> {
    const { whereClause, needsJoins } = this.buildApplicationWhereConditions(filters);
    
    // Add month filter to where clause
    const monthWhereClause = and(
      whereClause,
      sql`EXTRACT(MONTH FROM ${applications.date}) = EXTRACT(MONTH FROM CURRENT_DATE)
        AND EXTRACT(YEAR FROM ${applications.date}) = EXTRACT(YEAR FROM CURRENT_DATE)`
    );

    if (!needsJoins) {
      const result = await db
        .select({ totalArea: sum(applications.hectares) })
        .from(applications)
        .where(monthWhereClause);

      return Number(result[0]?.totalArea || 0);
    }

    // With joins
    const result = await db
      .select({ totalArea: sum(applications.hectares) })
      .from(applications)
      .leftJoin(users, eq(applications.pilotId, users.id))
      .leftJoin(plots, eq(applications.plotId, plots.id))
      .leftJoin(farms, eq(applications.farmId, farms.id))
      .leftJoin(customers, eq(farms.customerId, customers.id))
      .leftJoin(serviceOrders, eq(applications.serviceOrderId, serviceOrders.id))
      .where(monthWhereClause);

    return Number(result[0]?.totalArea || 0);
  }

  /**
   * Gets the date of the first application.
   * @param {ApplicationStatsQueryString} filters - Optional filters to apply
   * @returns {Promise<Date | null>} Date of first application or null if none exists.
   */
  private async getFirstApplicationDate(filters?: ApplicationStatsQueryString): Promise<Date | null> {
    const { whereClause, needsJoins } = this.buildApplicationWhereConditions(filters);

    if (!needsJoins) {
      const result = await db
        .select({ firstDate: sql<Date>`MIN(${applications.date})` })
        .from(applications)
        .where(whereClause);

      return result[0]?.firstDate ? new Date(result[0].firstDate) : null;
    }

    // With joins
    const result = await db
      .select({ firstDate: sql<Date>`MIN(${applications.date})` })
      .from(applications)
      .leftJoin(users, eq(applications.pilotId, users.id))
      .leftJoin(plots, eq(applications.plotId, plots.id))
      .leftJoin(farms, eq(applications.farmId, farms.id))
      .leftJoin(customers, eq(farms.customerId, customers.id))
      .leftJoin(serviceOrders, eq(applications.serviceOrderId, serviceOrders.id))
      .where(whereClause);

    return result[0]?.firstDate ? new Date(result[0].firstDate) : null;
  }

  /**
   * Calculates the number of elapsed days between two dates.
   * @param {Date | null} firstDate - Start date
   * @param {Date} endDate - End date
   * @returns {number} Number of days elapsed (inclusive of both dates)
   */
  private calculateDaysElapsed(firstDate: Date | null, endDate: Date): number {
    if (!firstDate) {
      return 0;
    }

    // Set both dates to midnight to get accurate day count
    const start = new Date(firstDate);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    // Calculate difference in milliseconds and convert to days
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Return at least 1 day if dates are the same or very close
    return Math.max(1, diffDays);
  }

  /**
   * Get average for application Area.
   * @param {ApplicationStatsQueryString} filters - Optional filters to apply
   * @returns {Promise<number>} Avarage of Applications.
   */
  private async getAverageApplicationArea(filters?: ApplicationStatsQueryString): Promise<number> {
    const { whereClause, needsJoins } = this.buildApplicationWhereConditions(filters);

    if (!needsJoins) {
      const [result] = await db
        .select({ average: avg(applications.hectares) })
        .from(applications)
        .where(whereClause);

      return Number(result?.average) || 0;
    }

    // With joins
    const [result] = await db
      .select({ average: avg(applications.hectares) })
      .from(applications)
      .leftJoin(users, eq(applications.pilotId, users.id))
      .leftJoin(plots, eq(applications.plotId, plots.id))
      .leftJoin(farms, eq(applications.farmId, farms.id))
      .leftJoin(customers, eq(farms.customerId, customers.id))
      .leftJoin(serviceOrders, eq(applications.serviceOrderId, serviceOrders.id))
      .where(whereClause);

    return Number(result?.average) || 0;
  }

  /**
   * Gets count of plotsId that are null.
   * @param {ApplicationStatsQueryString} filters - Optional filters to apply
   * @returns {Promise<number>} Count of pilots with open orders.
   */
  private async getInvalidadApplication(filters?: ApplicationStatsQueryString): Promise<number> {
    const { whereClause, needsJoins } = this.buildApplicationWhereConditions(filters);

    if (!needsJoins) {
      const [result] = await db
        .select({ count: countDistinct(applications.id) })
        .from(applications)
        .innerJoin(serviceOrders, eq(applications.serviceOrderId, serviceOrders.id))
        .where(
          and(
            isNull(applications.plotId), 
            isNull(applications.deletedAt), 
            eq(serviceOrders.status, 'open'),
            // Exclude applications from special "avulso" service orders
            not(inArray(applications.serviceOrderId, EXCLUDED_SERVICE_ORDER_IDS))
          )
        );
      
      return result?.count ?? 0;
    }

    // With joins - add exclusion to existing whereClause
    const [result] = await db
      .select({ count: countDistinct(applications.id) })
      .from(applications)
      .innerJoin(serviceOrders, eq(applications.serviceOrderId, serviceOrders.id))
      .leftJoin(users, eq(applications.pilotId, users.id))
      .leftJoin(plots, eq(applications.plotId, plots.id))
      .leftJoin(farms, eq(applications.farmId, farms.id))
      .leftJoin(customers, eq(farms.customerId, customers.id))
      .where(
        and(
          whereClause,
          // Exclude applications from special "avulso" service orders
          not(inArray(applications.serviceOrderId, EXCLUDED_SERVICE_ORDER_IDS))
        )
      );
    
    return result?.count ?? 0;
  }

  /**
   * Build WHERE conditions for pending applications (missing serviceOrderId, farmId, or plotId)
   * @param {ApplicationStatsQueryString} filters - Optional filters to apply
   * @returns {object} Object with whereClause and joins needed
   */
  private buildPendingApplicationsWhereConditions(filters?: ApplicationStatsQueryString) {
    const whereConditions = [
      isNull(applications.deletedAt),
      or(
        isNull(applications.serviceOrderId),
        isNull(applications.farmId),
        isNull(applications.plotId)
      )!,
      // Exclude applications from special "avulso" service orders
      // These service orders are used to organize loose/invalid applications and should not be counted
      or(
        isNull(applications.serviceOrderId),
        not(inArray(applications.serviceOrderId, EXCLUDED_SERVICE_ORDER_IDS))
      )!
    ];
    let needsJoins = false;

    // Search conditions
    if (filters?.search) {
      whereConditions.push(
        or(
          ilike(applications.observations, `%${filters.search}%`),
          ilike(users.name, `%${filters.search}%`), // pilot name
          ilike(customers.name, `%${filters.search}%`), // customer name
          ilike(farms.name, `%${filters.search}%`) // farm name
        )!
      );
      needsJoins = true;
    }

    // Filter conditions
    if (filters?.serviceOrderStatus) {
      whereConditions.push(eq(serviceOrders.status, filters.serviceOrderStatus));
      needsJoins = true;
    }

    if (filters?.farmId) {
      whereConditions.push(eq(farms.id, filters.farmId));
      needsJoins = true;
    }

    if (filters?.pilotId) {
      whereConditions.push(eq(applications.pilotId, filters.pilotId));
    }

    if (filters?.productId) {
      whereConditions.push(eq(applications.productId, filters.productId));
    }

    if (filters?.customerId) {
      whereConditions.push(eq(customers.id, filters.customerId));
      needsJoins = true;
    }

    if (filters?.serviceOrderId) {
      whereConditions.push(eq(applications.serviceOrderId, filters.serviceOrderId));
    }

    if (filters?.startDate && filters?.endDate) {
      const adjustEndDate = new Date(filters.endDate);
      adjustEndDate.setDate(adjustEndDate.getDate() + 1);

      whereConditions.push(
        and(
          gte(applications.date, new Date(filters.startDate)),
          lt(applications.date, adjustEndDate)
        )!
      );
    }

    return {
      whereClause: whereConditions.length > 1 ? and(...whereConditions) : whereConditions[0],
      needsJoins
    };
  }

  /**
   * Gets count of pending applications (missing serviceOrderId, farmId, or plotId).
   * @param {ApplicationStatsQueryString} filters - Optional filters to apply
   * @returns {Promise<number>} Count of pending applications.
   */
  private async getPendingApplicationsCount(filters?: ApplicationStatsQueryString): Promise<number> {
    const { whereClause, needsJoins } = this.buildPendingApplicationsWhereConditions(filters);

    if (!needsJoins) {
      const result = await db
        .select({ count: count() })
        .from(applications)
        .where(whereClause);

      return Number(result[0]?.count || 0);
    }

    // With joins
    const result = await db
      .select({ count: count() })
      .from(applications)
      .leftJoin(users, eq(applications.pilotId, users.id))
      .leftJoin(plots, eq(applications.plotId, plots.id))
      .leftJoin(farms, eq(applications.farmId, farms.id))
      .leftJoin(customers, eq(farms.customerId, customers.id))
      .leftJoin(serviceOrders, eq(applications.serviceOrderId, serviceOrders.id))
      .where(whereClause);

    return Number(result[0]?.count || 0);
  }

  /**
   * Gets total area (hectares) of pending applications.
   * @param {ApplicationStatsQueryString} filters - Optional filters to apply
   * @returns {Promise<number>} Total area in hectares of pending applications.
   */
  private async getPendingApplicationsTotalArea(filters?: ApplicationStatsQueryString): Promise<number> {
    const { whereClause, needsJoins } = this.buildPendingApplicationsWhereConditions(filters);

    if (!needsJoins) {
      const result = await db
        .select({ totalArea: sum(applications.hectares) })
        .from(applications)
        .where(whereClause);

      return Number(result[0]?.totalArea || 0);
    }

    // With joins
    const result = await db
      .select({ totalArea: sum(applications.hectares) })
      .from(applications)
      .leftJoin(users, eq(applications.pilotId, users.id))
      .leftJoin(plots, eq(applications.plotId, plots.id))
      .leftJoin(farms, eq(applications.farmId, farms.id))
      .leftJoin(customers, eq(farms.customerId, customers.id))
      .leftJoin(serviceOrders, eq(applications.serviceOrderId, serviceOrders.id))
      .where(whereClause);

    return Number(result[0]?.totalArea || 0);
  }

  /**
   * Gets count of unique farms that have pending applications.
   * @param {ApplicationStatsQueryString} filters - Optional filters to apply
   * @returns {Promise<number>} Count of unique farms with pending applications.
   */
  private async getPendingFarmsCount(filters?: ApplicationStatsQueryString): Promise<number> {
    const { whereClause, needsJoins } = this.buildPendingApplicationsWhereConditions(filters);

    if (!needsJoins) {
      const result = await db
        .select({ count: sql<number>`COUNT(DISTINCT ${applications.farmId})` })
        .from(applications)
        .where(and(whereClause, sql`${applications.farmId} IS NOT NULL`));

      return Number(result[0]?.count || 0);
    }

    // With joins
    const result = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${applications.farmId})` })
      .from(applications)
      .leftJoin(users, eq(applications.pilotId, users.id))
      .leftJoin(plots, eq(applications.plotId, plots.id))
      .leftJoin(farms, eq(applications.farmId, farms.id))
      .leftJoin(customers, eq(farms.customerId, customers.id))
      .leftJoin(serviceOrders, eq(applications.serviceOrderId, serviceOrders.id))
      .where(and(whereClause, sql`${applications.farmId} IS NOT NULL`));

    return Number(result[0]?.count || 0);
  }

  /**
   * Gets count of unique plots that have pending applications.
   * @param {ApplicationStatsQueryString} filters - Optional filters to apply
   * @returns {Promise<number>} Count of unique plots with pending applications.
   */
  private async getPendingPlotsCount(filters?: ApplicationStatsQueryString): Promise<number> {
    const { whereClause, needsJoins } = this.buildPendingApplicationsWhereConditions(filters);

    if (!needsJoins) {
      const result = await db
        .select({ count: sql<number>`COUNT(DISTINCT ${applications.id})` })
        .from(applications)
        .where(and(whereClause, sql`${applications.plotId} IS NULL`));

      return Number(result[0]?.count || 0);
    }

    // With joins
    const result = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${applications.id})` })
      .from(applications)
      .leftJoin(users, eq(applications.pilotId, users.id))
      .leftJoin(plots, eq(applications.plotId, plots.id))
      .leftJoin(farms, eq(applications.farmId, farms.id))
      .leftJoin(customers, eq(farms.customerId, customers.id))
      .leftJoin(serviceOrders, eq(applications.serviceOrderId, serviceOrders.id))
      .where(and(whereClause, sql`${applications.plotId} IS NULL`));

    return Number(result[0]?.count || 0);
  }

  /**
   * Pendências estruturais com farmId nulo (sem fazenda vinculada).
   */
  private async getPendingApplicationsMissingFarmCount(filters?: ApplicationStatsQueryString): Promise<number> {
    const { whereClause, needsJoins } = this.buildPendingApplicationsWhereConditions(filters);
    const combined = and(whereClause, isNull(applications.farmId))!;

    if (!needsJoins) {
      const result = await db
        .select({ count: count() })
        .from(applications)
        .where(combined);

      return Number(result[0]?.count || 0);
    }

    const result = await db
      .select({ count: count() })
      .from(applications)
      .leftJoin(users, eq(applications.pilotId, users.id))
      .leftJoin(plots, eq(applications.plotId, plots.id))
      .leftJoin(farms, eq(applications.farmId, farms.id))
      .leftJoin(customers, eq(farms.customerId, customers.id))
      .leftJoin(serviceOrders, eq(applications.serviceOrderId, serviceOrders.id))
      .where(combined);

    return Number(result[0]?.count || 0);
  }

  /**
   * Pendências estruturais (mesmo critério de pendingApplicationsCount) exceto o recorte
   * contado em invalidApplication (sem talhão + OS aberta + fora das OS especiais).
   * Garante partição disjunta: invalid + este = pending (por linha de aplicação).
   */
  private async getPendingApplicationsOtherThanInvalidOpen(
    filters?: ApplicationStatsQueryString,
  ): Promise<number> {
    const { whereClause, needsJoins } = this.buildPendingApplicationsWhereConditions(filters);

    const invalidOpenSlice = and(
      isNull(applications.plotId),
      exists(
        db
          .select({ id: serviceOrders.id })
          .from(serviceOrders)
          .where(
            and(
              eq(serviceOrders.id, applications.serviceOrderId),
              eq(serviceOrders.status, "open"),
            )!,
          ),
      ),
      not(inArray(applications.serviceOrderId, EXCLUDED_SERVICE_ORDER_IDS)),
    )!;

    const combined = and(whereClause, not(invalidOpenSlice))!;

    if (!needsJoins) {
      const result = await db
        .select({ count: count() })
        .from(applications)
        .where(combined);

      return Number(result[0]?.count || 0);
    }

    const result = await db
      .select({ count: count() })
      .from(applications)
      .leftJoin(users, eq(applications.pilotId, users.id))
      .leftJoin(plots, eq(applications.plotId, plots.id))
      .leftJoin(farms, eq(applications.farmId, farms.id))
      .leftJoin(customers, eq(farms.customerId, customers.id))
      .leftJoin(serviceOrders, eq(applications.serviceOrderId, serviceOrders.id))
      .where(combined);

    return Number(result[0]?.count || 0);
  }

  /**
   * Get type of Products with total hectares.
   * @param {ApplicationStatsQueryString} filters - Optional filters to apply
   * @returns {Promise<{productId: string, product: string, hectares: number}[]>} hectares by product.
   */
  private async getTypeOfProducts(filters?: ApplicationStatsQueryString): Promise<{ productId: string; product: string; hectares: number }[]> {
    const { whereClause, needsJoins } = this.buildApplicationWhereConditions(filters);

    if (!needsJoins) {
      const results = await db
        .select({
          productId: products.id,
          product: products.name,
          hectares: sum(applications.hectares)
        })
        .from(applications)
        .innerJoin(products, eq(applications.productId, products.id))
        .where(whereClause)
        .groupBy(products.id, products.name);

      return results.map(r => ({
        productId: r.productId,
        product: r.product,
        hectares: Number(r.hectares || 0),
      }));
    }

    // With joins
    const results = await db
      .select({
        productId: products.id,
        product: products.name,
        hectares: sum(applications.hectares)
      })
      .from(applications)
      .innerJoin(products, eq(applications.productId, products.id))
      .leftJoin(users, eq(applications.pilotId, users.id))
      .leftJoin(plots, eq(applications.plotId, plots.id))
      .leftJoin(farms, eq(applications.farmId, farms.id))
      .leftJoin(customers, eq(farms.customerId, customers.id))
      .leftJoin(serviceOrders, eq(applications.serviceOrderId, serviceOrders.id))
      .where(whereClause)
      .groupBy(products.id, products.name);

    return results.map(r => ({
      productId: r.productId,
      product: r.product,
      hectares: Number(r.hectares || 0),
    }));
  }

  /**
   * Get total count pilot.
   * @param {ApplicationStatsQueryString} filters - Optional filters to apply
   * @returns {Promise<number>} count of Pilot.
   */
  private async getPilotsCount(filters?: ApplicationStatsQueryString): Promise<number> {
    const { whereClause, needsJoins } = this.buildApplicationWhereConditions(filters);
    const activePilotWhereClause = and(whereClause, isNull(users.deletedAt));

    if (!needsJoins) {
      const result = await db
        .selectDistinct({ count: sql<number>`COUNT(DISTINCT ${applications.pilotId})` })
        .from(applications)
        .leftJoin(users, eq(applications.pilotId, users.id))
        .where(activePilotWhereClause);

      return Number(result[0]?.count || 0);
    }

    // With joins
    const result = await db
      .selectDistinct({ count: sql<number>`COUNT(DISTINCT ${applications.pilotId})` })
      .from(applications)
      .leftJoin(users, eq(applications.pilotId, users.id))
      .leftJoin(plots, eq(applications.plotId, plots.id))
      .leftJoin(farms, eq(applications.farmId, farms.id))
      .leftJoin(customers, eq(farms.customerId, customers.id))
      .leftJoin(serviceOrders, eq(applications.serviceOrderId, serviceOrders.id))
      .where(activePilotWhereClause);

    return Number(result[0]?.count || 0);
  }

  /**
   * Get total count Drones.
   * @param {ApplicationStatsQueryString} filters - Optional filters to apply
   * @returns {Promise<number>} count of Drones.
   */
  private async getDronesCount(filters?: ApplicationStatsQueryString): Promise<number> {
    const { whereClause, needsJoins } = this.buildApplicationWhereConditions(filters);

    if (!needsJoins) {
      const result = await db
        .selectDistinct({ count: sql<number>`COUNT(DISTINCT ${applications.droneId})` })
        .from(applications)
        .where(whereClause);

      return Number(result[0]?.count || 0);
    }

    // With joins
    const result = await db
      .selectDistinct({ count: sql<number>`COUNT(DISTINCT ${applications.droneId})` })
      .from(applications)
      .leftJoin(users, eq(applications.pilotId, users.id))
      .leftJoin(plots, eq(applications.plotId, plots.id))
      .leftJoin(farms, eq(applications.farmId, farms.id))
      .leftJoin(customers, eq(farms.customerId, customers.id))
      .leftJoin(serviceOrders, eq(applications.serviceOrderId, serviceOrders.id))
      .where(whereClause);

    return Number(result[0]?.count || 0);
  }

  /**
   * Get total count cultures.
   * @param {ApplicationStatsQueryString} filters - Optional filters to apply
   * @returns {Promise<number>} count of cultures.
   */  
  private async getCulturesCount(filters?: ApplicationStatsQueryString): Promise<number> {
    const { whereClause, needsJoins } = this.buildApplicationWhereConditions(filters);

    if (!needsJoins) {
      const result = await db
        .select({ count: sql<number>`COUNT(DISTINCT ${applications.cultureId})` })
        .from(applications)
        .where(whereClause);

      return Number(result[0]?.count || 0);
    }

    // With joins
    const result = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${applications.cultureId})` })
      .from(applications)
      .leftJoin(users, eq(applications.pilotId, users.id))
      .leftJoin(plots, eq(applications.plotId, plots.id))
      .leftJoin(farms, eq(applications.farmId, farms.id))
      .leftJoin(customers, eq(farms.customerId, customers.id))
      .leftJoin(serviceOrders, eq(applications.serviceOrderId, serviceOrders.id))
      .where(whereClause);

    return Number(result[0]?.count || 0);
  }

  /**
   * Get count average application by pilot.
   * @param {ApplicationStatsQueryString} filters - Optional filters to apply
   * @returns {Promise<number>}  count average application by pilot.
   */  
  private async getAverageApplicationByPilot(filters?: ApplicationStatsQueryString): Promise<number> {
    const { whereClause, needsJoins } = this.buildApplicationWhereConditions(filters);

    let countApplications, countDistinctPilots;

    if (!needsJoins) {
      countApplications = await db
        .select({ count: count() })
        .from(applications)
        .where(whereClause);

      countDistinctPilots = await db
        .select({ count: sql<number>`COUNT(DISTINCT ${applications.pilotId})`})
        .from(applications)
        .where(whereClause);
    } else {
      countApplications = await db
        .select({ count: count() })
        .from(applications)
        .leftJoin(users, eq(applications.pilotId, users.id))
        .leftJoin(plots, eq(applications.plotId, plots.id))
        .leftJoin(farms, eq(applications.farmId, farms.id))
        .leftJoin(customers, eq(farms.customerId, customers.id))
        .leftJoin(serviceOrders, eq(applications.serviceOrderId, serviceOrders.id))
        .where(whereClause);

      countDistinctPilots = await db
        .select({ count: sql<number>`COUNT(DISTINCT ${applications.pilotId})`})
        .from(applications)
        .leftJoin(users, eq(applications.pilotId, users.id))
        .leftJoin(plots, eq(applications.plotId, plots.id))
        .leftJoin(farms, eq(applications.farmId, farms.id))
        .leftJoin(customers, eq(farms.customerId, customers.id))
        .leftJoin(serviceOrders, eq(applications.serviceOrderId, serviceOrders.id))
        .where(whereClause);
    }

    const totalApplications = countApplications[0]?.count ?? 0;
    const totalPilot = countDistinctPilots[0]?.count ?? 0;

    return totalPilot > 0 ? Number(totalApplications / totalPilot) : 0;
  }

  /**
   * Get count average application by drone.
   * @returns {Promise<number>}  count average application by drone.
   */    
  private async getAverageApplicationByDrone(filters?: ApplicationStatsQueryString): Promise<number> {
    const { whereClause, needsJoins } = this.buildApplicationWhereConditions(filters);

    let countApplications, countDistinctDrones;

    if (!needsJoins) {
      countApplications = await db
        .select({ count: count() })
        .from(applications)
        .where(whereClause);

      countDistinctDrones = await db
        .select({ count: sql<number>`COUNT(DISTINCT ${applications.droneId})`})
        .from(applications)
        .where(whereClause);
    } else {
      countApplications = await db
        .select({ count: count() })
        .from(applications)
        .leftJoin(users, eq(applications.pilotId, users.id))
        .leftJoin(plots, eq(applications.plotId, plots.id))
        .leftJoin(farms, eq(applications.farmId, farms.id))
        .leftJoin(customers, eq(farms.customerId, customers.id))
        .leftJoin(serviceOrders, eq(applications.serviceOrderId, serviceOrders.id))
        .where(whereClause);

      countDistinctDrones = await db
        .select({ count: sql<number>`COUNT(DISTINCT ${applications.droneId})`})
        .from(applications)
        .leftJoin(users, eq(applications.pilotId, users.id))
        .leftJoin(plots, eq(applications.plotId, plots.id))
        .leftJoin(farms, eq(applications.farmId, farms.id))
        .leftJoin(customers, eq(farms.customerId, customers.id))
        .leftJoin(serviceOrders, eq(applications.serviceOrderId, serviceOrders.id))
        .where(whereClause);
    }

    const totalApplications = countApplications[0]?.count ?? 0;
    const totalDrones = countDistinctDrones[0]?.count ?? 0;

    return totalDrones > 0 ? Number(totalApplications / totalDrones) : 0;
  }

  /**
   * Get count average convered application.
   * @returns {Promise<number>}  count average convered application.
   */    
  private async averageAreaCoveredApplication(filters?: ApplicationStatsQueryString): Promise<number> {
    const { whereClause, needsJoins } = this.buildApplicationWhereConditions(filters);

    if (!needsJoins) {
      const [result] = await db
        .select({ average: avg(applications.hectares) })
        .from(applications)
        .where(whereClause);

      return Number(result?.average) || 0;
    }

    // With joins
    const [result] = await db
      .select({ average: avg(applications.hectares) })
      .from(applications)
      .leftJoin(users, eq(applications.pilotId, users.id))
      .leftJoin(plots, eq(applications.plotId, plots.id))
      .leftJoin(farms, eq(applications.farmId, farms.id))
      .leftJoin(customers, eq(farms.customerId, customers.id))
      .leftJoin(serviceOrders, eq(applications.serviceOrderId, serviceOrders.id))
      .where(whereClause);

    return Number(result?.average) || 0;
  }

  /**
   * @description Validate foreign key relationships
   * @param {CreateApplicationDTO | UpdateApplicationDTO} data - The application data
   * @param {boolean} isUpdate - Whether this is an update operation
   * @throws {AppError} If validation fails
   */
  private async validateForeignKeys(data: CreateApplicationDTO | UpdateApplicationDTO, isUpdate = false): Promise<void> {
    const validationPromises: Promise<void>[] = [];

    // Validate service order ID (if provided)
    if (data.serviceOrderId) {
      validationPromises.push(this.validateServiceOrder(data.serviceOrderId));
    }

    // Validate pilot ID (required for create, optional for update)
    if (data.pilotId || (!isUpdate && !data.pilotId)) {
      if (!data.pilotId && !isUpdate) {
        throw new AppError("O ID do piloto é requerido", HTTP_STATUS_CODES.BAD_REQUEST);
      }
      if (data.pilotId) {
        validationPromises.push(this.validatePilot(data.pilotId));
      }
    }

    // Validate assistant ID (if provided)
    if (data.assistantId) {
      validationPromises.push(this.validateAssistant(data.assistantId));
    }

    // Validate drone ID (required for create, optional for update)
    if (data.droneId || (!isUpdate && !data.droneId)) {
      if (!data.droneId && !isUpdate) {
        throw new AppError("O ID do drone é requerido", HTTP_STATUS_CODES.BAD_REQUEST);
      }
      if (data.droneId) {
        validationPromises.push(this.validateDrone(data.droneId));
      }
    }

    // Validate culture ID (required for create, optional for update)
    if (data.cultureId || (!isUpdate && !data.cultureId)) {
      if (!data.cultureId && !isUpdate) {
        throw new AppError("O ID da cultura é requerido", HTTP_STATUS_CODES.BAD_REQUEST);
      }
      if (data.cultureId) {
        validationPromises.push(this.validateCulture(data.cultureId));
      }
    }

    // Validate product ID (required for create, optional for update)
    if (data.productId || (!isUpdate && !data.productId)) {
      if (!data.productId && !isUpdate) {
        throw new AppError("O ID do produto é requerido", HTTP_STATUS_CODES.BAD_REQUEST);
      }
      if (data.productId) {
        validationPromises.push(this.validateProduct(data.productId));
      }
    }

    // Only validade if there's a value in the plot id
    if (data.plotId) {
      validationPromises.push(this.validatePlot(data.plotId));
    }

    await Promise.all(validationPromises);
  }

  private async validateServiceOrder(serviceOrderId: string): Promise<void> {
    const serviceOrder = await db.query.serviceOrders.findFirst({
      where: eq(serviceOrders.id, serviceOrderId),
    });

    if (!serviceOrder) {
      throw new AppError("Ordem de serviço não encontrada", HTTP_STATUS_CODES.NOT_FOUND);
    }
  }

  private async validatePilot(pilotId: string): Promise<void> {
    const pilot = await db.query.users.findFirst({
      where: and(eq(users.id, pilotId), eq(users.type, 'pilot'), isNull(users.deletedAt)),
    });

    if (!pilot) {
      throw new AppError("Piloto não encontrado", HTTP_STATUS_CODES.NOT_FOUND);
    }
  }

  private async validateAssistant(assistantId: string): Promise<void> {
    const assistant = await db.query.assistants.findFirst({
      where: and(eq(assistants.id, assistantId), isNull(assistants.deletedAt)),
    });

    if (!assistant) {
      throw new AppError("Assistente não encontrado", HTTP_STATUS_CODES.NOT_FOUND);
    }
  }

  private async validateDrone(droneId: string): Promise<void> {
    const drone = await db.query.drones.findFirst({
      where: and(eq(drones.id, droneId), isNull(drones.deletedAt)),
    });

    if (!drone) {
      throw new AppError("Drone não encontrado", HTTP_STATUS_CODES.NOT_FOUND);
    }
  }

  private async validateCulture(cultureId: string): Promise<void> {
    const culture = await db.query.cultureTypes.findFirst({
      where: and(eq(cultureTypes.id, cultureId), isNull(cultureTypes.deletedAt)),
    });

    if (!culture) {
      throw new AppError("Tipo de cultura não encontrado", HTTP_STATUS_CODES.NOT_FOUND);
    }
  }

  private async validateProduct(productId: string): Promise<void> {
    const product = await db.query.products.findFirst({
      where: and(eq(products.id, productId), isNull(products.deletedAt)),
    });

    if (!product) {
      throw new AppError("Produto não encontrado", HTTP_STATUS_CODES.NOT_FOUND);
    }
  }

  private async validatePlot(plotId: string): Promise<void> {
    const plot = await db.query.plots.findFirst({
      where: and(eq(plots.id, plotId), isNull(plots.deletedAt)),
    });

    if (!plot) {
      throw new AppError("Talhão não encontrado", HTTP_STATUS_CODES.NOT_FOUND);
    }
  }

  /**
   * @description Get dashboard metrics for the DashboardCardGeneralMetrics component
   * @param {DashboardMetricsQueryString} filters - Optional filters
   * @returns {Promise<DashboardMetricsDTO>} Dashboard metrics
   */
  public async getDashboardMetrics(filters?: DashboardMetricsQueryString): Promise<DashboardMetricsDTO> {
    app.log.info("[ApplicationService] - Fetching dashboard metrics");

    // Build where conditions
    const whereConditions = [isNull(applications.deletedAt)];
    
    // Filter by contract IDs via serviceOrders.contractId
    // This is the correct way to filter by contract - through service orders
    if (filters?.contractIds && filters.contractIds.length > 0) {
      whereConditions.push(inArray(serviceOrders.contractId, filters.contractIds));
    }
    
    // Filter by customer IDs via farms.customerId -> customers.id
    if (filters?.customerIds && filters.customerIds.length > 0) {
      whereConditions.push(inArray(customers.id, filters.customerIds));
    }
    
    // Filter by farm IDs
    if (filters?.farmIds && filters.farmIds.length > 0) {
      whereConditions.push(inArray(applications.farmId, filters.farmIds));
    }

    // Get start date from filters (required - client must always send a period)
    // The start date is interpreted as Brazil time (GMT-3)
    if (!filters?.startDate) {
      throw new AppError("O parâmetro startDate é obrigatório", HTTP_STATUS_CODES.BAD_REQUEST);
    }
    const startDate = new Date(filters.startDate + 'T00:00:00-03:00');
    
    // Convert start date to UTC for database query
    // Start date 00:00 GMT-3 = 03:00 UTC
    const startDateUTC = getStartOfDayBrazilInUTC(startDate);

    // Add date filter to where conditions
    // Only count applications from the start date onwards
    const whereConditionsWithDate = [
      ...whereConditions,
      gte(applications.date, startDateUTC),
    ];

    // Get total area hectares (filtered by date, farm, customer, and contract)
    // Join with serviceOrders to enable filtering by contractId
    const totalAreaResult = await db
      .select({ totalArea: sum(applications.hectares) })
      .from(applications)
      .leftJoin(serviceOrders, eq(applications.serviceOrderId, serviceOrders.id))
      .leftJoin(plots, eq(applications.plotId, plots.id))
      .leftJoin(farms, eq(applications.farmId, farms.id))
      .leftJoin(customers, eq(farms.customerId, customers.id))
      .where(and(...whereConditionsWithDate));

    const totalAreaHectares = Number(totalAreaResult[0]?.totalArea || 0);

    // Calculate days since start using Brazil timezone (GMT-3)
    const todayBrazil = getBrazilNow();
    const startOfTodayBrazil = new Date(Date.UTC(
      todayBrazil.getUTCFullYear(),
      todayBrazil.getUTCMonth(),
      todayBrazil.getUTCDate(),
      0, 0, 0, 0
    ));
    const startOfStartDate = new Date(Date.UTC(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate(),
      0, 0, 0, 0
    ));
    const diffTime = startOfTodayBrazil.getTime() - startOfStartDate.getTime();
    const daysSinceStart = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    // Calculate average daily area
    const averageDailyArea = totalAreaHectares / daysSinceStart;

    // Get yesterday's statistics (pass contractIds for proper filtering)
    const yesterdayStats = await this.getYesterdayStats(whereConditions, filters?.customerIds, filters?.farmIds, filters?.contractIds);

    // Get monthly sprayed area for chart (with date filter)
    const monthlySprayedArea = await this.getMonthlySprayedArea(whereConditionsWithDate, filters?.customerIds, filters?.farmIds, startDateUTC, filters?.contractIds);

    app.log.info("[ApplicationService] - Dashboard metrics fetched successfully");

    return {
      totalAreaHectares,
      daysSinceStart,
      averageDailyArea,
      yesterdayStats,
      monthlySprayedArea,
    };
  }

  /**
   * @description Get yesterday's statistics
   * @param {any[]} baseWhereConditions - Base where conditions
   * @param {string[]} customerIds - Customer IDs to filter by
   * @param {string[]} farmIds - Farm IDs to filter by
   * @param {string[]} contractIds - Contract IDs to filter by (via serviceOrders)
   * @returns {Promise<YesterdayStats>} Yesterday statistics
   */
  private async getYesterdayStats(
    baseWhereConditions: unknown[],
    customerIds?: string[],
    farmIds?: string[],
    contractIds?: string[]
  ): Promise<YesterdayStats> {
    // Get current date/time in Brazil timezone (GMT-3)
    const nowBrazil = getBrazilNow();
    
    // Get today's date components in Brazil timezone
    const todayYear = nowBrazil.getUTCFullYear();
    const todayMonth = nowBrazil.getUTCMonth();
    const todayDay = nowBrazil.getUTCDate();
    
    // Calculate yesterday in Brazil timezone
    const yesterdayBrazil = new Date(Date.UTC(todayYear, todayMonth, todayDay, 0, 0, 0, 0));
    yesterdayBrazil.setUTCDate(yesterdayBrazil.getUTCDate() - 1);
    
    // Get yesterday's date string (YYYY-MM-DD format)
    // We use Brazil timezone to determine which calendar day is "yesterday"
    const yesterdayDateStr = `${yesterdayBrazil.getUTCFullYear()}-${String(yesterdayBrazil.getUTCMonth() + 1).padStart(2, '0')}-${String(yesterdayBrazil.getUTCDate()).padStart(2, '0')}`;
    
    // Debug: Log the date being used
    app.log.info(
      `[ApplicationService] - Yesterday stats: filtering for UTC date = ${yesterdayDateStr}`
    );

    // IMPORTANT: Use DATE(applications.date) directly WITHOUT timezone conversion
    // This is because many entries are stored with midnight UTC (00:00:00 UTC) 
    // which represents the user's intended date. When converted to Brazil time,
    // midnight UTC becomes 21:00 of the previous day, incorrectly excluding these entries.
    // 
    // Example: User enters date "2025-12-08" -> stored as "2025-12-08 00:00:00 UTC"
    // With Brazil conversion: shows as "2025-12-07 21:00:00 Brazil" (WRONG day)
    // Without conversion: DATE = "2025-12-08" (CORRECT day)
    const whereConditions = [
      isNull(applications.deletedAt),
      // Compare the UTC date directly - this includes entries stored at midnight UTC
      sql`DATE(${applications.date}) = ${sql.raw(`'${yesterdayDateStr}'`)}::date`,
    ];

    // Add contract filter (requires join with serviceOrders)
    if (contractIds && contractIds.length > 0) {
      whereConditions.push(inArray(serviceOrders.contractId, contractIds));
    }

    // Add customer filter (requires join)
    if (customerIds && customerIds.length > 0) {
      whereConditions.push(inArray(customers.id, customerIds));
    }

    // Add farm filter (no join needed, farmId is directly on applications)
    if (farmIds && farmIds.length > 0) {
      whereConditions.push(inArray(applications.farmId, farmIds));
    }

    // Determine if we need joins based on filters
    const needsServiceOrdersJoin = contractIds && contractIds.length > 0;
    const needsCustomerJoin = customerIds && customerIds.length > 0;

    // Build query with aggregation in SQL to avoid duplication issues
    // Use SUM() and COUNT(DISTINCT) directly in SQL instead of reduce() in JS
    let result;
    
    if (needsServiceOrdersJoin && needsCustomerJoin) {
      // Need both serviceOrders and customer joins
      result = await db
        .select({
          totalArea: sum(applications.hectares),
          uniqueDrones: sql<number>`COUNT(DISTINCT ${applications.droneId})`,
        })
        .from(applications)
        .leftJoin(serviceOrders, eq(applications.serviceOrderId, serviceOrders.id))
        .leftJoin(farms, eq(applications.farmId, farms.id))
        .leftJoin(customers, eq(farms.customerId, customers.id))
        .where(and(...whereConditions));
    } else if (needsServiceOrdersJoin) {
      // Only need serviceOrders join for contract filter
      result = await db
        .select({
          totalArea: sum(applications.hectares),
          uniqueDrones: sql<number>`COUNT(DISTINCT ${applications.droneId})`,
        })
        .from(applications)
        .leftJoin(serviceOrders, eq(applications.serviceOrderId, serviceOrders.id))
        .where(and(...whereConditions));
    } else if (needsCustomerJoin) {
      // Only need customer join
      result = await db
        .select({
          totalArea: sum(applications.hectares),
          uniqueDrones: sql<number>`COUNT(DISTINCT ${applications.droneId})`,
        })
        .from(applications)
        .leftJoin(farms, eq(applications.farmId, farms.id))
        .leftJoin(customers, eq(farms.customerId, customers.id))
        .where(and(...whereConditions));
    } else {
      // No joins needed, query directly from applications table
      result = await db
        .select({
          totalArea: sum(applications.hectares),
          uniqueDrones: sql<number>`COUNT(DISTINCT ${applications.droneId})`,
        })
        .from(applications)
        .where(and(...whereConditions));
    }

    const totalArea = Number(result[0]?.totalArea || 0);
    const dronesCount = Number(result[0]?.uniqueDrones || 0);
    const areaPerDrone = dronesCount > 0 ? totalArea / dronesCount : 0;

    // Debug logs
    app.log.info(
      `[ApplicationService] - Yesterday stats result: date=${yesterdayDateStr}, totalArea=${totalArea.toFixed(2)}, dronesCount=${dronesCount}, areaPerDrone=${areaPerDrone.toFixed(2)}`
    );

    return {
      totalArea,
      dronesCount,
      areaPerDrone,
    };
  }

  /**
   * @description Get monthly sprayed area for chart
   * @param {any[]} baseWhereConditions - Base where conditions (already includes date, customer, farm, and contract filters)
   * @param {string[]} customerIds - Customer IDs to filter by
   * @param {string[]} farmIds - Farm IDs to filter by
   * @param {Date} startDateUTC - Start date in UTC for filtering
   * @param {string[]} contractIds - Contract IDs to filter by (determines if serviceOrders join is needed)
   * @returns {Promise<MonthlySprayedArea[]>} Monthly sprayed area data
   */
  private async getMonthlySprayedArea(
    baseWhereConditions: unknown[],
    customerIds?: string[],
    farmIds?: string[],
    startDateUTC?: Date,
    contractIds?: string[]
  ): Promise<MonthlySprayedArea[]> {
    // Use the provided where conditions which already include all filters (date, customer, farm, contract)
    // Convert unknown[] to proper SQL conditions
    const whereConditions = baseWhereConditions as ReturnType<typeof and>[];

    // Get monthly aggregated data using Brazil timezone (GMT-3)
    // The AT TIME ZONE converts the UTC timestamp to Brazil local time before extracting the month
    // Include serviceOrders join to support filtering by contractId
    const monthlyDataResult = await db
      .select({
        yearMonth: sql<string>`TO_CHAR(${applications.date} AT TIME ZONE 'UTC' AT TIME ZONE '${sql.raw(BRAZIL_TIMEZONE)}', 'YYYY-MM')`,
        hectares: sum(applications.hectares),
      })
      .from(applications)
      .leftJoin(serviceOrders, eq(applications.serviceOrderId, serviceOrders.id))
      .leftJoin(plots, eq(applications.plotId, plots.id))
      .leftJoin(farms, eq(applications.farmId, farms.id))
      .leftJoin(customers, eq(farms.customerId, customers.id))
      .where(baseWhereConditions.length > 0 ? and(...(baseWhereConditions as Parameters<typeof and>[0][])) : isNull(applications.deletedAt))
      .groupBy(sql`TO_CHAR(${applications.date} AT TIME ZONE 'UTC' AT TIME ZONE '${sql.raw(BRAZIL_TIMEZONE)}', 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${applications.date} AT TIME ZONE 'UTC' AT TIME ZONE '${sql.raw(BRAZIL_TIMEZONE)}', 'YYYY-MM')`);

    // Format month names in Portuguese
    const monthNames: Record<string, string> = {
      '01': 'jan.',
      '02': 'fev.',
      '03': 'mar.',
      '04': 'abr.',
      '05': 'mai.',
      '06': 'jun.',
      '07': 'jul.',
      '08': 'ago.',
      '09': 'set.',
      '10': 'out.',
      '11': 'nov.',
      '12': 'dez.',
    };

    return monthlyDataResult.map(item => {
      const [year, month] = item.yearMonth.split('-');
      const monthName = monthNames[month] || month;
      
      return {
        month: `${monthName} de ${year}`,
        yearMonth: item.yearMonth,
        hectares: Number(item.hectares || 0),
      };
    });
  }
} 