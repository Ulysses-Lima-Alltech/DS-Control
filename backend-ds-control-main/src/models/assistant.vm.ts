import z from "zod";

export const AssistantSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  createdAt: z.date(),
  updatedAt: z.date().nullable(),
  deletedAt: z.date().nullable(),
});

export const AssistantViewModelSchema = AssistantSchema.extend({
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]).nullish(),
  deletedAt: z.union([z.string(), z.date()]).nullish(),
});

export type Assistant = z.infer<typeof AssistantSchema>;
export type AssistantViewModel = z.infer<typeof AssistantViewModelSchema>;

export const AssistantVM = {
  toViewModel: (assistant: Assistant) => {
    return AssistantViewModelSchema.parse(assistant);
  },
}; 