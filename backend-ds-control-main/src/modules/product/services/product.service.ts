import AppError from "@common/handlers/app-error";
import { HTTP_STATUS_CODES } from "@common/types/http-status.types";
import { db } from "@infra/database";
import { products } from "@infra/database/schema";
import { and, eq, isNull } from "drizzle-orm";

import type { PaginatedRequest } from "@common/types/paginated-request.types";
import {
    ProductVM,
    type ProductViewModelSchema,
} from "@models/product.vm";
import { app } from "@modules/app/app.module";
import { ProductRepository } from "@repositories/products/product.repository";
import type { Product } from "@repositories/products/product.types";
import type { CreateProductDTO } from "../dto/create-product.dto";
import type { UpdateProductDTO } from "../dto/update-product.dto";

export class ProductService {
  private readonly productRepository = new ProductRepository();

  /**
   * @description Create a new product
   * @param {CreateProductDTO} data - The product data
   * @throws {AppError} If validation fails
   */
  public async createProduct({ name }: CreateProductDTO): Promise<void> {
    app.log.info("[ProductService] - Starting product creation with name %s", name);

    // Check if product name already exists
    const existingProduct = await db.query.products.findFirst({
      where: and(eq(products.name, name), isNull(products.deletedAt)),
    });

    if (existingProduct) {
      app.log.warn(
        "[ProductService] - Product creation failed: Product name %s already exists",
        name,
      );
      throw new AppError(
        "Já existe um produto com este",
        HTTP_STATUS_CODES.CONFLICT,
      );
    }

    // Create the product
    const product = await this.productRepository.createProduct({
      name,
    });

    app.log.info("[ProductService] - Product created successfully with ID %s", product.id);
  }

  /**
   * @description Get all products with optional search and status filter
   * @param {number} page - The page number
   * @param {number} limit - The limit per page
   * @param {string} search - Optional search term to filter by name
   * @param {string} status - Optional status filter (active/inactive)
   * @returns {Promise<PaginatedRequest<typeof ProductViewModelSchema>>} The list of products
   */
  public async listProducts(
    page: number,
    limit: number,
    search?: string,
    status?: "active" | "inactive"
  ): Promise<PaginatedRequest<typeof ProductViewModelSchema>> {
    app.log.info("[ProductService] - Listing all products");

    const queryResult = await this.productRepository.getAllProducts(page, limit, search, status);
    const totalCount = await this.productRepository.countProducts(search, status);

    app.log.info("[ProductService] - Retrieved %d products", totalCount);

    return {
      data: queryResult.map((product) => ProductVM.toViewModel(product)),
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
      totalCount,
    };
  }

  /**
   * @description Get product by ID
   * @param {string} productId - The product's ID
   * @returns {Promise<Product>} The product details
   * @throws {AppError} If the product is not found
   */
  public async getProductById(productId: string): Promise<Product> {
    app.log.info("[ProductService] - Fetching product details for product %s", productId);

    try {
      const product = await this.productRepository.getProductById(productId);

      if (!product) {
        app.log.warn("[ProductService] - Product not found: %s", productId);
        throw new AppError("Produto não encontrado", HTTP_STATUS_CODES.NOT_FOUND);
      }

      app.log.info("[ProductService] - Successfully retrieved product details for %s", productId);
      return product;
    } catch (error) {
      app.log.error("[ProductService] - Failed to fetch product details: %s", error);
      throw error;
    }
  }

  /**
   * @description Update product by ID
   * @param {string} productId - The product's ID
   * @param {UpdateProductDTO} data - The product data to update
   * @returns {Promise<Product>} The updated product
   * @throws {AppError} If the product is not found or validation fails
   */
  public async updateProduct(productId: string, data: UpdateProductDTO): Promise<Product> {
    app.log.info("[ProductService] - Starting product update for product %s", productId);

    try {
      const existingProduct = await this.productRepository.getProductById(productId);

      if (!existingProduct) {
        app.log.warn("[ProductService] - Product update failed: Product %s not found", productId);
        throw new AppError("Produto não encontrado", HTTP_STATUS_CODES.NOT_FOUND);
      }

      if (data.name && data.name !== existingProduct.name) {
        const nameExists = await db.query.products.findFirst({
          where: and(eq(products.name, data.name), isNull(products.deletedAt)),
        });

        if (nameExists) {
          app.log.warn(
            "[ProductService] - Product update failed: Product name %s already exists",
            data.name,
          );
          throw new AppError(
            "Já existe um produto com este nome",
            HTTP_STATUS_CODES.CONFLICT,
          );
        }
      }

      const updateData: { name?: string } = {};
      if (data.name) updateData.name = data.name;

      if (Object.keys(updateData).length > 0) {
        await this.productRepository.updateProduct(productId, updateData);
      }

      const updatedProduct = await this.productRepository.getProductById(productId);

      if (!updatedProduct) {
        app.log.error(
          "[ProductService] - Product update failed: Unable to retrieve updated product %s",
          productId,
        );
        throw new AppError("Falha ao atualizar o produto", HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR);
      }

      app.log.info("[ProductService] - Product updated successfully with ID %s", productId);
      return updatedProduct;
    } catch (error) {
      app.log.error("[ProductService] - Product update failed: %s", error);
      throw error;
    }
  }

  /**
   * @description Delete a product (soft delete)
   * @param {string} productId - The product's ID to delete
   * @returns {Promise<void>}
   * @throws {AppError} If the product is not found
   */
  public async deleteProduct(productId: string): Promise<void> {
    app.log.info("[ProductService] - Starting product deletion for product %s", productId);

    try {
      // Check if product exists and is not already deleted
      const existingProduct = await this.productRepository.getProductById(productId);

      if (!existingProduct) {
        app.log.warn("[ProductService] - Product deletion failed: Product %s not found", productId);
        throw new AppError("Produto não encontrado", HTTP_STATUS_CODES.NOT_FOUND);
      }

      await this.productRepository.deleteProduct(productId);

      app.log.info("[ProductService] - Product deleted successfully with ID %s", productId);
    } catch (error) {
      app.log.error("[ProductService] - Product deletion failed: %s", error);
      throw error;
    }
  }
} 