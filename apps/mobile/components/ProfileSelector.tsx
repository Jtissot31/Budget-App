import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { jakartaBoldText, jakartaExtraBoldText, radius, spacing, typography } from '@/constants/theme';
import type { ProfileType } from '@/lib/profile';
import { useAppTheme } from '@/lib/themeContext';

const profiles: { id: ProfileType; label: string }[] = [
  { id: 'student', label: 'Étudiant' },
  { id: 'entrepreneur', label: 'Pro' },
  { id: 'homebuyer', label: 'Projet' },
  { id: 'retired', label: 'Retraité' },
];

type Props = {
  selected: ProfileType;
  onChange: (profile: ProfileType) => void;
};

export function ProfileSelector({ selected, onChange }: Props) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.wrap}>
      <Text style={[styles.heading, { color: colors.textMuted }]}>Profil</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {profiles.map((p) => {
          const active = selected === p.id;
          return (
            <Pressable
              key={p.id}
              onPress={() => onChange(p.id)}
              style={[
                styles.chip,
                { borderColor: active ? colors.primary : colors.border },
                active && { backgroundColor: colors.scopeActive },
              ]}
            >
              <Text style={[styles.chipText, { color: active ? colors.primary : colors.textMuted }, active && styles.chipTextActive]}>
                {p.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  heading: { ...jakartaBoldText, fontSize: typography.caption, letterSpacing: 0.5 },
  row: { gap: spacing.sm, paddingVertical: 2 },
  chip: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
  },
  chipText: { ...jakartaBoldText, fontSize: typography.caption },
  chipTextActive: { ...jakartaExtraBoldText },
});
