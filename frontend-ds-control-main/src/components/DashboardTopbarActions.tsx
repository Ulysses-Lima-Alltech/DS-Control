'use client';

import { Bell, ChevronDown, LogOutIcon, UserCircleIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLogout } from '@/mutations/auth.mutation';
import { useAuth } from '@/providers/auth.provider';

function getInitials(name?: string) {
  if (!name) return 'DS';

  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
}

export default function DashboardTopbarActions() {
  const router = useRouter();
  const { user } = useAuth();
  const { mutate: logout, isPending: isLoggingOut } = useLogout();

  return (
    <div className='flex items-center gap-3'>
      <button
        type='button'
        aria-label='Notificacoes'
        className='flex size-9 items-center justify-center rounded-full text-foreground/70 transition-colors hover:bg-primary/10 hover:text-primary'
      >
        <Bell className='size-5' />
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type='button'
            className='flex items-center gap-2 rounded-full px-1 py-1 text-sm font-medium text-foreground transition-colors hover:bg-primary/10'
          >
            <span className='flex size-9 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground shadow-[0_8px_18px_rgba(113,167,128,0.22)]'>
              {getInitials(user?.name)}
            </span>
            <ChevronDown className='size-4 text-foreground/70' />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='min-w-56 rounded-xl'>
          <DropdownMenuItem
            className='p-0 font-normal'
            onClick={() => router.push('/dashboard/account')}
          >
            <div className='grid gap-0.5 px-2 py-2 text-left'>
              <span className='truncate text-sm font-medium'>{user?.name}</span>
              <span className='truncate text-xs text-muted-foreground'>{user?.email}</span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => router.push('/dashboard/account')}>
              <UserCircleIcon />
              Minha conta
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => logout()} disabled={isLoggingOut}>
            <LogOutIcon />
            {isLoggingOut ? 'Saindo...' : 'Sair'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
