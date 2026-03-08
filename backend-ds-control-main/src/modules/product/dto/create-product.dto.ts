import { z } from "zod";

export const CreateProductSchema = z.object({
  name: z.string().min(1, "Product name is required").max(255, "Product name is too long"),
});

export type CreateProductDTO = z.infer<typeof CreateProductSchema>; 