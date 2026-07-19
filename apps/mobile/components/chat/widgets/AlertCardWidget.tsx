import { StyleSheet, Text, View } from 'react-native';
import type { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { AppIcon } from '@/components/icons/AppIcon';
import { planFinanceKit, planFinanceSecondaryButtonStyle } from '@/constants/planFinanceKit';
import { spacing } from '@/constants/theme';
import type { AlertCardData } from '@/types/aiWidgets';
import { aiWidgetFonts, aiWidgetTypography, useAIWidgetColors } from './theme';
import { WidgetCardShell } from './WidgetCardShell';

type Props = {
  data: AlertCardData;
};

type MaterialIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

type SeverityStyle = {
  eyebrow: string;
  icon: MaterialIconName;
  accent: string;
  wellBg: string;
};

function resolveSeverityStyle(
  severity: AlertCardData['severity'],
  palette: ReturnType<typeof useAIWidgetColors>,
): SeverityStyle {
  switch (severity) {
    case 'danger':
      return {
        eyebrow: 'ALERTE',
        icon: 'alert-circle-outline',
        accent: palette.red,
        wellBg: palette.dangerMuted,
      };
    case 'warning':
      return {
        eyebrow: 'ALERTE',
        icon: 'alert-outline',
        accent: palette.warning,
        wellBg: palette.warningMuted,
      };
    case 'success':
      return {
        eyebrow: 'CONFIRMATION',
        icon: 'check-circle-outline',
        accent: palette.green,
        wellBg: palette.successMuted,
      };
    case 'info':
    default:
      return {
        eyebrow: 'INFO',
        icon: 'information-outline',
        accent: palette.info,
        wellBg: palette.track,
      };
  }
}

export function AlertCardWidget({ data }: Props) {
  const palette = useAIWidgetColors();
  const severity = resolveSeverityStyle(data.severity, palette);

  return (
    <WidgetCardShell label={severity.eyebrow}>
      <View style={styles.headerRow}>
        <View style={[styles.iconWell, { backgroundColor: severity.wellBg }]}>
          <AppIcon family="material-community" name={severity.icon} size={18} color={severity.accent} />
        </View>

        <View style={styles.copyBlock}>
          <Text style={[styles.title, { color: palette.text, fontFamily: aiWidgetFonts.title }]}>
            {data.title}
          </Text>
          <Text
            style={[
              aiWidgetTypography.insight,
              styles.message,
              { color: palette.textMuted, fontFamily: aiWidgetFonts.labelRegular },
            ]}
          >
            {data.message}
          </Text>
        </View>
      </View>

      {data.action ? (
        <View
          style={[
            styles.actionButton,
            planFinanceSecondaryButtonStyle(),
            { borderColor: palette.border },
          ]}
          accessibilityRole="button"
          accessibilityLabel={data.action.label}
        >
          <Text style={[styles.actionText, { color: palette.text, fontFamily: aiWidgetFonts.label }]}>
            {data.action.label}
          </Text>
        </View>
      ) : null}
    </WidgetCardShell>
  );
}

const ICON_WELL_SIZE = 32;

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  iconWell: {
    width: ICON_WELL_SIZE,
    height: ICON_WELL_SIZE,
    borderRadius: planFinanceKit.radius.small,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  copyBlock: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  title: {
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  message: {
    marginTop: 0,
  },
  actionButton: {
    minHeight: 40,
    alignSelf: 'stretch',
    paddingHorizontal: spacing.md,
  },
  actionText: {
    fontSize: 13,
    letterSpacing: 0.2,
  },
});
