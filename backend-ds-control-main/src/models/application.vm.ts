import z from "zod";

export const ApplicationSchema = z.object({
  id: z.string().uuid(),
  serviceOrderId: z.string().uuid().nullable(),
  pilotId: z.string().uuid(),
  assistantId: z.string().uuid().nullable(),
  droneId: z.string().uuid(),
  cultureId: z.string().uuid(),
  hectares: z.string(),
  flowRate: z.string(),
  altitude: z.string(),
  routeSpacing: z.string(),
  dropletSize: z.string(),
  date: z.date(),
  productId: z.string().uuid(),
  plotId: z.string().uuid().nullable(),
  observations: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date().nullable(),
  deletedAt: z.date().nullable(),
  farmId: z.string().uuid().nullable(),
});

export const ApplicationViewModelSchema = ApplicationSchema.extend({
  date: z.union([z.string(), z.date()]),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]).nullish(),
  deletedAt: z.union([z.string(), z.date()]).nullish(),
});

export const ApplicationWithRelationsSchema = ApplicationSchema.extend({
  serviceOrder: z.object({
    id: z.string().uuid(),
    number: z.number(),
    status: z.string(),
  }).nullable(),
  pilot: z.object({
    id: z.string().uuid(),
    name: z.string(),
    email: z.string(),
  }),
  assistant: z.object({
    id: z.string().uuid(),
    name: z.string(),
  }).nullable(),
  drone: z.object({
    id: z.string().uuid(),
    name: z.string(),
    model: z.string(),
  }),
  culture: z.object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string().nullable(),
  }),
  product: z.object({
    id: z.string().uuid(),
    name: z.string(),
  }),
  plot: z.object({
    id: z.string().uuid(),
    name: z.string(),
    hectare: z.string(),
  }).nullable(),
  farm: z.object({
    id: z.string().uuid(),
    name: z.string(),
    customer: z.object({
      id: z.string().uuid(),
      name: z.string(),
    }),
  }).nullable(),
});

export const ApplicationWithRelationsViewModelSchema = ApplicationWithRelationsSchema.extend({
  date: z.union([z.string(), z.date()]),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]).nullish(),
  deletedAt: z.union([z.string(), z.date()]).nullish(),
});

export type Application = z.infer<typeof ApplicationSchema>;
export type ApplicationViewModel = z.infer<typeof ApplicationViewModelSchema>;
export type ApplicationWithRelations = z.infer<typeof ApplicationWithRelationsSchema>;
export type ApplicationWithRelationsViewModel = z.infer<typeof ApplicationWithRelationsViewModelSchema>;

export const ApplicationVM = {
  toViewModel: (application: Application) => {
    return ApplicationViewModelSchema.parse(application);
  },
  toViewModelWithRelations: (application: ApplicationWithRelations) => {
    return ApplicationWithRelationsViewModelSchema.parse(application);
  },
}; 