import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Location from 'expo-location';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import MapNavigationButton from '@/components/Map/MapNavigationButton';
import MapViewer from '@/components/Map/MapViewer';
import TextInputSearchMultipleFarms from '@/components/TextInputSearchMultipleFarms';
import { COLORS } from '@/constants/colors';
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

const normalizeFarm = (farm: Farm | null | undefined): Farm | null => {
  if (!farm || typeof farm !== 'object') return null;

  const normalizedId = farm.id == null ? '' : String(farm.id);
  if (!normalizedId) return null;

  return {
    id: normalizedId,
    name: typeof farm.name === 'string' && farm.name.trim() ? farm.name : 'Fazenda sem nome',
    customer: {
      id: farm.customer?.id == null ? '-' : String(farm.customer.id),
      name:
        typeof farm.customer?.name === 'string' && farm.customer.name.trim()
          ? farm.customer.name
          : '-',
    },
    plots: Array.isArray(farm.plots) ? farm.plots.filter((plot) => Boolean(plot)) : [],
    createdAt: typeof farm.createdAt === 'string' ? farm.createdAt : '',
    updatedAt: typeof farm.updatedAt === 'string' ? farm.updatedAt : '',
  };
};

const LOCATION_TIMEOUT_MS = 15000;
const ROUTE_START_INVALID_MESSAGE =
  'A rota selecionada nao possui um ponto inicial valido para navegacao.';
const ROUTE_CALCULATION_GENERIC_MESSAGE =
  'Nao foi possivel calcular a rota ate o inicio da operacao. Verifique sua localizacao e tente novamente.';
const MAPBOX_NO_ROUTE_MESSAGE =
  'A Mapbox nao encontrou uma rota viaria ate o inicio da operacao. Tente ajustar sua localizacao ou selecione outra rota.';

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
      'Permita o acesso a sua localizacao para calcular a rota dentro do iControl Agras.'
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
    const normalizedFarm = normalizeFarm(initialFarmData.farm);
    if (!normalizedFarm) return;

    setSelectedFarms((previousSelectedFarms) => {
      if (
        previousSelectedFarms.length === 1 &&
        previousSelectedFarms[0].id === normalizedFarm.id
      ) {
        return previousSelectedFarms;
      }

      return [normalizedFarm];
    });
    appliedInitialFarmIdRef.current = normalizedInitialFarmId;
  }, [initialFarmData?.farm, normalizedInitialFarmId]);

  const safeSelectedFarms = useMemo<Farm[]>(() => {
    if (!Array.isArray(selectedFarms)) return [];
    return selectedFarms
      .map((farm) => normalizeFarm(farm))
      .filter((farm): farm is Farm => Boolean(farm));
  }, [selectedFarms]);

  const primarySelectedFarm = safeSelectedFarms.length > 0 ? safeSelectedFarms[0] : null;

  const allPlots = useMemo<Plot[]>(() => {
    return safeSelectedFarms.flatMap((farm) => (Array.isArray(farm.plots) ? farm.plots : []));
  }, [safeSelectedFarms]);

  const selectedFarmId =
    safeSelectedFarms.length === 1 ? String(primarySelectedFarm?.id ?? '') : null;

  const { data: routeData, isFetching: isFetchingRoute } = useGetRouteByFarmId(selectedFarmId, {
    includeGeoJson: 'true',
  });

  const allRoutes = useMemo<Route[]>(() => {
    if (safeSelectedFarms.length === 1 && routeData?.routes) {
      return routeData.routes;
    }
    return [];
  }, [safeSelectedFarms.length, routeData]);

  useEffect(() => {
    if (allRoutes.length === 0) {
      setSelectedRouteId((previousRouteId) => (previousRouteId === null ? previousRouteId : null));
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
    setNavigationRoute((previousRoute) => (previousRoute ? null : previousRoute));
    setNavigationRouteError((previousError) => (previousError ? null : previousError));
    setIsNavigationMode((previousValue) => (previousValue ? false : previousValue));
  }, [selectedFarmId, selectedRoute?.id]);

  const handleStartNavigationToRoute = async () => {
    if (!selectedRouteStartCoordinate) {
      logIrAgoraDev('Route start coordinate unavailable', {
        selectedRouteId: selectedRoute?.id,
      });
      Alert.alert('Inicio da rota indisponivel', ROUTE_START_INVALID_MESSAGE);
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
      Alert.alert('Nao foi possivel calcular a rota', message);
    } finally {
      setIsFetchingNavigation(false);
      logIrAgoraDev('Navigation loading finished');
    }
  };

  const handleToggleNavigationMode = () => {
    setIsNavigationMode((prev) => !prev);
  };

  const showMapTools = safeSelectedFarms.length <= 1;
  const showNavigationButton = safeSelectedFarms.length === 1;
  const showRouteSelector =
    safeSelectedFarms.length === 1 && allRoutes.length > 0 && !isNavigationMode;
  const canStartNavigation = Boolean(selectedRouteStartCoordinate) && !isFetchingRoute;

  return (
    <View style={{ flex: 1, flexDirection: 'column' }}>
      <MapViewer
        isFetching={isFetchingRoute || isFetchingNavigation}
        selectedFarmId={primarySelectedFarm?.id ?? null}
        plots={allPlots}
        routes={routesForMap}
        navigationRoute={navigationRoute}
        showMapTools={showMapTools}
        showRoute={safeSelectedFarms.length === 1}
        showNavigationRoute={Boolean(navigationRoute)}
        isNavigationMode={isNavigationMode}
      />
      {!isNavigationMode && (
        <TextInputSearchMultipleFarms
          placeholder='Buscar fazenda... '
          onFarmsSelect={setSelectedFarms}
          customerId={customerId}
          selectedFarmsExternal={safeSelectedFarms}
        />
      )}
      {showRouteSelector && (
        <View style={styles.routeSelectorContainer}>
          <View style={styles.routeSelectorHeader}>
            <MaterialCommunityIcons name='routes' size={14} color={COLORS.primaryDark} />
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
          disabled={safeSelectedFarms.length === 0}
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
    borderColor: COLORS.border,
    borderRadius: 16,
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
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },
  routeSelectorLoadingText: {
    color: COLORS.textMuted,
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
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: COLORS.surface,
    maxWidth: 220,
  },
  routeChipSelected: {
    borderColor: COLORS.primaryDark,
    backgroundColor: COLORS.primarySoft,
  },
  routeChipText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  routeChipTextSelected: {
    color: COLORS.primaryDark,
  },
  navigationErrorContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 58,
    zIndex: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(127, 29, 29, 0.94)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  navigationErrorText: {
    color: COLORS.surface,
    fontSize: 12,
    fontWeight: '500',
  },
});
