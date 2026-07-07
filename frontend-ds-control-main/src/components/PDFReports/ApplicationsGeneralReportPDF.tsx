import { Document, Font, Image, Page, Text, View } from '@react-pdf/renderer';
import React from 'react';

import { APPLICATION_ISSUE_LABELS, type ApplicationIssueFilter } from '@/types/applications.type';
import type { ServiceOrderStatus } from '@/types/service-order.type';

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

export type ApplicationsGeneralReportRow = {
  id: string;
  date: string;
  serviceOrderNumber: string;
  customerName: string;
  farmName: string;
  plotName: string;
  pilotName: string;
  assistantName: string;
  droneName: string;
  productName: string;
  typeOrIssueLabel: string;
  appliedHectares: number;
  statusLabel: string;
};

interface ApplicationsGeneralReportPDFProps {
  generatedAt: string;
  filtersSummary: Array<{ label: string; value: string }>;
  periodLabel: string;
  rows: ApplicationsGeneralReportRow[];
  totalAppliedHectares: number;
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

function formatStatusLabel(status?: ServiceOrderStatus): string {
  if (status === 'open') return 'Aberta';
  if (status === 'completed') return 'Concluida';
  if (status === 'cancelled') return 'Cancelada';
  return 'Nao informado';
}

export function resolveApplicationTypeOrIssueLabel(observations?: string): string {
  const clean = (observations || '').trim();
  if (!clean) return 'Nao informado';

  const key = clean as ApplicationIssueFilter;
  if (APPLICATION_ISSUE_LABELS[key]) return APPLICATION_ISSUE_LABELS[key];
  return clean;
}

export function resolveApplicationStatusLabel(status?: ServiceOrderStatus): string {
  return formatStatusLabel(status);
}

const ApplicationsGeneralReportPDF: React.FC<ApplicationsGeneralReportPDFProps> = ({
  generatedAt,
  filtersSummary,
  periodLabel,
  rows,
  totalAppliedHectares,
}) => {
  const totalApplications = rows.length;
  const detailPages = chunkRows(rows, 26);

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
            <Text style={{ fontSize: 14, fontWeight: 700 }}>Relatorio de Aplicacoes</Text>
            <Text style={{ fontSize: 10, color: MUTED_TEXT, marginTop: 2 }}>Central de Relatorios IControl</Text>
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
          <Text style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Resumo</Text>

          <View style={{ flexDirection: 'row', marginBottom: 6 }}>
            <View style={{ width: '50%' }}>
              <Text style={{ fontSize: 9, color: MUTED_TEXT, marginBottom: 2 }}>Total de aplicacoes</Text>
              <Text style={{ fontSize: 12, fontWeight: 700 }}>{totalApplications}</Text>
            </View>
            <View style={{ width: '50%' }}>
              <Text style={{ fontSize: 9, color: MUTED_TEXT, marginBottom: 2 }}>Area total aplicada</Text>
              <Text style={{ fontSize: 12, fontWeight: 700 }}>{formatHectares(totalAppliedHectares)}</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row' }}>
            <View style={{ width: '50%' }}>
              <Text style={{ fontSize: 9, color: MUTED_TEXT, marginBottom: 2 }}>Periodo filtrado</Text>
              <Text style={{ fontSize: 10, fontWeight: 500 }}>{periodLabel}</Text>
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
            <Text style={{ width: '14%', fontSize: 8, fontWeight: 700 }}>Data</Text>
            <Text style={{ width: '8%', fontSize: 8, fontWeight: 700 }}>OS</Text>
            <Text style={{ width: '17%', fontSize: 8, fontWeight: 700 }}>Cliente/Fazenda</Text>
            <Text style={{ width: '10%', fontSize: 8, fontWeight: 700 }}>Talhao</Text>
            <Text style={{ width: '11%', fontSize: 8, fontWeight: 700 }}>Piloto</Text>
            <Text style={{ width: '10%', fontSize: 8, fontWeight: 700 }}>Ajudante</Text>
            <Text style={{ width: '8%', fontSize: 8, fontWeight: 700 }}>Drone</Text>
            <Text style={{ width: '9%', fontSize: 8, fontWeight: 700 }}>Produto</Text>
            <Text style={{ width: '7%', fontSize: 8, fontWeight: 700 }}>Tipo/Issue</Text>
            <Text style={{ width: '4%', fontSize: 8, fontWeight: 700, textAlign: 'right' }}>Area</Text>
            <Text style={{ width: '6%', fontSize: 8, fontWeight: 700, textAlign: 'right' }}>Status</Text>
          </View>

          {rows.slice(0, 12).map((row, index) => (
            <View
              key={`app-row-${row.id}`}
              style={{
                flexDirection: 'row',
                paddingVertical: 5,
                paddingHorizontal: 6,
                backgroundColor: index % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
                borderBottom: index === Math.min(rows.length, 12) - 1 ? 0 : `1px solid ${LIGHT_BORDER}`,
              }}
            >
              <Text style={{ width: '14%', fontSize: 7.5 }}>{row.date}</Text>
              <Text style={{ width: '8%', fontSize: 7.5 }}>{row.serviceOrderNumber}</Text>
              <Text style={{ width: '17%', fontSize: 7.5 }}>{row.customerName} / {row.farmName}</Text>
              <Text style={{ width: '10%', fontSize: 7.5 }}>{row.plotName}</Text>
              <Text style={{ width: '11%', fontSize: 7.5 }}>{row.pilotName}</Text>
              <Text style={{ width: '10%', fontSize: 7.5 }}>{row.assistantName}</Text>
              <Text style={{ width: '8%', fontSize: 7.5 }}>{row.droneName}</Text>
              <Text style={{ width: '9%', fontSize: 7.5 }}>{row.productName}</Text>
              <Text style={{ width: '7%', fontSize: 7.5 }}>{row.typeOrIssueLabel}</Text>
              <Text style={{ width: '4%', fontSize: 7.5, textAlign: 'right' }}>{row.appliedHectares.toFixed(2)}</Text>
              <Text style={{ width: '6%', fontSize: 7.5, textAlign: 'right' }}>{row.statusLabel}</Text>
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
          key={`applications-detail-${pageIndex}`}
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
              <Text style={{ fontSize: 13, fontWeight: 700 }}>Detalhamento de Aplicacoes</Text>
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
              <Text style={{ width: '14%', fontSize: 8, fontWeight: 700 }}>Data</Text>
              <Text style={{ width: '8%', fontSize: 8, fontWeight: 700 }}>OS</Text>
              <Text style={{ width: '17%', fontSize: 8, fontWeight: 700 }}>Cliente/Fazenda</Text>
              <Text style={{ width: '10%', fontSize: 8, fontWeight: 700 }}>Talhao</Text>
              <Text style={{ width: '11%', fontSize: 8, fontWeight: 700 }}>Piloto</Text>
              <Text style={{ width: '10%', fontSize: 8, fontWeight: 700 }}>Ajudante</Text>
              <Text style={{ width: '8%', fontSize: 8, fontWeight: 700 }}>Drone</Text>
              <Text style={{ width: '9%', fontSize: 8, fontWeight: 700 }}>Produto</Text>
              <Text style={{ width: '7%', fontSize: 8, fontWeight: 700 }}>Tipo/Issue</Text>
              <Text style={{ width: '4%', fontSize: 8, fontWeight: 700, textAlign: 'right' }}>Area</Text>
              <Text style={{ width: '6%', fontSize: 8, fontWeight: 700, textAlign: 'right' }}>Status</Text>
            </View>

            {rowsChunk.map((row, index) => (
              <View
                key={`applications-detail-row-${pageIndex}-${row.id}`}
                style={{
                  flexDirection: 'row',
                  paddingVertical: 5,
                  paddingHorizontal: 6,
                  backgroundColor: index % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
                  borderBottom: index === rowsChunk.length - 1 ? 0 : `1px solid ${LIGHT_BORDER}`,
                }}
              >
                <Text style={{ width: '14%', fontSize: 7.5 }}>{row.date}</Text>
                <Text style={{ width: '8%', fontSize: 7.5 }}>{row.serviceOrderNumber}</Text>
                <Text style={{ width: '17%', fontSize: 7.5 }}>{row.customerName} / {row.farmName}</Text>
                <Text style={{ width: '10%', fontSize: 7.5 }}>{row.plotName}</Text>
                <Text style={{ width: '11%', fontSize: 7.5 }}>{row.pilotName}</Text>
                <Text style={{ width: '10%', fontSize: 7.5 }}>{row.assistantName}</Text>
                <Text style={{ width: '8%', fontSize: 7.5 }}>{row.droneName}</Text>
                <Text style={{ width: '9%', fontSize: 7.5 }}>{row.productName}</Text>
                <Text style={{ width: '7%', fontSize: 7.5 }}>{row.typeOrIssueLabel}</Text>
                <Text style={{ width: '4%', fontSize: 7.5, textAlign: 'right' }}>{row.appliedHectares.toFixed(2)}</Text>
                <Text style={{ width: '6%', fontSize: 7.5, textAlign: 'right' }}>{row.statusLabel}</Text>
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

export default ApplicationsGeneralReportPDF;
