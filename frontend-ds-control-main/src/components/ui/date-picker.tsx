'use client';

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface DatePickerProps {
  value?: string;
  onChange?: (date: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  name?: string;
  defaultMonth?: Date;
}

const parseLocalDate = (dateString: string): Date => {
  if (dateString.includes('T')) {
    return new Date(dateString);
  }

  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function DatePicker({
  value,
  onChange,
  placeholder = 'Selecione uma data',
  className,
  disabled,
  name,
  defaultMonth,
}: DatePickerProps) {
  const [date, setDate] = React.useState<Date | undefined>(
    value ? parseLocalDate(value) : undefined
  );
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (value) {
      setDate(parseLocalDate(value));
    } else {
      setDate(undefined);
    }
  }, [value]);

  const handleDateSelect = (selectedDate: Date | undefined) => {
    setDate(selectedDate);
    if (selectedDate) {
      onChange?.(formatLocalDate(selectedDate));
    } else {
      onChange?.('');
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={'outline'}
          className={cn(
            'w-full justify-start text-left font-normal',
            !date && 'text-muted-foreground',
            className
          )}
          disabled={disabled}
          name={name}
        >
          <CalendarIcon className='mr-2 h-4 w-4' />
          {date ? format(date, 'dd/MM/yyyy', { locale: ptBR }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className='w-auto p-0'
        align='start'
        side='bottom'
        sideOffset={8}
        avoidCollisions={false}
      >
        <Calendar
          mode='single'
          selected={date}
          onSelect={handleDateSelect}
          locale={ptBR}
          defaultMonth={defaultMonth}
        />
      </PopoverContent>
    </Popover>
  );
}
