import { View, Text, TouchableOpacity } from 'react-native';
import { router, usePathname } from 'expo-router';
import { Image } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
const logo = () => {
  return (
    <Image
      source={require('@/assets/images/top_banner_logo.png')}
      style={{ height: 24, width: 144 }}
    />
  );
};

export default function HeaderApp() {
  const pathname = usePathname();

  if (pathname.split('/')[1] === 'auth') {
    return null;
  }

  return (
    <View
      style={{
        width: '100%',
        height: 48,
        backgroundColor: 'white',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
        borderBottomWidth: 2,
        borderBottomColor: '#E5E5EA',
      }}
    >
      {pathname.split('/')[3] && (
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ position: 'absolute', left: 10, top: 10, zIndex: 1000 }}
        >
          <Ionicons name='arrow-back' size={24} color='black' />
        </TouchableOpacity>
      )}
      <View
        style={{
          width: '100%',
          height: 36,
          backgroundColor: 'white',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
        }}
      >
        {logo()}
      </View>
    </View>
  );
}
