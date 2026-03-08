import { View, ActivityIndicator } from 'react-native';

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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size='large' color='#EAAE07' />
      </View>
    );
  }

  return <>{children}</>;
};
