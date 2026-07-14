import type { ServiceOrder } from '@/types/service-order.type';

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
  serviceOrderId?: string | null;
  farmId?: string | null;
  plotId?: string | null;
  plotCompleted?: boolean;
  applicationSynced?: boolean;
  createdAt: string;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'error';
  syncError?: string;
}

export interface OfflineDataCache {
  pilot: {
    id: string;
    name: string;
  } | null;
  assistants: { id: string; name: string }[];
  drones: { id: string; name: string }[];
  cultureTypes: { id: string; name: string }[];
  products: { id: string; name: string }[];
  serviceOrders?: ServiceOrder[];
  lastUpdated: string;
}
