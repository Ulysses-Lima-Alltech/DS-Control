import type { FastifyReply, FastifyRequest } from "fastify";
import type { CreateCustomerDTO } from "./dto/create-customer.dto";
import type { UpdateCustomerDTO } from "./dto/update-customer.dto";

import AppError from "@common/handlers/app-error";
import type { PaginatedRequestQueryString } from "@common/types/paginated-request.types";
import { CustomerVM } from "@models/customer.vm";
import { app } from "@modules/app/app.module";
import { CustomerService } from "./services/customer.service";
import { CustomerOrderBy, CustomerOrderType } from "@repositories/customers/customer.types";

export class CustomerController {
  private service: CustomerService;

  constructor() {
    this.service = new CustomerService();
  }

  public createCustomer = async (
    request: FastifyRequest<{ Body: CreateCustomerDTO }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info(
        "[CustomerController] - Starting customer creation for CNPJ or CPF %s",
        request.body.document_number,
      );

      await this.service.createCustomer(request.body);

      app.log.info("[CustomerController] - Customer created successfully");
      return reply.status(201).send({
        message: "Customer created successfully",
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[CustomerController] - Customer creation failed: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[CustomerController] - Unexpected error during customer creation: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };

  public listCustomers = async (
    request: FastifyRequest<{
      Querystring: PaginatedRequestQueryString & { search?: string, orderBy?: CustomerOrderBy, orderType?: CustomerOrderType };
    }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info("[CustomerController] - Listing customers");
      const page = request.query.page ?? 1;
      const limit = request.query.limit ?? 10;
      const search = request.query.search;
      const orderBy = request.query.orderBy;
      const orderType = request.query.orderType;
      const customers = await this.service.listCustomers(page, limit, search, orderBy, orderType);

      app.log.info("[CustomerController] - Successfully listed customers");
      
      return reply.status(200).send({
        message: "Customers listed successfully",
        ...customers,
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[CustomerController] - Failed to list customers: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[CustomerController] - Unexpected error during customer listing: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };

  public getCustomerById = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info(
        "[CustomerController] - Fetching customer details for customer %s",
        request.params.id,
      );
      const customerDb = await this.service.getCustomerById(request.params.id);
      const customer = CustomerVM.toViewModel(customerDb);

      app.log.info("[CustomerController] - Successfully retrieved customer details");
      return reply.status(200).send({
        message: "Customer details retrieved successfully",
        customer,
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn(
          "[CustomerController] - Failed to retrieve customer details: %s",
          error.message,
        );
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error(
        "[CustomerController] - Unexpected error during customer details retrieval: %s",
        error,
      );
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };

  public updateCustomer = async (
    request: FastifyRequest<{ Params: { id: string }; Body: UpdateCustomerDTO }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info(
        "[CustomerController] - Starting customer update for customer %s",
        request.params.id,
      );

      const updatedCustomer = await this.service.updateCustomer(request.params.id, request.body);
      const customer = CustomerVM.toViewModel(updatedCustomer);

      app.log.info("[CustomerController] - Customer updated successfully");
      return reply.status(200).send({
        message: "Customer updated successfully",
        customer,
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[CustomerController] - Customer update failed: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[CustomerController] - Unexpected error during customer update: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };

  public deleteCustomer = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info(
        "[CustomerController] - Starting customer deletion for customer %s",
        request.params.id,
      );

      await this.service.deleteCustomer(request.params.id);

      app.log.info("[CustomerController] - Customer deleted successfully");
      return reply.status(200).send({
        message: "Customer deleted successfully",
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[CustomerController] - Customer deletion failed: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[CustomerController] - Unexpected error during customer deletion: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };
}
