'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';

import { DashboardPageShell } from '@/components/DashboardPageShell';
import DialogForm from '@/components/DialogForm';
import FormRegisterNewRoute from '@/components/Forms/FormRegisterNewRoute';
import TableRoutes from '@/components/Tables/TableRoutes';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function RoutesPage() {
  const [isNewRouteDialogOpen, setIsNewRouteDialogOpen] = useState(false);

  return (
    <DashboardPageShell
      title='Rotas'
      description='Gerencie todas as rotas cadastradas'
      action={
        <DialogForm
          form={<FormRegisterNewRoute closeDialog={() => setIsNewRouteDialogOpen(false)} />}
          isOpen={isNewRouteDialogOpen}
          setIsOpen={setIsNewRouteDialogOpen}
          trigger={
            <Button
              variant='default'
              onClick={() => setIsNewRouteDialogOpen(true)}
              className='h-12 rounded-xl px-6 text-sm font-semibold shadow-[0_10px_22px_rgba(113,167,128,0.24)]'
            >
              <Plus className='mr-2 h-5 w-5' />
              Nova rota
            </Button>
          }
          className='sm:max-w-5xl p-0'
        />
      }
    >
      <Card className='max-w-full gap-0 overflow-hidden rounded-[22px] border-border/60 bg-card/95 py-0 shadow-[0_14px_34px_rgba(15,23,42,0.06)]'>
        <CardContent className='p-6'>
          <TableRoutes />
        </CardContent>
      </Card>
    </DashboardPageShell>
  );
}
