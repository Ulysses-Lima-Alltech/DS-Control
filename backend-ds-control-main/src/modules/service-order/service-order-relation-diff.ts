export type RelationDiff = {
  addedIds: string[];
  removedIds: string[];
};

export function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

export function buildRelationDiff(existingIds: string[], requestedIds: string[]): RelationDiff {
  const existing = new Set(uniqueIds(existingIds));
  const requested = new Set(uniqueIds(requestedIds));

  return {
    addedIds: [...requested].filter((id) => !existing.has(id)),
    removedIds: [...existing].filter((id) => !requested.has(id)),
  };
}
