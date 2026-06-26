import type { Application } from '@/types/applications.type';
import type { Farm } from '@/types/farm.type';
import type { Plot } from '@/types/plot.type';
import type { Route } from '@/types/route.type';
import type { ServiceOrder } from '@/types/service-order.type';
import type { User } from '@/types/user.type';

export type OfflineMapBounds = {
  northEast: [number, number];
  southWest: [number, number];
};

export type OfflineMapPackageDefinition = {
  farmId: string;
  name: string;
  styleURL: string;
  bounds: OfflineMapBounds;
  center: [number, number];
  minZoom: number;
  maxZoom: number;
};

export type OfflineMapPackStatus = OfflineMapPackageDefinition & {
  packName: string;
  status: 'pending' | 'downloading' | 'available' | 'error' | 'skipped';
  progress: number;
  completedResourceSize?: number;
  completedTileCount?: number;
  errorMessage?: string;
  downloadedAt?: string;
};

export type OfflineBootstrap = {
  user: Omit<User, 'password'> & { customerId?: string | null };
  tenant: Record<string, unknown> | null;
  permissions: string[];
  farms: Farm[];
  plots: Plot[];
  serviceOrders: ServiceOrder[];
  applications: Application[];
  routes: Route[];
  assistants?: Record<string, unknown>[];
  drones?: Record<string, unknown>[];
  cultureTypes?: Record<string, unknown>[];
  products?: Record<string, unknown>[];
  mapPackages: OfflineMapPackageDefinition[];
  serverTime: string;
};

export type OfflineModeStatus =
  | 'not-configured'
  | 'downloading-data'
  | 'downloading-maps'
  | 'available'
  | 'partial'
  | 'expired'
  | 'error';

export type OfflineStatusSnapshot = {
  status: OfflineModeStatus;
  isReady: boolean;
  lastSyncAt?: string;
  offlineExpiresAt?: string;
  approximateSizeBytes?: number;
  farmsCount: number;
  plotsCount: number;
  serviceOrdersCount: number;
  applicationsCount: number;
  mapPackagesCount: number;
  availableMapPackagesCount: number;
  warnings: string[];
  errors: string[];
  updatedAt: string;
};

export type OfflineSyncStage =
  | 'idle'
  | 'preparing'
  | 'downloading-data'
  | 'saving-data'
  | 'downloading-maps'
  | 'finalizing'
  | 'completed'
  | 'error';

export type OfflineSyncProgress = {
  stage: OfflineSyncStage;
  message: string;
  currentMapPackage?: string;
  mapPackageProgress?: number;
  completedMapPackages?: number;
  totalMapPackages?: number;
  warnings?: string[];
};
