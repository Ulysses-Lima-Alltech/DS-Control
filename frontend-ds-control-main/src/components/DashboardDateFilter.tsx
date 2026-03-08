'use client';

import { format } from 'date-fns';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';

export interface DateParams {
  startDate: string;
  endDate: string;
}

interface DashboardDateFilterProps {
  onDateChange: (dateParams: DateParams) => void;
}

export const DashboardDateFilter = ({ onDateChange }: DashboardDateFilterProps) => {
  const [startDate, setStartDate] = useState<string>(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 3);
    return format(date, 'yyyy-MM-dd');
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return format(new Date(), 'yyyy-MM-dd');
  });

  const handleDateRangePreset = (preset: string) => {
    const today = new Date();
    let start = new Date();
    let end = new Date();

    switch (preset) {
      case 'last7days':
        start.setDate(today.getDate() - 7);
        end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        break;
      case 'last30days':
        start.setDate(today.getDate() - 30);
        end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        break;
      case 'last60days':
        start.setDate(today.getDate() - 60);
        end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        break;
      case 'last90days':
        start.setDate(today.getDate() - 90);
        end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        break;
      case 'last3months':
        start = new Date(today.getFullYear(), today.getMonth() - 3, 1);
        end = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      default:
        return;
    }

    setStartDate(format(start, 'yyyy-MM-dd'));
    setEndDate(format(end, 'yyyy-MM-dd'));
  };

  useEffect(() => {
    onDateChange({ startDate, endDate });
  }, [startDate, endDate]);

  return (
    <div className='sticky top-0 z-50 bg-card/95 backdrop-blur-sm border rounded-lg p-4 shadow-sm'>
      <div className='mb-4'>
        <h2 className='text-xl font-semibold'>Análise de Performance</h2>
        <p className='text-sm text-muted-foreground'>
          Selecione o período para análise das aplicações e desempenho dos pilotos
        </p>
      </div>
      <div className='flex flex-col lg:flex-row gap-4 items-start lg:items-end justify-between'>
        <div className='flex flex-col sm:flex-row gap-4'>
          <div className='flex items-center gap-2'>
            <span className='text-sm font-medium whitespace-nowrap'>Data inicial:</span>
            <DatePicker
              className='w-auto'
              value={startDate}
              onChange={setStartDate}
              placeholder='Selecione a data inicial'
              defaultMonth={startDate ? new Date(startDate) : undefined}
            />
          </div>
          <div className='flex items-center gap-2'>
            <span className='text-sm font-medium whitespace-nowrap'>Data final:</span>
            <DatePicker
              className='w-auto'
              value={endDate}
              onChange={setEndDate}
              placeholder='Selecione a data final'
              defaultMonth={endDate ? new Date(endDate) : undefined}
            />
          </div>
        </div>
        <div className='flex flex-wrap gap-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => handleDateRangePreset('last7days')}
            className='text-xs'
          >
            <span className='sm:hidden'>7d</span>
            <span className='hidden sm:inline'>Últimos 7 dias</span>
          </Button>
          <Button
            variant='outline'
            size='sm'
            onClick={() => handleDateRangePreset('last30days')}
            className='text-xs'
          >
            <span className='md:hidden'>30d</span>
            <span className='hidden md:inline'>Últimos 30 dias</span>
          </Button>
          <Button
            variant='outline'
            size='sm'
            onClick={() => handleDateRangePreset('last60days')}
            className='text-xs'
          >
            <span className='md:hidden'>60d</span>
            <span className='hidden md:inline'>Últimos 60 dias</span>
          </Button>
          <Button
            variant='outline'
            size='sm'
            onClick={() => handleDateRangePreset('last90days')}
            className='text-xs'
          >
            <span className='md:hidden'>90d</span>
            <span className='hidden md:inline'>Últimos 90 dias</span>
          </Button>
          <Button
            variant='outline'
            size='sm'
            onClick={() => handleDateRangePreset('last3months')}
            className='text-xs'
          >
            <span className='md:hidden'>3m</span>
            <span className='hidden md:inline'>Últimos 3 meses completos</span>
          </Button>
        </div>
      </div>
    </div>
  );
};
