import { ScrollView } from 'react-native';
import CardServiceOrderData from '@/components/CardServiceOrderData';
import { useLocalSearchParams } from 'expo-router';
import CardServiceOrderApplications from '@/components/CardServiceOrderApplications';
import OfflineOSDownloadButton from '@/components/Offline/OfflineOSDownloadButton';
import { COLORS } from '@/constants/colors';

export default function ServiceOrderDetailsScreen() {
  const { serviceOrderId } = useLocalSearchParams<{ serviceOrderId: string }>();

  return (
    <ScrollView style={{ padding: 12, backgroundColor: COLORS.background }}>
      <OfflineOSDownloadButton serviceOrderId={serviceOrderId} />
      <CardServiceOrderData serviceOrderId={serviceOrderId} />
      <CardServiceOrderApplications serviceOrderId={serviceOrderId} />
    </ScrollView>
  );
}
