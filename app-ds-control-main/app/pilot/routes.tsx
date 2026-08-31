import { useLocalSearchParams } from 'expo-router';

import BackofficeRoutesMap from '@/components/Backoffice/BackofficeRoutesMap';

export default function PilotRoutesScreen() {
  const { farmId, plotId, autoGo } = useLocalSearchParams<{
    farmId?: string;
    plotId?: string;
    autoGo?: string;
  }>();

  return (
    <BackofficeRoutesMap
      audience='pilot'
      initialFarmId={farmId}
      initialPlotId={plotId}
      autoStartNavigation={autoGo === 'true'}
    />
  );
}
