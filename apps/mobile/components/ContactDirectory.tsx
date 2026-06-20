import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { GlassContainer } from '@/components/GlassContainer';
import { radius, spacing } from '@/constants/theme';
import type { ContactDirectoryRow } from '@/lib/contactHistory';
import { listRowTitle, rowTitleTextProps } from '@/lib/textLayout';
import { useAppTheme } from '@/lib/themeContext';

export function filterContacts(contacts: ContactDirectoryRow[], query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return contacts;
  return contacts.filter((contact) => contact.name.toLowerCase().includes(needle));
}

export function ContactRow({
  contact,
  onPress,
}: {
  contact: ContactDirectoryRow;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const photoUri = contact.photoUri?.trim() ?? '';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Voir l'historique de ${contact.name}`}
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      <GlassContainer borderRadius={radius.card} padding={spacing.md}>
        <View style={styles.rowInner}>
          <View
            style={[
              styles.avatar,
              { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
            ]}
          >
            {photoUri ? (
              <Image
                source={{ uri: photoUri }}
                style={styles.avatarImage}
                contentFit="cover"
                accessibilityLabel={`Photo de ${contact.name}`}
              />
            ) : (
              <Ionicons name="person-outline" size={22} color={colors.textSecondary} />
            )}
          </View>
          <View style={styles.rowCopy}>
            <Text style={[styles.rowName, { color: colors.text }]} {...rowTitleTextProps}>
              {contact.name}
            </Text>
          </View>
          <View style={styles.chevronSlot}>
            <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
          </View>
        </View>
      </GlassContainer>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    flexShrink: 0,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    alignSelf: 'center',
  },
  rowName: {
    ...listRowTitle,
    flex: 0,
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 16,
    alignSelf: 'center',
    includeFontPadding: false,
  },
  chevronSlot: {
    width: 16,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    flexShrink: 0,
  },
  pressed: {
    opacity: 0.82,
  },
});

export type { ContactDirectoryRow };
