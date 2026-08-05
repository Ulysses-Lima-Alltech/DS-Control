import assert from 'node:assert/strict';

import { Application } from '@/types/applications.type';
import { ServiceOrder } from '@/types/service-order.type';

import {
  buildApplicationReportFilename,
  buildApplicationReportMetrics,
  hydrateApplicationReportPlots,
  resolveApplicationReportPeriod,
} from './service-order-application-report';

const all = resolveApplicationReportPeriod('all');
assert.deepEqual(all, { mode: 'all', label: 'Todas as aplicações' });
assert.equal(buildApplicationReportFilename(42, all), 'relatorio-aplicacoes-os-42-geral.pdf');

const single = resolveApplicationReportPeriod('single', '2026-08-05T23:59:00.000Z');
assert.equal(single.startDate, '2026-08-05');
assert.equal(single.endDate, '2026-08-05');
assert.equal(
  buildApplicationReportFilename(42, single),
  'relatorio-aplicacoes-os-42-2026-08-05.pdf'
);

const range = resolveApplicationReportPeriod('range', undefined, '2026-08-01', '2026-08-05');
assert.equal(range.label, '01/08/2026 a 05/08/2026');
assert.equal(
  buildApplicationReportFilename(42, range),
  'relatorio-aplicacoes-os-42-2026-08-01-a-2026-08-05.pdf'
);
assert.throws(
  () => resolveApplicationReportPeriod('range', undefined, '2026-08-06', '2026-08-05'),
  /data inicial/
);

const plot = { id: 'plot-1', name: 'Talhão 1' };
const serviceOrder = { plots: [plot], farms: [] } as unknown as ServiceOrder;
const applications = [
  { id: 'a', plotId: 'plot-1', plot: null, hectares: '3.5' },
  { id: 'b', plotId: null, plot: null, hectares: '2' },
] as unknown as Application[];
const hydrated = hydrateApplicationReportPlots(serviceOrder, applications);
assert.equal(hydrated[0].plot?.name, 'Talhão 1');
assert.equal(hydrated[1].plot, null);
assert.equal(applications[0].plot, null);
assert.deepEqual(buildApplicationReportMetrics(hydrated), {
  applicationsCount: 2,
  grossAppliedAreaHa: 5.5,
  distinctPlotsCount: 1,
});

console.log('service-order-application-report mobile tests passed');
