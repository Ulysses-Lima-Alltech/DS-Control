'use client';

import { ArrowRight, Plane, User, UserCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useGetAllAssistants } from '@/queries/assistant.query';
import { useGetAllDrones } from '@/queries/drone.query';
import { useGetAllUsers } from '@/queries/user.query';

export const DashboardCardFleetManagement = () => {
  const router = useRouter();

  const {
    data: drones,
    isPending: isPendingDrones,
    isError: isErrorDrones,
  } = useGetAllDrones({
    page: '1',
    limit: '1000',
  });

  const {
    data: users,
    isPending: isPendingUsers,
    isError: isErrorUsers,
  } = useGetAllUsers({
    page: '1',
    limit: '1000',
  });

  const {
    data: assistants,
    isPending: isPendingAssistants,
    isError: isErrorAssistants,
  } = useGetAllAssistants({
    page: '1',
    limit: '1000',
  });

  const totalDrones = drones?.data?.length || 0;
  const totalPilots = users?.data?.filter((user) => user.type === 'pilot').length || 0;
  const totalAssistants = assistants?.data?.length || 0;

  const isLoading = isPendingDrones || isPendingUsers || isPendingAssistants;
  const hasError = isErrorDrones || isErrorUsers || isErrorAssistants;

  const handleViewUsers = () => {
    router.push('/dashboard/users');
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='flex items-center gap-2'>
            <Plane className='w-5 h-5 text-indigo-500' />
            Frota & Equipe
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='space-y-4'>
            <div className='flex items-center justify-between'>
              <span className='text-sm font-medium'>Carregando...</span>
              <div className='w-8 h-8 bg-muted animate-pulse rounded' />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (hasError) {
    return (
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='flex items-center gap-2'>
            <Plane className='w-5 h-5 text-red-500' />
            Frota & Equipe
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='space-y-4'>
            <div className='text-sm text-muted-foreground'>Erro ao carregar dados</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className='pb-3'>
        <CardTitle className='flex items-center gap-2'>
          <Plane className='w-5 h-5 text-indigo-500' />
          Frota & Equipe
        </CardTitle>
      </CardHeader>
      <CardContent className='flex flex-col h-full'>
        <div className='flex-1 space-y-3'>
          <div className='space-y-2'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <Plane className='w-4 h-4 text-indigo-500' />
                <span className='text-sm font-medium'>Drones</span>
              </div>
              <span className='text-xl font-bold text-indigo-600 dark:text-indigo-400'>
                {totalDrones}
              </span>
            </div>

            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <User className='w-4 h-4 text-blue-500' />
                <span className='text-sm font-medium'>Pilotos</span>
              </div>
              <span className='text-xl font-bold text-blue-600 dark:text-blue-400'>
                {totalPilots}
              </span>
            </div>

            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <UserCheck className='w-4 h-4 text-green-500' />
                <span className='text-sm font-medium'>Ajudantes</span>
              </div>
              <span className='text-xl font-bold text-green-600 dark:text-green-400'>
                {totalAssistants}
              </span>
            </div>
          </div>

          <div className='text-xs text-muted-foreground'>
            {totalDrones > 0 && totalPilots > 0
              ? `Razão: ${(totalDrones / totalPilots).toFixed(1)} drone${totalDrones !== 1 ? 's' : ''}/piloto`
              : 'Proporção frota/equipe não disponível'}
          </div>
        </div>

        <Button
          variant='outline'
          size='sm'
          onClick={handleViewUsers}
          className='w-full flex items-center justify-center gap-2 mt-4'
        >
          Ver Usuários
          <ArrowRight className='w-4 h-4' />
        </Button>
      </CardContent>
    </Card>
  );
};
