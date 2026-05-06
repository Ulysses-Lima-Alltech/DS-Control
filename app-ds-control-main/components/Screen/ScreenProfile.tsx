import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from 'react-native';

import ModalChangeCurrentUserPassword from '@/components/Modal/ModalChangeCurrentUserPassword';
import { COLORS } from '@/constants/colors';
import { OTA_VERSION_TEXT } from '@/constants/version';
import { useLogout } from '@/mutations/auth.mutation';
import { useAuth } from '@/providers/auth.provider';
import { getUserTypeLabel } from '@/utils/user-role';

interface MenuItem {
  id: string;
  title: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  color?: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
}

type UpdateStatus =
  | 'checking'
  | 'up-to-date'
  | 'update-available'
  | 'error'
  | 'fetching'
  | 'installing'
  | 'installed';

export default function Profile() {
  const { user, refreshUser, setUser } = useAuth();
  const { mutate: logout, isPending } = useLogout({
    onError: async (_error) => {
      try {
        setUser(undefined);
        await refreshUser();
      } catch (error) {
        console.error('[Logout] Ocorreu um erro inesperado: ', error);
      }
    },
    onSuccess: async () => {
      try {
        setUser(undefined);
        await refreshUser();
      } catch (error) {
        console.error('[Logout] Ocorreu um erro inesperado: ', error);
      }
    },
  });

  const [refreshing, setRefreshing] = useState(false);
  const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('checking');

  const handleRefresh = async () => {
    setRefreshing(true);
    setRefreshing(false);
  };

  const checkForUpdates = async () => {
    try {
      setUpdateStatus('checking');
      const update = await Updates.checkForUpdateAsync();

      if (update.isAvailable) {
        setUpdateStatus('update-available');
      } else {
        setUpdateStatus('up-to-date');
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
      setUpdateStatus('error');
    }
  };

  const handleUpdatePress = async () => {
    if (updateStatus === 'update-available') {
      try {
        setUpdateStatus('fetching');
        await Updates.fetchUpdateAsync();
        setUpdateStatus('installing');
        setUpdateStatus('installed');
        setTimeout(() => {
          Updates.reloadAsync();
        }, 2000);
      } catch (error) {
        console.error('Error updating app:', error);
        setUpdateStatus('error');
      }
    } else if (updateStatus === 'error') {
      checkForUpdates();
    }
  };

  useEffect(() => {
    checkForUpdates();
  }, []);

  const getUpdateMenuItem = (): MenuItem => {
    const title = `Atualizações - Versão Atual: v${Constants.expoConfig?.version || 'N/A'}`;

    switch (updateStatus) {
      case 'checking':
        return {
          id: 'update',
          title,
          subtitle: 'Checando por atualizações.',
          icon: 'refresh',
          color: COLORS.gray,
          disabled: true,
          loading: true,
          onPress: () => {},
        };
      case 'update-available':
        return {
          id: 'update',
          title,
          subtitle: 'Atualização disponível, clique aqui para atualizar.',
          icon: 'warning',
          color: COLORS.yellow,
          onPress: handleUpdatePress,
        };
      case 'up-to-date':
        return {
          id: 'update',
          title,
          subtitle: 'O aplicativo está atualizado.',
          icon: 'checkmark-circle',
          color: COLORS.green,
          onPress: () => {},
        };
      case 'error':
        return {
          id: 'update',
          title,
          subtitle: 'Erro ao checar por atualizações. Tentar novamente.',
          icon: 'close-circle',
          color: COLORS.red,
          onPress: handleUpdatePress,
        };
      case 'fetching':
        return {
          id: 'update',
          title,
          subtitle: 'Baixando atualização...',
          icon: 'cloud-download',
          color: COLORS.blue,
          disabled: true,
          loading: true,
          onPress: () => {},
        };
      case 'installing':
        return {
          id: 'update',
          title,
          subtitle: 'Instalando atualização...',
          icon: 'download',
          color: COLORS.blue,
          disabled: true,
          loading: true,
          onPress: () => {},
        };
      case 'installed':
        return {
          id: 'update',
          title,
          subtitle:
            'Atualização instalada. Encerre e abra o aplicativo para aplicar a atualização.',
          icon: 'checkmark-circle',
          color: COLORS.green,
          onPress: () => {},
        };
      default:
        return {
          id: 'update',
          title,
          subtitle: 'Checando por atualizações.',
          icon: 'refresh',
          color: COLORS.gray,
          disabled: true,
          loading: true,
          onPress: () => {},
        };
    }
  };

  const menuItems: MenuItem[] = [
    {
      id: 'security',
      title: 'Alterar senha',
      subtitle: 'Altere sua senha de acesso',
      icon: 'shield-checkmark',
      color: '#34C759',
      onPress: () => {
        setIsPasswordModalVisible(true);
      },
    },
    {
      id: 'help',
      title: 'Ajuda e Suporte',
      subtitle: 'Entre em contato com o suporte',
      icon: 'help-circle',
      color: '#5856D6',
      onPress: () => {
        Linking.openURL('https://wa.me/5599984778466');
      },
    },
    getUpdateMenuItem(),
  ];

  const renderMenuItem = (item: MenuItem) => (
    <TouchableOpacity
      key={item.id}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingVertical: 15,
          borderBottomWidth: 1,
          borderBottomColor: '#F2F2F7',
        },
        item.disabled && {
          opacity: 0.6,
        },
      ]}
      onPress={item.onPress}
      disabled={item.disabled}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          flex: 1,
        }}
      >
        <View
          style={[
            {
              width: 36,
              height: 36,
              borderRadius: 18,
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: 15,
            },
            { backgroundColor: item.color + '20' },
          ]}
        >
          {item.loading ? (
            <ActivityIndicator size='small' color={item.color} />
          ) : (
            <Ionicons name={item.icon} size={20} color={item.color} />
          )}
        </View>
        <View
          style={{
            flex: 1,
          }}
        >
          <Text
            style={[
              {
                fontSize: 16,
                fontWeight: '600',
                color: '#1C1C1E',
                marginBottom: 2,
              },
              item.disabled && {
                color: '#C7C7CC',
              },
            ]}
          >
            {item.title}
          </Text>
          {item.subtitle && (
            <Text
              style={[
                {
                  fontSize: 14,
                  color: '#8E8E93',
                },
                item.disabled && {
                  color: '#C7C7CC',
                },
              ]}
            >
              {item.subtitle}
            </Text>
          )}
        </View>
      </View>
      {item.onPress && !item.disabled && (
        <Ionicons name='chevron-forward' size={20} color='#C7C7CC' />
      )}
    </TouchableOpacity>
  );

  return (
    <ScrollView
      style={{
        flex: 1,
        backgroundColor: '#F2F2F7',
      }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      <View
        style={{
          backgroundColor: '#FFFFFF',
          padding: 20,
          alignItems: 'center',
          marginBottom: 10,
        }}
      >
        <View
          style={{
            position: 'relative',
            marginBottom: 15,
          }}
        >
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: '#007AFF',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Ionicons name='person' size={40} color='#FFFFFF' />
          </View>
        </View>

        <Text
          style={{
            fontSize: 24,
            fontWeight: 'bold',
            color: '#1C1C1E',
            marginBottom: 5,
          }}
        >
          {user?.name || 'Usuário'}
        </Text>
        {user?.type && (
          <Text
            style={{
              fontSize: 16,
              color: '#007AFF',
              fontWeight: '600',
              marginBottom: 5,
            }}
          >
            {getUserTypeLabel(user.type)}
          </Text>
        )}
        <Text
          style={{
            fontSize: 14,
            color: '#8E8E93',
          }}
        >
          {user?.email || ''}
        </Text>
      </View>
      <View
        style={{
          backgroundColor: '#FFFFFF',
          marginBottom: 10,
        }}
      >
        <Text
          style={{
            fontSize: 18,
            fontWeight: 'bold',
            color: '#1C1C1E',
            paddingHorizontal: 20,
            paddingVertical: 15,
            borderBottomWidth: 1,
            borderBottomColor: '#E5E5EA',
          }}
        >
          Configurações
        </Text>
        <View
          style={{
            paddingVertical: 5,
          }}
        >
          {menuItems.map(renderMenuItem)}
        </View>
      </View>
      <TouchableOpacity
        style={[
          {
            backgroundColor: '#FFFFFF',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 15,
            marginBottom: 10,
          },
          isPending && { opacity: 0.7 },
        ]}
        disabled={isPending}
        onPress={() => logout()}
      >
        {isPending ? (
          <ActivityIndicator size='small' color='#FF3B30' />
        ) : (
          <>
            <Ionicons name='log-out' size={20} color='#FF3B30' />
            <Text
              style={{
                fontSize: 16,
                fontWeight: '600',
                color: '#FF3B30',
                marginLeft: 10,
              }}
            >
              Sair
            </Text>
          </>
        )}
      </TouchableOpacity>
      <Text style={{ fontSize: 12, color: '#8E8E93', textAlign: 'center', marginTop: 10 }}>
        {OTA_VERSION_TEXT}
      </Text>
      <ModalChangeCurrentUserPassword
        visible={isPasswordModalVisible}
        onClose={() => setIsPasswordModalVisible(false)}
      />
    </ScrollView>
  );
}
