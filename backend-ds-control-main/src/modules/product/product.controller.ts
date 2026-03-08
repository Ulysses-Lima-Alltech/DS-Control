import type { FastifyReply, FastifyRequest } from "fastify";
import type { CreateProductDTO } from "./dto/create-product.dto";
import type { UpdateProductDTO } from "./dto/update-product.dto";

import AppError from "@common/handlers/app-error";
import type { PaginatedRequestQueryString } from "@common/types/paginated-request.types";
import { ProductVM } from "@models/product.vm";
import { app } from "@modules/app/app.module";
import { ProductService } from "./services/product.service";

export class ProductController {
  private service: ProductService;

  constructor() {
    this.service = new ProductService();
  }

  public createProduct = async (
    request: FastifyRequest<{
      Body: CreateProductDTO;
    }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info(
        "[ProductController] - Starting product creation with name %s",
        request.body.name,
      );

      await this.service.createProduct(request.body);

      app.log.info("[ProductController] - Product created successfully");
      return reply.status(201).send({
        message: "Product created successfully",
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[ProductController] - Product creation failed: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[ProductController] - Unexpected error during product creation: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };

  public listProducts = async (
    request: FastifyRequest<{
      Querystring: PaginatedRequestQueryString & {
        search?: string;
        status?: "active" | "inactive";
      };
    }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info("[ProductController] - Listing products");
      const page = request.query.page ?? 1;
      const limit = request.query.limit ?? 10;
      const search = request.query.search;
      const status = request.query.status;

      const result = await this.service.listProducts(page, limit, search, status);

      app.log.info("[ProductController] - Successfully listed products");
      return reply.status(200).send({
        message: "Products listed successfully",
        ...result,
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[ProductController] - Failed to list products: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[ProductController] - Unexpected error during product listing: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };

  public getProductById = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info("[ProductController] - Fetching product details for product %s", request.params.id);
      const productDb = await this.service.getProductById(request.params.id);
      const product = ProductVM.toViewModel(productDb);

      app.log.info("[ProductController] - Successfully retrieved product details");
      return reply.status(200).send({
        message: "Product details retrieved successfully",
        product,
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[ProductController] - Failed to retrieve product details: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[ProductController] - Unexpected error during product details retrieval: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };

  public updateProduct = async (
    request: FastifyRequest<{ Params: { id: string }; Body: UpdateProductDTO }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info("[ProductController] - Starting product update for product %s", request.params.id);

      const updatedProduct = await this.service.updateProduct(request.params.id, request.body);
      const product = ProductVM.toViewModel(updatedProduct);

      app.log.info("[ProductController] - Product updated successfully");
      return reply.status(200).send({
        message: "Product updated successfully",
        product,
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[ProductController] - Product update failed: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[ProductController] - Unexpected error during product update: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };

  public deleteProduct = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info("[ProductController] - Starting product deletion for product %s", request.params.id);

      await this.service.deleteProduct(request.params.id);

      app.log.info("[ProductController] - Product deleted successfully");
      return reply.status(200).send({
        message: "Product deleted successfully",
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[ProductController] - Product deletion failed: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[ProductController] - Unexpected error during product deletion: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };
} 