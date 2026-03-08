'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';

import DialogForm from '@/components/DialogForm';
import FormRegisterNewRoute from '@/components/Forms/FormRegisterNewRoute';
import TableRoutes from '@/components/Tables/TableRoutes';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function RoutesPage() {
  const [isNewRouteDialogOpen, setIsNewRouteDialogOpen] = useState(false);

  return (
    <div className='p-6 space-y-6 min-h-full max-w-screen'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold'>Rotas</h1>
          <p>Gerencie todas as rotas cadastradas</p>
        </div>
        <DialogForm
          form={<FormRegisterNewRoute closeDialog={() => setIsNewRouteDialogOpen(false)} />}
          isOpen={isNewRouteDialogOpen}
          setIsOpen={setIsNewRouteDialogOpen}
          trigger={
            <Button variant='default' onClick={() => setIsNewRouteDialogOpen(true)}>
              <Plus className='w-4 h-4 mr-2' />
              Nova rota
            </Button>
          }
          className='sm:max-w-5xl p-0'
        />
      </div>

      <Card className='max-w-full overflow-auto gap-0 py-0'>
        <CardContent>
          <TableRoutes />
        </CardContent>
      </Card>
    </div>
  );
}
