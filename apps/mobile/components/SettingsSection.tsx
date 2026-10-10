import { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { ListCard, SectionLabel } from '@/components/kit';

type Props = {
  title: string;
  children: ReactNode;
  style?: ViewStyle;
};

/** Grouped settings block — kit eyebrow + glass list card (Transactions style). */
export function SettingsSection({ title, children, style }: Props) {
  return (
    <View style={[styles.section, style]}>
      <SectionLabel title={title} />
      <ListCard style={styles.card}>{children}</ListCard>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    alignSelf: 'stretch',
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
  },
  card: {
    alignSelf: 'stretch',
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
  },
});
