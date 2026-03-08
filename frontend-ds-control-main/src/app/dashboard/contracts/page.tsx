import { Plus } from 'lucide-react';

import DialogForm from '@/components/DialogForm';
import FormRegisterNewContract from '@/components/Forms/FormRegisterNewContract';
import { TableContracts } from '@/components/Tables/TableContracts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ContractsPage() {
  return (
    <div className='p-6 min-h-full max-w-screen'>
      <Card className='max-w-full overflow-auto gap-0'>
        <CardHeader className='flex flex-row justify-between'>
          <CardTitle className='text-2xl font-bold'>Contratos</CardTitle>
          <DialogForm
            form={<FormRegisterNewContract />}
            trigger={
              <Button>
                <Plus />
                Novo contrato
              </Button>
            }
          />
        </CardHeader>
        <CardContent>
          <TableContracts />
        </CardContent>
      </Card>
    </div>
  );
}
