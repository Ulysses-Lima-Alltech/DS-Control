import type { serviceOrders } from '@infra/database/schema';

export type ServiceOrder = typeof serviceOrders.$inferSelect;

export type CreateServiceOrder = typeof serviceOrders.$inferInsert;

export type ServiceOrderWithDetails = ServiceOrder & {
  plannedHectares: number;
  totalAppliedHectares: number;
  grossAppliedAreaHa: number;
  registeredCompletedAreaHa: number;
  inProgressAppliedAreaHa: number;
  consolidatedPlotAreaHa: number;
  registeredProgressPercent: number;
  grossAppliedProgressPercent: number;
  consolidatedProgressPercent: number;
  progressPercent: number;
  completedHectares: number;
  pendingHectares: number;
  completedPlots: number;
  pendingPlots: number;
  applicationsCount: number;
  plotsWithApplications: number;
  totalPlots: number;
  myAppliedHectares: number;
  myApplicationsCount: number;
  plotCompletionThresholdPercent: number;
  farms: Array<{
    id: string;
    name: string;
    customerId: string;
    createdAt: Date;
    updatedAt: Date;
    plots: Array<{
      id: string;
      name: string;
      hectare: string;
      geoJson: unknown;
      farmId: string;
      customerId: string;
      externalId: string;
      createdAt: Date;
      updatedAt: Date;
    }>;
  }>;
  customer: {
    id: string;
    document_number: string;
    entity_type: 'PF' | 'PJ';
    phone: string;
    name: string;
    razaoSocial: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  contract: {
    id: string;
    customerId: string | null;
    name: string;
    date_start: Date;
    date_end: Date;
    observation: string;
    createdAt: Date;
    updatedAt: Date;
  };
  pilots: Array<{
    id: string;
    name: string;
    email: string;
    password: string;
    type: 'backoffice' | 'pilot' | 'farmer';
    createdAt: Date;
    customerId: string | null;
    updatedAt: Date | null;
    deletedAt: Date | null;
  }>;
  plots: Array<{
    id: string;
    name: string;
    hectare: string;
    geoJson: unknown;
    farmId: string;
    customerId: string;
    externalId: string;
    createdAt: Date;
    updatedAt: Date;
    status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
    completedAt: Date | null;
    completedBy: string | null;
    effectiveAppliedHectares: string;
    grossAppliedHectares: string;
    coveragePercent: string;
    derivedStatus: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  }>;
};

export enum ServiceOrderBy {
  NUMBER = 'number',
  CUSTOMER = 'customer',
  PLANNED_DATE = 'planned_date',
}

export enum ServiceOrderType {
  ASC = 'asc',
  DESC = 'desc',
}
