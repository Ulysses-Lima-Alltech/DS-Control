import { UserType } from "@repositories/users/user.types";
import z from "zod";

export const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  password: z.string(),
  type: z.nativeEnum(UserType),
  createdAt: z.date(),
  updatedAt: z.date().nullable(),
  deletedAt: z.date().nullable(),
  customerId: z.string().uuid().nullish(),
});

export const UserViewModelSchema = UserSchema.omit({ password: true }).extend({
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]).nullish(),
  deletedAt: z.union([z.string(), z.date()]).nullish(),
});

export type User = z.infer<typeof UserSchema>;
export type UserViewModel = z.infer<typeof UserViewModelSchema>;

export const UserVM = {
  toViewModel: (user: User) => {
    return UserViewModelSchema.parse(user);
  },
};
