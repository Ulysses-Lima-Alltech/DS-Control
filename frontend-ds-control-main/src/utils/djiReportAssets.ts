import { Application } from '@/types/applications.type';
import { ServiceOrder } from '@/types/service-order.type';
import { fetchRemoteImageAsDataUrl } from '@/utils/fetchRemoteImageAsDataUrl';

type DjiReportManifestApplication = {
  applicationId: string;
  imageStatus?: string;
  imageScope?: 'day' | 'application' | string | null;
  matchType?: 'exact_application' | 'high_confidence' | 'date_only' | 'no_match' | string | null;
  matchConfidence?: number | null;
  imageUrl?: string;
  publicImageUrl?: string;
  djiImageUrl?: string;
  reviewRequired?: boolean;
  reviewStatus?: string | null;
  reviewApprovedAt?: string | null;
  reviewApprovedBy?: string | null;
  plot?: string | null;
  farm?: string | null;
  pilot?: string | null;
  drone?: string | null;
  dsAreaHa?: number | null;
  djiAreaHa?: number | null;
  areaDifferenceHa?: number | null;
  areaDifferencePercent?: number | null;
  flightCount?: number | null;
  flightRecordNumbers?: string[];
  djiDate?: string | null;
  djiFlightRecordNumber?: string | null;
  djiMetadata?: Record<string, unknown> | null;
};

type DjiReportPublicManifest = {
  osId?: string;
  generatedAt?: string;
  matchingMode?: string | null;
  applications?: DjiReportManifestApplication[] | Record<string, DjiReportManifestApplication>;
};

export type DjiReportImageByApplicationId = Record<
  string,
  {
    imageSrc: string;
    imageUrl: string;
    imageStatus: string;
    imageScope: 'application';
    matchType: 'exact_application' | 'high_confidence';
    matchConfidence: number | null;
    djiFlightRecordNumber?: string | null;
    djiMetadata?: Application['djiMetadata'];
  }
>;

type DjiReportManifestApplicationEntry = {
  key: string | null;
  item: DjiReportManifestApplication;
};

function getManifestApplicationItems(
  manifest: DjiReportPublicManifest | null | undefined
): DjiReportManifestApplication[] {
  const applications = manifest?.applications;
  if (Array.isArray(applications)) return applications;
  if (applications && typeof applications === 'object') return Object.values(applications);
  return [];
}

function getManifestApplicationEntries(
  manifest: DjiReportPublicManifest | null | undefined
): DjiReportManifestApplicationEntry[] {
  const applications = manifest?.applications;
  if (Array.isArray(applications)) {
    return applications.map((item) => ({ key: null, item }));
  }

  if (applications && typeof applications === 'object') {
    return Object.entries(applications).map(([key, item]) => ({ key, item }));
  }

  return [];
}

function getManifestImageUrl(item: DjiReportManifestApplication | undefined): string | null {
  return resolveManifestImageUrl(item?.publicImageUrl || item?.djiImageUrl || item?.imageUrl);
}

function isTrustedApplicationImage(
  item: DjiReportManifestApplication | undefined
): item is DjiReportManifestApplication & {
  imageScope: 'application';
  matchType: 'exact_application' | 'high_confidence';
} {
  return (
    item?.imageScope === 'application' &&
    (item.matchType === 'exact_application' || item.matchType === 'high_confidence') &&
    item.reviewRequired === false &&
    item.reviewStatus === 'approved' &&
    Boolean(getManifestImageUrl(item))
  );
}

function isTrustedApplicationMatch(application: Application): application is Application & {
  djiImageUrl: string;
  djiImageScope: 'application';
  djiMatchType: 'exact_application' | 'high_confidence';
} {
  return (
    Boolean(application.djiImageUrl) &&
    application.djiImageScope === 'application' &&
    (application.djiMatchType === 'exact_application' ||
      application.djiMatchType === 'high_confidence')
  );
}

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
  const manifestItems = getManifestApplicationItems(manifest);
  const manifestEntries = getManifestApplicationEntries(manifest);
  if (!manifestItems.length) {
    return applications;
  }

  const imageByApplicationId = new Map<string, DjiReportManifestApplication>();
  for (const { key, item } of manifestEntries) {
    const applicationId = item.applicationId || key;
    if (applicationId) {
      imageByApplicationId.set(applicationId, item);
    }
  }

  return applications.map((application) => {
    const manifestItem = imageByApplicationId.get(application.id);
    if (!isTrustedApplicationImage(manifestItem)) {
      return application;
    }

    const djiImageUrl = getManifestImageUrl(manifestItem);

    if (!djiImageUrl) {
      return application;
    }

    const djiMetadata = {
      ...(manifestItem.djiMetadata || {}),
      plot: manifestItem.plot,
      farm: manifestItem.farm,
      pilot: manifestItem.pilot,
      drone: manifestItem.drone,
      dsAreaHa: manifestItem.dsAreaHa,
      djiAreaHa: manifestItem.djiAreaHa,
      areaDifferenceHa: manifestItem.areaDifferenceHa,
      areaDifferencePercent: manifestItem.areaDifferencePercent,
      flightCount: manifestItem.flightCount,
      flightRecordNumbers: manifestItem.flightRecordNumbers,
      reviewStatus: manifestItem.reviewStatus,
      reviewApprovedAt: manifestItem.reviewApprovedAt,
      reviewApprovedBy: manifestItem.reviewApprovedBy,
    };

    return {
      ...application,
      djiImageUrl,
      djiImageStatus: manifestItem?.imageStatus || manifestItem?.reviewStatus || 'approved',
      djiDate: manifestItem?.djiDate || undefined,
      djiImageScope: manifestItem.imageScope,
      djiMatchType: manifestItem.matchType,
      djiMatchConfidence: manifestItem.matchConfidence ?? undefined,
      djiFlightRecordNumber: manifestItem.djiFlightRecordNumber ?? undefined,
      djiMetadata,
    };
  });
}

export async function prefetchDjiReportImagesByApplicationId(
  applications: Application[]
): Promise<DjiReportImageByApplicationId> {
  const out: DjiReportImageByApplicationId = {};

  for (const application of applications) {
    if (!isTrustedApplicationMatch(application)) {
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
      imageScope: 'application',
      matchType: application.djiMatchType,
      matchConfidence: application.djiMatchConfidence ?? null,
      djiFlightRecordNumber: application.djiFlightRecordNumber,
      djiMetadata: application.djiMetadata,
    };
  }

  return out;
}
