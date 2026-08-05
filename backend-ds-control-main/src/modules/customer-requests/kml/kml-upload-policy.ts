import crypto from 'node:crypto';
import path from 'node:path';

import { KML_LIMITS, KmlValidationError } from './kml-parser';

export const KML_UPLOAD_EXPIRES_SECONDS = 300;
export const KML_UPLOAD_UNHOISTABLE_HEADERS = new Set(['x-amz-checksum-sha256']);
export const KML_ALLOWED_CONTENT_TYPES = [
  'application/vnd.google-earth.kml+xml',
  'application/xml',
  'text/xml',
] as const;

export type KmlUploadMetadata = {
  originalFileName: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
};

export type ValidatedKmlUploadMetadata = KmlUploadMetadata & {
  contentType: (typeof KML_ALLOWED_CONTENT_TYPES)[number];
  sha256: string;
};

export function validateKmlUploadMetadata(input: KmlUploadMetadata): ValidatedKmlUploadMetadata {
  if (path.extname(input.originalFileName).toLocaleLowerCase('en-US') !== '.kml') {
    throw new KmlValidationError('Somente arquivos com extensão .kml são permitidos');
  }
  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0) {
    throw new KmlValidationError('Tamanho do arquivo KML inválido');
  }
  if (input.sizeBytes > KML_LIMITS.maxBytes) {
    throw new KmlValidationError('Arquivo KML excede 15 MB');
  }

  const contentType = input.contentType.split(';', 1)[0]!.trim().toLocaleLowerCase('en-US');
  if (!(KML_ALLOWED_CONTENT_TYPES as readonly string[]).includes(contentType)) {
    throw new KmlValidationError('MIME type não permitido para KML');
  }

  const sha256 = input.sha256.trim().toLocaleLowerCase('en-US');
  if (!/^[0-9a-f]{64}$/.test(sha256)) {
    throw new KmlValidationError('Checksum SHA-256 inválido');
  }

  return {
    ...input,
    originalFileName: path.basename(input.originalFileName),
    contentType: contentType as ValidatedKmlUploadMetadata['contentType'],
    sha256,
  };
}

export function buildKmlStorageKey(requestId: string): string {
  return `customer-requests/areas/${requestId}/${crypto.randomUUID()}.kml`;
}

export function sha256HexToBase64(sha256: string): string {
  return Buffer.from(sha256, 'hex').toString('base64');
}
