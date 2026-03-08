import Mapbox, {
  MapView,
  Camera,
  FillLayer,
  ShapeSource,
  SymbolLayer,
  LineLayer,
} from '@rnmapbox/maps';
import { useRef, useEffect, useMemo } from 'react';
import { UserTrackingMode } from '@rnmapbox/maps';
import {
  createFillColorExpression,
  createFillOpacityExpression,
  createStrokeColorExpression,
} from '@/utils/map-utils';
import * as turf from '@turf/turf';
import { usePathname } from 'expo-router';

import { MapToolsHookReturn } from '@/components/Map/MapTools';
import { FeatureCollection } from 'geojson';

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '');

export type MapContentProps = {
  geoData?: GeoJSON.FeatureCollection;
  geoDataRoute?: GeoJSON.FeatureCollection | null;
  showGeoDataRoute?: boolean;
  navigationRoute?: GeoJSON.FeatureCollection | null;
  showNavigationRoute?: boolean;
  selectedPlotId?: string;
  onPlotPress?: (plotId: string) => void;
  mapTools?: boolean;
  isCameraLockedOnUserLocation?: boolean;
  setIsCameraLockedOnUserLocation?: (isCameraLockedOnUserLocation: boolean) => void;
  moveCameraToGeodataBbox: number;
  plotForCameraMovingToIstBbbox: FeatureCollection | null;
  mapToolsHookReturn: MapToolsHookReturn;
  isNavigationMode?: boolean;
};

export default function MapContent({
  geoData,
  geoDataRoute,
  showGeoDataRoute = true,
  navigationRoute,
  showNavigationRoute = true,
  selectedPlotId,
  onPlotPress,
  mapTools = true,
  isCameraLockedOnUserLocation,
  setIsCameraLockedOnUserLocation,
  moveCameraToGeodataBbox,
  plotForCameraMovingToIstBbbox,
  mapToolsHookReturn,
  isNavigationMode = false,
}: MapContentProps) {
  const isMapFullScreen = usePathname().split('/')[2] === 'map';

  const mapRef = useRef<MapView>(null!);

  const cameraRef = useRef<Camera>(null!);

  const isDraggingSomePoint = mapToolsHookReturn.draggedPointIndex !== null;

  // GEODATA BBOX
  const geodataBBox = useMemo(() => {
    if (geoData && geoData.features.length > 0) {
      const bbox = turf.bbox(geoData);
      const bounds: [[number, number], [number, number]] = [
        [bbox[0], bbox[1]],
        [bbox[2], bbox[3]],
      ];
      return bounds;
    }
  }, [geoData]);

  const handleMoveCameraToGeodataBbox = () => {
    if (!geodataBBox || !cameraRef.current) {
      return;
    }

    cameraRef.current.setCamera({
      bounds: {
        ne: geodataBBox[1],
        sw: geodataBBox[0],
      },
      padding: {
        paddingTop: 50,
        paddingRight: 50,
        paddingBottom: 50,
        paddingLeft: 50,
      },
      animationDuration: 1500,
    });
  };

  useEffect(() => {
    handleMoveCameraToGeodataBbox();
  }, [moveCameraToGeodataBbox]);

  // PLOT BBOX
  const plotBBox = useMemo(() => {
    if (plotForCameraMovingToIstBbbox && plotForCameraMovingToIstBbbox.features.length > 0) {
      const bbox = turf.bbox(plotForCameraMovingToIstBbbox);
      const bounds: [[number, number], [number, number]] = [
        [bbox[0], bbox[1]],
        [bbox[2], bbox[3]],
      ];
      return bounds;
    }
  }, [plotForCameraMovingToIstBbbox]);

  const handleMoveCameraToPlotBbox = () => {
    if (!plotBBox || !cameraRef.current) {
      return;
    }

    cameraRef.current.setCamera({
      bounds: {
        ne: plotBBox[1],
        sw: plotBBox[0],
      },
      padding: {
        paddingTop: 50,
        paddingRight: 50,
        paddingBottom: 50,
        paddingLeft: 50,
      },
      animationDuration: 1500,
    });
  };

  useEffect(() => {
    handleMoveCameraToPlotBbox();
  }, [plotForCameraMovingToIstBbbox]);

  const handleMapPress = (event: any) => {
    const coordinates = event?.geometry?.coordinates || event?.coordinates;

    if (mapToolsHookReturn.isSomeToolActive) {
      mapToolsHookReturn.handleMapPress(coordinates);
      return;
    }

    if (onPlotPress) {
      if (event.features && event.features.length > 0) {
        const plotFeature = event.features[0];
        if (plotFeature?.properties?.plot_id) {
          onPlotPress(plotFeature.properties.plot_id);
        }
      }
    }
  };

  useEffect(() => {
    if (isCameraLockedOnUserLocation && cameraRef.current) {
      cameraRef.current.setCamera({
        zoomLevel: 15,
      });
    }
  }, [isCameraLockedOnUserLocation]);

  const handleTouchMove = (event: any) => {
    if (isCameraLockedOnUserLocation && !isNavigationMode) {
      setIsCameraLockedOnUserLocation?.(false);
      return;
    }
    if (!isNavigationMode) {
      mapToolsHookReturn.handleTouchMove(event, mapRef);
    }
  };

  const handleTouchEnd = () => {
    mapToolsHookReturn.handleTouchEnd();
  };

  return (
    <MapView
      ref={mapRef}
      style={{ height: '100%', width: '100%' }}
      attributionEnabled={false}
      logoEnabled={false}
      scaleBarEnabled={false}
      projection='globe'
      compassEnabled={true}
      compassFadeWhenNorth={true}
      compassPosition={{ top: isMapFullScreen ? 70 : 8, right: 8 }}
      styleURL='mapbox://styles/mapbox/satellite-streets-v12'
      onPress={handleMapPress}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      scrollEnabled={!isDraggingSomePoint && !isNavigationMode}
      zoomEnabled={!isDraggingSomePoint && !isNavigationMode}
      pitchEnabled={!isDraggingSomePoint && !isNavigationMode}
      rotateEnabled={!isDraggingSomePoint && !isNavigationMode}
      onDidFinishLoadingStyle={() => {
        if (!geoData || mapToolsHookReturn.isSomeToolActive) return;
        handleMoveCameraToGeodataBbox();
      }}
    >
      <Camera
        ref={cameraRef}
        followUserLocation={isCameraLockedOnUserLocation}
        followUserMode={
          isNavigationMode ? UserTrackingMode.FollowWithHeading : UserTrackingMode.Follow
        }
        followZoomLevel={isNavigationMode ? 16 : 12}
        followPitch={isNavigationMode ? 60 : 0}
        followHeading={isNavigationMode ? 0 : undefined}
      />

      <Mapbox.UserLocation
        visible={true}
        showsUserHeadingIndicator={true}
        requestsAlwaysUse={true}
      />

      <ShapeSource
        id='non-selected-plots'
        shape={{
          type: 'FeatureCollection',
          features:
            geoData?.features?.filter(
              (feature) => feature.properties?.plot_id !== selectedPlotId
            ) || [],
        }}
        onPress={mapToolsHookReturn.isSomeToolActive ? undefined : handleMapPress}
      >
        <FillLayer
          id='non-selected-fill'
          style={{
            fillColor: createFillColorExpression(),
            fillOpacity: createFillOpacityExpression(),
            fillOutlineColor: createStrokeColorExpression(),
          }}
        />
        <SymbolLayer
          id='non-selected-labels'
          style={{
            textField: ['concat', ['get', 'plot_name'], '\n', ['get', 'hectare'], ' ha'],
            textSize: 12,
            textColor: '#FFFFFF',
            textHaloColor: '#000000',
            textHaloWidth: 2,
            textAnchor: 'center',
            textJustify: 'center',
          }}
        />
      </ShapeSource>
      <ShapeSource
        id='selected-plot'
        shape={{
          type: 'FeatureCollection',
          features:
            geoData?.features?.filter(
              (feature) => feature.properties?.plot_id === selectedPlotId
            ) || [],
        }}
        onPress={mapToolsHookReturn.isSomeToolActive ? undefined : handleMapPress}
      >
        <FillLayer
          id='selected-fill'
          style={{
            fillColor: '#EAAE07',
            fillOpacity: 0.7,
            fillOutlineColor: '#EAAE07',
          }}
        />
        <SymbolLayer
          id='selected-labels'
          style={{
            textField: ['concat', ['get', 'plot_name'], '\n', ['get', 'hectare'], ' ha'],
            textSize: 14,
            textColor: '#000000',
            textHaloColor: '#FFFFFF',
            textHaloWidth: 2,
            textAnchor: 'center',
            textJustify: 'center',
          }}
        />
      </ShapeSource>
      {showGeoDataRoute && geoDataRoute && (
        <ShapeSource id='routes' shape={geoDataRoute}>
          <LineLayer
            id='routes-line'
            style={{
              lineColor: '#FF6B6B',
              lineWidth: 3,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        </ShapeSource>
      )}
      {showNavigationRoute && navigationRoute && (
        <ShapeSource id='navigation-route' shape={navigationRoute}>
          <LineLayer
            id='navigation-route-line'
            style={{
              lineColor: '#4A90E2',
              lineWidth: 4,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        </ShapeSource>
      )}
      {mapTools && mapToolsHookReturn.getToolLayers()}
    </MapView>
  );
}
