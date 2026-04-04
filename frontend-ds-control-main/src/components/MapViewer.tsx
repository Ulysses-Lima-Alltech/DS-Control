import type { GeoJSON } from 'geojson';
import { useEffect } from 'react';
import Map from 'react-map-gl/mapbox';

import MapContent from '@/components/MapContent';

import 'mapbox-gl/dist/mapbox-gl.css';

export type MapViewerProps = {
  geoData: GeoJSON | undefined;
  layerNameToHighlight?: string | string[];
  onPlotClick?: (plotLayerName: string) => void;
};

/** Diagnóstico temporário [MAP_DEBUG] — remover após identificar causa em produção */
function summarizeGeoDataForDebug(geoData: GeoJSON | undefined) {
  if (geoData === undefined || geoData === null) {
    return {
      hasGeoData: false as const,
      typeofGeoData: String(geoData),
      hasFeaturesKey: false,
      featuresLength: undefined as number | undefined,
      hasGeometryKey: false,
      geometryType: undefined as string | undefined,
      firstFeatureGeometryType: undefined as string | undefined,
    };
  }

  const g = geoData as unknown as Record<string, unknown>;
  const hasFeaturesKey = 'features' in g;
  const featuresLength =
    hasFeaturesKey && Array.isArray(g.features) ? g.features.length : undefined;
  let hasGeometryKey = false;
  let geometryType: string | undefined;
  if ('geometry' in g && g.geometry && typeof g.geometry === 'object' && g.geometry !== null) {
    const geom = g.geometry as { type?: string };
    hasGeometryKey = 'type' in geom;
    geometryType = geom.type;
  }
  let firstFeatureGeometryType: string | undefined;
  if (hasFeaturesKey && Array.isArray(g.features) && g.features.length > 0) {
    const f0 = g.features[0] as { geometry?: { type?: string } } | undefined;
    if (f0?.geometry?.type) {
      firstFeatureGeometryType = f0.geometry.type;
    }
  }

  return {
    hasGeoData: true as const,
    typeofGeoData: typeof geoData,
    hasFeaturesKey,
    featuresLength,
    hasGeometryKey,
    geometryType,
    firstFeatureGeometryType,
  };
}

export default function MapViewer({ geoData, layerNameToHighlight, onPlotClick }: MapViewerProps) {
  // TESTE TEMPORÁRIO — apenas para diagnosticar env/build do Amplify (NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN). Reverter antes de merge/produção.
  // const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '';
  const token = 'pk.eyJ1IjoiYW50b25pb3Zpbmk0NyIsImEiOiJjbWJoNW9wM2swNmlyMmlvbGlmb3J6NW4xIn0.wKznYpMm2m5Z0Opjjkpa-Q';

  const geoSummary = summarizeGeoDataForDebug(geoData);
  const tokenPresent = Boolean(token && String(token).trim() !== '');
  const earlyReturnNoMap = !tokenPresent;

  useEffect(() => {
    console.log('[MAP_DEBUG] MapViewer render', {
      tokenPresent,
      earlyReturnNoMap: !tokenPresent,
      geoSummary: summarizeGeoDataForDebug(geoData),
    });
  }, [tokenPresent, geoData]);

  return (
    <div className='flex h-full min-h-[200px] w-full flex-col gap-1 overflow-hidden rounded-md border-2 border-amber-600 bg-amber-50 p-2 text-left text-xs dark:border-amber-500 dark:bg-amber-950/50'>
      <div
        className='shrink-0 space-y-1 font-mono text-amber-950 dark:text-amber-100'
        data-map-debug='panel'
      >
        <div className='font-bold text-amber-900 dark:text-amber-50'>[MAP_DEBUG] MapViewer</div>
        <div>
          <strong>NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN:</strong>{' '}
          {tokenPresent ? 'presente' : 'ausente'}
        </div>
        {!tokenPresent ? (
          <div className='font-bold text-red-700 dark:text-red-400'>MAP_DEBUG: token ausente</div>
        ) : null}
        {!geoSummary.hasGeoData ? (
          <div className='font-bold text-red-700 dark:text-red-400'>MAP_DEBUG: geoData ausente</div>
        ) : null}
        {geoSummary.hasGeoData ? (
          <>
            <div>
              <strong>typeof geoData:</strong> {geoSummary.typeofGeoData}
            </div>
            <div>
              <strong>geoData.features:</strong> {geoSummary.hasFeaturesKey ? 'sim' : 'não'}
              {geoSummary.featuresLength !== undefined
                ? ` (length: ${geoSummary.featuresLength})`
                : ''}
            </div>
            <div>
              <strong>geoData.geometry:</strong> {geoSummary.hasGeometryKey ? 'sim' : 'não'}
              {geoSummary.geometryType ? ` (type: ${geoSummary.geometryType})` : ''}
            </div>
            {geoSummary.firstFeatureGeometryType ? (
              <div>
                <strong>features[0].geometry.type:</strong> {geoSummary.firstFeatureGeometryType}
              </div>
            ) : null}
          </>
        ) : null}
        <div>
          <strong>Early return (Map não monta):</strong>{' '}
          {earlyReturnNoMap ? 'SIM — token ausente' : 'NÃO — Map deve montar'}
        </div>
      </div>

      <div className='relative min-h-0 flex-1 overflow-hidden rounded border border-muted bg-background'>
        {tokenPresent ? (
          <Map
            logoPosition='bottom-right'
            attributionControl={false}
            cursor='default'
            mapboxAccessToken={token as string}
            style={{ width: '100%', height: '100%' }}
            mapStyle='mapbox://styles/mapbox/satellite-streets-v12'
          >
            <MapContent
              geoData={geoData}
              layerNameToHighlight={layerNameToHighlight}
              onPlotClick={onPlotClick}
            />
          </Map>
        ) : (
          <div className='flex h-full min-h-[120px] w-full items-center justify-center p-3 text-center text-sm text-muted-foreground'>
            <div>
              <p className='font-semibold text-foreground'>Mapa não montado</p>
              <p className='mt-1'>
                Early return ativo: sem token o componente &lt;Map&gt; não renderiza — nenhum pedido
                ao Mapbox.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
