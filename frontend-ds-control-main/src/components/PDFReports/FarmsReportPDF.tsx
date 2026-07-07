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

export type FarmsReportRow = {
  farmId: string;
  farmName: string;
  customerName: string;
  plotsCount: number;
  totalAreaHectares: number;
  applicationsCount: number;
  serviceOrdersCount: number;
};

interface FarmsReportPDFProps {
  rows: FarmsReportRow[];
  generatedAt: string;
  filtersSummary: Array<{ label: string; value: string }>;
}

function formatHectares(value: number): string {
  return `${value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ha`;
}

function chunkRows<T>(rows: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size));
  }
  return chunks;
}

const FarmsReportPDF: React.FC<FarmsReportPDFProps> = ({ rows, generatedAt, filtersSummary }) => {
  const totalFarms = rows.length;
  const totalPlots = rows.reduce((sum, row) => sum + row.plotsCount, 0);
  const totalAreaHectares = rows.reduce((sum, row) => sum + row.totalAreaHectares, 0);
  const totalApplications = rows.reduce((sum, row) => sum + row.applicationsCount, 0);
  const totalServiceOrders = rows.reduce((sum, row) => sum + row.serviceOrdersCount, 0);
  const detailPages = chunkRows(rows, 25);

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
            <Text style={{ fontSize: 14, fontWeight: 700 }}>Relatorio de Fazendas</Text>
            <Text style={{ fontSize: 10, color: MUTED_TEXT, marginTop: 2 }}>
              Central de Relatorios IControl
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
          <Text style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Resumo consolidado</Text>

          <View style={{ flexDirection: 'row', marginBottom: 6 }}>
            <View style={{ width: '50%' }}>
              <Text style={{ fontSize: 9, color: MUTED_TEXT, marginBottom: 2 }}>Fazendas</Text>
              <Text style={{ fontSize: 12, fontWeight: 700 }}>{totalFarms}</Text>
            </View>
            <View style={{ width: '50%' }}>
              <Text style={{ fontSize: 9, color: MUTED_TEXT, marginBottom: 2 }}>Talhoes / mapas</Text>
              <Text style={{ fontSize: 12, fontWeight: 700 }}>{totalPlots}</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', marginBottom: 6 }}>
            <View style={{ width: '50%' }}>
              <Text style={{ fontSize: 9, color: MUTED_TEXT, marginBottom: 2 }}>Area total cadastrada</Text>
              <Text style={{ fontSize: 12, fontWeight: 700 }}>{formatHectares(totalAreaHectares)}</Text>
            </View>
            <View style={{ width: '50%' }}>
              <Text style={{ fontSize: 9, color: MUTED_TEXT, marginBottom: 2 }}>Aplicacoes vinculadas</Text>
              <Text style={{ fontSize: 12, fontWeight: 700 }}>{totalApplications}</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row' }}>
            <View style={{ width: '50%' }}>
              <Text style={{ fontSize: 9, color: MUTED_TEXT, marginBottom: 2 }}>OS vinculadas</Text>
              <Text style={{ fontSize: 12, fontWeight: 700 }}>{totalServiceOrders}</Text>
            </View>
            <View style={{ width: '50%' }}>
              <Text style={{ fontSize: 9, color: MUTED_TEXT, marginBottom: 2 }}>Gerado em</Text>
              <Text style={{ fontSize: 10, fontWeight: 500 }}>{generatedAt}</Text>
            </View>
          </View>
        </View>

        <View style={{ border: `1px solid ${LIGHT_BORDER}`, borderRadius: 8, padding: 10, marginBottom: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>Filtros aplicados</Text>
          {filtersSummary.length > 0 ? (
            filtersSummary.map((item) => (
              <View key={`${item.label}-${item.value}`} style={{ flexDirection: 'row', marginBottom: 4 }}>
                <Text style={{ width: '34%', fontSize: 8.5, color: MUTED_TEXT }}>{item.label}</Text>
                <Text style={{ width: '66%', fontSize: 8.5, fontWeight: 500 }}>{item.value}</Text>
              </View>
            ))
          ) : (
            <Text style={{ fontSize: 8.5, color: MUTED_TEXT }}>Sem filtros especificos.</Text>
          )}
        </View>

        <View style={{ border: `1px solid ${LIGHT_BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: '#FFF8E5',
              borderBottom: `1px solid ${LIGHT_BORDER}`,
              paddingVertical: 6,
              paddingHorizontal: 6,
            }}
          >
            <Text style={{ width: '25%', fontSize: 8, fontWeight: 700 }}>Cliente</Text>
            <Text style={{ width: '25%', fontSize: 8, fontWeight: 700 }}>Fazenda</Text>
            <Text style={{ width: '12%', fontSize: 8, fontWeight: 700, textAlign: 'right' }}>Talhoes</Text>
            <Text style={{ width: '14%', fontSize: 8, fontWeight: 700, textAlign: 'right' }}>Area</Text>
            <Text style={{ width: '12%', fontSize: 8, fontWeight: 700, textAlign: 'right' }}>Aplic.</Text>
            <Text style={{ width: '12%', fontSize: 8, fontWeight: 700, textAlign: 'right' }}>OS</Text>
          </View>

          {rows.slice(0, 11).map((row, index) => (
            <View
              key={`farm-row-${row.farmId}`}
              style={{
                flexDirection: 'row',
                paddingVertical: 6,
                paddingHorizontal: 6,
                backgroundColor: index % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
                borderBottom: index === Math.min(rows.length, 11) - 1 ? 0 : `1px solid ${LIGHT_BORDER}`,
              }}
            >
              <Text style={{ width: '25%', fontSize: 8 }}>{row.customerName}</Text>
              <Text style={{ width: '25%', fontSize: 8 }}>{row.farmName}</Text>
              <Text style={{ width: '12%', fontSize: 8, textAlign: 'right' }}>{row.plotsCount}</Text>
              <Text style={{ width: '14%', fontSize: 8, textAlign: 'right' }}>
                {formatHectares(row.totalAreaHectares)}
              </Text>
              <Text style={{ width: '12%', fontSize: 8, textAlign: 'right' }}>{row.applicationsCount}</Text>
              <Text style={{ width: '12%', fontSize: 8, textAlign: 'right' }}>{row.serviceOrdersCount}</Text>
            </View>
          ))}
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
          <Text style={{ fontSize: 8, color: MUTED_TEXT }}>IControl - Gerado em {generatedAt}</Text>
          <Text
            style={{ fontSize: 8, color: MUTED_TEXT }}
            render={({ pageNumber, totalPages }) => `Pagina ${pageNumber} de ${totalPages}`}
          />
        </View>
      </Page>

      {detailPages.slice(1).map((rowsChunk, pageIndex) => (
        <Page
          key={`farms-detail-${pageIndex}`}
          size='A4'
          style={{
            backgroundColor: '#FFFFFF',
            fontFamily: 'Roboto',
            fontSize: 9,
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
              marginBottom: 12,
            }}
          >
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src='/images/pdf-logo-only.png' style={{ width: 126, height: 32, objectFit: 'contain' }} />
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 13, fontWeight: 700 }}>Detalhamento de Fazendas</Text>
              <Text style={{ fontSize: 9, color: MUTED_TEXT }}>Central de Relatorios IControl</Text>
            </View>
          </View>

          <View style={{ border: `1px solid ${LIGHT_BORDER}`, borderRadius: 6, overflow: 'hidden' }}>
            <View
              style={{
                flexDirection: 'row',
                backgroundColor: '#FFF8E5',
                borderBottom: `1px solid ${LIGHT_BORDER}`,
                paddingVertical: 6,
                paddingHorizontal: 6,
              }}
            >
              <Text style={{ width: '25%', fontSize: 8, fontWeight: 700 }}>Cliente</Text>
              <Text style={{ width: '25%', fontSize: 8, fontWeight: 700 }}>Fazenda</Text>
              <Text style={{ width: '12%', fontSize: 8, fontWeight: 700, textAlign: 'right' }}>Talhoes</Text>
              <Text style={{ width: '14%', fontSize: 8, fontWeight: 700, textAlign: 'right' }}>Area</Text>
              <Text style={{ width: '12%', fontSize: 8, fontWeight: 700, textAlign: 'right' }}>Aplic.</Text>
              <Text style={{ width: '12%', fontSize: 8, fontWeight: 700, textAlign: 'right' }}>OS</Text>
            </View>

            {rowsChunk.map((row, index) => (
              <View
                key={`farms-detail-row-${pageIndex}-${row.farmId}`}
                style={{
                  flexDirection: 'row',
                  paddingVertical: 6,
                  paddingHorizontal: 6,
                  backgroundColor: index % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
                  borderBottom: index === rowsChunk.length - 1 ? 0 : `1px solid ${LIGHT_BORDER}`,
                }}
              >
                <Text style={{ width: '25%', fontSize: 8 }}>{row.customerName}</Text>
                <Text style={{ width: '25%', fontSize: 8 }}>{row.farmName}</Text>
                <Text style={{ width: '12%', fontSize: 8, textAlign: 'right' }}>{row.plotsCount}</Text>
                <Text style={{ width: '14%', fontSize: 8, textAlign: 'right' }}>
                  {formatHectares(row.totalAreaHectares)}
                </Text>
                <Text style={{ width: '12%', fontSize: 8, textAlign: 'right' }}>{row.applicationsCount}</Text>
                <Text style={{ width: '12%', fontSize: 8, textAlign: 'right' }}>{row.serviceOrdersCount}</Text>
              </View>
            ))}
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
            <Text style={{ fontSize: 8, color: MUTED_TEXT }}>IControl - Gerado em {generatedAt}</Text>
            <Text
              style={{ fontSize: 8, color: MUTED_TEXT }}
              render={({ pageNumber, totalPages }) => `Pagina ${pageNumber} de ${totalPages}`}
            />
          </View>
        </Page>
      ))}
    </Document>
  );
};

export default FarmsReportPDF;
