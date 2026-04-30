import { z } from 'zod';

import { RegisterNewProductSchema, UpdateProductByIdSchema } from '@/schemas/product.schema';
import { Product } from '@/types/product.type';

import { api } from './api.service';

export type GetAllProductsResponse = {
  data: Product[];
  page: number;
  limit: number;
  totalPages: number;
  totalCount: number;
};

export type GetAllProductsParams = {
  page?: string;
  limit?: string;
  search?: string;
  status?: 'active' | 'inactive';
};

export async function getAllProducts(
  params?: GetAllProductsParams
): Promise<GetAllProductsResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.append('page', params.page);
  if (params?.limit) searchParams.append('limit', params.limit);
  if (params?.search) searchParams.append('search', params.search);
  if (params?.status) searchParams.append('status', params.status);

  const url = `/products${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  const response = await api(url, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`[Product Service] Erro ao buscar produtos: ${error.message}`);
  }

  return await response.json();
}

export async function getAllActiveProductIds(): Promise<string[]> {
  const collectedIds = new Set<string>();
  let page = 1;
  let totalPages = 1;

  do {
    const response = await getAllProducts({
      page: page.toString(),
      limit: '200',
      status: 'active',
    });
    response.data.forEach((product) => {
      if (product.id) {
        collectedIds.add(product.id);
      }
    });
    totalPages = response.totalPages || 1;
    page += 1;
  } while (page <= totalPages);

  return Array.from(collectedIds);
}

export type RegisterNewProductParams = z.infer<typeof RegisterNewProductSchema>;

export type RegisterNewProductResponse = {
  message: string;
};

export async function registerNewProduct(
  data: RegisterNewProductParams
): Promise<RegisterNewProductResponse> {
  try {
    RegisterNewProductSchema.parse(data);

    const response = await api(`/products`, {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`[Product Service] Erro ao criar produto: ${error.message}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(
        `[Product Service] Erro de validação: ${error.errors.map((err) => err.message).join(', ')}`
      );
      throw new Error('Erro ao criar produto');
    }

    console.error(`[Product Service] Erro ao criar produto: ${error}`);
    throw error;
  }
}

export type UpdateProductByIdParams = z.infer<typeof UpdateProductByIdSchema> & {
  id: string;
};

export type UpdateProductByIdResponse = {
  message: string;
};

export async function updateProductById(
  data: UpdateProductByIdParams
): Promise<UpdateProductByIdResponse> {
  try {
    UpdateProductByIdSchema.parse(data);

    const response = await api(`/products/${data.id}`, {
      method: 'PUT',
      body: JSON.stringify({ name: data.name }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`[Product Service] Erro ao atualizar produto: ${error.message}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(
        `[Product Service] Erro de validação: ${error.errors.map((err) => err.message).join(', ')}`
      );
      throw new Error('Erro ao atualizar produto');
    }

    console.error(`[Product Service] Erro ao atualizar produto: ${error}`);
    throw error;
  }
}

export async function deleteProductById(productId: string): Promise<void> {
  const response = await api(`/products/${productId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`[Product Service] Erro ao deletar produto: ${error.message}`);
  }
}

export type GetProductByIdResponse = {
  message: string;
  product: Product;
};

export async function getProductById(productId: string): Promise<GetProductByIdResponse> {
  const response = await api(`/products/${productId}`, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`[Product Service] Erro ao buscar produto: ${error.message}`);
  }

  const data = await response.json();
  return data;
}
