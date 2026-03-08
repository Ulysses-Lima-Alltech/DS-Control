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
  farmId: string;
  pilotId: string;
  assistantId: string;
  droneId: string;
  cultureId: string;
  hectares: string;
  flowRate: string;
  altitude: string;
  routeSpacing: string;
  dropletSize: string;
  date: string;
  productId: string;
  plotId: string | null;
  observations: string | undefined;
  createdAt: Date;
  serviceOrder: ServiceOrder;
  pilot: User;
  assistant: User;
  drone: Drone;
  culture: CultureType;
  product: Product;
  plot: Plot;
  updatedAt: Date;
  farm: Farm;
};

export type ApplicationStats = {
  applicationCount: number;
  applicationCountByMonth: number;
  totalAreaHectares: number;
  averageApplicationArea: number;
  typeOfProducts: {
    product: string;
    hectares: number;
  }[];
  pilotsCount: number;
  dronesCount: number;
  culturesCount: number;
  averageApplicationByPilot: number;
  averageApplicationByDrone: number;
  averageAreaCoveredApplication: number;
  invalidApplication: number;
  totalHectaresByMonth: number;
  totalHectaresPerDay: number;
  totalHectaresByMonthPerDay: number;
  pendingApplicationsCount: number;
  pendingApplicationsTotalArea: number;
  pendingFarmsCount: number;
  pendingPlotsCount: number;
};

export enum ApplicationOrderBy {
  DATE = 'date',
  PILOT = 'pilot',
  PRODUCT = 'product'
}

export enum ApplicationOrderType {
  ASC = 'asc',
  DESC = 'desc'
}
