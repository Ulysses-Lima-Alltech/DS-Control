import { describe, expect, it } from 'vitest';
import {
  buildLegacyServiceOrderMetricAliases,
  buildPlotCoverageAssessments,
  buildServiceOrderMetrics,
  type PlotCoverageSourceRow,
} from '../service-order-plot-coverage';

const SERVICE_ORDER_ID = 'service-order-1';

function buildMetrics(applicationAreas: number[]) {
  const rows: PlotCoverageSourceRow[] = [
    {
      serviceOrderId: SERVICE_ORDER_ID,
      plotId: 'plot-1',
      farmId: 'farm-1',
      registeredAreaHectares: 100,
      applicationId: null,
      appliedAreaHectares: null,
    },
    ...applicationAreas.map((area, index) => ({
      serviceOrderId: SERVICE_ORDER_ID,
      plotId: 'plot-1',
      farmId: 'farm-1',
      registeredAreaHectares: 100,
      applicationId: `application-${index + 1}`,
      appliedAreaHectares: area,
    })),
  ];
  const assessments = buildPlotCoverageAssessments(rows);
  const metrics = buildServiceOrderMetrics(assessments, {
    grossAppliedAreaHa: applicationAreas.reduce((total, area) => total + area, 0),
    applicationsCount: applicationAreas.length,
    applicationsWithoutPlotCount: 0,
  });

  return { assessment: assessments[0], metrics };
}

describe('canonical service order metrics truth table', () => {
  it.each([
    {
      applications: [],
      effective: 0,
      gross: 0,
      status: 'PENDING',
      completed: 0,
      inProgress: 0,
      consolidated: 0,
    },
    {
      applications: [40],
      effective: 40,
      gross: 40,
      status: 'IN_PROGRESS',
      completed: 0,
      inProgress: 40,
      consolidated: 40,
    },
    {
      applications: [40, 40],
      effective: 40,
      gross: 80,
      status: 'IN_PROGRESS',
      completed: 0,
      inProgress: 80,
      consolidated: 80,
    },
    {
      applications: [70],
      effective: 70,
      gross: 70,
      status: 'COMPLETED',
      completed: 100,
      inProgress: 0,
      consolidated: 100,
    },
    {
      applications: [80],
      effective: 80,
      gross: 80,
      status: 'COMPLETED',
      completed: 100,
      inProgress: 0,
      consolidated: 100,
    },
    {
      applications: [60, 60],
      effective: 60,
      gross: 120,
      status: 'IN_PROGRESS',
      completed: 0,
      inProgress: 120,
      consolidated: 120,
    },
  ])(
    'uses maximum application coverage and gross operational totals for $applications',
    ({ applications, effective, gross, status, completed, inProgress, consolidated }) => {
      const { assessment, metrics } = buildMetrics(applications);

      expect(Number(assessment.effectiveAppliedHectares)).toBe(effective);
      expect(assessment.derivedStatus).toBe(status);
      expect(metrics).toMatchObject({
        plannedAreaHa: 100,
        effectiveCoveredAreaHa: effective,
        grossAppliedAreaHa: gross,
        registeredCompletedAreaHa: completed,
        inProgressAppliedAreaHa: inProgress,
        consolidatedOperationalAreaHa: consolidated,
        completionThresholdPercent: 70,
        coverageMethod: 'maximum_application',
        metricVersion: 1,
      });
    },
  );

  it('ignores a soft-deleted application because it is absent from the active source rows', () => {
    const { assessment, metrics } = buildMetrics([]);
    expect(assessment.applications).toHaveLength(0);
    expect(metrics.grossAppliedAreaHa).toBe(0);
    expect(metrics.applicationsCount).toBe(0);
  });

  it('counts an active application without a plot only in gross OS metrics', () => {
    const { assessment } = buildMetrics([40]);
    const metrics = buildServiceOrderMetrics([assessment], {
      grossAppliedAreaHa: 65,
      applicationsCount: 2,
      applicationsWithoutPlotCount: 1,
    });

    expect(metrics.effectiveCoveredAreaHa).toBe(40);
    expect(metrics.grossAppliedAreaHa).toBe(65);
    expect(metrics.applicationsWithoutPlotCount).toBe(1);
  });

  it('does not apply an application from another service order to the current plot', () => {
    const current = buildMetrics([]).assessment;
    const other = buildPlotCoverageAssessments([
      {
        serviceOrderId: 'service-order-2',
        plotId: 'plot-1',
        farmId: 'farm-1',
        registeredAreaHectares: 100,
        applicationId: 'application-other-order',
        appliedAreaHectares: 90,
      },
    ]);
    const metrics = buildServiceOrderMetrics(
      [current, ...other].filter((assessment) => assessment.serviceOrderId === SERVICE_ORDER_ID),
    );

    expect(metrics.effectiveCoveredAreaHa).toBe(0);
    expect(metrics.pendingPlots).toBe(1);
  });

  it('excludes a soft-deleted plot while retaining its active application in gross OS totals', () => {
    const metrics = buildServiceOrderMetrics([], {
      grossAppliedAreaHa: 25,
      applicationsCount: 1,
      applicationsWithoutPlotCount: 0,
    });

    expect(metrics.plannedAreaHa).toBe(0);
    expect(metrics.totalPlots).toBe(0);
    expect(metrics.effectiveCoveredAreaHa).toBe(0);
    expect(metrics.grossAppliedAreaHa).toBe(25);
  });

  it('keeps legacy aliases aligned while preserving legacy pending semantics', () => {
    const { metrics } = buildMetrics([40]);
    const aliases = buildLegacyServiceOrderMetricAliases(metrics);

    expect(aliases.plannedHectares).toBe(metrics.plannedAreaHa);
    expect(aliases.totalAppliedHectares).toBe(metrics.grossAppliedAreaHa);
    expect(aliases.completedHectares).toBe(metrics.registeredCompletedAreaHa);
    expect(aliases.progressPercent).toBe(metrics.registeredProgressPercent);
    expect(aliases.pendingPlots).toBe(1);
    expect(metrics.pendingPlots).toBe(0);
    expect(metrics.inProgressPlots).toBe(1);
  });
});
