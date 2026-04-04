import type { GeoJSON, Geometry, Position } from 'geojson';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useEffect, useState } from 'react';
import { Layer, Source, useMap } from 'react-map-gl/mapbox';
import { toast } from 'sonner';

import MapTooltip from '@/components/MapTooltip';
import {
  createHoverPlotFillColorPaintExpression,
  createHoverPlotFillOpacityPaintExpression,
  createHoverPlotStrokeColorPaintExpression,
  createPlotFillColorPaintExpression,
  createPlotFillOpacityPaintExpression,
  createPlotStrokeColorPaintExpression,
} from '@/utils/map-utils';

export type MapContentProps = {
  geoData: GeoJSON | undefined;
  layerNameToHighlight?: string | string[];
  onPlotClick?: (plotLayerName: string) => void;
  animationDuration?: number;
};

export default function MapContent({
  geoData,
  layerNameToHighlight,
  onPlotClick,
  animationDuration = 2000,
}: MapContentProps) {
  const { current: map } = useMap();
  const [tooltipData, setTooltipData] = useState<{
    show: boolean;
    x: number;
    y: number;
    content: string;
  }>({
    show: false,
    x: 0,
    y: 0,
    content: '',
  });
  const [hoveredPolygonId, setHoveredPolygonId] = useState<string | null>(null);

  const layerNamesToHighlight = Array.isArray(layerNameToHighlight)
    ? layerNameToHighlight
    : layerNameToHighlight
      ? [layerNameToHighlight]
      : [];

  const isLineStringData =
    geoData &&
    'features' in geoData &&
    geoData.features.length > 0 &&
    (geoData.features[0].geometry?.type === 'LineString' ||
      geoData.features[0].geometry?.type === 'MultiLineString');

  useEffect(() => {
    if (!geoData && map) {
      map.flyTo({
        zoom: 2,
      });
    }
  }, [geoData, map]);

  useEffect(() => {
    if (geoData && map) {
      const bounds = new mapboxgl.LngLatBounds();

      const processCoordinates = (coords: Position) => {
        if (coords.length >= 2) {
          bounds.extend([coords[0], coords[1]]);
        }
      };

      const processGeometry = (geometry: Geometry) => {
        if (geometry.type === 'Point') {
          processCoordinates(geometry.coordinates);
        } else if (geometry.type === 'LineString') {
          geometry.coordinates.forEach(processCoordinates);
        } else if (geometry.type === 'MultiLineString') {
          geometry.coordinates.forEach((line: Position[]) => {
            line.forEach(processCoordinates);
          });
        } else if (geometry.type === 'Polygon') {
          geometry.coordinates[0].forEach(processCoordinates);
        } else if (geometry.type === 'MultiPolygon') {
          geometry.coordinates.forEach((polygon: Position[][]) => {
            polygon[0].forEach(processCoordinates);
          });
        }
      };

      if ('features' in geoData) {
        geoData.features.forEach((feature) => {
          if (feature.geometry) {
            processGeometry(feature.geometry);
          }
        });
      } else if ('geometry' in geoData) {
        processGeometry(geoData.geometry);
      }

      const padding = { top: 50, bottom: 50, left: 50, right: 50 };

      try {
        if (!bounds.isEmpty()) {
          map.fitBounds(bounds, {
            padding,
            duration: animationDuration,
            essential: true,
          });
        }
      } catch (error) {
        toast('Erro ao carregar mapa', {
          description: error instanceof Error ? error.message : 'Erro desconhecido',
        });
        console.error(error);
      }
    }
  }, [geoData, map]);

  useEffect(() => {
    if (!map || !geoData || isLineStringData) return;

    const mapInstance = map.getMap();

    const checkLayerAndSetup = () => {
      const layer = mapInstance.getLayer('uploaded-layer');

      if (layer) {
        const isHighlighted =
          layerNamesToHighlight.length > 0
            ? ['in', ['get', 'plot_name'], ['literal', layerNamesToHighlight]]
            : false;

        mapInstance.setPaintProperty(
          'uploaded-layer',
          'fill-color',
          createPlotFillColorPaintExpression(isHighlighted)
        );
        mapInstance.setPaintProperty(
          'uploaded-layer',
          'fill-opacity',
          createPlotFillOpacityPaintExpression(isHighlighted)
        );
        mapInstance.setPaintProperty(
          'uploaded-layer',
          'fill-outline-color',
          createPlotStrokeColorPaintExpression(isHighlighted)
        );
      } else {
        setTimeout(checkLayerAndSetup, 100);
      }
    };

    checkLayerAndSetup();
  }, [map, geoData, layerNamesToHighlight, isLineStringData]);

  useEffect(() => {
    if (!map || !geoData) return;

    const mapInstance = map.getMap();

    const handleMouseMove = (e: mapboxgl.MapMouseEvent) => {
      const layer = mapInstance.getLayer('uploaded-layer');
      if (!layer) return;

      const features = mapInstance.queryRenderedFeatures(e.point, {
        layers: ['uploaded-layer'],
      });

      if (features && features.length > 0) {
        const feature = features[0];
        const properties = feature.properties || {};

        let content: string = '';
        let polygonId: string | null = null;

        if ('plot_name' in properties) {
          const farmName = properties.farm_name || 'Fazenda desconhecida';
          content = `Fazenda: ${farmName}
Nome: ${properties.plot_name}
Hectares: ${properties.hectare} ha`;
          polygonId = properties.plot_name as string;
        } else if ('name' in properties) {
          content = `Rota: ${properties.name}`;
          polygonId = properties.name as string;
        }

        setTooltipData({
          show: true,
          x: e.point.x,
          y: e.point.y,
          content,
        });

        setHoveredPolygonId(polygonId);
      } else {
        setTooltipData((prev) => ({ ...prev, show: false }));
        setHoveredPolygonId(null);
      }
    };

    const handleMouseLeave = () => {
      setTooltipData((prev) => ({ ...prev, show: false }));
      setHoveredPolygonId(null);
    };

    const handleClick = (e: mapboxgl.MapMouseEvent) => {
      const layer = mapInstance.getLayer('uploaded-layer');
      if (!layer) return;

      const features = mapInstance.queryRenderedFeatures(e.point, {
        layers: ['uploaded-layer'],
      });

      if (features && features.length > 0) {
        const feature = features[0];
        const properties = feature.properties || {};

        if ('plot_name' in properties) {
          onPlotClick?.(properties.plot_name);
        } else if ('name' in properties) {
          onPlotClick?.(properties.name);
        }
      }
    };

    const setupEventHandlers = () => {
      const layer = mapInstance.getLayer('uploaded-layer');

      if (layer) {
        mapInstance.on('mousemove', handleMouseMove);
        mapInstance.on('mouseleave', handleMouseLeave);
        mapInstance.on('click', handleClick);
      } else {
        setTimeout(setupEventHandlers, 100);
      }
    };

    setupEventHandlers();

    return () => {
      mapInstance.off('mousemove', handleMouseMove);
      mapInstance.off('mouseleave', handleMouseLeave);
      mapInstance.off('click', handleClick);
    };
  }, [map, geoData, onPlotClick]);

  useEffect(() => {
    if (!map || isLineStringData) return;

    const mapInstance = map.getMap();
    const layer = mapInstance.getLayer('uploaded-layer');
    if (layer) {
      const isHighlighted =
        layerNamesToHighlight.length > 0
          ? ['in', ['get', 'plot_name'], ['literal', layerNamesToHighlight]]
          : false;

      if (hoveredPolygonId) {
        mapInstance.setPaintProperty(
          'uploaded-layer',
          'fill-color',
          createHoverPlotFillColorPaintExpression(hoveredPolygonId, isHighlighted)
        );
        mapInstance.setPaintProperty(
          'uploaded-layer',
          'fill-opacity',
          createHoverPlotFillOpacityPaintExpression(hoveredPolygonId, isHighlighted)
        );
        mapInstance.setPaintProperty(
          'uploaded-layer',
          'fill-outline-color',
          createHoverPlotStrokeColorPaintExpression(hoveredPolygonId, isHighlighted)
        );
      } else {
        mapInstance.setPaintProperty(
          'uploaded-layer',
          'fill-color',
          createPlotFillColorPaintExpression(isHighlighted)
        );
        mapInstance.setPaintProperty(
          'uploaded-layer',
          'fill-opacity',
          createPlotFillOpacityPaintExpression(isHighlighted)
        );
        mapInstance.setPaintProperty(
          'uploaded-layer',
          'fill-outline-color',
          createPlotStrokeColorPaintExpression(isHighlighted)
        );
      }
    }
  }, [hoveredPolygonId, layerNamesToHighlight, map, isLineStringData]);

  const isHighlighted =
    layerNamesToHighlight.length > 0
      ? ['in', ['get', 'plot_name'], ['literal', layerNamesToHighlight]]
      : false;

  return (
    <>
      {geoData && !isLineStringData ? (
        <Source id='uploaded-source' type='geojson' data={geoData}>
          <Layer
            id='uploaded-layer'
            type='fill'
            paint={{
              'fill-color': createPlotFillColorPaintExpression(isHighlighted),
              'fill-opacity': createPlotFillOpacityPaintExpression(isHighlighted),
              'fill-outline-color': createPlotStrokeColorPaintExpression(isHighlighted),
            }}
          />
          <Layer
            minzoom={14}
            id='uploaded-layer-labels'
            type='symbol'
            layout={{
              'text-field': ['coalesce', ['get', 'name'], ['get', 'plot_name']],
              'text-size': 12,
              'text-anchor': 'center',
              'text-allow-overlap': true,
              'text-ignore-placement': true,
            }}
            paint={{
              'text-color': 'white',
              'text-halo-color': 'black',
              'text-halo-width': 1,
            }}
          />
        </Source>
      ) : null}

      {geoData && isLineStringData ? (
        <Source id='uploaded-source' type='geojson' data={geoData}>
          <Layer
            id='uploaded-layer'
            type='line'
            paint={{
              'line-color': ['coalesce', ['get', 'stroke'], '#0080ff'],
              'line-width': 4,
              'line-opacity': 0.8,
            }}
          />
          <Layer
            id='uploaded-layer-labels'
            type='symbol'
            layout={{
              'text-field': ['coalesce', ['get', 'name'], ['get', 'plot_name']],
              'text-size': 12,
              'text-anchor': 'center',
              'text-allow-overlap': true,
              'text-ignore-placement': true,
              'symbol-placement': 'line',
            }}
            paint={{
              'text-color': 'white',
              'text-halo-color': 'black',
              'text-halo-width': 1,
            }}
          />
        </Source>
      ) : null}

      <MapTooltip tooltipData={tooltipData} />
    </>
  );
}
