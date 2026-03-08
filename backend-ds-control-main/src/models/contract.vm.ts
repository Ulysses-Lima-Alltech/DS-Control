import z from "zod";

export const ContractSchema = z.object({
  id: z.string().uuid(),
  customerId: z.string().uuid(),
  name: z.string(),
  dateStart: z.date(),
  dateEnd: z.date(),
  observation: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date().nullable(),
  deletedAt: z.date().nullable(),
});

export const ContractViewModelSchema = ContractSchema.extend({
  dateStart: z.union([z.string(), z.date()]),
  dateEnd: z.union([z.string(), z.date()]),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]).nullish(),
  deleteAt:  z.union([z.string(), z.date()]).nullish(),
});

export const ContractWithCustomerViewModelSchema = ContractViewModelSchema.extend({
  customer: z.object({
    id: z.string().uuid(),
    name: z.string(),
  }),
});

export type Contract = z.infer<typeof ContractSchema>;
export type ContractViewModel = z.infer<typeof ContractViewModelSchema>;
export type ContractWithCustomerViewModel = z.infer<typeof ContractWithCustomerViewModelSchema>;

export const ContractVM = {
  toViewModel: (contract: Contract) => {
    return ContractViewModelSchema.parse(contract);
  },
  toViewModelWithCustomer: (contract: Contract & {
    customer: {
      id: string;
      name: string;
    };
  }) => {
    return ContractWithCustomerViewModelSchema.parse(contract);
  },
}; 