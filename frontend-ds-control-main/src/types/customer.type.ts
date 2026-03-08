export type EntityType = 'PF' | 'PJ';

export type Customer = {
  id: string;
  document_number: string;
  entity_type: EntityType;
  phone: string;
  name: string;
  razaoSocial?: string;
  createdAt: Date;
  updatedAt: Date;
};

export enum CustomerOrderBy {
  NAME = 'name',
  CREATEDAT = 'created_at'
}

export enum CustomerOrderType {
  ASC = 'asc',
  DESC = 'desc'
}
