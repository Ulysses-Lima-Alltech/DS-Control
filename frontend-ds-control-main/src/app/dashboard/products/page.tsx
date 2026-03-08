import { Plus } from 'lucide-react';

import DialogForm from '@/components/DialogForm';
import FormRegisterNewProduct from '@/components/Forms/FormRegisterNewProduct';
import { TableProducts } from '@/components/Tables/TableProducts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ProductsPage() {
  return (
    <div className='p-6 min-h-full max-w-screen'>
      <Card className='max-w-full overflow-auto gap-0 pb-0'>
        <CardHeader className='flex flex-row justify-between'>
          <CardTitle className='text-2xl font-bold'>Produtos</CardTitle>
          <DialogForm
            form={<FormRegisterNewProduct />}
            trigger={
              <Button>
                <Plus />
                Novo produto
              </Button>
            }
          />
        </CardHeader>
        <CardContent>
          <TableProducts />
        </CardContent>
      </Card>
    </div>
  );
}
