import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet } from 'react-native';

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
        <Ionicons name='business' size={24} color='#007AFF' />
        <Text style={styles.statNumber}>{statistics.totalFarms}</Text>
        <Text style={styles.statLabel}>Fazendas</Text>
      </View>

      <View style={styles.statCard}>
        <Ionicons name='map' size={24} color='#34C759' />
        <Text style={styles.statNumber}>{statistics.totalPlots}</Text>
        <Text style={styles.statLabel}>Talhões</Text>
      </View>

      <View style={styles.statCard}>
        <Ionicons name='leaf' size={24} color='#FF9500' />
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
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginTop: 5,
    textOverflow: 'hidden',
  },
  statLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
});
