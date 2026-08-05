import { parentPort } from 'node:worker_threads';

import { parseKml } from './kml-parser';

if (!parentPort) throw new Error('KML parser worker requires a parent port');

parentPort.once('message', (input: Uint8Array) => {
  try {
    parentPort!.postMessage({ ok: true, result: parseKml(Buffer.from(input)) });
  } catch (error) {
    parentPort!.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : 'Falha ao processar KML',
    });
  }
});
