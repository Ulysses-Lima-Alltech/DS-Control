import { Linking, Platform } from 'react-native';

export type NavigationCoordinate = {
  latitude: number;
  longitude: number;
};

type OpenExternalNavigationResult = {
  success: boolean;
  openedUrl?: string;
  error?: string;
};

const isValidCoordinate = (coordinate: NavigationCoordinate) => {
  return (
    Number.isFinite(coordinate.latitude) &&
    Number.isFinite(coordinate.longitude) &&
    Math.abs(coordinate.latitude) <= 90 &&
    Math.abs(coordinate.longitude) <= 180
  );
};

const formatCoordinate = (value: number) => value.toFixed(6);

const buildAndroidCandidates = ({ latitude, longitude }: NavigationCoordinate) => {
  const lat = formatCoordinate(latitude);
  const lng = formatCoordinate(longitude);

  return [
    `google.navigation:q=${lat},${lng}&mode=d`,
    `waze://?ll=${lat},${lng}&navigate=yes`,
    `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`,
    `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`,
  ];
};

const buildIOSCandidates = ({ latitude, longitude }: NavigationCoordinate) => {
  const lat = formatCoordinate(latitude);
  const lng = formatCoordinate(longitude);

  return [
    `maps://?daddr=${lat},${lng}&dirflg=d`,
    `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`,
    `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`,
    `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`,
  ];
};

export const buildExternalNavigationUrls = (coordinate: NavigationCoordinate) => {
  if (!isValidCoordinate(coordinate)) {
    return [];
  }

  if (Platform.OS === 'android') {
    return buildAndroidCandidates(coordinate);
  }

  return buildIOSCandidates(coordinate);
};

export const openExternalNavigation = async (
  coordinate: NavigationCoordinate
): Promise<OpenExternalNavigationResult> => {
  if (!isValidCoordinate(coordinate)) {
    return {
      success: false,
      error: 'invalid-coordinate',
    };
  }

  const candidates = buildExternalNavigationUrls(coordinate);

  for (const url of candidates) {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) continue;

      await Linking.openURL(url);
      return {
        success: true,
        openedUrl: url,
      };
    } catch (error) {
      console.error('[Navigation External] Failed to open URL', { url, error });
    }
  }

  return {
    success: false,
    error: 'no-supported-url',
  };
};
