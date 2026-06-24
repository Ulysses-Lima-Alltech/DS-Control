import { StyleSheet, Text, View } from 'react-native';

import ApplicationPlotHistory from '@/components/ApplicationPlotHistory';
import { COLORS } from '@/constants/colors';
import { Plot } from '@/types/plot.type';

export type PlotDetailsProps = {
  selectedPlot?: Plot;
  showApplicationHistory?: boolean;
  plotDetailsContent?: (selectedPlot: Plot | undefined) => React.ReactNode;
};

export default function PlotDetails({
  selectedPlot,
  showApplicationHistory = false,
  plotDetailsContent,
}: PlotDetailsProps) {
  if (!selectedPlot) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.plotDetails}>
        <Text style={styles.plotDetailsTitle}>Detalhes do Talhão</Text>
        <Text style={styles.plotDetailsInfo}>Nome: {selectedPlot.name}</Text>
        {selectedPlot.hectare && (
          <Text style={styles.plotDetailsInfo}>Hectares: {selectedPlot.hectare}</Text>
        )}
        {plotDetailsContent && plotDetailsContent(selectedPlot)}
      </View>

      {showApplicationHistory && <ApplicationPlotHistory plotId={selectedPlot.id} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 20,
  },
  plotDetails: {
    marginTop: 20,
  },
  plotDetailsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  plotDetailsInfo: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginBottom: 4,
  },
});
