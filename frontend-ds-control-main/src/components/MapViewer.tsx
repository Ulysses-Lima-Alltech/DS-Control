import type { GeoJSON } from 'geojson';
import Map from 'react-map-gl/mapbox';

import MapContent from '@/components/MapContent';

import 'mapbox-gl/dist/mapbox-gl.css';

export type MapViewerProps = {
  geoData: GeoJSON | undefined;
  layerNameToHighlight?: string | string[];
  layerPlotIdsToHighlight?: string[];
  onPlotClick?: (plotId: string) => void;
};

export default function MapViewer({
  geoData,
  layerNameToHighlight,
  layerPlotIdsToHighlight,
  onPlotClick,
}: MapViewerProps) {
  // Temporário: token fixo no código até corrigir NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN no build do Amplify.
  // const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '';
  const token =
    'pk.eyJ1IjoiYW50b25pb3Zpbmk0NyIsImEiOiJjbWJoNW9wM2swNmlyMmlvbGlmb3J6NW4xIn0.wKznYpMm2m5Z0Opjjkpa-Q';

  return (
    <Map
      logoPosition='bottom-right'
      attributionControl={false}
      cursor='default'
      mapboxAccessToken={token}
      style={{ width: '100%', height: '100%' }}
      mapStyle='mapbox://styles/mapbox/satellite-streets-v12'
    >
      <MapContent
        geoData={geoData}
        layerNameToHighlight={layerNameToHighlight}
        layerPlotIdsToHighlight={layerPlotIdsToHighlight}
        onPlotClick={onPlotClick}
      />
    </Map>
  );
}
