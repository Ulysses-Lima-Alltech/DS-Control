import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import FarmPlotMapPicker from '@/components/Farmer/FarmPlotMapPicker';
import TextInputSearchMultipleFarms from '@/components/TextInputSearchMultipleFarms';
import DatePickeriOSModal from '@/components/ui/DatePickeriOSModal';
import SearchableMultiSelect from '@/components/ui/SearchableMultiSelect';
import SearchableSelectQuery from '@/components/ui/SearchableSelectQuery';
import { COLORS, SHADOWS } from '@/constants/colors';
import { useAuth } from '@/providers/auth.provider';
import {
  createServiceOrderRequest,
  submitServiceOrderRequest,
} from '@/services/customer-request.service';
import { Farm } from '@/types/farm.type';
import { isAndroid } from '@/utils/isAndroid';

const toYYYYMMDD = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const APPLICATION_TYPES = [
  { id: 'Pulverização', name: 'Pulverização' },
  { id: 'Pesticida', name: 'Pesticida' },
  { id: 'Herbicida', name: 'Herbicida' },
  { id: 'Fungicida', name: 'Fungicida' },
  { id: 'Inseticida', name: 'Inseticida' },
  { id: 'Adjuvante', name: 'Adjuvante' },
  { id: 'Outro', name: 'Outro' },
];

export default function CreateServiceOrderScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedFarms, setSelectedFarms] = useState<Farm[]>([]);
  const [plotIds, setPlotIds] = useState<string[]>([]);
  const [plannedDate, setPlannedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [applicationType, setApplicationType] = useState('Pulverização');
  const [observation, setObservation] = useState('');
  const [isMapPickerVisible, setIsMapPickerVisible] = useState(false);

  const previousSelectedFarmsRef = useRef<Farm[]>([]);
  useEffect(() => {
    const currentFarmIds = new Set(selectedFarms.map((farm) => farm.id));
    const removedFarms = previousSelectedFarmsRef.current.filter(
      (farm) => !currentFarmIds.has(farm.id)
    );
    if (removedFarms.length > 0) {
      const removedPlotIds = new Set(
        removedFarms.flatMap((farm) => (farm.plots || []).map((plot) => plot.id))
      );
      setPlotIds((previous) => previous.filter((plotId) => !removedPlotIds.has(plotId)));
    }
    previousSelectedFarmsRef.current = selectedFarms;
  }, [selectedFarms]);

  const isValid = selectedFarms.length > 0 && plotIds.length > 0 && Boolean(applicationType);

  const createMutation = useMutation({
    mutationFn: async () => {
      const created = await createServiceOrderRequest({
        farmIds: selectedFarms.map((farm) => farm.id),
        requestedDate: toYYYYMMDD(plannedDate),
        serviceType: applicationType,
        requestedPlotIds: plotIds,
        observation: observation.trim() || undefined,
      });
      await submitServiceOrderRequest(created.data.id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['farmer-service-order-requests'] });
      Alert.alert(
        'Solicitação enviada',
        'Sua solicitação foi enviada para aprovação do administrador. Você pode acompanhar o status em Solicitações.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    },
    onError: (error) =>
      Alert.alert(
        'Não foi possível enviar a solicitação',
        error instanceof Error ? error.message : 'Tente novamente.'
      ),
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name='arrow-back' size={22} color={COLORS.primaryDark} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Criar OS</Text>
          <Text style={styles.subtitle}>
            Sua solicitação será enviada para aprovação do administrador, que designará o piloto.
          </Text>
        </View>
      </View>

      <View style={[styles.formCard, styles.farmPickerCard]}>
        <Text style={styles.label}>Fazendas</Text>
        <Text style={styles.hint}>
          Selecione uma ou mais fazendas do seu cliente. Uma OS pode ter talhões de fazendas
          diferentes.
        </Text>
        <View style={styles.farmSearchWrap}>
          <TextInputSearchMultipleFarms
            placeholder='Buscar fazenda...'
            customerId={user?.customerId}
            selectedFarmsExternal={selectedFarms}
            onFarmsSelect={setSelectedFarms}
          />
        </View>
        {selectedFarms.length > 0 && (
          <View style={styles.chipsWrap}>
            {selectedFarms.map((farm) => (
              <View key={farm.id} style={styles.selectedFarmChip}>
                <Text style={styles.selectedFarmChipText}>{farm.name}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.formCard}>
        <Text style={styles.label}>Talhões</Text>
        {selectedFarms.length === 0 ? (
          <Text style={styles.hint}>Selecione ao menos uma fazenda para ver os talhões.</Text>
        ) : (
          <>
            {selectedFarms.map((farm) => {
              const plotOptions = (farm.plots || [])
                .filter((plot) => plot.id)
                .map((plot) => ({ id: plot.id as string, name: plot.name }));
              const farmPlotIdSet = new Set(plotOptions.map((plot) => plot.id));
              const selectedIdsForFarm = plotIds.filter((id) => farmPlotIdSet.has(id));
              const handleFarmPlotIdsChange = (nextIdsForFarm: string[]) => {
                const otherFarmsPlotIds = plotIds.filter((id) => !farmPlotIdSet.has(id));
                setPlotIds([...otherFarmsPlotIds, ...nextIdsForFarm]);
              };
              return (
                <View key={farm.id} style={styles.farmPlotsSection}>
                  <Text style={styles.farmPlotsTitle}>{farm.name}</Text>
                  {plotOptions.length === 0 ? (
                    <Text style={styles.hint}>Nenhum talhão cadastrado nesta fazenda.</Text>
                  ) : (
                    <SearchableMultiSelect
                      placeholder={`Buscar talhões de ${farm.name}...`}
                      listedData={plotOptions}
                      itemKey='name'
                      value={selectedIdsForFarm}
                      onChange={handleFarmPlotIdsChange}
                    />
                  )}
                </View>
              );
            })}
            <TouchableOpacity
              style={styles.mapPickerButton}
              onPress={() => setIsMapPickerVisible(true)}
            >
              <Ionicons name='map-outline' size={16} color={COLORS.primaryDark} />
              <Text style={styles.mapPickerButtonText}>Selecionar no mapa</Text>
            </TouchableOpacity>
          </>
        )}

        <Text style={styles.label}>Aplicação</Text>
        <SearchableSelectQuery
          placeholder='Selecione o tipo de aplicação'
          listedData={APPLICATION_TYPES}
          itemKey='name'
          value={applicationType}
          onItemSelect={setApplicationType}
        />

        <Text style={styles.label}>Data planejada</Text>
        {isAndroid ? (
          <>
            <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)}>
              <Text style={{ color: COLORS.text, paddingTop: 10 }}>
                {plannedDate.toLocaleDateString('pt-BR')}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={plannedDate}
                mode='date'
                display='default'
                onChange={(_, selectedDate) => {
                  setShowDatePicker(false);
                  if (selectedDate) setPlannedDate(selectedDate);
                }}
              />
            )}
          </>
        ) : (
          <DatePickeriOSModal value={plannedDate} onDateChange={setPlannedDate} />
        )}

        <Text style={styles.label}>Observação</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          multiline
          value={observation}
          onChangeText={setObservation}
          placeholder='Detalhes adicionais do serviço (opcional)'
        />

        <TouchableOpacity
          style={[styles.primaryButton, (!isValid || createMutation.isPending) && styles.disabled]}
          disabled={!isValid || createMutation.isPending}
          onPress={() => createMutation.mutate()}
        >
          {createMutation.isPending ? (
            <ActivityIndicator size='small' color={COLORS.white} />
          ) : (
            <Text style={styles.primaryButtonText}>Enviar solicitação</Text>
          )}
        </TouchableOpacity>
      </View>

      <FarmPlotMapPicker
        farms={selectedFarms}
        visible={isMapPickerVisible}
        initialSelectedPlotIds={plotIds}
        onClose={() => setIsMapPickerVisible(false)}
        onConfirm={setPlotIds}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingBottom: 60, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primarySoft,
  },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.primaryDark },
  subtitle: { color: COLORS.textMuted, marginTop: 2, fontSize: 12 },
  formCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.card,
  },
  label: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, marginTop: 6 },
  hint: { fontSize: 12, color: COLORS.textMuted },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderRadius: 12,
    paddingHorizontal: 12,
    color: COLORS.text,
    backgroundColor: COLORS.surface,
  },
  multiline: { minHeight: 80, paddingTop: 12, textAlignVertical: 'top' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
  },
  choiceActive: { backgroundColor: COLORS.primaryDark, borderColor: COLORS.primaryDark },
  choiceText: { color: COLORS.text },
  choiceTextActive: { color: COLORS.white, fontWeight: '700' },
  farmPickerCard: { position: 'relative', zIndex: 20, minHeight: 120 },
  farmSearchWrap: { position: 'relative', minHeight: 54 },
  selectedFarmChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.primarySoft,
  },
  selectedFarmChipText: { color: COLORS.primaryDark, fontWeight: '700', fontSize: 12 },
  farmPlotsSection: { gap: 6, marginBottom: 4 },
  farmPlotsTitle: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  mapPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.primaryDark,
    borderRadius: 12,
    paddingVertical: 10,
    marginTop: 8,
  },
  mapPickerButtonText: { color: COLORS.primaryDark, fontWeight: '700', fontSize: 13 },
  primaryButton: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: { color: COLORS.white, fontWeight: '800' },
  disabled: { opacity: 0.6 },
});
