export enum UserType {
  BACKOFFICE = 'backoffice',
  PILOT = 'pilot',
  FARMER = 'farmer',
}

export type User = {
  id: string;
  email: string;
  name: string;
  password: string;
  type: UserType;
  createdAt: Date;
  updatedAt: Date | null;
  deletedAt: Date | null;
  customerId: string | null;
  mustChangePassword: boolean;
};

export interface CreateUser {
  email: string;
  name: string;
  password: string;
  type?: UserType;
  customerId?: string | null;
}

export enum UserOrderBy {
  NAME = 'name',
  CREATEDAT = 'created_at'
}

export enum UserOrderType {
  ASC = 'asc',
  DESC = 'desc'
}
