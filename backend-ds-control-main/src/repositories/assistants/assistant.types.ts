export type Assistant = {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date | null;
  deletedAt: Date | null;
};

export interface CreateAssistant {
  name: string;
} 