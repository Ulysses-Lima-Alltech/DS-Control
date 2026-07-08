import Mapbox, {
  Camera,
  CircleLayer,
  FillLayer,
  LineLayer,
  MapView,
  ShapeSource,
  SymbolLayer,
  UserTrackingMode,
} from '@rnmapbox/maps';
import * as turf from '@turf/turf';
import { usePathname } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';

import { MapToolsHookReturn } from '@/components/Map/MapTools';
import { COLORS } from '@/constants/colors';
import {
  createFillColorExpression,
  createFillOpacityExpression,
  createStrokeColorExpression,
} from '@/utils/map-utils';

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '');

export type MapContentProps = {
  geoData?: GeoJSON.FeatureCollection;
  geoDataRoute?: GeoJSON.FeatureCollection | null;
  showGeoDataRoute?: boolean;
  navigationRoute?: GeoJSON.FeatureCollection | null;
  operationalRouteMarkers?: GeoJSON.FeatureCollection<GeoJSON.Point> | null;
  selectedRouteId?: string | null;
  showNavigationRoute?: boolean;
  selectedPlotId?: string;
  onPlotPress?: (plotId: string) => void;
  onRoutePress?: (routeId: string) => void;
  mapTools?: boolean;
  isCameraLockedOnUserLocation?: boolean;
  setIsCameraLockedOnUserLocation?: (isCameraLockedOnUserLocation: boolean) => void;
  moveCameraToGeodataBbox: number;
  plotForCameraMovingToIstBbbox: GeoJSON.FeatureCollection | null;
  mapToolsHookReturn: MapToolsHookReturn;
  isNavigationMode?: boolean;
};

export default function MapContent({
  geoData,
  geoDataRoute,
  showGeoDataRoute = true,
  navigationRoute,
  operationalRouteMarkers,
  selectedRouteId = null,
  showNavigationRoute = true,
  selectedPlotId,
  onPlotPress,
  onRoutePress,
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
    const features = [
      ...(geoData?.features ?? []),
      ...(showGeoDataRoute ? (geoDataRoute?.features ?? []) : []),
    ];

    if (features.length > 0) {
      const bbox = turf.bbox({
        type: 'FeatureCollection',
        features,
      });
      const bounds: [[number, number], [number, number]] = [
        [bbox[0], bbox[1]],
        [bbox[2], bbox[3]],
      ];
      return bounds;
    }
  }, [geoData, geoDataRoute, showGeoDataRoute]);

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

  useEffect(() => {
    handleMoveCameraToGeodataBbox();
  }, [geodataBBox]);

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

    if (event.features && event.features.length > 0) {
      const pressedFeature = event.features[0];

      if (pressedFeature?.properties?.route_id) {
        onRoutePress?.(String(pressedFeature.properties.route_id));
        return;
      }

      if (pressedFeature?.properties?.plot_id) {
        onPlotPress?.(String(pressedFeature.properties.plot_id));
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
        if (!geodataBBox || mapToolsHookReturn.isSomeToolActive) return;
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
            fillColor: COLORS.accent,
            fillOpacity: 0.7,
            fillOutlineColor: COLORS.accent,
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
        <ShapeSource id='routes' shape={geoDataRoute} onPress={handleMapPress}>
          <LineLayer
            id='routes-line'
            style={{
              lineColor: selectedRouteId
                ? ['case', ['==', ['get', 'route_id'], selectedRouteId], '#FF6B6B', '#94A3B8']
                : '#FF6B6B',
              lineWidth: selectedRouteId
                ? ['case', ['==', ['get', 'route_id'], selectedRouteId], 5, 2]
                : 3,
              lineOpacity: selectedRouteId
                ? ['case', ['==', ['get', 'route_id'], selectedRouteId], 0.96, 0.55]
                : 1,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        </ShapeSource>
      )}
      {showNavigationRoute && navigationRoute && (
        <ShapeSource id='navigation-route-source' shape={navigationRoute}>
          <LineLayer
            id='navigation-route-line'
            style={{
              lineColor: '#0D6EFD',
              lineWidth: 5,
              lineOpacity: 0.95,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        </ShapeSource>
      )}
      {operationalRouteMarkers && (
        <ShapeSource id='operational-route-markers-source' shape={operationalRouteMarkers}>
          <CircleLayer
            id='operational-route-markers-circle'
            style={{
              circleRadius: 7,
              circleColor: [
                'case',
                ['==', ['get', 'type'], 'user'],
                '#0D6EFD',
                ['==', ['get', 'type'], 'operational-start'],
                COLORS.accent,
                '#DC2626',
              ],
              circleStrokeColor: '#FFFFFF',
              circleStrokeWidth: 2,
            }}
          />
          <SymbolLayer
            id='operational-route-markers-label'
            style={{
              textField: ['get', 'label'],
              textSize: 12,
              textColor: '#FFFFFF',
              textHaloColor: '#000000',
              textHaloWidth: 2,
              textOffset: [0, 1.4],
              textAnchor: 'top',
            }}
          />
        </ShapeSource>
      )}
      {mapTools && mapToolsHookReturn.getToolLayers()}
    </MapView>
  );
}
