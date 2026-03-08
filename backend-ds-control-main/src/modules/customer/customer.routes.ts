import type {
  FastifyInstance,
  FastifyPluginOptions,
  HookHandlerDoneFunction,
} from "fastify";

import { PaginatedRequestQueryStringSchema, PaginatedRequestSchema } from "@common/types/paginated-request.types";
import { AuthenticationJWT } from "@middleware/authentication-jwt-middleware";
import { CustomerViewModelSchema } from "@models/customer.vm";
import type { FastifyZodOpenApiTypeProvider } from "fastify-zod-openapi";
import { z } from "zod";
import { CustomerController } from "./customer.controller";
import { CreateCustomerSchema } from "./dto/create-customer.dto";
import { UpdateCustomerSchema } from "./dto/update-customer.dto";
import { GetCustomerQueryStringSchema } from "./dto/get-all-customer.dto";

export function CustomerV1Routes(
  app: FastifyInstance,
  _: FastifyPluginOptions,
  done: HookHandlerDoneFunction,
) {
  const controller = new CustomerController();

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "GET",
    url: "/",
    schema: {
      description: "List all customers with optional search",
      summary: "List customers",
      tags: ["customers"],
      querystring: GetCustomerQueryStringSchema,
      response: {
        200: PaginatedRequestSchema(CustomerViewModelSchema),
      }
    },
    preHandler: [AuthenticationJWT],
    handler: controller.listCustomers,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "POST",
    url: "/",
    schema: {
      body: CreateCustomerSchema,
      description: "Create a new customer",
      summary: "Create customer",
      tags: ["customers"],
    },
    preHandler: [AuthenticationJWT],
    handler: controller.createCustomer,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "GET",
    url: "/:id",
    schema: {
      description: "Get customer by ID",
      summary: "Get customer by ID",
      tags: ["customers"],
      params: z.object({
        id: z.string(),
      }),
    },
    preHandler: [AuthenticationJWT],
    handler: controller.getCustomerById,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "PUT",
    url: "/:id",
    schema: {
      description: "Update a customer by ID",
      summary: "Update customer by ID",
      tags: ["customers"],
      body: UpdateCustomerSchema,
      params: z.object({
        id: z.string(),
      }),
    },
    preHandler: [AuthenticationJWT],
    handler: controller.updateCustomer,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "DELETE",
    url: "/:id",
    schema: {
      description: "Delete a customer by ID",
      summary: "Delete customer by ID",
      tags: ["customers"],
      params: z.object({
        id: z.string().uuid(),
      }),
    },
    preHandler: [AuthenticationJWT],
    handler: controller.deleteCustomer,
  });

  done();
} 