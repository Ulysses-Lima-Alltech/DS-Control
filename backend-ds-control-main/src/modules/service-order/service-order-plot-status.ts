export type ServiceOrderPlotStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED';

export function buildServiceOrderPlotStatusUpdate(
  status: ServiceOrderPlotStatus,
  currentUserId: string,
  now = new Date(),
) {
  const completed = status === 'COMPLETED';
  return {
    status,
    completedAt: completed ? now : null,
    completedBy: completed ? currentUserId : null,
    updatedAt: now,
  };
}

export function calculateOfficialPlotProgress(
  links: Array<{ plotId: string; status: ServiceOrderPlotStatus; hectare: string | number }>,
) {
  const uniqueLinks = new Map(links.map((link) => [link.plotId, link]));
  let plannedHectares = 0;
  let completedHectares = 0;
  let pendingHectares = 0;
  let completedPlots = 0;
  let pendingPlots = 0;

  uniqueLinks.forEach((link) => {
    const hectare = Number(link.hectare) || 0;
    plannedHectares += hectare;
    if (link.status === 'COMPLETED') {
      completedPlots += 1;
      completedHectares += hectare;
    } else if (link.status === 'PENDING') {
      pendingPlots += 1;
      pendingHectares += hectare;
    }
  });

  const roundedPlannedHectares = Number(plannedHectares.toFixed(2));
  const roundedCompletedHectares = Number(completedHectares.toFixed(2));

  return {
    plannedHectares: roundedPlannedHectares,
    completedHectares: roundedCompletedHectares,
    pendingHectares: Number(pendingHectares.toFixed(2)),
    completedPlots,
    pendingPlots,
    progressPercent:
      roundedPlannedHectares > 0
        ? Number(((roundedCompletedHectares / roundedPlannedHectares) * 100).toFixed(2))
        : 0,
  };
}
