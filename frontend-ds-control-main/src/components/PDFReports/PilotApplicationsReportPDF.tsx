import { Document, Font, Page, Text, View } from '@react-pdf/renderer';
import React from 'react';

import type { Application } from '@/types/applications.type';

Font.register({
  family: 'Roboto',
  fonts: [
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-light-webfont.ttf', fontWeight: 300 },
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf', fontWeight: 400 },
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-medium-webfont.ttf', fontWeight: 500 },
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-bold-webfont.ttf', fontWeight: 700 },
  ],
});

type PilotGroup = {
  pilotName: string;
  applications: Application[];
};

interface PilotApplicationsReportPDFProps {
  generatedAt: string;
  filtersSummary: Array<{ label: string; value: string }>;
  groups: PilotGroup[];
}

function parseNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function fmtDate(value?: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('pt-BR').format(date);
}

const PilotApplicationsReportPDF: React.FC<PilotApplicationsReportPDFProps> = ({
  generatedAt,
  filtersSummary,
  groups,
}) => {
  const totalApplications = groups.reduce((sum, group) => sum + group.applications.length, 0);
  const totalHectares = groups.reduce(
    (sum, group) =>
      sum + group.applications.reduce((acc, application) => acc + parseNumber(application.hectares), 0),
    0
  );

  return (
    <Document>
      <Page size='A4' style={{ padding: 24, fontFamily: 'Roboto', fontSize: 9, color: '#1F2937' }}>
        <Text style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Relatorio por Piloto</Text>
        <Text style={{ fontSize: 8, color: '#6B7280', marginBottom: 8 }}>Gerado em: {generatedAt}</Text>

        <View style={{ border: '1px solid #E5E7EB', borderRadius: 6, padding: 8, marginBottom: 8 }}>
          <Text style={{ fontSize: 10, fontWeight: 700, marginBottom: 4 }}>Resumo geral</Text>
          <Text>Total de pilotos: {groups.length}</Text>
          <Text>Total de aplicacoes: {totalApplications}</Text>
          <Text>Total de hectares aplicados: {totalHectares.toFixed(2)} ha</Text>
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

        {groups.map((group) => {
          const pilotHectares = group.applications.reduce(
            (sum, app) => sum + parseNumber(app.hectares),
            0
          );
          return (
            <View key={group.pilotName} wrap={false} style={{ marginBottom: 8 }}>
              <View style={{ backgroundColor: '#EFF6FF', border: '1px solid #E5E7EB', padding: 6 }}>
                <Text style={{ fontSize: 10, fontWeight: 700 }}>{group.pilotName}</Text>
                <Text style={{ fontSize: 8, color: '#6B7280' }}>
                  Aplicacoes: {group.applications.length} | Hectares: {pilotHectares.toFixed(2)} ha
                </Text>
              </View>
              <View style={{ border: '1px solid #E5E7EB', borderTop: 0 }}>
                <View style={{ flexDirection: 'row', backgroundColor: '#F9FAFB', paddingVertical: 4, paddingHorizontal: 5 }}>
                  <Text style={{ width: '11%', fontWeight: 700 }}>Data</Text>
                  <Text style={{ width: '8%', fontWeight: 700 }}>OS</Text>
                  <Text style={{ width: '12%', fontWeight: 700 }}>Cliente</Text>
                  <Text style={{ width: '10%', fontWeight: 700 }}>Fazenda</Text>
                  <Text style={{ width: '10%', fontWeight: 700 }}>Talhao</Text>
                  <Text style={{ width: '12%', fontWeight: 700 }}>Produto/Tipo</Text>
                  <Text style={{ width: '10%', fontWeight: 700 }}>Drone</Text>
                  <Text style={{ width: '10%', fontWeight: 700 }}>Ajudante</Text>
                  <Text style={{ width: '9%', fontWeight: 700, textAlign: 'right' }}>Ha</Text>
                  <Text style={{ width: '8%', fontWeight: 700, textAlign: 'right' }}>Status</Text>
                </View>
                {group.applications.map((app, index) => (
                  <View
                    key={app.id}
                    style={{
                      flexDirection: 'row',
                      paddingVertical: 4,
                      paddingHorizontal: 5,
                      backgroundColor: index % 2 === 0 ? '#FFFFFF' : '#FCFCFD',
                      borderTop: '1px solid #F3F4F6',
                    }}
                  >
                    <Text style={{ width: '11%' }}>{fmtDate(app.date)}</Text>
                    <Text style={{ width: '8%' }}>#{app.serviceOrder?.number || '-'}</Text>
                    <Text style={{ width: '12%' }}>{app.serviceOrder?.customer?.name || '-'}</Text>
                    <Text style={{ width: '10%' }}>{app.farm?.name || '-'}</Text>
                    <Text style={{ width: '10%' }}>{app.plot?.name || '-'}</Text>
                    <Text style={{ width: '12%' }}>{app.product?.name || app.observations || '-'}</Text>
                    <Text style={{ width: '10%' }}>{app.drone?.name || '-'}</Text>
                    <Text style={{ width: '10%' }}>{app.assistant?.name || '-'}</Text>
                    <Text style={{ width: '9%', textAlign: 'right' }}>{parseNumber(app.hectares).toFixed(2)}</Text>
                    <Text style={{ width: '8%', textAlign: 'right' }}>{app.serviceOrder?.status || '-'}</Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default PilotApplicationsReportPDF;

