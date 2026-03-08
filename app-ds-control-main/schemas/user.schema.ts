import z from 'zod';
import { UserType } from '@/types/user.type';

const userTypeValues = Object.values(UserType).map((type) => type.value);

export const ChangeCurrentUserPasswordDialogSchema = z
  .object({
    oldPassword: z.string().min(6, 'A senha atual deve ter pelo menos 6 caracteres'),
    newPassword: z.string().min(6, 'A nova senha deve ter pelo menos 6 caracteres'),
    confirmNewPassword: z
      .string()
      .min(6, 'A confirmação da nova senha deve ter pelo menos 6 caracteres'),
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
