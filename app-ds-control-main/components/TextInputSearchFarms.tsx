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
import { RefObject, useRef, useState } from 'react';
import { InfiniteData } from '@tanstack/react-query';
import { Farm } from '../types/farm.type';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import debounce from 'lodash/debounce';

interface TextInputSearchFarmsProps {
  placeholder?: string;
  onFarmSelect?: (farmId: string | null) => void;
  customerId?: string;
}

export default function TextInputSearchFarms({
  placeholder = 'Buscar fazenda... ',
  onFarmSelect,
  customerId,
}: TextInputSearchFarmsProps) {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isFarmsListVisible, setIsFarmsListVisible] = useState<boolean>(false);
  const inputRef = useRef<TextInput>(null);

  const { data, hasNextPage, fetchNextPage, isFetchingNextPage, isFetching } =
    useGetAllFarmsInfinite(
      customerId ?? undefined,
      {
        search: searchTerm,
        includeCustomer: 'true',
        includePlots: 'true',
        includeGeoJson: 'false',
      },
      { enabled: searchTerm.trim().length > 0 }
    );

  const listedFarms =
    (data as unknown as InfiniteData<{ data: Farm[] }>)?.pages?.flatMap((page) => page.data) || [];

  const onFarmPress = (farmId: string) => {
    onFarmSelect?.(farmId);
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
              {listedFarms.map((farm) => (
                <TouchableOpacity
                  key={farm.id}
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
                    {farm.name}
                  </Text>
                  <Text style={{ color: 'gray', fontSize: 10 }}>{farm.customer.name}</Text>
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
