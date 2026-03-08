import type { FastifyReply, FastifyRequest } from "fastify";
import type { CreateContractDTO } from "./dto/create-contract.dto";
import type { UpdateContractDTO } from "./dto/update-contract.dto";

import AppError from "@common/handlers/app-error";
import type { PaginatedRequestQueryString } from "@common/types/paginated-request.types";
import { ContractVM } from "@models/contract.vm";
import { app } from "@modules/app/app.module";
import { ContractService } from "./services/contract.service";
import { ContractOrderBy, ContractOrderType } from "@repositories/contracts/contract.types";

export class ContractController {
  private service: ContractService;

  constructor() {
    this.service = new ContractService();
  }

  public createContract = async (
    request: FastifyRequest<{
      Body: CreateContractDTO;
    }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info(
        "[ContractController] - Starting contract creation for customer %s",
        request.body.customerId,
      );

      await this.service.createContract(request.body);

      app.log.info("[ContractController] - Contract created successfully");
      return reply.status(201).send({
        message: "Contract created successfully",
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[ContractController] - Contract creation failed: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[ContractController] - Unexpected error during contract creation: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };

  public listContracts = async (
    request: FastifyRequest<{
      Querystring: PaginatedRequestQueryString & { search?: string, orderBy?: ContractOrderBy, orderType?: ContractOrderType };
    }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info("[ContractController] - Listing contracts");
      const page = request.query.page ?? 1;
      const limit = request.query.limit ?? 10;
      const search = request.query.search;
      const orderBy = request.query.orderBy;
      const orderType = request.query.orderType;

      const result = await this.service.listContracts(page, limit, search, orderBy, orderType);

      app.log.info("[ContractController] - Successfully listed contracts");
      return reply.status(200).send({
        message: "Contracts listed successfully",
        ...result,
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[ContractController] - Failed to list contracts: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[ContractController] - Unexpected error during contract listing: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };

  public getContractById = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info("[ContractController] - Fetching contract details for contract %s", request.params.id);
      const contractDb = await this.service.getContractById(request.params.id);
      const contract = ContractVM.toViewModelWithCustomer(contractDb);

      app.log.info("[ContractController] - Successfully retrieved contract details");
      return reply.status(200).send({
        message: "Contract details retrieved successfully",
        contract,
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[ContractController] - Failed to retrieve contract details: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[ContractController] - Unexpected error during contract details retrieval: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };

  public getContractsByCustomerId = async (
    request: FastifyRequest<{ Params: { customerId: string }, Querystring: PaginatedRequestQueryString }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info("[ContractController] - Fetching contracts for customer %s", request.params.customerId);
      const page = request.query.page ?? 1;
      const limit = request.query.limit ?? 10;
      const contracts = await this.service.getContractsByCustomerId(request.params.customerId, page, limit);

      app.log.info("[ContractController] - Successfully retrieved contracts for customer");
      return reply.status(200).send({
        message: "Contracts retrieved successfully",
        ...contracts,
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[ContractController] - Failed to retrieve contracts for customer: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[ContractController] - Unexpected error during contracts retrieval: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };

  public updateContract = async (
    request: FastifyRequest<{ Params: { id: string }; Body: UpdateContractDTO }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info("[ContractController] - Starting contract update for contract %s", request.params.id);

      const updatedContract = await this.service.updateContract(request.params.id, request.body);
      const contract = ContractVM.toViewModelWithCustomer(updatedContract);

      app.log.info("[ContractController] - Contract updated successfully");
      return reply.status(200).send({
        message: "Contract updated successfully",
        contract,
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[ContractController] - Contract update failed: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[ContractController] - Unexpected error during contract update: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };

  public deleteContract = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info("[ContractController] - Starting contract deletion for contract %s", request.params.id);

      await this.service.deleteContract(request.params.id);

      app.log.info("[ContractController] - Contract deleted successfully");
      return reply.status(200).send({
        message: "Contract deleted successfully",
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[ContractController] - Contract deletion failed: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[ContractController] - Unexpected error during contract deletion: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };
} 