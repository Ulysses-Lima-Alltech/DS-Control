export type CustomerRequestStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'PARSING'
  | 'UNDER_REVIEW'
  | 'CHANGES_REQUESTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

export type FarmerServiceOrderRequest = {
  id: string;
  status: CustomerRequestStatus;
  requestedFarmId: string;
  requestedDate: string;
  serviceType: string;
  observation?: string | null;
  rejectionReason?: string | null;
  requestedFarm?: { id: string; name: string };
  approvedServiceOrderId?: string | null;
  createdAt: string;
};

export type FarmerAreaRequestPlot = {
  id: string;
  suggestedName: string;
  calculatedAreaHa: string;
  validationStatus: 'PENDING' | 'VALID' | 'INVALID' | 'EXCLUDED';
  validationErrors: unknown[];
};

export type FarmerAreaRequest = {
  id: string;
  status: CustomerRequestStatus;
  suggestedFarmName?: string | null;
  existingFarmId?: string | null;
  existingFarm?: { id: string; name: string } | null;
  approvedFarmId?: string | null;
  rejectionReason?: string | null;
  submittedPlots?: FarmerAreaRequestPlot[];
  files?: {
    id: string;
    originalFileName: string;
    parseStatus: string;
    parseError?: string | null;
  }[];
  createdAt: string;
};

export type CustomerRequestPage<T> = {
  data: T[];
  page: number;
  limit: number;
  totalPages: number;
  totalCount: number;
};

export type PreparedKmlUpload = {
  fileId: string;
  uploadUrl: string;
  expiresInSeconds: number;
  requiredHeaders: Record<string, string>;
};
