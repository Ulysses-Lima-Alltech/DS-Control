import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { COLORS } from '@/constants/colors';
import { useState, useEffect, useCallback } from 'react';
import { Feather, Ionicons } from '@expo/vector-icons';
import { getOfflineApplications, deleteOfflineApplication } from '@/utils/offline-storage';
import { OfflineApplication } from '@/types/offline-application.type';
import formatDateToDDMMYYYY from '@/utils/date-formatter';
import { Alert } from 'react-native';

export default function OfflineApplicationsList() {
  const [applications, setApplications] = useState<OfflineApplication[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadApplications = useCallback(async () => {
    const apps = await getOfflineApplications();
    setApplications(apps);
  }, []);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadApplications();
    setRefreshing(false);
  }, [loadApplications]);

  const handleDelete = (application: OfflineApplication) => {
    Alert.alert(
      'Excluir Aplicação',
      'Tem certeza que deseja excluir esta aplicação? Esta ação não pode ser desfeita.',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteOfflineApplication(application.localId);
              await loadApplications();
              Alert.alert('Sucesso', 'Aplicação excluída com sucesso.');
            } catch (error) {
              Alert.alert('Erro', 'Não foi possível excluir a aplicação.');
            }
          },
        },
      ]
    );
  };

  const getStatusBadge = (status: OfflineApplication['syncStatus']) => {
    const statusConfig = {
      pending: { color: COLORS.red || '#FF0000', text: 'Pendente', icon: 'clock' },
      syncing: { color: COLORS.orange || '#EAAE07', text: 'Sincronizando', icon: 'refresh-cw' },
      synced: { color: COLORS.green || '#00FF00', text: 'Sincronizado', icon: 'check-circle' },
      error: { color: COLORS.red || '#FF0000', text: 'Erro', icon: 'alert-circle' },
    };

    const config = statusConfig[status];

    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          backgroundColor: config.color + '20',
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 12,
        }}
      >
        <Feather name={config.icon as any} size={12} color={config.color} />
        <Text style={{ fontSize: 12, color: config.color, fontWeight: '500' }}>{config.text}</Text>
      </View>
    );
  };

  if (applications.length === 0) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: COLORS.white }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View
          style={{
            flex: 1,
            padding: 24,
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: 400,
          }}
        >
          <Feather name='inbox' size={64} color={COLORS.gray} />
          <Text
            style={{
              fontSize: 16,
              color: COLORS.black,
              marginTop: 16,
              textAlign: 'center',
              fontWeight: '500',
            }}
          >
            Nenhuma aplicação offline
          </Text>
          <Text style={{ fontSize: 14, color: COLORS.gray, marginTop: 8, textAlign: 'center' }}>
            As aplicações criadas offline aparecerão aqui.
          </Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.white, padding: 12 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {applications.map((app) => (
        <View
          key={app.localId}
          style={{
            backgroundColor: COLORS.white,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: COLORS.lightgray,
            padding: 12,
            marginBottom: 12,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Feather name='droplet' size={16} color={COLORS.blue} />
              <Text style={{ fontSize: 14, fontWeight: 'bold', color: COLORS.black }}>
                {formatDateToDDMMYYYY(app.date)}
              </Text>
            </View>
            {getStatusBadge(app.syncStatus)}
          </View>

          <View style={{ gap: 8 }}>
            <InfoRow icon='user' label='Piloto' value={app.pilotName} />
            <InfoRow icon='user' label='Ajudante' value={app.assistantName} />
            <InfoRow icon='settings' label='Drone' value={app.droneName} />
            <InfoRow icon='target' label='Produto' value={app.productName} />
            <InfoRow icon='layers' label='Cultivo' value={app.cultureName} />
            <InfoRow icon='maximize-2' label='Hectares' value={`${app.hectares} ha`} />
            {app.observations && (
              <View style={{ marginTop: 4 }}>
                <Text style={{ fontSize: 12, color: COLORS.gray }}>Observações:</Text>
                <Text style={{ fontSize: 12, color: COLORS.black, marginTop: 2 }}>
                  {app.observations}
                </Text>
              </View>
            )}
          </View>

          {app.syncStatus === 'error' && app.syncError && (
            <View
              style={{
                marginTop: 12,
                padding: 8,
                backgroundColor: COLORS.lightpink || '#FFE5E5',
                borderRadius: 4,
              }}
            >
              <Text style={{ fontSize: 12, color: COLORS.red }}>Erro: {app.syncError}</Text>
            </View>
          )}

          <View
            style={{
              flexDirection: 'row',
              gap: 8,
              marginTop: 12,
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: COLORS.lightgray,
            }}
          >
            <TouchableOpacity
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                backgroundColor: COLORS.red,
                padding: 8,
                borderRadius: 6,
              }}
              onPress={() => handleDelete(app)}
            >
              <Feather name='trash-2' size={14} color={COLORS.white} />
              <Text style={{ fontSize: 12, color: COLORS.white, fontWeight: '500' }}>Excluir</Text>
            </TouchableOpacity>
          </View>

          <Text style={{ fontSize: 10, color: COLORS.gray, marginTop: 8, textAlign: 'right' }}>
            Criado em: {formatDateToDDMMYYYY(app.createdAt)}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Feather name={icon as any} size={12} color={COLORS.gray} />
      <Text style={{ fontSize: 12, color: COLORS.gray, width: 80 }}>{label}:</Text>
      <Text style={{ fontSize: 12, color: COLORS.black, flex: 1 }}>{value}</Text>
    </View>
  );
}
