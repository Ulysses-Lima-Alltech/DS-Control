'use client';

import {
  ColumnDef,
  ColumnFiltersState,
  OnChangeFn,
  Row,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import * as React from 'react';

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    onCellClick?: (row: TData) => void;
  }
}

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export type ColumnDefWithId<TData, TValue = unknown> = ColumnDef<TData, TValue> & {
  id: string;
  label?: string;
};

interface DataTableProps<TData, TValue> {
  columns: ColumnDefWithId<TData, TValue>[];
  data: TData[];
  pagination?: {
    manual?: boolean;
    pageCount?: number;
    currentPage?: number;
    pageSize?: number;
    totalCount?: number;
    totalPages?: number;
    onPageChange?: (page: number) => void;
    onPageSizeChange?: (pageSize: number) => void;
  };
  searchConfig?: {
    placeholder?: string;
    searchValue?: string;
    onSearchChange?: (value: string) => void;
    globalFilter?: boolean;
    globalFilterFn?: (row: Row<TData>, columnId: string, filterValue: string) => boolean;
    className?: string;
  };
  filters?: React.ReactNode;
  isLoading?: boolean;
  isError?: boolean;
  error?: Error | null;
  className?: string;
  columnVisibility?: VisibilityState;
  onColumnVisibilityChange?: OnChangeFn<VisibilityState>;
  initialColumnVisibility?: Record<string, boolean>;
  renderSkeletonRows?: (count: number) => React.ReactNode;
  renderErrorState?: () => React.ReactNode;
  renderEmptyState?: () => React.ReactNode;
  expandedRows?: Set<string>;
  renderExpandedRow?: (row: TData, rowIndex: number) => React.ReactNode;
  onRetry?: () => void;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  pagination,
  searchConfig,
  filters,
  isLoading = false,
  isError = false,
  error,
  className,
  columnVisibility: externalColumnVisibility,
  onColumnVisibilityChange,
  initialColumnVisibility,
  renderSkeletonRows,
  renderErrorState,
  renderEmptyState,
  expandedRows,
  renderExpandedRow,
  onRetry,
}: DataTableProps<TData, TValue>) {
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [internalColumnVisibility, setInternalColumnVisibility] = React.useState<VisibilityState>(
    initialColumnVisibility || {}
  );
  const [globalFilter, setGlobalFilter] = React.useState('');

  const columnVisibility = externalColumnVisibility || internalColumnVisibility;
  const setColumnVisibility = React.useCallback(
    (updater: VisibilityState | ((prev: VisibilityState) => VisibilityState)) => {
      const newVisibility = typeof updater === 'function' ? updater(columnVisibility) : updater;

      const visibleColumns = Object.entries(newVisibility).filter(([, isVisible]) => isVisible);
      const dataColumns = columns.filter((col) => col.id !== 'actions' && col.id !== 'expand');
      const visibleDataColumns = visibleColumns.filter(([columnId]) =>
        dataColumns.some((col) => col.id === columnId)
      );

      if (visibleDataColumns.length === 0 && dataColumns.length > 0) {
        const firstDataColumn = dataColumns[0];
        newVisibility[firstDataColumn.id] = true;
      }

      if (onColumnVisibilityChange) {
        onColumnVisibilityChange(newVisibility);
      } else {
        setInternalColumnVisibility(newVisibility);
      }
    },
    [columnVisibility, columns, onColumnVisibilityChange]
  );

  const table = useReactTable({
    data,
    columns,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: searchConfig?.globalFilterFn || undefined,
    state: {
      columnFilters,
      columnVisibility,
      globalFilter: searchConfig?.globalFilter ? globalFilter : undefined,
    },
    manualPagination: pagination?.manual || false,
    pageCount: pagination?.pageCount || -1,
    columnResizeMode: 'onChange',
  });

  const searchValue = (searchConfig?.searchValue ?? globalFilter) || '';
  const handleSearchChange = (value: string) => {
    if (searchConfig?.onSearchChange) {
      searchConfig.onSearchChange(value);
    } else {
      setGlobalFilter(value);
    }
  };

  const currentPage = pagination?.currentPage || table.getState().pagination.pageIndex + 1;
  const pageSize = pagination?.pageSize || table.getState().pagination.pageSize;
  const totalPages = pagination?.totalPages || table.getPageCount();
  const totalCount = pagination?.totalCount;

  const handlePageChange = (page: number) => {
    if (pagination?.onPageChange) {
      pagination.onPageChange(page);
    } else {
      table.setPageIndex(page - 1);
    }
  };

  const handlePageSizeChange = (newPageSize: number) => {
    if (pagination?.onPageSizeChange) {
      pagination.onPageSizeChange(newPageSize);
    } else {
      table.setPageSize(newPageSize);
    }
  };

  const toolbar = (
    <div className='flex flex-col items-center gap-4 py-4 w-auto md:flex-row'>
      <div className='flex flex-row justify-between w-full overflow-x-scroll scrollbar-hide space-x-2 p-2 px-0'>
        <Input
          placeholder={searchConfig?.placeholder || 'Buscar...'}
          value={searchValue}
          onChange={(event) => handleSearchChange(event.target.value)}
          className={`max-w-sm min-w-[150px] w-full md:w-[18rem] text-ellipsis ${searchConfig?.className || ''}`}
        />
        {filters && <div className='flex items-center gap-2 w-fit'>{filters}</div>}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='outline' className='ml-auto'>
              Colunas <ChevronDown className='ml-2 h-4 w-4' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => {
                const columnDef = column.columnDef as ColumnDef<TData, TValue> & {
                  label?: string;
                };
                const isDataColumn = column.id !== 'actions' && column.id !== 'expand';
                const isVisible = column.getIsVisible();

                const visibleDataColumns = table
                  .getAllColumns()
                  .filter((col) => col.getIsVisible() && col.id !== 'actions' && col.id !== 'expand');

                const wouldBeLastDataColumn =
                  isDataColumn && isVisible && visibleDataColumns.length === 1;
                const isDisabled = wouldBeLastDataColumn;

                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className='capitalize'
                    checked={isVisible}
                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                    disabled={isDisabled}
                  >
                    {columnDef.label || column.id}
                  </DropdownMenuCheckboxItem>
                );
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  const errorPanel = (
    <div className='rounded-md border border-destructive/20 bg-destructive/5'>
      {renderErrorState ? (
        renderErrorState()
      ) : (
        <div className='flex flex-col items-center justify-center gap-3 px-4 py-10 text-center'>
          <p className='text-sm font-medium text-foreground'>Não foi possível carregar os dados</p>
          <p className='text-xs text-muted-foreground max-w-md'>
            {error?.message || 'Erro desconhecido. Verifique a conexão e tente novamente.'}
          </p>
          {onRetry && (
            <Button variant='outline' size='sm' onClick={onRetry}>
              Tentar novamente
            </Button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className={`w-full ${className || ''}`}>
      {toolbar}
      {isError ? (
        errorPanel
      ) : isLoading ? (
        <>
          <div className='rounded-md border overflow-hidden'>
            <div className='overflow-x-auto'>
              <Table className='w-full'>
                <TableHeader>
                  <TableRow>
                    {columns.map((column, index) => (
                      <TableHead key={index} className='px-3 py-2 align-middle'>
                        <Skeleton className='h-5 w-24 max-w-[min(100%,8rem)]' />
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {renderSkeletonRows
                    ? renderSkeletonRows(5)
                    : Array.from({ length: 5 }).map((_, index) => (
                        <TableRow key={index}>
                          {columns.map((_, colIndex) => (
                            <TableCell key={colIndex} className='px-3 py-2.5'>
                              <Skeleton
                                className={`h-5 max-w-full ${['w-28', 'w-36', 'w-32', 'w-24', 'w-40', 'w-20'][colIndex % 6]}`}
                              />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <div className='flex items-center justify-between space-x-2 py-4'>
            <Skeleton className='h-8 w-[120px]' />
            <div className='flex items-center space-x-2'>
              <Skeleton className='h-8 w-8' />
              <Skeleton className='h-8 w-8' />
              <Skeleton className='h-8 w-8' />
              <Skeleton className='h-8 w-8' />
            </div>
          </div>
        </>
      ) : (
        <>
          <div className='rounded-md border w-full overflow-hidden'>
            <div className='overflow-x-auto w-full'>
              <Table className='w-full'>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => {
                        return (
                          <TableHead
                            key={header.id}
                            className='px-3 py-2 text-left align-middle whitespace-nowrap'
                          >
                            {header.isPlaceholder
                              ? null
                              : flexRender(header.column.columnDef.header, header.getContext())}
                          </TableHead>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.map((row, index) => (
                      <React.Fragment key={row.id}>
                        <TableRow data-state={row.getIsSelected() && 'selected'}>
                          {row.getVisibleCells().map((cell) => {
                            const onCellClick = cell.column.columnDef.meta?.onCellClick;

                            return (
                              <TableCell
                                key={cell.id}
                                className={`px-3 py-2 ${onCellClick ? 'cursor-pointer hover:bg-muted/50' : ''}`}
                                onClick={onCellClick ? () => onCellClick(row.original) : undefined}
                              >
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                        {expandedRows?.has(row.id) && renderExpandedRow && (
                          <TableRow key={`expanded-${row.id}`} className='bg-muted/50'>
                            <TableCell
                              colSpan={row.getVisibleCells().length}
                              className='p-0 w-full'
                            >
                              <div className='w-full overflow-hidden'>
                                {renderExpandedRow(row.original, index)}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    ))
                  ) : renderEmptyState ? (
                    <TableRow>
                      <TableCell
                        colSpan={table.getVisibleLeafColumns().length}
                        className='min-h-[12rem] py-8 text-center align-middle'
                      >
                        {renderEmptyState()}
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={table.getVisibleLeafColumns().length}
                        className='min-h-[12rem] py-8 text-center align-middle text-muted-foreground text-sm'
                      >
                        Nenhum resultado encontrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
          <div className='flex items-center justify-between space-x-2 py-4'>
            <div className='hidden sm:flex items-center space-x-2'>
              <p className='text-sm font-medium'>Linhas por página</p>
              <Select
                value={`${pageSize}`}
                onValueChange={(value) => handlePageSizeChange(Number(value))}
              >
                <SelectTrigger className='h-8 w-[70px]'>
                  <SelectValue placeholder={pageSize} />
                </SelectTrigger>
                <SelectContent side='top'>
                  {[10, 20, 30, 40, 50].map((size) => (
                    <SelectItem key={size} value={`${size}`}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='flex w-full sm:w-auto items-center space-x-6 lg:space-x-8'>
              {totalCount && (
                <div className='hidden sm:block text-muted-foreground text-sm whitespace-nowrap'>
                  {totalCount} item(s) no total
                </div>
              )}

              <div className='flex w-full flex-row justify-between sm:w-auto sm:flex sm:items-center sm:space-x-2'>
                <div className='flex items-center space-x-2'>
                  <Button
                    variant='outline'
                    className='h-8 w-8 p-0'
                    onClick={() => handlePageChange(1)}
                    disabled={currentPage === 1}
                  >
                    <span className='sr-only'>Ir para primeira página</span>
                    <ChevronsLeft className='h-4 w-4' />
                  </Button>
                  <Button
                    variant='outline'
                    className='h-8 w-8 p-0'
                    onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    <span className='sr-only'>Ir para página anterior</span>
                    <ChevronLeft className='h-4 w-4' />
                  </Button>
                </div>
                <div className='flex items-center space-x-2'>
                  <p className='text-sm font-medium whitespace-nowrap'>
                    Página {currentPage} de {totalPages}
                  </p>
                </div>
                <div className='flex items-center space-x-2'>
                  <Button
                    variant='outline'
                    className='h-8 w-8 p-0'
                    onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <span className='sr-only'>Ir para próxima página</span>
                    <ChevronRight className='h-4 w-4' />
                  </Button>
                  <Button
                    variant='outline'
                    className='h-8 w-8 p-0'
                    onClick={() => handlePageChange(totalPages)}
                    disabled={currentPage === totalPages}
                  >
                    <span className='sr-only'>Ir para última página</span>
                    <ChevronsRight className='h-4 w-4' />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
