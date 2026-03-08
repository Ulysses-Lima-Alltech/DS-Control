'use client';
import { Plus } from 'lucide-react';
import { useState } from 'react';

import DialogForm from '@/components/DialogForm';
import FormRegisterNewCustomer from '@/components/Forms/FormRegisterNewCustomer';
import { TableCustomers } from '@/components/Tables/TableCustomers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function CustomersPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleSuccess = () => {
    setIsDialogOpen(false);
  };

  return (
    <div className='p-6 min-h-full max-w-screen'>
      <Card className='max-w-full overflow-auto gap-0'>
        <CardHeader className='flex flex-row justify-between'>
          <CardTitle className='text-2xl font-bold'>Clientes</CardTitle>
          <DialogForm
            form={<FormRegisterNewCustomer onSuccess={handleSuccess} />}
            trigger={
              <Button>
                <Plus />
                Novo cliente
              </Button>
            }
            isOpen={isDialogOpen}
            setIsOpen={setIsDialogOpen}
          />
        </CardHeader>
        <CardContent>
          <TableCustomers />
        </CardContent>
      </Card>
    </div>
  );
}
