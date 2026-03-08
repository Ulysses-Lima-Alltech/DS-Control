import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface MapNavigationButtonProps {
  isNavigationMode: boolean;
  onToggleNavigationMode: () => void;
  disabled?: boolean;
}

export default function MapNavigationButton({
  isNavigationMode,
  onToggleNavigationMode,
  disabled = false,
}: MapNavigationButtonProps) {
  return (
    <View
      style={{
        position: 'absolute',
        bottom: 9,
        right: 9,
        alignItems: 'center',
        zIndex: 2,
      }}
    >
      <TouchableOpacity
        style={[
          {
            width: 38,
            height: 38,
            borderRadius: 20,
            backgroundColor: '#000000',
            justifyContent: 'center',
            alignItems: 'center',
            elevation: 3,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
          },
          isNavigationMode && {
            backgroundColor: '#EAAE07',
          },
          disabled && {
            opacity: 0.5,
            backgroundColor: '#666666',
          },
        ]}
        onPress={onToggleNavigationMode}
        disabled={disabled}
      >
        <MaterialCommunityIcons
          name={isNavigationMode ? 'navigation' : 'navigation-outline'}
          size={20}
          color='white'
        />
      </TouchableOpacity>
    </View>
  );
}
