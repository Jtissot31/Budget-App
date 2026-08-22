/**
 * Galerie de prototypes — container de solde de compte bancaire.
 * La variante 3 (Tuile patrimoine) est celle appliquée à MES COMPTES sur Portefeuille.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '@/components/icons/AppIcon';
import { PageTransition } from '@/components/PageTransition';
import { ProtoSectionHeader } from '@/components/proto/ProtoSectionHeader';
import {
  AccountLinePrototype,
  AccountMonumentPrototype,
  AccountPatrimoinePrototype,
  AccountQuietRailPrototype,
  AccountSplitPrototype,
} from '@/components/wallet/AccountCardPrototypes';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import {
  FLOATING_NAV_CONTENT_PADDING,
  PAGE_TITLE_STYLE,
  screenHorizontalGutter,
  spacing,
  typographyKit,
} from '@/constants/theme';
import { getSimulatedAccounts } from '@/lib/db';
import { dataEvents } from '@/lib/events';
import { tapHaptic } from '@/lib/haptics';
import { ensureDbReady } from '@/lib/init';
import { useAppTheme } from '@/lib/themeContext';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import type { SimulatedAccount } from '@/types';

/**
 * Two comparable accounts: one positive balance and the credit card, since
 * credit is where several variants tell visibly different stories.
 */
function pickShowcaseAccounts(accounts: SimulatedAccount[]): SimulatedAccount[] {
  const positive = accounts.find((account) => account.kind !== 'credit' && account.balance >= 0);
  const credit = accounts.find((account) => account.kind === 'credit');
  const picked = [positive, credit].filter((account): account is SimulatedAccount => account != null);
  if (picked.length > 0) return picked;
  return accounts.slice(0, 2);
}

type VariantBlock = {
  key: string;
  title: string;
  note: string;
  render: (account: SimulatedAccount, onPress: () => void) => React.ReactNode;
};

const VARIANTS: readonly VariantBlock[] = [
  {
    key: 'line',
    title: 'VARIANTE 1 — LIGNE ÉDITORIALE',
    note: 'Rangée Onyx pleine largeur (rythme patrimoine) : puits logo, nom + type, solde à droite. La plus dense. Couleurs système — crédit dû neutre, rouge seulement en découvert hors crédit.',
    render: (account, onPress) => (
      <AccountLinePrototype account={account} onPress={onPress} />
    ),
  },
  {
    key: 'monument',
    title: 'VARIANTE 2 — SOLDE MONUMENT',
    note: 'Le solde est le héros (tier hero) ; nom et institution en légende. Crédit : « Solde dû » + barre d’utilisation, jamais en rouge.',
    render: (account, onPress) => (
      <AccountMonumentPrototype account={account} onPress={onPress} />
    ),
  },
  {
    key: 'patrimoine',
    title: 'VARIANTE 3 — TUILE PATRIMOINE',
    note: 'Appliquée sur Portefeuille → MES COMPTES. Rythme tuiles stock : type + marque en haut, solde ancré en bas à droite. Crédit dû neutre + légende « Solde dû ».',
    render: (account, onPress) => (
      <AccountPatrimoinePrototype account={account} onPress={onPress} />
    ),
  },
  {
    key: 'split',
    title: 'VARIANTE 4 — COLONNES',
    note: 'Split bilatéral Onyx : identité à gauche, montant à droite, filet vertical. Le solde ne se bat plus avec le nom pour l’espace.',
    render: (account, onPress) => (
      <AccountSplitPrototype account={account} onPress={onPress} />
    ),
  },
  {
    key: 'rail',
    title: 'VARIANTE 5 — RAIL DISCRET',
    note: 'Un seul filet teinté par type de compte — pas de voile, pas de badge. Solde mi-poids (tier stat) ; crédit avec barre d’utilisation seulement.',
    render: (account, onPress) => (
      <AccountQuietRailPrototype account={account} onPress={onPress} />
    ),
  },
];

export default function AccountCardPrototypesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const gutter = Platform.OS === 'web' ? 0 : screenHorizontalGutter(insets);
  const [accounts, setAccounts] = useState<SimulatedAccount[]>([]);

  const load = useCallback(async () => {
    await ensureDbReady();
    setAccounts(await getSimulatedAccounts());
  }, []);

  useEffect(() => {
    void load();
    return dataEvents.subscribe(() => {
      void load();
    });
  }, [load]);

  useRefreshOnFocus(load);

  const showcase = useMemo(() => pickShowcaseAccounts(accounts), [accounts]);

  const openAccount = useCallback(
    (accountId: string) => {
      tapHaptic();
      router.push({ pathname: '/account-detail', params: { accountId } });
    },
    [router],
  );

  return (
    <PageTransition>
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.header,
            { paddingTop: insets.top + SCREEN_TOP_GUTTER, paddingHorizontal: gutter },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retour"
            hitSlop={12}
            onPress={() => {
              tapHaptic();
              router.back();
            }}
            style={({ pressed }) => [styles.backHit, pressed && styles.pressed]}
          >
            <AppIcon family="ionicons" name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
            Prototypes — carte de compte
          </Text>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            {
              paddingHorizontal: gutter,
              paddingBottom: insets.bottom + FLOATING_NAV_CONTENT_PADDING,
            },
          ]}
        >
          <Text style={[styles.intro, { color: colors.textMuted }]}>
            Cinq pistes premium minimalistes (Onyx), avec tes vrais comptes. La variante 3 (Tuile
            patrimoine) est celle appliquée à MES COMPTES sur Portefeuille.
          </Text>

          {showcase.length === 0 ? (
            <Text style={[styles.intro, { color: colors.textMuted }]}>
              Ajoute au moins un compte dans Portefeuille pour comparer les variantes.
            </Text>
          ) : (
            VARIANTS.map((variant) => (
              <View key={variant.key} style={styles.variantBlock}>
                <ProtoSectionHeader title={variant.title} />
                <Text style={[styles.note, { color: colors.textMuted }]}>{variant.note}</Text>
                <View
                  style={
                    variant.key === 'patrimoine' ? styles.patrimoineGrid : styles.variantList
                  }
                >
                  {showcase.map((account) => (
                    <View
                      key={`${variant.key}-${account.id}`}
                      style={variant.key === 'patrimoine' ? styles.patrimoineCell : undefined}
                    >
                      {variant.render(account, () => openAccount(account.id))}
                    </View>
                  ))}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </PageTransition>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  backHit: { padding: spacing.xs, flexShrink: 0 },
  title: {
    flex: 1,
    ...PAGE_TITLE_STYLE,
    fontSize: 24,
    lineHeight: 30,
    minWidth: 0,
  },
  content: { gap: spacing.xl, flexGrow: 1 },
  intro: { ...typographyKit.metaMedium, fontSize: 13, lineHeight: 19 },
  variantBlock: { gap: spacing.sm },
  note: { ...typographyKit.micro, fontSize: 11, lineHeight: 15, marginBottom: 2 },
  variantList: { gap: spacing.sm },
  patrimoineGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  patrimoineCell: {
    width: '48%',
    flexGrow: 1,
    flexBasis: '47%',
  },
  pressed: { opacity: 0.78 },
});
