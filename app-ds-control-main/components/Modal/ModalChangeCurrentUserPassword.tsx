import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useChangeCurrentUserPassword } from '@/mutations/user.mutation';
import { ChangeCurrentUserPasswordDialogSchema } from '@/schemas/user.schema';

type ChangePasswordFormData = {
  oldPassword: string;
  newPassword: string;
  confirmNewPassword: string;
};

interface ModalChangeCurrentUserPasswordProps {
  visible: boolean;
  onClose: () => void;
}

export default function ModalChangeCurrentUserPassword({
  visible,
  onClose,
}: ModalChangeCurrentUserPasswordProps) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(ChangeCurrentUserPasswordDialogSchema),
    defaultValues: {
      oldPassword: '',
      newPassword: '',
      confirmNewPassword: '',
    },
  });

  const { mutate: changePassword, isPending: isChangingPassword } = useChangeCurrentUserPassword({
    onSuccess: () => {
      Alert.alert('Sucesso', 'Senha alterada com sucesso!');
      onClose();
      reset();
    },
    onError: (error) => {
      Alert.alert('Erro', error.message || 'Erro ao alterar senha');
    },
  });

  const onSubmitPasswordChange = (data: ChangePasswordFormData) => {
    changePassword({
      oldPassword: data.oldPassword,
      newPassword: data.newPassword,
    });
  };

  const handleClose = () => {
    onClose();
    reset();
  };

  return (
    <Modal
      visible={visible}
      animationType='slide'
      presentationStyle='pageSheet'
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.modalContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={handleClose}>
            <Text style={styles.modalCancelText}>Cancelar</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Alterar Senha</Text>
          <TouchableOpacity
            onPress={handleSubmit(onSubmitPasswordChange)}
            disabled={isChangingPassword}
          >
            {isChangingPassword ? (
              <ActivityIndicator size='small' color='#007AFF' />
            ) : (
              <Text style={styles.modalSaveText}>Salvar</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Senha atual</Text>
            <Controller
              control={control}
              name='oldPassword'
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[styles.formInput, errors.oldPassword && styles.formInputError]}
                  placeholder='Digite sua senha atual'
                  placeholderTextColor='gray'
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  secureTextEntry
                  autoCapitalize='none'
                />
              )}
            />
            {errors.oldPassword && (
              <Text style={styles.formErrorText}>{errors.oldPassword.message}</Text>
            )}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Nova senha</Text>
            <Controller
              control={control}
              name='newPassword'
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[styles.formInput, errors.newPassword && styles.formInputError]}
                  placeholder='Digite sua nova senha'
                  placeholderTextColor='gray'
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  secureTextEntry
                  autoCapitalize='none'
                />
              )}
            />
            {errors.newPassword && (
              <Text style={styles.formErrorText}>{errors.newPassword.message}</Text>
            )}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Confirmar nova senha</Text>
            <Controller
              control={control}
              name='confirmNewPassword'
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[styles.formInput, errors.confirmNewPassword && styles.formInputError]}
                  placeholder='Digite novamente sua nova senha'
                  placeholderTextColor='gray'
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  secureTextEntry
                  autoCapitalize='none'
                />
              )}
            />
            {errors.confirmNewPassword && (
              <Text style={styles.formErrorText}>{errors.confirmNewPassword.message}</Text>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#007AFF',
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1C1C1E',
  },
  formInputError: {
    borderColor: '#FF3B30',
  },
  formErrorText: {
    fontSize: 14,
    color: '#FF3B30',
    marginTop: 4,
  },
});
