export type Plot = {
  id: string;
  name: string;
  farmId: string;
  customerId: string;
  geoJson?: Record<string, unknown>;
  externalId: string;
  hectare: string;
  createdAt: Date;
  updatedAt: Date | null;
  deletedAt: Date | null;
};

export interface CreatePlot {
  name: string;
  farmId: string;
  customerId: string;
  geoJson: Record<string, unknown>;
  externalId: string;
  hectare: string;
} 