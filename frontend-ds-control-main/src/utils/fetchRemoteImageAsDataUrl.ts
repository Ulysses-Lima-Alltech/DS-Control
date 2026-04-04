/**
 * Pré-carrega uma imagem remota para data URL (útil com @react-pdf/renderer, que nem sempre embute URLs externas).
 */
export async function fetchRemoteImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    const blob = await response.blob();
    const dataUrl = await blobToDataUrl(blob);
    return dataUrl.startsWith('data:') ? dataUrl : null;
  } catch {
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
