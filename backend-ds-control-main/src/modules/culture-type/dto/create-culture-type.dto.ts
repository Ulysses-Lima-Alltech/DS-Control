import { z } from "zod";

export const CreateCultureTypeSchema = z.object({
  name: z.string().min(1, "Culture type name is required").max(255, "Culture type name is too long"),
  description: z.string().max(500, "Culture type description is too long").nullable(),
});

export type CreateCultureTypeDTO = z.infer<typeof CreateCultureTypeSchema>; 