export type DjiFlight = {
  id: string;
  recordNumber: string;
  flightDate: Date;
  startTime: string | null;
  endTime: string | null;
  aircraftName: string | null;
  droneSerial: string | null;
  pilotName: string | null;
  taskAreaHa: string | null;
  estimatedAppliedAreaHa: string | null;
  routeSpacingM: string | null;
  routeDistanceKm: string | null;
  coordinateCount: number | null;
  bbox: unknown;
  center: unknown;
  rawMetadata: unknown;
  createdAt: Date;
  updatedAt: Date;
};

export type DjiFlightAsset = {
  id: string;
  djiFlightId: string;
  bucket: string;
  region: string;
  rawKmlS3Key: string;
  pngS3Key: string;
  routeGeoJsonS3Key: string;
  bufferGeoJsonS3Key: string;
  metadataS3Key: string;
  createdAt: Date;
  updatedAt: Date;
};

export type DjiApplicationLinkStatus = "suggested" | "approved" | "rejected";

export type DjiApplicationLink = {
  id: string;
  applicationId: string;
  djiFlightId: string;
  recordNumber: string;
  status: DjiApplicationLinkStatus;
  confidenceScore: string | null;
  matchType: string | null;
  scoreReasons: unknown;
  approvedBy: string | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type UpsertDjiFlightInput = {
  recordNumber: string;
  flightDate: Date;
  startTime?: string | null;
  endTime?: string | null;
  aircraftName?: string | null;
  droneSerial?: string | null;
  pilotName?: string | null;
  taskAreaHa?: string | null;
  estimatedAppliedAreaHa?: string | null;
  routeSpacingM?: string | null;
  routeDistanceKm?: string | null;
  coordinateCount?: number | null;
  bbox?: unknown;
  center?: unknown;
  rawMetadata?: unknown;
};

export type UpsertDjiFlightAssetInput = {
  djiFlightId: string;
  bucket: string;
  region: string;
  rawKmlS3Key: string;
  pngS3Key: string;
  routeGeoJsonS3Key: string;
  bufferGeoJsonS3Key: string;
  metadataS3Key: string;
};

export type UpsertDjiApplicationLinkInput = {
  applicationId: string;
  djiFlightId: string;
  recordNumber: string;
  status: DjiApplicationLinkStatus;
  confidenceScore?: string | null;
  matchType?: string | null;
  scoreReasons?: unknown;
  approvedBy?: string | null;
  approvedAt?: Date | null;
};

export type DjiFlightWithAssets = DjiFlight & {
  assets: DjiFlightAsset | null;
};

export type DjiApplicationCandidateContext = {
  id: string;
  date: Date;
  hectares: string;
  observations: string | null;
  pilot: {
    name: string;
  } | null;
  drone: {
    name: string;
  } | null;
  plot: {
    name: string;
    hectare: string;
  } | null;
};

export type ApprovedDjiFlightForApplication = {
  recordNumber: string;
  flightDate: Date;
  startTime: string | null;
  aircraftName: string | null;
  pilotName: string | null;
  taskAreaHa: string | null;
  estimatedAppliedAreaHa: string | null;
  pngS3Key: string;
  pngSignedUrl?: string | null;
  metadataS3Key: string;
  bucket: string;
  region: string;
};

export type DjiFlightCandidate = ApprovedDjiFlightForApplication & {
  id: string;
  rawMetadata: unknown;
  alreadyLinkedStatus: DjiApplicationLinkStatus | null;
};
