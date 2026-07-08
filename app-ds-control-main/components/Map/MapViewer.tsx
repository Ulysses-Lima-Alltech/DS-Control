import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import MapContent from '@/components/Map/MapContent';
import MapControls from '@/components/Map/MapControls';
import MapTools, { useMapTools } from '@/components/Map/MapTools';
import ModalPlotViewer from '@/components/Modal/ModalPlotViewer';
import { COLORS } from '@/constants/colors';
import { Plot } from '@/types/plot.type';
import { Route } from '@/types/route.type';
import {
  convertDatabasePlotsToMapViewerPlotsFeatureCollection,
  convertDatabaseRoutesToMapViewerRoutesFeatureCollection,
} from '@/utils/map-utils';

interface ButtonsOffset {
  mapControls?: {
    bottom?: number;
    left?: number;
  };
  mapTools?: {
    top?: number;
    left?: number;
  };
}

export type MapViewerProps = {
  isFetching?: boolean;
  selectedFarmId: string | null;
  plots: Plot[];
  routes?: Route[];
  navigationRoute?: GeoJSON.FeatureCollection | null;
  operationalRouteMarkers?: GeoJSON.FeatureCollection<GeoJSON.Point> | null;
  selectedRouteId?: string | null;
  selectedPlotId?: string;
  onPlotPress?: (plotId: string) => void;
  onRoutePress?: (routeId: string) => void;
  showMapControls?: boolean;
  showMapTools?: boolean;
  showRoute?: boolean;
  showNavigationRoute?: boolean;
  buttonsOffset?: ButtonsOffset;
  isNavigationMode?: boolean;
};

export default function MapViewer({
  isFetching,
  selectedFarmId,
  plots,
  routes = [],
  navigationRoute = null,
  operationalRouteMarkers = null,
  selectedRouteId = null,
  selectedPlotId,
  onPlotPress,
  onRoutePress,
  showMapControls = true,
  showMapTools = true,
  showRoute = false,
  showNavigationRoute = false,
  buttonsOffset,
  isNavigationMode = false,
}: MapViewerProps) {
  const [isCameraLockedOnUserLocation, setIsCameraLockedOnUserLocation] = useState<boolean>(true);
  const [moveCameraToGeodataBbox, triggerMoveCameraToGeodataBbox] = useState(0);
  const [plotForCameraMovingToIstBbbox, setMoveCameraToPlotGeojson] =
    useState<GeoJSON.FeatureCollection | null>(null);
  const [isPlotModalVisible, setIsPlotModalVisible] = useState(false);
  const [selectedPlotIdForModal, setSelectedPlotIdForModal] = useState<string | null>(null);
  const lastCameraMoveSignatureRef = useRef<string>('');

  const geoData = useMemo(() => {
    return convertDatabasePlotsToMapViewerPlotsFeatureCollection(plots);
  }, [plots]);

  const geoDataRoute = useMemo(() => {
    return convertDatabaseRoutesToMapViewerRoutesFeatureCollection(routes);
  }, [routes]);

  const mapToolsHookReturn = useMapTools();

  function handlePlotPress(plotId: string) {
    setSelectedPlotIdForModal(plotId);
    setIsPlotModalVisible(true);

    // Call the external onPlotPress handler if provided
    if (onPlotPress) {
      onPlotPress(plotId);
    }
  }

  function handleMoveCameraToPlotBbox() {
    if (!selectedPlotId || plots.length === 0 || !plots) return;
    setIsCameraLockedOnUserLocation(false);
    setMoveCameraToPlotGeojson(plots.find((p) => p.id === selectedPlotId)?.geoJson ?? null);
  }

  useEffect(() => {
    handleMoveCameraToPlotBbox();
  }, [selectedPlotId]);

  function handleMoveCameraToGeodataBbox() {
    if (!selectedFarmId || plots.length === 0 || !plots) return;
    setIsCameraLockedOnUserLocation(false);
    triggerMoveCameraToGeodataBbox((p) => p + 1);
  }

  useEffect(() => {
    const plotsSignature = plots.map((plot) => plot.id).join(',');
    const nextSignature = `${selectedFarmId ?? ''}|${plotsSignature}`;

    if (lastCameraMoveSignatureRef.current === nextSignature) {
      return;
    }

    lastCameraMoveSignatureRef.current = nextSignature;
    handleMoveCameraToGeodataBbox();
  }, [plots, selectedFarmId]);

  useEffect(() => {
    if (isNavigationMode) {
      setIsCameraLockedOnUserLocation(true);
    }
  }, [isNavigationMode]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: isFetching ? 'black' : 'white',
        opacity: isFetching ? 0.7 : 1,
      }}
    >
      {isFetching && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 2,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <ActivityIndicator color={COLORS.primary} size='large' />
        </View>
      )}
      <MapContent
        geoData={geoData}
        geoDataRoute={geoDataRoute}
        showGeoDataRoute={showRoute || isNavigationMode}
        navigationRoute={navigationRoute}
        operationalRouteMarkers={operationalRouteMarkers}
        selectedRouteId={selectedRouteId}
        showNavigationRoute={showNavigationRoute}
        selectedPlotId={selectedPlotId}
        onPlotPress={handlePlotPress}
        onRoutePress={onRoutePress}
        isCameraLockedOnUserLocation={isCameraLockedOnUserLocation}
        setIsCameraLockedOnUserLocation={setIsCameraLockedOnUserLocation}
        moveCameraToGeodataBbox={moveCameraToGeodataBbox}
        plotForCameraMovingToIstBbbox={plotForCameraMovingToIstBbbox}
        mapToolsHookReturn={mapToolsHookReturn}
        isNavigationMode={isNavigationMode}
      />
      {showMapControls && !isNavigationMode && (
        <MapControls
          buttonsOffset={buttonsOffset?.mapControls}
          farmIsLoaded={plots.length > 0}
          setIsCameraLockedOnUserLocation={setIsCameraLockedOnUserLocation}
          moveCameraToGeodataBbox={handleMoveCameraToGeodataBbox}
          toggleCameraLockedOnUserLocation={() => setIsCameraLockedOnUserLocation((prev) => !prev)}
          isCameraLockedOnUserLocation={isCameraLockedOnUserLocation}
        />
      )}
      {showMapTools && !isNavigationMode && <MapTools toolsHookReturn={mapToolsHookReturn} />}

      <ModalPlotViewer
        plotId={selectedPlotIdForModal}
        visible={isPlotModalVisible}
        setVisible={setIsPlotModalVisible}
      />
    </View>
  );
}
