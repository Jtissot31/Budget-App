/**
 * Account balance containers — production MES COMPTES tiles + gallery variants.
 * Even grid cells use {@link AccountPatrimoineTile}; odd-last full-width rows
 * use {@link AccountLineTile}. Other variants stay in
 * `app/account-card-prototypes.tsx` for comparison.
 */
import { useEffect, useState, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type AccessibilityRole,
  type AccessibilityState,
} from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { RemoteLogoImage } from '@/components/IconFrame';
import { SummaryCard, type SummaryStat } from '@/components/kit';
import { OnyxContainer } from '@/components/OnyxContainer';
import { UserPickedIconWell } from '@/components/UserPickedIconWell';
import {
  ONYX_CONTAINER,
  onyxContainerCompactTilePaddingStyle,
  onyxContainerPressedStyle,
  onyxContainerRowLayoutStyle,
} from '@/constants/planFinanceKit';
import { ICON_WELL_SIZE, moneyAmountTypography, spacing, typographyKit } from '@/constants/theme';
import {
  accountBalanceIconTone,
  accountBalanceRowTitle,
  accountBalanceSubtitle,
  accountBalanceValueColor,
  accountKindTypeLabel,
  resolveSimulatedAccountLogoSources,
} from '@/lib/accountBalancePresentation';
import { creditLimitUtilizationPercent, creditUsedFromBalance } from '@/lib/creditLimitUtilization';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { useAppTheme } from '@/lib/themeContext';
import {
  logoIconWellStyle,
  userPickedIconGlyphSize,
  userPickedIconWellStyle,
} from '@/lib/userPickedIcon';
import type { AccountKind, SimulatedAccount } from '@/types';

/** Compact tiles need a larger fill than the default 68% merchant inset. */
const INSTITUTION_LOGO_INSET_RATIO = 0.9;
/** Wide card-network wordmarks (Visa, etc.) — nearly full-well contain. */
const CARD_NETWORK_LOGO_INSET_RATIO = 0.96;
const CARD_NETWORK_LOGO_URI_RE = /visa|mastercard|amex|americanexpress|discover/i;
/**
 * Quiet « Solde dû » caption line — always reserved on patrimoine tiles so
 * credit owed and non-credit cells share one 2-col height (odd-last line tile
 * is a different format and is not constrained by this).
 */
const PATRIMOINE_CAPTION_LINE_HEIGHT = typographyKit.micro.lineHeight;
/** cardMetric (16) default line box — keeps the amount block floor stable. */
const PATRIMOINE_AMOUNT_LINE_HEIGHT = 20;
/** Onyx content floor: header + name + caption slot + amount (compact pad). */
const PATRIMOINE_TILE_MIN_HEIGHT = 132;

export type AccountCardPrototypeProps = {
  account: SimulatedAccount;
  onPress?: () => void;
};

export type AccountPatrimoineTileProps = {
  account: SimulatedAccount;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Mask the amount (œil « masquer les soldes »). */
  hideBalance?: boolean;
  /**
   * Replaces the institution mark (e.g. manage-mode checkbox).
   * When omitted, the system logo / glyph well is shown.
   */
  headerAccessory?: ReactNode;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  accessibilityLabel?: string;
  /**
   * When false, render the Onyx shell only — parent owns press/drag
   * (e.g. Sortable.Touchable in MES COMPTES).
   */
  pressable?: boolean;
};

/** Same production affordances as {@link AccountPatrimoineTile} for odd-last rows. */
export type AccountLineTileProps = AccountPatrimoineTileProps;

/** Even padding for logos inside the white app-icon tile. */
const TILE_LOGO_INSET_RATIO = 0.14;

function kindIcon(kind: AccountKind): string {
  if (kind === 'credit') return 'card-outline';
  if (kind === 'savings') return 'wallet-outline';
  return 'cash-outline';
}

/** Minus sign is U+2212 so it lines up with Inter numeric amounts. */
function formatSignedBalance(balance: number): string {
  const amount = formatDisplayMoneyAbsolute(Math.abs(balance));
  return balance < 0 ? `−${amount}` : amount;
}

function institutionLogoInsetRatio(logoUrl: string, account: SimulatedAccount): number {
  const haystack = `${logoUrl} ${account.name} ${account.institution ?? ''}`;
  return CARD_NETWORK_LOGO_URI_RE.test(haystack)
    ? CARD_NETWORK_LOGO_INSET_RATIO
    : INSTITUTION_LOGO_INSET_RATIO;
}

/**
 * Institution mark — system logo well (`ICON_WELL_SIZE` / `logoIconWellStyle`).
 * Remote logos use a transparent plate; glyph fallbacks keep the charcoal/light well.
 * Pass `transparentWell` to also clear the glyph well fill on MES COMPTES tiles.
 */
export function InstitutionMark({
  account,
  size = ICON_WELL_SIZE,
  tinted = false,
  transparentWell = false,
  tile = false,
}: {
  account: SimulatedAccount;
  size?: number;
  tinted?: boolean;
  /** Tile-local: clear filled grey circle behind logos/icons. */
  transparentWell?: boolean;
  /** List-row look: logo on a transparent background with an even inset. */
  tile?: boolean;
}) {
  const { colors, isLight } = useAppTheme();
  const manualIcon = account.icon?.trim() || null;
  const { asset, urls } = resolveSimulatedAccountLogoSources(account);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [assetFailed, setAssetFailed] = useState(false);
  const [remoteFailed, setRemoteFailed] = useState(false);

  useEffect(() => {
    setSourceIndex(0);
    setAssetFailed(false);
    setRemoteFailed(false);
  }, [asset, urls.join('|')]);

  if (manualIcon) {
    return (
      <UserPickedIconWell
        icon={manualIcon}
        size={size}
        style={transparentWell ? styles.transparentWell : undefined}
      />
    );
  }

  const preferAsset = asset != null && !assetFailed;
  const uri = !preferAsset && !remoteFailed ? urls[sourceIndex] : null;
  const showLogo = preferAsset || Boolean(uri);
  const glyphColor = tinted
    ? accountBalanceIconTone(account.kind, colors)
    : colors.textMuted;
  const insetRatio = uri
    ? institutionLogoInsetRatio(uri, account)
    : INSTITUTION_LOGO_INSET_RATIO;

  return (
    <View
      style={[
        showLogo ? logoIconWellStyle(size, isLight) : userPickedIconWellStyle(size, isLight),
        transparentWell && styles.transparentWell,
        tile && showLogo && {
          backgroundColor: 'transparent',
          borderWidth: 0,
        },
        tile && !showLogo && { backgroundColor: colors.surfaceElevated, borderRadius: Math.round(size * 0.28), borderWidth: 0 },
        styles.mark,
      ]}
    >
      {preferAsset && asset != null ? (
        <RemoteLogoImage
          asset={asset}
          size={size}
          contentFit="contain"
          insetRatio={tile ? TILE_LOGO_INSET_RATIO : CARD_NETWORK_LOGO_INSET_RATIO}
          onError={() => setAssetFailed(true)}
        />
      ) : uri ? (
        <RemoteLogoImage
          uri={uri}
          size={size}
          contentFit="contain"
          insetRatio={tile ? TILE_LOGO_INSET_RATIO : insetRatio}
          onError={() => {
            if (sourceIndex < urls.length - 1) {
              setSourceIndex((i) => i + 1);
            } else {
              setRemoteFailed(true);
            }
          }}
        />
      ) : (
        <AppIcon
          family="ionicons"
          name={kindIcon(account.kind)}
          size={userPickedIconGlyphSize(size)}
          color={glyphColor}
        />
      )}
    </View>
  );
}

/** Thin utilization track — credit only. */
function UtilizationTrack({ percent, tone }: { percent: number; tone: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.track, { backgroundColor: colors.borderSubtle }]}>
      <View style={[styles.trackFill, { width: `${Math.min(percent, 100)}%`, backgroundColor: tone }]} />
    </View>
  );
}

function creditMeta(account: SimulatedAccount): {
  utilization: number | undefined;
  used: number;
  remaining: number | undefined;
} {
  const used = creditUsedFromBalance(account.balance);
  const utilization = creditLimitUtilizationPercent(account.balance, account.creditLimit);
  const remaining =
    typeof account.creditLimit === 'number' && account.creditLimit > 0
      ? Math.max(account.creditLimit - used, 0)
      : undefined;
  return { utilization, used, remaining };
}

function PrototypeShell({
  onPress,
  accessibilityLabel,
  children,
  style,
}: {
  onPress?: () => void;
  accessibilityLabel: string;
  children: React.ReactNode;
  style?: React.ComponentProps<typeof OnyxContainer>['style'];
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [pressed && onyxContainerPressedStyle()]}
    >
      <OnyxContainer style={style}>{children}</OnyxContainer>
    </Pressable>
  );
}

/**
 * Production MES COMPTES odd-last row — dense full-width « ligne éditoriale »
 * (WealthHoldingTile rhythm): mark · name + type · balance. Used when the
 * accounts grid has an odd count so the last cell is not a stretched patrimoine tile.
 * Colors via {@link accountBalanceValueColor} — crédit dû stays neutral.
 */
export function AccountLineTile({
  account,
  onPress,
  onLongPress,
  hideBalance = false,
  headerAccessory,
  accessibilityRole = 'button',
  accessibilityState,
  accessibilityLabel,
  pressable = true,
}: AccountLineTileProps) {
  const { colors } = useAppTheme();
  const title = accountBalanceRowTitle(account);
  const institution = accountBalanceSubtitle(account);
  const meta = [accountKindTypeLabel(account.kind), institution].filter(Boolean).join(' · ');
  const label =
    accessibilityLabel ?? `${title}, ${formatDisplayMoneyAbsolute(account.balance)}`;

  const body = (
    <OnyxContainer style={onyxContainerRowLayoutStyle()}>
      {headerAccessory ?? (
        <InstitutionMark account={account} size={36} transparentWell />
      )}
      <View style={styles.rowCopy}>
        <Text
          style={[typographyKit.rowTitle, styles.rowTitleTight, { color: colors.text }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text style={[typographyKit.micro, { color: colors.textMuted }]} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      <Text
        style={[
          moneyAmountTypography({ tier: 'row' }),
          { color: accountBalanceValueColor(account, colors.text), flexShrink: 0 },
        ]}
        numberOfLines={1}
      >
        {hideBalance ? '••••' : formatSignedBalance(account.balance)}
      </Text>
    </OnyxContainer>
  );

  if (!pressable) {
    return <View style={styles.linePress}>{body}</View>;
  }

  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState}
      accessibilityLabel={label}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={380}
      style={({ pressed }) => [styles.linePress, pressed && onyxContainerPressedStyle()]}
    >
      {body}
    </Pressable>
  );
}

/**
 * Variante 1 — Ligne éditoriale (gallery).
 * Same shell as production {@link AccountLineTile}.
 */
export function AccountLinePrototype({ account, onPress }: AccountCardPrototypeProps) {
  return <AccountLineTile account={account} onPress={onPress} />;
}

/**
 * Variante 2 — Solde monument.
 * Balance is the only hero. Quiet type eyebrow + mark; name as caption.
 * Credit debt is labeled « Solde dû » — not reddened — with a utilization track.
 */
export function AccountMonumentPrototype({ account, onPress }: AccountCardPrototypeProps) {
  const { colors } = useAppTheme();
  const title = accountBalanceRowTitle(account);
  const institution = accountBalanceSubtitle(account);
  const isCredit = account.kind === 'credit';
  const owed = isCredit && account.balance < 0;
  const { utilization, remaining } = creditMeta(account);
  const tone = accountBalanceIconTone(account.kind, colors);

  return (
    <PrototypeShell
      onPress={onPress}
      accessibilityLabel={`${title}, ${formatDisplayMoneyAbsolute(account.balance)}`}
      style={styles.cardPad}
    >
      <View style={styles.monumentTop}>
        <Text style={[typographyKit.eyebrow, styles.eyebrowFlex, { color: colors.textMuted }]} numberOfLines={1}>
          {accountKindTypeLabel(account.kind).toUpperCase()}
        </Text>
        <InstitutionMark account={account} size={ICON_WELL_SIZE} />
      </View>

      <View style={styles.amountStack}>
        <Text style={[typographyKit.micro, { color: colors.textMuted }]}>
          {owed ? 'Solde dû' : 'Solde disponible'}
        </Text>
        <Text
          style={[
            moneyAmountTypography({ tier: 'hero' }),
            { color: accountBalanceValueColor(account, colors.text) },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {formatDisplayMoneyAbsolute(Math.abs(account.balance))}
        </Text>
      </View>

      <Text style={[typographyKit.metaMedium, { color: colors.textSecondary }]} numberOfLines={1}>
        {institution ? `${title} · ${institution}` : title}
      </Text>

      {isCredit && utilization != null ? (
        <View style={styles.trackBlock}>
          <UtilizationTrack percent={utilization} tone={tone} />
          <Text style={[typographyKit.micro, { color: colors.textMuted }]} numberOfLines={1}>
            {Math.round(utilization)} % de la limite
            {remaining != null ? ` · ${formatDisplayMoneyAbsolute(remaining)} de marge` : ''}
          </Text>
        </View>
      ) : null}
    </PrototypeShell>
  );
}

/**
 * Production MES COMPTES tile — compact Onyx 2-column patrimoine rhythm
 * (StockHoldingTile): type + mark on top, name, balance anchored bottom-right.
 * Credit debt stays neutral via {@link accountBalanceValueColor}; quiet
 * « Solde dû » caption when owed — caption line slot is always reserved so
 * 2-col tiles stay equal height.
 */
export function AccountPatrimoineTile({
  account,
  onPress,
  onLongPress,
  hideBalance = false,
  headerAccessory,
  accessibilityRole = 'button',
  accessibilityState,
  accessibilityLabel,
  pressable = true,
}: AccountPatrimoineTileProps) {
  const { colors } = useAppTheme();
  const title = accountBalanceRowTitle(account);
  const typeLabel = accountKindTypeLabel(account.kind);
  const showOwedCaption = account.kind === 'credit' && account.balance < 0 && !hideBalance;
  const label =
    accessibilityLabel ?? `${title}, ${formatDisplayMoneyAbsolute(account.balance)}`;

  const body = (
    <OnyxContainer style={styles.patrimoineCard}>
      <View style={styles.patrimoineHeader}>
        <Text
          style={[typographyKit.microUpper, { color: colors.textMuted, flex: 1, minWidth: 0 }]}
          numberOfLines={1}
        >
          {typeLabel}
        </Text>
        {headerAccessory ?? (
          <InstitutionMark account={account} size={ICON_WELL_SIZE} transparentWell />
        )}
      </View>

      <Text style={[typographyKit.listPrimary, { color: colors.text }]} numberOfLines={1}>
        {title}
      </Text>

      <View style={styles.patrimoineValueRow}>
        <View style={styles.patrimoineCaptionSlot} accessibilityElementsHidden={!showOwedCaption}>
          {showOwedCaption ? (
            <Text style={[typographyKit.micro, { color: colors.textMuted }]} numberOfLines={1}>
              Solde dû
            </Text>
          ) : null}
        </View>
        <Text
          style={[
            moneyAmountTypography({ tier: 'card', textAlign: 'right' }),
            { color: accountBalanceValueColor(account, colors.text) },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.65}
        >
          {hideBalance ? '••••' : formatSignedBalance(account.balance)}
        </Text>
      </View>
    </OnyxContainer>
  );

  if (!pressable) {
    return <View style={styles.patrimoinePress}>{body}</View>;
  }

  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState}
      accessibilityLabel={label}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={380}
      style={({ pressed }) => [styles.patrimoinePress, pressed && onyxContainerPressedStyle()]}
    >
      {body}
    </Pressable>
  );
}

/** Gallery alias — same shell as production MES COMPTES. */
export function AccountPatrimoinePrototype({ account, onPress }: AccountCardPrototypeProps) {
  return <AccountPatrimoineTile account={account} onPress={onPress} />;
}

function accountDetailBalanceCaption(account: SimulatedAccount): string {
  if (account.kind === 'credit') {
    return account.balance < 0 ? 'Solde dû' : 'Solde';
  }
  if (account.kind === 'savings') return 'Solde';
  return 'Solde disponible';
}

/**
 * Account detail hero — Onyx monument (not the old dashed wallet / ID-1 card).
 * Display-only; parent owns edit / overflow.
 */
export function AccountDetailHeroCard({ account }: { account: SimulatedAccount }) {
  const { colors } = useAppTheme();
  const isCredit = account.kind === 'credit';
  const { remaining } = creditMeta(account);
  const creditLimit =
    typeof account.creditLimit === 'number' && account.creditLimit > 0
      ? account.creditLimit
      : undefined;
  const showCreditMeta = isCredit && (remaining != null || creditLimit != null);

  return (
    <OnyxContainer style={styles.cardPad}>
      <View style={styles.monumentTop}>
        <Text
          style={[typographyKit.eyebrow, styles.eyebrowFlex, { color: colors.textMuted }]}
          numberOfLines={1}
        >
          {accountKindTypeLabel(account.kind)}
        </Text>
        <InstitutionMark account={account} size={ICON_WELL_SIZE} transparentWell />
      </View>

      <View style={[styles.amountStack, showCreditMeta && styles.amountStackCredit]}>
        <Text style={[typographyKit.micro, { color: colors.textMuted }]}>
          {accountDetailBalanceCaption(account)}
        </Text>
        <Text
          style={[
            moneyAmountTypography({ tier: 'hero' }),
            { color: accountBalanceValueColor(account, colors.text) },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {formatSignedBalance(account.balance)}
        </Text>
        {showCreditMeta ? (
          <View style={styles.creditMetaStack}>
            {remaining != null ? (
              <View style={styles.creditAvailableBlock}>
                <Text style={[typographyKit.microUpper, { color: colors.textMuted }]}>Disponible</Text>
                <Text
                  style={[moneyAmountTypography({ tier: 'card' }), { color: colors.text }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                >
                  {formatDisplayMoneyAbsolute(remaining)}
                </Text>
              </View>
            ) : null}
            {creditLimit != null ? (
              <Text style={[typographyKit.micro, { color: colors.textMuted }]} numberOfLines={1}>
                Limite · {formatDisplayMoneyAbsolute(creditLimit)}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </OnyxContainer>
  );
}

/**
 * Account detail summary — same shell as the tab summaries (kit SummaryCard).
 * Credit accounts show available / limit; callers append monthly flow stats.
 */
export function AccountDetailSummaryCard({
  account,
  stats = [],
  footer,
  badge,
  children,
}: {
  account: SimulatedAccount;
  stats?: SummaryStat[];
  footer?: string;
  badge?: { label: string; color: string };
  children?: ReactNode;
}) {
  const { colors } = useAppTheme();
  const { remaining, utilization } = creditMeta(account);
  const creditLimit =
    typeof account.creditLimit === 'number' && account.creditLimit > 0 ? account.creditLimit : undefined;
  const creditStats: SummaryStat[] =
    account.kind === 'credit'
      ? [
          ...(remaining != null ? [{ label: 'Disponible', value: formatDisplayMoneyAbsolute(remaining) }] : []),
          ...(creditLimit != null ? [{ label: 'Limite', value: formatDisplayMoneyAbsolute(creditLimit) }] : []),
        ]
      : [];
  const tone =
    utilization == null ? colors.accentGreen : utilization >= 90 ? colors.danger : utilization >= 70 ? colors.warning : colors.accentGreen;

  return (
    <SummaryCard
      label={accountDetailBalanceCaption(account)}
      amount={formatSignedBalance(account.balance)}
      amountValue={account.balance}
      formatAmount={formatSignedBalance}
      amountColor={accountBalanceValueColor(account, colors.text)}
      badge={badge ?? (utilization != null ? { label: `${Math.round(utilization)} % utilisé`, color: tone } : undefined)}
      stats={[...creditStats, ...stats]}
      footer={footer}
    >
      {utilization != null ? (
        <View style={[styles.track, { backgroundColor: colors.borderSubtle }]}>
          <View style={[styles.trackFill, { width: `${Math.min(utilization, 100)}%`, backgroundColor: tone }]} />
        </View>
      ) : null}
      {children}
    </SummaryCard>
  );
}

/**
 * Variante 4 — Colonnes.
 * Bilateral split: identity left, amount right, hairline divider. Quiet and
 * scannable — balance never fights the name for horizontal space.
 */
export function AccountSplitPrototype({ account, onPress }: AccountCardPrototypeProps) {
  const { colors } = useAppTheme();
  const title = accountBalanceRowTitle(account);
  const institution = accountBalanceSubtitle(account);
  const isCredit = account.kind === 'credit';
  const owed = isCredit && account.balance < 0;
  const meta = [accountKindTypeLabel(account.kind), institution].filter(Boolean).join(' · ');

  return (
    <PrototypeShell
      onPress={onPress}
      accessibilityLabel={`${title}, ${formatDisplayMoneyAbsolute(account.balance)}`}
      style={styles.splitCard}
    >
      <View style={styles.splitLeft}>
        <InstitutionMark account={account} size={36} />
        <View style={styles.rowCopy}>
          <Text style={[typographyKit.rowTitle, styles.rowTitleTight, { color: colors.text }]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={[typographyKit.micro, { color: colors.textMuted }]} numberOfLines={1}>
            {meta}
          </Text>
        </View>
      </View>

      <View style={[styles.splitRule, { backgroundColor: colors.borderSubtle }]} />

      <View style={styles.splitRight}>
        <Text style={[typographyKit.micro, { color: colors.textMuted }]} numberOfLines={1}>
          {owed ? 'Dû' : 'Solde'}
        </Text>
        <Text
          style={[
            moneyAmountTypography({ tier: 'card', textAlign: 'right' }),
            { color: accountBalanceValueColor(account, colors.text) },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {formatDisplayMoneyAbsolute(Math.abs(account.balance))}
        </Text>
      </View>
    </PrototypeShell>
  );
}

/**
 * Variante 5 — Rail discret.
 * Single kind-tone hairline on the left — no wash, no badge. Balance mid-weight
 * (`stat`); credit shows utilization only. Premium cue without loud chrome.
 */
export function AccountQuietRailPrototype({ account, onPress }: AccountCardPrototypeProps) {
  const { colors } = useAppTheme();
  const title = accountBalanceRowTitle(account);
  const institution = accountBalanceSubtitle(account);
  const isCredit = account.kind === 'credit';
  const owed = isCredit && account.balance < 0;
  const { utilization, remaining } = creditMeta(account);
  const tone = accountBalanceIconTone(account.kind, colors);

  return (
    <PrototypeShell
      onPress={onPress}
      accessibilityLabel={`${title}, ${formatDisplayMoneyAbsolute(account.balance)}`}
      style={styles.railCard}
    >
      <View pointerEvents="none" style={[styles.quietRail, { backgroundColor: tone }]} />

      <View style={styles.railHeader}>
        <InstitutionMark account={account} size={34} tinted />
        <View style={styles.rowCopy}>
          <Text style={[typographyKit.rowTitle, styles.rowTitleTight, { color: colors.text }]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={[typographyKit.micro, { color: colors.textMuted }]} numberOfLines={1}>
            {[accountKindTypeLabel(account.kind), institution].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </View>

      <View style={styles.railAmountRow}>
        <Text style={[typographyKit.micro, { color: colors.textMuted }]}>
          {owed ? 'Dû' : 'Disponible'}
        </Text>
        <Text
          style={[
            moneyAmountTypography({ tier: 'stat' }),
            { color: accountBalanceValueColor(account, colors.text), flexShrink: 1 },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {formatDisplayMoneyAbsolute(Math.abs(account.balance))}
        </Text>
      </View>

      {isCredit && utilization != null ? (
        <View style={styles.trackBlock}>
          <UtilizationTrack percent={utilization} tone={tone} />
          <Text style={[typographyKit.micro, { color: colors.textMuted }]} numberOfLines={1}>
            {remaining != null
              ? `${formatDisplayMoneyAbsolute(remaining)} de marge restante`
              : `${Math.round(utilization)} % de la limite`}
          </Text>
        </View>
      ) : null}
    </PrototypeShell>
  );
}

const styles = StyleSheet.create({
  mark: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  /** MES COMPTES only — keep 34px hit box, drop solid grey fill. */
  transparentWell: {
    backgroundColor: 'transparent',
  },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  rowTitleTight: { fontSize: 14, lineHeight: 18 },
  eyebrowFlex: { flex: 1, minWidth: 0 },
  cardPad: { padding: ONYX_CONTAINER.padding.card, gap: spacing.md },
  monumentTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  amountStack: { gap: 2 },
  amountStackCredit: { gap: 6 },
  creditMetaStack: { gap: 4, marginTop: 2 },
  creditAvailableBlock: { gap: 2 },
  trackBlock: { gap: 6 },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  trackFill: { height: '100%', borderRadius: 2 },

  linePress: { width: '100%' },
  patrimoinePress: { width: '100%' },
  patrimoineCard: {
    width: '100%',
    ...onyxContainerCompactTilePaddingStyle(),
    minHeight: PATRIMOINE_TILE_MIN_HEIGHT,
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  patrimoineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  /** Caption slot + amount — same floor with or without « Solde dû ». */
  patrimoineValueRow: {
    alignItems: 'flex-end',
    gap: 2,
    minHeight: PATRIMOINE_CAPTION_LINE_HEIGHT + 2 + PATRIMOINE_AMOUNT_LINE_HEIGHT,
  },
  patrimoineCaptionSlot: {
    minHeight: PATRIMOINE_CAPTION_LINE_HEIGHT,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    alignSelf: 'stretch',
  },

  splitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: ONYX_CONTAINER.padding.row,
    gap: spacing.md,
  },
  splitLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  splitRule: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
  splitRight: {
    flexShrink: 0,
    alignItems: 'flex-end',
    gap: 2,
    maxWidth: '42%',
  },

  railCard: {
    paddingVertical: ONYX_CONTAINER.padding.row + 2,
    paddingRight: ONYX_CONTAINER.padding.row + 2,
    paddingLeft: ONYX_CONTAINER.padding.row + 6,
    gap: spacing.md,
  },
  quietRail: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: StyleSheet.hairlineWidth * 3,
  },
  railHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  railAmountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
});
