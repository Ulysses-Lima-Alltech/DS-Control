'use client';

import { Leaf, Sprout } from 'lucide-react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  Sidebar as SidebarShadcn,
} from '@/components/ui/sidebar';
import { pathItems, type PathItem } from '@/types/path.type';

export function Sidebar() {
  const pathname = usePathname();
  const isPathActive = (url: string) =>
    pathname === url || (url !== '/dashboard' && pathname.startsWith(`${url}/`));

  return (
    <>
      <SidebarShadcn collapsible='icon'>
        <SidebarHeader>
          <div className='flex min-h-20 items-center group-data-[collapsible=icon]:justify-center'>
            <div className='relative h-20 w-full overflow-hidden group-data-[collapsible=icon]:hidden'>
              <Image
                src='/images/logo-icontrol-agras.png'
                alt='iControl Agras'
                fill
                priority
                sizes='220px'
                className='object-contain object-left'
              />
            </div>
            <div className='hidden aspect-square size-9 items-center justify-center rounded-xl bg-primary/10 text-primary group-data-[collapsible=icon]:flex'>
              <Leaf className='size-5' />
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Visualizar</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {pathItems
                  .filter((item: PathItem) => item.showOnSidebar && item.category === 'visualizar')
                  .map((item: PathItem) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={isPathActive(item.url)}>
                        <a href={item.url}>
                          {item.icon && <item.icon className='mr-2' />}
                          <span>{item.title}</span>
                        </a>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Cadastros</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {pathItems
                  .filter((item: PathItem) => item.showOnSidebar && item.category === 'cadastros')
                  .map((item: PathItem) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={isPathActive(item.url)}>
                        <a href={item.url}>
                          {item.icon && <item.icon className='mr-2' />}
                          <span>{item.title}</span>
                        </a>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Configurações do sistema</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {pathItems
                  .filter(
                    (item: PathItem) => item.showOnSidebar && item.category === 'configurações'
                  )
                  .map((item: PathItem) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={isPathActive(item.url)}>
                        <a href={item.url}>
                          {item.icon && <item.icon className='mr-2' />}
                          <span>{item.title}</span>
                        </a>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className='group-data-[collapsible=icon]:hidden'>
          <div className='relative overflow-hidden rounded-2xl border border-primary/10 bg-[linear-gradient(135deg,color-mix(in_oklch,var(--brand-primary)_12%,white),color-mix(in_oklch,var(--brand-secondary)_8%,white))] p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]'>
            <div className='relative z-10 flex items-start gap-2.5'>
              <span className='flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary'>
                <Leaf className='size-4' />
              </span>
              <div className='space-y-0.5'>
                <p className='text-[11px] font-semibold leading-snug text-foreground'>
                  Tecnologia que protege.
                </p>
                <p className='text-[10px] leading-snug text-muted-foreground'>
                  Dados que geram resultado.
                </p>
              </div>
            </div>
            <Sprout className='pointer-events-none absolute -bottom-3 right-2 h-16 w-16 text-primary/25' />
          </div>
        </SidebarFooter>
      </SidebarShadcn>
    </>
  );
}
