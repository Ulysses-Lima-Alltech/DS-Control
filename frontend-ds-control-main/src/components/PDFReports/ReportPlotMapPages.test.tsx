import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { test } from 'node:test';

import { Document, pdf } from '@react-pdf/renderer';
import React from 'react';

import type { Plot } from '@/types/plot.type';
import type { ReportMapAsset } from '@/utils/report-map-assets';

import { ReportPlotMapPages } from './ReportPlotMapPages';

test('renders a multi-page vector report without a Mapbox base', async () => {
  const sections = Array.from({ length: 12 }, (_, index) => {
    const plot = buildPlot(`plot-${index}`);
    const asset: ReportMapAsset = {
      plotId: plot.id!,
      farmId: plot.farmId,
      plot,
      overlayPathDs: [],
      vectorPathD: 'M 160 80 L 1120 80 L 1080 400 L 220 390 Z',
      fillColor: '#34D399',
      strokeColor: '#226F65',
      status: 'vector-only',
      message: 'Mapa base indisponível — limite do talhão exibido.',
    };
    return { asset, customerName: 'Cliente de teste', farmName: 'Fazenda de teste' };
  });

  const document = (
    <Document>
      <ReportPlotMapPages
        sections={sections}
        generatedAt='05/08/2026 12:00'
        title='Validação visual de mapas'
      />
    </Document>
  );
  const blob = await pdf(document).toBlob();
  assert.ok(blob.size > 5_000);

  const visualPath = process.env.REPORT_MAP_VISUAL_PATH;
  if (visualPath) {
    await writeFile(visualPath, Buffer.from(await blob.arrayBuffer()));
  }
});

function buildPlot(id: string): Plot {
  return {
    id,
    farmId: 'farm-test',
    name: `Talhão ${id}`,
    externalId: id,
    hectare: '12.50',
    geoJson: { type: 'FeatureCollection', features: [] },
  };
}
