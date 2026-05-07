import { MaterialCommunityIcons } from '@expo/vector-icons';
import { InfiniteData } from '@tanstack/react-query';
import debounce from 'lodash/debounce';
import { RefObject, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import TextInputSearch from '@/components/ui/TextInputSearch';
import { useGetAllFarmsInfinite } from '@/queries/farm.query';
import { Farm } from '@/types/farm.type';

interface TextInputSearchFarmsProps {
  placeholder?: string;
  onFarmSelect?: (farmId: string | null) => void;
  customerId?: string;
}

type FarmLike = Partial<Farm> & {
  id?: unknown;
  name?: unknown;
  customer?: {
    id?: unknown;
    name?: unknown;
  } | null;
  plots?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

const normalizeFarm = (farm: FarmLike | null | undefined): Farm | null => {
  if (!farm || typeof farm !== 'object') return null;

  const normalizedId = farm.id == null ? '' : String(farm.id);
  if (!normalizedId) return null;

  return {
    id: normalizedId,
    name: typeof farm.name === 'string' && farm.name.trim() ? farm.name : 'Fazenda sem nome',
    customer: {
      id: farm.customer?.id == null || farm.customer?.id === '' ? '-' : String(farm.customer.id),
      name:
        typeof farm.customer?.name === 'string' && farm.customer.name.trim()
          ? farm.customer.name
          : '-',
    },
    plots: Array.isArray(farm.plots) ? farm.plots : [],
    createdAt: typeof farm.createdAt === 'string' ? farm.createdAt : '',
    updatedAt: typeof farm.updatedAt === 'string' ? farm.updatedAt : '',
  };
};

export default function TextInputSearchFarms({
  placeholder = 'Buscar fazenda... ',
  onFarmSelect,
  customerId,
}: TextInputSearchFarmsProps) {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isFarmsListVisible, setIsFarmsListVisible] = useState<boolean>(false);
  const inputRef = useRef<TextInput>(null);

  const {
    data,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    isFetching,
    isError: isFarmsError,
    error: farmsError,
  } = useGetAllFarmsInfinite(
    customerId ?? undefined,
    {
      search: searchTerm,
      includeCustomer: 'true',
      includePlots: 'true',
      includeGeoJson: 'false',
    },
    { enabled: searchTerm.trim().length > 0 }
  );

  const listedFarms = ((data as unknown as InfiniteData<{ data?: unknown }>)?.pages?.flatMap(
    (page) => {
      const farms = Array.isArray(page?.data) ? page.data : [];
      return farms
        .map((farm) => normalizeFarm(farm as FarmLike))
        .filter((farm): farm is Farm => Boolean(farm));
    }
  ) || []) as Farm[];

  const onFarmPress = (farmId: string | null | undefined) => {
    const normalizedFarmId = farmId == null ? null : String(farmId);
    onFarmSelect?.(normalizedFarmId);
    setIsFarmsListVisible(false);
  };

  return (
    <View
      style={{
        position: 'absolute',
        top: 12,
        width: '90%',
        marginHorizontal: '5%',
        zIndex: 10,
        flexDirection: 'column',
      }}
    >
      <TextInputSearch
        ref={inputRef as RefObject<TextInput>}
        placeholder={placeholder}
        style={{
          backgroundColor: 'white',
          shadowColor: 'black',
          height: 50,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: 'gray',
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 15,
        }}
        onChangeText={debounce((text) => {
          setSearchTerm(text);
        }, 500)}
        onFocus={() => {
          setIsFarmsListVisible(true);
        }}
      />
      {searchTerm.trim().length > 0 && isFarmsListVisible && (
        <ScrollView
          style={{
            backgroundColor: 'white',
            maxHeight: 250,
            paddingHorizontal: 10,
            borderWidth: 1,
            borderColor: 'gray',
            borderRadius: 10,
          }}
          showsVerticalScrollIndicator={true}
          onScroll={({ nativeEvent }) => {
            const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
            const isCloseToBottom =
              layoutMeasurement.height + contentOffset.y >= contentSize.height - 20;

            if (isCloseToBottom && hasNextPage && !isFetchingNextPage) {
              fetchNextPage();
            }
          }}
          onMomentumScrollEnd={({ nativeEvent }) => {
            const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
            const isAtBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 5;

            if (isAtBottom && hasNextPage && !isFetchingNextPage) {
              fetchNextPage();
            }
          }}
          scrollEventThrottle={200}
        >
          {isFetching && !isFetchingNextPage && (
            <View style={{ paddingVertical: 10, alignItems: 'center', backgroundColor: 'white' }}>
              <ActivityIndicator size='small' color='gray' />
            </View>
          )}
          {listedFarms.length === 0 && !isFetching ? (
            <View
              style={{
                justifyContent: 'center',
                alignItems: 'center',
                height: 80,
                width: '100%',
              }}
            >
              <MaterialCommunityIcons name='magnify' size={24} color='gray' />
              <Text style={{ color: 'gray', fontSize: 14 }}>Nenhuma fazenda encontrada</Text>
            </View>
          ) : (
            <>
              {listedFarms.map((farm, index) => (
                <TouchableOpacity
                  key={String(farm?.id ?? farm?.customer?.id ?? index)}
                  style={{
                    backgroundColor: 'white',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    height: 36,
                    width: '100%',
                  }}
                  onPress={() => onFarmPress(farm.id)}
                >
                  <Text
                    style={{
                      color: 'black',
                      textOverflow: 'ellipsis',
                      fontSize: 14,
                    }}
                  >
                    {farm?.name ?? 'Fazenda sem nome'}
                  </Text>
                  <Text style={{ color: 'gray', fontSize: 10 }}>{farm?.customer?.name ?? '-'}</Text>
                </TouchableOpacity>
              ))}
              {isFarmsError && (
                <View
                  style={{ paddingVertical: 10, alignItems: 'center', backgroundColor: 'white' }}
                >
                  <Text style={{ color: '#c62828', fontSize: 12, textAlign: 'center' }}>
                    {farmsError?.message || 'Nao foi possivel carregar as fazendas.'}
                  </Text>
                </View>
              )}
              {isFetchingNextPage && (
                <View
                  style={{ paddingVertical: 10, alignItems: 'center', backgroundColor: 'white' }}
                >
                  <ActivityIndicator size='small' color='gray' />
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}
