import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export type EmptyStateProps = {
  title: string;
  description?: string;
  iconName?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
};

export default function ServiceOrdersEmptyState({
  title,
  description,
  iconName = 'clipboard-list-outline',
  primaryActionLabel,
  onPrimaryAction,
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.illustration}>
        <MaterialCommunityIcons name={iconName} size={56} color='#C7C7CC' />
      </View>

      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}

      {primaryActionLabel && onPrimaryAction ? (
        <TouchableOpacity style={styles.button} onPress={onPrimaryAction} activeOpacity={0.8}>
          <Text style={styles.buttonText}>{primaryActionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  illustration: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F2F7',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    textAlign: 'center',
  },
  description: {
    marginTop: 6,
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
  button: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#EAAE07',
    borderRadius: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
});
