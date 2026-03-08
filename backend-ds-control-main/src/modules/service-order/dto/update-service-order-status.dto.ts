import z from "zod";

export const UpdateServiceOrderStatusSchema = z.object({
  status: z.enum(["open", "completed", "cancelled"]),
});

export type UpdateServiceOrderStatusDTO = z.infer<typeof UpdateServiceOrderStatusSchema>;