import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, RefreshControl, Dimensions } from 'react-native';

import FarmPlotList from '@/components/FarmPlotList';
import LoadingDSIcon from '@/components/IconLoadingDS';
import PlotDetails from '@/components/PlotDetails';
import MapViewer from '@/components/Map/MapViewer';
import Drawer from '@/components/ui/Drawer';
import { Farm } from '@/types/farm.type';
import { Plot } from '@/types/plot.type';

export type PlotMapViewerProps = {
  farms: Farm[];
  plots: Plot[];
  isLoadingServiceOrder?: boolean;
  error?: any;
  onRefresh?: () => Promise<void>;
  showApplicationHistory?: boolean;
  headerContent?: React.ReactNode;
  plotDetailsContent?: (selectedPlot: Plot | undefined) => React.ReactNode;
  onSelectedPlotChange?: (selectedPlot: Plot | undefined) => void;
  defaultExpanded?: boolean;
  onLoadMore?: () => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  initialPlotId?: string;
};

export default function PlotMapViewer({
  farms,
  plots,
  isLoadingServiceOrder,
  error,
  onRefresh,
  showApplicationHistory = false,
  headerContent,
  plotDetailsContent,
  onSelectedPlotChange,
  defaultExpanded = false,
  onLoadMore,
  hasNextPage,
  isFetchingNextPage,
  initialPlotId,
}: PlotMapViewerProps) {
  const [isLandscape, setIsLandscape] = useState(false);
  const [selectedPlot, setSelectedPlot] = useState<Plot | undefined>();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const updateIsLandscape = () => {
      const { width, height } = Dimensions.get('window');
      setIsLandscape(width > height);
    };
    updateIsLandscape();
    const subscription = Dimensions.addEventListener('change', updateIsLandscape);
    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (initialPlotId) {
      setSelectedPlot(plots.find((p) => p.id === initialPlotId));
    }
  }, [initialPlotId]);

  useEffect(() => {
    if (plots.length === 0) return;

    if (!selectedPlot || !plots.some((p) => p.id === selectedPlot.id)) {
      const initial = plots[0];
      setSelectedPlot(initial);
    }
  }, [plots]);

  const handleRefresh = async () => {
    if (!onRefresh) return;

    const currentPlot = selectedPlot;
    setRefreshing(true);
    setSelectedPlot(undefined);
    try {
      await onRefresh();
    } finally {
      setSelectedPlot(currentPlot);
      setRefreshing(false);
    }
  };

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 20;

    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom) {
      if (hasNextPage && !isFetchingNextPage && onLoadMore) {
        onLoadMore();
      }
    }
  };

  const handlePlotPress = (plot: Plot) => {
    setSelectedPlot(plot);
    onSelectedPlotChange?.(plot);
  };

  const handleMapPlotPress = (plotId: string) => {
    const plot = plots.find((p) => p.id === plotId);
    if (plot) {
      setSelectedPlot(plot);
      onSelectedPlotChange?.(plot);
    }
  };

  useEffect(() => {
    if (selectedPlot) {
      onSelectedPlotChange?.(selectedPlot);
    }
  }, [selectedPlot, onSelectedPlotChange]);

  const isLoading = isLoadingServiceOrder || !selectedPlot;

  if (isLoading) {
    return (
      <View style={[styles.centerContainer, { flex: 1 }]}>
        <LoadingDSIcon />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centerContainer, { flex: 1 }]}>
        <Text>Erro ao carregar dados</Text>
      </View>
    );
  }

  const renderFarmList = () => (
    <Drawer
      title='Fazendas e Talhões'
      defaultOpen={true}
      isLandscape={isLandscape}
      position={isLandscape ? 'left' : 'top'}
    >
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        onScroll={handleScroll}
        scrollEventThrottle={400}
      >
        <View style={styles.detailsCard}>
          {headerContent}
          <FarmPlotList
            farms={farms}
            plots={plots}
            selectedPlot={selectedPlot}
            onPlotPress={handlePlotPress}
            defaultExpanded={defaultExpanded}
          />
          {isFetchingNextPage && (
            <View style={styles.loadingMore}>
              <LoadingDSIcon />
              <Text style={styles.loadingMoreText}>Carregando mais fazendas...</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </Drawer>
  );

  const renderPlotDetails = () => (
    <Drawer
      title='Detalhes do Talhão'
      defaultOpen={false}
      isLandscape={isLandscape}
      position={isLandscape ? 'right' : 'bottom'}
    >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <PlotDetails
          selectedPlot={selectedPlot}
          showApplicationHistory={showApplicationHistory}
          plotDetailsContent={plotDetailsContent}
        />
      </ScrollView>
    </Drawer>
  );

  return (
    <View style={styles.container}>
      {isLandscape ? (
        <View style={styles.landscapeContainer}>
          <View style={styles.drawerContainer}>{renderFarmList()}</View>
          <View style={styles.mapContainer}>
            <MapViewer
              selectedFarmId={selectedPlot?.farmId ?? null}
              plots={plots}
              selectedPlotId={selectedPlot?.id}
              onPlotPress={handleMapPlotPress}
              showMapTools={false}
            />
          </View>
          <View style={styles.drawerContainer}>{renderPlotDetails()}</View>
        </View>
      ) : (
        <View style={styles.portraitContainer}>
          <View style={styles.drawerContainer}>{renderFarmList()}</View>
          <View style={styles.mapContainer}>
            <MapViewer
              selectedFarmId={selectedPlot?.farmId ?? null}
              plots={plots}
              selectedPlotId={selectedPlot?.id}
              onPlotPress={handleMapPlotPress}
              showMapTools={false}
            />
          </View>
          <View style={styles.drawerContainer}>{renderPlotDetails()}</View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  centerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  landscapeContainer: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    padding: 8,
  },
  portraitContainer: {
    flex: 1,
    gap: 8,
    padding: 8,
  },
  drawerContainer: {
    zIndex: 1,
  },
  mapContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  scrollView: {
    flex: 1,
  },
  detailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    paddingTop: 36,
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
});
