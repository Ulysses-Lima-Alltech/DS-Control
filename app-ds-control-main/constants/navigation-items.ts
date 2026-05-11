import { Ionicons } from '@expo/vector-icons';

import { isAdminRole, isAdministrativeRole, isPilotRole } from '@/utils/user-role';

export type SideMenuItem = {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  enabled: boolean;
};

const ADMIN_BASE_MENU_ITEMS: SideMenuItem[] = [
  {
    id: 'dashboard',
    title: 'Painel',
    icon: 'grid-outline',
    route: '/backoffice/dashboard',
    enabled: true,
  },
  {
    id: 'map',
    title: 'Fazendas',
    icon: 'map-outline',
    route: '/backoffice/map',
    enabled: true,
  },
  {
    id: 'applications',
    title: 'Aplicacoes',
    icon: 'flask-outline',
    route: '/backoffice/applications',
    enabled: true,
  },
  {
    id: 'service-orders',
    title: 'Ordens de Servico',
    icon: 'document-text-outline',
    route: '/backoffice/service-orders',
    enabled: true,
  },
  {
    id: 'routes',
    title: 'Rotas',
    icon: 'navigate-outline',
    route: '/backoffice/routes',
    enabled: true,
  },
  {
    id: 'profile',
    title: 'Perfil',
    icon: 'person-outline',
    route: '/backoffice/profile',
    enabled: true,
  },
];

const ADMIN_CONFIGURATION_MENU_ITEM: SideMenuItem = {
  id: 'configurations',
  title: 'Configuracoes',
  icon: 'settings-outline',
  route: '/backoffice/configurations',
  enabled: true,
};

const PILOT_MENU_ITEMS: SideMenuItem[] = [
  {
    id: 'routes',
    title: 'Rotas',
    icon: 'navigate-outline',
    route: '/pilot/routes',
    enabled: true,
  },
  {
    id: 'service-orders',
    title: 'Ordens de Servico',
    icon: 'document-text-outline',
    route: '/pilot/service-orders',
    enabled: true,
  },
  {
    id: 'applications',
    title: 'Aplicacoes',
    icon: 'flask-outline',
    route: '/pilot/applications',
    enabled: true,
  },
  {
    id: 'map',
    title: 'Fazendas',
    icon: 'map-outline',
    route: '/pilot/map',
    enabled: true,
  },
  {
    id: 'profile',
    title: 'Perfil',
    icon: 'person-outline',
    route: '/pilot/profile',
    enabled: true,
  },
];

export const getSideMenuItemsByUserType = (userType?: string | null): SideMenuItem[] => {
  if (isPilotRole(userType)) {
    return PILOT_MENU_ITEMS;
  }

  if (isAdministrativeRole(userType)) {
    if (isAdminRole(userType)) {
      return [...ADMIN_BASE_MENU_ITEMS, ADMIN_CONFIGURATION_MENU_ITEM];
    }

    return ADMIN_BASE_MENU_ITEMS;
  }

  return [];
};
