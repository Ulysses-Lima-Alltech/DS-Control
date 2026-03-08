import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
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

import { useLogin } from '@/mutations/auth.mutation';
import { useAuth } from '@/providers/auth.provider';
import { LoginSchema } from '@/schemas/auth.schema';
import { OTA_VERSION_TEXT } from '@/constants/version';

export type LoginFormData = z.infer<typeof LoginSchema>;

export default function LoginScreen() {
  const { refreshUser } = useAuth();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<LoginFormData>({
    resolver: zodResolver(LoginSchema),
  });

  const emailValue = watch('email');

  const { mutate: login, isPending } = useLogin({
    onSuccess: async () => {
      try {
        await refreshUser();
      } catch (error) {
        console.error('[Login Screen] Error while refreshing user:', error);
      }
    },
    onError: (error) => {
      Alert.alert('Erro ao entrar', error.message || 'Ocorreu um erro inesperado');
    },
  });

  const onSubmit = (data: LoginFormData) => {
    login(data);
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
                <Text style={styles.title}>Entrar</Text>

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

                <Controller
                  control={control}
                  name='password'
                  render={({
                    field: { onChange, onBlur, value },
                  }: {
                    field: { onChange: (v: string) => void; onBlur: () => void; value: string };
                  }) => (
                    <View style={styles.inputGroup}>
                      <TextInput
                        style={[styles.input, errors.password && styles.inputError]}
                        placeholder='Senha'
                        placeholderTextColor='gray'
                        secureTextEntry
                        autoCapitalize='none'
                        autoComplete='password'
                        autoCorrect={false}
                        onBlur={onBlur}
                        onChangeText={onChange}
                        value={value}
                      />
                      {errors.password && (
                        <Text style={styles.errorText}>{errors.password.message}</Text>
                      )}
                    </View>
                  )}
                />

                <TouchableOpacity
                  style={[styles.button, isPending && { opacity: 0.7 }]}
                  disabled={isPending}
                  onPress={handleSubmit(onSubmit)}
                >
                  <Text style={styles.buttonText}>{isPending ? 'Entrando...' : 'Entrar'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.forgotPasswordLink}
                  onPress={() =>
                    router.push(
                      `/auth/forgot-password?email=${encodeURIComponent(emailValue || '')}`
                    )
                  }
                >
                  <Text style={styles.forgotPasswordText}>Esqueceu sua senha?</Text>
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
              <Text style={styles.title}>Entrar</Text>

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

              <Controller
                control={control}
                name='password'
                render={({
                  field: { onChange, onBlur, value },
                }: {
                  field: { onChange: (v: string) => void; onBlur: () => void; value: string };
                }) => (
                  <View style={styles.inputGroup}>
                    <TextInput
                      style={[styles.input, errors.password && styles.inputError]}
                      placeholder='Senha'
                      placeholderTextColor='gray'
                      secureTextEntry
                      autoCapitalize='none'
                      autoComplete='password'
                      autoCorrect={false}
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value}
                    />
                    {errors.password && (
                      <Text style={styles.errorText}>{errors.password.message}</Text>
                    )}
                  </View>
                )}
              />

              <TouchableOpacity
                style={[styles.button, isPending && { opacity: 0.7 }]}
                disabled={isPending}
                onPress={handleSubmit(onSubmit)}
              >
                <Text style={styles.buttonText}>{isPending ? 'Entrando...' : 'Entrar'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.forgotPasswordLink}
                onPress={() =>
                  router.push(`/auth/forgot-password?email=${encodeURIComponent(emailValue || '')}`)
                }
              >
                <Text style={styles.forgotPasswordText}>Esqueceu sua senha?</Text>
              </TouchableOpacity>
              <Text style={{ color: '#8E8E93', fontSize: 12, textAlign: 'center' }}>
                {OTA_VERSION_TEXT}
              </Text>
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
    marginBottom: 32,
    textAlign: 'center',
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
  forgotPasswordLink: {
    marginTop: 16,
    alignItems: 'center',
  },
  forgotPasswordText: {
    color: '#8E8E93',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
