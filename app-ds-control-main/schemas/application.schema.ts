import { z } from 'zod';

const nullableIdSchema = z
  .string()
  .optional()
  .nullable()
  .transform((value) => (value && value.trim() ? value : null));

const requiredIdSchema = z.string().min(1);

const ApplicationCommonSchema = z.object({
  date: z.string().min(1, 'Data é obrigatória'),
  pilotId: z.string().min(1, 'Piloto é obrigatório'),
  droneId: z.string().min(1, 'Drone é obrigatório'),
  cultureId: z.string().min(1, 'Cultivo é obrigatório'),
  productId: z.string().min(1, 'Produto é obrigatório'),
  hectares: z.string().min(1, 'Hectares é obrigatório'),
  observations: z.string().optional().nullable(),
  flowRate: z.string().min(1, 'Vazão é obrigatória'),
  altitude: z.string().min(1, 'Altitude é obrigatória'),
  routeSpacing: z.string().min(1, 'Espaçamento de rota é obrigatório'),
  dropletSize: z.string().min(1, 'Tamanho de gota é obrigatório'),
});

export const ApplicationBaseSchema = ApplicationCommonSchema.extend({
  serviceOrderId: requiredIdSchema,
  farmId: requiredIdSchema,
  plotId: requiredIdSchema,
  assistantId: requiredIdSchema,
});

export const RegisterNewApplicationSchema = ApplicationBaseSchema;
export const UpdateApplicationByIdSchema = ApplicationBaseSchema;

export const RegisterNewLooseApplicationSchema = ApplicationCommonSchema.extend({
  serviceOrderId: nullableIdSchema,
  farmId: nullableIdSchema,
  plotId: nullableIdSchema,
  assistantId: nullableIdSchema,
  observations: z
    .string()
    .min(
      1,
      'Atenção: Para aplicações avulsas, as observações são obrigatórias, insira aqui o motivo.'
    ),
});

export const UpdateLooseApplicationSchema = RegisterNewLooseApplicationSchema;
