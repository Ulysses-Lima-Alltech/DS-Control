import { Plot } from '@/types/plot.type';

export type Farm = {
  id: string;
  name: string;
  customer: {
    id: string;
    name: string;
  };
  plots: Plot[];
  createdAt: string;
  updatedAt: string;
};

export enum FarmOrderBy {
  NAME = 'name',
  CREATEDAT = 'created_at',
  CUSTOMER = 'customer'
}

export enum FarmOrderType {
  ASC = 'asc',
  DESC = 'desc'
}
