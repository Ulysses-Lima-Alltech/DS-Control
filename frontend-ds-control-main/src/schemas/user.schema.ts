import { z } from 'zod';

import { UserType } from '@/types/user.type';

// CPF/CNPJ validation utilities
const cpfRegex = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;
const cnpjRegex = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/;

// Custom validation function for CPF/CNPJ
export const validateCpfCnpj = (value: string) => {
  // Remove all non-digits to check the length
  const onlyNumbers = value.replace(/\D/g, '');

  if (onlyNumbers.length <= 11) {
    // CPF validation - should have exactly 11 digits and match CPF format
    return onlyNumbers.length === 11 && cpfRegex.test(value);
  } else {
    // CNPJ validation - should have exactly 14 digits and match CNPJ format
    return onlyNumbers.length === 14 && cnpjRegex.test(value);
  }
};

// Reusable CPF/CNPJ schema field
export const cpfCnpjField = z
  .string()
  .min(1, 'CPF/CNPJ é obrigatório')
  .refine(validateCpfCnpj, 'CPF/CNPJ inválido');

const userTypeValues = Object.values(UserType).map((type) => type.value);

export const PasswordSchema = z
  .string()
  .min(1, 'Senha é obrigatória')
  .min(6, 'A senha deve ter no mínimo 6 caracteres');

export const RegisterNewUserSchema = z
  .object({
    name: z.string().min(1, 'Nome completo é obrigatório'),
    email: z
      .string()
      .email('Endereço de e-mail inválido')
      .min(1, 'Endereço de e-mail é obrigatório'),
    password: PasswordSchema,
    confirmPassword: z.string().min(1, 'Confirme a senha'),
    type: z.enum(userTypeValues as [string, ...string[]], {
      errorMap: () => ({ message: 'Escolha um tipo de usuário' }),
    }),
    customerId: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  })
  .refine(
    (data) => {
      if (data.type === UserType.FARMER.value) {
        return data.customerId && data.customerId !== '404' && data.customerId.trim() !== '';
      }
      return true;
    },
    {
      message: 'É obrigatório selecionar um cliente para o usuário',
      path: ['customerId'],
    }
  );

export const RequestResetUserPasswordByEmailSchema = z.object({
  email: z.string().email('Endereço de e-mail inválido').min(1, 'Endereço de e-mail é obrigatório'),
});

export const UpdateCurrentUserSchema = z.object({
  name: z.string().min(1, 'Nome completo é obrigatório'),
  email: z.string().email('Endereço de e-mail inválido').min(1, 'Endereço de e-mail é obrigatório'),
});

export const ChangeCurrentUserPasswordDialogSchema = z
  .object({
    oldPassword: z.string().min(1, 'Senha atual é obrigatória'),
    newPassword: PasswordSchema,
    confirmNewPassword: z.string().min(1, 'Confirme a nova senha'),
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
