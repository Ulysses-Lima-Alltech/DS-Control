import { Application } from '@/types/applications.type';
import { ServiceOrder } from '@/types/service-order.type';
import { fetchRemoteImageAsDataUrl } from '@/utils/fetchRemoteImageAsDataUrl';

type DjiReportManifestApplication = {
  applicationId: string;
  imageStatus?: string;
  imageUrl?: string;
  publicImageUrl?: string;
  djiImageUrl?: string;
  djiDate?: string | null;
};

type DjiReportPublicManifest = {
  osId?: string;
  generatedAt?: string;
  matchingMode?: string | null;
  applications?: DjiReportManifestApplication[];
};

export type DjiReportImageByApplicationId = Record<
  string,
  {
    imageSrc: string;
    imageUrl: string;
    imageStatus: string;
  }
>;

function getServiceOrderNumber(serviceOrder?: ServiceOrder | null): string | null {
  if (serviceOrder?.number === undefined || serviceOrder?.number === null) {
    return null;
  }

  return String(serviceOrder.number);
}

function resolveManifestImageUrl(imageUrl: string | undefined | null): string | null {
  if (!imageUrl) return null;
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  return imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
}

async function fetchDjiReportManifest(
  serviceOrder: ServiceOrder | null | undefined
): Promise<DjiReportPublicManifest | null> {
  const osNumber = getServiceOrderNumber(serviceOrder);
  if (!osNumber) return null;

  try {
    const response = await fetch(`/dji-reports/os-${encodeURIComponent(osNumber)}/manifest.json`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as DjiReportPublicManifest;
  } catch {
    return null;
  }
}

export async function enrichApplicationsWithDjiImageUrl(
  serviceOrder: ServiceOrder | null | undefined,
  applications: Application[]
): Promise<Application[]> {
  const manifest = await fetchDjiReportManifest(serviceOrder);
  if (!manifest?.applications?.length) {
    return applications;
  }

  const imageByApplicationId = new Map<string, DjiReportManifestApplication>();
  for (const item of manifest.applications) {
    if (item.applicationId) {
      imageByApplicationId.set(item.applicationId, item);
    }
  }

  return applications.map((application) => {
    const manifestItem = imageByApplicationId.get(application.id);
    const djiImageUrl = resolveManifestImageUrl(
      manifestItem?.publicImageUrl || manifestItem?.djiImageUrl || manifestItem?.imageUrl
    );

    if (!djiImageUrl) {
      return application;
    }

    return {
      ...application,
      djiImageUrl,
      djiImageStatus: manifestItem?.imageStatus,
      djiDate: manifestItem?.djiDate || undefined,
    };
  });
}

export async function prefetchDjiReportImagesByApplicationId(
  applications: Application[]
): Promise<DjiReportImageByApplicationId> {
  const out: DjiReportImageByApplicationId = {};

  for (const application of applications) {
    if (!application.djiImageUrl) {
      continue;
    }

    const imageSrc = await fetchRemoteImageAsDataUrl(application.djiImageUrl);
    if (!imageSrc) {
      continue;
    }

    out[application.id] = {
      imageSrc,
      imageUrl: application.djiImageUrl,
      imageStatus: application.djiImageStatus || 'READY',
    };
  }

  return out;
}
