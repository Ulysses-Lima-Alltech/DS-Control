import { z } from "zod";


export const CreateServiceOrderSchema = z.object({
  farmsIds: z.array(z.string().uuid()).min(1, "At least one farm is required"),
  customerId: z.string().uuid(),
  contractId: z.string().uuid(),
  observation: z.string().optional(),
  plannedDate: z.string().date(),
  pilotsIds: z.array(z.string().uuid()),
  plotsIds: z.array(z.string().uuid()),
});

export type CreateServiceOrderDTO = z.infer<typeof CreateServiceOrderSchema>;