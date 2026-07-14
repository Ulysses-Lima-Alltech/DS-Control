import React from 'react';

import PlannedAreaReportPDF, {
  type PlannedAreaReportPDFProps,
} from '@/components/PDFReports/PlannedAreaReportPDF';

type CompletedPlotsPlannedAreaReportPDFProps = Omit<
  PlannedAreaReportPDFProps,
  'variant' | 'completedPlotIds'
> & {
  completedPlotIds: string[];
};

const CompletedPlotsPlannedAreaReportPDF: React.FC<CompletedPlotsPlannedAreaReportPDFProps> = (
  props
) => {
  return <PlannedAreaReportPDF {...props} variant='completed' />;
};

export default CompletedPlotsPlannedAreaReportPDF;
