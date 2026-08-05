import type { Plot } from "../plots/plot.types";

export type Farm = {
  id: string;
  name: string;
  mapColor: string | null;
  customerId: string;
  createdAt: Date;
  updatedAt: Date | null;
  deletedAt: Date | null;
};

export type FarmWithPlots = Farm & {
  customer: { 
    id: string;
    name: string;
  };
  plots: Plot[];
};

export interface CreateFarm {
  name: string;
  customerId: string;
  mapColor?: string | null;
}

export enum FarmOrderBy {
  NAME = 'name',
  CREATEDAT = 'created_at',
  CUSTOMER = 'customer'
}

export enum FarmOrderType {
  ASC = 'asc',
  DESC = 'desc'
}
