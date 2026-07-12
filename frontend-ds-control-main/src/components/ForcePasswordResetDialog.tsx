'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { useForcePasswordReset } from '@/mutations/user.mutation';
import { TemporaryPasswordSchema } from '@/schemas/user.schema';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function ForcePasswordResetDialog({ userId, open, onOpenChange }: { userId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [visible, setVisible] = useState(false);
  const validation = TemporaryPasswordSchema.safeParse(password);
  const error = password && !validation.success ? validation.error.issues[0]?.message : confirmation && password !== confirmation ? 'As senhas não coincidem' : '';
  const mutation = useForcePasswordReset({ onSuccess: () => { toast('Senha temporária definida com sucesso. O usuário deverá alterá-la no próximo acesso.'); setPassword(''); setConfirmation(''); onOpenChange(false); }, onError: (err) => toast(err.message) });
  const close = (next: boolean) => { if (!next) { setPassword(''); setConfirmation(''); } onOpenChange(next); };

  return <Dialog open={open} onOpenChange={close}><DialogContent><DialogHeader><DialogTitle>Definir senha temporária</DialogTitle><DialogDescription>As sessões atuais serão encerradas e o usuário deverá trocar esta senha no próximo acesso.</DialogDescription></DialogHeader>
    <div className='space-y-4'><div><Label htmlFor='temporary-password'>Senha temporária</Label><div className='flex gap-2'><Input id='temporary-password' type={visible ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete='new-password'/><Button type='button' variant='outline' size='icon' onClick={() => setVisible(!visible)}>{visible ? <EyeOff/> : <Eye/>}</Button></div></div><div><Label htmlFor='temporary-password-confirmation'>Confirmar senha</Label><Input id='temporary-password-confirmation' type={visible ? 'text' : 'password'} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} autoComplete='new-password'/></div>{error && <p className='text-destructive text-sm'>{error}</p>}</div>
    <DialogFooter><Button variant='outline' onClick={() => close(false)}>Cancelar</Button><Button disabled={!validation.success || password !== confirmation || mutation.isPending} onClick={() => { if (window.confirm('Confirma a redefinição administrativa da senha?')) mutation.mutate({ userId, temporaryPassword: password }); }}>Definir senha temporária</Button></DialogFooter>
  </DialogContent></Dialog>;
}
