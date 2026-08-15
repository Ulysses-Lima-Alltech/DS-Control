import { Entypo } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import MapViewer from '@/components/Map/MapViewer';
import { COLORS, SHADOWS } from '@/constants/colors';
import { Farm } from '@/types/farm.type';

type FarmPlotMapPickerProps = {
  farm: Farm | undefined;
  visible: boolean;
  initialSelectedPlotIds: string[];
  onClose: () => void;
  onConfirm: (plotIds: string[]) => void;
};

export default function FarmPlotMapPicker({
  farm,
  visible,
  initialSelectedPlotIds,
  onClose,
  onConfirm,
}: FarmPlotMapPickerProps) {
  const [selectedPlotIds, setSelectedPlotIds] = useState<string[]>(initialSelectedPlotIds);

  const handleOpen = () => {
    setSelectedPlotIds(initialSelectedPlotIds);
  };

  const handlePlotPress = (plotId: string) => {
    setSelectedPlotIds((previous) =>
      previous.includes(plotId) ? previous.filter((id) => id !== plotId) : [...previous, plotId]
    );
  };

  const handleConfirm = () => {
    onConfirm(selectedPlotIds);
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
            {farm?.name || 'Selecionar talhões'}
          </Text>
        </View>
        <TouchableOpacity onPress={onClose}>
          <Entypo name='cross' size={20} color={COLORS.blue} />
        </TouchableOpacity>
      </View>

      <Text style={styles.hint}>Toque nos talhões desejados no mapa para selecioná-los.</Text>

      <View style={styles.mapWrap}>
        <MapViewer
          selectedFarmId={farm?.id ?? null}
          plots={farm?.plots ?? []}
          farms={farm ? [farm] : []}
          selectedPlotIds={selectedPlotIds}
          disablePlotDetailModal
          onPlotPress={handlePlotPress}
          buttonsOffset={{ mapControls: { bottom: 20 } }}
        />
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
