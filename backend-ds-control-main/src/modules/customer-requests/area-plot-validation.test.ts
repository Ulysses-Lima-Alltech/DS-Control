import { describe, expect, it } from 'vitest';

import { resolveAreaPlotValidationStatus } from './area-plot-validation';

describe('area plot validation status', () => {
  it('preserves status when only the name changes', () => {
    expect(resolveAreaPlotValidationStatus('INVALID', ['bad-ring'], undefined)).toBe('INVALID');
  });

  it('allows any extracted plot to be excluded', () => {
    expect(resolveAreaPlotValidationStatus('INVALID', ['bad-ring'], true)).toBe('EXCLUDED');
  });

  it('reincludes only geometry without validation errors', () => {
    expect(resolveAreaPlotValidationStatus('EXCLUDED', [], false)).toBe('VALID');
    expect(() => resolveAreaPlotValidationStatus('EXCLUDED', ['bad-ring'], false)).toThrow(
      'não pode ser reincluído',
    );
  });
});
