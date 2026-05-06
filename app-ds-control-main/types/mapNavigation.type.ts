export type NavigationCoordinate = {
  longitude: number;
  latitude: number;
};

export type MapNavigationCoordinate = NavigationCoordinate;

export type NavigationMapMode = 'navigation3d' | 'light2d' | 'dark2d';

export type NavigationMapModeOption = {
  mode: NavigationMapMode;
  label: string;
  description: string;
  styleURL: string;
  pitch: number;
  zoomLevel: number;
  useBearing: boolean;
  followPerspective: boolean;
};

export type MapboxNavigationStep = {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  maneuverType?: string;
  maneuverModifier?: string;
  maneuverLocation: NavigationCoordinate;
};

export type MapboxDirectionsResult = {
  geoJson: GeoJSON.FeatureCollection<GeoJSON.LineString>;
  distance?: number;
  duration?: number;
  distanceMeters?: number;
  durationSeconds?: number;
  steps: MapboxNavigationStep[];
};

export type MapboxDirectionsRoute = MapboxDirectionsResult;

export type MapboxDirectionsErrorCode =
  | 'missing-token'
  | 'invalid-coordinate'
  | 'timeout'
  | 'no-route'
  | 'http-error'
  | 'invalid-response'
  | 'unknown';

export class MapboxDirectionsError extends Error {
  code: MapboxDirectionsErrorCode;
  mapboxCode?: string;

  constructor(message: string, code: MapboxDirectionsErrorCode, mapboxCode?: string) {
    super(message);
    this.name = 'MapboxDirectionsError';
    this.code = code;
    this.mapboxCode = mapboxCode;
  }
}
