import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Location from 'expo-location';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import MapNavigationButton from '@/components/Map/MapNavigationButton';
import MapViewer from '@/components/Map/MapViewer';
import TextInputSearchMultipleFarms from '@/components/TextInputSearchMultipleFarms';
import { useGetFarmById } from '@/queries/farm.query';
import { useGetRouteByFarmId } from '@/queries/route.query';
import { getMapboxDrivingDirections } from '@/services/mapboxDirections.service';
import { Farm } from '@/types/farm.type';
import { MapboxDirectionsError, MapNavigationCoordinate } from '@/types/mapNavigation.type';
import { Plot } from '@/types/plot.type';
import { Route } from '@/types/route.type';
import { extractRouteStartCoordinate } from '@/utils/routeNavigationGeometry';

interface ScreenMapViewerWithSearchProps {
  customerId?: string;
  initialFarmId?: string | string[];
}

const buildRouteLabel = (route: Route, index: number) => {
  if (route.name && route.name.trim()) return route.name.trim();
  return `Rota ${index + 1}`;
};

const LOCATION_TIMEOUT_MS = 15000;
const ROUTE_START_INVALID_MESSAGE =
  'A rota selecionada não possui um ponto inicial válido para navegação.';
const ROUTE_CALCULATION_GENERIC_MESSAGE =
  'Não foi possível calcular a rota até o início da operação. Verifique sua localização e tente novamente.';
const MAPBOX_NO_ROUTE_MESSAGE =
  'A Mapbox não encontrou uma rota viária até o início da operação. Tente ajustar sua localização ou selecione outra rota.';

const logIrAgoraDev = (message: string, data?: Record<string, unknown>) => {
  if (__DEV__) {
    console.warn('[IrAgora][DEV]', message, data);
  }
};

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('location-timeout'));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

const getCurrentUserCoordinate = async (): Promise<MapNavigationCoordinate | null> => {
  const isLocationEnabled = await Location.hasServicesEnabledAsync();

  if (!isLocationEnabled) {
    Alert.alert(
      'Localizacao desativada',
      'Ative a localizacao do dispositivo para calcular a rota ate o inicio da operacao.'
    );
    return null;
  }

  const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
  const permission =
    existingStatus === 'granted'
      ? { status: existingStatus }
      : await Location.requestForegroundPermissionsAsync();

  if (permission.status !== 'granted') {
    Alert.alert(
      'Permissao de localizacao',
      'Permita o acesso a sua localizacao para calcular a rota dentro do DS Control.'
    );
    return null;
  }

  const location = await withTimeout(
    Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    }),
    LOCATION_TIMEOUT_MS
  );

  return {
    longitude: location.coords.longitude,
    latitude: location.coords.latitude,
  };
};

const getNavigationAlertMessage = (error: unknown) => {
  if (error instanceof Error && error.message === 'location-timeout') {
    return ROUTE_CALCULATION_GENERIC_MESSAGE;
  }

  if (error instanceof MapboxDirectionsError && error.code === 'no-route') {
    return MAPBOX_NO_ROUTE_MESSAGE;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return ROUTE_CALCULATION_GENERIC_MESSAGE;
};

export default function ScreenMapViewerWithSearch({
  customerId,
  initialFarmId,
}: ScreenMapViewerWithSearchProps) {
  const [selectedFarms, setSelectedFarms] = useState<Farm[]>([]);
  const [navigationRoute, setNavigationRoute] = useState<GeoJSON.FeatureCollection | null>(null);
  const [navigationRouteError, setNavigationRouteError] = useState<string | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [isFetchingNavigation, setIsFetchingNavigation] = useState(false);
  const [isNavigationMode, setIsNavigationMode] = useState(false);
  const appliedInitialFarmIdRef = useRef<string | null>(null);

  const normalizedInitialFarmId = useMemo(() => {
    return Array.isArray(initialFarmId) ? initialFarmId[0] : initialFarmId;
  }, [initialFarmId]);

  const { data: initialFarmData } = useGetFarmById(
    normalizedInitialFarmId ?? null,
    {
      includePlots: 'true',
      includeGeoJson: 'true',
      includeCustomer: 'true',
    },
    {
      queryKey: ['initial-map-farm', normalizedInitialFarmId],
      enabled: !!normalizedInitialFarmId,
    }
  );

  useEffect(() => {
    if (!normalizedInitialFarmId) {
      appliedInitialFarmIdRef.current = null;
      return;
    }

    if (!initialFarmData?.farm) return;
    if (appliedInitialFarmIdRef.current === normalizedInitialFarmId) return;

    setSelectedFarms((previousSelectedFarms) => {
      if (
        previousSelectedFarms.length === 1 &&
        previousSelectedFarms[0].id === initialFarmData.farm.id
      ) {
        return previousSelectedFarms;
      }

      return [initialFarmData.farm];
    });
    appliedInitialFarmIdRef.current = normalizedInitialFarmId;
  }, [initialFarmData?.farm, normalizedInitialFarmId]);

  const allPlots = useMemo<Plot[]>(() => {
    return selectedFarms.flatMap((farm) => farm.plots || []);
  }, [selectedFarms]);

  const selectedFarmId = selectedFarms.length === 1 ? selectedFarms[0].id : null;

  const { data: routeData, isFetching: isFetchingRoute } = useGetRouteByFarmId(selectedFarmId, {
    includeGeoJson: 'true',
  });

  const allRoutes = useMemo<Route[]>(() => {
    if (selectedFarms.length === 1 && routeData?.routes) {
      return routeData.routes;
    }
    return [];
  }, [selectedFarms.length, routeData]);

  useEffect(() => {
    if (allRoutes.length === 0) {
      setSelectedRouteId(null);
      return;
    }

    setSelectedRouteId((previousRouteId) => {
      if (previousRouteId && allRoutes.some((route) => route.id === previousRouteId)) {
        return previousRouteId;
      }
      return allRoutes[0].id;
    });
  }, [allRoutes]);

  const selectedRoute = useMemo<Route | null>(() => {
    if (allRoutes.length === 0) return null;
    if (!selectedRouteId) return allRoutes[0];
    return allRoutes.find((route) => route.id === selectedRouteId) ?? allRoutes[0];
  }, [allRoutes, selectedRouteId]);

  const routesForMap = useMemo<Route[]>(() => {
    if (!selectedRoute) return allRoutes;
    return [selectedRoute];
  }, [allRoutes, selectedRoute]);

  const selectedRouteStartCoordinate = useMemo(() => {
    return selectedRoute ? extractRouteStartCoordinate(selectedRoute) : null;
  }, [selectedRoute]);

  useEffect(() => {
    setNavigationRoute(null);
    setNavigationRouteError(null);
    setIsNavigationMode(false);
  }, [selectedFarmId, selectedRoute?.id]);

  const handleStartNavigationToRoute = async () => {
    if (!selectedRouteStartCoordinate) {
      logIrAgoraDev('Route start coordinate unavailable', {
        selectedRouteId: selectedRoute?.id,
      });
      Alert.alert('Início da rota indisponível', ROUTE_START_INVALID_MESSAGE);
      return;
    }

    try {
      setIsFetchingNavigation(true);
      setNavigationRouteError(null);
      setNavigationRoute(null);

      logIrAgoraDev('Navigation calculation started', {
        selectedRouteId: selectedRoute?.id,
        destinationY: selectedRouteStartCoordinate,
      });

      const originCoordinate = await getCurrentUserCoordinate();
      if (!originCoordinate) {
        setNavigationRoute(null);
        logIrAgoraDev('Origin coordinate unavailable');
        return;
      }

      logIrAgoraDev('Current location captured', {
        originX: originCoordinate,
        destinationY: selectedRouteStartCoordinate,
      });

      const directionsRoute = await getMapboxDrivingDirections(
        originCoordinate,
        selectedRouteStartCoordinate
      );

      setNavigationRoute(directionsRoute.geoJson);
      setIsNavigationMode(true);
      logIrAgoraDev('Navigation route applied to map', {
        distance: directionsRoute.distance,
        duration: directionsRoute.duration,
      });
    } catch (error) {
      const message = getNavigationAlertMessage(error);

      logIrAgoraDev('Handled navigation error', { error, message });
      setNavigationRoute(null);
      setNavigationRouteError(message);
      Alert.alert('Não foi possível calcular a rota', message);
    } finally {
      setIsFetchingNavigation(false);
      logIrAgoraDev('Navigation loading finished');
    }
  };

  const handleToggleNavigationMode = () => {
    setIsNavigationMode((prev) => !prev);
  };

  const showMapTools = selectedFarms.length <= 1;
  const showNavigationButton = selectedFarms.length === 1;
  const showRouteSelector = selectedFarms.length === 1 && allRoutes.length > 0 && !isNavigationMode;
  const canStartNavigation = Boolean(selectedRouteStartCoordinate) && !isFetchingRoute;

  return (
    <View style={{ flex: 1, flexDirection: 'column' }}>
      <MapViewer
        isFetching={isFetchingRoute || isFetchingNavigation}
        selectedFarmId={selectedFarms.length > 0 ? selectedFarms[0].id : null}
        plots={allPlots}
        routes={routesForMap}
        navigationRoute={navigationRoute}
        showMapTools={showMapTools}
        showRoute={selectedFarms.length === 1}
        showNavigationRoute={Boolean(navigationRoute)}
        isNavigationMode={isNavigationMode}
      />
      {!isNavigationMode && (
        <TextInputSearchMultipleFarms
          placeholder='Buscar fazenda... '
          onFarmsSelect={setSelectedFarms}
          customerId={customerId}
          selectedFarmsExternal={selectedFarms}
        />
      )}
      {showRouteSelector && (
        <View style={styles.routeSelectorContainer}>
          <View style={styles.routeSelectorHeader}>
            <MaterialCommunityIcons name='routes' size={14} color='#0D6EFD' />
            <Text style={styles.routeSelectorTitle}>Rotas da fazenda</Text>
          </View>
          {isFetchingRoute ? (
            <Text style={styles.routeSelectorLoadingText}>Carregando rotas...</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.routeChipList}>
                {allRoutes.map((route, index) => {
                  const isSelected = selectedRoute?.id === route.id;
                  return (
                    <TouchableOpacity
                      key={route.id}
                      style={[styles.routeChip, isSelected && styles.routeChipSelected]}
                      onPress={() => setSelectedRouteId(route.id)}
                    >
                      <Text
                        style={[styles.routeChipText, isSelected && styles.routeChipTextSelected]}
                        numberOfLines={1}
                      >
                        {buildRouteLabel(route, index)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          )}
        </View>
      )}
      {showNavigationButton && (
        <MapNavigationButton
          isNavigationMode={isNavigationMode}
          onToggleNavigationMode={handleToggleNavigationMode}
          disabled={selectedFarms.length === 0}
          showGoNow={canStartNavigation}
          goNowDisabled={!canStartNavigation}
          goNowLoading={isFetchingNavigation}
          onGoNow={handleStartNavigationToRoute}
        />
      )}
      {navigationRouteError && !isFetchingNavigation && (
        <View style={styles.navigationErrorContainer}>
          <Text style={styles.navigationErrorText}>{navigationRouteError}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  routeSelectorContainer: {
    position: 'absolute',
    top: 72,
    width: '90%',
    marginHorizontal: '5%',
    zIndex: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderWidth: 1,
    borderColor: '#DADADA',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  routeSelectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  routeSelectorTitle: {
    color: '#1D1D1D',
    fontSize: 12,
    fontWeight: '600',
  },
  routeSelectorLoadingText: {
    color: '#646464',
    fontSize: 12,
  },
  routeChipList: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 8,
  },
  routeChip: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D3D3D3',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
    maxWidth: 220,
  },
  routeChipSelected: {
    borderColor: '#0D6EFD',
    backgroundColor: '#EAF2FF',
  },
  routeChipText: {
    color: '#464646',
    fontSize: 12,
    fontWeight: '500',
  },
  routeChipTextSelected: {
    color: '#0D6EFD',
  },
  navigationErrorContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 58,
    zIndex: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(127, 29, 29, 0.94)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  navigationErrorText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
});
