import React from 'react';

import ApplicationsReportPDF, {
  type ApplicationsReportPDFProps,
} from '@/components/PDFReports/ApplicationsReportPDF';

type CompletedPlotsPlannedAreaReportPDFProps = Omit<
  ApplicationsReportPDFProps,
  'mode' | 'completedPlotIds'
> & {
  completedPlotIds: string[];
};

const CompletedPlotsPlannedAreaReportPDF: React.FC<CompletedPlotsPlannedAreaReportPDFProps> = (
  props
) => {
  return <ApplicationsReportPDF {...props} mode='completedPlannedArea' />;
};

export default CompletedPlotsPlannedAreaReportPDF;
