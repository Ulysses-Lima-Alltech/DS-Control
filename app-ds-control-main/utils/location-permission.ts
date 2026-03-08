import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

export const useLocationPermission = () => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(
    null
  );

  const requestLocationPermission = async () => {
    try {
      setIsLoading(true);

      const isEnabled = await Location.hasServicesEnabledAsync();
      if (!isEnabled) {
        Alert.alert(
          'Serviços de Localização',
          'Os serviços de localização estão desabilitados. Por favor, habilite-os nas configurações do seu dispositivo.',
          [
            { text: 'OK', onPress: () => setHasPermission(false) },
            { text: 'Configurações', onPress: () => Location.enableNetworkProviderAsync() },
          ]
        );
        return false;
      }

      const { status: existingStatus } = await Location.getForegroundPermissionsAsync();

      if (existingStatus === 'granted') {
        setHasPermission(true);
        try {
          const lastKnown = await Location.getLastKnownPositionAsync();
          if (lastKnown?.coords) {
            setUserLocation({
              latitude: lastKnown.coords.latitude,
              longitude: lastKnown.coords.longitude,
            });
          }
        } catch {}
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        })
          .then(({ coords }) => {
            setUserLocation({ latitude: coords.latitude, longitude: coords.longitude });
          })
          .catch(() => {});
        return true;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status === 'granted') {
        setHasPermission(true);
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        })
          .then(({ coords }) => {
            setUserLocation({ latitude: coords.latitude, longitude: coords.longitude });
          })
          .catch(() => {
            // Ignore transient errors; permission is granted
          });
        return true;
      } else {
        Alert.alert(
          'Permissão de Localização',
          'Para uma melhor experiência, este app precisa acessar sua localização. Você pode conceder permissão nas configurações do app.',
          [{ text: 'OK', onPress: () => setHasPermission(false) }]
        );
        setHasPermission(false);
        return false;
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
      // Only set permission false if we truly know it's denied; generic errors shouldn't flip state
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    requestLocationPermission();
  }, []);

  return {
    userLocation,
    hasPermission,
    isLoading,
    requestLocationPermission,
  };
};
