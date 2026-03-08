import TextInputSearch from '@/components/ui/TextInputSearch';
import {
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Modal,
  Pressable,
} from 'react-native';
import { RefObject, useRef, useState } from 'react';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import debounce from 'lodash/debounce';
import { COLORS } from '../../constants/colors';

interface SearchableSelectQueryProps {
  placeholder?: string;
  onItemSelect?: (itemId: string) => void;
  listedData: any[];
  hasNextPage?: boolean;
  fetchNextPage?: () => void;
  isFetchingNextPage?: boolean;
  isFetching?: boolean;
  itemKey: string;
  onSearchChange?: (text: string) => void;
  disabled?: boolean;
  value?: string;
}

export default function SearchableSelectQuery({
  placeholder = 'Buscar... ',
  onItemSelect,
  listedData,
  hasNextPage,
  fetchNextPage,
  isFetchingNextPage,
  isFetching,
  itemKey,
  onSearchChange,
  disabled = false,
  value,
}: SearchableSelectQueryProps) {
  const [isListVisible, setIsListVisible] = useState<boolean>(false);
  const inputRef = useRef<TextInput>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef<View>(null);

  const selectedItem = value ? listedData.find((item) => item.id === value) : null;

  const onSearchTermChange = (text: string) => {
    onSearchChange?.(text);
  };

  const onItemPress = (itemId: string) => {
    onItemSelect?.(itemId);
    setIsListVisible(false);
  };

  const measureContainer = () => {
    if (containerRef.current) {
      containerRef.current.measure((x, y, width, height, pageX, pageY) => {
        setDropdownPosition({
          top: pageY + height,
          left: pageX,
          width: width,
        });
      });
    }
  };

  const handleToggleDropdown = () => {
    if (!isListVisible) {
      measureContainer();
    }
    setIsListVisible(!isListVisible);
  };

  const handleCloseDropdown = () => {
    setIsListVisible(false);
  };

  return (
    <>
      <View
        ref={containerRef}
        style={{
          width: '100%',
          flexDirection: 'column',
        }}
      >
        <TouchableOpacity
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            justifyContent: 'space-between',
            borderWidth: 1,
            height: 50,
            borderColor: disabled ? COLORS.lightgray : COLORS.gray,
            borderRadius: 10,
            paddingHorizontal: 15,
            paddingVertical: 10,
          }}
          onPress={handleToggleDropdown}
          disabled={disabled}
        >
          <Text
            style={{
              fontSize: 14,
              color: disabled ? COLORS.lightgray : selectedItem ? COLORS.black : COLORS.gray,
            }}
          >
            {selectedItem ? selectedItem[itemKey] : placeholder}
          </Text>
          <Feather
            name='chevron-down'
            size={20}
            color={disabled ? COLORS.lightgray : COLORS.gray}
          />
        </TouchableOpacity>
      </View>

      <Modal
        visible={isListVisible}
        transparent={true}
        animationType='fade'
        onRequestClose={handleCloseDropdown}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
          }}
          onPress={handleCloseDropdown}
        >
          <View
            style={{
              position: 'absolute',
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              width: dropdownPosition.width,
              backgroundColor: COLORS.white,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: COLORS.gray,
              shadowColor: '#000',
              shadowOffset: {
                width: 0,
                height: 2,
              },
              shadowOpacity: 0.25,
              shadowRadius: 3.84,
              elevation: 5,
              maxHeight: 250,
              zIndex: 1000,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                borderBottomWidth: 1,
                borderBottomColor: COLORS.gray,
              }}
            >
              <TextInputSearch
                ref={inputRef as RefObject<TextInput>}
                placeholder={placeholder}
                style={{
                  backgroundColor: COLORS.white,
                  height: 50,
                  borderTopLeftRadius: 10,
                  borderBottomLeftRadius: 10,
                  borderTopRightRadius: 0,
                  borderBottomRightRadius: 0,
                  borderTopWidth: 0,
                  borderBottomWidth: 0,
                  borderLeftWidth: 0,
                  borderRightWidth: 0,
                  borderColor: COLORS.gray,
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 15,
                }}
                onChangeText={debounce(onSearchTermChange, 500)}
                onFocus={() => {
                  setIsListVisible(true);
                }}
              />
              <TouchableOpacity
                style={{
                  width: 50,
                  height: 50,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: COLORS.white,
                  borderTopRightRadius: 10,
                  borderBottomRightRadius: 10,
                  borderTopLeftRadius: 0,
                  borderBottomLeftRadius: 0,
                }}
                onPress={() => {
                  setIsListVisible(false);
                }}
              >
                <Feather name='x' size={20} color={COLORS.gray} />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={{
                maxHeight: 200,
              }}
              showsVerticalScrollIndicator={true}
              onScroll={({ nativeEvent }) => {
                const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
                const isCloseToBottom =
                  layoutMeasurement.height + contentOffset.y >= contentSize.height - 20;

                if (isCloseToBottom && hasNextPage && !isFetchingNextPage && fetchNextPage) {
                  fetchNextPage();
                }
              }}
              onMomentumScrollEnd={({ nativeEvent }) => {
                const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
                const isAtBottom =
                  layoutMeasurement.height + contentOffset.y >= contentSize.height - 5;

                if (isAtBottom && hasNextPage && !isFetchingNextPage && fetchNextPage) {
                  fetchNextPage();
                }
              }}
              scrollEventThrottle={200}
            >
              {isFetching && !isFetchingNextPage && (
                <View
                  style={{
                    paddingVertical: 10,
                    alignItems: 'center',
                    backgroundColor: COLORS.white,
                  }}
                >
                  <ActivityIndicator size='small' color='gray' />
                </View>
              )}
              {listedData.length === 0 && !isFetching ? (
                <View
                  style={{
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: 80,
                    width: '100%',
                  }}
                >
                  <MaterialCommunityIcons name='magnify' size={24} color={COLORS.gray} />
                  <Text style={{ color: 'gray', fontSize: 14 }}>Nenhum resultado encontrado</Text>
                </View>
              ) : (
                <>
                  {listedData.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={{
                        backgroundColor: COLORS.white,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        height: 36,
                        width: '100%',
                        paddingHorizontal: 15,
                        borderBottomEndRadius: 10,
                        borderBottomStartRadius: 10,
                      }}
                      onPress={() => onItemPress(item.id)}
                    >
                      <Text
                        style={{
                          color: COLORS.black,
                          textOverflow: 'ellipsis',
                          fontSize: 14,
                          flex: 1,
                        }}
                        numberOfLines={1}
                      >
                        {item[itemKey]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {isFetchingNextPage && (
                    <View
                      style={{
                        paddingVertical: 10,
                        alignItems: 'center',
                        backgroundColor: COLORS.white,
                      }}
                    >
                      <ActivityIndicator size='small' color='gray' />
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
