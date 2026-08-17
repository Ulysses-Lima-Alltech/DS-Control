import { Entypo } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import MapViewer from '@/components/Map/MapViewer';
import TextInputSearchMultipleFarms from '@/components/TextInputSearchMultipleFarms';
import { COLORS, SHADOWS } from '@/constants/colors';
import { Farm } from '@/types/farm.type';

export type SelectedPlotDetail = {
  id: string;
  name: string;
  farmId: string;
  farmName: string;
};

type FarmPlotMapPickerProps = {
  farms: Farm[];
  customerId?: string;
  visible: boolean;
  initialSelectedPlots: SelectedPlotDetail[];
  onClose: () => void;
  onConfirm: (plotDetails: SelectedPlotDetail[]) => void;
};

export default function FarmPlotMapPicker({
  farms,
  customerId,
  visible,
  initialSelectedPlots,
  onClose,
  onConfirm,
}: FarmPlotMapPickerProps) {
  const [selectedPlotsById, setSelectedPlotsById] = useState<Map<string, SelectedPlotDetail>>(
    new Map()
  );
  const [focusedFarms, setFocusedFarms] = useState<Farm[]>([]);

  const handleOpen = () => {
    setSelectedPlotsById(new Map(initialSelectedPlots.map((plot) => [plot.id, plot])));
    setFocusedFarms([]);
  };

  const displayedFarms = focusedFarms.length > 0 ? focusedFarms : farms;
  const selectedPlotIds = useMemo(
    () => Array.from(selectedPlotsById.keys()),
    [selectedPlotsById]
  );

  const handlePlotPress = (plotId: string) => {
    setSelectedPlotsById((previous) => {
      const next = new Map(previous);
      if (next.has(plotId)) {
        next.delete(plotId);
        return next;
      }
      const farm = displayedFarms.find((candidate) =>
        (candidate.plots || []).some((plot) => plot.id === plotId)
      );
      const plot = farm?.plots?.find((candidate) => candidate.id === plotId);
      if (farm && plot) {
        next.set(plotId, { id: plotId, name: plot.name, farmId: farm.id, farmName: farm.name });
      }
      return next;
    });
  };

  const handleConfirm = () => {
    onConfirm(Array.from(selectedPlotsById.values()));
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType='slide'
      presentationStyle='pageSheet'
      onShow={handleOpen}
    >
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <Entypo name='map' size={14} color={COLORS.blue} />
          <Text numberOfLines={1} style={styles.title}>
            {displayedFarms.length === 1
              ? displayedFarms[0].name
              : displayedFarms.length > 1
                ? `${displayedFarms.length} fazendas`
                : 'Selecionar talhões'}
          </Text>
        </View>
        <TouchableOpacity onPress={onClose}>
          <Entypo name='cross' size={20} color={COLORS.blue} />
        </TouchableOpacity>
      </View>

      <Text style={styles.hint}>Toque nos talhões desejados no mapa para selecioná-los.</Text>

      <View style={styles.mapWrap}>
        <MapViewer
          selectedFarmId={
            displayedFarms.length > 0 ? displayedFarms.map((farm) => farm.id).join('|') : null
          }
          plots={displayedFarms.flatMap((farm) => farm.plots ?? [])}
          farms={displayedFarms}
          selectedPlotIds={selectedPlotIds}
          disablePlotDetailModal
          onPlotPress={handlePlotPress}
          buttonsOffset={{ mapControls: { bottom: 20 } }}
        />
        {customerId && (
          <TextInputSearchMultipleFarms
            placeholder='Buscar fazenda no mapa...'
            customerId={customerId}
            selectedFarmsExternal={focusedFarms}
            onFarmsSelect={setFocusedFarms}
          />
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.selectionCount}>
          {selectedPlotIds.length}{' '}
          {selectedPlotIds.length === 1 ? 'talhão selecionado' : 'talhões selecionados'}
        </Text>
        <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
          <Text style={styles.confirmButtonText}>Confirmar seleção</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  titleWrap: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  hint: {
    fontSize: 12,
    color: COLORS.textMuted,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.surface,
  },
  mapWrap: { flex: 1 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    ...SHADOWS.card,
  },
  selectionCount: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  confirmButton: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  confirmButtonText: { color: COLORS.white, fontWeight: '800' },
});
