import z from "zod";

export const CultureTypeSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date().nullable(),
  deletedAt: z.date().nullable(),
});

export const CultureTypeViewModelSchema = CultureTypeSchema.extend({
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]).nullish(),
  deletedAt: z.union([z.string(), z.date()]).nullish(),
});

export type CultureType = z.infer<typeof CultureTypeSchema>;
export type CultureTypeViewModel = z.infer<typeof CultureTypeViewModelSchema>;

export const CultureTypeVM = {
  toViewModel: (cultureType: CultureType) => {
    return CultureTypeViewModelSchema.parse(cultureType);
  },
}; 