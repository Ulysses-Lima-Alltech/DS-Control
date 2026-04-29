import {
  Building,
  Drone,
  Droplets,
  FileText,
  FileUser,
  HandHelping,
  LayoutDashboard,
  Map,
  NotepadText,
  Route,
  Settings,
  ShieldUser,
  SprayCan,
  Tractor,
  Users,
  UserStar,
  Wheat,
} from 'lucide-react';

export type PathItem = {
  title: string;
  url: string;
  icon?: React.ElementType;
  showOnSidebar?: boolean;
  category?: string;
};

export const pathItems: PathItem[] = [
  {
    title: 'Painel',
    url: '/dashboard',
    icon: LayoutDashboard,
    showOnSidebar: true,
    category: 'visualizar',
  },
  {
    title: 'Mapa',
    url: '/dashboard/map',
    icon: Map,
    showOnSidebar: true,
    category: 'visualizar',
  },
  {
    title: 'Fazendas',
    url: '/dashboard/farms',
    icon: Tractor,
    showOnSidebar: true,
    category: 'visualizar',
  },
  {
    title: 'Aplicações',
    url: '/dashboard/applications',
    icon: SprayCan,
    showOnSidebar: true,
    category: 'visualizar',
  },
  {
    title: 'Clientes',
    url: '/dashboard/customers',
    icon: Building,
    showOnSidebar: true,
    category: 'cadastros',
  },
  {
    title: 'Contratos',
    url: '/dashboard/contracts',
    icon: FileText,
    showOnSidebar: true,
    category: 'cadastros',
  },
  {
    title: 'Rotas',
    url: '/dashboard/routes',
    icon: Route,
    showOnSidebar: true,
    category: 'cadastros',
  },
  {
    title: 'Ordens de Serviços',
    url: '/dashboard/service-orders',
    icon: NotepadText,
    showOnSidebar: true,
    category: 'cadastros',
  },
  {
    title: 'Configurações',
    url: '/dashboard/configurations',
    icon: Settings,
    showOnSidebar: true,
    category: 'configurações',
  },
  {
    title: 'Usuários',
    url: '/dashboard/users',
    icon: Users,
    showOnSidebar: true,
    category: 'configurações',
  },
  {
    title: 'Administradores',
    url: '/dashboard/backoffice',
    icon: ShieldUser,
    showOnSidebar: true,
    category: 'configurações',
  },
  {
    title: 'Fazendeiros',
    url: '/dashboard/farmers',
    icon: UserStar,
    showOnSidebar: true,
    category: 'configurações',
  },
  {
    title: 'Pilotos',
    url: '/dashboard/pilots',
    icon: FileUser,
    showOnSidebar: true,
    category: 'configurações',
  },
  {
    title: 'Ajudantes',
    url: '/dashboard/assistant',
    icon: HandHelping,
    showOnSidebar: true,
    category: 'configurações',
  },
  {
    title: 'Drones',
    url: '/dashboard/drones',
    icon: Drone,
    showOnSidebar: true,
    category: 'configurações',
  },
  {
    title: 'Produtos',
    url: '/dashboard/products',
    icon: Droplets,
    showOnSidebar: true,
    category: 'configurações',
  },
  {
    title: 'Tipos de Cultura',
    url: '/dashboard/culture-types',
    icon: Wheat,
    showOnSidebar: true,
    category: 'configurações',
  },
];

