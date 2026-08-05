import assert from 'node:assert/strict';

import type { ServiceOrder } from '@/types/service-order.type';

import { resolveServiceOrderMetrics } from './service-order-metrics';

const canonical = resolveServiceOrderMetrics({
  metrics: {
    plannedAreaHa: 100,
    grossAppliedAreaHa: 120,
    effectiveCoveredAreaHa: 60,
    registeredCompletedAreaHa: 0,
    inProgressAppliedAreaHa: 120,
    consolidatedOperationalAreaHa: 120,
    registeredProgressPercent: 0,
    grossAppliedProgressPercent: 120,
    consolidatedProgressPercent: 120,
    totalPlots: 1,
    completedPlots: 0,
    inProgressPlots: 1,
    pendingPlots: 0,
    applicationsCount: 2,
    plotsWithApplications: 1,
    applicationsWithoutPlotCount: 0,
    completionThresholdPercent: 70,
    coverageMethod: 'maximum_application',
    metricVersion: 1,
  },
  plannedHectares: 999,
} as Partial<ServiceOrder>);

assert.equal(canonical.plannedAreaHa, 100);
assert.equal(canonical.grossAppliedProgressPercent, 120);

const legacyCache = resolveServiceOrderMetrics({
  plannedHectares: 80,
  totalAppliedHectares: 20,
  completedHectares: 10,
  progressPercent: 12.5,
  completedPlots: 1,
  pendingPlots: 2,
  totalPlots: 3,
  applicationsCount: 2,
  plotsWithApplications: 1,
} as Partial<ServiceOrder>);

assert.equal(legacyCache.plannedAreaHa, 80);
assert.equal(legacyCache.grossAppliedAreaHa, 20);
assert.equal(legacyCache.registeredCompletedAreaHa, 10);
assert.equal(legacyCache.registeredProgressPercent, 12.5);
assert.equal(legacyCache.completionThresholdPercent, 70);
