export function replaceFarmPlotSelection(
  selectedPlotIds: string[],
  knownFarmPlotIds: string[],
  currentFarmPlotIds: string[]
): string[] {
  const farmPlotIds = new Set(knownFarmPlotIds);
  const selectedOutsideFarm = selectedPlotIds.filter((plotId) => !farmPlotIds.has(plotId));

  return [...new Set([...selectedOutsideFarm, ...currentFarmPlotIds])];
}
