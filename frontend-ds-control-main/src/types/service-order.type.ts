import { Contract } from '@/types/contracts.type';
import { Customer } from '@/types/customer.type';
import { Farm } from '@/types/farm.type';
import { Plot } from '@/types/plot.type';
import { User } from '@/types/user.type';

export type ServiceOrderStatus = 'open' | 'completed' | 'cancelled';
export type ServiceOrderPlotStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED';
export type CompletedPlotsReportAreaMode = 'plot_area' | 'applied_area';

export type ServiceOrder = {
  id: string;
  number: number;
  status: ServiceOrderStatus;
  customerId: string;
  customer: Customer;
  contractId: string;
  contract: Contract;
  farms: Farm[];
  farmsIds: string[];
  pilotsIds: string[];
  pilots: User[];
  plotsIds: string[];
  plots: Plot[];
  observation: string;
  plannedDate: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  plannedHectares: number;
  totalAppliedHectares: number;
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
};

export type StatsServiceOrders = {
  openOrdersCount: number;
  completedOrdersCount: number;
  cancelledOrdersCount: number;
  farmsCount: number;
  plotsCount: number;
  totalAreaHectares: number;
  pilotsWithOpenOrders: number;
  invalidApplications: number;
  openOrdersAreaHectares: number;
  completedOrdersAreaHectares: number;
  cancelledOrdersAreaHectares: number;
  openOrdersAppliedHectares: number;
  completedOrdersAppliedHectares: number;
  cancelledOrdersAppliedHectares: number;
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
