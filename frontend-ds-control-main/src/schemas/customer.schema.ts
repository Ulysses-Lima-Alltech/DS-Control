import { z } from 'zod';

import { cpfCnpjField } from '@/schemas/user.schema';

export const RegisterNewCustomerSchema = z
  .object({
    document_number: cpfCnpjField,
    entity_type: z.enum(['PF', 'PJ'], {
      errorMap: () => ({ message: 'Escolha um tipo de cliente (PF ou PJ)' }),
    }),
    phone: z
      .string()
      .min(1, 'Telefone é obrigatório')
      .max(15, 'Telefone deve ter no máximo 15 caracteres'),
    name: z.string().min(1, 'Nome fantasia é obrigatório'),
    razaoSocial: z.string().nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.entity_type === 'PJ') {
        return data.razaoSocial && data.razaoSocial.trim() !== '';
      }
      return true;
    },
    {
      message: 'Razão social é obrigatória para pessoa jurídica',
      path: ['razaoSocial'],
    }
  );

export const UpdateCustomerByIdSchema = z
  .object({
    document_number: cpfCnpjField,
    entity_type: z.enum(['PF', 'PJ'], {
      errorMap: () => ({ message: 'Escolha um tipo de cliente (PF ou PJ)' }),
    }),
    phone: z.string().min(1, 'Telefone é obrigatório'),
    name: z.string().min(1, 'Nome fantasia é obrigatório'),
    razaoSocial: z.string().nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.entity_type === 'PJ') {
        return data.razaoSocial && data.razaoSocial.trim() !== '';
      }
      return true;
    },
    {
      message: 'Razão social é obrigatória para pessoa jurídica',
      path: ['razaoSocial'],
    }
  );
