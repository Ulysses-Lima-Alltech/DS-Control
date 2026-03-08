import z from "zod";

import { DefaultPasswordSchema } from "@common/types/password.schema";
import { UserType } from "@repositories/users/user.types";


export const CreateUserSchema = z.object({
  email: z.string().email(),
  password: DefaultPasswordSchema,
  name: z.string().min(1),
  type: z.nativeEnum(UserType),
  customerId: z.string().uuid().nullish(),
}).refine(
  (data) => {
    // If type is FARMER, customerId can be present or null
    if (data.type === UserType.FARMER) {
      return true;
    }
    // If type is not FARMER, customerId must be null or undefined
    return data.customerId === null || data.customerId === undefined;
  },
  {
    message: "customerId is only allowed when user type is farmer",
    path: ["customerId"],
  }
);

export type CreateUserDTO = z.infer<typeof CreateUserSchema>;