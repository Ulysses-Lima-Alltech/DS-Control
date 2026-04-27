import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { COLORS } from '@/constants/colors';

type DashboardKpiCardProps = {
  title: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  accentColor: string;
  isLoading?: boolean;
};

export default function DashboardKpiCard({
  title,
  value,
  icon,
  accentColor,
  isLoading = false,
}: DashboardKpiCardProps) {
  return (
    <View style={styles.card}>
      <View style={[styles.accent, { backgroundColor: accentColor }]} />
      <View style={styles.headerRow}>
        <Text style={styles.title}>{title}</Text>
        <View style={[styles.iconWrap, { backgroundColor: `${accentColor}20` }]}>
          <Ionicons name={icon} size={16} color={accentColor} />
        </View>
      </View>
      <Text style={styles.value}>{isLoading ? 'Carregando...' : value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.lightgray,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 96,
  },
  accent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 13,
    color: COLORS.gray,
    fontWeight: '600',
  },
  value: {
    marginTop: 10,
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.black,
  },
});
