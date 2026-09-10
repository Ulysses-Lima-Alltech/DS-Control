import { describe, expect, it } from 'vitest';

import { buildRelationDiff, uniqueIds } from '../service-order-relation-diff';

describe('service-order relation diff', () => {
  it('deduplicates ids while preserving their first-seen order', () => {
    expect(uniqueIds(['plot-1', 'plot-1', 'plot-2'])).toEqual(['plot-1', 'plot-2']);
  });

  it('only adds and removes changed identities', () => {
    expect(buildRelationDiff(['plot-1', 'plot-2'], ['plot-2', 'plot-3', 'plot-3'])).toEqual({
      addedIds: ['plot-3'],
      removedIds: ['plot-1'],
    });
  });

  it('is idempotent for an unchanged relation', () => {
    expect(buildRelationDiff(['plot-1', 'plot-2'], ['plot-2', 'plot-1'])).toEqual({
      addedIds: [],
      removedIds: [],
    });
  });
});
