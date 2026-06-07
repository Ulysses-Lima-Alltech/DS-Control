'use client';

/**
 * Página de preview HTML do layout do relatório PDF.
 * Espelho em React/HTML do ApplicationsReportPDF para análise e aprovação visual sem depender da renderização em PDF.
 * NÃO altera o fluxo do PDF. Apenas visualização espelho para estudo.
 * Acesse via: /preview-report-html
 */

import { ApplicationsReportLayoutMirror } from '@/components/PDFReports/ApplicationsReportLayoutMirror';
import type { Application } from '@/types/applications.type';
import type { Plot } from '@/types/plot.type';
import type { ServiceOrder } from '@/types/service-order.type';

const mockPlot = {
  id: 'mock-plot-id',
  name: 'Talhão 1 - Norte',
  farmId: 'mock-farm-id',
  customerId: 'mock-customer-id',
  externalId: 'ext-001',
  hectare: '25.50',
  geoJson: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { fill: '#3388ff', stroke: '#3388ff' },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [-47.55, -23.55],
              [-47.45, -23.55],
              [-47.45, -23.45],
              [-47.55, -23.45],
              [-47.55, -23.55],
            ],
          ],
        },
      },
    ],
  },
  createdAt: '',
  updatedAt: '',
  deletedAt: null,
} as Plot;

const MOCK_SERVICE_ORDER: ServiceOrder = {
  id: 'mock-so-id',
  number: 1001,
  status: 'completed',
  customerId: 'mock-customer-id',
  customer: {
    id: 'mock-customer-id',
    name: 'Cliente Preview Ltda',
    document_number: '12.345.678/0001-90',
    entity_type: 'PJ',
    phone: '+55 11 99999-9999',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  contractId: 'mock-contract-id',
  contract: {
    id: 'mock-contract-id',
    customerId: 'mock-customer-id',
    name: 'Contrato 2024 - Preview',
    dateStart: new Date('2024-01-01'),
    dateEnd: new Date('2024-12-31'),
    observation: '',
    customer: { id: 'mock-customer-id', name: 'Cliente Preview Ltda' },
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  farms: [
    {
      id: 'mock-farm-id',
      name: 'Fazenda Preview',
      customer: { id: 'mock-customer-id', name: 'Cliente Preview Ltda' },
      plots: [mockPlot],
      createdAt: '',
      updatedAt: '',
    },
  ],
  farmsIds: ['mock-farm-id'],
  pilotsIds: ['mock-pilot-id'],
  pilots: [
    {
      id: 'mock-pilot-id',
      name: 'Piloto Preview',
      email: 'pilot@preview.com',
      password: '',
      type: 'pilot',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    },
  ],
  plotsIds: ['mock-plot-id'],
  plots: [mockPlot],
  observation: 'Dados mockados para preview do layout.',
  plannedDate: new Date('2024-06-15'),
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  plannedHectares: 25.5,
  totalAppliedHectares: 12.75,
  progressPercent: 50,
  applicationsCount: 1,
  plotsWithApplications: 1,
  totalPlots: 1,
  myAppliedHectares: 12.75,
  myApplicationsCount: 1,
};

const MOCK_APPLICATIONS: Application[] = [
  {
    id: 'mock-app-id',
    serviceOrderId: 'mock-so-id',
    farmId: 'mock-farm-id',
    pilotId: 'mock-pilot-id',
    assistantId: 'mock-assistant-id',
    droneId: 'mock-drone-id',
    cultureId: 'mock-culture-id',
    hectares: '12.75',
    flowRate: '15.50',
    altitude: '120.00',
    routeSpacing: '6.00',
    dropletSize: '250.00',
    date: '2024-06-15',
    productId: 'mock-product-id',
    plotId: 'mock-plot-id',
    observations: 'Aplicação em condições ideais.',
    createdAt: new Date(),
    serviceOrder: MOCK_SERVICE_ORDER,
    pilot: {
      id: 'mock-pilot-id',
      name: 'Piloto Preview',
      email: 'pilot@preview.com',
      password: '',
      type: 'pilot',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    },
    assistant: {
      id: 'mock-assistant-id',
      name: 'Assistente Preview',
      email: 'assistant@preview.com',
      password: '',
      type: 'pilot',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    },
    drone: {
      id: 'mock-drone-id',
      name: 'Drone DJI T40',
      model: 'DJI Agras T40',
      aircraftRid: 'RID-PREVIEW-001',
      createdAt: '',
      updatedAt: '',
      deletedAt: null,
    },
    culture: {
      id: 'mock-culture-id',
      name: 'Soja',
      description: 'Soja',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    },
    product: {
      id: 'mock-product-id',
      name: 'Herbicida Glyphosate 480',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    },
    plot: mockPlot,
    updatedAt: new Date(),
    farm: {
      id: 'mock-farm-id',
      name: 'Fazenda Preview',
      customer: { id: 'mock-customer-id', name: 'Cliente Preview Ltda' },
      plots: [mockPlot],
      createdAt: '',
      updatedAt: '',
    },
  } as Application,
];

export default function PreviewReportHtmlPage() {
  return (
    <div className='min-h-screen w-full bg-muted p-6'>
      <div className='mb-6'>
        <h1 className='text-xl font-semibold text-foreground'>
          Espelho HTML do Relatório PDF
        </h1>
        <p className='text-sm text-muted-foreground mt-1'>
          Layout equivalente ao ApplicationsReportPDF.tsx em HTML/React para análise e aprovação visual
        </p>
      </div>
      <div className='bg-white rounded-lg border border-border shadow-sm overflow-hidden'>
        <ApplicationsReportLayoutMirror
          serviceOrder={MOCK_SERVICE_ORDER}
          applications={MOCK_APPLICATIONS}
        />
      </div>
    </div>
  );
}
