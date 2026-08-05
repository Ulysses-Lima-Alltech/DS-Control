import * as SQLite from 'expo-sqlite';

import type {
  OfflineBootstrap,
  OfflineDatasetManifest,
  OfflineMapPackStatus,
  OfflineOwner,
  OfflineOutboxOperation,
  OfflineStatusSnapshot,
} from '@/offline/offlineTypes';
import type { Application } from '@/types/applications.type';
import type { Farm } from '@/types/farm.type';
import type { OfflineApplication } from '@/types/offline-application.type';
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

type ActiveDatasetRow = {
  datasetId: string;
  ownerUserId: string;
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

async function getActiveDataset(): Promise<ActiveDatasetRow | null> {
  const db = await getDb();
  return db.getFirstAsync<ActiveDatasetRow>(
    `SELECT active.dataset_id AS datasetId, active.owner_user_id AS ownerUserId
       FROM offline_v2_runtime runtime
       JOIN offline_v2_active_datasets active
         ON active.owner_user_id = runtime.active_user_id
       JOIN offline_v2_datasets datasets
         ON datasets.dataset_id = active.dataset_id
        AND datasets.owner_user_id = active.owner_user_id
      WHERE runtime.singleton_id = 1
        AND datasets.state = 'READY'`
  );
}

async function insertDatasetCollection(
  tx: SQLite.SQLiteDatabase,
  datasetId: string,
  ownerUserId: string,
  collection: EntityCollection,
  items: unknown[],
  now: string
): Promise<void> {
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    await tx.runAsync(
      `INSERT INTO offline_v2_entities
         (dataset_id, owner_user_id, collection, entity_id, json, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      datasetId,
      ownerUserId,
      collection,
      getEntityId(item, String(index)),
      JSON.stringify(item),
      now
    );
  }
}

export async function stageOfflineBootstrapData(bootstrap: OfflineBootstrap): Promise<string> {
  if (!validateOfflineManifestShape(bootstrap, bootstrap.manifest)) {
    throw new Error('Manifesto offline incompativel com o dataset recebido.');
  }

  const owner = await getActiveOfflineOwner();
  if (!owner || owner.userId !== bootstrap.user.id) {
    throw new Error('Owner offline ativo nao corresponde ao dataset recebido.');
  }

  const db = await getDb();
  const now = new Date().toISOString();
  const datasetId = `${bootstrap.manifest.datasetVersion}:${now}`;
  const mapStatuses: OfflineMapPackStatus[] = bootstrap.mapPackages.map((mapPackage) => ({
    ...mapPackage,
    packName: `dataset-${bootstrap.manifest.datasetVersion}-farm-${mapPackage.farmId}`,
    status: 'pending',
    progress: 0,
  }));
  const collections: [EntityCollection, unknown[]][] = [
    ['farms', bootstrap.farms],
    ['plots', bootstrap.plots],
    ['serviceOrders', bootstrap.serviceOrders],
    ['applications', bootstrap.applications],
    ['routes', bootstrap.routes],
    ['mapPackages', bootstrap.mapPackages],
    ['mapPackStatuses', mapStatuses],
    ['assistants', bootstrap.assistants ?? []],
    ['drones', bootstrap.drones ?? []],
    ['cultureTypes', bootstrap.cultureTypes ?? []],
    ['products', bootstrap.products ?? []],
  ];

  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      `INSERT INTO offline_v2_datasets
         (dataset_id, owner_user_id, schema_version, dataset_version, manifest_checksum,
          manifest_json, state, server_time, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'STAGING', ?, ?)`,
      datasetId,
      owner.userId,
      bootstrap.manifest.schemaVersion,
      bootstrap.manifest.datasetVersion,
      bootstrap.manifest.checksum,
      JSON.stringify(bootstrap.manifest),
      bootstrap.serverTime,
      now
    );

    for (const serviceOrderId of bootstrap.manifest.selectedServiceOrderIds) {
      await tx.runAsync(
        `INSERT INTO offline_v2_service_order_selections
           (owner_user_id, service_order_id, dataset_id, selected_at)
         VALUES (?, ?, ?, ?)`,
        owner.userId,
        serviceOrderId,
        datasetId,
        now
      );
    }

    for (const [collection, items] of collections) {
      await insertDatasetCollection(tx, datasetId, owner.userId, collection, items, now);
    }

    await tx.runAsync(
      `UPDATE offline_v2_datasets SET state = 'DATA_READY'
        WHERE dataset_id = ? AND owner_user_id = ? AND state = 'STAGING'`,
      datasetId,
      owner.userId
    );
  });

  return datasetId;
}

export async function saveStagedMapPackStatuses(
  datasetId: string,
  statuses: OfflineMapPackStatus[]
): Promise<void> {
  const owner = await getActiveOfflineOwner();
  if (!owner) throw new Error('Owner offline ativo nao encontrado.');
  const db = await getDb();
  const now = new Date().toISOString();

  await db.withExclusiveTransactionAsync(async (tx) => {
    const dataset = await tx.getFirstAsync<{ state: string }>(
      `SELECT state FROM offline_v2_datasets
        WHERE dataset_id = ? AND owner_user_id = ?`,
      datasetId,
      owner.userId
    );
    if (!dataset || !['DATA_READY', 'STAGING'].includes(dataset.state)) {
      throw new Error('Dataset offline nao aceita atualizacao de mapas.');
    }
    await tx.runAsync(
      `DELETE FROM offline_v2_entities
        WHERE dataset_id = ? AND owner_user_id = ? AND collection = 'mapPackStatuses'`,
      datasetId,
      owner.userId
    );
    await insertDatasetCollection(tx, datasetId, owner.userId, 'mapPackStatuses', statuses, now);
  });
}

export async function activateOfflineDataset(
  datasetId: string,
  statuses: OfflineMapPackStatus[]
): Promise<void> {
  const owner = await getActiveOfflineOwner();
  if (!owner) throw new Error('Owner offline ativo nao encontrado.');
  if (statuses.some((status) => status.status !== 'available')) {
    throw new Error('Todos os mapas precisam estar validados antes de ativar o dataset.');
  }

  await saveStagedMapPackStatuses(datasetId, statuses);
  const db = await getDb();
  const now = new Date().toISOString();
  await db.withExclusiveTransactionAsync(async (tx) => {
    const dataset = await tx.getFirstAsync<{ state: string }>(
      `SELECT state FROM offline_v2_datasets
        WHERE dataset_id = ? AND owner_user_id = ?`,
      datasetId,
      owner.userId
    );
    if (dataset?.state !== 'DATA_READY') {
      throw new Error('Dataset offline nao esta pronto para ativacao.');
    }
    await tx.runAsync(
      `UPDATE offline_v2_datasets
          SET state = 'READY', activated_at = ?, failure_reason = NULL
        WHERE dataset_id = ? AND owner_user_id = ?`,
      now,
      datasetId,
      owner.userId
    );
    await tx.runAsync(
      `INSERT INTO offline_v2_active_datasets (owner_user_id, dataset_id, activated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(owner_user_id) DO UPDATE SET
         dataset_id = excluded.dataset_id,
         activated_at = excluded.activated_at`,
      owner.userId,
      datasetId,
      now
    );
  });
}

export async function failOfflineDataset(datasetId: string, reason: string): Promise<void> {
  const owner = await getActiveOfflineOwner();
  if (!owner) return;
  const db = await getDb();
  await db.runAsync(
    `UPDATE offline_v2_datasets
        SET state = 'FAILED', failure_reason = ?
      WHERE dataset_id = ? AND owner_user_id = ? AND state <> 'READY'`,
    reason.slice(0, 1000),
    datasetId,
    owner.userId
  );
}

export async function getActiveOfflineManifest(): Promise<OfflineDatasetManifest | null> {
  const active = await getActiveDataset();
  if (!active) return null;
  const db = await getDb();
  const row = await db.getFirstAsync<{ manifestJson: string }>(
    `SELECT manifest_json AS manifestJson
       FROM offline_v2_datasets
      WHERE dataset_id = ? AND owner_user_id = ? AND state = 'READY'`,
    active.datasetId,
    active.ownerUserId
  );
  if (!row) return null;
  try {
    return JSON.parse(row.manifestJson) as OfflineDatasetManifest;
  } catch {
    return null;
  }
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
  const active = await getActiveDataset();
  if (active) {
    const rows = await db.getAllAsync<OfflineEntityRow>(
      `SELECT json FROM offline_v2_entities
        WHERE dataset_id = ? AND owner_user_id = ? AND collection = ?
        ORDER BY entity_id ASC`,
      active.datasetId,
      active.ownerUserId,
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
  if (await getActiveOfflineOwner()) return [];

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
  const active = await getActiveDataset();
  if (active) {
    const row = await db.getFirstAsync<OfflineEntityRow>(
      `SELECT json FROM offline_v2_entities
        WHERE dataset_id = ? AND owner_user_id = ? AND collection = ? AND entity_id = ?`,
      active.datasetId,
      active.ownerUserId,
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
  if (await getActiveOfflineOwner()) return null;

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
  const owner = await getActiveOfflineOwner();
  if (owner) {
    await db.runAsync(
      `INSERT INTO offline_v2_meta (owner_user_id, key, value, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(owner_user_id, key) DO UPDATE SET
         value = excluded.value,
         updated_at = excluded.updated_at`,
      owner.userId,
      key,
      JSON.stringify(value),
      new Date().toISOString()
    );
    return;
  }
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
  const owner = await getActiveOfflineOwner();
  if (owner) {
    const scopedRow = await db.getFirstAsync<OfflineMetaRow>(
      `SELECT value FROM offline_v2_meta WHERE owner_user_id = ? AND key = ?`,
      owner.userId,
      key
    );
    if (!scopedRow) return null;
    try {
      return JSON.parse(scopedRow.value) as T;
    } catch {
      return null;
    }
  }
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
  const active = await getActiveDataset();
  if (active) {
    const db = await getDb();
    const now = new Date().toISOString();
    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync(
        `DELETE FROM offline_v2_entities
          WHERE dataset_id = ? AND owner_user_id = ? AND collection = 'mapPackStatuses'`,
        active.datasetId,
        active.ownerUserId
      );
      await insertDatasetCollection(
        tx,
        active.datasetId,
        active.ownerUserId,
        'mapPackStatuses',
        statuses,
        now
      );
    });
    return;
  }
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

function toCanonicalLocalApplication(
  application: OfflineApplication,
  relations: {
    serviceOrder: ServiceOrder | null;
    farm: Farm | null;
    plot: Record<string, unknown> | null;
    assistant: Record<string, unknown> | null;
    drone: Record<string, unknown> | null;
    culture: Record<string, unknown> | null;
    product: Record<string, unknown> | null;
  }
): Application {
  return {
    id: application.localId,
    serviceOrderId: application.serviceOrderId ?? null,
    serviceOrder: relations.serviceOrder,
    pilotId: application.pilotId,
    pilot: {
      id: application.pilotId,
      name: application.pilotName,
      type: 'pilot',
    } as Application['pilot'],
    assistantId: application.assistantId || null,
    assistant: relations.assistant as Application['assistant'],
    droneId: application.droneId,
    drone: relations.drone as Application['drone'],
    cultureId: application.cultureId,
    culture: relations.culture as Application['culture'],
    hectares: application.hectares,
    date: application.date,
    applicationDate: application.date,
    productId: application.productId,
    product: relations.product as Application['product'],
    plotId: application.plotId ?? null,
    plot: relations.plot as Application['plot'],
    flowRate: application.flowRate,
    altitude: application.altitude,
    routeSpacing: application.routeSpacing,
    dropletSize: application.dropletSize,
    observations: application.observations || null,
    createdAt: application.createdAt,
    updatedAt: application.createdAt,
    deletedAt: null,
    farmId: application.farmId ?? null,
    farm: relations.farm,
  };
}

export async function enqueueOfflineApplication(
  application: OfflineApplication,
  idempotencyKey = application.localId
): Promise<void> {
  const [owner, active, serviceOrders, farms, supportData] = await Promise.all([
    getActiveOfflineOwner(),
    getActiveDataset(),
    getOfflineServiceOrders(),
    getOfflineFarms(),
    getOfflineSupportData(),
  ]);
  if (!owner || !active || owner.userId !== active.ownerUserId) {
    throw new Error('Dataset offline ativo nao encontrado para este usuario.');
  }
  if (owner.role !== 'pilot' || application.pilotId !== owner.userId) {
    throw new Error('Aplicacao offline fora do escopo do piloto autenticado.');
  }

  const serviceOrder = application.serviceOrderId
    ? (serviceOrders.find((item) => item.id === application.serviceOrderId) ?? null)
    : null;
  if (application.serviceOrderId && !serviceOrder) {
    throw new Error('Ordem de Servico nao pertence ao dataset offline selecionado.');
  }
  const farm = application.farmId
    ? (farms.find((item) => item.id === application.farmId) ?? null)
    : null;
  const plot = application.plotId
    ? (farms.flatMap((item) => item.plots ?? []).find((item) => item.id === application.plotId) ??
      null)
    : null;
  if (application.farmId && !farm) throw new Error('Fazenda fora do dataset offline.');
  if (application.plotId && !plot) throw new Error('Talhao fora do dataset offline.');

  const localEntity = toCanonicalLocalApplication(application, {
    serviceOrder,
    farm,
    plot: plot as Record<string, unknown> | null,
    assistant: supportData.assistants.find((item) => item.id === application.assistantId) ?? null,
    drone: supportData.drones.find((item) => item.id === application.droneId) ?? null,
    culture: supportData.cultureTypes.find((item) => item.id === application.cultureId) ?? null,
    product: supportData.products.find((item) => item.id === application.productId) ?? null,
  });
  const updatedServiceOrder =
    application.plotCompleted && serviceOrder && application.plotId
      ? {
          ...serviceOrder,
          plots: (serviceOrder.plots ?? []).map((item) =>
            item.id === application.plotId ? { ...item, status: 'COMPLETED' as const } : item
          ),
        }
      : null;
  const payload = {
    serviceOrderId: application.serviceOrderId ?? null,
    farmId: application.farmId ?? null,
    pilotId: application.pilotId,
    assistantId: application.assistantId || null,
    droneId: application.droneId,
    cultureId: application.cultureId,
    productId: application.productId,
    plotId: application.plotId ?? null,
    date: application.date,
    hectares: application.hectares,
    flowRate: application.flowRate,
    altitude: application.altitude,
    routeSpacing: application.routeSpacing,
    dropletSize: application.dropletSize,
    observations: application.observations || null,
    plotCompleted: Boolean(application.plotCompleted),
  };
  const db = await getDb();
  const now = new Date().toISOString();
  await db.withExclusiveTransactionAsync(async (tx) => {
    const existing = await tx.getFirstAsync<{ ownerUserId: string }>(
      `SELECT owner_user_id AS ownerUserId FROM offline_v2_outbox WHERE idempotency_key = ?`,
      idempotencyKey
    );
    if (existing && existing.ownerUserId !== owner.userId) {
      throw new Error('Idempotency key pertence a outro usuario.');
    }
    await tx.runAsync(
      `INSERT INTO offline_v2_outbox
         (idempotency_key, owner_user_id, operation_type, payload_json, local_entity_json,
          state, attempt_count, created_at, updated_at)
       VALUES (?, ?, 'CREATE_APPLICATION', ?, ?, 'PENDING', 0, ?, ?)
       ON CONFLICT(idempotency_key) DO NOTHING`,
      idempotencyKey,
      owner.userId,
      JSON.stringify(payload),
      JSON.stringify(application),
      now,
      now
    );
    await tx.runAsync(
      `INSERT INTO offline_v2_entities
         (dataset_id, owner_user_id, collection, entity_id, json, updated_at)
       VALUES (?, ?, 'applications', ?, ?, ?)
       ON CONFLICT(dataset_id, collection, entity_id) DO UPDATE SET
         json = excluded.json,
         updated_at = excluded.updated_at`,
      active.datasetId,
      owner.userId,
      application.localId,
      JSON.stringify(localEntity),
      now
    );
    if (updatedServiceOrder) {
      await tx.runAsync(
        `UPDATE offline_v2_entities SET json = ?, updated_at = ?
          WHERE dataset_id = ? AND owner_user_id = ?
            AND collection = 'serviceOrders' AND entity_id = ?`,
        JSON.stringify(updatedServiceOrder),
        now,
        active.datasetId,
        owner.userId,
        updatedServiceOrder.id
      );
    }
  });
}

export async function getQueuedOfflineApplications(): Promise<OfflineApplication[]> {
  const owner = await getActiveOfflineOwner();
  if (!owner) return [];
  const db = await getDb();
  const rows = await db.getAllAsync<{
    localEntityJson: string;
    state: string;
    lastError: string | null;
  }>(
    `SELECT local_entity_json AS localEntityJson, state, last_error AS lastError
       FROM offline_v2_outbox
      WHERE owner_user_id = ? AND state <> 'SUCCEEDED'
      ORDER BY created_at ASC`,
    owner.userId
  );
  return rows.flatMap((row) => {
    try {
      const application = JSON.parse(row.localEntityJson) as OfflineApplication;
      return [
        {
          ...application,
          syncStatus:
            row.state === 'SYNCING'
              ? ('syncing' as const)
              : row.state === 'RETRY'
                ? ('error' as const)
                : ('pending' as const),
          syncError: row.lastError ?? undefined,
        },
      ];
    } catch {
      return [];
    }
  });
}

export async function deleteQueuedOfflineApplication(localId: string): Promise<void> {
  const owner = await getActiveOfflineOwner();
  const active = await getActiveDataset();
  if (!owner || !active) return;
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (tx) => {
    const operation = await tx.getFirstAsync<{ state: string }>(
      `SELECT state FROM offline_v2_outbox
        WHERE idempotency_key = ? AND owner_user_id = ?`,
      localId,
      owner.userId
    );
    if (!operation) return;
    if (!['PENDING', 'RETRY'].includes(operation.state)) {
      throw new Error('Operacao em sincronizacao nao pode ser removida.');
    }
    await tx.runAsync(
      `DELETE FROM offline_v2_outbox WHERE idempotency_key = ? AND owner_user_id = ?`,
      localId,
      owner.userId
    );
    await tx.runAsync(
      `DELETE FROM offline_v2_entities
        WHERE dataset_id = ? AND owner_user_id = ?
          AND collection = 'applications' AND entity_id = ?`,
      active.datasetId,
      owner.userId,
      localId
    );
  });
}

export async function countPendingOfflineOperations(): Promise<number> {
  const owner = await getActiveOfflineOwner();
  if (!owner) return 0;
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: number }>(
    `SELECT COUNT(*) AS value FROM offline_v2_outbox
      WHERE owner_user_id = ? AND state <> 'SUCCEEDED'`,
    owner.userId
  );
  return Number(row?.value ?? 0);
}

export async function claimOfflineOperations(limit = 20): Promise<OfflineOutboxOperation[]> {
  const owner = await getActiveOfflineOwner();
  if (!owner) return [];
  const db = await getDb();
  const now = new Date();
  const nowIso = now.toISOString();
  const leaseExpiresAt = new Date(now.getTime() + 2 * 60 * 1000).toISOString();
  const claimed: OfflineOutboxOperation[] = [];

  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      `UPDATE offline_v2_outbox
          SET state = 'RETRY', lease_expires_at = NULL, updated_at = ?
        WHERE owner_user_id = ? AND state = 'SYNCING' AND lease_expires_at <= ?`,
      nowIso,
      owner.userId,
      nowIso
    );
    const rows = await tx.getAllAsync<{
      idempotencyKey: string;
      operationType: OfflineOutboxOperation['operationType'];
      payloadJson: string;
      state: OfflineOutboxOperation['state'];
      attemptCount: number;
      createdAt: string;
      updatedAt: string;
      nextAttemptAt: string | null;
      lastError: string | null;
      remoteEntityId: string | null;
    }>(
      `SELECT idempotency_key AS idempotencyKey,
              operation_type AS operationType,
              payload_json AS payloadJson,
              state,
              attempt_count AS attemptCount,
              created_at AS createdAt,
              updated_at AS updatedAt,
              next_attempt_at AS nextAttemptAt,
              last_error AS lastError,
              remote_entity_id AS remoteEntityId
         FROM offline_v2_outbox
        WHERE owner_user_id = ?
          AND state IN ('PENDING', 'RETRY')
          AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
        ORDER BY created_at ASC
        LIMIT ?`,
      owner.userId,
      nowIso,
      Math.max(1, Math.min(limit, 100))
    );
    for (const row of rows) {
      await tx.runAsync(
        `UPDATE offline_v2_outbox
            SET state = 'SYNCING', attempt_count = attempt_count + 1,
                lease_expires_at = ?, updated_at = ?, last_error = NULL
          WHERE idempotency_key = ? AND owner_user_id = ?
            AND state IN ('PENDING', 'RETRY')`,
        leaseExpiresAt,
        nowIso,
        row.idempotencyKey,
        owner.userId
      );
      claimed.push({
        idempotencyKey: row.idempotencyKey,
        ownerUserId: owner.userId,
        operationType: row.operationType,
        payload: JSON.parse(row.payloadJson) as Record<string, unknown>,
        state: 'SYNCING',
        attemptCount: row.attemptCount + 1,
        createdAt: row.createdAt,
        updatedAt: nowIso,
        nextAttemptAt: row.nextAttemptAt,
        lastError: row.lastError,
        remoteEntityId: row.remoteEntityId,
      });
    }
  });
  return claimed;
}

export async function retryOfflineOperation(
  idempotencyKey: string,
  errorMessage: string,
  attemptCount: number
): Promise<void> {
  const owner = await getActiveOfflineOwner();
  if (!owner) return;
  const delaySeconds = Math.min(15 * 60, 2 ** Math.min(attemptCount, 8) * 5);
  const now = new Date();
  const db = await getDb();
  await db.runAsync(
    `UPDATE offline_v2_outbox
        SET state = 'RETRY', next_attempt_at = ?, lease_expires_at = NULL,
            last_error = ?, updated_at = ?
      WHERE idempotency_key = ? AND owner_user_id = ? AND state = 'SYNCING'`,
    new Date(now.getTime() + delaySeconds * 1000).toISOString(),
    errorMessage.slice(0, 1000),
    now.toISOString(),
    idempotencyKey,
    owner.userId
  );
}

export async function completeOfflineOperation(
  idempotencyKey: string,
  application: Application
): Promise<void> {
  const owner = await getActiveOfflineOwner();
  const active = await getActiveDataset();
  if (!owner || !active) throw new Error('Dataset offline ativo nao encontrado.');
  const db = await getDb();
  const now = new Date().toISOString();
  await db.withExclusiveTransactionAsync(async (tx) => {
    const row = await tx.getFirstAsync<{ localEntityJson: string }>(
      `SELECT local_entity_json AS localEntityJson
         FROM offline_v2_outbox
        WHERE idempotency_key = ? AND owner_user_id = ? AND state = 'SYNCING'`,
      idempotencyKey,
      owner.userId
    );
    if (!row) throw new Error('Operacao offline em sincronizacao nao encontrada.');
    const local = JSON.parse(row.localEntityJson) as OfflineApplication;
    await tx.runAsync(
      `DELETE FROM offline_v2_entities
        WHERE dataset_id = ? AND owner_user_id = ?
          AND collection = 'applications' AND entity_id = ?`,
      active.datasetId,
      owner.userId,
      local.localId
    );
    await tx.runAsync(
      `INSERT INTO offline_v2_entities
         (dataset_id, owner_user_id, collection, entity_id, json, updated_at)
       VALUES (?, ?, 'applications', ?, ?, ?)
       ON CONFLICT(dataset_id, collection, entity_id) DO UPDATE SET
         json = excluded.json,
         updated_at = excluded.updated_at`,
      active.datasetId,
      owner.userId,
      application.id,
      JSON.stringify(application),
      now
    );
    await tx.runAsync(
      `UPDATE offline_v2_outbox
          SET state = 'SUCCEEDED', remote_entity_id = ?, completed_at = ?, updated_at = ?,
              lease_expires_at = NULL, next_attempt_at = NULL, last_error = NULL
        WHERE idempotency_key = ? AND owner_user_id = ?`,
      application.id,
      now,
      now,
      idempotencyKey,
      owner.userId
    );
  });
}

export async function getOfflineMigrationState(migrationKey: string): Promise<string | null> {
  const owner = await getActiveOfflineOwner();
  if (!owner) return null;
  const db = await getDb();
  const row = await db.getFirstAsync<{ state: string }>(
    `SELECT state FROM offline_v2_migrations
      WHERE owner_user_id = ? AND migration_key = ?`,
    owner.userId,
    migrationKey
  );
  return row?.state ?? null;
}

export async function startOfflineMigration(migrationKey: string): Promise<void> {
  const owner = await getActiveOfflineOwner();
  if (!owner) throw new Error('Owner offline ativo nao encontrado.');
  const db = await getDb();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO offline_v2_migrations
       (owner_user_id, migration_key, state, migrated_count, started_at)
     VALUES (?, ?, 'RUNNING', 0, ?)
     ON CONFLICT(owner_user_id, migration_key) DO UPDATE SET
       state = CASE WHEN state = 'COMPLETED' THEN state ELSE 'RUNNING' END,
       last_error = NULL`,
    owner.userId,
    migrationKey,
    now
  );
}

export async function completeOfflineMigration(
  migrationKey: string,
  migratedCount: number
): Promise<void> {
  const owner = await getActiveOfflineOwner();
  if (!owner) throw new Error('Owner offline ativo nao encontrado.');
  const db = await getDb();
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE offline_v2_migrations
        SET state = 'COMPLETED', migrated_count = ?, completed_at = ?, last_error = NULL
      WHERE owner_user_id = ? AND migration_key = ?`,
    migratedCount,
    now,
    owner.userId,
    migrationKey
  );
}

export async function failOfflineMigration(
  migrationKey: string,
  errorMessage: string
): Promise<void> {
  const owner = await getActiveOfflineOwner();
  if (!owner) return;
  const db = await getDb();
  await db.runAsync(
    `UPDATE offline_v2_migrations
        SET state = 'FAILED', last_error = ?
      WHERE owner_user_id = ? AND migration_key = ? AND state <> 'COMPLETED'`,
    errorMessage.slice(0, 1000),
    owner.userId,
    migrationKey
  );
}

export async function clearOfflineStorage(): Promise<void> {
  const db = await getDb();
  const owner = await getActiveOfflineOwner();
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync('DELETE FROM offline_entities');
    await tx.runAsync('DELETE FROM offline_meta');
    if (!owner) return;
    const datasets = await tx.getAllAsync<{ datasetId: string }>(
      `SELECT dataset_id AS datasetId FROM offline_v2_datasets WHERE owner_user_id = ?`,
      owner.userId
    );
    for (const dataset of datasets) {
      await tx.runAsync('DELETE FROM offline_v2_entities WHERE dataset_id = ?', dataset.datasetId);
      await tx.runAsync(
        'DELETE FROM offline_v2_service_order_selections WHERE dataset_id = ?',
        dataset.datasetId
      );
    }
    await tx.runAsync(
      'DELETE FROM offline_v2_active_datasets WHERE owner_user_id = ?',
      owner.userId
    );
    await tx.runAsync('DELETE FROM offline_v2_datasets WHERE owner_user_id = ?', owner.userId);
    await tx.runAsync('DELETE FROM offline_v2_meta WHERE owner_user_id = ?', owner.userId);
    await tx.runAsync('DELETE FROM offline_v2_runtime WHERE singleton_id = 1');
  });
}

export function estimateOfflinePayloadBytes(bootstrap: OfflineBootstrap): number {
  return JSON.stringify(bootstrap).length;
}
