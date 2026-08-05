import assert from 'node:assert/strict';

import type { Application } from '@/types/applications.type';

import {
  buildApplicationReportFilename,
  buildApplicationReportMetrics,
  collectApplicationReportPages,
  hydrateApplicationReportPlots,
  resolveApplicationReportPeriod,
} from './service-order-application-report';

async function run() {
  const application = (id: string, hectares: string, plotId: string | null): Application =>
    ({ id, hectares, plotId }) as Application;

  assert.deepEqual(resolveApplicationReportPeriod('all'), {
    mode: 'all',
    label: 'Todas as aplicações',
  });
  assert.deepEqual(resolveApplicationReportPeriod('single', '2026-08-04'), {
    mode: 'single',
    label: 'Aplicações de 04/08/2026',
    startDate: '2026-08-04',
    endDate: '2026-08-04',
  });
  assert.deepEqual(resolveApplicationReportPeriod('range', '2026-08-01', '2026-08-04'), {
    mode: 'range',
    label: 'Aplicações de 01/08/2026 a 04/08/2026',
    startDate: '2026-08-01',
    endDate: '2026-08-04',
  });
  assert.throws(() => resolveApplicationReportPeriod('single', '2026-02-30'));
  assert.throws(() => resolveApplicationReportPeriod('range', '2026-08-04', '2026-08-01'));

  const metrics = buildApplicationReportMetrics([
    application('a', '10.25', 'plot-1'),
    application('b', '5,50', 'plot-1'),
    application('c', '3', null),
  ]);
  assert.deepEqual(metrics, {
    applicationsCount: 3,
    grossAppliedAreaHa: 18.75,
    distinctPlotsCount: 1,
  });

  const original = application('a', '10', 'plot-1');
  const hydrated = hydrateApplicationReportPlots([original], [
    { id: 'plot-1', name: 'Talhão 1' },
  ] as never);
  assert.notEqual(hydrated[0], original);
  assert.equal(hydrated[0].plot.name, 'Talhão 1');

  assert.equal(
    buildApplicationReportFilename(142, resolveApplicationReportPeriod('all')),
    'relatorio-aplicacoes-os-142-geral.pdf'
  );
  assert.equal(
    buildApplicationReportFilename(142, resolveApplicationReportPeriod('single', '2026-08-04')),
    'relatorio-aplicacoes-os-142-2026-08-04.pdf'
  );
  assert.equal(
    buildApplicationReportFilename(
      142,
      resolveApplicationReportPeriod('range', '2026-08-01', '2026-08-04')
    ),
    'relatorio-aplicacoes-os-142-2026-08-01-a-2026-08-04.pdf'
  );

  const paginated = await collectApplicationReportPages(async (page) => {
    if (page === 1) {
      return {
        data: [application('a', '1', 'plot-1'), application('b', '2', 'plot-2')],
        totalCount: 3,
        totalPages: 2,
      };
    }
    return {
      data: [application('b', '2', 'plot-2'), application('c', '3', null)],
      totalCount: 3,
      totalPages: 2,
    };
  });
  assert.deepEqual(
    paginated.map(({ id }) => id),
    ['a', 'b', 'c']
  );

  await assert.rejects(() =>
    collectApplicationReportPages(async () => ({ data: [], totalCount: 1, totalPages: 1 }))
  );
  await assert.rejects(() =>
    collectApplicationReportPages(async () => ({ data: [], totalCount: 0, totalPages: 2 }), 1)
  );
}

void run();
