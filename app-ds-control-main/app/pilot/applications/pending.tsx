import { Stack } from 'expo-router';
import OfflineApplicationsList from '@/components/OfflineApplicationsList';
import HeaderApp from '@/components/HeaderApp';

export default function PendingApplications() {
  return (
    <>
      <Stack.Screen
        options={{
          header: () => <HeaderApp />,
        }}
      />
      <OfflineApplicationsList />
    </>
  );
}
