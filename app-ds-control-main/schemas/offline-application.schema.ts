import { z } from 'zod';

export const OfflineApplicationSchema = z.object({
  pilotId: z.string().min(1, 'Piloto é obrigatório'),
  pilotName: z.string().min(1, 'Nome do piloto é obrigatório'),
  date: z.string().min(1, 'Data é obrigatória'),
  assistantId: z.string().min(1, 'Ajudante é obrigatório'),
  assistantName: z.string().min(1, 'Nome do ajudante é obrigatório'),
  droneId: z.string().min(1, 'Drone é obrigatório'),
  droneName: z.string().min(1, 'Nome do drone é obrigatório'),
  cultureId: z.string().min(1, 'Cultivo é obrigatório'),
  cultureName: z.string().min(1, 'Nome do cultivo é obrigatório'),
  productId: z.string().min(1, 'Tipo de aplicação é obrigatório'),
  productName: z.string().min(1, 'Nome do produto é obrigatório'),
  hectares: z.string().min(1, 'Hectares é obrigatório'),
  flowRate: z.string().min(1, 'Vazão é obrigatória'),
  altitude: z.string().min(1, 'Altitude é obrigatória'),
  routeSpacing: z.string().min(1, 'Espaçamento de rota é obrigatório'),
  dropletSize: z.string().min(1, 'Tamanho de gota é obrigatório'),
  observations: z.string().optional(),
  serviceOrderId: z.string().nullish(),
  farmId: z.string().nullish(),
  plotId: z.string().nullish(),
  plotCompleted: z.boolean().optional(),
});

export type OfflineApplicationFormData = z.infer<typeof OfflineApplicationSchema>;
