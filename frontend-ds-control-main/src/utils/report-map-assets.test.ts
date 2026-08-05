import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import type { Plot } from '@/types/plot.type';

import { buildReportMapAssets, REPORT_MAP_POLICY } from './report-map-assets';

const originalFetch = globalThis.fetch;
const originalFileReader = globalThis.FileReader;

afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.FileReader = originalFileReader;
});

const polygonPlot = (id: string, farmId = 'farm-a'): Plot => ({
  id,
  farmId,
  name: `Talhão ${id}`,
  externalId: id,
  hectare: '12.5',
  geoJson: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [[[-47.01, -15.01], [-47, -15.01], [-47, -15], [-47.01, -15], [-47.01, -15.01]]],
        },
      },
    ],
  },
});

test('report maps deduplicate by plot and keep the persisted farm color', async () => {
  const plot = polygonPlot('plot-a');
  const result = await buildReportMapAssets(
    [
      { plot, farm: { id: 'farm-a', mapColor: '#71a780' } },
      { plot, farm: { id: 'farm-a', mapColor: '#71a780' } },
    ],
    { accessToken: '' }
  );

  assert.deepEqual(
    { requested: result.stats.requested, distinct: result.stats.distinctPlots, vector: result.stats.vectorOnly },
    { requested: 2, distinct: 1, vector: 1 }
  );
  assert.equal(result.assets[0].fillColor, '#71A780');
  assert.equal(result.assets[0].status, 'vector-only');
  assert.ok(result.assets[0].vectorPathD);
});

test('report maps use Mapbox when the base image succeeds', async () => {
  installFileReader();
  globalThis.fetch = async () => new Response(new Blob(['png'], { type: 'image/png' }), { status: 200 });
  const result = await buildReportMapAssets([{ plot: polygonPlot('plot-map') }], {
    accessToken: 'controlled-test-token',
  });

  assert.equal(result.assets[0].status, 'mapbox');
  assert.match(result.assets[0].imageDataUrl || '', /^data:image\/png;base64,/);
});

test('report maps keep the vector when the base image fails', async () => {
  globalThis.fetch = async () => new Response(null, { status: 403 });
  const result = await buildReportMapAssets([{ plot: polygonPlot('plot-fallback') }], {
    accessToken: 'controlled-test-token',
  });

  assert.equal(result.assets[0].status, 'vector-only');
  assert.equal(result.assets[0].message, 'Mapa base indisponível — limite do talhão exibido.');
  assert.equal(result.assets[0].errorCode, 'mapbox_fetch_failed');
});

test('invalid geometry does not cancel other report maps', async () => {
  const invalid = { ...polygonPlot('plot-invalid'), geoJson: undefined } as unknown as Plot;
  const result = await buildReportMapAssets(
    [{ plot: invalid }, { plot: polygonPlot('plot-valid') }],
    { accessToken: '' }
  );

  assert.equal(result.stats.distinctPlots, 2);
  assert.equal(result.stats.vectorOnly, 1);
  assert.equal(result.stats.unavailable, 1);
  assert.equal(result.byPlotId['plot-invalid'].errorCode, 'geometry_unavailable');
});

test('report maps respect configured concurrency', async () => {
  installFileReader();
  let active = 0;
  let maximum = 0;
  globalThis.fetch = async () => {
    active += 1;
    maximum = Math.max(maximum, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
    return new Response(new Blob(['png'], { type: 'image/png' }), { status: 200 });
  };

  await buildReportMapAssets(
    Array.from({ length: 6 }, (_, index) => ({ plot: polygonPlot(`plot-${index}`) })),
    { accessToken: 'controlled-test-token', concurrency: 2 }
  );
  assert.equal(maximum, 2);
});

test('report maps support MultiPolygon geometry', async () => {
  const plot = polygonPlot('plot-multi');
  plot.geoJson.features[0].geometry = {
    type: 'MultiPolygon',
    coordinates: [
      [[[-47.01, -15.01], [-47, -15.01], [-47, -15], [-47.01, -15], [-47.01, -15.01]]],
    ],
  };
  const result = await buildReportMapAssets([{ plot }], { accessToken: '' });
  assert.equal(result.assets[0].status, 'vector-only');
});

test('large report batches keep every distinct plot without maps in pilot or assistant policy', async () => {
  const result = await buildReportMapAssets(
    Array.from({ length: 120 }, (_, index) => ({ plot: polygonPlot(`large-${index}`) })),
    { accessToken: '', concurrency: 4 }
  );
  assert.equal(result.stats.distinctPlots, 120);
  assert.equal(result.assets.length, 120);
  assert.equal(REPORT_MAP_POLICY.pilot, false);
  assert.equal(REPORT_MAP_POLICY.assistant, false);
});

function installFileReader() {
  class TestFileReader {
    result: string | ArrayBuffer | null = null;
    error: DOMException | null = null;
    onloadend: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;
    onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;

    readAsDataURL(blob: Blob) {
      void blob.arrayBuffer().then((buffer) => {
        this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString('base64')}`;
        this.onloadend?.call(this as unknown as FileReader, {} as ProgressEvent<FileReader>);
      });
    }
  }
  globalThis.FileReader = TestFileReader as unknown as typeof FileReader;
}
