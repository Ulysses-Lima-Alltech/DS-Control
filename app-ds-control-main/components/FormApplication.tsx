import {
  View,
  Text,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { COLORS } from '@/constants/colors';
import { useGetServiceOrderById } from '@/queries/service-order.query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import DateTimePicker from '@react-native-community/datetimepicker';
import formatDateToDDMMYYYY from '@/utils/date-formatter';
import { useMemo, useState, useEffect } from 'react';
import { Feather, Ionicons, Octicons } from '@expo/vector-icons';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { useGetAllAssistantsInfinite } from '@/queries/assistant.query';
import { InfiniteData, useQueryClient } from '@tanstack/react-query';
import { Assistant } from '../types/assistant.type';
import SearchableSelectQuery from '@/components/ui/SearchableSelectQuery';
import { useGetAllDronesInfinite } from '@/queries/drone.query';
import { Drone } from '@/types/drone.type';
import { CultureType } from '@/types/culture-types.type';
import { useGetAllCultureTypesInfinite } from '@/queries/culture-type.query';
import { useGetAllProductsInfinite } from '../queries/product.query';
import { Product } from '@/types/product.type';
import { isAndroid } from '@/utils/isAndroid';
import Separator from './ui/Separator';
import DatePickeriOSModal from './ui/DatePickeriOSModal';
import { FormMode } from '@/app/pilot/service-orders/form-application';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';
import {
  useRegisterNewApplication,
  useRegisterNewApplicationWithoutPlot,
  useUpdateApplicationById,
  useUpdateLooseApplicationById,
} from '@/mutations/application.mutation';
import {
  RegisterNewLooseApplicationSchema,
  UpdateApplicationByIdSchema,
  RegisterNewApplicationSchema,
  UpdateLooseApplicationSchema,
} from '@/schemas/application.schema';
import { z } from 'zod';
import { useAuth } from '@/providers/auth.provider';
import { useGetApplicationById } from '@/queries/application.query';
import { useGetAllFarmsInfinite } from '../queries/farm.query';
import { Farm } from '../types/farm.type';

interface FormApplicationProps {
  serviceOrderId: string | undefined;
  formMode: FormMode;
  applicationId: string | undefined;
}

const getSchemaByFormMode = (formMode: FormMode) => {
  switch (formMode) {
    case 'new-loose':
      return RegisterNewLooseApplicationSchema;
    case 'edit-loose':
      return UpdateLooseApplicationSchema;
    case 'edit':
      return UpdateApplicationByIdSchema;
    case 'new':
      return RegisterNewApplicationSchema;
    default:
      return RegisterNewApplicationSchema;
  }
};

type ApplicationFormData =
  | z.infer<typeof RegisterNewLooseApplicationSchema>
  | z.infer<typeof UpdateLooseApplicationSchema>
  | z.infer<typeof UpdateApplicationByIdSchema>
  | z.infer<typeof RegisterNewApplicationSchema>;

export default function FormApplication({
  serviceOrderId,
  formMode,
  applicationId,
}: FormApplicationProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [hectaresValidationError, setHectaresValidationError] = useState<string>('');
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [serviceOrderIdToFetch, setServiceOrderIdToFetch] = useState(serviceOrderId ?? '');

  const currentSchema = getSchemaByFormMode(formMode);

  const {
    data: serviceOrder,
    isFetching: isFetchingServiceOrder,
    isError: isErrorServiceOrder,
    error: errorServiceOrder,
  } = useGetServiceOrderById({
    serviceOrderId: serviceOrderIdToFetch,
    includePlots: 'true',
    includeFarms: 'true',
  });

  const {
    data: dataApplicationBeingEdited,
    isFetching: isFetchingApplicationBeingEdited,
    isError: isErrorApplicationBeingEdited,
    error: errorApplicationBeingEdited,
  } = useGetApplicationById(applicationId ?? '');

  // FORMS
  const defaultValues: ApplicationFormData = useMemo(() => {
    return {
      pilotId: user?.id ?? '',
      serviceOrderId:
        serviceOrderId ?? dataApplicationBeingEdited?.application?.serviceOrderId ?? '',
      farmId: dataApplicationBeingEdited?.application?.farmId ?? '',
      plotId: dataApplicationBeingEdited?.application?.plotId ?? '',
      assistantId: dataApplicationBeingEdited?.application?.assistantId ?? '',
      droneId: dataApplicationBeingEdited?.application?.droneId ?? '',
      cultureId: dataApplicationBeingEdited?.application?.cultureId ?? '',
      hectares: dataApplicationBeingEdited?.application?.hectares ?? '',
      date: dataApplicationBeingEdited?.application?.date ?? new Date().toISOString(),
      productId: dataApplicationBeingEdited?.application?.productId ?? '',
      flowRate: dataApplicationBeingEdited?.application?.flowRate ?? '',
      altitude: dataApplicationBeingEdited?.application?.altitude ?? '',
      routeSpacing: dataApplicationBeingEdited?.application?.routeSpacing ?? '',
      dropletSize: dataApplicationBeingEdited?.application?.dropletSize ?? '',
      observations: dataApplicationBeingEdited?.application?.observations ?? '',
    } as ApplicationFormData;
  }, [serviceOrderId, dataApplicationBeingEdited, user?.id]);

  const {
    control,
    setValue,
    handleSubmit,
    formState: { errors: errorsForm },
    watch,
    reset,
  } = useForm<ApplicationFormData>({
    resolver: zodResolver(currentSchema as any),
    mode: 'onChange',
    defaultValues: defaultValues,
  });

  useEffect(() => {
    if (applicationId && (formMode === 'edit' || formMode === 'edit-loose')) {
      setServiceOrderIdToFetch(dataApplicationBeingEdited?.application?.serviceOrderId ?? '');
    }
  }, [applicationId, dataApplicationBeingEdited, formMode]);

  useEffect(() => {
    if (
      (formMode === 'edit' || formMode === 'edit-loose') &&
      dataApplicationBeingEdited?.application
    ) {
      reset(defaultValues);
    }
  }, [dataApplicationBeingEdited, formMode, reset, defaultValues]);

  // FARM
  const [farmSearchTerm, setFarmSearchTerm] = useState('');

  const {
    data: farmsData,
    isFetching: isFetchingFarms,
    hasNextPage: hasNextPageFarms,
    isFetchingNextPage: isFetchingNextPageFarms,
    fetchNextPage: fetchNextPageFarms,
  } = useGetAllFarmsInfinite('', {
    includePlots: 'true',
    search: farmSearchTerm,
  });

  const [listedFarms, setListedFarms] = useState<Farm[]>([]);

  useEffect(() => {
    if (serviceOrder) {
      setListedFarms(serviceOrder.farms);
    } else {
      const newListedFarms: Farm[] = [
        ...(dataApplicationBeingEdited?.application?.farm
          ? [dataApplicationBeingEdited?.application.farm]
          : []),
        ...((farmsData as unknown as InfiniteData<{ data: Farm[] }>)?.pages?.flatMap(
          (page: { data: Farm[] }) => page.data
        ) || []),
        ...listedFarms,
      ].filter((farm, index, self) => self.findIndex((f) => f && f.id === farm?.id) === index);

      setListedFarms(newListedFarms);
    }
  }, [serviceOrder, farmsData, dataApplicationBeingEdited, farmSearchTerm]);

  // PLOT
  const listedPlots = useMemo(() => {
    if (serviceOrder) {
      return serviceOrder.plots
        .filter((plot) => plot.farmId === watch('farmId'))
        .filter((plot) => !plot?.deletedAt);
    }

    return (
      listedFarms
        .flatMap((farm) => farm?.plots)
        .filter((plot) => plot?.farmId === watch('farmId'))
        .filter((plot) => !plot?.deletedAt) || []
    );
  }, [listedFarms, watch('farmId'), serviceOrder]);

  // ASSISTANT
  const [assistantSearchTerm, setAssistantSearchTerm] = useState('');

  const {
    data: assistantsData,
    isFetching: isFetchingAssistants,
    hasNextPage: hasNextPageAssistants,
    isFetchingNextPage: isFetchingNextPageAssistants,
    fetchNextPage: fetchNextPageAssistants,
  } = useGetAllAssistantsInfinite({
    search: assistantSearchTerm,
  });

  const listedAssistants = [
    ...((assistantsData as unknown as InfiniteData<{ data: Assistant[] }>)?.pages?.flatMap(
      (page: { data: Assistant[] }) => page.data
    ) || []),
    ...[dataApplicationBeingEdited?.application?.assistant],
  ].filter(
    (assistant, index, self) => self.findIndex((a) => a && a.id === assistant?.id) === index
  );

  // DRONE
  const [droneSearchTerm, setDroneSearchTerm] = useState('');

  const {
    data: dronesData,
    isFetching: isFetchingDrones,
    hasNextPage: hasNextPageDrones,
    isFetchingNextPage: isFetchingNextPageDrones,
    fetchNextPage: fetchNextPageDrones,
  } = useGetAllDronesInfinite({
    search: droneSearchTerm,
  });

  const listedDrones = [
    ...((dronesData as unknown as InfiniteData<{ data: Drone[] }>)?.pages?.flatMap(
      (page: { data: Drone[] }) => page.data
    ) || []),
    ...[dataApplicationBeingEdited?.application?.drone],
  ].filter((drone, index, self) => self.findIndex((d) => d && d.id === drone?.id) === index);

  // CULTURE TYPE
  const [cultureTypeSearchTerm, setCultureTypeSearchTerm] = useState('');

  const {
    data: cultureTypesData,
    isFetching: isFetchingCultureTypes,
    hasNextPage: hasNextPageCultureTypes,
    isFetchingNextPage: isFetchingNextPageCultureTypes,
    fetchNextPage: fetchNextPageCultureTypes,
  } = useGetAllCultureTypesInfinite({
    search: cultureTypeSearchTerm,
  });

  const listedCultureTypes = [
    ...((cultureTypesData as unknown as InfiniteData<{ data: CultureType[] }>)?.pages?.flatMap(
      (page: { data: CultureType[] }) => page.data
    ) || []),
    ...[dataApplicationBeingEdited?.application?.culture],
  ].filter((culture, index, self) => self.findIndex((c) => c && c.id === culture?.id) === index);

  // PRODUCT
  const [productSearchTerm, setProductSearchTerm] = useState('');

  const {
    data: productsData,
    isFetching: isFetchingProducts,
    hasNextPage: hasNextPageProducts,
    isFetchingNextPage: isFetchingNextPageProducts,
    fetchNextPage: fetchNextPageProducts,
  } = useGetAllProductsInfinite({
    search: productSearchTerm,
  });

  const listedProducts = [
    ...((productsData as unknown as InfiniteData<{ data: Product[] }>)?.pages?.flatMap(
      (page: { data: Product[] }) => page.data
    ) || []),
    ...[dataApplicationBeingEdited?.application?.product],
  ].filter((product, index, self) => self.findIndex((p) => p && p.id === product?.id) === index);

  const invalidateApplicationCaches = (targetServiceOrderId?: string | null) => {
    const effectiveServiceOrderId =
      targetServiceOrderId ||
      serviceOrderIdToFetch ||
      serviceOrderId ||
      dataApplicationBeingEdited?.application?.serviceOrderId;

    queryClient.invalidateQueries({ queryKey: ['applications'] });
    queryClient.invalidateQueries({ queryKey: ['service-orders'] });
    queryClient.invalidateQueries({ queryKey: ['service-orders', 'my-open'] });
    queryClient.invalidateQueries({ queryKey: ['applications', 'dashboard-metrics'] });

    if (effectiveServiceOrderId) {
      queryClient.invalidateQueries({
        queryKey: ['applications', 'service-order', effectiveServiceOrderId],
      });
      queryClient.invalidateQueries({ queryKey: ['service-orders', effectiveServiceOrderId] });
    }
  };

  const { mutate: registerNewApplication, isPending: isPendingRegisterNewApplication } =
    useRegisterNewApplication({
      onSuccess: () => {
        Alert.alert('Aplicação criada com sucesso');
        reset();
        invalidateApplicationCaches();
        router.back();
      },
      onError: (error) => {
        Alert.alert('Erro ao criar aplicação', error.message);
      },
    });

  const { mutate: registerNewLooseApplication, isPending: isPendingRegisterNewLooseApplication } =
    useRegisterNewApplicationWithoutPlot({
      onSuccess: () => {
        Alert.alert('Aplicação criada com sucesso');
        reset();
        invalidateApplicationCaches();
        router.back();
      },
      onError: (error) => {
        Alert.alert('Erro ao criar aplicação', error.message);
      },
    });

  const { mutate: updateApplication, isPending: isPendingUpdateApplication } =
    useUpdateApplicationById({
      onSuccess: () => {
        Alert.alert('Aplicação atualizada com sucesso');
        reset();
        invalidateApplicationCaches();
        router.back();
      },
      onError: (error) => {
        Alert.alert('Erro ao atualizar aplicação', error.message);
      },
    });

  const { mutate: updateLooseApplication, isPending: isPendingUpdateLooseApplication } =
    useUpdateLooseApplicationById({
      onSuccess: () => {
        Alert.alert('Aplicação atualizada com sucesso');
        reset();
        invalidateApplicationCaches();
        router.back();
      },
      onError: (error) => {
        Alert.alert('Erro ao atualizar aplicação', error.message);
      },
    });

  // HANDLE SUBMIT FORM
  const handleSubmitForm = handleSubmit(
    async (data) => {
      // Edit Application Mode
      if (formMode === 'edit' && applicationId) {
        updateApplication({
          ...(data as z.infer<typeof UpdateApplicationByIdSchema>),
          id: dataApplicationBeingEdited?.application?.id ?? '',
        });
        return;
      }

      // Edit Loose Application Mode
      if (formMode === 'edit-loose' && applicationId) {
        updateLooseApplication({
          ...(data as z.infer<typeof UpdateLooseApplicationSchema>),
          id: dataApplicationBeingEdited?.application?.id ?? '',
          serviceOrderId: watch('serviceOrderId') ? watch('serviceOrderId') : null,
          farmId: watch('farmId') ? watch('farmId') : null,
          plotId: watch('plotId') ? watch('plotId') : null,
        });
        return;
      }

      // New Application Mode
      if (formMode === 'new-loose') {
        const looseData = data as z.infer<typeof RegisterNewLooseApplicationSchema>;
        registerNewLooseApplication({
          ...looseData,
          farmId: watch('farmId') ? watch('farmId') : null,
          plotId: watch('plotId') ? watch('plotId') : null,
          serviceOrderId: watch('serviceOrderId') ? watch('serviceOrderId') : null,
        });
      } else {
        const newData = data as z.infer<typeof RegisterNewApplicationSchema>;
        registerNewApplication(newData);
      }
    },
    (errors) => {
      const firstError = Object.values(errors)[0];
      const errorMessage =
        firstError?.message || 'Por favor, preencha todos os campos obrigatórios.';

      Alert.alert('Erro de Validação', errorMessage, [{ text: 'OK', style: 'default' }]);
    }
  );

  const handleCancelButtonClick = () => {
    Alert.alert(
      'Cancelar Aplicação',
      'Tem certeza que deseja cancelar? Todos os dados preenchidos serão perdidos.',
      [
        {
          text: 'Sim, cancelar',
          onPress: () => {
            router.back();
          },
          style: 'destructive',
        },
        { text: 'Continuar editando', style: 'cancel' },
      ]
    );
  };

  const handleSaveButtonClick = () => {
    Alert.alert('Salvar Aplicação', 'Confirmar o salvamento da aplicação?', [
      {
        text: 'Sim, salvar',
        onPress: () => {
          handleSubmitForm();
        },
        style: 'default',
        isPreferred: true,
      },
      { text: 'Revisar dados', style: 'cancel' },
    ]);
  };

  // ERRORS status
  const isError =
    isErrorServiceOrder ||
    ((formMode === 'edit' || formMode === 'edit-loose') && isErrorApplicationBeingEdited);
  const errors = () => {
    let errorList = [];

    if (errorServiceOrder) {
      errorList.push(errorServiceOrder);
    }

    if ((formMode === 'edit' || formMode === 'edit-loose') && errorApplicationBeingEdited) {
      errorList.push(errorApplicationBeingEdited);
    }
    return errorList;
  };

  // SUBMITTING and FETCHING status
  const isSubmitting =
    isPendingRegisterNewApplication ||
    isPendingRegisterNewLooseApplication ||
    isPendingUpdateApplication ||
    isPendingUpdateLooseApplication;
  const isLoading =
    isFetchingServiceOrder ||
    ((formMode === 'edit' || formMode === 'edit-loose') && isFetchingApplicationBeingEdited);

  if (isError) {
    return <SkeletonError errors={errors()} />;
  }

  if (isLoading) {
    return <SkeletonLoading />;
  }

  return (
    <>
      {serviceOrder?.number && (
        <View style={{ backgroundColor: COLORS.lightblue, padding: 12 }}>
          <Text style={{ fontSize: 12, color: COLORS.blue }}>
            Você está criando uma aplicação para a ordem de serviço:{' '}
            <Text style={{ fontWeight: 'bold' }}>#{serviceOrder.number}</Text>
          </Text>
        </View>
      )}

      {(formMode === 'new-loose' || formMode === 'edit-loose') && (
        <View
          style={{
            backgroundColor: COLORS.lightpink,
            padding: 16,
            paddingRight: 24,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Feather name='alert-triangle' size={14} color={COLORS.red} />
          <Text style={{ fontSize: 12, color: COLORS.red }}>
            Atenção: Você está criando uma aplicação avulsa, ela não estará vinculada a nenhuma
            ordem de serviço. Coloque nas observações o motivo.
          </Text>
        </View>
      )}

      {/* FORM */}
      <KeyboardAvoidingView
        behavior={isAndroid ? 'height' : 'padding'}
        style={{ flex: 1 }}
        enabled
        keyboardVerticalOffset={125}
      >
        <ScrollView style={{ flex: 1, padding: 12, backgroundColor: COLORS.background, gap: 24 }}>
          {/* DATE */}
          <Controller
            control={control}
            name='date'
            render={({ field }) => {
              return (
                <>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      marginBottom: 8,
                      marginTop: 12,
                    }}
                  >
                    <Feather name='calendar' size={14} color={COLORS.blue} />
                    <Text style={{ fontSize: 14, color: COLORS.black }}>Data da aplicação</Text>
                  </View>

                  {isAndroid ? (
                    <>
                      <TouchableOpacity
                        disabled={isSubmitting}
                        onPress={() => setShowDatePicker(!showDatePicker)}
                      >
                        <View
                          style={{
                            backgroundColor: COLORS.white,
                            padding: 12,
                            borderRadius: 16,
                            height: 50,
                            borderWidth: 1,
                            borderColor: isSubmitting ? COLORS.border : COLORS.borderStrong,
                            width: '100%',
                          }}
                        >
                          <Text style={{ color: isSubmitting ? COLORS.lightgray : COLORS.black }}>
                            {formatDateToDDMMYYYY(field.value)}
                          </Text>
                        </View>
                      </TouchableOpacity>
                      {showDatePicker && (
                        <DateTimePicker
                          value={new Date(field.value)}
                          mode='date'
                          display='default'
                          minimumDate={new Date(new Date().setHours(new Date().getHours() - 48))}
                          maximumDate={(() => {
                            const today = new Date();
                            today.setHours(23, 59, 59, 999);
                            return today;
                          })()}
                          textColor={COLORS.gray}
                          onChange={async (_: any, selectedDate: Date | undefined) => {
                            if (selectedDate) {
                              setValue('date', selectedDate.toISOString());
                              setShowDatePicker(false);
                            }
                          }}
                        />
                      )}
                    </>
                  ) : (
                    <DatePickeriOSModal
                      value={new Date(field.value)}
                      onDateChange={(date) => setValue('date', date.toISOString())}
                      minimumDate={new Date(new Date().setHours(new Date().getHours() - 48))}
                      maximumDate={(() => {
                        const today = new Date();
                        today.setHours(23, 59, 59, 999);
                        return today;
                      })()}
                      disabled={isSubmitting}
                    />
                  )}

                  {errorsForm.date && (
                    <Text style={{ fontSize: 12, color: COLORS.red }}>
                      {errorsForm.date.message}
                    </Text>
                  )}
                </>
              );
            }}
          />

          {/* FARM */}
          <Controller
            control={control}
            name='farmId'
            render={({ field }) => {
              return (
                <>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      marginBottom: 8,
                      marginTop: 12,
                    }}
                  >
                    <Feather name='map-pin' size={14} color={COLORS.orange} />
                    <Text style={{ fontSize: 14, color: COLORS.black }}>Fazenda</Text>
                  </View>
                  {serviceOrder ? (
                    <SearchableSelect
                      value={field.value ?? ''}
                      listedData={listedFarms}
                      onItemSelect={field.onChange}
                      itemKey='name'
                      disabled={isSubmitting}
                    />
                  ) : (
                    <SearchableSelectQuery
                      value={field.value ?? ''}
                      listedData={listedFarms}
                      onSearchChange={setFarmSearchTerm}
                      onItemSelect={field.onChange}
                      itemKey='name'
                      hasNextPage={hasNextPageFarms}
                      fetchNextPage={fetchNextPageFarms}
                      isFetchingNextPage={isFetchingNextPageFarms}
                      isFetching={isFetchingFarms}
                      disabled={isSubmitting}
                    />
                  )}
                  {(errorsForm as any).farmId && (
                    <Text style={{ fontSize: 12, color: COLORS.red, marginTop: 4 }}>
                      {(errorsForm as any).farmId.message}
                    </Text>
                  )}
                </>
              );
            }}
          />

          {/* PLOT */}
          <Controller
            control={control}
            name='plotId'
            render={({ field }) => {
              return (
                <>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      marginBottom: 8,
                      marginTop: 12,
                    }}
                  >
                    <Octicons name='stack' size={14} color={COLORS.purple} />
                    <Text style={{ fontSize: 14, color: COLORS.black }}>Talhão</Text>
                  </View>
                  <SearchableSelect
                    value={field.value ?? ''}
                    listedData={listedPlots}
                    onItemSelect={field.onChange}
                    itemKey='name'
                    disabled={isSubmitting}
                  />
                  {(errorsForm as any).plotId && (
                    <Text style={{ fontSize: 12, color: COLORS.red, marginTop: 4 }}>
                      {(errorsForm as any).plotId.message}
                    </Text>
                  )}
                </>
              );
            }}
          />

          {/* Assistant */}
          <Controller
            control={control}
            name='assistantId'
            render={({ field }) => {
              return (
                <>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      marginBottom: 8,
                      marginTop: 12,
                    }}
                  >
                    <Feather name='user' size={14} color={COLORS.green} />
                    <Text style={{ fontSize: 14, color: COLORS.black }}>Ajudante</Text>
                  </View>
                  <SearchableSelectQuery
                    value={field.value ?? undefined}
                    listedData={listedAssistants}
                    onSearchChange={setAssistantSearchTerm}
                    onItemSelect={field.onChange}
                    itemKey='name'
                    hasNextPage={hasNextPageAssistants}
                    fetchNextPage={fetchNextPageAssistants}
                    isFetchingNextPage={isFetchingNextPageAssistants}
                    isFetching={isFetchingAssistants}
                    disabled={isSubmitting}
                  />
                  {errorsForm.assistantId && (
                    <Text style={{ fontSize: 12, color: COLORS.red, marginTop: 4 }}>
                      {errorsForm.assistantId.message}
                    </Text>
                  )}
                </>
              );
            }}
          />

          {/* Drone */}
          <Controller
            control={control}
            name='droneId'
            render={({ field }) => {
              return (
                <>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      marginBottom: 8,
                      marginTop: 12,
                    }}
                  >
                    <Feather name='settings' size={14} color={COLORS.purple} />
                    <Text style={{ fontSize: 14, color: COLORS.black }}>Drone</Text>
                  </View>
                  <SearchableSelectQuery
                    value={field.value ?? ''}
                    listedData={listedDrones}
                    onSearchChange={setDroneSearchTerm}
                    onItemSelect={field.onChange}
                    itemKey='name'
                    hasNextPage={hasNextPageDrones}
                    fetchNextPage={fetchNextPageDrones}
                    isFetchingNextPage={isFetchingNextPageDrones}
                    isFetching={isFetchingDrones}
                    disabled={isSubmitting}
                  />
                  {errorsForm.droneId && (
                    <Text style={{ fontSize: 12, color: COLORS.red, marginTop: 4 }}>
                      {errorsForm.droneId.message}
                    </Text>
                  )}
                </>
              );
            }}
          />

          {/* CULTURE TYPE */}
          <Controller
            control={control}
            name='cultureId'
            render={({ field }) => {
              return (
                <>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      marginBottom: 8,
                      marginTop: 12,
                    }}
                  >
                    <Octicons name='stack' size={14} color={COLORS.green} />
                    <Text style={{ fontSize: 14, color: COLORS.black }}>Cultivo</Text>
                  </View>
                  <SearchableSelectQuery
                    value={field.value ?? ''}
                    listedData={listedCultureTypes}
                    onSearchChange={setCultureTypeSearchTerm}
                    onItemSelect={field.onChange}
                    itemKey='name'
                    hasNextPage={hasNextPageCultureTypes}
                    fetchNextPage={fetchNextPageCultureTypes}
                    isFetchingNextPage={isFetchingNextPageCultureTypes}
                    isFetching={isFetchingCultureTypes}
                    disabled={isSubmitting}
                  />
                  {errorsForm.cultureId && (
                    <Text style={{ fontSize: 12, color: COLORS.red, marginTop: 4 }}>
                      {errorsForm.cultureId.message}
                    </Text>
                  )}
                </>
              );
            }}
          />

          {/* PRODUCT */}
          <Controller
            control={control}
            name='productId'
            render={({ field }) => {
              return (
                <>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      marginBottom: 8,
                      marginTop: 12,
                    }}
                  >
                    <Feather name='target' size={14} color={COLORS.red} />
                    <Text style={{ fontSize: 14, color: COLORS.black }}>Tipo de aplicação</Text>
                  </View>
                  <SearchableSelectQuery
                    value={field.value}
                    listedData={listedProducts}
                    onSearchChange={setProductSearchTerm}
                    onItemSelect={field.onChange}
                    itemKey='name'
                    hasNextPage={hasNextPageProducts}
                    fetchNextPage={fetchNextPageProducts}
                    isFetchingNextPage={isFetchingNextPageProducts}
                    isFetching={isFetchingProducts}
                    disabled={isSubmitting}
                  />
                  {errorsForm.productId && (
                    <Text style={{ fontSize: 12, color: COLORS.red, marginTop: 4 }}>
                      {errorsForm.productId.message}
                    </Text>
                  )}
                </>
              );
            }}
          />

          {/* OBSERVAÇÕES */}
          <Controller
            control={control}
            name='observations'
            render={({ field }) => {
              return (
                <>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      marginBottom: 8,
                      marginTop: 12,
                    }}
                  >
                    <Ionicons name='chatbox-outline' size={14} color={COLORS.red} />
                    <Text style={{ fontSize: 14, color: COLORS.black }}>Observações</Text>
                  </View>
                  <TextInput
                    placeholder='Digite suas observações...'
                    placeholderTextColor={COLORS.textMuted}
                    multiline
                    numberOfLines={3}
                    value={field.value ?? ''}
                    onChangeText={field.onChange}
                    style={{
                      backgroundColor: COLORS.white,
                      padding: 12,
                      borderRadius: 16,
                      borderWidth: 1,
                      height: 80,
                      borderColor: isSubmitting ? COLORS.border : COLORS.borderStrong,
                    }}
                    editable={!isSubmitting}
                  />
                  {errorsForm.observations && (
                    <Text style={{ fontSize: 12, color: COLORS.red, marginTop: 4 }}>
                      {errorsForm.observations.message}
                    </Text>
                  )}
                </>
              );
            }}
          />

          {/* HECTARES */}
          <Controller
            control={control}
            name='hectares'
            render={({ field }) => {
              return (
                <>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      marginBottom: 8,
                      marginTop: 12,
                    }}
                  >
                    <Octicons name='stack' size={14} color={COLORS.blue} />
                    <Text style={{ fontSize: 14, color: COLORS.black }}>Hectares (ha)</Text>
                  </View>
                  <TextInput
                    placeholder='0.00'
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType='numeric'
                    value={field.value}
                    onChangeText={(text) => {
                      const numericText = text.replace(/[^0-9]/g, '');
                      if (numericText === '') {
                        field.onChange('');
                        return;
                      }
                      const decimalValue = (parseInt(numericText) / 100).toFixed(2);
                      field.onChange(decimalValue);
                    }}
                    onBlur={() => {
                      const selectedPlotId = watch('plotId');
                      const inputHectares = parseFloat(field.value);

                      if (selectedPlotId && !isNaN(inputHectares)) {
                        const selectedPlot = listedPlots.find(
                          (plot) => plot?.id === selectedPlotId
                        );

                        if (selectedPlot && selectedPlot.hectare) {
                          const plotHectares = parseFloat(selectedPlot.hectare);
                          const tolerance = plotHectares * 0.2;
                          const minAllowed = plotHectares - tolerance;
                          const maxAllowed = plotHectares + tolerance;

                          if (inputHectares < minAllowed || inputHectares > maxAllowed) {
                            setHectaresValidationError(
                              `Atenção: O valor informado está muito diferente do talhão "${selectedPlot.name}" (${selectedPlot.hectare} ha). Verifique se está correto.`
                            );
                          } else {
                            setHectaresValidationError('');
                          }
                        }
                      } else {
                        setHectaresValidationError('');
                      }
                    }}
                    style={{
                      backgroundColor: COLORS.white,
                      padding: 12,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: isSubmitting ? COLORS.border : COLORS.borderStrong,
                    }}
                    editable={!isSubmitting}
                  />
                  {errorsForm.hectares && (
                    <Text style={{ fontSize: 12, color: COLORS.red, marginTop: 4 }}>
                      {errorsForm.hectares.message}
                    </Text>
                  )}
                  {hectaresValidationError && (
                    <Text style={{ fontSize: 12, color: COLORS.red, marginTop: 4 }}>
                      {hectaresValidationError}
                    </Text>
                  )}
                </>
              );
            }}
          />

          <View
            style={{
              flexDirection: 'row',
              gap: 18,
              marginTop: 12,
              width: '100%',
            }}
          >
            {/* VAZÃO */}
            <Controller
              control={control}
              name='flowRate'
              render={({ field }) => {
                return (
                  <>
                    <View
                      style={{
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        gap: 4,
                        flex: 1,
                      }}
                    >
                      <Text style={{ fontSize: 14, color: COLORS.black }}>Vazão (L/ha)</Text>
                      <TextInput
                        placeholderTextColor={COLORS.textMuted}
                        keyboardType='numeric'
                        placeholder='0.00'
                        value={field.value}
                        onChangeText={(text) => {
                          const numericText = text.replace(/[^0-9]/g, '');
                          if (numericText === '') {
                            field.onChange('');
                            return;
                          }
                          const decimalValue = (parseInt(numericText) / 100).toFixed(2);
                          field.onChange(decimalValue);
                        }}
                        style={{
                          backgroundColor: COLORS.white,
                          padding: 12,
                          borderRadius: 16,
                          borderWidth: 1,
                          borderColor: isSubmitting ? COLORS.border : COLORS.borderStrong,
                          width: '100%',
                        }}
                        editable={!isSubmitting}
                      />
                      {errorsForm.flowRate && (
                        <Text style={{ fontSize: 12, color: COLORS.red, marginTop: 4 }}>
                          {errorsForm.flowRate.message}
                        </Text>
                      )}
                    </View>
                  </>
                );
              }}
            />

            {/* Altitude de voo */}
            <Controller
              control={control}
              name='altitude'
              render={({ field }) => {
                return (
                  <>
                    <View
                      style={{
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        gap: 4,
                        flex: 1,
                      }}
                    >
                      <Text style={{ fontSize: 14, color: COLORS.black }}>Altitude de voo (m)</Text>
                      <TextInput
                        placeholderTextColor={COLORS.textMuted}
                        keyboardType='numeric'
                        placeholder='0.00'
                        value={field.value}
                        onChangeText={(text) => {
                          const numericText = text.replace(/[^0-9]/g, '');
                          if (numericText === '') {
                            field.onChange('');
                            return;
                          }
                          const decimalValue = (parseInt(numericText) / 100).toFixed(2);
                          field.onChange(decimalValue);
                        }}
                        style={{
                          backgroundColor: COLORS.white,
                          padding: 12,
                          borderRadius: 16,
                          borderWidth: 1,
                          borderColor: isSubmitting ? COLORS.border : COLORS.borderStrong,
                          width: '100%',
                        }}
                        editable={!isSubmitting}
                      />
                      {errorsForm.altitude && (
                        <Text style={{ fontSize: 12, color: COLORS.red, marginTop: 4 }}>
                          {errorsForm.altitude.message}
                        </Text>
                      )}
                    </View>
                  </>
                );
              }}
            />
          </View>

          <View
            style={{
              flexDirection: 'row',
              gap: 18,
              marginTop: 12,
              width: '100%',
              marginBottom: 12,
            }}
          >
            {/* Espaçamento de rota */}
            <Controller
              control={control}
              name='routeSpacing'
              render={({ field }) => {
                return (
                  <>
                    <View
                      style={{
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        gap: 4,
                        flex: 1,
                      }}
                    >
                      <Text style={{ fontSize: 14, color: COLORS.black }}>
                        Espaçamento de rota (m)
                      </Text>
                      <TextInput
                        placeholderTextColor={COLORS.textMuted}
                        keyboardType='numeric'
                        placeholder='0.00'
                        value={field.value}
                        onChangeText={(text) => {
                          const numericText = text.replace(/[^0-9]/g, '');
                          if (numericText === '') {
                            field.onChange('');
                            return;
                          }
                          const decimalValue = (parseInt(numericText) / 100).toFixed(2);
                          field.onChange(decimalValue);
                        }}
                        style={{
                          backgroundColor: COLORS.white,
                          padding: 12,
                          borderRadius: 16,
                          borderWidth: 1,
                          borderColor: isSubmitting ? COLORS.border : COLORS.borderStrong,
                          width: '100%',
                        }}
                        editable={!isSubmitting}
                      />
                      {errorsForm.routeSpacing && (
                        <Text style={{ fontSize: 12, color: COLORS.red, marginTop: 4 }}>
                          {errorsForm.routeSpacing.message}
                        </Text>
                      )}
                    </View>
                  </>
                );
              }}
            />

            {/* Tamanho de gota */}
            <Controller
              control={control}
              name='dropletSize'
              render={({ field }) => {
                return (
                  <>
                    <View
                      style={{
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        gap: 4,
                        flex: 1,
                      }}
                    >
                      <Text style={{ fontSize: 14, color: COLORS.black }}>
                        Tamanho de gota (µm)
                      </Text>
                      <TextInput
                        placeholderTextColor={COLORS.textMuted}
                        keyboardType='numeric'
                        placeholder='0.00'
                        value={field.value}
                        onChangeText={(text) => {
                          const numericText = text.replace(/[^0-9]/g, '');
                          if (numericText === '') {
                            field.onChange('');
                            return;
                          }
                          const decimalValue = (parseInt(numericText) / 100).toFixed(2);
                          field.onChange(decimalValue);
                        }}
                        style={{
                          backgroundColor: COLORS.white,
                          padding: 12,
                          borderRadius: 16,
                          borderWidth: 1,
                          borderColor: isSubmitting ? COLORS.border : COLORS.borderStrong,
                          width: '100%',
                        }}
                        editable={!isSubmitting}
                      />
                      {errorsForm.dropletSize && (
                        <Text style={{ fontSize: 12, color: COLORS.red, marginTop: 4 }}>
                          {errorsForm.dropletSize.message}
                        </Text>
                      )}
                    </View>
                  </>
                );
              }}
            />
          </View>

          <Separator color={COLORS.lightgray} lineWidth={1} />
          {/* BUTTONS */}
          <View
            style={{
              flexDirection: 'row',
              gap: 12,
              width: '100%',
              marginTop: 12,
              marginBottom: 12,
            }}
          >
            <TouchableOpacity
              disabled={isSubmitting}
              style={{
                flex: 1,
                backgroundColor: COLORS.surface,
                padding: 12,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: COLORS.primary,
                opacity: isSubmitting ? 0.7 : 1,
              }}
              onPress={handleCancelButtonClick}
            >
              <Text style={{ color: COLORS.primaryDark, textAlign: 'center', fontWeight: '700' }}>
                Cancelar
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={isSubmitting}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                backgroundColor: COLORS.primary,
                padding: 12,
                borderRadius: 16,
                opacity: isSubmitting ? 0.7 : 1,
              }}
              onPress={handleSaveButtonClick}
            >
              <Ionicons name='save-outline' size={14} color={COLORS.white} />
              <Text style={{ color: COLORS.white, fontWeight: '700' }}>Salvar Aplicação</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const SkeletonError = ({ errors }: { errors: Error[] | null }) => {
  return (
    <View style={{ flex: 1, padding: 12, backgroundColor: COLORS.white }}>
      <Text style={{ fontSize: 12, color: COLORS.red }}>Erro ao buscar a ordem de serviço</Text>
      {errors?.map((error) => (
        <Text style={{ fontSize: 12, color: COLORS.red }}>
          {error?.message ?? 'Erro desconhecido'}
        </Text>
      ))}
    </View>
  );
};

const SkeletonLoading = () => {
  return (
    <View
      style={{
        flex: 1,
        padding: 12,
        backgroundColor: COLORS.white,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <ActivityIndicator size='large' color={COLORS.primary} />
    </View>
  );
};
