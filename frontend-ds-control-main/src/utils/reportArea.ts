import type { Application } from '@/types/applications.type';
import type { Farm } from '@/types/farm.type';
import type { Plot } from '@/types/plot.type';
import type { ServiceOrder } from '@/types/service-order.type';

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

function buildFarmIdByPlotId(farms: Farm[]): Map<string, string> {
  const farmIdByPlotId = new Map<string, string>();

  farms.forEach((farm) => {
    farm.plots?.forEach((plot) => {
      if (plot.id) {
        farmIdByPlotId.set(plot.id, farm.id);
      }
    });
  });

  return farmIdByPlotId;
}

export function groupPlotsByFarm(plots: Plot[], farms: Farm[]): Map<string, Plot[]> {
  const farmIdByPlotId = buildFarmIdByPlotId(farms);
  const plotsByFarm = new Map<string, Plot[]>();

  deduplicatePlotsById(plots).forEach((plot) => {
    const farmId = plot.farmId || (plot.id ? farmIdByPlotId.get(plot.id) : undefined) || 'unknown';
    const farmPlots = plotsByFarm.get(farmId) || [];
    farmPlots.push(plot);
    plotsByFarm.set(farmId, farmPlots);
  });

  return plotsByFarm;
}

export interface PlannedAreaFarmGroup {
  id: string;
  name: string;
  plots: Plot[];
  totalArea: number;
}

export interface PlannedAreaPlotEntry {
  plot: Plot;
  farmId: string;
  farmName: string;
  status: 'completed' | 'pending';
}

export interface PlannedAreaReportData {
  plots: Plot[];
  applications: Application[];
  farmGroups: PlannedAreaFarmGroup[];
  plotEntries: PlannedAreaPlotEntry[];
  totalArea: number;
  totalPlots: number;
}

export function buildCompletedPlotsPlannedAreaReportData({
  serviceOrder,
  applications,
  completedPlotIds,
}: {
  serviceOrder: ServiceOrder;
  applications: Application[];
  completedPlotIds: string[];
}): PlannedAreaReportData {
  const completedIds = new Set(completedPlotIds);
  const completedPlots = deduplicatePlotsById(serviceOrder.plots || []).filter((plot) =>
    Boolean(plot.id && completedIds.has(plot.id))
  );
  const completedServiceOrder: ServiceOrder = {
    ...serviceOrder,
    plots: completedPlots,
  };
  const reportData = buildPlannedAreaReportData({
    serviceOrder: completedServiceOrder,
    applications,
  });

  return {
    ...reportData,
    plotEntries: reportData.plotEntries.map((entry) => ({
      ...entry,
      status: 'completed' as const,
    })),
  };
}

export function buildPlannedAreaReportData({
  serviceOrder,
  applications,
}: {
  serviceOrder: ServiceOrder;
  applications: Application[];
}): PlannedAreaReportData {
  const plots = deduplicatePlotsById(serviceOrder.plots || []);
  const validPlotIds = new Set(plots.flatMap((plot) => (plot.id ? [plot.id] : [])));
  const distinctApplications = deduplicateApplicationsById(applications).filter(
    (application) => application.serviceOrderId === serviceOrder.id
  );
  const completedPlotIds = new Set(
    distinctApplications.flatMap((application) =>
      application.plotId && validPlotIds.has(application.plotId) ? [application.plotId] : []
    )
  );
  const farmsById = new Map((serviceOrder.farms || []).map((farm) => [farm.id, farm]));
  const farmIdByPlotId = buildFarmIdByPlotId(serviceOrder.farms || []);
  const plotsByFarm = groupPlotsByFarm(plots, serviceOrder.farms || []);

  const farmGroups = Array.from(plotsByFarm.entries()).map(([farmId, farmPlots]) => ({
    id: farmId,
    name: farmsById.get(farmId)?.name || 'Fazenda não identificada',
    plots: farmPlots,
    totalArea: sumRegisteredPlotArea(farmPlots),
  }));

  const plotEntries = plots.map((plot) => {
    const farmId = plot.farmId || (plot.id ? farmIdByPlotId.get(plot.id) : undefined) || 'unknown';

    return {
      plot,
      farmId,
      farmName: farmsById.get(farmId)?.name || 'Fazenda não identificada',
      status:
        plot.id && completedPlotIds.has(plot.id) ? ('completed' as const) : ('pending' as const),
    };
  });

  return {
    plots,
    applications: distinctApplications,
    farmGroups,
    plotEntries,
    totalArea: sumRegisteredPlotArea(plots),
    totalPlots: plots.length,
  };
}
