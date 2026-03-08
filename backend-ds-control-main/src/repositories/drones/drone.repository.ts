import { db } from "@infra/database";
import { applications, drones, serviceOrders } from "@infra/database/schema";
import { and, count, eq, gte, ilike, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { DateTime } from "luxon";
import type { CreateDrone, Drone } from "./drone.types";

export class DroneRepository {
  /**
   * @description Create a new drone
   * @param {CreateDrone} data - The drone data
   * @returns {Promise<Drone>} The created drone
   */
  public async createDrone({
    name,
    model,
    aircraftRid,
  }: CreateDrone): Promise<Drone> {
    const [drone] = await db
      .insert(drones)
      .values({
        name,
        model,
        aircraftRid,
      })
      .returning();

    if (!drone) {
      throw new Error("Failed to create drone");
    }

    return this.formatDrone(drone)!;
  }

  /**
   * @description Get a drone by ID (only non-deleted)
   * @param {string} id - The drone's ID
   * @returns {Promise<Drone | null>} The drone
   */
  public async getDroneById(id: string): Promise<Drone | null> {
    const drone = await db.query.drones.findFirst({
      where: and(eq(drones.id, id), isNull(drones.deletedAt)),
    });

    return this.formatDrone(drone);
  }

  /**
   * @description Get all drones with optional pagination, search and status filter
   * @param {number} page - The page number
   * @param {number} limit - The limit per page
   * @param {string} search - Optional search term to filter by name, model, or aircraftRid
   * @param {string} status - Optional status filter (active/inactive)
   * @returns {Promise<Drone[]>} The drones list
   */
  public async getAllDrones(
    page: number,
    limit: number,
    search?: string,
    status?: "active" | "inactive"
  ): Promise<Drone[]> {
    // Build where conditions
    const whereConditions = [];

    // Search conditions
    if (search) {
      whereConditions.push(
        or(
          ilike(drones.name, `%${search}%`),
          ilike(drones.model, `%${search}%`),
          ilike(drones.aircraftRid, `%${search}%`)
        )
      );
    }

    // Status filter conditions
    if (status) {
      if (status === "active") {
        whereConditions.push(isNull(drones.deletedAt));
      } else if (status === "inactive") {
        whereConditions.push(isNotNull(drones.deletedAt));
      }
    } else {
      // Default behavior: only show active drones if no status filter is specified
      whereConditions.push(isNull(drones.deletedAt));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    const dronesList = await db.query.drones.findMany({
      where: whereClause,
      offset: (page - 1) * limit,
      limit,
      orderBy: (drones, { desc }) => [desc(drones.createdAt)],
    });

    return dronesList.map(this.formatDrone).filter(Boolean) as Drone[];
  }

  /**
   * @description Count drones with optional search and status filter
   * @param {string} search - Optional search term to filter by name, model, or aircraftRid
   * @param {string} status - Optional status filter (active/inactive)
   * @returns {Promise<number>} The count of drones
   */
  public async countDrones(
    search?: string,
    status?: "active" | "inactive"
  ): Promise<number> {
    if (!search && !status) {
      // Default behavior: count only active drones
      const [result] = await db.select({ count: count() }).from(drones).where(isNull(drones.deletedAt));
      return result.count;
    }

    // Build where conditions
    const whereConditions = [];

    // Search conditions
    if (search) {
      whereConditions.push(
        or(
          ilike(drones.name, `%${search}%`),
          ilike(drones.model, `%${search}%`),
          ilike(drones.aircraftRid, `%${search}%`)
        )
      );
    }

    // Status filter conditions
    if (status) {
      if (status === "active") {
        whereConditions.push(isNull(drones.deletedAt));
      } else if (status === "inactive") {
        whereConditions.push(isNotNull(drones.deletedAt));
      }
    } else {
      // Default behavior: only count active drones if no status filter is specified
      whereConditions.push(isNull(drones.deletedAt));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    const [result] = await db
      .select({ count: count() })
      .from(drones)
      .where(whereClause);

    return result.count;
  }

  /**
   * @description Update a drone (only non-deleted)
   * @param {string} id - The drone's ID
   * @param {Partial<typeof drones.$inferInsert>} data - The drone data
   * @returns {Promise<Drone | null>} The updated drone
   */
  public async updateDrone(
    id: string,
    data: Partial<typeof drones.$inferInsert>,
  ): Promise<Drone | null> {
    const [drone] = await db
      .update(drones)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(drones.id, id), isNull(drones.deletedAt)))
      .returning();

    return this.formatDrone(drone);
  }

  /**
   * @description Count Hectares
   * @param {Date} startDate - The initial Date
   * @param {Date} endDate - The final Date
   * @returns {Promise<number>} The count
   */
  public async avgHectaresByDrones(startDate: Date, endDate: Date): Promise<number> {
    const adjustEndDate = new Date(endDate);
    adjustEndDate.setDate(adjustEndDate.getDate() + 1);

    const result = await db
      .select({
        totalHectares: sql<number>`COALESCE(SUM(${applications.hectares}), 0)`,
        totalDrones: sql<number>`COUNT(DISTINCT ${drones.id})`,
      })
      .from(drones)
      .innerJoin(applications, eq(drones.id, applications.droneId))
      .where(
        and(
          isNull(drones.deletedAt),
          isNull(applications.deletedAt),
          gte(applications.date, startDate),
          lt(applications.date, adjustEndDate)
        )
      );

      const totalHectares = Number(result[0]?.totalHectares || 0);
      const totalDrones = Number(result[0]?.totalDrones || 0);

      return totalDrones > 0 ?  totalHectares / totalDrones : 0;
  }

  public async CountHectares(startDate: Date, endDate: Date): Promise<number> {
    const adjustEndDate = new Date(endDate);
    adjustEndDate.setDate(adjustEndDate.getDate() + 1);

    const result = await db
      .select({
        totalHectares: sql<number>`COALESCE(SUM(${applications.hectares}), 0)`
      })
      .from(applications)
      .innerJoin(drones, eq(applications.droneId, drones.id))
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

  public async compareLastMonth(startDate: Date, endDate: Date): Promise<
  { droneName: string, 
    droneRID: string, 
    month: string, 
    applications: number
    hectares: number 
    }[]> {

      const comparasionStarDate = new Date(startDate);
      comparasionStarDate.setMonth(comparasionStarDate.getMonth() - 3);

      let comparisonEndDate =  new Date(endDate);
      
      let adjustEndDateComparison =  new Date(comparisonEndDate);
      adjustEndDateComparison.setDate(adjustEndDateComparison.getDate() + 1);
    
      const result = await db
        .select({
          droneName: drones.name,
          droneRID: drones.aircraftRid,
          day: sql<string>`TO_CHAR(${applications.date}::timestamp, 'YYYY-MM-DD')`,
          applications: sql<number>`COUNT(${applications.id})`,
          hectares: sql<number>`COALESCE(SUM(${applications.hectares}), 0)`
        })
        .from(drones)
        .innerJoin(applications, eq(drones.id, applications.droneId))
        .where(
          and(
            isNull(drones.deletedAt),
            isNull(applications.deletedAt),
            gte(applications.date, comparasionStarDate),
            lt(applications.date, adjustEndDateComparison)
          )
        )
        .groupBy(sql`${drones.name}, ${drones.aircraftRid}, TO_CHAR(${applications.date}::timestamp, 'YYYY-MM-DD')`)
        .orderBy(sql`TO_CHAR(${applications.date}::timestamp, 'YYYY-MM-DD') DESC`);
      
      return result.map(r => ({
        droneName: r.droneName,
        droneRID: r.droneRID,
        day: r.day,
        month: DateTime.fromISO(r.day).toFormat('yyyy-MM'),
        applications: Number(r.applications),
        hectares: Number(r.hectares),
      }));
    }

  

  /**
   * @description Soft delete a drone (only non-deleted)
   * @param {string} id - The drone's ID
   * @returns {Promise<void>}
   */
  public async deleteDrone(id: string): Promise<void> {
    await db.update(drones)
      .set({ deletedAt: new Date() })
      .where(and(eq(drones.id, id), isNull(drones.deletedAt)));
  }

  /**
   * @description Hard delete a drone (permanent)
   * @param {string} id - The drone's ID
   * @returns {Promise<void>}
   */
  public async hardDeleteDrone(id: string): Promise<void> {
    await db.delete(drones).where(eq(drones.id, id));
  }

  /**
   * @description Get drones by their IDs (only non-deleted)
   * @param {string[]} ids - The drones' IDs
   * @returns {Promise<Drone[]>} The drones
   */
  public async getDronesByIds(ids: string[]): Promise<Drone[]> {
    const list = await db.query.drones.findMany({
      where: and(inArray(drones.id, ids), isNull(drones.deletedAt)),
    });

    return list.filter(Boolean).map(this.formatDrone) as Drone[];
  }

  /**
   * @description Format a drone
   * @param {typeof drones.$inferSelect} drone - The drone
   * @returns {Drone} The formatted drone
   */
  private formatDrone(drone?: typeof drones.$inferSelect | null): Drone | null {
    if (!drone) return null;

    return {
      id: drone.id,
      name: drone.name,
      model: drone.model,
      aircraftRid: drone.aircraftRid,
      deletedAt: drone.deletedAt,
      createdAt: drone.createdAt,
      updatedAt: drone.updatedAt,
    };
  }
} 