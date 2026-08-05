import { Image, Page, Path, Svg, Text, View } from '@react-pdf/renderer';
import React from 'react';

import type { Application } from '@/types/applications.type';
import type { ReportMapAsset } from '@/utils/report-map-assets';

export type ReportPlotMapSection = {
  asset: ReportMapAsset;
  customerName?: string;
  farmName?: string;
  serviceOrderNumber?: number;
  serviceOrderNumbers?: number[];
  applications?: Application[];
};

export function ReportPlotMapPages({
  sections,
  generatedAt,
  title = 'Mapa do talhão',
}: {
  sections: ReportPlotMapSection[];
  generatedAt: string;
  title?: string;
}) {
  return (
    <>
      {sections.map((section, index) => {
        const { asset } = section;
        const applications = section.applications || [];
        return (
          <Page
            key={`report-map-${asset.plotId}`}
            size='A4'
            style={{ padding: 28, fontFamily: 'Helvetica', fontSize: 9, color: '#1F2937' }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                borderBottom: '2px solid #EAAE07',
                paddingBottom: 8,
                marginBottom: 12,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: 700 }}>{title}</Text>
              <Text style={{ color: '#6B7280' }}>
                {index + 1} de {sections.length}
              </Text>
            </View>

            <View style={{ marginBottom: 10 }}>
              <Text style={{ fontSize: 12, fontWeight: 700 }}>{asset.plot.name}</Text>
              <Text style={{ color: '#6B7280', marginTop: 2 }}>
                {[section.customerName, section.farmName].filter(Boolean).join(' • ') ||
                  'Fazenda não informada'}
                {formatServiceOrders(section)}
              </Text>
              <Text style={{ color: '#6B7280', marginTop: 2 }}>
                Área cadastrada: {formatHectares(asset.plot.hectare)} • Aplicações: {applications.length}
              </Text>
            </View>

            <View
              style={{
                width: '100%',
                height: 230,
                position: 'relative',
                border: '1px solid #D1D5DB',
                backgroundColor: '#F3F4F6',
                overflow: 'hidden',
              }}
            >
              {asset.status === 'mapbox' && asset.imageDataUrl ? (
                <>
                  {/* eslint-disable-next-line jsx-a11y/alt-text */}
                  <Image
                    src={asset.imageDataUrl}
                    style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'fill' }}
                  />
                  {asset.overlayPathDs.length > 0 && (
                    <Svg
                      style={{ position: 'absolute', width: '100%', height: '100%' }}
                      viewBox='0 0 1280 480'
                      preserveAspectRatio='none'
                    >
                      {asset.overlayPathDs.map((pathD, pathIndex) => (
                        <Path
                          key={`${asset.plotId}-overlay-${pathIndex}`}
                          d={pathD}
                          fill={asset.fillColor}
                          fillOpacity={0.38}
                          fillRule='evenodd'
                          stroke={asset.strokeColor}
                          strokeWidth={2.5}
                        />
                      ))}
                    </Svg>
                  )}
                </>
              ) : asset.vectorPathD ? (
                <Svg width='100%' height='100%' viewBox='0 0 1280 480' preserveAspectRatio='none'>
                  <Path d='M 0 0 H 1280 V 480 H 0 Z' fill='#FFFFFF' stroke='#D1D5DB' />
                  <Path
                    d={asset.vectorPathD}
                    fill={asset.fillColor}
                    fillOpacity={0.58}
                    fillRule='evenodd'
                    stroke={asset.strokeColor}
                    strokeWidth={2.5}
                  />
                </Svg>
              ) : (
                <View
                  style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}
                >
                  <Text style={{ color: '#6B7280' }}>Geometria do talhão indisponível.</Text>
                </View>
              )}
            </View>

            {asset.status !== 'mapbox' && (
              <Text style={{ marginTop: 6, color: '#6B7280', textAlign: 'center' }}>
                {asset.message}
              </Text>
            )}

            {applications.length > 0 && (
              <View style={{ marginTop: 14, border: '1px solid #E5E7EB' }}>
                <View style={{ flexDirection: 'row', backgroundColor: '#FFF8E5', padding: 5 }}>
                  <Text style={{ width: '18%', fontWeight: 700 }}>Data</Text>
                  <Text style={{ width: '25%', fontWeight: 700 }}>Piloto</Text>
                  <Text style={{ width: '25%', fontWeight: 700 }}>Produto</Text>
                  <Text style={{ width: '18%', fontWeight: 700 }}>Drone</Text>
                  <Text style={{ width: '14%', fontWeight: 700, textAlign: 'right' }}>Área</Text>
                </View>
                {applications.map((application, applicationIndex) => (
                  <View
                    key={application.id}
                    style={{
                      flexDirection: 'row',
                      padding: 5,
                      backgroundColor: applicationIndex % 2 === 0 ? '#FFFFFF' : '#F9FAFB',
                      borderTop: '1px solid #F3F4F6',
                    }}
                  >
                    <Text style={{ width: '18%' }}>{formatDate(application.date)}</Text>
                    <Text style={{ width: '25%' }}>{application.pilot?.name || '-'}</Text>
                    <Text style={{ width: '25%' }}>{application.product?.name || '-'}</Text>
                    <Text style={{ width: '18%' }}>{application.drone?.name || '-'}</Text>
                    <Text style={{ width: '14%', textAlign: 'right' }}>
                      {formatHectares(application.hectares)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <Text
              fixed
              style={{ position: 'absolute', bottom: 16, left: 28, right: 28, textAlign: 'center', color: '#9CA3AF' }}
            >
              IControl • Gerado em {generatedAt}
            </Text>
          </Page>
        );
      })}
    </>
  );
}

function formatServiceOrders(section: ReportPlotMapSection): string {
  const numbers = Array.from(
    new Set(
      [...(section.serviceOrderNumbers || []), section.serviceOrderNumber].filter(
        (value): value is number => typeof value === 'number'
      )
    )
  );
  return numbers.length > 0 ? ` • OS ${numbers.map((number) => `#${number}`).join(', ')}` : '';
}

function formatDate(value?: string | Date): string {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('pt-BR').format(date);
}

function formatHectares(value: string | number): string {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value.replace(',', '.'));
  return `${(Number.isFinite(parsed) ? parsed : 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ha`;
}
