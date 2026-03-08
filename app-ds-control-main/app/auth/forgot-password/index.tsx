import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import type { z } from 'zod';

import { useForgotPassword } from '@/mutations/user.mutation';
import { ForgotPasswordSchema } from '@/schemas/user.schema';

export type ForgotPasswordFormData = z.infer<typeof ForgotPasswordSchema>;

export default function ForgotPasswordScreen() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const { email } = useLocalSearchParams<{ email: string }>();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(ForgotPasswordSchema),
    defaultValues: {
      email: email || '',
    },
  });

  const { mutate: forgotPassword, isPending } = useForgotPassword({
    onSuccess: () => {
      Alert.alert(
        'E-mail enviado',
        'Se o e-mail existir em nossa base de dados, você receberá um link para redefinir sua senha.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    },
    onError: (error: Error) => {
      Alert.alert('Erro: ', error.message || 'Ocorreu um erro inesperado');
    },
  });

  const onSubmit = (data: ForgotPasswordFormData) => {
    forgotPassword(data);
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoidingView}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollViewContent}
        keyboardShouldPersistTaps='handled'
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.container, isLandscape && styles.containerLandscape]}>
          {isLandscape ? (
            <>
              <View style={styles.logoSection}>
                <Image
                  source={require('@/assets/images/icon-1080.png')}
                  style={styles.logoLandscape}
                  resizeMode='contain'
                />
              </View>
              <View style={styles.formSection}>
                <Text style={styles.title}>Esqueceu sua senha?</Text>
                <Text style={styles.subtitle}>
                  Digite seu e-mail e enviaremos um link para redefinir sua senha.
                </Text>

                <Controller
                  control={control}
                  name='email'
                  render={({
                    field: { onChange, onBlur, value },
                  }: {
                    field: { onChange: (v: string) => void; onBlur: () => void; value: string };
                  }) => (
                    <View style={styles.inputGroup}>
                      <TextInput
                        style={[styles.input, errors.email && styles.inputError]}
                        placeholder='E-mail'
                        placeholderTextColor='gray'
                        autoCapitalize='none'
                        keyboardType='email-address'
                        onBlur={onBlur}
                        onChangeText={onChange}
                        value={value}
                      />
                      {errors.email && <Text style={styles.errorText}>{errors.email.message}</Text>}
                    </View>
                  )}
                />

                <TouchableOpacity
                  style={[styles.button, isPending && { opacity: 0.7 }]}
                  disabled={isPending}
                  onPress={handleSubmit(onSubmit)}
                >
                  <Text style={styles.buttonText}>
                    {isPending ? 'Enviando...' : 'Enviar e-mail'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.backToLoginLink} onPress={() => router.back()}>
                  <Text style={styles.backToLoginText}>Voltar para o login</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Image
                source={require('@/assets/images/icon-1080.png')}
                style={styles.logo}
                resizeMode='contain'
              />
              <Text style={styles.title}>Esqueceu sua senha?</Text>
              <Text style={styles.subtitle}>
                Digite seu e-mail e enviaremos um link para redefinir sua senha.
              </Text>

              <Controller
                control={control}
                name='email'
                render={({
                  field: { onChange, onBlur, value },
                }: {
                  field: { onChange: (v: string) => void; onBlur: () => void; value: string };
                }) => (
                  <View style={styles.inputGroup}>
                    <TextInput
                      style={[styles.input, errors.email && styles.inputError]}
                      placeholder='E-mail'
                      placeholderTextColor='gray'
                      autoCapitalize='none'
                      keyboardType='email-address'
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value}
                    />
                    {errors.email && <Text style={styles.errorText}>{errors.email.message}</Text>}
                  </View>
                )}
              />

              <TouchableOpacity
                style={[styles.button, isPending && { opacity: 0.7 }]}
                disabled={isPending}
                onPress={handleSubmit(onSubmit)}
              >
                <Text style={styles.buttonText}>{isPending ? 'Enviando...' : 'Enviar e-mail'}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.backToLoginLink} onPress={() => router.back()}>
                <Text style={styles.backToLoginText}>Voltar para o login</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  scrollViewContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  containerLandscape: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 48,
  },
  logoSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formSection: {
    flex: 1,
    justifyContent: 'center',
  },
  logo: {
    width: 240,
    height: 240,
    alignSelf: 'center',
    marginBottom: 12,
  },
  logoLandscape: {
    width: 240,
    height: 240,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 22,
  },
  inputGroup: {
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    color: '#1C1C1E',
  },
  inputError: {
    borderColor: '#FF3B30',
    borderWidth: 1,
  },
  errorText: {
    marginTop: 4,
    fontSize: 12,
    color: '#FF3B30',
  },
  button: {
    backgroundColor: '#EAAE07',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  backToLoginLink: {
    marginTop: 16,
    alignItems: 'center',
  },
  backToLoginText: {
    color: '#8E8E93',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
