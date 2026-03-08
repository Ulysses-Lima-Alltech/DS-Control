import z from "zod";

export const ProductSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  createdAt: z.date(),
  updatedAt: z.date().nullable(),
  deletedAt: z.date().nullable(),
});

export const ProductViewModelSchema = ProductSchema.extend({
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]).nullish(),
  deletedAt: z.union([z.string(), z.date()]).nullish(),
});

export type Product = z.infer<typeof ProductSchema>;
export type ProductViewModel = z.infer<typeof ProductViewModelSchema>;

export const ProductVM = {
  toViewModel: (product: Product) => {
    return ProductViewModelSchema.parse(product);
  },
}; 