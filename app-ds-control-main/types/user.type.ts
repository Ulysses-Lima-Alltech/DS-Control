export type User = {
  id: string;
  email: string;
  name: string;
  password: string;
  type: (typeof UserType)[keyof typeof UserType]['value'];
  customerId: string;
  createdAt: Date;
  updatedAt: Date | null;
  deletedAt: Date | null;
  avatarUrl?: string;
};

export const UserType = {
  ADMIN: { value: 'admin', label: 'ADM' },
  BACKOFFICE: { value: 'backoffice', label: 'Administrativo' },
  PILOT: { value: 'pilot', label: 'Piloto' },
  FARMER: { value: 'farmer', label: 'Fazendeiro' },
};
