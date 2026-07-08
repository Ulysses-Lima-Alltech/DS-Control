import { db } from '@infra/database';
import { customers, farms, routes } from '@infra/database/schema';
import { and, asc, count, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';
import {
  type CreateRoute,
  type Route,
  type RouteFarmGroup,
  RouteOrderBy,
  RouteOrderType,
  type RouteWithCustomer,
  type RouteWithFarm,
  type RouteWithFarmAndCustomer,
} from './route.types';

const toDateOrNull = (value: unknown): Date | null => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
};

const getDateTime = (value: unknown): number => toDateOrNull(value)?.getTime() ?? 0;

const toIsoStringOrNull = (value: unknown): string | null => {
  const date = toDateOrNull(value);
  return date ? date.toISOString() : null;
};

export class RouteRepository {
  /**
   * @description Create a new route
   * @param {CreateRoute} data - The route data
   * @returns {Promise<Route>} The created route
   */
  public async createRoute({ name, geoJson, farmId, customerId }: CreateRoute): Promise<Route> {
    const [route] = await db
      .insert(routes)
      .values({
        name,
        geoJson,
        farmId,
        customerId,
      })
      .returning();

    if (!route) {
      throw new Error('Failed to create route');
    }

    return this.formatRoute(route)!;
  }

  /**
   * @description Create many routes in a single transaction
   * @param {CreateRoute[]} items - The routes data
   * @returns {Promise<Route[]>} The created routes
   */
  public async createRoutesBatch(items: CreateRoute[]): Promise<Route[]> {
    if (items.length === 0) return [];

    const createdRoutes = await db.transaction(async (tx) => {
      return await tx
        .insert(routes)
        .values(
          items.map(({ name, geoJson, farmId, customerId }) => ({
            name,
            geoJson,
            farmId,
            customerId,
          })),
        )
        .returning();
    });

    if (createdRoutes.length !== items.length) {
      throw new Error('Failed to create all routes');
    }

    return createdRoutes.map(this.formatRoute).filter(Boolean) as Route[];
  }

  /**
   * @description Get active route names by farm ID
   * @param {string} farmId - The farm ID
   * @returns {Promise<string[]>} The active route names
   */
  public async getActiveRouteNamesByFarmId(farmId: string): Promise<string[]> {
    const routeNames = await db
      .select({ name: routes.name })
      .from(routes)
      .where(and(eq(routes.farmId, farmId), isNull(routes.deletedAt)));

    return routeNames.map((route) => route.name);
  }

  /**
   * @description Get a route by ID
   * @param {string} id - The route's ID
   * @returns {Promise<Route | null>} The route
   */
  public async getRouteById(id: string): Promise<Route | null> {
    const route = await db.query.routes.findFirst({
      where: and(eq(routes.id, id), isNull(routes.deletedAt)),
    });

    return this.formatRoute(route);
  }

  /**
   * @description Get a route by ID with related farm and customer
   * @param {string} id - The route's ID
   * @param {boolean} includeFarm - Include farm data
   * @param {boolean} includeCustomer - Include customer data
   * @returns {Promise<RouteWithFarm | RouteWithCustomer | RouteWithFarmAndCustomer | Route | null>} The route with relations
   */
  public async getRouteWithRelationsById(
    id: string,
    includeFarm: boolean = false,
    includeCustomer: boolean = false,
  ): Promise<RouteWithFarm | RouteWithCustomer | RouteWithFarmAndCustomer | Route | null> {
    const route = await db.query.routes.findFirst({
      where: and(eq(routes.id, id), isNull(routes.deletedAt)),
      with: {
        farm: includeFarm
          ? {
              columns: {
                id: true,
                name: true,
              },
            }
          : undefined,
        customer: includeCustomer
          ? {
              columns: {
                id: true,
                name: true,
              },
            }
          : undefined,
      },
    });

    if (!route) return null;

    return this.formatRouteWithRelations(route, includeFarm, includeCustomer);
  }

  /**
   * @description Get all routes
   * @param {string} routeId - The route's ID
   * @param {string} farmId - The farm's ID
   * @param {string} customerId - The customer's ID
   * @param {boolean} includeFarm - Include farm data
   * @param {boolean} includeCustomer - Include customer data
   * @param {boolean} includeGeoJson - Include geoJson data
   * @param {RouteOrderBy} orderBy - Order by field
   * @param {RouteOrderType} orderType - Order type
   * @returns {Promise<RouteWithFarm[] | RouteWithCustomer[] | RouteWithFarmAndCustomer[] | Route[]>} The routes list
   */
  public async getAllRoutes(
    routeId?: string,
    farmId?: string,
    customerId?: string,
    includeFarm?: boolean,
    includeCustomer?: boolean,
    _includeGeoJson?: boolean,
    orderBy?: RouteOrderBy,
    orderType?: RouteOrderType,
  ): Promise<RouteWithFarm[] | RouteWithCustomer[] | RouteWithFarmAndCustomer[] | Route[]> {
    const where = [isNull(routes.deletedAt)];

    if (routeId) {
      where.push(eq(routes.id, routeId));
    }

    if (farmId) {
      where.push(eq(routes.farmId, farmId));
    }

    if (customerId) {
      where.push(eq(routes.customerId, customerId));
    }

    let orderByExpression = desc(routes.createdAt);

    switch (orderBy) {
      case RouteOrderBy.NAME:
        orderByExpression = orderType === RouteOrderType.ASC ? asc(routes.name) : desc(routes.name);
        break;
      case RouteOrderBy.CREATEDAT:
        orderByExpression =
          orderType === RouteOrderType.ASC ? asc(routes.createdAt) : desc(routes.createdAt);
        break;
      case RouteOrderBy.FARM:
        if (includeFarm) {
          orderByExpression = orderType === RouteOrderType.ASC ? asc(farms.name) : desc(farms.name);
        }
        break;
      case RouteOrderBy.CUSTOMER:
        if (includeCustomer) {
          orderByExpression =
            orderType === RouteOrderType.ASC ? asc(customers.name) : desc(customers.name);
        }
        break;
      default:
        orderByExpression = desc(routes.createdAt);
    }

    // Complex query with all needed joins for search and filters
    const baseQuery = db
      .select({
        route: routes,
        farm: includeFarm ? farms : sql`NULL`,
        customer: includeCustomer ? customers : sql`NULL`,
      })
      .from(routes)
      .leftJoin(farms, eq(routes.farmId, farms.id))
      .leftJoin(customers, eq(routes.customerId, customers.id))
      .where(and(...where))
      .orderBy(orderByExpression);

    const results = await baseQuery;

    return results
      .map((row) => {
        const baseRoute = this.formatRoute(row.route);
        if (!baseRoute) return null;

        if (includeFarm && includeCustomer) {
          return {
            ...baseRoute,
            farm: row.farm as { id: string; name: string },
            customer: row.customer as { id: string; name: string },
          } as RouteWithFarmAndCustomer;
        } else if (includeFarm) {
          return {
            ...baseRoute,
            farm: row.farm as { id: string; name: string },
          } as RouteWithFarm;
        } else if (includeCustomer) {
          return {
            ...baseRoute,
            customer: row.customer as { id: string; name: string },
          } as RouteWithCustomer;
        }

        return baseRoute;
      })
      .filter(Boolean) as
      | RouteWithFarm[]
      | RouteWithCustomer[]
      | RouteWithFarmAndCustomer[]
      | Route[];
  }

  /**
   * @description Get all routes with related data and optional search
   * @param {number} page - Page number
   * @param {number} limit - Items per page
   * @param {string} search - Optional search term to filter by route name or farm name
   * @param {string} customerId - Optional customer ID to filter by customer
   * @param {string} farmId - Optional farm ID to filter by farm
   * @param {boolean} includeFarm - Optional flag to include farm in the response
   * @param {boolean} includeCustomer - Optional flag to include customer in the response
   * @param {boolean} includeGeoJson - Optional flag to include geoJson in the response
   * @param {RouteOrderBy} orderBy - Order by field
   * @param {RouteOrderType} orderType - Order type
   * @returns {Promise<RouteWithFarm[] | RouteWithCustomer[] | RouteWithFarmAndCustomer[] | Route[]>} The routes list
   */
  public async getAllRoutesWithRelations(
    page: number,
    limit: number,
    search?: string,
    customerId?: string,
    farmId?: string,
    includeFarm?: boolean,
    includeCustomer?: boolean,
    _includeGeoJson?: boolean,
    orderBy?: RouteOrderBy,
    orderType?: RouteOrderType,
  ): Promise<RouteWithFarm[] | RouteWithCustomer[] | RouteWithFarmAndCustomer[] | Route[]> {
    const where = [isNull(routes.deletedAt)];

    if (search) {
      where.push(
        or(ilike(routes.name, `%${search}%`), ilike(farms.name, `%${search}%`)) as SQL<unknown>,
      );
    }

    if (customerId) {
      where.push(eq(routes.customerId, customerId));
    }

    if (farmId) {
      where.push(eq(routes.farmId, farmId));
    }

    let orderByExpression = desc(routes.createdAt);

    switch (orderBy) {
      case RouteOrderBy.NAME:
        orderByExpression = orderType === RouteOrderType.ASC ? asc(routes.name) : desc(routes.name);
        break;
      case RouteOrderBy.CREATEDAT:
        orderByExpression =
          orderType === RouteOrderType.ASC ? asc(routes.createdAt) : desc(routes.createdAt);
        break;
      case RouteOrderBy.FARM:
        if (includeFarm) {
          orderByExpression = orderType === RouteOrderType.ASC ? asc(farms.name) : desc(farms.name);
        }
        break;
      case RouteOrderBy.CUSTOMER:
        if (includeCustomer) {
          orderByExpression =
            orderType === RouteOrderType.ASC ? asc(customers.name) : desc(customers.name);
        }
        break;
      default:
        orderByExpression = desc(routes.createdAt);
    }

    // Complex query with all needed joins for search and filters
    const baseQuery = db
      .select({
        route: routes,
        farm: includeFarm ? farms : sql`NULL`,
        customer: includeCustomer ? customers : sql`NULL`,
      })
      .from(routes)
      .leftJoin(farms, eq(routes.farmId, farms.id))
      .leftJoin(customers, eq(routes.customerId, customers.id))
      .where(and(...where))
      .offset((page - 1) * limit)
      .limit(limit)
      .orderBy(orderByExpression);

    const results = await baseQuery;

    return results
      .map((row) => {
        const baseRoute = this.formatRoute(row.route);
        if (!baseRoute) return null;

        if (includeFarm && includeCustomer) {
          return {
            ...baseRoute,
            farm: row.farm as { id: string; name: string },
            customer: row.customer as { id: string; name: string },
          } as RouteWithFarmAndCustomer;
        } else if (includeFarm) {
          return {
            ...baseRoute,
            farm: row.farm as { id: string; name: string },
          } as RouteWithFarm;
        } else if (includeCustomer) {
          return {
            ...baseRoute,
            customer: row.customer as { id: string; name: string },
          } as RouteWithCustomer;
        }

        return baseRoute;
      })
      .filter(Boolean) as
      | RouteWithFarm[]
      | RouteWithCustomer[]
      | RouteWithFarmAndCustomer[]
      | Route[];
  }

  /**
   * @description Get count of routes with optional search
   * @param {string} search - Optional search term to filter by route name or farm name
   * @param {string} customerId - Optional customer ID to filter by customer
   * @param {string} farmId - Optional farm ID to filter by farm
   * @returns {Promise<number>} The count of routes
   */
  public async getRoutesCount(
    search?: string,
    customerId?: string,
    farmId?: string,
  ): Promise<number> {
    const where = [isNull(routes.deletedAt)];

    if (search) {
      where.push(
        or(ilike(routes.name, `%${search}%`), ilike(farms.name, `%${search}%`)) as SQL<unknown>,
      );
    }

    if (customerId) {
      where.push(eq(routes.customerId, customerId));
    }

    if (farmId) {
      where.push(eq(routes.farmId, farmId));
    }

    if (search) {
      // When searching, we need to join with farms table
      const [result] = await db
        .select({ count: count() })
        .from(routes)
        .leftJoin(farms, eq(routes.farmId, farms.id))
        .where(and(...where));

      return result.count;
    } else {
      const [result] = await db
        .select({ count: count() })
        .from(routes)
        .where(and(...where));
      return result.count;
    }
  }

  /**
   * @description Get active routes with farm and customer data for farm-grouped listings
   * @param {string} search - Optional search term to filter by route, farm or customer name
   * @param {string} customerId - Optional customer ID to filter by customer
   * @param {string} farmId - Optional farm ID to filter by farm
   * @param {RouteOrderBy} orderBy - Order by field
   * @param {RouteOrderType} orderType - Order type
   * @returns {Promise<RouteWithFarmAndCustomer[]>} Routes with farm and customer data
   */
  public async getRoutesWithFarmAndCustomerForGrouping(
    search?: string,
    customerId?: string,
    farmId?: string,
    orderBy?: RouteOrderBy,
    orderType?: RouteOrderType,
  ): Promise<RouteWithFarmAndCustomer[]> {
    const where = [isNull(routes.deletedAt)];

    if (search) {
      where.push(
        or(
          ilike(routes.name, `%${search}%`),
          ilike(farms.name, `%${search}%`),
          ilike(customers.name, `%${search}%`),
        ) as SQL<unknown>,
      );
    }

    if (customerId) {
      where.push(eq(routes.customerId, customerId));
    }

    if (farmId) {
      where.push(eq(routes.farmId, farmId));
    }

    let orderByExpression = desc(routes.createdAt);

    switch (orderBy) {
      case RouteOrderBy.NAME:
        orderByExpression = orderType === RouteOrderType.ASC ? asc(routes.name) : desc(routes.name);
        break;
      case RouteOrderBy.CREATEDAT:
        orderByExpression =
          orderType === RouteOrderType.ASC ? asc(routes.createdAt) : desc(routes.createdAt);
        break;
      case RouteOrderBy.FARM:
        orderByExpression = orderType === RouteOrderType.ASC ? asc(farms.name) : desc(farms.name);
        break;
      case RouteOrderBy.CUSTOMER:
        orderByExpression =
          orderType === RouteOrderType.ASC ? asc(customers.name) : desc(customers.name);
        break;
      default:
        orderByExpression = desc(routes.createdAt);
    }

    const results = await db
      .select({
        route: routes,
        farm: {
          id: farms.id,
          name: farms.name,
        },
        customer: {
          id: customers.id,
          name: customers.name,
        },
      })
      .from(routes)
      .leftJoin(farms, eq(routes.farmId, farms.id))
      .leftJoin(customers, eq(routes.customerId, customers.id))
      .where(and(...where))
      .orderBy(orderByExpression);

    return results
      .map((row) => {
        const route = this.formatRoute(row.route);
        const farmId = row.farm?.id;
        const farmName = row.farm?.name;
        const customerId = row.customer?.id;
        const customerName = row.customer?.name;

        if (
          !route ||
          typeof farmId !== 'string' ||
          typeof farmName !== 'string' ||
          typeof customerId !== 'string' ||
          typeof customerName !== 'string'
        ) {
          return null;
        }

        return {
          ...route,
          farm: {
            id: farmId,
            name: farmName,
          },
          customer: {
            id: customerId,
            name: customerName,
          },
        };
      })
      .filter(Boolean) as RouteWithFarmAndCustomer[];
  }

  public groupRoutesByFarm(routesList: RouteWithFarmAndCustomer[]): RouteFarmGroup[] {
    const groups = new Map<string, RouteFarmGroup>();

    routesList.forEach((route) => {
      if (!route.farm?.id || !route.farm?.name || !route.customer?.id || !route.customer?.name) {
        return;
      }

      const group = groups.get(route.farmId) ?? {
        farmId: route.farmId,
        farmName: route.farm.name,
        customerId: route.customerId,
        customerName: route.customer.name,
        routeCount: 0,
        lastRouteUpdatedAt: null,
        routes: [],
      };

      const routeUpdatedAt = route.updatedAt ?? route.createdAt;
      if (getDateTime(routeUpdatedAt) > getDateTime(group.lastRouteUpdatedAt)) {
        group.lastRouteUpdatedAt = toIsoStringOrNull(routeUpdatedAt);
      }

      group.routes.push(route);
      group.routeCount = group.routes.length;
      groups.set(route.farmId, group);
    });

    return Array.from(groups.values());
  }

  /**
   * @description Get routes by farm ID
   * @param {string} farmId - The farm's ID
   * @returns {Promise<Route[]>} The routes list
   */
  public async getRoutesByFarmId(farmId: string): Promise<Route[]> {
    const routesList = await db.query.routes.findMany({
      where: and(eq(routes.farmId, farmId), isNull(routes.deletedAt)),
    });

    return routesList.map(this.formatRoute).filter(Boolean) as Route[];
  }

  /**
   * @description Get routes by customer ID
   * @param {string} customerId - The customer's ID
   * @returns {Promise<Route[]>} The routes list
   */
  public async getRoutesByCustomerId(customerId: string): Promise<Route[]> {
    const routesList = await db.query.routes.findMany({
      where: and(eq(routes.customerId, customerId), isNull(routes.deletedAt)),
    });

    return routesList.map(this.formatRoute).filter(Boolean) as Route[];
  }

  /**
   * @description Update a route
   * @param {string} id - The route's ID
   * @param {Partial<typeof routes.$inferInsert>} data - The route data
   * @returns {Promise<Route | null>} The updated route
   */
  public async updateRoute(
    id: string,
    data: Partial<typeof routes.$inferInsert>,
  ): Promise<Route | null> {
    const [route] = await db.update(routes).set(data).where(eq(routes.id, id)).returning();

    return this.formatRoute(route);
  }

  /**
   * @description Soft delete a route
   * @param {string} id - The route's ID
   * @returns {Promise<void>}
   */
  public async deleteRoute(id: string): Promise<void> {
    await db
      .update(routes)
      .set({ deletedAt: new Date() })
      .where(and(eq(routes.id, id), isNull(routes.deletedAt)));
  }

  /**
   * @description Get routes by their IDs
   * @param {string[]} ids - The routes' IDs
   * @returns {Promise<Route[]>} The routes
   */
  public async getRoutesByIds(ids: string[]): Promise<Route[]> {
    const list = await db.query.routes.findMany({
      where: and(inArray(routes.id, ids), isNull(routes.deletedAt)),
    });

    return list.filter(Boolean).map(this.formatRoute) as Route[];
  }

  /**
   * @description Format a route
   * @param {typeof routes.$inferSelect} route - The route
   * @returns {Route} The formatted route
   */
  private formatRoute(route?: typeof routes.$inferSelect | null): Route | null {
    if (!route) return null;

    return {
      id: route.id,
      name: route.name,
      geoJson: route.geoJson as Record<string, unknown>,
      farmId: route.farmId,
      customerId: route.customerId,
      createdAt: route.createdAt,
      updatedAt: route.updatedAt,
      deletedAt: route.deletedAt,
    };
  }

  /**
   * @description Format a route with relations
   * @param {object} route - The route with relations
   * @param {boolean} includeFarm - Include farm data
   * @param {boolean} includeCustomer - Include customer data
   * @returns {RouteWithFarm | RouteWithCustomer | RouteWithFarmAndCustomer | Route} The formatted route with relations
   */
  private formatRouteWithRelations(
    route: {
      id: string;
      name: string;
      geoJson: unknown;
      farmId: string;
      customerId: string;
      createdAt: Date;
      updatedAt: Date | null;
      deletedAt: Date | null;
      farm?: {
        id: string;
        name: string;
      };
      customer?: {
        id: string;
        name: string;
      };
    } | null,
    includeFarm: boolean,
    includeCustomer: boolean,
  ): RouteWithFarm | RouteWithCustomer | RouteWithFarmAndCustomer | Route | null {
    if (!route) return null;

    const baseRoute = this.formatRoute(route as typeof routes.$inferSelect);
    if (!baseRoute) return null;

    if (includeFarm && includeCustomer) {
      return {
        ...baseRoute,
        farm: route.farm!,
        customer: route.customer!,
      } as RouteWithFarmAndCustomer;
    } else if (includeFarm) {
      return {
        ...baseRoute,
        farm: route.farm!,
      } as RouteWithFarm;
    } else if (includeCustomer) {
      return {
        ...baseRoute,
        customer: route.customer!,
      } as RouteWithCustomer;
    }

    return baseRoute;
  }
}
