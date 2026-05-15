import { db } from "@infra/database";
import { farms, users, userTokens } from "@infra/database/schema";
import { and, asc, count, desc, eq, ilike, inArray, isNotNull, isNull, or } from "drizzle-orm";
import { CreateUser, User, UserOrderBy, UserOrderType, UserType } from "./user.types";

export class UserRepository {
  /**
   * @description Create a new user
   * @param {CreateUser} data - The user data
   * @returns {Promise<User>} The created user
   */
  public async createUser({
    email,
    name,
    password,
    customerId,
    type = "backoffice" as UserType,
  }: CreateUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        email,
        name,
        password,
        type,
        customerId,
      })
      .returning();

    if (!user) {
      throw new Error("Failed to create user");
    }

    return this.formatUser(user)!;
  }

  /**
   * @description Get a user by ID
   * @param {string} id - The user's ID
   * @returns {Promise<User | null>} The user
   */
  public async getUserById(id: string): Promise<User | null> {
    const user = await db.query.users.findFirst({
      where: and(eq(users.id, id), isNull(users.deletedAt)),
    });

    return this.formatUser(user);
  }

  /**
   * @description Get a user by email
   * @param {string} email - The user's email
   * @returns {Promise<User | null>} The user
   */
  public async getUserByEmail(email: string): Promise<User | null> {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    return this.formatUser(user);
  }

  /**
   * @description Update a user
   * @param {string} id - The user's ID
   * @param {Partial<typeof users.$inferInsert>} data - The user data
   * @returns {Promise<User | null>} The updated user
   */
  public async updateUser(
    id: string,
    data: Partial<typeof users.$inferInsert>,
  ): Promise<User | null> {
    const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();

    return this.formatUser(user);
  }

  /**
   * @description Disable a user
   * @param {string} id - The user's ID
   * @returns {Promise<void>} The disabled user
   */
  public async disableUser(id: string): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.update(users).set({ deletedAt: new Date() }).where(eq(users.id, id));
      await tx.delete(userTokens).where(eq(userTokens.userId, id));
    });
  }

  /**
   * @description Enable a user
   * @param {string} id - The user's ID
   * @returns {Promise<void>} The enabled user
   */
  public async enableUser(id: string): Promise<void> {
    await db.update(users).set({ deletedAt: null }).where(eq(users.id, id));
  }

  /**
   * @description Get users by their IDs
   * @param {string[]} ids - The users' IDs
   * @returns {Promise<User[]>} The users
   */
  public async getUsersByIds(ids: string[]): Promise<User[]> {
    const list = await db.query.users.findMany({
      where: inArray(users.id, ids),
    });

    return list.filter(Boolean).map(this.formatUser) as User[];
  }

  /**
   * @description Update user type
   * @param {string} userId - The user's ID
   * @param {UserType} type - The user type
   */
  public async updateUserType(userId: string, type: UserType) {
    const [user] = await db.update(users).set({ type }).where(eq(users.id, userId)).returning();
    return this.formatUser(user);
  }

  /**
   * @description Get all users with pagination, optional search and filters
   * @param {number} page - The page number
   * @param {number} limit - The limit per page
   * @param {string} search - Optional search term to filter by name or email
   * @param {object} filters - Optional filters for type and status
   * @returns {Promise<User[]>} The users list
   */
  public async getAllUsers(
    page: number,
    limit: number,
    search?: string,
    filters?: {
      type?: "backoffice" | "pilot" | "farmer";
      status?: "active" | "inactive" | "all";
    },
    orderBy?: UserOrderBy,
    orderType?: UserOrderType,
  ): Promise<User[]> {
    // Build where conditions
    const whereConditions = [];

    // Search conditions
    if (search) {
      whereConditions.push(
        or(
          ilike(users.name, `%${search}%`),
          ilike(users.email, `%${search}%`)
        )
      );
    }

    // Filter conditions
    if (filters?.type) {
      whereConditions.push(eq(users.type, filters.type));
    }

    if (filters?.status === "active") {
      whereConditions.push(isNull(users.deletedAt));
    } else if (filters?.status === "inactive") {
      whereConditions.push(isNotNull(users.deletedAt));
    } else if (filters?.status === "all") {
      // Keep both active and inactive users.
    } else {
      // Default behavior: only show active users if no status filter is specified
      whereConditions.push(isNull(users.deletedAt));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    let orderByExpression;

    switch (orderBy) {
      case UserOrderBy.NAME: 
        orderByExpression =  orderType === UserOrderType.ASC ? asc(users.name) : desc(users.name);
        break;
      case UserOrderBy.CREATEDAT:
        orderByExpression = orderType === UserOrderType.ASC ? asc(users.createdAt) : desc(users.createdAt);
        break;
      default:
        orderByExpression = desc(users.createdAt);
    }

    const usersList = await db.query.users.findMany({
      where: whereClause,
      orderBy: [orderByExpression],
      offset: (page - 1) * limit,
      limit,
    });

    return usersList.map(this.formatUser).filter(Boolean) as User[];
  }

  /**
   * @description Count users with optional search and filters
   * @param {string} search - Optional search term to filter by name or email
   * @param {object} filters - Optional filters for type and status
   * @returns {Promise<number>} The count of users
   */
  public async countUsers(
    search?: string,
    filters?: {
      type?: "backoffice" | "pilot" | "farmer";
      status?: "active" | "inactive" | "all";
    }
  ): Promise<number> {
    // Build where conditions
    const whereConditions = [];

    // Search conditions
    if (search) {
      whereConditions.push(
        or(
          ilike(users.name, `%${search}%`),
          ilike(users.email, `%${search}%`)
        )
      );
    }

    // Filter conditions
    if (filters?.type) {
      whereConditions.push(eq(users.type, filters.type));
    }

    if (filters?.status === "active") {
      whereConditions.push(isNull(users.deletedAt));
    } else if (filters?.status === "inactive") {
      whereConditions.push(isNotNull(users.deletedAt));
    } else if (filters?.status === "all") {
      // Keep both active and inactive users.
    } else {
      // Default behavior: only count active users if no status filter is specified
      whereConditions.push(isNull(users.deletedAt));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    const [result] = await db
      .select({ count: count() })
      .from(users)
      .where(whereClause);

    return result.count;
  }

  /**
   * @description Format a user
   * @param {typeof users.$inferSelect} user - The user
   * @returns {User} The formatted user
   */
  private formatUser(user?: typeof users.$inferSelect | null): User | null {
    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      password: user.password,
      type: user.type as UserType,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      deletedAt: user.deletedAt,
      customerId: user.customerId,
    };
  }
}
