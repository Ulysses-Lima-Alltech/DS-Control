import z from "zod";

export const CreateCustomerSchema = z.object({
  document_number: z.string().min(11).max(14, "CPF must be exactly 11  character | CNPJ must be exactly 14 characters"),
  entity_type: z.enum(["PF", "PJ"]),
  phone: z.string().min(1).max(15),
  name: z.string().min(1),
  razaoSocial: z.string().min(1).nullable(),
}).refine(
  (data) => {

    if(data.entity_type === "PF") return data.document_number.length === 11;

    if(data.entity_type === "PJ") return data.document_number.length === 14;

    return false;
  }, 
  {
    message: "CPF must be exactly 11  character | CNPJ must be exactly 14 characters",
    path: ["document_number"],
  }
);

export type CreateCustomerDTO = z.infer<typeof CreateCustomerSchema>; 