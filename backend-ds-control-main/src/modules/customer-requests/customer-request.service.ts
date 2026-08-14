import AppError from '@common/handlers/app-error';
import { HTTP_STATUS_CODES } from '@common/types/http-status.types';
import { db } from '@infra/database';
import {
  areaSubmissionFiles,
  areaSubmissionPlots,
  areaSubmissionRequests,
  farms,
  plots,
  requestReviewEvents,
  serviceOrderRequests,
} from '@infra/database/schema';
import { and, asc, count, desc, eq, gte, inArray, isNull, lte } from 'drizzle-orm';

import type {
  CreateAreaSubmissionRequestDTO,
  CreateServiceOrderRequestDTO,
  CustomerRequestListQuery,
  UpdateAreaSubmissionPlotDTO,
} from './customer-request.dto';
import { resolveAreaPlotValidationStatus } from './area-plot-validation';
import {
  assertCustomerRequestTransition,
  type CustomerRequestStatus,
} from './customer-request-status';

type FarmerIdentity = {
  userId: string;
  customerId: string;
};

function dateBounds(query: CustomerRequestListQuery) {
  return {
    startDate: query.startDate ? new Date(`${query.startDate}T00:00:00.000Z`) : undefined,
    endDate: query.endDate ? new Date(`${query.endDate}T23:59:59.999Z`) : undefined,
  };
}

export class CustomerRequestService {
  public async createServiceOrderRequest(
    identity: FarmerIdentity,
    dto: CreateServiceOrderRequestDTO,
  ) {
    const farm = await db.query.farms.findFirst({
      where: and(
        eq(farms.id, dto.farmId),
        eq(farms.customerId, identity.customerId),
        isNull(farms.deletedAt),
      ),
      columns: { id: true },
    });
    if (!farm) throw new AppError('Fazenda não encontrada', HTTP_STATUS_CODES.NOT_FOUND);

    const requestedPlotIds = [...new Set(dto.requestedPlotIds ?? [])];
    if (requestedPlotIds.length > 0) {
      const validPlots = await db.query.plots.findMany({
        where: and(
          inArray(plots.id, requestedPlotIds),
          eq(plots.farmId, dto.farmId),
          isNull(plots.deletedAt),
        ),
        columns: { id: true },
      });
      if (validPlots.length !== requestedPlotIds.length) {
        throw new AppError(
          'Um ou mais talhões selecionados não pertencem a esta fazenda',
          HTTP_STATUS_CODES.BAD_REQUEST,
        );
      }
    }

    return db.transaction(async (tx) => {
      const [request] = await tx
        .insert(serviceOrderRequests)
        .values({
          customerId: identity.customerId,
          requestedByUserId: identity.userId,
          requestedFarmId: dto.farmId,
          requestedDate: dto.requestedDate,
          serviceType: dto.serviceType,
          requestedPlotIds,
          observation: dto.observation,
        })
        .returning();
      if (!request) throw new AppError('Falha ao criar solicitação', 500);
      await tx.insert(requestReviewEvents).values({
        requestType: 'SERVICE_ORDER',
        requestId: request.id,
        actorUserId: identity.userId,
        eventType: 'CREATED',
        toStatus: 'DRAFT',
      });
      return request;
    });
  }

  public async listServiceOrderRequests(identity: FarmerIdentity, query: CustomerRequestListQuery) {
    const { startDate, endDate } = dateBounds(query);
    const conditions = [
      eq(serviceOrderRequests.customerId, identity.customerId),
      eq(serviceOrderRequests.requestedByUserId, identity.userId),
      isNull(serviceOrderRequests.deletedAt),
    ];
    if (query.status) conditions.push(eq(serviceOrderRequests.status, query.status));
    if (startDate) conditions.push(gte(serviceOrderRequests.createdAt, startDate));
    if (endDate) conditions.push(lte(serviceOrderRequests.createdAt, endDate));

    const where = and(...conditions);
    const [data, total] = await Promise.all([
      db
        .select()
        .from(serviceOrderRequests)
        .where(where)
        .orderBy(desc(serviceOrderRequests.createdAt))
        .limit(query.limit)
        .offset((query.page - 1) * query.limit),
      db.select({ value: count() }).from(serviceOrderRequests).where(where),
    ]);
    const totalCount = total[0]?.value ?? 0;
    return {
      data,
      page: query.page,
      limit: query.limit,
      totalCount,
      totalPages: Math.ceil(totalCount / query.limit),
    };
  }

  public async getServiceOrderRequest(identity: FarmerIdentity, id: string) {
    const request = await db.query.serviceOrderRequests.findFirst({
      where: and(
        eq(serviceOrderRequests.id, id),
        eq(serviceOrderRequests.customerId, identity.customerId),
        eq(serviceOrderRequests.requestedByUserId, identity.userId),
        isNull(serviceOrderRequests.deletedAt),
      ),
      with: { requestedFarm: true, approvedServiceOrder: true },
    });
    if (!request) throw new AppError('Solicitação não encontrada', HTTP_STATUS_CODES.NOT_FOUND);
    const events = await this.listEvents('SERVICE_ORDER', id);
    return { ...request, events };
  }

  public async createAreaSubmissionRequest(
    identity: FarmerIdentity,
    dto: CreateAreaSubmissionRequestDTO,
  ) {
    if (dto.existingFarmId) {
      const farm = await db.query.farms.findFirst({
        where: and(
          eq(farms.id, dto.existingFarmId),
          eq(farms.customerId, identity.customerId),
          isNull(farms.deletedAt),
        ),
        columns: { id: true },
      });
      if (!farm) throw new AppError('Fazenda não encontrada', HTTP_STATUS_CODES.NOT_FOUND);
    }

    return db.transaction(async (tx) => {
      const [request] = await tx
        .insert(areaSubmissionRequests)
        .values({
          customerId: identity.customerId,
          requestedByUserId: identity.userId,
          suggestedFarmName: dto.suggestedFarmName,
          existingFarmId: dto.existingFarmId,
        })
        .returning();
      if (!request) throw new AppError('Falha ao criar solicitação', 500);
      await tx.insert(requestReviewEvents).values({
        requestType: 'AREA_SUBMISSION',
        requestId: request.id,
        actorUserId: identity.userId,
        eventType: 'CREATED',
        toStatus: 'DRAFT',
      });
      return request;
    });
  }

  public async listAreaSubmissionRequests(
    identity: FarmerIdentity,
    query: CustomerRequestListQuery,
  ) {
    const { startDate, endDate } = dateBounds(query);
    const conditions = [
      eq(areaSubmissionRequests.customerId, identity.customerId),
      eq(areaSubmissionRequests.requestedByUserId, identity.userId),
      isNull(areaSubmissionRequests.deletedAt),
    ];
    if (query.status) conditions.push(eq(areaSubmissionRequests.status, query.status));
    if (startDate) conditions.push(gte(areaSubmissionRequests.createdAt, startDate));
    if (endDate) conditions.push(lte(areaSubmissionRequests.createdAt, endDate));
    const where = and(...conditions);

    const [data, total] = await Promise.all([
      db
        .select()
        .from(areaSubmissionRequests)
        .where(where)
        .orderBy(desc(areaSubmissionRequests.createdAt))
        .limit(query.limit)
        .offset((query.page - 1) * query.limit),
      db.select({ value: count() }).from(areaSubmissionRequests).where(where),
    ]);
    const totalCount = total[0]?.value ?? 0;
    return {
      data,
      page: query.page,
      limit: query.limit,
      totalCount,
      totalPages: Math.ceil(totalCount / query.limit),
    };
  }

  public async getAreaSubmissionRequest(identity: FarmerIdentity, id: string) {
    const request = await db.query.areaSubmissionRequests.findFirst({
      where: and(
        eq(areaSubmissionRequests.id, id),
        eq(areaSubmissionRequests.customerId, identity.customerId),
        eq(areaSubmissionRequests.requestedByUserId, identity.userId),
        isNull(areaSubmissionRequests.deletedAt),
      ),
      with: {
        existingFarm: true,
        approvedFarm: true,
        files: true,
        submittedPlots: true,
      },
    });
    if (!request) throw new AppError('Solicitação não encontrada', HTTP_STATUS_CODES.NOT_FOUND);
    const events = await this.listEvents('AREA_SUBMISSION', id);
    return { ...request, events };
  }

  public async updateAreaSubmissionPlot(
    identity: FarmerIdentity,
    requestId: string,
    plotId: string,
    dto: UpdateAreaSubmissionPlotDTO,
  ) {
    return db.transaction(async (tx) => {
      const [request] = await tx
        .select()
        .from(areaSubmissionRequests)
        .where(
          and(
            eq(areaSubmissionRequests.id, requestId),
            eq(areaSubmissionRequests.customerId, identity.customerId),
            eq(areaSubmissionRequests.requestedByUserId, identity.userId),
            isNull(areaSubmissionRequests.deletedAt),
          ),
        )
        .for('update');
      if (!request) throw new AppError('Solicitação não encontrada', HTTP_STATUS_CODES.NOT_FOUND);
      if (!['DRAFT', 'CHANGES_REQUESTED'].includes(request.status)) {
        throw new AppError('Solicitação não pode mais ser editada', HTTP_STATUS_CODES.CONFLICT);
      }

      const [existingPlot] = await tx
        .select()
        .from(areaSubmissionPlots)
        .where(
          and(eq(areaSubmissionPlots.id, plotId), eq(areaSubmissionPlots.requestId, requestId)),
        );
      if (!existingPlot) {
        throw new AppError('Talhão extraído não encontrado', HTTP_STATUS_CODES.NOT_FOUND);
      }

      const updates: Partial<typeof areaSubmissionPlots.$inferInsert> = { updatedAt: new Date() };
      if (dto.suggestedName !== undefined) {
        updates.suggestedName = dto.suggestedName;
        updates.normalizedName = dto.suggestedName
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim()
          .replace(/\s+/g, ' ')
          .toLocaleLowerCase('pt-BR');
      }
      if (dto.excluded !== undefined) {
        updates.validationStatus = resolveAreaPlotValidationStatus(
          existingPlot.validationStatus,
          existingPlot.validationErrors,
          dto.excluded,
        );
      }
      const [plot] = await tx
        .update(areaSubmissionPlots)
        .set(updates)
        .where(
          and(eq(areaSubmissionPlots.id, plotId), eq(areaSubmissionPlots.requestId, requestId)),
        )
        .returning();
      if (!plot) throw new AppError('Talhão extraído não encontrado', HTTP_STATUS_CODES.NOT_FOUND);
      await tx.insert(requestReviewEvents).values({
        requestType: 'AREA_SUBMISSION',
        requestId,
        actorUserId: identity.userId,
        eventType: 'UPDATED',
        fromStatus: request.status,
        toStatus: request.status,
        detailsJson: { plotId, fields: Object.keys(dto) },
      });
      return plot;
    });
  }

  public async submitServiceOrderRequest(identity: FarmerIdentity, id: string) {
    return db.transaction(async (tx) => {
      const [request] = await tx
        .select()
        .from(serviceOrderRequests)
        .where(
          and(
            eq(serviceOrderRequests.id, id),
            eq(serviceOrderRequests.customerId, identity.customerId),
            eq(serviceOrderRequests.requestedByUserId, identity.userId),
            isNull(serviceOrderRequests.deletedAt),
          ),
        )
        .for('update');
      if (!request) throw new AppError('Solicitação não encontrada', HTTP_STATUS_CODES.NOT_FOUND);
      assertCustomerRequestTransition(request.status, 'SUBMITTED');
      await this.advanceToReview(tx, 'SERVICE_ORDER', request, identity.userId);
      return { ...request, status: 'UNDER_REVIEW' as const };
    });
  }

  public async submitAreaSubmissionRequest(identity: FarmerIdentity, id: string) {
    return db.transaction(async (tx) => {
      const [request] = await tx
        .select()
        .from(areaSubmissionRequests)
        .where(
          and(
            eq(areaSubmissionRequests.id, id),
            eq(areaSubmissionRequests.customerId, identity.customerId),
            eq(areaSubmissionRequests.requestedByUserId, identity.userId),
            isNull(areaSubmissionRequests.deletedAt),
          ),
        )
        .for('update');
      if (!request) throw new AppError('Solicitação não encontrada', HTTP_STATUS_CODES.NOT_FOUND);
      assertCustomerRequestTransition(request.status, 'SUBMITTED');

      const files = await tx
        .select({ id: areaSubmissionFiles.id })
        .from(areaSubmissionFiles)
        .where(
          and(eq(areaSubmissionFiles.requestId, id), eq(areaSubmissionFiles.parseStatus, 'PARSED')),
        );
      const plots = await tx
        .select({ status: areaSubmissionPlots.validationStatus })
        .from(areaSubmissionPlots)
        .where(eq(areaSubmissionPlots.requestId, id));
      if (files.length === 0 || plots.length === 0) {
        throw new AppError(
          'KML processado é obrigatório antes do envio',
          HTTP_STATUS_CODES.CONFLICT,
        );
      }
      if (plots.some((plot) => !['VALID', 'EXCLUDED'].includes(plot.status))) {
        throw new AppError(
          'Corrija os talhões inválidos antes do envio',
          HTTP_STATUS_CODES.CONFLICT,
        );
      }
      if (plots.every((plot) => plot.status === 'EXCLUDED')) {
        throw new AppError(
          'Ao menos um talhão deve permanecer na solicitação',
          HTTP_STATUS_CODES.CONFLICT,
        );
      }

      await this.advanceToReview(tx, 'AREA_SUBMISSION', request, identity.userId);
      return { ...request, status: 'UNDER_REVIEW' as const };
    });
  }

  public async cancelServiceOrderRequest(identity: FarmerIdentity, id: string) {
    return this.cancel(identity, id, 'SERVICE_ORDER');
  }

  public async cancelAreaSubmissionRequest(identity: FarmerIdentity, id: string) {
    return this.cancel(identity, id, 'AREA_SUBMISSION');
  }

  private async cancel(
    identity: FarmerIdentity,
    id: string,
    type: 'SERVICE_ORDER' | 'AREA_SUBMISSION',
  ) {
    return db.transaction(async (tx) => {
      const table = type === 'SERVICE_ORDER' ? serviceOrderRequests : areaSubmissionRequests;
      const [request] = await tx
        .select()
        .from(table)
        .where(
          and(
            eq(table.id, id),
            eq(table.customerId, identity.customerId),
            eq(table.requestedByUserId, identity.userId),
            isNull(table.deletedAt),
          ),
        )
        .for('update');
      if (!request) throw new AppError('Solicitação não encontrada', HTTP_STATUS_CODES.NOT_FOUND);
      assertCustomerRequestTransition(request.status, 'CANCELLED');
      await tx
        .update(table)
        .set({ status: 'CANCELLED', updatedAt: new Date() })
        .where(eq(table.id, id));
      await tx.insert(requestReviewEvents).values({
        requestType: type,
        requestId: id,
        actorUserId: identity.userId,
        eventType: 'CANCELLED',
        fromStatus: request.status,
        toStatus: 'CANCELLED',
      });
      return { ...request, status: 'CANCELLED' as const };
    });
  }

  private async advanceToReview(
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    type: 'SERVICE_ORDER' | 'AREA_SUBMISSION',
    request: { id: string; status: CustomerRequestStatus },
    actorUserId: string,
  ) {
    const table = type === 'SERVICE_ORDER' ? serviceOrderRequests : areaSubmissionRequests;
    const now = new Date();
    await tx
      .update(table)
      .set({ status: 'SUBMITTED', submittedAt: now, updatedAt: now })
      .where(eq(table.id, request.id));
    await tx.insert(requestReviewEvents).values({
      requestType: type,
      requestId: request.id,
      actorUserId,
      eventType: 'SUBMITTED',
      fromStatus: request.status,
      toStatus: 'SUBMITTED',
    });
    assertCustomerRequestTransition('SUBMITTED', 'PARSING');
    await tx
      .update(table)
      .set({ status: 'PARSING', updatedAt: now })
      .where(eq(table.id, request.id));
    await tx.insert(requestReviewEvents).values({
      requestType: type,
      requestId: request.id,
      actorUserId,
      eventType: 'PARSING_STARTED',
      fromStatus: 'SUBMITTED',
      toStatus: 'PARSING',
    });
    assertCustomerRequestTransition('PARSING', 'UNDER_REVIEW');
    await tx
      .update(table)
      .set({ status: 'UNDER_REVIEW', updatedAt: now })
      .where(eq(table.id, request.id));
    await tx.insert(requestReviewEvents).values({
      requestType: type,
      requestId: request.id,
      actorUserId,
      eventType: 'PARSING_COMPLETED',
      fromStatus: 'PARSING',
      toStatus: 'UNDER_REVIEW',
    });
  }

  private async listEvents(type: 'SERVICE_ORDER' | 'AREA_SUBMISSION', id: string) {
    return db
      .select()
      .from(requestReviewEvents)
      .where(and(eq(requestReviewEvents.requestType, type), eq(requestReviewEvents.requestId, id)))
      .orderBy(asc(requestReviewEvents.createdAt));
  }
}
