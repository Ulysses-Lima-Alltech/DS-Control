import { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { COLORS } from '@/constants/colors';

interface DatePickeriOSModalProps {
  value: Date;
  onDateChange: (date: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  disabled?: boolean;
}

export default function DatePickeriOSModal({
  value,
  onDateChange,
  minimumDate,
  maximumDate,
  disabled = false,
}: DatePickeriOSModalProps) {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [tempDate, setTempDate] = useState(value);
  const containerRef = useRef<View>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });

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

  const handleOpenModal = () => {
    if (disabled) return;
    setTempDate(value);
    measureContainer();
    setIsModalVisible(true);
  };

  const handleCloseModal = () => {
    setIsModalVisible(false);
  };

  const handleConfirm = () => {
    onDateChange(tempDate);
    setIsModalVisible(false);
  };

  const handleCancel = () => {
    setTempDate(value); // Reset to original value
    setIsModalVisible(false);
  };

  return (
    <>
      <View ref={containerRef} style={{ width: '100%' }}>
        <TouchableOpacity
          disabled={disabled}
          onPress={handleOpenModal}
          style={{
            backgroundColor: COLORS.white,
            paddingHorizontal: 16,
            borderRadius: 16,
            height: 54,
            borderWidth: 1,
            borderColor: disabled ? COLORS.border : COLORS.borderStrong,
            width: '100%',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: disabled ? COLORS.textMuted : COLORS.text, fontWeight: '600' }}>
            {value.toLocaleDateString('pt-BR')}
          </Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType='fade'
        onRequestClose={handleCloseModal}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
          }}
          onPress={handleCloseModal}
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
              elevation: 8,
              zIndex: 1000,
              maxHeight: 350,
            }}
          >
            {/* Header */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: COLORS.border,
              }}
            >
              <TouchableOpacity
                onPress={handleCancel}
                style={{
                  padding: 8,
                }}
              >
                <Text style={{ color: COLORS.textMuted, fontSize: 16, fontWeight: '600' }}>
                  Cancelar
                </Text>
              </TouchableOpacity>

              <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text }}>
                Selecionar Data
              </Text>

              <TouchableOpacity
                onPress={handleConfirm}
                style={{
                  padding: 8,
                }}
              >
                <Text style={{ color: COLORS.primaryDark, fontSize: 16, fontWeight: '700' }}>
                  Confirmar
                </Text>
              </TouchableOpacity>
            </View>

            {/* Date Picker */}
            <View style={{ padding: 16 }}>
              <DateTimePicker
                value={tempDate}
                mode='date'
                display='spinner'
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                textColor={COLORS.text}
                onChange={(_, selectedDate) => {
                  if (selectedDate) {
                    setTempDate(selectedDate);
                  }
                }}
                style={{
                  backgroundColor: COLORS.white,
                }}
              />
            </View>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
