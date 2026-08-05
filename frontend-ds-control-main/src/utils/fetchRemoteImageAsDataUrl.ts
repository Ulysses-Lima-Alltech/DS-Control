export type RemoteImageFetchOptions = {
  timeoutMs?: number;
  retries?: number;
  signal?: AbortSignal;
};

const DEFAULT_TIMEOUT_MS = 10_000;

/** Fetches an image without ever logging its URL, query string or credentials. */
export async function fetchRemoteImageAsDataUrl(
  url: string,
  options: RemoteImageFetchOptions = {}
): Promise<string | null> {
  const retries = Math.max(0, options.retries ?? 0);
  const timeoutMs = Math.max(1, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const resourceHost = safeHost(url);

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (options.signal?.aborted) return null;

    const controller = new AbortController();
    const abortFromParent = () => controller.abort();
    options.signal?.addEventListener('abort', abortFromParent, { once: true });
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        if (attempt === retries || !isRetryableStatus(response.status)) {
          console.warn('[REPORT_IMAGE_FETCH]', {
            resourceHost,
            responseStatus: response.status,
            reason: 'response_not_ok',
          });
          return null;
        }
        continue;
      }

      const dataUrl = await blobToDataUrl(await response.blob());
      if (dataUrl.startsWith('data:')) return dataUrl;

      console.warn('[REPORT_IMAGE_FETCH]', {
        resourceHost,
        responseStatus: response.status,
        reason: 'invalid_data_url',
      });
      return null;
    } catch {
      if (options.signal?.aborted) return null;
      if (attempt === retries) {
        console.warn('[REPORT_IMAGE_FETCH]', {
          resourceHost,
          responseStatus: null,
          reason: controller.signal.aborted ? 'timeout' : 'fetch_failed',
        });
        return null;
      }
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener('abort', abortFromParent);
    }
  }

  return null;
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'invalid-url';
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      resolve(typeof result === 'string' ? result : '');
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
