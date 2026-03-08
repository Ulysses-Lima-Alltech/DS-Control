import z from "zod";


export const SuccessResponseSchema = <T extends z.ZodType>(dataSchema: T) => z.object({
  success: z.boolean(),
  message: z.string(),
  data: dataSchema,
});

export type SuccessResponse<T extends z.ZodType> = z.infer<ReturnType<typeof SuccessResponseSchema<T>>>;

