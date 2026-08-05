import AppError from '@common/handlers/app-error';
import { HTTP_STATUS_CODES } from '@common/types/http-status.types';
import { toOperationalDateDatabaseTimestamp } from '@common/utils/operational-date';
import { db } from '@infra/database';
import {
  applications,
  offlineOperationReceipts,
  plots,
  serviceOrderFarms,
  serviceOrderPilots,
  serviceOrderPlots,
  users,
} from '@infra/database/schema';
import { and, eq } from 'drizzle-orm';
import type {
  SyncOfflineOperationDTO,
  SyncOfflineOperationsDTO,
} from './dto/sync-offline-operations.dto';
import { hashOfflineOperation } from './offline-operation-idempotency';

type OfflineOperationSuccess = {
  idempotencyKey: string;
  status: 'SUCCEEDED';
  application: typeof applications.$inferSelect;
  replayed: boolean;
};

type OfflineOperationFailure = {
  idempotencyKey: string;
  status: 'FAILED';
  error: string;
};

type StoredResponse = Omit<OfflineOperationSuccess, 'replayed'>;

export class MobileOfflineOperationsService {
  public async sync(
    userId: string,
    input: SyncOfflineOperationsDTO,
  ): Promise<{ results: (OfflineOperationSuccess | OfflineOperationFailure)[] }> {
    const results: (OfflineOperationSuccess | OfflineOperationFailure)[] = [];

    for (const operation of input.operations) {
      try {
        results.push(await this.executeCreateApplication(userId, operation));
      } catch (error) {
        if (!(error instanceof AppError)) throw error;
        results.push({
          idempotencyKey: operation.idempotencyKey,
          status: 'FAILED',
          error: error.message,
        });
      }
    }

    return { results };
  }

  private async executeCreateApplication(
    userId: string,
    operation: SyncOfflineOperationDTO,
  ): Promise<OfflineOperationSuccess> {
    const requestHash = hashOfflineOperation(operation);

    return db.transaction(async (tx) => {
      await tx
        .insert(offlineOperationReceipts)
        .values({
          userId,
          idempotencyKey: operation.idempotencyKey,
          operationType: operation.operationType,
          requestHash,
        })
        .onConflictDoNothing({
          target: [offlineOperationReceipts.userId, offlineOperationReceipts.idempotencyKey],
        });

      const [receipt] = await tx
        .select()
        .from(offlineOperationReceipts)
        .where(
          and(
            eq(offlineOperationReceipts.userId, userId),
            eq(offlineOperationReceipts.idempotencyKey, operation.idempotencyKey),
          ),
        )
        .limit(1);

      if (!receipt) {
        throw new Error('Offline operation receipt was not created');
      }
      if (
        receipt.requestHash !== requestHash ||
        receipt.operationType !== operation.operationType
      ) {
        throw new AppError(
          'Idempotency key already used with a different operation',
          HTTP_STATUS_CODES.CONFLICT,
        );
      }
      if (receipt.status === 'SUCCEEDED' && receipt.responseJson) {
        const stored = receipt.responseJson as StoredResponse;
        return { ...stored, replayed: true };
      }

      const [authenticatedUser] = await tx
        .select({ id: users.id, type: users.type })
        .from(users)
        .where(and(eq(users.id, userId), eq(users.type, 'pilot')))
        .limit(1);
      if (!authenticatedUser || operation.payload.pilotId !== authenticatedUser.id) {
        throw new AppError(
          'Offline application is outside the authenticated pilot scope',
          HTTP_STATUS_CODES.FORBIDDEN,
        );
      }

      await this.assertApplicationScope(tx, authenticatedUser.id, operation);
      const payload = operation.payload;
      const [application] = await tx
        .insert(applications)
        .values({
          serviceOrderId: payload.serviceOrderId ?? null,
          farmId: payload.farmId ?? null,
          pilotId: authenticatedUser.id,
          assistantId: payload.assistantId ?? null,
          droneId: payload.droneId,
          cultureId: payload.cultureId,
          productId: payload.productId,
          plotId: payload.plotId,
          date: toOperationalDateDatabaseTimestamp(payload.date),
          hectares: payload.hectares,
          flowRate: payload.flowRate,
          altitude: payload.altitude,
          routeSpacing: payload.routeSpacing,
          dropletSize: payload.dropletSize,
          observations: payload.observations ?? null,
        })
        .returning();

      const stored: StoredResponse = {
        idempotencyKey: operation.idempotencyKey,
        status: 'SUCCEEDED',
        application,
      };
      await tx
        .update(offlineOperationReceipts)
        .set({ status: 'SUCCEEDED', responseJson: stored, updatedAt: new Date() })
        .where(eq(offlineOperationReceipts.id, receipt.id));

      return { ...stored, replayed: false };
    });
  }

  private async assertApplicationScope(
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    pilotId: string,
    operation: SyncOfflineOperationDTO,
  ): Promise<void> {
    const { serviceOrderId, farmId, plotId } = operation.payload;
    if (!serviceOrderId || !farmId) {
      throw new AppError(
        'Offline applications must belong to a selected service order and farm',
        HTTP_STATUS_CODES.BAD_REQUEST,
      );
    }

    const [assignment] = await tx
      .select({ serviceOrderId: serviceOrderPilots.serviceOrderId })
      .from(serviceOrderPilots)
      .innerJoin(
        serviceOrderFarms,
        and(
          eq(serviceOrderFarms.serviceOrderId, serviceOrderPilots.serviceOrderId),
          eq(serviceOrderFarms.farmId, farmId),
        ),
      )
      .where(
        and(
          eq(serviceOrderPilots.serviceOrderId, serviceOrderId),
          eq(serviceOrderPilots.pilotId, pilotId),
        ),
      )
      .limit(1);
    if (!assignment) {
      throw new AppError(
        'Service order or farm is outside the authenticated pilot scope',
        HTTP_STATUS_CODES.FORBIDDEN,
      );
    }

    if (plotId) {
      const [plotScope] = await tx
        .select({ plotId: serviceOrderPlots.plotId })
        .from(serviceOrderPlots)
        .innerJoin(plots, and(eq(plots.id, serviceOrderPlots.plotId), eq(plots.farmId, farmId)))
        .where(
          and(
            eq(serviceOrderPlots.serviceOrderId, serviceOrderId),
            eq(serviceOrderPlots.plotId, plotId),
          ),
        )
        .limit(1);
      if (!plotScope) {
        throw new AppError(
          'Plot is outside the selected service order scope',
          HTTP_STATUS_CODES.FORBIDDEN,
        );
      }
    }
  }
}
