import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  deriveAutomaticFarmMapColor,
  deriveFarmStrokeColor,
  resolveFarmMapColor,
} from './farm-map-color';
import { convertDatabasePlotsToMapViewerPlotsFeatureCollection } from './map-utils';

test('farm colors use the shared stable test vectors', () => {
  assert.equal(deriveAutomaticFarmMapColor('00000000-0000-0000-0000-000000000001'), '#94A3B8');
  assert.equal(deriveAutomaticFarmMapColor('00000000-0000-0000-0000-000000000002'), '#F59E0B');
  assert.equal(resolveFarmMapColor({ id: 'old-cache' }), deriveAutomaticFarmMapColor('old-cache'));
  assert.equal(resolveFarmMapColor({ id: 'farm', mapColor: '#71a780' }), '#71A780');
  assert.equal(deriveFarmStrokeColor('#71A780'), '#4B6E54');
});

test('operational GeoJSON preserves imported metadata but farm color wins', () => {
  const plot = {
    id: 'plot',
    name: 'Plot',
    farmId: 'farm',
    externalId: 'plot',
    hectare: '1',
    geoJson: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { fill: '#FFFFFF', stroke: '#000000' },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [0, 0],
                [1, 0],
                [0, 1],
                [0, 0],
              ],
            ],
          },
        },
      ],
    },
  } as const;
  const feature = convertDatabasePlotsToMapViewerPlotsFeatureCollection(
    [plot as never],
    [{ id: 'farm', name: 'Farm', mapColor: '#71A780' } as never]
  ).features[0];
  assert.equal(feature.properties?.fill, '#71A780');
  assert.equal(feature.properties?.stroke, '#4B6E54');
  assert.equal(feature.properties?.imported_fill, '#FFFFFF');
  assert.equal(feature.properties?.imported_stroke, '#000000');
});
