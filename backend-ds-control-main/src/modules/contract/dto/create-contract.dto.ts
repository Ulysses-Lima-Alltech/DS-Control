import { z } from "zod";

export const CreateContractSchema = z.object({
  customerId: z.string().uuid("Customer ID must be a valid UUID"),
  name: z.string().min(1, "Contract name is required").max(255, "Contract name is too long"),
  dateStart: z.coerce.date(),
  dateEnd: z.coerce.date(),
  observation: z.string().max(1000, "Observation is too long").nullable(),
}).refine(
  (data) => data.dateEnd > data.dateStart,
  {
    message: "End date must be after start date",
    path: ["dateEnd"],
  }
);

export type CreateContractDTO = z.infer<typeof CreateContractSchema>; 