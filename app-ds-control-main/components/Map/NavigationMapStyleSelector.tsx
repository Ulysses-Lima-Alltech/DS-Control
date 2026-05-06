import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { NavigationMapMode, NavigationMapModeOption } from '@/types/mapNavigation.type';

type NavigationMapStyleSelectorProps = {
  activeMode: NavigationMapMode;
  options: NavigationMapModeOption[];
  isOpen: boolean;
  onToggle: () => void;
  onSelectMode: (mode: NavigationMapMode) => void;
};

const getCompactModeLabel = (option?: NavigationMapModeOption) => {
  if (!option) return 'Mapa';
  return option.mode === 'navigation3d' ? '3D' : option.description;
};

export default function NavigationMapStyleSelector({
  activeMode,
  options,
  isOpen,
  onToggle,
  onSelectMode,
}: NavigationMapStyleSelectorProps) {
  const activeOption = options.find((option) => option.mode === activeMode);

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.toggleButton} onPress={onToggle} activeOpacity={0.85}>
        <MaterialCommunityIcons name='layers-outline' size={17} color='#111827' />
        <Text style={styles.toggleTitle}>{getCompactModeLabel(activeOption)}</Text>
      </TouchableOpacity>

      {isOpen && (
        <View style={styles.menu}>
          {options.map((option) => {
            const isActive = option.mode === activeMode;

            return (
              <TouchableOpacity
                key={option.mode}
                style={[styles.option, isActive && styles.optionActive]}
                onPress={() => onSelectMode(option.mode)}
                activeOpacity={0.85}
              >
                <View style={styles.optionTextWrap}>
                  <Text style={[styles.optionLabel, isActive && styles.optionLabelActive]}>
                    {getCompactModeLabel(option)}
                  </Text>
                  {option.mode === 'navigation3d' && (
                    <Text
                      style={[styles.optionDescription, isActive && styles.optionDescriptionActive]}
                    >
                      Navegação
                    </Text>
                  )}
                </View>
                {isActive && (
                  <MaterialCommunityIcons name='check-circle' size={16} color='#0D6EFD' />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 164,
    left: 12,
    zIndex: 12,
    alignItems: 'flex-start',
  },
  toggleButton: {
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
  },
  toggleTitle: {
    color: '#111827',
    fontSize: 12,
    fontWeight: '900',
  },
  menu: {
    width: 116,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    marginTop: 7,
    padding: 5,
    gap: 3,
  },
  option: {
    minHeight: 38,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  optionActive: {
    backgroundColor: '#E7F0FF',
  },
  optionTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  optionLabel: {
    color: '#111827',
    fontSize: 12,
    fontWeight: '900',
  },
  optionLabelActive: {
    color: '#0D47A1',
  },
  optionDescription: {
    color: '#6B7280',
    fontSize: 9,
    fontWeight: '800',
  },
  optionDescriptionActive: {
    color: '#0D47A1',
  },
});
