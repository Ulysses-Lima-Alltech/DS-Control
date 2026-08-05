import * as SQLite from 'expo-sqlite';

import type {
  OfflineBootstrap,
  OfflineDatasetManifest,
  OfflineMapPackStatus,
  OfflineOwner,
  OfflineStatusSnapshot,
} from '@/offline/offlineTypes';
import type { Application } from '@/types/applications.type';
import type { Farm } from '@/types/farm.type';
import type { Route } from '@/types/route.type';
import type { ServiceOrder } from '@/types/service-order.type';

const DATABASE_NAME = 'ds-control-offline.db';
const STATUS_META_KEY = 'offline_status';
export const OFFLINE_SCHEMA_VERSION = 2;

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
        PRAGMA foreign_keys = ON;

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

        CREATE TABLE IF NOT EXISTS offline_v2_owners (
          user_id TEXT PRIMARY KEY NOT NULL,
          customer_id TEXT,
          role TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS offline_v2_runtime (
          singleton_id INTEGER PRIMARY KEY NOT NULL CHECK (singleton_id = 1),
          active_user_id TEXT,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (active_user_id) REFERENCES offline_v2_owners(user_id)
        );

        CREATE TABLE IF NOT EXISTS offline_v2_datasets (
          dataset_id TEXT PRIMARY KEY NOT NULL,
          owner_user_id TEXT NOT NULL,
          schema_version INTEGER NOT NULL,
          dataset_version TEXT NOT NULL,
          manifest_checksum TEXT NOT NULL,
          manifest_json TEXT NOT NULL,
          state TEXT NOT NULL CHECK (state IN ('STAGING', 'DATA_READY', 'READY', 'FAILED')),
          server_time TEXT NOT NULL,
          created_at TEXT NOT NULL,
          activated_at TEXT,
          failure_reason TEXT,
          UNIQUE (owner_user_id, dataset_id),
          FOREIGN KEY (owner_user_id) REFERENCES offline_v2_owners(user_id)
        );

        CREATE INDEX IF NOT EXISTS offline_v2_datasets_owner_state_idx
          ON offline_v2_datasets(owner_user_id, state, created_at DESC);

        CREATE TABLE IF NOT EXISTS offline_v2_active_datasets (
          owner_user_id TEXT PRIMARY KEY NOT NULL,
          dataset_id TEXT NOT NULL UNIQUE,
          activated_at TEXT NOT NULL,
          FOREIGN KEY (owner_user_id) REFERENCES offline_v2_owners(user_id),
          FOREIGN KEY (dataset_id) REFERENCES offline_v2_datasets(dataset_id)
        );

        CREATE TABLE IF NOT EXISTS offline_v2_entities (
          dataset_id TEXT NOT NULL,
          owner_user_id TEXT NOT NULL,
          collection TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          json TEXT NOT NULL,
          content_checksum TEXT,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (dataset_id, collection, entity_id),
          FOREIGN KEY (dataset_id) REFERENCES offline_v2_datasets(dataset_id),
          FOREIGN KEY (owner_user_id) REFERENCES offline_v2_owners(user_id)
        );

        CREATE INDEX IF NOT EXISTS offline_v2_entities_owner_collection_idx
          ON offline_v2_entities(owner_user_id, collection, entity_id);

        CREATE TABLE IF NOT EXISTS offline_v2_service_order_selections (
          owner_user_id TEXT NOT NULL,
          service_order_id TEXT NOT NULL,
          dataset_id TEXT NOT NULL,
          selected_at TEXT NOT NULL,
          PRIMARY KEY (owner_user_id, service_order_id, dataset_id),
          FOREIGN KEY (owner_user_id) REFERENCES offline_v2_owners(user_id),
          FOREIGN KEY (dataset_id) REFERENCES offline_v2_datasets(dataset_id)
        );

        CREATE TABLE IF NOT EXISTS offline_v2_outbox (
          idempotency_key TEXT PRIMARY KEY NOT NULL,
          owner_user_id TEXT NOT NULL,
          operation_type TEXT NOT NULL CHECK (operation_type IN ('CREATE_APPLICATION')),
          payload_json TEXT NOT NULL,
          local_entity_json TEXT NOT NULL,
          state TEXT NOT NULL CHECK (state IN ('PENDING', 'SYNCING', 'RETRY', 'SUCCEEDED')),
          attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
          next_attempt_at TEXT,
          lease_expires_at TEXT,
          last_error TEXT,
          remote_entity_id TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          completed_at TEXT,
          FOREIGN KEY (owner_user_id) REFERENCES offline_v2_owners(user_id)
        );

        CREATE INDEX IF NOT EXISTS offline_v2_outbox_owner_state_idx
          ON offline_v2_outbox(owner_user_id, state, next_attempt_at, created_at);

        CREATE TABLE IF NOT EXISTS offline_v2_meta (
          owner_user_id TEXT NOT NULL,
          key TEXT NOT NULL,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (owner_user_id, key),
          FOREIGN KEY (owner_user_id) REFERENCES offline_v2_owners(user_id)
        );

        CREATE TABLE IF NOT EXISTS offline_v2_migrations (
          owner_user_id TEXT NOT NULL,
          migration_key TEXT NOT NULL,
          state TEXT NOT NULL CHECK (state IN ('RUNNING', 'COMPLETED', 'FAILED')),
          migrated_count INTEGER NOT NULL DEFAULT 0,
          started_at TEXT NOT NULL,
          completed_at TEXT,
          last_error TEXT,
          PRIMARY KEY (owner_user_id, migration_key),
          FOREIGN KEY (owner_user_id) REFERENCES offline_v2_owners(user_id)
        );

        PRAGMA user_version = 2;
      `);
      return db;
    });
  }

  return dbPromise;
}

export async function setActiveOfflineOwner(owner: OfflineOwner): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      `INSERT INTO offline_v2_owners (user_id, customer_id, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         customer_id = excluded.customer_id,
         role = excluded.role,
         updated_at = excluded.updated_at`,
      owner.userId,
      owner.customerId ?? null,
      owner.role,
      now,
      now
    );
    await tx.runAsync(
      `INSERT INTO offline_v2_runtime (singleton_id, active_user_id, updated_at)
       VALUES (1, ?, ?)
       ON CONFLICT(singleton_id) DO UPDATE SET
         active_user_id = excluded.active_user_id,
         updated_at = excluded.updated_at`,
      owner.userId,
      now
    );
  });
}

export async function getActiveOfflineOwner(): Promise<OfflineOwner | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{
    userId: string;
    customerId: string | null;
    role: string;
  }>(
    `SELECT owners.user_id AS userId,
            owners.customer_id AS customerId,
            owners.role AS role
       FROM offline_v2_runtime runtime
       JOIN offline_v2_owners owners ON owners.user_id = runtime.active_user_id
      WHERE runtime.singleton_id = 1`
  );

  return row ? { userId: row.userId, customerId: row.customerId, role: row.role } : null;
}

export async function clearActiveOfflineOwner(): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM offline_v2_runtime WHERE singleton_id = 1');
}

export async function getOfflineSchemaVersion(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  return Number(row?.user_version ?? 0);
}

export function validateOfflineManifestShape(
  bootstrap: OfflineBootstrap,
  manifest: OfflineDatasetManifest
): boolean {
  return (
    manifest.schemaVersion === OFFLINE_SCHEMA_VERSION &&
    manifest.counts.farms === bootstrap.farms.length &&
    manifest.counts.plots === bootstrap.plots.length &&
    manifest.counts.serviceOrders === bootstrap.serviceOrders.length &&
    manifest.counts.applications === bootstrap.applications.length &&
    manifest.counts.routes === bootstrap.routes.length &&
    manifest.counts.mapPackages === bootstrap.mapPackages.length &&
    manifest.selectedServiceOrderIds.length > 0
  );
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

export async function getOfflineRoutes(): Promise<Route[]> {
  return getCollection<Route>('routes');
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
