import type {
    FastifyInstance,
    FastifyPluginOptions,
    HookHandlerDoneFunction,
} from "fastify";

import { PaginatedRequestQueryStringSchema, PaginatedRequestSchema } from "@common/types/paginated-request.types";
import { AuthenticationJWT } from "@middleware/authentication-jwt-middleware";
import { ContractWithCustomerViewModelSchema } from "@models/contract.vm";
import type { FastifyZodOpenApiTypeProvider } from "fastify-zod-openapi";
import { z } from "zod";
import { ContractController } from "./contract.controller";
import { CreateContractSchema } from "./dto/create-contract.dto";
import { UpdateContractSchema } from "./dto/update-contract.dto";
import { GetContractQueryStringSchema } from "./dto/get-all-contract.dto";

export function ContractV1Routes(
  app: FastifyInstance,
  _: FastifyPluginOptions,
  done: HookHandlerDoneFunction,
) {
  const controller = new ContractController();

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "GET",
    url: "/",
    schema: {
      description: "List all contracts with their customer and optional search",
      summary: "List contracts",
      tags: ["contracts"],
      querystring: GetContractQueryStringSchema,
      response: { 
        200: PaginatedRequestSchema(ContractWithCustomerViewModelSchema),
      }
    },
    preHandler: [AuthenticationJWT],
    handler: controller.listContracts,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "POST",
    url: "/",
    schema: {
      body: CreateContractSchema,
      description: "Create a new contract",
      summary: "Create contract",
      tags: ["contracts"],
    },
    preHandler: [AuthenticationJWT],
    handler: controller.createContract,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "GET",
    url: "/:id",
    schema: {
      description: "Get contract by ID with its customer",
      summary: "Get contract by ID",
      tags: ["contracts"],
      params: z.object({
        id: z.string().uuid(),
      }),
    },
    preHandler: [AuthenticationJWT],
    handler: controller.getContractById,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "GET",
    url: "/customer/:customerId",
    schema: {
      description: "Get contracts by customer ID with their customer",
      summary: "Get contracts by customer ID",
      tags: ["contracts"],
      params: z.object({
        customerId: z.string().uuid(),
      }),
      querystring: PaginatedRequestQueryStringSchema,
      response: { 
        200: PaginatedRequestSchema(ContractWithCustomerViewModelSchema),
      }
    },
    preHandler: [AuthenticationJWT],
    handler: controller.getContractsByCustomerId,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "PUT",
    url: "/:id",
    schema: {
      description: "Update a contract by ID",
      summary: "Update contract by ID",
      tags: ["contracts"],
      body: UpdateContractSchema,
      params: z.object({
        id: z.string().uuid(),
      }),
    },
    preHandler: [AuthenticationJWT],
    handler: controller.updateContract,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "DELETE",
    url: "/:id",
    schema: {
      description: "Delete a contract by ID",
      summary: "Delete contract by ID",
      tags: ["contracts"],
      params: z.object({
        id: z.string().uuid(),
      }),
    },
    preHandler: [AuthenticationJWT],
    handler: controller.deleteContract,
  });

  done();
} 