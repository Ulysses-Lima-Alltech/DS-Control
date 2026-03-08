import FormApplication from '@/components/FormApplication';
import { useLocalSearchParams } from 'expo-router';

export type FormMode = 'new' | 'edit' | 'new-loose';

export default function ScreenNewApplication() {
  const { serviceOrderId, formMode, applicationId } = useLocalSearchParams<{
    serviceOrderId: string;
    formMode: FormMode;
    applicationId: string;
  }>();

  return (
    <FormApplication
      serviceOrderId={serviceOrderId}
      formMode={formMode}
      applicationId={applicationId}
    />
  );
}
