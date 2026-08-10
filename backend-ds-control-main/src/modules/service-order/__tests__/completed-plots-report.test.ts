import { describe, expect, it } from 'vitest';
import { CompletedPlotsReportRequestSchema } from '../dto/completed-plots-report.dto';
import {
  buildCompletedPlotsReportData,
  buildPlotCoverageAssessments,
  isPlotCoverageCompleted,
  PLOT_COMPLETION_THRESHOLD_PERCENT,
  type PlotCoverageSourceRow,
} from '../service-order-plot-coverage';

const SERVICE_ORDER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_SERVICE_ORDER_ID = '22222222-2222-4222-8222-222222222222';
const FARM_ID = '33333333-3333-4333-8333-333333333333';

function sourceRow(
  overrides: Partial<PlotCoverageSourceRow> & Pick<PlotCoverageSourceRow, 'plotId'>,
): PlotCoverageSourceRow {
  return {
    serviceOrderId: SERVICE_ORDER_ID,
    farmId: FARM_ID,
    registeredAreaHectares: '100',
    applicationId: null,
    appliedAreaHectares: null,
    ...overrides,
  };
}

describe('canonical plot completion threshold', () => {
  it.each([
    ['0', false],
    ['40', false],
    ['69.99', false],
    ['69.999', false],
    ['70.00', true],
    ['72', true],
    ['100', true],
  ])('classifies %s%% without display rounding', (effectiveArea, expected) => {
    expect(isPlotCoverageCompleted(effectiveArea, '100')).toBe(expected);
  });

  it('centralizes the inclusive threshold', () => {
    expect(PLOT_COMPLETION_THRESHOLD_PERCENT).toBe(70);
  });

  it('does not add overlapping application areas to decide completion', () => {
    const [assessment] = buildPlotCoverageAssessments([
      sourceRow({
        plotId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        applicationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        appliedAreaHectares: '40',
      }),
      sourceRow({
        plotId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        applicationId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        appliedAreaHectares: '40',
      }),
    ]);

    expect(assessment.effectiveAppliedHectares).toBe('40');
    expect(assessment.grossAppliedHectares).toBe('80');
    expect(assessment.coveragePercent).toBe('40');
    expect(assessment.status).toBe('PENDING');
    expect(assessment.derivedStatus).toBe('IN_PROGRESS');
  });
});

describe('completed plots report transformation', () => {
  const plotA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const plotB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const pendingPlot = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const applicationA1 = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const applicationA2 = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const applicationB = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

  const sourceRows: PlotCoverageSourceRow[] = [
    sourceRow({
      plotId: plotA,
      registeredAreaHectares: '51.34',
      applicationId: applicationA1,
      appliedAreaHectares: '36.95',
    }),
    sourceRow({
      plotId: plotA,
      registeredAreaHectares: '51.34',
      applicationId: applicationA2,
      appliedAreaHectares: '35',
    }),
    sourceRow({
      plotId: plotB,
      registeredAreaHectares: '32.10',
      applicationId: applicationB,
      appliedAreaHectares: '32.10',
    }),
    sourceRow({
      plotId: pendingPlot,
      registeredAreaHectares: '20',
      applicationId: '99999999-9999-4999-8999-999999999999',
      appliedAreaHectares: '13.99',
    }),
    sourceRow({
      serviceOrderId: OTHER_SERVICE_ORDER_ID,
      plotId: '12121212-1212-4212-8212-121212121212',
      registeredAreaHectares: '500',
      applicationId: '13131313-1313-4313-8313-131313131313',
      appliedAreaHectares: '500',
    }),
  ];

  it('normalizes completed plots in plot_area and emits one row per completed plot only', () => {
    const snapshot = structuredClone(sourceRows);
    const report = buildCompletedPlotsReportData(
      buildPlotCoverageAssessments(sourceRows),
      'plot_area',
      SERVICE_ORDER_ID,
    );

    // plot_area is the "Talhões Concluídos" report: it must only ever include plots
    // that reached the completion threshold. In-progress plots (below threshold) are
    // reported through their own totals/metrics, never listed here — otherwise the
    // report would visually diverge from the strategic map, which only marks a plot
    // as completed when derivedStatus === 'COMPLETED'.
    expect(report.rows).toHaveLength(2);
    expect(report.rows.map((row) => row.plotId)).toEqual([plotA, plotB]);
    expect(report.rows.every((row) => row.status === 'COMPLETED')).toBe(true);
    expect(report.rows[0]).toMatchObject({
      applicationId: null,
      displayedAppliedHectares: '51.34',
      displayedCoveragePercent: '100',
      accountedAreaHectares: '51.34',
      accountedCoveragePercent: '100',
      status: 'COMPLETED',
      applicationsCount: 2,
    });
    expect(report.totalDisplayedHectares).toBe('83.44');
    expect(report.totals).toMatchObject({
      plannedAreaHa: '103.44',
      grossAppliedAreaHa: '118.04',
      registeredCompletedAreaHa: '83.44',
      inProgressAppliedAreaHa: '13.99',
      consolidatedPlotAreaHa: '97.43',
      completedPlotsCount: 2,
      inProgressPlotsCount: 1,
      notStartedPlotsCount: 0,
      applicationsCount: 4,
    });
    expect(sourceRows).toEqual(snapshot);
  });

  it('preserves every real service-order application row, area and percentage in applied_area', () => {
    const snapshot = structuredClone(sourceRows);
    const report = buildCompletedPlotsReportData(
      buildPlotCoverageAssessments(sourceRows),
      'applied_area',
      SERVICE_ORDER_ID,
    );

    expect(report.rows).toHaveLength(4);
    expect(report.rows.map((row) => row.applicationId)).toEqual([
      applicationA1,
      applicationA2,
      applicationB,
      '99999999-9999-4999-8999-999999999999',
    ]);
    expect(report.rows[0]).toMatchObject({
      displayedAppliedHectares: '36.95',
      displayedCoveragePercent: '71.971172',
      realCoveragePercent: '71.971172',
    });
    expect(report.rows[1]).toMatchObject({
      displayedAppliedHectares: '35',
      displayedCoveragePercent: '68.172964',
    });
    expect(report.rows[3]).toMatchObject({
      displayedAppliedHectares: '13.99',
      displayedCoveragePercent: '69.95',
      status: 'IN_PROGRESS',
    });
    expect(report.totalDisplayedHectares).toBe('118.04');
    expect(report.totals.grossAppliedAreaHa).toBe('118.04');
    expect(report.totals.grossAppliedProgressPercent).toBe('114.11');
    expect(sourceRows).toEqual(snapshot);
  });

  it('excludes in-progress plots and data from another service order', () => {
    const report = buildCompletedPlotsReportData(
      buildPlotCoverageAssessments(sourceRows),
      'plot_area',
      SERVICE_ORDER_ID,
    );

    expect(report.rows.some((row) => row.plotId === pendingPlot)).toBe(false);
    expect(report.rows.some((row) => row.registeredAreaHectares === '500')).toBe(false);
    expect(report.rows.every((row) => row.farmId === FARM_ID)).toBe(true);
  });
});

describe('manual override precedence over coverage calculation', () => {
  const plotId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  it('marks a plot COMPLETED when manually overridden, even below the coverage threshold', () => {
    // OS 152 / plot 18A shape: 46.85 ha registered, largest single application only 26.06 ha
    // (55.6%) — below the 70% threshold — but backoffice forced COMPLETED with a reason.
    const [assessment] = buildPlotCoverageAssessments([
      {
        serviceOrderId: SERVICE_ORDER_ID,
        farmId: FARM_ID,
        plotId,
        registeredAreaHectares: '46.85',
        applicationId: 'app-1',
        appliedAreaHectares: '26.06',
        manualOverride: true,
        overrideStatus: 'COMPLETED',
      },
    ]);

    expect(assessment.derivedStatus).toBe('COMPLETED');
    expect(assessment.status).toBe('COMPLETED');
    expect(assessment.manualOverride).toBe(true);
    // Real coverage numbers stay visible/unchanged for transparency.
    expect(assessment.coveragePercent).toBe('55.624332');
  });

  it('keeps a plot PENDING when manually overridden back, even above the coverage threshold', () => {
    const [assessment] = buildPlotCoverageAssessments([
      {
        serviceOrderId: SERVICE_ORDER_ID,
        farmId: FARM_ID,
        plotId,
        registeredAreaHectares: '50',
        applicationId: 'app-1',
        appliedAreaHectares: '50',
        manualOverride: true,
        overrideStatus: 'PENDING',
      },
    ]);

    expect(assessment.derivedStatus).toBe('PENDING');
    expect(assessment.status).toBe('PENDING');
    expect(assessment.manualOverride).toBe(true);
  });

  it('falls back to the coverage calculation when there is no override', () => {
    const [assessment] = buildPlotCoverageAssessments([
      {
        serviceOrderId: SERVICE_ORDER_ID,
        farmId: FARM_ID,
        plotId,
        registeredAreaHectares: '46.85',
        applicationId: 'app-1',
        appliedAreaHectares: '26.06',
        manualOverride: false,
        overrideStatus: null,
      },
    ]);

    expect(assessment.derivedStatus).toBe('IN_PROGRESS');
    expect(assessment.manualOverride).toBe(false);
  });

  it('includes a manually completed plot in the plot_area completed report', () => {
    const report = buildCompletedPlotsReportData(
      buildPlotCoverageAssessments([
        {
          serviceOrderId: SERVICE_ORDER_ID,
          farmId: FARM_ID,
          plotId,
          registeredAreaHectares: '46.85',
          applicationId: 'app-1',
          appliedAreaHectares: '26.06',
          manualOverride: true,
          overrideStatus: 'COMPLETED',
        },
      ]),
      'plot_area',
      SERVICE_ORDER_ID,
    );

    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]).toMatchObject({ plotId, status: 'COMPLETED' });
  });
});

describe('completed plots report contract', () => {
  it.each(['plot_area', 'applied_area'] as const)('accepts %s explicitly', (areaMode) => {
    expect(CompletedPlotsReportRequestSchema.parse({ areaMode })).toEqual({ areaMode });
  });

  it('rejects an invalid mode', () => {
    expect(() => CompletedPlotsReportRequestSchema.parse({ areaMode: 'unknown' })).toThrow();
  });

  it('does not infer a missing mode', () => {
    expect(() => CompletedPlotsReportRequestSchema.parse({})).toThrow();
  });
});
