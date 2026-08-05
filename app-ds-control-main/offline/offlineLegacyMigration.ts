import {
  completeOfflineMigration,
  enqueueOfflineApplication,
  failOfflineMigration,
  getActiveOfflineOwner,
  getOfflineMigrationState,
  startOfflineMigration,
} from '@/offline/offlineStorage';
import {
  getOfflineApplications as getLegacyOfflineApplications,
  replaceOfflineApplications,
} from '@/utils/offline-storage';

const LEGACY_OUTBOX_MIGRATION = 'legacy_async_storage_outbox_v1';

export async function migrateLegacyOfflineApplicationQueue(): Promise<number> {
  const owner = await getActiveOfflineOwner();
  if (!owner) return 0;
  const legacyApplications = await getLegacyOfflineApplications();
  const ownedApplications = legacyApplications.filter(
    (application) => application.pilotId === owner.userId
  );
  const preservedApplications = legacyApplications.filter(
    (application) => application.pilotId !== owner.userId
  );
  const state = await getOfflineMigrationState(LEGACY_OUTBOX_MIGRATION);

  if (state === 'COMPLETED') {
    if (ownedApplications.length > 0) await replaceOfflineApplications(preservedApplications);
    return 0;
  }

  await startOfflineMigration(LEGACY_OUTBOX_MIGRATION);
  try {
    for (const application of ownedApplications) {
      await enqueueOfflineApplication(application, application.localId);
    }
    await completeOfflineMigration(LEGACY_OUTBOX_MIGRATION, ownedApplications.length);
    await replaceOfflineApplications(preservedApplications);
    return ownedApplications.length;
  } catch (error) {
    await failOfflineMigration(
      LEGACY_OUTBOX_MIGRATION,
      error instanceof Error ? error.message : 'Falha ao migrar fila offline legada.'
    );
    throw error;
  }
}
