import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Plot } from '@/types/plot.type';
import type { ServiceOrder } from '@/types/service-order.type';

import {
  buildStrategicMapData,
  buildStrategicMapFilename,
  filterStrategicMapPlots,
  getStrategicMapScopeLabel,
  parseStrategicMapScope,
  resolveStrategicMapPlotStatus,
  scopeStrategicMapServiceOrder,
} from './strategic-map-scope';

const polygon = (x: number) => ({
  type: 'FeatureCollection' as const,
  features: [
    {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'Polygon' as const,
        coordinates: [
          [
            [x, 0],
            [x + 1, 0],
            [x + 1, 1],
            [x, 0],
          ],
        ],
      },
    },
  ],
});

const plot = (id: string, overrides: Partial<Plot> = {}): Plot => ({
  id,
  name: id,
  externalId: id,
  hectare: '10',
  geoJson: polygon(0),
  status: 'PENDING',
  ...overrides,
});

const serviceOrder = (plots: Plot[]): ServiceOrder =>
  ({
    id: 'os',
    number: 142,
    status: 'open',
    plots,
    farms: [
      { id: 'f1', name: 'Fazenda Um' },
      { id: 'f2', name: 'Fazenda Dois' },
    ] as ServiceOrder['farms'],
  }) as ServiceOrder;

test('aceita somente os dois escopos explícitos', () => {
  assert.equal(parseStrategicMapScope('completed'), 'completed');
  assert.equal(parseStrategicMapScope('pending'), 'pending');
  assert.equal(parseStrategicMapScope('COMPLETED'), null);
  assert.equal(parseStrategicMapScope('all'), null);
  assert.equal(parseStrategicMapScope(null), null);
});

test('status derivado prevalece sobre o persistido', () => {
  assert.equal(
    resolveStrategicMapPlotStatus(plot('a', { status: 'COMPLETED', derivedStatus: 'IN_PROGRESS' })),
    'IN_PROGRESS'
  );
  assert.equal(
    resolveStrategicMapPlotStatus(plot('b', { status: 'PENDING', derivedStatus: 'COMPLETED' })),
    'COMPLETED'
  );
});

test('fallback retrocompatível usa status persistido', () => {
  assert.equal(resolveStrategicMapPlotStatus(plot('a', { status: 'COMPLETED' })), 'COMPLETED');
  assert.equal(resolveStrategicMapPlotStatus(plot('b', { status: 'PENDING' })), 'PENDING');
});

test('cancelados e removidos são excluídos', () => {
  assert.equal(resolveStrategicMapPlotStatus(plot('a', { status: 'CANCELLED' })), null);
  assert.equal(resolveStrategicMapPlotStatus(plot('b', { deletedAt: '2026-01-01' })), null);
});

test('escopo concluído contém somente derived COMPLETED', () => {
  const plots = [
    plot('done', { derivedStatus: 'COMPLETED' }),
    plot('doing', { derivedStatus: 'IN_PROGRESS' }),
    plot('todo', { derivedStatus: 'PENDING' }),
  ];
  assert.deepEqual(
    filterStrategicMapPlots(plots, 'completed').map(({ id }) => id),
    ['done']
  );
});

test('escopo pendente reúne PENDING e IN_PROGRESS', () => {
  const plots = [
    plot('done', { derivedStatus: 'COMPLETED' }),
    plot('doing', { derivedStatus: 'IN_PROGRESS' }),
    plot('todo', { derivedStatus: 'PENDING' }),
  ];
  assert.deepEqual(
    filterStrategicMapPlots(plots, 'pending').map(({ id }) => id),
    ['doing', 'todo']
  );
});

test('escopo vazio permanece vazio', () => {
  assert.deepEqual(filterStrategicMapPlots(undefined, 'completed'), []);
});

test('cópia da OS não altera o objeto original', () => {
  const source = serviceOrder([plot('done', { derivedStatus: 'COMPLETED' }), plot('todo')]);
  const scoped = scopeStrategicMapServiceOrder(source, 'completed');
  assert.equal(source.plots.length, 2);
  assert.equal(scoped.plots.length, 1);
  assert.notEqual(scoped, source);
});

test('nomes de arquivo são exatos por escopo', () => {
  assert.equal(
    buildStrategicMapFilename(142, 'completed'),
    'mapa-estrategico-os-142-concluidos.pdf'
  );
  assert.equal(buildStrategicMapFilename(142, 'pending'), 'mapa-estrategico-os-142-pendentes.pdf');
});

test('nome de arquivo sanitiza número externo', () => {
  assert.equal(
    buildStrategicMapFilename(' OS 14/2 ', 'completed'),
    'mapa-estrategico-os-OS-14-2-concluidos.pdf'
  );
});

test('rótulos distinguem os escopos', () => {
  assert.equal(getStrategicMapScopeLabel('completed'), 'ÁREAS CONCLUÍDAS');
  assert.equal(getStrategicMapScopeLabel('pending'), 'ÁREAS PENDENTES E EM ANDAMENTO');
});

test('dados concluídos usam somente geometria do escopo', () => {
  const data = buildStrategicMapData(
    serviceOrder([
      plot('done', { farmId: 'f1', derivedStatus: 'COMPLETED', geoJson: polygon(10) }),
      plot('todo', { farmId: 'f2', derivedStatus: 'PENDING', geoJson: polygon(30) }),
    ]),
    'completed'
  );
  assert.equal(data.featureCollection.features.length, 1);
  assert.deepEqual(data.bounds, [
    [10, 0],
    [11, 1],
  ]);
});

test('bounds pendentes são recalculados depois do filtro', () => {
  const data = buildStrategicMapData(
    serviceOrder([
      plot('done', { farmId: 'f1', derivedStatus: 'COMPLETED', geoJson: polygon(10) }),
      plot('todo', { farmId: 'f2', derivedStatus: 'PENDING', geoJson: polygon(30) }),
    ]),
    'pending'
  );
  assert.deepEqual(data.bounds, [
    [30, 0],
    [31, 1],
  ]);
});

test('geoJson inválido não cria feature, bounds ou fazenda na legenda', () => {
  const data = buildStrategicMapData(
    serviceOrder([
      plot('bad', {
        farmId: 'f1',
        derivedStatus: 'COMPLETED',
        geoJson: 'invalid' as unknown as Plot['geoJson'],
      }),
    ]),
    'completed'
  );
  assert.equal(data.featureCollection.features.length, 0);
  assert.equal(data.bounds, null);
  assert.deepEqual(data.farms, []);
});

test('uma fazenda produz uma única linha sem hectares', () => {
  const data = buildStrategicMapData(
    serviceOrder([
      plot('a', { farmId: 'f1', derivedStatus: 'COMPLETED' }),
      plot('b', { farmId: 'f1', derivedStatus: 'COMPLETED' }),
    ]),
    'completed'
  );
  assert.equal(data.farms.length, 1);
  assert.deepEqual(Object.keys(data.farms[0]).sort(), ['fill', 'key', 'name']);
});

test('múltiplas fazendas mantêm nome e cor consistentes', () => {
  const data = buildStrategicMapData(
    serviceOrder([
      plot('a', { farmId: 'f1', derivedStatus: 'PENDING' }),
      plot('b', { farmId: 'f2', derivedStatus: 'IN_PROGRESS' }),
    ]),
    'pending'
  );
  assert.deepEqual(
    data.farms.map(({ name }) => name),
    ['Fazenda Um', 'Fazenda Dois']
  );
  assert.equal(data.featureCollection.features[0].properties?.fill, data.farms[0].fill);
  assert.equal(data.featureCollection.features[1].properties?.fill, data.farms[1].fill);
});

test('legenda desconhecida não inventa métricas', () => {
  const data = buildStrategicMapData(
    serviceOrder([plot('a', { farmId: undefined, derivedStatus: 'COMPLETED' })]),
    'completed'
  );
  assert.equal(data.farms[0].name, 'Fazenda não informada');
  assert.equal('hectares' in data.farms[0], false);
  assert.equal('total' in data.farms[0], false);
});

test('coleção multipolígono participa do bounds', () => {
  const multi = {
    type: 'MultiPolygon' as const,
    coordinates: [
      [
        [
          [2, 3],
          [4, 3],
          [4, 5],
          [2, 3],
        ],
      ],
    ],
  };
  const data = buildStrategicMapData(
    serviceOrder([
      plot('multi', { derivedStatus: 'COMPLETED', geoJson: multi as unknown as Plot['geoJson'] }),
    ]),
    'completed'
  );
  assert.deepEqual(data.bounds, [
    [2, 3],
    [4, 5],
  ]);
});
