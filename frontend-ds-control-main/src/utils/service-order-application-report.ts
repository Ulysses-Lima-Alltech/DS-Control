import { Application } from '@/types/applications.type';
import { Plot } from '@/types/plot.type';

export type ApplicationReportPeriodMode = 'all' | 'single' | 'range';

export type ApplicationReportPeriod = {
  mode: ApplicationReportPeriodMode;
  label: string;
  startDate?: string;
  endDate?: string;
};

export type ApplicationReportMetrics = {
  applicationsCount: number;
  grossAppliedAreaHa: number;
  distinctPlotsCount: number;
};

type ApplicationsPage = {
  data: Application[];
  totalCount: number;
  totalPages: number;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidCivilDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

function formatCivilDateBR(value: string): string {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

export function resolveApplicationReportPeriod(
  mode: ApplicationReportPeriodMode,
  startDate?: string,
  endDate?: string
): ApplicationReportPeriod {
  if (mode === 'all') return { mode, label: 'Todas as aplicações' };

  if (!startDate || !isValidCivilDate(startDate)) {
    throw new Error('Informe uma data inicial válida.');
  }

  if (mode === 'single') {
    return {
      mode,
      label: `Aplicações de ${formatCivilDateBR(startDate)}`,
      startDate,
      endDate: startDate,
    };
  }

  if (!endDate || !isValidCivilDate(endDate)) {
    throw new Error('Informe uma data final válida.');
  }
  if (startDate > endDate) {
    throw new Error('A data inicial não pode ser posterior à data final.');
  }

  return {
    mode,
    label: `Aplicações de ${formatCivilDateBR(startDate)} a ${formatCivilDateBR(endDate)}`,
    startDate,
    endDate,
  };
}

export function buildApplicationReportMetrics(
  applications: Application[]
): ApplicationReportMetrics {
  const plotIds = new Set<string>();
  let grossAppliedAreaHa = 0;

  applications.forEach((application) => {
    const hectares = Number(String(application.hectares || '0').replace(',', '.'));
    if (Number.isFinite(hectares)) grossAppliedAreaHa += hectares;
    if (application.plotId) plotIds.add(application.plotId);
  });

  return {
    applicationsCount: applications.length,
    grossAppliedAreaHa,
    distinctPlotsCount: plotIds.size,
  };
}

export function hydrateApplicationReportPlots(
  applications: Application[],
  plots: Plot[]
): Application[] {
  const plotsById = new Map(plots.filter((plot) => plot.id).map((plot) => [plot.id!, plot]));

  return applications.map((application) => {
    if (!application.plotId) return application;
    const plot = plotsById.get(application.plotId);
    return plot ? { ...application, plot } : application;
  });
}

export function buildApplicationReportFilename(
  serviceOrderNumber: string | number,
  period: ApplicationReportPeriod
): string {
  const safeNumber = String(serviceOrderNumber).replace(/[^a-zA-Z0-9_-]+/g, '-') || 'sem-numero';
  const suffix =
    period.mode === 'all'
      ? 'geral'
      : period.mode === 'single'
        ? period.startDate
        : `${period.startDate}-a-${period.endDate}`;

  return `relatorio-aplicacoes-os-${safeNumber}-${suffix}.pdf`;
}

export async function collectApplicationReportPages(
  fetchPage: (page: number) => Promise<ApplicationsPage>,
  maxPages = 10_000
): Promise<Application[]> {
  const applicationsById = new Map<string, Application>();
  let page = 1;
  let expectedTotal = 0;
  let expectedPages = 1;

  while (page <= expectedPages) {
    if (page > maxPages) {
      throw new Error('O relatório excedeu o limite de segurança de paginação.');
    }

    const payload = await fetchPage(page);
    expectedTotal = payload.totalCount;
    expectedPages = payload.totalPages;
    if (expectedPages > maxPages) {
      throw new Error('O relatório excedeu o limite de segurança de paginação.');
    }

    payload.data.forEach((application) => applicationsById.set(application.id, application));
    page += 1;
  }

  if (applicationsById.size !== expectedTotal) {
    throw new Error('A paginação do relatório não retornou todas as aplicações esperadas.');
  }

  return Array.from(applicationsById.values());
}
