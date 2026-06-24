import { Ionicons } from '@expo/vector-icons';
import { InfiniteData } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { debounce } from 'lodash';
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
import StatsFarms from '@/components/StatsFarms';
import { COLORS, SHADOWS } from '@/constants/colors';
import { useAuth } from '@/providers/auth.provider';
import { useGetAllFarmsInfinite } from '@/queries/farm.query';
import { Farm } from '@/types/farm.type';
import { isAdministrativeRole } from '@/utils/user-role';

export default function ScreenDashboardFarms() {
  const { user } = useAuth();
  const router = useRouter();
  const isAdministrativeUser = isAdministrativeRole(user?.type);
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
  } = useGetAllFarmsInfinite(isAdministrativeUser ? undefined : user?.customerId, {
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
        `/${isAdministrativeUser ? 'backoffice' : 'farmer'}/map?initialFarmId=${farm.id}`
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
        <Text style={styles.title}>iControl Agras</Text>
        <Text style={styles.subtitle}>
          {isAdministrativeUser ? 'Painel Administrativo' : 'Painel do Fazendeiro'}
        </Text>
        <Text style={styles.welcomeText}>Olá, {user?.name}!</Text>
      </View>
      <StatsFarms />

      {allListedFarms && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {isAdministrativeUser ? 'Fazendas' : 'Suas Fazendas'}
            </Text>
            <Ionicons name='business-outline' size={20} color={COLORS.primaryDark} />
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
              <Ionicons name='business-outline' size={64} color={COLORS.borderStrong} />
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
                      <Ionicons name='location-outline' size={16} color={COLORS.primary} />
                      <Text style={styles.farmDetailText}>
                        {farm.plots
                          .reduce((sum: number, plot) => sum + parseFloat(plot.hectare || '0'), 0)
                          .toFixed(1)}{' '}
                        ha
                      </Text>
                    </View>
                    <View style={styles.farmDetailItem}>
                      <Ionicons name='time-outline' size={16} color={COLORS.primary} />
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
    backgroundColor: COLORS.background,
  },
  header: {
    padding: 22,
    backgroundColor: COLORS.primary,
    margin: 16,
    marginBottom: 18,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    ...SHADOWS.card,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.white,
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.primarySoft,
    marginBottom: 5,
    fontWeight: '600',
  },
  welcomeText: {
    fontSize: 14,
    color: COLORS.accentSoft,
    fontWeight: '700',
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
    fontWeight: '800',
    color: COLORS.text,
  },
  farmCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.card,
  },
  farmHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  farmName: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
    flex: 1,
  },
  farmStats: {
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  farmStatsText: {
    fontSize: 12,
    color: COLORS.primaryDark,
    fontWeight: '700',
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
    color: COLORS.textMuted,
  },
  plotsPreview: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
  },
  plotsPreviewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  plotsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  plotChip: {
    backgroundColor: COLORS.secondarySoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  plotChipText: {
    fontSize: 12,
    color: COLORS.primaryDark,
    fontWeight: '700',
  },
  plotChipHectare: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textMuted,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: COLORS.textMuted,
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
    color: COLORS.textMuted,
  },
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
});
