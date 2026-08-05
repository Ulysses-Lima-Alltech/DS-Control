import path from 'node:path';
import { Worker } from 'node:worker_threads';

import { KML_LIMITS, KmlValidationError, type KmlParseResult } from './kml-parser';

type WorkerResponse =
  | { ok: true; result: KmlParseResult }
  | { ok: false; error: string };

export function parseKmlWithTimeout(
  input: Buffer,
  timeoutMilliseconds = KML_LIMITS.maxParseMilliseconds + 1_000,
): Promise<KmlParseResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'kml-parser.worker.js'), {
      resourceLimits: {
        maxOldGenerationSizeMb: 64,
        maxYoungGenerationSizeMb: 16,
        stackSizeMb: 2,
      },
    });
    let settled = false;

    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      callback();
    };

    const timer = setTimeout(() => {
      finish(() => reject(new KmlValidationError('Tempo limite de parsing excedido')));
    }, timeoutMilliseconds);

    worker.once('message', (message: WorkerResponse) => {
      finish(() => {
        if (message.ok) resolve(message.result);
        else reject(new KmlValidationError(message.error));
      });
    });
    worker.once('error', () => {
      finish(() => reject(new KmlValidationError('Falha isolada ao processar KML')));
    });
    worker.once('exit', (code) => {
      if (code !== 0) {
        finish(() => reject(new KmlValidationError('Worker de KML encerrado antes da conclusão')));
      }
    });

    worker.postMessage(input);
  });
}
