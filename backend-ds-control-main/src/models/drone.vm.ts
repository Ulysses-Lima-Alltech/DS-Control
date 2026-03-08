import z from "zod";

export const DroneSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  model: z.string(),
  aircraftRid: z.string(),
  deletedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date().nullable(),
});

export const DroneViewModelSchema = DroneSchema.extend({
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]).nullish(),
  deletedAt: z.union([z.string(), z.date()]).nullish(),
});

export type Drone = z.infer<typeof DroneSchema>;
export type DroneViewModel = z.infer<typeof DroneViewModelSchema>;

export const DroneVM = {
  toViewModel: (drone: Drone) => {
    return DroneViewModelSchema.parse(drone);
  },
}; 