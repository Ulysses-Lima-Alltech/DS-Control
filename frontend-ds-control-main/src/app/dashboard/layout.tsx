'use server';
import { cookies } from 'next/headers';
import Link from 'next/link';

import BreadcrumbHeader from '@/components/BreadcrumbHeader';
import DashboardTopbarActions from '@/components/DashboardTopbarActions';
import { Sidebar } from '@/components/Sidebar';
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
        <div className='flex min-h-svh w-full overflow-hidden bg-[color:color-mix(in_oklch,var(--brand-secondary)_8%,white)]'>
          <Sidebar />
          <div className='flex-1 flex flex-col min-w-0 overflow-hidden'>
            <header className='flex h-16 items-center gap-3 border-b border-border/60 bg-card/95 px-5 shadow-[0_1px_18px_rgba(15,23,42,0.04)] backdrop-blur flex-shrink-0'>
              <SidebarTrigger className='size-8 rounded-lg text-foreground/70 hover:bg-primary/10 hover:text-primary' />
              <Separator orientation='vertical' className='mx-1 data-[orientation=vertical]:h-4' />
              <Link href='/dashboard' className='text-sm font-semibold tracking-normal'>
                DS Control
              </Link>
              <BreadcrumbHeader />
              <div className='ml-auto'>
                <DashboardTopbarActions />
              </div>
            </header>
            <div className='flex-1 overflow-y-auto overflow-x-hidden'>{children}</div>
          </div>
        </div>
      </SidebarProvider>
    </AuthGuard>
  );
}
