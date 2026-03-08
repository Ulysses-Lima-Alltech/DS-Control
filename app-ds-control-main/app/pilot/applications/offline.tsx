import { Stack } from 'expo-router';
import OfflineFormApplication from '@/components/OfflineFormApplication';
import HeaderApp from '@/components/HeaderApp';

export default function OfflineApplicationForm() {
  return (
    <>
      <Stack.Screen
        options={{
          header: () => <HeaderApp />,
        }}
      />
      <OfflineFormApplication />
    </>
  );
}
