import { Document, Font, Image, Page, Path, Svg, Text, View } from '@react-pdf/renderer';
import React from 'react';

import type { Application } from '@/types/applications.type';
import type { ServiceOrder } from '@/types/service-order.type';
import {
  buildReportMapboxStaticUrl,
  getReportMapPlaceholderMessage,
} from '@/utils/mapboxStaticReportMap';
import { formatOperationalDateBR } from '@/utils/operational-date';
import {
  buildCompletedPlotsPlannedAreaReportData,
  buildPlannedAreaReportData,
  formatReportHectares,
} from '@/utils/reportArea';
import { buildPlotPolygonSvgOverlay, buildPlotReportLabel } from '@/utils/reportPlotPolygonSvg';

Font.register({
  family: 'Roboto',
  fonts: [
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

export interface PlannedAreaReportPDFProps {
  serviceOrder: ServiceOrder;
  applications: Application[];
  prefetchedMapImageDataUrls?: Record<string, string | null>;
  variant?: 'all' | 'completed';
  completedPlotIds?: string[];
}

const MAP_WIDTH = 1280;
const MAP_HEIGHT = 480;

function CoverInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', marginBottom: 8 }}>
      <Text style={{ width: '40%', fontSize: 10, fontWeight: 700, color: '#6B7280' }}>{label}</Text>
      <Text style={{ width: '60%', fontSize: 10, color: '#1F2937' }}>{value}</Text>
    </View>
  );
}

const PlannedAreaReportPDF: React.FC<PlannedAreaReportPDFProps> = ({
  serviceOrder,
  applications,
  prefetchedMapImageDataUrls,
  variant = 'all',
  completedPlotIds = [],
}) => {
  const isCompletedReport = variant === 'completed';
  const reportData = isCompletedReport
    ? buildCompletedPlotsPlannedAreaReportData({
        serviceOrder,
        applications,
        completedPlotIds,
      })
    : buildPlannedAreaReportData({ serviceOrder, applications });
  const linkedFarms = isCompletedReport ? serviceOrder.farms || [] : reportData.farmGroups;
  const generatedDateTime = new Date().toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <Document
      title={`${
        isCompletedReport
          ? 'Relatório de Talhões Concluídos — Área Planejada'
          : 'Relatório de Área Planejada'
      } - OS ${serviceOrder.number}`}
    >
      <Page
        wrap={false}
        size='A4'
        style={{
          backgroundColor: '#FFFFFF',
          fontFamily: 'Roboto',
          fontSize: 10,
          padding: 30,
        }}
      >
        <View style={{ alignItems: 'center' }}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image
            src='/images/pdf-logo-complete.png'
            style={{ width: 280, height: 90, marginBottom: 14, objectFit: 'contain' }}
          />
          <Text style={{ fontSize: 23, fontWeight: 700, marginBottom: 8, textAlign: 'center' }}>
            DS Drones Agrícolas LTDA
          </Text>
          <Text
            style={{
              fontSize: 17,
              fontWeight: 500,
              marginBottom: 20,
              color: '#6B7280',
              textAlign: 'center',
            }}
          >
            {isCompletedReport
              ? 'Relatório de Talhões Concluídos — Área Planejada'
              : 'Relatório de Área Planejada'}
          </Text>
        </View>

        <View
          style={{
            width: '100%',
            padding: 14,
            border: '1px solid #E5E7EB',
            borderRadius: 8,
            marginBottom: 14,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: '#1F2937' }}>
            Identificação da Ordem de Serviço
          </Text>
          <CoverInfoRow label='Número da OS:' value={`#${serviceOrder.number}`} />
          <CoverInfoRow label='Cliente:' value={serviceOrder.customer?.name || 'N/A'} />
          <CoverInfoRow label='Contrato:' value={serviceOrder.contract?.name || 'N/A'} />
          <CoverInfoRow
            label='Data Planejada:'
            value={formatOperationalDateBR(serviceOrder.plannedDate)}
          />
          <View style={{ flexDirection: 'row' }}>
            <Text style={{ width: '40%', fontSize: 10, fontWeight: 700, color: '#6B7280' }}>
              Fazendas Vinculadas:
            </Text>
            <View style={{ width: '60%', flexDirection: 'row', flexWrap: 'wrap' }}>
              {linkedFarms.map((farm) => (
                <Text
                  key={farm.id}
                  style={{
                    backgroundColor: '#FFF3CD',
                    color: '#B77900',
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 4,
                    fontSize: 8,
                    marginRight: 4,
                    marginBottom: 4,
                  }}
                >
                  {farm.name}
                </Text>
              ))}
            </View>
          </View>
        </View>

        <View
          style={{
            width: '100%',
            padding: 14,
            border: '1px solid #E5E7EB',
            borderRadius: 8,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: '#1F2937' }}>
            {isCompletedReport ? 'Resumo dos Talhões Concluídos' : 'Resumo do Planejamento'}
          </Text>
          <View style={{ flexDirection: 'row', marginBottom: 14 }}>
            <View
              style={{
                width: '49%',
                marginRight: '2%',
                padding: 12,
                borderRadius: 6,
                border: '1px solid #E5E7EB',
                backgroundColor: '#F9FAFB',
              }}
            >
              <Text style={{ fontSize: 9, fontWeight: 700, color: '#6B7280' }}>
                {isCompletedReport ? 'Talhões Concluídos' : 'Quantidade Total de Talhões'}
              </Text>
              <Text style={{ fontSize: 18, fontWeight: 700, color: '#1F2937', marginTop: 6 }}>
                {reportData.totalPlots}
              </Text>
            </View>
            <View
              style={{
                width: '49%',
                padding: 12,
                borderRadius: 6,
                border: '2px solid #EAAE07',
                backgroundColor: '#FFF3CD',
              }}
            >
              <Text style={{ fontSize: 9, fontWeight: 700, color: '#6B7280' }}>
                {isCompletedReport ? 'Área Total dos Talhões Concluídos' : 'Área Total Planejada'}
              </Text>
              <Text style={{ fontSize: 18, fontWeight: 700, color: '#B77900', marginTop: 6 }}>
                {formatReportHectares(reportData.totalArea)}
              </Text>
            </View>
          </View>

          <Text style={{ fontSize: 11, fontWeight: 700, marginBottom: 8, color: '#1F2937' }}>
            {isCompletedReport ? 'Área Concluída por Fazenda' : 'Área Planejada por Fazenda'}
          </Text>
          {reportData.farmGroups.map((farm) => (
            <View
              key={farm.id}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingVertical: 7,
                paddingHorizontal: 9,
                marginBottom: 5,
                borderRadius: 5,
                backgroundColor: '#F9FAFB',
              }}
            >
              <Text style={{ fontSize: 10, color: '#1F2937' }}>{farm.name}</Text>
              <Text style={{ fontSize: 10, fontWeight: 700, color: '#B77900' }}>
                {formatReportHectares(farm.totalArea)}
              </Text>
            </View>
          ))}
          {isCompletedReport ? (
            <Text style={{ fontSize: 9, color: '#6B7280', marginTop: 7 }}>
              Aplicações registradas: {reportData.applications.length}
            </Text>
          ) : null}
          <Text style={{ fontSize: 8, color: '#6B7280', marginTop: 8, lineHeight: 1.35 }}>
            {isCompletedReport
              ? 'Cada talhão classificado como concluído é considerado integralmente pela sua área cadastrada, com contagem única por talhão.'
              : 'Valores calculados a partir das áreas cadastradas dos talhões vinculados à Ordem de Serviço, com contagem única por talhão.'}
          </Text>
        </View>
      </Page>

      {reportData.plotEntries.map(({ plot, farmName, status }, plotIndex) => {
        const plotId = plot.id!;
        const plotPolygonOverlay = buildPlotPolygonSvgOverlay(plot, MAP_WIDTH, MAP_HEIGHT);
        const plotLabel = buildPlotReportLabel(plot);
        const mapResult = buildReportMapboxStaticUrl({
          plot,
          mapWidth: MAP_WIDTH,
          mapHeight: MAP_HEIGHT,
          accessToken:
            process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ||
            'pk.eyJ1IjoiYW50b25pb3Zpbmk0NyIsImEiOiJjbWJoNW9wM2swNmlyMmlvbGlmb3J6NW4xIn0.wKznYpMm2m5Z0Opjjkpa-Q',
        });
        const prefetchedSrc = prefetchedMapImageDataUrls?.[plotId];
        const usePrefetchedMap = prefetchedMapImageDataUrls !== undefined;
        const mapImageSrc = usePrefetchedMap
          ? (prefetchedSrc ?? undefined)
          : (mapResult.url ?? undefined);
        const mapPlaceholderMessage = mapResult.url
          ? 'Mapa indisponível'
          : getReportMapPlaceholderMessage(mapResult.unavailableReason);
        const isCompleted = isCompletedReport || status === 'completed';

        return (
          <Page
            key={plotId}
            size='A4'
            style={{
              backgroundColor: '#FFFFFF',
              fontFamily: 'Roboto',
              fontSize: 10,
              padding: 30,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 20,
                paddingBottom: 10,
                borderBottom: '2px solid #EAAE07',
              }}
            >
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <Image
                src='/images/pdf-logo-only.png'
                style={{ width: 120, height: 30, objectFit: 'contain' }}
              />
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 10, color: '#6B7280' }}>Página {plotIndex + 1}</Text>
                <Text style={{ fontSize: 8, color: '#9CA3AF', marginTop: 2 }}>
                  Gerado em: {generatedDateTime}
                </Text>
              </View>
            </View>

            <View
              style={{
                width: '100%',
                height: 250,
                position: 'relative',
                marginBottom: 22,
                border: '1px solid #E5E7EB',
                backgroundColor: '#F3F4F6',
              }}
            >
              {mapImageSrc ? (
                <>
                  {/* eslint-disable-next-line jsx-a11y/alt-text */}
                  <Image
                    src={mapImageSrc}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'fill',
                    }}
                  />
                  {plotPolygonOverlay ? (
                    <Svg
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                      }}
                      viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
                      preserveAspectRatio='none'
                    >
                      {plotPolygonOverlay.paths.map((path, index) => (
                        <Path
                          key={`${plotId}-polygon-${index}`}
                          d={path}
                          fill='#3388ff'
                          fillOpacity={0.35}
                          fillRule='evenodd'
                          stroke='#1d4ed8'
                          strokeWidth={2}
                        />
                      ))}
                      <Text
                        x={plotPolygonOverlay.labelPoint.x}
                        y={plotPolygonOverlay.labelPoint.y - 10}
                        textAnchor='middle'
                        dominantBaseline='middle'
                        fill='#FFFFFF'
                        stroke='#111827'
                        strokeOpacity={0.8}
                        strokeWidth={6}
                        strokeLinejoin='round'
                        style={{ fontFamily: 'Roboto', fontSize: 32, fontWeight: 700 }}
                      >
                        {plotLabel.title}
                      </Text>
                      <Text
                        x={plotPolygonOverlay.labelPoint.x}
                        y={plotPolygonOverlay.labelPoint.y + 28}
                        textAnchor='middle'
                        dominantBaseline='middle'
                        fill='#FFFFFF'
                        stroke='#111827'
                        strokeOpacity={0.8}
                        strokeWidth={5}
                        strokeLinejoin='round'
                        style={{ fontFamily: 'Roboto', fontSize: 27, fontWeight: 700 }}
                      >
                        {plotLabel.area}
                      </Text>
                    </Svg>
                  ) : null}
                </>
              ) : (
                <View style={{ height: '100%', justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: '#6B7280', fontWeight: 500 }}>
                    {mapPlaceholderMessage}
                  </Text>
                </View>
              )}
            </View>

            <View
              style={{
                padding: 18,
                borderRadius: 8,
                border: '1px solid #E5E7EB',
                backgroundColor: '#F9FAFB',
              }}
            >
              <Text style={{ fontSize: 17, fontWeight: 700, color: '#EAAE07', marginBottom: 16 }}>
                Talhão: {plot.name}
              </Text>
              <CoverInfoRow label='Fazenda:' value={farmName} />
              <CoverInfoRow
                label={isCompletedReport ? 'Área Concluída Considerada:' : 'Área Cadastrada:'}
                value={formatReportHectares(plot.hectare)}
              />
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                <Text style={{ width: '40%', fontSize: 10, fontWeight: 700, color: '#6B7280' }}>
                  Situação:
                </Text>
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: isCompleted ? '#166534' : '#92400E',
                    backgroundColor: isCompleted ? '#DCFCE7' : '#FEF3C7',
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 4,
                  }}
                >
                  {isCompletedReport ? 'Concluído' : isCompleted ? 'Com aplicação' : 'Pendente'}
                </Text>
              </View>
            </View>
          </Page>
        );
      })}
    </Document>
  );
};

export default PlannedAreaReportPDF;
