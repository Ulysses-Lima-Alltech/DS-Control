import { createHash } from 'node:crypto';
import type { SyncOfflineOperationDTO } from './dto/sync-offline-operations.dto';

export function hashOfflineOperation(operation: SyncOfflineOperationDTO): string {
  return createHash('sha256')
    .update(JSON.stringify({ operationType: operation.operationType, payload: operation.payload }))
    .digest('hex');
}
