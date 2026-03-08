'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';

import DialogForm from '@/components/DialogForm';
import FormRegisterNewFarm from '@/components/Forms/FormRegisterNewFarm';
import TableFarms from '@/components/Tables/TableFarms';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function FarmsPage() {
  const [isNewFarmDialogOpen, setIsNewFarmDialogOpen] = useState(false);

  return (
    <div className='p-6 space-y-6 min-h-full max-w-screen'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold'>Fazendas</h1>
          <p>Gerencie todas as fazendas cadastradas</p>
        </div>
        <DialogForm
          form={<FormRegisterNewFarm closeDialog={() => setIsNewFarmDialogOpen(false)} />}
          isOpen={isNewFarmDialogOpen}
          setIsOpen={setIsNewFarmDialogOpen}
          trigger={
            <Button variant='default' onClick={() => setIsNewFarmDialogOpen(true)}>
              <Plus className='w-4 h-4 mr-2' />
              Nova fazenda
            </Button>
          }
          className='sm:max-w-5xl p-0'
        />
      </div>

      <Card className='max-w-full overflow-auto gap-0 py-0'>
        <CardContent>
          <TableFarms />
        </CardContent>
      </Card>
    </div>
  );
}
