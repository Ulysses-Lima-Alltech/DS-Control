export type Customer = {
  id: string;
  document_number: string;
  entity_type: "PF" | "PJ";
  phone: string;
  name: string;
  razaoSocial: string | null;
  createdAt: Date;
  updatedAt: Date | null;
  deletedAt: Date | null;
};

export interface CreateCustomer {
  document_number: string;
  entity_type: "PF" | "PJ";
  phone: string;
  name: string;
  razaoSocial: string | null;
} 

export enum CustomerOrderBy {
  NAME = 'name',
  CREATEDAT = 'created_at'
}

export enum CustomerOrderType {
  ASC = 'asc',
  DESC = 'desc'
}