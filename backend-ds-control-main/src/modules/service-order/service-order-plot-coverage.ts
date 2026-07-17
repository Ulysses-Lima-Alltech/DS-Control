export const PLOT_COMPLETION_THRESHOLD_PERCENT = 70;

export type PlotCompletionStatus = 'PENDING' | 'COMPLETED';
export type PlotDerivedStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
export type CompletedPlotsReportAreaMode = 'plot_area' | 'applied_area';

export type PlotCoverageSourceRow = {
  serviceOrderId: string;
  plotId: string;
  farmId: string;
  registeredAreaHectares: string | number;
  applicationId: string | null;
  appliedAreaHectares: string | number | null;
};

export type PlotCoverageApplication = {
  id: string;
  appliedAreaHectares: string;
};

export type PlotCoverageAssessment = {
  serviceOrderId: string;
  plotId: string;
  farmId: string;
  registeredAreaHectares: string;
  effectiveAppliedHectares: string;
  grossAppliedHectares: string;
  coveragePercent: string;
  status: PlotCompletionStatus;
  derivedStatus: PlotDerivedStatus;
  applications: PlotCoverageApplication[];
};

export type CompletedPlotsReportRow = {
  plotId: string;
  farmId: string;
  applicationId: string | null;
  registeredAreaHectares: string;
  effectiveAppliedHectares: string;
  realAppliedHectares: string;
  realCoveragePercent: string;
  displayedAppliedHectares: string;
  displayedCoveragePercent: string;
  accountedAreaHectares: string;
  accountedCoveragePercent: string;
  status: PlotDerivedStatus;
  applicationsCount: number;
};

export type CompletedPlotsReportTotals = {
  plannedAreaHa: string;
  grossAppliedAreaHa: string;
  registeredCompletedAreaHa: string;
  inProgressAppliedAreaHa: string;
  consolidatedPlotAreaHa: string;
  registeredProgressPercent: string;
  grossAppliedProgressPercent: string;
  consolidatedProgressPercent: string;
  completedPlotsCount: number;
  inProgressPlotsCount: number;
  notStartedPlotsCount: number;
  applicationsCount: number;
};

type DecimalValue = {
  units: number;
  scale: number;
};

const ZERO_DECIMAL: DecimalValue = { units: 0, scale: 0 };

function powerOfTen(exponent: number): number {
  return 10 ** exponent;
}

function parseDecimal(value: unknown): DecimalValue {
  const normalized = String(value ?? '')
    .trim()
    .replace(',', '.');
  const match = normalized.match(/^(\d+)(?:\.(\d+))?$/);

  if (!match) {
    return ZERO_DECIMAL;
  }

  const fraction = match[2] ?? '';
  return {
    units: Number(`${match[1]}${fraction}`),
    scale: fraction.length,
  };
}

function decimalToString(value: DecimalValue): string {
  if (value.units === 0) return '0';
  if (value.scale === 0) return value.units.toString();

  const padded = value.units.toString().padStart(value.scale + 1, '0');
  const integerPart = padded.slice(0, -value.scale);
  const fractionPart = padded.slice(-value.scale).replace(/0+$/, '');
  return fractionPart ? `${integerPart}.${fractionPart}` : integerPart;
}

function compareDecimals(left: DecimalValue, right: DecimalValue): number {
  const commonScale = Math.max(left.scale, right.scale);
  const leftUnits = left.units * powerOfTen(commonScale - left.scale);
  const rightUnits = right.units * powerOfTen(commonScale - right.scale);
  return leftUnits === rightUnits ? 0 : leftUnits > rightUnits ? 1 : -1;
}

function addDecimals(values: DecimalValue[]): DecimalValue {
  const scale = values.reduce((largest, value) => Math.max(largest, value.scale), 0);
  return {
    units: values.reduce(
      (total, value) => total + value.units * powerOfTen(scale - value.scale),
      0,
    ),
    scale,
  };
}

function isZeroDecimal(value: DecimalValue): boolean {
  return value.units === 0;
}

function getDerivedStatus(
  effectiveAppliedHectares: string,
  registeredAreaHectares: string,
): PlotDerivedStatus {
  if (isPlotCoverageCompleted(effectiveAppliedHectares, registeredAreaHectares)) {
    return 'COMPLETED';
  }

  return isZeroDecimal(parseDecimal(effectiveAppliedHectares)) ? 'PENDING' : 'IN_PROGRESS';
}

function formatPercentage(
  coveredArea: DecimalValue,
  registeredArea: DecimalValue,
  decimalPlaces = 6,
): string {
  if (registeredArea.units <= 0) return '0';

  const numerator =
    coveredArea.units * powerOfTen(registeredArea.scale) * 100 * powerOfTen(decimalPlaces);
  const denominator = registeredArea.units * powerOfTen(coveredArea.scale);
  const scaledPercentage = Math.floor(numerator / denominator);
  return decimalToString({ units: scaledPercentage, scale: decimalPlaces });
}

export function isPlotCoverageCompleted(
  effectiveAppliedHectares: string | number,
  registeredAreaHectares: string | number,
): boolean {
  const applied = parseDecimal(effectiveAppliedHectares);
  const registered = parseDecimal(registeredAreaHectares);
  if (registered.units <= 0) return false;

  const appliedSide = applied.units * powerOfTen(registered.scale) * 100;
  const thresholdSide =
    registered.units * powerOfTen(applied.scale) * PLOT_COMPLETION_THRESHOLD_PERCENT;

  return appliedSide >= thresholdSide;
}

export function buildPlotCoverageAssessments(
  rows: PlotCoverageSourceRow[],
): PlotCoverageAssessment[] {
  const plotsByScope = new Map<
    string,
    {
      serviceOrderId: string;
      plotId: string;
      farmId: string;
      registeredArea: DecimalValue;
      applications: Map<string, DecimalValue>;
    }
  >();

  rows.forEach((row) => {
    const key = `${row.serviceOrderId}:${row.plotId}`;
    const current = plotsByScope.get(key) ?? {
      serviceOrderId: row.serviceOrderId,
      plotId: row.plotId,
      farmId: row.farmId,
      registeredArea: parseDecimal(row.registeredAreaHectares),
      applications: new Map<string, DecimalValue>(),
    };

    if (row.applicationId) {
      current.applications.set(row.applicationId, parseDecimal(row.appliedAreaHectares));
    }
    plotsByScope.set(key, current);
  });

  return Array.from(plotsByScope.values()).map((plot) => {
    const applicationEntries = Array.from(plot.applications, ([id, area]) => ({ id, area }));
    // A cobertura/status do talhão usa a maior aplicação individual enquanto não houver uma
    // geometria canônica de união espacial. A área bruta/consolidada soma as aplicações reais.
    // Não trocar uma regra pela outra: múltiplas aplicações pequenas não concluem o talhão.
    const effectiveArea = applicationEntries.reduce(
      (largest, application) =>
        compareDecimals(application.area, largest) > 0 ? application.area : largest,
      ZERO_DECIMAL,
    );
    const grossAppliedArea = addDecimals(applicationEntries.map((application) => application.area));
    const registeredAreaHectares = decimalToString(plot.registeredArea);
    const effectiveAppliedHectares = decimalToString(effectiveArea);
    const derivedStatus = getDerivedStatus(effectiveAppliedHectares, registeredAreaHectares);

    return {
      serviceOrderId: plot.serviceOrderId,
      plotId: plot.plotId,
      farmId: plot.farmId,
      registeredAreaHectares,
      effectiveAppliedHectares,
      grossAppliedHectares: decimalToString(grossAppliedArea),
      coveragePercent: formatPercentage(effectiveArea, plot.registeredArea),
      status: derivedStatus === 'COMPLETED' ? 'COMPLETED' : 'PENDING',
      derivedStatus,
      applications: applicationEntries.map(({ id, area }) => ({
        id,
        appliedAreaHectares: decimalToString(area),
      })),
    };
  });
}

function buildAccountedArea(assessment: PlotCoverageAssessment): string {
  if (assessment.derivedStatus === 'COMPLETED') return assessment.registeredAreaHectares;
  if (assessment.derivedStatus === 'IN_PROGRESS') return assessment.grossAppliedHectares;
  return '0';
}

function buildAccountedPercent(assessment: PlotCoverageAssessment): string {
  if (assessment.derivedStatus === 'COMPLETED') return '100';
  if (assessment.derivedStatus === 'IN_PROGRESS') {
    return formatPercentage(
      parseDecimal(assessment.grossAppliedHectares),
      parseDecimal(assessment.registeredAreaHectares),
    );
  }
  return '0';
}

function buildTotals(assessments: PlotCoverageAssessment[]): CompletedPlotsReportTotals {
  const plannedArea = addDecimals(
    assessments.map((assessment) => parseDecimal(assessment.registeredAreaHectares)),
  );
  const grossAppliedArea = addDecimals(
    assessments.map((assessment) => parseDecimal(assessment.grossAppliedHectares)),
  );
  const registeredCompletedArea = addDecimals(
    assessments
      .filter((assessment) => assessment.derivedStatus === 'COMPLETED')
      .map((assessment) => parseDecimal(assessment.registeredAreaHectares)),
  );
  const inProgressAppliedArea = addDecimals(
    assessments
      .filter((assessment) => assessment.derivedStatus === 'IN_PROGRESS')
      .map((assessment) => parseDecimal(assessment.grossAppliedHectares)),
  );
  const consolidatedPlotArea = addDecimals([registeredCompletedArea, inProgressAppliedArea]);

  return {
    plannedAreaHa: decimalToString(plannedArea),
    grossAppliedAreaHa: decimalToString(grossAppliedArea),
    registeredCompletedAreaHa: decimalToString(registeredCompletedArea),
    inProgressAppliedAreaHa: decimalToString(inProgressAppliedArea),
    consolidatedPlotAreaHa: decimalToString(consolidatedPlotArea),
    registeredProgressPercent: formatPercentage(registeredCompletedArea, plannedArea, 2),
    grossAppliedProgressPercent: formatPercentage(grossAppliedArea, plannedArea, 2),
    consolidatedProgressPercent: formatPercentage(consolidatedPlotArea, plannedArea, 2),
    completedPlotsCount: assessments.filter(
      (assessment) => assessment.derivedStatus === 'COMPLETED',
    ).length,
    inProgressPlotsCount: assessments.filter(
      (assessment) => assessment.derivedStatus === 'IN_PROGRESS',
    ).length,
    notStartedPlotsCount: assessments.filter((assessment) => assessment.derivedStatus === 'PENDING')
      .length,
    applicationsCount: assessments.reduce(
      (total, assessment) => total + assessment.applications.length,
      0,
    ),
  };
}

export function buildCompletedPlotsReportData(
  assessments: PlotCoverageAssessment[],
  areaMode: CompletedPlotsReportAreaMode,
  serviceOrderId: string,
) {
  const serviceOrderAssessments = assessments.filter(
    (assessment) => assessment.serviceOrderId === serviceOrderId,
  );
  const reportablePlots = serviceOrderAssessments.filter(
    (assessment) => assessment.derivedStatus !== 'PENDING',
  );
  const rows = (
    areaMode === 'plot_area' ? reportablePlots : serviceOrderAssessments
  ).flatMap<CompletedPlotsReportRow>((assessment) => {
    const accountedAreaHectares = buildAccountedArea(assessment);
    const accountedCoveragePercent = buildAccountedPercent(assessment);

    if (areaMode === 'plot_area') {
      return [
        {
          plotId: assessment.plotId,
          farmId: assessment.farmId,
          applicationId: null,
          registeredAreaHectares: assessment.registeredAreaHectares,
          effectiveAppliedHectares: assessment.effectiveAppliedHectares,
          realAppliedHectares: assessment.grossAppliedHectares,
          realCoveragePercent: assessment.coveragePercent,
          displayedAppliedHectares: accountedAreaHectares,
          displayedCoveragePercent: accountedCoveragePercent,
          accountedAreaHectares,
          accountedCoveragePercent,
          status: assessment.derivedStatus,
          applicationsCount: assessment.applications.length,
        },
      ];
    }

    return assessment.applications.map((application) => ({
      plotId: assessment.plotId,
      farmId: assessment.farmId,
      applicationId: application.id,
      registeredAreaHectares: assessment.registeredAreaHectares,
      effectiveAppliedHectares: assessment.effectiveAppliedHectares,
      realAppliedHectares: assessment.grossAppliedHectares,
      realCoveragePercent: assessment.coveragePercent,
      displayedAppliedHectares: application.appliedAreaHectares,
      displayedCoveragePercent: formatPercentage(
        parseDecimal(application.appliedAreaHectares),
        parseDecimal(assessment.registeredAreaHectares),
      ),
      accountedAreaHectares: application.appliedAreaHectares,
      accountedCoveragePercent: formatPercentage(
        parseDecimal(application.appliedAreaHectares),
        parseDecimal(assessment.registeredAreaHectares),
      ),
      status: assessment.derivedStatus,
      applicationsCount: assessment.applications.length,
    }));
  });
  const totals = buildTotals(serviceOrderAssessments);

  return {
    areaMode,
    completionThresholdPercent: PLOT_COMPLETION_THRESHOLD_PERCENT,
    coverageSource: 'maximum_registered_application_area' as const,
    rows,
    totals,
    totalDisplayedHectares: decimalToString(
      addDecimals(rows.map((row) => parseDecimal(row.displayedAppliedHectares))),
    ),
  };
}
