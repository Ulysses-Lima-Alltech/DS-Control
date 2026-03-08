import z from "zod";

export const UpdateDroneSchema = z.object({
  name: z.string().min(1, "Drone name is required").optional(),
  model: z.string().min(1, "Drone model is required").optional(),
  aircraftRid: z.string().min(1, "Aircraft RID is required").optional(),
});

export type UpdateDroneDTO = z.infer<typeof UpdateDroneSchema>; 