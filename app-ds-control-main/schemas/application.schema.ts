import { z } from 'zod';

export const ApplicationBaseSchema = z.object({
  serviceOrderId: z.string().min(1, 'Ordem de serviço é obrigatória'),
  date: z.string().min(1, 'Data é obrigatória'),
  pilotId: z.string().min(1, 'Piloto é obrigatório'),
  plotId: z.string().min(1, 'Talhão é obrigatório'),
  assistantId: z.string().min(1, 'Ajudante é obrigatório'),
  droneId: z.string().min(1, 'Drone é obrigatório'),
  cultureId: z.string().min(1, 'Cultivo é obrigatório'),
  productId: z.string().min(1, 'Produto é obrigatório'),
  hectares: z.string().min(1, 'Hectares é obrigatório'),
  observations: z.string().optional(),
  flowRate: z.string().min(1, 'Vazão é obrigatória'),
  altitude: z.string().min(1, 'Altitude é obrigatória'),
  routeSpacing: z.string().min(1, 'Espaçamento de rota é obrigatório'),
  dropletSize: z.string().min(1, 'Tamanho de gota é obrigatório'),
});

export const RegisterNewApplicationSchema = ApplicationBaseSchema;
export const UpdateApplicationByIdSchema = ApplicationBaseSchema.extend({
  farmId: z.string().min(1, 'Fazenda é obrigatória'),
});

export const RegisterNewLooseApplicationSchema = ApplicationBaseSchema.extend({
  plotId: z.string().optional().nullable(),
  farmId: z.string().optional().nullable(),
  serviceOrderId: z.string().optional().nullable(),
  observations: z
    .string()
    .min(
      1,
      'Atenção: Para aplicações avulsas, as observações são obrigatórias, insira aqui o motivo.'
    ),
});

export const UpdateLooseApplicationSchema = RegisterNewLooseApplicationSchema;
