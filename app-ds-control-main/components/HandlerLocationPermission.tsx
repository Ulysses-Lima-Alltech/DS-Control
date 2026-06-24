import { View, ActivityIndicator } from 'react-native';

import { COLORS } from '@/constants/colors';
import { useLocationPermission } from '@/utils/location-permission';

interface LocationPermissionHandlerProps {
  children: React.ReactNode;
}

export const LocationPermissionHandler: React.FC<LocationPermissionHandlerProps> = ({
  children,
}) => {
  const { isLoading } = useLocationPermission();

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: COLORS.background,
        }}
      >
        <ActivityIndicator size='large' color={COLORS.primary} />
      </View>
    );
  }

  return <>{children}</>;
};
