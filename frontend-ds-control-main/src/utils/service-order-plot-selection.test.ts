import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { replaceFarmPlotSelection } from './service-order-plot-selection';

describe('replaceFarmPlotSelection', () => {
  it('replaces legacy farm plots instead of accumulating a new map version', () => {
    assert.deepEqual(
      replaceFarmPlotSelection(
        ['other-farm', 'legacy-1', 'legacy-2'],
        ['legacy-1', 'legacy-2', 'current-1', 'current-2'],
        ['current-1', 'current-2']
      ),
      ['other-farm', 'current-1', 'current-2']
    );
  });

  it('clears every known version of the farm when deselecting all', () => {
    assert.deepEqual(
      replaceFarmPlotSelection(
        ['legacy-1', 'current-1', 'other-farm'],
        ['legacy-1', 'current-1'],
        []
      ),
      ['other-farm']
    );
  });

  it('is idempotent and removes repeated ids', () => {
    const first = replaceFarmPlotSelection(
      ['other-farm', 'current-1'],
      ['legacy-1', 'current-1'],
      ['current-1', 'current-1']
    );

    assert.deepEqual(
      replaceFarmPlotSelection(first, ['legacy-1', 'current-1'], ['current-1']),
      first
    );
    assert.deepEqual(first, ['other-farm', 'current-1']);
  });
});
