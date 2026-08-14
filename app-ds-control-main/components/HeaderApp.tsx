import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useState } from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';

import AdminSideMenu from '@/components/Admin/AdminSideMenu';
import { COLORS, SHADOWS } from '@/constants/colors';
import { useAuth } from '@/providers/auth.provider';
import { isFarmerRole } from '@/utils/user-role';

const logo = () => {
  return (
    <Image
      source={require('@/assets/images/logo-icontrol-agras.png')}
      style={styles.logo}
      resizeMode='contain'
    />
  );
};

export default function HeaderApp() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);

  if (pathname.split('/')[1] === 'auth') {
    return null;
  }

  const showBackButton = Boolean(pathname.split('/')[3]);
  const showMenuButton = !showBackButton && isFarmerRole(user?.type);

  return (
    <View style={styles.container}>
      {showBackButton && (
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name='arrow-back' size={22} color={COLORS.primaryDark} />
        </TouchableOpacity>
      )}
      {showMenuButton && (
        <TouchableOpacity
          onPress={() => setIsMenuVisible(true)}
          style={styles.backButton}
        >
          <Ionicons name='menu' size={24} color={COLORS.primaryDark} />
        </TouchableOpacity>
      )}
      <View style={styles.logoContainer}>
        {logo()}
      </View>
      {isFarmerRole(user?.type) && (
        <AdminSideMenu
          visible={isMenuVisible}
          onClose={() => setIsMenuVisible(false)}
          pathname={pathname}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 58,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    ...SHADOWS.card,
    shadowOpacity: 0.05,
    elevation: 2,
    zIndex: 10,
  },
  backButton: {
    position: 'absolute',
    left: 12,
    top: 11,
    zIndex: 1000,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primarySoft,
  },
  logoContainer: {
    width: '100%',
    height: 42,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  logo: {
    height: 34,
    width: 176,
  },
});
