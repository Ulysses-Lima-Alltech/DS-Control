'use client';

import { Pencil } from 'lucide-react';
import { useState } from 'react';

import DialogForm from '@/components/DialogForm';
import FormEditCustomer from '@/components/Forms/FormEditCustomer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useGetCustomerById } from '@/queries/customer.query';
import type { Customer } from '@/types/customer.type';
import { documentFormatter } from '@/utils/document-formatter';
import { phoneFormatter } from '@/utils/phone-formatter';
import { formatTimestamp } from '@/utils/timestamp-formatter';

type CardCustomerDetailsProps = {
  customerId: string;
};

export default function CardCustomerDetails({ customerId }: CardCustomerDetailsProps) {
  const { data, isPending: isLoading, isError } = useGetCustomerById(customerId);

  if (isLoading) {
    return <CardCustomerDetailsLoading />;
  }

  if (isError || !data?.customer) {
    return <CardCustomerDetailsError />;
  }

  return <LoadedCardCustomerDetails customer={data.customer} />;
}

function CardCustomerDetailsLoading() {
  return (
    <Card className='h-full rounded-none border-l border-border border-t-0 border-r-0 border-b-0 flex flex-col gap-0'>
      <CardHeader className='pb-4 flex-shrink-0'>
        <Skeleton className='h-6 w-48' />
      </CardHeader>

      <CardContent className='flex-1 space-y-4 p-6 overflow-y-auto overflow-x-hidden'>
        <div className='space-y-4'>
          <div>
            <Skeleton className='h-4 w-40 mb-3' />
            <div className='space-y-4'>
              <div className='flex flex-col gap-1 py-2'>
                <Skeleton className='h-4 w-16' />
                <Skeleton className='h-4 w-32' />
              </div>
              <div className='flex flex-col gap-1 py-2'>
                <Skeleton className='h-4 w-24' />
                <Skeleton className='h-4 w-40' />
              </div>
              <div className='flex flex-col gap-1 py-2'>
                <Skeleton className='h-4 w-12' />
                <Skeleton className='h-4 w-36' />
              </div>
              <div className='flex flex-col gap-1 py-2'>
                <Skeleton className='h-4 w-16' />
                <Skeleton className='h-4 w-28' />
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <Skeleton className='h-4 w-36 mb-3' />
            <div className='space-y-4'>
              <div className='flex flex-col gap-1 py-2'>
                <Skeleton className='h-4 w-28' />
                <Skeleton className='h-4 w-24' />
              </div>
            </div>
          </div>

          <div className='pt-4 border-t'>
            <Skeleton className='h-4 w-20 mb-3' />
            <Skeleton className='h-9 w-full' />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CardCustomerDetailsError() {
  return (
    <Card className='h-full rounded-none border-l border-t-0 border-r-0 border-b-0 flex flex-col gap-0 border-destructive'>
      <CardHeader className='pb-4 flex-shrink-0'>
        <CardTitle className='text-xl font-semibold text-destructive truncate'>
          Erro ao carregar
        </CardTitle>
      </CardHeader>

      <CardContent className='flex-1 space-y-4 p-6 overflow-y-auto overflow-x-hidden'>
        <div className='space-y-4'>
          <div>
            <div className='h-4 w-40 bg-destructive/20 rounded mb-3' />
            <div className='space-y-4'>
              <div className='flex flex-col gap-1 py-2'>
                <div className='h-4 w-16 bg-destructive/20 rounded' />
                <div className='h-4 w-32 bg-destructive/10 rounded' />
              </div>
              <div className='flex flex-col gap-1 py-2'>
                <div className='h-4 w-24 bg-destructive/20 rounded' />
                <div className='h-4 w-40 bg-destructive/10 rounded' />
              </div>
              <div className='flex flex-col gap-1 py-2'>
                <div className='h-4 w-12 bg-destructive/20 rounded' />
                <div className='h-4 w-36 bg-destructive/10 rounded' />
              </div>
              <div className='flex flex-col gap-1 py-2'>
                <div className='h-4 w-16 bg-destructive/20 rounded' />
                <div className='h-4 w-28 bg-destructive/10 rounded' />
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <div className='h-4 w-36 bg-destructive/20 rounded mb-3' />
            <div className='space-y-4'>
              <div className='flex flex-col gap-1 py-2'>
                <div className='h-4 w-28 bg-destructive/20 rounded' />
                <div className='h-4 w-24 bg-destructive/10 rounded' />
              </div>
            </div>
          </div>
        </div>

        <div className='mt-6 p-3 bg-destructive/5 rounded border border-destructive/20'>
          <div className='text-sm text-destructive text-center'>
            Não foi possível carregar os detalhes do cliente
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LoadedCardCustomerDetails({ customer }: { customer: Customer }) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  return (
    <Card className='h-full rounded-none border-l border-border border-t-0 border-r-0 border-b-0 flex flex-col gap-0'>
      <CardHeader className='pb-4 flex-shrink-0'>
        <CardTitle className='text-xl font-semibold text-foreground'>Detalhes do Cliente</CardTitle>
      </CardHeader>

      <CardContent className='flex-1 space-y-4 p-6 overflow-y-auto overflow-x-hidden'>
        <div className='space-y-4'>
          <div>
            <h3 className='text-sm font-medium text-muted-foreground mb-3'>
              Informações do Cliente
            </h3>
            <div className='space-y-4'>
              <div className='flex flex-col gap-1 py-2'>
                <span className='text-sm font-medium'>Nome</span>
                <span className='text-sm text-muted-foreground break-words'>{customer.name}</span>
              </div>
              {customer.entity_type === 'PJ' && customer.razaoSocial && (
                <div className='flex flex-col gap-1 py-2'>
                  <span className='text-sm font-medium'>Razão Social</span>
                  <span className='text-sm text-muted-foreground break-words'>
                    {customer.razaoSocial}
                  </span>
                </div>
              )}
              <div className='flex flex-col gap-1 py-2'>
                <span className='text-sm font-medium'>
                  {customer.entity_type === 'PF' ? 'CPF' : 'CNPJ'}
                </span>
                <span className='text-sm text-muted-foreground break-words'>
                  {documentFormatter(customer.document_number ?? '')}
                </span>
              </div>
              <div className='flex flex-col gap-1 py-2'>
                <span className='text-sm font-medium'>Telefone</span>
                <span className='text-sm text-muted-foreground break-words'>
                  {phoneFormatter(customer.phone ?? '')}
                </span>
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className='text-sm font-medium text-muted-foreground mb-3'>
              Informações do Sistema
            </h3>
            <div className='space-y-4'>
              <div className='flex flex-col gap-1 py-2'>
                <span className='text-sm font-medium'>Data de Criação</span>
                <span className='text-sm text-muted-foreground break-words'>
                  {formatTimestamp(customer.createdAt ?? null)}
                </span>
              </div>
            </div>
          </div>

          <div className='pt-4 border-t'>
            <h3 className='text-sm font-medium text-muted-foreground mb-3'>Editar</h3>
            <DialogForm
              form={
                <FormEditCustomer
                  customer={customer}
                  onSuccess={() => setIsEditDialogOpen(false)}
                />
              }
              trigger={
                <Button variant='outline' size='sm' className='flex items-center gap-2 w-full'>
                  <Pencil className='h-4 w-4' />
                  Editar Cliente
                </Button>
              }
              isOpen={isEditDialogOpen}
              setIsOpen={setIsEditDialogOpen}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
