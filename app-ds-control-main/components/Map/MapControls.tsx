import { View } from 'react-native';
import { TouchableOpacity } from 'react-native';
import { FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

import { COLORS } from '@/constants/colors';

interface ButtonsOffset {
  bottom?: number;
  left?: number;
}
interface MapControlsProps {
  farmIsLoaded: boolean;
  moveCameraToGeodataBbox: () => void;
  toggleCameraLockedOnUserLocation: () => void;
  isCameraLockedOnUserLocation: boolean;
  setIsCameraLockedOnUserLocation: (isCameraLockedOnUserLocation: boolean) => void;
  buttonsOffset?: ButtonsOffset;
}

export default function MapControls({
  farmIsLoaded,
  moveCameraToGeodataBbox,
  toggleCameraLockedOnUserLocation,
  isCameraLockedOnUserLocation,
  setIsCameraLockedOnUserLocation,
  buttonsOffset,
}: MapControlsProps) {
  return (
    <View
      style={{
        position: 'absolute',
        bottom: 9 + (buttonsOffset?.bottom ?? 0),
        left: 9 + (buttonsOffset?.left ?? 0),
        alignItems: 'center',
        zIndex: 10,
        gap: 9,
      }}
    >
      <TouchableOpacity
        style={{
          width: 38,
          height: 38,
          borderRadius: 20,
          opacity: farmIsLoaded ? 1 : 0.5,
          backgroundColor: farmIsLoaded ? COLORS.text : COLORS.textMuted,
          justifyContent: 'center',
          alignItems: 'center',
          elevation: 3,
          shadowColor: COLORS.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
        }}
        onPressIn={() => {
          if (!farmIsLoaded) {
            Toast.show({
              type: 'info',
              text1: 'Fazenda não carregada',
            });
            return;
          }
          setIsCameraLockedOnUserLocation(false);
        }}
        onPress={moveCameraToGeodataBbox}
        disabled={!farmIsLoaded}
      >
        <FontAwesome5 name='map-marker-alt' size={18} color='white' />
      </TouchableOpacity>
      <TouchableOpacity
        style={{
          width: 38,
          height: 38,
          borderRadius: 20,
          backgroundColor: COLORS.text,
          justifyContent: 'center',
          alignItems: 'center',
          elevation: 3,
          shadowColor: COLORS.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
        }}
        onPress={toggleCameraLockedOnUserLocation}
      >
        <MaterialIcons
          name='gps-fixed'
          size={18}
          color={isCameraLockedOnUserLocation ? COLORS.primary : COLORS.white}
        />
      </TouchableOpacity>
    </View>
  );
}
