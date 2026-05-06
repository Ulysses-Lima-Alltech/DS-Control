import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef } from 'react';
import {
  Alert,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { COLORS } from '@/constants/colors';
import { useLogout } from '@/mutations/auth.mutation';
import { useAuth } from '@/providers/auth.provider';
import { getUserTypeLabel as getNormalizedUserTypeLabel, isAdminRole } from '@/utils/user-role';

type AdminSideMenuProps = {
  visible: boolean;
  onClose: () => void;
  pathname?: string;
};

type AdminMenuItem = {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  route?: string;
  enabled: boolean;
};

const menuItems: AdminMenuItem[] = [
  {
    id: 'dashboard',
    title: 'Painel',
    icon: 'grid-outline',
    route: '/backoffice/dashboard',
    enabled: true,
  },
  { id: 'map', title: 'Fazendas', icon: 'map-outline', route: '/backoffice/map', enabled: true },
  {
    id: 'applications',
    title: 'Aplicações',
    icon: 'flask-outline',
    route: '/backoffice/applications',
    enabled: true,
  },
  {
    id: 'service-orders',
    title: 'Ordens de Serviço',
    icon: 'document-text-outline',
    route: '/backoffice/service-orders',
    enabled: true,
  },
  {
    id: 'routes',
    title: 'Rotas',
    icon: 'navigate-outline',
    route: '/backoffice/routes',
    enabled: true,
  },
  {
    id: 'configurations',
    title: 'Configurações',
    icon: 'settings-outline',
    route: '/backoffice/configurations',
    enabled: true,
  },
  {
    id: 'profile',
    title: 'Perfil',
    icon: 'person-outline',
    route: '/backoffice/profile',
    enabled: true,
  },
];

const getUserTypeLabel = (userType?: string) => {
  if (!userType) return 'Usuário';

  const typedEntries = [{ value: userType, label: getNormalizedUserTypeLabel(userType) }];
  const found = typedEntries.find((entry) => entry.value === userType);
  return found?.label ?? 'Usuário';
};

export default function AdminSideMenu({ visible, onClose, pathname }: AdminSideMenuProps) {
  const router = useRouter();
  const { user, refreshUser, setUser } = useAuth();
  const slideAnimation = useRef(new Animated.Value(0)).current;
  const isAdminUser = isAdminRole(user?.type);

  const { mutate: logout, isPending: isLoggingOut } = useLogout({
    onError: async () => {
      setUser(undefined);
      await refreshUser();
      onClose();
    },
    onSuccess: async () => {
      setUser(undefined);
      await refreshUser();
      onClose();
    },
  });

  const activeRoute = useMemo(() => {
    if (!pathname) return '';
    return pathname;
  }, [pathname]);

  useEffect(() => {
    if (!visible) return;

    slideAnimation.setValue(0);
    Animated.timing(slideAnimation, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [slideAnimation, visible]);

  const handleNavigate = (item: AdminMenuItem) => {
    if (!item.enabled) {
      Alert.alert('Em breve', `O módulo "${item.title}" ainda não está disponível no mobile.`);
      return;
    }

    if (!item.route) {
      return;
    }

    onClose();
    router.push(item.route as any);
  };

  return (
    <Modal transparent visible={visible} animationType='none' onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <Pressable
          onPress={onClose}
          style={{
            ...ViewStyleSheet.absoluteFillObject,
            backgroundColor: 'rgba(0,0,0,0.45)',
          }}
        />

        <Animated.View
          style={{
            width: '78%',
            maxWidth: 320,
            height: '100%',
            backgroundColor: COLORS.white,
            paddingTop: 56,
            paddingHorizontal: 16,
            transform: [
              {
                translateX: slideAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-320, 0],
                }),
              },
            ],
            shadowColor: '#000',
            shadowOffset: { width: 2, height: 0 },
            shadowOpacity: 0.2,
            shadowRadius: 10,
            elevation: 10,
          }}
        >
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.black }}>DS Control</Text>
            <Text style={{ fontSize: 13, color: COLORS.gray, marginTop: 4 }}>
              {user?.name || 'Usuário'}
            </Text>
            <Text style={{ fontSize: 12, color: COLORS.blue, marginTop: 2 }}>
              {getUserTypeLabel(user?.type)}
            </Text>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ gap: 8, paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
          >
            {menuItems
              .filter((item) => item.id !== 'configurations' || isAdminUser)
              .map((item) => {
                const isActive = !!item.route && activeRoute.startsWith(item.route);
                const isDisabled = !item.enabled;

                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => handleNavigate(item)}
                    disabled={isDisabled}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      borderRadius: 10,
                      paddingVertical: 12,
                      paddingHorizontal: 10,
                      backgroundColor: isActive ? COLORS.lightblue : COLORS.white,
                      borderWidth: 1,
                      borderColor: isActive ? COLORS.blue : COLORS.lightgray,
                      opacity: isDisabled ? 0.6 : 1,
                    }}
                  >
                    <Ionicons
                      name={item.icon}
                      size={18}
                      color={isDisabled ? COLORS.gray : isActive ? COLORS.blue : COLORS.black}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: isActive ? '700' : '600',
                          color: isDisabled ? COLORS.gray : COLORS.black,
                        }}
                      >
                        {item.title}
                      </Text>
                      {!item.enabled && (
                        <Text style={{ fontSize: 11, color: COLORS.gray, marginTop: 2 }}>
                          Em breve
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
          </ScrollView>

          <TouchableOpacity
            onPress={() => logout()}
            disabled={isLoggingOut}
            style={{
              marginBottom: 24,
              marginTop: 12,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: COLORS.red,
              paddingVertical: 12,
              paddingHorizontal: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              backgroundColor: '#FFF5F5',
              opacity: isLoggingOut ? 0.65 : 1,
            }}
          >
            <Ionicons name='log-out-outline' size={18} color={COLORS.red} />
            <Text style={{ color: COLORS.red, fontWeight: '700' }}>
              {isLoggingOut ? 'Saindo...' : 'Sair'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const ViewStyleSheet = {
  absoluteFillObject: {
    position: 'absolute' as const,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
};
