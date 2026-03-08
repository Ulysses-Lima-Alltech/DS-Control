export type Contract = {
  id: string;
  customerId: string;
  name: string;
  dateStart: Date;
  dateEnd: Date;
  observation: string | null;
  createdAt: Date;
  updatedAt: Date | null;
  deletedAt: Date | null;
};

export type ContractWithCustomer = Contract & {
  customer: { 
    id: string;
    name: string;
  };
};

export interface CreateContract {
  customerId: string;
  name: string;
  dateStart: Date;
  dateEnd: Date;
  observation: string | null;
}

export enum ContractOrderBy {
  NAME = 'name',
  CREATEDAT = 'created_at'
}

export enum ContractOrderType {
  ASC = 'asc',
  DESC = 'desc'
}
