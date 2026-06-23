'use client';

import { usePathname } from 'next/navigation';

import { SidebarUser } from '@/components/SidebarUser';
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
          <div className='flex items-center gap-3'>
            <div className='flex aspect-square size-9 items-center justify-center rounded-xl bg-primary text-white shadow-[0_8px_18px_rgba(113,167,128,0.22)]'>
              <span className='text-sm font-bold'>DS</span>
            </div>
            <div className='grid flex-1 text-left text-sm leading-tight'>
              <span className='truncate font-semibold tracking-normal'>DS Control</span>
              <span className='truncate text-xs text-sidebar-foreground/70'>Painel</span>
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
        <SidebarFooter>
          <SidebarUser />
        </SidebarFooter>
      </SidebarShadcn>
    </>
  );
}
