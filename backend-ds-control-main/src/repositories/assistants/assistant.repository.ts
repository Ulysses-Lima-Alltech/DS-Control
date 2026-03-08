import { db } from "@infra/database";
import { assistants } from "@infra/database/schema";
import { and, count, eq, ilike, inArray, isNotNull, isNull } from "drizzle-orm";
import type { Assistant, CreateAssistant } from "./assistant.types";

export class AssistantRepository {
  /**
   * @description Create a new assistant
   * @param {CreateAssistant} data - The assistant data
   * @returns {Promise<Assistant>} The created assistant
   */
  public async createAssistant({
    name,
  }: CreateAssistant): Promise<Assistant> {
    const [assistant] = await db
      .insert(assistants)
      .values({
        name,
      })
      .returning();

    if (!assistant) {
      throw new Error("Failed to create assistant");
    }

    return this.formatAssistant(assistant)!;
  }

  /**
   * @description Get an assistant by ID (only non-deleted)
   * @param {string} id - The assistant's ID
   * @returns {Promise<Assistant | null>} The assistant
   */
  public async getAssistantById(id: string): Promise<Assistant | null> {
    const assistant = await db.query.assistants.findFirst({
      where: and(eq(assistants.id, id), isNull(assistants.deletedAt)),
    });

    return this.formatAssistant(assistant);
  }

  /**
   * @description Get all assistants with optional search and status filter
   * @param {number} page - The page number
   * @param {number} limit - The limit per page
   * @param {string} search - Optional search term to filter by name
   * @param {string} status - Optional status filter (active/inactive)
   * @returns {Promise<Assistant[]>} The assistants list
   */
  public async getAllAssistants(
    page: number, 
    limit: number,
    search?: string,
    status?: "active" | "inactive"
  ): Promise<Assistant[]> {
    // Build where conditions
    const whereConditions = [];

    // Search conditions
    if (search) {
      whereConditions.push(ilike(assistants.name, `%${search}%`));
    }

    // Status filter conditions
    if (status) {
      if (status === "active") {
        whereConditions.push(isNull(assistants.deletedAt));
      } else if (status === "inactive") {
        whereConditions.push(isNotNull(assistants.deletedAt));
      }
    } else {
      // Default behavior: only show active assistants if no status filter is specified
      whereConditions.push(isNull(assistants.deletedAt));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    const assistantsList = await db.query.assistants.findMany({
      where: whereClause,
      offset: (page - 1) * limit,
      limit,
      orderBy: (assistants, { desc }) => [desc(assistants.createdAt)],
    });

    return assistantsList.map(this.formatAssistant).filter(Boolean) as Assistant[];
  }

  /**
   * @description Update an assistant (only non-deleted)
   * @param {string} id - The assistant's ID
   * @param {Partial<typeof assistants.$inferInsert>} data - The assistant data
   * @returns {Promise<Assistant | null>} The updated assistant
   */
  public async updateAssistant(
    id: string,
    data: Partial<typeof assistants.$inferInsert>,
  ): Promise<Assistant | null> {
    const [assistant] = await db.update(assistants)
      .set(data)
      .where(and(eq(assistants.id, id), isNull(assistants.deletedAt)))
      .returning();

    return this.formatAssistant(assistant);
  }

  /**
   * @description Soft delete an assistant (only non-deleted)
   * @param {string} id - The assistant's ID
   * @returns {Promise<void>}
   */
  public async deleteAssistant(id: string): Promise<void> {
    await db.update(assistants)
      .set({ deletedAt: new Date() })
      .where(and(eq(assistants.id, id), isNull(assistants.deletedAt)));
  }

  /**
   * @description Hard delete an assistant (permanent)
   * @param {string} id - The assistant's ID
   * @returns {Promise<void>}
   */
  public async hardDeleteAssistant(id: string): Promise<void> {
    await db.delete(assistants).where(eq(assistants.id, id));
  }

  /**
   * @description Get assistants by their IDs (only non-deleted)
   * @param {string[]} ids - The assistants' IDs
   * @returns {Promise<Assistant[]>} The assistants
   */
  public async getAssistantsByIds(ids: string[]): Promise<Assistant[]> {
    const list = await db.query.assistants.findMany({
      where: and(inArray(assistants.id, ids), isNull(assistants.deletedAt)),
    });

    return list.filter(Boolean).map(this.formatAssistant) as Assistant[];
  }

  /**
   * @description Count assistants with optional search and status filter
   * @param {string} search - Optional search term to filter by name
   * @param {string} status - Optional status filter (active/inactive)
   * @returns {Promise<number>} The count of assistants
   */
  public async countAssistants(
    search?: string,
    status?: "active" | "inactive"
  ): Promise<number> {
    if (!search && !status) {
      // Default behavior: count only active assistants
      const result = await db.$count(assistants, isNull(assistants.deletedAt));
      return result;
    }

    // Build where conditions
    const whereConditions = [];

    // Search conditions
    if (search) {
      whereConditions.push(ilike(assistants.name, `%${search}%`));
    }

    // Status filter conditions
    if (status) {
      if (status === "active") {
        whereConditions.push(isNull(assistants.deletedAt));
      } else if (status === "inactive") {
        whereConditions.push(isNotNull(assistants.deletedAt));
      }
    } else {
      // Default behavior: only count active assistants if no status filter is specified
      whereConditions.push(isNull(assistants.deletedAt));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    const [result] = await db
      .select({ count: count() })
      .from(assistants)
      .where(whereClause);

    return result.count;
  }

  /**
   * @description Format an assistant
   * @param {typeof assistants.$inferSelect} assistant - The assistant
   * @returns {Assistant} The formatted assistant
   */
  private formatAssistant(assistant?: typeof assistants.$inferSelect | null): Assistant | null {
    if (!assistant) return null;

    return {
      id: assistant.id,
      name: assistant.name,
      createdAt: assistant.createdAt,
      updatedAt: assistant.updatedAt,
      deletedAt: assistant.deletedAt,
    };
  }
} 