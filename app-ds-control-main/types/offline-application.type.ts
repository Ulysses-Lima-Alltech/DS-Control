export interface OfflineApplication {
  localId: string;
  pilotId: string;
  pilotName: string;
  date: string;
  assistantId: string;
  assistantName: string;
  droneId: string;
  droneName: string;
  cultureId: string;
  cultureName: string;
  productId: string;
  productName: string;
  hectares: string;
  flowRate: string;
  altitude: string;
  routeSpacing: string;
  dropletSize: string;
  observations: string;
  createdAt: string;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'error';
  syncError?: string;
}

export interface OfflineDataCache {
  pilot: {
    id: string;
    name: string;
  } | null;
  assistants: Array<{ id: string; name: string }>;
  drones: Array<{ id: string; name: string }>;
  cultureTypes: Array<{ id: string; name: string }>;
  products: Array<{ id: string; name: string }>;
  lastUpdated: string;
}
