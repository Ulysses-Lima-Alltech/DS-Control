import z from "zod";

export const CreateDroneSchema = z.object({
  name: z.string().min(1, "Drone name is required"),
  model: z.string().min(1, "Drone model is required"),
  aircraftRid: z.string().min(1, "Aircraft RID is required"),
});

export type CreateDroneDTO = z.infer<typeof CreateDroneSchema>; 