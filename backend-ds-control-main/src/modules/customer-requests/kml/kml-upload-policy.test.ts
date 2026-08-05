import { describe, expect, it } from 'vitest';

import { KML_LIMITS } from './kml-parser';
import {
  buildKmlStorageKey,
  KML_UPLOAD_EXPIRES_SECONDS,
  sha256HexToBase64,
  validateKmlUploadMetadata,
} from './kml-upload-policy';

const valid = {
  originalFileName: 'area.kml',
  contentType: 'application/vnd.google-earth.kml+xml',
  sizeBytes: 1024,
  sha256: 'a'.repeat(64),
};

describe('KML upload policy', () => {
  it('normalizes safe metadata and uses a short expiry', () => {
    expect(validateKmlUploadMetadata({
      ...valid,
      originalFileName: '../AREA.KML',
      contentType: 'Application/XML; charset=utf-8',
      sha256: 'A'.repeat(64),
    })).toEqual({
      ...valid,
      originalFileName: 'AREA.KML',
      contentType: 'application/xml',
    });
    expect(KML_UPLOAD_EXPIRES_SECONDS).toBe(300);
  });

  it.each(['area.kmz', 'area.kml.exe', 'area.xml', 'area'])('rejects extension %s', (name) => {
    expect(() => validateKmlUploadMetadata({ ...valid, originalFileName: name })).toThrow(
      'extensão .kml',
    );
  });

  it.each(['application/zip', 'application/octet-stream', 'text/plain'])('rejects MIME %s', (contentType) => {
    expect(() => validateKmlUploadMetadata({ ...valid, contentType })).toThrow('MIME type');
  });

  it('rejects empty, fractional and oversized files', () => {
    for (const sizeBytes of [0, 1.5, KML_LIMITS.maxBytes + 1]) {
      expect(() => validateKmlUploadMetadata({ ...valid, sizeBytes })).toThrow();
    }
  });

  it('rejects malformed checksums', () => {
    for (const sha256 of ['a'.repeat(63), 'g'.repeat(64), '']) {
      expect(() => validateKmlUploadMetadata({ ...valid, sha256 })).toThrow('SHA-256');
    }
  });

  it('builds random immutable keys without the original filename', () => {
    const first = buildKmlStorageKey('11111111-1111-4111-8111-111111111111');
    const second = buildKmlStorageKey('11111111-1111-4111-8111-111111111111');
    expect(first).toMatch(/^customer-requests\/areas\/11111111-1111-4111-8111-111111111111\/[0-9a-f-]+\.kml$/);
    expect(first).not.toBe(second);
  });

  it('converts the declared hex checksum for the signed S3 header', () => {
    expect(sha256HexToBase64('00'.repeat(32))).toBe('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=');
  });
});
