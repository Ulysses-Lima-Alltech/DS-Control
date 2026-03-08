import z from "zod";

import { UserType } from "@repositories/users/user.types";

export const UpdateUserSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).optional(),
  type: z.nativeEnum(UserType).optional(),
});

export type UpdateUserDTO = z.infer<typeof UpdateUserSchema>; 