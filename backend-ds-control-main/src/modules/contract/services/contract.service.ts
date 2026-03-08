import AppError from "@common/handlers/app-error";
import { HTTP_STATUS_CODES } from "@common/types/http-status.types";
import { db } from "@infra/database";
import { contracts, customers } from "@infra/database/schema";
import { and, count, eq } from "drizzle-orm";

import type { PaginatedRequest } from "@common/types/paginated-request.types";
import {
  ContractVM,
  type ContractWithCustomerViewModel,
  type ContractWithCustomerViewModelSchema,
} from "@models/contract.vm";
import { app } from "@modules/app/app.module";
import { ContractRepository } from "@repositories/contracts/contract.repository";
import type { ContractOrderBy, ContractOrderType, ContractWithCustomer } from "@repositories/contracts/contract.types";
import type { CreateContractDTO } from "../dto/create-contract.dto";
import type { UpdateContractDTO } from "../dto/update-contract.dto";

export class ContractService {
  private readonly contractRepository = new ContractRepository();

  /**
   * @description Create a new contract
   * @param {CreateContractDTO} data - The contract data
   * @throws {AppError} If the customer doesn't exist or validation fails
   */
  public async createContract({ customerId, name, dateStart, dateEnd, observation }: CreateContractDTO): Promise<void> {
    app.log.info("[ContractService] - Starting contract creation for customer %s", customerId);

    // Validate that customer exists
    const customer = await db.query.customers.findFirst({
      where: eq(customers.id, customerId),
    });

    if (!customer) {
      app.log.warn("[ContractService] - Contract creation failed: Customer %s not found", customerId);
      throw new AppError("Cliente não encontrado", HTTP_STATUS_CODES.NOT_FOUND);
    }

    // Check if contract name already exists for this customer
    const existingContract = await db.query.contracts.findFirst({
      where: and(eq(contracts.name, name), eq(contracts.customerId, customerId)),
    });

    if (existingContract) {
      app.log.warn(
        "[ContractService] - Contract creation failed: Contract name %s already exists for customer %s",
        name,
        customerId,
      );
      throw new AppError(
        "Já existe contrato com este nome para esse cliente",
        HTTP_STATUS_CODES.CONFLICT,
      );
    }

    // Create the contract
    const contract = await this.contractRepository.createContract({
      customerId,
      name,
      dateStart,
      dateEnd,
      observation,
    });

    app.log.info("[ContractService] - Contract created successfully with ID %s", contract.id);
  }

  /**
   * @description Get all contracts with customer and optional search
   * @param {number} page - Page number
   * @param {number} limit - Items per page
   * @param {string} search - Optional search term to filter by contract name or customer name
   * @returns {Promise<ContractWithCustomer[]>} The list of contracts with customer
   */
  public async listContracts(
    page: number,
    limit: number,
    search?: string,
    orderBy?: ContractOrderBy,
    orderType?: ContractOrderType
  ): Promise<PaginatedRequest<typeof ContractWithCustomerViewModelSchema>> {
    app.log.info("[ContractService] - Listing all contracts with customer");

    const queryResult = await this.contractRepository.getAllContractsWithCustomer(page, limit, search, orderBy, orderType);
    const totalCount = await this.contractRepository.getContractsCount(search);

    app.log.info("[ContractService] - Retrieved %d contracts", totalCount);

    return {
      data: queryResult.map((contract) => ContractVM.toViewModelWithCustomer(contract)),
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
      totalCount,
    };
  }

  /**
   * @description Get contract by ID with customer
   * @param {string} contractId - The contract's ID
   * @returns {Promise<ContractWithCustomerViewModel>} The contract details with customer
   * @throws {AppError} If the contract is not found
   */
  public async getContractById(contractId: string): Promise<ContractWithCustomer> {
    app.log.info("[ContractService] - Fetching contract details for contract %s", contractId);

    try {
      const contract = await this.contractRepository.getContractWithCustomerById(contractId);

      if (!contract) {
        app.log.warn("[ContractService] - Contract not found: %s", contractId);
        throw new AppError("Contrato não encontrado", HTTP_STATUS_CODES.NOT_FOUND);
      }

      app.log.info("[ContractService] - Successfully retrieved contract details for %s", contractId);
      return contract;
    } catch (error) {
      app.log.error("[ContractService] - Failed to fetch contract details: %s", error);
      throw error;
    }
  }

  /**
   * @description Get contracts by customer ID with customer
   * @param {string} customerId - The customer's ID
   * @returns {Promise<ContractWithCustomer[]>} The list of contracts for the customer
   */
  public async getContractsByCustomerId(
    customerId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedRequest<typeof ContractWithCustomerViewModelSchema>> {
    app.log.info("[ContractService] - Fetching contracts for customer %s", customerId);

    // Validate that customer exists
    const customer = await db.query.customers.findFirst({
      where: eq(customers.id, customerId),
    });

    if (!customer) {
      app.log.warn("[ContractService] - Customer not found: %s", customerId);
      throw new AppError("Cliente não encontrado", HTTP_STATUS_CODES.NOT_FOUND);
    }

    const queryResult = await this.contractRepository.getContractsByCustomerIdWithCustomer(
      customerId,
      page,
      limit,
    );
    const [countResult] = await db.select({ count: count() }).from(contracts).where(eq(contracts.customerId, customerId));

    app.log.info("[ContractService] - Retrieved %d contracts for customer %s", countResult.count, customerId);
    
    return {
      data: queryResult.map((contract) => ContractVM.toViewModelWithCustomer(contract)),
      page,
      limit,
      totalPages: Math.ceil(countResult.count / limit),
      totalCount: countResult.count,
    };
  }

  /**
   * @description Update contract by ID
   * @param {string} contractId - The contract's ID
   * @param {UpdateContractDTO} data - The contract data to update
   * @returns {Promise<ContractWithCustomer>} The updated contract with customer
   * @throws {AppError} If the contract is not found or validation fails
   */
  public async updateContract(contractId: string, data: UpdateContractDTO): Promise<ContractWithCustomer> {
    app.log.info("[ContractService] - Starting contract update for contract %s", contractId);

    try {
      const existingContract = await this.contractRepository.getContractById(contractId);

      if (!existingContract) {
        app.log.warn("[ContractService] - Contract update failed: Contract %s not found", contractId);
        throw new AppError("Contrato não encontrado", HTTP_STATUS_CODES.NOT_FOUND);
      }

      if (data.customerId && data.customerId !== existingContract.customerId) {
        const customer = await db.query.customers.findFirst({
          where: eq(customers.id, data.customerId),
        });

        if (!customer) {
          app.log.warn(
            "[ContractService] - Contract update failed: Customer %s not found",
            data.customerId,
          );
          throw new AppError("Cliente não encontrado", HTTP_STATUS_CODES.NOT_FOUND);
        }
      }

      if (data.name && data.name !== existingContract.name) {
        const customerId = data.customerId || existingContract.customerId;
        const nameExists = await db.query.contracts.findFirst({
          where: and(eq(contracts.name, data.name), eq(contracts.customerId, customerId)),
        });

        if (nameExists) {
          app.log.warn(
            "[ContractService] - Contract update failed: Contract name %s already exists for customer %s",
            data.name,
            customerId,
          );
          throw new AppError(
            "Já existe contrato com este nome para esse cliente",
            HTTP_STATUS_CODES.CONFLICT,
          );
        }
      }

      const updateData: { 
        customerId?: string; 
        name?: string; 
        date_start?: Date; 
        date_end?: Date; 
        observation?: string | null; 
      } = {};
      
      if (data.customerId) updateData.customerId = data.customerId;
      if (data.name) updateData.name = data.name;
      if (data.dateStart) updateData.date_start = data.dateStart;
      if (data.dateEnd) updateData.date_end = data.dateEnd;
      if (data.observation) updateData.observation = data.observation;

      if (Object.keys(updateData).length > 0) {
        await this.contractRepository.updateContract(contractId, updateData);
      }

      const updatedContract = await this.contractRepository.getContractWithCustomerById(contractId);

      if (!updatedContract) {
        app.log.error(
          "[ContractService] - Contract update failed: Unable to retrieve updated contract %s",
          contractId,
        );
        throw new AppError("Falha ao atualizar o contrato", HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR);
      }

      app.log.info("[ContractService] - Contract updated successfully with ID %s", contractId);
      return updatedContract;
    } catch (error) {
      app.log.error("[ContractService] - Contract update failed: %s", error);
      throw error;
    }
  }

  /**
   * @description Delete a contract
   * @param {string} contractId - The contract's ID to delete
   * @returns {Promise<void>}
   * @throws {AppError} If the contract is not found
   */
  public async deleteContract(contractId: string): Promise<void> {
    app.log.info("[ContractService] - Starting contract deletion for contract %s", contractId);

    try {
      // Check if contract exists
      const existingContract = await this.contractRepository.getContractById(contractId);

      if (!existingContract) {
        app.log.warn("[ContractService] - Contract deletion failed: Contract %s not found", contractId);
        throw new AppError("Contrato não encontrado", HTTP_STATUS_CODES.NOT_FOUND);
      }

      await this.contractRepository.deleteContract(contractId);

      app.log.info("[ContractService] - Contract deleted successfully with ID %s", contractId);
    } catch (error) {
      app.log.error("[ContractService] - Contract deletion failed: %s", error);
      throw error;
    }
  }
} 