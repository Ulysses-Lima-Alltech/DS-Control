import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { fetchRemoteImageAsDataUrl } from './fetchRemoteImageAsDataUrl';

const originalFetch = globalThis.fetch;
const originalWarn = console.warn;

afterEach(() => {
  globalThis.fetch = originalFetch;
  console.warn = originalWarn;
});

for (const status of [401, 403]) {
  test(`remote report image handles HTTP ${status} without logging its token`, async () => {
    const token = 'secret-query-value';
    globalThis.fetch = async () => new Response(null, { status });
    const calls: unknown[][] = [];
    console.warn = (...args: unknown[]) => calls.push(args);

    const result = await fetchRemoteImageAsDataUrl(
      `https://api.mapbox.com/static/a?access_token=${token}`,
      { retries: 1 }
    );

    assert.equal(result, null);
    assert.equal(JSON.stringify(calls).includes(token), false);
    assert.equal(JSON.stringify(calls).includes(String(status)), true);
  });
}

test('remote report image aborts after its timeout', async () => {
  globalThis.fetch = (_url, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    });
  console.warn = () => undefined;

  const result = await fetchRemoteImageAsDataUrl(
    'https://api.mapbox.com/static/a?access_token=hidden',
    { timeoutMs: 5 }
  );
  assert.equal(result, null);
});
