import z from "zod";

export const RouteSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  geoJson: z.record(z.string(), z.unknown()),
  farmId: z.string().uuid(),
  customerId: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date().nullable(),
  deletedAt: z.date().nullable(),
});

export const RouteViewModelSchema = RouteSchema.extend({
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]).nullish(),
  deletedAt: z.union([z.string(), z.date()]).nullish(),
});

export const RouteWithFarmViewModelSchema = RouteViewModelSchema.extend({
  farm: z.object({
    id: z.string().uuid(),
    name: z.string(),
  }),
});

export const RouteWithCustomerViewModelSchema = RouteViewModelSchema.extend({
  customer: z.object({
    id: z.string().uuid(),
    name: z.string(),
  }),
});

export const RouteWithFarmAndCustomerViewModelSchema = RouteViewModelSchema.extend({
  farm: z.object({
    id: z.string().uuid(),
    name: z.string(),
  }),
  customer: z.object({
    id: z.string().uuid(),
    name: z.string(),
  }),
});

export type Route = z.infer<typeof RouteSchema>;
export type RouteViewModel = z.infer<typeof RouteViewModelSchema>;
export type RouteWithFarmViewModel = z.infer<typeof RouteWithFarmViewModelSchema>;
export type RouteWithCustomerViewModel = z.infer<typeof RouteWithCustomerViewModelSchema>;
export type RouteWithFarmAndCustomerViewModel = z.infer<typeof RouteWithFarmAndCustomerViewModelSchema>;

export const RouteVM = {
  toViewModel: (route: Route) => {
    return RouteViewModelSchema.parse(route);
  },
  toViewModelWithFarm: (route: Route & {
    farm: {
      id: string;
      name: string;
    };
  }) => {
    return RouteWithFarmViewModelSchema.parse(route);
  },
  toViewModelWithCustomer: (route: Route & {
    customer: {
      id: string;
      name: string;
    };
  }) => {
    return RouteWithCustomerViewModelSchema.parse(route);
  },
  toViewModelWithFarmAndCustomer: (route: Route & {
    farm: {
      id: string;
      name: string;
    };
    customer: {
      id: string;
      name: string;
    };
  }) => {
    return RouteWithFarmAndCustomerViewModelSchema.parse(route);
  },
};
