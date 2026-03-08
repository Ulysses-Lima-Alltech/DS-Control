import { z } from "zod";

export const CreateAssistantSchema = z.object({
  name: z.string().min(1, "Assistant name is required").max(255, "Assistant name is too long"),
});

export type CreateAssistantDTO = z.infer<typeof CreateAssistantSchema>; 