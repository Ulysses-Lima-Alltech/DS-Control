import type { Application } from '@/types/applications.type';
import type { Farm } from '@/types/farm.type';
import type { Plot } from '@/types/plot.type';
import type { ServiceOrder } from '@/types/service-order.type';

export type ReportAreaCriterion = 'plot-total' | 'applied-registered';
export type ApplicationsReportScope = 'all' | 'completed' | 'pending';

export const REPORT_AREA_CRITERIA: Record<
  ReportAreaCriterion,
  {
    label: string;
    shortDescription: string;
    summaryLabel: string;
    summaryCriterion: string;
    countLabel: string;
    operationalNote: string;
    fileSlug: string;
  }
> = {
  'plot-total': {
    label: 'Área Total dos Talhões',
    shortDescription: 'Utiliza a área cadastrada no mapa.',
    summaryLabel: 'Área Total Considerada',
    summaryCriterion: 'Área cadastrada dos talhões',
    countLabel: 'Quantidade de Talhões',
    operationalNote:
      'Os valores deste relatório correspondem às áreas cadastradas dos talhões incluídos.',
    fileSlug: 'area-total',
  },
  'applied-registered': {
    label: 'Área Aplicada Registrada',
    shortDescription: 'Utiliza a área informada nas aplicações.',
    summaryLabel: 'Área Total Aplicada',
    summaryCriterion: 'Área informada nas aplicações',
    countLabel: 'Aplicações Consideradas',
    operationalNote:
      'Os valores deste relatório correspondem às áreas registradas nas aplicações e podem variar em caso de interrupção ou perda de comunicação com o equipamento.',
    fileSlug: 'area-aplicada',
  },
};

export const APPLICATIONS_REPORT_SCOPES: Record<
  ApplicationsReportScope,
  { label: string; fileSlug: string }
> = {
  all: { label: 'Geral', fileSlug: 'geral' },
  completed: { label: 'Concluídos', fileSlug: 'concluidos' },
  pending: { label: 'Pendentes', fileSlug: 'pendentes' },
};

export function parseReportArea(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export function formatReportHectares(value: unknown): string {
  return `${parseReportArea(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ha`;
}

export function deduplicatePlotsById(plots: Plot[]): Plot[] {
  const plotsById = new Map<string, Plot>();

  plots.forEach((plot) => {
    if (plot.id) {
      plotsById.set(plot.id, plot);
    }
  });

  return Array.from(plotsById.values());
}

export function deduplicateApplicationsById(applications: Application[]): Application[] {
  const applicationsById = new Map<string, Application>();

  applications.forEach((application) => {
    if (application.id && !application.deletedAt) {
      applicationsById.set(application.id, application);
    }
  });

  return Array.from(applicationsById.values());
}

export function sumRegisteredPlotArea(plots: Plot[]): number {
  return deduplicatePlotsById(plots).reduce(
    (total, plot) => total + parseReportArea(plot.hectare),
    0
  );
}

export function sumRegisteredApplicationArea(applications: Application[]): number {
  return deduplicateApplicationsById(applications).reduce(
    (total, application) => total + parseReportArea(application.hectares),
    0
  );
}

export function groupApplicationsByPlot(applications: Application[]): Map<string, Application[]> {
  const applicationsByPlot = new Map<string, Application[]>();

  deduplicateApplicationsById(applications).forEach((application) => {
    if (!application.plotId) {
      return;
    }

    const plotApplications = applicationsByPlot.get(application.plotId) || [];
    plotApplications.push(application);
    applicationsByPlot.set(application.plotId, plotApplications);
  });

  return applicationsByPlot;
}

export function groupPlotsByFarm(plots: Plot[], farms: Farm[] = []): Map<string, Plot[]> {
  const farmIdsByPlotId = new Map<string, string>();

  farms.forEach((farm) => {
    farm.plots?.forEach((plot) => {
      if (plot.id) {
        farmIdsByPlotId.set(plot.id, farm.id);
      }
    });
  });

  const plotsByFarm = new Map<string, Plot[]>();
  deduplicatePlotsById(plots).forEach((plot) => {
    const farmId = plot.farmId || (plot.id ? farmIdsByPlotId.get(plot.id) : undefined) || 'unknown';
    const farmPlots = plotsByFarm.get(farmId) || [];
    farmPlots.push(plot);
    plotsByFarm.set(farmId, farmPlots);
  });

  return plotsByFarm;
}

export interface ApplicationsReportPlotEntry {
  plot: Plot;
  applications: Application[];
  registeredArea: number;
  appliedArea: number;
  consideredArea: number;
}

export interface ApplicationsReportData {
  scope: ApplicationsReportScope;
  areaCriterion: ReportAreaCriterion;
  plots: Plot[];
  applications: Application[];
  plotEntries: ApplicationsReportPlotEntry[];
  totalArea: number;
  distinctPlotCount: number;
  distinctApplicationCount: number;
  hasAppliedArea: boolean;
}

export function buildApplicationsReportData({
  serviceOrder,
  applications,
  scope = 'all',
  areaCriterion = 'applied-registered',
}: {
  serviceOrder: ServiceOrder;
  applications: Application[];
  scope?: ApplicationsReportScope;
  areaCriterion?: ReportAreaCriterion;
}): ApplicationsReportData {
  const allPlots = deduplicatePlotsById(serviceOrder.plots || []);
  const validPlotIds = new Set(allPlots.flatMap((plot) => (plot.id ? [plot.id] : [])));
  const allApplications = deduplicateApplicationsById(applications).filter(
    (application) => application.serviceOrderId === serviceOrder.id
  );
  const applicationsWithValidPlot = allApplications.filter(
    (application) => application.plotId && validPlotIds.has(application.plotId)
  );
  const completedPlotIds = new Set(
    applicationsWithValidPlot.flatMap((application) =>
      application.plotId ? [application.plotId] : []
    )
  );

  const plots = allPlots.filter((plot) => {
    if (scope === 'all') {
      return true;
    }

    const isCompleted = Boolean(plot.id && completedPlotIds.has(plot.id));
    return scope === 'completed' ? isCompleted : !isCompleted;
  });
  const selectedPlotIds = new Set(plots.flatMap((plot) => (plot.id ? [plot.id] : [])));

  const selectedApplications = allApplications.filter((application) => {
    if (scope === 'all') {
      return true;
    }

    return Boolean(application.plotId && selectedPlotIds.has(application.plotId));
  });
  const applicationsByPlot = groupApplicationsByPlot(selectedApplications);

  const detailPlots =
    areaCriterion === 'plot-total' || scope === 'pending'
      ? plots
      : plots.filter((plot) => Boolean(plot.id && applicationsByPlot.has(plot.id)));

  const plotEntries = detailPlots.map((plot) => {
    const plotApplications = plot.id ? applicationsByPlot.get(plot.id) || [] : [];
    const registeredArea = parseReportArea(plot.hectare);
    const appliedArea = sumRegisteredApplicationArea(plotApplications);

    return {
      plot,
      applications: plotApplications,
      registeredArea,
      appliedArea,
      consideredArea: areaCriterion === 'plot-total' ? registeredArea : appliedArea,
    };
  });

  const totalArea =
    areaCriterion === 'plot-total'
      ? sumRegisteredPlotArea(plots)
      : sumRegisteredApplicationArea(selectedApplications);

  return {
    scope,
    areaCriterion,
    plots,
    applications: selectedApplications,
    plotEntries,
    totalArea,
    distinctPlotCount: plots.length,
    distinctApplicationCount: selectedApplications.length,
    hasAppliedArea: sumRegisteredApplicationArea(selectedApplications) > 0,
  };
}

export function buildApplicationsReportFileName({
  serviceOrderNumber,
  areaCriterion,
  scope,
}: {
  serviceOrderNumber: number;
  areaCriterion: ReportAreaCriterion;
  scope: ApplicationsReportScope;
}): string {
  return `relatorio-${REPORT_AREA_CRITERIA[areaCriterion].fileSlug}-os-${serviceOrderNumber}-${APPLICATIONS_REPORT_SCOPES[scope].fileSlug}.pdf`;
}
