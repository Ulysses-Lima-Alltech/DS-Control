'use client';

import { LogOutIcon, MoreVerticalIcon, UserCircleIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';

import AvatarUser from '@/components/AvatarUser';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { useLogout } from '@/mutations/auth.mutation';
import { useAuth } from '@/providers/auth.provider';

export function SidebarUser() {
  const router = useRouter();
  const { user } = useAuth();
  const { isMobile } = useSidebar();
  const { mutate: logout, isPending: isLoggingOut } = useLogout();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size='lg'
              className='data-[state=open]:bg-primary/10 data-[state=open]:text-primary'
            >
              <AvatarUser name={user?.name} />
              <div className='grid flex-1 text-left text-sm leading-tight'>
                <span className='truncate font-medium'>{user?.name}</span>
                <span className='truncate text-xs text-muted-foreground'>{user?.email}</span>
              </div>
              <MoreVerticalIcon className='ml-auto size-4' />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className='w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg'
            side={isMobile ? 'bottom' : 'right'}
            align='end'
            sideOffset={4}
          >
            <DropdownMenuItem
              className='p-0 font-normal'
              onClick={() => router.push('/dashboard/account')}
            >
              <div className='flex items-center gap-2 px-1 py-1.5 text-left text-sm'>
                <AvatarUser name={user?.name} />
                <div className='grid flex-1 text-left text-sm leading-tight'>
                  <span className='truncate font-medium'>{user?.name}</span>
                  <span className='truncate text-xs text-muted-foreground'>{user?.email}</span>
                </div>
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
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
