'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { useGenerateTemporaryPassword } from '@/mutations/user.mutation';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export function GenerateTemporaryPasswordDialog({ userId, open, onOpenChange }: { userId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const mutation = useGenerateTemporaryPassword({
    onSuccess: (result) => setTemporaryPassword(result.temporaryPassword),
    onError: (error) => toast(error.message),
  });
  const close = () => { setTemporaryPassword(null); setCopied(false); onOpenChange(false); };
  const copy = async () => {
    if (!temporaryPassword) return;
    await navigator.clipboard.writeText(temporaryPassword);
    setCopied(true);
    toast('Senha copiada.');
  };

  return <Dialog open={open} onOpenChange={(next) => !next && close()}><DialogContent><DialogHeader><DialogTitle>Criar nova senha</DialogTitle><DialogDescription>{temporaryPassword ? 'Copie a senha agora. Ela será exibida apenas desta vez e o usuário deverá trocá-la no próximo login.' : 'Deseja gerar uma nova senha temporária para este usuário?'}</DialogDescription></DialogHeader>
    {temporaryPassword && <div className='flex gap-2'><Input readOnly value={temporaryPassword} aria-label='Senha temporária gerada'/><Button type='button' variant='outline' onClick={copy}>{copied ? <Check className='mr-2 h-4 w-4'/> : <Copy className='mr-2 h-4 w-4'/>}{copied ? 'Copiada' : 'Copiar'}</Button></div>}
    <DialogFooter>{temporaryPassword ? <Button onClick={close}>Fechar</Button> : <><Button variant='outline' onClick={close}>Cancelar</Button><Button disabled={mutation.isPending} onClick={() => mutation.mutate(userId)}>{mutation.isPending ? 'Gerando...' : 'Criar nova senha'}</Button></>}</DialogFooter>
  </DialogContent></Dialog>;
}
