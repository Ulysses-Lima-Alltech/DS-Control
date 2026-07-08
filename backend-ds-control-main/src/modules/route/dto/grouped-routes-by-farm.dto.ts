import { PaginatedRequestQueryStringSchema } from '@common/types/paginated-request.types';
import { RouteOrderBy, RouteOrderType } from '@repositories/routes/route.types';
import { z } from 'zod';

export const GroupedRoutesByFarmQueryStringSchema = PaginatedRequestQueryStringSchema.extend({
  search: z
    .string()
    .optional()
    .describe('Search term to filter routes by farm, customer or route name'),
  customerId: z.string().uuid().optional().describe('Customer ID to filter routes by customer'),
  farmId: z.string().uuid().optional().describe('Farm ID to filter routes by farm'),
  includeGeoJson: z
    .enum(['true', 'false'])
    .optional()
    .default('false')
    .transform((val) => val === 'true')
    .describe('Include route geoJson in the response'),
  orderBy: z.nativeEnum(RouteOrderBy).optional().describe('Field to order farm groups by'),
  orderType: z
    .nativeEnum(RouteOrderType)
    .optional()
    .describe('Order type (ascending or descending)'),
});

export type GroupedRoutesByFarmQueryString = z.infer<typeof GroupedRoutesByFarmQueryStringSchema>;
