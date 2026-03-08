import ScreenMapViewerWithSearch from '@/components/Screen/ScreenMapViewerWithSearch';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/providers/auth.provider';

export default function ScreenFarmerMap() {
  const { user } = useAuth();
  const { initialFarmId } = useLocalSearchParams<{ initialFarmId?: string }>();

  return <ScreenMapViewerWithSearch initialFarmId={initialFarmId} customerId={user?.customerId} />;
}
