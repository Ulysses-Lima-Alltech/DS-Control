import { db } from "@infra/database";
import { contracts, customers } from "@infra/database/schema";
import { and, asc, count, desc, eq, ilike, inArray, isNull, or } from "drizzle-orm";
import { Contract, ContractOrderBy, ContractOrderType, ContractWithCustomer, CreateContract } from "./contract.types";

export class ContractRepository {
  /**
   * @description Create a new contract
   * @param {CreateContract} data - The contract data
   * @returns {Promise<Contract>} The created contract
   */
  public async createContract({
    customerId,
    name,
    dateStart,
    dateEnd,
    observation,
  }: CreateContract): Promise<Contract> {
    const [contract] = await db
      .insert(contracts)
      .values({
        customerId,
        name,
        date_start: dateStart,
        date_end: dateEnd,
        observation,
      })
      .returning();

    if (!contract) {
      throw new Error("Failed to create contract");
    }

    return this.formatContract(contract)!;
  }

  /**
   * @description Get a contract by ID
   * @param {string} id - The contract's ID
   * @returns {Promise<Contract | null>} The contract
   */
  public async getContractById(id: string): Promise<Contract | null> {
    const contract = await db.query.contracts.findFirst({
      where: and(eq(contracts.id, id), isNull(contracts.deletedAt)),
    });

    return this.formatContract(contract);
  }

  /**
   * @description Get a contract by ID with related customer
   * @param {string} id - The contract's ID
   * @returns {Promise<ContractWithCustomer | null>} The contract with customer
   */
  public async getContractWithCustomerById(id: string): Promise<ContractWithCustomer | null> {
    const contract = await db.query.contracts.findFirst({
      where: and(eq(contracts.id, id), isNull(contracts.deletedAt)),
      with: {
        customer: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!contract) return null;

    return this.formatContractWithCustomer(contract);
  }

  /**
   * @description Get all contracts
   * @returns {Promise<Contract[]>} The contracts list
   */
  public async getAllContracts(): Promise<Contract[]> {
    const contractsList = await db.query.contracts.findMany();

    return contractsList.map(this.formatContract).filter(Boolean) as Contract[];
  }

  /**
   * @description Get all contracts with related customer and optional search
   * @param {number} page - Page number
   * @param {number} limit - Items per page
   * @param {string} search - Optional search term to filter by contract name or customer name
   * @returns {Promise<ContractWithCustomer[]>} The contracts list with customer
   */
  public async getAllContractsWithCustomer(page: number, limit: number, search?: string, orderBy?: ContractOrderBy, orderType?: ContractOrderType): Promise<ContractWithCustomer[]> {

    const whereClause = search 
      ? or(
          ilike(contracts.name, `%${search}%`),
          ilike(customers.name, `%${search}%`)
        ) : undefined;

    let orderByExpression;

    switch (orderBy) {
      case ContractOrderBy.NAME:
        orderByExpression = orderType === ContractOrderType.ASC ? asc(contracts.name) : desc(contracts.name);
        break;
      case ContractOrderBy.CREATEDAT:
        orderByExpression = orderType === ContractOrderType.ASC ? asc(contracts.createdAt) : desc(contracts.createdAt);
        break;
      default:
        orderByExpression = desc(contracts.createdAt);
    }

    const contractsList = await db.query.contracts.findMany({
      where: whereClause,
      orderBy: [orderByExpression],
      with: {
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

    return contractsList.map(this.formatContractWithCustomer).filter(Boolean) as ContractWithCustomer[];
  }

  /**
   * @description Get count of contracts with optional search
   * @param {string} search - Optional search term to filter by contract name or customer name
   * @returns {Promise<number>} The count of contracts
   */
  public async getContractsCount(search?: string): Promise<number> {
    if (!search) {
      const [result] = await db
        .select({ count: count() })
        .from(contracts);
      return result.count;
    }

    // When searching, we need to join with customers table
    const [result] = await db
      .select({ count: count() })
      .from(contracts)
      .leftJoin(customers, eq(contracts.customerId, customers.id))
      .where(
        or(
          ilike(contracts.name, `%${search}%`),
          ilike(customers.name, `%${search}%`)
        )
      );

    return result.count;
  }

  /**
   * @description Get contracts by customer ID
   * @param {string} customerId - The customer's ID
   * @returns {Promise<Contract[]>} The contracts list
   */
  public async getContractsByCustomerId(customerId: string): Promise<Contract[]> {
    const contractsList = await db.query.contracts.findMany({
      where: eq(contracts.customerId, customerId),
    });

    return contractsList.map(this.formatContract).filter(Boolean) as Contract[];
  }

  /**
   * @description Get contracts by customer ID with related customer
   * @param {string} customerId - The customer's ID
   * @returns {Promise<ContractWithCustomer[]>} The contracts list with customer
   */
  public async getContractsByCustomerIdWithCustomer(
    customerId: string,
    page: number,
    limit: number,
  ): Promise<ContractWithCustomer[]> {
    const contractsList = await db.query.contracts.findMany({
      where: eq(contracts.customerId, customerId),
      with: {
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

    return contractsList.map(this.formatContractWithCustomer).filter(Boolean) as ContractWithCustomer[];
  }

  /**
   * @description Update a contract
   * @param {string} id - The contract's ID
   * @param {Partial<typeof contracts.$inferInsert>} data - The contract data
   * @returns {Promise<Contract | null>} The updated contract
   */
  public async updateContract(
    id: string,
    data: Partial<typeof contracts.$inferInsert>,
  ): Promise<Contract | null> {
    const [contract] = await db.update(contracts).set(data).where(eq(contracts.id, id)).returning();

    return this.formatContract(contract);
  }

  /**
  //  * @description soft Delete a contract (only non-deleted)
  //  * @param {string} id - The contract's ID
  //  * @returns {Promise<void>}
  //  */
  public async deleteContract(id: string): Promise<void> {
    await db.update(contracts)
      .set({ deletedAt: new Date() })
      .where(and(eq(contracts.id, id), isNull(contracts.deletedAt)));
  }

  /**
   * @description Get contracts by their IDs
   * @param {string[]} ids - The contracts' IDs
   * @returns {Promise<Contract[]>} The contracts
   */
  public async getContractsByIds(ids: string[]): Promise<Contract[]> {
    const list = await db.query.contracts.findMany({
      where: inArray(contracts.id, ids),
    });

    return list.filter(Boolean).map(this.formatContract) as Contract[];
  }

  /**
   * @description Format a contract
   * @param {typeof contracts.$inferSelect} contract - The contract
   * @returns {Contract} The formatted contract
   */
  private formatContract(contract?: typeof contracts.$inferSelect | null): Contract | null {
    if (!contract) return null;

    return {
      id: contract.id,
      customerId: contract.customerId!,
      name: contract.name,
      dateStart: contract.date_start,
      dateEnd: contract.date_end,
      observation: contract.observation,
      createdAt: contract.createdAt,
      updatedAt: contract.updatedAt,
      deletedAt: contract.deletedAt,
    };
  }

  /**
   * @description Format a contract with customer
   * @param {object} contract - The contract with customer
   * @returns {ContractWithCustomer} The formatted contract with customer
   */
  private formatContractWithCustomer(contract?: { 
    id: string; 
    customerId: string | null;
    name: string;
    date_start: Date;
    date_end: Date;
    observation: string | null;
    createdAt: Date; 
    updatedAt: Date | null;
    deletedAt: Date | null
    customer: {
      id: string;
      name: string;
    } | null;
  }): ContractWithCustomer | null {
    if (!contract || !contract.customer) return null;

    return {
      id: contract.id,
      customerId: contract.customerId!,
      name: contract.name,
      dateStart: contract.date_start,
      dateEnd: contract.date_end,
      observation: contract.observation,
      createdAt: contract.createdAt,
      updatedAt: contract.updatedAt,
      customer: contract.customer,
      deletedAt: contract.deletedAt,
    };
  }
} 