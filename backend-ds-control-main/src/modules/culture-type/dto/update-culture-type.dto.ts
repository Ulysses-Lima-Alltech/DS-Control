import { z } from "zod";

export const UpdateCultureTypeSchema = z.object({
  name: z.string().min(1, "Culture type name is required").max(255, "Culture type name is too long").optional(),
  description: z.string().max(500, "Culture type description is too long").nullable().optional(),
});

export type UpdateCultureTypeDTO = z.infer<typeof UpdateCultureTypeSchema>; 