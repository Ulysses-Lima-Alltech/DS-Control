import * as SQLite from 'expo-sqlite';

import type {
  OfflineBootstrap,
  OfflineMapPackStatus,
  OfflineStatusSnapshot,
} from '@/offline/offlineTypes';
import type { Application } from '@/types/applications.type';
import type { Farm } from '@/types/farm.type';
import type { Route } from '@/types/route.type';
import type { ServiceOrder } from '@/types/service-order.type';

const DATABASE_NAME = 'ds-control-offline.db';
const STATUS_META_KEY = 'offline_status';

type EntityCollection =
  | 'farms'
  | 'plots'
  | 'serviceOrders'
  | 'applications'
  | 'routes'
  | 'mapPackages'
  | 'mapPackStatuses'
  | 'assistants'
  | 'drones'
  | 'cultureTypes'
  | 'products';

type OfflineEntityRow = {
  json: string;
};

type OfflineMetaRow = {
  value: string;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const getEntityId = (item: unknown, fallback: string) => {
  if (item && typeof item === 'object' && 'id' in item) {
    const id = (item as { id?: unknown }).id;
    if (id != null && String(id)) return String(id);
  }

  if (item && typeof item === 'object' && 'packName' in item) {
    const packName = (item as { packName?: unknown }).packName;
    if (packName != null && String(packName)) return String(packName);
  }

  if (item && typeof item === 'object' && 'farmId' in item) {
    const farmId = (item as { farmId?: unknown }).farmId;
    if (farmId != null && String(farmId)) return String(farmId);
  }

  return fallback;
};

async function getDb() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DATABASE_NAME).then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;

        CREATE TABLE IF NOT EXISTS offline_entities (
          collection TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          json TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (collection, entity_id)
        );

        CREATE TABLE IF NOT EXISTS offline_meta (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);
      return db;
    });
  }

  return dbPromise;
}

async function replaceCollection(collection: EntityCollection, items: unknown[]): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync('DELETE FROM offline_entities WHERE collection = ?', collection);

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    await db.runAsync(
      `INSERT OR REPLACE INTO offline_entities (collection, entity_id, json, updated_at)
       VALUES (?, ?, ?, ?)`,
      collection,
      getEntityId(item, String(index)),
      JSON.stringify(item),
      now
    );
  }
}

async function getCollection<T>(collection: EntityCollection): Promise<T[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<OfflineEntityRow>(
    'SELECT json FROM offline_entities WHERE collection = ? ORDER BY entity_id ASC',
    collection
  );

  return rows.flatMap((row) => {
    try {
      return [JSON.parse(row.json) as T];
    } catch {
      return [];
    }
  });
}

async function getCollectionItem<T>(
  collection: EntityCollection,
  entityId: string
): Promise<T | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<OfflineEntityRow>(
    'SELECT json FROM offline_entities WHERE collection = ? AND entity_id = ?',
    collection,
    entityId
  );

  if (!row) return null;

  try {
    return JSON.parse(row.json) as T;
  } catch {
    return null;
  }
}

async function setMeta<T>(key: string, value: T): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO offline_meta (key, value, updated_at)
     VALUES (?, ?, ?)`,
    key,
    JSON.stringify(value),
    new Date().toISOString()
  );
}

async function getMeta<T>(key: string): Promise<T | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<OfflineMetaRow>(
    'SELECT value FROM offline_meta WHERE key = ?',
    key
  );

  if (!row) return null;

  try {
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}

export async function saveOfflineBootstrapData(
  bootstrap: OfflineBootstrap,
  status: OfflineStatusSnapshot
): Promise<void> {
  const mapStatuses: OfflineMapPackStatus[] = bootstrap.mapPackages.map((mapPackage) => ({
    ...mapPackage,
    packName: `farm-${mapPackage.farmId}`,
    status: 'pending',
    progress: 0,
  }));

  await replaceCollection('farms', bootstrap.farms);
  await replaceCollection('plots', bootstrap.plots);
  await replaceCollection('serviceOrders', bootstrap.serviceOrders);
  await replaceCollection('applications', bootstrap.applications);
  await replaceCollection('routes', bootstrap.routes);
  await replaceCollection('mapPackages', bootstrap.mapPackages);
  await replaceCollection('mapPackStatuses', mapStatuses);
  await replaceCollection('assistants', bootstrap.assistants ?? []);
  await replaceCollection('drones', bootstrap.drones ?? []);
  await replaceCollection('cultureTypes', bootstrap.cultureTypes ?? []);
  await replaceCollection('products', bootstrap.products ?? []);
  await setOfflineStatus(status);
}

export async function setOfflineStatus(status: OfflineStatusSnapshot): Promise<void> {
  await setMeta(STATUS_META_KEY, status);
}

export async function getOfflineStatus(): Promise<OfflineStatusSnapshot | null> {
  return getMeta<OfflineStatusSnapshot>(STATUS_META_KEY);
}

export async function saveMapPackStatuses(statuses: OfflineMapPackStatus[]): Promise<void> {
  await replaceCollection('mapPackStatuses', statuses);
}

export async function getMapPackStatuses(): Promise<OfflineMapPackStatus[]> {
  return getCollection<OfflineMapPackStatus>('mapPackStatuses');
}

export async function getOfflineFarms(): Promise<Farm[]> {
  return getCollection<Farm>('farms');
}

export async function getOfflineFarmById(farmId: string): Promise<Farm | null> {
  return getCollectionItem<Farm>('farms', farmId);
}

export async function getOfflineRoutesByFarmId(farmId: string): Promise<Route[]> {
  const routes = await getCollection<Route>('routes');
  return routes.filter((route) => route.farmId === farmId);
}

export async function getOfflineServiceOrders(): Promise<ServiceOrder[]> {
  return getCollection<ServiceOrder>('serviceOrders');
}

export async function getOfflineServiceOrderById(
  serviceOrderId: string
): Promise<ServiceOrder | null> {
  return getCollectionItem<ServiceOrder>('serviceOrders', serviceOrderId);
}

export async function getOfflineApplications(): Promise<Application[]> {
  return getCollection<Application>('applications');
}

export async function getOfflineApplicationsByServiceOrderId(
  serviceOrderId: string
): Promise<Application[]> {
  const applications = await getOfflineApplications();
  return applications.filter((application) => application.serviceOrderId === serviceOrderId);
}

export async function getOfflineApplicationsByPlotId(plotId: string): Promise<Application[]> {
  const applications = await getOfflineApplications();
  return applications.filter((application) => application.plotId === plotId);
}

export async function getOfflineSupportData() {
  const [assistants, drones, cultureTypes, products] = await Promise.all([
    getCollection<Record<string, unknown>>('assistants'),
    getCollection<Record<string, unknown>>('drones'),
    getCollection<Record<string, unknown>>('cultureTypes'),
    getCollection<Record<string, unknown>>('products'),
  ]);

  return { assistants, drones, cultureTypes, products };
}

export async function clearOfflineStorage(): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM offline_entities');
  await db.runAsync('DELETE FROM offline_meta');
}

export function estimateOfflinePayloadBytes(bootstrap: OfflineBootstrap): number {
  return JSON.stringify(bootstrap).length;
}
