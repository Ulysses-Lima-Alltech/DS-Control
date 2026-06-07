import { db } from '@infra/database';
import {
  applications,
  customers,
  plots,
  serviceOrderFarms,
  serviceOrderPilots,
  serviceOrderPlots,
  serviceOrders
} from '@infra/database/schema';
import type { CreateServiceOrderDTO } from '@modules/service-order/dto/create-service-order';
import type { UpdateServiceOrderStatusDTO } from '@modules/service-order/dto/update-service-order-status.dto';
import type { UpdateServiceOrderDTO } from '@modules/service-order/dto/update-service-order.dto';
import { and, asc, count, desc, eq, exists, gte, ilike, inArray, isNull, lt, not, or, sql } from 'drizzle-orm';
import { ServiceOrder, ServiceOrderBy, ServiceOrderType, ServiceOrderWithDetails } from './service-order.types';

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

type ServiceOrderProgressMetrics = Pick<
  ServiceOrderWithDetails,
  | 'plannedHectares'
  | 'totalAppliedHectares'
  | 'progressPercent'
  | 'applicationsCount'
  | 'plotsWithApplications'
  | 'totalPlots'
  | 'myAppliedHectares'
  | 'myApplicationsCount'
>;

export class ServiceOrderRepository {
  private getEmptyProgressMetrics(): ServiceOrderProgressMetrics {
    return {
      plannedHectares: 0,
      totalAppliedHectares: 0,
      progressPercent: 0,
      applicationsCount: 0,
      plotsWithApplications: 0,
      totalPlots: 0,
      myAppliedHectares: 0,
      myApplicationsCount: 0,
    };
  }

  private calculateProgressPercent(totalAppliedHectares: number, plannedHectares: number): number {
    if (plannedHectares <= 0) return 0;
    return Number(((totalAppliedHectares / plannedHectares) * 100).toFixed(2));
  }

  private async getProgressMetricsByServiceOrderIds(
    serviceOrderIds: string[],
    currentPilotId?: string,
  ): Promise<Map<string, ServiceOrderProgressMetrics>> {
    const uniqueServiceOrderIds = Array.from(new Set(serviceOrderIds.filter(Boolean)));
    const metricsByServiceOrderId = new Map<string, ServiceOrderProgressMetrics>();

    uniqueServiceOrderIds.forEach((serviceOrderId) => {
      metricsByServiceOrderId.set(serviceOrderId, this.getEmptyProgressMetrics());
    });

    if (uniqueServiceOrderIds.length === 0) {
      return metricsByServiceOrderId;
    }

    const [plannedRows, appliedRows, myAppliedRows] = await Promise.all([
      db
        .select({
          serviceOrderId: serviceOrderPlots.serviceOrderId,
          plannedHectares: sql<string>`COALESCE(SUM(${plots.hectare}), 0)`,
          totalPlots: sql<number>`COUNT(DISTINCT ${plots.id})`,
        })
        .from(serviceOrderPlots)
        .innerJoin(plots, eq(serviceOrderPlots.plotId, plots.id))
        .where(
          and(
            inArray(serviceOrderPlots.serviceOrderId, uniqueServiceOrderIds),
            isNull(plots.deletedAt),
          ),
        )
        .groupBy(serviceOrderPlots.serviceOrderId),
      db
        .select({
          serviceOrderId: applications.serviceOrderId,
          totalAppliedHectares: sql<string>`COALESCE(SUM(${applications.hectares}), 0)`,
          applicationsCount: sql<number>`COUNT(${applications.id})`,
          plotsWithApplications: sql<number>`COUNT(DISTINCT ${applications.plotId})`,
        })
        .from(applications)
        .where(
          and(
            inArray(applications.serviceOrderId, uniqueServiceOrderIds),
            isNull(applications.deletedAt),
          ),
        )
        .groupBy(applications.serviceOrderId),
      currentPilotId
        ? db
            .select({
              serviceOrderId: applications.serviceOrderId,
              myAppliedHectares: sql<string>`COALESCE(SUM(${applications.hectares}), 0)`,
              myApplicationsCount: sql<number>`COUNT(${applications.id})`,
            })
            .from(applications)
            .where(
              and(
                inArray(applications.serviceOrderId, uniqueServiceOrderIds),
                eq(applications.pilotId, currentPilotId),
                isNull(applications.deletedAt),
              ),
            )
            .groupBy(applications.serviceOrderId)
        : Promise.resolve([]),
    ]);

    plannedRows.forEach((row) => {
      const current = metricsByServiceOrderId.get(row.serviceOrderId) ?? this.getEmptyProgressMetrics();
      current.plannedHectares = Number(row.plannedHectares || 0);
      current.totalPlots = Number(row.totalPlots || 0);
      metricsByServiceOrderId.set(row.serviceOrderId, current);
    });

    appliedRows.forEach((row) => {
      if (!row.serviceOrderId) return;
      const current = metricsByServiceOrderId.get(row.serviceOrderId) ?? this.getEmptyProgressMetrics();
      current.totalAppliedHectares = Number(row.totalAppliedHectares || 0);
      current.applicationsCount = Number(row.applicationsCount || 0);
      current.plotsWithApplications = Number(row.plotsWithApplications || 0);
      metricsByServiceOrderId.set(row.serviceOrderId, current);
    });

    myAppliedRows.forEach((row) => {
      if (!row.serviceOrderId) return;
      const current = metricsByServiceOrderId.get(row.serviceOrderId) ?? this.getEmptyProgressMetrics();
      current.myAppliedHectares = Number(row.myAppliedHectares || 0);
      current.myApplicationsCount = Number(row.myApplicationsCount || 0);
      metricsByServiceOrderId.set(row.serviceOrderId, current);
    });

    metricsByServiceOrderId.forEach((metrics) => {
      metrics.progressPercent = this.calculateProgressPercent(
        metrics.totalAppliedHectares,
        metrics.plannedHectares,
      );
    });

    return metricsByServiceOrderId;
  }

  private async attachProgressMetrics<T extends { id: string }>(
    serviceOrdersList: T[],
    currentPilotId?: string,
  ): Promise<Array<T & ServiceOrderProgressMetrics>> {
    const metricsByServiceOrderId = await this.getProgressMetricsByServiceOrderIds(
      serviceOrdersList.map((serviceOrder) => serviceOrder.id),
      currentPilotId,
    );

    return serviceOrdersList.map((serviceOrder) => ({
      ...serviceOrder,
      ...(metricsByServiceOrderId.get(serviceOrder.id) ?? this.getEmptyProgressMetrics()),
    }));
  }

  private filterActivePlots<T extends { deletedAt?: Date | null }>(items?: T[] | null): T[] {
    if (!items || items.length === 0) return [];
    return items.filter((item) => !item.deletedAt);
  }

  private mapFarmsWithActivePlots(serviceOrderFarms?: Array<Record<string, unknown>>) {
    if (!serviceOrderFarms || serviceOrderFarms.length === 0) {
      return [];
    }

    return serviceOrderFarms
      .map((sof) => {
        if (!('farm' in sof)) return null;
        return (sof as { farm?: Record<string, unknown> | null }).farm ?? null;
      })
      .filter(Boolean)
      .map((farm) => ({
        ...farm,
        plots: this.filterActivePlots(
          (farm as { plots?: Array<{ deletedAt?: Date | null }> }).plots,
        ),
      }));
  }

  private mapActiveServiceOrderPlots(serviceOrderPlots?: Array<Record<string, unknown>>) {
    if (!serviceOrderPlots || serviceOrderPlots.length === 0) {
      return [];
    }

    return serviceOrderPlots
      .map((sop) => {
        if (!('plot' in sop)) return null;
        return (sop as { plot?: { deletedAt?: Date | null } | null }).plot ?? null;
      })
      .filter(Boolean)
      .filter((plot) => !(plot as { deletedAt?: Date | null }).deletedAt);
  }
  /**
   * Creates a new service order and associates it with farms, pilots and plots.
   * @param {CreateServiceOrderDTO} dto - The data transfer object containing service order details.
   * @returns {Promise<void>} Resolves when the service order is created successfully.
   * @throws {Error} Throws an error if the service order creation fails.
   */
  public async createServiceOrder(dto: CreateServiceOrderDTO): Promise<void> {
    await db.transaction(async (tx) => {
      const [serviceOrder] = await tx
        .insert(serviceOrders)
        .values({
          contractId: dto.contractId,
          customerId: dto.customerId,
          plannedDate: new Date(dto.plannedDate),
          observation: dto.observation,
          status: 'open',
        })
        .returning();

      if (!serviceOrder) {
        throw new Error('Failed to create service order');
      }

      // Insert service order farms associations
      await tx.insert(serviceOrderFarms).values(
        dto.farmsIds.map((farmId) => ({
          serviceOrderId: serviceOrder.id,
          farmId,
        })),
      );

      await tx.insert(serviceOrderPilots).values(
        dto.pilotsIds.map((pilotId) => ({
          serviceOrderId: serviceOrder.id,
          pilotId,
        })),
      );

      await tx.insert(serviceOrderPlots).values(
        dto.plotsIds.map((plotId) => ({
          serviceOrderId: serviceOrder.id,
          plotId,
        })),
      );
    });
  }

  /**
   * Retrieves a service order by its ID with related data.
   * @param {string} serviceOrderId - The service order ID.
   * @param {boolean} includePlots - Whether to include plots.
   * @param {boolean} includePilots - Whether to include pilots.
   * @param {boolean} includeFarms - Whether to include farms.
   * @param {boolean} includeContracts - Whether to include contracts.
   * @param {boolean} includeCustomers - Whether to include customers.
   * @param {boolean} includeGeoJson - Whether to include geojson.
   * @returns {Promise<ServiceOrderWithDetails | null>} The service order with related data.
   */
  public async getServiceOrderById(
    serviceOrderId: string,
    includePlots: boolean = true,
    includePilots: boolean = true,
    includeFarms: boolean = true,
    includeContracts: boolean = true,
    includeCustomers: boolean = true,
    includeGeoJson: boolean = false,
    currentPilotId?: string,
  ): Promise<ServiceOrderWithDetails | null> {
    const serviceOrder = await db.query.serviceOrders.findFirst({
      where: eq(serviceOrders.id, serviceOrderId),
      with: {
        contract: includeContracts ? true : undefined, 
        customer: includeCustomers ? true : undefined,
        serviceOrderFarms: includeFarms ? {
          with: {
            farm: includeFarms ? {
              with: {
                plots: {
                  columns: {
                  id: true,
                  name: true,
                  hectare: true,
                  geoJson: includeGeoJson ? true : undefined,
                  farmId: true,
                  externalId: true,
                  createdAt: true,
                  updatedAt: true,
                  deletedAt: true,
                  customerId: true,
                  }
                }
              } 
            } : undefined,
          }
        } : undefined,
        serviceOrderPilots: includePilots ? {
          with: {
            pilot: true,
          }
        } : undefined,
        serviceOrderPlots: includePlots ? {
          with: {
            plot: {
              columns: {
                id: true,
                name: true,
                hectare: true,
                geoJson: includeGeoJson ? true : undefined,
                farmId: true,
                externalId: true,
                createdAt: true,
                updatedAt: true,
                deletedAt: true,
                customerId: true,
              },
            },
          },
        } : undefined,
      }
    });

    if (!serviceOrder) {
      return null;
    }

    const mappedServiceOrder = {
      ...serviceOrder,
      contract: serviceOrder.contract ?? null,
      customer: serviceOrder.customer ?? null,
      farms: this.mapFarmsWithActivePlots(serviceOrder.serviceOrderFarms),
      pilots: serviceOrder.serviceOrderPilots?.map(sop => 'pilot' in sop ? sop.pilot : null).filter(Boolean) || [],
      plots: this.mapActiveServiceOrderPlots(serviceOrder.serviceOrderPlots),
    };

    const [serviceOrderWithProgress] = await this.attachProgressMetrics(
      [mappedServiceOrder],
      currentPilotId,
    );

    return serviceOrderWithProgress as unknown as ServiceOrderWithDetails;
  }

  /**
   * Retrieves all service orders with optional filters and includes.
   * @param {number} page - The page number.
   * @param {number} limit - The number of items per page.
   * @param {string} search - Optional search term.
   * @param {object} filters - Optional filters for status, farmId, pilotId, customerId.
   * @param {boolean} includePlots - Whether to include plots.
   * @param {boolean} includePilots - Whether to include pilots.
   * @param {boolean} includeFarms - Whether to include farms.
   * @param {boolean} includeContracts - Whether to include contracts.
   * @param {boolean} includeCustomers - Whether to include customers.
   * @param {boolean} includeGeoJson - Whether to include geojson.
   * @returns {Promise<ServiceOrderWithDetails[]>} The list of service orders.
   */
  public async getAllServiceOrders(
    page: number,
    limit: number,
    search?: string,
    filters?: {
      status?: 'open' | 'completed' | 'cancelled';
      farmId?: string;
      pilotId?: string;
      customerId?: string;
      invalidApplication?: boolean;
      startDate?: Date;
      endDate?: Date;
    },
    includePlots: boolean = false,
    includePilots: boolean = false,
    includeFarms: boolean = false,
    includeContracts: boolean = false,
    includeCustomers: boolean = false,
    includeGeoJson: boolean = false,
    orderBy?: ServiceOrderBy,
    orderType?: ServiceOrderType,
    currentPilotId?: string,
  ): Promise<ServiceOrderWithDetails[]> {
    // Build where conditions for the main query
    const whereConditions = [];

    // Search conditions
    if (search) {
      whereConditions.push(
        or(
          ilike(serviceOrders.observation, `%${search}%`),
          ilike(sql`${serviceOrders.number}::text`, `%${search}%`),
        ),
      );
    }

    // Filter conditions
    if (filters?.status) {
      whereConditions.push(eq(serviceOrders.status, filters.status));
    }

    if (filters?.customerId) {
      whereConditions.push(eq(serviceOrders.customerId, filters.customerId));
    }

    // Complex filters using exists
    if (filters?.farmId) {
      whereConditions.push(
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

    if(filters?.invalidApplication) {
      whereConditions.push(
        inArray(
          serviceOrders.id,
          db
            .select({ serviceOrderId: applications.serviceOrderId})
            .from(applications)
            .where(
              and(
                isNull(applications.plotId),
                // Exclude applications from special "avulso" service orders
                not(inArray(applications.serviceOrderId, EXCLUDED_SERVICE_ORDER_IDS))
              )
            )
        ),
      );
      // Also exclude the special service orders from results
      whereConditions.push(not(inArray(serviceOrders.id, EXCLUDED_SERVICE_ORDER_IDS)));
    }

    if(filters?.startDate && filters?.endDate) {
      const adjustEndDate = new Date(filters.endDate);
      adjustEndDate.setDate(adjustEndDate.getDate() + 1);

      whereConditions.push(and(
        gte(serviceOrders.plannedDate, filters.startDate),
        lt(serviceOrders.plannedDate, adjustEndDate)
      ));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    // Determine order by expression
    let orderByExpression;
    let needsCustomerJoinForOrder = false;

    switch (orderBy) {
      case ServiceOrderBy.NUMBER:
        orderByExpression = orderType === ServiceOrderType.ASC ? asc(serviceOrders.number) : desc(serviceOrders.number);
        break;
      case ServiceOrderBy.CUSTOMER:
        if(includeCustomers) {
          orderByExpression = orderType === ServiceOrderType.ASC ? asc(customers.name) : desc(customers.name);
          needsCustomerJoinForOrder = true;
          break;
        }
        // Fall through to default if customers not included
      case ServiceOrderBy.PLANNED_DATE:
        orderByExpression = orderType === ServiceOrderType.ASC ? asc(serviceOrders.plannedDate) : desc(serviceOrders.plannedDate);
        break;
      default:
        orderByExpression = desc(serviceOrders.plannedDate); 
    }

    // Step 1: Get filtered and paginated service order IDs
    // This is much faster than the previous approach with complex JSON aggregation
    let idsQuery = db
      .select({ 
        id: serviceOrders.id,
        ...(needsCustomerJoinForOrder ? { customerName: customers.name } : {})
      })
      .from(serviceOrders);

    // Only join customers if needed for ordering
    if (needsCustomerJoinForOrder) {
      idsQuery = idsQuery.leftJoin(customers, eq(serviceOrders.customerId, customers.id)) as any;
    }

    idsQuery = idsQuery
      .where(whereClause)
      .orderBy(orderByExpression)
      .offset((page - 1) * limit)
      .limit(limit) as any;

    const serviceOrderIds = await idsQuery;

    if (serviceOrderIds.length === 0) {
      return [];
    }

    // Step 2: Fetch full details for these service orders using the relational query API
    // This is much more efficient than manual JSON aggregation with subqueries
    const serviceOrdersList = await db.query.serviceOrders.findMany({
      where: inArray(
        serviceOrders.id,
        serviceOrderIds.map(so => so.id),
      ),
      with: {
        contract: includeContracts ? true : undefined,
        customer: includeCustomers ? true : undefined,
        serviceOrderFarms: includeFarms ? {
          with: {
            farm: true,
          }
        } : undefined,
        serviceOrderPilots: includePilots ? {
          with: {
            pilot: true,
          }
        } : undefined,
        serviceOrderPlots: includePlots ? {
          with: {
            plot: {
              columns: {
                id: true,
                name: true,
                hectare: true,
                geoJson: includeGeoJson ? true : undefined,
                farmId: true,
                externalId: true,
                createdAt: true,
                updatedAt: true,
                deletedAt: true,
                customerId: true,
              },
            },
          },
        } : undefined,
      }
    });

    // Create a map for quick lookup and preserve the original order
    const serviceOrderMap = new Map(
      serviceOrdersList.map(so => [so.id, so])
    );

    // Return in the same order as the IDs query (respecting pagination and sorting)
    const mappedServiceOrders = serviceOrderIds.map(({ id }) => {
      const serviceOrder = serviceOrderMap.get(id);
      if (!serviceOrder) {
        throw new Error(`Service order ${id} not found in details query`);
      }

      return {
        ...serviceOrder,
        contract: serviceOrder.contract ?? null,
        customer: serviceOrder.customer ?? null,
        farms: this.mapFarmsWithActivePlots(serviceOrder.serviceOrderFarms),
        pilots: serviceOrder.serviceOrderPilots?.map(sop => 'pilot' in sop ? sop.pilot : null).filter(Boolean) || [],
        plots: this.mapActiveServiceOrderPlots(serviceOrder.serviceOrderPlots),
      };
    });

    return await this.attachProgressMetrics(
      mappedServiceOrders,
      currentPilotId,
    ) as unknown as ServiceOrderWithDetails[];
  }

  /**
   * Updates a service order and its associated farms, pilots and plots.
   * @param {string} serviceOrderId - The service order ID.
   * @param {UpdateServiceOrderDTO} dto - The update data.
   * @returns {Promise<ServiceOrder>} The updated service order.
   */
  public async updateServiceOrder(
    serviceOrderId: string,
    dto: UpdateServiceOrderDTO,
  ): Promise<ServiceOrderWithDetails> {
    const os = await db.transaction(async (tx) => {
      // Update the main service order
      const updateData: Partial<typeof serviceOrders.$inferInsert> = {};
      if (dto.contractId) updateData.contractId = dto.contractId;
      if (dto.observation !== undefined) updateData.observation = dto.observation;
      if (dto.plannedDate) updateData.plannedDate = new Date(dto.plannedDate);
      updateData.updatedAt = new Date();

      const [updatedServiceOrder] = await tx
        .update(serviceOrders)
        .set(updateData)
        .where(eq(serviceOrders.id, serviceOrderId))
        .returning();

      if (!updatedServiceOrder) {
        throw new Error('Failed to update service order');
      }

      // Update farms if provided
      if (dto.farmsIds) {
        // Delete existing farms
        await tx
          .delete(serviceOrderFarms)
          .where(eq(serviceOrderFarms.serviceOrderId, serviceOrderId));

        // Insert new farms
        if (dto.farmsIds.length > 0) {
          await tx.insert(serviceOrderFarms).values(
            dto.farmsIds.map((farmId) => ({
              serviceOrderId,
              farmId,
            })),
          );
        }
      }

      // Update pilots if provided
      if (dto.pilotsIds) {
        // Delete existing pilots
        await tx
          .delete(serviceOrderPilots)
          .where(eq(serviceOrderPilots.serviceOrderId, serviceOrderId));

        // Insert new pilots
        if (dto.pilotsIds.length > 0) {
          await tx.insert(serviceOrderPilots).values(
            dto.pilotsIds.map((pilotId) => ({
              serviceOrderId,
              pilotId,
            })),
          );
        }
      }

      // Update plots if provided
      if (dto.plotsIds) {
        // Delete existing plots
        await tx
          .delete(serviceOrderPlots)
          .where(eq(serviceOrderPlots.serviceOrderId, serviceOrderId));

        // Insert new plots
        if (dto.plotsIds.length > 0) {
          await tx.insert(serviceOrderPlots).values(
            dto.plotsIds.map((plotId) => ({
              serviceOrderId,
              plotId,
            })),
          );
        }
      }

      return updatedServiceOrder;
    });

    if (!os) {
      throw new Error('Failed to update service order');
    }

    return this.getServiceOrderById(os.id) as unknown as ServiceOrderWithDetails;
  }

  /**
   * Updates the status of a service order.
   * @param {string} serviceOrderId - The service order ID.
   * @param {UpdateServiceOrderStatusDTO} dto - The status update data.
   * @returns {Promise<ServiceOrder>} The updated service order.
   */
  public async updateServiceOrderStatus(
    serviceOrderId: string,
    dto: UpdateServiceOrderStatusDTO,
  ): Promise<ServiceOrder> {
    const [updatedServiceOrder] = await db
      .update(serviceOrders)
      .set({
        status: dto.status,
        updatedAt: new Date(),
      })
      .where(eq(serviceOrders.id, serviceOrderId))
      .returning();

    return this.getServiceOrderById(updatedServiceOrder.id) as unknown as ServiceOrderWithDetails;
  }

  /**
   * Counts total service orders with optional search and filters.
   * @param {string} search - Optional search term to filter by number, observation, or customer name.
   * @param {object} filters - Optional filters for status, farmId, pilotId, customerId.
   * @returns {Promise<number>} The count of service orders.
   */
  public async countServiceOrders(
    search?: string,
    filters?: {
      status?: 'open' | 'completed' | 'cancelled';
      farmId?: string;
      pilotId?: string;
      customerId?: string;
      startDate: Date | undefined;
      endDate: Date | undefined;
    },
  ): Promise<number> {
    // Build where conditions
    const whereConditions = [];

    // Search conditions
    if (search) {
      whereConditions.push(
        or(
          ilike(serviceOrders.observation, `%${search}%`),
          ilike(customers.name, `%${search}%`),
          // Convert number to string for search
          ilike(sql`${serviceOrders.number}::text`, `%${search}%`),
        ),
      );
    }

    // Filter conditions
    if (filters?.status) {
      whereConditions.push(eq(serviceOrders.status, filters.status));
    }

    if (filters?.customerId) {
      whereConditions.push(eq(serviceOrders.customerId, filters.customerId));
    }

    if (filters?.farmId) {
      whereConditions.push(
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

    if (filters?.startDate && filters?.endDate) {
      const adjustEndDate = new Date(filters.endDate);
      adjustEndDate.setDate(adjustEndDate.getDate() + 1);

      whereConditions.push(and(
        gte(serviceOrders.plannedDate, filters.startDate),
        lt(serviceOrders.plannedDate, adjustEndDate)
      ))
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    const [result] = await db
      .select({ count: count() })
      .from(serviceOrders)
      .leftJoin(customers, eq(serviceOrders.customerId, customers.id))
      .where(whereClause);

    return result.count;
  }


  /**
   * Retrieves all open service orders for a specific pilot.
   * @param {string} pilotId - The pilot ID.
   * @param {number} page - The page number.
   * @param {number} limit - The number of items per page.
   * @param {boolean} includePlots - Whether to include plots.
   * @param {boolean} includePilots - Whether to include pilots.
   * @param {boolean} includeFarms - Whether to include farms.
   * @param {boolean} includeContracts - Whether to include contracts.
   * @param {boolean} includeCustomers - Whether to include customers.
   * @param {boolean} includeGeoJson - Whether to include geojson.
   * @returns {Promise<ServiceOrderWithDetails[]>} The list of open service orders for the pilot.
   */
  public async getOpenServiceOrdersByPilotId(
    pilotId: string,
    page: number,
    limit: number,
    includePlots: boolean = true,
    includePilots: boolean = true,
    includeFarms: boolean = true,
    includeContracts: boolean = true,
    includeCustomers: boolean = true,
    includeGeoJson: boolean = false,
  ): Promise<ServiceOrderWithDetails[]> {
    // First get the service order IDs that are associated with this pilot and are open
    const serviceOrderIds = await db
      .select({ serviceOrderId: serviceOrderPilots.serviceOrderId })
      .from(serviceOrderPilots)
      .innerJoin(serviceOrders, eq(serviceOrderPilots.serviceOrderId, serviceOrders.id))
      .where(and(eq(serviceOrderPilots.pilotId, pilotId), eq(serviceOrders.status, 'open')))
      .offset((page - 1) * limit)
      .limit(limit);

    if (serviceOrderIds.length === 0) {
      return [];
    }

    // Get the full service order details for these IDs
    const serviceOrdersList = await db.query.serviceOrders.findMany({
      where: inArray(
        serviceOrders.id,
        serviceOrderIds.map((so: { serviceOrderId: string }) => so.serviceOrderId),
      ),
      with: {
        contract: includeContracts ? {
          with: {
            customer: true,
          },
        } : undefined, 
        customer: includeCustomers ? true : undefined,
        serviceOrderFarms: includeFarms ? {
          with: {
            farm: true,
          }
        } : undefined,
        serviceOrderPilots: includePilots ? {
          with: {
            pilot: true,
          }
        } : undefined,
        serviceOrderPlots: includePlots ? {
          with: {
            plot: {
              columns: {
                id: true,
                name: true,
                hectare: true,
                geoJson: includeGeoJson ? true : undefined,
                farmId: true,
                externalId: true,
                createdAt: true,
                updatedAt: true,
                deletedAt: true,
                customerId: true,
              },
            },
          },
        } : undefined,
      }
    });

    const mappedServiceOrders = serviceOrdersList.map(serviceOrder => ({
      ...serviceOrder,
      contract: serviceOrder.contract ?? null,
      customer: serviceOrder.customer ?? null,
      farms: this.mapFarmsWithActivePlots(serviceOrder.serviceOrderFarms),
      pilots: serviceOrder.serviceOrderPilots?.map(sop => 'pilot' in sop ? sop.pilot : null).filter(Boolean) || [],
      plots: this.mapActiveServiceOrderPlots(serviceOrder.serviceOrderPlots),
    }));

    return await this.attachProgressMetrics(
      mappedServiceOrders,
      pilotId,
    ) as unknown as ServiceOrderWithDetails[];
  }

  /**
   * Counts open service orders for a specific pilot.
   * @param {string} pilotId - The pilot ID.
   * @returns {Promise<number>} The count of open service orders for the pilot.
   */
  public async countOpenServiceOrdersByPilotId(pilotId: string): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(serviceOrderPilots)
      .innerJoin(serviceOrders, eq(serviceOrderPilots.serviceOrderId, serviceOrders.id))
      .where(and(eq(serviceOrderPilots.pilotId, pilotId), eq(serviceOrders.status, 'open')));
    return result.count;
  }
}
