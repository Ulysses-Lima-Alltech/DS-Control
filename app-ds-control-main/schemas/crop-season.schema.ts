import { z } from 'zod';

const CIVIL_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidCivilDate(value: string): boolean {
  if (!CIVIL_DATE_REGEX.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
}

const CropSeasonBaseSchema = z
  .object({
    name: z.string().trim().min(1, 'Nome é obrigatório'),
    startDate: z.string().refine(isValidCivilDate, {
      message: 'Data inicial inválida. Use YYYY-MM-DD',
    }),
    endDate: z.string().refine(isValidCivilDate, {
      message: 'Data final inválida. Use YYYY-MM-DD',
    }),
    productIds: z.array(z.string().uuid()).min(1, 'Selecione ao menos um produto'),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: 'Data fim não pode ser menor que data início',
    path: ['endDate'],
  });

export const RegisterNewCropSeasonSchema = CropSeasonBaseSchema;
export const UpdateCropSeasonByIdSchema = CropSeasonBaseSchema;
