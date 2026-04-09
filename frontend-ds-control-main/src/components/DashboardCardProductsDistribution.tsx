'use client';

import { InfiniteData } from '@tanstack/react-query';
import { Droplets, PieChart } from 'lucide-react';
import { useState } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { SearchableSelectQuery } from '@/components/ui/searchable-select-query';
import { useGetStatsApplications } from '@/queries/application.query';
import { useGetAllCustomersInfinite } from '@/queries/customer.query';
import { Customer } from '@/types/customer.type';

import { Skeleton } from './ui/skeleton';

interface DashboardCardProductsDistributionProps {
  startDate?: string;
  endDate?: string;
}

export const DashboardCardProductsDistribution = ({
  startDate,
  endDate,
}: DashboardCardProductsDistributionProps) => {
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>(undefined);
  const [customerSearchValue, setCustomerSearchValue] = useState('');

  const {
    data: customersData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isLoadingCustomers,
  } = useGetAllCustomersInfinite({
    limit: '10',
    search: customerSearchValue || undefined,
  });

  const allCustomers =
    (customersData as unknown as InfiniteData<{ data: Customer[] }>)?.pages?.flatMap(
      (page) => page.data
    ) || [];

  const {
    data: stats,
    isPending: isLoadingStats,
    isError: isErrorOnStats,
  } = useGetStatsApplications({
    customerId: selectedCustomerId,
    startDate,
    endDate,
  });

  if (isLoadingStats) {
    return <SkeletonLoadingCard />;
  }

  if (isErrorOnStats || !stats) {
    return <SkeletonErrorCard />;
  }

  const totalHectares =
    stats?.stats?.typeOfProducts?.reduce((sum, product) => sum + product.hectares, 0) || 0;
  const allProducts = stats?.stats?.typeOfProducts?.sort((a, b) => b.hectares - a.hectares) || [];
  const displayedProducts = showAllProducts ? allProducts : allProducts.slice(0, 3);

  return (
    <Card className='min-w-0'>
      <CardHeader className='pb-3'>
        <div className='flex items-center justify-between gap-2 min-w-0'>
          <div className='min-w-0 flex-1'>
            <CardTitle className='flex items-center gap-2 min-w-0'>
              <PieChart className='w-5 h-5 text-indigo-500 flex-shrink-0' />
              <span className='truncate'>Tipos de Aplicação</span>
            </CardTitle>
            <CardDescription className='truncate'>Área aplicada por produto</CardDescription>
          </div>
          <div className='w-[200px] flex-shrink-0'>
            <SearchableSelectQuery
              options={allCustomers.map((customer: Customer) => ({
                value: customer.id,
                label: customer.name,
              }))}
              value={selectedCustomerId}
              onValueChange={(value) => setSelectedCustomerId(value as string | undefined)}
              placeholder='Todos os clientes'
              searchPlaceholder='Buscar cliente...'
              className='w-full'
              clearable
              onSearchChange={setCustomerSearchValue}
              onScrollEnd={fetchNextPage}
              hasNextPage={hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
              isLoading={isLoadingCustomers}
              portal={true}
              popoverClassName='w-[250px]'
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className='flex flex-col h-full'>
        <div className='flex-1 space-y-3'>
          <div className='flex items-center justify-between gap-2 min-w-0'>
            <span className='text-sm font-medium truncate'>Total de Tipos</span>
            <span className='text-2xl font-bold text-indigo-600 dark:text-indigo-400 flex-shrink-0'>
              {stats?.stats?.typeOfProducts?.length || 0}
            </span>
          </div>

          {displayedProducts.length > 0 ? (
            <div className='space-y-3'>
              {displayedProducts.map((product, index) => {
                const percentage = totalHectares > 0 ? (product.hectares / totalHectares) * 100 : 0;
                const colors = ['text-emerald-600', 'text-sky-600', 'text-violet-600'];

                return (
                  <div
                    key={index}
                    className='space-y-1 rounded-md border border-border/40 bg-muted/20 p-2.5'
                  >
                    <div className='flex items-center justify-between gap-2 min-w-0'>
                      <div className='flex items-center gap-2 min-w-0'>
                        <Droplets
                          className={`w-4 h-4 flex-shrink-0 ${colors[index % colors.length]}`}
                        />
                        <span className='text-xs font-medium truncate' title={product.product}>
                          {product.product}
                        </span>
                      </div>
                      <span className='text-sm font-semibold flex-shrink-0'>
                        {product.hectares.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ha
                      </span>
                    </div>
                    <Progress value={percentage} className='h-2 bg-muted/60' />
                    <div className='text-xs text-muted-foreground truncate'>
                      {percentage.toFixed(1)}% do total
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className='text-sm text-muted-foreground text-center py-4'>
              Nenhuma aplicação registrada
            </div>
          )}

          {(stats?.stats?.typeOfProducts?.length || 0) > 3 && !showAllProducts && (
            <button
              onClick={() => setShowAllProducts(true)}
              className='text-xs text-muted-foreground hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer'
            >
              +{(stats?.stats?.typeOfProducts?.length || 0) - 3} outros produtos
            </button>
          )}
          {showAllProducts && (stats?.stats?.typeOfProducts?.length || 0) > 3 && (
            <button
              onClick={() => setShowAllProducts(false)}
              className='text-xs text-muted-foreground hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer'
            >
              Ver menos
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const SkeletonLoadingCard = () => {
  return (
    <Card>
      <CardHeader className='pb-3'>
        <CardTitle className='flex items-center gap-2'>
          <Droplets className='w-5 h-5 text-green-500' />
          Tipos de Aplicação
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className='space-y-4'>
          <div className='flex items-center justify-between'>
            <Skeleton className='w-24 h-4' />
            <Skeleton className='w-24 h-8' />
          </div>
          <div className='flex items-center justify-between'>
            <Skeleton className='w-24 h-4' />
            <Skeleton className='w-24 h-8' />
          </div>
          <div className='flex items-center justify-between'>
            <Skeleton className='w-24 h-4' />
            <Skeleton className='w-24 h-8' />
          </div>
          <div className='flex items-center justify-between'>
            <Skeleton className='w-24 h-4' />
            <Skeleton className='w-24 h-8' />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const SkeletonErrorCard = () => {
  return (
    <Card>
      <CardHeader className='pb-3'>
        <CardTitle className='flex items-center gap-2'>
          <Droplets className='w-5 h-5 text-red-500' />
          Tipos de Aplicação
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className='space-y-4'>
          <div className='text-sm text-muted-foreground'>Erro ao carregar dados</div>
        </div>
      </CardContent>
    </Card>
  );
};
