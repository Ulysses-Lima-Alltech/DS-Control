export type ReportId = 'applications' | 'service-orders' | 'farms' | 'general';

export type ReportFilterKey =
  | 'period'
  | 'cropSeason'
  | 'customer'
  | 'farm'
  | 'pilot'
  | 'product'
  | 'assistant'
  | 'drone'
  | 'serviceOrderStatus'
  | 'applicationIssue'
  | 'observation'
  | 'serviceOrderNumber'
  | 'serviceOrder';

export type ReportCatalogItem = {
  id: ReportId;
  label: string;
  description: string;
  supportedFilters: ReportFilterKey[];
  requiresServiceOrderSelection?: boolean;
  serviceOrderSelectionLabel?: string;
};

export const reportsCatalog: ReportCatalogItem[] = [
  {
    id: 'applications',
    label: 'Relatorio de aplicacao',
    description: 'Gera um PDF individual por voo/aplicacao, com mapa do talhao selecionado.',
    supportedFilters: [
      'period',
      'cropSeason',
      'customer',
      'farm',
      'pilot',
      'product',
      'assistant',
      'drone',
      'serviceOrderStatus',
      'applicationIssue',
      'serviceOrderNumber',
    ],
  },
  {
    id: 'service-orders',
    label: 'Relatorio de OS',
    description: 'Reutiliza o relatorio estrategico da OS sem alterar o visual atual.',
    supportedFilters: [
      'period',
      'cropSeason',
      'customer',
      'farm',
      'pilot',
      'serviceOrderStatus',
      'observation',
      'serviceOrderNumber',
      'serviceOrder',
    ],
    requiresServiceOrderSelection: true,
    serviceOrderSelectionLabel: 'OS para o relatorio estrategico',
  },
  {
    id: 'farms',
    label: 'Relatorio de fazendas',
    description: 'Consolida fazendas, talhoes, area total e vinculos operacionais.',
    supportedFilters: [
      'period',
      'cropSeason',
      'customer',
      'farm',
      'pilot',
      'serviceOrderStatus',
      'serviceOrderNumber',
    ],
  },
  {
    id: 'general',
    label: 'Relatorio geral',
    description: 'Consolidado de aplicacoes e OS para o recorte filtrado.',
    supportedFilters: [
      'period',
      'cropSeason',
      'customer',
      'farm',
      'pilot',
      'product',
      'assistant',
      'drone',
      'serviceOrderStatus',
      'applicationIssue',
      'observation',
      'serviceOrderNumber',
    ],
  },
];
