export type User = {
  id: string;
  email: string;
  name: string;
  password: string;
  type: (typeof UserType)[keyof typeof UserType]['value'];
  createdAt: Date;
  updatedAt: Date | null;
  deletedAt: Date | null;
  avatarUrl?: string;
};

export const UserType = {
  BACKOFFICE: { value: 'backoffice', label: 'Administrativo' },
  PILOT: { value: 'pilot', label: 'Piloto' },
  FARMER: { value: 'farmer', label: 'Fazendeiro' },
};

export enum UserOrderBy {
  NAME = 'name',
  CREATEDAT = 'created_at'
}

export enum UserOrderType {
  ASC = 'asc',
  DESC = 'desc'
}
