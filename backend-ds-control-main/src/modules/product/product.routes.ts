import type {
    FastifyInstance,
    FastifyPluginOptions,
    HookHandlerDoneFunction,
} from "fastify";

import { PaginatedRequestQueryStringSchema, PaginatedRequestSchema } from "@common/types/paginated-request.types";
import { AuthenticationJWT } from "@middleware/authentication-jwt-middleware";
import { ProductViewModelSchema } from "@models/product.vm";
import type { FastifyZodOpenApiTypeProvider } from "fastify-zod-openapi";
import { z } from "zod";
import { CreateProductSchema } from "./dto/create-product.dto";
import { UpdateProductSchema } from "./dto/update-product.dto";
import { ProductController } from "./product.controller";

// Extended query string schema for product search and filters
const ProductSearchQueryStringSchema = PaginatedRequestQueryStringSchema.extend({
  search: z
    .string()
    .optional()
    .describe("Search term to filter products by name"),
  status: z
    .enum(["active", "inactive"])
    .optional()
    .describe("Filter by product status (active = not deleted, inactive = deleted)"),
});

export function ProductV1Routes(
  app: FastifyInstance,
  _: FastifyPluginOptions,
  done: HookHandlerDoneFunction,
) {
  const controller = new ProductController();

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "GET",
    url: "/",
    schema: {
      description: "List all products with optional search and status filter",
      summary: "List products",
      tags: ["products"],
      querystring: ProductSearchQueryStringSchema,
      response: { 
        200: PaginatedRequestSchema(ProductViewModelSchema),
      }
    },
    preHandler: [AuthenticationJWT],
    handler: controller.listProducts,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "POST",
    url: "/",
    schema: {
      body: CreateProductSchema,
      description: "Create a new product",
      summary: "Create product",
      tags: ["products"],
    },
    preHandler: [AuthenticationJWT],
    handler: controller.createProduct,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "GET",
    url: "/:id",
    schema: {
      description: "Get product by ID",
      summary: "Get product by ID",
      tags: ["products"],
      params: z.object({
        id: z.string().uuid(),
      }),
    },
    preHandler: [AuthenticationJWT],
    handler: controller.getProductById,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "PUT",
    url: "/:id",
    schema: {
      description: "Update a product by ID",
      summary: "Update product by ID",
      tags: ["products"],
      body: UpdateProductSchema,
      params: z.object({
        id: z.string().uuid(),
      }),
    },
    preHandler: [AuthenticationJWT],
    handler: controller.updateProduct,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "DELETE",
    url: "/:id",
    schema: {
      description: "Delete a product by ID (soft delete)",
      summary: "Delete product by ID",
      tags: ["products"],
      params: z.object({
        id: z.string().uuid(),
      }),
    },
    preHandler: [AuthenticationJWT],
    handler: controller.deleteProduct,
  });

  done();
} 