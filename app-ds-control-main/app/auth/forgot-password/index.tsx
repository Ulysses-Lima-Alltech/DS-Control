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
import { COLORS, SHADOWS } from '@/constants/colors';

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

  const formContent = (
    <>
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

      <TouchableOpacity
        style={[styles.button, isPending && styles.buttonDisabled]}
        disabled={isPending}
        onPress={handleSubmit(onSubmit)}
      >
        <Text style={styles.buttonText}>{isPending ? 'Enviando...' : 'Enviar e-mail'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.backToLoginLink} onPress={() => router.back()}>
        <Text style={styles.backToLoginText}>Voltar para o login</Text>
      </TouchableOpacity>
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
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textMuted,
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 22,
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
  backToLoginLink: {
    marginTop: 16,
    alignItems: 'center',
  },
  backToLoginText: {
    color: COLORS.primaryDark,
    fontSize: 14,
    fontWeight: '700',
  },
});
