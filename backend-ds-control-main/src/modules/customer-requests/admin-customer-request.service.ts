import crypto from 'node:crypto';

import AppError from '@common/handlers/app-error';
import { HTTP_STATUS_CODES } from '@common/types/http-status.types';
import { deriveAutomaticFarmMapColor } from '@common/utils/farm-map-color';
import { db } from '@infra/database';
import {
  areaSubmissionFiles,
  areaSubmissionPlots,
  areaSubmissionRequests,
  contracts,
  farms,
  plots,
  requestReviewEvents,
  serviceOrderFarms,
  serviceOrderPilots,
  serviceOrderPlots,
  serviceOrderRequests,
  serviceOrders,
  users,
} from '@infra/database/schema';
import { and, asc, count, desc, eq, gte, inArray, isNull, lte } from 'drizzle-orm';

import type {
  AdminCustomerRequestListQuery,
  AdminRequestParams,
  ApproveCustomerRequestDTO,
} from './customer-request.dto';
import {
  assertCustomerRequestTransition,
  type CustomerRequestStatus,
} from './customer-request-status';

type AdminIdentity = { userId: string };

export class AdminCustomerRequestService {
  public async list(query: AdminCustomerRequestListQuery) {
    const startDate = query.startDate ? new Date(`${query.startDate}T00:00:00.000Z`) : undefined;
    const endDate = query.endDate ? new Date(`${query.endDate}T23:59:59.999Z`) : undefined;
    const take = query.page * query.limit;

    const serviceConditions = [isNull(serviceOrderRequests.deletedAt)];
    const areaConditions = [isNull(areaSubmissionRequests.deletedAt)];
    if (query.customerId) {
      serviceConditions.push(eq(serviceOrderRequests.customerId, query.customerId));
      areaConditions.push(eq(areaSubmissionRequests.customerId, query.customerId));
    }
    if (query.status) {
      serviceConditions.push(eq(serviceOrderRequests.status, query.status));
      areaConditions.push(eq(areaSubmissionRequests.status, query.status));
    }
    if (startDate) {
      serviceConditions.push(gte(serviceOrderRequests.createdAt, startDate));
      areaConditions.push(gte(areaSubmissionRequests.createdAt, startDate));
    }
    if (endDate) {
      serviceConditions.push(lte(serviceOrderRequests.createdAt, endDate));
      areaConditions.push(lte(areaSubmissionRequests.createdAt, endDate));
    }

    const [serviceRows, areaRows, serviceCountRows, areaCountRows] = await Promise.all([
      query.type === 'AREA_SUBMISSION'
        ? Promise.resolve([])
        : db
            .select()
            .from(serviceOrderRequests)
            .where(and(...serviceConditions))
            .orderBy(desc(serviceOrderRequests.createdAt))
            .limit(take),
      query.type === 'SERVICE_ORDER'
        ? Promise.resolve([])
        : db
            .select()
            .from(areaSubmissionRequests)
            .where(and(...areaConditions))
            .orderBy(desc(areaSubmissionRequests.createdAt))
            .limit(take),
      query.type === 'AREA_SUBMISSION'
        ? Promise.resolve([{ value: 0 }])
        : db
            .select({ value: count() })
            .from(serviceOrderRequests)
            .where(and(...serviceConditions)),
      query.type === 'SERVICE_ORDER'
        ? Promise.resolve([{ value: 0 }])
        : db
            .select({ value: count() })
            .from(areaSubmissionRequests)
            .where(and(...areaConditions)),
    ]);

    const all = [
      ...serviceRows.map((row) => ({ ...row, requestType: 'SERVICE_ORDER' as const })),
      ...areaRows.map((row) => ({ ...row, requestType: 'AREA_SUBMISSION' as const })),
    ].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
    const offset = (query.page - 1) * query.limit;
    const totalCount = (serviceCountRows[0]?.value ?? 0) + (areaCountRows[0]?.value ?? 0);
    return {
      data: all.slice(offset, offset + query.limit),
      page: query.page,
      limit: query.limit,
      totalCount,
      totalPages: Math.ceil(totalCount / query.limit),
    };
  }

  public async get(params: AdminRequestParams) {
    if (params.type === 'service-orders') {
      const request = await db.query.serviceOrderRequests.findFirst({
        where: and(eq(serviceOrderRequests.id, params.id), isNull(serviceOrderRequests.deletedAt)),
        with: {
          customer: true,
          requestedBy: true,
          requestedFarm: true,
          reviewedBy: true,
          approvedServiceOrder: true,
        },
      });
      if (!request) throw new AppError('Solicitação não encontrada', HTTP_STATUS_CODES.NOT_FOUND);
      return this.sanitizeDetail({
        ...request,
        requestType: 'SERVICE_ORDER',
        events: await this.events('SERVICE_ORDER', params.id),
      });
    }

    const request = await db.query.areaSubmissionRequests.findFirst({
      where: and(
        eq(areaSubmissionRequests.id, params.id),
        isNull(areaSubmissionRequests.deletedAt),
      ),
      with: {
        customer: true,
        requestedBy: true,
        reviewedBy: true,
        existingFarm: true,
        approvedFarm: true,
        files: true,
        submittedPlots: true,
      },
    });
    if (!request) throw new AppError('Solicitação não encontrada', HTTP_STATUS_CODES.NOT_FOUND);
    return this.sanitizeDetail({
      ...request,
      requestType: 'AREA_SUBMISSION',
      events: await this.events('AREA_SUBMISSION', params.id),
    });
  }

  public async requestChanges(identity: AdminIdentity, params: AdminRequestParams, reason: string) {
    return this.reviewTransition(identity, params, 'CHANGES_REQUESTED', reason);
  }

  public async reject(identity: AdminIdentity, params: AdminRequestParams, reason: string) {
    return this.reviewTransition(identity, params, 'REJECTED', reason);
  }

  public async approve(
    identity: AdminIdentity,
    params: AdminRequestParams,
    dto: ApproveCustomerRequestDTO,
  ) {
    if (params.type === 'service-orders') {
      if (dto.approvalType !== 'SERVICE_ORDER') {
        throw new AppError('Payload de aprovação incompatível', HTTP_STATUS_CODES.BAD_REQUEST);
      }
      return this.approveServiceOrder(identity, params.id, dto);
    }
    if (dto.approvalType !== 'AREA_SUBMISSION') {
      throw new AppError('Payload de aprovação incompatível', HTTP_STATUS_CODES.BAD_REQUEST);
    }
    return this.approveArea(identity, params.id, dto);
  }

  private async reviewTransition(
    identity: AdminIdentity,
    params: AdminRequestParams,
    target: 'CHANGES_REQUESTED' | 'REJECTED',
    reason: string,
  ) {
    return db.transaction(async (tx) => {
      if (params.type === 'service-orders') {
        const [request] = await tx
          .select()
          .from(serviceOrderRequests)
          .where(
            and(eq(serviceOrderRequests.id, params.id), isNull(serviceOrderRequests.deletedAt)),
          )
          .for('update');
        if (!request) throw new AppError('Solicitação não encontrada', HTTP_STATUS_CODES.NOT_FOUND);
        assertCustomerRequestTransition(request.status, target);
        const now = new Date();
        await tx
          .update(serviceOrderRequests)
          .set({
            status: target,
            reviewedAt: now,
            reviewedByUserId: identity.userId,
            rejectionReason: reason,
            updatedAt: now,
          })
          .where(eq(serviceOrderRequests.id, request.id));
        await this.insertReviewEvent(
          tx,
          'SERVICE_ORDER',
          request.id,
          identity.userId,
          request.status,
          target,
          reason,
        );
        return { ...request, status: target };
      }

      const [request] = await tx
        .select()
        .from(areaSubmissionRequests)
        .where(
          and(eq(areaSubmissionRequests.id, params.id), isNull(areaSubmissionRequests.deletedAt)),
        )
        .for('update');
      if (!request) throw new AppError('Solicitação não encontrada', HTTP_STATUS_CODES.NOT_FOUND);
      assertCustomerRequestTransition(request.status, target);
      const now = new Date();
      await tx
        .update(areaSubmissionRequests)
        .set({
          status: target,
          reviewedAt: now,
          reviewedByUserId: identity.userId,
          rejectionReason: reason,
          updatedAt: now,
        })
        .where(eq(areaSubmissionRequests.id, request.id));
      await this.insertReviewEvent(
        tx,
        'AREA_SUBMISSION',
        request.id,
        identity.userId,
        request.status,
        target,
        reason,
      );
      return { ...request, status: target };
    });
  }

  private async approveServiceOrder(
    identity: AdminIdentity,
    requestId: string,
    dto: Extract<ApproveCustomerRequestDTO, { approvalType: 'SERVICE_ORDER' }>,
  ) {
    return db.transaction(async (tx) => {
      const [request] = await tx
        .select()
        .from(serviceOrderRequests)
        .where(and(eq(serviceOrderRequests.id, requestId), isNull(serviceOrderRequests.deletedAt)))
        .for('update');
      if (!request) throw new AppError('Solicitação não encontrada', HTTP_STATUS_CODES.NOT_FOUND);
      assertCustomerRequestTransition(request.status, 'APPROVED');

      const [contract] = await tx
        .select()
        .from(contracts)
        .where(
          and(
            eq(contracts.id, dto.contractId),
            eq(contracts.customerId, request.customerId),
            isNull(contracts.deletedAt),
          ),
        );
      const approvalDate = new Date();
      if (!contract || contract.date_start > approvalDate || contract.date_end < approvalDate) {
        throw new AppError('Contrato inválido ou expirado', HTTP_STATUS_CODES.BAD_REQUEST);
      }

      const [farm] = await tx
        .select({ id: farms.id })
        .from(farms)
        .where(
          and(
            eq(farms.id, request.requestedFarmId),
            eq(farms.customerId, request.customerId),
            isNull(farms.deletedAt),
          ),
        );
      if (!farm)
        throw new AppError('Fazenda da solicitação não é válida', HTTP_STATUS_CODES.BAD_REQUEST);

      const uniquePlotIds = [...new Set(dto.plotIds)];
      const validPlots = await tx
        .select({ id: plots.id })
        .from(plots)
        .where(
          and(
            inArray(plots.id, uniquePlotIds),
            eq(plots.farmId, farm.id),
            eq(plots.customerId, request.customerId),
            isNull(plots.deletedAt),
          ),
        );
      if (validPlots.length !== uniquePlotIds.length) {
        throw new AppError(
          'Talhões não pertencem à fazenda solicitada',
          HTTP_STATUS_CODES.BAD_REQUEST,
        );
      }

      const uniquePilotIds = [...new Set(dto.pilotIds)];
      const validPilots = await tx
        .select({ id: users.id })
        .from(users)
        .where(
          and(inArray(users.id, uniquePilotIds), eq(users.type, 'pilot'), isNull(users.deletedAt)),
        );
      if (validPilots.length !== uniquePilotIds.length) {
        throw new AppError('Pilotos inválidos', HTTP_STATUS_CODES.BAD_REQUEST);
      }

      const [serviceOrder] = await tx
        .insert(serviceOrders)
        .values({
          customerId: request.customerId,
          contractId: contract.id,
          plannedDate: new Date(`${dto.plannedDate ?? request.requestedDate}T12:00:00.000Z`),
          observation: dto.observation ?? request.observation,
          status: 'open',
        })
        .returning();
      if (!serviceOrder) throw new AppError('Falha ao criar Ordem de Serviço', 500);

      await tx
        .insert(serviceOrderFarms)
        .values({ serviceOrderId: serviceOrder.id, farmId: farm.id });
      await tx
        .insert(serviceOrderPilots)
        .values(uniquePilotIds.map((pilotId) => ({ serviceOrderId: serviceOrder.id, pilotId })));
      await tx.insert(serviceOrderPlots).values(
        uniquePlotIds.map((plotId) => ({
          serviceOrderId: serviceOrder.id,
          plotId,
          status: 'PENDING' as const,
        })),
      );

      const now = new Date();
      await tx
        .update(serviceOrderRequests)
        .set({
          status: 'APPROVED',
          approvedServiceOrderId: serviceOrder.id,
          reviewedAt: now,
          reviewedByUserId: identity.userId,
          rejectionReason: null,
          updatedAt: now,
        })
        .where(eq(serviceOrderRequests.id, request.id));
      await tx.insert(requestReviewEvents).values({
        requestType: 'SERVICE_ORDER',
        requestId: request.id,
        actorUserId: identity.userId,
        eventType: 'APPROVED',
        fromStatus: request.status,
        toStatus: 'APPROVED',
        detailsJson: {
          approvedServiceOrderId: serviceOrder.id,
          serviceType: request.serviceType,
        },
      });
      return { requestId: request.id, approvedServiceOrderId: serviceOrder.id };
    });
  }

  private async approveArea(
    identity: AdminIdentity,
    requestId: string,
    dto: Extract<ApproveCustomerRequestDTO, { approvalType: 'AREA_SUBMISSION' }>,
  ) {
    return db.transaction(async (tx) => {
      const [request] = await tx
        .select()
        .from(areaSubmissionRequests)
        .where(
          and(eq(areaSubmissionRequests.id, requestId), isNull(areaSubmissionRequests.deletedAt)),
        )
        .for('update');
      if (!request) throw new AppError('Solicitação não encontrada', HTTP_STATUS_CODES.NOT_FOUND);
      assertCustomerRequestTransition(request.status, 'APPROVED');

      const [parsedFile] = await tx
        .select({ id: areaSubmissionFiles.id })
        .from(areaSubmissionFiles)
        .where(
          and(
            eq(areaSubmissionFiles.requestId, request.id),
            eq(areaSubmissionFiles.parseStatus, 'PARSED'),
          ),
        );
      if (!parsedFile)
        throw new AppError('KML processado não encontrado', HTTP_STATUS_CODES.CONFLICT);

      const submittedPlots = await tx
        .select()
        .from(areaSubmissionPlots)
        .where(eq(areaSubmissionPlots.requestId, request.id))
        .orderBy(asc(areaSubmissionPlots.sourceFeatureIndex));
      const selectedPlots = submittedPlots.filter((plot) => plot.validationStatus === 'VALID');
      if (
        selectedPlots.length === 0 ||
        submittedPlots.some((plot) => !['VALID', 'EXCLUDED'].includes(plot.validationStatus))
      ) {
        throw new AppError(
          'Talhões da solicitação não estão aprováveis',
          HTTP_STATUS_CODES.CONFLICT,
        );
      }

      let farmId = request.existingFarmId;
      if (farmId) {
        const [existingFarm] = await tx
          .select({ id: farms.id })
          .from(farms)
          .where(
            and(
              eq(farms.id, farmId),
              eq(farms.customerId, request.customerId),
              isNull(farms.deletedAt),
            ),
          );
        if (!existingFarm)
          throw new AppError('Fazenda vinculada não é válida', HTTP_STATUS_CODES.BAD_REQUEST);
      } else {
        const farmName = dto.farmName ?? request.suggestedFarmName;
        if (!farmName)
          throw new AppError('Nome da fazenda é obrigatório', HTTP_STATUS_CODES.BAD_REQUEST);

        const [duplicateFarm] = await tx
          .select({ id: farms.id })
          .from(farms)
          .where(and(eq(farms.name, farmName), eq(farms.customerId, request.customerId)));
        if (duplicateFarm)
          throw new AppError(
            'Ja existe uma fazenda com este nome para esse cliente. Use "vincular a fazenda existente" em vez de criar uma nova.',
            HTTP_STATUS_CODES.CONFLICT,
          );

        farmId = crypto.randomUUID();
        await tx.insert(farms).values({
          id: farmId,
          name: farmName,
          customerId: request.customerId,
          mapColor: dto.mapColor ?? deriveAutomaticFarmMapColor(farmId),
        });
      }

      const approvedPlots: Array<{ submissionPlotId: string; plotId: string }> = [];
      for (const submittedPlot of selectedPlots) {
        const plotId = crypto.randomUUID();
        await tx.insert(plots).values({
          id: plotId,
          name: submittedPlot.suggestedName,
          farmId,
          customerId: request.customerId,
          externalId: `area-request-${request.id}-${submittedPlot.sourceFeatureIndex}`,
          geoJson: submittedPlot.geoJson,
          hectare: submittedPlot.calculatedAreaHa,
        });
        await tx
          .update(areaSubmissionPlots)
          .set({ approvedPlotId: plotId, updatedAt: new Date() })
          .where(eq(areaSubmissionPlots.id, submittedPlot.id));
        approvedPlots.push({ submissionPlotId: submittedPlot.id, plotId });
      }

      const now = new Date();
      await tx
        .update(areaSubmissionRequests)
        .set({
          status: 'APPROVED',
          approvedFarmId: farmId,
          reviewedAt: now,
          reviewedByUserId: identity.userId,
          rejectionReason: null,
          updatedAt: now,
        })
        .where(eq(areaSubmissionRequests.id, request.id));
      await tx.insert(requestReviewEvents).values({
        requestType: 'AREA_SUBMISSION',
        requestId: request.id,
        actorUserId: identity.userId,
        eventType: 'APPROVED',
        fromStatus: request.status,
        toStatus: 'APPROVED',
        detailsJson: { approvedFarmId: farmId, approvedPlots },
      });
      return { requestId: request.id, approvedFarmId: farmId, approvedPlots };
    });
  }

  private async insertReviewEvent(
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    type: 'SERVICE_ORDER' | 'AREA_SUBMISSION',
    requestId: string,
    actorUserId: string,
    fromStatus: CustomerRequestStatus,
    toStatus: 'CHANGES_REQUESTED' | 'REJECTED',
    reason: string,
  ) {
    await tx.insert(requestReviewEvents).values({
      requestType: type,
      requestId,
      actorUserId,
      eventType: toStatus,
      fromStatus,
      toStatus,
      detailsJson: { reason },
    });
  }

  private async events(type: 'SERVICE_ORDER' | 'AREA_SUBMISSION', requestId: string) {
    return db
      .select()
      .from(requestReviewEvents)
      .where(
        and(
          eq(requestReviewEvents.requestType, type),
          eq(requestReviewEvents.requestId, requestId),
        ),
      )
      .orderBy(asc(requestReviewEvents.createdAt));
  }

  private sanitizeDetail<
    T extends {
      requestedBy?: typeof users.$inferSelect | null;
      reviewedBy?: typeof users.$inferSelect | null;
    },
  >(detail: T) {
    const toPublicUser = (user: typeof users.$inferSelect | null | undefined) =>
      user
        ? {
            id: user.id,
            name: user.name,
            email: user.email,
            type: user.type,
            customerId: user.customerId,
          }
        : null;
    return {
      ...detail,
      requestedBy: toPublicUser(detail.requestedBy),
      reviewedBy: toPublicUser(detail.reviewedBy),
    };
  }
}
