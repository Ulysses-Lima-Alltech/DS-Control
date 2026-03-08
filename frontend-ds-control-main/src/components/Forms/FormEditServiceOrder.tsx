import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import FormRegisterNewServiceOrder from '@/components/Forms/FormRegisterNewServiceOrder';
import { useUpdateServiceOrderById } from '@/mutations/service-order.mutation';
import { useGetServiceOrderById } from '@/queries/service-order.query';
import { RegisterNewServiceOrderParams } from '@/services/service-order.service';
import { Farm } from '@/types/farm.type';
import { Plot } from '@/types/plot.type';
import { ServiceOrder } from '@/types/service-order.type';

export default function FormEditServiceOrder({
  serviceOrderId,
  onSuccess,
}: {
  serviceOrderId: string;
  onSuccess?: () => void;
}) {
  const queryClient = useQueryClient();

  const { data: serviceOrder, isLoading: isLoadingServiceOrder } = useGetServiceOrderById(
    serviceOrderId,
    {
      includeGeoJson: 'true',
      includePlots: 'true',
      includePilots: 'true',
      includeFarms: 'true',
      includeContracts: 'true',
      includeCustomers: 'true',
    }
  );

  const { mutate: updateServiceOrderById, isPending: isUpdatingServiceOrder } =
    useUpdateServiceOrderById();

  const handleSubmit = (data: RegisterNewServiceOrderParams) => {
    if (!serviceOrder) return;

    updateServiceOrderById(
      { id: serviceOrder.id, ...data },
      {
        onSuccess: () => {
          toast('Ordem de serviço atualizada com sucesso');
          queryClient.invalidateQueries({ queryKey: ['service-orders'] });
          onSuccess?.();
        },
        onError: (error) => {
          toast(error.message);
        },
      }
    );
  };

  if (isLoadingServiceOrder) {
    return (
      <div className='flex flex-col items-center justify-center space-y-2 p-8 h-full'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary'></div>
        <p className='text-sm text-muted-foreground'>Baixando fazendas...</p>
      </div>
    );
  }

  if (!serviceOrder) {
    return (
      <div className='flex flex-col items-center justify-center space-y-2 p-8 h-full'>
        <p className='text-sm text-muted-foreground'>Ordem de serviço não encontrada!</p>
      </div>
    );
  }

  const filteredPlots = serviceOrder?.plots?.filter((plot) => {
    return !plot.deletedAt || (plot.id && serviceOrder.plotsIds?.includes(plot.id));
  });

  function puttingThePlotsInsideRespectiveFarm(plots: Plot[], farms: Farm[]): Farm[] {
    if (!plots || !farms) return [];
    serviceOrder?.plots?.forEach((plot) => {
      const farm = farms.find((farm) => farm.id === plot.farmId);
      if (farm) {
        farm.plots = [];
        farm.plots = [...farm.plots, ...plots.filter((plot) => plot.farmId === farm.id)];
      }
    });
    return farms;
  }

  const farmsWithPlots = puttingThePlotsInsideRespectiveFarm(filteredPlots, serviceOrder?.farms);

  const initialValues: Partial<ServiceOrder> = {
    customer: serviceOrder?.customer,
    contract: serviceOrder?.contract,
    farms: farmsWithPlots || [],
    pilots: serviceOrder?.pilots || [],
    plots: filteredPlots,
    plannedDate: serviceOrder?.plannedDate,
    observation: serviceOrder?.observation,
  };

  return (
    <FormRegisterNewServiceOrder
      isEditingServiceOrder={true}
      isUpdatingServiceOrder={isUpdatingServiceOrder}
      initialValues={initialValues}
      onSubmitOverride={handleSubmit}
      closeDialog={onSuccess}
    />
  );
}
