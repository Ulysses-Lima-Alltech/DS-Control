'use client';

import { Plus } from 'lucide-react';

import DialogForm from '@/components/DialogForm';
import FormRegisterNewCropSeason from '@/components/Forms/FormRegisterNewCropSeason';
import { TableCropSeasons } from '@/components/Tables/TableCropSeasons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function ConfigurationsPage() {
  return (
    <div className='p-6 min-h-full max-w-screen'>
      <Card className='max-w-full overflow-auto gap-0 pb-0'>
        <CardHeader className='pb-0'>
          <CardTitle className='text-2xl font-bold'>Configurações do sistema</CardTitle>
        </CardHeader>
        <CardContent className='pt-0'>
          <Tabs defaultValue='crop-seasons' className='w-full'>
            <TabsList>
              <TabsTrigger value='crop-seasons'>Safras</TabsTrigger>
            </TabsList>

            <TabsContent value='crop-seasons' className='pt-6'>
              <div className='mb-4 flex justify-end'>
                <DialogForm
                  form={<FormRegisterNewCropSeason />}
                  trigger={
                    <Button>
                      <Plus className='h-4 w-4 mr-2' />
                      Nova safra
                    </Button>
                  }
                />
              </div>
              <TableCropSeasons />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

