import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProfileSelector } from '@/components/ProfileSelector';
import { SurfaceCard } from '@/components/SurfaceCard';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import { FLOATING_NAV_CONTENT_PADDING, PAGE_TITLE_CONTENT_GAP, radius, spacing, typography, type AppColors } from '@/constants/theme';
import { getProfile, setProfile, type ProfileType } from '@/lib/profile';
import {
  getApiBaseUrl,
  getUseMockOnly,
  setApiBaseUrl,
  setUseMockOnly,
} from '@/lib/settings';
import { syncWithServer } from '@/lib/sync';
import { useRefreshOnFocus, useScrollToTopOnFocus } from '@/hooks/useRefreshOnFocus';
import { useAppTheme } from '@/lib/themeContext';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isLight, toggleLightMode } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scrollRef = useRef<ScrollView>(null);
  const [apiUrl, setApiUrl] = useState('https://localhost:7080');
  const [mockOnly, setMockOnly] = useState(true);
  const [profile, setProfileState] = useState<ProfileType>('student');
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    setApiUrl(await getApiBaseUrl());
    setMockOnly(await getUseMockOnly());
    setProfileState(await getProfile());
  }, []);

  useRefreshOnFocus(load);
  useScrollToTopOnFocus(
    useCallback(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, []),
  );

  const save = async () => {
    await setApiBaseUrl(apiUrl);
    await setUseMockOnly(mockOnly);
    await setProfile(profile);
    Alert.alert('Enregistré', 'Paramètres mis à jour.');
  };

  const sync = async () => {
    setSyncing(true);
    const result = await syncWithServer();
    setSyncing(false);
    Alert.alert(result.ok ? 'Sync' : 'Hors ligne', result.message);
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + SCREEN_TOP_GUTTER },
      ]}
    >
      <Text style={styles.title}>Réglages</Text>

      <SurfaceCard padding={spacing.md} style={styles.accountCard}>
        <View style={styles.accountHeader}>
          <View style={styles.accountIcon}>
            <Ionicons name="person-outline" size={18} color={colors.primary} />
          </View>
          <View style={styles.accountCopy}>
            <Text style={styles.accountTitle}>Compte utilisateur</Text>
            <Text style={styles.accountHint}>Gère ton profil et personnalise les conseils du tableau de bord.</Text>
          </View>
        </View>
        <ProfileSelector
          selected={profile}
          onChange={(p) => {
            setProfileState(p);
            void setProfile(p);
          }}
        />
      </SurfaceCard>

      <SurfaceCard padding={spacing.md}>
        <View style={styles.row}>
          <View style={styles.rowCopy}>
            <Text style={styles.rowLabel}>Thème clair</Text>
            <Text style={styles.rowHint}>Active une interface douce et lumineuse.</Text>
          </View>
          <Switch
            value={isLight}
            onValueChange={(enabled) => void toggleLightMode(enabled)}
            trackColor={{ false: colors.borderStrong, true: colors.primary }}
            thumbColor={isLight ? colors.surfaceSolid : undefined}
          />
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Mode démo</Text>
          <Switch
            value={mockOnly}
            onValueChange={setMockOnly}
            trackColor={{ false: colors.borderStrong, true: colors.primary }}
            thumbColor={mockOnly ? colors.surfaceSolid : undefined}
          />
        </View>
        <Text style={styles.label}>URL API</Text>
        <TextInput
          style={styles.input}
          value={apiUrl}
          onChangeText={setApiUrl}
          autoCapitalize="none"
          keyboardType="url"
          placeholderTextColor={colors.textMuted}
        />
        <Pressable style={styles.btn} onPress={() => void save()}>
          <Text style={styles.btnText}>Enregistrer</Text>
        </Pressable>
        <Pressable style={styles.btnGhost} onPress={() => void sync()} disabled={syncing}>
          <Text style={styles.btnGhostText}>{syncing ? 'Sync…' : 'Synchroniser'}</Text>
        </Pressable>
      </SurfaceCard>

      <Pressable style={styles.linkRow}>
        <Ionicons name="help-circle-outline" size={18} color={colors.textMuted} />
        <Text style={styles.link}>Aide</Text>
      </Pressable>

      <Text style={styles.footer}>v1.0</Text>
    </ScrollView>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingBottom: FLOATING_NAV_CONTENT_PADDING, gap: PAGE_TITLE_CONTENT_GAP },
  title: { color: colors.text, fontSize: typography.title, fontWeight: '800', letterSpacing: -0.5 },
  accountCard: { gap: spacing.md },
  accountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  accountIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cyanMuted,
  },
  accountCopy: { flex: 1, minWidth: 0 },
  accountTitle: { color: colors.text, fontSize: typography.body, fontWeight: '800' },
  accountHint: { color: colors.textMuted, fontSize: typography.micro, marginTop: 3, lineHeight: 15 },
  label: { color: colors.textMuted, fontSize: typography.micro, marginBottom: spacing.xs, marginTop: spacing.md },
  input: {
    backgroundColor: 'transparent',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    padding: spacing.md,
    fontSize: typography.body,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  rowCopy: { flex: 1, minWidth: 0 },
  rowLabel: { color: colors.text, fontSize: typography.body },
  rowHint: { color: colors.textMuted, fontSize: typography.micro, marginTop: 3, lineHeight: 15 },
  btn: {
    marginTop: spacing.lg,
    backgroundColor: colors.text,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
  },
  btnText: { color: colors.background, fontWeight: '800', fontSize: typography.body },
  btnGhost: { marginTop: spacing.sm, padding: spacing.sm, alignItems: 'center' },
  btnGhostText: { color: colors.primary, fontWeight: '800' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  link: { color: colors.textMuted, fontSize: typography.body },
  footer: { color: colors.textMuted, fontSize: typography.micro, textAlign: 'center' },
});
