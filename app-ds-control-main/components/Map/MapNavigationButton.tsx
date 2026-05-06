import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, View, TouchableOpacity, Text, StyleSheet } from 'react-native';

interface MapNavigationButtonProps {
  isNavigationMode: boolean;
  onToggleNavigationMode: () => void;
  disabled?: boolean;
  onGoNow?: () => void;
  showGoNow?: boolean;
  goNowDisabled?: boolean;
  goNowLoading?: boolean;
}

export default function MapNavigationButton({
  isNavigationMode,
  onToggleNavigationMode,
  disabled = false,
  onGoNow,
  showGoNow = false,
  goNowDisabled = false,
  goNowLoading = false,
}: MapNavigationButtonProps) {
  const isGoNowDisabled = goNowDisabled || goNowLoading;

  return (
    <View style={styles.container}>
      {showGoNow && (
        <TouchableOpacity
          style={[
            styles.goNowButton,
            isGoNowDisabled && {
              opacity: 0.5,
              backgroundColor: '#666666',
            },
          ]}
          onPress={onGoNow}
          disabled={isGoNowDisabled}
        >
          {goNowLoading ? (
            <ActivityIndicator size='small' color='white' />
          ) : (
            <MaterialCommunityIcons name='navigation-variant' size={16} color='white' />
          )}
          <Text style={styles.goNowButtonText}>
            {goNowLoading ? 'Calculando rota...' : 'Ir agora'}
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[
          styles.navigationButton,
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

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 9,
    right: 9,
    alignItems: 'flex-end',
    zIndex: 2,
    gap: 8,
  },
  goNowButton: {
    height: 38,
    borderRadius: 19,
    backgroundColor: '#0D6EFD',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    paddingHorizontal: 12,
    flexDirection: 'row',
    gap: 6,
  },
  goNowButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
  navigationButton: {
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
});
