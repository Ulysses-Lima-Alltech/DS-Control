import { z } from 'zod';

export const RegisterNewApplicationSchema = z
  .object({
    serviceOrderId: z.string().transform(value => value === '' ? null : value).nullish(),
    farmId: z.string().transform(value => value === '' ? null : value).nullish(),
    pilotId: z.string().min(1, 'ID do piloto é obrigatório'),
    assistantId: z.string().min(1, 'ID do assistente é obrigatório'),
    droneId: z.string().min(1, 'ID do drone é obrigatório'),
    cultureId: z.string().min(1, 'ID da cultura é obrigatório'),
    hectares: z.string().min(1, 'Hectares é obrigatório'),
    flowRate: z.string().min(1, 'Vazão média é obrigatória'),
    altitude: z.string().min(1, 'Altitude é obrigatória'),
    routeSpacing: z.string().min(1, 'Espaçamento de rota é obrigatório'),
    dropletSize: z.string().min(1, 'Tamanho de gota é obrigatório'),
    date: z.string().min(1, 'Data é obrigatória'),
    productId: z.string().min(1, 'ID do produto é obrigatório'),
    plotId: z.string().transform(value => value === '' ? null : value).nullish(),
    observations: z.string().optional(),
  })
  .refine(
    (data) => {
      const isPlotIdEmpty = !data.plotId || data.plotId.trim() === '';

      if (isPlotIdEmpty) {
        return data.observations && data.observations.trim() !== '';
      }
      return true;
    },
    {
      message: 'Observações são obrigatórias quando nenhum talhão é selecionado',
      path: ['observations'],
    }
  );

export const UpdateApplicationByIdSchema = z
  .object({
    serviceOrderId: z.string().nullish(),
    farmId: z.string().nullish(),
    pilotId: z.string().min(1, 'ID do piloto é obrigatório'),
    assistantId: z.string().min(1, 'ID do assistente é obrigatório'),
    droneId: z.string().min(1, 'ID do drone é obrigatório'),
    cultureId: z.string().min(1, 'ID da cultura é obrigatório'),
    hectares: z.string().min(1, 'Hectares é obrigatório'),
    flowRate: z.string().min(1, 'Vazão média é obrigatória'),
    altitude: z.string().min(1, 'Altitude é obrigatória'),
    routeSpacing: z.string().min(1, 'Espaçamento de rota é obrigatório'),
    dropletSize: z.string().min(1, 'Tamanho de gota é obrigatório'),
    date: z.string().min(1, 'Data é obrigatória'),
    productId: z.string().min(1, 'ID do produto é obrigatório'),
    plotId: z.string().nullish(),
    observations: z.string().optional(),
  })
  .refine(
    (data) => {
      const isPlotIdEmpty = !data.plotId || data.plotId.trim() === '';

      if (isPlotIdEmpty) {
        return data.observations && data.observations.trim() !== '';
      }
      return true;
    },
    {
      message: 'Observações são obrigatórias quando nenhum talhão é selecionado',
      path: ['observations'],
    }
  );
