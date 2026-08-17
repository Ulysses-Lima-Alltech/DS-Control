import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
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

import FarmPlotMapPicker, {
  SelectedPlotDetail,
} from '@/components/Farmer/FarmPlotMapPicker';
import DatePickeriOSModal from '@/components/ui/DatePickeriOSModal';
import SearchableSelectQuery from '@/components/ui/SearchableSelectQuery';
import { COLORS, SHADOWS } from '@/constants/colors';
import { useAuth } from '@/providers/auth.provider';
import {
  createServiceOrderRequest,
  submitServiceOrderRequest,
} from '@/services/customer-request.service';
import { getAllFarmsPaginated } from '@/services/farm.service';
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

  const [selectedPlots, setSelectedPlots] = useState<SelectedPlotDetail[]>([]);
  const [plannedDate, setPlannedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [applicationType, setApplicationType] = useState('Pulverização');
  const [observation, setObservation] = useState('');
  const [isMapPickerVisible, setIsMapPickerVisible] = useState(false);

  const farmsQuery = useQuery({
    queryKey: ['farmer-create-os-farms', user?.customerId],
    queryFn: () =>
      getAllFarmsPaginated(user?.customerId, {
        page: '1',
        limit: '500',
        includePlots: 'true',
        includeGeoJson: 'true',
      }),
    enabled: Boolean(user?.customerId) && isMapPickerVisible,
  });
  const allFarms = farmsQuery.data?.data || [];

  const selectedFarmGroups = useMemo(() => {
    const groups = new Map<string, { farmName: string; plots: { id: string; name: string }[] }>();
    selectedPlots.forEach((plot) => {
      const group = groups.get(plot.farmId) ?? { farmName: plot.farmName, plots: [] };
      group.plots.push({ id: plot.id, name: plot.name });
      groups.set(plot.farmId, group);
    });
    return Array.from(groups.entries()).map(([farmId, group]) => ({ farmId, ...group }));
  }, [selectedPlots]);

  const isValid = selectedPlots.length > 0 && Boolean(applicationType);

  const createMutation = useMutation({
    mutationFn: async () => {
      const farmIds = selectedFarmGroups.map((group) => group.farmId);
      const plotIds = selectedPlots.map((plot) => plot.id);
      const created = await createServiceOrderRequest({
        farmIds,
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

  const removePlot = (plotId: string) =>
    setSelectedPlots((previous) => previous.filter((plot) => plot.id !== plotId));

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

      <View style={styles.formCard}>
        <Text style={styles.label}>Talhões</Text>
        <Text style={styles.hint}>
          Navegue pelo mapa e toque nos talhões que deseja incluir na OS. Você pode selecionar
          talhões de fazendas diferentes na mesma solicitação.
        </Text>

        <TouchableOpacity style={styles.mapPickerButton} onPress={() => setIsMapPickerVisible(true)}>
          <Ionicons name='map-outline' size={18} color={COLORS.white} />
          <Text style={styles.mapPickerButtonText}>Selecionar talhões no mapa</Text>
        </TouchableOpacity>

        {selectedFarmGroups.length === 0 ? (
          <Text style={styles.hint}>Nenhum talhão selecionado ainda.</Text>
        ) : (
          selectedFarmGroups.map((group) => (
            <View key={group.farmId} style={styles.farmPlotsSection}>
              <Text style={styles.farmPlotsTitle}>{group.farmName}</Text>
              <View style={styles.chipsWrap}>
                {group.plots.map((plot) => (
                  <TouchableOpacity
                    key={plot.id}
                    style={styles.selectedPlotChip}
                    onPress={() => removePlot(plot.id)}
                  >
                    <Text style={styles.selectedPlotChipText}>{plot.name}</Text>
                    <Ionicons name='close' size={14} color={COLORS.primaryDark} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))
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
        farms={allFarms}
        customerId={user?.customerId}
        visible={isMapPickerVisible}
        initialSelectedPlots={selectedPlots}
        onClose={() => setIsMapPickerVisible(false)}
        onConfirm={setSelectedPlots}
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
  farmPlotsSection: { gap: 6, marginBottom: 4 },
  farmPlotsTitle: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  selectedPlotChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.primarySoft,
  },
  selectedPlotChipText: { color: COLORS.primaryDark, fontWeight: '700', fontSize: 12 },
  mapPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primaryDark,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 4,
  },
  mapPickerButtonText: { color: COLORS.white, fontWeight: '800', fontSize: 14 },
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
