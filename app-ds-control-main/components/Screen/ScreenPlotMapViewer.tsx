import { useLocalSearchParams } from 'expo-router';

import { StyleSheet, Text, View } from 'react-native';

import PlotMapViewer from '@/components/PlotMapViewer';
import { useAuth } from '@/providers/auth.provider';
import { useGetAllFarms } from '@/queries/farm.query';
import { Plot } from '@/types/plot.type';
import { Farm } from '@/types/farm.type';
import LoadingDSIcon from '@/components/IconLoadingDS';

export default function ScreenPlotMapViewer() {
  const { user } = useAuth();
  const { plotId } = useLocalSearchParams<{ plotId?: string }>();

  if (!user) {
    return null;
  }

  const {
    data: farmsFromQuery,
    isLoading: isLoadingFarms,
    refetch,
    error: farmsError,
    isError: isErrorFarms,
  } = useGetAllFarms(user.type === 'backoffice' ? undefined : user.customerId, {
    includePlots: 'true',
    includeGeoJson: 'true',
    includeCustomer: 'true',
  });

  const farms: Farm[] = farmsFromQuery?.farms ?? [];
  const plots: Plot[] = farms
    .flatMap((farm) => farm.plots ?? [])
    .filter((plot) => plot.deletedAt === null);

  const renderHeaderContent = () => (
    <>
      <View style={styles.customerHeader}>
        <Text style={styles.customerTitle}>{user.name ?? 'N/A'}</Text>
      </View>

      <Text style={styles.customerInfo}>Total de fazendas: {farms.length}</Text>
      <Text style={styles.customerInfo}>Total de talhões: {plots.length}</Text>
    </>
  );

  const renderPlotDetailsContent = (selectedPlot: Plot | undefined) => {
    if (!selectedPlot) return null;

    return (
      <Text style={styles.plotDetailsInfo}>
        Fazenda: {farms.find((f: Farm) => f.id === selectedPlot.farmId)?.name ?? 'N/A'}
      </Text>
    );
  };

  const handleRefresh = async () => {
    await refetch();
  };

  if (isLoadingFarms) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <LoadingDSIcon />
      </View>
    );
  }

  if (isErrorFarms) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text>Erro ao carregar fazendas</Text>
        <Text style={{ color: 'red' }}>{farmsError.message}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <PlotMapViewer
        farms={farms}
        plots={plots}
        error={farmsError}
        onRefresh={handleRefresh}
        headerContent={renderHeaderContent()}
        plotDetailsContent={renderPlotDetailsContent}
        defaultExpanded={false}
        showApplicationHistory={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  customerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  customerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginRight: 10,
  },
  customerInfo: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 6,
  },
  plotDetailsInfo: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
});
