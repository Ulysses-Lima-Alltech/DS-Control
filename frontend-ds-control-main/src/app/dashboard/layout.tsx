'use server';
import { cookies } from 'next/headers';
import Link from 'next/link';

import BreadcrumbHeader from '@/components/BreadcrumbHeader';
import { Sidebar } from '@/components/Sidebar';
import SwitchToogleTheme from '@/components/SwitchToogleTheme';
import { Separator } from '@/components/ui/separator';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AuthGuard } from '@/guards/auth.guard';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const sidebarStateCookie = cookieStore.get('sidebar_state');

  return (
    <AuthGuard>
      <SidebarProvider
        defaultOpen={sidebarStateCookie === undefined ? true : sidebarStateCookie.value === 'true'}
      >
        <div className='flex min-h-svh w-full overflow-hidden'>
          <Sidebar />
          <div className='flex-1 flex flex-col min-w-0 overflow-hidden'>
            <header className='flex items-center gap-2 p-4 flex-shrink-0'>
              <SidebarTrigger />
              <Separator orientation='vertical' className=' mx-2 data-[orientation=vertical]:h-4' />
              <Link href='/dashboard' className='font-bold text-lg'>
                DS Control
              </Link>
              <BreadcrumbHeader />
              <div className='ml-auto'>
                <SwitchToogleTheme />
              </div>
            </header>
            <Separator />
            <div className='flex-1 overflow-y-auto overflow-x-hidden'>{children}</div>
          </div>
        </div>
      </SidebarProvider>
    </AuthGuard>
  );
}
