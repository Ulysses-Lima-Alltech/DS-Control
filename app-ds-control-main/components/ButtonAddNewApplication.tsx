import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS, SHADOWS } from '@/constants/colors';

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
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.floating,
    zIndex: 1000,
  },
  floatingButtonText: {
    color: COLORS.white,
    fontSize: 24,
    fontWeight: '800',
  },
});
