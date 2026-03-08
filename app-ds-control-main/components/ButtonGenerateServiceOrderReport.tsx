import { TouchableOpacity, Text, ActivityIndicator, View, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { COLORS } from '@/constants/colors';
import { useGetApplicationsByServiceOrderId } from '@/queries/application.query';
import { useGetServiceOrderById } from '@/queries/service-order.query';
import { generateServiceOrderReportHTML } from '@/utils/generate-service-order-report';

interface ButtonGenerateServiceOrderReportProps {
  serviceOrderId: string;
}

export default function ButtonGenerateServiceOrderReport({
  serviceOrderId,
}: ButtonGenerateServiceOrderReportProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: serviceOrderData, isLoading: isLoadingServiceOrder } = useGetServiceOrderById({
    serviceOrderId: serviceOrderId,
    includeFarms: 'true',
    includeCustomers: 'true',
    includePlots: 'true',
    includePilots: 'true',
    includeContracts: 'true',
    includeGeoJson: 'true',
  });

  const { data: applicationsData, isLoading: isLoadingApplications } =
    useGetApplicationsByServiceOrderId(serviceOrderId, { includeGeoJson: 'true' });

  const handleGeneratePDF = async () => {
    if (!serviceOrderData || !applicationsData) {
      Alert.alert('Erro', 'Dados não carregados');
      return;
    }

    const applications = applicationsData.data || [];

    if (applications.length === 0) {
      Alert.alert('Aviso', 'Não há aplicações para gerar o relatório');
      return;
    }

    try {
      setIsGenerating(true);

      const htmlContent = generateServiceOrderReportHTML(serviceOrderData, applications);

      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
      });

      if (Platform.OS === 'ios') {
        await Sharing.shareAsync(uri);
      } else {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `OS-${serviceOrderData.number}-Relatório.pdf`,
          UTI: 'com.adobe.pdf',
        });
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      Alert.alert('Erro', 'Não foi possível gerar o relatório');
    } finally {
      setIsGenerating(false);
    }
  };

  const isLoading = isLoadingServiceOrder || isLoadingApplications;
  const isDisabled = isLoading || isGenerating || !serviceOrderData || !applicationsData;

  return (
    <TouchableOpacity
      onPress={handleGeneratePDF}
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
          <Text
            style={{
              color: COLORS.white,
              fontSize: 16,
              fontWeight: 'bold',
            }}
          >
            Gerar relatório da OS
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}
