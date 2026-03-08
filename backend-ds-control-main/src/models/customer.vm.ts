import z from "zod";

export const CustomerSchema = z.object({
  id: z.string().uuid(),
  document_number: z.string(),
  entity_type: z.enum(["PF", "PJ"]),
  phone: z.string(),
  name: z.string(),
  razaoSocial: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date().nullable(),
  deletedAt: z.date().nullable(),
});

export const CustomerViewModelSchema = CustomerSchema.extend({
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]).nullish(),
  deletedAt: z.union([z.string(), z.date()]).nullish(),
});

export type Customer = z.infer<typeof CustomerSchema>;
export type CustomerViewModel = z.infer<typeof CustomerViewModelSchema>;

export const CustomerVM = {
  toViewModel: (customer: Customer) => {
    return CustomerViewModelSchema.parse(customer);
  },
}; 