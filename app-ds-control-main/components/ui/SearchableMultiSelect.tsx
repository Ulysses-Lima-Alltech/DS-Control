import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { COLORS } from '@/constants/colors';

type MultiSelectItem = { id: string; [key: string]: unknown };

interface SearchableMultiSelectProps {
  placeholder?: string;
  listedData: MultiSelectItem[];
  itemKey: string;
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  emptyLabel?: string;
}

export default function SearchableMultiSelect({
  placeholder = 'Buscar...',
  listedData,
  itemKey,
  value,
  onChange,
  disabled = false,
  emptyLabel = 'Nenhum item disponivel',
}: SearchableMultiSelectProps) {
  const [isListVisible, setIsListVisible] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<View>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });

  const selectedSet = useMemo(() => new Set(value), [value]);

  const filteredData = useMemo(() => {
    if (!search.trim()) return listedData;
    const normalized = search.trim().toLowerCase();
    return listedData.filter((item) =>
      String(item[itemKey] ?? '')
        .toLowerCase()
        .includes(normalized)
    );
  }, [listedData, search, itemKey]);

  const measureContainer = () => {
    if (containerRef.current) {
      containerRef.current.measure((_x, _y, width, height, pageX, pageY) => {
        setDropdownPosition({ top: pageY + height, left: pageX, width });
      });
    }
  };

  const handleToggleDropdown = () => {
    if (disabled) return;
    if (!isListVisible) measureContainer();
    setIsListVisible(!isListVisible);
  };

  const toggleItem = (id: string) => {
    if (selectedSet.has(id)) {
      onChange(value.filter((existingId) => existingId !== id));
    } else {
      onChange([...value, id]);
    }
  };

  const removeItem = (id: string) => {
    onChange(value.filter((existingId) => existingId !== id));
  };

  const selectedItems = listedData.filter((item) => selectedSet.has(item.id));

  return (
    <>
      <View ref={containerRef} style={{ width: '100%' }}>
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
          onPress={handleToggleDropdown}
          disabled={disabled}
        >
          <Text
            style={{
              fontSize: 14,
              color: value.length > 0 ? COLORS.text : COLORS.textMuted,
              fontWeight: value.length > 0 ? '600' : '500',
            }}
          >
            {value.length > 0 ? `${value.length} selecionado(s)` : placeholder}
          </Text>
          <Feather
            name='chevron-down'
            size={20}
            color={disabled ? COLORS.lightgray : COLORS.gray}
          />
        </TouchableOpacity>
      </View>

      {selectedItems.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {selectedItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => removeItem(item.id)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: COLORS.primarySoft,
                borderRadius: 999,
                paddingHorizontal: 10,
                paddingVertical: 6,
              }}
            >
              <Text style={{ fontSize: 12, color: COLORS.primaryDark, fontWeight: '600' }}>
                {String(item[itemKey] ?? '')}
              </Text>
              <Feather name='x' size={12} color={COLORS.primaryDark} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Modal
        visible={isListVisible}
        transparent
        animationType='fade'
        onRequestClose={() => setIsListVisible(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
          onPress={() => setIsListVisible(false)}
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
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.12,
              shadowRadius: 18,
              elevation: 8,
              maxHeight: 350,
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
              <TextInput
                placeholder={placeholder}
                value={search}
                onChangeText={setSearch}
                style={{
                  height: 54,
                  flex: 1,
                  paddingHorizontal: 15,
                  color: COLORS.text,
                }}
                placeholderTextColor={COLORS.textMuted}
              />
              <TouchableOpacity
                style={{ width: 54, height: 54, alignItems: 'center', justifyContent: 'center' }}
                onPress={() => setIsListVisible(false)}
              >
                <Feather name='x' size={20} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator>
              {filteredData.length === 0 ? (
                <View style={{ justifyContent: 'center', alignItems: 'center', height: 80 }}>
                  <MaterialCommunityIcons name='magnify' size={24} color={COLORS.gray} />
                  <Text style={{ color: COLORS.textMuted, fontSize: 14 }}>{emptyLabel}</Text>
                </View>
              ) : (
                filteredData.map((item) => {
                  const isSelected = selectedSet.has(item.id);
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        minHeight: 46,
                        width: '100%',
                        paddingHorizontal: 15,
                        backgroundColor: isSelected ? COLORS.primarySoft : COLORS.white,
                      }}
                      onPress={() => toggleItem(item.id)}
                    >
                      <Text
                        style={{
                          color: COLORS.text,
                          fontSize: 14,
                          flex: 1,
                          fontWeight: isSelected ? '700' : '400',
                        }}
                        numberOfLines={1}
                      >
                        {String(item[itemKey] ?? '')}
                      </Text>
                      {isSelected && <Feather name='check' size={16} color={COLORS.primaryDark} />}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
