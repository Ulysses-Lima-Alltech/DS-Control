import { CultureType } from '@/types/culture-types.type';
import { Drone } from '@/types/drone.type';
import { Plot } from '@/types/plot.type';
import { Product } from '@/types/product.type';
import { ServiceOrder } from '@/types/service-order.type';
import { User } from '@/types/user.type';

import { Farm } from './farm.type';

export type DjiApplicationMetadata = {
  plot?: string | null;
  farm?: string | null;
  pilot?: string | null;
  drone?: string | null;
  dsAreaHa?: string | number | null;
  djiAreaHa?: string | number | null;
  dsPlannedAreaHa?: string | number | null;
  dsAppliedAreaHa?: string | number | null;
  djiTaskAreaHa?: string | number | null;
  djiEstimatedAppliedAreaHa?: string | number | null;
  djiLinkedFlightCount?: number | null;
  djiRenderedFlightCount?: number | null;
  djiEstimatedAppliedAreaTotalHa?: string | number | null;
  areaDifferenceHa?: number | null;
  areaDifferencePercent?: number | null;
  flightCount?: number | null;
  flightRecordNumbers?: string[];
  reviewStatus?: string | null;
  reviewApprovedAt?: string | null;
  reviewApprovedBy?: string | null;
  [key: string]: unknown;
};

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
  djiImageUrl?: string;
  djiImageStatus?: string;
  djiDate?: string;
  djiImageScope?: 'day' | 'application';
  djiMatchType?: 'exact_application' | 'high_confidence' | 'date_only' | 'no_match' | string;
  djiMatchConfidence?: number;
  djiFlightRecordNumber?: string | null;
  djiMetadata?: DjiApplicationMetadata | null;
};

/** Filtro de listagem alinhado às métricas de inconsistência no backend. */
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

export type ApplicationStats = {
  applicationCount: number;
  applicationCountByMonth: number;
  totalAreaHectares: number;
  averageApplicationArea: number;
  typeOfProducts: {
    productId?: string;
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
  /** Enviado pela API a partir do detalhamento de pendências; ausente em respostas antigas em cache. */
  pendingApplicationsMissingFarmCount?: number;
  /**
   * Pendências estruturais fora do recorte invalidApplication; com invalidApplication soma ao total de pendências.
   */
  pendingApplicationsOtherThanInvalidOpenCount?: number;
  operationalAverageHectaresPerDay: number;
  operationalAverageHectaresPerDrone: number;
  operationalAverageHectaresPerPilot: number;
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
