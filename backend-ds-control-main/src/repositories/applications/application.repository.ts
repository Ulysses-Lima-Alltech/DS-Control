import { db } from "@infra/database";
import { applications, customers, farms, plots, products, serviceOrderPlots, serviceOrders, users } from "@infra/database/schema";
import { and, asc, count, desc, eq, exists, gte, ilike, inArray, isNull, lt, not, or, sql, sum } from "drizzle-orm";
import { DateTime } from 'luxon';
import { Application, ApplicationOrderBy, ApplicationOrderType, ApplicationWithRelations, CreateApplication, DrizzleApplicationQueryResult, UpdateApplication } from "./application.types";

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


export class ApplicationRepository {
  /**
   * @description Create a new application
   * @param {CreateApplication} data - The application data
   * @returns {Promise<Application>} The created application
   */
  public async createApplication(data: CreateApplication): Promise<Application> {
    let farmId = data.farmId;
    
    if(data.plotId) {
      const plot = await db.query.plots.findFirst({
        where: eq(plots.id, data.plotId),
      });

      farmId = plot?.farmId ?? null;
    }

    const [application] = await db
      .insert(applications)
      .values({
        serviceOrderId: data.serviceOrderId || null,
        pilotId: data.pilotId,
        assistantId: data.assistantId || null,
        droneId: data.droneId,
        cultureId: data.cultureId,
        hectares: data.hectares,
        flowRate: data.flowRate,
        altitude: data.altitude,
        routeSpacing: data.routeSpacing,
        dropletSize: data.dropletSize,
        date: data.date,
        productId: data.productId,
        plotId: data.plotId,
        farmId: farmId,
        observations: data.observations || null,
      })
      .returning();

    if (!application) {
      throw new Error("Failed to create application");
    }

    return this.formatApplication(application)!;
  }

  /**
   * @description Get an application by ID
   * @param {string} id - The application's ID
   * @returns {Promise<Application | null>} The application
   */
  public async getApplicationById(id: string): Promise<Application | null> {
    const application = await db.query.applications.findFirst({
      where: and(eq(applications.id, id), isNull(applications.deletedAt)),
    });

    return this.formatApplication(application);
  }

  /**
   * @description Get application with relations by ID
   * @param {string} id - The application's ID
   * @returns {Promise<ApplicationWithRelations | null>} The application with relations
   */
  public async getApplicationWithRelationsById(id: string): Promise<ApplicationWithRelations | null> {
    const application = await db.query.applications.findFirst({
      where: and(eq(applications.id, id), isNull(applications.deletedAt)),
      with: {
        serviceOrder: {
          columns: {
            id: true,
            number: true,
            status: true,
          },
        },
        pilot: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
        assistant: {
          columns: {
            id: true,
            name: true,
          },
        },
        drone: {
          columns: {
            id: true,
            name: true,
            model: true,
          },
        },
        culture: {
          columns: {
            id: true,
            name: true,
            description: true,
          },
        },
        product: {
          columns: {
            id: true,
            name: true,
          },
        },
        plot: {
          columns: {
            id: true,
            name: true,
            hectare: true,
          },
          with: {
            farm: {
              columns: {
                id: true,
                name: true,
              },
              with: {
                customer: {
                  columns: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        farm: {
          columns: {
            id: true,
            name: true,
          },
          with: {
            customer: {
              columns: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return this.formatApplicationWithRelations(application);
  }

  /**
   * @description Get all applications with pagination, optional search and filters
   * @param {number} page - The page number
   * @param {number} limit - The limit per page
   * @param {string} search - Optional search term to filter by observations, customer name, pilot name, or farm name
   * @param {object} filters - Optional filters for serviceOrderStatus, farmId, pilotId, customerId, serviceOrderId
   * @returns {Promise<ApplicationWithRelations[]>} The applications list with relations
   */
  public async getAllApplications(
    page: number, 
    limit: number,
    search?: string,
    filters?: {
      serviceOrderStatus?: "open" | "completed" | "cancelled";
      farmId?: string;
      pilotId?: string;
      customerId?: string;
      serviceOrderId?: string;
      invalidApplication?: boolean;
      startDate?: Date;
      endDate?: Date;
    },
    orderBy?: ApplicationOrderBy,
    orderType?: ApplicationOrderType,
  ): Promise<ApplicationWithRelations[]> {
    // Build where conditions
    const whereConditions = [];

    // filter deletedAt 
    whereConditions.push(isNull(applications.deletedAt));
    
    if(filters?.invalidApplication) {
      // filter Invalid Applications
      whereConditions.push(isNull(applications.plotId));
      whereConditions.push(not(inArray(applications.serviceOrderId, EXCLUDED_SERVICE_ORDER_IDS)));
    }
    // Search conditions
    if (search) {
      whereConditions.push(
        or(
          ilike(applications.observations, `%${search}%`),
          ilike(users.name, `%${search}%`), // pilot name
          ilike(customers.name, `%${search}%`), // customer name
          ilike(farms.name, `%${search}%`) // farm name (from both plot and direct relationship)
        )
      );
    }

    // Filter conditions
    if (filters?.serviceOrderStatus) {
      whereConditions.push(eq(serviceOrders.status, filters.serviceOrderStatus));
    }

    if (filters?.farmId) {
      whereConditions.push(eq(farms.id, filters.farmId));
    }

    if (filters?.pilotId) {
      whereConditions.push(eq(applications.pilotId, filters.pilotId));
    }

    if (filters?.customerId) {
      whereConditions.push(eq(customers.id, filters.customerId));
    }

    if (filters?.serviceOrderId) {
      whereConditions.push(eq(applications.serviceOrderId, filters.serviceOrderId));
    }

    if(filters?.startDate && filters?.endDate) {
      const adjustEndDate = new Date(filters.endDate);
      adjustEndDate.setDate(adjustEndDate.getDate() + 1);

      whereConditions.push(and(
        gte(applications.date, filters.startDate),
        lt(applications.date, adjustEndDate)
      ));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    let orderByExpression;

    switch (orderBy) {
      case ApplicationOrderBy.DATE:
        orderByExpression = orderType === ApplicationOrderType.ASC ? asc(applications.date) : desc(applications.date);
        break;
      case ApplicationOrderBy.PILOT:
        orderByExpression = orderType === ApplicationOrderType.ASC ? asc(users.name) : desc(users.name);
        break;
      case ApplicationOrderBy.PRODUCT:
        orderByExpression = orderType === ApplicationOrderType.ASC ? asc(products.name) : desc(products.name);
        break;
      default:
        orderByExpression = desc(applications.date);
    }

    // Complex query with all needed joins for search and filters
    const baseQuery = db
      .select({
        application: applications,
        pilot: users,
        customer: customers,
        farm: farms,
        serviceOrder: serviceOrders,
        products: products
      })
      .from(applications)
      .leftJoin(users, eq(applications.pilotId, users.id))
      .leftJoin(plots, eq(applications.plotId, plots.id))
      .leftJoin(farms, eq(applications.farmId, farms.id))
      .leftJoin(customers, eq(farms.customerId, customers.id))
      .leftJoin(serviceOrders, eq(applications.serviceOrderId, serviceOrders.id))
      .leftJoin(products, eq(applications.productId, products.id))
      .where(whereClause)
      .offset((page - 1) * limit)
      .limit(limit)
      .orderBy(orderByExpression);

    const results = await baseQuery;

    // For each result, get full application with relations
    const applicationIds = results.map(r => r.application.id);
    if (applicationIds.length === 0) return [];

    const applicationsWithFullRelations = await Promise.all(
      applicationIds.map(async (id) => {
        return await this.getApplicationWithRelationsById(id);
      })
    );

    return applicationsWithFullRelations.filter(Boolean) as ApplicationWithRelations[];
  }

  /**
   * @description Get applications by customer ID
   * @param {string} customerId - The customer's ID
   * @param {number} page - The page number
   * @param {number} limit - The limit per page
   * @returns {Promise<ApplicationWithRelations[]>} The applications list with relations
   */
  public async getApplicationsByCustomerId(customerId: string, page: number, limit: number): Promise<ApplicationWithRelations[]> {
    const applicationsList = await db.query.applications.findMany({
      where: (applications, { inArray }) => inArray(
        applications.plotId,
        db.select({ id: plots.id }).from(plots).innerJoin(farms, eq(plots.farmId, farms.id)).where(eq(farms.customerId, customerId))
      ),
      offset: (page - 1) * limit,
      limit,
      orderBy: (applications, { desc }) => [desc(applications.createdAt)],
      with: {
        serviceOrder: {
          columns: {
            id: true,
            number: true,
            status: true,
          },
        },
        pilot: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
        assistant: {
          columns: {
            id: true,
            name: true,
          },
        },
        drone: {
          columns: {
            id: true,
            name: true,
            model: true,
          },
        },
        culture: {
          columns: {
            id: true,
            name: true,
            description: true,
          },
        },
        product: {
          columns: {
            id: true,
            name: true,
          },
        },
        plot: {
          columns: {
            id: true,
            name: true,
            hectare: true,
          },
          with: {
            farm: {
              columns: {
                id: true,
                name: true,
              },
              with: {
                customer: {
                  columns: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return applicationsList.map(this.formatApplicationWithRelations).filter(Boolean) as ApplicationWithRelations[];
  }

  /**
   * @description Get applications by pilot ID
   * @param {string} pilotId - The pilot's ID
   * @param {number} page - The page number
   * @param {number} limit - The limit per page
   * @returns {Promise<ApplicationWithRelations[]>} The applications list with relations
   */
  public async getApplicationsByPilotId(pilotId: string, page: number, limit: number): Promise<ApplicationWithRelations[]> {
    const applicationsList = await db.query.applications.findMany({
      where: eq(applications.pilotId, pilotId),
      offset: (page - 1) * limit,
      limit,
      orderBy: (applications, { desc }) => [desc(applications.createdAt)],
      with: {
        serviceOrder: {
          columns: {
            id: true,
            number: true,
            status: true,
          },
        },
        pilot: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
        assistant: {
          columns: {
            id: true,
            name: true,
          },
        },
        drone: {
          columns: {
            id: true,
            name: true,
            model: true,
          },
        },
        culture: {
          columns: {
            id: true,
            name: true,
            description: true,
          },
        },
        product: {
          columns: {
            id: true,
            name: true,
          },
        },
        plot: {
          columns: {
            id: true,
            name: true,
            hectare: true,
          },
          with: {
            farm: {
              columns: {
                id: true,
                name: true,
              },
              with: {
                customer: {
                  columns: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return applicationsList.map(this.formatApplicationWithRelations).filter(Boolean) as ApplicationWithRelations[];
  }

  /**
   * @description Get applications by farm ID
   * @param {string} farmId - The farm's ID
   * @param {number} page - The page number
   * @param {number} limit - The limit per page
   * @returns {Promise<ApplicationWithRelations[]>} The applications list with relations
   */
  public async getApplicationsByFarmId(farmId: string, page: number, limit: number): Promise<ApplicationWithRelations[]> {
    const applicationsList = await db.query.applications.findMany({
      where: (applications, { inArray, and }) =>
        and(
          inArray(
            applications.plotId,
            db
              .select({ id: plots.id })
              .from(plots)
              .where(eq(plots.farmId, farmId))
          ),
          isNull(applications.deletedAt)
        ),
      offset: (page - 1) * limit,
      limit,
      orderBy: (applications, { desc }) => [desc(applications.createdAt)],
      with: {
        serviceOrder: {
          columns: {
            id: true,
            number: true,
            status: true,
          },
        },
        pilot: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
        assistant: {
          columns: {
            id: true,
            name: true,
          },
        },
        drone: {
          columns: {
            id: true,
            name: true,
            model: true,
          },
        },
        culture: {
          columns: {
            id: true,
            name: true,
            description: true,
          },
        },
        product: {
          columns: {
            id: true,
            name: true,
          },
        },
        plot: {
          columns: {
            id: true,
            name: true,
            hectare: true,
          },
          with: {
            farm: {
              columns: {
                id: true,
                name: true,
              },
              with: {
                customer: {
                  columns: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return applicationsList.map(this.formatApplicationWithRelations).filter(Boolean) as ApplicationWithRelations[];
  }

  /**
   * @description Get applications by service order ID
   * @param {string} serviceOrderId - The service order's ID
   * @param {number} page - The page number
   * @param {number} limit - The limit per page
   * @returns {Promise<ApplicationWithRelations[]>} The applications list with relations
   */
  public async getApplicationsByServiceOrderId(serviceOrderId: string, page: number, limit: number): Promise<ApplicationWithRelations[]> {
    const applicationsList = await db.query.applications.findMany({
      where: and(eq(applications.serviceOrderId, serviceOrderId), isNull(applications.deletedAt)),
      offset: (page - 1) * limit,
      limit,
      orderBy: (applications, { desc }) => [desc(applications.createdAt)],
      with: {
        serviceOrder: {
          columns: {
            id: true,
            number: true,
            status: true,
          },
        },
        pilot: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
        assistant: {
          columns: {
            id: true,
            name: true,
          },
        },
        drone: {
          columns: {
            id: true,
            name: true,
            model: true,
          },
        },
        culture: {
          columns: {
            id: true,
            name: true,
            description: true,
          },
        },
        product: {
          columns: {
            id: true,
            name: true,
          },
        },
        plot: {
          columns: {
            id: true,
            name: true,
            hectare: true,
          },
          with: {
            farm: {
              columns: {
                id: true,
                name: true,
              },
              with: {
                customer: {
                  columns: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return applicationsList.map(this.formatApplicationWithRelations).filter(Boolean) as ApplicationWithRelations[];
  }

  /**
   * @description Get applications by plot ID
   * @param {string} plotId - The plot's ID
   * @param {number} page - The page number
   * @param {number} limit - The limit per page
   * @returns {Promise<ApplicationWithRelations[]>} The applications list with relations
   */
  public async getApplicationsByPlotId(plotId: string, page: number, limit: number): Promise<ApplicationWithRelations[]> {
    const applicationsList = await db.query.applications.findMany({
      where: and(eq(applications.plotId, plotId), isNull(applications.deletedAt)),
      offset: (page - 1) * limit,
      limit,
      orderBy: (applications, { desc }) => [desc(applications.createdAt)],
      with: {
        serviceOrder: {
          columns: {
            id: true,
            number: true,
            status: true,
          },
        },
        pilot: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
        assistant: {
          columns: {
            id: true,
            name: true,
          },
        },
        drone: {
          columns: {
            id: true,
            name: true,
            model: true,
          },
        },
        culture: {
          columns: {
            id: true,
            name: true,
            description: true,
          },
        },
        product: {
          columns: {
            id: true,
            name: true,
          },
        },
        plot: {
          columns: {
            id: true,
            name: true,
            hectare: true,
          },
          with: {
            farm: {
              columns: {
                id: true,
                name: true,
              },
              with: {
                customer: {
                  columns: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return applicationsList.map(this.formatApplicationWithRelations).filter(Boolean) as ApplicationWithRelations[];
  }

  /**
   * @description Update an application
   * @param {string} id - The application's ID
   * @param {UpdateApplication} data - The application data
   * @returns {Promise<Application | null>} The updated application
   */
  public async updateApplication(id: string, data: UpdateApplication): Promise<Application | null> {
    const updateData: Partial<typeof applications.$inferInsert> = {};
    
    if (data.serviceOrderId !== undefined) updateData.serviceOrderId = data.serviceOrderId;
    if (data.pilotId !== undefined) updateData.pilotId = data.pilotId;
    if (data.assistantId !== undefined) updateData.assistantId = data.assistantId;
    if (data.droneId !== undefined) updateData.droneId = data.droneId;
    if (data.cultureId !== undefined) updateData.cultureId = data.cultureId;
    if (data.hectares !== undefined) updateData.hectares = data.hectares;
    if(data.flowRate !== undefined) updateData.flowRate  = data.flowRate;
    if(data.altitude !== undefined) updateData.altitude = data.altitude;
    if(data.routeSpacing !== undefined) updateData.routeSpacing = data.routeSpacing;
    if(data.dropletSize !== undefined) updateData.dropletSize = data.dropletSize; 
    if (data.date !== undefined) updateData.date = data.date;
    if (data.productId !== undefined) updateData.productId = data.productId;
    if (data.plotId !== undefined) updateData.plotId = data.plotId;
    if (data.observations !== undefined) updateData.observations = data.observations;

    let farmId = data.farmId;

    if (data.plotId !== undefined) {
      const plot = await db.query.plots.findFirst({
        where: eq(plots.id, data.plotId),
      });
      farmId = plot?.farmId ?? undefined;
    }

    await db
      .update(applications)
      .set({ ...updateData, farmId: farmId })
      .where(eq(applications.id, id))
    
    const application = await this.getApplicationWithRelationsById(id);

    return this.formatApplicationWithRelations(application);
  }

  /**
   * @description soft Delete an application (only non-deleted)
   * @param {string} id - The application's ID
   * @returns {Promise<void>}
   */
  public async deleteApplication(id: string): Promise<void> {
    await db.update(applications)
      .set({ deletedAt: new Date() })
      .where(and(eq(applications.id, id), isNull(applications.deletedAt)))
  }


  /**
   * @description Count applications with optional search and filters
   * @param {string} search - Optional search term to filter by observations, customer name, pilot name, or farm name
   * @param {object} filters - Optional filters for serviceOrderStatus, farmId, pilotId, customerId, serviceOrderId
   * @returns {Promise<number>} The count of applications
   */
  public async countApplications(
    search?: string,
    filters?: {
      serviceOrderStatus?: "open" | "completed" | "cancelled";
      farmId?: string;
      pilotId?: string;
      customerId?: string;
      serviceOrderId?: string;
      invalidApplication?: boolean;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<number> {
    if (!search && !filters) {
      const [result] = await db
        .select({ count: count() })
        .from(applications)
        .where(isNull(applications.deletedAt));
      return result.count;
    }

    // Build where conditions
    const whereConditions = [];

    // Search conditions
    if (search) {
      whereConditions.push(
        or(
          ilike(applications.observations, `%${search}%`),
          ilike(users.name, `%${search}%`), // pilot name
          ilike(customers.name, `%${search}%`), // customer name
          ilike(farms.name, `%${search}%`) // farm name (from both plot and direct relationship)
        )
      );
    }

    // Filter conditions
    if (filters?.serviceOrderStatus) {
      whereConditions.push(eq(serviceOrders.status, filters.serviceOrderStatus));
    }

    if (filters?.farmId) {
      whereConditions.push(eq(farms.id, filters.farmId));
    }

    if (filters?.pilotId) {
      whereConditions.push(eq(applications.pilotId, filters.pilotId));
    }

    if (filters?.customerId) {
      whereConditions.push(eq(customers.id, filters.customerId));
    }

    if (filters?.serviceOrderId) {
      whereConditions.push(eq(applications.serviceOrderId, filters.serviceOrderId));
    }

    if (filters?.invalidApplication) {
      whereConditions.push(isNull(applications.plotId));
      // Exclude applications from special "avulso" service orders
      whereConditions.push(
        not(inArray(applications.serviceOrderId, EXCLUDED_SERVICE_ORDER_IDS))
      );
    }

    if(filters?.startDate && filters?.endDate) {
      const adjustEndDate = new Date(filters.endDate);
      adjustEndDate.setDate(adjustEndDate.getDate() + 1);
      whereConditions.push(and(
        gte(applications.date, filters.startDate),
        lt(applications.date, adjustEndDate)
      ));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    const [result] = await db
      .select({ count: count() })
      .from(applications)
      .leftJoin(users, eq(applications.pilotId, users.id))
      .leftJoin(plots, eq(applications.plotId, plots.id))
      .leftJoin(farms, eq(applications.farmId, farms.id))
      .leftJoin(customers, eq(farms.customerId, customers.id))
      .leftJoin(serviceOrders, eq(applications.serviceOrderId, serviceOrders.id))
      .where(and(whereClause, isNull(applications.deletedAt)));

    return result.count;
  }

  /**
   * @description Count applications by customer ID
   * @param {string} customerId - The customer's ID
   * @returns {Promise<number>} The count
   */
  public async countApplicationsByCustomerId(customerId: string): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(applications)
      .innerJoin(plots, eq(applications.plotId, plots.id))
      .innerJoin(farms, eq(plots.farmId, farms.id))
      .where(and(eq(farms.customerId, customerId), isNull(applications.deletedAt)));

    return result[0]?.count || 0;
  }

  /**
   * @description Count applications by pilot ID
   * @param {string} pilotId - The pilot's ID
   * @returns {Promise<number>} The count
   */
  public async countApplicationsByPilotId(pilotId: string): Promise<number> {
    const result = await db.$count(applications, and(eq(applications.pilotId, pilotId), isNull(applications.deletedAt)));
    return result;
  }

  /**
   * @description Count applications by farm ID
   * @param {string} farmId - The farm's ID
   * @returns {Promise<number>} The count
   */
  public async countApplicationsByFarmId(farmId: string): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(applications)
      .innerJoin(plots, eq(applications.plotId, plots.id))
      .where(and(eq(plots.farmId, farmId), isNull(applications.deletedAt)));

    return result[0]?.count || 0;
  }

  /**
   * @description Count applications by service order ID
   * @param {string} serviceOrderId - The service order's ID
   * @returns {Promise<number>} The count
   */
  public async countApplicationsByServiceOrderId(serviceOrderId: string): Promise<number> {
    const result = await db.$count(applications, and(eq(applications.serviceOrderId, serviceOrderId), isNull(applications.deletedAt)));
    return result;
  }

  /**
   * @description Avg count Service Orders by daily
   * @param {Date} startDate - The initial Date
   * @param {Date} endDate - The final Date
   * @returns {Promise<number>} The count
   */
  public async avgServiceOrdersByDaily(startDate: Date, endDate: Date): Promise<number> {

    const adjustEndDate = new Date(endDate);
    adjustEndDate.setDate(adjustEndDate.getDate() + 1);

    const result = await db
      .select({ count: count() })
      .from(serviceOrders)
      .where(
        and(
          gte(serviceOrders.createdAt, startDate),
          lt(serviceOrders.createdAt, adjustEndDate)
        )
      );

    const serviceOrdersCount = Number(result[0]?.count || 0)
    const daysCount = Math.max(
      1,
      Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 *24))
    )

    return serviceOrdersCount > 0 ?  Number((serviceOrdersCount / daysCount).toFixed(2)) : 0;
  }

  /**
   * Gets count of service orders by status.
   * @param {Date} startDate - The initial Date
   * @param {Date} endDate - The final Date
   * @param {string} status - The status to filter by.
   * @returns {Promise<number>} Count of service orders.
   */
  public async countServiceOrdersByStatus(
    startDate: Date, 
    endDate: Date, 
    status: 'open' | 'completed' | 'cancelled'): Promise<number> {
    const adjustEndDate = new Date(endDate);
    adjustEndDate.setDate(adjustEndDate.getDate() + 1);

    const [result] = await db
      .select({ count: count() })
      .from(serviceOrders)
      .where(
        and(
          eq(serviceOrders.status, status),
          gte(serviceOrders.plannedDate, startDate),
          lt(serviceOrders.plannedDate, adjustEndDate)
        )
      );

    return result?.count ?? 0;
  }

  /**
   * @description Count Hectares
   * @param {Date} startDate - The initial Date
   * @param {Date} endDate - The final Date
   * @returns {Promise<number>} The count
   */
  public async avgHectarebyApplication(startDate: Date, endDate: Date): Promise<number> {
    const adjustEndDate = new Date(endDate);
    adjustEndDate.setDate(adjustEndDate.getDate() + 1);

    const result = await db
      .select({   
        totalHectares: sql<number>`COALESCE(SUM(${applications.hectares}), 0)`,
        totalApplication: sql<number>`COUNT(${applications.id})`
      })
      .from(applications)
      .where(
        and(
          isNull(applications.deletedAt),
          gte(applications.date, startDate),
          lt(applications.date, adjustEndDate)
        )
      );

      const totalHectares = Number(result[0]?.totalHectares || 0);
      const totalApplication = Number(result[0]?.totalApplication || 0);


      if(!totalApplication) {
        return 0;
      }

    return totalHectares / totalApplication;
  }

    /**
   * @description Count Hectares
   * @param {Date} startDate - The initial Date
   * @param {Date} endDate - The final Date
   * @returns {Promise<number>} The count
   */
  public async countHectares(startDate: Date, endDate: Date): Promise<number> {
    const adjustEndDate = new Date(endDate);
    adjustEndDate.setDate(adjustEndDate.getDate() + 1);

    const result = await db
      .select({
        totalHectares: sql<number>`COALESCE(SUM(${applications.hectares}), 0)`
      })
      .from(applications)
      .where(
        and(
          isNull(applications.deletedAt),
          gte(applications.date, startDate),
          lt(applications.date, adjustEndDate)
        )
      );
    
    const totalHectares = Number(result[0]?.totalHectares || 0);

    return totalHectares;
  }

   /**
   * @description Count Hectares
   * @param {Date} startDate - The initial Date
   * @param {Date} endDate - The final Date
   * @returns {Promise<number>} The count
   */
  public async countHectaresPerfomance(startDate: Date, endDate: Date): Promise<number> {
    const adjustEndDate = new Date(endDate);
    adjustEndDate.setDate(adjustEndDate.getDate() + 1);

    const result = await db
      .select({
        totalHectares: sql<number>`COALESCE(SUM(${applications.hectares}), 0)`
      })
      .from(applications)
      .where(
        and(
          isNull(applications.deletedAt),
          gte(applications.date, startDate),
          lt(applications.date, adjustEndDate)
        )
      );
    
    const totalHectares = Number(result[0]?.totalHectares || 0);

    return totalHectares;
  }



  /**
   * @description Compare last months
   * @param {Date} startDate - The initial Date
   * @param {Date} endDate - The final Date
   * @returns {Promise<{day: string, totalApplications: number, hectares: number}>[]} The count
   */
  public async compareLastMonths(startDate: Date, endDate: Date) {

    const comparasionStarDate = new Date(startDate);
    comparasionStarDate.setMonth(comparasionStarDate.getMonth() - 3);

    const comparisonEndDate = new Date(endDate);

    const adjustEndDateComparison = new Date(comparisonEndDate);
    adjustEndDateComparison.setDate(adjustEndDateComparison.getDate() + 1);

    const result = await db
      .select({
        day: sql<string>`TO_CHAR(${applications.date}::timestamp, 'YYYY-MM-DD')`,
        totalApplications: sql<number>`COUNT(DISTINCT ${applications.id})`,
        hectares: sql<number>`COALESCE(SUM(${applications.hectares}), 0)`,
      })
      .from(applications)
      .where(and(
        isNull(applications.deletedAt),
        gte(applications.date, comparasionStarDate),
        lt(applications.date, adjustEndDateComparison)
      ))
      .groupBy(sql`TO_CHAR(${applications.date}::timestamp, 'YYYY-MM-DD') `)
      .orderBy(sql`TO_CHAR(${applications.date}::timestamp, 'YYYY-MM-DD') DESC`)

      return result.map(r => ({
        day: r.day,
        month: DateTime.fromISO(r.day).toFormat('yyyy-MM'),
        totalApplications: Number(r.totalApplications),
        hectares: Number(r.hectares)
      }));
  }

  /**
   * @description Count avg hectares by pilot
   * @param {Date} startDate - The initial Date
   * @param {Date} endDate - The final Date
   * @returns {Promise<{pilotName: string, avgHectares: number}[]>} The count
   */
  public async avgHectaresByPilot(startDate: Date, endDate: Date): Promise<number> {
    const adjustEndDate = new Date(endDate);
    adjustEndDate.setDate(adjustEndDate.getDate() + 1);
    
    const result = await db
      .select({
        totalHectares: sql<number>`COALESCE(SUM(${applications.hectares}), 0)`,
        totalPilots: sql<number>`COUNT(DISTINCT ${users.id})`,
      })
      .from(applications)
      .innerJoin(users, eq(applications.pilotId, users.id))
      .where(
        and(
          isNull(applications.deletedAt),
          isNull(users.deletedAt),
          gte(applications.date, startDate),
          lt(applications.date, adjustEndDate)
        )
      )

      const totalHectares = Number(result[0]?.totalHectares || 0);
      const totalUsers = Number(result[0]?.totalPilots || 0);

      return totalUsers > 0 ? totalHectares / totalUsers : 0;
  }

  public async applicationsByPilotsLastMonths(startDate: Date, endDate: Date) {
  
    const comparasionStarDate = new Date(startDate);
    comparasionStarDate.setMonth(comparasionStarDate.getMonth() - 3);

    let comparisonEndDate =  new Date(endDate);
    
    let adjustEndDateComparison =  new Date(comparisonEndDate);
    adjustEndDateComparison.setDate(adjustEndDateComparison.getDate() + 1);
    
    
    const result = await db
      .select({ 
        pilotName: users.name,
        day: sql<string>`TO_CHAR(${applications.date}::timestamp, 'YYYY-MM-DD')`,
        applications: sql<number>`COUNT(${applications.id})`,
        hectares: sql<number>`COALESCE(SUM(${applications.hectares}), 0)`
      })
      .from(applications)
      .innerJoin(users, eq(applications.pilotId, users.id))
      .where(
        and(
          isNull(applications.deletedAt),
          isNull(users.deletedAt),
          gte(applications.date, comparasionStarDate),
          lt(applications.date, adjustEndDateComparison)
        )
      )
      .groupBy(users.id, users.name, sql`TO_CHAR(${applications.date}::timestamp, 'YYYY-MM-DD')`)
      .orderBy(sql`TO_CHAR(${applications.date}::timestamp, 'YYYY-MM-DD') DESC`);

      return result.map(r => ({
        pilotName: r.pilotName,
        day: r.day,
        month: DateTime.fromISO(r.day).toFormat('yyyy-MM'),
        applications: Number(r.applications),
        hectares: Number(r.hectares)
      }));
  }
 
  /**
   * @description Count applications by plot ID
   * @param {string} plotId - The plot's ID
   * @returns {Promise<number>} The count
   */
  public async countApplicationsByPlotId(plotId: string): Promise<number> {
    const result = await db.$count(applications, and(eq(applications.plotId, plotId), isNull(applications.deletedAt)));
    return result;
  }

  /**
   * @description Format an application
   * @param {typeof applications.$inferSelect} application - The application
   * @returns {Application | null} The formatted application
   */
  private formatApplication(application?: typeof applications.$inferSelect | null): Application | null {
    if (!application) return null;

    return {
      id: application.id,
      serviceOrderId: application.serviceOrderId,
      pilotId: application.pilotId,
      assistantId: application.assistantId,
      droneId: application.droneId,
      cultureId: application.cultureId,
      farmId: application.farmId,
      hectares: application.hectares,
      flowRate: application.flowRate,
      altitude: application.altitude,
      routeSpacing: application.routeSpacing,
      dropletSize: application.dropletSize,
      date: application.date,
      productId: application.productId,
      plotId: application.plotId,
      observations: application.observations,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
      deletedAt: application.deletedAt
    };
  }

  /**
   * @description Format an application with relations
   * @param {DrizzleApplicationQueryResult} application - The application with relations
   * @returns {ApplicationWithRelations | null} The formatted application with relations
   */
  private formatApplicationWithRelations(application?: DrizzleApplicationQueryResult | null): ApplicationWithRelations | null {
    if (!application) return null;

    return {
      id: application.id,
      serviceOrderId: application.serviceOrderId,
      pilotId: application.pilotId,
      assistantId: application.assistantId,
      droneId: application.droneId,
      cultureId: application.cultureId,
      hectares: application.hectares,
      flowRate: application.flowRate,
      altitude: application.altitude,
      routeSpacing: application.routeSpacing,
      dropletSize: application.dropletSize,
      date: application.date,
      productId: application.productId,
      plotId: application?.plotId,
      observations: application.observations,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
      deletedAt: application.deletedAt,
      serviceOrder: application.serviceOrder || null,
      pilot: application.pilot,
      assistant: application.assistant || null,
      drone: application.drone,
      culture: application.culture,
      product: application.product,
      plot: application.plot,
      farm: application.farm || null,
      farmId: application.farmId || null,
    };
  }

  /**
   * Gets total area in hectares for service orders with a specific status, filtered by application dates.
   * @param {string} status - The status to filter by ('open', 'completed', 'cancelled').
   * @param {Date} startDate - The start date for filtering applications.
   * @param {Date} endDate - The end date for filtering applications.
   * @returns {Promise<number>} Total area in hectares for the status.
   */
  public async getAreaHectaresByStatus(
    status: 'open' | 'completed' | 'cancelled',
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const adjustEndDate = new Date(endDate);
    adjustEndDate.setDate(adjustEndDate.getDate() + 1);

    // Query plots through serviceOrderPlots junction table
    // Filter by service order status and application dates
    // Use subquery to get distinct plots to avoid counting the same plot multiple times
    const distinctPlots = await db
      .selectDistinct({ plotId: plots.id, hectare: plots.hectare })
      .from(plots)
      .innerJoin(serviceOrderPlots, eq(serviceOrderPlots.plotId, plots.id))
      .innerJoin(serviceOrders, eq(serviceOrderPlots.serviceOrderId, serviceOrders.id))
      .where(
        and(
          eq(serviceOrders.status, status),
          exists(
            db
              .select()
              .from(applications)
              .where(
                and(
                  eq(applications.serviceOrderId, serviceOrders.id),
                  isNull(applications.deletedAt),
                  gte(applications.date, startDate),
                  lt(applications.date, adjustEndDate)
                )
              )
          )
        )
      );

    const totalArea = distinctPlots.reduce((sum, plot) => sum + Number(plot.hectare || 0), 0);
    return totalArea;
  }

  /**
   * Gets total hectares applied (from applications) for service orders with a specific status.
   * @param {string} status - The status to filter by ('open', 'completed', 'cancelled').
   * @param {Date} startDate - The start date for filtering applications.
   * @param {Date} endDate - The end date for filtering applications.
   * @returns {Promise<number>} Total hectares applied for the status.
   */
  public async getAppliedHectaresByStatus(
    status: 'open' | 'completed' | 'cancelled',
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const adjustEndDate = new Date(endDate);
    adjustEndDate.setDate(adjustEndDate.getDate() + 1);

    // Query applications through serviceOrders
    // Sum hectares from applications where serviceOrderId matches and application is not deleted
    const result = await db
      .select({ totalApplied: sum(applications.hectares) })
      .from(applications)
      .innerJoin(serviceOrders, eq(applications.serviceOrderId, serviceOrders.id))
      .where(
        and(
          eq(serviceOrders.status, status),
          isNull(applications.deletedAt),
          gte(applications.date, startDate),
          lt(applications.date, adjustEndDate)
        )
      );

    return Number(result[0]?.totalApplied || 0);
  }
} 