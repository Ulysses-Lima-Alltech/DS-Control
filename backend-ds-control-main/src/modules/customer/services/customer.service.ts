import AppError from "@common/handlers/app-error";
import { HTTP_STATUS_CODES } from "@common/types/http-status.types";
import { db } from "@infra/database";
import { customers } from "@infra/database/schema";
import { eq } from "drizzle-orm";

import type { PaginatedRequest } from "@common/types/paginated-request.types";
import { CustomerVM, type CustomerViewModelSchema, type Customer as CustomerVMType } from "@models/customer.vm";
import { app } from "@modules/app/app.module";
import { CustomerRepository } from "@repositories/customers/customer.repository";
import type { Customer, CustomerOrderBy, CustomerOrderType } from "@repositories/customers/customer.types";
import type { CreateCustomerDTO } from "../dto/create-customer.dto";
import type { UpdateCustomerDTO } from "../dto/update-customer.dto";

export class CustomerService {
  private readonly customerRepository = new CustomerRepository();

  /**
   * @description Create a new customer
   * @param {CreateCustomerDTO} data - The customer data
   * @throws {AppError} If the customer already exists
   */
  public async createCustomer({
    document_number,
    entity_type,
    phone,
    name,
    razaoSocial,
  }: CreateCustomerDTO): Promise<void> {
    app.log.info("[CustomerService] - Starting customer creation for CNPJ or CPF %s", document_number);

    const existingCustomer = await db.query.customers.findFirst({
      where: eq(customers.document_number, document_number),
    });

    if (existingCustomer) {
      app.log.warn("[CustomerService] - Customer creation failed: CNPJ or CPF %s already exists", document_number);
      throw new AppError("Já existe cliente com este CNPJ ou CPF", HTTP_STATUS_CODES.CONFLICT);
    }

    const customer = await this.customerRepository.createCustomer({
      document_number,
      entity_type,
      phone,
      name,
      razaoSocial,
    });

    app.log.info("[CustomerService] - Customer created successfully with ID %s", customer.id);
  }

  /**
   * @description Get all customers with optional search
   * @param {number} page - Page number
   * @param {number} limit - Items per page
   * @param {string} search - Optional search term to filter by name or razaoSocial
   * @returns {Promise<Customer[]>} The list of customers
   */
  public async listCustomers(
    page: number,
    limit: number,
    search?: string,
    orderBy?: CustomerOrderBy,
    orderType?: CustomerOrderType,
  ): Promise<PaginatedRequest<typeof CustomerViewModelSchema>> {
    app.log.info("[CustomerService] - Listing all customers");

    const queryResult = await this.customerRepository.getAllCustomers(page, limit, search, orderBy, orderType);
    const totalCount = await this.customerRepository.getCustomersCount(search);

    app.log.info("[CustomerService] - Retrieved %d customers", totalCount);
    return {
      data: queryResult.map((customer) => CustomerVM.toViewModel(customer)),
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
      totalCount,
    };
  }

  /**
   * @description Get customer by ID
   * @param {string} customerId - The customer's ID
   * @returns {Promise<CustomerVMType>} The customer details
   * @throws {AppError} If the customer is not found
   */
  public async getCustomerById(customerId: string): Promise<CustomerVMType> {
    app.log.info("[CustomerService] - Fetching customer details for customer %s", customerId);

    try {
      const customer = await this.customerRepository.getCustomerById(customerId);

      if (!customer) {
        app.log.warn("[CustomerService] - Customer not found: %s", customerId);
        throw new AppError("Cliente não encontrado", HTTP_STATUS_CODES.NOT_FOUND);
      }

      app.log.info(
        "[CustomerService] - Successfully retrieved customer details for %s",
        customerId,
      );
      return customer as CustomerVMType;
    } catch (error) {
      app.log.error("[CustomerService] - Failed to fetch customer details: %s", error);
      throw error;
    }
  }

  /**
   * @description Update customer by ID
   * @param {string} customerId - The customer's ID
   * @param {UpdateCustomerDTO} data - The customer data to update
   * @returns {Promise<CustomerVMType>} The updated customer
   * @throws {AppError} If the customer is not found or CNPJ already exists
   */
  public async updateCustomer(
    customerId: string,
    data: UpdateCustomerDTO,
  ): Promise<CustomerVMType> {
    app.log.info("[CustomerService] - Starting customer update for customer %s", customerId);

    try {
      // Check if customer exists
      const existingCustomer = await this.customerRepository.getCustomerById(customerId);

      if (!existingCustomer) {
        app.log.warn(
          "[CustomerService] - Customer update failed: Customer %s not found",
          customerId,
        );
        throw new AppError("Cliente não encontrado", HTTP_STATUS_CODES.NOT_FOUND);
      }

      // Check if CNPJ is being updated and if it already exists
      if (data.document_number && data.document_number !== existingCustomer.document_number) {
        const cnpjExists = await this.customerRepository.getCustomerByCnpj(data.document_number);

        if (cnpjExists) {
          app.log.warn(
            "[CustomerService] - Customer update failed: CNPJ or CPF %s already exists",
            data.document_number,
          );
          throw new AppError("Já existe cliente com este CNPJ ou CPF", HTTP_STATUS_CODES.CONFLICT);
        }
      }

      const updatedCustomer = await this.customerRepository.updateCustomer(customerId, data);

      if (!updatedCustomer) {
        app.log.error(
          "[CustomerService] - Customer update failed: Unable to update customer %s",
          customerId,
        );
        throw new AppError("Failed to update customer", HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR);
      }

      app.log.info("[CustomerService] - Customer updated successfully with ID %s", customerId);
      return updatedCustomer as CustomerVMType;
    } catch (error) {
      app.log.error("[CustomerService] - Customer update failed: %s", error);
      throw error;
    }
  }

  /**
   * @description Delete a customer
   * @param {string} customerId - The customer's ID to delete
   * @returns {Promise<void>}
   * @throws {AppError} If the customer is not found
   */
  public async deleteCustomer(customerId: string): Promise<void> {
    app.log.info("[CustomerService] - Starting customer deletion for customer %s", customerId);

    try {
      // Check if customer exists
      const existingCustomer = await this.customerRepository.getCustomerById(customerId);

      if (!existingCustomer) {
        app.log.warn(
          "[CustomerService] - Customer deletion failed: Customer %s not found",
          customerId,
        );
        throw new AppError("Cliente não encontrado", HTTP_STATUS_CODES.NOT_FOUND);
      }

      await this.customerRepository.deleteCustomer(customerId);

      app.log.info("[CustomerService] - Customer deleted successfully with ID %s", customerId);
    } catch (error) {
      app.log.error("[CustomerService] - Customer deletion failed: %s", error);
      throw error;
    }
  }
}
