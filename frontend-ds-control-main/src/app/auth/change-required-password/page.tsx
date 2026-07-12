'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PasswordSchema } from '@/schemas/user.schema';
import { api } from '@/services/api.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ChangeRequiredPasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const validation = PasswordSchema.safeParse(newPassword);
  const submit = async () => {
    if (!validation.success || newPassword !== confirmation) return;
    setLoading(true);
    try {
      const response = await api('/users/me/password', { method: 'PUT', body: JSON.stringify({ oldPassword: currentPassword, newPassword }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast('Senha alterada com sucesso.');
      router.replace('/dashboard');
    } catch (error) { toast(error instanceof Error ? error.message : 'Não foi possível alterar a senha'); }
    finally { setLoading(false); }
  };
  return <main className='flex min-h-screen items-center justify-center p-4'><Card className='w-full max-w-md'><CardHeader><CardTitle>Troca de senha obrigatória</CardTitle></CardHeader><CardContent className='space-y-4'><p className='text-muted-foreground text-sm'>Defina uma senha definitiva antes de continuar.</p><div><Label>Senha temporária atual</Label><Input type='password' value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}/></div><div><Label>Nova senha</Label><Input type='password' value={newPassword} onChange={(e) => setNewPassword(e.target.value)}/></div><div><Label>Confirmar nova senha</Label><Input type='password' value={confirmation} onChange={(e) => setConfirmation(e.target.value)}/></div>{!validation.success && newPassword && <p className='text-destructive text-sm'>{validation.error.issues[0]?.message}</p>}{confirmation && newPassword !== confirmation && <p className='text-destructive text-sm'>As senhas não coincidem</p>}<Button className='w-full' disabled={loading || !currentPassword || !validation.success || newPassword !== confirmation} onClick={submit}>{loading ? 'Alterando...' : 'Alterar senha'}</Button></CardContent></Card></main>;
}
