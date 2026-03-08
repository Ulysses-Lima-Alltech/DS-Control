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

export enum ApplicationOrderBy {
  DATE = 'date',
  PILOT = 'pilot',
  PRODUCT = 'product',
}

export enum ApplicationOrderType {
  ASC = 'asc',
  DESC = 'desc',
}
