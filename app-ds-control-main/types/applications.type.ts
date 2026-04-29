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
  serviceOrderId: string;
  serviceOrder: ServiceOrder;
  pilotId: string;
  pilot: User;
  assistantId: string;
  assistant: Assistant;
  droneId: string;
  drone: Drone;
  cultureId: string;
  culture: CultureType;
  hectares: string;
  date: string;
  productId: string;
  product: Product;
  plotId: string;
  plot: Plot;
  flowRate: string;
  altitude: string;
  routeSpacing: string;
  dropletSize: string;
  observations: string;
  createdAt: Date;
  updatedAt: Date;
  farmId: string;
  farm: Farm;
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
