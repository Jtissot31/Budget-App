/**
 * « Connecter ma banque » — Plaid bank-sync flow.
 * intro → choose bank → connecting → choose accounts → done.
 * Data comes from `lib/bankSync.ts` (preview/demo until the Plaid backend exists).
 * Bank credentials are never entered here: with live Plaid, the « connecting » step opens Plaid Link.
 */
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { AppIcon } from '@/components/icons/AppIcon';
import { AnimatedFill, PressScale, Reveal, usePopOnActive } from '@/components/kit/motion';
import { PickerLeadingTile } from '@/components/SettingsPickerSheet';
import { jakartaBoldText, jakartaMediumText, jakartaSemiboldText, spacing, typography } from '@/constants/theme';
import {
  BANK_SYNC_LIVE,
  importBankAccounts,
  listBankInstitutions,
  startBankConnection,
  type BankConnection,
  type BankSyncInstitution,
} from '@/lib/bankSync';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { successHaptic, tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

type Step = 'intro' | 'bank' | 'connecting' | 'accounts' | 'done';
const STEPS: Step[] = ['intro', 'bank', 'connecting', 'accounts', 'done'];
const PAD = spacing.lg;

const KIND_LABEL = { checking: 'Chèque', savings: 'Épargne', credit: 'Crédit', cash: 'Espèces' } as const;

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export default function ConnectBankScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();

  const [step, setStep] = useState<Step>('intro');
  const [query, setQuery] = useState('');
  const [institution, setInstitution] = useState<BankSyncInstitution | null>(null);
  const [connection, setConnection] = useState<BankConnection | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const institutions = useMemo(() => listBankInstitutions(), []);
  const filtered = useMemo(() => {
    const q = normalize(query);
    return q ? institutions.filter((i) => normalize(i.name).includes(q)) : institutions;
  }, [institutions, query]);

  const stepIndex = STEPS.indexOf(step);
  const close = () => router.back();

  const goBack = () => {
    tapHaptic();
    if (step === 'bank') setStep('intro');
    else if (step === 'accounts') setStep('bank');
    else close();
  };

  const chooseBank = (next: BankSyncInstitution) => {
    tapHaptic();
    setInstitution(next);
    setError(null);
    setStep('connecting');
  };

  // Connecting: with live Plaid this is where Plaid Link opens.
  useEffect(() => {
    if (step !== 'connecting' || !institution) return;
    let cancelled = false;
    startBankConnection(institution)
      .then((result) => {
        if (cancelled) return;
        setConnection(result);
        setSelectedIds(result.accounts.map((a) => a.id));
        setStep('accounts');
      })
      .catch(() => {
        if (cancelled) return;
        setError('La connexion a échoué. Réessaie dans un instant.');
        setStep('bank');
      });
    return () => {
      cancelled = true;
    };
  }, [institution, step]);

  const toggleAccount = (id: string) => {
    tapHaptic();
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const importSelected = async () => {
    if (!connection || selectedIds.length === 0 || importing) return;
    setImporting(true);
    try {
      await importBankAccounts(connection.connectionId, selectedIds);
      successHaptic();
      setStep('done');
    } finally {
      setImporting(false);
    }
  };

  const showBack = step === 'bank' || step === 'accounts';

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header: back / progress / close */}
      <View style={styles.topBar}>
        <View style={styles.topSide}>
          {showBack ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Retour" hitSlop={14} onPress={goBack}>
              <AppIcon family="ionicons" name="chevron-back" size={24} color={colors.text} />
            </Pressable>
          ) : null}
        </View>
        <View style={[styles.progressTrack, { backgroundColor: colors.borderSubtle }]}>
          <AnimatedFill
            progress={(stepIndex + 1) / STEPS.length}
            style={[styles.progressFill, { backgroundColor: colors.accentGreen }]}
          />
        </View>
        <View style={[styles.topSide, styles.topSideEnd]}>
          {step !== 'done' ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Fermer" hitSlop={14} onPress={close}>
              <AppIcon family="ionicons" name="close" size={24} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {!BANK_SYNC_LIVE ? (
        <View style={[styles.previewPill, { backgroundColor: colors.surfaceElevated }]}>
          <Text style={[styles.previewText, { color: colors.textMuted }]}>Aperçu · données de démonstration</Text>
        </View>
      ) : null}

      {step === 'intro' ? (
        <IntroStep key="intro" onContinue={() => { tapHaptic(); setStep('bank'); }} bottomInset={insets.bottom} />
      ) : null}

      {step === 'bank' ? (
        <View key="bank" style={styles.flex}>
          <Reveal>
            <Text style={[styles.h1, styles.padded, { color: colors.text }]}>Choisis ta banque</Text>
          </Reveal>
          <View style={[styles.search, { backgroundColor: colors.surfaceElevated }]}>
            <AppIcon family="ionicons" name="search" size={16} color={colors.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Rechercher une institution"
              placeholderTextColor={colors.textMuted}
              autoCorrect={false}
              autoCapitalize="none"
              style={[styles.searchInput, { color: colors.text }]}
            />
          </View>
          {error ? <Text style={[styles.error, styles.padded, { color: colors.danger }]}>{error}</Text> : null}
          <ScrollView
            style={styles.flex}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
          >
            <Reveal index={1}>
              {!query ? <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Populaires</Text> : null}
              {filtered.length === 0 ? (
                <Text style={[styles.empty, { color: colors.textMuted }]}>Aucune institution trouvée</Text>
              ) : (
                filtered.map((item, index) => (
                  <View key={item.id}>
                    {!query && index > 0 && item.popular !== filtered[index - 1]!.popular ? (
                      <Text style={[styles.sectionLabel, styles.sectionLabelSpaced, { color: colors.textMuted }]}>
                        Toutes les institutions
                      </Text>
                    ) : null}
                    <PressScale
                      accessibilityRole="button"
                      accessibilityLabel={item.name}
                      onPress={() => chooseBank(item)}
                      scaleTo={0.98}
                      style={styles.row}
                    >
                      <BankLogo institution={item} size={36} />
                      <Text style={[styles.rowLabel, { color: colors.text }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <AppIcon family="ionicons" name="chevron-forward" size={18} color={colors.textMuted} />
                    </PressScale>
                  </View>
                ))
              )}
            </Reveal>
          </ScrollView>
        </View>
      ) : null}

      {step === 'connecting' && institution ? <ConnectingStep key="connecting" institution={institution} /> : null}

      {step === 'accounts' && connection ? (
        <View key="accounts" style={styles.flex}>
          <ScrollView style={styles.flex} contentContainerStyle={{ paddingBottom: spacing.xl }}>
            <Reveal style={styles.padded}>
              <BankLogo institution={connection.institution} size={44} />
              <Text style={[styles.h1, styles.h1Spaced, { color: colors.text }]}>Quels comptes importer ?</Text>
              <Text style={[styles.body, { color: colors.textMuted }]}>
                {connection.institution.name} · {connection.accounts.length} comptes trouvés
              </Text>
            </Reveal>
            <Reveal index={1} style={styles.accountList}>
              {connection.accounts.map((account) => {
                const selected = selectedIds.includes(account.id);
                return (
                  <PressScale
                    key={account.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={`${account.name}, ${KIND_LABEL[account.kind]} se terminant par ${account.mask}`}
                    onPress={() => toggleAccount(account.id)}
                    scaleTo={0.98}
                    style={styles.row}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        selected
                          ? { backgroundColor: colors.text, borderColor: colors.text }
                          : { borderColor: colors.borderStrong },
                      ]}
                    >
                      {selected ? <AppIcon family="ionicons" name="checkmark" size={14} color={colors.background} /> : null}
                    </View>
                    <View style={styles.rowCopy}>
                      <Text style={[styles.rowLabel, { color: colors.text }]} numberOfLines={1}>
                        {account.name}
                      </Text>
                      <Text style={[styles.rowMeta, { color: colors.textMuted }]} numberOfLines={1}>
                        {KIND_LABEL[account.kind]} ··{account.mask}
                      </Text>
                    </View>
                    <Text style={[styles.balance, { color: colors.text }]}>
                      {account.balance < 0 ? '−' : ''}
                      {formatDisplayMoneyAbsolute(Math.abs(account.balance))}
                    </Text>
                  </PressScale>
                );
              })}
            </Reveal>
          </ScrollView>
          <Footer bottomInset={insets.bottom}>
            <PrimaryButton
              label={
                importing
                  ? 'Importation…'
                  : selectedIds.length === 0
                    ? 'Sélectionne au moins un compte'
                    : `Importer ${selectedIds.length} compte${selectedIds.length > 1 ? 's' : ''}`
              }
              loading={importing}
              disabled={selectedIds.length === 0}
              onPress={() => void importSelected()}
            />
          </Footer>
        </View>
      ) : null}

      {step === 'done' && connection ? (
        <DoneStep
          key="done"
          institutionName={connection.institution.name}
          count={selectedIds.length}
          bottomInset={insets.bottom}
          onFinish={close}
        />
      ) : null}
    </View>
  );
}

/* ───────────────────────── Steps ───────────────────────── */

function IntroStep({ onContinue, bottomInset }: { onContinue: () => void; bottomInset: number }) {
  const { colors } = useAppTheme();
  const points: { icon: string; title: string; body: string }[] = [
    { icon: 'sync', title: 'Synchronisation automatique', body: 'Soldes et transactions à jour, sans rien saisir.' },
    { icon: 'lock-closed', title: 'Chiffré et en lecture seule', body: 'Tes identifiants restent chez Plaid. Personne ne peut bouger ton argent.' },
    { icon: 'trash-outline', title: 'Supprimable à tout moment', body: 'Déconnecte ta banque et efface tes données en un geste.' },
  ];
  const collected = ['Nom des transactions', 'Montants', 'Soldes des comptes'];
  const neverCollected = ['Identifiants bancaires', 'Nom, adresse et courriel', 'NAS et date de naissance'];
  return (
    <View style={styles.flex}>
      <ScrollView style={styles.flex} contentContainerStyle={[styles.padded, { paddingBottom: spacing.xl }]}>
        <Reveal>
          <View style={styles.heroIcons}>
            <View style={[styles.heroBadge, { backgroundColor: colors.surfaceElevated }]}>
              <AppIcon family="ionicons" name="business" size={26} color={colors.text} />
            </View>
            <View style={[styles.heroLink, { backgroundColor: colors.borderStrong }]} />
            <View style={[styles.heroBadge, { backgroundColor: `${colors.accentGreen}24` }]}>
              <AppIcon family="ionicons" name="wallet" size={26} color={colors.accentGreen} />
            </View>
          </View>
          <Text style={[styles.hero, { color: colors.text }]}>Connecte ta banque</Text>
          <Text style={[styles.body, { color: colors.textMuted }]}>
            Budget-OX se met à jour tout seul. Ça prend moins d’une minute.
          </Text>
        </Reveal>
        <View style={styles.points}>
          {points.map((point, index) => (
            <Reveal key={point.title} index={index + 1} style={styles.point}>
              <AppIcon family="ionicons" name={point.icon} size={20} color={colors.text} />
              <View style={styles.rowCopy}>
                <Text style={[styles.pointTitle, { color: colors.text }]}>{point.title}</Text>
                <Text style={[styles.pointBody, { color: colors.textMuted }]}>{point.body}</Text>
              </View>
            </Reveal>
          ))}
        </View>

        {/* Privacy — say plainly what is read and what never is. */}
        <Reveal index={4} style={[styles.privacy, { backgroundColor: colors.surfaceElevated }]}>
          <View style={styles.privacyHeader}>
            <AppIcon family="ionicons" name="shield-checkmark" size={18} color={colors.accentGreen} />
            <Text style={[styles.pointTitle, { color: colors.text }]}>Ta vie privée d’abord</Text>
          </View>
          <Text style={[styles.privacyLabel, { color: colors.textMuted }]}>On lit seulement</Text>
          {collected.map((item) => (
            <View key={item} style={styles.privacyItem}>
              <AppIcon family="ionicons" name="checkmark" size={16} color={colors.accentGreen} />
              <Text style={[styles.privacyText, { color: colors.text }]}>{item}</Text>
            </View>
          ))}
          <Text style={[styles.privacyLabel, styles.privacyLabelSpaced, { color: colors.textMuted }]}>
            On ne collecte jamais
          </Text>
          {neverCollected.map((item) => (
            <View key={item} style={styles.privacyItem}>
              <AppIcon family="ionicons" name="close" size={16} color={colors.textMuted} />
              <Text style={[styles.privacyText, { color: colors.text }]}>{item}</Text>
            </View>
          ))}
          <Text style={[styles.privacyNote, { color: colors.textMuted }]}>
            Tout est chiffré. Tes données ne sont jamais vendues ni partagées, et tu peux les supprimer quand tu veux
            depuis les réglages.
          </Text>
        </Reveal>
      </ScrollView>
      <Footer bottomInset={bottomInset}>
        <PrimaryButton label="Continuer" onPress={onContinue} />
        <Text style={[styles.footnote, { color: colors.textMuted }]}>
          En continuant, tu acceptes que Plaid accède à tes données bancaires en lecture seule.
        </Text>
      </Footer>
    </View>
  );
}

function ConnectingStep({ institution }: { institution: BankSyncInstitution }) {
  const { colors } = useAppTheme();
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [pulse]);
  const ring = useAnimatedStyle(() => ({ opacity: 0.15 + pulse.value * 0.35, transform: [{ scale: 1 + pulse.value * 0.12 }] }));
  return (
    <View style={[styles.flex, styles.center]}>
      <View style={styles.connectingLogo}>
        <Animated.View style={[styles.connectingRing, { borderColor: colors.accentGreen }, ring]} />
        <BankLogo institution={institution} size={64} />
      </View>
      <Text style={[styles.h1, styles.centerText, { color: colors.text }]}>Connexion à {institution.name}…</Text>
      <Text style={[styles.body, styles.centerText, styles.connectingBody, { color: colors.textMuted }]}>
        Une fenêtre sécurisée Plaid s’ouvre pour te connecter. Budget-OX ne voit jamais tes identifiants.
      </Text>
      <ActivityIndicator color={colors.textMuted} style={{ marginTop: spacing.lg }} />
    </View>
  );
}

function DoneStep({
  institutionName,
  count,
  bottomInset,
  onFinish,
}: {
  institutionName: string;
  count: number;
  bottomInset: number;
  onFinish: () => void;
}) {
  const { colors } = useAppTheme();
  const [shown, setShown] = useState(false);
  useEffect(() => setShown(true), []);
  const pop = usePopOnActive(shown, 1.25);
  return (
    <View style={styles.flex}>
      <View style={[styles.flex, styles.center]}>
        <Animated.View style={[styles.doneBadge, { backgroundColor: colors.accentGreen }, pop]}>
          <AppIcon family="ionicons" name="checkmark" size={40} color="#FFFFFF" />
        </Animated.View>
        <Reveal index={1}>
          <Text style={[styles.hero, styles.centerText, { color: colors.text }]}>C’est connecté !</Text>
          <Text style={[styles.body, styles.centerText, styles.connectingBody, { color: colors.textMuted }]}>
            {count} compte{count > 1 ? 's' : ''} de {institutionName}{' '}
            {count > 1 ? 'seront synchronisés' : 'sera synchronisé'} automatiquement.
          </Text>
          {!BANK_SYNC_LIVE ? (
            <Text style={[styles.footnote, styles.centerText, { color: colors.textMuted }]}>
              Aperçu : aucune donnée n’a été importée.
            </Text>
          ) : null}
        </Reveal>
      </View>
      <Footer bottomInset={bottomInset}>
        <PrimaryButton label="Terminer" onPress={onFinish} />
      </Footer>
    </View>
  );
}

/* ───────────────────────── Pieces ───────────────────────── */

function BankLogo({ institution, size }: { institution: BankSyncInstitution; size: number }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.logoWell, { width: size, height: size, borderRadius: Math.round(size * 0.28), backgroundColor: colors.surfaceElevated }]}>
      <PickerLeadingTile
        logoAsset={institution.logoAsset}
        logoUrl={institution.logoUrl}
        label={institution.name}
        icon="business"
        iconColor={colors.textSecondary}
        wellBackground="transparent"
        size={size}
      />
    </View>
  );
}

function Footer({ children, bottomInset }: { children: React.ReactNode; bottomInset: number }) {
  return <View style={[styles.footer, { paddingBottom: Math.max(bottomInset, spacing.md) + spacing.sm }]}>{children}</View>;
}

function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading }}
      disabled={disabled || loading}
      onPress={onPress}
      scaleTo={0.97}
      style={[styles.primary, { backgroundColor: colors.text }, (disabled || loading) && styles.primaryDisabled]}
    >
      {loading ? <ActivityIndicator color={colors.background} /> : null}
      <Text style={[styles.primaryText, { color: colors.background }]}>{label}</Text>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  padded: { paddingHorizontal: PAD },
  center: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: PAD },
  centerText: { textAlign: 'center' },

  topBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: PAD, height: 52 },
  topSide: { width: 28 },
  topSideEnd: { alignItems: 'flex-end' },
  progressTrack: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  previewPill: { alignSelf: 'center', paddingHorizontal: 10, height: 24, borderRadius: 12, justifyContent: 'center', marginBottom: spacing.md },
  previewText: { ...jakartaMediumText, fontSize: 11.5 },

  hero: { ...jakartaBoldText, fontSize: 28, letterSpacing: -0.6, marginBottom: 8 },
  h1: { ...jakartaBoldText, fontSize: 24, letterSpacing: -0.4, marginBottom: spacing.md },
  h1Spaced: { marginTop: spacing.lg, marginBottom: 4 },
  body: { ...jakartaMediumText, fontSize: typography.body, lineHeight: 22 },
  footnote: { ...jakartaMediumText, fontSize: 12, lineHeight: 17, marginTop: spacing.md, textAlign: 'center' },
  error: { ...jakartaMediumText, fontSize: typography.meta, marginBottom: spacing.sm },

  heroIcons: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.xl },
  heroBadge: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  heroLink: { width: 28, height: 2, borderRadius: 1, marginHorizontal: 8 },
  points: { marginTop: spacing.xl, gap: spacing.lg },
  point: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  pointTitle: { ...jakartaSemiboldText, fontSize: typography.body, marginBottom: 2 },
  pointBody: { ...jakartaMediumText, fontSize: 13.5, lineHeight: 19 },
  privacy: { marginTop: spacing.xl, borderRadius: 20, padding: 16 },
  privacyHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.md },
  privacyLabel: { ...jakartaMediumText, fontSize: 12, marginBottom: 6 },
  privacyLabelSpaced: { marginTop: spacing.md },
  privacyItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 3 },
  privacyText: { ...jakartaMediumText, fontSize: 14 },
  privacyNote: { ...jakartaMediumText, fontSize: 12.5, lineHeight: 18, marginTop: spacing.md },

  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 42,
    marginHorizontal: PAD,
    marginBottom: spacing.sm,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  searchInput: { flex: 1, ...jakartaMediumText, fontSize: typography.body, paddingVertical: 0 },
  sectionLabel: { ...jakartaMediumText, fontSize: 12, paddingHorizontal: PAD, marginTop: spacing.sm, marginBottom: 2 },
  sectionLabelSpaced: { marginTop: spacing.lg },
  empty: { ...jakartaMediumText, fontSize: typography.meta, textAlign: 'center', paddingVertical: spacing.xl },

  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60, paddingHorizontal: PAD, paddingVertical: 10 },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  rowLabel: { ...jakartaSemiboldText, fontSize: typography.body, flexShrink: 1 },
  rowMeta: { ...jakartaMediumText, fontSize: 12.5 },
  balance: { ...jakartaSemiboldText, fontSize: typography.body },
  logoWell: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  accountList: { marginTop: spacing.lg },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },

  connectingLogo: { width: 112, height: 112, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl },
  connectingRing: { position: 'absolute', width: 112, height: 112, borderRadius: 56, borderWidth: 2 },
  connectingBody: { maxWidth: 320 },
  doneBadge: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl },

  footer: { paddingHorizontal: PAD, paddingTop: spacing.sm },
  primary: { height: 54, borderRadius: 27, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryDisabled: { opacity: 0.4 },
  primaryText: { ...jakartaBoldText, fontSize: typography.body },
});
