import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import LoadingDSIcon from '@/components/IconLoadingDS';
import { COLORS, SHADOWS } from '@/constants/colors';
import { useAuth } from '@/providers/auth.provider';
import {
  cancelAreaRequest,
  cancelServiceOrderRequest,
  completeKmlUpload,
  createAreaRequest,
  createServiceOrderRequest,
  getAreaRequest,
  listAreaRequests,
  listServiceOrderRequests,
  prepareKmlUpload,
  submitAreaRequest,
  submitServiceOrderRequest,
  updateAreaRequestPlot,
  uploadKmlToSignedUrl,
} from '@/services/customer-request.service';
import { getAllFarmsPaginated } from '@/services/farm.service';
import type { CustomerRequestStatus, FarmerAreaRequestPlot } from '@/types/customer-request.type';

const STATUS_LABELS: Record<CustomerRequestStatus, string> = {
  DRAFT: 'Rascunho',
  SUBMITTED: 'Enviada',
  PARSING: 'Processando',
  UNDER_REVIEW: 'Em análise',
  CHANGES_REQUESTED: 'Ajustes solicitados',
  APPROVED: 'Aprovada',
  REJECTED: 'Rejeitada',
  CANCELLED: 'Cancelada',
};
const editable = (status: CustomerRequestStatus) =>
  status === 'DRAFT' || status === 'CHANGES_REQUESTED';
const hex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');

function PlotEditor({
  plot,
  requestId,
  onSaved,
}: {
  plot: FarmerAreaRequestPlot;
  requestId: string;
  onSaved: () => void;
}) {
  const [name, setName] = useState(plot.suggestedName);
  const excluded = plot.validationStatus === 'EXCLUDED';
  const mutation = useMutation({
    mutationFn: (payload: { suggestedName?: string; excluded?: boolean }) =>
      updateAreaRequestPlot(requestId, plot.id, payload),
    onSuccess: onSaved,
    onError: (error) =>
      Alert.alert(
        'Não foi possível atualizar',
        error instanceof Error ? error.message : 'Tente novamente.'
      ),
  });
  return (
    <View style={styles.plotCard}>
      <TextInput style={styles.input} value={name} onChangeText={setName} />
      <View style={styles.rowBetween}>
        <Text style={styles.muted}>
          {Number(plot.calculatedAreaHa).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ha ·{' '}
          {plot.validationStatus}
        </Text>
        <View style={styles.inlineActions}>
          <TouchableOpacity
            style={[styles.smallButton, styles.saveButton]}
            disabled={!name.trim() || mutation.isPending}
            onPress={() => mutation.mutate({ suggestedName: name.trim() })}
          >
            <Text style={styles.smallButtonText}>Salvar nome</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.smallButton, excluded && styles.restoreButton]}
            disabled={mutation.isPending || (excluded && plot.validationErrors.length > 0)}
            onPress={() => mutation.mutate({ excluded: !excluded })}
          >
            <Text style={styles.smallButtonText}>{excluded ? 'Reincluir' : 'Excluir'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export default function FarmerRequestsScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'service-orders' | 'areas'>('service-orders');
  const [showForm, setShowForm] = useState(false);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [farmId, setFarmId] = useState('');
  const [requestedDate, setRequestedDate] = useState(new Date().toISOString().slice(0, 10));
  const [serviceType, setServiceType] = useState('Pulverização');
  const [observation, setObservation] = useState('');
  const [areaMode, setAreaMode] = useState<'new' | 'existing'>('new');
  const [farmName, setFarmName] = useState('');
  const [uploading, setUploading] = useState(false);

  const serviceQuery = useQuery({
    queryKey: ['farmer-service-order-requests'],
    queryFn: listServiceOrderRequests,
  });
  const areaQuery = useQuery({ queryKey: ['farmer-area-requests'], queryFn: listAreaRequests });
  const areaDetailQuery = useQuery({
    queryKey: ['farmer-area-request', selectedAreaId],
    queryFn: () => getAreaRequest(selectedAreaId!),
    enabled: Boolean(selectedAreaId),
  });
  const farmsQuery = useQuery({
    queryKey: ['farmer-request-farms', user?.customerId],
    queryFn: () =>
      getAllFarmsPaginated(user?.customerId, { page: '1', limit: '100', includePlots: 'true' }),
    enabled: Boolean(user?.customerId),
  });
  const farms = farmsQuery.data?.data || [];
  useEffect(() => {
    if (!farmId && farms[0]?.id) setFarmId(farms[0].id);
  }, [farmId, farms]);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['farmer-service-order-requests'] }),
      queryClient.invalidateQueries({ queryKey: ['farmer-area-requests'] }),
      queryClient.invalidateQueries({ queryKey: ['farmer-area-request'] }),
    ]);
  };
  const actionMutation = useMutation({
    mutationFn: async (action: string) => {
      if (action === 'create-so')
        return createServiceOrderRequest({
          farmId,
          requestedDate,
          serviceType: serviceType.trim(),
          observation: observation.trim() || undefined,
        });
      if (action === 'create-area')
        return createAreaRequest(
          areaMode === 'new' ? { suggestedFarmName: farmName.trim() } : { existingFarmId: farmId }
        );
      const [kind, id] = action.split(':');
      if (kind === 'submit-so') return submitServiceOrderRequest(id);
      if (kind === 'cancel-so') return cancelServiceOrderRequest(id);
      if (kind === 'submit-area') return submitAreaRequest(id);
      if (kind === 'cancel-area') return cancelAreaRequest(id);
      throw new Error('Ação inválida');
    },
    onSuccess: async (data, action) => {
      if (action === 'create-area' && data && typeof data === 'object' && 'data' in data)
        setSelectedAreaId((data as { data: { id: string } }).data.id);
      setShowForm(false);
      await invalidate();
      Alert.alert('Sucesso', 'Solicitação atualizada.');
    },
    onError: (error) =>
      Alert.alert(
        'Não foi possível concluir',
        error instanceof Error ? error.message : 'Tente novamente.'
      ),
  });

  const handleKml = async (requestId: string) => {
    try {
      setUploading(true);
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['application/vnd.google-earth.kml+xml', 'application/xml', 'text/xml'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (picked.canceled) return;
      const asset = picked.assets[0];
      if (!asset.name.toLowerCase().endsWith('.kml'))
        throw new Error('Selecione um arquivo com extensão .kml. Arquivos KMZ não são aceitos.');
      const bytes = await (await fetch(asset.uri)).arrayBuffer();
      if (bytes.byteLength === 0 || bytes.byteLength > 15 * 1024 * 1024)
        throw new Error('O KML deve ter entre 1 byte e 15 MB.');
      const digest = hex(
        await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, new Uint8Array(bytes))
      );
      const accepted = [
        'application/vnd.google-earth.kml+xml',
        'application/xml',
        'text/xml',
      ] as const;
      const contentType =
        accepted.find((item) => item === asset.mimeType) || 'application/vnd.google-earth.kml+xml';
      const prepared = await prepareKmlUpload(requestId, {
        originalFileName: asset.name,
        contentType,
        sizeBytes: bytes.byteLength,
        sha256: digest,
      });
      await uploadKmlToSignedUrl(prepared, bytes);
      const result = await completeKmlUpload(requestId, prepared.fileId);
      await invalidate();
      Alert.alert(
        'KML processado',
        `${result.plotsCount} talhões extraídos. Revise os itens antes de enviar.`
      );
    } catch (error) {
      Alert.alert(
        'Falha no KML',
        error instanceof Error ? error.message : 'Não foi possível processar o arquivo.'
      );
    } finally {
      setUploading(false);
    }
  };

  const isRefreshing = serviceQuery.isRefetching || areaQuery.isRefetching;
  const areaDetail = areaDetailQuery.data;
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => invalidate()} />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Solicitações</Text>
          <Text style={styles.subtitle}>Envie pedidos sem alterar cadastros definitivos.</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={() => setShowForm((value) => !value)}>
          <Ionicons name={showForm ? 'close' : 'add'} size={24} color={COLORS.white} />
        </TouchableOpacity>
      </View>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'service-orders' && styles.tabActive]}
          onPress={() => {
            setTab('service-orders');
            setSelectedAreaId(null);
          }}
        >
          <Text style={[styles.tabText, tab === 'service-orders' && styles.tabTextActive]}>
            Ordens de serviço
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'areas' && styles.tabActive]}
          onPress={() => setTab('areas')}
        >
          <Text style={[styles.tabText, tab === 'areas' && styles.tabTextActive]}>Áreas / KML</Text>
        </TouchableOpacity>
      </View>

      {showForm && (
        <View style={styles.formCard}>
          {tab === 'service-orders' ? (
            <>
              <Text style={styles.sectionTitle}>Novo pedido de OS</Text>
              <Text style={styles.label}>Fazenda</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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
              </ScrollView>
              <Text style={styles.label}>Data (AAAA-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={requestedDate}
                onChangeText={setRequestedDate}
              />
              <Text style={styles.label}>Serviço</Text>
              <TextInput style={styles.input} value={serviceType} onChangeText={setServiceType} />
              <Text style={styles.label}>Observação</Text>
              <TextInput
                style={[styles.input, styles.multiline]}
                multiline
                value={observation}
                onChangeText={setObservation}
              />
              <TouchableOpacity
                style={styles.primaryButton}
                disabled={!farmId || !serviceType.trim() || actionMutation.isPending}
                onPress={() => actionMutation.mutate('create-so')}
              >
                <Text style={styles.primaryButtonText}>Salvar rascunho</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.sectionTitle}>Nova solicitação de área</Text>
              <View style={styles.tabs}>
                <TouchableOpacity
                  style={[styles.tab, areaMode === 'new' && styles.tabActive]}
                  onPress={() => setAreaMode('new')}
                >
                  <Text style={[styles.tabText, areaMode === 'new' && styles.tabTextActive]}>
                    Nova fazenda
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tab, areaMode === 'existing' && styles.tabActive]}
                  onPress={() => setAreaMode('existing')}
                >
                  <Text style={[styles.tabText, areaMode === 'existing' && styles.tabTextActive]}>
                    Fazenda existente
                  </Text>
                </TouchableOpacity>
              </View>
              {areaMode === 'new' ? (
                <TextInput
                  style={styles.input}
                  placeholder='Nome sugerido da fazenda'
                  value={farmName}
                  onChangeText={setFarmName}
                />
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {farms.map((farm) => (
                    <TouchableOpacity
                      key={farm.id}
                      style={[styles.choice, farmId === farm.id && styles.choiceActive]}
                      onPress={() => setFarmId(farm.id)}
                    >
                      <Text
                        style={farmId === farm.id ? styles.choiceTextActive : styles.choiceText}
                      >
                        {farm.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
              <TouchableOpacity
                style={styles.primaryButton}
                disabled={
                  (areaMode === 'new' ? !farmName.trim() : !farmId) || actionMutation.isPending
                }
                onPress={() => actionMutation.mutate('create-area')}
              >
                <Text style={styles.primaryButtonText}>Criar e anexar KML</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {tab === 'service-orders' ? (
        serviceQuery.isLoading ? (
          <LoadingDSIcon />
        ) : (
          serviceQuery.data?.data.map((item) => (
            <View key={item.id} style={styles.card}>
              <View style={styles.rowBetween}>
                <View style={styles.iconTitle}>
                  <MaterialCommunityIcons
                    name='clipboard-text-outline'
                    size={22}
                    color={COLORS.primaryDark}
                  />
                  <Text style={styles.cardTitle}>{item.serviceType}</Text>
                </View>
                <Text style={styles.status}>{STATUS_LABELS[item.status]}</Text>
              </View>
              <Text style={styles.muted}>
                {item.requestedFarm?.name || 'Fazenda'} · {item.requestedDate}
              </Text>
              {item.rejectionReason && <Text style={styles.errorText}>{item.rejectionReason}</Text>}
              {editable(item.status) && (
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => actionMutation.mutate(`cancel-so:${item.id}`)}
                  >
                    <Text style={styles.secondaryButtonText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.primarySmall}
                    onPress={() => actionMutation.mutate(`submit-so:${item.id}`)}
                  >
                    <Text style={styles.primaryButtonText}>Enviar</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))
        )
      ) : areaQuery.isLoading ? (
        <LoadingDSIcon />
      ) : (
        <>
          {areaQuery.data?.data.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.card, selectedAreaId === item.id && styles.cardSelected]}
              onPress={() => setSelectedAreaId(item.id)}
            >
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>
                  {item.existingFarm?.name || item.suggestedFarmName}
                </Text>
                <Text style={styles.status}>{STATUS_LABELS[item.status]}</Text>
              </View>
              <Text style={styles.muted}>{item.submittedPlots?.length || 0} talhões extraídos</Text>
              {item.rejectionReason && <Text style={styles.errorText}>{item.rejectionReason}</Text>}
            </TouchableOpacity>
          ))}
          {selectedAreaId && areaDetail && (
            <View style={styles.detailCard}>
              <Text style={styles.sectionTitle}>Revisar área</Text>
              {editable(areaDetail.status) && (
                <TouchableOpacity
                  style={styles.uploadButton}
                  disabled={uploading}
                  onPress={() => handleKml(areaDetail.id)}
                >
                  <Ionicons name='cloud-upload-outline' size={20} color={COLORS.primaryDark} />
                  <Text style={styles.uploadText}>
                    {uploading ? 'Processando KML...' : 'Selecionar KML'}
                  </Text>
                </TouchableOpacity>
              )}
              {areaDetail.submittedPlots?.map((plot) => (
                <PlotEditor
                  key={plot.id}
                  plot={plot}
                  requestId={areaDetail.id}
                  onSaved={() => invalidate()}
                />
              ))}
              {editable(areaDetail.status) && (
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => actionMutation.mutate(`cancel-area:${areaDetail.id}`)}
                  >
                    <Text style={styles.secondaryButtonText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.primarySmall}
                    disabled={
                      !areaDetail.submittedPlots?.some((plot) => plot.validationStatus === 'VALID')
                    }
                    onPress={() => actionMutation.mutate(`submit-area:${areaDetail.id}`)}
                  >
                    <Text style={styles.primaryButtonText}>Enviar para análise</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingBottom: 100, gap: 14 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.primaryDark },
  subtitle: { color: COLORS.textMuted, marginTop: 3 },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryDark,
  },
  tabs: { flexDirection: 'row', backgroundColor: COLORS.primarySoft, borderRadius: 14, padding: 3 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 11 },
  tabActive: { backgroundColor: COLORS.surface, ...SHADOWS.card },
  tabText: { color: COLORS.textMuted, fontWeight: '700' },
  tabTextActive: { color: COLORS.primaryDark },
  formCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.card,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  label: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted },
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
  choice: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    marginRight: 8,
  },
  choiceActive: { backgroundColor: COLORS.primaryDark, borderColor: COLORS.primaryDark },
  choiceText: { color: COLORS.text },
  choiceTextActive: { color: COLORS.white, fontWeight: '700' },
  primaryButton: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryButtonText: { color: COLORS.white, fontWeight: '800' },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 7,
    ...SHADOWS.card,
  },
  cardSelected: { borderColor: COLORS.primaryDark, borderWidth: 2 },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  iconTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text, flexShrink: 1 },
  status: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primaryDark,
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  muted: { fontSize: 13, color: COLORS.textMuted },
  errorText: { color: COLORS.error, fontSize: 13 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 6 },
  secondaryButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
  },
  secondaryButtonText: { color: COLORS.text, fontWeight: '700' },
  primarySmall: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: COLORS.primaryDark,
  },
  detailCard: {
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surface,
    gap: 10,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 13,
    borderRadius: 12,
    backgroundColor: COLORS.primarySoft,
  },
  uploadText: { color: COLORS.primaryDark, fontWeight: '800' },
  plotCard: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 10, gap: 8 },
  smallButton: {
    backgroundColor: COLORS.error,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 9,
  },
  inlineActions: { flexDirection: 'row', gap: 6 },
  saveButton: { backgroundColor: COLORS.primaryDark },
  restoreButton: { backgroundColor: COLORS.primaryDark },
  smallButtonText: { color: COLORS.white, fontSize: 11, fontWeight: '800' },
});
