import z from "zod";

export const ServiceOrderSchema = z.object({
  id: z.string().uuid(),
  number: z.number(),
  customerId: z.string().uuid(),
  contractId: z.string().uuid(),
  observation: z.string().nullable(),
  plannedDate: z.date(),
  status: z.enum(["open", "completed", "cancelled"]),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const ServiceOrderWithDetailsSchema = ServiceOrderSchema.extend({
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
  plannedDate: z.union([z.string(), z.date()]),
  farms: z.array(z.object({
    id: z.string().uuid(),
    name: z.string(),
    customerId: z.string().uuid(),
    createdAt: z.union([z.string(), z.date()]),
    updatedAt: z.union([z.string(), z.date()]),
    plots: z.array(z.object({
      id: z.string().uuid(),
      name: z.string(),
      hectare: z.string(),
      geoJson: z.unknown(),
      farmId: z.string().uuid(),
      customerId: z.string().uuid(),
      externalId: z.string(),
      createdAt: z.union([z.string(), z.date()]),
      updatedAt: z.union([z.string(), z.date()]),
    })).nullish()
  })).nullable(),
  customer: z.object({
    id: z.string().uuid(),
    document_number: z.string(),
    entity_type: z.enum(["PF", "PJ"]),
    phone: z.string(),
    name: z.string(),
    razaoSocial: z.string().nullish(),
    createdAt: z.union([z.string(), z.date()]),
    updatedAt: z.union([z.string(), z.date()]),
  }).nullable(),
  contract: z.object({
    id: z.string().uuid(),
    customerId: z.string().uuid().nullable(),
    name: z.string(),
    date_start: z.union([z.string(), z.date()]),
    date_end: z.union([z.string(), z.date()]),
    observation: z.string(),
    createdAt: z.union([z.string(), z.date()]),
    updatedAt: z.union([z.string(), z.date()]),
  }).nullable(),
  pilots: z.array(z.object({
    id: z.string().uuid(),
    name: z.string(),
    email: z.string(),
    type: z.enum(["backoffice", "pilot", "farmer"]),
    customerId: z.string().uuid().nullable(),
    createdAt: z.union([z.string(), z.date()]),
    updatedAt: z.union([z.string(), z.date()]).nullable(),
    deletedAt: z.union([z.string(), z.date()]).nullable(),
  })).nullable(),
  plots: z.array(z.object({
    id: z.string().uuid(),
    name: z.string(),
    hectare: z.string(),
    geoJson: z.unknown(),
    farmId: z.string().uuid(),
    customerId: z.string().uuid(),
    externalId: z.string(),
    createdAt: z.union([z.string(), z.date()]),
    updatedAt: z.union([z.string(), z.date()]),
  })).nullable(),
});

export const ServiceOrderViewModelSchema = ServiceOrderSchema.extend({
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
  plannedDate: z.union([z.string(), z.date()]),
});

export type ServiceOrder = z.infer<typeof ServiceOrderSchema>;
export type ServiceOrderWithDetails = z.infer<typeof ServiceOrderWithDetailsSchema>;
export type ServiceOrderViewModel = z.infer<typeof ServiceOrderViewModelSchema>;

export const ServiceOrderVM = {
  toViewModel: (serviceOrder: ServiceOrder) => {
    return ServiceOrderViewModelSchema.parse(serviceOrder);
  },
  
  toViewModelWithDetails: (serviceOrder: ServiceOrderWithDetails) => {
    return ServiceOrderWithDetailsSchema.parse(serviceOrder);
  },
}; 