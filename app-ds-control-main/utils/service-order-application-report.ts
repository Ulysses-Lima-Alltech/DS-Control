import { Application } from '@/types/applications.type';
import { ServiceOrder } from '@/types/service-order.type';
import { toOperationalDateYMD } from '@/utils/operational-date';

export type ApplicationReportPeriodMode = 'all' | 'single' | 'range';

export type ApplicationReportPeriod = {
  mode: ApplicationReportPeriodMode;
  startDate?: string;
  endDate?: string;
  label: string;
};

export type ApplicationReportMetrics = {
  applicationsCount: number;
  grossAppliedAreaHa: number;
  distinctPlotsCount: number;
};

const formatCivilDate = (value: string) => {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
};

export function resolveApplicationReportPeriod(
  mode: ApplicationReportPeriodMode,
  selectedDate?: string,
  startDate?: string,
  endDate?: string
): ApplicationReportPeriod {
  if (mode === 'all') return { mode, label: 'Todas as aplica\u00e7\u00f5es' };

  if (mode === 'single') {
    const date = toOperationalDateYMD(selectedDate);
    if (!date) throw new Error('Selecione uma data v\u00e1lida.');
    return { mode, startDate: date, endDate: date, label: formatCivilDate(date) };
  }

  const normalizedStartDate = toOperationalDateYMD(startDate);
  const normalizedEndDate = toOperationalDateYMD(endDate);
  if (!normalizedStartDate || !normalizedEndDate) {
    throw new Error('Selecione as datas inicial e final.');
  }
  if (normalizedStartDate > normalizedEndDate) {
    throw new Error('A data inicial n\u00e3o pode ser posterior \u00e0 data final.');
  }

  return {
    mode,
    startDate: normalizedStartDate,
    endDate: normalizedEndDate,
    label: `${formatCivilDate(normalizedStartDate)} a ${formatCivilDate(normalizedEndDate)}`,
  };
}

export function hydrateApplicationReportPlots(
  serviceOrder: ServiceOrder,
  applications: Application[]
): Application[] {
  const plots = new Map(
    [
      ...(serviceOrder.plots ?? []),
      ...(serviceOrder.farms ?? []).flatMap((farm) => farm.plots ?? []),
    ]
      .filter((plot) => Boolean(plot.id))
      .map((plot) => [plot.id, plot])
  );

  return applications.map((application) => ({
    ...application,
    plot: application.plot ?? (application.plotId ? (plots.get(application.plotId) ?? null) : null),
  }));
}

export function buildApplicationReportMetrics(
  applications: Application[]
): ApplicationReportMetrics {
  return {
    applicationsCount: applications.length,
    grossAppliedAreaHa: applications.reduce(
      (total, application) => total + (Number(application.hectares) || 0),
      0
    ),
    distinctPlotsCount: new Set(
      applications.map((application) => application.plotId).filter(Boolean)
    ).size,
  };
}

export function buildApplicationReportFilename(
  serviceOrderNumber: number,
  period: ApplicationReportPeriod
): string {
  const safeNumber = String(serviceOrderNumber).replace(/[^a-zA-Z0-9_-]+/g, '-') || 'sem-numero';
  if (period.mode === 'single') {
    return `relatorio-aplicacoes-os-${safeNumber}-${period.startDate}.pdf`;
  }
  if (period.mode === 'range') {
    return `relatorio-aplicacoes-os-${safeNumber}-${period.startDate}-a-${period.endDate}.pdf`;
  }
  return `relatorio-aplicacoes-os-${safeNumber}-geral.pdf`;
}
