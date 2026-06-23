import { Sprout } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type DashboardPageShellProps = {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function DashboardPageShell({
  title,
  description,
  action,
  children,
  className,
}: DashboardPageShellProps) {
  return (
    <div className={cn('relative min-h-full w-full overflow-hidden p-5 lg:p-8', className)}>
      <div className='pointer-events-none absolute right-0 top-0 h-72 w-[46rem] overflow-hidden opacity-80'>
        <div className='absolute -right-16 top-0 h-40 w-[34rem] rounded-bl-[80%] bg-[color:color-mix(in_oklch,var(--brand-secondary)_14%,white)]' />
        <div className='absolute right-16 top-24 h-28 w-[34rem] rounded-tl-full bg-[color:color-mix(in_oklch,var(--brand-primary)_9%,white)]' />
        <Sprout className='absolute bottom-5 right-8 h-20 w-20 rotate-12 text-primary/20' />
      </div>

      <div className='relative z-10 mb-9 flex flex-col gap-4 md:flex-row md:items-start md:justify-between'>
        <div className='space-y-1'>
          <h1 className='text-3xl font-semibold tracking-normal text-[color:color-mix(in_oklch,var(--brand-primary)_72%,black)]'>
            {title}
          </h1>
          <p className='text-base text-muted-foreground'>{description}</p>
        </div>
        {action ? <div className='shrink-0'>{action}</div> : null}
      </div>

      <div className='relative z-10'>{children}</div>
    </div>
  );
}
