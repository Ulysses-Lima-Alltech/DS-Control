import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import DatePickeriOSModal from '@/components/ui/DatePickeriOSModal';
import { COLORS } from '@/constants/colors';
import { useGetServiceOrderById } from '@/queries/service-order.query';
import { getServiceOrderApplicationReport } from '@/services/application.service';
import { generateServiceOrderReportHTML } from '@/utils/generate-service-order-report';
import {
  formatOperationalDateBR,
  parseOperationalDateToPickerDate,
  toOperationalDateYMDOrToday,
} from '@/utils/operational-date';
import {
  ApplicationReportPeriodMode,
  buildApplicationReportFilename,
  buildApplicationReportMetrics,
  hydrateApplicationReportPlots,
  resolveApplicationReportPeriod,
} from '@/utils/service-order-application-report';

interface ButtonGenerateServiceOrderReportProps {
  serviceOrderId: string;
}

function DateField({
  label,
  value,
  onChange,
  minimumDate,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minimumDate?: string;
}) {
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);
  const pickerDate = parseOperationalDateToPickerDate(value) ?? new Date();
  const minimumPickerDate = parseOperationalDateToPickerDate(minimumDate);

  return (
    <View style={{ marginTop: 14 }}>
      <Text style={{ color: COLORS.text, fontWeight: '600', marginBottom: 6 }}>{label}</Text>
      {Platform.OS === 'ios' ? (
        <DatePickeriOSModal
          value={pickerDate}
          minimumDate={minimumPickerDate}
          onDateChange={(date) => onChange(toOperationalDateYMDOrToday(date))}
        />
      ) : (
        <>
          <TouchableOpacity
            onPress={() => setShowAndroidPicker(true)}
            style={{
              backgroundColor: COLORS.white,
              borderColor: COLORS.borderStrong,
              borderRadius: 12,
              borderWidth: 1,
              padding: 14,
            }}
          >
            <Text style={{ color: COLORS.text }}>{formatOperationalDateBR(value)}</Text>
          </TouchableOpacity>
          {showAndroidPicker ? (
            <DateTimePicker
              value={pickerDate}
              minimumDate={minimumPickerDate}
              mode='date'
              onChange={(_, date) => {
                setShowAndroidPicker(false);
                if (date) onChange(toOperationalDateYMDOrToday(date));
              }}
            />
          ) : null}
        </>
      )}
    </View>
  );
}

export default function ButtonGenerateServiceOrderReport({
  serviceOrderId,
}: ButtonGenerateServiceOrderReportProps) {
  const today = toOperationalDateYMDOrToday();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [periodMode, setPeriodMode] = useState<ApplicationReportPeriodMode>('all');
  const [selectedDate, setSelectedDate] = useState(today);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  const { data: serviceOrderData, isLoading: isLoadingServiceOrder } = useGetServiceOrderById({
    serviceOrderId,
    includeFarms: 'true',
    includeCustomers: 'true',
    includePlots: 'true',
    includePilots: 'true',
    includeContracts: 'true',
    includeGeoJson: 'true',
  });

  const handleGeneratePDF = async () => {
    if (!serviceOrderData) {
      Alert.alert('Erro', 'Dados não carregados');
      return;
    }

    try {
      setIsGenerating(true);
      const period = resolveApplicationReportPeriod(periodMode, selectedDate, startDate, endDate);
      const loadedApplications = await getServiceOrderApplicationReport({
        serviceOrderId,
        startDate: period.startDate,
        endDate: period.endDate,
      });

      if (loadedApplications.length === 0) {
        Alert.alert('Aviso', 'Nenhuma aplicação encontrada no período selecionado.');
        return;
      }

      const applications = hydrateApplicationReportPlots(serviceOrderData, loadedApplications);
      const reportMetrics = buildApplicationReportMetrics(applications);
      const filename = buildApplicationReportFilename(serviceOrderData.number, period);
      const htmlContent = generateServiceOrderReportHTML(serviceOrderData, applications, {
        period,
        metrics: reportMetrics,
      });
      const { uri } = await Print.printToFileAsync({ html: htmlContent, base64: false });

      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: filename,
        UTI: 'com.adobe.pdf',
      });
      setIsModalVisible(false);
    } catch (error) {
      Alert.alert(
        'Erro',
        error instanceof Error ? error.message : 'Não foi possível gerar o relatório'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const isDisabled = isLoadingServiceOrder || isGenerating || !serviceOrderData;

  return (
    <>
      <TouchableOpacity
        onPress={() => setIsModalVisible(true)}
        disabled={isDisabled}
        style={{
          backgroundColor: isDisabled ? COLORS.lightgray : COLORS.green,
          borderRadius: 12,
          padding: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 12,
          shadowColor: COLORS.black,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 3.84,
          elevation: 5,
        }}
      >
        {isGenerating ? (
          <ActivityIndicator color={COLORS.white} size='small' />
        ) : (
          <>
            <Ionicons
              name='document-text'
              size={24}
              color={COLORS.white}
              style={{ marginRight: 8 }}
            />
            <Text style={{ color: COLORS.white, fontSize: 16, fontWeight: 'bold' }}>
              Gerar relatório da OS
            </Text>
          </>
        )}
      </TouchableOpacity>

      <Modal
        visible={isModalVisible}
        transparent
        animationType='fade'
        onRequestClose={() => !isGenerating && setIsModalVisible(false)}
      >
        <Pressable
          onPress={() => !isGenerating && setIsModalVisible(false)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.45)',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={{ backgroundColor: COLORS.white, borderRadius: 18, padding: 20 }}
          >
            <Text style={{ color: COLORS.text, fontSize: 20, fontWeight: '700' }}>
              Relatório de aplicações
            </Text>
            <Text style={{ color: COLORS.textMuted, marginTop: 6 }}>
              Escolha o período incluído no PDF.
            </Text>

            {(
              [
                ['all', 'Todas as aplicações'],
                ['single', 'Uma data específica'],
                ['range', 'Intervalo de datas'],
              ] as const
            ).map(([mode, label]) => (
              <TouchableOpacity
                key={mode}
                onPress={() => setPeriodMode(mode)}
                style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14 }}
              >
                <Ionicons
                  name={periodMode === mode ? 'radio-button-on' : 'radio-button-off'}
                  color={periodMode === mode ? COLORS.green : COLORS.textMuted}
                  size={22}
                />
                <Text style={{ color: COLORS.text, marginLeft: 8 }}>{label}</Text>
              </TouchableOpacity>
            ))}

            {periodMode === 'single' ? (
              <DateField
                label='Data da aplicação'
                value={selectedDate}
                onChange={setSelectedDate}
              />
            ) : null}
            {periodMode === 'range' ? (
              <>
                <DateField label='Data inicial' value={startDate} onChange={setStartDate} />
                <DateField
                  label='Data final'
                  value={endDate}
                  minimumDate={startDate}
                  onChange={setEndDate}
                />
              </>
            ) : null}

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 22 }}>
              <TouchableOpacity
                disabled={isGenerating}
                onPress={() => setIsModalVisible(false)}
                style={{ padding: 12, marginRight: 8 }}
              >
                <Text style={{ color: COLORS.textMuted, fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={isGenerating}
                onPress={handleGeneratePDF}
                style={{ backgroundColor: COLORS.green, borderRadius: 12, padding: 12 }}
              >
                {isGenerating ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={{ color: COLORS.white, fontWeight: '700' }}>Gerar PDF</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
