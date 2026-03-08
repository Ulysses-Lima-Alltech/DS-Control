import { z } from "zod";

export const UpdateContractSchema = z.object({
  customerId: z.string().uuid("Customer ID must be a valid UUID").optional(),
  name: z.string().min(1, "Contract name is required").max(255, "Contract name is too long").optional(),
  dateStart: z.coerce.date().optional(),
  dateEnd: z.coerce.date().optional(),
  observation: z.string().max(1000, "Observation is too long").nullable().optional(),
}).refine(
  (data) => {
    if (data.dateStart && data.dateEnd) {
      return data.dateEnd > data.dateStart;
    }
    return true;
  },
  {
    message: "End date must be after start date",
    path: ["dateEnd"],
  }
);

export type UpdateContractDTO = z.infer<typeof UpdateContractSchema>; 