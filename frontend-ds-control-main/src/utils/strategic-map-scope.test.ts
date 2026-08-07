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

const serviceOrder = (
  plots: Plot[],
  farms: ServiceOrder['farms'] = [
    { id: 'f1', name: 'Fazenda Um' },
    { id: 'f2', name: 'Fazenda Dois' },
  ] as ServiceOrder['farms']
): ServiceOrder =>
  ({
    id: 'os',
    number: 142,
    status: 'open',
    plots,
    farms,
  }) as ServiceOrder;

test('aceita os três escopos explícitos e rejeita valores inválidos', () => {
  assert.equal(parseStrategicMapScope('completed'), 'completed');
  assert.equal(parseStrategicMapScope('pending'), 'pending');
  assert.equal(parseStrategicMapScope('all'), 'all');
  assert.equal(parseStrategicMapScope('COMPLETED'), null);
  assert.equal(parseStrategicMapScope('total'), null);
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

test('escopo completo reúne todos os estados válidos sem cancelados ou removidos', () => {
  const plots = [
    plot('done', { derivedStatus: 'COMPLETED' }),
    plot('doing', { derivedStatus: 'IN_PROGRESS' }),
    plot('todo', { derivedStatus: 'PENDING' }),
    plot('cancelled', { status: 'CANCELLED' }),
    plot('deleted', { derivedStatus: 'PENDING', deletedAt: '2026-01-01' }),
  ];
  assert.deepEqual(
    filterStrategicMapPlots(plots, 'all').map(({ id }) => id),
    ['done', 'doing', 'todo']
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
  assert.equal(buildStrategicMapFilename(142, 'all'), 'mapa-estrategico-os-142-completo.pdf');
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
  assert.equal(getStrategicMapScopeLabel('all'), 'TODAS AS ÁREAS');
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

test('geoJson inválido não cria feature, bounds ou item falso na legenda', () => {
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
  assert.deepEqual(data.legendItems, []);
});

test('legenda concluída agrupa por fazenda e soma somente talhões visíveis do scope', () => {
  const data = buildStrategicMapData(
    serviceOrder([
      plot('done-a', {
        name: 'Talhão 01',
        hectare: '25.30',
        farmId: 'f1',
        derivedStatus: 'COMPLETED',
      }),
      plot('done-b', {
        name: 'Talhão 02',
        hectare: '10.20',
        farmId: 'f1',
        derivedStatus: 'COMPLETED',
      }),
      plot('todo', { farmId: 'f1', derivedStatus: 'PENDING' }),
    ]),
    'completed'
  );
  assert.equal(data.legendItems.length, 1);
  assert.equal(data.legendItems[0].key, 'f1');
  assert.equal(data.legendItems[0].name, 'Fazenda Um');
  assert.equal(data.legendItems[0].hectares, 35.5);
  assert.equal(data.totalHectares, 35.5);
  assert.equal(data.drawablePlotCount, 2);
});

test('pending agrupa PENDING e IN_PROGRESS por fazenda com cores distintas', () => {
  const data = buildStrategicMapData(
    serviceOrder([
      plot('a', { farmId: 'f1', hectare: '12.5', derivedStatus: 'PENDING' }),
      plot('b', { farmId: 'f2', hectare: '8.25', derivedStatus: 'IN_PROGRESS' }),
      plot('done', { name: 'Talhão C', farmId: 'f2', derivedStatus: 'COMPLETED' }),
    ]),
    'pending'
  );
  assert.deepEqual(
    data.legendItems.map(({ key, hectares }) => [key, hectares]),
    [
      ['f2', 8.25],
      ['f1', 12.5],
    ]
  );
  assert.notEqual(data.legendItems[0].fill, data.legendItems[1].fill);
  assert.equal(data.totalHectares, 20.75);
});

test('talhões da mesma fazenda compartilham exatamente cor e opacidade da legenda', () => {
  const data = buildStrategicMapData(
    serviceOrder([
      plot('a', { farmId: 'f1', derivedStatus: 'PENDING' }),
      plot('b', { farmId: 'f1', derivedStatus: 'IN_PROGRESS' }),
    ]),
    'pending'
  );

  assert.equal(data.legendItems.length, 1);
  const farmLegend = data.legendItems[0];
  data.featureCollection.features.forEach((feature) => {
    assert.equal(feature.properties?.farm_key, farmLegend.key);
    assert.equal(feature.properties?.fill, farmLegend.fill);
    assert.equal(feature.properties?.fill_opacity, farmLegend.fillOpacity);
  });
});

test('legenda completa soma fazendas sem contar GeoJSON ausente ou geometria duplicada', () => {
  const multiFeatureGeoJson = polygon(0);
  multiFeatureGeoJson.features.push({
    ...multiFeatureGeoJson.features[0],
    geometry: polygon(5).features[0].geometry,
  });
  const data = buildStrategicMapData(
    serviceOrder([
      plot('done', {
        name: 'Talhão 01',
        hectare: '25.30',
        farmId: 'f1',
        derivedStatus: 'COMPLETED',
        geoJson: multiFeatureGeoJson,
      }),
      plot('doing', {
        name: 'Talhão 02',
        hectare: '18,40',
        farmId: 'f1',
        derivedStatus: 'IN_PROGRESS',
      }),
      plot('todo', {
        name: 'Talhão 03',
        hectare: '22.10',
        farmId: 'f2',
        derivedStatus: 'PENDING',
      }),
      plot('without-geometry', {
        hectare: '100',
        farmId: 'f2',
        derivedStatus: 'PENDING',
        geoJson: undefined,
      }),
    ]),
    'all'
  );

  assert.equal(data.featureCollection.features.length, 4);
  assert.deepEqual(
    data.legendItems.map(({ key, hectares }) => [key, hectares]),
    [
      ['f2', 22.1],
      ['f1', 43.7],
    ]
  );
  assert.ok(Math.abs(data.totalHectares - 65.8) < 1e-9);
  assert.equal(
    data.totalHectares,
    data.legendItems.reduce((sum, farm) => sum + farm.hectares, 0)
  );
  assert.equal(data.drawablePlotCount, 3);
});

test('múltiplas geometrias do mesmo talhão não duplicam hectares', () => {
  const geoJson = polygon(0);
  geoJson.features.push({ ...geoJson.features[0], geometry: polygon(5).features[0].geometry });
  const data = buildStrategicMapData(
    serviceOrder([plot('a', { derivedStatus: 'COMPLETED', geoJson })]),
    'completed'
  );

  assert.equal(data.featureCollection.features.length, 2);
  assert.equal(data.legendItems.length, 1);
  assert.equal(data.legendItems[0].hectares, 10);
  assert.equal(data.totalHectares, 10);
  assert.equal(data.drawablePlotCount, 1);
});

test('farm.mapColor é respeitado e fazendas com cor repetida recebem fallback local distinto', () => {
  const data = buildStrategicMapData(
    serviceOrder(
      [
        plot('a', { farmId: 'f1', derivedStatus: 'COMPLETED' }),
        plot('b', { farmId: 'f2', derivedStatus: 'COMPLETED' }),
      ],
      [
        { id: 'f1', name: 'Fazenda Um', mapColor: '#123456' },
        { id: 'f2', name: 'Fazenda Dois', mapColor: '#123456' },
      ] as ServiceOrder['farms']
    ),
    'completed'
  );

  const colorByFarm = new Map(data.legendItems.map((farm) => [farm.key, farm.fill]));
  assert.equal(colorByFarm.get('f1'), '#123456');
  assert.notEqual(colorByFarm.get('f2'), '#123456');
  assert.notEqual(colorByFarm.get('f1'), colorByFarm.get('f2'));
  data.featureCollection.features.forEach((feature) => {
    assert.equal(feature.properties?.fill, colorByFarm.get(feature.properties?.farm_key));
  });
});

test('fallback sem mapColor é determinístico e preserva o rótulo individual do talhão', () => {
  const source = serviceOrder([
    plot('a', { name: 'Talhão Identificado', farmId: 'f1', derivedStatus: 'COMPLETED' }),
  ]);
  const first = buildStrategicMapData(source, 'completed');
  const second = buildStrategicMapData(source, 'completed');

  assert.equal(first.legendItems[0].fill, second.legendItems[0].fill);
  assert.equal(first.featureCollection.features[0].properties?.plot_name, 'Talhão Identificado');
  assert.equal(first.featureCollection.features[0].properties?.plot_id, 'a');
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
