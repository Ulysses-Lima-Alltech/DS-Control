import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { router, usePathname } from 'expo-router';
import { Image } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '@/constants/colors';

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

  if (pathname.split('/')[1] === 'auth') {
    return null;
  }

  return (
    <View style={styles.container}>
      {pathname.split('/')[3] && (
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name='arrow-back' size={22} color={COLORS.primaryDark} />
        </TouchableOpacity>
      )}
      <View style={styles.logoContainer}>
        {logo()}
      </View>
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
