import { CellContext, ColumnDef } from '@tanstack/react-table';

import { Badge } from '@/components/ui/badge';
import { ColumnDefWithId } from '@/components/ui/table-data';
import { formatTimestamp } from '@/utils/timestamp-formatter';

export function createColumn<T>(
  id: string,
  accessorKey: string,
  label: string,
  cellRenderer: (context: CellContext<T, unknown>) => React.ReactNode,
  options?: {
    width?: number;
    minWidth?: number;
    maxWidth?: number;
  }
): ColumnDefWithId<T> {
  const { width, minWidth, maxWidth } = options || {};

  return {
    id,
    accessorKey,
    label,
    header: label,
    cell: cellRenderer,
    size: width || 150,
    minSize: minWidth || 100,
    maxSize: maxWidth || 200,
  };
}

export function createDateColumn<T>(
  id: string,
  accessorKey: string,
  label: string,
  options?: {
    width?: number;
    minWidth?: number;
    maxWidth?: number;
  }
): ColumnDefWithId<T> {
  return {
    id,
    accessorKey,
    label,
    header: label,
    size: options?.width || 120,
    minSize: options?.minWidth || 100,
    maxSize: options?.maxWidth || 150,
    cell: ({ row }) => {
      const date = formatTimestamp(row.getValue(accessorKey));
      return <div className='text-foreground font-mono text-sm whitespace-nowrap'>{date}</div>;
    },
  };
}

export function createTextColumn<T>(
  id: string,
  accessorKey: string,
  label: string,
  options?: {
    width?: number;
    minWidth?: number;
    maxWidth?: number;
    className?: string;
    priority?: 'high' | 'medium' | 'low';
  }
): ColumnDefWithId<T> {
  const { width, minWidth, maxWidth, className, priority = 'medium' } = options || {};

  return {
    id,
    accessorKey,
    label,
    header: label,
    size: width || (priority === 'low' ? 80 : priority === 'medium' ? 150 : 200),
    minSize: minWidth || (priority === 'low' ? 60 : priority === 'medium' ? 100 : 120),
    maxSize: maxWidth || (priority === 'low' ? 120 : priority === 'medium' ? 200 : 300),
    cell: ({ row }) => {
      const value = row.getValue(accessorKey) as string;
      return <div className={`text-foreground whitespace-nowrap ${className || ''}`}>{value}</div>;
    },
  };
}

export function createActionsColumn<T>(
  renderActions: (row: T) => React.ReactNode
): ColumnDefWithId<T> {
  return {
    id: 'actions',
    header: () => <div className='text-center'>Ações</div>,
    label: 'Ações',
    enableHiding: false,
    enableSorting: false,
    enableResizing: false,
    size: 140,
    minSize: 120,
    maxSize: 200,
    cell: ({ row }) => (
      <div className='flex justify-center gap-1 px-1'>{renderActions(row.original)}</div>
    ),
  };
}

export function createClickableColumn<T>(
  id: string,
  accessorKey: string,
  label: string,
  cellRenderer: (context: CellContext<T, unknown>) => React.ReactNode,
  onCellClick: (row: T) => void,
  options?: {
    width?: number;
    minWidth?: number;
    maxWidth?: number;
  }
): ColumnDefWithId<T> {
  const { width, minWidth, maxWidth } = options || {};

  return {
    id,
    accessorKey,
    label,
    header: label,
    cell: cellRenderer,
    size: width || 150,
    minSize: minWidth || 100,
    maxSize: maxWidth || 200,
    meta: {
      onCellClick,
    },
  };
}

export function createBadgesColumn<T>(
  id: string,
  accessorKey: string,
  label: string,
  getItems: (row: T) => Array<{ id?: string; name: string }>,
  options?: {
    width?: number;
    minWidth?: number;
    maxWidth?: number;
    maxItems?: number;
    variant?: 'default' | 'secondary' | 'destructive' | 'outline';
    onClick?: (row: T) => void;
    isExpanded?: (row: T) => void;
  }
): ColumnDefWithId<T> {
  const { width, minWidth, maxWidth, maxItems = 3, variant = 'outline' } = options || {};

  return {
    id,
    accessorKey,
    label,
    header: label,
    size: width || 200,
    minSize: minWidth || 150,
    maxSize: maxWidth || 300,
    cell: ({ row }) => {
      const items = getItems(row.original);
      const isOpen = !!options?.isExpanded?.(row.original);

      if (!items || items.length === 0) {
        return <div className='text-muted-foreground'>N/A</div>;
      }

      const displayItems = isOpen ? items : items.slice(0, maxItems);
      const remainingCount = items.length - maxItems;

      return (
        <div className='flex flex-wrap gap-1 max-w-full'>
          {displayItems.map((item, index) => {
            const firstName = item.name.split(' ')[0];
            return (
              <Badge key={item.id || index} variant={variant} className='text-xs'>
                {firstName}
              </Badge>
            );
          })}
          {remainingCount > 0 && !isOpen && (
            <Badge
              variant={variant}
              className={`text-xs ${options?.onClick ? 'cursor-pointer' : ''}`}
              onClick={() => options?.onClick?.(row.original)}
            >
              +{remainingCount}
            </Badge>
          )}
          {isOpen && (
            <button
              onClick={() => {
                options?.onClick?.(row.original);
              }}
              className='text-xs text-muted-foreground hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer'
            >
              Ver menos
            </button>
          )}
        </div>
      );
    },
  };
}

export function createCustomColumn<T>(
  id: string,
  config: Omit<ColumnDef<T>, 'id'> & { label?: string }
): ColumnDefWithId<T> {
  const configWithAccessor = config as Omit<ColumnDef<T>, 'id'> & {
    label?: string;
    accessorKey?: string;
  };
  return {
    id,
    label: configWithAccessor.label || configWithAccessor.accessorKey || id,
    ...config,
  };
}
