import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

interface ButtonAddNewApplicationProps {
  serviceOrderId: string;
  plotId?: string;
  plotName?: string;
  plotMaxHectare?: string;
}

const ButtonAddNewApplication: React.FC<ButtonAddNewApplicationProps> = ({
  serviceOrderId,
  plotId,
  plotName,
  plotMaxHectare,
}) => {
  const { bottom } = useSafeAreaInsets();
  const router = useRouter();

  const handlePress = () => {
    router.push({
      pathname: '/pilot/service-orders/form-application',
      params: {
        serviceOrderId,
        formMode: 'new',
        ...(plotId && { plotId }),
        ...(plotName && { plotName }),
        ...(plotMaxHectare && { plotMaxHectare }),
      },
    });
  };

  return (
    <TouchableOpacity
      style={[styles.floatingButton, { bottom: bottom + 44 }]}
      onPress={handlePress}
    >
      <Text style={styles.floatingButtonText}>+</Text>
    </TouchableOpacity>
  );
};

export default ButtonAddNewApplication;

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EAAE07',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  floatingButtonText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
});
