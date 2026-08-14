import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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
import {
  createServiceOrderRequest,
  submitServiceOrderRequest,
} from '@/services/customer-request.service';
import { getAllFarmsPaginated } from '@/services/farm.service';

const todayYYYYMMDD = () => new Date().toISOString().slice(0, 10);

export default function CreateServiceOrderScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [farmId, setFarmId] = useState('');
  const [plannedDate, setPlannedDate] = useState(todayYYYYMMDD());
  const [serviceType, setServiceType] = useState('Pulverização');
  const [observation, setObservation] = useState('');

  const farmsQuery = useQuery({
    queryKey: ['farmer-create-os-farms', user?.customerId],
    queryFn: () => getAllFarmsPaginated(user?.customerId, { page: '1', limit: '200' }),
    enabled: Boolean(user?.customerId),
  });
  const farms = farmsQuery.data?.data || [];

  useEffect(() => {
    if (!farmId && farms[0]?.id) setFarmId(farms[0].id);
  }, [farmId, farms]);

  const isValid =
    Boolean(farmId) && Boolean(serviceType.trim()) && /^\d{4}-\d{2}-\d{2}$/.test(plannedDate);

  const createMutation = useMutation({
    mutationFn: async () => {
      const created = await createServiceOrderRequest({
        farmId,
        requestedDate: plannedDate,
        serviceType: serviceType.trim(),
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

      <View style={styles.formCard}>
        <Text style={styles.label}>Fazenda</Text>
        {farmsQuery.isLoading ? (
          <ActivityIndicator size='small' color={COLORS.primaryDark} />
        ) : farms.length === 0 ? (
          <Text style={styles.hint}>Nenhuma fazenda cadastrada para o seu cliente.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipsWrap}>
              {farms.map((farm) => (
                <TouchableOpacity
                  key={farm.id}
                  style={[styles.choice, farmId === farm.id && styles.choiceActive]}
                  onPress={() => setFarmId(farm.id)}
                >
                  <Text style={farmId === farm.id ? styles.choiceTextActive : styles.choiceText}>
                    {farm.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}

        <Text style={styles.label}>Data planejada (AAAA-MM-DD)</Text>
        <TextInput style={styles.input} value={plannedDate} onChangeText={setPlannedDate} />

        <Text style={styles.label}>Serviço</Text>
        <TextInput style={styles.input} value={serviceType} onChangeText={setServiceType} />

        <Text style={styles.label}>Observação</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          multiline
          value={observation}
          onChangeText={setObservation}
          placeholder='Talhões, detalhes do serviço, etc. (opcional)'
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
  chipsWrap: { flexDirection: 'row', gap: 8 },
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
