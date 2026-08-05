import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

import { COLORS, SHADOWS } from '@/constants/colors';
import { PilotSummary } from '@/services/mobile.service';
import { formatOperationalDateBR } from '@/utils/operational-date';

const hectaresFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function PilotSummaryCard({
  summary,
  isLoading,
  error,
  onRetry,
}: {
  summary?: PilotSummary;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
}) {
  if (isLoading) {
    return (
      <View
        style={{
          ...SHADOWS.card,
          alignItems: 'center',
          backgroundColor: COLORS.white,
          borderColor: COLORS.border,
          borderRadius: 18,
          borderWidth: 1,
          marginBottom: 12,
          padding: 20,
        }}
      >
        <ActivityIndicator color={COLORS.primaryDark} />
        <Text style={{ color: COLORS.textMuted, marginTop: 8 }}>Carregando total histórico...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View
        style={{
          backgroundColor: COLORS.errorSoft,
          borderColor: COLORS.error,
          borderRadius: 18,
          borderWidth: 1,
          marginBottom: 12,
          padding: 16,
        }}
      >
        <Text style={{ color: COLORS.error, fontWeight: '700' }}>
          Resumo histórico indisponível
        </Text>
        <Text style={{ color: COLORS.textMuted, marginTop: 4 }}>
          Conecte-se à internet e tente novamente.
        </Text>
        <TouchableOpacity onPress={onRetry} style={{ marginTop: 10 }}>
          <Text style={{ color: COLORS.primaryDark, fontWeight: '700' }}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const applicationsCount = summary?.applicationsCount ?? 0;
  const lastApplication = summary?.lastApplicationAt
    ? formatOperationalDateBR(summary.lastApplicationAt)
    : 'Nenhuma aplicação';

  return (
    <View
      style={{
        ...SHADOWS.card,
        backgroundColor: COLORS.primarySoft,
        borderColor: COLORS.borderStrong,
        borderRadius: 18,
        borderWidth: 1,
        marginBottom: 12,
        padding: 16,
      }}
    >
      <Text style={{ color: COLORS.primaryDark, fontSize: 14, fontWeight: '700' }}>
        Meu histórico de aplicações
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 }}>
        <View style={{ minWidth: '50%', paddingRight: 10 }}>
          <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>Total aplicado</Text>
          <Text style={{ color: COLORS.text, fontSize: 22, fontWeight: '700', marginTop: 2 }}>
            {hectaresFormatter.format(summary?.historicalAppliedAreaHa ?? 0)} ha
          </Text>
        </View>
        <View style={{ minWidth: '50%' }}>
          <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>Aplicações</Text>
          <Text style={{ color: COLORS.text, fontSize: 22, fontWeight: '700', marginTop: 2 }}>
            {applicationsCount.toLocaleString('pt-BR')}
          </Text>
        </View>
        <View style={{ marginTop: 14, width: '100%' }}>
          <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>Última aplicação</Text>
          <Text style={{ color: COLORS.text, fontSize: 16, fontWeight: '600', marginTop: 2 }}>
            {lastApplication}
          </Text>
        </View>
      </View>
    </View>
  );
}
