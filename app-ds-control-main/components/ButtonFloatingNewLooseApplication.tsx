import { TouchableOpacity, Text } from 'react-native';
import { COLORS, SHADOWS } from '../constants/colors';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';

export default function ButtonFloatingNewLooseApplication() {
  return (
    <TouchableOpacity
      style={{
        position: 'absolute',
        alignSelf: 'center',
        bottom: 16,
        paddingVertical: 14,
        paddingHorizontal: 18,
        borderRadius: 28,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
        ...SHADOWS.floating,
        zIndex: 1000,
        flexDirection: 'row',
        gap: 8,
      }}
      onPress={() => {
        router.push('/pilot/applications/form-application?formMode=new-loose');
      }}
    >
      <Feather name='plus' size={14} color={COLORS.white} />
      <Text style={{ fontSize: 14, color: COLORS.white, fontWeight: 'bold' }}>
        Adicionar aplicação avulsa
      </Text>
    </TouchableOpacity>
  );
}
