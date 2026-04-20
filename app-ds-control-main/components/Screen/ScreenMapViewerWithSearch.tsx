import { useState, useMemo, useEffect, useRef } from 'react';
import { View } from 'react-native';
import * as Location from 'expo-location';
import * as turf from '@turf/turf';
import MapViewer from '@/components/Map/MapViewer';
import MapNavigationButton from '@/components/Map/MapNavigationButton';
import TextInputSearchMultipleFarms from '@/components/TextInputSearchMultipleFarms';
import { Farm } from '@/types/farm.type';
import { Plot } from '@/types/plot.type';
import { Route } from '@/types/route.type';
import { useGetRouteByFarmId } from '@/queries/route.query';
import { useGetFarmById } from '@/queries/farm.query';

interface ScreenMapViewerWithSearchProps {
  customerId?: string;
  initialFarmId?: string | string[];
}

export default function ScreenMapViewerWithSearch({
  customerId,
  initialFarmId,
}: ScreenMapViewerWithSearchProps) {
  const [selectedFarms, setSelectedFarms] = useState<Farm[]>([]);
  const [navigationRoute, setNavigationRoute] = useState<GeoJSON.FeatureCollection | null>(null);
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
    const fetchNavigationRoute = async () => {
      // Only proceed if exactly 1 farm is selected
      if (selectedFarms.length !== 1) {
        setNavigationRoute(null);
        return;
      }

      try {
        setIsFetchingNavigation(true);

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.error('Location permission not granted');
          return;
        }

        const location = await Location.getCurrentPositionAsync({});
        const userCoords = [location.coords.longitude, location.coords.latitude];

        let destinationCoordinate: [number, number] | null = null;

        if (routeData?.routes && routeData.routes.length > 0) {
          const firstRoute = routeData.routes[0];
          const routeGeoJson = firstRoute.geoJson as any;

          if (routeGeoJson.type === 'Feature' && routeGeoJson.geometry?.coordinates) {
            const coords = routeGeoJson.geometry.coordinates;
            if (routeGeoJson.geometry.type === 'LineString') {
              destinationCoordinate = coords[coords.length - 1];
            } else if (routeGeoJson.geometry.type === 'Point') {
              destinationCoordinate = coords;
            }
          } else if (
            routeGeoJson.type === 'FeatureCollection' &&
            routeGeoJson.features?.[0]?.geometry?.coordinates
          ) {
            const coords = routeGeoJson.features[0].geometry.coordinates;
            if (routeGeoJson.features[0].geometry.type === 'LineString') {
              destinationCoordinate = coords[coords.length - 1];
            } else if (routeGeoJson.features[0].geometry.type === 'Point') {
              destinationCoordinate = coords;
            }
          } else if (routeGeoJson.coordinates) {
            if (routeGeoJson.type === 'LineString') {
              destinationCoordinate = routeGeoJson.coordinates[routeGeoJson.coordinates.length - 1];
            } else if (routeGeoJson.type === 'Point') {
              destinationCoordinate = routeGeoJson.coordinates;
            }
          }
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
          setNavigationRoute(null);
          return;
        }

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
      } finally {
        setIsFetchingNavigation(false);
      }
    };

    fetchNavigationRoute();
  }, [routeData, selectedFarms]);

  const handleToggleNavigationMode = () => {
    setIsNavigationMode((prev) => !prev);
  };

  const showMapTools = selectedFarms.length <= 1;
  const showNavigationButton = selectedFarms.length === 1;

  return (
    <View style={{ flex: 1, flexDirection: 'column' }}>
      <MapViewer
        selectedFarmId={selectedFarms.length > 0 ? selectedFarms[0].id : null}
        plots={allPlots}
        routes={allRoutes}
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
      {showNavigationButton && (
        <MapNavigationButton
          isNavigationMode={isNavigationMode}
          onToggleNavigationMode={handleToggleNavigationMode}
          disabled={selectedFarms.length === 0}
        />
      )}
    </View>
  );
}
