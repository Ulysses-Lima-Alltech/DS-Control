import { Entypo } from '@expo/vector-icons';
import { View, Text, Modal, TouchableOpacity } from 'react-native';
import { COLORS } from '@/constants/colors';
import MapViewer from '@/components/Map/MapViewer';
import { useGetFarmById } from '@/queries/farm.query';
import Toast from 'react-native-toast-message';

interface ModalMapFarmViewerProps {
  farmId: string;
  visible: boolean;
  setVisible: (visible: boolean) => void;
}

export default function ModalMapFarmViewer({
  farmId,
  visible,
  setVisible,
}: ModalMapFarmViewerProps) {
  const {
    data: farmData,
    isFetching: isFetchingFarm,
    isError,
  } = useGetFarmById(farmId, {
    includePlots: 'true',
    includeGeoJson: 'true',
  });

  if (isError) {
    Toast.show({
      type: 'error',
      text1: 'Erro ao carregar fazenda',
    });
    setVisible(false);
  }

  return (
    <Modal visible={visible} animationType='slide' presentationStyle='pageSheet'>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingTop: 18,
          paddingBottom: 12,
          backgroundColor: COLORS.surface,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.border,
          justifyContent: 'space-between',
        }}
      >
        {/* Title */}
        <View
          style={{
            flexShrink: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'nowrap',
          }}
        >
          <Entypo name='map' size={14} color={COLORS.blue} />
          <Text
            numberOfLines={1}
            style={{
              fontSize: 14,
              fontWeight: '600',
              color: COLORS.text,
              flexWrap: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {isFetchingFarm ? 'Baixando fazenda...' : `MAPA - ${farmData?.farm?.name}`}
          </Text>
        </View>
        {/* Close button */}
        <TouchableOpacity
          style={{ alignSelf: 'flex-end', alignItems: 'flex-end' }}
          onPress={() => setVisible(false)}
        >
          <Entypo name='cross' size={18} color={COLORS.blue} />
        </TouchableOpacity>
      </View>

      {/* Map */}
      <View style={{ flex: 1, padding: 0 }}>
        <MapViewer
          showMapTools={false}
          isFetching={isFetchingFarm}
          selectedFarmId={farmId}
          plots={farmData?.farm?.plots ?? []}
          buttonsOffset={{ mapControls: { bottom: 20 } }}
        />
      </View>
    </Modal>
  );
}
