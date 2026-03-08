import { Plus } from 'lucide-react';

import DialogForm from '@/components/DialogForm';
import FormRegisterNewDrone from '@/components/Forms/FormRegisterNewDrone';
import { TableDrones } from '@/components/Tables/TableDrones';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function DronesPage() {
  return (
    <div className='p-6 min-h-full max-w-screen'>
      <Card className='max-w-full overflow-auto gap-0 pb-0'>
        <CardHeader className='flex flex-row justify-between'>
          <CardTitle className='text-2xl font-bold'>Drones</CardTitle>
          <DialogForm
            form={<FormRegisterNewDrone />}
            trigger={
              <Button>
                <Plus />
                Novo drone
              </Button>
            }
          />
        </CardHeader>
        <CardContent>
          <TableDrones />
        </CardContent>
      </Card>
    </div>
  );
}
