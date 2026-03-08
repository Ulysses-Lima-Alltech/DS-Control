import { z } from 'zod';

import type { ApiResponse as RouteApiResponse } from '@/app/api/file-converter-route/route';
// eslint-disable-next-line import/order
import type { ApiResponse as FarmApiResponse } from '@/app/api/file-converter/route';

export const ConvertKmlToGeoJsonSchema = z.object({
  file: z
    .instanceof(File, { message: 'Arquivo KML é obrigatório' })
    .refine(
      (file) => file.type === 'application/vnd.google-earth.kml+xml' || file.name.endsWith('.kml'),
      {
        message: 'O arquivo deve ser um KML válido',
      }
    ),
  type: z.enum(['farm', 'route']),
});

export type ConvertKmlToGeoJsonParams = z.infer<typeof ConvertKmlToGeoJsonSchema>;

export async function convertKmlToGeoJson(
  data: ConvertKmlToGeoJsonParams
): Promise<FarmApiResponse | RouteApiResponse> {
  try {
    ConvertKmlToGeoJsonSchema.parse(data);

    const formData = new FormData();
    formData.append('file', data.file);

    const endpoint = data.type === 'route' ? '/api/file-converter-route' : '/api/file-converter';

    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('[File Service] Failed to convert KML to GeoJSON');
    }

    return await response.json();
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error('[File Service] Erro ao converter KML para GeoJSON: ' + error.message);
    }

    console.error('[File Service] Failed to convert KML to GeoJSON: ', error);
    throw new Error('[File Service] Failed to convert KML to GeoJSON');
  }
}
