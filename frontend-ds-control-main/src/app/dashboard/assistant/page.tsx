import { Plus } from 'lucide-react';

import DialogForm from '@/components/DialogForm';
import FormRegisterNewAssistant from '@/components/Forms/FormRegisterNewAssistant';
import { TableAssistants } from '@/components/Tables/TableAssistants';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AssistantPage() {
  return (
    <div className='p-6 min-h-full max-w-screen'>
      <Card className='max-w-full overflow-auto gap-0 pb-0'>
        <CardHeader className='flex flex-row justify-between'>
          <CardTitle className='text-2xl font-bold'>Ajudantes</CardTitle>
          <DialogForm
            form={<FormRegisterNewAssistant />}
            trigger={
              <Button>
                <Plus />
                Novo ajudante
              </Button>
            }
          />
        </CardHeader>
        <CardContent>
          <TableAssistants />
        </CardContent>
      </Card>
    </div>
  );
}
