import { db } from "@infra/database";
import { applications, cultureTypes } from "@infra/database/schema";
import { and, eq, gte, ilike, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { DateTime } from "luxon";
import type { CreateCultureType, CultureType } from "./culture-type.types";

export class CultureTypeRepository {
  /**
   * @description Create a new culture type
   * @param {CreateCultureType} data - The culture type data
   * @returns {Promise<CultureType>} The created culture type
   */
  public async createCultureType({
    name,
    description,
  }: CreateCultureType): Promise<CultureType> {
    const [cultureType] = await db
      .insert(cultureTypes)
      .values({
        name,
        description,
      })
      .returning();

    if (!cultureType) {
      throw new Error("Failed to create culture type");
    }

    return this.formatCultureType(cultureType)!;
  }

  /**
   * @description Get a culture type by ID (only non-deleted)
   * @param {string} id - The culture type's ID
   * @returns {Promise<CultureType | null>} The culture type
   */
  public async getCultureTypeById(id: string): Promise<CultureType | null> {
    const cultureType = await db.query.cultureTypes.findFirst({
      where: and(eq(cultureTypes.id, id), isNull(cultureTypes.deletedAt)),
    });

    return this.formatCultureType(cultureType);
  }

  /**
   * @description Get all culture types (only non-deleted)
   * @returns {Promise<CultureType[]>} The culture types list
   */
  public async getAllCultureTypes(
    page: number, 
    limit: number, 
    search?: string, 
    status?: "active" | "inactive"
  ): Promise<CultureType[]> {
    const conditions = [];

    // Status filter
    if (status === "active") {
      conditions.push(isNull(cultureTypes.deletedAt));
    } else if (status === "inactive") {
      conditions.push(isNotNull(cultureTypes.deletedAt));
    } else {
      // Default: only show active culture types
      conditions.push(isNull(cultureTypes.deletedAt));
    }

    // Search filter
    if (search) {
      conditions.push(
        ilike(cultureTypes.name, `%${search}%`)
      );
    }

    const cultureTypesList = await db.query.cultureTypes.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      offset: (page - 1) * limit,
      limit,
      orderBy: cultureTypes.createdAt,
    });

    return cultureTypesList.map(this.formatCultureType).filter(Boolean) as CultureType[];
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
      .innerJoin(cultureTypes, eq(applications.cultureId, cultureTypes.id))
      .where(
        and(
          isNull(cultureTypes.deletedAt),
          isNull(applications.deletedAt),
          gte(applications.date, startDate),
          lt(applications.date, adjustEndDate)
        )
      );
    
    const totalHectares = Number(result[0]?.totalHectares || 0);

    return totalHectares;
  }

  /**
   * @description Compare last month
   * @param {Date} startDate - The initial Date
   * @param {Date} endDate - The final Date
   * @returns {Promise<{cultureTypeName: string, month: string, applications: string}[]>} Return the CompareLastMonth
   */
  public async compareLastMonth(startDate: Date, endDate: Date): Promise<{
    cultureTypeName: string,
    month: string,
    applications: number,
    hectares: number
  }[]> {

    const comparasionStarDate = new Date(startDate);
    comparasionStarDate.setMonth(comparasionStarDate.getMonth() - 3);

    const comparisonEndDate = new Date(endDate);

    const adjustEndDateComparison = new Date(comparisonEndDate);
    adjustEndDateComparison.setDate(adjustEndDateComparison.getDate() + 1);

    const result = await db
      .select({
        cultureTypeName: cultureTypes.name,
        day: sql<string>`TO_CHAR(${applications.date}::timestamp, 'YYYY-MM-DD')`,
        applications: sql<number>`COUNT(${applications.id})`,
        hectares: sql<number>`COALESCE(SUM(${applications.hectares}), 0)`
      })
      .from(cultureTypes)
      .innerJoin(applications, eq(cultureTypes.id, applications.cultureId))
      .where(
        and(
          isNull(cultureTypes.deletedAt),
          isNull(applications.deletedAt),
          gte(applications.date, comparasionStarDate),
          lt(applications.date, adjustEndDateComparison)
        )
      )
      .groupBy(sql`${cultureTypes.name}, TO_CHAR(${applications.date}::timestamp, 'YYYY-MM-DD')`)
      .orderBy(sql`TO_CHAR(${applications.date}::timestamp, 'YYYY-MM-DD') DESC`);


      return result.map(r => ({
        cultureTypeName: r.cultureTypeName,
        day: r.day,
        month: DateTime.fromISO(r.day).toFormat('yyyy-MM'),
        applications: Number(r.applications),
        hectares: Number(r.hectares)
      }));;
  }

  /**
   * @description Update a culture type (only non-deleted)
   * @param {string} id - The culture type's ID
   * @param {Partial<typeof cultureTypes.$inferInsert>} data - The culture type data
   * @returns {Promise<CultureType | null>} The updated culture type
   */
  public async updateCultureType(
    id: string,
    data: Partial<typeof cultureTypes.$inferInsert>,
  ): Promise<CultureType | null> {
    const [cultureType] = await db.update(cultureTypes)
      .set(data)
      .where(and(eq(cultureTypes.id, id), isNull(cultureTypes.deletedAt)))
      .returning();

    return this.formatCultureType(cultureType);
  }

  /**
   * @description Soft delete a culture type (only non-deleted)
   * @param {string} id - The culture type's ID
   * @returns {Promise<void>}
   */
  public async deleteCultureType(id: string): Promise<void> {
    await db.update(cultureTypes)
      .set({ deletedAt: new Date() })
      .where(and(eq(cultureTypes.id, id), isNull(cultureTypes.deletedAt)));
  }

  /**
   * @description Hard delete a culture type (permanent)
   * @param {string} id - The culture type's ID
   * @returns {Promise<void>}
   */
  public async hardDeleteCultureType(id: string): Promise<void> {
    await db.delete(cultureTypes).where(eq(cultureTypes.id, id));
  }

  /**
   * @description Get culture types by their IDs (only non-deleted)
   * @param {string[]} ids - The culture types' IDs
   * @returns {Promise<CultureType[]>} The culture types
   */
  public async getCultureTypesByIds(ids: string[]): Promise<CultureType[]> {
    const list = await db.query.cultureTypes.findMany({
      where: and(inArray(cultureTypes.id, ids), isNull(cultureTypes.deletedAt)),
    });

    return list.filter(Boolean).map(this.formatCultureType) as CultureType[];
  }

  /**
   * @description Count total culture types (only non-deleted)
   * @returns {Promise<number>} The total count
   */
  public async countCultureTypes(search?: string, status?: "active" | "inactive"): Promise<number> {
    const conditions = [];

    // Status filter
    if (status === "active") {
      conditions.push(isNull(cultureTypes.deletedAt));
    } else if (status === "inactive") {
      conditions.push(isNotNull(cultureTypes.deletedAt));
    } else {
      // Default: only show active culture types
      conditions.push(isNull(cultureTypes.deletedAt));
    }

    // Search filter
    if (search) {
      conditions.push(
        ilike(cultureTypes.name, `%${search}%`)
      );
    }

    const result = await db.$count(
      cultureTypes, 
      conditions.length > 0 ? and(...conditions) : undefined
    );
    return result;
  }

  /**
   * @description Format a culture type
   * @param {typeof cultureTypes.$inferSelect} cultureType - The culture type
   * @returns {CultureType} The formatted culture type
   */
  private formatCultureType(cultureType?: typeof cultureTypes.$inferSelect | null): CultureType | null {
    if (!cultureType) return null;

    return {
      id: cultureType.id,
      name: cultureType.name,
      description: cultureType.description,
      createdAt: cultureType.createdAt,
      updatedAt: cultureType.updatedAt,
      deletedAt: cultureType.deletedAt,
    };
  }
} 