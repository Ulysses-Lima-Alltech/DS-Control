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
            padding: 12,
            borderRadius: 8,
            height: 50,
            borderWidth: 1,
            borderColor: disabled ? COLORS.lightgray : COLORS.gray,
            width: '100%',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: disabled ? COLORS.lightgray : COLORS.black }}>
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
              borderRadius: 12,
              borderWidth: 1,
              borderColor: COLORS.gray,
              shadowColor: '#000',
              shadowOffset: {
                width: 0,
                height: 4,
              },
              shadowOpacity: 0.3,
              shadowRadius: 6,
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
                borderBottomColor: COLORS.lightgray,
              }}
            >
              <TouchableOpacity
                onPress={handleCancel}
                style={{
                  padding: 8,
                }}
              >
                <Text style={{ color: COLORS.gray, fontSize: 16, fontWeight: '500' }}>
                  Cancelar
                </Text>
              </TouchableOpacity>

              <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.black }}>
                Selecionar Data
              </Text>

              <TouchableOpacity
                onPress={handleConfirm}
                style={{
                  padding: 8,
                }}
              >
                <Text style={{ color: COLORS.black, fontSize: 16, fontWeight: '500' }}>
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
                textColor={COLORS.black}
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
