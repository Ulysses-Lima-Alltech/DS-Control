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
import { COLORS, SHADOWS } from '@/constants/colors';

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

  const formContent = (
    <>
      <Text style={styles.title}>Entrar</Text>
      <Text style={styles.subtitle}>Acesse sua operação iControl Agras</Text>

      <Controller
        control={control}
        name='email'
        render={({
          field: { onChange, onBlur, value },
        }: {
          field: { onChange: (v: string) => void; onBlur: () => void; value: string };
        }) => (
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>E-mail</Text>
            <TextInput
              style={[styles.input, errors.email && styles.inputError]}
              placeholder='seu@email.com'
              placeholderTextColor={COLORS.textMuted}
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
            <Text style={styles.inputLabel}>Senha</Text>
            <TextInput
              style={[styles.input, errors.password && styles.inputError]}
              placeholder='Digite sua senha'
              placeholderTextColor={COLORS.textMuted}
              secureTextEntry
              autoCapitalize='none'
              autoComplete='password'
              autoCorrect={false}
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
            />
            {errors.password && <Text style={styles.errorText}>{errors.password.message}</Text>}
          </View>
        )}
      />

      <TouchableOpacity
        style={[styles.button, isPending && styles.buttonDisabled]}
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
      <Text style={styles.versionText}>{OTA_VERSION_TEXT}</Text>
    </>
  );

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
          <View style={styles.logoSection}>
            <Image
              source={require('@/assets/images/logo-icontrol-agras.png')}
              style={isLandscape ? styles.logoLandscape : styles.logo}
              resizeMode='contain'
            />
          </View>
          <View style={styles.formCard}>{formContent}</View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollViewContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    gap: 24,
  },
  containerLandscape: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 32,
  },
  logoSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  logo: {
    width: 270,
    height: 120,
    alignSelf: 'center',
  },
  logoLandscape: {
    width: 330,
    height: 148,
  },
  formCard: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 26,
    padding: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.card,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginBottom: 24,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primaryDark,
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    minHeight: 54,
    borderRadius: 16,
    fontSize: 16,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  inputError: {
    borderColor: COLORS.error,
    borderWidth: 1,
  },
  errorText: {
    marginTop: 4,
    fontSize: 12,
    color: COLORS.error,
  },
  button: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
    marginTop: 8,
    ...SHADOWS.floating,
    shadowOpacity: 0.14,
  },
  buttonDisabled: {
    opacity: 0.72,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '800',
  },
  forgotPasswordLink: {
    marginTop: 16,
    alignItems: 'center',
  },
  forgotPasswordText: {
    color: COLORS.primaryDark,
    fontSize: 14,
    fontWeight: '700',
  },
  versionText: {
    color: COLORS.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 14,
  },
});
