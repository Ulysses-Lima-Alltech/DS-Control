'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';

import DialogForm from '@/components/DialogForm';
import FormRegisterNewUser from '@/components/Forms/FormRegisterNewUser';
import { TableUsers } from '@/components/Tables/TableUsers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function FarmersPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <div className='p-6 min-h-full max-w-screen'>
      <Card className='max-w-full overflow-auto gap-0 pb-0'>
        <CardHeader className='flex flex-row justify-between'>
          <CardTitle className='text-2xl font-bold'>Fazendeiros</CardTitle>
          <DialogForm
            form={
              <FormRegisterNewUser
                defaultUserType='farmer'
                onSuccess={() => setIsDialogOpen(false)}
              />
            }
            trigger={
              <Button>
                <Plus />
                Novo fazendeiro
              </Button>
            }
            isOpen={isDialogOpen}
            setIsOpen={setIsDialogOpen}
          />
        </CardHeader>
        <CardContent>
          <TableUsers userType='farmer' title='Fazendeiro' showStatusFilter />
        </CardContent>
      </Card>
    </div>
  );
}
