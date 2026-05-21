import { Document, Font, Page, Text, View } from '@react-pdf/renderer';
import React from 'react';

import type { Application } from '@/types/applications.type';
import type { ServiceOrder } from '@/types/service-order.type';

Font.register({
  family: 'Roboto',
  fonts: [
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-light-webfont.ttf', fontWeight: 300 },
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf', fontWeight: 400 },
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-medium-webfont.ttf', fontWeight: 500 },
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-bold-webfont.ttf', fontWeight: 700 },
  ],
});

export type ServiceOrderDetailedSection = {
  serviceOrder: ServiceOrder;
  applications: Application[];
};

interface ServiceOrdersDetailedReportPDFProps {
  title: string;
  generatedAt: string;
  filtersSummary: Array<{ label: string; value: string }>;
  sections: ServiceOrderDetailedSection[];
}

function parseNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function fmtDate(value?: string | Date): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('pt-BR').format(date);
}

const ServiceOrdersDetailedReportPDF: React.FC<ServiceOrdersDetailedReportPDFProps> = ({
  title,
  generatedAt,
  filtersSummary,
  sections,
}) => {
  const totalApplications = sections.reduce((sum, item) => sum + item.applications.length, 0);
  const totalHectares = sections.reduce(
    (sum, item) => sum + item.applications.reduce((acc, app) => acc + parseNumber(app.hectares), 0),
    0
  );
  const pilots = new Set<string>();
  sections.forEach((item) => {
    item.applications.forEach((app) => {
      if (app.pilot?.name) pilots.add(app.pilot.name);
    });
  });

  return (
    <Document>
      <Page size='A4' style={{ padding: 24, fontFamily: 'Roboto', fontSize: 9, color: '#1F2937' }}>
        <Text style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{title}</Text>
        <Text style={{ fontSize: 8, color: '#6B7280', marginBottom: 8 }}>Gerado em: {generatedAt}</Text>

        <View style={{ border: '1px solid #E5E7EB', borderRadius: 6, padding: 8, marginBottom: 8 }}>
          <Text style={{ fontSize: 10, fontWeight: 700, marginBottom: 4 }}>Resumo</Text>
          <Text>OS selecionadas: {sections.length}</Text>
          <Text>Total de aplicacoes: {totalApplications}</Text>
          <Text>Total de hectares: {totalHectares.toFixed(2)} ha</Text>
          <Text>Pilotos envolvidos: {pilots.size}</Text>
        </View>

        {filtersSummary.length > 0 && (
          <View style={{ border: '1px solid #E5E7EB', borderRadius: 6, padding: 8, marginBottom: 8 }}>
            <Text style={{ fontSize: 10, fontWeight: 700, marginBottom: 4 }}>Filtros</Text>
            {filtersSummary.map((item) => (
              <Text key={`${item.label}-${item.value}`}>
                {item.label}: {item.value}
              </Text>
            ))}
          </View>
        )}

        {sections.map((section, index) => {
          const osApplied = section.applications.reduce((sum, app) => sum + parseNumber(app.hectares), 0);
          return (
            <View key={section.serviceOrder.id} wrap={false} style={{ marginBottom: 8 }}>
              <View style={{ backgroundColor: '#FFF8E5', border: '1px solid #E5E7EB', padding: 6 }}>
                <Text style={{ fontSize: 10, fontWeight: 700 }}>
                  OS #{section.serviceOrder.number} | {section.serviceOrder.customer?.name || 'Cliente N/A'}
                </Text>
                <Text style={{ fontSize: 8, color: '#6B7280' }}>
                  Planejada: {fmtDate(section.serviceOrder.plannedDate)} | Status: {section.serviceOrder.status}
                </Text>
                <Text style={{ fontSize: 8, color: '#6B7280' }}>
                  Fazendas:{' '}
                  {section.serviceOrder.farms?.length
                    ? section.serviceOrder.farms.map((farm) => farm.name).join(', ')
                    : 'N/A'}
                </Text>
                <Text style={{ fontSize: 8, color: '#6B7280' }}>
                  Aplicacoes: {section.applications.length} | Hectares: {osApplied.toFixed(2)} ha
                </Text>
              </View>

              {section.applications.length === 0 ? (
                <View style={{ border: '1px solid #E5E7EB', borderTop: 0, padding: 6 }}>
                  <Text style={{ color: '#6B7280' }}>Nenhuma aplicacao vinculada nesta OS.</Text>
                </View>
              ) : (
                <View style={{ border: '1px solid #E5E7EB', borderTop: 0 }}>
                  <View style={{ flexDirection: 'row', backgroundColor: '#F9FAFB', paddingVertical: 4, paddingHorizontal: 5 }}>
                    <Text style={{ width: '12%', fontWeight: 700 }}>Data</Text>
                    <Text style={{ width: '14%', fontWeight: 700 }}>Fazenda</Text>
                    <Text style={{ width: '12%', fontWeight: 700 }}>Talhao</Text>
                    <Text style={{ width: '14%', fontWeight: 700 }}>Piloto</Text>
                    <Text style={{ width: '12%', fontWeight: 700 }}>Produto</Text>
                    <Text style={{ width: '10%', fontWeight: 700 }}>Drone</Text>
                    <Text style={{ width: '12%', fontWeight: 700 }}>Ajudante</Text>
                    <Text style={{ width: '8%', fontWeight: 700, textAlign: 'right' }}>Ha</Text>
                    <Text style={{ width: '6%', fontWeight: 700, textAlign: 'right' }}>St</Text>
                  </View>
                  {section.applications.map((app, appIndex) => (
                    <View
                      key={app.id}
                      style={{
                        flexDirection: 'row',
                        paddingVertical: 4,
                        paddingHorizontal: 5,
                        backgroundColor: appIndex % 2 === 0 ? '#FFFFFF' : '#FCFCFD',
                        borderTop: '1px solid #F3F4F6',
                      }}
                    >
                      <Text style={{ width: '12%' }}>{fmtDate(app.date)}</Text>
                      <Text style={{ width: '14%' }}>{app.farm?.name || '-'}</Text>
                      <Text style={{ width: '12%' }}>{app.plot?.name || '-'}</Text>
                      <Text style={{ width: '14%' }}>{app.pilot?.name || '-'}</Text>
                      <Text style={{ width: '12%' }}>{app.product?.name || '-'}</Text>
                      <Text style={{ width: '10%' }}>{app.drone?.name || '-'}</Text>
                      <Text style={{ width: '12%' }}>{app.assistant?.name || '-'}</Text>
                      <Text style={{ width: '8%', textAlign: 'right' }}>{parseNumber(app.hectares).toFixed(2)}</Text>
                      <Text style={{ width: '6%', textAlign: 'right' }}>
                        {app.serviceOrder?.status || section.serviceOrder.status || '-'}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {index === sections.length - 1 ? null : <View style={{ height: 2 }} />}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default ServiceOrdersDetailedReportPDF;
