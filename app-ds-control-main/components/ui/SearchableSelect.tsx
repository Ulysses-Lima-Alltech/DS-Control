import TextInputSearch from '@/components/ui/TextInputSearch';
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Dimensions,
  Pressable,
} from 'react-native';
import { RefObject, useRef, useState, useEffect } from 'react';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';

interface SearchableSelectProps {
  placeholder?: string;
  onItemSelect?: (itemId: string) => void;
  listedData: any[];
  itemKey: string;
  onSearchChange?: (text: string) => void;
  disabled?: boolean;
  value?: string;
}

export default function SearchableSelect({
  placeholder = 'Buscar... ',
  onItemSelect,
  listedData,
  itemKey,
  onSearchChange,
  disabled = false,
  value,
}: SearchableSelectProps) {
  const [isListVisible, setIsListVisible] = useState<boolean>(false);
  const inputRef = useRef<TextInput>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef<View>(null);

  const selectedItem = value ? listedData.find((item) => item.id === value) : null;

  const onSearchTermChange = (text: string) => {
    onSearchChange?.(text);
    setSearchTerm(text);
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
            minHeight: 54,
            borderColor: disabled ? COLORS.border : COLORS.borderStrong,
            borderRadius: 16,
            paddingHorizontal: 16,
            paddingVertical: 10,
            backgroundColor: disabled ? COLORS.background : COLORS.surface,
          }}
          disabled={disabled}
          onPress={handleToggleDropdown}
        >
          <Text
            style={{
              fontSize: 14,
              color: disabled ? COLORS.textMuted : selectedItem ? COLORS.text : COLORS.textMuted,
              fontWeight: selectedItem ? '600' : '500',
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
              borderRadius: 18,
              borderWidth: 1,
              borderColor: COLORS.border,
              shadowColor: COLORS.shadow,
              shadowOffset: {
                width: 0,
                height: 8,
              },
              shadowOpacity: 0.12,
              shadowRadius: 18,
              elevation: 6,
              maxHeight: 250,
              zIndex: 1000,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                borderBottomWidth: 1,
                borderBottomColor: COLORS.border,
              }}
            >
              <TextInputSearch
                ref={inputRef as RefObject<TextInput>}
                placeholder={placeholder}
                style={{
                  backgroundColor: COLORS.white,
                  height: 54,
                  borderTopLeftRadius: 18,
                  borderBottomLeftRadius: 0,
                  borderTopRightRadius: 0,
                  borderBottomRightRadius: 0,
                  borderTopWidth: 0,
                  borderBottomWidth: 0,
                  borderLeftWidth: 0,
                  borderRightWidth: 0,
                  borderColor: COLORS.border,
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 15,
                }}
                onChangeText={onSearchTermChange}
                onFocus={() => {
                  setIsListVisible(true);
                }}
              />
              <TouchableOpacity
                style={{
                  width: 54,
                  height: 54,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: COLORS.white,
                  borderTopRightRadius: 18,
                  borderBottomRightRadius: 0,
                  borderTopLeftRadius: 0,
                  borderBottomLeftRadius: 0,
                }}
                onPress={() => {
                  setIsListVisible(false);
                }}
              >
                <Feather name='x' size={20} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={{
                maxHeight: 200,
              }}
              showsVerticalScrollIndicator={true}
            >
              {listedData.length === 0 ? (
                <View
                  style={{
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: 80,
                    width: '100%',
                  }}
                >
                  <MaterialCommunityIcons name='magnify' size={24} color={COLORS.gray} />
                  <Text style={{ color: COLORS.textMuted, fontSize: 14 }}>
                    Nenhum resultado encontrado
                  </Text>
                </View>
              ) : (
                <>
                  {listedData
                    .filter((item) =>
                      item[itemKey].toLowerCase().trim().includes(searchTerm.toLowerCase().trim())
                    )
                    .map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        style={{
                          backgroundColor: COLORS.white,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          minHeight: 42,
                          width: '100%',
                          paddingHorizontal: 15,
                          borderBottomEndRadius: 10,
                          borderBottomStartRadius: 10,
                        }}
                        onPress={() => onItemPress(item.id)}
                      >
                        <Text
                          style={{
                          color: COLORS.text,
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
                </>
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
