import { z } from "zod";

export const UpdateProductSchema = z.object({
  name: z.string().min(1, "Product name is required").max(255, "Product name is too long").optional(),
});

export type UpdateProductDTO = z.infer<typeof UpdateProductSchema>; 