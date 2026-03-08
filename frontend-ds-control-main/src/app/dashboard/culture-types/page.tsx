import { Plus } from 'lucide-react';

import DialogForm from '@/components/DialogForm';
import FormRegisterNewCultureType from '@/components/Forms/FormRegisterNewCultureType';
import { TableCultureTypes } from '@/components/Tables/TableCultureTypes';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function CultureTypesPage() {
  return (
    <div className='p-6 min-h-full max-w-screen'>
      <Card className='max-w-full overflow-auto gap-0 pb-0'>
        <CardHeader className='flex flex-row justify-between'>
          <CardTitle className='text-2xl font-bold'>Tipos de Cultura</CardTitle>
          <DialogForm
            form={<FormRegisterNewCultureType />}
            trigger={
              <Button>
                <Plus />
                Novo tipo de cultura
              </Button>
            }
          />
        </CardHeader>
        <CardContent>
          <TableCultureTypes />
        </CardContent>
      </Card>
    </div>
  );
}
