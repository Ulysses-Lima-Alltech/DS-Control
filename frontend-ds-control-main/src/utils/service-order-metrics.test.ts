import assert from 'node:assert/strict';

import type { ServiceOrder } from '@/types/service-order.type';

import { resolveServiceOrderMetrics } from './service-order-metrics';

const canonical = resolveServiceOrderMetrics({
  metrics: {
    plannedAreaHa: 100,
    grossAppliedAreaHa: 125,
    effectiveCoveredAreaHa: 60,
    registeredCompletedAreaHa: 0,
    inProgressAppliedAreaHa: 125,
    consolidatedOperationalAreaHa: 125,
    registeredProgressPercent: 0,
    grossAppliedProgressPercent: 125,
    consolidatedProgressPercent: 125,
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
  progressPercent: 999,
} as Partial<ServiceOrder>);

assert.equal(canonical.plannedAreaHa, 100);
assert.equal(canonical.grossAppliedProgressPercent, 125);
assert.equal(canonical.inProgressPlots, 1);

const legacy = resolveServiceOrderMetrics({
  plannedHectares: 80,
  totalAppliedHectares: 20,
  completedHectares: 10,
  progressPercent: 12.5,
  completedPlots: 1,
  pendingPlots: 2,
  totalPlots: 3,
  applicationsCount: 2,
  plotsWithApplications: 1,
  plotCompletionThresholdPercent: 70,
} as Partial<ServiceOrder>);

assert.equal(legacy.plannedAreaHa, 80);
assert.equal(legacy.grossAppliedAreaHa, 20);
assert.equal(legacy.registeredCompletedAreaHa, 10);
assert.equal(legacy.registeredProgressPercent, 12.5);
assert.equal(legacy.coverageMethod, 'maximum_application');

const empty = resolveServiceOrderMetrics(undefined);
assert.equal(empty.plannedAreaHa, 0);
assert.equal(empty.applicationsWithoutPlotCount, 0);
assert.equal(empty.completionThresholdPercent, 70);
