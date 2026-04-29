'use client';

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
  return (
    <>
      <SidebarShadcn collapsible='icon'>
        <SidebarHeader>
          <div className='flex items-center gap-2'>
            <div className='flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground grayscale'>
              <span className='text-sm font-bold'>DS</span>
            </div>
            <div className='grid flex-1 text-left text-sm leading-tight'>
              <span className='truncate font-semibold'>DS Control</span>
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
                      <SidebarMenuButton asChild>
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
                      <SidebarMenuButton asChild>
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
                      <SidebarMenuButton asChild>
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

