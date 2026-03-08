import type { GeoJSON } from 'geojson';
import Map from 'react-map-gl/mapbox';

import MapContent from '@/components/MapContent';

import 'mapbox-gl/dist/mapbox-gl.css';

export type MapViewerProps = {
  geoData: GeoJSON | undefined;
  layerNameToHighlight?: string | string[];
  onPlotClick?: (plotLayerName: string) => void;
};

export default function MapViewer({ geoData, layerNameToHighlight, onPlotClick }: MapViewerProps) {
  return (
    <Map
      logoPosition='bottom-right'
      attributionControl={false}
      cursor='default'
      mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}
      style={{ width: '100%', height: '100%' }}
      mapStyle='mapbox://styles/mapbox/satellite-streets-v12'
    >
      <MapContent
        geoData={geoData}
        layerNameToHighlight={layerNameToHighlight}
        onPlotClick={onPlotClick}
      />
    </Map>
  );
}
