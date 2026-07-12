import z from 'zod';
import { UserType } from '@/types/user.type';

const userTypeValues = Object.values(UserType).map((type) => type.value);

export const PasswordSchema = z
  .string()
  .min(1, 'Senha é obrigatória')
  .min(6, 'A senha deve ter no mínimo 6 caracteres');

export const ChangeCurrentUserPasswordDialogSchema = z
  .object({
    oldPassword: z.string().min(1, 'A senha atual é obrigatória'),
    newPassword: PasswordSchema,
    confirmNewPassword: z
      .string()
      .min(1, 'Confirme a nova senha'),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmNewPassword'],
  });

export const UpdateUserByIdSchema = z.object({
  name: z.string().min(1, 'Nome completo é obrigatório'),
  email: z.string().email('Endereço de e-mail inválido').min(1, 'Endereço de e-mail é obrigatório'),
  type: z.enum(userTypeValues as [string, ...string[]], {
    errorMap: () => ({ message: 'Escolha um tipo de usuário' }),
  }),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email('Endereço de e-mail inválido'),
});
