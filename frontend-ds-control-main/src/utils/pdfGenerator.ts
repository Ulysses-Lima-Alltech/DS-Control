import { pdf } from '@react-pdf/renderer';

import ApplicationsReportPDF from '@/components/PDFReports/ApplicationsReportPDF';
import { Application } from '@/types/applications.type';
import { ServiceOrder } from '@/types/service-order.type';

interface GeneratePDFParams {
  serviceOrder: ServiceOrder;
  applications: Application[];
}

export async function generateApplicationsReportPDF({
  serviceOrder,
  applications,
}: GeneratePDFParams): Promise<Blob> {
  const element = ApplicationsReportPDF({
    serviceOrder,
    applications,
  });

  // @ts-expect-error - toBlob is not typed
  const blob = await pdf(element).toBlob();
  return blob;
}

export function downloadPDF(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
