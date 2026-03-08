import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, TextInput } from 'react-native';

import { Farm } from '@/types/farm.type';
import { Plot } from '@/types/plot.type';

import { useAuth } from '../providers/auth.provider';

export type FarmPlotListProps = {
  farms: Farm[];
  plots: Plot[];
  selectedPlot?: Plot;
  onPlotPress: (plot: Plot) => void;
  defaultExpanded?: boolean;
};

export default function FarmPlotList({
  farms,
  plots,
  selectedPlot,
  onPlotPress,
  defaultExpanded = false,
}: FarmPlotListProps) {
  const { user } = useAuth();
  const [expandedFarms, setExpandedFarms] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (defaultExpanded) {
      setExpandedFarms(new Set(farms.map((farm) => farm.id)));
    } else {
      setExpandedFarms(new Set());
    }
  }, [farms, defaultExpanded]);

  const { filteredFarms, filteredPlots } = useMemo(() => {
    if (!searchTerm.trim()) {
      return { filteredFarms: farms, filteredPlots: plots };
    }

    const searchLower = searchTerm.toLowerCase();

    const matchingPlots = plots.filter((plot) => plot.name.toLowerCase().includes(searchLower));

    const matchingFarms = farms.filter((farm) => {
      const farmNameMatches = farm.name.toLowerCase().includes(searchLower);
      const hasMatchingPlots = matchingPlots.some((plot) => plot.farmId === farm.id);
      return farmNameMatches || hasMatchingPlots;
    });

    return { filteredFarms: matchingFarms, filteredPlots: matchingPlots };
  }, [farms, plots, searchTerm]);

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
  const renderPlotBadge = (plot: Plot) => {
    const isSelected = selectedPlot?.id === plot.id;
    return (
      <TouchableOpacity
        key={plot.id}
        style={[styles.plotCard, isSelected && styles.selectedPlotCard]}
        onPress={() => onPlotPress(plot)}
      >
        <Text style={[styles.plotName, isSelected && styles.selectedPlotName]}>{plot.name}</Text>
      </TouchableOpacity>
    );
  };

  const renderFarmPlots = () => {
    if (!filteredFarms || filteredFarms.length === 0) return null;

    const farmsToRender = filteredFarms
      .map((farm) => {
        const farmNameMatches =
          !searchTerm.trim() || farm.name.toLowerCase().includes(searchTerm.toLowerCase());
        const farmPlots = farmNameMatches
          ? plots.filter((p) => p.farmId === farm.id)
          : filteredPlots.filter((p) => p.farmId === farm.id);

        if (farmPlots.length === 0) return null;

        const isExpanded = expandedFarms.has(farm.id);

        return (
          <View key={farm.id} style={styles.farmSection}>
            <TouchableOpacity
              style={styles.farmHeader}
              onPress={() => toggleFarmExpansion(farm.id)}
            >
              <Text style={styles.farmTitle}>
                {user?.type === 'backoffice' ? `${farm.customer.name} - ` : 'Fazenda: '} {farm.name}
              </Text>
              <Text style={styles.chevron}>{isExpanded ? '▼' : '▶'}</Text>
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
          Tente buscar por outro nome de fazenda ou talhão
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
        placeholder='Buscar fazenda ou talhão...'
        value={searchTerm}
        onChangeText={setSearchTerm}
        placeholderTextColor='gray'
      />
      {hasResults ? farmsToShow : hasSearchTerm ? renderEmptyState() : null}
    </View>
  );
}

const styles = StyleSheet.create({
  searchInput: {
    height: 40,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
    fontSize: 16,
    color: '#1C1C1E',
    backgroundColor: '#FFFFFF',
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
    color: '#1C1C1E',
    flex: 1,
  },
  chevron: {
    fontSize: 12,
    color: '#8E8E93',
    marginLeft: 8,
  },
  plotCard: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#EFEFF4',
    marginRight: 8,
    marginBottom: 8,
  },
  selectedPlotCard: {
    backgroundColor: '#EAAE07',
  },
  plotName: {
    fontSize: 12,
    color: '#8E8E93',
  },
  selectedPlotName: {
    color: '#FFFFFF',
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
    color: '#1C1C1E',
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
  },
});
