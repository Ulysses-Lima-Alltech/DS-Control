import { useLocalSearchParams } from 'expo-router';
import { ScrollView } from 'react-native';

import ButtonGenerateServiceOrderReport from '@/components/ButtonGenerateServiceOrderReport';
import CardServiceOrderApplications from '@/components/CardServiceOrderApplications';
import CardServiceOrderData from '@/components/CardServiceOrderData';
import { COLORS } from '@/constants/colors';

export default function BackofficeServiceOrderDetailsScreen() {
  const { serviceOrderId } = useLocalSearchParams<{ serviceOrderId: string }>();

  return (
    <ScrollView style={{ padding: 12, backgroundColor: COLORS.background }}>
      <ButtonGenerateServiceOrderReport serviceOrderId={serviceOrderId} />
      <CardServiceOrderData serviceOrderId={serviceOrderId} />
      <CardServiceOrderApplications serviceOrderId={serviceOrderId} />
    </ScrollView>
  );
}
