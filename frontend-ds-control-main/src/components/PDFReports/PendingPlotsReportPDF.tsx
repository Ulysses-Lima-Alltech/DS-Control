import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import React from 'react';

import type { ServiceOrder } from '@/types/service-order.type';

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, color: '#1f2937', fontFamily: 'Helvetica' },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 6 },
  subtitle: { fontSize: 10, color: '#6b7280', marginBottom: 20 },
  summary: { padding: 12, backgroundColor: '#f3f4f6', marginBottom: 16 },
  summaryText: { fontSize: 11, marginBottom: 3 },
  header: { flexDirection: 'row', backgroundColor: '#e5e7eb', padding: 7, fontWeight: 700 },
  row: { flexDirection: 'row', padding: 7, borderBottomWidth: 0.5, borderBottomColor: '#d1d5db' },
  plot: { width: '30%' },
  farm: { width: '45%' },
  area: { width: '25%', textAlign: 'right' },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 36,
    right: 36,
    textAlign: 'center',
    color: '#9ca3af',
  },
});

export function PendingPlotsReportPDF({
  serviceOrder,
  pendingPlotIds,
}: {
  serviceOrder: ServiceOrder;
  pendingPlotIds: string[];
}) {
  const pendingIds = new Set(pendingPlotIds);
  const plots = (serviceOrder.plots || [])
    .filter((plot) => Boolean(plot.id && pendingIds.has(plot.id)))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }));
  const area = plots.reduce((sum, plot) => sum + (Number.parseFloat(plot.hectare) || 0), 0);
  const farmNames = new Map((serviceOrder.farms || []).map((farm) => [farm.id, farm.name]));
  const hectares = (value: number) =>
    `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ha`;

  return (
    <Document title={`Relatório de Talhões Pendentes - OS ${serviceOrder.number}`}>
      <Page size='A4' style={styles.page}>
        <Text style={styles.title}>Relatório de Talhões Pendentes</Text>
        <Text style={styles.subtitle}>Ordem de Serviço #{serviceOrder.number}</Text>
        <View style={styles.summary}>
          <Text style={styles.summaryText}>Talhões pendentes: {plots.length}</Text>
          <Text style={styles.summaryText}>Área pendente: {hectares(area)}</Text>
          <Text>Critério oficial: vínculo da OS com status PENDING.</Text>
        </View>
        <View style={styles.header} fixed>
          <Text style={styles.plot}>Talhão</Text>
          <Text style={styles.farm}>Fazenda</Text>
          <Text style={styles.area}>Área cadastrada</Text>
        </View>
        {plots.map((plot) => (
          <View key={plot.id} style={styles.row} wrap={false}>
            <Text style={styles.plot}>{plot.name}</Text>
            <Text style={styles.farm}>{farmNames.get(plot.farmId || '') || 'Não informada'}</Text>
            <Text style={styles.area}>{hectares(Number.parseFloat(plot.hectare) || 0)}</Text>
          </View>
        ))}
        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}
