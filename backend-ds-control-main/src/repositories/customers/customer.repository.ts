import { db } from "@infra/database";
import { customers, customerTypeEnum } from "@infra/database/schema";
import { count, eq, ilike, inArray, isNull, or, and, desc, asc } from "drizzle-orm";
import { CreateCustomer, Customer, CustomerOrderBy, CustomerOrderType } from "./customer.types";

export class CustomerRepository {
  /**
   * @description Create a new customer
   * @param {CreateCustomer} data - The customer data
   * @returns {Promise<Customer>} The created customer
   */
  public async createCustomer({
    document_number,
    entity_type,
    phone,
    name,
    razaoSocial,
  }: CreateCustomer): Promise<Customer> {
    const [customer] = await db
      .insert(customers)
      .values({
        document_number,
        entity_type,
        phone,
        name,
        razaoSocial,
      })
      .returning();

    if (!customer) {
      throw new Error("Failed to create customer");
    }

    return this.formatCustomer(customer)!;
  }

  /**
   * @description Get a customer by ID
   * @param {string} id - The customer's ID
   * @returns {Promise<Customer | null>} The customer
   */
  public async getCustomerById(id: string): Promise<Customer | null> {
    const customer = await db.query.customers.findFirst({
      where: and(eq(customers.id, id), isNull(customers.deletedAt)),
    });

    return this.formatCustomer(customer);
  }

  /**
   * @description Get a customer by CNPJ | CPF
   * @param {string} document_number - The customer's CNPJ | CPF
   * @returns {Promise<Customer | null>} The customer
   */
  public async getCustomerByCnpj(document_number: string): Promise<Customer | null> {
    const customer = await db.query.customers.findFirst({
      where: eq(customers.document_number, document_number),
    });

    return this.formatCustomer(customer);
  }

  /**
   * @description Get all customers with optional search
   * @param {number} page - Page number
   * @param {number} limit - Items per page  
   * @param {string} search - Optional search term to filter by name or razaoSocial
   * @returns {Promise<Customer[]>} The customers list
   */
  public async getAllCustomers(page: number, limit: number, search?: string, orderBy?: CustomerOrderBy, orderType?: CustomerOrderType): Promise<Customer[]> {
    const whereClause = search 
      ? and(
          or(
            ilike(customers.name, `%${search}%`),
            ilike(customers.razaoSocial, `%${search}%`)
        ), 
        isNull(customers.deletedAt)
      ) : isNull(customers.deletedAt);

    let orderByExpression;

    switch (orderBy) {
      case CustomerOrderBy.NAME:
        orderByExpression = orderType === CustomerOrderType.ASC ? asc(customers.name) : desc(customers.name);
        break;
      case CustomerOrderBy.CREATEDAT:
        orderByExpression = orderType === CustomerOrderType.ASC ? asc(customers.createdAt) : desc(customers.createdAt);
        break;
      default: 
        orderByExpression = desc(customers.createdAt);
    }

    const customersList = await db.query.customers.findMany({
      where: whereClause,
      orderBy: [orderByExpression],
      offset: (page - 1) * limit,
      limit,
    });

    return customersList.map(this.formatCustomer).filter(Boolean) as Customer[];
  }

  /**
   * @description Get count of customers with optional search
   * @param {string} search - Optional search term to filter by name or razaoSocial
   * @returns {Promise<number>} The count of customers
   */
  public async getCustomersCount(search?: string): Promise<number> {
    const whereClause = search 
      ? or(
          ilike(customers.name, `%${search}%`),
          ilike(customers.razaoSocial, `%${search}%`)
        )
      : undefined;

    const [result] = await db
      .select({ count: count() })
      .from(customers)
      .where(whereClause);

    return result.count;
  }

  /**
   * @description Update a customer
   * @param {string} id - The customer's ID
   * @param {Partial<typeof customers.$inferInsert>} data - The customer data
   * @returns {Promise<Customer | null>} The updated customer
   */
  public async updateCustomer(
    id: string,
    data: Partial<typeof customers.$inferInsert>,
  ): Promise<Customer | null> {
    const [customer] = await db.update(customers).set(data).where(eq(customers.id, id)).returning();

    return this.formatCustomer(customer);
  }

  /**
   * @description Soft delete a customer (only non-deleted)
   * @param {string} id - The customer's ID
   * @returns {Promise<void>}
   */
  public async deleteCustomer(id: string): Promise<void> {
    await db.update(customers)
      .set({deletedAt: new Date() })
      .where(and(eq(customers.id, id), isNull(customers.deletedAt)));
  }

  /**
   * @description Get customers by their IDs
   * @param {string[]} ids - The customers' IDs
   * @returns {Promise<Customer[]>} The customers
   */
  public async getCustomersByIds(ids: string[]): Promise<Customer[]> {
    const list = await db.query.customers.findMany({
      where: inArray(customers.id, ids),
    });

    return list.filter(Boolean).map(this.formatCustomer) as Customer[];
  }

  /**
   * @description Format a customer
   * @param {typeof customers.$inferSelect} customer - The customer
   * @returns {Customer} The formatted customer
   */
  private formatCustomer(customer?: typeof customers.$inferSelect | null): Customer | null {
    if (!customer) return null;

    return {
      id: customer.id,
      document_number: customer.document_number,
      entity_type: customer.entity_type,
      phone: customer.phone,
      name: customer.name,
      razaoSocial: customer.razaoSocial,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
      deletedAt: customer.deletedAt,
    };
  }
} 