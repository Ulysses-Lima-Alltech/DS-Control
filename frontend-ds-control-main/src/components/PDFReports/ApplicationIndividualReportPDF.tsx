import { Document, Font, Image, Page, Path, Svg, Text, View } from '@react-pdf/renderer';
import React from 'react';

import type { Application } from '@/types/applications.type';
import type { ServiceOrderStatus } from '@/types/service-order.type';
import { formatApplicationDate } from '@/utils/application-date-formatter';

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
const MAP_BG = '#EEF3FA';
const MAP_FALLBACK_BORDER = '#B9C8DA';

const MAP_WIDTH = 1280;
const MAP_HEIGHT = 480;
const DJI_REPORT_IMAGE_HEIGHT = 270;

type ApplicationIndividualReportPDFProps = {
  application: Application;
  generatedAt: string;
  djiImageDataUrl?: string | null;
  djiImageUrl?: string | null;
  mapImageDataUrl?: string | null;
  mapOverlayPathDs?: string[] | null;
  mapFallbackVectorPathD?: string | null;
  mapUnavailableMessage?: string | null;
};

function parseNumber(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const normalized = Number.parseFloat(value.replace(',', '.'));
    return Number.isFinite(normalized) ? normalized : 0;
  }

  return 0;
}

function formatHectares(value: number): string {
  return `${value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ha`;
}

function formatStatus(status?: ServiceOrderStatus): string {
  if (status === 'completed') return 'Concluida';
  if (status === 'cancelled') return 'Cancelada';
  if (status === 'open') return 'Aberta';
  return 'Nao informada';
}

function formatMetricPercent(value: number): string {
  return `${value.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

const ApplicationIndividualReportPDF: React.FC<ApplicationIndividualReportPDFProps> = ({
  application,
  generatedAt,
  djiImageDataUrl,
  djiImageUrl,
  mapImageDataUrl,
  mapOverlayPathDs,
  mapFallbackVectorPathD,
  mapUnavailableMessage,
}) => {
  const serviceOrder = application.serviceOrder;
  const customerName =
    application.farm?.customer?.name || serviceOrder?.customer?.name || 'Cliente N/A';
  const farmName = application.farm?.name || 'Fazenda N/A';
  const plotName = application.plot?.name || 'Talhao N/A';
  const productName = application.product?.name || 'Produto N/A';
  const pilotName = application.pilot?.name || 'Piloto N/A';
  const assistantName = application.assistant?.name || 'Ajudante N/A';
  const droneName = application.drone?.name || 'Drone N/A';
  const statusLabel = formatStatus(serviceOrder?.status);
  const serviceOrderNumber =
    serviceOrder?.number !== undefined && serviceOrder?.number !== null
      ? `#${serviceOrder.number}`
      : application.serviceOrderId
        ? `#${application.serviceOrderId}`
        : 'Sem OS vinculada';
  const contractLabel = serviceOrder?.contract?.name || 'Nao informado';
  const observations = application.observations || serviceOrder?.observation || 'Sem observacoes';

  const plannedHectares = parseNumber(application.plot?.hectare);
  const appliedHectares = parseNumber(application.hectares);
  const areaDifference = plannedHectares > 0 ? appliedHectares - plannedHectares : null;
  const completionPercent = plannedHectares > 0 ? (appliedHectares / plannedHectares) * 100 : null;

  const applicationDateLabel = formatApplicationDate(application.date);
  const showDjiImage = Boolean(djiImageUrl && djiImageDataUrl);
  const showMapImage = !showDjiImage && Boolean(mapImageDataUrl);
  const showMapVectorFallback = !showDjiImage && !showMapImage && Boolean(mapFallbackVectorPathD);

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
          <Image
            src='/images/pdf-logo-only.png'
            style={{ width: 126, height: 32, objectFit: 'contain' }}
          />
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 14, fontWeight: 700 }}>Relatorio de Aplicacao</Text>
            <Text style={{ fontSize: 10, color: MUTED_TEXT, marginTop: 2 }}>
              Detalhamento individual do voo/aplicacao
            </Text>
          </View>
        </View>

        <View
          style={{
            border: `1px solid ${LIGHT_BORDER}`,
            borderRadius: 8,
            padding: 12,
            backgroundColor: '#F9FAFB',
            marginBottom: 10,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Dados gerais</Text>
          <View style={{ flexDirection: 'row', marginBottom: 6 }}>
            <Info label='Cliente' value={customerName} width='50%' />
            <Info label='OS' value={serviceOrderNumber} width='50%' />
          </View>
          <View style={{ flexDirection: 'row', marginBottom: 6 }}>
            <Info label='Fazenda' value={farmName} width='50%' />
            <Info label='Talhao' value={plotName} width='50%' />
          </View>
          <View style={{ flexDirection: 'row', marginBottom: 6 }}>
            <Info label='Produto' value={productName} width='50%' />
            <Info label='Piloto' value={pilotName} width='50%' />
          </View>
          <View style={{ flexDirection: 'row', marginBottom: 6 }}>
            <Info label='Ajudante' value={assistantName} width='50%' />
            <Info label='Drone' value={droneName} width='50%' />
          </View>
          <View style={{ flexDirection: 'row', marginBottom: 6 }}>
            <Info label='Data da aplicacao' value={applicationDateLabel} width='50%' />
            <Info label='Status' value={statusLabel} width='50%' />
          </View>
          <View style={{ flexDirection: 'row', marginBottom: 6 }}>
            <Info label='Contrato / Safra' value={contractLabel} width='50%' />
            <Info label='Area aplicada' value={formatHectares(appliedHectares)} width='50%' />
          </View>
          <Info label='Observacoes' value={observations} width='100%' />
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
          <MetricCard
            label='Area planejada'
            value={plannedHectares > 0 ? formatHectares(plannedHectares) : 'Nao informada'}
            background='#FFFBEB'
            valueColor='#B45309'
          />
          <MetricCard
            label='Area aplicada'
            value={formatHectares(appliedHectares)}
            background='#EFF6FF'
            valueColor='#1D4ED8'
          />
          <MetricCard
            label='Diferenca'
            value={areaDifference === null ? 'N/A' : formatHectares(areaDifference)}
            background='#F8FAFC'
            valueColor='#0F172A'
          />
          <MetricCard
            label='Percentual concluido'
            value={completionPercent === null ? 'N/A' : formatMetricPercent(completionPercent)}
            background='#ECFDF3'
            valueColor='#047857'
          />
        </View>

        <View
          style={{
            border: `1px solid ${LIGHT_BORDER}`,
            borderRadius: 8,
            padding: 10,
            marginBottom: 10,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
            {showDjiImage ? 'Imagem DJI vinculada' : 'Mapa individual do talhao'}
          </Text>
          {showDjiImage ? (
            <>
              <View
                style={{
                  width: '100%',
                  height: DJI_REPORT_IMAGE_HEIGHT,
                  border: `1px solid ${LIGHT_BORDER}`,
                  borderRadius: 6,
                  backgroundColor: '#F9FAFB',
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: 6,
                  overflow: 'hidden',
                }}
              >
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <Image
                  src={djiImageDataUrl!}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                  }}
                />
              </View>
              <Text
                style={{
                  fontSize: 8,
                  color: MUTED_TEXT,
                  textAlign: 'center',
                  marginTop: 6,
                }}
              >
                Imagem DJI vinculada à aplicação — {applicationDateLabel}
              </Text>
            </>
          ) : (
            <View
              style={{
                width: '100%',
                height: 200,
                border: `1px solid ${LIGHT_BORDER}`,
                borderRadius: 6,
                backgroundColor: MAP_BG,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {showMapImage && (
                <>
                  {/* eslint-disable-next-line jsx-a11y/alt-text */}
                  <Image
                    src={mapImageDataUrl!}
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'fill',
                    }}
                  />
                  {mapOverlayPathDs?.length ? (
                    <Svg
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        width: '100%',
                        height: '100%',
                      }}
                      viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
                      preserveAspectRatio='none'
                    >
                      {mapOverlayPathDs.map((pathD, index) => (
                        <Path
                          key={`overlay-${index}`}
                          d={pathD}
                          fill='#3388ff'
                          fillOpacity={0.35}
                          fillRule='evenodd'
                          stroke='#1d4ed8'
                          strokeWidth={2}
                        />
                      ))}
                    </Svg>
                  ) : null}
                </>
              )}

              {showMapVectorFallback && (
                <Svg
                  width='100%'
                  height='100%'
                  viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
                  preserveAspectRatio='none'
                >
                  <Path
                    d={`M 0 0 L ${MAP_WIDTH} 0 L ${MAP_WIDTH} ${MAP_HEIGHT} L 0 ${MAP_HEIGHT} Z`}
                    fill='#FFFFFF'
                    stroke={MAP_FALLBACK_BORDER}
                    strokeWidth={1}
                  />
                  <Path
                    d={mapFallbackVectorPathD!}
                    fill='#60A5FA'
                    fillOpacity={0.58}
                    fillRule='evenodd'
                    stroke='#1D4ED8'
                    strokeWidth={2.2}
                  />
                </Svg>
              )}

              {!showMapImage && !showMapVectorFallback && (
                <View
                  style={{
                    width: '100%',
                    height: '100%',
                    justifyContent: 'center',
                    alignItems: 'center',
                    paddingHorizontal: 12,
                  }}
                >
                  <Text style={{ fontSize: 10, color: MUTED_TEXT, textAlign: 'center' }}>
                    {mapUnavailableMessage || 'Mapa indisponivel para esta aplicacao.'}
                  </Text>
                </View>
              )}
            </View>
          )}
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
            <Text style={{ width: '20%', fontSize: 8, fontWeight: 700 }}>Data</Text>
            <Text style={{ width: '24%', fontSize: 8, fontWeight: 700 }}>Produto</Text>
            <Text style={{ width: '16%', fontSize: 8, fontWeight: 700 }}>Piloto</Text>
            <Text style={{ width: '14%', fontSize: 8, fontWeight: 700, textAlign: 'right' }}>
              Planejada
            </Text>
            <Text style={{ width: '14%', fontSize: 8, fontWeight: 700, textAlign: 'right' }}>
              Aplicada
            </Text>
            <Text style={{ width: '12%', fontSize: 8, fontWeight: 700, textAlign: 'center' }}>
              Status
            </Text>
          </View>

          <View style={{ flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 6 }}>
            <Text style={{ width: '20%', fontSize: 8 }}>{applicationDateLabel}</Text>
            <Text style={{ width: '24%', fontSize: 8 }}>{productName}</Text>
            <Text style={{ width: '16%', fontSize: 8 }}>{pilotName}</Text>
            <Text style={{ width: '14%', fontSize: 8, textAlign: 'right' }}>
              {plannedHectares > 0 ? formatHectares(plannedHectares) : 'N/A'}
            </Text>
            <Text style={{ width: '14%', fontSize: 8, textAlign: 'right' }}>
              {formatHectares(appliedHectares)}
            </Text>
            <Text style={{ width: '12%', fontSize: 8, textAlign: 'center' }}>{statusLabel}</Text>
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
          <Text style={{ fontSize: 8, color: MUTED_TEXT }}>
            DS Control - Gerado em {generatedAt}
          </Text>
          <Text
            style={{ fontSize: 8, color: MUTED_TEXT }}
            render={({ pageNumber, totalPages }) => `Pagina ${pageNumber} de ${totalPages}`}
          />
        </View>
      </Page>

      <Page
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
            marginBottom: 10,
          }}
        >
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image
            src='/images/pdf-logo-only.png'
            style={{ width: 126, height: 32, objectFit: 'contain' }}
          />
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 13, fontWeight: 700 }}>Detalhamento tecnico</Text>
            <Text style={{ fontSize: 9, color: MUTED_TEXT }}>{serviceOrderNumber}</Text>
          </View>
        </View>

        <View
          style={{
            border: `1px solid ${LIGHT_BORDER}`,
            borderRadius: 8,
            padding: 10,
            marginBottom: 10,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: 700, marginBottom: 8 }}>Dados operacionais</Text>
          <DetailRow label='ID da aplicacao' value={application.id} />
          <DetailRow label='Area aplicada' value={formatHectares(appliedHectares)} />
          <DetailRow
            label='Vazao'
            value={application.flowRate ? `${application.flowRate} L/ha` : 'Nao informada'}
          />
          <DetailRow
            label='Altitude'
            value={application.altitude ? `${application.altitude} m` : 'Nao informada'}
          />
          <DetailRow
            label='Espacamento de rota'
            value={application.routeSpacing ? `${application.routeSpacing} m` : 'Nao informado'}
          />
          <DetailRow
            label='Tamanho de gota'
            value={application.dropletSize ? `${application.dropletSize} um` : 'Nao informado'}
          />
        </View>

        <View style={{ border: `1px solid ${LIGHT_BORDER}`, borderRadius: 8, padding: 10 }}>
          <Text style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>
            Historico / observacoes
          </Text>
          <Text style={{ fontSize: 9, color: DARK_TEXT, lineHeight: 1.35 }}>{observations}</Text>
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
          <Text style={{ fontSize: 8, color: MUTED_TEXT }}>
            DS Control - Gerado em {generatedAt}
          </Text>
          <Text
            style={{ fontSize: 8, color: MUTED_TEXT }}
            render={({ pageNumber, totalPages }) => `Pagina ${pageNumber} de ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
};

function Info({ label, value, width }: { label: string; value: string; width: string }) {
  return (
    <View style={{ width }}>
      <Text style={{ fontSize: 9, color: MUTED_TEXT, marginBottom: 2 }}>{label}</Text>
      <Text style={{ fontSize: 10, fontWeight: 500 }}>{value}</Text>
    </View>
  );
}

function MetricCard({
  label,
  value,
  background,
  valueColor,
}: {
  label: string;
  value: string;
  background: string;
  valueColor: string;
}) {
  return (
    <View
      style={{
        width: '24%',
        backgroundColor: background,
        borderRadius: 6,
        paddingVertical: 8,
        paddingHorizontal: 7,
      }}
    >
      <Text style={{ fontSize: 8, color: MUTED_TEXT, marginBottom: 2 }}>{label}</Text>
      <Text style={{ fontSize: 10, fontWeight: 700, color: valueColor }}>{value}</Text>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
        borderBottom: '1px solid #F1F5F9',
        paddingBottom: 4,
      }}
    >
      <Text style={{ fontSize: 9, color: MUTED_TEXT }}>{label}</Text>
      <Text style={{ fontSize: 9, color: DARK_TEXT, fontWeight: 500 }}>{value}</Text>
    </View>
  );
}

export default ApplicationIndividualReportPDF;
