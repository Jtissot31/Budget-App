import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DASHBOARD_VALUE_GREEN, darkColors } from '@/constants/theme';
type Props = {
  children: ReactNode;
};

type State = {
  error: Error | null;
};

/** Catches render errors on native so a blank screen becomes a readable failure. */
export class RootErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    // Web uses a noop SQLite stub — never hard-crash the shell for leftover sqlite noise.
    // Also swallow FontFaceObserver / expo-font web timeouts (`6000ms timeout exceeded`).
    const message = (error?.message ?? '').toLowerCase();
    if (
      message.includes('sqlite') ||
      message.includes('opfs') ||
      message.includes('wa-sqlite') ||
      message.includes('workerchannel') ||
      /\d+ms timeout exceeded/.test(message)
    ) {
      return { error: null };
    }
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Boot] uncaught render error', error, info.componentStack);
  }

  private reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    const message = this.state.error.message || 'Erreur inconnue';

    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>L&apos;application a rencontré une erreur</Text>
          <Text style={styles.body}>{message}</Text>
          <Pressable onPress={this.reset} style={styles.button} accessibilityRole="button">
            <Text style={styles.buttonText}>Réessayer</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: darkColors.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  title: {
    color: '#F5F5F5',
    fontSize: 20,
    fontWeight: '800',
  },
  body: {
    color: 'rgba(245,245,245,0.78)',
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: DASHBOARD_VALUE_GREEN,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  buttonText: {
    color: darkColors.background,
    fontSize: 14,
    fontWeight: '800',
  },
});
