import { MapboxNavigationStep, NavigationCoordinate } from '@/types/mapNavigation.type';

export const formatNavigationDistance = (distanceMeters?: number) => {
  if (!Number.isFinite(distanceMeters) || distanceMeters === undefined) return '--';

  if (distanceMeters < 1000) {
    return `${Math.max(0, Math.round(distanceMeters))} m`;
  }

  return `${(distanceMeters / 1000).toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} km`;
};

export const buildInstructionFallback = (step?: MapboxNavigationStep | null) => {
  if (!step) return 'Instruções indisponíveis para esta rota.';
  if (step.instruction?.trim()) return step.instruction.trim();

  const maneuver = [step.maneuverType, step.maneuverModifier].filter(Boolean).join(' ');
  return maneuver ? `Siga: ${maneuver}` : 'Siga pela rota indicada.';
};

export const getManeuverTitle = (step?: MapboxNavigationStep | null) => {
  if (!step) return 'Instruções indisponíveis';

  const type = step.maneuverType;
  const modifier = step.maneuverModifier;

  if (type === 'turn' && modifier?.includes('right')) return 'Vire à direita';
  if (type === 'turn' && modifier?.includes('left')) return 'Vire à esquerda';
  if (type === 'continue') return 'Siga em frente';
  if (type === 'depart') return 'Inicie a rota';
  if (type === 'arrive') return 'Chegada';
  if (type === 'roundabout' || type === 'rotary') return 'Rotatória';
  if (type === 'merge') return 'Entre na via';
  if (type === 'fork') return 'Mantenha-se';
  if (type === 'end of road') return 'Fim da via';

  return buildInstructionFallback(step);
};

export const getManeuverRoadName = (step?: MapboxNavigationStep | null) => {
  const instruction = step?.instruction?.trim();
  if (!instruction) return '';

  const ontoMatch = instruction.match(/\bonto\s+(.+?)(\.|$)/i);
  if (ontoMatch?.[1]) return ontoMatch[1].trim();

  const onMatch = instruction.match(/\bon\s+(.+?)(\.|$)/i);
  if (onMatch?.[1]) return onMatch[1].trim();

  const emMatch = instruction.match(/\bem\s+(.+?)(\.|$)/i);
  if (emMatch?.[1]) return emMatch[1].trim();

  return instruction;
};

export const getManeuverIconName = (step?: MapboxNavigationStep | null) => {
  const modifier = step?.maneuverModifier;
  if (modifier?.includes('right')) return 'arrow-right-top';
  if (modifier?.includes('left')) return 'arrow-left-top';
  if (step?.maneuverType === 'arrive') return 'flag-checkered';
  if (step?.maneuverType === 'roundabout' || step?.maneuverType === 'rotary')
    return 'rotate-3d-variant';
  if (step?.maneuverType === 'merge') return 'merge';
  if (step?.maneuverType === 'fork') return 'source-fork';
  return 'arrow-up';
};

export const formatNavigationDuration = (durationSeconds?: number) => {
  if (!Number.isFinite(durationSeconds) || durationSeconds === undefined) return '--';

  const minutes = Math.max(1, Math.round(durationSeconds / 60));
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours} h ${remainingMinutes} min` : `${hours} h`;
};

export const getEstimatedArrivalTime = (durationSeconds?: number) => {
  if (!Number.isFinite(durationSeconds) || durationSeconds === undefined) return '--:--';

  const arrival = new Date(Date.now() + durationSeconds * 1000);
  return arrival.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const getRemainingNavigationSummary = (
  steps: MapboxNavigationStep[],
  activeStepIndex: number
) => {
  const remainingSteps = steps.slice(activeStepIndex);

  return remainingSteps.reduce(
    (summary, step) => ({
      distanceMeters: summary.distanceMeters + step.distanceMeters,
      durationSeconds: summary.durationSeconds + step.durationSeconds,
    }),
    {
      distanceMeters: 0,
      durationSeconds: 0,
    }
  );
};

export const calculateBearing = (
  from?: NavigationCoordinate | null,
  to?: NavigationCoordinate | null
) => {
  if (!from || !to) return undefined;

  const toRadians = (value: number) => (value * Math.PI) / 180;
  const toDegrees = (value: number) => (value * 180) / Math.PI;

  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);
  const deltaLongitude = toRadians(to.longitude - from.longitude);

  const y = Math.sin(deltaLongitude) * Math.cos(toLatitude);
  const x =
    Math.cos(fromLatitude) * Math.sin(toLatitude) -
    Math.sin(fromLatitude) * Math.cos(toLatitude) * Math.cos(deltaLongitude);

  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
};

export const getRouteCoordinatesFromLineString = (
  navigationRoute?: GeoJSON.FeatureCollection<GeoJSON.LineString> | null
): NavigationCoordinate[] => {
  const coordinates = navigationRoute?.features?.[0]?.geometry?.coordinates;
  if (!Array.isArray(coordinates)) return [];

  return coordinates
    .map((coordinate) => ({
      longitude: Number(coordinate[0]),
      latitude: Number(coordinate[1]),
    }))
    .filter(
      (coordinate) =>
        Number.isFinite(coordinate.longitude) &&
        Number.isFinite(coordinate.latitude) &&
        coordinate.longitude >= -180 &&
        coordinate.longitude <= 180 &&
        coordinate.latitude >= -90 &&
        coordinate.latitude <= 90
    );
};

export const getNextRoutePointAhead = (
  currentLocation?: NavigationCoordinate | null,
  routeCoordinates: NavigationCoordinate[] = []
) => {
  if (!currentLocation || routeCoordinates.length === 0) return routeCoordinates[1] ?? null;

  let closestIndex = 0;
  let closestDistance = Infinity;

  routeCoordinates.forEach((coordinate, index) => {
    const distance = getDistanceMetersBetweenCoordinates(currentLocation, coordinate) ?? Infinity;
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  });

  return routeCoordinates[Math.min(closestIndex + 4, routeCoordinates.length - 1)] ?? null;
};

export const getInitialNavigationBearing = (
  routeCoordinates: NavigationCoordinate[],
  origin?: NavigationCoordinate | null
) => {
  if (origin) {
    return calculateBearing(origin, getNextRoutePointAhead(origin, routeCoordinates));
  }

  return calculateBearing(routeCoordinates[0], routeCoordinates[1]);
};

export const getDistanceMetersBetweenCoordinates = (
  origin?: NavigationCoordinate | null,
  destination?: NavigationCoordinate | null
) => {
  if (!origin || !destination) return undefined;

  const earthRadiusMeters = 6371000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const deltaLatitude = toRadians(destination.latitude - origin.latitude);
  const deltaLongitude = toRadians(destination.longitude - origin.longitude);
  const originLatitude = toRadians(origin.latitude);
  const destinationLatitude = toRadians(destination.latitude);

  const haversine =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(originLatitude) * Math.cos(destinationLatitude) * Math.sin(deltaLongitude / 2) ** 2;

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

export const getNextStepIndex = ({
  activeStepIndex,
  steps,
  userCoordinate,
  thresholdMeters = 45,
}: {
  activeStepIndex: number;
  steps: MapboxNavigationStep[];
  userCoordinate?: NavigationCoordinate | null;
  thresholdMeters?: number;
}) => {
  const activeStep = steps[activeStepIndex];
  if (!activeStep || !userCoordinate) return activeStepIndex;

  const distanceMeters = getDistanceMetersBetweenCoordinates(
    userCoordinate,
    activeStep.maneuverLocation
  );

  if (
    distanceMeters !== undefined &&
    distanceMeters <= thresholdMeters &&
    activeStepIndex < steps.length - 1
  ) {
    return activeStepIndex + 1;
  }

  return activeStepIndex;
};
