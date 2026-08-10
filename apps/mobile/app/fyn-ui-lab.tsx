import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CreditCard, Wallet } from 'lucide-react-native';
import { PageTransition } from '@/components/PageTransition';
import {
  Badge,
  BudgetRow,
  Button,
  Card,
  Divider,
  Input,
  ListItem,
  RadioGroup,
} from '@/components/fyn-ui';
import { AppIcon } from '@/components/icons/AppIcon';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import { COLORS, SPACING, TYPOGRAPHY } from '@/constants/design-tokens';
import { FLOATING_NAV_CONTENT_PADDING, spacing } from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';

function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function VariantHint({ children }: { children: string }) {
  return <Text style={styles.variantHint}>{children}</Text>;
}

export default function FynUiLabScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [inputDefault, setInputDefault] = useState('');
  const [inputNumeric, setInputNumeric] = useState('1250');
  const [inputSecure, setInputSecure] = useState('secret');
  const [inputMultiline, setInputMultiline] = useState('Note multiligne…');
  const [radioValue, setRadioValue] = useState('mensuel');
  const [radioBinary, setRadioBinary] = useState('oui');

  return (
    <PageTransition>
      <View style={[styles.screen, { paddingTop: insets.top + SCREEN_TOP_GUTTER }]}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retour"
            hitSlop={12}
            onPress={() => {
              tapHaptic();
              router.back();
            }}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <AppIcon family="ionicons" name="chevron-back" size={22} color={COLORS.text} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Fyn UI
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + FLOATING_NAV_CONTENT_PADDING + spacing.xl },
          ]}
        >
          <Text style={styles.subtitle}>Bibliothèque de composants — galerie complète</Text>

          {/* ── Button ── */}
          <SectionLabel>Button</SectionLabel>
          <VariantHint>Variantes</VariantHint>
          <View style={styles.rowGap}>
            <Button label="Primary" variant="primary" onPress={() => tapHaptic()} />
            <Button label="Secondary" variant="secondary" onPress={() => tapHaptic()} />
            <Button label="Ghost" variant="ghost" onPress={() => tapHaptic()} />
            <Button label="Disabled" variant="primary" disabled onPress={() => {}} />
          </View>
          <VariantHint>Tailles (sm / md / lg)</VariantHint>
          <View style={styles.rowGap}>
            <Button label="Small" variant="primary" size="sm" onPress={() => tapHaptic()} />
            <Button label="Medium" variant="primary" size="md" onPress={() => tapHaptic()} />
            <Button label="Large" variant="primary" size="lg" onPress={() => tapHaptic()} />
          </View>
          <VariantHint>Secondary · tailles</VariantHint>
          <View style={styles.rowGap}>
            <Button label="Small" variant="secondary" size="sm" onPress={() => tapHaptic()} />
            <Button label="Large" variant="secondary" size="lg" onPress={() => tapHaptic()} />
          </View>
          <VariantHint>Ghost · tailles</VariantHint>
          <View style={styles.rowGap}>
            <Button label="Small ghost" variant="ghost" size="sm" onPress={() => tapHaptic()} />
            <Button label="Large ghost" variant="ghost" size="lg" onPress={() => tapHaptic()} />
          </View>

          <Divider />

          {/* ── Card ── */}
          <SectionLabel>Card</SectionLabel>
          <VariantHint>Avec titre</VariantHint>
          <Card title="Exemple de carte">
            <Text style={styles.bodyText}>
              Conteneur surface sombre avec titre optionnel et contenu libre.
            </Text>
          </Card>
          <VariantHint>Sans titre</VariantHint>
          <Card>
            <Text style={styles.bodyText}>Carte sans titre — contenu seul.</Text>
          </Card>
          <VariantHint>Pressable (onPress)</VariantHint>
          <Card title="Carte interactive" onPress={() => tapHaptic()}>
            <Text style={styles.bodyText}>Appuyez pour le retour haptique.</Text>
          </Card>

          <Divider />

          {/* ── Input ── */}
          <SectionLabel>Input</SectionLabel>
          <VariantHint>Défaut (focus → bordure verte)</VariantHint>
          <Input
            placeholder="Montant ou libellé…"
            value={inputDefault}
            onChangeText={setInputDefault}
          />
          <VariantHint>Clavier numérique</VariantHint>
          <Input
            placeholder="0,00"
            value={inputNumeric}
            onChangeText={setInputNumeric}
            keyboardType="numeric"
          />
          <VariantHint>Sécurisé</VariantHint>
          <Input
            placeholder="Mot de passe"
            value={inputSecure}
            onChangeText={setInputSecure}
            secureTextEntry
          />
          <VariantHint>Multiligne</VariantHint>
          <Input
            placeholder="Notes…"
            value={inputMultiline}
            onChangeText={setInputMultiline}
            multiline
            style={styles.multilineInput}
          />
          <VariantHint>Non éditable</VariantHint>
          <Input
            placeholder="Lecture seule"
            value="Valeur figée"
            onChangeText={() => {}}
            editable={false}
          />
          <VariantHint>maxLength (8)</VariantHint>
          <Input
            placeholder="Max 8 caractères"
            value={inputDefault.slice(0, 8)}
            onChangeText={(t) => setInputDefault(t.slice(0, 8))}
            maxLength={8}
          />

          <Divider />

          {/* ── RadioGroup ── */}
          <SectionLabel>RadioGroup</SectionLabel>
          <VariantHint>Trois options</VariantHint>
          <RadioGroup
            value={radioValue}
            onSelect={setRadioValue}
            options={[
              { label: 'Mensuel', value: 'mensuel' },
              { label: 'Hebdo', value: 'hebdo' },
              { label: 'Annuel', value: 'annuel' },
            ]}
          />
          <VariantHint>Deux options</VariantHint>
          <RadioGroup
            value={radioBinary}
            onSelect={setRadioBinary}
            options={[
              { label: 'Oui', value: 'oui' },
              { label: 'Non', value: 'non' },
            ]}
          />

          <Divider />

          {/* ── Badge ── */}
          <SectionLabel>Badge</SectionLabel>
          <VariantHint>success · warning · error</VariantHint>
          <View style={styles.badgeRow}>
            <Badge status="success" label="OK" />
            <Badge status="warning" label="Attention" />
            <Badge status="error" label="Dépassé" />
          </View>
          <View style={styles.badgeRow}>
            <Badge status="success" label="Sous budget" />
            <Badge status="warning" label="Limite proche" />
            <Badge status="error" label="Alerte" />
          </View>

          <Divider />

          {/* ── BudgetRow ── */}
          <SectionLabel>BudgetRow</SectionLabel>
          <VariantHint>≤100% vert · 100–115% ambre · &gt;115% rouge</VariantHint>
          <View style={styles.rowGap}>
            <BudgetRow category="Alimentation (normal)" spent={320} limit={400} />
            <BudgetRow category="Loisirs (warning)" spent={110} limit={100} />
            <BudgetRow category="Transport (alert)" spent={180} limit={120} />
            <BudgetRow
              category="Pressable"
              spent={50}
              limit={200}
              onPress={() => tapHaptic()}
            />
          </View>

          <Divider />

          {/* ── ListItem ── */}
          <SectionLabel>ListItem</SectionLabel>
          <VariantHint>Icône + valeur + chevron</VariantHint>
          <Card>
            <ListItem
              icon={<Wallet size={18} color={COLORS.textMuted} />}
              label="Compte courant"
              value="2 450,00 $"
              onPress={() => tapHaptic()}
            />
            <ListItem
              icon={<CreditCard size={18} color={COLORS.textMuted} />}
              label="Carte de crédit"
              value="−320,00 $"
              onPress={() => tapHaptic()}
            />
            <VariantHint>Sans icône · sans chevron</VariantHint>
            <ListItem
              label="Sans icône"
              value="Option"
              onPress={() => tapHaptic()}
              showChevron={false}
            />
            <VariantHint>Sans valeur</VariantHint>
            <ListItem label="Ligne seule" onPress={() => tapHaptic()} />
            <VariantHint>Valeur ReactNode (Badge)</VariantHint>
            <ListItem
              label="Statut"
              value={<Badge status="success" label="Actif" />}
              onPress={() => tapHaptic()}
              showChevron={false}
            />
          </Card>

          <Divider />

          {/* ── Divider ── */}
          <SectionLabel>Divider</SectionLabel>
          <VariantHint>Défaut (margin token)</VariantHint>
          <Divider />
          <VariantHint>Marge nulle</VariantHint>
          <Divider margin={0} />
          <VariantHint>Marge large</VariantHint>
          <Divider margin={SPACING.xl} />
          <VariantHint>Couleur accent</VariantHint>
          <Divider color={COLORS.green} margin={SPACING.sm} />
          <Text style={styles.bodyText}>
            Règle fine — séparateur de listes et de sections (utilisé aussi ci-dessus).
          </Text>
        </ScrollView>
      </View>
    </PageTransition>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.dark.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  headerTitle: {
    ...TYPOGRAPHY.h2,
    flex: 1,
    color: COLORS.text,
  },
  headerSpacer: {
    width: 40,
  },
  pressed: {
    opacity: 0.82,
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: SPACING.sm,
  },
  subtitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    marginBottom: SPACING.sm,
  },
  sectionLabel: {
    fontFamily: TYPOGRAPHY.families.uiMedium,
    fontSize: TYPOGRAPHY.sizes.meta,
    color: COLORS.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: SPACING.md,
  },
  variantHint: {
    fontFamily: TYPOGRAPHY.families.uiRegular,
    fontSize: TYPOGRAPHY.sizes.caption,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },
  rowGap: {
    gap: SPACING.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  bodyText: {
    ...TYPOGRAPHY.body,
    color: COLORS.dark.textSecondary,
  },
  multilineInput: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
});
