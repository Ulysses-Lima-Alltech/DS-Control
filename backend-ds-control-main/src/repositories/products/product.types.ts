export type Product = {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date | null;
  deletedAt: Date | null;
};

export interface CreateProduct {
  name: string;
} 