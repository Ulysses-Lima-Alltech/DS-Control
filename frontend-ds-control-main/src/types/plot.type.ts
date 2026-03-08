export type Plot = {
  id?: string;
  name: string;
  farmId?: string;
  customerId?: string;
  externalId: string;
  hectare: string;
  geoJson: GeoJSON.FeatureCollection;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
};
