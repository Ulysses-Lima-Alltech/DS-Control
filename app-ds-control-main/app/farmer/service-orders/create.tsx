import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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

import { COLORS, SHADOWS } from '@/constants/colors';
import { useAuth } from '@/providers/auth.provider';
import { getContractsByCustomerId } from '@/services/contract.service';
import { getAllFarmsPaginated } from '@/services/farm.service';
import { createServiceOrder } from '@/services/service-order.service';

const todayYYYYMMDD = () => new Date().toISOString().slice(0, 10);

const toggleInSet = (set: Set<string>, id: string) => {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
};

export default function CreateServiceOrderScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedFarmIds, setSelectedFarmIds] = useState<Set<string>>(new Set());
  const [selectedPlotIds, setSelectedPlotIds] = useState<Set<string>>(new Set());
  const [contractId, setContractId] = useState('');
  const [plannedDate, setPlannedDate] = useState(todayYYYYMMDD());
  const [observation, setObservation] = useState('');

  const farmsQuery = useQuery({
    queryKey: ['farmer-create-os-farms', user?.customerId],
    queryFn: () =>
      getAllFarmsPaginated(user?.customerId, { page: '1', limit: '200', includePlots: 'true' }),
    enabled: Boolean(user?.customerId),
  });
  const farms = farmsQuery.data?.data || [];

  const contractsQuery = useQuery({
    queryKey: ['farmer-create-os-contracts', user?.customerId],
    queryFn: () => getContractsByCustomerId(user!.customerId!, { limit: '100' }),
    enabled: Boolean(user?.customerId),
  });
  const contracts = contractsQuery.data?.data || [];

  useEffect(() => {
    if (!contractId && contracts[0]?.id) setContractId(contracts[0].id);
  }, [contractId, contracts]);

  const selectedFarms = useMemo(
    () => farms.filter((farm) => selectedFarmIds.has(farm.id)),
    [farms, selectedFarmIds]
  );
  const availablePlots = useMemo(
    () =>
      selectedFarms.flatMap((farm) => farm.plots.map((plot) => ({ ...plot, farmName: farm.name }))),
    [selectedFarms]
  );

  const toggleFarm = (farmId: string) => {
    setSelectedFarmIds((current) => toggleInSet(current, farmId));
    const farm = farms.find((item) => item.id === farmId);
    if (farm) {
      const farmPlotIds = new Set(farm.plots.map((plot) => plot.id).filter(Boolean) as string[]);
      setSelectedPlotIds((current) => {
        const next = new Set(current);
        const isRemoving = selectedFarmIds.has(farmId);
        farmPlotIds.forEach((plotId) => {
          if (isRemoving) next.delete(plotId);
        });
        return next;
      });
    }
  };

  const togglePlot = (plotId: string) => {
    setSelectedPlotIds((current) => toggleInSet(current, plotId));
  };

  const isValid =
    selectedFarmIds.size > 0 &&
    selectedPlotIds.size > 0 &&
    Boolean(contractId) &&
    /^\d{4}-\d{2}-\d{2}$/.test(plannedDate);

  const createMutation = useMutation({
    mutationFn: () =>
      createServiceOrder({
        farmsIds: [...selectedFarmIds],
        customerId: user!.customerId!,
        contractId,
        observation: observation.trim() || undefined,
        plannedDate,
        pilotsIds: [],
        plotsIds: [...selectedPlotIds],
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['service-orders'] });
      Alert.alert('OS criada', 'A ordem de serviço foi criada com sucesso.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (error) =>
      Alert.alert(
        'Não foi possível criar a OS',
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
          <Text style={styles.subtitle}>A ordem de serviço é criada imediatamente.</Text>
        </View>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.label}>Fazenda(s)</Text>
        {farmsQuery.isLoading ? (
          <ActivityIndicator size='small' color={COLORS.primaryDark} />
        ) : farms.length === 0 ? (
          <Text style={styles.hint}>Nenhuma fazenda cadastrada para o seu cliente.</Text>
        ) : (
          <View style={styles.chipsWrap}>
            {farms.map((farm) => {
              const selected = selectedFarmIds.has(farm.id);
              return (
                <TouchableOpacity
                  key={farm.id}
                  style={[styles.choice, selected && styles.choiceActive]}
                  onPress={() => toggleFarm(farm.id)}
                >
                  <Text style={selected ? styles.choiceTextActive : styles.choiceText}>
                    {farm.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <Text style={styles.label}>Talhões</Text>
        {selectedFarms.length === 0 ? (
          <Text style={styles.hint}>Selecione ao menos uma fazenda para ver os talhões.</Text>
        ) : availablePlots.length === 0 ? (
          <Text style={styles.hint}>Nenhum talhão cadastrado nas fazendas selecionadas.</Text>
        ) : (
          <View style={styles.chipsWrap}>
            {availablePlots.map((plot) =>
              plot.id ? (
                <TouchableOpacity
                  key={plot.id}
                  style={[styles.choice, selectedPlotIds.has(plot.id) && styles.choiceActive]}
                  onPress={() => togglePlot(plot.id as string)}
                >
                  <Text
                    style={
                      selectedPlotIds.has(plot.id) ? styles.choiceTextActive : styles.choiceText
                    }
                  >
                    {plot.name} ({plot.farmName})
                  </Text>
                </TouchableOpacity>
              ) : null
            )}
          </View>
        )}

        <Text style={styles.label}>Contrato</Text>
        {contractsQuery.isLoading ? (
          <ActivityIndicator size='small' color={COLORS.primaryDark} />
        ) : contracts.length === 0 ? (
          <Text style={styles.hint}>Nenhum contrato encontrado para o seu cliente.</Text>
        ) : (
          <View style={styles.chipsWrap}>
            {contracts.map((contract) => (
              <TouchableOpacity
                key={contract.id}
                style={[styles.choice, contractId === contract.id && styles.choiceActive]}
                onPress={() => setContractId(contract.id)}
              >
                <Text
                  style={contractId === contract.id ? styles.choiceTextActive : styles.choiceText}
                >
                  {contract.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.label}>Data planejada (AAAA-MM-DD)</Text>
        <TextInput style={styles.input} value={plannedDate} onChangeText={setPlannedDate} />

        <Text style={styles.label}>Observação</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          multiline
          value={observation}
          onChangeText={setObservation}
          placeholder='Opcional'
        />

        <TouchableOpacity
          style={[styles.primaryButton, (!isValid || createMutation.isPending) && styles.disabled]}
          disabled={!isValid || createMutation.isPending}
          onPress={() => createMutation.mutate()}
        >
          {createMutation.isPending ? (
            <ActivityIndicator size='small' color={COLORS.white} />
          ) : (
            <Text style={styles.primaryButtonText}>Criar OS</Text>
          )}
        </TouchableOpacity>
      </View>
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
