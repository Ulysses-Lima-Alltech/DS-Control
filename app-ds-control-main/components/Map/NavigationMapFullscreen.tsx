import { MaterialCommunityIcons } from '@expo/vector-icons';
import Mapbox, {
  Camera,
  CircleLayer,
  LineLayer,
  MapView,
  ShapeSource,
  SymbolLayer,
} from '@rnmapbox/maps';
import * as turf from '@turf/turf';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import NavigationInstructionPanel from '@/components/Map/NavigationInstructionPanel';
import NavigationMapStyleSelector from '@/components/Map/NavigationMapStyleSelector';
import { COLORS } from '@/constants/colors';
import {
  MapboxNavigationStep,
  NavigationCoordinate,
  NavigationMapMode,
  NavigationMapModeOption,
} from '@/types/mapNavigation.type';
import {
  calculateBearing,
  formatNavigationDuration,
  getDistanceMetersBetweenCoordinates,
  getEstimatedArrivalTime,
  getInitialNavigationBearing,
  getNextRoutePointAhead,
  getNextStepIndex,
  getRemainingNavigationSummary,
  getRouteCoordinatesFromLineString,
} from '@/utils/navigationInstructionUtils';
import {
  buildNavigationVoiceStepKey,
  buildSpokenNavigationInstruction,
} from '@/utils/navigationVoiceUtils';

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '');

type NavigationMapFullscreenProps = {
  visible: boolean;
  onClose: () => void;
  navigationRoute: GeoJSON.FeatureCollection<GeoJSON.LineString> | null;
  operationalRoute: GeoJSON.FeatureCollection | null;
  operationalRouteMarkers: GeoJSON.FeatureCollection<GeoJSON.Point> | null;
  routeSummary?: {
    routeName: string;
    routeCount: number;
    mapboxDistanceMeters: number;
    operationalDistanceMeters: number;
    totalDistanceMeters: number;
    isAutomatic: boolean;
  } | null;
  steps: MapboxNavigationStep[];
  originCoordinate: NavigationCoordinate | null;
  startCoordinate: NavigationCoordinate | null;
};

const NAVIGATION_PITCH = 58;
const NAVIGATION_ZOOM = 16.8;

const NAVIGATION_MAP_MODE_OPTIONS: NavigationMapModeOption[] = [
  {
    mode: 'navigation3d',
    label: '3D',
    description: 'Navegação',
    styleURL: 'mapbox://styles/mapbox/satellite-streets-v12',
    pitch: NAVIGATION_PITCH,
    zoomLevel: NAVIGATION_ZOOM,
    useBearing: true,
    followPerspective: true,
  },
  {
    mode: 'light2d',
    label: '2D',
    description: 'Claro',
    styleURL: 'mapbox://styles/mapbox/light-v11',
    pitch: NAVIGATION_PITCH,
    zoomLevel: NAVIGATION_ZOOM,
    useBearing: true,
    followPerspective: true,
  },
  {
    mode: 'dark2d',
    label: '2D',
    description: 'Escuro',
    styleURL: 'mapbox://styles/mapbox/dark-v11',
    pitch: NAVIGATION_PITCH,
    zoomLevel: NAVIGATION_ZOOM,
    useBearing: true,
    followPerspective: true,
  },
];

const logNavigationFullscreenDev = (message: string, data?: Record<string, unknown>) => {
  if (__DEV__) {
    console.warn('[NavigationFullscreen][DEV]', message, data);
  }
};

const logNavigationInstructionsDev = (message: string, data?: Record<string, unknown>) => {
  if (__DEV__) {
    console.warn('[NavigationInstructions][DEV]', message, data);
  }
};

const logNavigationMapModeDev = (message: string, data?: Record<string, unknown>) => {
  if (__DEV__) {
    console.warn('[NavigationMapMode][DEV]', message, data);
  }
};

const logNavigationVoiceDev = (message: string, data?: Record<string, unknown>) => {
  if (__DEV__) {
    console.warn('[NavigationVoice][DEV]', message, data);
  }
};

const coordinateToPosition = (coordinate: NavigationCoordinate): [number, number] => [
  coordinate.longitude,
  coordinate.latitude,
];

const formatTripDistance = (distanceMeters?: number) => {
  if (!Number.isFinite(distanceMeters) || distanceMeters === undefined) return '--';

  if (distanceMeters < 1000) {
    return `${Math.max(0, Math.round(distanceMeters))} m`;
  }

  const distanceKm = distanceMeters / 1000;
  if (distanceKm >= 100) {
    return `${Math.round(distanceKm).toLocaleString('pt-BR')} km`;
  }

  return `${distanceKm.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} km`;
};

export default function NavigationMapFullscreen({
  visible,
  onClose,
  navigationRoute,
  operationalRoute,
  operationalRouteMarkers,
  routeSummary,
  steps,
  originCoordinate,
  startCoordinate,
}: NavigationMapFullscreenProps) {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<Camera>(null);
  const selectedVoiceIdRef = useRef<string | undefined>(undefined);
  const lastSpokenStepKeyRef = useRef<string | null>(null);
  const distanceToManeuverMetersRef = useRef<number | undefined>(undefined);
  const [userCoordinate, setUserCoordinate] = useState<NavigationCoordinate | null>(
    originCoordinate
  );
  const [userHeading, setUserHeading] = useState<number | undefined>(undefined);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [isStyleLoaded, setIsStyleLoaded] = useState(false);
  const [isFollowingUser, setIsFollowingUser] = useState(true);
  const [mapMode, setMapMode] = useState<NavigationMapMode>('navigation3d');
  const [isMapModeSelectorOpen, setIsMapModeSelectorOpen] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);

  const activeStep = steps[activeStepIndex] ?? null;
  const activeMapModeOption =
    NAVIGATION_MAP_MODE_OPTIONS.find((option) => option.mode === mapMode) ??
    NAVIGATION_MAP_MODE_OPTIONS[0];
  const routeCoordinates = useMemo(
    () => getRouteCoordinatesFromLineString(navigationRoute),
    [navigationRoute]
  );
  const remainingSummary = useMemo(
    () => getRemainingNavigationSummary(steps, activeStepIndex),
    [activeStepIndex, steps]
  );
  const distanceToManeuverMeters = useMemo(
    () => getDistanceMetersBetweenCoordinates(userCoordinate, activeStep?.maneuverLocation),
    [activeStep?.maneuverLocation, userCoordinate]
  );
  const routeBearing = useMemo(() => {
    const bearing =
      calculateBearing(userCoordinate, activeStep?.maneuverLocation) ??
      getInitialNavigationBearing(routeCoordinates, userCoordinate ?? originCoordinate);

    if (bearing !== undefined) {
      logNavigationFullscreenDev('route bearing calculated', { bearing });
    }

    return bearing;
  }, [activeStep?.maneuverLocation, originCoordinate, routeCoordinates, userCoordinate]);

  const fullRouteShape = useMemo(() => {
    const features: GeoJSON.Feature[] = [];
    if (navigationRoute?.features?.length) features.push(...navigationRoute.features);
    if (operationalRoute?.features?.length) features.push(...operationalRoute.features);
    if (operationalRouteMarkers?.features?.length)
      features.push(...operationalRouteMarkers.features);

    return features.length > 0
      ? ({
          type: 'FeatureCollection',
          features,
        } as GeoJSON.FeatureCollection)
      : null;
  }, [navigationRoute, operationalRoute, operationalRouteMarkers]);

  const getCameraHeading = useCallback(
    (coordinate?: NavigationCoordinate | null, heading?: number) => {
      if (!activeMapModeOption.useBearing) return 0;
      if (heading !== undefined) return heading;

      const nextPoint = getNextRoutePointAhead(coordinate, routeCoordinates);
      return calculateBearing(coordinate, nextPoint) ?? routeBearing;
    },
    [activeMapModeOption.useBearing, routeBearing, routeCoordinates]
  );

  const setNavigationCamera = useCallback(
    (coordinate: NavigationCoordinate, heading?: number, animationDuration = 600) => {
      if (!cameraRef.current) return;

      const cameraHeading = getCameraHeading(coordinate, heading);

      cameraRef.current.setCamera({
        centerCoordinate: coordinateToPosition(coordinate),
        zoomLevel: activeMapModeOption.zoomLevel,
        pitch: activeMapModeOption.pitch,
        heading: cameraHeading,
        padding: {
          paddingTop: activeMapModeOption.followPerspective ? 210 : 120,
          paddingRight: 32,
          paddingBottom: activeMapModeOption.followPerspective ? 70 : 120,
          paddingLeft: 32,
        },
        animationDuration,
      });

      if (activeMapModeOption.followPerspective) {
        logNavigationFullscreenDev('camera pitch mode enabled', {
          pitch: activeMapModeOption.pitch,
          zoom: activeMapModeOption.zoomLevel,
          heading: cameraHeading,
        });
      }

      logNavigationMapModeDev('camera updated for mode', {
        mode: activeMapModeOption.mode,
        pitch: activeMapModeOption.pitch,
        zoom: activeMapModeOption.zoomLevel,
        heading: cameraHeading,
      });
    },
    [activeMapModeOption, getCameraHeading]
  );

  const fitShape = useCallback(
    (shape: GeoJSON.FeatureCollection | null) => {
      if (!shape?.features.length || !cameraRef.current) return;

      const bbox = turf.bbox(shape);
      if (!bbox.every(Number.isFinite)) return;

      cameraRef.current.setCamera({
        bounds: {
          ne: [bbox[2], bbox[3]],
          sw: [bbox[0], bbox[1]],
        },
        padding: {
          paddingTop: 170,
          paddingRight: 60,
          paddingBottom: 130,
          paddingLeft: 60,
        },
        pitch: activeMapModeOption.followPerspective ? 10 : 0,
        heading: 0,
        animationDuration: 800,
      });
    },
    [activeMapModeOption.followPerspective]
  );

  const fitFullRoute = useCallback(() => {
    setIsFollowingUser(false);
    logNavigationFullscreenDev('fit full route');
    fitShape(fullRouteShape);
  }, [fitShape, fullRouteShape]);

  const recenterUser = useCallback(() => {
    if (!userCoordinate) return;

    setIsFollowingUser(true);
    logNavigationFullscreenDev('follow user enabled');
    logNavigationFullscreenDev('recenter user', { userCoordinate });
    setNavigationCamera(userCoordinate, userHeading);
  }, [setNavigationCamera, userCoordinate, userHeading]);

  const pauseFollowByGesture = useCallback(() => {
    setIsFollowingUser((wasFollowing) => {
      if (wasFollowing) {
        logNavigationFullscreenDev('follow user paused by gesture');
      }
      return false;
    });
  }, []);

  const centerStart = useCallback(() => {
    if (!startCoordinate || !cameraRef.current) return;

    setIsFollowingUser(false);
    cameraRef.current.setCamera({
      centerCoordinate: coordinateToPosition(startCoordinate),
      zoomLevel: 16,
      pitch: activeMapModeOption.followPerspective ? 20 : 0,
      heading: activeMapModeOption.useBearing ? routeBearing : 0,
      animationDuration: 600,
    });
  }, [
    activeMapModeOption.followPerspective,
    activeMapModeOption.useBearing,
    routeBearing,
    startCoordinate,
  ]);

  const fitOperation = useCallback(() => {
    setIsFollowingUser(false);
    logNavigationFullscreenDev('fit operation');
    fitShape(operationalRoute);
  }, [fitShape, operationalRoute]);

  const closeFullscreen = useCallback(() => {
    Speech.stop();
    lastSpokenStepKeyRef.current = null;
    logNavigationVoiceDev('voice stopped on close');
    logNavigationFullscreenDev('closed');
    onClose();
  }, [onClose]);

  const speakInstruction = useCallback(
    (step: MapboxNavigationStep | null, stepIndex: number, force = false) => {
      if (!step || !isVoiceEnabled) return;

      const stepKey = buildNavigationVoiceStepKey(step, stepIndex);
      if (!force && lastSpokenStepKeyRef.current === stepKey) {
        logNavigationVoiceDev('instruction already spoken, skipping', { stepIndex });
        return;
      }

      const text = buildSpokenNavigationInstruction(step, distanceToManeuverMetersRef.current);
      if (!text.trim()) return;

      try {
        Speech.stop();
        Speech.speak(text, {
          language: 'pt-BR',
          voice: selectedVoiceIdRef.current,
          rate: 0.95,
          pitch: 1,
          volume: 1,
          onError: (error) => {
            logNavigationVoiceDev('speech failed', { error });
          },
        });

        lastSpokenStepKeyRef.current = stepKey;
        logNavigationVoiceDev('speaking instruction', { stepIndex, text });
      } catch (error) {
        logNavigationVoiceDev('speech failed', { error });
      }
    },
    [isVoiceEnabled]
  );

  const toggleVoice = useCallback(() => {
    setIsVoiceEnabled((wasEnabled) => {
      const nextEnabled = !wasEnabled;

      if (!nextEnabled) {
        Speech.stop();
        logNavigationVoiceDev('voice disabled');
        logNavigationVoiceDev('speech stopped');
        return false;
      }

      lastSpokenStepKeyRef.current = null;
      logNavigationVoiceDev('voice enabled');
      return true;
    });
  }, []);

  const changeMapMode = useCallback(
    (nextMode: NavigationMapMode) => {
      const nextOption = NAVIGATION_MAP_MODE_OPTIONS.find((option) => option.mode === nextMode);
      if (!nextOption || nextMode === mapMode) {
        setIsMapModeSelectorOpen(false);
        return;
      }

      setMapMode(nextMode);
      setIsMapModeSelectorOpen(false);
      setIsStyleLoaded(false);

      logNavigationMapModeDev('mode changed', {
        previousMode: mapMode,
        nextMode,
      });
      logNavigationMapModeDev('style changed', {
        mode: nextMode,
        styleURL: nextOption.styleURL,
      });
    },
    [mapMode]
  );

  const handleUserLocationUpdate = useCallback(
    (location: any) => {
      const longitude = Number(location?.coords?.longitude);
      const latitude = Number(location?.coords?.latitude);
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return;

      const heading = Number(location?.coords?.heading);
      const nextHeading = Number.isFinite(heading) && heading >= 0 ? heading : undefined;
      const nextCoordinate = { longitude, latitude };

      setUserCoordinate(nextCoordinate);
      setUserHeading(nextHeading);

      if (isFollowingUser) {
        setNavigationCamera(nextCoordinate, nextHeading, 300);
      }

      setActiveStepIndex((currentIndex) => {
        const nextIndex = getNextStepIndex({
          activeStepIndex: currentIndex,
          steps,
          userCoordinate: nextCoordinate,
        });

        if (nextIndex !== currentIndex) {
          logNavigationInstructionsDev('active step changed', {
            previousStepIndex: currentIndex,
            activeStepIndex: nextIndex,
          });
        }

        return nextIndex;
      });
    },
    [isFollowingUser, setNavigationCamera, steps]
  );

  useEffect(() => {
    if (!visible) return;

    setActiveStepIndex(0);
    setUserCoordinate(originCoordinate);
    setUserHeading(undefined);
    setIsFollowingUser(true);
    setMapMode('navigation3d');
    setIsMapModeSelectorOpen(false);
    setIsVoiceEnabled(true);
    lastSpokenStepKeyRef.current = null;
    logNavigationFullscreenDev('opened portrait navigation');
    logNavigationFullscreenDev('follow user enabled');
    logNavigationInstructionsDev('steps loaded', { stepsCount: steps.length });
  }, [originCoordinate, steps.length, visible]);

  useEffect(() => {
    if (!visible || !isStyleLoaded || !originCoordinate) return;
    setNavigationCamera(originCoordinate, routeBearing, 800);
  }, [
    activeMapModeOption.mode,
    isStyleLoaded,
    originCoordinate,
    routeBearing,
    setNavigationCamera,
    visible,
  ]);

  useEffect(() => {
    distanceToManeuverMetersRef.current = distanceToManeuverMeters;
  }, [distanceToManeuverMeters]);

  useEffect(() => {
    if (!visible) return;

    let isMounted = true;

    Speech.getAvailableVoicesAsync()
      .then((voices) => {
        if (!isMounted) return;

        const portugueseVoice = voices.find((voice) => {
          const language = voice.language?.toLocaleLowerCase();
          return language === 'pt-br' || language === 'pt_br';
        });

        if (portugueseVoice?.identifier) {
          selectedVoiceIdRef.current = portugueseVoice.identifier;
          logNavigationVoiceDev('pt-BR voice selected', {
            language: portugueseVoice.language,
          });
          return;
        }

        selectedVoiceIdRef.current = undefined;
        logNavigationVoiceDev('pt-BR voice not found, using language fallback');
      })
      .catch((error) => {
        selectedVoiceIdRef.current = undefined;
        logNavigationVoiceDev('voice lookup failed', { error });
      });

    return () => {
      isMounted = false;
    };
  }, [visible]);

  useEffect(() => {
    if (!visible || !isVoiceEnabled || !activeStep) return;
    speakInstruction(activeStep, activeStepIndex);
  }, [activeStep, activeStepIndex, isVoiceEnabled, speakInstruction, visible]);

  useEffect(() => {
    if (visible) return;

    Speech.stop();
    lastSpokenStepKeyRef.current = null;
    logNavigationVoiceDev('speech stopped');
  }, [visible]);

  const arrivalLabel = getEstimatedArrivalTime(remainingSummary.durationSeconds);
  const durationLabel = formatNavigationDuration(remainingSummary.durationSeconds);
  const distanceLabel = formatTripDistance(remainingSummary.distanceMeters);

  return (
    <Modal visible={visible} animationType='slide' presentationStyle='fullScreen'>
      <SafeAreaView style={styles.container}>
        <MapView
          style={styles.map}
          attributionEnabled={false}
          logoEnabled={false}
          scaleBarEnabled={false}
          compassEnabled={true}
          styleURL={activeMapModeOption.styleURL}
          scrollEnabled={true}
          zoomEnabled={true}
          pitchEnabled={true}
          rotateEnabled={true}
          onTouchMove={pauseFollowByGesture}
          onDidFinishLoadingStyle={() => setIsStyleLoaded(true)}
        >
          <Camera ref={cameraRef} />
          <Mapbox.UserLocation
            visible={true}
            showsUserHeadingIndicator={true}
            onUpdate={handleUserLocationUpdate}
          />

          {operationalRoute && (
            <ShapeSource id='fullscreen-operational-route-source' shape={operationalRoute}>
              <LineLayer
                id='fullscreen-operational-route-line'
                style={{
                  lineColor: '#FF6B6B',
                  lineWidth: 4,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
            </ShapeSource>
          )}

          {navigationRoute && (
            <ShapeSource id='fullscreen-navigation-route-source' shape={navigationRoute}>
              <LineLayer
                id='fullscreen-navigation-route-line'
                style={{
                  lineColor: '#0D6EFD',
                  lineWidth: 7,
                  lineOpacity: 0.96,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
            </ShapeSource>
          )}

          {operationalRouteMarkers && (
            <ShapeSource id='fullscreen-operational-markers-source' shape={operationalRouteMarkers}>
              <CircleLayer
                id='fullscreen-operational-markers-circle'
                style={{
                  circleRadius: 8,
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
                id='fullscreen-operational-markers-label'
                style={{
                  textField: ['get', 'label'],
                  textSize: 13,
                  textColor: '#FFFFFF',
                  textHaloColor: '#000000',
                  textHaloWidth: 2,
                  textOffset: [0, 1.45],
                  textAnchor: 'top',
                }}
              />
            </ShapeSource>
          )}
        </MapView>

        <NavigationInstructionPanel
          activeStep={activeStep}
          distanceToManeuverMeters={distanceToManeuverMeters}
        />

        <NavigationMapStyleSelector
          activeMode={mapMode}
          options={NAVIGATION_MAP_MODE_OPTIONS}
          isOpen={isMapModeSelectorOpen}
          onToggle={() => setIsMapModeSelectorOpen((isOpen) => !isOpen)}
          onSelectMode={changeMapMode}
        />

        <View style={styles.actions}>
          <ActionButton icon='crosshairs-gps' label='Minha posição' onPress={recenterUser} />
          <ActionButton icon='map-search' label='Rota completa' onPress={fitFullRoute} />
          <ActionButton icon='flag-outline' label='Início' onPress={centerStart} />
          <ActionButton icon='routes' label='Operação' onPress={fitOperation} />
          <ActionButton
            icon={isVoiceEnabled ? 'volume-high' : 'volume-off'}
            label={isVoiceEnabled ? 'Voz' : 'Mudo'}
            onPress={toggleVoice}
          />
        </View>

        {routeSummary ? (
          <View style={[styles.routeSummaryPanel, { bottom: Math.max(insets.bottom + 90, 96) }]}>
            <Text style={styles.routeSummaryTitle} numberOfLines={1}>
              {routeSummary.routeName}
            </Text>
            <View style={styles.routeSummaryMetrics}>
              <TripMetric
                value={formatTripDistance(routeSummary.mapboxDistanceMeters)}
                label='até entrada'
              />
              <View style={styles.metricDivider} />
              <TripMetric
                value={formatTripDistance(routeSummary.operationalDistanceMeters)}
                label='operacional'
              />
              <View style={styles.metricDivider} />
              <TripMetric
                value={formatTripDistance(routeSummary.totalDistanceMeters)}
                label='total'
              />
            </View>
            {routeSummary.isAutomatic ? (
              <Text style={styles.routeSummaryHint} numberOfLines={2}>
                Melhor entrada calculada automaticamente entre {routeSummary.routeCount} rotas
                cadastradas
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={[styles.bottomPanel, { bottom: Math.max(insets.bottom + 10, 16) }]}>
          <TouchableOpacity
            style={styles.endCircleButton}
            onPress={closeFullscreen}
            accessibilityLabel='Encerrar navegação'
          >
            <MaterialCommunityIcons name='close' size={22} color='#FFFFFF' />
          </TouchableOpacity>

          <View style={styles.tripMetrics}>
            <TripMetric value={arrivalLabel} label='chegada' />
            <View style={styles.metricDivider} />
            <TripMetric value={durationLabel} label='tempo' />
            <View style={styles.metricDivider} />
            <TripMetric value={distanceLabel} label='distância' />
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.actionWrap}>
      <TouchableOpacity style={styles.actionButton} onPress={onPress}>
        <MaterialCommunityIcons name={icon} size={21} color='#111827' />
      </TouchableOpacity>
      <Text style={styles.actionText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function TripMetric({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.metricBlock}>
      <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.metricLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  map: {
    flex: 1,
  },
  actions: {
    position: 'absolute',
    right: 12,
    top: 170,
    zIndex: 10,
    gap: 9,
    alignItems: 'center',
  },
  actionWrap: {
    alignItems: 'center',
    gap: 3,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    maxWidth: 76,
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
    textShadowColor: '#000000',
    textShadowRadius: 3,
  },
  routeSummaryPanel: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  routeSummaryTitle: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '900',
  },
  routeSummaryMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeSummaryHint: {
    color: '#1D4ED8',
    fontSize: 11,
    fontWeight: '800',
  },
  bottomPanel: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 10,
    minHeight: 68,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  endCircleButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tripMetrics: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricBlock: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  metricValue: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
  metricLabel: {
    color: '#6B7280',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 2,
  },
  metricDivider: {
    width: StyleSheet.hairlineWidth,
    height: 34,
    backgroundColor: '#D1D5DB',
  },
});
