import z from "zod";

export const UpdateCustomerSchema = z.object({
  document_number: z.string().min(11).max(14, "CPF must be exactly 11  character | CNPJ must be exactly 14 characters").optional(),
  entity_type: z.enum(["PF", "PJ"]),
  phone: z.string().min(1).max(15).optional(),
  name: z.string().min(1).optional(),
  razaoSocial: z.string().min(1).optional().nullish(),
}).refine(
  (data) => {

    if(data.entity_type === "PF") return data.document_number?.length === 11;

    if(data.entity_type === "PJ") return data.document_number?.length === 14;

    return false
  },
  {
    message: "CPF must be exactly 11  character | CNPJ must be exactly 14 characters",
  }
);

export type UpdateCustomerDTO = z.infer<typeof UpdateCustomerSchema>; 