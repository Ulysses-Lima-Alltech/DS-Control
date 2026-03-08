'use client';

import { Check, ChevronsUpDown, X } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface MultiInfiniteSearchableSelectOption {
  value: string;
  label: string;
}

interface MultiInfiniteSearchableSelectProps {
  options: MultiInfiniteSearchableSelectOption[];
  values: string[];
  onValuesChange: (values: string[]) => void;
  placeholder?: string;
  emptyText?: string;
  searchPlaceholder?: string;
  className?: string;
  disabled?: boolean;
  maxDisplay?: number;
  onSearchChange?: (value: string) => void;
  onLoadMore?: () => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  portal?: boolean;
}

export function MultiInfiniteSearchableSelect({
  options,
  values,
  onValuesChange,
  placeholder = 'Selecionar...',
  emptyText = 'Nenhum item encontrado.',
  searchPlaceholder = 'Buscar...',
  className,
  disabled = false,
  maxDisplay = 2,
  onSearchChange,
  onLoadMore,
  hasNextPage = false,
  isFetchingNextPage = false,
  portal = true,
}: MultiInfiniteSearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState('');

  const selectedOptions = options.filter((option) => values.includes(option.value));

  const handleSelect = (selectedValue: string) => {
    if (values.includes(selectedValue)) {
      onValuesChange(values.filter((v) => v !== selectedValue));
    } else {
      onValuesChange([...values, selectedValue]);
    }
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onValuesChange([]);
  };

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    onSearchChange?.(value);
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight * 1.5 && hasNextPage && !isFetchingNextPage) {
      onLoadMore?.();
    }
  };

  const displayText = () => {
    if (selectedOptions.length === 0) {
      return placeholder;
    }
    if (selectedOptions.length <= maxDisplay) {
      return selectedOptions.map((o) => o.label).join(', ');
    }
    return `${selectedOptions.length} selecionados`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className='relative'>
        <PopoverTrigger asChild>
          <Button
            variant='outline'
            role='combobox'
            aria-expanded={open}
            className={cn('justify-between pr-8 h-auto min-h-9', className)}
            disabled={disabled}
          >
            <span className='truncate text-left'>{displayText()}</span>
            <ChevronsUpDown className='h-4 w-4 shrink-0 opacity-50' />
          </Button>
        </PopoverTrigger>
        {selectedOptions.length > 0 && (
          <button
            type='button'
            onClick={handleClearAll}
            className='absolute right-8 top-1/2 -translate-y-1/2 h-4 w-4 rounded-sm opacity-50 hover:opacity-100 focus:opacity-100 focus:outline-none disabled:pointer-events-none'
            disabled={disabled}
          >
            <X className='h-4 w-4' />
            <span className='sr-only'>Limpar seleção</span>
          </button>
        )}
      </div>
      <PopoverContent
        className='w-[var(--radix-popover-trigger-width)] p-0'
        align='start'
        portal={portal}
      >
        <Command>
          <CommandInput
            placeholder={searchPlaceholder}
            value={searchValue}
            onValueChange={handleSearchChange}
          />
          <CommandList onScroll={handleScroll} className='max-h-[200px] overflow-y-auto'>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => handleSelect(option.value)}
                  keywords={[option.label, option.value]}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      values.includes(option.value) ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className='truncate'>{option.label}</span>
                </CommandItem>
              ))}
              {isFetchingNextPage && (
                <div className='px-2 py-1.5 text-sm text-muted-foreground'>
                  Carregando mais itens...
                </div>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
