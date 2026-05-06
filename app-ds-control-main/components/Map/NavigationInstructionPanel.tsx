import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { MapboxNavigationStep } from '@/types/mapNavigation.type';
import {
  buildInstructionFallback,
  formatNavigationDistance,
  getManeuverIconName,
  getManeuverRoadName,
  getManeuverTitle,
} from '@/utils/navigationInstructionUtils';

type NavigationInstructionPanelProps = {
  activeStep?: MapboxNavigationStep | null;
  distanceToManeuverMeters?: number;
};

export default function NavigationInstructionPanel({
  activeStep,
  distanceToManeuverMeters,
}: NavigationInstructionPanelProps) {
  const distanceLabel = formatNavigationDistance(
    distanceToManeuverMeters ?? activeStep?.distanceMeters
  );

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <MaterialCommunityIcons name={getManeuverIconName(activeStep)} size={34} color='#FFFFFF' />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.distance}>{activeStep ? distanceLabel : '--'}</Text>
        <Text style={styles.title} numberOfLines={1}>
          {getManeuverTitle(activeStep)}
        </Text>
        <Text style={styles.road} numberOfLines={1}>
          {getManeuverRoadName(activeStep) || buildInstructionFallback(activeStep)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 52,
    left: 12,
    right: 12,
    zIndex: 10,
    minHeight: 100,
    borderRadius: 12,
    backgroundColor: 'rgba(17, 24, 39, 0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0D6EFD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
    gap: 3,
  },
  distance: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  road: {
    color: '#D1D5DB',
    fontSize: 13,
    fontWeight: '600',
  },
});
