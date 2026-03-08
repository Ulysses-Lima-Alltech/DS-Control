import { FlashList } from '@shopify/flash-list';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useGetApplicationsByPlotId } from '@/queries/application.query';
import { Application } from '@/types/applications.type';
import formatDateToDDMMYYYY from '@/utils/date-formatter';

interface ApplicationPlotHistoryProps {
  plotId?: string;
  headerComponent?: React.ReactElement;
}

const ApplicationPlotHistory: React.FC<ApplicationPlotHistoryProps> = ({ plotId }) => {
  const { data: applicationsData, error, refetch } = useGetApplicationsByPlotId(plotId ?? '');

  const applications: Application[] = applicationsData?.data ?? [];

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const renderApplication = ({ item }: { item: Application }) => (
    <View style={styles.applicationCard}>
      <View style={styles.applicationHeader}>
        <Text style={styles.applicationTitle}>Aplicação de {item.product.name}</Text>
        <Text style={styles.applicationDate}>{formatDateToDDMMYYYY(item.date)}</Text>
      </View>
      <Text style={styles.applicationInfo}>Piloto: {item.pilot.name}</Text>
      <Text style={styles.applicationInfo}>Ajudante: {item.assistant.name}</Text>
      <Text style={styles.applicationInfo}>Drone: {item.drone.name}</Text>
      <Text style={styles.applicationInfo}>Hectares: {item.hectares}</Text>
      <Text style={styles.applicationInfo}>Talhão: {item.plot.name}</Text>
      <Text style={styles.applicationInfo}>Cultivo: {item.culture.name}</Text>
      <Text style={styles.applicationInfo}>Vazão: {item.flowRate} L/ha</Text>
      <Text style={styles.applicationInfo}>Altitude: {item.altitude} m</Text>
      <Text style={styles.applicationInfo}>Espaçamento de rota: {item.routeSpacing} m</Text>
      <Text style={styles.applicationInfo}>Tamanho de gota: {item.dropletSize} µm</Text>
      {item.observations && (
        <Text style={styles.applicationInfo}>Observações: {item.observations}</Text>
      )}
    </View>
  );

  if (!plotId) {
    return null;
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text>Erro ao carregar aplicações do talhão</Text>
      </View>
    );
  }

  return (
    <>
      <FlashList
        scrollEnabled={false}
        ListHeaderComponent={<Text style={styles.title}>Histórico de aplicações</Text>}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Nenhuma aplicação encontrada para esse talhão</Text>
        }
        data={applications}
        estimatedItemSize={20}
        keyExtractor={(item) => item.id}
        renderItem={renderApplication}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={handleRefresh}
      />
    </>
  );
};

export default ApplicationPlotHistory;

const styles = StyleSheet.create({
  centerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  listContent: {
    paddingVertical: 12,
    paddingHorizontal: 2,
  },
  applicationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  applicationHeader: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  applicationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1C1C1E',
  },
  applicationDate: {
    fontSize: 12,
    color: '#8E8E93',
  },
  applicationInfo: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 16,
  },
});
