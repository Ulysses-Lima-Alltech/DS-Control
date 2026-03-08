'use client';

import { debounce } from 'lodash';
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

export interface SearchableSelectQueryOption {
  value: string;
  label: string;
  aditionalInformation?: string;
}

interface SearchableSelectQueryProps {
  options: SearchableSelectQueryOption[];
  value?: string | string[];
  onValueChange?: (value: string | string[] | undefined) => void;
  placeholder?: string;
  emptyText?: string;
  searchPlaceholder?: string;
  className?: string;
  disabled?: boolean;
  clearable?: boolean;
  isMultipleSelections?: boolean;
  showCheckbox?: boolean;
  popoverClassName?: string;
  onSearchChange?: (search: string) => void;
  onScrollEnd?: () => void;
  isLoading?: boolean;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  portal?: boolean;
  onItemClick?: (value: string) => void;
}

export function SearchableSelectQuery({
  options,
  value,
  onValueChange,
  placeholder = 'Selecionar...',
  emptyText = 'Nenhum item encontrado.',
  searchPlaceholder = 'Buscar...',
  className,
  disabled = false,
  clearable = true,
  isMultipleSelections = false,
  showCheckbox = false,
  popoverClassName,
  onSearchChange,
  onScrollEnd,
  isLoading = false,
  hasNextPage = false,
  isFetchingNextPage = false,
  portal = false,
  onItemClick,
}: SearchableSelectQueryProps) {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState('');

  const debouncedSearchRef = React.useRef<ReturnType<typeof debounce> | null>(null);

  React.useEffect(() => {
    debouncedSearchRef.current = debounce((searchTerm: string) => {
      onSearchChange?.(searchTerm);
    }, 300);

    return () => {
      debouncedSearchRef.current?.cancel();
    };
  }, [onSearchChange]);

  const selectedValues = isMultipleSelections
    ? (value as string[]) || []
    : [value as string].filter(Boolean);

  const selectedOptions = options.filter((option) => selectedValues.includes(option.value));

  const handleSelect = (selectedValue: string) => {
    if (isMultipleSelections) {
      const currentValues = (value as string[]) || [];
      const newValues = currentValues.includes(selectedValue)
        ? currentValues.filter((v) => v !== selectedValue)
        : [...currentValues, selectedValue];
      onValueChange?.(newValues);
    } else {
      const newValue = selectedValue === value ? undefined : selectedValue;
      onValueChange?.(newValue);
      setOpen(false);
    }
  };

  const handleItemClick = (selectedValue: string) => {
    if (isMultipleSelections) {
      if (onItemClick) {
        onItemClick(selectedValue);
      } else {
        handleSelect(selectedValue);
      }
    } else {
      handleSelect(selectedValue);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onValueChange?.(isMultipleSelections ? [] : undefined);
  };

  const handleInputChange = (value: string) => {
    setSearchValue(value);
    debouncedSearchRef.current?.(value);
  };

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 1 && hasNextPage && !isFetchingNextPage) {
      onScrollEnd?.();
    }
  };

  const getDisplayText = () => {
    if (isMultipleSelections) {
      if (selectedValues.length === 0) return placeholder;
      if (selectedValues.length === 1) return selectedOptions[0]?.label || placeholder;
      return `${selectedValues.length} itens selecionados`;
    }
    return selectedOptions[0]?.label || placeholder;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className='relative'>
        <PopoverTrigger asChild>
          <Button
            variant='outline'
            role='combobox'
            aria-expanded={open}
            className={cn('justify-between pr-8', className)}
            disabled={disabled}
          >
            <span className='truncate'>{getDisplayText()}</span>
            <ChevronsUpDown className='h-4 w-4 shrink-0 opacity-50' />
          </Button>
        </PopoverTrigger>
        {clearable && selectedValues.length > 0 && (
          <button
            type='button'
            onClick={handleClear}
            className='absolute right-8 top-1/2 -translate-y-1/2 h-4 w-4 rounded-sm opacity-50 hover:opacity-100 focus:opacity-100 focus:outline-none disabled:pointer-events-none'
            disabled={disabled}
          >
            <X className='h-4 w-4' />
            <span className='sr-only'>Clear selection</span>
          </button>
        )}
      </div>
      <PopoverContent
        className={`w-[var(--radix-popover-trigger-width)] p-0 ${popoverClassName}`}
        align='start'
        portal={portal}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={searchValue}
            onValueChange={handleInputChange}
          />
          <CommandList onScroll={handleScroll} className='max-h-[200px]'>
            {options.length === 0 && !isLoading && <CommandEmpty>{emptyText}</CommandEmpty>}
            <CommandGroup>
              {isLoading && (
                <div className='flex items-center justify-center py-2 text-sm text-muted-foreground'>
                  Carregando mais itens...
                </div>
              )}
              {options.map((option) => {
                const isSelected = selectedValues.includes(option.value);

                return (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={() => handleItemClick(option.value)}
                    className='flex items-center space-x-2 cursor-pointer'
                  >
                    {showCheckbox && isMultipleSelections && (
                      <input
                        type='checkbox'
                        checked={isSelected}
                        onChange={() => handleSelect(option.value)}
                        className='cursor-pointer'
                      />
                    )}
                    <span className='text-sm flex-2/3'>{option.label}</span>
                    {option.aditionalInformation && (
                      <span className='flex-1/3 text-xs text-muted-foreground text-right'>
                        {option.aditionalInformation}
                      </span>
                    )}
                    {!option.aditionalInformation && isSelected && (
                      <span className='flex text-xs text-muted-foreground text-right'>
                        <Check />
                      </span>
                    )}
                  </CommandItem>
                );
              })}
              {isFetchingNextPage && (
                <div className='flex items-center justify-center py-2 text-sm text-muted-foreground'>
                  Carregando mais...
                </div>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
