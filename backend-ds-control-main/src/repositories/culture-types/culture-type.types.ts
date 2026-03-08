export type CultureType = {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date | null;
  deletedAt: Date | null;
};

export interface CreateCultureType {
  name: string;
  description: string | null;
} 