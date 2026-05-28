import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SurfaceCard } from '@/components/SurfaceCard';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import { FLOATING_NAV_CONTENT_PADDING, radius, spacing, typography, type AppColors } from '@/constants/theme';
import { clearLocalPersonalData } from '@/lib/db';
import { tapHaptic, successHaptic } from '@/lib/haptics';
import {
  clearLocalAccountSettings,
  getLocalProStatus,
  getLocalUserEmail,
  getLocalUserPassword,
  setLocalProStatus,
  setLocalUserEmail,
  setLocalUserPassword,
} from '@/lib/settings';
import { useAppTheme } from '@/lib/themeContext';
import { getUserDisplayName, setUserDisplayName } from '@/lib/userDisplay';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';

export default function UserAccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [name, setName] = useState('Jérémie');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPro, setIsPro] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const [storedName, storedEmail, storedPassword, storedPro] = await Promise.all([
      getUserDisplayName(),
      getLocalUserEmail(),
      getLocalUserPassword(),
      getLocalProStatus(),
    ]);
    setName(storedName);
    setEmail(storedEmail);
    setPassword(storedPassword);
    setIsPro(storedPro);
  }, []);

  useRefreshOnFocus(load);

  const saveProfile = async () => {
    setSaving(true);
    await Promise.all([
      setUserDisplayName(name),
      setLocalUserEmail(email),
      setLocalUserPassword(password),
    ]);
    setSaving(false);
    successHaptic();
    Alert.alert('Profil enregistré', 'Tes informations locales ont été mises à jour.');
  };

  const upgradeToPro = async () => {
    tapHaptic();
    await setLocalProStatus(true);
    setIsPro(true);
    Alert.alert('Pro activé', 'Statut Pro simulé sur cet appareil.');
  };

  const confirmDeleteData = () => {
    tapHaptic();
    Alert.alert(
      'Supprimer les données?',
      'Cette action efface les transactions, comptes simulés, objectifs, paiements récurrents, budgets, catégories et réglages locaux.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Tout supprimer',
          style: 'destructive',
          onPress: () => void deleteData(),
        },
      ],
    );
  };

  const deleteData = async () => {
    setDeleting(true);
    await clearLocalPersonalData();
    await clearLocalAccountSettings();
    setName('Jérémie');
    setEmail('');
    setPassword('');
    setIsPro(false);
    setDeleting(false);
    Alert.alert('Données supprimées', 'Les données personnelles locales ont été effacées.');
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + SCREEN_TOP_GUTTER,
          paddingBottom: FLOATING_NAV_CONTENT_PADDING,
        },
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.textSecondary} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>Compte local</Text>
          <Text style={styles.title}>Profil utilisateur</Text>
        </View>
      </View>

      <SurfaceCard padding={spacing.lg}>
        <View style={styles.profileHero}>
          <View style={styles.avatar}>
            <Ionicons name="person-outline" size={28} color={colors.primary} />
          </View>
          <View style={styles.profileCopy}>
            <Text style={styles.profileName}>{name.trim() || 'Jérémie'}</Text>
            <Text style={styles.profileEmail}>{email.trim() || 'Aucun courriel local'}</Text>
          </View>
        </View>

        <AccountInput label="Nom affiché" value={name} onChangeText={setName} />
        <AccountInput
          label="Courriel"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="toi@exemple.com"
        />
        <AccountInput
          label="Mot de passe local"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Mot de passe simulé"
        />

        <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]} onPress={() => void saveProfile()}>
          <Text style={styles.primaryButtonText}>{saving ? 'Enregistrement...' : 'Enregistrer le profil'}</Text>
        </Pressable>
      </SurfaceCard>

      <SurfaceCard padding={spacing.lg}>
        <View style={styles.statusRow}>
          <View style={styles.proBadge}>
            <Ionicons name="sparkles" size={16} color={colors.background} />
            <Text style={styles.proBadgeText}>{isPro ? 'Pro actif' : 'Gratuit'}</Text>
          </View>
          <Text style={styles.statusText}>
            {isPro ? 'Avantages Pro simulés activés sur cet appareil.' : 'Passe à Pro pour simuler les options avancées.'}
          </Text>
        </View>
        <Pressable
          disabled={isPro}
          style={({ pressed }) => [styles.secondaryButton, isPro && styles.disabledButton, pressed && !isPro && styles.pressed]}
          onPress={() => void upgradeToPro()}
        >
          <Text style={[styles.secondaryButtonText, isPro && styles.disabledButtonText]}>
            {isPro ? 'Déjà Pro' : 'Passer à Pro'}
          </Text>
        </Pressable>
      </SurfaceCard>

      <SurfaceCard padding={spacing.lg} style={styles.dangerCard}>
        <View style={styles.dangerHeader}>
          <Ionicons name="warning-outline" size={20} color={colors.danger} />
          <Text style={styles.dangerTitle}>Zone dangereuse</Text>
        </View>
        <Text style={styles.dangerCopy}>
          Efface toutes les données personnelles stockées localement dans cette app. Cette action ne touche aucun service externe.
        </Text>
        <Pressable
          disabled={deleting}
          onPress={confirmDeleteData}
          style={({ pressed }) => [styles.dangerButton, pressed && styles.pressed, deleting && styles.disabledButton]}
        >
          <Text style={styles.dangerButtonText}>{deleting ? 'Suppression...' : 'Supprimer mes données locales'}</Text>
        </Pressable>
      </SurfaceCard>
    </ScrollView>
  );
}

function AccountInput(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { label, ...inputProps } = props;
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...inputProps}
        style={styles.input}
        placeholderTextColor={colors.textMuted}
      />
    </View>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: {
    color: colors.textMuted,
    fontSize: typography.micro,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.8,
  },
  title: { color: colors.text, fontSize: typography.title, fontWeight: '900', letterSpacing: -0.5, marginTop: 2 },
  profileHero: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.successMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  profileCopy: { flex: 1, minWidth: 0 },
  profileName: { color: colors.text, fontSize: typography.dashboardGreeting, fontWeight: '800' },
  profileEmail: { color: colors.textMuted, fontSize: typography.meta, fontWeight: '600', marginTop: 3 },
  inputGroup: { gap: spacing.xs, marginBottom: spacing.md },
  label: { color: colors.textMuted, fontSize: typography.meta, fontWeight: '700' },
  input: {
    minHeight: 50,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.body,
    fontWeight: '700',
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
  },
  primaryButtonText: { color: colors.background, fontSize: typography.body, fontWeight: '900' },
  statusRow: { gap: spacing.md },
  proBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryAlt,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  proBadgeText: { color: colors.background, fontSize: typography.meta, fontWeight: '900' },
  statusText: { color: colors.textMuted, fontSize: typography.caption, lineHeight: 20, fontWeight: '600' },
  secondaryButton: {
    marginTop: spacing.lg,
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    paddingVertical: spacing.md,
  },
  secondaryButtonText: { color: colors.primary, fontSize: typography.body, fontWeight: '900' },
  disabledButton: { opacity: 0.58 },
  disabledButtonText: { color: colors.textMuted },
  dangerCard: { borderColor: colors.danger },
  dangerHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dangerTitle: { color: colors.danger, fontSize: typography.body, fontWeight: '900' },
  dangerCopy: { color: colors.textMuted, fontSize: typography.caption, lineHeight: 20, marginTop: spacing.sm },
  dangerButton: {
    marginTop: spacing.lg,
    alignItems: 'center',
    borderRadius: radius.lg,
    backgroundColor: colors.dangerMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.danger,
    paddingVertical: spacing.md,
  },
  dangerButtonText: { color: colors.danger, fontSize: typography.body, fontWeight: '900' },
  pressed: { opacity: 0.72 },
});
