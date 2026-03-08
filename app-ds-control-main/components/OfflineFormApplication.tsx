import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { COLORS } from '@/constants/colors';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import DateTimePicker from '@react-native-community/datetimepicker';
import formatDateToDDMMYYYY from '@/utils/date-formatter';
import { useState, useEffect } from 'react';
import { Feather, Ionicons, Octicons } from '@expo/vector-icons';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { isAndroid } from '@/utils/isAndroid';
import Separator from './ui/Separator';
import DatePickeriOSModal from './ui/DatePickeriOSModal';
import { useRouter } from 'expo-router';
import {
  OfflineApplicationSchema,
  OfflineApplicationFormData,
} from '@/schemas/offline-application.schema';
import { getOfflineDataCache, saveOfflineApplication } from '@/utils/offline-storage';
import { OfflineApplication, OfflineDataCache } from '@/types/offline-application.type';

export default function OfflineFormApplication() {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const router = useRouter();
  const [offlineData, setOfflineData] = useState<OfflineDataCache | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    const loadOfflineData = async () => {
      setIsLoadingData(true);
      const data = await getOfflineDataCache();
      setOfflineData(data);
      setIsLoadingData(false);
    };
    loadOfflineData();
  }, []);

  const {
    control,
    setValue,
    handleSubmit,
    formState: { errors: errorsForm },
    reset,
  } = useForm<OfflineApplicationFormData>({
    resolver: zodResolver(OfflineApplicationSchema),
    mode: 'onChange',
    defaultValues: {
      pilotId: offlineData?.pilot?.id || '',
      pilotName: offlineData?.pilot?.name || '',
      date: new Date().toISOString(),
      assistantId: '',
      assistantName: '',
      droneId: '',
      droneName: '',
      cultureId: '',
      cultureName: '',
      productId: '',
      productName: '',
      hectares: '',
      flowRate: '',
      altitude: '',
      routeSpacing: '',
      dropletSize: '',
      observations: '',
    },
  });

  useEffect(() => {
    if (offlineData?.pilot) {
      setValue('pilotId', offlineData.pilot.id);
      setValue('pilotName', offlineData.pilot.name);
    }
  }, [offlineData, setValue]);

  const handleSubmitForm = handleSubmit(
    async (data) => {
      setIsSubmitting(true);
      try {
        const application: OfflineApplication = {
          localId: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          pilotId: data.pilotId,
          pilotName: data.pilotName,
          date: data.date,
          assistantId: data.assistantId,
          assistantName: data.assistantName,
          droneId: data.droneId,
          droneName: data.droneName,
          cultureId: data.cultureId,
          cultureName: data.cultureName,
          productId: data.productId,
          productName: data.productName,
          hectares: data.hectares,
          flowRate: data.flowRate,
          altitude: data.altitude,
          routeSpacing: data.routeSpacing,
          dropletSize: data.dropletSize,
          observations: data.observations || '',
          createdAt: new Date().toISOString(),
          syncStatus: 'pending',
        };

        await saveOfflineApplication(application);

        Alert.alert(
          'Sucesso',
          'Aplicação salva offline. Será sincronizada quando conectar à internet.'
        );
        reset();
        router.back();
      } catch (error) {
        Alert.alert('Erro', 'Não foi possível salvar a aplicação offline.');
      } finally {
        setIsSubmitting(false);
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

  if (isLoadingData) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <ActivityIndicator size='large' color={COLORS.blue} />
        <Text style={{ fontSize: 14, color: COLORS.gray, marginTop: 16, textAlign: 'center' }}>
          Carregando dados offline...
        </Text>
      </View>
    );
  }

  if (!offlineData || !offlineData.pilot) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Feather name='alert-circle' size={48} color={COLORS.red} />
        <Text style={{ fontSize: 16, color: COLORS.black, marginTop: 16, textAlign: 'center' }}>
          Dados offline não disponíveis.
        </Text>
        <Text style={{ fontSize: 14, color: COLORS.gray, marginTop: 8, textAlign: 'center' }}>
          Conecte-se à internet primeiro para baixar os dados necessários.
        </Text>
        <TouchableOpacity
          style={{
            backgroundColor: COLORS.blue,
            padding: 12,
            borderRadius: 8,
            marginTop: 24,
          }}
          onPress={() => router.back()}
        >
          <Text style={{ color: COLORS.white }}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
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
        <Feather name='wifi-off' size={14} color={COLORS.red} />
        <Text style={{ fontSize: 12, color: COLORS.red }}>
          Modo Offline: Esta aplicação será sincronizada quando houver conexão com a internet.
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior={isAndroid ? 'height' : 'padding'}
        style={{ flex: 1 }}
        enabled
        keyboardVerticalOffset={125}
      >
        <ScrollView style={{ flex: 1, padding: 12, backgroundColor: COLORS.white, gap: 24 }}>
          {/* PILOT NAME (READ ONLY) */}
          <View style={{ marginTop: 12 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                marginBottom: 8,
              }}
            >
              <Feather name='user' size={14} color={COLORS.blue} />
              <Text style={{ fontSize: 14, color: COLORS.black }}>Piloto</Text>
            </View>
            <View
              style={{
                backgroundColor: COLORS.lightgray,
                padding: 12,
                borderRadius: 8,
                height: 50,
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: COLORS.gray }}>{offlineData.pilot?.name || 'N/A'}</Text>
            </View>
          </View>

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
                            borderRadius: 8,
                            height: 50,
                            borderWidth: 1,
                            borderColor: isSubmitting ? COLORS.lightgray : COLORS.gray,
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
                  <SearchableSelect
                    value={field.value}
                    listedData={offlineData?.assistants || []}
                    onItemSelect={(id) => {
                      field.onChange(id);
                      const assistant = offlineData?.assistants.find((a) => a.id === id);
                      if (assistant) {
                        setValue('assistantName', assistant.name);
                      }
                    }}
                    itemKey='name'
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
                  <SearchableSelect
                    value={field.value}
                    listedData={offlineData?.drones || []}
                    onItemSelect={(id) => {
                      field.onChange(id);
                      const drone = offlineData?.drones.find((d) => d.id === id);
                      if (drone) {
                        setValue('droneName', drone.name);
                      }
                    }}
                    itemKey='name'
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
                  <SearchableSelect
                    value={field.value}
                    listedData={offlineData?.cultureTypes || []}
                    onItemSelect={(id) => {
                      field.onChange(id);
                      const culture = offlineData?.cultureTypes.find((c) => c.id === id);
                      if (culture) {
                        setValue('cultureName', culture.name);
                      }
                    }}
                    itemKey='name'
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
                  <SearchableSelect
                    value={field.value}
                    listedData={offlineData?.products || []}
                    onItemSelect={(id) => {
                      field.onChange(id);
                      const product = offlineData?.products.find((p) => p.id === id);
                      if (product) {
                        setValue('productName', product.name);
                      }
                    }}
                    itemKey='name'
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
                    placeholderTextColor={isSubmitting ? COLORS.lightgray : COLORS.gray}
                    multiline
                    numberOfLines={3}
                    value={field.value}
                    onChangeText={field.onChange}
                    style={{
                      backgroundColor: COLORS.white,
                      padding: 12,
                      borderRadius: 8,
                      borderWidth: 1,
                      height: 80,
                      borderColor: isSubmitting ? COLORS.lightgray : COLORS.gray,
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
                    placeholderTextColor={isSubmitting ? COLORS.lightgray : COLORS.gray}
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
                    style={{
                      backgroundColor: COLORS.white,
                      padding: 12,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: isSubmitting ? COLORS.lightgray : COLORS.gray,
                    }}
                    editable={!isSubmitting}
                  />
                  {errorsForm.hectares && (
                    <Text style={{ fontSize: 12, color: COLORS.red, marginTop: 4 }}>
                      {errorsForm.hectares.message}
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
                        placeholderTextColor={isSubmitting ? COLORS.lightgray : COLORS.gray}
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
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: isSubmitting ? COLORS.lightgray : COLORS.gray,
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
                        placeholderTextColor={isSubmitting ? COLORS.lightgray : COLORS.gray}
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
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: isSubmitting ? COLORS.lightgray : COLORS.gray,
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
                        placeholderTextColor={isSubmitting ? COLORS.lightgray : COLORS.gray}
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
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: isSubmitting ? COLORS.lightgray : COLORS.gray,
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
                        placeholderTextColor={isSubmitting ? COLORS.lightgray : COLORS.gray}
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
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: isSubmitting ? COLORS.lightgray : COLORS.gray,
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
                backgroundColor: COLORS.black,
                padding: 12,
                borderRadius: 8,
                opacity: isSubmitting ? 0.7 : 1,
              }}
              onPress={handleCancelButtonClick}
            >
              <Text style={{ color: COLORS.white, textAlign: 'center' }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={isSubmitting}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                backgroundColor: COLORS.green,
                padding: 12,
                borderRadius: 8,
                opacity: isSubmitting ? 0.7 : 1,
              }}
              onPress={handleSaveButtonClick}
            >
              <Ionicons name='save-outline' size={14} color={COLORS.white} />
              <Text style={{ color: COLORS.white }}>Salvar Offline</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
