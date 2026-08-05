import type { ServiceOrder, ServiceOrderMetrics } from '@/types/service-order.type';

function finiteNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function resolveServiceOrderMetrics(
  serviceOrder: Partial<ServiceOrder> | null | undefined
): ServiceOrderMetrics {
  const canonical = serviceOrder?.metrics;
  if (canonical?.metricVersion === 1) {
    return {
      ...canonical,
      plannedAreaHa: finiteNumber(canonical.plannedAreaHa),
      grossAppliedAreaHa: finiteNumber(canonical.grossAppliedAreaHa),
      effectiveCoveredAreaHa: finiteNumber(canonical.effectiveCoveredAreaHa),
      registeredCompletedAreaHa: finiteNumber(canonical.registeredCompletedAreaHa),
      inProgressAppliedAreaHa: finiteNumber(canonical.inProgressAppliedAreaHa),
      consolidatedOperationalAreaHa: finiteNumber(canonical.consolidatedOperationalAreaHa),
      registeredProgressPercent: finiteNumber(canonical.registeredProgressPercent),
      grossAppliedProgressPercent: finiteNumber(canonical.grossAppliedProgressPercent),
      consolidatedProgressPercent: finiteNumber(canonical.consolidatedProgressPercent),
      totalPlots: finiteNumber(canonical.totalPlots),
      completedPlots: finiteNumber(canonical.completedPlots),
      inProgressPlots: finiteNumber(canonical.inProgressPlots),
      pendingPlots: finiteNumber(canonical.pendingPlots),
      applicationsCount: finiteNumber(canonical.applicationsCount),
      plotsWithApplications: finiteNumber(canonical.plotsWithApplications),
      applicationsWithoutPlotCount: finiteNumber(canonical.applicationsWithoutPlotCount),
    };
  }

  return {
    plannedAreaHa: finiteNumber(serviceOrder?.plannedHectares),
    grossAppliedAreaHa: finiteNumber(
      serviceOrder?.grossAppliedAreaHa ?? serviceOrder?.totalAppliedHectares
    ),
    effectiveCoveredAreaHa: 0,
    registeredCompletedAreaHa: finiteNumber(
      serviceOrder?.registeredCompletedAreaHa ?? serviceOrder?.completedHectares
    ),
    inProgressAppliedAreaHa: finiteNumber(serviceOrder?.inProgressAppliedAreaHa),
    consolidatedOperationalAreaHa: finiteNumber(serviceOrder?.consolidatedPlotAreaHa),
    registeredProgressPercent: finiteNumber(
      serviceOrder?.registeredProgressPercent ?? serviceOrder?.progressPercent
    ),
    grossAppliedProgressPercent: finiteNumber(serviceOrder?.grossAppliedProgressPercent),
    consolidatedProgressPercent: finiteNumber(serviceOrder?.consolidatedProgressPercent),
    totalPlots: finiteNumber(serviceOrder?.totalPlots),
    completedPlots: finiteNumber(serviceOrder?.completedPlots),
    inProgressPlots: finiteNumber(serviceOrder?.inProgressPlots),
    pendingPlots: finiteNumber(serviceOrder?.pendingPlots),
    applicationsCount: finiteNumber(serviceOrder?.applicationsCount),
    plotsWithApplications: finiteNumber(serviceOrder?.plotsWithApplications),
    applicationsWithoutPlotCount: finiteNumber(serviceOrder?.applicationsWithoutPlotCount),
    completionThresholdPercent: finiteNumber(serviceOrder?.plotCompletionThresholdPercent) || 70,
    coverageMethod: 'maximum_application',
    metricVersion: 1,
  };
}
