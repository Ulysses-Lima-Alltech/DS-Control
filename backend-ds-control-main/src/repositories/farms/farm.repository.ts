import { db } from '@infra/database';
import { customers, farms, plots, serviceOrderFarms, serviceOrders } from '@infra/database/schema';
import { and, asc, count, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';
import { CreateFarm, Farm, FarmOrderBy, FarmOrderType, FarmWithPlots } from './farm.types';

export class FarmRepository {
  /**
   * @description Create a new farm
   * @param {CreateFarm} data - The farm data
   * @returns {Promise<Farm>} The created farm
   */
  public async createFarm({ name, customerId }: CreateFarm): Promise<Farm> {
    const [farm] = await db
      .insert(farms)
      .values({
        name,
        customerId,
      })
      .returning();

    if (!farm) {
      throw new Error('Failed to create farm');
    }

    return this.formatFarm(farm)!;
  }

  /**
   * @description Get a farm by ID
   * @param {string} id - The farm's ID
   * @returns {Promise<Farm | null>} The farm
   */
  public async getFarmById(id: string): Promise<Farm | null> {
    const farm = await db.query.farms.findFirst({
      where: and(eq(farms.id, id), isNull(farms.deletedAt)),
    });

    return this.formatFarm(farm);
  }

  /**
   * @description Get a farm by ID with related plots
   * @param {string} id - The farm's ID
   * @returns {Promise<FarmWithPlots | null>} The farm with plots
   */
  public async getFarmWithPlotsById(
    id: string, 
    includePlots: boolean = false,
    includeGeoJson: boolean = false,
    includeCustomer: boolean = false,
  ): Promise<FarmWithPlots | null> {
    const farm = await db.query.farms.findFirst({
      where: and(eq(farms.id, id), isNull(farms.deletedAt)),
      with: {
        plots: includePlots ? {
          columns: {
            id: true,
            name: true,
            farmId: true,
            customerId: true,
            geoJson: includeGeoJson,
            hectare: true,
            deletedAt: true,
            createdAt: true, 
            updatedAt: true,
            externalId: true,
          },
        } : undefined,
        customer: includeCustomer ? {
          columns: {
            id: true,
            name: true,
          }
        } : undefined,
      },
    });

    if (!farm) return null;

    return this.formatFarmWithPlots(farm);
  }

  /**
   * @description Get all farms
   * @param {string} farmId - The farm's ID
   * @param {string} customerId - The customer's ID
   * @returns {Promise<FarmWithPlots[]>} The farms list
   */
  public async getAllFarms(
    farmId?: string, 
    customerId?: string,
    includePlots?: boolean,
    includeGeoJson?: boolean,
    includeCustomer?: boolean,
    orderBy?: FarmOrderBy,
    orderType?: FarmOrderType,
  ): Promise<FarmWithPlots[]> {
    const where = [isNull(farms.deletedAt)];

    if(farmId) {
      where.push(eq(farms.id, farmId))
    }

    if(customerId) {
      where.push(eq(farms.customerId, customerId))
    }

    let orderByExpression;

    switch (orderBy) {
      case FarmOrderBy.NAME:
        orderByExpression = orderType === FarmOrderType.ASC ? asc(farms.name) : desc(farms.name);
        break;
      case FarmOrderBy.CREATEDAT:
        orderByExpression = orderType === FarmOrderType.ASC ? asc(farms.createdAt) : desc(farms.createdAt);
        break;
      case FarmOrderBy.CUSTOMER:
        if(includeCustomer) {
          orderByExpression = orderType === FarmOrderType.ASC ? asc(customers.name) : desc(customers.name);
          break;
        }
      default:
        orderByExpression = desc(farms.createdAt);
    }

    
    // Complex query with all needed joins for search and filters
    const baseQuery = db
      .select({
        farm: farms,
        plots: includePlots ? sql`json_agg(               
          jsonb_build_object(
            'id', ${plots.id},
            'name', ${plots.name},
            'farmId', ${plots.farmId},
            'customerId', ${plots.customerId},
            'geoJson', CASE WHEN ${includeGeoJson} THEN ${plots.geoJson} ELSE NULL END,
            'createdAt', ${sql`to_char(${plots.createdAt}, 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`},
            'updatedAt', ${sql`to_char(${plots.updatedAt}, 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`},
            'externalId', ${plots.externalId},
            'hectare', ${sql`${plots.hectare}::text`},
            'deletedAt', ${plots.deletedAt} 
          )
        ) FILTER (WHERE ${plots.id} IS NOT NULL)` : sql`NULL`,
        customer: includeCustomer ? customers : sql`NULL`
      })
      .from(farms)
      .leftJoin(plots, eq(farms.id, plots.farmId))
      .leftJoin(customers, eq(farms.customerId, customers.id))
      .where(and(...where))
      .groupBy(farms.id, customers.id)
      .orderBy(orderByExpression)

    const results = await baseQuery;

    return results.map(row => ({
      ...row.farm,
      customer: row.customer,
      plots: (row.plots as any || []).map((plot: any) => ({
        ...plot,
        createdAt: new Date(plot.createdAt), 
        updatedAt: new Date(plot.updatedAt), 
      }))
    })) as FarmWithPlots[];
  }

  /**
   * @description Get all farms with related plots and optional search
   * @param {number} page - Page number
   * @param {number} limit - Items per page
   * @param {string} search - Optional search term to filter by farm name or customer name
   * @param {string} customerId - Optional customer ID to filter by customer
   * @param {boolean} includePlots - Optional flag to include plots in the response
   * @param {boolean} includeGeoJson - Optional flag to include geojson in the response
   * @returns {Promise<FarmWithPlots[]>} The farms list with plots
   */
  public async getAllFarmsWithPlots(
    page: number,
    limit: number,
    search?: string,
    customerId?: string,
    includePlots?: boolean,
    includeGeoJson?: boolean,
    includeCustomer?: boolean,
    orderBy?: FarmOrderBy,
    orderType?: FarmOrderType,
  ): Promise<FarmWithPlots[]> {
    const where = [isNull(farms.deletedAt)];

    if (search) {
      where.push(
        or(ilike(farms.name, `%${search}%`), ilike(customers.name, `%${search}%`)) as SQL<unknown>,
      );
    }

    if (customerId) {
      where.push(eq(farms.customerId, customerId));
    }

    let orderByExpression;

    switch (orderBy) {
      case FarmOrderBy.NAME:
        orderByExpression = orderType === FarmOrderType.ASC ? asc(farms.name) : desc(farms.name);
        break;
      case FarmOrderBy.CREATEDAT:
        orderByExpression = orderType === FarmOrderType.ASC ? asc(farms.createdAt) : desc(farms.createdAt);
        break;
      case FarmOrderBy.CUSTOMER:
        if(includeCustomer) {
          orderByExpression = orderType === FarmOrderType.ASC ? asc(customers.name) : desc(customers.name);
          break;
        }
      default:
        orderByExpression = desc(farms.createdAt);
    }

    // Complex query with all needed joins for search and filters
    const baseQuery = db
      .select({
        farm: farms,
        plots: includePlots ? sql`json_agg(               
          jsonb_build_object(
            'id', ${plots.id},
            'name', ${plots.name},
            'farmId', ${plots.farmId},
            'customerId', ${plots.customerId},
            'geoJson', CASE WHEN ${includeGeoJson} THEN ${plots.geoJson} ELSE NULL END,
            'createdAt', ${sql`to_char(${plots.createdAt}, 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`},
            'updatedAt', ${sql`to_char(${plots.updatedAt}, 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`},
            'externalId', ${plots.externalId},
            'hectare', ${sql`${plots.hectare}::text`},
            'deletedAt', ${plots.deletedAt}
          )
        ) FILTER (WHERE ${plots.id} IS NOT NULL)` : sql`NULL`,
        customer: includeCustomer ? customers : sql`NULL`
      })
      .from(farms)
      .leftJoin(plots, eq(farms.id, plots.farmId))
      .leftJoin(customers, eq(farms.customerId, customers.id))
      .where(and(...where))
      .groupBy(farms.id, customers.id)
      .offset((page - 1) * limit)
      .limit(limit)
      .orderBy(orderByExpression)

    const results = await baseQuery;

    return results.map(row => ({
      ...row.farm,
      customer: row.customer,
      plots: (row.plots as any || []).map((plot: any) => ({
        ...plot,
        createdAt: new Date(plot.createdAt), 
        updatedAt: new Date(plot.updatedAt),
        deletedAt: null
      }))
    })) as FarmWithPlots[];
  }

  /**
   * @description Get count of farms with optional search
   * @param {string} search - Optional search term to filter by farm name or customer name
   * @returns {Promise<number>} The count of farms
   */
  public async getFarmsCount(search?: string): Promise<number> {
    if (!search) {
      const [result] = await db.select({ count: count() }).from(farms);
      return result.count;
    }

    // When searching, we need to join with customers table
    const [result] = await db
      .select({ count: count() })
      .from(farms)
      .leftJoin(customers, eq(farms.customerId, customers.id))
      .where(or(ilike(farms.name, `%${search}%`), ilike(customers.name, `%${search}%`)));

    return result.count;
  }

  /**
   * @description Get farms by customer ID
   * @param {string} customerId - The customer's ID
   * @returns {Promise<Farm[]>} The farms list
   */
  public async getFarmsByCustomerId(customerId: string): Promise<Farm[]> {
    const farmsList = await db.query.farms.findMany({
      where: eq(farms.customerId, customerId),
    });

    return farmsList.map(this.formatFarm).filter(Boolean) as Farm[];
  }

  /**
   * @description Get farms by customer ID with related plots
   * @param {string} customerId - The customer's ID
   * @returns {Promise<FarmWithPlots[]>} The farms list with plots
   */
  public async getFarmsByCustomerIdWithPlots(
    customerId: string,
    page: number,
    limit: number,
  ): Promise<FarmWithPlots[]> {
    const farmsList = await db.query.farms.findMany({
      where: eq(farms.customerId, customerId),
      with: {
        plots: true,
        customer: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
      offset: (page - 1) * limit,
      limit,
    });

    return farmsList.map(this.formatFarmWithPlots).filter(Boolean) as FarmWithPlots[];
  }

  /**
   * @description Update a farm
   * @param {string} id - The farm's ID
   * @param {Partial<typeof farms.$inferInsert>} data - The farm data
   * @returns {Promise<Farm | null>} The updated farm
   */
  public async updateFarm(
    id: string,
    data: Partial<typeof farms.$inferInsert>,
  ): Promise<Farm | null> {
    const [farm] = await db.update(farms).set(data).where(eq(farms.id, id)).returning();

    return this.formatFarm(farm);
  }

  /**
   * @description  count ServiceOrders open
   * @param {string} id - The farm's ID
   * @returns {Promise<void>}
   */
  public async OpenServiceOrders(farmId: string): Promise<boolean> {
    const [serviceStatusOpen] = await db
      .select({ count: count() })
      .from(serviceOrders)
      .leftJoin(serviceOrderFarms, eq(serviceOrders.id, serviceOrderFarms.serviceOrderId))
      .where(and(eq(serviceOrders.status, 'open'), eq(serviceOrderFarms.farmId, farmId)));

    return (serviceStatusOpen?.count ?? 0) > 0;
  }

  /**
   * @description  soft Delete a farm
   * @param {string} id - The farm's ID
   * @returns {Promise<void>}
   */
  public async deleteFarm(id: string): Promise<void> {
    await db
      .update(farms)
      .set({ deletedAt: new Date() })
      .where(and(eq(farms.id, id), isNull(farms.deletedAt)));
  }

  /**
   * @description Get farms by their IDs
   * @param {string[]} ids - The farms' IDs
   * @returns {Promise<Farm[]>} The farms
   */
  public async getFarmsByIds(ids: string[]): Promise<Farm[]> {
    const list = await db.query.farms.findMany({
      where: inArray(farms.id, ids),
    });

    return list.filter(Boolean).map(this.formatFarm) as Farm[];
  }

  /**
   * @description Format a farm
   * @param {typeof farms.$inferSelect} farm - The farm
   * @returns {Farm} The formatted farm
   */
  private formatFarm(farm?: typeof farms.$inferSelect | null): Farm | null {
    if (!farm) return null;

    return {
      id: farm.id,
      name: farm.name,
      customerId: farm.customerId,
      createdAt: farm.createdAt,
      updatedAt: farm.updatedAt,
      deletedAt: farm.deletedAt,
    };
  }

  /**
   * @description Format a farm with plots
   * @param {object} farm - The farm with plots
   * @returns {FarmWithPlots} The formatted farm with plots
   */
  private formatFarmWithPlots(farm?: {
    id: string;
    name: string;
    customerId: string;
    createdAt: Date;
    updatedAt: Date | null;
    deletedAt: Date | null;
    customer?: {
      id: string;
      name: string;
    };
    plots?: Array<{
      id: string;
      name: string;
      farmId: string;
      customerId: string;
      geoJson?: unknown;
      createdAt: Date;
      updatedAt: Date | null;
      externalId: string;
      hectare: string;
      deletedAt: Date | null;
    }>;
  }): FarmWithPlots | null {
    if (!farm) return null;

    return {
      id: farm.id,
      name: farm.name,
      customerId: farm.customerId,
      createdAt: farm.createdAt,
      updatedAt: farm.updatedAt,
      deletedAt: farm.deletedAt,
      customer: farm.customer!,
      plots:
        farm.plots?.map((plot) => ({
          id: plot.id,
          name: plot.name,
          farmId: plot.farmId,
          customerId: plot.customerId,
          geoJson: plot.geoJson as Record<string, unknown> | undefined,
          createdAt: plot.createdAt,
          updatedAt: plot.updatedAt,
          deletedAt: plot.deletedAt,
          externalId: plot.externalId,
          hectare: plot.hectare,
        })) || [],
    };
  }
}
