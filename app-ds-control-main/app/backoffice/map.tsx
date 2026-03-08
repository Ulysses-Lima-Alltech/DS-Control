import ScreenMapViewerWithSearch from '@/components/Screen/ScreenMapViewerWithSearch';
import { useLocalSearchParams } from 'expo-router';

export default function ScreenBackofficeMap() {
  const { initialFarmId } = useLocalSearchParams<{ initialFarmId?: string }>();

  return <ScreenMapViewerWithSearch initialFarmId={initialFarmId} />;
}
