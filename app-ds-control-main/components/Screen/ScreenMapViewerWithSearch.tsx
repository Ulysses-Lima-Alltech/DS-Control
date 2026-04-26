import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as turf from '@turf/turf';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import MapNavigationButton from '@/components/Map/MapNavigationButton';
import MapViewer from '@/components/Map/MapViewer';
import TextInputSearchMultipleFarms from '@/components/TextInputSearchMultipleFarms';
import { useGetFarmById } from '@/queries/farm.query';
import { useGetRouteByFarmId } from '@/queries/route.query';
import { Farm } from '@/types/farm.type';
import { Plot } from '@/types/plot.type';
import { Route } from '@/types/route.type';
import { NavigationCoordinate, openExternalNavigation } from '@/utils/navigationExternal';

interface ScreenMapViewerWithSearchProps {
  customerId?: string;
  initialFarmId?: string | string[];
}

type LngLatCoordinate = [number, number];

const isValidLngLatCoordinate = (value: unknown): value is LngLatCoordinate => {
  if (!Array.isArray(value) || value.length < 2) return false;

  const longitude = Number(value[0]);
  const latitude = Number(value[1]);

  return (
    Number.isFinite(longitude) &&
    Number.isFinite(latitude) &&
    Math.abs(longitude) <= 180 &&
    Math.abs(latitude) <= 90
  );
};

const getDestinationFromGeometry = (geometry: any): LngLatCoordinate | null => {
  if (!geometry) return null;

  if (geometry.type === 'Point' && isValidLngLatCoordinate(geometry.coordinates)) {
    return geometry.coordinates;
  }

  if (geometry.type === 'LineString' && Array.isArray(geometry.coordinates)) {
    const lastCoordinate = geometry.coordinates[geometry.coordinates.length - 1];
    return isValidLngLatCoordinate(lastCoordinate) ? lastCoordinate : null;
  }

  if (geometry.type === 'MultiLineString' && Array.isArray(geometry.coordinates)) {
    const lastLine = geometry.coordinates[geometry.coordinates.length - 1];
    if (!Array.isArray(lastLine) || lastLine.length === 0) return null;
    const lastCoordinate = lastLine[lastLine.length - 1];
    return isValidLngLatCoordinate(lastCoordinate) ? lastCoordinate : null;
  }

  return null;
};

const getDestinationFromRouteGeoJson = (routeGeoJson: unknown): LngLatCoordinate | null => {
  const geoJson = routeGeoJson as any;
  if (!geoJson) return null;

  if (geoJson.type === 'Feature' && geoJson.geometry) {
    return getDestinationFromGeometry(geoJson.geometry);
  }

  if (
    geoJson.type === 'FeatureCollection' &&
    Array.isArray(geoJson.features) &&
    geoJson.features.length > 0
  ) {
    const lineFeature = geoJson.features.find(
      (feature: any) => feature?.geometry?.type === 'LineString'
    );
    if (lineFeature) {
      return getDestinationFromGeometry(lineFeature.geometry);
    }

    const firstFeatureWithGeometry = geoJson.features.find((feature: any) => feature?.geometry);
    if (firstFeatureWithGeometry) {
      return getDestinationFromGeometry(firstFeatureWithGeometry.geometry);
    }
  }

  if (geoJson.type && geoJson.coordinates) {
    return getDestinationFromGeometry(geoJson);
  }

  return null;
};

const buildRouteLabel = (route: Route, index: number) => {
  if (route.name && route.name.trim()) return route.name.trim();
  return `Rota ${index + 1}`;
};

export default function ScreenMapViewerWithSearch({
  customerId,
  initialFarmId,
}: ScreenMapViewerWithSearchProps) {
  const [selectedFarms, setSelectedFarms] = useState<Farm[]>([]);
  const [navigationRoute, setNavigationRoute] = useState<GeoJSON.FeatureCollection | null>(null);
  const [destinationCoordinate, setDestinationCoordinate] = useState<NavigationCoordinate | null>(
    null
  );
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

  useEffect(() => {
    const fetchNavigationRoute = async () => {
      // Only proceed if exactly 1 farm is selected
      if (selectedFarms.length !== 1) {
        setNavigationRoute(null);
        setDestinationCoordinate(null);
        return;
      }

      try {
        setIsFetchingNavigation(true);

        let destinationCoordinate: [number, number] | null = null;

        if (selectedRoute?.geoJson) {
          destinationCoordinate = getDestinationFromRouteGeoJson(selectedRoute.geoJson);
        }

        if (!destinationCoordinate && selectedFarms[0].plots && selectedFarms[0].plots.length > 0) {
          try {
            const plotFeatures: GeoJSON.Feature[] = [];

            selectedFarms[0].plots.forEach((plot) => {
              if (plot.geoJson) {
                const geoJson = plot.geoJson as any;
                if (geoJson.type === 'FeatureCollection') {
                  plotFeatures.push(...geoJson.features);
                } else if (geoJson.type === 'Feature') {
                  plotFeatures.push(geoJson);
                }
              }
            });

            if (plotFeatures.length > 0) {
              const farmFeatureCollection: GeoJSON.FeatureCollection = {
                type: 'FeatureCollection',
                features: plotFeatures,
              };

              const centroid = turf.centroid(farmFeatureCollection);
              destinationCoordinate = centroid.geometry.coordinates as [number, number];
            }
          } catch (error) {
            console.error('Error calculating farm centroid:', error);
          }
        }

        if (!destinationCoordinate) {
          console.error('Could not determine destination coordinate (no route and no plots)');
          setDestinationCoordinate(null);
          setNavigationRoute(null);
          return;
        }

        setDestinationCoordinate({
          longitude: destinationCoordinate[0],
          latitude: destinationCoordinate[1],
        });

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setNavigationRoute(null);
          return;
        }

        const location = await Location.getCurrentPositionAsync({});
        const userCoords: LngLatCoordinate = [location.coords.longitude, location.coords.latitude];

        const accessToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
        const coordinates = `${userCoords[0].toFixed(6)},${userCoords[1].toFixed(6)};${destinationCoordinate[0].toFixed(6)},${destinationCoordinate[1].toFixed(6)}`;
        const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?geometries=geojson&access_token=${accessToken}`;

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Failed to fetch navigation route');
        }

        const data = await response.json();

        if (data.routes && data.routes.length > 0) {
          const navigationGeoJson: GeoJSON.FeatureCollection = {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: {
                  type: 'navigation',
                  distance: data.routes[0].distance,
                  duration: data.routes[0].duration,
                },
                geometry: data.routes[0].geometry,
              },
            ],
          };
          setNavigationRoute(navigationGeoJson);
        }
      } catch (error) {
        console.error('Error fetching navigation route:', error);
        setNavigationRoute(null);
      } finally {
        setIsFetchingNavigation(false);
      }
    };

    fetchNavigationRoute();
  }, [selectedRoute, selectedFarms]);

  const handleOpenExternalNavigation = useCallback(async () => {
    if (!destinationCoordinate) {
      Alert.alert(
        'Destino indisponível',
        'Selecione uma fazenda com rota ou talhões válidos para iniciar a navegação.'
      );
      return;
    }

    const result = await openExternalNavigation(destinationCoordinate);
    if (!result.success) {
      Alert.alert(
        'Não foi possível abrir a navegação',
        'Nenhum app de mapas compatível foi encontrado. Tente novamente.'
      );
    }
  }, [destinationCoordinate]);

  const handleToggleNavigationMode = () => {
    setIsNavigationMode((prev) => !prev);
  };

  const showMapTools = selectedFarms.length <= 1;
  const showNavigationButton = selectedFarms.length === 1;
  const showRouteSelector = selectedFarms.length === 1 && allRoutes.length > 0 && !isNavigationMode;

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
        showNavigationRoute={selectedFarms.length === 1}
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
          showGoNow={showNavigationButton}
          onGoNow={handleOpenExternalNavigation}
        />
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
});
