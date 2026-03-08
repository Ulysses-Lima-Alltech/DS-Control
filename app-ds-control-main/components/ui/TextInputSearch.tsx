import {
  View,
  TextInput,
  TouchableOpacity,
  StyleProp,
  ViewStyle,
  TextInputProps,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { RefObject, useEffect, useState } from 'react';

interface TextInputSearchProps extends Omit<TextInputProps, 'style'> {
  ref?: RefObject<TextInput>;
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
  onChangeText?: (text: string) => void;
}

export default function TextInputSearch({
  placeholder = 'Buscar... ',
  style,
  onChangeText,
  ref,
  ...inputProps
}: TextInputSearchProps) {
  const [searchText, setSearchText] = useState('');

  const handleClearSearch = () => {
    setSearchText('');
    ref?.current?.focus();
  };

  useEffect(() => {
    onChangeText?.(searchText);
  }, [searchText]);

  return (
    <View style={style}>
      <Ionicons name='search' size={20} color='gray' style={{ marginRight: 10 }} />
      <TextInput
        ref={ref}
        style={{
          flex: 1,
          height: '100%',
          fontSize: 16,
        }}
        placeholder={placeholder}
        placeholderTextColor='gray'
        value={searchText}
        onChangeText={setSearchText}
        inputMode='search'
        {...inputProps}
      />
      {searchText.length > 0 && (
        <TouchableOpacity onPress={handleClearSearch} style={{ padding: 5 }}>
          <Ionicons name='close-circle' size={20} color='gray' />
        </TouchableOpacity>
      )}
    </View>
  );
}
