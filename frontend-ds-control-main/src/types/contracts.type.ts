export type Contract = {
  id: string;
  customerId: string;
  name: string;
  dateStart: Date;
  dateEnd: Date;
  observation: string;
  customer: {
    id: string;
    name: string;
  };
  createdAt: Date;
  updatedAt: Date;
};

export enum ContractOrderBy {
  NAME = 'name',
  CREATEDAT = 'created_at'
}

export enum ContractOrderType {
  ASC = 'asc',
  DESC = 'desc'
}
