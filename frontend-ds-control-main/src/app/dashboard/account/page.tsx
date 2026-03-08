'use client';

import { Pencil, RectangleEllipsis } from 'lucide-react';
import { useState } from 'react';

import AvatarUser from '@/components/AvatarUser';
import DialogForm from '@/components/DialogForm';
import FormChangePassword from '@/components/Forms/FormChangePassword';
import FormEditCurrentUser from '@/components/Forms/FormEditCurrentUser';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/providers/auth.provider';

export default function AccountPage() {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { user } = useAuth();

  return (
    <div className='container mx-auto py-6'>
      <div className='max-w-2xl mx-auto'>
        <Card>
          <CardHeader className='pb-4'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center space-x-4'>
                <AvatarUser name={user?.name} className='h-16 w-16' />
                <div>
                  <CardTitle className='text-xl'>Minha Conta</CardTitle>
                  <p className='text-sm text-muted-foreground'>
                    Gerencie suas informações pessoais
                  </p>
                </div>
              </div>
              <DialogForm
                form={<FormEditCurrentUser onSuccess={() => setIsEditDialogOpen(false)} />}
                trigger={
                  <Button variant='outline' size='sm' className='flex items-center gap-2'>
                    <Pencil className='h-4 w-4' />
                    Editar
                  </Button>
                }
                isOpen={isEditDialogOpen}
                setIsOpen={setIsEditDialogOpen}
              />
            </div>
          </CardHeader>

          <CardContent className='space-y-6'>
            <div className='space-y-4'>
              <div>
                <h3 className='text-sm font-medium text-muted-foreground mb-2'>
                  Informações Pessoais
                </h3>
                <div className='space-y-3'>
                  <div className='flex justify-between items-center py-2'>
                    <span className='text-sm font-medium'>Nome</span>
                    <span className='text-sm text-muted-foreground'>{user?.name}</span>
                  </div>
                  <div className='flex justify-between items-center py-2'>
                    <span className='text-sm font-medium'>Email</span>
                    <span className='text-sm text-muted-foreground'>{user?.email}</span>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className='text-sm font-medium text-muted-foreground mb-2'>Segurança</h3>
                <div className='flex justify-between items-center py-2'>
                  <div>
                    <span className='text-sm font-medium'>Senha</span>
                    <p className='text-xs text-muted-foreground'>
                      Última alteração há mais de 30 dias
                    </p>
                  </div>
                  <DialogForm
                    form={<FormChangePassword />}
                    trigger={
                      <Button variant='outline' size='sm' className='flex items-center gap-2'>
                        <RectangleEllipsis className='h-4 w-4' />
                        Alterar senha
                      </Button>
                    }
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
