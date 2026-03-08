import { z } from "zod";

export const UpdateAssistantSchema = z.object({
  name: z.string().min(1, "Assistant name is required").max(255, "Assistant name is too long").optional(),
});

export type UpdateAssistantDTO = z.infer<typeof UpdateAssistantSchema>; 