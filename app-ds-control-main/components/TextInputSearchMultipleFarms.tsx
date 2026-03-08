import TextInputSearch from '@/components/ui/TextInputSearch';
import {
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
} from 'react-native';
import { useGetAllFarmsInfinite } from '@/queries/farm.query';
import { RefObject, useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { InfiniteData } from '@tanstack/react-query';
import { Farm } from '../types/farm.type';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import debounce from 'lodash/debounce';

interface TextInputSearchMultipleFarmsProps {
  placeholder?: string;
  onFarmsSelect?: (farms: Farm[]) => void;
  customerId?: string;
}

export default function TextInputSearchMultipleFarms({
  placeholder = 'Buscar fazenda... ',
  onFarmsSelect,
  customerId,
}: TextInputSearchMultipleFarmsProps) {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isFarmsListVisible, setIsFarmsListVisible] = useState<boolean>(false);
  const [selectedFarms, setSelectedFarms] = useState<Farm[]>([]);
  const [isSelectAllActive, setIsSelectAllActive] = useState<boolean>(false);
  const [hideListTimeout, setHideListTimeout] = useState<NodeJS.Timeout | null>(null);
  const inputRef = useRef<TextInput>(null);

  const queryLimit = isSelectAllActive ? '5' : '10';

  const {
    data: infiniteData,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    isFetching: isFetchingInfinite,
  } = useGetAllFarmsInfinite(
    customerId ?? undefined,
    {
      search: searchTerm,
      includeCustomer: 'true',
      includePlots: 'true',
      includeGeoJson: 'true',
      limit: queryLimit,
    },
    { enabled: isFarmsListVisible }
  );

  const queriedFarms = useMemo(() => {
    return (
      (infiniteData as unknown as InfiniteData<{ data: Farm[] }>)?.pages?.flatMap(
        (page) => page.data
      ) || []
    );
  }, [infiniteData]);

  const listedFarms = useMemo(() => {
    const selectedFarmIds = new Set(selectedFarms.map((f) => f.id));
    const unselectedFarms = queriedFarms.filter((farm) => !selectedFarmIds.has(farm.id));
    return [...selectedFarms, ...unselectedFarms];
  }, [selectedFarms, queriedFarms]);

  const isFarmSelected = useCallback(
    (farmId: string) => {
      return selectedFarms.some((f) => f.id === farmId);
    },
    [selectedFarms]
  );

  const toggleFarmSelection = useCallback(
    (farm: Farm) => {
      setSelectedFarms((prev) => {
        const isCurrentlySelected = prev.some((f) => f.id === farm.id);
        let newSelection: Farm[];

        if (isCurrentlySelected) {
          newSelection = prev.filter((f) => f.id !== farm.id);
          if (isSelectAllActive) {
            setIsSelectAllActive(false);
          }
        } else {
          newSelection = [...prev, farm];
        }

        return newSelection;
      });

      scheduleHideList();
    },
    [isSelectAllActive]
  );

  const toggleSelectAll = useCallback(() => {
    if (isSelectAllActive) {
      setIsSelectAllActive(false);
      setSelectedFarms([]);
    } else {
      setIsSelectAllActive(true);
      setSelectedFarms(queriedFarms);
    }

    scheduleHideList();
  }, [isSelectAllActive, queriedFarms]);

  useEffect(() => {
    if (isSelectAllActive && queriedFarms.length > 0) {
      setSelectedFarms((prev) => {
        const existingIds = new Set(prev.map((f) => f.id));
        const newFarms = queriedFarms.filter((farm) => !existingIds.has(farm.id));
        return [...prev, ...newFarms];
      });
    }
  }, [isSelectAllActive, queriedFarms]);

  useEffect(() => {
    if (isSelectAllActive && hasNextPage && !isFetchingNextPage && !isFetchingInfinite) {
      const timer = setTimeout(() => {
        fetchNextPage();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isSelectAllActive, hasNextPage, isFetchingNextPage, isFetchingInfinite, fetchNextPage]);

  const prevSelectedFarmsRef = useRef<Farm[]>([]);
  useEffect(() => {
    const selectedIds = selectedFarms
      .map((f) => f.id)
      .sort()
      .join(',');
    const prevIds = prevSelectedFarmsRef.current
      .map((f) => f.id)
      .sort()
      .join(',');

    if (selectedIds !== prevIds) {
      onFarmsSelect?.(selectedFarms);
      prevSelectedFarmsRef.current = selectedFarms;
    }
  }, [selectedFarms, onFarmsSelect]);

  const scheduleHideList = () => {
    if (hideListTimeout) {
      clearTimeout(hideListTimeout);
    }
    const timeout = setTimeout(() => {
      setIsFarmsListVisible(false);
    }, 500);
    // @ts-ignore
    setHideListTimeout(timeout);
  };

  useEffect(() => {
    return () => {
      if (hideListTimeout) {
        clearTimeout(hideListTimeout);
      }
    };
  }, [hideListTimeout]);

  const handleSearchChange = debounce((text: string) => {
    setSearchTerm(text);
  }, 500);

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
        onChangeText={(text) => {
          handleSearchChange(text);
          setIsFarmsListVisible(true);
        }}
        onFocus={() => {
          setIsFarmsListVisible(true);
          if (hideListTimeout) {
            clearTimeout(hideListTimeout);
            setHideListTimeout(null);
          }
        }}
      />
      {isFarmsListVisible && (
        <ScrollView
          style={{
            backgroundColor: 'white',
            maxHeight: 250,
            paddingHorizontal: 10,
            borderWidth: 1,
            borderColor: 'gray',
            borderRadius: 10,
            marginTop: 4,
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
          <TouchableOpacity
            style={{
              backgroundColor: '#f5f5f5',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              height: 40,
              width: '100%',
              paddingHorizontal: 8,
              marginVertical: 4,
              borderRadius: 5,
            }}
            onPress={toggleSelectAll}
          >
            <Text
              style={{
                color: 'black',
                fontSize: 14,
                fontWeight: 'bold',
              }}
            >
              Mostra todas as fazendas
            </Text>
            <MaterialCommunityIcons
              name={isSelectAllActive ? 'checkbox-marked' : 'checkbox-blank-outline'}
              size={24}
              color={isSelectAllActive ? '#4CAF50' : 'gray'}
            />
          </TouchableOpacity>

          {isFetchingInfinite && !isFetchingNextPage && queriedFarms.length === 0 && (
            <View style={{ paddingVertical: 10, alignItems: 'center', backgroundColor: 'white' }}>
              <ActivityIndicator size='small' color='gray' />
            </View>
          )}

          {listedFarms.length === 0 && !isFetchingInfinite ? (
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
              {listedFarms.map((farm) => (
                <TouchableOpacity
                  key={farm.id}
                  style={{
                    backgroundColor: isFarmSelected(farm.id) ? '#e8f5e9' : 'white',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    height: 40,
                    width: '100%',
                    paddingHorizontal: 8,
                    borderRadius: 5,
                    marginVertical: 2,
                  }}
                  onPress={() => toggleFarmSelection(farm)}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: 'black',
                        fontSize: 14,
                      }}
                      numberOfLines={1}
                    >
                      {farm.name}
                    </Text>
                    <Text style={{ color: 'gray', fontSize: 10 }}>{farm.customer.name}</Text>
                  </View>
                  <MaterialCommunityIcons
                    name={isFarmSelected(farm.id) ? 'checkbox-marked' : 'checkbox-blank-outline'}
                    size={24}
                    color={isFarmSelected(farm.id) ? '#4CAF50' : 'gray'}
                  />
                </TouchableOpacity>
              ))}

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
