import { Document, Font, Image, Page, Text, View } from '@react-pdf/renderer';
import React from 'react';

Font.register({
  family: 'Roboto',
  fonts: [
    {
      src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-light-webfont.ttf',
      fontWeight: 300,
    },
    {
      src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf',
      fontWeight: 400,
    },
    {
      src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-medium-webfont.ttf',
      fontWeight: 500,
    },
    {
      src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-bold-webfont.ttf',
      fontWeight: 700,
    },
  ],
});

const BRAND_YELLOW = '#EAAE07';
const DARK_TEXT = '#1F2937';
const MUTED_TEXT = '#6B7280';
const LIGHT_BORDER = '#E5E7EB';
const BACKGROUND_SUBTLE = '#F9FAFB';

export type GeneralNamedValue = {
  name: string;
  value: number;
};

export interface GeneralReportTotals {
  applicationsCount: number;
  serviceOrdersCount: number;
  totalAppliedHectares: number;
}

export interface GeneralReportStatusSummary {
  openCount: number;
  completedCount: number;
  cancelledCount: number;
}

interface GeneralReportPDFProps {
  generatedAt: string;
  filtersSummary: Array<{ label: string; value: string }>;
  totals: GeneralReportTotals;
  statusSummary: GeneralReportStatusSummary;
  byFarm: GeneralNamedValue[];
  byPilot: GeneralNamedValue[];
  byProduct: GeneralNamedValue[];
  byAssistant: GeneralNamedValue[];
}

function formatHectares(value: number): string {
  return `${value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ha`;
}

function topRows(rows: GeneralNamedValue[], maxRows: number): GeneralNamedValue[] {
  return rows.slice(0, maxRows);
}

const GeneralReportPDF: React.FC<GeneralReportPDFProps> = ({
  generatedAt,
  filtersSummary,
  totals,
  statusSummary,
  byFarm,
  byPilot,
  byProduct,
  byAssistant,
}) => {
  const topFarms = topRows(byFarm, 10);
  const topPilots = topRows(byPilot, 10);
  const topProducts = topRows(byProduct, 10);
  const topAssistants = topRows(byAssistant, 10);

  return (
    <Document>
      <Page
        size='A4'
        style={{
          backgroundColor: '#FFFFFF',
          fontFamily: 'Roboto',
          fontSize: 10,
          color: DARK_TEXT,
          paddingTop: 24,
          paddingHorizontal: 28,
          paddingBottom: 44,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: `2px solid ${BRAND_YELLOW}`,
            paddingBottom: 10,
            marginBottom: 14,
          }}
        >
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src='/images/pdf-logo-only.png' style={{ width: 126, height: 32, objectFit: 'contain' }} />
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 14, fontWeight: 700 }}>Relatorio Geral</Text>
            <Text style={{ fontSize: 10, color: MUTED_TEXT, marginTop: 2 }}>
              Consolidado operacional DS Control
            </Text>
          </View>
        </View>

        <View
          style={{
            border: `1px solid ${LIGHT_BORDER}`,
            borderRadius: 8,
            padding: 12,
            backgroundColor: BACKGROUND_SUBTLE,
            marginBottom: 12,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Resumo geral</Text>

          <View style={{ flexDirection: 'row', marginBottom: 6 }}>
            <View style={{ width: '50%' }}>
              <Text style={{ fontSize: 9, color: MUTED_TEXT, marginBottom: 2 }}>Aplicacoes</Text>
              <Text style={{ fontSize: 12, fontWeight: 700 }}>{totals.applicationsCount}</Text>
            </View>
            <View style={{ width: '50%' }}>
              <Text style={{ fontSize: 9, color: MUTED_TEXT, marginBottom: 2 }}>Ordens de servico</Text>
              <Text style={{ fontSize: 12, fontWeight: 700 }}>{totals.serviceOrdersCount}</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', marginBottom: 6 }}>
            <View style={{ width: '50%' }}>
              <Text style={{ fontSize: 9, color: MUTED_TEXT, marginBottom: 2 }}>Total aplicado</Text>
              <Text style={{ fontSize: 12, fontWeight: 700 }}>{formatHectares(totals.totalAppliedHectares)}</Text>
            </View>
            <View style={{ width: '50%' }}>
              <Text style={{ fontSize: 9, color: MUTED_TEXT, marginBottom: 2 }}>Gerado em</Text>
              <Text style={{ fontSize: 10, fontWeight: 500 }}>{generatedAt}</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row' }}>
            <View style={{ width: '100%' }}>
              <Text style={{ fontSize: 9, color: MUTED_TEXT, marginBottom: 2 }}>Status OS (aberta/concluida/cancelada)</Text>
              <Text style={{ fontSize: 10, fontWeight: 500 }}>
                {statusSummary.openCount} / {statusSummary.completedCount} / {statusSummary.cancelledCount}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ border: `1px solid ${LIGHT_BORDER}`, borderRadius: 8, padding: 10, marginBottom: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>Filtros aplicados</Text>
          {filtersSummary.length > 0 ? (
            filtersSummary.map((item) => (
              <View key={`${item.label}-${item.value}`} style={{ flexDirection: 'row', marginBottom: 4 }}>
                <Text style={{ width: '36%', fontSize: 8.5, color: MUTED_TEXT }}>{item.label}</Text>
                <Text style={{ width: '64%', fontSize: 8.5, fontWeight: 500 }}>{item.value}</Text>
              </View>
            ))
          ) : (
            <Text style={{ fontSize: 8.5, color: MUTED_TEXT }}>Sem filtros especificos.</Text>
          )}
        </View>

        <View style={{ flexDirection: 'row', marginBottom: 10 }}>
          <View style={{ width: '49%', marginRight: '2%', border: `1px solid ${LIGHT_BORDER}`, borderRadius: 8, padding: 8 }}>
            <Text style={{ fontSize: 10, fontWeight: 700, marginBottom: 4 }}>Area por fazenda</Text>
            {topFarms.length > 0 ? (
              topFarms.map((row) => (
                <View key={`farm-${row.name}`} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                  <Text style={{ fontSize: 8, width: '66%' }}>{row.name}</Text>
                  <Text style={{ fontSize: 8, fontWeight: 500 }}>{formatHectares(row.value)}</Text>
                </View>
              ))
            ) : (
              <Text style={{ fontSize: 8, color: MUTED_TEXT }}>Sem dados para o recorte.</Text>
            )}
          </View>

          <View style={{ width: '49%', border: `1px solid ${LIGHT_BORDER}`, borderRadius: 8, padding: 8 }}>
            <Text style={{ fontSize: 10, fontWeight: 700, marginBottom: 4 }}>Area por piloto</Text>
            {topPilots.length > 0 ? (
              topPilots.map((row) => (
                <View key={`pilot-${row.name}`} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                  <Text style={{ fontSize: 8, width: '66%' }}>{row.name}</Text>
                  <Text style={{ fontSize: 8, fontWeight: 500 }}>{formatHectares(row.value)}</Text>
                </View>
              ))
            ) : (
              <Text style={{ fontSize: 8, color: MUTED_TEXT }}>Sem dados para o recorte.</Text>
            )}
          </View>
        </View>

        <View style={{ flexDirection: 'row' }}>
          <View style={{ width: '49%', marginRight: '2%', border: `1px solid ${LIGHT_BORDER}`, borderRadius: 8, padding: 8 }}>
            <Text style={{ fontSize: 10, fontWeight: 700, marginBottom: 4 }}>Area por ajudante</Text>
            {topAssistants.length > 0 ? (
              topAssistants.map((row) => (
                <View key={`assistant-${row.name}`} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                  <Text style={{ fontSize: 8, width: '66%' }}>{row.name}</Text>
                  <Text style={{ fontSize: 8, fontWeight: 500 }}>{formatHectares(row.value)}</Text>
                </View>
              ))
            ) : (
              <Text style={{ fontSize: 8, color: MUTED_TEXT }}>Sem dados para o recorte.</Text>
            )}
          </View>

          <View style={{ width: '49%', border: `1px solid ${LIGHT_BORDER}`, borderRadius: 8, padding: 8 }}>
            <Text style={{ fontSize: 10, fontWeight: 700, marginBottom: 4 }}>Area por produto</Text>
            {topProducts.length > 0 ? (
              topProducts.map((row) => (
                <View key={`product-${row.name}`} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                  <Text style={{ fontSize: 8, width: '66%' }}>{row.name}</Text>
                  <Text style={{ fontSize: 8, fontWeight: 500 }}>{formatHectares(row.value)}</Text>
                </View>
              ))
            ) : (
              <Text style={{ fontSize: 8, color: MUTED_TEXT }}>Sem dados para o recorte.</Text>
            )}
          </View>
        </View>

        <View
          fixed
          style={{
            position: 'absolute',
            bottom: 16,
            left: 28,
            right: 28,
            borderTop: `1px solid ${LIGHT_BORDER}`,
            paddingTop: 6,
            flexDirection: 'row',
            justifyContent: 'space-between',
          }}
        >
          <Text style={{ fontSize: 8, color: MUTED_TEXT }}>DS Control - Gerado em {generatedAt}</Text>
          <Text
            style={{ fontSize: 8, color: MUTED_TEXT }}
            render={({ pageNumber, totalPages }) => `Pagina ${pageNumber} de ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
};

export default GeneralReportPDF;
