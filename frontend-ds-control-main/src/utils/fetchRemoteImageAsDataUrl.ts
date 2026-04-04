const PREFETCH_DEBUG = '[REPORT_PREFETCH_DEBUG]';

/**
 * Pré-carrega uma imagem remota para data URL (útil com @react-pdf/renderer, que nem sempre embute URLs externas).
 */
export async function fetchRemoteImageAsDataUrl(url: string): Promise<string | null> {
  const urlPreview =
    url.length > 160 ? `${url.slice(0, 160)}…(len=${url.length})` : url;

  try {
    const response = await fetch(url);
    const contentType = response.headers.get('content-type');

    if (!response.ok) {
      console.log(PREFETCH_DEBUG, {
        phase: 'fetchRemoteImageAsDataUrl',
        urlPreview,
        responseStatus: response.status,
        responseOk: response.ok,
        contentType,
        returnNullReason: 'response_not_ok',
      });
      return null;
    }

    const blob = await response.blob();
    const blobSize = blob.size;
    const blobCreated = true;

    const dataUrl = await blobToDataUrl(blob);
    const dataUrlLength = dataUrl.length;
    const dataUrlValidPrefix = dataUrl.startsWith('data:');

    if (!dataUrlValidPrefix) {
      console.log(PREFETCH_DEBUG, {
        phase: 'fetchRemoteImageAsDataUrl',
        urlPreview,
        responseStatus: response.status,
        responseOk: response.ok,
        contentType,
        blobCreated,
        blobSize,
        dataUrlLength,
        returnNullReason: 'data_url_invalid_prefix',
      });
      return null;
    }

    console.log(PREFETCH_DEBUG, {
      phase: 'fetchRemoteImageAsDataUrl',
      urlPreview,
      responseStatus: response.status,
      responseOk: response.ok,
      contentType,
      blobCreated,
      blobSize,
      dataUrlApproxLength: dataUrlLength,
      returnNullReason: null,
    });

    return dataUrl;
  } catch (err) {
    console.log(PREFETCH_DEBUG, {
      phase: 'fetchRemoteImageAsDataUrl',
      urlPreview,
      responseStatus: null,
      responseOk: null,
      contentType: null,
      blobCreated: false,
      returnNullReason: 'fetch_or_blob_to_data_url_exception',
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
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
