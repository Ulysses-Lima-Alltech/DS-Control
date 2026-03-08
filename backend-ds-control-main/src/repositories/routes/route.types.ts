export type Route = {
  id: string;
  name: string;
  geoJson: Record<string, unknown>;
  farmId: string;
  customerId: string;
  createdAt: Date;
  updatedAt: Date | null;
  deletedAt: Date | null;
};

export type RouteWithFarm = Route & {
  farm: { 
    id: string;
    name: string;
  };
};

export type RouteWithCustomer = Route & {
  customer: { 
    id: string;
    name: string;
  };
};

export type RouteWithFarmAndCustomer = Route & {
  farm: { 
    id: string;
    name: string;
  };
  customer: { 
    id: string;
    name: string;
  };
};

export interface CreateRoute {
  name: string;
  geoJson: Record<string, unknown>;
  farmId: string;
  customerId: string;
} 

export enum RouteOrderBy {
  NAME = 'name',
  CREATEDAT = 'created_at',
  FARM = 'farm',
  CUSTOMER = 'customer'
}

export enum RouteOrderType {
  ASC = 'asc',
  DESC = 'desc'
}
