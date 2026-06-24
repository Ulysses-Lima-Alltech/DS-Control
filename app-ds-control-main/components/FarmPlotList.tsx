import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, TextInput } from 'react-native';

import { COLORS } from '@/constants/colors';
import { useAuth } from '@/providers/auth.provider';
import { Farm } from '@/types/farm.type';
import { Plot } from '@/types/plot.type';
import { isAdministrativeRole } from '@/utils/user-role';

export type FarmPlotListProps = {
  farms: Farm[];
  plots: Plot[];
  selectedPlot?: Plot;
  onPlotPress: (plot: Plot) => void;
  defaultExpanded?: boolean;
};

const toSearchableText = (value: unknown) => (typeof value === 'string' ? value : '');

export default function FarmPlotList({
  farms,
  plots,
  selectedPlot,
  onPlotPress,
  defaultExpanded = false,
}: FarmPlotListProps) {
  const { user } = useAuth();
  const isAdministrativeUser = isAdministrativeRole(user?.type);
  const [expandedFarms, setExpandedFarms] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  const safeFarms = useMemo(() => (Array.isArray(farms) ? farms : []), [farms]);
  const safePlots = useMemo(() => (Array.isArray(plots) ? plots : []), [plots]);

  useEffect(() => {
    const nextExpandedFarmIds = defaultExpanded
      ? new Set(
          safeFarms
            .map((farm) => (farm?.id == null ? '' : String(farm.id)))
            .filter((farmId) => Boolean(farmId))
        )
      : new Set<string>();

    setExpandedFarms((previousExpandedFarmIds) => {
      if (previousExpandedFarmIds.size === nextExpandedFarmIds.size) {
        let isSame = true;
        for (const farmId of previousExpandedFarmIds) {
          if (!nextExpandedFarmIds.has(farmId)) {
            isSame = false;
            break;
          }
        }
        if (isSame) return previousExpandedFarmIds;
      }

      return nextExpandedFarmIds;
    });
  }, [safeFarms, defaultExpanded]);

  const { filteredFarms, filteredPlots } = useMemo(() => {
    if (!searchTerm.trim()) {
      return { filteredFarms: safeFarms, filteredPlots: safePlots };
    }

    const searchLower = searchTerm.toLowerCase();

    const matchingPlots = safePlots.filter((plot) =>
      toSearchableText(plot?.name).toLowerCase().includes(searchLower)
    );

    const matchingFarms = safeFarms.filter((farm) => {
      const farmNameMatches = toSearchableText(farm?.name).toLowerCase().includes(searchLower);
      const farmId = farm?.id == null ? '' : String(farm.id);
      const hasMatchingPlots = matchingPlots.some((plot) => String(plot?.farmId ?? '') === farmId);
      return farmNameMatches || hasMatchingPlots;
    });

    return { filteredFarms: matchingFarms, filteredPlots: matchingPlots };
  }, [safeFarms, safePlots, searchTerm]);

  const toggleFarmExpansion = (farmId: string) => {
    setExpandedFarms((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(farmId)) {
        newSet.delete(farmId);
      } else {
        newSet.add(farmId);
      }
      return newSet;
    });
  };

  const renderPlotBadge = (plot: Plot, index: number) => {
    const isSelected = selectedPlot?.id === plot.id;
    return (
      <TouchableOpacity
        key={String(plot?.id ?? `${plot?.farmId ?? 'plot'}-${index}`)}
        style={[styles.plotCard, isSelected && styles.selectedPlotCard]}
        onPress={() => onPlotPress(plot)}
      >
        <Text style={[styles.plotName, isSelected && styles.selectedPlotName]}>
          {toSearchableText(plot?.name) || 'Talhao sem nome'}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderFarmPlots = () => {
    if (!filteredFarms || filteredFarms.length === 0) return null;

    const farmsToRender = filteredFarms
      .map((farm) => {
        const farmNameMatches =
          !searchTerm.trim() ||
          toSearchableText(farm?.name).toLowerCase().includes(searchTerm.toLowerCase());
        const farmId = farm?.id == null ? '' : String(farm.id);

        const farmPlots = farmNameMatches
          ? safePlots.filter((p) => String(p?.farmId ?? '') === farmId)
          : filteredPlots.filter((p) => String(p?.farmId ?? '') === farmId);

        if (farmPlots.length === 0) return null;

        const isExpanded = expandedFarms.has(farmId);

        return (
          <View key={farmId} style={styles.farmSection}>
            <TouchableOpacity style={styles.farmHeader} onPress={() => toggleFarmExpansion(farmId)}>
              <Text style={styles.farmTitle}>
                {isAdministrativeUser ? `${farm?.customer?.name ?? '-'} - ` : 'Fazenda: '}
                {toSearchableText(farm?.name) || 'Fazenda sem nome'}
              </Text>
              <Text style={styles.chevron}>{isExpanded ? 'v' : '>'}</Text>
            </TouchableOpacity>
            {isExpanded && (
              <View style={styles.plotsContainer}>{farmPlots.map(renderPlotBadge)}</View>
            )}
          </View>
        );
      })
      .filter(Boolean);

    return farmsToRender;
  };

  const renderEmptyState = () => {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyStateTitle}>Nenhum resultado encontrado</Text>
        <Text style={styles.emptyStateSubtitle}>
          Tente buscar por outro nome de fazenda ou talhao
        </Text>
      </View>
    );
  };

  const farmsToShow = renderFarmPlots();
  const hasSearchTerm = searchTerm.trim().length > 0;
  const hasResults = farmsToShow && farmsToShow.length > 0;

  return (
    <View>
      <TextInput
        style={styles.searchInput}
        placeholder='Buscar fazenda ou talhao...'
        value={searchTerm}
        onChangeText={setSearchTerm}
        placeholderTextColor={COLORS.textMuted}
      />
      {hasResults ? farmsToShow : hasSearchTerm ? renderEmptyState() : null}
    </View>
  );
}

const styles = StyleSheet.create({
  searchInput: {
    height: 52,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 16,
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: COLORS.surface,
  },
  plotsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  farmSection: {
    marginTop: 12,
  },
  farmHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  farmTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
    flex: 1,
  },
  chevron: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginLeft: 8,
  },
  plotCard: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: COLORS.primarySoft,
    marginRight: 8,
    marginBottom: 8,
  },
  selectedPlotCard: {
    backgroundColor: COLORS.primary,
  },
  plotName: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  selectedPlotName: {
    color: COLORS.white,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
