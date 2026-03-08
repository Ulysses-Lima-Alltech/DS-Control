import { db } from "@infra/database";
import { products } from "@infra/database/schema";
import { and, count, eq, ilike, inArray, isNotNull, isNull } from "drizzle-orm";
import type { CreateProduct, Product } from "./product.types";

export class ProductRepository {
  /**
   * @description Create a new product
   * @param {CreateProduct} data - The product data
   * @returns {Promise<Product>} The created product
   */
  public async createProduct({
    name,
  }: CreateProduct): Promise<Product> {
    const [product] = await db
      .insert(products)
      .values({
        name,
      })
      .returning();

    if (!product) {
      throw new Error("Failed to create product");
    }

    return this.formatProduct(product)!;
  }

  /**
   * @description Get a product by ID (only non-deleted)
   * @param {string} id - The product's ID
   * @returns {Promise<Product | null>} The product
   */
  public async getProductById(id: string): Promise<Product | null> {
    const product = await db.query.products.findFirst({
      where: and(eq(products.id, id), isNull(products.deletedAt)),
    });

    return this.formatProduct(product);
  }

  /**
   * @description Get all products with optional search and status filter
   * @param {number} page - The page number
   * @param {number} limit - The limit per page
   * @param {string} search - Optional search term to filter by name
   * @param {string} status - Optional status filter (active/inactive)
   * @returns {Promise<Product[]>} The products list
   */
  public async getAllProducts(
    page: number,
    limit: number,
    search?: string,
    status?: "active" | "inactive"
  ): Promise<Product[]> {
    // Build where conditions
    const whereConditions = [];

    // Search conditions
    if (search) {
      whereConditions.push(ilike(products.name, `%${search}%`));
    }

    // Status filter conditions
    if (status) {
      if (status === "active") {
        whereConditions.push(isNull(products.deletedAt));
      } else if (status === "inactive") {
        whereConditions.push(isNotNull(products.deletedAt));
      }
    } else {
      // Default behavior: only show active products if no status filter is specified
      whereConditions.push(isNull(products.deletedAt));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    const productsList = await db.query.products.findMany({
      where: whereClause,
      offset: (page - 1) * limit,
      limit,
      orderBy: (products, { desc }) => [desc(products.createdAt)],
    });

    return productsList.map(this.formatProduct).filter(Boolean) as Product[];
  }

  /**
   * @description Update a product (only non-deleted)
   * @param {string} id - The product's ID
   * @param {Partial<typeof products.$inferInsert>} data - The product data
   * @returns {Promise<Product | null>} The updated product
   */
  public async updateProduct(
    id: string,
    data: Partial<typeof products.$inferInsert>,
  ): Promise<Product | null> {
    const [product] = await db.update(products)
      .set(data)
      .where(and(eq(products.id, id), isNull(products.deletedAt)))
      .returning();

    return this.formatProduct(product);
  }

  /**
   * @description Soft delete a product (only non-deleted)
   * @param {string} id - The product's ID
   * @returns {Promise<void>}
   */
  public async deleteProduct(id: string): Promise<void> {
    await db.update(products)
      .set({ deletedAt: new Date() })
      .where(and(eq(products.id, id), isNull(products.deletedAt)));
  }

  /**
   * @description Hard delete a product (permanent)
   * @param {string} id - The product's ID
   * @returns {Promise<void>}
   */
  public async hardDeleteProduct(id: string): Promise<void> {
    await db.delete(products).where(eq(products.id, id));
  }

  /**
   * @description Get products by their IDs (only non-deleted)
   * @param {string[]} ids - The products' IDs
   * @returns {Promise<Product[]>} The products
   */
  public async getProductsByIds(ids: string[]): Promise<Product[]> {
    const list = await db.query.products.findMany({
      where: and(inArray(products.id, ids), isNull(products.deletedAt)),
    });

    return list.filter(Boolean).map(this.formatProduct) as Product[];
  }

  /**
   * @description Count products with optional search and status filter
   * @param {string} search - Optional search term to filter by name
   * @param {string} status - Optional status filter (active/inactive)
   * @returns {Promise<number>} The count of products
   */
  public async countProducts(
    search?: string,
    status?: "active" | "inactive"
  ): Promise<number> {
    if (!search && !status) {
      // Default behavior: count only active products
      const result = await db.$count(products, isNull(products.deletedAt));
      return result;
    }

    // Build where conditions
    const whereConditions = [];

    // Search conditions
    if (search) {
      whereConditions.push(ilike(products.name, `%${search}%`));
    }

    // Status filter conditions
    if (status) {
      if (status === "active") {
        whereConditions.push(isNull(products.deletedAt));
      } else if (status === "inactive") {
        whereConditions.push(isNotNull(products.deletedAt));
      }
    } else {
      // Default behavior: only count active products if no status filter is specified
      whereConditions.push(isNull(products.deletedAt));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    const [result] = await db
      .select({ count: count() })
      .from(products)
      .where(whereClause);

    return result.count;
  }

  /**
   * @description Format a product
   * @param {typeof products.$inferSelect} product - The product
   * @returns {Product} The formatted product
   */
  private formatProduct(product?: typeof products.$inferSelect | null): Product | null {
    if (!product) return null;

    return {
      id: product.id,
      name: product.name,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      deletedAt: product.deletedAt,
    };
  }
} 