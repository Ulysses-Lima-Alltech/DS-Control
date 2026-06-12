import { Assistant } from '@/types/assistant.type';
import { CultureType } from '@/types/culture-types.type';
import { Drone } from '@/types/drone.type';
import { Plot } from '@/types/plot.type';
import { Product } from '@/types/product.type';
import { ServiceOrder } from '@/types/service-order.type';
import { User } from '@/types/user.type';

import { Farm } from './farm.type';

export type Application = {
  id: string;
  serviceOrderId: string | null;
  serviceOrder: ServiceOrder | null;
  pilotId: string;
  pilot: User;
  assistantId: string | null;
  assistant: Assistant | null;
  droneId: string;
  drone: Drone;
  cultureId: string;
  culture: CultureType;
  hectares: string;
  date: string;
  applicationDate?: string;
  productId: string;
  product: Product;
  plotId: string | null;
  plot: Plot | null;
  flowRate: string;
  altitude: string;
  routeSpacing: string;
  dropletSize: string;
  observations: string | null;
  createdAt: Date | string;
  updatedAt: Date | string | null;
  deletedAt?: Date | string | null;
  farmId: string | null;
  farm: Farm | null;
};

export type ApplicationIssueFilter =
  | 'invalid_open_os'
  | 'structural_pending'
  | 'structural_pending_other'
  | 'structural_missing_plot'
  | 'structural_missing_farm';

export const APPLICATION_ISSUE_LABELS: Record<ApplicationIssueFilter, string> = {
  invalid_open_os: 'Sem talhão (OS aberta)',
  structural_pending: 'Todas as pendências de vínculo',
  structural_pending_other: 'Outras pendências de vínculo/estrutura',
  structural_missing_plot: 'Sem talhão (pendências)',
  structural_missing_farm: 'Sem fazenda (pendências)',
};

export enum ApplicationOrderBy {
  DATE = 'date',
  PILOT = 'pilot',
  PRODUCT = 'product',
}

export enum ApplicationOrderType {
  ASC = 'asc',
  DESC = 'desc',
}
