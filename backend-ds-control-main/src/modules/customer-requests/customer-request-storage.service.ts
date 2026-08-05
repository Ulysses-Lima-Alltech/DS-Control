import crypto from 'node:crypto';

import {
  ChecksumMode,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  ServerSideEncryption,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import AppError from '@common/handlers/app-error';
import { HTTP_STATUS_CODES } from '@common/types/http-status.types';
import { db } from '@infra/database';
import {
  areaSubmissionFiles,
  areaSubmissionPlots,
  areaSubmissionRequests,
  requestReviewEvents,
} from '@infra/database/schema';
import { and, eq, inArray, isNull } from 'drizzle-orm';

import type { CompleteKmlUploadDTO, PrepareKmlUploadDTO } from './customer-request.dto';
import {
  buildKmlStorageKey,
  KML_UPLOAD_EXPIRES_SECONDS,
  sha256HexToBase64,
  validateKmlUploadMetadata,
} from './kml/kml-upload-policy';
import { parseKmlWithTimeout } from './kml/parse-kml-with-timeout';

type FarmerIdentity = { userId: string; customerId: string };

const KML_BUCKET = process.env.CUSTOMER_REQUESTS_S3_BUCKET || 'dscontrol-dji-assets';
const KML_REGION = process.env.AWS_REGION || 'us-east-1';

export class CustomerRequestStorageService {
  private readonly s3 = new S3Client({ region: KML_REGION });

  public async prepareUpload(
    identity: FarmerIdentity,
    requestId: string,
    dto: PrepareKmlUploadDTO,
  ) {
    const metadata = validateKmlUploadMetadata(dto);
    const request = await this.getEditableRequest(identity, requestId);
    const existing = await db.query.areaSubmissionFiles.findFirst({
      where: and(
        eq(areaSubmissionFiles.requestId, requestId),
        inArray(areaSubmissionFiles.parseStatus, ['PENDING_UPLOAD', 'UPLOADED', 'PARSING']),
      ),
      columns: { id: true },
    });
    if (existing) {
      throw new AppError(
        'A solicitação já possui um arquivo ativo; cancele-o antes de reenviar',
        HTTP_STATUS_CODES.CONFLICT,
      );
    }

    const storageKey = buildKmlStorageKey(request.id);
    const file = await db.transaction(async (tx) => {
      await tx
        .select({ id: areaSubmissionRequests.id })
        .from(areaSubmissionRequests)
        .where(eq(areaSubmissionRequests.id, request.id))
        .for('update');
      const [concurrentUpload] = await tx
        .select({ id: areaSubmissionFiles.id })
        .from(areaSubmissionFiles)
        .where(
          and(
            eq(areaSubmissionFiles.requestId, requestId),
            inArray(areaSubmissionFiles.parseStatus, ['PENDING_UPLOAD', 'UPLOADED', 'PARSING']),
          ),
        )
        .limit(1);
      if (concurrentUpload) {
        throw new AppError(
          'A solicitaÃ§Ã£o jÃ¡ possui um upload em andamento',
          HTTP_STATUS_CODES.CONFLICT,
        );
      }
      const [createdFile] = await tx
        .insert(areaSubmissionFiles)
        .values({
          requestId,
          storageKey,
          originalFileName: metadata.originalFileName,
          contentType: metadata.contentType,
          sizeBytes: metadata.sizeBytes,
          sha256: metadata.sha256,
        })
        .returning();
      return createdFile;
    });
    if (!file) throw new AppError('Falha ao preparar upload', 500);

    try {
      const checksum = sha256HexToBase64(metadata.sha256);
      const command = new PutObjectCommand({
        Bucket: KML_BUCKET,
        Key: storageKey,
        ContentType: metadata.contentType,
        ContentLength: metadata.sizeBytes,
        ChecksumSHA256: checksum,
        ServerSideEncryption: ServerSideEncryption.AES256,
        Metadata: { sha256: metadata.sha256, fileid: file.id },
      });
      const uploadUrl = await getSignedUrl(this.s3, command, {
        expiresIn: KML_UPLOAD_EXPIRES_SECONDS,
      });
      return {
        fileId: file.id,
        uploadUrl,
        expiresInSeconds: KML_UPLOAD_EXPIRES_SECONDS,
        requiredHeaders: {
          'content-type': metadata.contentType,
          'x-amz-checksum-sha256': checksum,
          'x-amz-server-side-encryption': 'AES256',
        },
      };
    } catch {
      await db
        .update(areaSubmissionFiles)
        .set({
          parseStatus: 'FAILED',
          parseError: 'Falha ao assinar upload',
          updatedAt: new Date(),
        })
        .where(eq(areaSubmissionFiles.id, file.id));
      throw new AppError('Falha ao preparar upload', 500);
    }
  }

  public async completeUpload(
    identity: FarmerIdentity,
    requestId: string,
    dto: CompleteKmlUploadDTO,
  ) {
    const request = await this.getEditableRequest(identity, requestId);
    const file = await db.query.areaSubmissionFiles.findFirst({
      where: and(
        eq(areaSubmissionFiles.id, dto.fileId),
        eq(areaSubmissionFiles.requestId, requestId),
      ),
    });
    if (!file) throw new AppError('Arquivo não encontrado', HTTP_STATUS_CODES.NOT_FOUND);
    if (!['PENDING_UPLOAD', 'UPLOADED', 'FAILED'].includes(file.parseStatus)) {
      throw new AppError('Arquivo já está em processamento', HTTP_STATUS_CODES.CONFLICT);
    }

    const [claimedFile] = await db
      .update(areaSubmissionFiles)
      .set({ parseStatus: 'PARSING', parseError: null, updatedAt: new Date() })
      .where(
        and(
          eq(areaSubmissionFiles.id, file.id),
          inArray(areaSubmissionFiles.parseStatus, ['PENDING_UPLOAD', 'UPLOADED', 'FAILED']),
        ),
      )
      .returning({ id: areaSubmissionFiles.id });
    if (!claimedFile) {
      throw new AppError('Arquivo jÃ¡ estÃ¡ em processamento', HTTP_STATUS_CODES.CONFLICT);
    }

    try {
      const expectedChecksum = sha256HexToBase64(file.sha256);
      const head = await this.s3.send(
        new HeadObjectCommand({
          Bucket: KML_BUCKET,
          Key: file.storageKey,
          ChecksumMode: ChecksumMode.ENABLED,
        }),
      );
      if (
        head.ContentLength !== file.sizeBytes ||
        head.ContentType?.split(';', 1)[0]?.toLocaleLowerCase('en-US') !== file.contentType ||
        head.ChecksumSHA256 !== expectedChecksum ||
        head.ServerSideEncryption !== ServerSideEncryption.AES256
      ) {
        throw new Error('Metadados do objeto não conferem com a assinatura');
      }

      const object = await this.s3.send(
        new GetObjectCommand({ Bucket: KML_BUCKET, Key: file.storageKey }),
      );
      if (!object.Body) throw new Error('Objeto KML sem conteúdo');
      const bytes = Buffer.from(await object.Body.transformToByteArray());
      if (bytes.byteLength !== file.sizeBytes)
        throw new Error('Tamanho do KML diverge do declarado');
      const actualSha256 = crypto.createHash('sha256').update(bytes).digest('hex');
      if (!crypto.timingSafeEqual(Buffer.from(actualSha256), Buffer.from(file.sha256))) {
        throw new Error('Checksum do KML diverge do declarado');
      }

      const parsed = await parseKmlWithTimeout(bytes);
      await db.transaction(async (tx) => {
        await tx.delete(areaSubmissionPlots).where(eq(areaSubmissionPlots.requestId, requestId));
        await tx.insert(areaSubmissionPlots).values(
          parsed.plots.map((plot) => ({
            requestId,
            sourceFeatureIndex: plot.sourceFeatureIndex,
            suggestedName: plot.suggestedName,
            normalizedName: plot.normalizedName,
            geoJson: plot.geoJson,
            calculatedAreaHa: String(plot.calculatedAreaHa),
            validationStatus:
              plot.validationErrors.length === 0 ? ('VALID' as const) : ('INVALID' as const),
            validationErrors: plot.validationErrors,
          })),
        );
        await tx
          .update(areaSubmissionFiles)
          .set({
            parseStatus: 'PARSED',
            parseError:
              parsed.featureErrors.length > 0
                ? JSON.stringify(parsed.featureErrors).slice(0, 4_000)
                : null,
            uploadedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(areaSubmissionFiles.id, file.id));
        await tx.insert(requestReviewEvents).values({
          requestType: 'AREA_SUBMISSION',
          requestId,
          actorUserId: identity.userId,
          eventType: 'UPDATED',
          fromStatus: request.status,
          toStatus: request.status,
          detailsJson: {
            fileId: file.id,
            parsedPlots: parsed.plots.length,
            invalidFeatures: parsed.featureErrors.length,
          },
        });
      });
      return {
        fileId: file.id,
        plotsCount: parsed.plots.length,
        featureErrors: parsed.featureErrors,
      };
    } catch (error) {
      await db
        .update(areaSubmissionFiles)
        .set({
          parseStatus: 'FAILED',
          parseError:
            error instanceof Error ? error.message.slice(0, 1_000) : 'Falha ao processar KML',
          updatedAt: new Date(),
        })
        .where(eq(areaSubmissionFiles.id, file.id));
      throw new AppError('Não foi possível validar o arquivo KML', HTTP_STATUS_CODES.BAD_REQUEST);
    }
  }

  private async getEditableRequest(identity: FarmerIdentity, requestId: string) {
    const request = await db.query.areaSubmissionRequests.findFirst({
      where: and(
        eq(areaSubmissionRequests.id, requestId),
        eq(areaSubmissionRequests.customerId, identity.customerId),
        eq(areaSubmissionRequests.requestedByUserId, identity.userId),
        isNull(areaSubmissionRequests.deletedAt),
      ),
    });
    if (!request) throw new AppError('Solicitação não encontrada', HTTP_STATUS_CODES.NOT_FOUND);
    if (!['DRAFT', 'CHANGES_REQUESTED'].includes(request.status)) {
      throw new AppError('Solicitação não aceita upload neste estado', HTTP_STATUS_CODES.CONFLICT);
    }
    return request;
  }
}
