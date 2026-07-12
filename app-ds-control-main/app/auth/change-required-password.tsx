import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { changeCurrentUserPassword } from '@/services/user.service';

const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export default function ChangeRequiredPasswordScreen() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    if (!strongPassword.test(newPassword)) return Alert.alert('Senha inválida', 'Use ao menos 8 caracteres, maiúscula, minúscula, número e caractere especial.');
    if (newPassword !== confirmation) return Alert.alert('Senha inválida', 'As senhas não coincidem.');
    setLoading(true);
    try { await changeCurrentUserPassword({ oldPassword: currentPassword, newPassword }); Alert.alert('Sucesso', 'Senha alterada com sucesso.'); router.replace('/auth/login'); }
    catch (error) { Alert.alert('Erro', error instanceof Error ? error.message : 'Não foi possível alterar a senha.'); }
    finally { setLoading(false); }
  };
  return <View style={styles.container}><Text style={styles.title}>Troca de senha obrigatória</Text><Text>Defina uma senha definitiva antes de continuar.</Text><TextInput style={styles.input} secureTextEntry placeholder='Senha temporária atual' value={currentPassword} onChangeText={setCurrentPassword}/><TextInput style={styles.input} secureTextEntry placeholder='Nova senha' value={newPassword} onChangeText={setNewPassword}/><TextInput style={styles.input} secureTextEntry placeholder='Confirmar nova senha' value={confirmation} onChangeText={setConfirmation}/><TouchableOpacity style={styles.button} disabled={loading} onPress={submit}><Text style={styles.buttonText}>{loading ? 'Alterando...' : 'Alterar senha'}</Text></TouchableOpacity></View>;
}

const styles = StyleSheet.create({ container: { flex: 1, justifyContent: 'center', padding: 24, gap: 16, backgroundColor: '#fff' }, title: { fontSize: 24, fontWeight: '700' }, input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 14 }, button: { backgroundColor: '#166534', borderRadius: 8, padding: 16, alignItems: 'center' }, buttonText: { color: '#fff', fontWeight: '700' } });
