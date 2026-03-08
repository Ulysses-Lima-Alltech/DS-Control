import { Stack, useRouter, usePathname } from 'expo-router';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';

import { useAuth } from '@/providers/auth.provider';

export default function NotFoundScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={styles.container}>
        <Text>Esta tela não existe.</Text>
        <Text>{pathname}</Text>
        <TouchableOpacity
          onPress={() =>
            router.push(`/${user?.type}/map` as `/farmer/map` | `/pilot/map` | `/backoffice/map`)
          }
        >
          <Text>Voltar para o início!</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
});
