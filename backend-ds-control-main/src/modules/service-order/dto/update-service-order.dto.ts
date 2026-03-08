import z from "zod";

export const UpdateServiceOrderSchema = z.object({
  farmsIds: z.array(z.string().uuid()).min(1, "At least one farm is required").optional(),
  contractId: z.string().uuid().optional(),
  observation: z.string().optional(),
  plannedDate: z.string().date().optional(),
  pilotsIds: z.array(z.string().uuid()).optional(),
  plotsIds: z.array(z.string().uuid()).optional(),
});

export type UpdateServiceOrderDTO = z.infer<typeof UpdateServiceOrderSchema>;