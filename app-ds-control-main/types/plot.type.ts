import { FeatureCollection } from 'geojson';

export type Plot = {
  id?: string;
  name: string;
  farmId?: string;
  customerId?: string;
  externalId: string;
  nameOverridden?: boolean;
  hectare: string;
  geoJson: FeatureCollection;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
  status?: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  completedAt?: string | null;
  completedBy?: string | null;
};
