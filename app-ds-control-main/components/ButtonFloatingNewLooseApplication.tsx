import { TouchableOpacity, Text } from 'react-native';
import { COLORS } from '../constants/colors';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';

export default function ButtonFloatingNewLooseApplication() {
  return (
    <TouchableOpacity
      style={{
        position: 'absolute',
        alignSelf: 'center',
        bottom: 16,
        padding: 12,
        borderRadius: 28,
        backgroundColor: COLORS.green,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
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
