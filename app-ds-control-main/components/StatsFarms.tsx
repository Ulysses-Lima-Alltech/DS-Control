import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet } from 'react-native';

import { COLORS, SHADOWS } from '@/constants/colors';
import { useGetAllFarms } from '@/queries/farm.query';
import { useAuth } from '../providers/auth.provider';
import { Farm } from '../types/farm.type';

export default function StatsFarms() {
  const { user } = useAuth();
  const { data } = useGetAllFarms(user?.customerId, {
    includePlots: 'true',
    includeGeoJson: 'false',
    includeCustomer: 'false',
  });

  const statistics: {
    totalFarms: number;
    totalPlots: number;
    totalHectares: number;
  } = {
    totalFarms: data?.farms.length ?? 0,
    totalPlots: data?.farms.flatMap((farm: Farm) => farm.plots).length ?? 0,
    totalHectares:
      data?.farms
        .flatMap((farm: Farm) => farm.plots)
        .reduce((sum, plot) => sum + parseFloat(plot.hectare || '0'), 0) ?? 0,
  };

  return (
    <View style={styles.statsContainer}>
      <View style={styles.statCard}>
        <View style={[styles.iconBubble, { backgroundColor: COLORS.primarySoft }]}>
          <Ionicons name='business-outline' size={22} color={COLORS.primaryDark} />
        </View>
        <Text style={styles.statNumber}>{statistics.totalFarms}</Text>
        <Text style={styles.statLabel}>Fazendas</Text>
      </View>

      <View style={styles.statCard}>
        <View style={[styles.iconBubble, { backgroundColor: COLORS.secondarySoft }]}>
          <Ionicons name='map-outline' size={22} color={COLORS.secondary} />
        </View>
        <Text style={styles.statNumber}>{statistics.totalPlots}</Text>
        <Text style={styles.statLabel}>Talhões</Text>
      </View>

      <View style={styles.statCard}>
        <View style={[styles.iconBubble, { backgroundColor: COLORS.accentSoft }]}>
          <Ionicons name='leaf-outline' size={22} color={COLORS.warning} />
        </View>
        <Text style={styles.statNumber}>
          {statistics.totalHectares > 9999
            ? statistics.totalHectares.toFixed(0)
            : statistics.totalHectares.toFixed(1)}
        </Text>
        <Text style={styles.statLabel}>Hectares</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    padding: 14,
    borderRadius: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.card,
  },
  iconBubble: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text,
    textOverflow: 'hidden',
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
    fontWeight: '600',
  },
});
