import { useQuery } from '@tanstack/react-query';

import { getMyPilotSummary, PilotSummary } from '@/services/mobile.service';

export function useGetMyPilotSummary() {
  return useQuery<PilotSummary, Error>({
    queryKey: ['mobile', 'me', 'pilot-summary'],
    queryFn: getMyPilotSummary,
    staleTime: 5 * 60 * 1000,
  });
}
