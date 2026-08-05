export const CUSTOMER_REQUEST_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'PARSING',
  'UNDER_REVIEW',
  'CHANGES_REQUESTED',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
] as const;

export type CustomerRequestStatus = (typeof CUSTOMER_REQUEST_STATUSES)[number];
export type CustomerRequestType = 'SERVICE_ORDER' | 'AREA_SUBMISSION';
export type CustomerRequestPathType = 'service-orders' | 'areas';

export type CustomerRequestListItem = {
  id: string;
  requestType: CustomerRequestType;
  customerId: string;
  requestedByUserId: string;
  status: CustomerRequestStatus;
  requestedDate?: string;
  serviceType?: string;
  requestedFarmId?: string;
  suggestedFarmName?: string | null;
  existingFarmId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CustomerRequestEvent = {
  id: string;
  eventType: string;
  fromStatus: CustomerRequestStatus | null;
  toStatus: CustomerRequestStatus;
  detailsJson: Record<string, unknown>;
  createdAt: string;
};

export type PublicRequestUser = {
  id: string;
  name: string;
  email: string;
  type: string;
  customerId: string | null;
};

export type AreaSubmissionPlot = {
  id: string;
  sourceFeatureIndex: number;
  suggestedName: string;
  calculatedAreaHa: string;
  validationStatus: 'PENDING' | 'VALID' | 'INVALID' | 'EXCLUDED';
  validationErrors: unknown[];
  approvedPlotId: string | null;
};

export type AdminCustomerRequestDetail = CustomerRequestListItem & {
  customer?: { id: string; name: string };
  requestedBy?: PublicRequestUser | null;
  reviewedBy?: PublicRequestUser | null;
  requestedFarm?: { id: string; name: string; customerId: string };
  existingFarm?: { id: string; name: string; customerId: string } | null;
  approvedFarm?: { id: string; name: string } | null;
  approvedServiceOrder?: { id: string; number: number } | null;
  observation?: string | null;
  rejectionReason?: string | null;
  submittedPlots?: AreaSubmissionPlot[];
  files?: Array<{
    id: string;
    originalFileName: string;
    parseStatus: string;
    parseError: string | null;
    createdAt: string;
  }>;
  events: CustomerRequestEvent[];
};

export type CustomerRequestPage = {
  data: CustomerRequestListItem[];
  page: number;
  limit: number;
  totalPages: number;
  totalCount: number;
};

export type ApproveCustomerRequestPayload =
  | {
      approvalType: 'SERVICE_ORDER';
      contractId: string;
      pilotIds: string[];
      plotIds: string[];
      plannedDate?: string;
      observation?: string;
    }
  | { approvalType: 'AREA_SUBMISSION'; farmName?: string; mapColor?: string };
