import { Contract } from '@/types/contracts.type';
import { Customer } from '@/types/customer.type';
import { Farm } from '@/types/farm.type';
import { Plot } from '@/types/plot.type';
import { User } from '@/types/user.type';

export type ServiceOrderStatus = 'open' | 'completed' | 'cancelled';

export type ServiceOrder = {
  id: string;
  number: number;
  status: ServiceOrderStatus;
  customerId: string;
  customer: Customer;
  contractId: string;
  contract: Contract;
  farms: Farm[];
  pilots: User[];
  plots: Plot[];
  observation: string;
  plannedDate: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
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
