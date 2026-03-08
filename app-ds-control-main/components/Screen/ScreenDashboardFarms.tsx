import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  RefreshControl,
  TouchableOpacity,
  TextInput,
} from 'react-native';

import LoadingDSIcon from '@/components/IconLoadingDS';
import { useAuth } from '@/providers/auth.provider';
import { useGetAllFarmsInfinite } from '@/queries/farm.query';
import { Farm } from '@/types/farm.type';
import { InfiniteData } from '@tanstack/react-query';
import { debounce } from 'lodash';
import StatsFarms from '@/components/StatsFarms';

export default function ScreenDashboardFarms() {
  const { user } = useAuth();
  const router = useRouter();
  const [farmSearchInput, setFarmSearchInput] = React.useState('');
  const [farmSearch, setFarmSearch] = React.useState('');

  const debouncedSetFarmSearch = debounce(setFarmSearch, 300);

  const {
    data: farmsFromInfiniteQuery,
    fetchNextPage: fetchNextPageFarms,
    hasNextPage: hasNextPageFarms,
    isFetchingNextPage: isFetchingNextPageFarms,
    isLoading: isLoadingFarms,
    refetch,
    error: farmsError,
  } = useGetAllFarmsInfinite(user?.type === 'backoffice' ? undefined : user?.customerId, {
    includePlots: 'true',
    includeGeoJson: 'false',
    includeCustomer: 'false',
    limit: '5',
    search: farmSearch || undefined,
  });

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetch()]);
    setRefreshing(false);
  };

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 20;

    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom) {
      if (hasNextPageFarms && !isFetchingNextPageFarms) {
        fetchNextPageFarms();
      }
    }
  };

  const handleFarmPress = (farm: Farm) => {
    if (farm) {
      router.replace(
        `/${user?.type === 'backoffice' ? 'backoffice' : 'farmer'}/map?initialFarmId=${farm.id}`
      );
    }
  };

  const allListedFarms =
    (farmsFromInfiniteQuery as unknown as InfiniteData<{ data: Farm[] }>)?.pages?.flatMap(
      (page: { data: Farm[] }) => page.data
    ) || [];

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      onScroll={handleScroll}
    >
      <View style={styles.header}>
        <Text style={styles.title}>DS Control</Text>
        <Text style={styles.subtitle}>
          {user?.type === 'backoffice' ? 'Painel Administrativo' : 'Painel do Fazendeiro'}
        </Text>
        <Text style={styles.welcomeText}>Olá, {user?.name}!</Text>
      </View>
      <StatsFarms />

      {allListedFarms && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {user?.type === 'backoffice' ? 'Fazendas' : 'Suas Fazendas'}
            </Text>
            <Ionicons name='business-outline' size={20} color='#007AFF' />
          </View>

          <TextInput
            style={styles.searchInput}
            placeholder='Pesquisar fazenda'
            placeholderTextColor='gray'
            value={farmSearchInput}
            onChangeText={(text) => {
              setFarmSearchInput(text);
              debouncedSetFarmSearch(text);
            }}
          />

          {isLoadingFarms && (
            <View style={styles.loadingMore}>
              <LoadingDSIcon />
              <Text style={styles.loadingMoreText}>Carregando fazendas...</Text>
            </View>
          )}

          {farmsError && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateTitle}>Erro ao carregar fazendas</Text>
              <Text style={styles.emptyStateText}>{farmsError.message}</Text>
            </View>
          )}

          {allListedFarms.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name='business-outline' size={64} color='#C7C7CC' />
              <Text style={styles.emptyStateTitle}>Nenhuma fazenda encontrada</Text>
              <Text style={styles.emptyStateText}>
                Entre em contato com o administrador para configurar suas fazendas.
              </Text>
            </View>
          )}

          {allListedFarms.length > 0 && (
            <>
              {allListedFarms.map((farm: Farm) => (
                <TouchableOpacity
                  key={farm.id}
                  style={styles.farmCard}
                  onPress={() => handleFarmPress(farm)}
                >
                  <View style={styles.farmHeader}>
                    <Text style={styles.farmName}>{farm.name}</Text>
                    <View style={styles.farmStats}>
                      <Text style={styles.farmStatsText}>{farm.plots.length} talhões</Text>
                    </View>
                  </View>

                  <View style={styles.farmDetails}>
                    <View style={styles.farmDetailItem}>
                      <Ionicons name='location-outline' size={16} color='#8E8E93' />
                      <Text style={styles.farmDetailText}>
                        {farm.plots
                          .reduce((sum: number, plot) => sum + parseFloat(plot.hectare || '0'), 0)
                          .toFixed(1)}{' '}
                        ha
                      </Text>
                    </View>
                    <View style={styles.farmDetailItem}>
                      <Ionicons name='time-outline' size={16} color='#8E8E93' />
                      <Text style={styles.farmDetailText}>
                        {new Date(farm.createdAt).toLocaleDateString('pt-BR')}
                      </Text>
                    </View>
                  </View>

                  {farm.plots.length > 0 && (
                    <View style={styles.plotsPreview}>
                      <Text style={styles.plotsPreviewTitle}>Talhões:</Text>
                      <View style={styles.plotsList}>
                        {farm.plots.slice(0, 3).map((plot) => (
                          <View key={plot.id} style={styles.plotChip}>
                            <Text style={styles.plotChipText}>{plot.name}</Text>
                            <Text style={styles.plotChipHectare}>{plot.hectare}ha</Text>
                          </View>
                        ))}
                        {farm.plots.length > 3 && (
                          <View style={styles.plotChip}>
                            <Text style={styles.plotChipText}>+{farm.plots.length - 3} mais</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </>
          )}

          {isFetchingNextPageFarms && (
            <View style={styles.loadingMore}>
              <LoadingDSIcon />
              <Text style={styles.loadingMoreText}>Carregando mais fazendas...</Text>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    marginBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
    marginBottom: 5,
  },
  welcomeText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  section: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1C1E',
  },
  farmCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  farmHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  farmName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1C1E',
    flex: 1,
  },
  farmStats: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  farmStatsText: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },
  farmDetails: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  farmDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  farmDetailText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  plotsPreview: {
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
    paddingTop: 12,
  },
  plotsPreviewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  plotsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  plotChip: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  plotChipText: {
    fontSize: 12,
    color: '#1C1C1E',
    fontWeight: '500',
  },
  plotChipHectare: {
    fontSize: 12,
    color: '#8E8E93',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#8E8E93',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#C7C7CC',
    textAlign: 'center',
    lineHeight: 24,
  },
  loadingMore: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    gap: 10,
  },
  loadingMoreText: {
    fontSize: 14,
    color: '#8E8E93',
  },
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
});
