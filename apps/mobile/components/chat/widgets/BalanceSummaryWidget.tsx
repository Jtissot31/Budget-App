import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LogoIconFrame } from '@/components/IconFrame';
import { AppIcon } from '@/components/icons/AppIcon';
import { cashBanknotesLogoUri } from '@/components/icons/CashBanknotesOutlineIcon';
import { spacing } from '@/constants/theme';
import { getSimulatedAccounts } from '@/lib/db';
import { getAccountLogoUrl } from '@/lib/merchantLogo';
import type { BalanceSummaryCardData } from '@/types/aiWidgets';
import {
  AI_WIDGET_RADIUS,
  aiWidgetAmountTypography,
  aiWidgetFonts,
  aiWidgetHeroAmountTextProps,
  aiWidgetLabelTextProps,
  aiWidgetTypography,
  useAIWidgetColors,
} from './theme';
import { WidgetCardShell } from './WidgetCardShell';

type Props = {
  data: BalanceSummaryCardData;
};

/** Compact institution mark beside the account title (not a full card logo). */
const TITLE_LOGO_SIZE = 22;

function formatValueLabel(value: string): string {
  return value.replace(/ /g, '\u00A0');
}

function resolveTrendPositive(data: BalanceSummaryCardData): boolean {
  if (typeof data.positive === 'boolean') return data.positive;
  const trimmed = data.trend_label?.trim() ?? '';
  if (trimmed.startsWith('-') || trimmed.startsWith('−')) return false;
  return true;
}

function isAccountVariant(data: BalanceSummaryCardData): boolean {
  if (data.variant === 'account') return true;
  if (data.variant === 'total') return false;
  return Boolean(data.account_id?.trim() || data.account_name?.trim());
}

function accountKindEyebrow(kind: string | undefined): string | null {
  const normalized = kind?.trim().toLowerCase();
  if (!normalized) return null;
  switch (normalized) {
    case 'cheque':
    case 'checking':
      return 'Chèque';
    case 'epargne':
    case 'savings':
      return 'Épargne';
    case 'credit':
      return 'Crédit';
    case 'cash':
      return 'Espèces';
    default:
      return null;
  }
}

function buildAccountMeta(data: BalanceSummaryCardData): string | null {
  const parts: string[] = [];
  const institution = data.account_institution?.trim();
  const last4 = data.account_last4?.replace(/\D/g, '').slice(-4);
  if (institution) parts.push(institution);
  if (last4) parts.push(`····${last4}`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

function resolveEyebrow(data: BalanceSummaryCardData, accountMode: boolean): string {
  const label = data.label?.trim();
  if (!accountMode) return (label || 'Solde total').toUpperCase();

  const kindLabel = accountKindEyebrow(data.account_kind);
  if (kindLabel) return kindLabel.toUpperCase();

  if (label && !/^solde\s*total$/i.test(label)) {
    return label.toUpperCase();
  }
  return 'SOLDE';
}

/** Explicit URL, then institution name, then account name — never a broken image. */
function resolveAccountLogoUrl(data: BalanceSummaryCardData): string | null {
  const explicit = data.account_logo_url?.trim();
  if (explicit) return explicit;

  const kind = data.account_kind?.trim().toLowerCase();
  if (kind === 'cash') {
    return cashBanknotesLogoUri() || null;
  }

  const institution = data.account_institution?.trim();
  if (institution) {
    const fromInstitution = getAccountLogoUrl(institution);
    if (fromInstitution) return fromInstitution;
  }

  const name = data.account_name?.trim();
  if (name) return getAccountLogoUrl(name);
  return null;
}

async function resolveAccountId(data: BalanceSummaryCardData): Promise<string | null> {
  const explicit = data.account_id?.trim();
  if (explicit) return explicit;

  const name = data.account_name?.trim();
  if (!name) return null;

  try {
    const accounts = await getSimulatedAccounts();
    const needle = name.toLowerCase();
    const exact = accounts.find((account) => account.name.trim().toLowerCase() === needle);
    if (exact) return exact.id;
    const partial = accounts.find((account) => account.name.trim().toLowerCase().includes(needle));
    return partial?.id ?? null;
  } catch {
    return null;
  }
}

export function BalanceSummaryWidget({ data }: Props) {
  const palette = useAIWidgetColors();
  const router = useRouter();
  const [navigating, setNavigating] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  const accountMode = isAccountVariant(data);
  const accountName = data.account_name?.trim() || null;
  const accountMeta = accountMode ? buildAccountMeta(data) : null;
  const eyebrow = resolveEyebrow(data, accountMode);
  const logoUrl = accountMode ? resolveAccountLogoUrl(data) : null;
  const showLogo = Boolean(logoUrl) && !logoFailed;
  const trendPositive = resolveTrendPositive(data);
  const trendColor = trendPositive ? palette.green : palette.red;
  const trendWellBg = trendPositive ? palette.successMuted : palette.dangerMuted;
  const canNavigate = Boolean(data.action || data.account_id?.trim() || accountName);

  useEffect(() => {
    setLogoFailed(false);
  }, [logoUrl]);

  const handlePress = useCallback(async () => {
    if (navigating || !canNavigate) return;
    setNavigating(true);
    try {
      if (accountMode) {
        const accountId = await resolveAccountId(data);
        if (accountId) {
          router.push({ pathname: '/account-detail', params: { accountId } });
          return;
        }
      }
      router.push('/(tabs)/accounts');
    } finally {
      setNavigating(false);
    }
  }, [accountMode, canNavigate, data, navigating, router]);

  const content = (
    <WidgetCardShell style={styles.shell}>
      <Text
        style={[
          styles.eyebrow,
          aiWidgetTypography.eyebrow,
          { color: palette.accent, fontFamily: aiWidgetFonts.label },
        ]}
        {...aiWidgetLabelTextProps}
      >
        {eyebrow}
      </Text>

      {accountMode && accountName ? (
        <View style={styles.identityBlock}>
          <View style={styles.titleRow}>
            {showLogo && logoUrl ? (
              <View
                style={styles.logoSlot}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <LogoIconFrame
                  uri={logoUrl}
                  size={TITLE_LOGO_SIZE}
                  onError={() => setLogoFailed(true)}
                />
              </View>
            ) : null}
            <Text
              style={[styles.accountName, { color: palette.text, fontFamily: aiWidgetFonts.title }]}
              {...aiWidgetLabelTextProps}
            >
              {accountName}
            </Text>
          </View>
          {accountMeta ? (
            <Text
              style={[
                styles.accountMeta,
                { color: palette.textMuted, fontFamily: aiWidgetFonts.labelRegular },
                showLogo && styles.accountMetaWithLogo,
              ]}
              {...aiWidgetLabelTextProps}
            >
              {accountMeta}
            </Text>
          ) : null}
        </View>
      ) : null}

      <Text
        style={[aiWidgetTypography.value, styles.amount, { color: palette.text }]}
        {...aiWidgetHeroAmountTextProps}
      >
        {formatValueLabel(data.value_label)}
      </Text>

      <View style={styles.footerRow}>
        {data.trend_label ? (
          <View style={[styles.trendPill, { backgroundColor: trendWellBg }]}>
            <Text
              style={[
                aiWidgetAmountTypography('caption'),
                styles.trendText,
                { color: trendColor },
              ]}
              numberOfLines={2}
            >
              {data.trend_label}
            </Text>
          </View>
        ) : (
          <View style={styles.trendSpacer} />
        )}

        {canNavigate ? (
          <View
            style={[styles.actionButton, { borderColor: palette.border, backgroundColor: palette.track }]}
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
          >
            <AppIcon family="material-community" name="chevron-right" size={18} color={palette.textMuted} />
          </View>
        ) : null}
      </View>
    </WidgetCardShell>
  );

  if (!canNavigate) return content;

  return (
    <Pressable
      onPress={handlePress}
      disabled={navigating}
      style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={
        data.action?.label ??
        (accountMode
          ? `Solde ${accountName ?? 'du compte'}`.trim()
          : data.label || 'Solde total')
      }
    >
      {content}
    </Pressable>
  );
}

const ACTION_BUTTON_SIZE = 36;

const styles = StyleSheet.create({
  shell: {
    gap: spacing.sm,
  },
  eyebrow: {
    marginBottom: spacing.xs,
  },
  identityBlock: {
    gap: 2,
    marginBottom: spacing.xs,
    paddingRight: spacing.xs,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 0,
  },
  logoSlot: {
    width: TITLE_LOGO_SIZE,
    height: TITLE_LOGO_SIZE,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountName: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  accountMeta: {
    fontSize: 12,
    lineHeight: 16,
  },
  /** Indent meta under the name when a leading logo is present. */
  accountMetaWithLogo: {
    marginLeft: TITLE_LOGO_SIZE + spacing.sm,
  },
  amount: {
    marginBottom: spacing.xs,
    minWidth: 0,
    width: '100%',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.xs,
    minWidth: 0,
  },
  trendPill: {
    flex: 1,
    alignSelf: 'flex-start',
    borderRadius: AI_WIDGET_RADIUS,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minWidth: 0,
  },
  trendText: {
    fontSize: 12,
    lineHeight: 16,
    flexShrink: 1,
  },
  trendSpacer: {
    flex: 1,
  },
  actionButton: {
    width: ACTION_BUTTON_SIZE,
    height: ACTION_BUTTON_SIZE,
    borderRadius: ACTION_BUTTON_SIZE / 2,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  pressable: {
    width: '100%',
    alignSelf: 'stretch',
  },
  pressed: {
    opacity: 0.82,
  },
});
